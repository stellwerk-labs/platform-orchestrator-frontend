import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { PipelineDefinition } from './deploymentPipelineApi';
import type { Rollout } from './rolloutApi';
import { RolloutDetails } from './RolloutDetails';

const original: Rollout = {
  id: 'rollout-first',
  environment_id: 'environment-first',
  phase: 'awaiting_approval',
  subject: 'saved-plan-subject',
  revision: 7,
  created_at: '2026-11-16T12:00:00Z',
  changes: { add: 1, change: 0, remove: 0 },
  steps: [{ id: 'policy', phase: 'check', status: 'completed' }],
};

const definition: PipelineDefinition = {
  id: 'reviewed',
  version: 1,
  name: 'Reviewed deployment',
  strategy: 'reviewed',
  steps: [],
};

describe('Deployment pipeline review', () => {
  it('confirms the captured rollout and exact-plan subject after selection changes', async () => {
    const action = vi.fn();
    const { rerender } = render(
      <RolloutDetails
        definition={definition}
        rollout={original}
        canWrite
        busy={false}
        unavailable={false}
        action={action}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Approve local plan' }));
    rerender(
      <RolloutDetails
        definition={definition}
        canWrite
        rollout={{ ...original, id: 'rollout-second', subject: 'new-subject' }}
        busy={false}
        unavailable={false}
        action={action}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/saved-plan-subject/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(action).toHaveBeenCalledWith({
      type: 'approve',
      id: 'rollout-first',
      subject: 'saved-plan-subject',
    });
  });

  it('keeps the received phase when projection is unavailable and blocks approval', () => {
    render(
      <RolloutDetails
        definition={definition}
        rollout={original}
        canWrite
        busy={false}
        unavailable
        action={() => undefined}
      />,
    );
    expect(screen.getByText('Awaiting approval')).toBeInTheDocument();
    expect(screen.getByText('Projection unavailable or stale')).toBeInTheDocument();
    expect(screen.getByText(/does not establish execution failure/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve local plan' })).toBeDisabled();
  });

  it('blocks decisions if deployment write permission is revoked during confirmation', async () => {
    const action = vi.fn();
    const { rerender } = render(
      <RolloutDetails
        definition={definition}
        rollout={original}
        canWrite
        busy={false}
        unavailable={false}
        action={action}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Approve local plan' }));
    rerender(
      <RolloutDetails
        definition={definition}
        rollout={original}
        canWrite={false}
        busy={false}
        unavailable={false}
        action={action}
      />,
    );
    expect(screen.getByRole('button', { name: 'Approve local plan' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel deployment' })).toBeDisabled();
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }),
    ).toBeDisabled();
    expect(action).not.toHaveBeenCalled();
  });

  it('repairs only the captured post step and does not offer another apply', async () => {
    const action = vi.fn();
    const { rerender } = render(
      <RolloutDetails
        definition={definition}
        canWrite
        rollout={{ ...original, phase: 'post_failed', failed_step: 'bootstrap' }}
        busy={false}
        unavailable={false}
        action={action}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Approve local plan' })).not.toBeInTheDocument();
    expect(screen.getByText(/Retry only the failed post-task/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Retry failed task' }));
    rerender(
      <RolloutDetails
        definition={definition}
        canWrite
        rollout={{ ...original, id: 'another-run' }}
        busy={false}
        unavailable={false}
        action={action}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/apply step will not be repeated/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(action).toHaveBeenCalledWith({ type: 'repair', id: 'rollout-first', step: 'bootstrap' });
  });

  it('identifies the deliberate demo fault while retaining the real retry mechanism', () => {
    render(
      <RolloutDetails
        definition={{ ...definition, id: 'reviewed-bootstrap' }}
        canWrite
        rollout={{
          ...original,
          phase: 'post_failed',
          failed_step: 'bootstrap-lost-ack',
          infrastructure_applied: true,
        }}
        busy={false}
        unavailable={false}
        action={() => undefined}
      />,
    );
    expect(screen.getByText('Demo: simulated lost acknowledgment')).toBeVisible();
    expect(
      screen.getByText(/This recipe deliberately loses the database task acknowledgment/),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry failed task' })).toBeEnabled();
  });

  it('allows review at a waiting gate even when the last progress event is old', () => {
    render(
      <RolloutDetails
        definition={definition}
        canWrite
        rollout={{ ...original, last_received_at: '2026-01-01T00:00:00Z' }}
        busy={false}
        unavailable={false}
        action={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: 'Approve local plan' })).toBeEnabled();
    expect(screen.queryByText('No recent progress event')).not.toBeInTheDocument();
  });

  it.each(['applying', 'post_tasks', 'post_failed', 'outcome_unknown', 'denied'])(
    'does not offer cancellation after apply admission or a terminal gate: %s',
    (phase) => {
      render(
        <RolloutDetails
          definition={definition}
          canWrite
          rollout={{ ...original, phase }}
          busy={false}
          unavailable={false}
          action={() => undefined}
        />,
      );
      expect(screen.queryByRole('button', { name: 'Cancel deployment' })).not.toBeInTheDocument();
    },
  );

  it('requires explicit cancellation confirmation and explains that effects are not undone', async () => {
    const action = vi.fn();
    render(
      <RolloutDetails
        definition={definition}
        rollout={original}
        canWrite
        busy={false}
        unavailable={false}
        action={action}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel deployment' }));
    expect(action).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/does not undo completed effects/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(action).toHaveBeenCalledWith({ type: 'cancel', id: 'rollout-first' });
  });
});

it('keeps planned and actual counts in their own step outcome and shows the recorded approver', () => {
  render(<RolloutDetails definition={definition} rollout={{...original,phase:'completed',infrastructure_applied:true,plan_changes:{add:3,change:2,remove:1},apply_changes:{add:2,change:1,remove:0},approval_decision:{source:'human',decision:'approve',actor_id:'actor-id',subject:'saved-plan-subject',decided_at:'2026-11-17T12:00:00Z'}}} actorLabel={'Ada Admin'} canWrite busy={false} unavailable={false} action={() => undefined} />);
  const planRow = screen.getByRole('row', {name:/^Plan Completed/});
  const applyRow = screen.getByRole('row', {name:/^Apply saved plan Completed/});
  expect(within(planRow).getByText('3 add')).toBeVisible();
  expect(within(planRow).queryByText('2 add')).not.toBeInTheDocument();
  expect(within(applyRow).getByText('2 add')).toBeVisible();
  expect(screen.getByText('Approved by Ada Admin')).toBeVisible();
});

it('does not relabel an old combined count as both planned and applied', () => {
  render(<RolloutDetails definition={definition} rollout={{...original,phase:'completed',infrastructure_applied:true}} canWrite busy={false} unavailable={false} action={() => undefined} />);
  expect(screen.getAllByText('Change counts were not recorded.')).toHaveLength(2);
  expect(screen.getByText('Approval details were not recorded.')).toBeVisible();
});
