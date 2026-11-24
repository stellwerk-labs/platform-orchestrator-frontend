import { Alert, Form, Select, Typography } from 'antd';

import type {
  PipelinePolicy,
  PipelineRollbackDefaults,
  PublishedPipelineVersion,
} from '@src/models/pipelines';

import { EnvironmentPipelineDefaults } from './EnvironmentPipelineDefaults';

export const rollbackPolicyUpdate = (
  policy: PipelinePolicy,
  value: PipelineRollbackDefaults,
  enabled: boolean,
) => {
  if (policy.rollback_defaults === undefined) return {};
  return { rollback_defaults: enabled ? value : {} };
};

export const rollbackDefaultsAllowed = (value: PipelineRollbackDefaults, allowed: string[]) =>
  [value.default_version_id, ...Object.values(value.environment_default_version_ids ?? {})].every(
    (id) => !id || allowed.includes(id),
  );

export const RollbackPipelineDefaultsEditor = ({
  supported,
  orgId,
  projectId,
  value,
  versions,
  allowed,
  disabled,
  onChange,
}: {
  supported: boolean;
  orgId: string;
  projectId: string;
  value: PipelineRollbackDefaults;
  versions: PublishedPipelineVersion[];
  allowed: string[];
  disabled: boolean;
  onChange: (value: PipelineRollbackDefaults) => void;
}) => {
  if (!supported) return null;
  const invalid = !!value.default_version_id && !allowed.includes(value.default_version_id);
  return (
    <>
      <Form.Item label={'Rollback default version'} htmlFor={'pipeline-rollback-default'}>
        <Select
          id={'pipeline-rollback-default'}
          allowClear
          showSearch
          optionFilterProp={'label'}
          value={value.default_version_id}
          disabled={disabled}
          options={versions
            .filter((version) => !version.retired_at && allowed.includes(version.id))
            .map((version) => ({
              value: version.id,
              label: `${version.name} · v${version.version}`,
            }))}
          placeholder={'Choose an allowed rollback default'}
          onChange={(id) => onChange({ ...value, default_version_id: id })}
        />
      </Form.Item>
      {invalid && (
        <Alert
          type={'warning'}
          showIcon
          message={'Choose an allowed rollback default or clear it before saving.'}
        />
      )}
      <Typography.Paragraph type={'secondary'}>
        Rollbacks use this separate default, never the forward default. Without a rollback default,
        a rollout needs a custom rollback selection or an explicit forward-only decision.
      </Typography.Paragraph>
      <EnvironmentPipelineDefaults
        orgId={orgId}
        projectId={projectId}
        direction={'rollback'}
        defaults={value.environment_default_version_ids ?? {}}
        versions={versions}
        allowed={allowed}
        disabled={disabled}
        onChange={(defaults) => onChange({ ...value, environment_default_version_ids: defaults })}
      />
    </>
  );
};
