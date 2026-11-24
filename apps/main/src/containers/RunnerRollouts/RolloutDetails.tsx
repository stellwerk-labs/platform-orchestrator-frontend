import { ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Descriptions, Flex, Modal, Table, Typography } from 'antd';
import { useState } from 'react';

import type { PipelineDefinition } from './deploymentPipelineApi';
import { pipelineStages } from './pipelineStages';
import { PipelineStatus } from './PipelineStatus';
import { ResourceChanges } from './ResourceChanges';
import type { Rollout } from './rolloutApi';
import { StepOutcome } from './StepOutcome';

export type RolloutAction =
  | { type: 'approve'; id: string; subject: string }
  | { type: 'cancel'; id: string }
  | { type: 'repair'; id: string; step: string };

const terminal = new Set([
  'completed',
  'failed',
  'cancelled',
  'outcome_unknown',
  'denied',
  'refused',
]);
const cancellable = new Set([
  'submitted',
  'accepted',
  'pending',
  'preparing',
  'planning',
  'checking',
  'awaiting_approval',
  'approved',
]);
const waiting = new Set(['awaiting_approval', 'post_failed']);
const errors: Record<string, string> = {
  check_denied: 'A required check refused this plan.',
  approval_policy_denied: 'The plan exceeds the delegated policy bounds.',
  apply_outcome_unknown: 'Apply may have taken effect. Reconcile it before running it again.',
  task_outcome_unknown: 'A task may have taken effect. Reconcile it before running it again.',
  task_failed: 'A local task failed. Inspect its recorded step outcome.',
  plan_failed: 'The local plan failed.',
  command_expired: 'The delegated rollout authority expired.',
  approval_wait_expired: 'The local approval wait expired.',
  unknown_outcome: 'An operation may have taken effect. Reconcile it before running it again.',
  environment_busy: 'Another rollout owns this environment.',
  expired: 'The delegated rollout authority expired.',
  deployment_base_changed: 'The environment changed after planning.',
};

