import { DeleteOutlined, EllipsisOutlined, RedoOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Dropdown, message, Modal, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { formatDate } from 'date-fns';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { CheckRBAC } from '@src/components/shared/CheckRBAC';
import { MatchParams } from '@src/config/routing';
import { getListRolesQueryKey, listRoles } from '@src/hooks/react-query/v2/iam/role/role';
import {
  getListServiceUsersQueryKey,
  listServiceUsers,
  useDeleteServiceUser,
} from '@src/hooks/react-query/v2/iam/service-user/service-user';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { RBACPermission } from '@src/hooks/useRBAC';
import { ServiceUserSummary } from '@src/models/v2/iam';
import { DATE_FORMATS_TYPES } from '@src/utilities/datetime/datetime';
import { generateServiceUserDetailsUrl } from '@src/utilities/navigation';

import {
  CreateServiceUserButton,
  ServiceUserModal,
} from './CreateServiceUserButton/CreateServiceUserButton';

export const ServiceUserTable = () => {
  // Component state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serviceUserToRegenerate, setServiceUserToRegenerate] = useState<ServiceUserSummary>();

  // Router hooks
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;

  // React Query
  const queryClient = useQueryClient();

  const { data: allServiceUsers, isLoading: isServiceUsersLoading } = useAllPages(
    getAllPagesQueryKey(getListServiceUsersQueryKey(orgId)),
    (params) => listServiceUsers(orgId, params),
  );
  const { mutate: deleteUser } = useDeleteServiceUser();

  const [modal, contextHolder] = Modal.useModal();
  const { data: roles } = useAllPages(getAllPagesQueryKey(getListRolesQueryKey(orgId)), (params) =>
    listRoles(orgId, params),
  );

  const handleDelete = (id: string) => {
    deleteUser(
      { orgId, serviceUserId: id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getAllPagesQueryKey(getListServiceUsersQueryKey(orgId)),
          });
        },
        onError: () => message.error('Failed to delete service user.'),
      },
    );
  };

  const findRole = (record: ServiceUserSummary) =>
    roles?.find((role) => {
      return role.id === record.roles[0]?.id;
    })?.display_name;

  const columns: ColumnsType<ServiceUserSummary> = [
    {
      title: 'Name',
      dataIndex: 'display_name',
      key: 'display_name',
      sorter: (a, b) => a.display_name.localeCompare(b.display_name),
      render: (_, record) => (
        <Link to={generateServiceUserDetailsUrl(orgId, record.id)}>{record.display_name}</Link>
      ),
    },
    {
      title: 'Organization Role',
      dataIndex: 'role',
      key: 'role',
      sorter: (a, b) =>
        a.roles
          .map((role) => role.id)
          .join(' ')
          .localeCompare(b.roles.map((role) => role.id).join(' ')),
      render: (_, record) => {
        const roleName = findRole(record);
        if (roleName) {
          return <Tag>{roleName}</Tag>;
        }

        return '';
      },
    },
    {
      title: 'Generated At',
      dataIndex: 'generated_at',
      key: 'generated_at',
      sorter: (a, b) => dayjs(a.generated_at).unix() - dayjs(b.generated_at).unix(),
      render: (_, record) =>
        formatDate(record.generated_at, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE),
    },
    {
      title: 'Token Expiry',
      dataIndex: 'current_token_expires_at',
      key: 'current_token_expires_at',
      width: '300px',
      sorter: (a, b) =>
        new Date(a.current_token_expires_at).getTime() -
        new Date(b.current_token_expires_at).getTime(),
      render: (_, record) =>
        formatDate(record.current_token_expires_at, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE),
    },
    {
      title: '',
      key: 'actions',
      align: 'end',
      render: (_, record) => {
        return (
          <CheckRBAC permission={RBACPermission.SERVICE_USER_WRITE}>
            {(allowed) => (
              <Dropdown
                menu={{
                  items: [
                    {
                      icon: <RedoOutlined />,
                      key: 'regenerate',
                      disabled: !allowed,
                      onClick: () => {
                        setIsModalOpen(true);
                        setServiceUserToRegenerate(record);
                      },
                      label: 'Regenerate token',
                    },
                    {
                      icon: <DeleteOutlined />,
                      disabled: !allowed,
                      key: 'delete',
                      onClick: async () => {
                        await modal.confirm({
                          title: 'Delete service user',
                          content: 'Are you sure you want to delete this service user?',
                          okText: 'Yes',
                          onOk: () => handleDelete(record.id),
                        });
                      },
                      label: 'Delete',
                    },
                  ],
                }}
                trigger={['click']}>
                <Button aria-label={'Open menu'} icon={<EllipsisOutlined />} size={'small'} />
              </Dropdown>
            )}
          </CheckRBAC>
        );
      },
    },
  ];

  return (
    <Space direction={'vertical'} style={{ width: '100%' }} size={'middle'}>
      <CreateServiceUserButton />
      <ServiceUserModal
        openState={[isModalOpen, setIsModalOpen]}
        mode={'regenerate'}
        serviceUserToRegenerate={serviceUserToRegenerate}
      />

      {contextHolder}

      <Table<ServiceUserSummary>
        rowKey={'id'}
        columns={columns}
        dataSource={allServiceUsers}
        loading={isServiceUsersLoading}
        locale={{ emptyText: 'No service users found' }}
        aria-label={'Service users'}
      />
    </Space>
  );
};
