import { Alert, Button, Card, Flex, Form, Input, InputNumber, Select, Tag, Typography } from 'antd';
import { useState } from 'react';

import type {
  NativeAgentRunnerConfigurationUpdateBody,
  StateStorageConfiguration,
} from '@src/models/v2/controlplane';

import schemas from './nativeRunnerSchemas.json';
import type { NativeRunnerEditorValues } from './useNativeRunnerDocument';

const backends = {
  kubernetes: { namespace: 'Namespace' },
  s3: { bucket: 'Bucket', path_prefix: 'Path prefix (optional)' },
  gcs: { bucket: 'Bucket', path_prefix: 'Path prefix (optional)' },
  azurerm: {
    storage_account_name: 'Storage account',
    container_name: 'Container',
    resource_group_name: 'Resource group (optional)',
    path_prefix: 'Path prefix (optional)',
  },
};

const InventoryFields = ({
  configuration,
  disabled,
  onImport,
}: {
  configuration: NativeAgentRunnerConfigurationUpdateBody;
  disabled: boolean;
  onImport: (source: string) => boolean;
}) => {
  const [inventorySource, setInventorySource] = useState('');
  return (
    <Card title={'Approved public inventory'} size={'small'} style={{ marginBottom: 24 }}>
      <Flex vertical gap={'small'}>
        <Tag color={configuration.native_execution ? 'green' : undefined}>
          {configuration.native_execution
            ? `${configuration.native_execution.tools.length} approved tools`
            : 'Inventory absent, native admission disabled'}
        </Tag>
        {configuration.native_execution && (
          <Typography.Text copyable code>
            {configuration.native_execution.tools_digest}
          </Typography.Text>
        )}
        <Alert
          type={'info'}
          showIcon
          message={'Import the public catalogue exported by the installed Runner.'}
          description={
            'This replaces inventory, supported protocols and capabilities together. Keep the opaque digest unchanged. Private runtime configuration, executable paths and credentials do not belong here.'
          }
        />
        <Input.TextArea
          aria-label={'Public Runner catalogue export'}
          rows={6}
          value={inventorySource}
          onChange={(event) => setInventorySource(event.target.value)}
          placeholder={'Paste the public JSON or YAML export'}
        />
        <Button
          disabled={disabled || !inventorySource.trim()}
          onClick={() => {
            if (onImport(inventorySource)) setInventorySource('');
          }}>
          Use public catalogue
        </Button>
      </Flex>
    </Card>
  );
};

const StorageFields = ({
  storage,
  create,
  onChange,
}: {
  storage: StateStorageConfiguration | undefined;
  create: boolean;
  onChange: (storage: StateStorageConfiguration) => void;
}) => {
  const fields = backends[storage?.type as keyof typeof backends] ?? {};
  const changeStorage = (changes: Record<string, string>) =>
    onChange({ ...storage, ...changes } as StateStorageConfiguration);
  return (
    <>
      <Form.Item label={'State backend'} required={create}>
        <Select
          aria-label={'Runner state backend'}
          value={storage?.type}
          placeholder={'Choose the site state backend'}
          options={Object.keys(backends).map((type) => ({ label: type, value: type }))}
          onChange={(type) => onChange({ type } as StateStorageConfiguration)}
        />
      </Form.Item>
      {Object.entries(fields).map(([field, label]) => (
        <Form.Item key={field} label={label}>
          <Input
            aria-label={label}
            value={(storage as unknown as Record<string, string> | undefined)?.[field] ?? ''}
            onChange={(event) => changeStorage({ [field]: event.target.value })}
          />
        </Form.Item>
      ))}
    </>
  );
};

export const NativeRunnerForm = ({
  values,
  create,
  disabled,
  onChange,
  onImport,
}: {
  values: NativeRunnerEditorValues;
  create: boolean;
  disabled: boolean;
  onChange: (values: NativeRunnerEditorValues) => void;
  onImport: (source: string) => boolean;
}) => {
  const configuration = values.runner_configuration ?? { type: 'native-agent' };
  const changeConfiguration = (changes: Partial<NativeAgentRunnerConfigurationUpdateBody>) =>
    onChange({
      ...values,
      runner_configuration: { ...configuration, ...changes, type: 'native-agent' },
    });
  return (
    <Form layout={'vertical'} disabled={disabled}>
      {create && (
        <Form.Item
          label={'Runner ID'}
          required
          extra={`2 to ${schemas.create.properties.id.maxLength} lowercase letters, digits, underscores or hyphens, starting with a letter.`}>
          <Input
            aria-label={'Runner ID'}
            count={{ show: true, max: schemas.create.properties.id.maxLength }}
            value={values.id ?? ''}
            onChange={(event) => onChange({ ...values, id: event.target.value })}
          />
        </Form.Item>
      )}
      <Form.Item label={'Description'}>
        <Input
          aria-label={'Runner description'}
          value={values.description ?? ''}
          onChange={(event) => onChange({ ...values, description: event.target.value })}
        />
      </Form.Item>
      <Form.Item label={'Public Ed25519 key (PEM)'} required={create}>
        <Input.TextArea
          aria-label={'Runner public key'}
          rows={4}
          value={configuration.key ?? ''}
          onChange={(event) => changeConfiguration({ key: event.target.value })}
        />
      </Form.Item>
      <Form.Item label={'Parallel job capacity'} required={create}>
        <InputNumber
          aria-label={'Parallel job capacity'}
          min={1}
          precision={0}
          value={configuration.max_parallel_jobs}
          onChange={(value) => changeConfiguration({ max_parallel_jobs: value ?? undefined })}
        />
      </Form.Item>
      <Form.Item label={'Supported protocols'}>
        <Select
          aria-label={'Supported protocols'}
          mode={'tags'}
          value={configuration.supported_protocols ?? undefined}
          onChange={(supported_protocols) => changeConfiguration({ supported_protocols })}
        />
      </Form.Item>
      <Form.Item label={'Capabilities'}>
        <Select
          aria-label={'Runner capabilities'}
          mode={'tags'}
          value={configuration.capabilities ?? undefined}
          onChange={(capabilities) => changeConfiguration({ capabilities })}
        />
      </Form.Item>
      <InventoryFields configuration={configuration} disabled={disabled} onImport={onImport} />
      <StorageFields
        storage={values.state_storage_configuration}
        create={create}
        onChange={(state_storage_configuration) =>
          onChange({ ...values, state_storage_configuration })
        }
      />
    </Form>
  );
};
