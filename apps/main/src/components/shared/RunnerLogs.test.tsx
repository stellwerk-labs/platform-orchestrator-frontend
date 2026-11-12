import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';

import { RunnerLogs } from './RunnerLogs';

it('renders highlighted log payloads as safe text and restores the exact raw content', async () => {
  const content =
    '\n{"@level":"error","@message":"Error: test error","diagnostic":{"detail":"<script>alert(1)</script>","snippet":"first\\nsecond"}}\nplain\n{"partial":';
  render(<RunnerLogs content={content} />);
  expect(screen.getByLabelText('Runner logs')).toHaveTextContent('Error: test error');
  expect(screen.getByLabelText('Runner logs')).toHaveTextContent('<script>alert(1)</script>');
  const viewer = screen.getByLabelText('Runner logs');
  expect(viewer.querySelector('code span')).not.toBeNull();
  expect(viewer.querySelector('script')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Show raw logs' }));
  expect(screen.getByLabelText('Runner logs').textContent).toBe(content);
  await userEvent.click(screen.getByRole('button', { name: 'Show formatted logs' }));
  expect(screen.getByLabelText('Runner logs')).toHaveTextContent('Error: test error');
  expect(screen.getByLabelText('Runner logs')).toHaveTextContent('{"partial":');
});

it.each([
  'x'.repeat(1024 * 1024 + 1),
  '\n'.repeat(2000),
  Array.from({ length: 2000 }, () => '['.repeat(64) + '0' + ']'.repeat(64)).join('\n'),
])('shows large log content in full without constructing formatted rows (%#)', (content) => {
  render(<RunnerLogs content={content} />);
  expect(screen.getByRole('note')).toHaveTextContent('formatting is disabled');
  const viewer = screen.getByLabelText('Runner logs');
  expect(viewer.textContent).toBe(content);
  expect(viewer.querySelectorAll('pre')).toHaveLength(1);
  expect(viewer.querySelector('code')).toBeNull();
});
