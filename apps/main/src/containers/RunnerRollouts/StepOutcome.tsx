import { Flex, Typography } from 'antd';

import { ApprovalOutcome } from './ApprovalOutcome';
import { CostOutcome } from './CostOutcome';
import type { PipelineDefinition } from './deploymentPipelineApi';
import type { Stage } from './pipelineStages';
import { ResourceChanges } from './ResourceChanges';
import type { Rollout } from './rolloutApi';
import { TaskOutcome } from './TaskOutcome';

type Props = {
  stage: Stage;
  rollout: Rollout;
  definition: PipelineDefinition;
  actorLabel?: string;
};

const PlanOutcome = ({ rollout, definition }: Pick<Props, 'rollout' | 'definition'>) => (
  <Flex vertical gap={8}>
    <ResourceChanges
      changes={
        rollout.plan_changes ?? (definition.strategy === 'plan' ? rollout.changes : undefined)
      }
    />
    {rollout.cost && <CostOutcome cost={rollout.cost} />}
  </Flex>
);

const ApplyOutcome = ({ rollout, definition }: Pick<Props, 'rollout' | 'definition'>) => {
  const direct = definition.strategy === 'apply' || definition.strategy === 'destroy';
  const recorded =
    rollout.apply_changes ??
    (direct && rollout.infrastructure_applied ? rollout.changes : undefined);
  return <ResourceChanges changes={recorded} />;
};

export const StepOutcome = (props: Props) => {
  const { stage } = props;
  const pendingBuiltin =
    (stage.id === 'plan' || stage.id === 'apply') &&
    !['Completed', 'Outcome unknown'].includes(stage.status);
  if (pendingBuiltin)
    return (
      <Typography.Text type={'secondary'}>
        {stage.status === 'Running' ? 'Execution in progress' : 'No outcome yet'}
      </Typography.Text>
    );
  switch (stage.id) {
    case 'plan':
      return <PlanOutcome {...props} />;
    case 'apply':
      return <ApplyOutcome {...props} />;
    case 'approval':
      return <ApprovalOutcome {...props} />;
    default:
      return <TaskOutcome {...props} />;
  }
};
