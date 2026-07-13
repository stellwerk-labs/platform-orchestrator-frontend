import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Flex, Table, TableColumnProps, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { MembershipCreate } from '@src/containers/Orgs/OrgMembers/types';
import {
  EnrichedScopedRole,
  ScopedRole,
  useEnrichScopedRoles,
} from '@src/hooks/useEnrichScopedRoles';
import { RBACPermission } from '@src/hooks/useRBAC';
import { Environment } from '@src/models/v2/controlplane/environment';
import { Role } from '@src/models/v2/iam';
import { generateAppUrl } from '@src/utilities/navigation';

import { CheckRBAC } from '../CheckRBAC';
import { ProtectedButton } from '../ProtectedButton';
import { AssignRolesModal } from './AssignRolesModal';
import { RemoveRoleModal } from './RemoveRoleModal';
import { UpdateRoleModal } from './UpdateRoleModal';

interface ScopedRolesTableProps {
  orgId: string;
  scopedRoles: ScopedRole[];
  onLoaded?: () => void;
  onCreate?: (newMembership: MembershipCreate[]) => Promise<void>;
  onDelete?: (scopedRole: EnrichedScopedRole) => Promise<void>;
  onUpdate?: (scopedRole: EnrichedScopedRole, newRoleId: string) => Promise<void>;
}

export const ScopedRolesTable = ({
  orgId,
  scopedRoles,
  onLoaded,
  onUpdate,
  onCreate,
  onDelete,
}: ScopedRolesTableProps) => {
  const { enrichedScopedRoles, isLoading } = useEnrichScopedRoles({
    orgId,
    scopedRoles,
  });

  useEffect(() => {
    if (!isLoading && onLoaded) {
      onLoaded();
    }
  }, [isLoading, onLoaded]);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [role, setRole] = useState<EnrichedScopedRole | null>(null);
  const [isUpdateRoleModalOpen, setIsUpdateRoleModalOpen] = useState(false);
  const [deleteRole, setDeleteRole] = useState<EnrichedScopedRole | null>(null);

  const columns: TableColumnProps<EnrichedScopedRole>[] = [
    {
      title: 'Project',
      dataIndex: 'projectId',
      key: 'projectId',
      render: (projectId: string) => <Link to={generateAppUrl(orgId, projectId)}>{projectId}</Link>,
    },
    {
      title: 'Environment',
      dataIndex: 'environment',
      key: 'environment',
      render: (env: Environment | null, record: EnrichedScopedRole) => {
        // todo: consider but maybe restyle
        // if (!env) {
        //   return <Link to={generateAppUrl(orgId, record.projectId)}>all environments</Link>;
        // }

        if (!env) {
          return '';
        }

        return <Link to={generateAppUrl(orgId, record.projectId, env.id)}>{env.display_name}</Link>;
      },
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (r: Role) => <Tag>{r.display_name}</Tag>,
    },
    ...(onUpdate || onDelete
      ? [
          {
            title: '',
            key: 'mark-update-or-delete',
            align: 'end' as const,
            render: (_: any, record: EnrichedScopedRole) => (
              <CheckRBAC permission={RBACPermission.MANAGE}>
                {(allowed) => (
                  <Flex gap={'small'} justify={'end'}>
                    {onUpdate && (
                      <Button
                        disabled={!allowed}
                        icon={<EditOutlined />}
                        onClick={() => {
                          setIsUpdateRoleModalOpen(true);
                          setRole(record);
                        }}
                        aria-label={'Update scoped role'}
                        size={'small'}
                      />
                    )}

                    {onDelete && (
                      <Button
                        disabled={!allowed}
                        icon={<DeleteOutlined />}
                        onClick={() => {
                          setDeleteRole(record);
                        }}
                        aria-label={'Remove scoped role'}
                        size={'small'}
                      />
                    )}
                  </Flex>
                )}
              </CheckRBAC>
            ),
          },
        ]
      : []),
  ];

  const tableData = isLoading ? [] : enrichedScopedRoles;

  return (
    <div>
      <Flex justify={'space-between'} align={'center'} style={{ marginBottom: 16, minHeight: 32 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          Scoped roles
        </Typography.Title>

        {onCreate && (
          <CheckRBAC permission={RBACPermission.MANAGE}>
            {(allowed) => (
              <ProtectedButton
                allowed={allowed}
                message={
                  "You don't have permission to perform this action. Please contact an organization admin."
                }
                type={'primary'}
                icon={<PlusOutlined />}
                aria-label={'Assign scoped role'}
                onClick={() => setIsCreateModalOpen(true)}>
                Assign scoped role
              </ProtectedButton>
            )}
          </CheckRBAC>
        )}
      </Flex>

      <Table
        rowKey={(_record, index) => index!}
        columns={columns}
        dataSource={tableData}
        tableLayout={'fixed'}
        pagination={false}
        size={'small'}
      />

      {isUpdateRoleModalOpen && role && onUpdate && (
        <UpdateRoleModal
          open={isUpdateRoleModalOpen}
          membership={role}
          onClose={() => {
            setIsUpdateRoleModalOpen(false);
            setRole(null);
          }}
          onSubmit={async (roleId) => {
            await onUpdate?.(role, roleId);
          }}
          orgId={orgId}
        />
      )}

      {isCreateModalOpen && onCreate && (
        <AssignRolesModal
          orgId={orgId}
          open={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={onCreate}
        />
      )}

      {deleteRole && onDelete && (
        <RemoveRoleModal
          record={deleteRole}
          onConfirm={async () => {
            await onDelete(deleteRole);
            setDeleteRole(null);
          }}
          onCancel={() => setDeleteRole(null)}
        />
      )}
    </div>
  );
};
