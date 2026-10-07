import { Card, Empty, Flex } from 'antd';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import { DeploymentCard } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewEnvironment/components/Deploys/components/DeploymentCard';
import { useGetEnvironment } from '@src/hooks/react-query/v2/controlplane/environment/environment';
import { useListLastDeployments } from '@src/hooks/react-query/v2/dataplane/deployment/deployment';

import { DeploymentQueue } from '../DeploymentQueue/DeploymentQueue';
import { ResourceGraph } from '../ResourceGraph/ResourceGraph';

export const EnvStatus = () => {
  const { orgId, projectId, envId } = useParams<keyof MatchParams>() as MatchParams;

  // i18n
  const { t } = useTranslation('viewEnvironment');
  const deploysTranslations = t('DEPLOYS');

  const { data: environment } = useGetEnvironment(orgId, projectId, envId);

  // Get the latest stateful (not plan-only) deployment
  const { data: deploymentsPage } = useListLastDeployments(orgId, {
    project_id: projectId,
    env_id: envId,
    per_page: 1,
    state_change_only: true,
  });

  const deployment = deploymentsPage?.items[0];

  return (
    <Flex vertical gap={'middle'}>
      {deployment ? (
        <DeploymentCard deploy={deployment} isActiveDeployment />
      ) : (
        <Empty
          description={deploysTranslations.NO_DEPLOYS_TO_THIS_ENVIRONMENT}
          styles={{ image: { display: 'none' } }}
        />
      )}

      {/* Keyed so outcomes never carry over to another Environment. */}
      <DeploymentQueue key={`${orgId}/${projectId}/${envId}`} environmentUuid={environment?.uuid} />

      {deployment && (
        <Card title={'Active resources'}>
          <ResourceGraph />
        </Card>
      )}
    </Flex>
  );
};
