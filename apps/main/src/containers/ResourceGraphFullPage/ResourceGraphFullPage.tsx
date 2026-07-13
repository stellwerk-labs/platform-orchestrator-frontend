import { Layout } from 'antd';

import { MainHeader } from '@src/components/shared/MainHeader/MainHeader';
import { FullHeightContainer } from '@src/components/shared/ui/FullHeightContainer/FullHeightContainer';
import { ResourceGraph } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewEnvironment/components/ResourceGraph/ResourceGraph';

const ResourceGraphFullPage = () => {
  return (
    <Layout>
      <MainHeader />
      <Layout.Content style={{ display: 'flex', flexDirection: 'column', height: '96vh' }}>
        <FullHeightContainer>
          <ResourceGraph />
        </FullHeightContainer>
      </Layout.Content>
    </Layout>
  );
};
export { ResourceGraphFullPage };
