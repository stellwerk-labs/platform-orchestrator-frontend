import { Empty, Flex, Table, TableColumnProps } from 'antd';
import { formatDate } from 'date-fns';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { SearchInput } from '@src/components/shared/ui/SearchInput/SearchInput';
import { MatchParams } from '@src/config/routing';
import {
  getListRunnerRulesInOrgQueryKey,
  listRunnerRulesInOrg,
} from '@src/hooks/react-query/v2/controlplane/runner/runner';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { type RunnerRuleSummary } from '@src/models/v2/controlplane';
import { DATE_FORMATS_TYPES } from '@src/utilities/datetime/datetime';

export const RunnerRules = () => {
  const { orgId, runnerId } = useParams<keyof MatchParams>() as MatchParams;
  const filterParams = { byRunnerId: runnerId };
  const { data: allRunnerRules, isFetching: runnerRulesLoading } = useAllPages(
    getAllPagesQueryKey(getListRunnerRulesInOrgQueryKey(orgId, filterParams)),
    (params) => listRunnerRulesInOrg(orgId, { ...filterParams, ...params }),
  );

  // state
  const [filteredRunnerRules, setFilteredRunnerRules] = useState<RunnerRuleSummary[]>();

  useEffect(() => {
    setFilteredRunnerRules(allRunnerRules);
  }, [allRunnerRules]);

  const columns: TableColumnProps<RunnerRuleSummary>[] = [
    {
      title: 'Project Id',
      dataIndex: 'project_id',
      sorter: (a, b) => a.project_id.localeCompare(b.project_id),
      render: (project_id: string) => project_id || '-',
    },
    {
      title: 'Env type',
      dataIndex: 'env_type_id',
      sorter: (a, b) => (a.env_type_id ?? '')?.localeCompare(b.env_type_id ?? ''),
      render: (env_type_id: string) => env_type_id || '-',
    },
    {
      title: 'Created at',
      dataIndex: 'created_at',
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (value) => formatDate(value, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE),
    },
  ];

  const filterModuleRules = (value: string) => {
    if (value) {
      setFilteredRunnerRules(
        allRunnerRules?.filter(
          (moduleRule) =>
            moduleRule.env_type_id?.includes(value.toLowerCase()) ||
            moduleRule.project_id.includes(value.toLowerCase()) ||
            moduleRule.env_type_id.includes(value.toLowerCase()),
        ),
      );
    } else {
      setFilteredRunnerRules(allRunnerRules);
    }
  };
  return (
    <Flex vertical gap={'middle'}>
      <SearchInput placeholder={'Search rules'} onChange={filterModuleRules} />
      <Table
        columns={columns}
        dataSource={filteredRunnerRules}
        loading={runnerRulesLoading}
        rowKey={'id'}
        locale={{ emptyText: <Empty description={'No runner rules found'} /> }}
      />
    </Flex>
  );
};
