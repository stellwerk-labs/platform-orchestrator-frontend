import { Flex } from 'antd';
import { useEffect, useMemo } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router';

import { ErrorPage } from '@src/components/shared/ErrorPage/ErrorPage';
import { MainLayout } from '@src/components/shared/MainLayout';
import { MatchParams } from '@src/config/routing';
import { useGetCurrentUser } from '@src/hooks/react-query/v2/iam/user/user';
import { removeSelectedOrganization, setSelectedOrganization } from '@src/utilities/local-storage';
import { generateAppUrl } from '@src/utilities/navigation';

const Orgs = () => {
  // router hooks
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;
  const { data: currentUser, isFetched: isCurrentUserLoaded } = useGetCurrentUser();
  const navigate = useNavigate();

  const orgNonExistant = useMemo(
    () =>
      isCurrentUserLoaded && !currentUser?.organization_memberships.find((org) => org.id === orgId),
    [orgId, currentUser, isCurrentUserLoaded],
  );

  useEffect(() => {
    if (isCurrentUserLoaded && currentUser?.organization_memberships.length === 0) {
      removeSelectedOrganization();
      navigate('/');
    } else {
      setSelectedOrganization(orgId);
    }
  }, [orgId, currentUser, isCurrentUserLoaded, navigate]);

  return (
    <MainLayout>
      {orgNonExistant ? (
        <ErrorPage
          title={"You don't have access to this organization"}
          descriptionTexts={['Please select another one from the list below']}
          buttons={
            <Flex vertical gap={'small'}>
              {currentUser?.organization_memberships.map((org) => (
                <Link key={org.id} to={generateAppUrl(org.id)}>
                  {org.id}
                </Link>
              ))}
            </Flex>
          }
        />
      ) : (
        <Outlet />
      )}
    </MainLayout>
  );
};

export { Orgs };
