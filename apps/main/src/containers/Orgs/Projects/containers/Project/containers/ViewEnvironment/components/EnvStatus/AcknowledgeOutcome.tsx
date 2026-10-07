import { useQueryClient } from '@tanstack/react-query';
import { Button, Form, Input, message, Modal, Typography } from 'antd';
import { useState } from 'react';

import { FormWithErrorHandling } from '@src/components/shared/ui/FormWithErrorHandling';
import { useAcknowledgeDeploymentOutcome } from '@src/hooks/react-query/v2/controlplane/environment/environment';
import { getListDeploymentQueueItemsQueryKey } from '@src/hooks/react-query/v2/dataplane/deployment/deployment';
import { getAllPagesQueryKey } from '@src/hooks/useFetchAllPages';
import { RBACPermission, useRBACPermissions } from '@src/hooks/useRBAC';
import { DeploymentSummary } from '@src/models/v2/dataplane';

interface AcknowledgeOutcomeProps {
  deployment: DeploymentSummary;
  environmentUuid?: string;
}

// Core exposes no read model for the outcome fence, so the action is offered on
// the failed Environment head and the Data Plane decides whether it applies.
export const AcknowledgeOutcome = ({ deployment, environmentUuid }: AcknowledgeOutcomeProps) => {
  const queryClient = useQueryClient();
  const [messageApi, messageContext] = message.useMessage();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{ reason: string }>();
  const acknowledge = useAcknowledgeDeploymentOutcome();

  const check = {
    resource: `env:${environmentUuid}`,
    permission: RBACPermission.DEPLOYMENT_OUTCOME_ACKNOWLEDGE,
  };
  const eligible = Boolean(environmentUuid) && deployment.status === 'failed';
  const permissions = useRBACPermissions(eligible ? [check] : []);

  if (!eligible || !permissions.allowed(check)) return null;

  const submit = async ({ reason }: { reason: string }) => {
    const result = await acknowledge.mutateAsync({
      orgId: deployment.org_id,
      projectId: deployment.project_id,
      envId: deployment.env_id,
      deploymentId: deployment.id,
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
