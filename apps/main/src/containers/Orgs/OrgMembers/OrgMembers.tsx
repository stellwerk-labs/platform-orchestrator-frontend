import {
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Dropdown,
  Flex,
  Form,
  message,
  Modal,
  Space,
  Spin,
  Table,
  TableColumnProps,
  Tag,
  theme,
  Tooltip,
} from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { CheckRBAC } from '@src/components/shared/CheckRBAC';
import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { ProtectedButton } from '@src/components/shared/ProtectedButton';
import { features } from '@src/config/features';
import { MatchParams } from '@src/config/routing';
import {
  InviteUserModal,
  UserField,
} from '@src/containers/Orgs/OrgMembers/components/InviteUserModal';
import {
  ManageRolesModal,
  MembershipRow,
} from '@src/containers/Orgs/OrgMembers/components/ManageRolesModal';
import {
  getListInvitationsQueryKey,
  listInvitations,
  useCreateInvitation,
  useRevokeInvitation,
} from '@src/hooks/react-query/v2/iam/invitation/invitation';
import {
  getListMembersQueryKey,
  getListOrgMembershipsQueryKey,
  listMembers,
  listOrgMemberships,
  useDeleteOrgMembership,
  useReplaceOrgUserMemberships,
} from '@src/hooks/react-query/v2/iam/membership/membership';
import { getListRolesQueryKey, listRoles } from '@src/hooks/react-query/v2/iam/role/role';
import { useGetCurrentUser } from '@src/hooks/react-query/v2/iam/user/user';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { RBACPermission } from '@src/hooks/useRBAC';
import { InvitationSummary, SubjectType } from '@src/models/v2/iam';
import { isMembership } from '@src/types/type-guards';
import { generateMembershipDetailsUrl } from '@src/utilities/navigation';

type TableRow = MembershipRow | (InvitationSummary & { type: 'invite' });

