import { CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Button, Flex, Popover, Tag, Typography } from 'antd';

import type { PipelineDefinition } from './deploymentPipelineApi';
import type { Stage } from './pipelineStages';

const failedStatuses = new Set([
  'failed',
  'Failed',
  'Stopped',
  'Outcome unknown',
  'denied',
  'refused',
]);
const successStatuses = new Set(['Completed', 'ok']);
const taskVerdict = (stage: Stage, toolId?: string) => {
  if (stage.outcome?.verdict === 'deny') return 'Denied';
  if (failedStatuses.has(stage.status)) return 'Failed';
  if (toolId === 'validate-manifest') return 'Valid';
  if (stage.phase === 'plan_check') return 'Allowed';
  return 'Succeeded';
};

const PolicyDetails = ({ stage }: { stage: Stage }) => (
  <Popover
    trigger={['click', 'focus']}
    title={stage.outcome?.tool_name || 'Policy details'}
    content={
      <Flex vertical gap={4} style={{ maxWidth: 440 }}>
        <span>{stage.outcome?.meaning || 'Historical policy details were not recorded.'}</span>
        <span>
          {stage.outcome?.tool_id || stage.id}
          {stage.outcome?.tool_version ? ` · v${stage.outcome.tool_version}` : ''}
        </span>
      </Flex>
    }>
    <Button type={'link'} size={'small'} icon={<InfoCircleOutlined aria-hidden />}>
      Policy details
    </Button>
  </Popover>
);

const TaskEvidence = ({ stage, toolId }: { stage: Stage; toolId?: string }) => {
  const outcome = stage.outcome;
  const policy = stage.phase === 'plan_check';
  return (
    <>
      {outcome?.meaning && <Typography.Text>{outcome.meaning}</Typography.Text>}
      {policy && outcome?.tool_id && (
        <Typography.Text type={'secondary'}>
          {outcome.tool_name || outcome.tool_id}
          {outcome.tool_version ? ` · v${outcome.tool_version}` : ''}
        </Typography.Text>
      )}
      {policy && toolId && <PolicyDetails stage={stage} />}
    </>
  );
};

export const TaskOutcome = ({
  stage,
  definition,
}: {
  stage: Stage;
  definition: PipelineDefinition;
}) => {
  const failed = failedStatuses.has(stage.status) || stage.outcome?.verdict === 'deny';
  const finished = failed || successStatuses.has(stage.status);
  const toolId =
    stage.outcome?.tool_id ?? definition.steps.find((step) => step.id === stage.id)?.tool_id;
  return (
    <Flex vertical gap={4} align={'start'}>
      {finished && (
        <Tag
          icon={failed ? <CloseCircleOutlined aria-hidden /> : <CheckCircleOutlined aria-hidden />}
          color={failed ? 'error' : 'success'}>
          {taskVerdict(stage, toolId)}
        </Tag>
      )}
      <TaskEvidence stage={stage} toolId={toolId} />
      {stage.code && (
        <Typography.Text type={'secondary'} code>
          {stage.code}
        </Typography.Text>
      )}
      {!finished && (
        <Typography.Text type={'secondary'}>
          {stage.status === 'Not reported' ? 'No outcome reported yet' : stage.status}
        </Typography.Text>
      )}
    </Flex>
  );
};
