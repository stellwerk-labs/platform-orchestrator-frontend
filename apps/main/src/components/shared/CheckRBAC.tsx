import { ReactNode } from 'react';

import { RBACPermission, RBACStatus, useRBAC } from '@src/hooks/useRBAC';

interface CheckRBACProps {
  permission: RBACPermission;
  resource?: string;
  children: ReactNode | ((allowed: boolean) => ReactNode);
}

export const CheckRBAC = ({ permission, resource, children }: CheckRBACProps) => {
  const userPermission = useRBAC(permission, resource);

  if (userPermission === RBACStatus.LOADING) {
    return null;
  }

  const allowed = userPermission === RBACStatus.ALLOWED;

  if (typeof children === 'function') {
    return children(allowed);
  }

  return allowed ? <>{children}</> : null;
};
