import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  FileTextOutlined,
  LineChartOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Alert, Flex, Tabs, Typography } from 'antd';
import { useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router';

import { DataEntry } from '@src/components/shared/ui/DataEntry/DataEntry';
import { windowEnv } from '@src/config/environment';
import { MatchParams } from '@src/config/routing';
import type { PipelineDeployment } from '@src/containers/RunnerRollouts/deploymentPipelineApi';
import { PipelineStatus } from '@src/containers/RunnerRollouts/PipelineStatus';
import { useGetDeployment } from '@src/hooks/react-query/v2/dataplane/deployment/deployment';
import { useUserDetails } from '@src/hooks/useUserDetails';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';

import { DeploymentMode } from '../ViewEnvironment/components/Deploys/components/DeploymentMode';
import { DeploymentStatus } from '../ViewEnvironment/components/Deploys/components/DeploymentStatus';
import { UserVisibleMode } from '../ViewEnvironment/components/Deploys/modes';
import { DeploymentErrorDisplay } from './components/DeploymentErrorDisplay';

export const ViewDeployment = () => {
  const { orgId, projectId, envId, deployId } = useParams<keyof MatchParams>() as MatchParams & {
    deployId: string;
  };
  const navigate = useNavigate();
  const location = useLocation();

  // React query
  const { data: deployment, isLoading } = useGetDeployment(orgId, deployId, {
    query: { refetchInterval: windowEnv.RUNNER_ROLLOUTS === 'true' ? 2000 : false },
  });
  const pipeline = (deployment as PipelineDeployment | undefined)?.pipeline;
  const { getUserDisplayName } = useUserDetails(orgId);

  const urlSegments = location.pathname.split('/');
  const lastKey = urlSegments[urlSegments.length - 1] ?? 'resources';

  const actualProject = deployment?.project_id;
  const actualEnvironment = deployment?.env_id;
  useEffect(() => {
    if (
      actualProject &&
      actualEnvironment &&
      (actualProject !== projectId || actualEnvironment !== envId)
    ) {
      const tab = ['pipeline', 'manifest', 'logs'].includes(lastKey) ? lastKey : 'resources';
      navigate(
        `/orgs/${orgId}/projects/${actualProject}/envs/${actualEnvironment}/deploys/${deployId}/${tab}`,
        { replace: true },
      );
    }
  }, [actualProject, actualEnvironment, projectId, envId, orgId, deployId, lastKey, navigate]);

  const handleTabChange = (key: string) => {
    navigate(key, { replace: true });
  };

  if (isLoading || !deployment) {
    return null;
  }

  return (
    <Flex vertical gap={'large'}>
      <Flex vertical gap={'small'}>
        <Link
          to={`/orgs/${orgId}/projects/${deployment.project_id}/envs/${deployment.env_id}/deploys`}>
          <ArrowLeftOutlined /> Back to deployments
        </Link>
        <Typography.Title level={3}>{deployment.id}</Typography.Title>
      </Flex>

      <Flex gap={'middle'} wrap={'wrap'}>
        {deployment.status && (
          <DataEntry
            label={'Deployment status'}
            value={
              pipeline ? (
                <PipelineStatus phase={pipeline.phase} applied={pipeline.infrastructure_applied} />
              ) : (
                <DeploymentStatus status={deployment.status} activeDeployment={false} greyIcon />
              )
            }
          />
        )}
        {deployment.created_at && (
          <DataEntry
            label={'Created at'}
            value={formatDate(
              deployment.created_at,
              DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE,
            )}
          />
        )}
        <DataEntry
          label={'Mode'}
          value={
            <DeploymentMode
              mode={deployment.mode as UserVisibleMode}
              planOnly={deployment.plan_only}
            />
          }
        />
        <DataEntry label={'Created by'} value={getUserDisplayName(deployment.created_by)} />
        {deployment.status_message && deployment.status === 'failed' && (
          <DeploymentErrorDisplay statusMessage={deployment.status_message} />
        )}
      </Flex>

      {deployment.status === 'executing' &&
        deployment.status_message &&
        deployment.status_message !== 'Deploying...' && (
          <Alert type={'info'} showIcon message={deployment.status_message} />
        )}
      <Tabs
        activeKey={lastKey}
        items={[
          ...(windowEnv.RUNNER_ROLLOUTS === 'true'
            ? [{ label: 'Pipeline', icon: <ApartmentOutlined />, key: 'pipeline' }]
            : []),
          {
            label: 'Resources',
            icon: <LineChartOutlined />,
            key: 'resources',
          },
          {
            label: 'Manifest',
            icon: <UnorderedListOutlined />,
            key: 'manifest',
          },
          {
            label: 'Logs',
            icon: <FileTextOutlined />,
            key: 'logs',
          },
        ]}
        onChange={handleTabChange}
      />

      <Outlet
        context={{
          orgId,
          projectId: deployment.project_id,
          envId: deployment.env_id,
          deployId,
          getUserDisplayName,
        }}
      />
    </Flex>
  );
};
