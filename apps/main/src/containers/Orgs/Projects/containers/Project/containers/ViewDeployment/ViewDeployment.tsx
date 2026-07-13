import { LineChartOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Flex, Tabs, Typography } from 'antd';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router';

import { DataEntry } from '@src/components/shared/ui/DataEntry/DataEntry';
import { MatchParams } from '@src/config/routing';
import { useGetDeployment } from '@src/hooks/react-query/v2/dataplane/deployment/deployment';
import { useUserDetails } from '@src/hooks/useUserDetails';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';

import { DeploymentMode } from '../ViewEnvironment/components/Deploys/components/DeploymentMode';
import { DeploymentStatus } from '../ViewEnvironment/components/Deploys/components/DeploymentStatus';
import { UserVisibleMode } from '../ViewEnvironment/components/Deploys/modes';
import { DeploymentErrorDisplay } from './components/DeploymentErrorDisplay';

export const ViewDeployment = () => {
  const { orgId, deployId } = useParams<keyof MatchParams>() as MatchParams & {
    deployId: string;
  };
  const navigate = useNavigate();
  const location = useLocation();

  // React query
  const { data: deployment, isLoading } = useGetDeployment(orgId, deployId);
  const { getUserDisplayName } = useUserDetails(orgId);

  const urlSegments = location.pathname.split('/');
  const lastKey = urlSegments[urlSegments.length - 1];

  const handleTabChange = (key: string) => {
    navigate(key, { replace: true });
  };

  if (isLoading || !deployment) {
    return null;
  }

  return (
    <Flex vertical gap={'large'}>
      <Flex vertical gap={'small'}>
        <Typography.Title level={3}>{deployment.id}</Typography.Title>
      </Flex>

      <Flex gap={'middle'} wrap={'wrap'}>
        {deployment.status && (
          <DataEntry
            label={'Deployment status'}
            value={
              <DeploymentStatus status={deployment.status} activeDeployment={false} greyIcon />
            }
          />
        )}
        {deployment.created_at && (
          <DataEntry
            label={'Deployed at'}
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

      <Tabs
        defaultActiveKey={lastKey}
        items={[
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
        ]}
        onChange={handleTabChange}
      />

      <Outlet />
    </Flex>
  );
};
