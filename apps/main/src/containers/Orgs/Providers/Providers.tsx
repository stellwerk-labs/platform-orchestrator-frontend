import React from 'react';
import { Outlet } from 'react-router';

import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';

export const Providers = () => {
  return (
    <>
      <PageHeader />
      <Outlet />
    </>
  );
};
