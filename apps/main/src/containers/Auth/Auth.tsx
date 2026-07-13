import { Flex, Layout, theme } from 'antd';
import { Outlet } from 'react-router';

import { ErrorBoundary } from '@src/components/shared/ErrorBoundary/ErrorBoundary';
import { HTMLDocumentTitle } from '@src/components/shared/HTMLDocumentTitle';
import { MainHeader } from '@src/components/shared/MainHeader/MainHeader';

export const Auth = () => {
  const { token } = theme.useToken();
  return (
    <Layout style={{ height: '100vh' }}>
      <HTMLDocumentTitle />
      <MainHeader />
      <ErrorBoundary>
        <Flex style={{ backgroundColor: token.colorBgLayout, height: '100%' }} justify={'center'}>
          <Outlet />
        </Flex>
      </ErrorBoundary>
    </Layout>
  );
};
