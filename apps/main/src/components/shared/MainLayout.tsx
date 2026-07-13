import { Layout, theme } from 'antd';
import { ReactNode } from 'react';

import { Breadcrumbs } from '@src/components/shared/Breadcrumbs/Breadcrumbs';
import { ErrorBoundary } from '@src/components/shared/ErrorBoundary/ErrorBoundary';
import { MainHeader } from '@src/components/shared/MainHeader/MainHeader';
import { NavigationBar } from '@src/components/shared/NavigationBar/NavigationBar';
import { useBreadcrumbs } from '@src/hooks/useBreadcrumbs';

interface MainAppLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainAppLayoutProps) => {
  const { token } = theme.useToken();

  const crumbs = useBreadcrumbs();

  return (
    <Layout style={{ height: '100vh' }}>
      <MainHeader />
      <Layout>
        <NavigationBar />
        <Layout>
          {crumbs.length > 0 && <Breadcrumbs crumbs={crumbs} />}
          <Layout.Content
            id={'main-content'}
            style={{
              padding: `0 ${token.paddingXL}px ${token.paddingXL}px`,
              overflow: 'auto',
              height: '100%',
            }}>
            <ErrorBoundary>{children}</ErrorBoundary>
          </Layout.Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export { MainLayout };
