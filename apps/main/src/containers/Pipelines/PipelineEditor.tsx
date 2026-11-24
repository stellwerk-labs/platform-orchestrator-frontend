import { SaveOutlined, SendOutlined } from '@ant-design/icons';
import { Button, Drawer, Flex, Form, Input, Modal, Segmented, Tag, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';

import { createProjectPipeline } from '@src/api/pipelines';
import type { PipelineDraft, PipelineRecipe, PipelineTool } from '@src/models/pipelines';

import { savePipelineDocument } from './pipelineDocumentApi';
import { PipelineEditorFeedback } from './PipelineEditorFeedback';
import { authoringError } from './pipelineErrors';
import { PipelineFlowEditor } from './PipelineFlowEditor';
import { PipelinePreview } from './PipelinePreview';
import { PipelineSource } from './PipelineSource';
import { PipelineStepsEditor } from './PipelineStepsEditor';
import { samePipelineDocument, usePipelineDocument } from './usePipelineDocument';
import { usePipelinePublish } from './usePipelinePublish';

const emptyRecipe: PipelineRecipe = { strategy: 'apply', steps: [] };
const draftValues = (draft?: PipelineDraft) =>
  draft
    ? { name: draft.name, slug: draft.slug, definition: draft.definition }
    : { name: '', slug: '', definition: emptyRecipe };

export const PipelineEditor = ({
  orgId,
  projectId,
  draft,
  tools,
  canEdit,
  canPublish,
  onClose,
  onSaved,
  onPublished,
  onDirtyChange,
}: {
  orgId: string;
  projectId: string;
  draft?: PipelineDraft;
  tools: PipelineTool[];
  canEdit: boolean;
  canPublish: boolean;
  onClose: () => void;
  onSaved: (draft: PipelineDraft) => void;
  onPublished: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) => {
  const [base, setBase] = useState(draft);
  const [values, setValues] = useState(() => draftValues(draft));
  const { name, slug, definition: recipe } = values;
  const [modal, modalContext] = Modal.useModal();
  const document = usePipelineDocument({
    orgId,
    projectId,
    base,
    values,
    canEdit,
    onDocument: setValues,
  });
  const dirty = document.codeDirty || !samePipelineDocument(values, draftValues(base));
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const saveRequest = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    if (!canEdit) saveRequest.current?.abort();
    return () => saveRequest.current?.abort();
  }, [canEdit]);
  const saveDraft = async () => {
    if (!canEdit || saving) return;
    const request = new AbortController();
    saveRequest.current = request;
    setSaving(true);
    setSaveError(undefined);
    try {
      const prepared = await document.prepareSave();
      if (!prepared || request.signal.aborted) return;
      const saved = base
        ? await savePipelineDocument(
            orgId,
            projectId,
            base,
            prepared.source,
            prepared.format,
            request.signal,
          )
        : await createProjectPipeline(orgId, projectId, prepared.document, {
            signal: request.signal,
          });
      if (request.signal.aborted) return;
      setBase(saved);
      setValues(draftValues(saved));
      document.saved(prepared.document, prepared.source, prepared.format);
      onSaved(saved);
    } catch (error) {
      if (!request.signal.aborted) setSaveError(authoringError(error));
    } finally {
      setSaving(false);
    }
  };
  const publish = usePipelinePublish({ orgId, projectId, base, dirty, canPublish, onPublished });
  const busy = saving || publish.isPending || document.checking;
  const update = (value: Partial<PipelineRecipe>) =>
    setValues((previous) => ({ ...previous, definition: { ...previous.definition, ...value } }));
  return (
    <Drawer
      open
      width={1000}
      title={base ? `Edit ${base.name}` : 'Create pipeline'}
      onClose={onClose}
      closable={!busy}
      maskClosable={!busy}
      extra={
        <Flex gap={'small'} wrap>
          {dirty && <Tag color={'warning'}>Unsaved changes</Tag>}
          <Button
            icon={<SaveOutlined aria-hidden />}
            onClick={() => void saveDraft()}
            loading={saving}
            disabled={!canEdit || busy || !dirty}>
            Save draft
          </Button>
          <Button
            type={'primary'}
            icon={<SendOutlined aria-hidden />}
            disabled={!canPublish || !base || dirty || busy}
            loading={publish.isPending}
            onClick={() => {
              if (base)
                modal.confirm({
                  title: 'Publish this saved draft?',
                  content:
                    'Creates an immutable version. With project policy off, it becomes available to developers. Existing default and policy settings stay unchanged.',
                  okText: 'Publish version',
                  onOk: () => publish.mutateAsync(base.resource_version).catch(() => undefined),
                });
            }}>
            Publish version
          </Button>
        </Flex>
      }>
      {modalContext}
      <Flex vertical gap={'middle'}>
        <PipelineEditorFeedback
          canEdit={canEdit}
          canPublish={canPublish}
          validation={document.validation ?? saveError}
          error={publish.error}
          publishedVersion={publish.data?.version}
        />
        <Segmented
          aria-label={'Pipeline editing mode'}
          options={[
            { label: 'Designer', value: 'designer' },
            { label: 'Code', value: 'code' },
          ]}
          value={document.mode}
          disabled={busy}
          onChange={(mode) => void document.changeMode(mode === 'code' ? 'code' : 'designer')}
        />
        {document.mode === 'code' ? (
          <PipelineSource
            orgId={orgId}
            projectId={projectId}
            source={document.source}
            format={document.format}
            disabled={!canEdit || saving || publish.isPending}
            checking={document.checking}
            valid={document.valid}
            onChange={document.changeSource}
            onFormat={(format) => void document.changeFormat(format)}
            onValidate={() => {
              void document.validate();
            }}
          />
        ) : (
          <Flex gap={'large'} wrap align={'start'}>
            <Flex vertical gap={'middle'} style={{ flex: '1 1 440px' }}>
              <Form layout={'vertical'} disabled={!canEdit || busy}>
                <Form.Item label={'Name'} htmlFor={'pipeline-name'} required>
                  <Input
                    id={'pipeline-name'}
                    value={name}
                    maxLength={120}
                    onChange={(event) =>
                      setValues((previous) => ({ ...previous, name: event.target.value }))
                    }
                  />
                </Form.Item>
                <Form.Item label={'Pipeline ID'} htmlFor={'pipeline-slug'} required>
                  <Input
                    id={'pipeline-slug'}
                    value={slug}
                    maxLength={64}
                    disabled={Boolean(base) || !canEdit || busy}
                    onChange={(event) =>
                      setValues((previous) => ({ ...previous, slug: event.target.value }))
                    }
                  />
                </Form.Item>
                <PipelineFlowEditor recipe={recipe} onChange={update} />
              </Form>
              <PipelineStepsEditor
                recipe={recipe}
                tools={tools}
                disabled={!canEdit || busy}
                onChange={update}
              />
              <Typography.Text type={'secondary'}>
                Steps use operator-approved tools and fixed configuration. Customer uploads and
                arbitrary commands are not available in this iteration.
              </Typography.Text>
            </Flex>
            <div style={{ flex: '1 1 320px' }}>
              <PipelinePreview recipe={recipe} tools={tools} />
            </div>
          </Flex>
        )}
      </Flex>
    </Drawer>
  );
};
