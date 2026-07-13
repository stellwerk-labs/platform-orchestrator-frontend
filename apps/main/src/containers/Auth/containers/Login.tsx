import { useQueryClient } from '@tanstack/react-query';
import { Flex, Typography } from 'antd';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { Freetrial } from '@src/components/shared/Freetrial';
import { features } from '@src/config/features';
import { useLoginSession } from '@src/hooks/react-query/v2/iam/internal/internal';
import {
  getGetCurrentUserQueryKey,
  useGetCurrentUser,
} from '@src/hooks/react-query/v2/iam/user/user';
import { getLastVisitedURL } from '@src/utilities/local-storage';

import { AuthButtons } from '../components/AuthButtons';
import { SsoRedirectButton } from '../components/SsoRedirectButton';

export const Login = () => {
  const navigate = useNavigate();
  const {
    mutate: verifyProviderSignIn,
    isSuccess: loggedIn,
    error: loginError,
  } = useLoginSession();
  const { data: currentUser } = useGetCurrentUser();
  const queryClient = useQueryClient();

  // This error message is social-login only
  const text =
    loginError?.response?.data.message === 'no such user' &&
    "This user doesn't exist. Please sign up instead.";

  const handleProviderSuccess = (provider: 'google' | 'microsoft', token: string): void => {
    verifyProviderSignIn(
      {
        data: {
          provider,
          provider_token: token,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        },
      },
    );
  };

  useEffect(() => {
    const lastURL = getLastVisitedURL();
    if (loggedIn) {
      if (lastURL) {
        navigate(lastURL);
      }

      if (currentUser?.organization_memberships.length) {
        navigate(`/orgs/${currentUser.organization_memberships[0]?.id}/projects`);
      } else if (currentUser !== undefined) {
        navigate('/');
      }
    }
  }, [currentUser, loggedIn, navigate]);

  return (
    <Flex gap={'middle'} justify={'center'} align={'center'} flex={1} vertical>
      <Typography.Title style={{ margin: 0 }} level={1}>
        Welcome back!
      </Typography.Title>

      {features.socialLogins && (
        <div>
          <Typography.Text className={'txt-sm'}>Are you new here?</Typography.Text> <Freetrial />
        </div>
      )}

      <AuthButtons
        type={'login'}
        googleAuthSuccess={(token) => handleProviderSuccess('google', token)}
        microsoftAuthSuccess={(token) => handleProviderSuccess('microsoft', token)}
        ssoButton={<SsoRedirectButton />}
      />

      {text && (
        <Typography.Text className={'txt-sm'} type={'danger'}>
          {text}
        </Typography.Text>
      )}
    </Flex>
  );
};
