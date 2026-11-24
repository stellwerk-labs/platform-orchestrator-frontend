import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { load } from 'js-yaml';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import '@src/i18n/i18n';

import { AXIOS_INSTANCE } from '@src/custom-instance';
import { getListProjectsQueryKey } from '@src/hooks/react-query/v2/controlplane/project/project';
import { getCheckPermissionsQueryKey } from '@src/hooks/react-query/v2/iam/user/user';
import { getAllPagesQueryKey } from '@src/hooks/useFetchAllPages';
import { RBACPermission } from '@src/hooks/useRBAC';
import type {
  PipelineCatalogue,
  PipelineDraftCreate,
  PipelineDraftWrite,
  PipelinePolicyWrite,
  PipelinePublish,
} from '@src/models/pipelines';
import { server } from '@src/testing-utils/mswServer';

import { Pipelines } from './Pipelines';

const originalBase = AXIOS_INSTANCE.defaults.baseURL;
const checks = [
  RBACPermission.PIPELINE_READ,
  RBACPermission.PIPELINE_WRITE,
  RBACPermission.PIPELINE_PUBLISH,
].map((permission) => ({ resource: 'project:project-uuid', permission }));
let clients: QueryClient[] = [];
let requests: { method: string; path: string; body: unknown }[] = [];
let catalogue: PipelineCatalogue;
let conflict = false;
const fixture = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  let raw = '';
  request.on('data', (chunk) => {
    raw += chunk;
  });
  request.on('end', () => {
    const body = raw
      ? request.headers['content-type'] === 'application/yaml'
        ? load(raw)
        : JSON.parse(raw)
      : undefined;
    const path = request.url ?? '';
    requests.push({ method: request.method ?? '', path, body });
    const reply = (value: unknown, status = 200) => {
      response.statusCode = status;
      response.end(JSON.stringify(value));
    };
    if (path.endsWith('/validate')) {
      const document = body as PipelineDraftCreate;
      reply({
        valid: true,
        document: { definition: document.definition, name: document.name, slug: document.slug },
        errors: [],
      });
      return;
    }
    if (path.endsWith('/schema')) {
      reply({ message: 'Schema temporarily unavailable' }, 503);
      return;
    }
    if (request.method === 'GET') {
      if (path.includes('/envs')) {
        reply({
          items: [{ id: 'production', uuid: 'environment-uuid', display_name: 'Production' }],
        });
        return;
      }
      reply(catalogue);
      return;
    }
    if (conflict) {
      reply({ message: 'Conflict' }, 409);
      return;
    }
    if (path.endsWith('/publish')) {
      const publish = body as PipelinePublish;
      const draft = catalogue.drafts[0]!;
      if (publish.expected_resource_version !== draft.resource_version || !publish.request_key) {
        reply({}, 409);
        return;
      }
      const version = {
        id: 'version-id',
        pipeline_id: draft.id,
        project_id: 'project',
        version: 1,
        name: draft.name,
        digest: 'sha256:immutable',
        definition: structuredClone(draft.definition),
        published_at: '2026-11-17T10:00:00Z',
        published_by: 'publisher',
      };
      catalogue.versions = [version];
      reply(version);
      return;
    }
    if (path.endsWith('/policy')) {
      const policy = body as PipelinePolicyWrite;
      if (policy.expected_resource_version !== catalogue.policy.resource_version) {
        reply({}, 409);
        return;
      }
      catalogue.policy = { ...policy, resource_version: catalogue.policy.resource_version + 1 };
      reply(catalogue.policy);
      return;
    }
    if (request.method === 'POST') {
      const draft = body as PipelineDraftCreate;
      const saved = {
        ...draft,
        id: 'draft-id',
        project_id: 'project',
        resource_version: 1,
        updated_at: '2026-11-17T10:00:00Z',
        updated_by: 'editor',
      };
      catalogue.drafts = [saved];
      reply(saved, 201);
      return;
    }
    const updatePayload = body as PipelineDraftWrite;
    const current = catalogue.drafts[0]!;
    if (
      path.endsWith('/document')
        ? request.headers['if-match'] !== `"${current.resource_version}"`
        : updatePayload.expected_resource_version !== current.resource_version
    ) {
      reply({}, 409);
      return;
    }
    const updatedDraft = {
      ...current,
      ...updatePayload,
      resource_version: current.resource_version + 1,
    };
    catalogue.drafts = [updatedDraft];
    reply(updatedDraft);
  });
});

