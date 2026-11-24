import { Alert, Empty, Flex, Table, Typography } from 'antd';
import { ColumnsType, TableProps } from 'antd/es/table';
import { FilterValue, TablePaginationConfig } from 'antd/es/table/interface';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { TableToolbar, useTableSearch } from '@src/components/shared/TableToolbar';
import { windowEnv } from '@src/config/environment';
import { MatchParams } from '@src/config/routing';
import { CreatePipelineDeployment } from '@src/containers/RunnerRollouts/CreatePipelineDeployment';
import type { PipelineDeployment } from '@src/containers/RunnerRollouts/deploymentPipelineApi';
import { PipelineStatus } from '@src/containers/RunnerRollouts/PipelineStatus';
import { useListDeployments } from '@src/hooks/react-query/v2/dataplane/deployment/deployment';
import { useDebouncedValue } from '@src/hooks/useDebouncedValue';
import { useTokenPagination } from '@src/hooks/useTokenPagination';
import { useUserDetails } from '@src/hooks/useUserDetails';
import { ByStatusQueryParamParameterItem, DeploymentSummary } from '@src/models/v2/dataplane';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';

import { DeploymentMode } from './components/DeploymentMode';
import { DeploymentStatus } from './components/DeploymentStatus';
import { mapModeFilterToApiParams, USER_VISIBLE_MODES, UserVisibleMode } from './modes';

// Static filter options from API enums
const statusFilters = Object.values(ByStatusQueryParamParameterItem).map((status) => ({
  text: status,
  value: status,
}));

const modeFilters = USER_VISIBLE_MODES.map((mode) => ({
  text: mode,
  value: mode,
}));

type QuickFilter =
  'all' | 'plans' | 'unused_plans' | 'deployments' | 'needs_approval' | 'needs_attention';
const quickFilters = [
  { value: 'plans', label: 'Plans' },
  { value: 'unused_plans', label: 'Unused plans' },
  { value: 'deployments', label: 'Deployments' },
  { value: 'needs_approval', label: 'Needs approval' },
  { value: 'needs_attention', label: 'Needs attention' },
];

