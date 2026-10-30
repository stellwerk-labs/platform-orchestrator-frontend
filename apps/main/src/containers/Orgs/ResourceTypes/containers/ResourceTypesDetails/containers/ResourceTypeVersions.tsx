import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Descriptions,
  Flex,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Typography,
} from 'antd';
import { isAxiosError } from 'axios';
import { useRef, useState } from 'react';
import { useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import {
  getGetResourceTypeQueryKey,
  getListResourceTypeVersionsQueryKey,
  publishResourceTypeVersion,
  useGetResourceType,
  useListResourceTypeVersions,
} from '@src/hooks/react-query/v2/controlplane/resource-type/resource-type';
import { RBACPermission, RBACStatus, useRBAC } from '@src/hooks/useRBAC';
import type { ResourceTypeModuleContract, ResourceTypeVersion } from '@src/models/v2/controlplane';

export const ResourceTypeVersions = () => {
  const { orgId, resourceTypeId } = useParams<keyof MatchParams>() as MatchParams;
  const client = useQueryClient();
  const resource = useGetResourceType(orgId, resourceTypeId);
  const [page, setPage] = useState<string>();
  const versions = useListResourceTypeVersions(orgId, resourceTypeId, {
    per_page: 50,
    page,
  });
  const canPublish =
    useRBAC(RBACPermission.RESOURCE_TYPE_WRITE) === RBACStatus.ALLOWED && !resource.data?.built_in;
  const [selected, setSelected] = useState<ResourceTypeVersion>();
  const [review, setReview] = useState<{
    catalogueRevision: number;
    version: number;
    outputs: string;
    contract: string;
    reason: string;
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const intent = useRef({ payload: '', key: crypto.randomUUID() });
  return (
    <Flex vertical gap={'middle'}>
      <Alert
        type={'info'}
        showIcon
        message={'Evolve the interface without changing existing Modules'}
        description={
          'Every Module Version binds one exact interface. Publishing version 2 does not rewrite version 1 or make old clients select the latest version. Omitted selections still mean version 1.'
        }
      />
      {(error || versions.error) && (
        <Alert
          type={'error'}
          showIcon
          message={
            error || 'Interface history could not be loaded. Check server support and permissions.'
          }
        />
      )}
      <Space>
        <Button
          disabled={!canPublish || !resource.data || busy}
          onClick={() => {
            if (!resource.data) return;
            const source = selected ?? resource.data;
            setError('');
            setReview({
              catalogueRevision: resource.data.resource_version,
              version: selected ? selected.version + 1 : 2,
              outputs: JSON.stringify(source.output_schema, null, 2),
              contract:
                source.module_contract === undefined
                  ? ''
                  : JSON.stringify(source.module_contract, null, 2),
              reason: '',
            });
          }}>
          Publish interface version
        </Button>
        <Button disabled={!page} onClick={() => setPage(undefined)}>
          First interface page
        </Button>
        <Button
          disabled={!versions.data?.next_page_token}
          onClick={() => setPage(versions.data?.next_page_token)}>
          Next interface page
        </Button>
      </Space>
      <Table
        rowKey={'uuid'}
        dataSource={versions.data?.items ?? []}
        loading={versions.isPending}
        pagination={false}
        columns={[
          { title: 'Interface', dataIndex: 'version' },
          { title: 'UUID', dataIndex: 'uuid' },
          { title: 'Created', dataIndex: 'created_at' },
          { title: 'Reason', dataIndex: 'reason' },
          {
            title: 'Definition',
            render: (_, version) => (
              <Button onClick={() => setSelected(version)}>Read interface {version.version}</Button>
            ),
          },
        ]}
      />
      {selected && (
        <>
          <Descriptions column={1} bordered size={'small'}>
            <Descriptions.Item label={'Immutable interface'}>{selected.version}</Descriptions.Item>
            <Descriptions.Item label={'Interface UUID'}>{selected.uuid}</Descriptions.Item>
          </Descriptions>
          <Input.TextArea
            aria-label={'Immutable Resource Type interface'}
            readOnly
            rows={14}
            value={JSON.stringify(selected, null, 2)}
          />
        </>
      )}
      <Modal
        title={'Publish immutable Resource Type interface'}
        open={Boolean(review)}
        confirmLoading={busy}
        onCancel={() => setReview(undefined)}
        okText={'Publish interface'}
        okButtonProps={{
          disabled:
            !canPublish ||
            !review?.reason.trim() ||
            !Number.isInteger(review?.version) ||
            (review?.version ?? 0) < 2,
        }}
        onOk={async () => {
          if (!review || !canPublish) return;
          setBusy(true);
          setError('');
          try {
            const outputs: unknown = JSON.parse(review.outputs);
            const contract: unknown = review.contract.trim()
              ? JSON.parse(review.contract)
              : undefined;
            if (
              !outputs ||
              typeof outputs !== 'object' ||
              Array.isArray(outputs) ||
              (contract !== undefined &&
                (!contract || typeof contract !== 'object' || Array.isArray(contract)))
            )
              throw new Error('Output schema and optional Module contract must be JSON objects.');
            const body = {
              version: review.version,
              expected_resource_version: review.catalogueRevision,
              reason: review.reason.trim(),
              output_schema: outputs as Record<string, unknown>,
              ...(contract === undefined
                ? {}
                : { module_contract: contract as ResourceTypeModuleContract }),
            };
            const payload = JSON.stringify(body);
            if (intent.current.payload !== payload)
              intent.current = { payload, key: crypto.randomUUID() };
            const published = await publishResourceTypeVersion(orgId, resourceTypeId, body, {
              headers: { 'Idempotency-Key': intent.current.key },
            });
            setSelected(published);
            setReview(undefined);
            await Promise.all([
              client.invalidateQueries({
                queryKey: getGetResourceTypeQueryKey(orgId, resourceTypeId),
              }),
              client.invalidateQueries({
                queryKey: getListResourceTypeVersionsQueryKey(orgId, resourceTypeId),
              }),
            ]);
          } catch (cause) {
            setError(
              isAxiosError<{ message?: string }>(cause)
                ? (cause.response?.data?.message ?? cause.message)
                : cause instanceof Error
                  ? cause.message
                  : 'Publication failed.',
            );
          } finally {
            setBusy(false);
          }
        }}>
        <Typography.Paragraph>
          Choose the exact next consecutive interface number. Catalogue revision{' '}
          {review?.catalogueRevision} is the reviewed concurrency precondition, not an interface
          number. A concurrent change is rejected; reload before reviewing again.
        </Typography.Paragraph>
        <Space direction={'vertical'} style={{ width: '100%' }}>
          <InputNumber
            aria-label={'New interface version'}
            min={2}
            value={review?.version}
            onChange={(value) =>
              setReview((current) => current && { ...current, version: value ?? 2 })
            }
          />
          <Input.TextArea
            aria-label={'Interface output schema'}
            rows={8}
            value={review?.outputs}
            onChange={(event) =>
              setReview((current) => current && { ...current, outputs: event.target.value })
            }
          />
          <Input.TextArea
            aria-label={'Interface Module contract'}
            placeholder={'Optional Module contract, leave blank to omit'}
            rows={6}
            value={review?.contract}
            onChange={(event) =>
              setReview((current) => current && { ...current, contract: event.target.value })
            }
          />
          <Input.TextArea
            aria-label={'Interface publication reason'}
            rows={2}
            value={review?.reason}
            onChange={(event) =>
              setReview((current) => current && { ...current, reason: event.target.value })
            }
          />
          {error && <Alert type={'error'} message={error} />}
        </Space>
      </Modal>
    </Flex>
  );
};
