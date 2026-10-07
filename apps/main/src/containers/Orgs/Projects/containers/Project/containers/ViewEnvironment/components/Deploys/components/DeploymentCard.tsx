import { Card, Flex } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { DataEntry } from '@src/components/shared/ui/DataEntry/DataEntry';
import { DeploymentSummary } from '@src/models/v2/dataplane';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';
import { generateDeploymentUrl } from '@src/utilities/navigation';

import { DeploymentStatus } from './DeploymentStatus';

interface DeploymentCardProps {
  deploy: DeploymentSummary;
  isActiveDeployment?: boolean;
}

export const DeploymentCard = ({ deploy, isActiveDeployment }: DeploymentCardProps) => {
  // i18n
  const { t } = useTranslation('viewEnvironment');
  const translations = t('DEPLOYS').DEPLOYMENT_CARD;

  return (
    <Card title={isActiveDeployment ? 'Last deployment' : undefined}>
      <Flex gap={'middle'} wrap={'wrap'}>
        {deploy.status && (
          <DataEntry
            label={translations.DEPLOYMENT_STATUS}
            value={
              <DeploymentStatus
                status={deploy.status}
                activeDeployment={Boolean(isActiveDeployment)}
                greyIcon
              />
            }
          />
        )}
        <DataEntry
          label={translations.DEPLOYMENT_ID}
          value={
            <Link
              to={generateDeploymentUrl(
                deploy.org_id,
                deploy.project_id,
                deploy.env_id,
                deploy.id,
                'resources',
              )}>
              {deploy.id}
            </Link>
          }
        />

        {deploy?.created_at && (
          <DataEntry
            label={translations.DEPLOYED_AT}
            value={formatDate(deploy?.created_at, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE)}
          />
        )}
      </Flex>
    </Card>
  );
};
