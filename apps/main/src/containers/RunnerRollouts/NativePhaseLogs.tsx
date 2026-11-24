import { Alert, Select, Space } from 'antd';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router';

import { generateDeploymentUrl } from '@src/utilities/navigation';

import type { RolloutScope } from './rolloutApi';

export type NativeLogSelection = { executionId?: string; captureRevision?: number };
type Capture = {
  status: string;
  authority: {
    phase: 'plan' | 'apply';
    execution_id: string;
    capture_revision: number;
    subject?: string;
    inherited?: boolean;
    source_plan_id?: string;
  };
};
export type NativeLogProgress = {
  subject?: string;
  log_capture?: Capture;
  log_references?: Capture[];
  log_references_limited?: boolean;
};

const captureKey = ({ authority }: Capture) =>
  JSON.stringify([authority.execution_id, authority.capture_revision]);

export const NativePhaseLogs = ({
  scope,
  phase,
  progress,
  canRead,
  renderLogs,
}: {
  scope: RolloutScope;
  phase: 'plan' | 'apply';
  progress: NativeLogProgress;
  canRead: boolean;
  renderLogs: (selection: NativeLogSelection, subject: string) => ReactNode;
}) => {
  const [requested, setRequested] = useState<string>();
  const references = (progress.log_references ?? [])
    .filter((entry) => entry.authority.phase === phase)
    .sort((a, b) => b.authority.capture_revision - a.authority.capture_revision);
  const selected = references.find((entry) => captureKey(entry) === requested) ?? references[0];
  const capture =
    selected ??
    (progress.log_capture?.authority.phase === phase ? progress.log_capture : undefined);
  const status = selected ? 'available' : (capture?.status ?? 'not_captured');
  const messages: Record<string, string> = {
    available: 'Available. The retained encrypted artifact can be read without a connected Runner.',
    pending_transfer:
      'Pending transfer. The Runner has captured logs; the encrypted artifact has not arrived yet.',
    log_export_too_large: 'Too large. The captured output exceeds the central log export limit.',
    log_export_not_managed:
      'Unavailable. This command has no retained managed central log recipient.',
    log_export_unavailable: 'Unavailable. Central log export could not be prepared.',
    not_captured: 'Logs have not been captured for this phase.',
  };
  const authority = capture?.authority;
  return (
    <Space direction={'vertical'} style={{ width: '100%' }}>
      <Alert
        type={selected ? 'success' : 'info'}
        showIcon
        message={messages[status] ?? 'Logs unavailable.'}
      />
      {progress.log_references_limited && (
        <Alert
          type={'warning'}
          message={
            'The retained reference limit was reached. Unlisted captures are unavailable; existing captures remain readable.'
          }
        />
      )}
      {references.length > 1 && (
        <Select
          aria-label={'Log capture'}
          value={selected && captureKey(selected)}
          onChange={setRequested}
          options={references.map((entry) => ({
            value: captureKey(entry),
            label: `${entry.authority.execution_id}, capture ${entry.authority.capture_revision}`,
          }))}
        />
      )}
      {authority?.inherited && authority.source_plan_id && (
        <Alert
          type={'info'}
          message={'Inherited Plan logs. This deployment did not execute a new Plan.'}
          action={
            <Link
              to={`${generateDeploymentUrl(scope.orgId, scope.projectId, scope.envId, authority.source_plan_id, 'logs')}?log=plan`}>
              View source Plan logs
            </Link>
          }
        />
      )}
      {canRead &&
        selected &&
        renderLogs(
          {
            executionId: selected.authority.execution_id,
            captureRevision: selected.authority.capture_revision,
          },
          selected.authority.subject ?? '',
        )}
    </Space>
  );
};
