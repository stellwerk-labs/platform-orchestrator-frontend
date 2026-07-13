import { Empty, Flex, Table, TableColumnProps, Tooltip } from 'antd';
import { formatDate } from 'date-fns';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

import { SearchInput } from '@src/components/shared/ui/SearchInput/SearchInput';
import { DOCS_GET_STARTED_EMPTY_STATE, DOCS_RUNNERS } from '@src/config/docs-links';
import { MatchParams } from '@src/config/routing';
import {
  getListRunnersQueryKey,
  listRunners,
} from '@src/hooks/react-query/v2/controlplane/runner/runner';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { RunnerSummary } from '@src/models/v2/controlplane';
import { DATE_FORMATS_TYPES } from '@src/utilities/datetime/datetime';
import { generateRunnerDetailUrl } from '@src/utilities/navigation';

export const RunnersList = () => {
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;
  // React Query
  const { data: allRunners, isLoading: runnersLoading } = useAllPages(
    getAllPagesQueryKey(getListRunnersQueryKey(orgId)),
    (params) => listRunners(orgId, params),
  );

  // state
  const [filteredRunners, setFilteredRunners] = useState<RunnerSummary[] | undefined>();

  useEffect(() => {
    setFilteredRunners(allRunners);
  }, [allRunners]);

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

  const handleSearchChange = (value: string) => {
    setFilteredRunners(allRunners?.filter((runner) => runner.id.includes(value)));
  };

  return (
    <Flex vertical gap={'middle'} justify={'center'}>
      <SearchInput onChange={handleSearchChange} placeholder={'Filter runners'} />
      <Table
        columns={columns}
        dataSource={filteredRunners}
        rowKey={'id'}
        loading={runnersLoading}
        size={'small'}
        locale={{
          emptyText: (
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