export const Deploys = () => {
  const search = useTableSearch();
  const [statusFilter, setStatusFilter] = useState<ByStatusQueryParamParameterItem[]>();
  const [modeFilter, setModeFilter] = useState<UserVisibleMode[]>();

  const query = useDebouncedValue(search.query, 250);
  const filter = quickFilters.some((option) => option.value === search.view)
    ? (search.view as QuickFilter)
    : 'all';
  return (
    <Flex vertical gap={'small'}>
      <TableToolbar
        label={'deployments'}
        placeholder={'Search IDs, pipeline name, environment or creator ID'}
        {...search}
        filters={quickFilters}>
        {filter === 'unused_plans' && (
          <Typography.Text type={'secondary'}>
            No Apply deployment has been created. An unsuccessful Apply still consumes its source
            plan.
          </Typography.Text>
        )}
      </TableToolbar>
      <DeploymentsTable
        key={`${query}:${filter}`}
        query={query}
        quickFilter={filter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        modeFilter={modeFilter}
        setModeFilter={setModeFilter}
      />
    </Flex>
  );
};

const DeploymentsTable = ({
  query,
  quickFilter,
  statusFilter,
  setStatusFilter,
  modeFilter,
  setModeFilter,
}: {
  query: string;
  quickFilter: QuickFilter;
  statusFilter?: ByStatusQueryParamParameterItem[];
  setStatusFilter: (value: ByStatusQueryParamParameterItem[] | undefined) => void;
  modeFilter?: UserVisibleMode[];
  setModeFilter: (value: UserVisibleMode[] | undefined) => void;
}) => {
  const { orgId, projectId, envId } = useParams<keyof MatchParams>() as MatchParams;

  const { t } = useTranslation('viewEnvironment');
  const deploysTranslations = t('DEPLOYS');

  // Pagination
  const {
    currentPage,
    pageSize,
    pageToken,
    goToPage,
    setPageSize,
    reset: resetPagination,
  } = useTokenPagination();

  // Data fetching
  const {
    data: deploymentsPage,
    isLoading,
    isError,
  } = useListDeployments(
    orgId,
    {
      ...{ q: query || undefined, quick_filter: quickFilter },
      project_id: projectId,
      env_id: envId,
      by_status: statusFilter,
      by_mode: mapModeFilterToApiParams(modeFilter),
      per_page: pageSize,
      page: pageToken,
    },
    { query: { refetchInterval: windowEnv.RUNNER_ROLLOUTS === 'true' ? 2000 : false } },
  );

  const { getUserDisplayName } = useUserDetails(orgId);

  const nextPageToken = deploymentsPage?.next_page_token;
  const deployments = useMemo(() => deploymentsPage?.items ?? [], [deploymentsPage?.items]);

  const handleTableChange: TableProps<DeploymentSummary>['onChange'] = (
    pagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
  ) => {
    const newStatusFilter =
      (filters.status as ByStatusQueryParamParameterItem[] | null) || undefined;
    const newModeFilter = (filters.mode as UserVisibleMode[] | null) || undefined;

    const filtersChanged =
      JSON.stringify(newStatusFilter) !== JSON.stringify(statusFilter) ||
      JSON.stringify(newModeFilter) !== JSON.stringify(modeFilter);

    if (filtersChanged) {
      resetPagination();
    }

    setStatusFilter(newStatusFilter);
    setModeFilter(newModeFilter);

    if (!filtersChanged && pagination.pageSize) {
      setPageSize(pagination.pageSize);
    }
    if (!filtersChanged && pagination.current) {
      goToPage(pagination.current, nextPageToken);
    }
  };

  const [hoveredDeploymentId, setHoveredDeploymentId] = useState<string | null>(null);

  const columns: ColumnsType<DeploymentSummary> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 350,
      minWidth: 100,
      render: (id: string) => (
        <div
          onMouseEnter={() => setHoveredDeploymentId(id)}
          onMouseLeave={() => setHoveredDeploymentId(null)}>
          <Typography.Text copyable={hoveredDeploymentId === id && { text: id }}>
            <Link
              to={`/orgs/${orgId}/projects/${projectId}/envs/${envId}/deploys/${id}`}
              state={{ fromDeploys: true }}>
              {id}
            </Link>
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      filters: statusFilters,
      filteredValue: statusFilter ?? null,
      render: (status: string, record: PipelineDeployment) => (
        <Flex vertical gap={'small'}>
          {record.pipeline ? (
            <PipelineStatus
              phase={record.pipeline.phase}
              applied={record.pipeline.infrastructure_applied}
            />
          ) : (
            <DeploymentStatus status={status} activeDeployment={false} greyIcon />
          )}
          {status === 'executing' &&
            record.status_message &&
            record.status_message !== 'Deploying...' && (
              <Typography.Paragraph
                type={'secondary'}
                ellipsis={{ rows: 2, tooltip: true }}
                style={{ marginBottom: 0 }}>
                {record.status_message}
              </Typography.Paragraph>
            )}
        </Flex>
      ),
    },
    {
      title: 'Mode',
      dataIndex: 'mode',
      key: 'mode',
      width: 180,
      filters: modeFilters,
      filteredValue: modeFilter ?? null,
      render: (mode: UserVisibleMode, record: DeploymentSummary) => (
        <DeploymentMode mode={mode} planOnly={record.plan_only} />
      ),
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      width: 200,
      key: 'created_at',
      render: (created_at: string) => (
        <Typography.Text>
          {formatDate(created_at, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE)}
        </Typography.Text>
      ),
    },
    {
      title: 'Created By',
      dataIndex: 'created_by',
      width: 170,
      key: 'created_by',
      render: (created_by: string) => (
        <Typography.Text>{getUserDisplayName(created_by)}</Typography.Text>
      ),
    },
  ];

  // We don't know total count, so use next token to indicate if there are more pages
  const total = nextPageToken ? currentPage * pageSize + 1 : currentPage * pageSize;

  return (
    <Flex vertical gap={'middle'}>
      {windowEnv.RUNNER_ROLLOUTS === 'true' && (
        <CreatePipelineDeployment key={`${orgId}/${projectId}/${envId}`} />
      )}
      {isError ? (
        <Alert
          type={'error'}
          showIcon
          message={'Deployments could not be loaded. Check your access or try again.'}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={deployments}
          rowKey={'id'}
          loading={isLoading}
          pagination={{ current: currentPage, pageSize, total }}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <Empty
                description={
                  query || quickFilter !== 'all'
                    ? 'No deployments match these filters.'
                    : deploysTranslations.NO_DEPLOYS_TO_THIS_ENVIRONMENT
                }
              />
            ),
          }}
        />
      )}
    </Flex>
  );
};
