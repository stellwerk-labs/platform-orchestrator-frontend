import { createServer, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AXIOS_INSTANCE } from '@src/custom-instance';
import type { PipelineDraft } from '@src/models/pipelines';
import { server } from '@src/testing-utils/mswServer';

import { type PipelineDocument, savePipelineDocument } from './pipelineDocumentApi';
import { usePipelineDocument } from './usePipelineDocument';

const document: PipelineDocument = {
  slug: 'production',
  name: 'Production',
  definition: { strategy: 'apply', steps: [] },
};
const draft: PipelineDraft = {
  ...document,
  id: 'draft-id',
  project_id: 'project',
  resource_version: 3,
  updated_at: '',
  updated_by: '',
};
const originalBase = AXIOS_INSTANCE.defaults.baseURL;
let respond: (response: ServerResponse) => void;
let received: { body: string; type?: string; revision?: string | string[] }[] = [];
const fixture = createServer((request, response) => {
  response.setHeader('Connection', 'close');
  response.setHeader('Content-Type', 'application/json');
  let body = '';
  request.on('data', (part) => {
    body += part;
  });
  request.on('end', () => {
    received.push({
      body,
      type: request.headers['content-type'],
      revision: request.headers['if-match'],
    });
    respond(response);
  });
});
beforeAll(async () => {
  await new Promise<void>((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  AXIOS_INSTANCE.defaults.baseURL = `http://127.0.0.1:${(fixture.address() as AddressInfo).port}`;
  server.close();
});
beforeEach(() => {
  received = [];
  respond = (response) => response.end(JSON.stringify({ valid: true, document, errors: [] }));
});
afterAll(async () => {
  AXIOS_INSTANCE.defaults.baseURL = originalBase;
  server.listen();
  fixture.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    fixture.close((error) => (error ? reject(error) : resolve())),
  );
});
const setup = () => {
  let selected: PipelineDocument | undefined;
  const props = {
    orgId: 'org',
    projectId: 'project',
    base: draft,
    values: document,
    canEdit: true,
    onDocument: (value: PipelineDocument) => {
      selected = value;
    },
  };
  return {
    ...renderHook((value) => usePipelineDocument(value), { initialProps: props }),
    props,
    selected: () => selected,
  };
};

describe('validated pipeline source transitions', () => {
  it('keeps invalid source and format, and cannot return to Designer or prepare a save', async () => {
    respond = (response) =>
      response.end(
        JSON.stringify({
          valid: false,
          errors: [{ path: '/definition', code: 'invalid', message: 'Invalid recipe' }],
        }),
      );
    const { result } = setup();
    await act(() => result.current.changeMode('code'));
    act(() => result.current.changeSource('definition: [invalid'));
    await act(() => result.current.changeFormat('json'));
    expect(result.current.source).toBe('definition: [invalid');
    expect(result.current.format).toBe('yaml');
    await act(() => result.current.changeMode('designer'));
    expect(result.current.mode).toBe('code');
    expect(result.current.validation).toContain('/definition: Invalid recipe');
    let prepared: unknown;
    await act(async () => {
      prepared = await result.current.prepareSave();
    });
    expect(prepared).toBeUndefined();
  });

  it('sends the exact raw YAML and preserves comments when changing views without form edits', async () => {
    const { result, selected, rerender, props } = setup();
    const source =
      '# Keep this comment\nslug: production\nname: Production\ndefinition:\n  strategy: apply\n  steps: []\n';
    await act(() => result.current.changeMode('code'));
    act(() => result.current.changeSource(source));
    await act(() => result.current.changeMode('designer'));
    expect(selected()).toEqual(document);
    expect(received[0]).toMatchObject({ body: source, type: 'application/yaml' });
    let prepared: Awaited<ReturnType<typeof result.current.prepareSave>>;
    await act(async () => {
      prepared = await result.current.prepareSave();
    });
    expect(prepared?.source).toBe(source);
    act(() => result.current.saved(prepared!.document, prepared!.source, prepared!.format));
    rerender({
      ...props,
      values: { definition: document.definition, name: document.name, slug: document.slug },
    });
    await act(() => result.current.changeMode('code'));
    expect(result.current.source).toBe(source);
  });

  it('rejects an immutable pipeline ID even when the document is otherwise valid', async () => {
    respond = (response) =>
      response.end(
        JSON.stringify({ valid: true, document: { ...document, slug: 'renamed' }, errors: [] }),
      );
    const { result } = setup();
    await act(() => result.current.changeMode('code'));
    await act(() => result.current.changeMode('designer'));
    expect(result.current.mode).toBe('code');
    expect(result.current.validation).toContain('pipeline ID cannot change');
  });

  it('ignores a validation response after edits and after permission revocation', async () => {
    let finish!: () => void;
    respond = (response) => {
      finish = () => response.end(JSON.stringify({ valid: true, document, errors: [] }));
    };
    const { result, rerender, props, selected } = setup();
    await act(() => result.current.changeMode('code'));
    let transition!: Promise<void>;
    act(() => {
      transition = result.current.changeMode('designer');
    });
    await waitFor(() => expect(received).toHaveLength(1));
    act(() => result.current.changeSource('invalid: pending edits'));
    finish();
    await act(() => transition);
    expect(result.current.mode).toBe('code');
    expect(selected()).toBeUndefined();
    act(() => {
      transition = result.current.changeMode('designer');
    });
    await waitFor(() => expect(received).toHaveLength(2));
    rerender({ ...props, canEdit: false });
    finish();
    await act(() => transition);
    expect(result.current.mode).toBe('code');
    expect(result.current.source).toBe('invalid: pending edits');
    expect(selected()).toBeUndefined();
  });

  it('uses the current revision and raw source for a document update', async () => {
    respond = (response) => response.end(JSON.stringify(draft));
    await savePipelineDocument('org', 'project', draft, '# source\nslug: production', 'yaml');
    expect(received).toEqual([
      { body: '# source\nslug: production', type: 'application/yaml', revision: '"3"' },
    ]);
  });
});