export const RolloutDetails = ({
  rollout,
  definition,
  unavailable,
  busy,
  canWrite,
  action,
  actorLabel,
  localActions = true,
}: {
  rollout: Rollout;
  definition: PipelineDefinition;
  unavailable: boolean;
  busy: boolean;
  canWrite: boolean;
  action: (request: RolloutAction) => void;
  actorLabel?: string;
  localActions?: boolean;
}) => {
  const [confirmation, setConfirmation] = useState<RolloutAction>();
  const lastReceived = rollout.last_received_at;
  const stale = Boolean(
    lastReceived &&
    !terminal.has(rollout.phase) &&
    !waiting.has(rollout.phase) &&
    Date.now() - Date.parse(lastReceived) > 15_000,
  );
  const approve = () => {
    if (rollout.subject)
      setConfirmation({ type: 'approve', id: rollout.id, subject: rollout.subject });
  };
  return (
    <Flex vertical gap={'middle'}>
      {(unavailable || stale) && (
        <Alert
          type={'warning'}
          showIcon
          message={unavailable ? 'Projection unavailable or stale' : 'No recent progress event'}
          description={
            'The Runner may still be progressing. This view does not establish execution failure.'
          }
        />
      )}
      <Descriptions column={2} size={'small'}>
        <Descriptions.Item label={'Pipeline'}>{definition.name}</Descriptions.Item>
        <Descriptions.Item label={'Version'}>{definition.version}</Descriptions.Item>
        <Descriptions.Item label={'Execution'}>
          <PipelineStatus phase={rollout.phase} applied={rollout.infrastructure_applied} />
        </Descriptions.Item>
        <Descriptions.Item label={'Last received'}>
          {lastReceived ? new Date(lastReceived).toLocaleString() : 'Not reported'}
        </Descriptions.Item>
      </Descriptions>
      {rollout.infrastructure_applied && rollout.phase !== 'completed' && (
        <Alert
          type={'warning'}
          showIcon
          message={'Infrastructure has been applied'}
          description={
            'Required post tasks are still pending. Deployment settlement and effective resource history update after the pipeline finishes.'
          }
        />
      )}
      {definition.id === 'reviewed-bootstrap' && (
        <Alert
          type={'info'}
          showIcon
          message={'Demo: simulated lost acknowledgment'}
          description={
            'This recipe deliberately loses the database task acknowledgment. Retry failed task resumes only that task. Apply is not repeated.'
          }
        />
      )}
      {(rollout.error_code || rollout.phase === 'post_failed') && (
        <Alert
          type={'error'}
          showIcon
          message={
            (rollout.error_code && errors[rollout.error_code]) ||
            'The pipeline stopped. Inspect its recorded outcome.'
          }
          description={
            <Flex vertical gap={'small'}>
              {rollout.phase === 'post_failed' && (
                <span>
                  Retry only the failed post-task. Infrastructure is already applied; Apply will not
                  run again.
                </span>
              )}
              <Typography.Text type={'secondary'} code>
                {rollout.error_code}
              </Typography.Text>
            </Flex>
          }
          action={
            localActions && rollout.phase === 'post_failed' && rollout.failed_step ? (
              <Button
                icon={<ReloadOutlined aria-hidden />}
                disabled={!canWrite || busy || unavailable}
                onClick={() =>
                  setConfirmation({ type: 'repair', id: rollout.id, step: rollout.failed_step! })
                }>
                Retry failed task
              </Button>
            ) : undefined
          }
        />
      )}
      {rollout.subject && (
        <Typography.Text copyable={{ text: rollout.subject }}>
          Exact-plan subject: {rollout.subject}
        </Typography.Text>
      )}
      <Table
        size={'small'}
        pagination={false}
        rowKey={'id'}
        dataSource={pipelineStages({
          definition,
          progress: { ...rollout, infrastructure_applied: rollout.infrastructure_applied ?? false },
        })}
        columns={[
          { title: 'Step', dataIndex: 'name' },

          { title: 'Status', dataIndex: 'status' },
          {
            title: 'Outcome',
            render: (_, stage) => (
              <StepOutcome
                stage={stage}
                rollout={rollout}
                definition={definition}
                actorLabel={actorLabel}
              />
            ),
          },
        ]}
        locale={{ emptyText: 'No task results received' }}
      />
      <Flex gap={'small'} wrap>
        {localActions && rollout.phase === 'awaiting_approval' && (
          <Button
            type={'primary'}
            disabled={!canWrite || !rollout.subject || busy || unavailable}
            onClick={approve}>
            Approve local plan
          </Button>
        )}
        {localActions && cancellable.has(rollout.phase) && (
          <Button
            danger
            disabled={!canWrite || busy || unavailable}
            onClick={() => setConfirmation({ type: 'cancel', id: rollout.id })}>
            Cancel deployment
          </Button>
        )}
      </Flex>
      <Modal
        open={Boolean(confirmation)}
        title={
          confirmation?.type === 'approve'
            ? 'Approve this exact local plan?'
            : 'Confirm deployment action'
        }
        okText={'Confirm'}
        confirmLoading={busy}
        okButtonProps={{ disabled: !canWrite || busy || unavailable }}
        onCancel={() => setConfirmation(undefined)}
        onOk={() => {
          if (confirmation && canWrite && !busy && !unavailable) action(confirmation);
          setConfirmation(undefined);
        }}>
        <Typography.Paragraph>Deployment: {confirmation?.id}</Typography.Paragraph>
        {confirmation?.type === 'approve' && (
          <ResourceChanges changes={rollout.plan_changes ?? rollout.changes} />
        )}
        {confirmation?.type === 'approve' && (
          <Typography.Paragraph>
            This authorizes the saved plan with subject {confirmation.subject}. The Runner continues
            locally after approval.
          </Typography.Paragraph>
        )}
        {confirmation?.type === 'cancel' && (
          <Typography.Paragraph>
            Cancellation requests a stop. It does not undo completed effects.
          </Typography.Paragraph>
        )}
        {confirmation?.type === 'repair' && (
          <Typography.Paragraph>
            Retry only {confirmation.step}. The apply step will not be repeated.
          </Typography.Paragraph>
        )}
      </Modal>
    </Flex>
  );
};
