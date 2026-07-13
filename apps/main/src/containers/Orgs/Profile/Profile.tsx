import { useQueryClient } from '@tanstack/react-query';
import { Button, Flex, Popconfirm, Space, Switch, Table, TableProps, Tag, Typography } from 'antd';

import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { DataEntry } from '@src/components/shared/ui/DataEntry/DataEntry';
import { features } from '@src/config/features';
import {
  getGetCurrentUserQueryKey,
  getListUserSessionTokensQueryKey,
  listUserSessionTokens,
  useGetCurrentUser,
  useRevokeUserSessionToken,
} from '@src/hooks/react-query/v2/iam/user/user';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import type { UserSessionTokenSummary } from '@src/models/v2/iam';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';
import { getCookieConsent, setCookieConsent } from '@src/utilities/local-storage';
import { initializeAmplitude, optOutAmplitude } from '@src/utilities/tracking';

export const Profile = () => {
  const { data: user, isFetching: userLoading } = useGetCurrentUser();
  const { data: allUserSessions, isFetching: fetchingUserSessions } = useAllPages(
    getAllPagesQueryKey(getListUserSessionTokensQueryKey(user?.id)),
    (params) => listUserSessionTokens(user?.id ?? '', params),
    undefined,
    { enabled: !!user?.id },
  );
  const { mutate: revokeSession } = useRevokeUserSessionToken();
  const queryClient = useQueryClient();

  if (userLoading) {
    return <Flex style={{ height: '100%', width: '100%' }} justify={'center'} align={'center'} />;
  }

  const handleConfirmRevoke = (record: UserSessionTokenSummary) => {
    revokeSession(
      {
        userId: user?.id || '',
        hash: record.hash,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getAllPagesQueryKey(getListUserSessionTokensQueryKey(user?.id)),
          });
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        },
      },
    );
  };

  const userSessionsTableColumns: TableProps['columns'] = [
    {
      title: 'Hash',
      dataIndex: 'hash',
      width: 200,
    },
    {
      title: 'Created at',
      dataIndex: 'created_at',
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (value) => formatDate(value, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE),
    },
    {
      title: 'Expires at',
      dataIndex: 'expires_at',
      sorter: (a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime(),
      render: (value) => formatDate(value, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE),
    },
    {
      title: 'Provider',
      dataIndex: 'provider',
      responsive: ['lg'],
      render: (value) => (
        <Flex gap={'small'} wrap={'wrap'}>
          <Tag key={value}>{value}</Tag>
        </Flex>
      ),
    },
    {
      title: 'IP Address',
      dataIndex: 'client_ip',
      responsive: ['xl'],
    },
    {
      title: 'City',
      dataIndex: 'client_city',
      responsive: ['xl'],
    },
    {
      title: 'Region',
      width: 90,
      dataIndex: 'client_region',
      responsive: ['xl'],
    },
    {
      title: '',
      width: 100,
      render: (record) => (
        <Popconfirm
          title={'Revoke this session?'}
          onConfirm={() => handleConfirmRevoke(record)}
          okText={'Yes'}
          cancelText={'No'}>
          <Button size={'small'}>{'Revoke'}</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Flex vertical gap={'middle'}>
      <PageHeader />
      <Flex gap={'middle'}>
        <DataEntry label={'Name'} value={user?.display_name} />
        <DataEntry label={'Primary Email Address'} value={user?.primary_email_address} />
        <DataEntry
          label={'Created at'}
          value={formatDate(user?.created_at, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE)}
        />
        <DataEntry label={'User ID'} value={user?.id} copyable />
      </Flex>
      <Flex gap={'middle'}>
        <DataEntry
          label={'Organizations'}
          value={user?.organization_memberships.map((org) => org.id).join(', ')}
        />
      </Flex>
      <Typography.Title level={4}>Active sessions</Typography.Title>
      <Typography.Text>
        If you notice any sessions you don’t recognize, we recommend revoking them immediately to
        protect your account.
      </Typography.Text>
      <Table
        tableLayout={'fixed'}
        size={'small'}
        rowKey={'hash'}
        columns={userSessionsTableColumns}
        dataSource={allUserSessions}
        loading={fetchingUserSessions}
        locale={{ emptyText: 'No active sessions' }}
      />
      {features.amplitude && (
        <>
          <Typography.Title level={4}>Privacy settings</Typography.Title>
          <Space>
            <Switch
              defaultChecked={getCookieConsent() === 'accepted'}
              onChange={(checked) => {
                if (checked) {
                  setCookieConsent('accepted');
                  initializeAmplitude();
                } else {
                  optOutAmplitude();
                  setCookieConsent('declined');
                }
              }}
            />
            <Typography.Text>Enable cookies</Typography.Text>
          </Space>
        </>
      )}
    </Flex>
  );
};
