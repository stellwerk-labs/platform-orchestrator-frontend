import { Card, Empty, Flex } from 'antd';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import { DeploymentCard } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewEnvironment/components/Deploys/components/DeploymentCard';
import { useListLastDeployments } from '@src/hooks/react-query/v2/dataplane/deployment/deployment';

import { ResourceGraph } from '../ResourceGraph/ResourceGraph';

export const EnvStatus = () => {
  const { orgId, projectId, envId } = useParams<keyof MatchParams>() as MatchParams;

  // i18n
  const { t } = useTranslation('viewEnvironment');
  const deploysTranslations = t('DEPLOYS');

  // Get the latest stateful (not plan-only) deployment
  const { data: deploymentsPage } = useListLastDeployments(orgId, {
    project_id: projectId,
    env_id: envId,
    per_page: 1,
    state_change_only: true,
  });

  const deployment = deploymentsPage?.items[0];

  return (
    <>
      {deployment ? (
        <Flex vertical gap={'middle'}>
          <DeploymentCard deploy={deployment} isActiveDeployment />

          <Card title={'Active resources'}>
            <ResourceGraph />
          </Card>
        </Flex>
      ) : (
        <Empty
          description={deploysTranslations.NO_DEPLOYS_TO_THIS_ENVIRONMENT}
          styles={{ image: { display: 'none' } }}
        />
      )}
    </>
  );
};