beforeAll(async () => {
  await new Promise<void>((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  AXIOS_INSTANCE.defaults.baseURL = `http://127.0.0.1:${(fixture.address() as AddressInfo).port}`;
  server.close();
});
beforeEach(() => {
  requests = [];
  conflict = false;
  catalogue = {
    drafts: [],
    versions: [],
    policy: { resource_version: 0, enabled: false, allowed_version_ids: [] },
    tools: [
      {
        id: 'validate-manifest',
        name: 'Validate manifest',
        phase: 'pre_plan',
        description: 'Validate the deployment manifest.',
        required_capabilities: ['manifest.validate.v1'],
      },
    ],
  };
});
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients = [];
});
afterAll(async () => {
  AXIOS_INSTANCE.defaults.baseURL = originalBase;
  server.listen();
  fixture.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    fixture.close((error) => (error ? reject(error) : resolve())),
  );
});

const setup = (canRead = true, canEdit = true, canPublish = true) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(client);
  client.setQueryData(getAllPagesQueryKey(getListProjectsQueryKey('org')), [
    { id: 'project', uuid: 'project-uuid', display_name: 'Project' },
  ]);
  client.setQueryData(getCheckPermissionsQueryKey(checks), {
    items: checks.map((permission_check, index) => ({
      permission_check,
      allowed: [canRead, canEdit, canPublish][index],
    })),
  });
  const router = createMemoryRouter([{ path: '/orgs/:orgId/pipelines', element: <Pipelines /> }], {
    initialEntries: ['/orgs/org/pipelines?project=project'],
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return client;
};

const createDraft = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Create pipeline' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Reviewed production');
  await userEvent.type(screen.getByRole('textbox', { name: 'Pipeline ID' }), 'reviewed-production');
  await userEvent.click(screen.getByRole('combobox', { name: 'Deployment flow' }));
  await userEvent.click(screen.getByText('Plan, review and apply'));
  await userEvent.click(screen.getByRole('switch', { name: 'Estimate monthly cost' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Approval' }));
  await userEvent.click(screen.getByText('Auto-approve when cost does not increase'));
  await userEvent.click(screen.getByRole('combobox', { name: 'Add preparation step' }));
  await userEvent.click(screen.getByText('Validate manifest'));
  await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Publish version' })).not.toBeDisabled(),
  );
};

describe('Persisted project pipeline authoring', () => {
  it('starts a fresh editor session when a different pipeline is opened', async () => {
    const first: PipelineCatalogue['drafts'][number] = {
      id: 'first-id',
      project_id: 'project',
      name: 'First pipeline',
      slug: 'first-pipeline',
      definition: { strategy: 'apply', steps: [] },
      resource_version: 1,
      updated_at: '',
      updated_by: 'editor',
    };
    catalogue.drafts = [
      first,
      { ...first, id: 'second-id', name: 'Second pipeline', slug: 'second-pipeline' },
    ];
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'First pipeline' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Code' }));
    expect(await screen.findByRole('textbox', { name: 'Pipeline source' })).toHaveDisplayValue(
      /first-pipeline/,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Second pipeline' }));
    expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveValue('Second pipeline');
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: 'Code' }));
    expect(await screen.findByRole('textbox', { name: 'Pipeline source' })).toHaveDisplayValue(
      /second-pipeline/,
    );
  });

  it('keeps a newly created source buffer and editing mode through its first save', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Create pipeline' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'New source draft');
    await userEvent.type(screen.getByRole('textbox', { name: 'Pipeline ID' }), 'new-source');
    await userEvent.click(screen.getByRole('radio', { name: 'Code' }));
    await screen.findByText(/Schema completion could not be loaded/);
    const source =
      '# Preserve this new buffer\nslug: new-source\nname: New source draft\ndefinition:\n  strategy: apply\n  steps: []\n';
    const input = screen.getByRole('textbox', { name: 'Pipeline source' });
    const user = userEvent.setup();
    await user.clear(input);
    await user.click(input);
    await user.paste(source);
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Publish version' })).toBeEnabled(),
    );
    expect(screen.getByRole('textbox', { name: 'Pipeline source' })).toHaveValue(source);
    await userEvent.click(screen.getByRole('radio', { name: 'Designer' }));
    expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveValue('New source draft');
    expect(screen.getByRole('button', { name: 'Publish version' })).toBeEnabled();
    await userEvent.click(screen.getByRole('radio', { name: 'Code' }));
    expect(await screen.findByRole('textbox', { name: 'Pipeline source' })).toHaveValue(source);
  });

  it('edits raw YAML, saves through document CAS, and keeps source comments out of query and mutation caches', async () => {
    const client = setup();
    await createDraft();
    await userEvent.click(screen.getByRole('radio', { name: 'Code' }));
    await screen.findByText(/Schema completion could not be loaded/);
    const input = screen.getByRole('textbox', { name: 'Pipeline source' });
    const source =
      '# private source comment\nslug: reviewed-production\nname: Production from code\ndefinition:\n  strategy: apply\n  steps: []\n';
    const user = userEvent.setup();
    await user.clear(input);
    await user.click(input);
    await user.paste(source);
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(catalogue.drafts[0]?.name).toBe('Production from code'));
    expect(input).toHaveValue(source);
    expect(requests.find((request) => request.path.endsWith('/document'))?.method).toBe('PUT');
    const cached = JSON.stringify({
      queries: client
        .getQueryCache()
        .getAll()
        .map((query) => query.state),
      mutations: client
        .getMutationCache()
        .getAll()
        .map((mutation) => mutation.state),
    });
    expect(cached).not.toContain('private source comment');
    await userEvent.click(screen.getByRole('radio', { name: 'Designer' }));
    expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveValue(
      'Production from code',
    );
    expect(screen.getByRole('button', { name: 'Publish version' })).toBeEnabled();
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Code' }));
    expect(await screen.findByRole('textbox', { name: 'Pipeline source' })).toHaveValue(source);
    await userEvent.click(screen.getByRole('radio', { name: 'Designer' }));
    await screen.findByRole('combobox', { name: 'Deployment flow' });
    await userEvent.click(screen.getByRole('combobox', { name: 'Deployment flow' }));
    await userEvent.click(screen.getByText('Plan, review and apply'));
    await userEvent.click(screen.getByRole('combobox', { name: 'Deployment flow' }));
    await userEvent.click(
      screen.getByText('Apply directly', { selector: '.ant-select-item-option-content' }),
    );
    expect(screen.getByRole('button', { name: 'Publish version' })).toBeEnabled();
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });

  it('saves a trusted recipe, explicitly publishes an immutable version, then enables it in project policy', async () => {
    setup();
    await createDraft();
    expect(catalogue.drafts[0]?.definition).toEqual({
      strategy: 'reviewed',
      steps: [
        {
          id: 'validate-manifest',
          tool_id: 'validate-manifest',
          phase: 'pre_plan',
          parameters: {},
        },
      ],
      cost: { enabled: true },
      approval: { mode: 'cost_non_increasing' },
    });
    expect(catalogue.versions).toEqual([]);
    expect(catalogue.policy.enabled).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Publish version' }));
    const confirmation = screen
      .getAllByRole('dialog')
      .find((dialog) => within(dialog).queryAllByText('Publish this saved draft?').length > 0)!;
    await userEvent.click(within(confirmation).getByRole('button', { name: 'Publish version' }));
    expect(await screen.findByText('Published version 1')).toBeVisible();
    expect(catalogue.versions[0]?.definition).toEqual(catalogue.drafts[0]?.definition);
    expect(catalogue.policy.enabled).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Deployment policy' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Use published project pipelines' }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Allowed versions' }));
    await userEvent.click(screen.getByText('Reviewed production · v1'));
    await userEvent.click(screen.getByRole('combobox', { name: 'Default version' }));
    await userEvent.click(screen.getAllByText('Reviewed production · v1').pop()!);
    await userEvent.click(screen.getByRole('button', { name: 'Save deployment policy' }));
    await waitFor(() =>
      expect(catalogue.policy).toMatchObject({
        enabled: true,
        allowed_version_ids: ['version-id'],
        default_version_id: 'version-id',
        resource_version: 1,
      }),
    );
    expect(requests.find((request) => request.path.endsWith('/publish'))?.body).toMatchObject({
      expected_resource_version: 1,
      request_key: expect.any(String),
    });
  });

  it('denies authoring fetches without project read permission and never exposes a create action', async () => {
    setup(false, false, false);
    expect(
      await screen.findByText('Pipeline authoring access is required for this project.'),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Create pipeline' })).not.toBeInTheDocument();
    expect(requests).toEqual([]);
  });

  it('blocks an open publication confirmation if publication permission is revoked', async () => {
    const client = setup();
    await createDraft();
    await userEvent.click(screen.getByRole('button', { name: 'Publish version' }));
    await act(async () =>
      client.setQueryData(getCheckPermissionsQueryKey(checks), {
        items: checks.map((permission_check) => ({
          permission_check,
          allowed: permission_check.permission !== RBACPermission.PIPELINE_PUBLISH,
        })),
      }),
    );
    await userEvent.click(
      within(
        screen
          .getAllByRole('dialog')
          .find((dialog) => within(dialog).queryAllByText('Publish this saved draft?').length > 0)!,
      ).getByRole('button', { name: 'Publish version' }),
    );
    await waitFor(() =>
      expect(
        screen.getByText('The pipeline change could not be confirmed. Reload before trying again.'),
      ).toBeVisible(),
    );
    expect(requests.filter((request) => request.path.endsWith('/publish'))).toEqual([]);
  });

  it('preserves unsaved work after an optimistic conflict and does not publish it', async () => {
    setup();
    await createDraft();
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), ' changed');
    conflict = true;
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText(/This draft or policy changed/)).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Reviewed production changed',
    );
    expect(screen.getByRole('button', { name: 'Publish version' })).toBeDisabled();
    expect(catalogue.drafts[0]?.name).toBe('Reviewed production');
  });
});

