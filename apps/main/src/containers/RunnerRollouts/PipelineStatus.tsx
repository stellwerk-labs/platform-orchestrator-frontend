import { Tag } from 'antd';

export const pipelinePhaseLabel = (phase: string, applied: boolean) => {
  if (phase === 'post_failed' && applied) return 'Infrastructure applied; post-task failed';
  const labels: Record<string, string> = {
    submitted: 'Accepted',
    accepted: 'Accepted',
    preparing: 'Preparing',
    planning: 'Planning',
    planned: 'Plan created',
    checking: 'Checking plan',
    awaiting_approval: 'Awaiting approval',
    approved: 'Approved',
    applying: 'Applying',
    applied: 'Infrastructure applied',
    post_tasks: 'Running post tasks',
    post_failed: 'Post-task failed',
    post_retrying: 'Retrying post task',
    completed: 'Completed',
    failed: 'Failed',
    refused: 'Refused',
    cancelled: 'Cancelled',
    denied: 'Denied',
    outcome_unknown: 'Outcome unknown',
  };
  return labels[phase] ?? phase;
};

export const PipelineStatus = ({
  phase,
  applied = false,
}: {
  phase: string;
  applied?: boolean;
}) => {
  const color =
    phase === 'completed'
      ? 'success'
      : ['failed', 'refused', 'denied', 'post_failed'].includes(phase)
        ? 'error'
        : ['awaiting_approval', 'outcome_unknown'].includes(phase)
          ? 'warning'
          : 'processing';
  return (
    <Tag color={color} style={{ whiteSpace: 'normal', maxWidth: '100%' }}>
      {pipelinePhaseLabel(phase, applied)}
    </Tag>
  );
};
