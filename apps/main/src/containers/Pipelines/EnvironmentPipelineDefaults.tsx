import { PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Input, Select, Table, Typography } from 'antd';
import { useState } from 'react';

import {
  getListEnvironmentsQueryKey,
  listEnvironments,
} from '@src/hooks/react-query/v2/controlplane/environment/environment';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import type { PublishedPipelineVersion } from '@src/models/pipelines';

const directionLabels = {
  forward: {
    title: 'Environment defaults',
    search: 'Search default overrides',
    column: 'Default pipeline',
    rowPrefix: 'Default',
    restore: 'Use project default',
    environment: 'Environment for default pipeline',
    pipeline: 'Pipeline for environment default',
    add: 'Add default',
  },
  rollback: {
    title: 'Environment rollback defaults',
    search: 'Search rollback default overrides',
    column: 'Rollback default',
    rowPrefix: 'Rollback',
    restore: 'Use project rollback default',
    environment: 'Environment for rollback pipeline',
    pipeline: 'Pipeline for environment rollback',
    add: 'Add rollback default',
  },
};

export const EnvironmentPipelineDefaults = ({
  orgId,
  projectId,
  defaults,
  versions,
  allowed,
  disabled,
  onChange,
  direction = 'forward',
}: {
  direction?: 'forward' | 'rollback';
  orgId: string;
  projectId: string;
  defaults: Record<string, string>;
  versions: PublishedPipelineVersion[];
  allowed: string[];
  disabled: boolean;
  onChange: (defaults: Record<string, string>) => void;
}) => {
  const labels = directionLabels[direction];
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const environments = useAllPages(
    getAllPagesQueryKey(getListEnvironmentsQueryKey(orgId, projectId)),
    (params) => listEnvironments(orgId, projectId, params),
    undefined,
    { retry: false },
  );
  const [environmentId, setEnvironmentId] = useState<string>();
  const [versionId, setVersionId] = useState<string>();
  const options = versions
    .filter((version) => !version.retired_at && allowed.includes(version.id))
    .map((version) => ({ value: version.id, label: `${version.name} · v${version.version}` }));
  const invalid = Object.values(defaults).some(
    (id) => !options.some((option) => option.value === id),
  );
  return (
    <Flex vertical gap={'small'}>
      <Typography.Title level={5}>{labels.title}</Typography.Title>
      <Typography.Paragraph type={'secondary'}>
        Environments without an override use the project default. Console and plugin deployments use
        the same defaults. Authorized users may choose another allowed version.
      </Typography.Paragraph>
      {environments.isError && (
        <Alert
          type={'warning'}
          showIcon
          message={'Environments could not be loaded. Existing overrides have been kept.'}
        />
      )}
      {invalid && (
        <Alert
          type={'warning'}
          showIcon
          message={
            'Choose an allowed version for each environment, or remove its override before saving.'
          }
        />
      )}
      <Input
        aria-label={labels.search}
        placeholder={'Search environment overrides'}
        allowClear
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
      />
      <Table
        size={'small'}
        rowKey={'environmentId'}
        pagination={{ pageSize: 25, current: page, onChange: setPage, showSizeChanger: false }}
        dataSource={Object.entries(defaults)
          .map(([boundEnvironmentId, boundVersionId]) => ({
            environmentId: boundEnvironmentId,
            versionId: boundVersionId,
          }))
          .filter((row) => {
            const environment = environments.data?.find((item) => item.uuid === row.environmentId);
            return [row.environmentId, environment?.id, environment?.display_name]
              .join(' ')
              .toLowerCase()
              .includes(search.trim().toLowerCase());
          })}
        locale={{
          emptyText: search
            ? 'No overrides match this search.'
            : 'All environments use the project default.',
        }}
        columns={[
          {
            title: 'Environment',
            render: (_, row) => {
              const environment = environments.data?.find(
                (item) => item.uuid === row.environmentId,
              );
              return environment
                ? `${environment.display_name} (${environment.id})`
                : row.environmentId;
            },
          },
          {
            title: labels.column,
            render: (_, row) => (
              <Select
                aria-label={`${labels.rowPrefix} pipeline for ${row.environmentId}`}
                style={{ minWidth: 240 }}
                value={row.versionId}
                disabled={disabled}
                options={options}
                onChange={(id) => onChange({ ...defaults, [row.environmentId]: id })}
              />
            ),
          },
          {
            title: '',
            render: (_, row) => (
              <Button
                disabled={disabled}
                onClick={() => {
                  const next = { ...defaults };
                  delete next[row.environmentId];
                  onChange(next);
                }}>
                {labels.restore}
              </Button>
            ),
          },
        ]}
      />
      <Flex gap={'small'} wrap>
        <Select
          aria-label={labels.environment}
          placeholder={'Choose environment'}
          showSearch
          optionFilterProp={'label'}
          loading={environments.isPending}
          disabled={disabled || environments.isError}
          value={environmentId}
          style={{ minWidth: 240 }}
          options={environments.data
            ?.filter((item) => !(item.uuid in defaults))
            .map((item) => ({ value: item.uuid, label: `${item.display_name} (${item.id})` }))}
          onChange={setEnvironmentId}
        />
        <Select
          aria-label={labels.pipeline}
          placeholder={'Choose allowed pipeline'}
          disabled={disabled}
          style={{ minWidth: 240 }}
          options={options}
          value={versionId}
          onChange={setVersionId}
        />
        <Button
          icon={<PlusOutlined aria-hidden />}
          disabled={
            disabled || !environmentId || !options.some((option) => option.value === versionId)
          }
          onClick={() => {
            if (!environmentId || !versionId) return;
            onChange({ ...defaults, [environmentId]: versionId });
            setEnvironmentId(undefined);
            setVersionId(undefined);
          }}>
          {labels.add}
        </Button>
      </Flex>
    </Flex>
  );
};
