import { useQueryClient } from '@tanstack/react-query';
import { App, Flex, Result } from 'antd';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { LoadingBar } from '@src/components/shared/ui/LoadingBar/LoadingBar';
import { useCreateOrganization } from '@src/hooks/react-query/v2/controlplane/organization/organization';
import {
  getGetCurrentUserQueryKey,
  useGetCurrentUser,
} from '@src/hooks/react-query/v2/iam/user/user';
import { generateAppUrl } from '@src/utilities/navigation';

import { AnimatedDots } from './components/shared/AnimatedDots';

// Redirects authenticated users to their org, or auto-creates one if they have none.
// Unauthenticated users are handled upstream by the axios 401 interceptor, will redirect to /auth/login.
export const RedirectRoot = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { message } = App.useApp();
  const { data: currentUser, isSuccess: userLoaded } = useGetCurrentUser();

  const {
    mutate: createOrganization,
    isError: createOrganizationErrored,
    isPending: createOrganizationPending,
    error: createOrganizationError,
  } = useCreateOrganization({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      },
      onError: (err) => {
        message.error(err.response?.data?.message ?? 'Failed to create organization.');
      },
    },
  });

  useEffect(() => {
    if (!userLoaded) return;

    if (currentUser.organization_memberships[0]) {
      // User already belongs to an org — navigate directly
      navigate(generateAppUrl(currentUser.organization_memberships[0].id));
    } else if (!createOrganizationPending) {
      // No org yet — create one. Guard prevents duplicate calls on re-renders.
      createOrganization();
    }
  }, [userLoaded, currentUser, createOrganization, navigate, createOrganizationPending]);

  // Error state
  if (createOrganizationErrored) {
    return (
      <Result
        status={'error'}
        title={'Failed to create organization'}
        subTitle={
          createOrganizationError.response?.data?.message ??
          'An unexpected error occurred. Please try again later.'
        }
      />
    );
  }

  // Loading states
  return (
    <>
      <LoadingBar />
      <Flex style={{ height: '100vh', width: '100%' }} justify={'center'} align={'center'}>
        <span>{createOrganizationPending ? 'Creating organization' : 'Loading'}</span>
        <AnimatedDots time={200} />
      </Flex>
    </>
  );
};
