import { PlusOutlined } from '@ant-design/icons';
import { Button, Empty, Flex, Table, TableColumnProps, Tooltip } from 'antd';
import { formatDate } from 'date-fns';
import React from 'react';
import { Link, useParams } from 'react-router';

import { matchesSearch, TableToolbar, useTableSearch } from '@src/components/shared/TableToolbar';
import { DOCS_GET_STARTED_EMPTY_STATE, DOCS_RUNNERS } from '@src/config/docs-links';
import { MatchParams } from '@src/config/routing';
import {
  getListRunnersQueryKey,
  listRunners,
} from '@src/hooks/react-query/v2/controlplane/runner/runner';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { RBACPermission, RBACStatus, useRBAC } from '@src/hooks/useRBAC';
import { RunnerSummary } from '@src/models/v2/controlplane';
import { DATE_FORMATS_TYPES } from '@src/utilities/datetime/datetime';
import { generateRunnerDetailUrl, generateRunnersUrl } from '@src/utilities/navigation';

export const RunnersList = () => {
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;
  // React Query
  const { data: allRunners, isLoading: runnersLoading } = useAllPages(
    getAllPagesQueryKey(getListRunnersQueryKey(orgId)),
    (params) => listRunners(orgId, params),
  );

  const search = useTableSearch();
  const canWrite = useRBAC(RBACPermission.RUNNER_WRITE) === RBACStatus.ALLOWED;
  const filteredRunners = allRunners?.filter(
    (row) =>
      matchesSearch(
        search.query,
        row.id,
        row.description,
        row.runner_configuration?.type,
        row.state_storage_configuration?.type,
      ) &&
      (search.view === 'all' || row.runner_configuration?.type === search.view),
  );

  const columns: TableColumnProps<RunnerSummary>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      sorter: (a, b) => a.id.localeCompare(b.id),
      render: (runnerId) => (
        <Link tabIndex={0} to={generateRunnerDetailUrl(orgId, runnerId)}>
          {runnerId}
        </Link>
      ),
    },
    {
      title: 'Runner type',
      dataIndex: 'runner_configuration',
      ellipsis: true,
      sorter: (a, b) =>
        (a?.runner_configuration?.type ?? '').localeCompare(b?.runner_configuration?.type ?? ''),
      render: (runner_configuration) => <span>{runner_configuration?.type ?? '-'}</span>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      ellipsis: {
        showTitle: false,
      },
      sorter: (a, b) => (a.description ?? '').localeCompare(b.description ?? ''),
      render: (description) =>
        description ? (
          <Tooltip title={description} mouseEnterDelay={1}>
            {description}
          </Tooltip>
        ) : (
          <span>-</span>
        ),
    },
    {
      title: 'Created at',
      dataIndex: 'created_at',
      width: '300px',
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (value) => formatDate(value, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE),
    },
  ];

  return (
    <Flex vertical gap={'middle'} justify={'center'}>
      {canWrite && (
        <Flex justify={'flex-end'}>
          <Button
            type={'primary'}
            icon={<PlusOutlined />}
            href={`${generateRunnersUrl(orgId)}/list/new`}>
            Register native Runner
          </Button>
        </Flex>
      )}
      <TableToolbar
        label={'runners'}
        {...search}
        filters={[
          ...new Set(
            allRunners
              ?.map((row) => row.runner_configuration?.type)
              .filter((type) => type !== undefined),
          ),
        ].map((type) => ({ value: type, label: type }))}
      />
      <Table
        key={`${search.query}:${search.view}`}
        columns={columns}
        dataSource={filteredRunners}
        rowKey={'id'}
        loading={runnersLoading}
        size={'small'}
        locale={{
          emptyText:
            search.query || search.view !== 'all' ? (
              'No results match these filters.'
            ) : (
              <Empty
                description={
                  <>
                    No runners found, see{' '}
                    <a href={DOCS_RUNNERS} target={'_blank'} rel={'noreferrer noopener'}>
                      runners docs
                    </a>{' '}
                    for details, or follow the{' '}
                    <a
                      href={DOCS_GET_STARTED_EMPTY_STATE}
                      target={'_blank'}
                      rel={'noreferrer noopener'}>
                      tutorial
                    </a>{' '}
                    to explore the full setup flow.
                  </>
                }
                styles={{ image: { display: 'none' } }}
              />
            ),
        }}
      />
    </Flex>
  );
};
