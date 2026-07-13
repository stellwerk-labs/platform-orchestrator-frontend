import { Outlet } from 'react-router';

import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';

export const ModulesMain = () => {
  return (
    <>
      <PageHeader />
      <Outlet />
    </>
  );
};
