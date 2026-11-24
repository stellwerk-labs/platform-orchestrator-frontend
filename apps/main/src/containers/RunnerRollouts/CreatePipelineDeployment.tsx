import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Flex, Form, Input, Modal, Select, Typography } from 'antd';
import yaml from 'js-yaml';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import { useGetEnvironment } from '@src/hooks/react-query/v2/controlplane/environment/environment';
import { RBACPermission, useRBACPermissions } from '@src/hooks/useRBAC';
import type { DeploymentManifest } from '@src/models/v2/dataplane';

import {
  type CreatePipelineDeployment as CreateRequest,
  createPipelineDeployment,
  deploymentPipelineError,
  listDeploymentPipelines,
} from './deploymentPipelineApi';

const initialManifest = '{\n  "workloads": {}\n}';
type Draft = { manifest: string; pipeline: string; recipient?: string };

export const parseDeploymentManifest = (text: string): DeploymentManifest => {
  const value: unknown = yaml.load(text, { schema: yaml.JSON_SCHEMA });
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('workloads' in value))
    throw new Error('Enter a YAML or JSON manifest object with workloads.');
  return value as DeploymentManifest;
};

export const CreatePipelineDeployment = () => {
  const scope = useParams<keyof MatchParams>() as MatchParams;
  const { orgId, projectId, envId } = scope;
  const navigate = useNavigate();
  const { data: environment } = useGetEnvironment(orgId, projectId, envId);
  const permission = {
    resource: `env:${environment?.uuid}`,
    permission: RBACPermission.DEPLOYMENT_WRITE,
  };
  const permissions = useRBACPermissions(environment?.uuid ? [permission] : []);
  const canWrite = Boolean(environment?.uuid && permissions.allowed(permission));
  const catalogue = useQuery({
    queryKey: ['deployment-pipeline-definitions', orgId, projectId, envId],
    queryFn: () => listDeploymentPipelines(scope),
    retry: false,
  });
  const [mode, setMode] = useState<'deploy' | 'plan_only'>();
  const [form] = Form.useForm<Draft>();
  const selectedPipeline = Form.useWatch('pipeline', form);
  const request = useRef<{ encoded: string; key: string } | undefined>(undefined);
  const create = useMutation({
    mutationFn: ({ body, key }: { body: CreateRequest; key: string }) => {
      if (!canWrite) throw new Error('Deployment write permission is required.');
      return createPipelineDeployment(orgId, body, key);
    },
    onSuccess: (deployment) => {
      request.current = undefined;
      setMode(undefined);
      form.resetFields();
      navigate(
        `/orgs/${orgId}/projects/${projectId}/envs/${envId}/deploys/${deployment.id}/pipeline`,
      );
    },
  });
  const definitions = (nextMode: 'deploy' | 'plan_only' | undefined) =>
    catalogue.data?.items.filter(
      (item) => nextMode !== 'plan_only' || item.id === 'default' || Boolean(item.pipeline_id),
    );
  const submit = (draft: Draft) => {
    try {
      const definition = definitions(mode)?.find((item) => item.id === draft.pipeline);
      if (!definition || !definition.compatible) {
        form.setFields([
          { name: 'pipeline', errors: [definition?.reason || 'Choose a compatible pipeline.'] },
        ]);
        return;
      }
      const body: CreateRequest = {
        project_id: projectId,
        env_id: envId,
        mode: mode ?? 'deploy',
        manifest: parseDeploymentManifest(draft.manifest),
        managed_logs: true,
        when_busy: 'reject',
        ...(draft.recipient ? { encrypted_outputs_recipient: draft.recipient } : {}),
        pipeline: { id: definition.id, version: definition.version },
      };
      const encoded = JSON.stringify(body);
      if (request.current?.encoded !== encoded)
        request.current = { encoded, key: crypto.randomUUID() };
      create.mutate({ body, key: request.current.key });
    } catch (error) {
      form.setFields([{ name: 'manifest', errors: [deploymentPipelineError(error)] }]);
    }
  };
  const open = (nextMode: 'deploy' | 'plan_only') => {
    const selected = form.getFieldValue('pipeline');
    if (!definitions(nextMode)?.some((item) => item.id === selected && item.compatible))
      form.setFieldValue(
        'pipeline',
        catalogue.data?.default_pipeline_id ??
          (catalogue.data?.policy?.enabled ? undefined : 'default'),
      );
    setMode(nextMode);
  };
  const disabled = !canWrite || catalogue.isPending || catalogue.isError;
  return (
    <>
      <Flex justify={'flex-end'} gap={'small'}>
        <Button disabled={disabled} onClick={() => open('plan_only')}>
          Plan
        </Button>
        <Button type={'primary'} disabled={disabled} onClick={() => open('deploy')}>
          Deploy
        </Button>
      </Flex>
      {catalogue.isError && (
        <Alert type={'warning'} showIcon message={'Deployment pipelines could not be loaded.'} />
      )}
      <Modal
        title={mode === 'plan_only' ? 'Plan deployment' : 'Deploy environment'}
        open={Boolean(mode)}
        onCancel={() => setMode(undefined)}
        footer={null}
        width={760}
        modalRender={(dialog) => (
          <div className={'amp-block'} data-amp-mask data-dd-privacy={'hidden'}>
            {dialog}
          </div>
        )}
        closable={!create.isPending}
        maskClosable={!create.isPending}>
        <Form<Draft>
          form={form}
          layout={'vertical'}
          initialValues={{ manifest: initialManifest }}
          onFinish={submit}>
          <Typography.Paragraph>
            {projectId} / {envId}
          </Typography.Paragraph>
          {catalogue.data?.default_source === 'environment' && (
            <Alert
              type={'info'}
              showIcon
              message={'An environment default pipeline is configured.'}
              description={
                'This default is shared by Console and plugin deployments. You may select another allowed pipeline.'
              }
            />
          )}
          {mode === 'plan_only' && (
            <Alert
              type={'info'}
              showIcon
              message={'This plan operation will not apply changes.'}
              description={
                "A later Apply keeps the selected pipeline's required checks, approval and post steps."
              }
            />
          )}
          <Form.Item
            name={'pipeline'}
            label={mode === 'plan_only' ? 'Pipeline for the eventual Apply' : 'Pipeline'}
            rules={[{ required: true, message: 'Choose a compatible published pipeline.' }]}>
            <Select
              disabled={create.isPending}
              placeholder={'Choose a pipeline'}
              options={definitions(mode)?.map((item) => ({
                value: item.id,
                label: `${item.name} · v${item.version}${item.reason ? ` · ${item.reason}` : ''}`,
                disabled: item.compatible === false,
              }))}
            />
          </Form.Item>
          {mode === 'deploy' && selectedPipeline === 'reviewed-bootstrap' && (
            <Alert
              type={'info'}
              showIcon
              message={'Demo: retry a database bootstrap task'}
              description={
                'This recipe deliberately simulates a lost acknowledgment after its database task. Apply runs once. Use Retry failed task to resume the task.'
              }
            />
          )}
          <Form.Item
            label={'Deployment manifest (YAML or JSON)'}
            name={'manifest'}
            rules={[{ required: true }]}>
            <Input.TextArea
              aria-label={'Deployment manifest'}
              rows={11}
              disabled={create.isPending}
            />
          </Form.Item>
          <Form.Item
            label={'Encrypted outputs recipient (optional)'}
            name={'recipient'}
            rules={[{ pattern: /^age[a-z0-9]+$/, message: 'Enter an age recipient public key.' }]}>
            <Input disabled={create.isPending} placeholder={'age1…'} />
          </Form.Item>
          {create.isError && (
            <Alert type={'error'} showIcon message={deploymentPipelineError(create.error)} />
          )}
          <Button
            type={'primary'}
            htmlType={'submit'}
            loading={create.isPending}
            disabled={!canWrite}>
            {mode === 'plan_only' ? 'Run plan' : 'Deploy'}
          </Button>
        </Form>
      </Modal>
    </>
  );
};
