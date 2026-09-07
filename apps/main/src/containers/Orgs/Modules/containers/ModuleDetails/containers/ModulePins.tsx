import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Checkbox,
  Flex,
  Form,
  Input,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import { useRef, useState } from 'react';
import { useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import { useListEnvironmentsInOrg } from '@src/hooks/react-query/v2/controlplane/environment/environment';
import {
  getListEnvironmentModuleVersionPinEventsQueryKey,
  getListEnvironmentModuleVersionPinsQueryKey,
  useAppendEnvironmentModuleVersionPinNote,
  useCreateEnvironmentModuleVersionPin,
  useExecuteEnvironmentModuleVersionPinBulkOperation,
  useGetModuleCatalogueEntry,
  useListEnvironmentModuleVersionPinEvents,
  useListEnvironmentModuleVersionPins,
  useListModuleVersions,
  usePreviewEnvironmentModuleVersionPinBulkOperation,
  useTransitionEnvironmentModuleVersionPin,
} from '@src/hooks/react-query/v2/controlplane/modules/modules';
import { RBACPermission, useRBACPermissions } from '@src/hooks/useRBAC';
import type {
  EnvironmentModuleVersionPin,
  ModuleVersionPinBulkAction,
  ModuleVersionPinBulkPreview,
} from '@src/models/v2/controlplane';

const PinHistory = ({ orgId, pin }: { orgId: string; pin: EnvironmentModuleVersionPin }) => {
  const events = useListEnvironmentModuleVersionPinEvents(orgId, pin.id);
  return (
    <Timeline
      pending={events.isPending ? 'Loading Pin history…' : undefined}
      items={(events.data ?? []).map((event) => ({
        children: (
          <Flex vertical>
            <Typography.Text strong>{event.event_type}</Typography.Text>
            <Typography.Text>{event.note ?? event.reason}</Typography.Text>
            <Typography.Text type={'secondary'}>
              revision {event.revision} · {new Date(event.created_at).toLocaleString()}
              {event.activation_event_id === pin.activation_event_id
                ? ' · current approval boundary'
                : ''}
            </Typography.Text>
          </Flex>
        ),
      }))}
    />
  );
};

export const ModulePins = () => {
  const { orgId, moduleId } = useParams<keyof MatchParams>() as MatchParams;
  const queryClient = useQueryClient();
  const [messageApi, messageContext] = message.useMessage();
  const [createOpen, setCreateOpen] = useState(false);
  const [environmentUUID, setEnvironmentUUID] = useState<string>();
  const [versionUUID, setVersionUUID] = useState<string>();
  const [confirmDefective, setConfirmDefective] = useState(false);
  const [reason, setReason] = useState('');
  const [transitioning, setTransitioning] = useState<EnvironmentModuleVersionPin>();
  const [annotating, setAnnotating] = useState<EnvironmentModuleVersionPin>();
  const [note, setNote] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<ModuleVersionPinBulkAction>('pin');
  const [bulkEnvironmentUUIDs, setBulkEnvironmentUUIDs] = useState<string[]>([]);
  const [bulkPreview, setBulkPreview] = useState<ModuleVersionPinBulkPreview>();
  const [bulkReason, setBulkReason] = useState('');
  const idempotencyKey = useRef(crypto.randomUUID());

  const catalogue = useGetModuleCatalogueEntry(orgId, moduleId);
  const versions = useListModuleVersions(orgId, moduleId, {
    include_deprecated: true,
    include_defective: true,
  });
  const environments = useListEnvironmentsInOrg(orgId, { per_page: 100 });
  const pins = useListEnvironmentModuleVersionPins(
    orgId,
    {
      module_uuid: catalogue.data?.uuid,
      include_removed: true,
    },
    { query: { enabled: Boolean(catalogue.data?.uuid) } },
  );
  const permissionEnvironmentUUIDs = [
    ...new Set([
      ...(environments.data?.items.map((environment) => environment.uuid) ?? []),
      ...(pins.data?.filter((pin) => pin.status !== 'removed').map((pin) => pin.environment_uuid) ??
        []),
    ]),
  ];
  const permissions = useRBACPermissions(
    permissionEnvironmentUUIDs.flatMap((uuid) =>
      [
        RBACPermission.MODULE_VERSION_PIN,
        RBACPermission.MODULE_VERSION_PIN_NOTE,
        RBACPermission.MODULE_VERSION_UNPIN,
        RBACPermission.MODULE_VERSION_PIN_DEFECTIVE,
      ].map((permission) => ({ resource: `env:${uuid}`, permission })),
    ),
  );
  const allowed = (uuid: string | undefined, permission: RBACPermission) =>
    Boolean(uuid) && permissions.allowed({ resource: `env:${uuid}`, permission });
  const canPinAny = permissionEnvironmentUUIDs.some((uuid) =>
    allowed(uuid, RBACPermission.MODULE_VERSION_PIN),
  );
  const canUnpinAny = permissionEnvironmentUUIDs.some((uuid) =>
    allowed(uuid, RBACPermission.MODULE_VERSION_UNPIN),
  );
  const bulkPermission =
    bulkAction === 'pin' ? RBACPermission.MODULE_VERSION_PIN : RBACPermission.MODULE_VERSION_UNPIN;
  const canApplyBulk =
    bulkEnvironmentUUIDs.length > 0 &&
    bulkEnvironmentUUIDs.every((uuid) => allowed(uuid, bulkPermission));
  const selectedVersion = versions.data?.items.find(
    ({ version }) => version.uuid === versionUUID,
  )?.version;
  const defectiveVersion = selectedVersion?.lifecycle_status === 'defective';
  const canCreate =
    allowed(environmentUUID, RBACPermission.MODULE_VERSION_PIN) &&
    (!defectiveVersion ||
      (confirmDefective && allowed(environmentUUID, RBACPermission.MODULE_VERSION_PIN_DEFECTIVE)));
  const invalidatePins = () =>
    queryClient.invalidateQueries({
      queryKey: getListEnvironmentModuleVersionPinsQueryKey(orgId),
    });
  const createPin = useCreateEnvironmentModuleVersionPin({
    mutation: {
      onSuccess: async () => {
        await invalidatePins();
        idempotencyKey.current = crypto.randomUUID();
        setCreateOpen(false);
        setReason('');
        messageApi.success('Exact Environment Module Version Pin created');
      },
      onError: () => messageApi.error('Pin could not be created'),
    },
    request: { headers: { 'Idempotency-Key': idempotencyKey.current } },
  });
  const transitionPin = useTransitionEnvironmentModuleVersionPin({
    mutation: {
      onSuccess: async () => {
        await invalidatePins();
        idempotencyKey.current = crypto.randomUUID();
        setTransitioning(undefined);
        setReason('');
        messageApi.success('Pin lifecycle updated');
      },
      onError: () => messageApi.error('Pin lifecycle update failed'),
    },
    request: { headers: { 'Idempotency-Key': idempotencyKey.current } },
  });
  const appendNote = useAppendEnvironmentModuleVersionPinNote({
    mutation: {
      onSuccess: async () => {
        await invalidatePins();
        if (annotating) {
          await queryClient.invalidateQueries({
            queryKey: getListEnvironmentModuleVersionPinEventsQueryKey(orgId, annotating.id),
          });
        }
        idempotencyKey.current = crypto.randomUUID();
        setAnnotating(undefined);
        setNote('');
        messageApi.success('Immutable Pin note appended');
      },
      onError: () => messageApi.error('Pin note could not be appended'),
    },
    request: { headers: { 'Idempotency-Key': idempotencyKey.current } },
  });
  const previewBulk = usePreviewEnvironmentModuleVersionPinBulkOperation({
    mutation: {
      onSuccess: setBulkPreview,
      onError: () => messageApi.error('Bulk Pin preview failed'),
    },
  });
  const executeBulk = useExecuteEnvironmentModuleVersionPinBulkOperation({
    mutation: {
      onSuccess: async () => {
        await invalidatePins();
        idempotencyKey.current = crypto.randomUUID();
        setBulkOpen(false);
        setBulkPreview(undefined);
        setBulkReason('');
        messageApi.success('Frozen Environment Pin set applied atomically');
      },
      onError: () => messageApi.error('Bulk Pin operation failed'),
    },
    request: { headers: { 'Idempotency-Key': idempotencyKey.current } },
  });

  const selectedEnvironment = environments.data?.items.find(
    (environment) => environment.uuid === environmentUUID,
  );

  return (
    <Flex vertical gap={'middle'}>
      {messageContext}
      <Alert
        type={'info'}
        showIcon
        message={'Pins preserve one exact immutable Module Version in one Environment'}
        description={
          'A Pin is an audited safety boundary, not a selector policy. An authorised add-on may override it only through the explicit, recoverable Core operation protocol.'
        }
      />
      <Flex justify={'flex-end'} gap={'small'}>
        <Button disabled={!canPinAny && !canUnpinAny} onClick={() => setBulkOpen(true)}>
          Project / application Pin set
        </Button>
        <Button disabled={!canPinAny} type={'primary'} onClick={() => setCreateOpen(true)}>
          Pin Environment
        </Button>
      </Flex>
      <Table
        rowKey={'id'}
        loading={pins.isPending}
        dataSource={pins.data ?? []}
        expandable={{
          expandedRowRender: (pin) => <PinHistory orgId={orgId} pin={pin} />,
          rowExpandable: () => true,
        }}
        columns={[
          { title: 'Project', dataIndex: 'project_id' },
          { title: 'Environment', dataIndex: 'environment_id' },
          {
            title: 'Version',
            dataIndex: 'version_uuid',
            render: (uuid) =>
              versions.data?.items.find((item) => item.version.uuid === uuid)?.version
                .semantic_version ?? uuid,
          },
          {
            title: 'Status',
            dataIndex: 'status',
            render: (status) => (
              <Tag
                color={
                  status === 'active'
                    ? 'green'
                    : status === 'override_pending'
                      ? 'orange'
                      : undefined
                }>
                {status}
              </Tag>
            ),
          },
          {
            title: 'Actions',
            render: (_, pin) => (
              <Space>
                {pin.status !== 'removed' && (
                  <Button
                    disabled={
                      !allowed(pin.environment_uuid, RBACPermission.MODULE_VERSION_PIN_NOTE)
                    }
                    onClick={() => setAnnotating(pin)}>
                    Add note
                  </Button>
                )}
                {pin.status === 'active' && (
                  <Button
                    disabled={!allowed(pin.environment_uuid, RBACPermission.MODULE_VERSION_UNPIN)}
                    onClick={() => setTransitioning(pin)}>
                    Unpin
                  </Button>
                )}
                {pin.status === 'overridden' && (
                  <Button
                    disabled={!allowed(pin.environment_uuid, RBACPermission.MODULE_VERSION_UNPIN)}
                    danger
                    onClick={() => setTransitioning(pin)}>
                    Discard permanently
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        width={960}
        title={'Atomic Project / application Pin set'}
        open={bulkOpen}
        okText={bulkPreview ? 'Apply atomically' : 'Preview frozen set'}
        confirmLoading={previewBulk.isPending || executeBulk.isPending}
        okButtonProps={{
          disabled:
            !canApplyBulk || (bulkPreview ? !bulkPreview.eligible || !bulkReason.trim() : false),
          danger: bulkAction === 'discard',
        }}
        onCancel={() => {
          setBulkOpen(false);
          setBulkPreview(undefined);
        }}
        onOk={() => {
          if (!catalogue.data || !canApplyBulk) return;
          if (!bulkPreview) {
            previewBulk.mutate({
              orgId,
              data: {
                action: bulkAction,
                module_uuid: catalogue.data.uuid,
                environment_uuids: bulkEnvironmentUUIDs,
              },
            });
            return;
          }
          executeBulk.mutate({
            orgId,
            data: {
              action: bulkAction,
              module_uuid: catalogue.data.uuid,
              environment_uuids: bulkEnvironmentUUIDs,
              preview_fingerprint: bulkPreview.fingerprint,
              reason: bulkReason.trim(),
            },
          });
        }}>
        <Alert
          type={'info'}
          showIcon
          message={'The preview freezes exact Environment decisions'}
          description={
            'Every Environment is authorised and validated. Execution fails atomically if membership, active Versions or Pins changed.'
          }
        />
        <Form layout={'vertical'}>
          <Form.Item label={'Action'} required>
            <Select<ModuleVersionPinBulkAction>
              value={bulkAction}
              onChange={(value) => {
                setBulkAction(value);
                setBulkPreview(undefined);
              }}
              options={[
                {
                  value: 'pin',
                  disabled: !canPinAny,
                  label: 'Pin each Environment to its currently active exact Version',
                },
                { value: 'unpin', label: 'Remove active Pins', disabled: !canUnpinAny },
                {
                  value: 'discard',
                  label: 'Permanently discard overridden Pins',
                  disabled: !canUnpinAny,
                },
              ]}
            />
          </Form.Item>
          <Form.Item label={'Exact Environments'} required>
            <Select
              mode={'multiple'}
              value={bulkEnvironmentUUIDs}
              onChange={(value) => {
                setBulkEnvironmentUUIDs(value);
                setBulkPreview(undefined);
              }}
              options={environments.data?.items.map((environment) => ({
                value: environment.uuid,
                label: `${environment.project_id} / ${environment.display_name} (${environment.env_type_id})`,
                disabled: !allowed(environment.uuid, bulkPermission),
              }))}
            />
          </Form.Item>
          {bulkPreview && (
            <>
              <Table
                size={'small'}
                rowKey={'environment_uuid'}
                pagination={false}
                dataSource={bulkPreview.items}
                columns={[
                  { title: 'Project', dataIndex: 'project_id' },
                  { title: 'Environment', dataIndex: 'environment_id' },
                  {
                    title: 'Impact',
                    render: (_, item) =>
                      item.production ? (
                        <Tag color={'red'}>Production</Tag>
                      ) : (
                        <Tag>{item.environment_type}</Tag>
                      ),
                  },
                  {
                    title: 'Decision',
                    render: (_, item) =>
                      item.eligible ? (
                        <Tag color={'green'}>Eligible</Tag>
                      ) : (
                        <Tag color={'red'}>{item.problem}</Tag>
                      ),
                  },
                ]}
              />
              <Form.Item label={'Audited reason'} required>
                <Input.TextArea
                  value={bulkReason}
                  onChange={(event) => setBulkReason(event.target.value)}
                  rows={3}
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
      <Modal
        title={'Pin Environment to exact Module Version'}
        open={createOpen}
        okText={'Create Pin'}
        confirmLoading={createPin.isPending}
        okButtonProps={{
          disabled:
            !canCreate || !selectedEnvironment?.project_uuid || !versionUUID || !reason.trim(),
        }}
        onCancel={() => setCreateOpen(false)}
        onOk={() => {
          if (!canCreate || !catalogue.data || !selectedEnvironment?.project_uuid || !versionUUID)
            return;
          createPin.mutate({
            orgId,
            data: {
              project_uuid: selectedEnvironment.project_uuid,
              environment_uuid: selectedEnvironment.uuid,
              module_uuid: catalogue.data.uuid,
              version_uuid: versionUUID,
              reason: reason.trim(),
              ...(defectiveVersion ? { confirm_defective_version_uuid: versionUUID } : {}),
            },
          });
        }}>
        <Form layout={'vertical'}>
          <Form.Item label={'Environment'} required>
            <Select
              value={environmentUUID}
              onChange={(uuid) => {
                setEnvironmentUUID(uuid);
                setConfirmDefective(false);
              }}
              options={environments.data?.items.map((environment) => ({
                value: environment.uuid,
                label: `${environment.project_id} / ${environment.display_name} (${environment.env_type_id})`,
                disabled: !allowed(environment.uuid, RBACPermission.MODULE_VERSION_PIN),
              }))}
            />
          </Form.Item>
          <Form.Item label={'Exact Module Version'} required>
            <Select
              value={versionUUID}
              onChange={(uuid) => {
                setVersionUUID(uuid);
                setConfirmDefective(false);
              }}
              options={versions.data?.items.map(({ version }) => ({
                value: version.uuid,
                label: `${version.semantic_version ?? version.opaque_version_id} · ${version.lifecycle_status}`,
                disabled:
                  version.lifecycle_status === 'defective' &&
                  !allowed(environmentUUID, RBACPermission.MODULE_VERSION_PIN_DEFECTIVE),
              }))}
            />
          </Form.Item>
          {defectiveVersion && (
            <Alert
              type={'error'}
              showIcon
              message={'This exact Version is Defective'}
              description={
                <Checkbox
                  checked={confirmDefective}
                  onChange={(event) => setConfirmDefective(event.target.checked)}>
                  I explicitly confirm pinning Defective Version {versionUUID}. This does not repair
                  or deploy the Environment.
                </Checkbox>
              }
            />
          )}
          <Form.Item label={'Audited reason'} required>
            <Input.TextArea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={'Add immutable Pin note'}
        open={Boolean(annotating)}
        okText={'Append note'}
        okButtonProps={{
          disabled:
            !allowed(annotating?.environment_uuid, RBACPermission.MODULE_VERSION_PIN_NOTE) ||
            !note.trim(),
        }}
        confirmLoading={appendNote.isPending}
        onCancel={() => {
          setAnnotating(undefined);
          setNote('');
        }}
        onOk={() => {
          if (
            !annotating ||
            !allowed(annotating.environment_uuid, RBACPermission.MODULE_VERSION_PIN_NOTE)
          )
            return;
          appendNote.mutate({ orgId, pinId: annotating.id, data: { note: note.trim() } });
        }}>
        <Alert
          type={'info'}
          showIcon
          message={'Notes add context without changing protection'}
          description={'The Pin status, exact Version and approval boundary remain unchanged.'}
        />
        <Input.TextArea
          style={{ marginTop: 16 }}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
        />
      </Modal>
      <Modal
        title={transitioning?.status === 'overridden' ? 'Discard Pin permanently' : 'Remove Pin'}
        open={Boolean(transitioning)}
        okText={transitioning?.status === 'overridden' ? 'Discard permanently' : 'Unpin'}
        okButtonProps={{
          danger: transitioning?.status === 'overridden',
          disabled:
            !allowed(transitioning?.environment_uuid, RBACPermission.MODULE_VERSION_UNPIN) ||
            !reason.trim(),
        }}
        confirmLoading={transitionPin.isPending}
        onCancel={() => setTransitioning(undefined)}
        onOk={() => {
          if (
            !transitioning ||
            !allowed(transitioning.environment_uuid, RBACPermission.MODULE_VERSION_UNPIN)
          )
            return;
          transitionPin.mutate({
            orgId,
            pinId: transitioning.id,
            pinAction: transitioning.status === 'overridden' ? 'discard' : 'unpin',
            data: {
              expected_resource_version: transitioning.resource_version,
              reason: reason.trim(),
            },
          });
        }}>
        <Input.TextArea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
        />
      </Modal>
    </Flex>
  );
};
