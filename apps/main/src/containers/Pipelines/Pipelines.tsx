import { EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Flex, Modal, Select, Spin, Table, Tabs, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';

import { listProjectPipelines, retireProjectPipeline } from '@src/api/pipelines';
import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { matchesSearch, TableToolbar, useTableSearch } from '@src/components/shared/TableToolbar';
import type { MatchParams } from '@src/config/routing';
import {
  getListProjectsQueryKey,
  listProjects,
} from '@src/hooks/react-query/v2/controlplane/project/project';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { RBACPermission, useRBACPermissions } from '@src/hooks/useRBAC';
import type { PipelineDraft, PublishedPipelineVersion } from '@src/models/pipelines';

import { PipelineEditor } from './PipelineEditor';
import { authoringError } from './pipelineErrors';
import { PipelinePolicyEditor } from './PipelinePolicyEditor';
import { PipelinePreview } from './PipelinePreview';

export const pipelineCatalogueKey = (orgId: string, projectId: string) => [
  'project-pipelines',
  orgId,
  projectId,
];

export const Pipelines = () => {
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;
  const [params, setParams] = useSearchParams();
  const projects = useAllPages(getAllPagesQueryKey(getListProjectsQueryKey(orgId)), (page) =>
    listProjects(orgId, page),
  );
  const projectId = params.get('project') ?? projects.data?.[0]?.id;
  const project = projects.data?.find((item) => item.id === projectId);
  return (
    <Flex vertical gap={'middle'}>
      <PageHeader
        customHeading={'Pipelines'}
        subtitles={[
          'Design and publish project deployment flows. Developers select an allowed version when deploying.',
        ]}
      />
      <Flex gap={'small'} align={'center'} wrap>
        <Typography.Text>Project</Typography.Text>
        <Select
          aria-label={'Pipeline project'}
          showSearch
          optionFilterProp={'label'}
          loading={projects.isPending}
          value={projectId}
          style={{ minWidth: 240 }}
          options={projects.data?.map((item) => ({
            value: item.id,
            label: `${item.display_name} (${item.id})`,
          }))}
          onChange={(id) => setParams({ project: id })}
        />
      </Flex>
      {projects.isError && (
        <Alert type={'error'} showIcon message={'Projects could not be loaded.'} />
      )}
      {!projects.isPending && !project && (
        <Alert
          type={'info'}
          showIcon
          message={'Select an accessible project to manage its pipelines.'}
        />
      )}
      {project && (
        <ProjectPipelines
          key={`${orgId}/${project.id}`}
          orgId={orgId}
          projectId={project.id}
          projectUuid={project.uuid}
        />
      )}
    </Flex>
  );
};

const ProjectPipelines = ({
  orgId,
  projectId,
  projectUuid,
}: {
  orgId: string;
  projectId: string;
  projectUuid: string;
}) => {
  const search = useTableSearch();
  const cache = useQueryClient();
  const [editor, setEditor] = useState<{ draft?: PipelineDraft; session: string }>();
  const [editorDirty, setEditorDirty] = useState(false);
  const openEditor = (draft?: PipelineDraft) => {
    setEditor({ draft, session: crypto.randomUUID() });
    setEditorDirty(false);
  };
  const [viewVersion, setViewVersion] = useState<PublishedPipelineVersion>();
  const [modal, modalContext] = Modal.useModal();
  const read = { resource: `project:${projectUuid}`, permission: RBACPermission.PIPELINE_READ };
  const write = { ...read, permission: RBACPermission.PIPELINE_WRITE };
  const publish = { ...read, permission: RBACPermission.PIPELINE_PUBLISH };
  const permissions = useRBACPermissions([read, write, publish]);
  const canRead = permissions.allowed(read);
  const canEdit = permissions.allowed(write);
  const canPublish = permissions.allowed(publish);
  const queryKey = pipelineCatalogueKey(orgId, projectId);
  const catalogue = useQuery({
    queryKey,
    queryFn: () => listProjectPipelines(orgId, projectId),
    enabled: canRead,
    retry: false,
  });
  const refresh = () => cache.invalidateQueries({ queryKey });
  const retire = useMutation({
    mutationFn: (version: PublishedPipelineVersion) => {
      if (!canPublish) throw new Error('Publication permission is required.');
      return retireProjectPipeline(orgId, projectId, version.id);
    },
    onSuccess: refresh,
  });
  const closeEditor = () => {
    if (editorDirty)
      modal.confirm({
        title: 'Discard unsaved pipeline changes?',
        okText: 'Discard changes',
        okButtonProps: { danger: true },
        onOk: () => {
          setEditor(undefined);
          setEditorDirty(false);
        },
      });
    else setEditor(undefined);
  };
  if (permissions.isPending || (canRead && catalogue.isPending)) return <Spin />;
  if (!canRead)
    return (
      <Alert
        type={'info'}
        showIcon
        message={'Pipeline authoring access is required for this project.'}
        description={
          'Deployment users choose allowed published pipelines from the environment Deploy dialog.'
        }
      />
    );
  if (catalogue.isError || !catalogue.data)
    return (
      <Alert
        type={'error'}
        showIcon
        message={'The project pipeline catalogue could not be loaded.'}
        action={
          <Button icon={<ReloadOutlined aria-hidden />} onClick={() => catalogue.refetch()}>
            Reload
          </Button>
        }
      />
    );
  const { drafts, versions, policy, tools } = catalogue.data;
  const filteredDrafts = drafts.filter(
    (draft) =>
      matchesSearch(search.query, draft.slug, draft.name, draft.id) &&
      (search.view !== 'unpublished' ||
        !versions.some((version) => version.pipeline_id === draft.id)),
  );
  return (
    <Flex vertical gap={'middle'}>
      {modalContext}
      <TableToolbar
        label={'pipelines'}
        {...search}
        filters={[{ value: 'unpublished', label: 'Unpublished drafts' }]}>
        <Button
          type={'primary'}
          icon={<PlusOutlined aria-hidden />}
          disabled={!canEdit}
          onClick={() => openEditor()}>
          Create pipeline
        </Button>
        <Button icon={<ReloadOutlined aria-hidden />} onClick={() => refresh()}>
          Reload
        </Button>
      </TableToolbar>
      <Tabs
        items={[
          {
            key: 'drafts',
            label: 'Drafts',
            children: (
              <Table
                key={`${search.query}:${search.view}`}
                rowKey={'id'}
                dataSource={filteredDrafts}
                locale={{
                  emptyText:
                    search.query || search.view !== 'all'
                      ? 'No pipelines match these filters.'
                      : 'No pipelines yet. Create a draft to begin.',
                }}
                columns={[
                  {
                    title: 'Pipeline',
                    render: (_, draft: PipelineDraft) => (
                      <Button type={'link'} onClick={() => openEditor(draft)}>
                        {draft.name}
                      </Button>
                    ),
                  },
                  { title: 'ID', dataIndex: 'slug' },
                  {
                    title: 'Flow',
                    render: (_, draft) => (
                      <Tag>
                        {draft.definition.strategy === 'reviewed'
                          ? 'Plan, review and apply'
                          : 'Apply directly'}
                      </Tag>
                    ),
                  },
                  { title: 'Draft revision', dataIndex: 'resource_version' },
                  {
                    title: 'Latest publication',
                    render: (_, draft) => {
                      const latest = versions
                        .filter((version) => version.pipeline_id === draft.id)
                        .sort((a, b) => b.version - a.version)[0];
                      return latest ? `v${latest.version}` : 'Not published';
                    },
                  },
                  {
                    title: '',
                    render: (_, draft) => (
                      <Button icon={<EditOutlined aria-hidden />} onClick={() => openEditor(draft)}>
                        {canEdit ? 'Edit draft' : 'View draft'}
                      </Button>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: 'versions',
            label: 'Published versions',
            children: (
              <Table
                rowKey={'id'}
                dataSource={versions.filter((version) =>
                  matchesSearch(search.query, version.name, version.id, version.digest),
                )}
                locale={{ emptyText: 'No published versions match these filters.' }}
                columns={[
                  {
                    title: 'Version',
                    render: (_, version: PublishedPipelineVersion) => (
                      <Button type={'link'} onClick={() => setViewVersion(version)}>
                        {version.name} · v{version.version}
                      </Button>
                    ),
                  },
                  {
                    title: 'Status',
                    render: (_, version) => (
                      <Tag
                        color={
                          version.retired_at
                            ? 'default'
                            : policy.default_version_id === version.id
                              ? 'blue'
                              : policy.allowed_version_ids.includes(version.id)
                                ? 'success'
                                : 'default'
                        }>
                        {version.retired_at
                          ? 'Retired'
                          : policy.default_version_id === version.id
                            ? 'Default'
                            : policy.allowed_version_ids.includes(version.id)
                              ? 'Allowed'
                              : !policy.enabled
                                ? 'Available (policy off)'
                                : 'Not allowed for deployment'}
                      </Tag>
                    ),
                  },
                  {
                    title: 'Published',
                    render: (_, version) => new Date(version.published_at).toLocaleString(),
                  },
                  {
                    title: 'Digest',
                    render: (_, version) => (
                      <Typography.Text code copyable>
                        {version.digest}
                      </Typography.Text>
                    ),
                  },
                  {
                    title: '',
                    render: (_, version) => (
                      <Button
                        danger
                        disabled={
                          !canPublish ||
                          Boolean(version.retired_at) ||
                          policy.allowed_version_ids.includes(version.id) ||
                          retire.isPending
                        }
                        onClick={() =>
                          modal.confirm({
                            title: `Retire ${version.name} v${version.version}?`,
                            content:
                              'New deployments cannot select a retired version. Existing executions retain their original definition and authority.',
                            okText: 'Retire version',
                            okButtonProps: { danger: true },
                            onOk: () => retire.mutateAsync(version).catch(() => undefined),
                          })
                        }>
                        Retire
                      </Button>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: 'policy',
            label: 'Deployment policy',
            children: (
              <PipelinePolicyEditor
                key={policy.resource_version}
                orgId={orgId}
                projectId={projectId}
                policy={policy}
                versions={versions}
                canPublish={canPublish}
                onSaved={() => {
                  void refresh();
                }}
              />
            ),
          },
        ]}
      />
      {retire.isError && <Alert type={'error'} showIcon message={authoringError(retire.error)} />}
      {editor && (
        <PipelineEditor
          key={editor.session}
          orgId={orgId}
          projectId={projectId}
          draft={editor.draft}
          tools={tools}
          canEdit={canEdit}
          canPublish={canPublish}
          onClose={closeEditor}
          onDirtyChange={setEditorDirty}
          onSaved={(draft) => {
            setEditor((previous) =>
              previous?.session === editor.session ? { ...previous, draft } : previous,
            );
            void refresh();
          }}
          onPublished={() => {
            void refresh();
          }}
        />
      )}
      <Modal
        open={Boolean(viewVersion)}
        onCancel={() => setViewVersion(undefined)}
        footer={null}
        title={viewVersion ? `${viewVersion.name} · v${viewVersion.version}` : 'Published version'}
        width={700}>
        {viewVersion && (
          <Flex vertical gap={'small'}>
            <Alert
              type={'info'}
              showIcon
              message={'Immutable published definition'}
              description={
                'Editing the draft creates future versions. This version and executions pinned to it retain their original recipe.'
              }
            />
            <PipelinePreview recipe={viewVersion.definition} tools={tools} />
          </Flex>
        )}
      </Modal>
    </Flex>
  );
};
