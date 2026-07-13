import { ReactNode } from 'react';

import { RBACPermission, RBACStatus, useRBAC } from '@src/hooks/useRBAC';

interface CheckRBACProps {
  permission: RBACPermission;
  children: ReactNode | ((allowed: boolean) => ReactNode);
}

export const CheckRBAC = ({ permission, children }: CheckRBACProps) => {
  const userPermission = useRBAC(permission);

  if (userPermission === RBACStatus.LOADING) {
    return null;
  }

  const allowed = userPermission === RBACStatus.ALLOWED;

  if (typeof children === 'function') {
    return children(allowed);
  }

  return allowed ? <>{children}</> : null;
};
