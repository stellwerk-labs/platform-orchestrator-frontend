import type { DeploymentPipeline, PipelineDefinition } from './deploymentPipelineApi';
import type { RolloutStep } from './rolloutApi';

type Progress = DeploymentPipeline['progress'];
export type Stage = {
  id: string;
  name: string;
  phase: string;
  status: string;
  code?: string;
  outcome?: RolloutStep['outcome'];
};
const planned = new Set([
  'planned',
  'checking',
  'awaiting_approval',
  'approved',
  'applying',
  'applied',
  'post_tasks',
  'post_failed',
  'post_retrying',
  'completed',
]);
const applied = new Set(['applied', 'post_tasks', 'post_failed', 'post_retrying', 'completed']);

const approved = new Set([...applied, 'approved', 'applying']);
const stopped = new Set(['failed', 'cancelled', 'denied', 'refused']);
const activeStages: Record<string, { id: string; status: string }> = {
  planning: { id: 'plan', status: 'Running' },
  awaiting_approval: { id: 'approval', status: 'Waiting for approval' },
  applying: { id: 'apply', status: 'Running' },
};
const completedStatus = { plan: 'Completed', approval: 'Approved', apply: 'Completed' };

const builtinStage = (
  id: 'plan' | 'approval' | 'apply',
  name: string,
  progress: Progress,
): Stage => {
  const complete = {
    plan: Boolean(progress.subject) || planned.has(progress.phase),
    approval: approved.has(progress.phase),
    apply: progress.infrastructure_applied || applied.has(progress.phase),
  };
  let status = stopped.has(progress.phase) ? 'Stopped' : 'Pending';
  if (complete[id]) status = completedStatus[id];
  else if (activeStages[progress.phase]?.id === id) status = activeStages[progress.phase]!.status;
  else if (progress.phase === 'outcome_unknown' && id === 'apply') status = 'Outcome unknown';
  return { id, name, phase: 'deployment', status };
};

const taskStages = (definition: PipelineDefinition, progress: Progress, phase: string): Stage[] =>
  (definition.steps ?? [])
    .filter((step) => step.phase === phase)
    .map((step) => {
      const result = progress.steps?.find((item) => item.id === step.id);
      const failed = progress.phase === 'post_failed' && progress.failed_step === step.id;
      return {
        id: step.id,
        name: step.id,
        phase,
        status:
          result?.status === 'ok'
            ? 'Completed'
            : (result?.status ?? (failed ? 'Failed' : 'Not reported')),
        code: result?.code ?? (failed ? progress.error_code : undefined),
        outcome: result?.outcome,
      };
    });

export const pipelineStages = ({ definition, progress }: DeploymentPipeline): Stage[] => {
  const before = taskStages(definition, progress, 'pre_plan');
  if (definition.strategy === 'plan') return [...before, builtinStage('plan', 'Plan', progress)];
  const reviewed =
    definition.strategy === 'reviewed' ||
    (definition.strategy === 'apply_saved' && definition.intended_strategy === 'reviewed');
  const execution = [
    ...(definition.strategy === 'reviewed' ? [builtinStage('plan', 'Plan', progress)] : []),
    ...(reviewed
      ? [
          ...taskStages(definition, progress, 'plan_check'),
          builtinStage('approval', 'Approval', progress),
        ]
      : []),
    builtinStage(
      'apply',
      definition.strategy === 'destroy'
        ? 'Destroy'
        : reviewed || definition.strategy === 'apply_saved'
          ? 'Apply saved plan'
          : 'Apply',
      progress,
    ),
  ];
  return [...before, ...execution, ...taskStages(definition, progress, 'post_apply')];
};
