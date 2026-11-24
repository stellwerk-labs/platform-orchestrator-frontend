import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, it } from 'vitest';

import { type NativeLogProgress, NativePhaseLogs } from './NativePhaseLogs';

const scope = { orgId: 'org', projectId: 'project', envId: 'env' };
const capture = (revision: number) => ({
  status: 'pending_transfer',
  authority: {
    phase: 'plan' as const,
    execution_id: 'source',
    capture_revision: revision,
    subject: 'child-subject',
    inherited: true,
    source_plan_id: 'source',
  },
});
it('selects the greatest accepted capture regardless of arrival and preserves inherited provenance', () => {
  const progress: NativeLogProgress = { log_references: [capture(2), capture(1)] };
  const { rerender } = render(
    <MemoryRouter>
      <NativePhaseLogs
        scope={scope}
        phase={'plan'}
        progress={progress}
        canRead
        renderLogs={(selection, subject) => (
          <div>
            {selection.captureRevision}:{subject}
          </div>
        )}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText('2:child-subject')).toBeVisible();
  expect(screen.getByRole('link', { name: 'View source Plan logs' })).toHaveAttribute(
    'href',
    expect.stringContaining('source'),
  );
  expect(screen.getByText(/did not execute a new Plan/)).toBeVisible();
  rerender(
    <MemoryRouter>
      <NativePhaseLogs
        scope={scope}
        phase={'plan'}
        progress={progress}
        canRead={false}
        renderLogs={() => <div>PRIVATE LOG CONTENT</div>}
      />
    </MemoryRouter>,
  );
  expect(screen.queryByText('PRIVATE LOG CONTENT')).not.toBeInTheDocument();
});
it('shows finite transfer and capacity availability without claiming execution failure', () => {
  const progress: NativeLogProgress = { log_capture: capture(3), log_references_limited: true };
  render(
    <MemoryRouter>
      <NativePhaseLogs
        scope={scope}
        phase={'plan'}
        progress={progress}
        canRead
        renderLogs={() => <div>PRIVATE LOG CONTENT</div>}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText(/Pending transfer/)).toBeVisible();
  expect(screen.getByText(/Unlisted captures are unavailable/)).toBeVisible();
  expect(screen.queryByText('PRIVATE LOG CONTENT')).not.toBeInTheDocument();
});
