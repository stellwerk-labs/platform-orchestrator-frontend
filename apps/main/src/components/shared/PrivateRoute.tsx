import { Spin } from 'antd';
import { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { useGetCurrentUser } from '@src/hooks/react-query/v2/iam/user/user';

/**
 * Generic component for a protected route.
 */
export const PrivateRoute = ({ children }: { children: ReactNode }) => {
  const { isFetching, isSuccess } = useGetCurrentUser();

  if (isFetching) {
    <Spin />;
  }

  return <>{isSuccess || isFetching ? children : <Navigate to={'/auth/login'} />}</>;
};
