import { Table, TableColumnProps } from 'antd';
import { useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import {
  getListAvailableResourceTypesQueryKey,
  listAvailableResourceTypes,
} from '@src/hooks/react-query/v2/controlplane/resource-type/resource-type';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { AvailableResourceType } from '@src/models/v2/controlplane';

export const AvailableResourceTypes = () => {
  // Router hooks
  const { orgId, projectId, envId } = useParams<keyof MatchParams>() as MatchParams;
  // react query
  const { data: allAvailableResourceTypes } = useAllPages(
    getAllPagesQueryKey(getListAvailableResourceTypesQueryKey(orgId, projectId, envId)),
    (params) => listAvailableResourceTypes(orgId, projectId, envId, params),
  );

  const columns: TableColumnProps<AvailableResourceType>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      ellipsis: {
        showTitle: true,
      },
    },
  ];

  return (
    <Table dataSource={allAvailableResourceTypes} columns={columns} rowKey={'id'} size={'small'} />
  );
};