it('allows an editor to save a draft while keeping publication and deployment policy separately protected', async () => {
  catalogue.drafts = [
    {
      id: 'draft-id',
      project_id: 'project',
      slug: 'editable',
      name: 'Editable pipeline',
      resource_version: 1,
      definition: { strategy: 'apply', steps: [] },
      updated_at: '2026-11-17T10:00:00Z',
      updated_by: 'editor',
    },
  ];
  setup(true, true, false);
  await userEvent.click(await screen.findByRole('button', { name: 'Editable pipeline' }));
  expect(screen.getByRole('button', { name: 'Publish version' })).toBeDisabled();
  await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), ' revised');
  await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(catalogue.drafts[0]?.resource_version).toBe(2));
  expect(screen.getByRole('button', { name: 'Publish version' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  await userEvent.click(screen.getByRole('tab', { name: 'Deployment policy' }));
  expect(screen.getByRole('button', { name: 'Save deployment policy' })).toBeDisabled();
  expect(
    requests.filter(
      (request) => request.path.endsWith('/publish') || request.path.endsWith('/policy'),
    ),
  ).toEqual([]);
});

it('removes allowed and default authority when disabling project pipeline policy', async () => {
  catalogue.versions = [
    {
      id: 'version-id',
      pipeline_id: 'pipeline-id',
      project_id: 'project',
      version: 1,
      name: 'Published',
      digest: 'immutable',
      definition: { strategy: 'apply', steps: [] },
      published_at: '2026-11-17T10:00:00Z',
      published_by: 'publisher',
    },
  ];
  catalogue.policy = {
    resource_version: 3,
    enabled: true,
    allowed_version_ids: ['version-id'],
    default_version_id: 'version-id',
    environment_default_version_ids: { 'environment-uuid': 'version-id' },
  };
  setup();
  await userEvent.click(await screen.findByRole('tab', { name: 'Deployment policy' }));
  await userEvent.click(screen.getByRole('switch', { name: 'Use published project pipelines' }));
  expect(screen.getByRole('combobox', { name: 'Allowed versions' })).toBeDisabled();
  expect(screen.getByRole('combobox', { name: 'Default version' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Save deployment policy' }));
  await waitFor(() => expect(catalogue.policy.enabled).toBe(false));
  expect(requests.find((request) => request.path.endsWith('/policy'))?.body).toEqual({
    expected_resource_version: 3,
    enabled: false,
    allowed_version_ids: [],
  });
});

it('saves an environment default by immutable environment identity using project policy CAS', async () => {
  catalogue.versions = [
    {
      id: 'version-id',
      pipeline_id: 'pipeline-id',
      project_id: 'project',
      version: 1,
      name: 'Published',
      digest: 'immutable',
      definition: { strategy: 'apply', steps: [] },
      published_at: '2026-11-17T10:00:00Z',
      published_by: 'publisher',
    },
  ];
  catalogue.policy = {
    resource_version: 4,
    enabled: true,
    allowed_version_ids: ['version-id'],
    default_version_id: 'version-id',
  };
  setup();
  await userEvent.click(await screen.findByRole('tab', { name: 'Deployment policy' }));
  const environment = screen.getByRole('combobox', { name: 'Environment for default pipeline' });
  await userEvent.click(environment);
  await userEvent.click(
    await screen.findByText('Production (production)', {
      selector: '.ant-select-item-option-content',
    }),
  );
  await userEvent.click(screen.getByRole('combobox', { name: 'Pipeline for environment default' }));
  await userEvent.click(
    await screen.findByText('Published · v1', {
      selector:
        '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-content',
    }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Add default' }));
  expect(
    screen.getByRole('combobox', { name: 'Default pipeline for environment-uuid' }),
  ).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Save deployment policy' }));
  await waitFor(() =>
    expect(catalogue.policy.environment_default_version_ids).toEqual({
      'environment-uuid': 'version-id',
    }),
  );
  expect(
    requests.find((request) => request.method === 'PUT' && request.path.endsWith('/policy'))?.body,
  ).toMatchObject({ expected_resource_version: 4 });
});

it('saves separate project and environment rollback defaults without changing forward defaults', async () => {
  const forward = {
    id: 'forward-version',
    pipeline_id: 'forward-pipeline',
    project_id: 'project',
    version: 1,
    name: 'Forward',
    digest: 'forward-digest',
    definition: { strategy: 'apply' as const, steps: [] },
    published_at: '2026-11-17T10:00:00Z',
    published_by: 'publisher',
  };
  catalogue.versions = [forward, { ...forward, id: 'rollback-version', name: 'Rollback' }];
  catalogue.policy = {
    resource_version: 7,
    enabled: true,
    allowed_version_ids: ['forward-version', 'rollback-version'],
    default_version_id: 'forward-version',
    rollback_defaults: {},
  };
  setup();
  await userEvent.click(await screen.findByRole('tab', { name: 'Deployment policy' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Rollback default version' }));
  await userEvent.click(
    await screen.findByText('Rollback · v1', {
      selector:
        '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-content',
    }),
  );
  await userEvent.click(
    screen.getByRole('combobox', { name: 'Environment for rollback pipeline' }),
  );
  await userEvent.click(
    await screen.findByText('Production (production)', {
      selector:
        '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-content',
    }),
  );
  await userEvent.click(
    screen.getByRole('combobox', { name: 'Pipeline for environment rollback' }),
  );
  await userEvent.click(
    await screen.findByText('Rollback · v1', {
      selector:
        '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-content',
    }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Add rollback default' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save deployment policy' }));
  await waitFor(() =>
    expect(catalogue.policy.rollback_defaults).toEqual({
      default_version_id: 'rollback-version',
      environment_default_version_ids: { 'environment-uuid': 'rollback-version' },
    }),
  );
  expect(
    requests.find((request) => request.method === 'PUT' && request.path.endsWith('/policy'))?.body,
  ).toMatchObject({
    expected_resource_version: 7,
    default_version_id: 'forward-version',
    rollback_defaults: {
      default_version_id: 'rollback-version',
      environment_default_version_ids: { 'environment-uuid': 'rollback-version' },
    },
  });
});

it('explicitly clears rollback defaults when disabling a compatible project policy', async () => {
  catalogue.versions = [
    {
      id: 'version-id',
      pipeline_id: 'pipeline-id',
      project_id: 'project',
      version: 1,
      name: 'Published',
      digest: 'immutable',
      definition: { strategy: 'apply', steps: [] },
      published_at: '2026-11-17T10:00:00Z',
      published_by: 'publisher',
    },
  ];
  catalogue.policy = {
    resource_version: 8,
    enabled: true,
    allowed_version_ids: ['version-id'],
    default_version_id: 'version-id',
    rollback_defaults: {
      default_version_id: 'version-id',
      environment_default_version_ids: { 'environment-uuid': 'version-id' },
    },
  };
  setup();
  await userEvent.click(await screen.findByRole('tab', { name: 'Deployment policy' }));
  await userEvent.click(screen.getByRole('switch', { name: 'Use published project pipelines' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save deployment policy' }));
  await waitFor(() => expect(catalogue.policy.enabled).toBe(false));
  expect(
    requests.find((request) => request.method === 'PUT' && request.path.endsWith('/policy'))?.body,
  ).toEqual({
    expected_resource_version: 8,
    enabled: false,
    allowed_version_ids: [],
    rollback_defaults: {},
  });
});
