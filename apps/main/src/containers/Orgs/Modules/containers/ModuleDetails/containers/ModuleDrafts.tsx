import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Descriptions,
  Flex,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import { isAxiosError } from 'axios';
import { useRef, useState } from 'react';
import { useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import { invalidateModuleManagementQueries } from '@src/containers/Orgs/Modules/moduleManagementCache';
import { useListEnvironmentsInOrg } from '@src/hooks/react-query/v2/controlplane/environment/environment';
import {
  captureModuleDraftTestSnapshot,
  createModuleDraft,
  discardModuleDraft,
  getModuleDraft,
  getModuleDraftRevision,
  getModuleDraftTestSnapshot,
  publishModuleDraft,
  updateModuleDraft,
  useListModuleDrafts,
} from '@src/hooks/react-query/v2/controlplane/modules/modules';
import {
  createModuleTestDeployment,
  useGetDeployment,
  useGetDeploymentQueueItem,
} from '@src/hooks/react-query/v2/dataplane/deployment/deployment';
import { RBACPermission, RBACStatus, useRBAC, useRBACPermissions } from '@src/hooks/useRBAC';
import type {
  Environment,
  ModuleDraft,
  ModuleDraftTestSnapshot,
  ModuleVersionPublishBody,
} from '@src/models/v2/controlplane';
import type { Deployment, DeploymentManifest, DeploymentQueueItem } from '@src/models/v2/dataplane';
import { generateDeploymentUrl } from '@src/utilities/navigation';

const stringify = (value: unknown) => JSON.stringify(value, null, 2);
const initialDefinition: ModuleVersionPublishBody = {
  semantic_version: '1.0.0',
  module_source: 'inline',
  module_source_code: 'output "name" { value = "A" }',
  module_inputs: {},
  module_params: {},
  provider_mapping: {},
  dependencies: {},
  coprovisioned: [],
};

const parseObject = <T,>(value: string): T => {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('Enter a JSON object.');
  return parsed as T;
};

const DraftExecutionResult = ({
  orgId,
  result,
}: {
  orgId: string;
  result: Deployment | DeploymentQueueItem;
}) => {
  const queued = 'state' in result;
  const queue = useGetDeploymentQueueItem(orgId, queued ? result.id : '', {
    query: {
      enabled: queued,
      refetchInterval: (query) =>
        ['queued', 'dispatching'].includes(query.state.data?.state ?? 'queued') ? 1000 : false,
    },
  });
  const deploymentId = queued ? queue.data?.deployment_id : result.id;
  const deployment = useGetDeployment(orgId, deploymentId ?? '', {
    query: {
      enabled: Boolean(deploymentId),
      refetchInterval: (query) =>
        ['succeeded', 'failed', 'cancelled', 'terminated'].includes(query.state.data?.status ?? '')
          ? false
          : 1000,
    },
  });
  const failure = queue.error || deployment.error;
  return (
    <Alert
      showIcon
      type={failure || deployment.data?.status === 'failed' ? 'error' : 'info'}
      message={
        failure
          ? 'Execution status could not be read'
          : `Test execution: ${deployment.data?.status ?? queue.data?.state ?? 'starting'}`
      }
      description={
        <Space direction={'vertical'}>
          <span>
            {deployment.data?.status_message ||
              queue.data?.reason_message ||
              'Capture is separate from a successful deployment.'}
          </span>
          {deploymentId && (
            <Typography.Link
              href={generateDeploymentUrl(
                orgId,
                result.project_id,
                result.env_id,
                deploymentId,
                'manifest',
              )}>
              Open Deployment
            </Typography.Link>
          )}
        </Space>
      }
    />
  );
};

export const ModuleDrafts = () => {
  const { orgId, moduleId } = useParams<keyof MatchParams>() as MatchParams;
  const client = useQueryClient();
  const canAuthor = useRBAC(RBACPermission.MODULE_VERSION_PUBLISH) === RBACStatus.ALLOWED;
  const [pageToken, setPageToken] = useState<string>();
  const drafts = useListModuleDrafts(orgId, moduleId, { per_page: 50, page: pageToken });
  const [envPage, setEnvPage] = useState<string>();
  const environments = useListEnvironmentsInOrg(orgId, { per_page: 100, page: envPage });
  const [environment, setEnvironment] = useState<Environment>();
  const permissions = useRBACPermissions(
    environment
      ? [{ resource: `env:${environment.uuid}`, permission: RBACPermission.DEPLOYMENT_WRITE }]
      : [],
  );
  const canDeploy = Boolean(
    environment &&
    permissions.allowed({
      resource: `env:${environment.uuid}`,
      permission: RBACPermission.DEPLOYMENT_WRITE,
    }),
  );
  const [selected, setSelected] = useState<ModuleDraft>();
  const [definition, setDefinition] = useState(stringify(initialDefinition));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<'publish' | 'discard'>();
  const [revision, setRevision] = useState(1);
  const [history, setHistory] = useState('');
  const [snapshotId, setSnapshotId] = useState('');
  const [capture, setCapture] = useState<{
    snapshot: ModuleDraftTestSnapshot;
    environment: Environment;
  }>();
  const [manifest, setManifest] = useState(stringify({ workloads: {}, shared: {} }));
  const [execution, setExecution] = useState<Deployment | DeploymentQueueItem>();
  const intent = useRef({ payload: '', key: crypto.randomUUID() });
  const options = (operation: string, payload: unknown) => {
    const next = stringify({ operation, orgId, moduleId, payload });
    if (intent.current.payload !== next)
      intent.current = { payload: next, key: crypto.randomUUID() };
    return { headers: { 'Idempotency-Key': intent.current.key } };
  };
  const accepted = () => {
    intent.current = { payload: '', key: crypto.randomUUID() };
  };
  const perform = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(
        isAxiosError<{ message?: string }>(cause)
          ? (cause.response?.data?.message ?? cause.message)
          : cause instanceof Error
            ? cause.message
            : 'The operation failed.',
      );
    } finally {
      setBusy(false);
    }
  };
  const choose = (draft?: ModuleDraft) => {
    setSelected(draft);
    setDefinition(stringify(draft?.definition ?? initialDefinition));
    setHistory('');
    setRevision(1);
    setError('');
  };
  const dirty = selected ? definition !== stringify(selected.definition) : true;
  const refresh = () => invalidateModuleManagementQueries(client, orgId, moduleId);
  return (
    <Flex vertical gap={'middle'}>
      <Alert
        type={'info'}
        showIcon
        message={'Edit and test before publishing'}
        description={
          'Draft saves keep an intended SemVer editable. Each test captures an exact revision for one Environment. Published Versions, including Proposed, remain immutable.'
        }
      />
      {(error || drafts.error || environments.error) && (
        <Alert
          type={'error'}
          showIcon
          message={
            error ||
            'Drafts or Environments could not be loaded. Check server support and permissions.'
          }
        />
      )}
      <Space>
        <Button disabled={!canAuthor || busy} onClick={() => choose()}>
          Start a Draft
        </Button>
        <Button onClick={() => setPageToken(undefined)} disabled={!pageToken}>
          First Draft page
        </Button>
        <Button
          disabled={!drafts.data?.next_page_token}
          onClick={() => setPageToken(drafts.data?.next_page_token)}>
          Next Draft page
        </Button>
      </Space>
      <Table
        rowKey={'id'}
        loading={drafts.isPending}
        dataSource={drafts.data?.items ?? []}
        pagination={false}
        columns={[
          { title: 'Intended version', render: (_, draft) => draft.definition.semantic_version },
          { title: 'Status', dataIndex: 'status' },
          { title: 'Revision', dataIndex: 'resource_version' },
          {
            title: 'Draft',
            render: (_, draft) => (
              <Button disabled={busy} onClick={() => choose(draft)}>
                Open {draft.id}
              </Button>
            ),
          },
        ]}
      />
      <Typography.Title level={4}>
        {selected
          ? `Draft revision ${selected.resource_version} (${selected.status})`
          : 'New Draft'}
      </Typography.Title>
      <Input.TextArea
        aria-label={'Complete Draft definition'}
        value={definition}
        rows={14}
        readOnly={Boolean(selected && selected.status !== 'open')}
        onChange={(event) => setDefinition(event.target.value)}
      />
      <Input.TextArea
        aria-label={'Draft operation reason'}
        placeholder={'Reason for the next save, capture or publication'}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={2}
      />
      <Space wrap>
        {selected && (
          <Button
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                choose(await getModuleDraft(orgId, moduleId, selected.id));
                await refresh();
              })
            }>
            Reload stored Draft
          </Button>
        )}
        <Button
          type={'primary'}
          loading={busy}
          disabled={
            !canAuthor || !reason.trim() || (selected && selected.status !== 'open') || !dirty
          }
          onClick={() =>
            void perform(async () => {
              const body = {
                definition: parseObject<ModuleVersionPublishBody>(definition),
                reason: reason.trim(),
              };
              const saved = selected
                ? await updateModuleDraft(
                    orgId,
                    moduleId,
                    selected.id,
                    { ...body, expected_resource_version: selected.resource_version },
                    options('save', {
                      ...body,
                      draft: selected.id,
                      revision: selected.resource_version,
                    }),
                  )
                : await createModuleDraft(orgId, moduleId, body, options('create', body));
              choose(saved);
              accepted();
              await refresh();
            })
          }>
          Save Draft
        </Button>
        <Button
          disabled={
            !selected || selected.status !== 'open' || dirty || busy || !canAuthor || !reason.trim()
          }
          onClick={() => setConfirmation('publish')}>
          Publish reviewed revision
        </Button>
        <Button
          danger
          disabled={!selected || selected.status !== 'open' || busy || !canAuthor || !reason.trim()}
          onClick={() => setConfirmation('discard')}>
          Discard Draft
        </Button>
        {selected && (
          <>
            <InputNumber
              aria-label={'Historical Draft revision'}
              min={1}
              max={selected.resource_version}
              value={revision}
              onChange={(value) => setRevision(value ?? 1)}
            />
            <Button
              disabled={busy}
              onClick={() =>
                void perform(async () =>
                  setHistory(
                    stringify(await getModuleDraftRevision(orgId, moduleId, selected.id, revision)),
                  ),
                )
              }>
              Read revision
            </Button>
          </>
        )}
      </Space>
      {selected?.published_version_uuid && (
        <Typography.Text>Published Version UUID: {selected.published_version_uuid}</Typography.Text>
      )}
      {history && (
        <Input.TextArea
          aria-label={'Historical Draft definition'}
          value={history}
          readOnly
          rows={10}
        />
      )}
      <Typography.Title level={4}>Capture and execute a reviewed test</Typography.Title>
      <Typography.Paragraph>
        A first Module needs a Rule scoped to both Project and Environment. Capturing does not
        deploy. Editing afterward leaves this capture unchanged. Pins and current permissions still
        apply.
      </Typography.Paragraph>
      <Select
        aria-label={'Test Environment'}
        placeholder={'Select Project / Environment'}
        value={environment?.uuid}
        showSearch
        optionFilterProp={'label'}
        options={(environments.data?.items ?? []).map((env) => ({
          label: `${env.project_id} / ${env.id}`,
          value: env.uuid,
        }))}
        onChange={(value) =>
          setEnvironment(environments.data?.items.find((env) => env.uuid === value))
        }
      />
      <Space>
        <Button disabled={!envPage} onClick={() => setEnvPage(undefined)}>
          First Environment page
        </Button>
        <Button
          disabled={!environments.data?.next_page_token}
          onClick={() => setEnvPage(environments.data?.next_page_token)}>
          Next Environment page
        </Button>
      </Space>
      <Space wrap>
        <Button
          disabled={
            !selected ||
            selected.status !== 'open' ||
            dirty ||
            !canAuthor ||
            !canDeploy ||
            busy ||
            !reason.trim()
          }
          onClick={() =>
            void perform(async () => {
              if (!selected || !environment) return;
              const body = {
                expected_resource_version: selected.resource_version,
                reason: reason.trim(),
              };
              const snapshot = await captureModuleDraftTestSnapshot(
                orgId,
                environment.project_id,
                environment.id,
                moduleId,
                selected.id,
                body,
                options('capture', { ...body, draft: selected.id, environment: environment.uuid }),
              );
              accepted();
              setCapture({ snapshot, environment });
              setSnapshotId(snapshot.id);
              setExecution(undefined);
            })
          }>
          Capture reviewed revision
        </Button>
        <Input
          aria-label={'Captured test UUID'}
          value={snapshotId}
          onChange={(event) => {
            setSnapshotId(event.target.value);
            setCapture(undefined);
            setExecution(undefined);
          }}
        />
        <Button
          disabled={!environment || !snapshotId.trim() || busy}
          onClick={() =>
            void perform(async () => {
              if (!environment) return;
              const snapshot = await getModuleDraftTestSnapshot(
                orgId,
                environment.project_id,
                environment.id,
                moduleId,
                snapshotId.trim(),
              );
              setCapture({ snapshot, environment });
              setExecution(undefined);
            })
          }>
          Read captured test
        </Button>
      </Space>
      {capture && (
        <>
          <Descriptions column={1} bordered size={'small'}>
            <Descriptions.Item label={'Captured test UUID'}>
              {capture.snapshot.id}
            </Descriptions.Item>
            <Descriptions.Item label={'Frozen Draft revision'}>
              {capture.snapshot.draft_revision}
            </Descriptions.Item>
            <Descriptions.Item label={'Resource Type interface'}>
              {capture.snapshot.resource_type_version}
            </Descriptions.Item>
            <Descriptions.Item label={'Bound Environment'}>
              {capture.environment.project_id} / {capture.environment.id}
            </Descriptions.Item>
          </Descriptions>
          <Input.TextArea
            aria-label={'Captured immutable definition'}
            value={stringify(capture.snapshot.definition)}
            readOnly
            rows={8}
          />
          <Input.TextArea
            aria-label={'Test deployment manifest'}
            value={manifest}
            onChange={(event) => setManifest(event.target.value)}
            rows={8}
          />
          <Button
            disabled={
              busy || !canAuthor || !canDeploy || capture.environment.uuid !== environment?.uuid
            }
            onClick={() =>
              void perform(async () => {
                const body = {
                  deployment: {
                    mode: 'deploy' as const,
                    project_id: capture.environment.project_id,
                    env_id: capture.environment.id,
                    manifest: parseObject<DeploymentManifest>(manifest),
                  },
                  draft_test_snapshots: { [capture.snapshot.module_uuid]: capture.snapshot.id },
                };
                const result = await createModuleTestDeployment(
                  orgId,
                  body,
                  options('execute', body),
                );
                if (!('id' in result))
                  throw new Error('The server did not return a deployment or queue receipt.');
                accepted();
                setExecution(result);
              })
            }>
            Run captured test
          </Button>
        </>
      )}
      {execution && <DraftExecutionResult orgId={orgId} result={execution} />}
      <Modal
        title={
          confirmation === 'publish'
            ? 'Publish exact reviewed revision'
            : 'Discard authoring session'
        }
        open={Boolean(confirmation)}
        confirmLoading={busy}
        onCancel={() => setConfirmation(undefined)}
        okButtonProps={{
          disabled:
            !selected || !canAuthor || !reason.trim() || (confirmation === 'publish' && dirty),
        }}
        onOk={() =>
          void perform(async () => {
            if (!selected || !confirmation) return;
            const body = {
              expected_resource_version: selected.resource_version,
              reason: reason.trim(),
            };
            const requestOptions = options(confirmation, { ...body, draft: selected.id });
            if (confirmation === 'publish') {
              choose(
                (await publishModuleDraft(orgId, moduleId, selected.id, body, requestOptions))
                  .draft,
              );
            } else {
              choose(await discardModuleDraft(orgId, moduleId, selected.id, body, requestOptions));
            }
            accepted();
            setConfirmation(undefined);
            await refresh();
          })
        }>
        <Typography.Paragraph>
          {confirmation === 'publish'
            ? 'This freezes the stored revision as a separate immutable Proposed Version. It does not make it Default or deploy it. Save edited content before publication.'
            : 'This closes authoring and retains its revisions, captures and deployments.'}
        </Typography.Paragraph>
        <Typography.Text>Reviewed revision: {selected?.resource_version}</Typography.Text>
      </Modal>
    </Flex>
  );
};
