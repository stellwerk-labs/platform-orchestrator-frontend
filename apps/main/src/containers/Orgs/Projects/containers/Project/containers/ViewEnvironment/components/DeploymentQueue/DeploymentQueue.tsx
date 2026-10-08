import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  message,
  Popconfirm,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { formatDistanceStrict } from 'date-fns';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import {
  getDeploymentQueueItem,
  getListDeploymentQueueItemsQueryKey,
  getListDeploymentsQueryKey,
  getListLastDeploymentsQueryKey,
  listDeploymentQueueItems,
  useCancelDeploymentQueueItem,
} from '@src/hooks/react-query/v2/dataplane/deployment/deployment';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { RBACPermission, useRBACPermissions } from '@src/hooks/useRBAC';
import { useUserDetails } from '@src/hooks/useUserDetails';
import { DeploymentQueueItem, ListDeploymentQueueItemsParams } from '@src/models/v2/dataplane';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';
import { generateDeploymentUrl } from '@src/utilities/navigation';

import { DeploymentMode } from '../Deploys/components/DeploymentMode';

const refreshIntervalMs = 5_000;
const retainedOutcomes = 5;

// Why a queued request ended without a Deployment, phrased as what to do next.
const reasonAdvice: Record<string, string> = {
  outcome_unreconciled:
    'A failed plugin-dispatched Deployment blocks this Environment. Someone allowed to acknowledge its outcome must do so before the request can be made again.',
  deployment_base_changed:
    'The Environment changed after this request was prepared. Review the current Deployment and request again.',
  environment_deleting: 'The Environment is being deleted.',
  previous_deployment_failed:
    'The request asked not to start after a failed Deployment, and the Deployment it waited for failed. Fix the cause and request it again.',
};

const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const cancelRefusals: Record<string, string> = {
  queue_item_dispatching: 'The request is starting right now and can no longer be cancelled.',
  queue_item_settled: 'The request already left the queue.',
};

interface DeploymentQueueProps {
  environmentUuid?: string;
}

