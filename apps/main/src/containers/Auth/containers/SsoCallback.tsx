import { Flex, Typography } from 'antd';
import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { useGetSsoCallback } from '@src/hooks/react-query/v2/iam/internal/internal';
import { useGetCurrentUser } from '@src/hooks/react-query/v2/iam/user/user';

export const SsoCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { error: loginError, isSuccess } = useGetSsoCallback({
    code: searchParams.get('code') || undefined,
    state: searchParams.get('state') || undefined,
    error_description: searchParams.get('error_description') || undefined,
  });

  // Only fetch current user after SSO callback succeeds
  const { data: currentUser } = useGetCurrentUser({
    query: {
      enabled: isSuccess,
    },
  });

  const text = loginError?.response?.data.message;

  useEffect(() => {
    if (isSuccess) {
      if (currentUser?.organization_memberships.length) {
        navigate(`/orgs/${currentUser.organization_memberships[0]?.id}/projects`);
      }
    }
  }, [navigate, currentUser, isSuccess]);

  return (
    <Flex gap={'middle'} justify={'center'} align={'center'} flex={1} vertical>
      {loginError ? (
        <>
          <Typography.Text type={'danger'}>Authentication error: {text}</Typography.Text>
          <Link to={'/auth/login'}>Try again</Link>
        </>
      ) : (
        <Typography.Text>Authenticating...</Typography.Text>
      )}
    </Flex>
  );
};
