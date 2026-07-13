import { FullHeightContainer } from '@src/components/shared/ui/FullHeightContainer/FullHeightContainer';
import { ResourceGraph } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewEnvironment/components/ResourceGraph/ResourceGraph';

const EnvResources = () => {
  return (
    <FullHeightContainer height={'80%'}>
      <ResourceGraph />
    </FullHeightContainer>
  );
};

export { EnvResources };
