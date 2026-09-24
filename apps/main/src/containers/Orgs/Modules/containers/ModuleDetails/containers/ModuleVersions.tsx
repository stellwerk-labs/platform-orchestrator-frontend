import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Col,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Input,
  List,
  message,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRef, useState } from 'react';
import { useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import { invalidateModuleManagementQueries } from '@src/containers/Orgs/Modules/moduleManagementCache';
import {
  useCompareModuleVersions,
  useGetModuleCatalogueEntry,
  useGetModuleVersionUsage,
  useListModuleVersionLifecycleEvents,
  useListModuleVersions,
  usePublishModuleVersion,
  usePublishStableModuleVersionSuccessor,
  useTransitionModuleVersion,
} from '@src/hooks/react-query/v2/controlplane/modules/modules';
import { RBACPermission, useRBACPermissions } from '@src/hooks/useRBAC';
import type {
  CoreModuleVersion,
  CoreModuleVersionDetail,
  CoreModuleVersionPage,
  ModuleVersionComparison,
  ModuleVersionPublishBody,
} from '@src/models/v2/controlplane';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';

import { moduleVersionExtensionActions } from '../../../extensions/moduleVersionActions';

type LifecycleAction = 'promote' | 'deprecate' | 'mark-defective' | 'restore';

export const moduleVersionActionPermission: Record<LifecycleAction, RBACPermission> = {
  promote: RBACPermission.MODULE_VERSION_PROMOTE,
  deprecate: RBACPermission.MODULE_VERSION_DEPRECATE,
  'mark-defective': RBACPermission.MODULE_VERSION_DEFECTIVE,
  restore: RBACPermission.MODULE_VERSION_RESTORE,
};

type ComparisonDetail = {
  path: string;
  before: unknown;
  after: unknown;
  beforePresent: boolean;
  afterPresent: boolean;
};

export const publicationBodyFromDetail = (
  source: CoreModuleVersionDetail,
): ModuleVersionPublishBody => ({
  semantic_version: source.version.semantic_version ?? '',
  ...(source.version.artifact_digest ? { artifact_digest: source.version.artifact_digest } : {}),
  ...(source.version.source_revision ? { source_revision: source.version.source_revision } : {}),
  ...(source.version.release_notes ? { release_notes: source.version.release_notes } : {}),
  ...(source.definition.description ? { description: source.definition.description } : {}),
  module_source: source.definition.module_source,
  ...(source.definition.module_source_code
    ? { module_source_code: source.definition.module_source_code }
    : {}),
  module_params: source.definition.module_params,
  module_inputs: source.definition.module_inputs,
  provider_mapping: source.definition.provider_mapping,
  dependencies: source.definition.dependencies,
  coprovisioned: source.definition.coprovisioned,
  ...(source.definition.output_schema === undefined
    ? {}
    : { output_schema: source.definition.output_schema }),
});

const emptyPublicationBody = (): ModuleVersionPublishBody => ({
  semantic_version: '',
  module_source: 'inline',
  module_source_code: '',
  module_params: {},
  module_inputs: {},
  provider_mapping: {},
  dependencies: {},
  coprovisioned: [],
});

export const stableSuccessorSemanticVersion = (version?: string) =>
  version?.replace(/-.+$/, '') ?? '';

export const moduleVersionLifecycleActions = (
  version: CoreModuleVersion,
  previousDefaultVersionUuid?: string,
): LifecycleAction[] => {
  switch (version.lifecycle_status) {
    case 'proposed':
      return version.semantic_version?.includes('-')
        ? ['deprecate', 'mark-defective']
        : ['promote', 'deprecate', 'mark-defective'];
    case 'default':
      return ['mark-defective'];
    case 'deprecated':
      return version.uuid === previousDefaultVersionUuid
        ? ['restore', 'mark-defective']
        : ['mark-defective'];
    default:
      return [];
  }
};

const ModuleVersionEvidence = ({
  orgId,
  moduleId,
  version,
  onClose,
}: {
  orgId: string;
  moduleId: string;
  version?: CoreModuleVersion;
  onClose: () => void;
}) => {
  const usage = useGetModuleVersionUsage(orgId, moduleId, version?.uuid ?? '', {
    query: { enabled: Boolean(version) },
  });
  const history = useListModuleVersionLifecycleEvents(orgId, moduleId, version?.uuid ?? '', {
    query: { enabled: Boolean(version) },
  });

  return (
    <Drawer
      width={720}
      title={
        version ? `Module Version ${version.semantic_version ?? version.opaque_version_id}` : ''
      }
      open={Boolean(version)}
      onClose={onClose}>
      {version && (
        <Flex vertical gap={'large'}>
          <Descriptions column={1} size={'small'} bordered>
            <Descriptions.Item label={'Immutable Version UUID'}>{version.uuid}</Descriptions.Item>
            <Descriptions.Item label={'Source revision'}>
              {version.source_revision || 'Not declared'}
            </Descriptions.Item>
            <Descriptions.Item label={'Artifact'}>
              {version.artifact_digest || 'Not declared'}
            </Descriptions.Item>
          </Descriptions>
          <Typography.Title level={4}>Observed adoption</Typography.Title>
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title={'Active Environments'}
                value={usage.data?.active_environment_count ?? 0}
              />
            </Col>
            <Col span={8}>
              <Statistic title={'Active Pins'} value={usage.data?.active_pins ?? 0} />
            </Col>
            <Col span={8}>
              <Statistic
                title={'Unknown state'}
                value={usage.data?.unknown_environments.length ?? 0}
              />
            </Col>
          </Row>
          <Table
            size={'small'}
            rowKey={'environment_uuid'}
            loading={usage.isPending}
            dataSource={usage.data?.environments ?? []}
            pagination={false}
            columns={[
              { title: 'Project', dataIndex: 'project_id' },
              { title: 'Environment', dataIndex: 'environment_id' },
              { title: 'Type', dataIndex: 'environment_type' },
              {
                title: 'Observed',
                dataIndex: 'observed_at',
                render: (value) =>
                  formatDate(value, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE),
              },
            ]}
          />
          <Typography.Title level={4}>Lifecycle history</Typography.Title>
          <List
            loading={history.isPending}
            dataSource={history.data ?? []}
            renderItem={(event) => (
              <List.Item>
                <List.Item.Meta
                  title={`${event.from_status ?? 'published'} → ${event.to_status}`}
                  description={
                    <Space direction={'vertical'} size={0}>
                      <Typography.Text>{event.reason || 'Initial publication'}</Typography.Text>
                      <Typography.Text type={'secondary'}>
                        {formatDate(
                          event.created_at,
                          DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE,
                        )}
                      </Typography.Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Flex>
      )}
    </Drawer>
  );
};

const comparisonRows = (comparison?: ModuleVersionComparison) => {
  if (!comparison) return [];
  return [
    ['Module source', comparison.module_source_changed],
    ['Inline source', comparison.module_source_code_changed],
    ['External artifact digest', comparison.artifact_digest_changed],
    ['Source revision', comparison.source_revision_changed],
    ['Resource type', comparison.resource_type_changed],
    ['Co-provisioned resources', comparison.coprovisioning_changed],
    ['Declared output interface', comparison.output_schema_changed],
  ] as const;
};

export const formatComparisonItems = (items?: string[] | null) => items?.join(', ') || 'None';

const collectionComparisonDetails = (
  label: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  added: string[] = [],
  removed: string[] = [],
  changed: string[] = [],
): ComparisonDetail[] => [
  ...added.map((key) => ({
    path: `${label} / ${key}`,
    before: undefined,
    after: after[key],
    beforePresent: false,
    afterPresent: true,
  })),
  ...removed.map((key) => ({
    path: `${label} / ${key}`,
    before: before[key],
    after: undefined,
    beforePresent: true,
    afterPresent: false,
  })),
  ...changed.map((key) => ({
    path: `${label} / ${key}`,
    before: before[key],
    after: after[key],
    beforePresent: true,
    afterPresent: true,
  })),
];

export const moduleVersionComparisonDetails = (
  comparison?: ModuleVersionComparison,
): ComparisonDetail[] => {
  if (!comparison?.before || !comparison.after) return [];

  const { before, after } = comparison;
  const details: ComparisonDetail[] = [];
  const addChanged = (changed: boolean, path: string, previous: unknown, next: unknown) => {
    if (changed) {
      details.push({
        path,
        before: previous,
        after: next,
        beforePresent: true,
        afterPresent: true,
      });
    }
  };

  addChanged(
    comparison.module_source_changed,
    'Module source',
    before.module_source,
    after.module_source,
  );
  addChanged(
    comparison.module_source_code_changed,
    'Inline source',
    before.module_source_code,
    after.module_source_code,
  );
  addChanged(
    comparison.artifact_digest_changed,
    'External artifact digest',
    before.artifact_digest,
    after.artifact_digest,
  );
  addChanged(
    comparison.source_revision_changed,
    'Source revision',
    before.source_revision,
    after.source_revision,
  );
  addChanged(
    comparison.resource_type_changed,
    'Resource type',
    before.resource_type,
    after.resource_type,
  );
  details.push(
    ...collectionComparisonDetails(
      'Module inputs',
      before.module_inputs,
      after.module_inputs,
      comparison.added_module_inputs,
      comparison.removed_module_inputs,
      comparison.changed_module_inputs,
    ),
    ...collectionComparisonDetails(
      'Module parameters',
      before.module_params,
      after.module_params,
      comparison.added_module_params,
      comparison.removed_module_params,
      comparison.changed_module_params,
    ),
    ...collectionComparisonDetails(
      'Provider mappings',
      before.provider_mapping,
      after.provider_mapping,
      comparison.added_provider_mappings,
      comparison.removed_provider_mappings,
      comparison.changed_provider_mappings,
    ),
    ...collectionComparisonDetails(
      'Dependencies',
      before.dependencies,
      after.dependencies,
      comparison.added_dependencies,
      comparison.removed_dependencies,
      comparison.changed_dependencies,
    ),
  );
  addChanged(
    comparison.coprovisioning_changed,
    'Co-provisioned resources',
    before.coprovisioned,
    after.coprovisioned,
  );
  if (comparison.output_schema_changed) {
    details.push({
      path: 'Declared output interface',
      before: before.output_schema,
      after: after.output_schema,
      beforePresent: before.output_schema !== undefined,
      afterPresent: after.output_schema !== undefined,
    });
  }
  return details;
};

export const formatComparisonValue = (value: unknown, present = true) => {
  if (!present) return 'Not present';
  if (value === null || value === undefined || value === '') return 'None';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
};

export const moduleVersionHistoryErrorCopy = (status?: number) =>
  status === 403
    ? {
        message: 'Version history requires module.version.read',
        description:
          'This Module is readable, but immutable Module Versions use a separate permission.',
      }
    : {
        message: 'Version history could not be loaded',
        description:
          'Reload the page to try again. If the problem persists, contact your administrator.',
      };

export const visibleModuleVersionItems = (versions: {
  data?: CoreModuleVersionPage;
  isError: boolean;
}): CoreModuleVersionPage['items'] => (versions.isError ? [] : (versions.data?.items ?? []));

const ComparisonValue = ({
  value,
  present,
  side,
}: {
  value: unknown;
  present: boolean;
  side: 'before' | 'after';
}) => (
  <pre
    style={{
      margin: 0,
      padding: '8px 10px',
      maxHeight: 220,
      overflow: 'auto',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      borderLeft: `3px solid ${side === 'before' ? '#ff7875' : '#73d13d'}`,
      background: side === 'before' ? 'rgba(255, 77, 79, 0.08)' : 'rgba(82, 196, 26, 0.08)',
    }}>
    {formatComparisonValue(value, present)}
  </pre>
);

export const ComparisonList = ({ comparison }: { comparison?: ModuleVersionComparison }) => {
  const details = moduleVersionComparisonDetails(comparison);
  return (
    <Flex vertical gap={'middle'}>
      <Descriptions size={'small'} bordered column={1}>
        {comparisonRows(comparison).map(([label, changed]) => (
          <Descriptions.Item key={label} label={label}>
            <Tag color={changed ? 'gold' : 'default'}>{changed ? 'Changed' : 'Unchanged'}</Tag>
          </Descriptions.Item>
        ))}
      </Descriptions>
      {comparison &&
        [
          [
            'Module inputs',
            comparison.added_module_inputs,
            comparison.removed_module_inputs,
            comparison.changed_module_inputs,
          ],
          [
            'Module parameters',
            comparison.added_module_params,
            comparison.removed_module_params,
            comparison.changed_module_params,
          ],
          [
            'Provider mappings',
            comparison.added_provider_mappings,
            comparison.removed_provider_mappings,
            comparison.changed_provider_mappings,
          ],
          [
            'Dependencies',
            comparison.added_dependencies,
            comparison.removed_dependencies,
            comparison.changed_dependencies,
          ],
        ].map(([label, added, removed, changed]) => (
          <Descriptions
            key={label as string}
            size={'small'}
            bordered
            title={label as string}
            column={1}>
            <Descriptions.Item label={'Added'}>
              {formatComparisonItems(added as string[] | null)}
            </Descriptions.Item>
            <Descriptions.Item label={'Removed'}>
              {formatComparisonItems(removed as string[] | null)}
            </Descriptions.Item>
            <Descriptions.Item label={'Changed'}>
              {formatComparisonItems(changed as string[] | null)}
            </Descriptions.Item>
          </Descriptions>
        ))}
      <Typography.Title level={5} style={{ marginBottom: 0 }}>
        Detailed diff
      </Typography.Title>
      {details.length ? (
        <Table
          size={'small'}
          pagination={false}
          rowKey={'path'}
          dataSource={details}
          scroll={{ x: 860 }}
          columns={[
            { title: 'Changed field', dataIndex: 'path', width: 230 },
            {
              title: 'Before',
              width: 315,
              render: (_, item) => (
                <ComparisonValue value={item.before} present={item.beforePresent} side={'before'} />
              ),
            },
            {
              title: 'After',
              width: 315,
              render: (_, item) => (
                <ComparisonValue value={item.after} present={item.afterPresent} side={'after'} />
              ),
            },
          ]}
        />
      ) : (
        <Typography.Text type={'secondary'}>No structural changes.</Typography.Text>
      )}
    </Flex>
  );
};

const actionLabel: Record<LifecycleAction, string> = {
  promote: 'Promote to Default',
  deprecate: 'Deprecate',
  'mark-defective': 'Mark Defective',
  restore: 'Restore previous Default',
};

export const ModuleVersions = () => {
  const { orgId, moduleId } = useParams<keyof MatchParams>() as MatchParams;
  const queryClient = useQueryClient();
  const [messageApi, messageContext] = message.useMessage();
  const [selected, setSelected] = useState<{
    action: LifecycleAction;
    version: CoreModuleVersion;
  }>();
  const [reason, setReason] = useState('');
  const [inspectedVersion, setInspectedVersion] = useState<CoreModuleVersion>();
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishDefinition, setPublishDefinition] = useState('');
  const [stablePrerelease, setStablePrerelease] = useState<CoreModuleVersion>();
  const [stableDefinition, setStableDefinition] = useState('');
  const [stableReason, setStableReason] = useState('');
  const [compareFrom, setCompareFrom] = useState<CoreModuleVersion>();
  const [compareToUuid, setCompareToUuid] = useState('');
  const lifecycleIdempotencyKey = useRef(crypto.randomUUID());
  const publishIdempotencyKey = useRef(crypto.randomUUID());
  const stableIdempotencyKey = useRef(crypto.randomUUID());
  const catalogue = useGetModuleCatalogueEntry(orgId, moduleId);
  const permissionResource = `organization:${orgId}`;
  const permissions = useRBACPermissions(
    [RBACPermission.MODULE_VERSION_PUBLISH, ...Object.values(moduleVersionActionPermission)].map(
      (permission) => ({ resource: permissionResource, permission }),
    ),
  );
  const allowed = (permission: RBACPermission) =>
    permissions.allowed({ resource: permissionResource, permission });
  const canPublish =
    allowed(RBACPermission.MODULE_VERSION_PUBLISH) && catalogue.data?.status === 'active';
  const canPublishStable = canPublish && allowed(RBACPermission.MODULE_VERSION_DEPRECATE);
  const canTransition = (action: LifecycleAction) =>
    allowed(moduleVersionActionPermission[action]) &&
    (catalogue.data?.status === 'active' || action === 'mark-defective' || action === 'deprecate');
  const versions = useListModuleVersions(orgId, moduleId, {
    include_deprecated: true,
    include_defective: true,
  });
  const versionHistoryError = moduleVersionHistoryErrorCopy(versions.error?.response?.status);
  const versionItems = visibleModuleVersionItems(versions);
  const comparison = useCompareModuleVersions(
    orgId,
    moduleId,
    compareFrom?.uuid ?? '',
    compareToUuid,
    { query: { enabled: Boolean(compareFrom && compareToUuid) } },
  );
  const transition = useTransitionModuleVersion({
    mutation: {
      onSuccess: async () => {
        await invalidateModuleManagementQueries(queryClient, orgId, moduleId);
        messageApi.success('Module Version lifecycle updated');
        lifecycleIdempotencyKey.current = crypto.randomUUID();
        setSelected(undefined);
        setReason('');
      },
      onError: () => messageApi.error('Module Version lifecycle update failed'),
    },
    request: { headers: { 'Idempotency-Key': lifecycleIdempotencyKey.current } },
  });
  const publish = usePublishModuleVersion({
    mutation: {
      onSuccess: async () => {
        await invalidateModuleManagementQueries(queryClient, orgId, moduleId);
        publishIdempotencyKey.current = crypto.randomUUID();
        setPublishOpen(false);
        messageApi.success('Immutable Proposed Module Version published');
      },
      onError: () => messageApi.error('Module Version publication failed'),
    },
    request: { headers: { 'Idempotency-Key': publishIdempotencyKey.current } },
  });
  const publishStable = usePublishStableModuleVersionSuccessor({
    mutation: {
      onSuccess: async () => {
        await invalidateModuleManagementQueries(queryClient, orgId, moduleId);
        stableIdempotencyKey.current = crypto.randomUUID();
        setStablePrerelease(undefined);
        setStableDefinition('');
        setStableReason('');
        messageApi.success('Stable successor published and prerelease deprecated atomically');
      },
      onError: () => messageApi.error('Stable successor publication failed'),
    },
    request: { headers: { 'Idempotency-Key': stableIdempotencyKey.current } },
  });

  const openPublish = () => {
    if (!canPublish) return;
    const source = versions.data?.items.find((item) => item.version.lifecycle_status === 'default');
    const body = source ? publicationBodyFromDetail(source) : emptyPublicationBody();
    body.semantic_version = '';
    setPublishDefinition(JSON.stringify(body, null, 2));
    setPublishOpen(true);
  };

  const openStableSuccessor = (prerelease: CoreModuleVersion) => {
    if (!canPublishStable) return;
    const source = versions.data?.items.find((item) => item.version.uuid === prerelease.uuid);
    if (!source) return;
    const body = publicationBodyFromDetail(source);
    body.semantic_version = stableSuccessorSemanticVersion(prerelease.semantic_version);
    setStableDefinition(JSON.stringify(body, null, 2));
    setStableReason('');
    setStablePrerelease(prerelease);
  };

  const columns: ColumnsType<CoreModuleVersion> = [
    {
      title: 'Version',
      render: (_, item) => (
        <Typography.Text code>{item.semantic_version ?? item.opaque_version_id}</Typography.Text>
      ),
    },
    {
      title: 'Lifecycle',
      dataIndex: 'lifecycle_status',
      render: (status: CoreModuleVersion['lifecycle_status']) => (
        <Tag
          color={
            status === 'default'
              ? 'green'
              : status === 'defective'
                ? 'red'
                : status === 'proposed'
                  ? 'blue'
                  : 'default'
          }>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Verification',
      dataIndex: 'verification_status',
      render: (status) => <Tag>{status}</Tag>,
    },
    {
      title: 'Artifact digest',
      dataIndex: 'artifact_digest',
      ellipsis: true,
      render: (digest) => digest || 'Not declared',
    },
    {
      title: 'Published',
      dataIndex: 'created_at',
      render: (value) => formatDate(value, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE),
    },
    {
      title: 'Actions',
      render: (_, version) => (
        <Space wrap>
          <Button size={'small'} onClick={() => setInspectedVersion(version)}>
            Evidence
          </Button>
          <Button
            size={'small'}
            onClick={() => {
              setCompareFrom(version);
              setCompareToUuid('');
            }}>
            Compare
          </Button>
          {version.lifecycle_status === 'proposed' && version.semantic_version?.includes('-') && (
            <Button
              disabled={!canPublishStable}
              size={'small'}
              type={'primary'}
              onClick={() => openStableSuccessor(version)}>
              Publish stable successor
            </Button>
          )}
          {moduleVersionExtensionActions({ orgId, moduleId, version }).map((action) => (
            <Button
              key={action.id}
              size={'small'}
              type={action.primary ? 'primary' : 'default'}
              href={action.href}>
              {action.label}
            </Button>
          ))}
          {moduleVersionLifecycleActions(
            version,
            catalogue.data?.previous_default_version_uuid,
          ).map((action) => (
            <Button
              key={action}
              disabled={!canTransition(action)}
              danger={action === 'mark-defective'}
              size={'small'}
              onClick={() => setSelected({ action, version })}>
              {actionLabel[action]}
            </Button>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <Flex vertical gap={'middle'}>
      {messageContext}
      <Alert
        type={'info'}
        showIcon
        message={'Every version starts Proposed and unverified'}
        description={
          'Unverified is descriptive in this iteration. Proposed versions may be selected explicitly and stable versions may be promoted immediately.'
        }
      />
      <Flex justify={'flex-end'}>
        <Button
          type={'primary'}
          onClick={openPublish}
          disabled={
            !canPublish ||
            versions.isPending ||
            versions.isError ||
            versionItems.some((item) => item.version.lifecycle_status === 'proposed')
          }>
          Publish Module Version
        </Button>
      </Flex>
      {versions.isError && (
        <Alert
          type={'error'}
          showIcon
          message={versionHistoryError.message}
          description={versionHistoryError.description}
        />
      )}
      <Table
        rowKey={'uuid'}
        loading={versions.isPending}
        dataSource={versionItems.map((item) => item.version)}
        columns={columns}
        locale={{
          emptyText: versions.isError ? 'Version history unavailable' : 'No Module Versions found',
        }}
        expandable={{
          expandedRowRender: (version) => (
            <Flex vertical gap={'small'}>
              {version.release_notes && (
                <Typography.Paragraph>{version.release_notes}</Typography.Paragraph>
              )}
              <Typography.Text type={'secondary'}>Version UUID: {version.uuid}</Typography.Text>
              <Typography.Text type={'secondary'}>
                Source revision: {version.source_revision || 'Not declared'}
              </Typography.Text>
            </Flex>
          ),
        }}
      />
      <Modal
        title={selected ? actionLabel[selected.action] : ''}
        open={Boolean(selected)}
        okText={selected ? actionLabel[selected.action] : 'Confirm'}
        okButtonProps={{
          danger: selected?.action === 'mark-defective',
          disabled: !selected || !canTransition(selected.action) || !reason.trim(),
        }}
        confirmLoading={transition.isPending}
        onCancel={() => setSelected(undefined)}
        onOk={() => {
          if (!selected || !canTransition(selected.action)) return;
          transition.mutate({
            orgId,
            moduleId,
            moduleVersionId: selected.version.uuid,
            lifecycleAction: selected.action,
            data: {
              expected_resource_version: selected.version.resource_version,
              reason: reason.trim(),
            },
          });
        }}>
        {selected?.action === 'mark-defective' && (
          <Alert
            type={'error'}
            showIcon
            icon={<ExclamationCircleOutlined />}
            message={'Defective is terminal and blocks normal deployment use'}
            style={{ marginBottom: 16 }}
          />
        )}
        {selected?.action === 'restore' && (
          <Alert
            type={'warning'}
            showIcon
            message={'Only the immediately preceding Deprecated Default can be restored'}
            style={{ marginBottom: 16 }}
          />
        )}
        <Form layout={'vertical'}>
          <Form.Item label={'Audited reason'} required>
            <Input.TextArea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
            />
          </Form.Item>
        </Form>
      </Modal>
      <ModuleVersionEvidence
        orgId={orgId}
        moduleId={moduleId}
        version={inspectedVersion}
        onClose={() => setInspectedVersion(undefined)}
      />
      <Modal
        width={820}
        title={'Publish immutable Proposed Module Version'}
        open={publishOpen}
        okText={'Publish Proposed version'}
        okButtonProps={{ disabled: !canPublish }}
        confirmLoading={publish.isPending}
        onCancel={() => setPublishOpen(false)}
        onOk={() => {
          if (!canPublish) return;
          try {
            const data = JSON.parse(publishDefinition) as ModuleVersionPublishBody;
            publish.mutate({ orgId, moduleId, data });
          } catch {
            messageApi.error('The complete Module Version definition must be valid JSON');
          }
        }}>
        <Alert
          type={'warning'}
          showIcon
          message={'Publishing creates a permanent immutable version'}
          description={
            'Review the complete definition and choose a new canonical SemVer. External artifact digests are optional claims, not verification. When the Resource Type declares outputs, include the matching output_schema explicitly; the server validates its immutable interface contract before publishing.'
          }
          style={{ marginBottom: 16 }}
        />
        <Input.TextArea
          aria-label={'Complete Module Version definition'}
          value={publishDefinition}
          onChange={(event) => setPublishDefinition(event.target.value)}
          autoSize={{ minRows: 16, maxRows: 28 }}
          style={{ fontFamily: 'monospace' }}
        />
      </Modal>
      <Modal
        width={820}
        title={
          stablePrerelease
            ? `Publish stable successor for ${stablePrerelease.semantic_version}`
            : 'Publish stable successor'
        }
        open={Boolean(stablePrerelease)}
        okText={'Publish and deprecate prerelease'}
        okButtonProps={{ disabled: !canPublishStable || !stableReason.trim() }}
        confirmLoading={publishStable.isPending}
        onCancel={() => setStablePrerelease(undefined)}
        onOk={() => {
          if (!stablePrerelease || !canPublishStable) return;
          try {
            const version = JSON.parse(stableDefinition) as ModuleVersionPublishBody;
            publishStable.mutate({
              orgId,
              moduleId,
              moduleVersionId: stablePrerelease.uuid,
              data: {
                expected_prerelease_resource_version: stablePrerelease.resource_version,
                reason: stableReason.trim(),
                version,
              },
            });
          } catch {
            messageApi.error('The stable Module Version definition must be valid JSON');
          }
        }}>
        <Alert
          type={'info'}
          showIcon
          message={'One atomic catalogue operation'}
          description={
            'The stable version is a new immutable Proposed entity. The exact prerelease is deprecated only if publication succeeds.'
          }
          style={{ marginBottom: 16 }}
        />
        <Form layout={'vertical'}>
          <Form.Item label={'Reason for deprecating the prerelease'} required>
            <Input.TextArea
              value={stableReason}
              onChange={(event) => setStableReason(event.target.value)}
              rows={2}
            />
          </Form.Item>
          <Form.Item label={'Complete stable Module Version definition'} required>
            <Input.TextArea
              aria-label={'Complete stable Module Version definition'}
              value={stableDefinition}
              onChange={(event) => setStableDefinition(event.target.value)}
              autoSize={{ minRows: 14, maxRows: 24 }}
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        width={1100}
        title={
          compareFrom
            ? `Compare ${compareFrom.semantic_version ?? compareFrom.opaque_version_id}`
            : 'Compare Module Versions'
        }
        open={Boolean(compareFrom)}
        footer={<Button onClick={() => setCompareFrom(undefined)}>Close</Button>}
        onCancel={() => setCompareFrom(undefined)}>
        <Flex vertical gap={'middle'}>
          <Select
            aria-label={'Version to compare'}
            value={compareToUuid || undefined}
            placeholder={'Choose another immutable version'}
            onChange={setCompareToUuid}
            options={versionItems
              .filter((item) => item.version.uuid !== compareFrom?.uuid)
              .map((item) => ({
                value: item.version.uuid,
                label: item.version.semantic_version ?? item.version.opaque_version_id,
              }))}
          />
          {comparison.isPending && compareToUuid && <Typography.Text>Comparing…</Typography.Text>}
          {comparison.data && <ComparisonList comparison={comparison.data} />}
        </Flex>
      </Modal>
    </Flex>
  );
};
