import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router';

import { useGetCurrentUser } from '@src/hooks/react-query/v2/iam/user/user';
import { getLastVisitedURL } from '@src/utilities/local-storage';
import { generateAppUrl } from '@src/utilities/navigation';

/**
 * Generic component for a public route.
 */
export const PublicRoute = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const { data: user } = useGetCurrentUser();

  /**
   * Set the org to redirect to.
   */
  useEffect(() => {
    const lastURL = getLastVisitedURL();
    const firstOrgId = user?.organization_memberships[0]?.id;
    if (user) {
      if (lastURL) {
        navigate(lastURL);
      } else if (firstOrgId) {
        navigate(`${generateAppUrl(firstOrgId)}/projects`);
      }
    }
  }, [navigate, user]);

  return <>{children}</>;
};
