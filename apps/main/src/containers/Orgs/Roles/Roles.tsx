import { DeleteOutlined, EditOutlined, EllipsisOutlined, PlusOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Dropdown, message, Modal, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router';

import { CheckRBAC } from '@src/components/shared/CheckRBAC';
import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { MatchParams } from '@src/config/routing';
import {
  getListRolesQueryKey,
  listRoles,
  useCreateRole,
  useDeleteRole,
  useListPermissions,
  useUpdateRole,
} from '@src/hooks/react-query/v2/iam/role/role';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { RBACPermission } from '@src/hooks/useRBAC';
import { Role, RoleWriteBody } from '@src/models/v2/iam';

import { RoleModal } from './RoleModal';

export const Roles = () => {
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;
  const queryClient = useQueryClient();
  const [editedRole, setEditedRole] = useState<Role>();
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [confirm, confirmContext] = Modal.useModal();

  const rolesQueryKey = getAllPagesQueryKey(getListRolesQueryKey(orgId));
  const { data: roles, isLoading } = useAllPages(rolesQueryKey, (params) =>
    listRoles(orgId, params),
  );
  const {
    data: permissionCatalog,
    isLoading: permissionsLoading,
    isError: permissionsError,
  } = useListPermissions(orgId);
  const permissionsById = useMemo(
    () => new Map(permissionCatalog?.items.map((permission) => [permission.id, permission]) ?? []),
    [permissionCatalog],
  );
  const { mutate: createRole, isPending: isCreating } = useCreateRole();
  const { mutate: updateRole, isPending: isUpdating } = useUpdateRole();
  const { mutate: deleteRole } = useDeleteRole();

  const refresh = () => queryClient.invalidateQueries({ queryKey: rolesQueryKey });
  const closeModal = () => {
    setRoleModalOpen(false);
    setEditedRole(undefined);
  };
  const saveRole = (data: RoleWriteBody) => {
    const callbacks = {
      onSuccess: () => {
        closeModal();
        void refresh();
      },
      onError: () => message.error(`Failed to ${editedRole ? 'update' : 'create'} role.`),
    };
    if (editedRole) {
      updateRole({ orgId, roleId: editedRole.id, data }, callbacks);
    } else {
      createRole({ orgId, data }, callbacks);
    }
  };

  const columns: ColumnsType<Role> = [
    {
      title: 'Name',
      dataIndex: 'display_name',
      sorter: (left, right) => left.display_name.localeCompare(right.display_name),
      render: (name: string, role) => (
        <Space>
          <Typography.Text>{name}</Typography.Text>
          {role.is_system && <Tag>Built-in</Tag>}
        </Space>
      ),
    },
    {
      title: 'Permissions',
      dataIndex: 'permissions',
      render: (permissions: string[]) =>
        permissions.map((permission) => {
          const definition = permissionsById.get(permission);
          return (
            <Tooltip
              key={permission}
              title={definition ? `${definition.description} (${definition.id})` : permission}>
              <Tag>{definition?.display_name ?? permission}</Tag>
            </Tooltip>
          );
        }),
    },
    {
      title: '',
      key: 'actions',
      align: 'end',
      width: 64,
      render: (_, role) =>
        role.is_system ? null : (
          <CheckRBAC permission={RBACPermission.ROLE_WRITE}>
            {(allowed) => (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    {
                      key: 'edit',
                      icon: <EditOutlined />,
                      label: 'Edit',
                      disabled: !allowed,
                      onClick: () => {
                        setEditedRole(role);
                        setRoleModalOpen(true);
                      },
                    },
                    {
                      key: 'delete',
                      icon: <DeleteOutlined />,
                      label: 'Delete',
                      danger: true,
                      disabled: !allowed,
                      onClick: () =>
                        confirm.confirm({
                          title: `Delete ${role.display_name}?`,
                          content:
                            'A role can only be deleted after all of its assignments are removed.',
                          okText: 'Delete',
                          okButtonProps: { danger: true },
                          onOk: () =>
                            new Promise<void>((resolve, reject) => {
                              deleteRole(
                                { orgId, roleId: role.id },
                                {
                                  onSuccess: () => {
                                    void refresh();
                                    resolve();
                                  },
                                  onError: () => {
                                    void message.error(
                                      'Failed to delete role. Remove its assignments first.',
                                    );
                                    reject(new Error('role deletion failed'));
                                  },
                                },
                              );
                            }),
                        }),
                    },
                  ],
                }}>
                <Button aria-label={'Open role menu'} icon={<EllipsisOutlined />} size={'small'} />
              </Dropdown>
            )}
          </CheckRBAC>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        rightContent={
          <CheckRBAC permission={RBACPermission.ROLE_WRITE}>
            {(allowed) => (
              <Button
                type={'primary'}
                icon={<PlusOutlined />}
                disabled={!allowed}
                onClick={() => setRoleModalOpen(true)}>
                Create role
              </Button>
            )}
          </CheckRBAC>
        }
      />
      <Table<Role>
        aria-label={'Roles'}
        rowKey={'id'}
        columns={columns}
        dataSource={roles}
        loading={isLoading}
        locale={{ emptyText: 'No roles found' }}
      />
      <RoleModal
        open={roleModalOpen}
        role={editedRole}
        permissions={permissionCatalog?.items ?? []}
        permissionsLoading={permissionsLoading}
        permissionsError={permissionsError}
        loading={isCreating || isUpdating}
        onCancel={closeModal}
        onSubmit={saveRole}
      />
      {confirmContext}
    </>
  );
};
