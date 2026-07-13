import { Empty, Flex, Table, TableColumnProps } from 'antd';
import { formatDate } from 'date-fns';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { SearchInput } from '@src/components/shared/ui/SearchInput/SearchInput';
import { MatchParams } from '@src/config/routing';
import {
  getListModuleRulesInOrgQueryKey,
  listModuleRulesInOrg,
} from '@src/hooks/react-query/v2/controlplane/rules/rules';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { type RuleSummary } from '@src/models/v2/controlplane';
import { DATE_FORMATS_TYPES } from '@src/utilities/datetime/datetime';

export const ModuleRules = () => {
  const { orgId, moduleId } = useParams<keyof MatchParams>() as MatchParams;
  const filterParams = { byModuleId: moduleId };
  const { data: allModuleRules, isFetching: moduleRulesLoading } = useAllPages(
    getAllPagesQueryKey(getListModuleRulesInOrgQueryKey(orgId, filterParams)),
    (params) => listModuleRulesInOrg(orgId, { ...filterParams, ...params }),
  );

  useEffect(() => {
    setFilteredModuleRules(allModuleRules);
  }, [allModuleRules]);

  // state
  const [filteredModuleRules, setFilteredModuleRules] = useState<RuleSummary[]>();
  const columns: TableColumnProps<RuleSummary>[] = [
    {
      title: 'Resource type',
      dataIndex: 'resource_type',
      sorter: (a, b) => a.resource_type.localeCompare(b.resource_type),
    },
    {
      title: 'Resource ID',
      dataIndex: 'resource_id',
      sorter: (a, b) => (a.resource_id ?? '')?.localeCompare(b.resource_id ?? ''),
      render: (res_id) => res_id || '-',
    },
    {
      title: 'Resource class',
      dataIndex: 'resource_class',
      sorter: (a, b) => a.resource_class.localeCompare(b.resource_class),
    },
    {
      title: 'Environment type',
      dataIndex: 'env_type_id',
      sorter: (a, b) => (a.env_type_id ?? '')?.localeCompare(b.env_type_id ?? ''),
    },
    {
      title: 'Project ID',
      dataIndex: 'project_id',
      sorter: (a, b) => (a.project_id ?? '')?.localeCompare(b.project_id ?? ''),
      render: (project_id) => project_id || '-',
    },
    {
      title: 'Environment ID',
      dataIndex: 'env_id',
      sorter: (a, b) => (a.env_id ?? '')?.localeCompare(b.env_id ?? ''),
      render: (env_id) => env_id || '-',
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
      setFilteredModuleRules(
        allModuleRules?.filter(
          (moduleRule) =>
            moduleRule.env_type_id?.includes(value.toLowerCase()) ||
            moduleRule.module_id.includes(value.toLowerCase()) ||
            moduleRule.resource_type.includes(value.toLowerCase()) ||
            moduleRule.resource_id?.includes(value.toLowerCase()) ||
            moduleRule.resource_class.includes(value.toLowerCase()),
        ),
      );
    } else {
      setFilteredModuleRules(allModuleRules);
    }
  };
  return (
    <Flex vertical gap={'middle'}>
      <SearchInput placeholder={'Search rules'} onChange={filterModuleRules} />
      <Table
        columns={columns}
        dataSource={filteredModuleRules}
        loading={moduleRulesLoading}
        rowKey={'id'}
        size={'small'}
        locale={{ emptyText: <Empty description={'No module rules found'} /> }}
      />
    </Flex>
  );
};
