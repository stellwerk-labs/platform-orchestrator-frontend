import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Layout, Result, Row, Space, Spin, Typography } from 'antd';
import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { MainHeader } from '@src/components/shared/MainHeader/MainHeader';
import {
  useGetInvitation,
  useRedeemInvitation,
} from '@src/hooks/react-query/v2/iam/invitation/invitation';
import {
  getGetCurrentUserQueryKey,
  useGetCurrentUser,
} from '@src/hooks/react-query/v2/iam/user/user';
import { setInviteToken as setInviteTokenLocalStorage } from '@src/utilities/local-storage';
import { generateProjectsUrl } from '@src/utilities/navigation';
import { useGetUrlParam } from '@src/utilities/url-params';

const { Title, Text } = Typography;

export const AcceptInvite = () => {
  const [searchParams] = useSearchParams();
  // Router hooks
  const navigate = useNavigate();

  const inviteToken = useGetUrlParam('inviteToken');

  const orgId = searchParams.get('orgId');
  const inviteId = searchParams.get('inviteId');
  const redemptionToken = searchParams.get('redemptionToken');

  // React Query
  const queryClient = useQueryClient();
  const {
    data: invite,
    isLoading: isLoadingInvite,
    isSuccess: isLoadedInvite,
    isError: isLoadInviteError,
  } = useGetInvitation(orgId || '', inviteId || '', { redemptionToken: redemptionToken || '' });
  const {
    mutate: redeemInvitation,
    isSuccess,
    isPending: isAcceptingInvite,
  } = useRedeemInvitation();
  const { isSuccess: isLoggedIn, data: currentUser } = useGetCurrentUser();

  useEffect(() => {
    if (inviteToken) {
      // Set in localstorage
      setInviteTokenLocalStorage(inviteToken);
    }
  }, [inviteToken]);

  useEffect(() => {
    if (isSuccess && orgId) {
      navigate(generateProjectsUrl(orgId));
    }
  }, [isSuccess, navigate, invite, orgId]);

  const isEmailMismatch =
    currentUser?.primary_email_address &&
    invite?.email_address &&
    currentUser.primary_email_address.toLowerCase() !== invite.email_address.toLowerCase();

  const acceptInviteComponent = (
    <Card style={{ maxWidth: 480, margin: 'auto' }}>
      <Space direction={'vertical'} size={'middle'} style={{ width: '100%' }}>
        <Title level={4} style={{ margin: 0 }}>
          You've been invited to join {orgId}
        </Title>

        {isEmailMismatch && (
          <Alert
            type={'warning'}
            message={
              <Text>
                {'The invitation was sent to '}
                <strong>{invite?.email_address}</strong>
                {" but you're logged in as "}
                <strong>{currentUser?.primary_email_address}</strong>
                {'.'}
              </Text>
            }
            description={
              <Text type={'secondary'}>
                {"Please ensure you're using the correct account to accept this invitation."}
              </Text>
            }
          />
        )}

        <Space direction={'vertical'}>
          <Text>
            <b>Invited by:</b> {invite?.created_by_display_name} (
            {invite?.created_by_primary_email_address})
          </Text>
          <Text>
            <b>Sent to:</b> {invite?.email_address}
          </Text>
        </Space>

        <Space>
          <Button
            type={'primary'}
            loading={isAcceptingInvite}
            onClick={() => {
              if (orgId && inviteId && redemptionToken && invite) {
                redeemInvitation(
                  {
                    orgId,
                    invitationId: inviteId,
                    params: { redemptionToken },
                  },
                  {
                    onSuccess: () => {
                      queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
                    },
                  },
                );
              }
            }}>
            Accept
          </Button>
        </Space>
      </Space>
    </Card>
  );

  const notLoggedInComponent = (
    <Card style={{ maxWidth: 500, margin: '0 auto' }}>
      <Result
        title={'Not logged in'}
        subTitle={'Log in if you already have an account. Sign up if you are new here.'}
        extra={
          <>
            <Link to={'/auth/login'}>
              <Button>Log in</Button>
            </Link>
            <Link to={'/auth/register'}>
              <Button>Sign up</Button>
            </Link>
          </>
        }
      />
    </Card>
  );

  const loadInviteErrorComponent = (
    <Card style={{ maxWidth: 500, margin: '0 auto' }}>
      <Result
        title={'Invite Not Found'}
        subTitle={'This invitation may have expired, been revoked, or never existed.'}
        extra={
          isLoggedIn ? (
            <Link to={`/orgs/${currentUser?.organization_memberships[0]?.id}/projects`}>
              <Button> Proceed to {currentUser?.organization_memberships[0]?.id}</Button>
            </Link>
          ) : (
            <Link to={'/auth/login'}>
              <Button>Back to login</Button>
            </Link>
          )
        }
      />
    </Card>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <MainHeader />
      <Layout.Content>
        <Row justify={'center'} align={'middle'} style={{ minHeight: '100vh' }}>
          {isLoadingInvite ? (
            <Spin />
          ) : !isLoggedIn ? (
            notLoggedInComponent
          ) : isLoadInviteError ? (
            loadInviteErrorComponent
          ) : (
            isLoadedInvite && acceptInviteComponent
          )}
        </Row>
      </Layout.Content>
    </Layout>
  );
};
