import { useQueryClient } from '@tanstack/react-query';
import { Button, Form, Input, message, Modal, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { FormWithErrorHandling } from '@src/components/shared/ui/FormWithErrorHandling';
import { useAcknowledgeDeploymentOutcome } from '@src/hooks/react-query/v2/controlplane/environment/environment';
import { getListDeploymentQueueItemsQueryKey } from '@src/hooks/react-query/v2/dataplane/deployment/deployment';
import { getAllPagesQueryKey } from '@src/hooks/useFetchAllPages';
import { RBACPermission, useRBACPermissions } from '@src/hooks/useRBAC';
import { DeploymentSummary, EnvironmentFence } from '@src/models/v2/dataplane';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';

interface AcknowledgeOutcomeProps {
  deployment: DeploymentSummary;
  fence: EnvironmentFence;
  environmentUuid?: string;
}

// setTimeout fires immediately for delays beyond a signed 32-bit integer.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

// The Data Plane refuses the acknowledgement until `remedy_available_at`, so the
// action only appears from then on; a missing time means it is accepted at once.
const useRemedyAvailable = (remedyAvailableAt?: string) => {
  const availableAtMs = remedyAvailableAt ? Date.parse(remedyAvailableAt) : 0;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (now >= availableAtMs) return;
    const remaining = Math.max(0, availableAtMs - Date.now());
    const timer = setTimeout(() => setNow(Date.now()), Math.min(remaining, MAX_TIMEOUT_MS));
    return () => clearTimeout(timer);
  }, [availableAtMs, now]);

  return now >= availableAtMs;
};

export const AcknowledgeOutcome = ({
  deployment,
  fence,
  environmentUuid,
}: AcknowledgeOutcomeProps) => {
  const queryClient = useQueryClient();
  const [messageApi, messageContext] = message.useMessage();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{ reason: string }>();
  const acknowledge = useAcknowledgeDeploymentOutcome();

  const check = {
    resource: `env:${environmentUuid}`,
    permission: RBACPermission.DEPLOYMENT_OUTCOME_ACKNOWLEDGE,
  };
  const eligible = Boolean(environmentUuid);
  const permissions = useRBACPermissions(eligible ? [check] : []);
  const available = useRemedyAvailable(fence.remedy_available_at);

  if (!eligible || !permissions.allowed(check)) return null;

  if (!available) {
    return (
      <Typography.Text type={'secondary'}>
        {`Acknowledging becomes available at ${formatDate(fence.remedy_available_at, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE)}.`}
      </Typography.Text>
    );
  }

  const submit = async ({ reason }: { reason: string }) => {
    const result = await acknowledge.mutateAsync({
      orgId: deployment.org_id,
      projectId: deployment.project_id,
      envId: deployment.env_id,
      deploymentId: fence.deployment_id,
      data: { reason: reason.trim() },
    });
    setOpen(false);
    form.resetFields();
    messageApi.success(
      result.replayed
        ? 'This acknowledgement was already recorded.'
        : 'Outcome acknowledged. New Deployments of this Environment can start; requests that were waiting were not started.',
    );
    queryClient.invalidateQueries({
      queryKey: getAllPagesQueryKey(getListDeploymentQueueItemsQueryKey(deployment.org_id)),
    });
  };

  return (
    <>
      {messageContext}
      <Button danger onClick={() => setOpen(true)}>
        {'Acknowledge outcome'}
      </Button>
      <Modal
        open={open}
        title={'Acknowledge the unknown Runner outcome'}
        okText={'Acknowledge outcome'}
        okButtonProps={{ danger: true, loading: acknowledge.isPending }}
        onOk={() => form.submit()}
        onCancel={() => setOpen(false)}
        destroyOnHidden>
        <Typography.Paragraph>
          {
            'Use this only when this failed plugin-dispatched Deployment blocks the Environment (outcome_unreconciled) and you have confirmed that its Runner job can no longer change the Environment, for example because the job was deleted.'
          }
        </Typography.Paragraph>
        <Typography.Paragraph type={'secondary'}>
          {
            'Your name and reason are recorded. The Deployment keeps its status and history, and requests waiting in the queue are not started.'
          }
        </Typography.Paragraph>
        <FormWithErrorHandling form={form} layout={'vertical'} onFinish={submit}>
          <Form.Item
            name={'reason'}
            label={'Reason'}
            rules={[
              {
                required: true,
                whitespace: true,
                message: 'Say why the Runner can no longer change the Environment.',
              },
            ]}>
            <Input.TextArea maxLength={1000} showCount rows={3} />
          </Form.Item>
        </FormWithErrorHandling>
      </Modal>
    </>
  );
};
