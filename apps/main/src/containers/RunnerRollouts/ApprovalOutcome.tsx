import { RobotOutlined, UserOutlined } from '@ant-design/icons';
import { Flex, Tag, Typography } from 'antd';

import { CostOutcome } from './CostOutcome';
import type { PipelineDefinition } from './deploymentPipelineApi';
import type { Stage } from './pipelineStages';
import type { ApprovalDecision, Rollout } from './rolloutApi';

const approvalReasons: Record<string, string> = {
  human_review: 'Human review',
  cost_non_increasing: 'Complete comparable monthly cost does not increase.',
  resource_limits_satisfied: 'Planned changes satisfy the delegated resource limits.',
};

const DecisionDetails = ({
  decision,
  definition,
  actorLabel,
}: {
  decision: ApprovalDecision;
  definition: PipelineDefinition;
  actorLabel?: string;
}) => {
  const human = decision.source === 'human';
  const label = decision.decision === 'approve' ? 'Approved' : 'Denied';
  const attribution = human
    ? `by ${actorLabel || decision.actor_id || 'a human'}`
    : 'automatically by policy';
  const policyName =
    decision.policy_id === definition.pipeline_id ? definition.name : decision.policy_id;
  return (
    <Flex vertical gap={4}>
      <Tag
        icon={human ? <UserOutlined aria-hidden /> : <RobotOutlined aria-hidden />}
        color={decision.decision === 'approve' ? 'success' : 'error'}>
        {label} {attribution}
      </Tag>
      {decision.policy_id && (
        <Typography.Text>
          Policy: {policyName}
          {decision.policy_version ? ` · v${decision.policy_version}` : ''}
        </Typography.Text>
      )}
      {decision.reason && (
        <Typography.Text>{approvalReasons[decision.reason] ?? decision.reason}</Typography.Text>
      )}
      <Typography.Text type={'secondary'}>
        {new Date(decision.decided_at).toLocaleString()}
      </Typography.Text>
    </Flex>
  );
};

export const ApprovalOutcome = ({
  stage,
  rollout,
  definition,
  actorLabel,
}: {
  stage: Stage;
  rollout: Rollout;
  definition: PipelineDefinition;
  actorLabel?: string;
}) => (
  <Flex vertical gap={'small'}>
    {definition.strategy === 'apply_saved' && rollout.cost && <CostOutcome cost={rollout.cost} />}
    {rollout.approval_decision ? (
      <DecisionDetails
        decision={rollout.approval_decision}
        definition={definition}
        actorLabel={actorLabel}
      />
    ) : (
      <Typography.Text type={'secondary'}>
        {stage.status === 'Approved'
          ? 'Approval details were not recorded.'
          : 'Awaiting a decision'}
      </Typography.Text>
    )}
  </Flex>
);
