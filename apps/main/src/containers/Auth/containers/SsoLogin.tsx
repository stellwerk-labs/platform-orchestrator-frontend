import { Flex, Typography } from 'antd';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import { useRequestSsoLogin } from '@src/hooks/react-query/v2/iam/internal/internal';
import { useGetCurrentUser } from '@src/hooks/react-query/v2/iam/user/user';

import { SsoButton } from '../components/SsoButton';

export const SsoLogin = () => {
  const navigate = useNavigate();

  const { orgId } = useParams<keyof MatchParams>() as MatchParams;
  const { data: currentUser } = useGetCurrentUser();
  const { mutate: getRedirectURL, error: loginError } = useRequestSsoLogin();

  const text = loginError?.response?.data.message;

  const handleSsoLogin = () => {
    getRedirectURL(
      {
        data: { org_id: orgId },
      },
      {
        onSuccess: (data) => {
          window.location.href = data.redirect_url;
        },
      },
    );
  };

  useEffect(() => {
    if (currentUser === undefined) return;

    if (currentUser.organization_memberships.length) {
      navigate(`/orgs/${currentUser.organization_memberships[0]?.id}/projects`);
    } else {
      navigate('/');
    }
  }, [currentUser, navigate]);

  return (
    <Flex gap={'middle'} justify={'center'} align={'center'} flex={1} vertical>
      <Typography.Title style={{ margin: 0 }} level={1}>
        Sign in with SSO
      </Typography.Title>
      <Typography.Text type={'secondary'}>
        Organization: <Typography.Text strong>{orgId}</Typography.Text>
      </Typography.Text>
      <SsoButton onSsoClick={handleSsoLogin} label={'Continue'} />
      {text && (
        <Typography.Text className={'txt-sm'} type={'danger'}>
          {text}
        </Typography.Text>
      )}
      <Typography.Text className={'txt-sm'} type={'secondary'}>
        Wrong organization?{' '}
        <Link to={`/auth/login?orgId=${encodeURIComponent(orgId ?? '')}`}>Go back</Link>
      </Typography.Text>
    </Flex>
  );
};
