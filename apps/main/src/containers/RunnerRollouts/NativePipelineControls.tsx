import { Alert, Button, Flex, Modal, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { useGetCurrentUser } from '@src/hooks/react-query/v2/iam/user/user';

import type {
  DeploymentPipeline,
  PipelineControlAction,
  PipelineControlIntent,
  PipelineControlReceipt,
} from './deploymentPipelineApi';
import { ResourceChanges } from './ResourceChanges';
import { useNativePipelineControl } from './useNativePipelineControl';

type Props = {
  orgId: string;
  id: string;
  pipeline: DeploymentPipeline;
  canWrite: boolean;
  unavailable: boolean;
  onResolved: () => void;
};
const labels: Record<PipelineControlAction, string> = {
  approve: 'Approve local plan',
  deny: 'Deny local plan',
  cancel: 'Cancel deployment',
  repair: 'Retry failed task',
};
const confirmations: Record<PipelineControlAction, string> = {
  approve: 'Approval decision confirmed',
  deny: 'Denial decision confirmed',
  cancel: 'Cancellation state confirmed',
  repair: 'Task retry decision confirmed',
};
const refusals: Record<string, string> = {
  approval_subject_conflict: 'The site is no longer awaiting this exact plan.',
  repair_revision_conflict: 'The failed task occurrence changed. Reload deployment progress.',
  repair_refused: 'The site cannot retry this failed task.',
  effects_require_reconciliation: 'Recorded effects require reconciliation before this action.',
  control_expired: 'The control authority expired before the site accepted this action.',
  control_scope_refused: 'The site refused the captured execution authority.',
  invalid_cost_evidence: 'The site could not verify the recorded cost evidence.',
};

const ControlReceipt = ({ receipt }: { receipt: PipelineControlReceipt }) => {
  const result = receipt.status === 'resolved' ? receipt.result : undefined;
  const refused = result?.outcome === 'refused';
  const safeCode =
    result?.code && Object.prototype.hasOwnProperty.call(refusals, result.code)
      ? result.code
      : undefined;
  return (
    <Alert
      showIcon
      type={!result ? 'info' : refused ? 'warning' : 'success'}
      message={
        !result
          ? 'Request accepted, awaiting site confirmation'
          : refused
            ? 'Control request refused'
            : confirmations[receipt.action]
      }
      description={
        <Flex vertical gap={'small'} aria-live={'polite'}>
          <span>
            {!result
              ? 'Delivery is pending. Expiry or silence does not establish refusal, completion or absence of effects.'
              : refused
                ? (safeCode && refusals[safeCode]) ||
                  'The site refused this control. Reload deployment progress before another decision.'
                : receipt.action === 'cancel'
                  ? 'The site confirmed durable cancellation state and a wake signal. This does not confirm a stopped process or absence of effects.'
                  : 'The site confirmed the control decision. Deployment progress reports the infrastructure outcome.'}
          </span>
          <Typography.Text>{labels[receipt.action]}</Typography.Text>
          <Typography.Text>Deployment: {receipt.deployment_id}</Typography.Text>
          <Typography.Text copyable={{ text: receipt.id }}>Request: {receipt.id}</Typography.Text>
          {safeCode && (
            <Typography.Text code copyable={{ text: safeCode }}>
              {safeCode}
            </Typography.Text>
          )}
        </Flex>
      }
    />
  );
};

const NativeControlActions = ({ actorId, ...props }: Props & { actorId: string }) => {
  const { orgId, id, pipeline, canWrite, unavailable, onResolved } = props;
  const { progress, available_controls: controls = [] } = pipeline;
  const request = useNativePipelineControl(orgId, id, actorId, canWrite, onResolved);
  const [confirmation, setConfirmation] = useState<PipelineControlIntent>();
  useEffect(() => {
    if (!canWrite) setConfirmation(undefined);
  }, [canWrite]);
  const disabled = !canWrite || unavailable || request.busy || request.blocked;
  const changed =
    confirmation &&
    (!controls.includes(confirmation.action) ||
      ((confirmation.action === 'approve' || confirmation.action === 'deny') &&
        confirmation.subject !== progress.subject) ||
      (confirmation.action === 'repair' &&
        (confirmation.failed_step !== progress.failed_step ||
          confirmation.revision !== progress.revision)));
  const prepare = (action: PipelineControlAction) => {
    if ((action === 'approve' || action === 'deny') && progress.subject)
      setConfirmation({ action, subject: progress.subject });
    if (action === 'cancel') setConfirmation({ action });
    if (action === 'repair' && progress.failed_step && Number.isSafeInteger(progress.revision))
      setConfirmation({ action, failed_step: progress.failed_step, revision: progress.revision });
  };
  return (
    <Flex vertical gap={'small'}>
      {canWrite && request.receipt && <ControlReceipt receipt={request.receipt} />}
      {request.error && <Alert type={'warning'} showIcon message={request.error} />}
      {canWrite && request.pending && !request.receipt && (
        <Alert
          type={'warning'}
          showIcon
          message={'Control request is unconfirmed'}
          description={
            'Keep the same request identity when retrying. A lost response does not establish whether it was accepted.'
          }
        />
      )}
      {canWrite && request.blocked && (
        <Button
          disabled={request.busy || unavailable}
          loading={request.busy}
          onClick={request.retry}>
          {request.pending?.receiptId ? 'Check request status' : 'Retry same request'}
        </Button>
      )}
      <Typography.Text type={'secondary'}>
        Actions reflect last observed progress. The site checks the captured authority and current
        execution state; availability does not promise acceptance or immediate delivery.
      </Typography.Text>
      <Flex gap={'small'} wrap>
        {controls.map((action) => (
          <Button
            key={action}
            danger={action === 'deny' || action === 'cancel'}
            type={action === 'approve' ? 'primary' : 'default'}
            disabled={
              disabled ||
              ((action === 'approve' || action === 'deny') && !progress.subject) ||
              (action === 'repair' &&
                (!progress.failed_step ||
                  !Number.isSafeInteger(progress.revision) ||
                  progress.revision < 1))
            }
            onClick={() => prepare(action)}>
            {labels[action]}
          </Button>
        ))}
      </Flex>
      <Modal
        open={Boolean(confirmation)}
        title={'Confirm Native pipeline control'}
        okText={'Send request'}
        okButtonProps={{ disabled: disabled || Boolean(changed) }}
        onCancel={() => setConfirmation(undefined)}
        onOk={() => {
          if (confirmation && !disabled && !changed) request.submit(confirmation);
          setConfirmation(undefined);
        }}>
        <Typography.Paragraph>Deployment: {id}</Typography.Paragraph>
        {confirmation && <Typography.Paragraph>{labels[confirmation.action]}</Typography.Paragraph>}
        {(confirmation?.action === 'approve' || confirmation?.action === 'deny') && (
          <>
            <ResourceChanges changes={progress.plan_changes ?? progress.changes} />
            <Typography.Paragraph>Exact-plan subject: {confirmation.subject}</Typography.Paragraph>
          </>
        )}
        {confirmation?.action === 'cancel' && (
          <Typography.Paragraph>
            Requests durable cancellation and a wake signal. It does not undo completed effects or
            guarantee that a running process stops.
          </Typography.Paragraph>
        )}
        {confirmation?.action === 'repair' && (
          <Typography.Paragraph>
            Retry only {confirmation.failed_step} at observed revision {confirmation.revision}.
            Apply is not repeated.
          </Typography.Paragraph>
        )}
        <Typography.Paragraph>
          Sending accepts a request for delivery. Wait for the site receipt to confirm its decision.
        </Typography.Paragraph>
      </Modal>
    </Flex>
  );
};

export const NativePipelineControls = (props: Props) => {
  const { data: actor } = useGetCurrentUser();
  if (!actor) return <Alert type={'info'} message={'Loading current control identity.'} />;
  return (
    <NativeControlActions
      key={JSON.stringify([props.orgId, props.id, actor.id])}
      {...props}
      actorId={actor.id}
    />
  );
};
