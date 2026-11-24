import { SaveOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { Alert, Button, Card, Flex, Form, Select, Switch, Typography } from 'antd';
import { isEqual } from 'lodash';
import { useState } from 'react';

import { setProjectPipelinePolicy } from '@src/api/pipelines';
import type { PipelinePolicy, PublishedPipelineVersion } from '@src/models/pipelines';

import { EnvironmentPipelineDefaults } from './EnvironmentPipelineDefaults';
import { authoringError } from './pipelineErrors';
import {
  rollbackDefaultsAllowed,
  RollbackPipelineDefaultsEditor,
  rollbackPolicyUpdate,
} from './RollbackPipelineDefaultsEditor';

export const PipelinePolicyEditor = ({
  orgId,
  projectId,
  policy,
  versions,
  canPublish,
  onSaved,
}: {
  orgId: string;
  projectId: string;
  policy: PipelinePolicy;
  versions: PublishedPipelineVersion[];
  canPublish: boolean;
  onSaved: () => void;
}) => {
  const [enabled, setEnabled] = useState(policy.enabled);
  const [allowed, setAllowed] = useState(policy.allowed_version_ids);
  const [defaultId, setDefaultId] = useState(policy.default_version_id);
  const [environmentDefaults, setEnvironmentDefaults] = useState(
    policy.environment_default_version_ids ?? {},
  );
  const [rollbackDefaults, setRollbackDefaults] = useState(policy.rollback_defaults ?? {});
  const mutation = useMutation({
    mutationFn: () => {
      if (!canPublish) throw new Error('Publication permission is required.');
      return setProjectPipelinePolicy(orgId, projectId, {
        expected_resource_version: policy.resource_version,
        enabled,
        allowed_version_ids: enabled ? allowed : [],
        ...rollbackPolicyUpdate(policy, rollbackDefaults, enabled),
        ...(enabled && defaultId ? { default_version_id: defaultId } : {}),
        ...(enabled && Object.keys(environmentDefaults).length
          ? { environment_default_version_ids: environmentDefaults }
          : {}),
      });
    },
    onSuccess: onSaved,
  });
  const options = versions
    .filter((version) => !version.retired_at)
    .map((version) => ({ value: version.id, label: `${version.name} · v${version.version}` }));
  const dirty = !isEqual(
    [enabled, defaultId, allowed, environmentDefaults, rollbackDefaults],
    [
      policy.enabled,
      policy.default_version_id,
      policy.allowed_version_ids,
      policy.environment_default_version_ids ?? {},
      policy.rollback_defaults ?? {},
    ],
  );
  const invalidDefaults = Object.values(environmentDefaults).some((id) => !allowed.includes(id));
  const invalidRollback = !rollbackDefaultsAllowed(rollbackDefaults, allowed);
  return (
    <Card title={'Project deployment policy'}>
      <Flex vertical gap={'small'}>
        <Typography.Paragraph>
          When project policy is on, developers can select only allowed versions and a default is
          required. With policy off, all active published versions are available and the default
          applies directly.
        </Typography.Paragraph>
        {!enabled && (
          <Alert
            type={'info'}
            showIcon
            message={'Built-in deployment behavior is active'}
            description={
              'The default applies directly. All active published versions are also available to developers. A plan runs only when requested explicitly.'
            }
          />
        )}
        {enabled && !defaultId && (
          <Alert
            type={'info'}
            showIcon
            message={'Choose an allowed default version before saving.'}
          />
        )}
        {mutation.isError && (
          <Alert type={'error'} showIcon message={authoringError(mutation.error)} />
        )}
        <Form layout={'vertical'} disabled={!canPublish || mutation.isPending}>
          <Form.Item label={'Use published project pipelines'}>
            <Switch
              aria-label={'Use published project pipelines'}
              checked={enabled}
              onChange={(value) => {
                setEnabled(value);
                if (!value) {
                  setAllowed([]);
                  setDefaultId(undefined);
                  setEnvironmentDefaults({});
                  setRollbackDefaults({});
                }
              }}
            />
          </Form.Item>
          <Form.Item label={'Allowed versions'} htmlFor={'pipeline-allowed'}>
            <Select
              id={'pipeline-allowed'}
              mode={'multiple'}
              disabled={!enabled || !canPublish || mutation.isPending}
              value={allowed}
              onChange={(ids) => {
                setAllowed(ids);
                if (defaultId && !ids.includes(defaultId)) setDefaultId(undefined);
              }}
              options={options}
              placeholder={'Choose published versions'}
            />
          </Form.Item>
          <Form.Item label={'Default version'} required={enabled} htmlFor={'pipeline-default'}>
            <Select
              id={'pipeline-default'}
              allowClear
              disabled={!enabled || !canPublish || mutation.isPending}
              value={defaultId}
              onChange={setDefaultId}
              options={options.filter((option) => allowed.includes(option.value))}
              placeholder={'Choose an allowed default version'}
            />
          </Form.Item>
          {enabled && (
            <>
              <EnvironmentPipelineDefaults
                orgId={orgId}
                projectId={projectId}
                defaults={environmentDefaults}
                versions={versions}
                allowed={allowed}
                disabled={!canPublish || mutation.isPending}
                onChange={setEnvironmentDefaults}
              />
              <RollbackPipelineDefaultsEditor
                supported={policy.rollback_defaults !== undefined}
                orgId={orgId}
                projectId={projectId}
                value={rollbackDefaults}
                versions={versions}
                allowed={allowed}
                disabled={!canPublish || mutation.isPending}
                onChange={setRollbackDefaults}
              />
            </>
          )}
          <Button
            type={'primary'}
            icon={<SaveOutlined aria-hidden />}
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={
              !canPublish ||
              !dirty ||
              (enabled &&
                (allowed.length === 0 || !defaultId || invalidDefaults || invalidRollback))
            }>
            Save deployment policy
          </Button>
        </Form>
        {!canPublish && (
          <Typography.Text type={'secondary'}>
            Changing allowed or default versions requires pipeline publication permission.
          </Typography.Text>
        )}
      </Flex>
    </Card>
  );
};
