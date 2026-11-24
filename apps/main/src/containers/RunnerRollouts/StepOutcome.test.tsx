import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';

import { formatCost } from './CostOutcome';
import type { CostEstimate, Rollout } from './rolloutApi';
import { StepOutcome } from './StepOutcome';

it('formats recorded decimal amounts without rounding through a floating point number', () => {
  expect(formatCost('9007199254740993.123456', 'USD')).toBe('USD 9,007,199,254,740,993.123456');
  expect(formatCost('-0.00000001', 'USD')).toBe('USD −0.00000001');
  expect(formatCost(undefined, 'USD')).toBe('Not available');
  expect(formatCost('1e10', 'USD')).toBe('Not available');
});

it('shows incomplete cost evidence at a saved-plan review gate without presenting it as automatic authorization', () => {
  const cost: CostEstimate = {
    version: 'stellwerk.cost/v1',
    status: 'complete',
    estimator: 'infracost',
    build: 'v0.10',
    currency: 'USD',
    generated_at: '2026-11-17T10:00:00Z',
    after_monthly: '25.00',
  };
  const rollout: Rollout = {
    id: 'apply',
    environment_id: 'env',
    phase: 'awaiting_approval',
    revision: 2,
    created_at: '',
    cost,
  };
  render(
    <StepOutcome
      stage={{
        id: 'approval',
        name: 'Approval',
        phase: 'deployment',
        status: 'Waiting for approval',
      }}
      definition={{
        id: 'recipe',
        version: 1,
        name: 'Reviewed',
        strategy: 'apply_saved',
        intended_strategy: 'reviewed',
        steps: [],
      }}
      rollout={rollout}
    />,
  );
  expect(screen.getByText('Incomplete estimate, human approval required')).toBeVisible();
  expect(screen.getByText('Awaiting a decision')).toBeVisible();
  expect(screen.queryByText(/Approved automatically/)).not.toBeInTheDocument();
});

it.each(['pointer', 'keyboard'] as const)(
  'opens recorded policy and cost evidence with %s interaction',
  async (method) => {
    const rollout: Rollout = {
      id: 'review',
      environment_id: 'env',
      phase: 'awaiting_approval',
      revision: 1,
      created_at: '',
      cost: {
        version: 'stellwerk.cost/v1',
        status: 'partial',
        estimator: 'infracost',
        build: 'v0.10.43',
        currency: 'USD',
        generated_at: '2026-11-17T10:00:00Z',
        reason: 'incomplete_cost_coverage',
      },
    };
    render(
      <>
        <StepOutcome
          stage={{
            id: 'resource-policy',
            name: 'Policy',
            phase: 'plan_check',
            status: 'Completed',
            outcome: {
              verdict: 'allow',
              tool_id: 'resource-policy',
              tool_name: 'Recorded resource policy',
              tool_version: '7',
              meaning: 'Checks delegated resource limits.',
            },
          }}
          definition={{
            id: 'reviewed',
            version: 1,
            name: 'Reviewed',
            strategy: 'reviewed',
            steps: [],
          }}
          rollout={rollout}
        />
        <StepOutcome
          stage={{ id: 'plan', name: 'Plan', phase: 'deployment', status: 'Completed' }}
          definition={{
            id: 'reviewed',
            version: 1,
            name: 'Reviewed',
            strategy: 'reviewed',
            steps: [],
          }}
          rollout={rollout}
        />
      </>,
    );
    const user = userEvent.setup({ skipHover: true });
    const open = async (name: string) => {
      const button = screen.getByRole('button', { name });
      if (method === 'pointer') await user.click(button);
      else {
        await user.tab();
        expect(button).toHaveFocus();
      }
    };
    await open('Policy details');
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Recorded resource policy');
    expect(within(screen.getByRole('tooltip')).getByText('resource-policy · v7')).toBeVisible();
    await open('Estimate details');
    const estimate = (await screen.findAllByRole('tooltip')).find((tooltip) =>
      within(tooltip).queryByText('Estimator: infracost v0.10.43'),
    )!;
    expect(estimate).toHaveTextContent('Some resources have missing or unsupported pricing.');
    expect(estimate).toHaveTextContent('Estimator: infracost v0.10.43');
  },
);
