import { describe, expect, it } from 'vitest';

import { type DeploymentPipeline, executionHasStarted } from './deploymentPipelineApi';
import { pipelineStages } from './pipelineStages';
import { pipelinePhaseLabel } from './PipelineStatus';

const execution: DeploymentPipeline = {
  definition: { id: 'default', version: 1, name: 'Default', strategy: 'apply', steps: [] },
  progress: {
    id: 'deployment',
    environment_id: 'env',
    phase: 'applying',
    revision: 2,
    created_at: '2026-11-17T12:00:00Z',
    infrastructure_applied: false,
  },
};

describe('canonical pipeline steps', () => {
  it('shows only Apply in the default recipe, without a plan or approval gate', () => {
    expect(pipelineStages(execution)).toEqual([
      { id: 'apply', name: 'Apply', phase: 'deployment', status: 'Running' },
    ]);
  });

  it('keeps explicit manual Plan separate from Apply', () => {
    const rows = pipelineStages({
      ...execution,
      definition: { ...execution.definition, strategy: 'plan' },
      progress: { ...execution.progress, phase: 'completed' },
    });
    expect(rows.map((row) => row.name)).toEqual(['Plan']);
    expect(rows[0]?.status).toBe('Completed');
  });

  it('shows one saved Apply without inventing a new Plan or approval step', () => {
    const rows = pipelineStages({
      ...execution,
      definition: { ...execution.definition, strategy: 'apply_saved' },
    });
    expect(rows.map((row) => row.name)).toEqual(['Apply saved plan']);
  });

  it.each([
    ['plan', 'completed', false],
    ['reviewed', 'awaiting_approval', false],
    ['reviewed', 'post_failed', true],
    ['apply_saved', 'applying', true],
    ['apply', 'outcome_unknown', true],
  ] as const)(
    'offers execution logs only after execution: %s / %s',
    (strategy, phase, expected) => {
      expect(
        executionHasStarted({
          ...execution,
          definition: { ...execution.definition, strategy },
          progress: { ...execution.progress, phase },
        }),
      ).toBe(expected);
    },
  );

  it('preserves applied infrastructure when a required post task needs repair', () => {
    const rows = pipelineStages({
      definition: {
        ...execution.definition,
        strategy: 'reviewed',
        steps: [{ id: 'bootstrap', tool_id: 'bootstrap', phase: 'post_apply', parameters: {} }],
      },
      progress: {
        ...execution.progress,
        phase: 'post_failed',
        infrastructure_applied: true,
        failed_step: 'bootstrap',
        steps: [{ id: 'bootstrap', phase: 'post_apply', status: 'failed', code: 'task_failed' }],
      },
    });
    expect(rows.find((row) => row.id === 'apply')?.status).toBe('Completed');
    expect(rows.find((row) => row.id === 'bootstrap')).toMatchObject({
      status: 'failed',
      code: 'task_failed',
    });
    expect(pipelinePhaseLabel('post_failed', true)).toBe(
      'Infrastructure applied; post-task failed',
    );
  });

  it('identifies the failed post task when no step receipt was reported', () => {
    const rows = pipelineStages({
      definition: {
        ...execution.definition,
        steps: [
          { id: 'bootstrap', tool_id: 'bootstrap', phase: 'post_apply', parameters: {} },
          { id: 'notify', tool_id: 'notify', phase: 'post_apply', parameters: {} },
        ],
      },
      progress: {
        ...execution.progress,
        phase: 'post_failed',
        infrastructure_applied: true,
        failed_step: 'bootstrap',
        error_code: 'task_failed',
      },
    });
    expect(rows.find((row) => row.id === 'bootstrap')).toMatchObject({
      status: 'Failed',
      code: 'task_failed',
    });
    expect(rows.find((row) => row.id === 'notify')?.status).toBe('Not reported');
    expect(rows.find((row) => row.id === 'apply')?.status).toBe('Completed');
  });

  it('does not claim completion for an unknown apply outcome', () => {
    const rows = pipelineStages({
      ...execution,
      progress: { ...execution.progress, phase: 'outcome_unknown' },
    });
    expect(rows[0]?.status).toBe('Outcome unknown');
  });
});

it('preserves required checks and approval when applying a saved reviewed recipe without inventing a new Plan step', () => {
  const stages = pipelineStages({
    definition: {
      id: 'version-id',
      version: 2,
      name: 'Reviewed',
      strategy: 'apply_saved',
      intended_strategy: 'reviewed',
      steps: [{ id: 'policy', tool_id: 'resource-policy', phase: 'plan_check', parameters: {} }],
    },
    progress: {
      id: 'child',
      environment_id: 'env',
      revision: 1,
      created_at: '',
      phase: 'awaiting_approval',
      infrastructure_applied: false,
      subject: 'exact-plan',
    },
  });
  expect(stages.map((stage) => stage.id)).toEqual(['policy', 'approval', 'apply']);
});
