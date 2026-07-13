import { Table, TableColumnProps, Tag } from 'antd';
import { Link } from 'react-router';

import { getListRolesQueryKey, listRoles } from '@src/hooks/react-query/v2/iam/role/role';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { useUserDetails } from '@src/hooks/useUserDetails';
import { UserWithRole, UserWithRoleType } from '@src/models/v2/iam';
import {
  generateMembershipDetailsUrl,
  generateServiceUserDetailsUrl,
} from '@src/utilities/navigation';

interface Props {
  users: UserWithRole[];
  orgId: string;
  isLoading: boolean;
}

export const AccessTable = ({ users, orgId, isLoading }: Props) => {
  const { data: orgRoles } = useAllPages(
    getAllPagesQueryKey(getListRolesQueryKey(orgId)),
    (params) => listRoles(orgId, params),
  );

  const { getUserDetails } = useUserDetails(orgId);

  const columns: TableColumnProps<UserWithRole>[] = [
    {
      title: 'Name',
      key: 'displayName',
      sorter: (a, b) => {
        const nameA = getUserDetails(a.id).displayName;
        const nameB = getUserDetails(b.id).displayName;
        return nameA.localeCompare(nameB);
      },
      render: (_, record) => {
        const { displayName } = getUserDetails(record.id);
        return record.type === UserWithRoleType.user ? (
          <Link to={generateMembershipDetailsUrl(orgId, record.id)}>{displayName}</Link>
        ) : (
          <Link to={generateServiceUserDetailsUrl(orgId, record.id)}>{displayName}</Link>
        );
      },
    },
    {
      title: 'Email',
      key: 'email',
      render: (_, record) => {
        const { email } = getUserDetails(record.id);
        return email || '-';
      },
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      filters: [
        { text: 'User', value: UserWithRoleType.user },
        { text: 'Service User', value: UserWithRoleType['service-user'] },
      ],
      onFilter: (value, record) => record.type === value,
      render: (type: string) => (
        <Tag color={type === UserWithRoleType.user ? 'blue' : 'green'}>
          {type === UserWithRoleType.user ? 'User' : 'Service User'}
        </Tag>
      ),
    },
    {
      title: 'Role',
      key: 'role',
      render: (_, record) => {
        const role = orgRoles?.find((r) => r.id === record.subject_id);
        return role ? <Tag>{role.display_name}</Tag> : '';
      },
    },
  ];

  return (
    <Table
      rowKey={'id'}
      columns={columns}
      dataSource={users}
      tableLayout={'fixed'}
      loading={isLoading}
      pagination={false}
      locale={{ emptyText: 'No users have access' }}
      size={'small'}
    />
  );
};