export const OrgMembers = () => {
  // Router hooks
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;

  const [form] = Form.useForm();

  const [modal, contextHolder] = Modal.useModal();

  const { token } = theme.useToken();

  // Component state
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [inviteUserModalOpen, setInviteUserModalOpen] = useState(false);
  const [isManageRoleModalOpen, setIsManageRoleModalOpen] = useState(false);
  const [membership, setMembership] = useState<MembershipRow | null>(null);

  // React Query
  const queryClient = useQueryClient();

  const { data: orgMemberships, isLoading: orgMembershipsLoading } = useAllPages(
    getAllPagesQueryKey(getListMembersQueryKey(orgId)),
    (params) => listMembers(orgId, params),
  );
  const { data: allInvitations, isLoading: invitationsLoading } = useAllPages(
    getAllPagesQueryKey(getListInvitationsQueryKey(orgId)),
    (params) => listInvitations(orgId, params),
  );
  const { data: roles } = useAllPages(getAllPagesQueryKey(getListRolesQueryKey(orgId)), (params) =>
    listRoles(orgId, params),
  );
  const { data: currentUser } = useGetCurrentUser();
  const { mutate: createInvitation } = useCreateInvitation();
  const { mutate: deleteOrgMembership } = useDeleteOrgMembership();
  const { mutate: replaceMemberships, isPending: isReplacingMembership } =
    useReplaceOrgUserMemberships();
  const { mutate: removeInvitation } = useRevokeInvitation();

  const memberships: TableRow[] =
    orgMemberships?.map((m) => ({ ...m, type: 'member' as const })) ?? [];

  const invitations: TableRow[] =
    allInvitations?.map((i) => ({ ...i, type: 'invite' as const })) ?? [];

  const mergedRows: TableRow[] = [...memberships, ...invitations];

  const sortRows = (data: TableRow[]) =>
    [...data].sort((a, b) => {
      if (a.type === b.type) {
        return dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf();
      }
      return a.type === 'member' ? -1 : 1;
    });

  const sortedRows = sortRows(mergedRows);

  const handleInviteUsers = (userFields: UserField[]) => {
    setLoadingInvite(true);
    userFields.forEach((userField) => {
      try {
        createInvitation(
          {
            orgId,
            data: {
              email_address: userField.email,
              membership_subject_type: 'role',
              membership_subject: userField.role,
            },
          },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({
                queryKey: getAllPagesQueryKey(getListInvitationsQueryKey(orgId)),
              });
            },
          },
        );

        form.resetFields();
      } catch {
        message.error('Failed to send invitations');
      } finally {
        setLoadingInvite(false);
      }
    });
  };

  const handleRoleChange = async (currentMembership: MembershipRow, newRoleId: string) => {
    const userMemberships = await queryClient.fetchQuery({
      queryKey: getListOrgMembershipsQueryKey(orgId, { userId: currentMembership.user_id }),
      queryFn: () => listOrgMemberships(orgId, { userId: currentMembership.user_id }),
      staleTime: 0,
    });

    // Prevent firing on a deleted ID (resulting in creating new memberships instead of updating one)
    const membershipExists = userMemberships.items.some((m) => m.id === currentMembership.id);
    if (!membershipExists) {
      return;
    }

    // Keep all other current memberships
    const scopedRoles = userMemberships.items
      .filter((m) => m.id !== currentMembership.id)
      .map((r) => ({
        subject_type: r.subject_type,
        subject: r.subject,
        scope: r.scope,
      }));

    // Create new org-level role membership
    const newOrgRole = {
      subject_type: SubjectType.role,
      subject: newRoleId,
    };

    replaceMemberships(
      {
        orgId,
        userId: currentMembership.user_id,
        data: {
          memberships: [newOrgRole, ...scopedRoles],
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getAllPagesQueryKey(getListMembersQueryKey(orgId)),
          });
          queryClient.invalidateQueries({
            queryKey: getAllPagesQueryKey(getListOrgMembershipsQueryKey(orgId)),
          });
        },
        onError: () => {
          message.error('Failed to update user organization role');
        },
      },
    );
  };

  const handleDelete = (record: TableRow) => {
    if (record.type === 'invite') {
      removeInvitation(
        { orgId, invitationId: record.id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getAllPagesQueryKey(getListInvitationsQueryKey(orgId)),
            });
          },
        },
      );
    } else {
      deleteOrgMembership(
        { orgId, membershipId: record.id },
        {
          onSuccess: async () => {
            queryClient.invalidateQueries({
              queryKey: getAllPagesQueryKey(getListMembersQueryKey(orgId)),
            });
            queryClient.invalidateQueries({
              queryKey: getAllPagesQueryKey(getListOrgMembershipsQueryKey(orgId)),
            });
          },
        },
      );
    }
  };

  const isOwnMembership = (record: TableRow) => {
    return record.type === 'member' && record.user_id === currentUser?.id;
  };

  const findRole = (record: TableRow) =>
    roles?.find((role) => {
      if (isMembership(record)) {
        return role.id === record.subject;
      }
      return role.id === record.membership_subject;
    })?.display_name;

  const columns: TableColumnProps<TableRow>[] = [
    {
      title: 'Display Name',
      key: 'display_name',
      render: (_, record) =>
        record.type === 'invite' ? null : (
          <Link to={generateMembershipDetailsUrl(orgId, record.user_id)}>
            {record.user_display_name}
          </Link>
        ),
    },
    {
      title: (
        <Flex gap={'small'} align={'center'}>
          Identity Provider
          <Tooltip title={'The identity provider of the user'}>
            <InfoCircleOutlined style={{ color: token.colorTextTertiary }} />
          </Tooltip>
        </Flex>
      ),
      key: 'providers',
      render: (_, record) =>
        record.type === 'member' ? (
          <Flex gap={'small'} wrap={'wrap'}>
            {record.identity_providers.map((p) => (
              <Tag key={`${p}`}>{p}</Tag>
            ))}
          </Flex>
        ) : null,
    },
    {
      title: (
        <Flex gap={'small'} align={'center'}>
          Email Address
          <Tooltip title={'The email attached to the identity provider'}>
            <InfoCircleOutlined style={{ color: token.colorTextTertiary }} />
          </Tooltip>
        </Flex>
      ),
      key: 'identity',
      render: (_, record) =>
        record.type === 'invite' ? record.email_address : record.user_primary_email_address,
    },
    {
      title: (
        <Flex gap={'small'} align={'center'}>
          Organization Role
          <Tooltip title={'To see scoped roles, click on a user'}>
            <InfoCircleOutlined style={{ color: token.colorTextTertiary }} />
          </Tooltip>
        </Flex>
      ),
      key: 'role',
      render: (_, record) => {
        const roleName = findRole(record);
        if (roleName) {
          return <Tag>{roleName}</Tag>;
        }

        return null;
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) =>
        record.type === 'invite' ? (
          dayjs().isAfter(dayjs(record.expires_at)) ? (
            <Tag color={'red'}>Invitation expired</Tag>
          ) : (
            <Tag color={'orange'}>Invitation pending</Tag>
          )
        ) : (
          <Tag color={'green'}>Active</Tag>
        ),
    },
    {
      title: '',
      key: 'actions',
      align: 'end',
      render: (_, record) => (
        <CheckRBAC permission={RBACPermission.MANAGE}>
          {(allowed) => (
            <Dropdown
              menu={{
                items: [
                  ...(record.type !== 'invite'
                    ? [
                        {
                          icon: <EditOutlined />,
                          key: 'edit-role',
                          label: 'Manage membership',
                          disabled: !allowed || isOwnMembership(record),
                          onClick: () => {
                            setIsManageRoleModalOpen(true);
                            setMembership(record);
                          },
                        },
                      ]
                    : []),
                  {
                    icon: <DeleteOutlined />,
                    key: '1',
                    disabled: !allowed || isOwnMembership(record),
                    onClick: async () => {
                      await modal.confirm({
                        title:
                          record.type === 'invite'
                            ? 'Revoke this invitation?'
                            : 'Remove this membership?',
                        content:
                          record.type === 'invite'
                            ? 'Are you sure you want to revoke this invitation?'
                            : 'Are you sure you want to remove this membership?',
                        okText: 'Yes',
                        onOk: () => handleDelete(record),
                      });
                    },
                    label: record.type === 'invite' ? 'Revoke invitation' : 'Remove membership',
                  },
                ],
              }}
              trigger={['click']}>
              <Button icon={<EllipsisOutlined />} aria-label={'Open menu'} size={'small'} />
            </Dropdown>
          )}
        </CheckRBAC>
      ),
    },
  ];

  const isLoading = orgMembershipsLoading || invitationsLoading || loadingInvite;

  return (
    <Spin spinning={isLoading} tip={'Loading...'}>
      <PageHeader />
      <Space direction={'vertical'} style={{ width: '100%' }} size={'middle'}>
        {features.invites && (
          <Flex wrap={'wrap'} style={{ width: '100%' }}>
            <CheckRBAC permission={RBACPermission.MANAGE}>
              {(allowed) => (
                <ProtectedButton
                  allowed={allowed}
                  message={
                    "You don't have permission to perform this action. Please contact an organization admin."
                  }
                  type={'primary'}
                  onClick={() => setInviteUserModalOpen(true)}>
                  Invite users
                </ProtectedButton>
              )}
            </CheckRBAC>
          </Flex>
        )}

        {contextHolder}

        <Table
          rowKey={(record: TableRow) => record.id}
          columns={columns}
          dataSource={sortedRows}
          locale={{ emptyText: 'No members or invitations' }}
          pagination={false}
          size={'small'}
        />

        {inviteUserModalOpen && (
          <InviteUserModal
            open={inviteUserModalOpen}
            onClose={() => setInviteUserModalOpen(false)}
            onSubmit={handleInviteUsers}
          />
        )}

        {isManageRoleModalOpen && (
          <ManageRolesModal
            open={isManageRoleModalOpen}
            membership={membership}
            onClose={() => {
              setIsManageRoleModalOpen(false);
              setMembership(null);
            }}
            onSubmit={handleRoleChange}
            orgId={orgId}
            isLoading={isReplacingMembership}
          />
        )}
      </Space>
    </Spin>
  );
};
