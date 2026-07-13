import { Empty, Table, Typography } from 'antd';
import { ColumnsType, TableProps } from 'antd/es/table';
import { FilterValue, TablePaginationConfig } from 'antd/es/table/interface';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import { useListDeployments } from '@src/hooks/react-query/v2/dataplane/deployment/deployment';
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

export const Deploys = () => {
  const { orgId, projectId, envId } = useParams<keyof MatchParams>() as MatchParams;

  const { t } = useTranslation('viewEnvironment');
  const deploysTranslations = t('DEPLOYS');

  // Server-side filters
  const [statusFilter, setStatusFilter] = useState<ByStatusQueryParamParameterItem[]>();
  const [modeFilter, setModeFilter] = useState<UserVisibleMode[]>();

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
  const { data: deploymentsPage, isLoading } = useListDeployments(orgId, {
    project_id: projectId,
    env_id: envId,
    by_status: statusFilter,
    by_mode: mapModeFilterToApiParams(modeFilter),
    per_page: pageSize,
    page: pageToken,
  });

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
      filteredValue: statusFilter,
      render: (status: string) => (
        <DeploymentStatus status={status} activeDeployment={false} greyIcon />
      ),
    },
    {
      title: 'Mode',
      dataIndex: 'mode',
      key: 'mode',
      width: 180,
      filters: modeFilters,
      filteredValue: modeFilter,
      render: (mode: UserVisibleMode, record: DeploymentSummary) => (
        <DeploymentMode mode={mode} planOnly={record.plan_only} />
      ),
    },
    {
      title: 'Deployed At',
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
    <Table
      columns={columns}
      dataSource={deployments}
      rowKey={'id'}
      loading={isLoading}
      pagination={{ current: currentPage, pageSize, total }}
      onChange={handleTableChange}
      locale={{
        emptyText: <Empty description={deploysTranslations.NO_DEPLOYS_TO_THIS_ENVIRONMENT} />,
      }}
    />
  );
};
