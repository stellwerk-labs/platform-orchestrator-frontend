import { Alert } from 'antd';

import { DeploymentSummary, EnvironmentFence } from '@src/models/v2/dataplane';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';

import { AcknowledgeOutcome } from './AcknowledgeOutcome';

interface OutcomeFenceProps {
  deployment: DeploymentSummary;
  fence: EnvironmentFence;
  environmentUuid?: string;
}

export const OutcomeFence = ({ deployment, fence, environmentUuid }: OutcomeFenceProps) => (
  <Alert
    type={'warning'}
    showIcon
    message={'New Deployments of this Environment are blocked (outcome_unreconciled)'}
    description={
      <>
        {`Deployment ${fence.deployment_id} failed on ${formatDate(fence.since, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE)} and its Runner may still be active. Until a late Runner result arrives or an operator acknowledges the outcome, every new Deployment of this Environment, queued or not, is refused.`}
        <div>
          <AcknowledgeOutcome
            deployment={deployment}
            fence={fence}
            environmentUuid={environmentUuid}
          />
        </div>
      </>
    }
  />
);
