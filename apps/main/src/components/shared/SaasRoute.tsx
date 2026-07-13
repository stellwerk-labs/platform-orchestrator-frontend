import { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router';

import { isSelfHosted } from '@src/config/features';
import { MatchParams } from '@src/config/routing';

export const SaasRoute = ({ children }: { children: ReactNode }) => {
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;

  if (isSelfHosted) {
    return <Navigate to={orgId ? `/orgs/${orgId}/projects` : '/'} replace />;
  }

  return <>{children}</>;
};