export const DeploymentQueue = ({ environmentUuid }: DeploymentQueueProps) => {
  const { orgId, projectId, envId } = useParams<keyof MatchParams>() as MatchParams;
  const queryClient = useQueryClient();
  const [messageApi, messageContext] = message.useMessage();
  const { getUserDisplayName } = useUserDetails(orgId);
  const [outcomes, setOutcomes] = useState<DeploymentQueueItem[]>([]);
  const queuedIds = useRef<Set<string> | undefined>(undefined);

  const params: ListDeploymentQueueItemsParams = {
    project_id: projectId,
    env_id: envId,
    state: 'queued',
  };
  const queueKey = getAllPagesQueryKey(getListDeploymentQueueItemsQueryKey(orgId, params));
  const queue = useAllPages(queueKey, (page) => listDeploymentQueueItems(orgId, page), params, {
    refetchInterval: (query) => (query.state.data?.length ? refreshIntervalMs : false),
  });
  const items = queue.data;

  const cancelCheck = {
    resource: `env:${environmentUuid}`,
    permission: RBACPermission.DEPLOYMENT_WRITE,
  };
  const permissions = useRBACPermissions(environmentUuid ? [cancelCheck] : []);
  const canCancel = permissions.allowed(cancelCheck);

  const remember = useCallback(
    (settled: DeploymentQueueItem[]) =>
      setOutcomes((previous) =>
        [...settled, ...previous.filter(({ id }) => !settled.some((item) => item.id === id))].slice(
          0,
          retainedOutcomes,
        ),
      ),
    [],
  );

  // A request that leaves the queue was dispatched, cancelled, expired or rejected.
  // Read it once to say which, and refresh the Deployments when one started.
  useEffect(() => {
    if (!items) return;
    const current = new Set(items.map(({ id }) => id));
    const left = [...(queuedIds.current ?? [])].filter((id) => !current.has(id));
    queuedIds.current = current;
    if (left.length === 0) return;
    Promise.all(left.map((id) => getDeploymentQueueItem(orgId, id).catch(() => undefined))).then(
      (read) => {
        const settled = read.filter(
          (item): item is DeploymentQueueItem => item !== undefined && item.state !== 'queued',
        );
        if (settled.some(({ state }) => state === 'dispatched')) {
          queryClient.invalidateQueries({ queryKey: getListLastDeploymentsQueryKey(orgId) });
          queryClient.invalidateQueries({ queryKey: getListDeploymentsQueryKey(orgId) });
        }
        remember(settled);
      },
    );
  }, [items, orgId, queryClient, remember]);

  const cancel = useCancelDeploymentQueueItem({
    mutation: {
      onSuccess: (item) => {
        queuedIds.current?.delete(item.id);
        remember([item]);
      },
      onError: (error) => {
        const body = error.response?.data;
        messageApi.error(
          cancelRefusals[body?.error ?? ''] ??
            body?.message ??
            'The queued request could not be cancelled.',
        );
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: queueKey }),
    },
  });

  const now = queue.dataUpdatedAt;
  const columns: ColumnsType<DeploymentQueueItem> = [
    { title: 'Position', dataIndex: 'position', key: 'position', width: 90 },
    {
      title: 'Mode',
      dataIndex: 'mode',
      key: 'mode',
      width: 110,
      render: (mode: DeploymentQueueItem['mode']) => (
        <DeploymentMode mode={mode} planOnly={false} />
      ),
    },
    {
      title: 'Requested by',
      dataIndex: 'created_by',
      key: 'created_by',
      render: (createdBy: string) => getUserDisplayName(createdBy),
    },
    {
      title: 'Waiting',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (createdAt: string) => formatDistanceStrict(new Date(createdAt), now),
    },
    {
      title: 'Expires',
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (expiresAt: string) => (
        <span title={formatDate(expiresAt, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE)}>
          {Date.parse(expiresAt) > now
            ? `in ${formatDistanceStrict(new Date(expiresAt), now)}`
            : 'now'}
        </span>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, item) => (
        <Flex gap={'small'} wrap align={'center'}>
          {item.attempts > 0 ? (
            <Typography.Text type={'warning'}>
              {`Retrying after ${item.attempts} failed attempt(s)`}
              {item.last_error && `: ${item.last_error}`}
            </Typography.Text>
          ) : (
            <span>{'Waiting'}</span>
          )}
          {item.halt_on_failure && (
            <Tag title={'Not started if the Deployment it waits for fails.'}>
              {'Halts on failure'}
            </Tag>
          )}
        </Flex>
      ),
    },
    ...(canCancel
      ? [
          {
            key: 'actions',
            width: 100,
            render: (_: unknown, item: DeploymentQueueItem) => (
              <Popconfirm
                title={'Cancel this queued request?'}
                description={'It will not be started. The cancellation is recorded with your name.'}
                okText={'Cancel request'}
                cancelText={'Keep'}
                onConfirm={() => cancel.mutate({ orgId, queueItemId: item.id, data: {} })}>
                <Button size={'small'} danger>
                  {'Cancel'}
                </Button>
              </Popconfirm>
            ),
          },
        ]
      : []),
  ];

  const outcomeAlert = (item: DeploymentQueueItem) => {
    const request = `Queued ${item.mode} requested by ${getUserDisplayName(item.created_by)}`;
    switch (item.state) {
      case 'dispatched':
        return {
          type: 'success' as const,
          title: `${request} started.`,
          detail: item.deployment_id && (
            <Link
              to={generateDeploymentUrl(orgId, projectId, envId, item.deployment_id, 'resources')}>
              {`Open Deployment ${item.deployment_id}`}
            </Link>
          ),
        };
      case 'cancelled':
        return {
          type: 'info' as const,
          title: `${request} was cancelled${item.settled_by ? ` by ${getUserDisplayName(item.settled_by)}` : ''}.`,
          detail: item.reason_message,
        };
      case 'expired':
        return {
          type: 'warning' as const,
          title: `${request} expired.`,
          detail: 'It waited longer than its time limit. Request it again if it is still needed.',
        };
      default: {
        const failedDeploymentId =
          item.reason_code === 'previous_deployment_failed'
            ? item.reason_message?.match(uuidPattern)?.[0]
            : undefined;
        return {
          type: 'warning' as const,
          title: `${request} was rejected${item.reason_code ? ` (${item.reason_code})` : ''}.`,
          detail: (
            <>
              {[reasonAdvice[item.reason_code ?? ''], item.reason_message]
                .filter(Boolean)
                .join(' ')}
              {failedDeploymentId && (
                <>
                  {' '}
                  <Link
                    to={generateDeploymentUrl(
                      orgId,
                      projectId,
                      envId,
                      failedDeploymentId,
                      'resources',
                    )}>
                    {`Open failed Deployment ${failedDeploymentId}`}
                  </Link>
                </>
              )}
            </>
          ),
        };
      }
    }
  };

  return (
    <Card title={'Deployment queue'} loading={queue.isLoading}>
      {messageContext}
      <Flex vertical gap={'middle'}>
        {queue.isError ? (
          <Alert type={'warning'} showIcon message={'The deployment queue could not be loaded.'} />
        ) : items?.length ? (
          <Table columns={columns} dataSource={items} rowKey={'id'} pagination={false} />
        ) : (
          <Empty
            description={'No deployment requests are waiting.'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
        {outcomes.map((item) => {
          const { type, title, detail } = outcomeAlert(item);
          return (
            <Alert
              key={item.id}
              type={type}
              showIcon
              closable
              message={title}
              description={detail || undefined}
              onClose={() => setOutcomes((previous) => previous.filter(({ id }) => id !== item.id))}
            />
          );
        })}
      </Flex>
    </Card>
  );
};
