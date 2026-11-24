import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Flex, Modal, Typography } from 'antd';
import { isAxiosError } from 'axios';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { generateDeploymentUrl } from '@src/utilities/navigation';

import { DeploymentLink } from './DeploymentLink';
import {
  applySavedPlan,
  type DeploymentPipeline,
  deploymentPipelineError,
  pipelineQueryKey,
  replanDeployment,
} from './deploymentPipelineApi';
import { ResourceChanges } from './ResourceChanges';
import type { RolloutScope } from './rolloutApi';

type Request = { action: 'apply-plan' | 'replan'; id: string; subject: string };
type Props = {
  scope: RolloutScope;
  id: string;
  plan: NonNullable<DeploymentPipeline['plan']>;
  changes: DeploymentPipeline['progress']['changes'];
  canWrite: boolean;
  unavailable: boolean;
};

const titles = {
  ready: 'Ready to apply',
  superseded: 'Plan is out of date',
  used: 'This plan has an apply deployment',
  busy: 'Environment is busy',
  unavailable: 'This plan cannot be applied',
  pending: 'Plan is still being created',
};

export const PlanActions = ({ scope, id, plan, changes, canWrite, unavailable }: Props) => {
  const { orgId, projectId, envId } = scope;
  const navigate = useNavigate();
  const cache = useQueryClient();
  const keys = useRef(new Map<string, string>());
  const [confirmation, setConfirmation] = useState<Request>();
  const action = useMutation({
    mutationFn: (request: Request) => {
      if (!canWrite) throw new Error('Deployment read and write permissions are required.');
      const identity = JSON.stringify(request);
      let key = keys.current.get(identity);
      if (!key) {
        key = crypto.randomUUID();
        keys.current.set(identity, key);
      }
      return request.action === 'apply-plan'
        ? applySavedPlan(orgId, request.id, request.subject, key)
        : replanDeployment(orgId, request.id, key);
    },
    onSuccess: (deployment) => {
      void cache.invalidateQueries({ queryKey: pipelineQueryKey(orgId, id) });
      navigate(generateDeploymentUrl(orgId, projectId, envId, deployment.id, 'pipeline'));
    },
    onError: (error) => {
      if (isAxiosError(error) && error.response?.status === 409)
        void cache.invalidateQueries({ queryKey: pipelineQueryKey(orgId, id) });
    },
  });
  const disabled = !canWrite || unavailable || action.isPending;
  const changed =
    confirmation?.action === 'apply-plan' &&
    (plan.state !== 'ready' || confirmation.subject !== plan.subject);
  const link = (deploymentId: string, label: string) => (
    <DeploymentLink url={generateDeploymentUrl(orgId, projectId, envId, deploymentId, 'pipeline')}>
      {label}
    </DeploymentLink>
  );
  return (
    <Flex vertical gap={'small'}>
      <Alert
        showIcon
        type={plan.state === 'superseded' || plan.state === 'busy' ? 'warning' : 'info'}
        message={titles[plan.state]}
        description={
          plan.state === 'used'
            ? 'A saved plan can only be used once. Open its deployment to follow the outcome. To deploy again, start a new deployment or rollback.'
            : plan.state === 'ready'
              ? 'Review the saved plan before applying. Apply this plan executes those exact changes once, without generating another plan.'
              : plan.reason
        }
        action={
          plan.state === 'used' && plan.apply_deployment_id
            ? link(plan.apply_deployment_id, 'View apply deployment')
            : plan.state === 'superseded' && plan.current_deployment_id
              ? link(plan.current_deployment_id, 'View newer deployment')
              : undefined
        }
      />
      {action.isError && (
        <Alert type={'error'} showIcon message={deploymentPipelineError(action.error)} />
      )}
      <Flex gap={'small'} wrap>
        {plan.state === 'ready' && (
          <Button
            type={'primary'}
            disabled={disabled || !plan.subject}
            loading={action.isPending}
            onClick={() => setConfirmation({ action: 'apply-plan', id, subject: plan.subject! })}>
            Apply this plan
          </Button>
        )}
        {plan.can_replan && plan.state !== 'used' && (
          <Button
            type={plan.state === 'superseded' ? 'primary' : 'default'}
            disabled={disabled}
            loading={action.isPending}
            onClick={() => setConfirmation({ action: 'replan', id, subject: '' })}>
            Create new plan
          </Button>
        )}
      </Flex>
      <Modal
        open={Boolean(confirmation)}
        title={
          confirmation?.action === 'apply-plan' ? 'Apply this saved plan?' : 'Create a new plan?'
        }
        okText={confirmation?.action === 'apply-plan' ? 'Apply plan' : 'Create new plan'}
        okButtonProps={{ disabled: disabled || changed }}
        onCancel={() => setConfirmation(undefined)}
        onOk={() => {
          if (confirmation && !disabled && !changed) {
            action.mutate(confirmation);
            setConfirmation(undefined);
          }
        }}>
        <Typography.Paragraph>
          Environment: {projectId} / {envId}
        </Typography.Paragraph>
        <Typography.Paragraph>Source plan: {confirmation?.id}</Typography.Paragraph>
        {confirmation?.action === 'apply-plan' ? (
          <>
            <ResourceChanges changes={changes} />
            <Typography.Paragraph>
              Applies the exact reviewed plan once. No new plan is generated.
            </Typography.Paragraph>
          </>
        ) : (
          <Typography.Paragraph>
            Creates a new plan against the current environment using the same deployment request.
            Review the new plan before applying it. No Apply starts automatically.
          </Typography.Paragraph>
        )}
      </Modal>
    </Flex>
  );
};
