import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Checkbox, Form, Input, Switch, Typography } from 'antd';
import { useEffect } from 'react';

import {
  costEstimationPath,
  type CostEstimationValues,
  getCostEstimation,
  putCostEstimation,
  settingsErrorMessage,
} from './settingsApi';
import { SettingsError } from './SettingsError';

interface CostFields extends CostEstimationValues {
  remove_api_key?: boolean;
}

const CostEstimationFields = ({
  configured,
  disabled,
  saving,
}: {
  configured: boolean;
  disabled: boolean;
  saving: boolean;
}) => {
  const enabled = Form.useWatch<boolean>('enabled');
  const apiKey = Form.useWatch<string>('api_key');
  const remove = Form.useWatch<boolean>('remove_api_key');
  const hasKey = (!remove && configured) || (!remove && !!apiKey);
  return (
    <>
      <Form.Item name={'enabled'} label={'Infrastructure cost estimates'} valuePropName={'checked'}>
        <Switch />
      </Form.Item>
      <Form.Item
        name={'api_key'}
        label={'Infracost API key'}
        extra={
          configured
            ? 'An API key is stored. Leave this field empty to keep it, or enter a replacement.'
            : 'Enter your Infracost API key before enabling cost estimates.'
        }>
        <Input.Password
          autoComplete={'new-password'}
          visibilityToggle={false}
          maxLength={4096}
          disabled={disabled || remove}
        />
      </Form.Item>
      {configured && (
        <Form.Item
          name={'remove_api_key'}
          valuePropName={'checked'}
          extra={'Turn estimates off before removing the saved key.'}>
          <Checkbox>Remove saved API key</Checkbox>
        </Form.Item>
      )}
      <Button
        type={'primary'}
        htmlType={'submit'}
        disabled={disabled || (enabled && !hasKey)}
        loading={saving}>
        Save cost settings
      </Button>
    </>
  );
};

export const CostEstimationSettingsCard = ({ canWrite }: { canWrite: boolean }) => {
  const client = useQueryClient();
  const { message } = App.useApp();
  const [form] = Form.useForm<CostFields>();
  const query = useQuery({ queryKey: [costEstimationPath], queryFn: getCostEstimation });
  const save = useMutation({
    mutationFn: putCostEstimation,
    gcTime: 0,
    onError: (error) => {
      form.resetFields(['api_key', 'remove_api_key']);
      void message.error(settingsErrorMessage(error));
    },
    onSuccess: (value) => {
      form.resetFields(['api_key', 'remove_api_key']);
      client.setQueryData([costEstimationPath], value);
      save.reset();
      void message.success('Cost settings saved.');
    },
  });
  useEffect(() => {
    if (query.data)
      form.setFieldsValue({ enabled: query.data.enabled, api_key: '', remove_api_key: false });
  }, [form, query.data]);
  if (query.isPending) return <Card title={'Infrastructure costs'} loading />;
  if (query.isError)
    return <SettingsError error={query.error} retry={() => void query.refetch()} />;
  const submit = (values: CostFields) => {
    const settings: CostEstimationValues = { enabled: values.enabled };
    if (values.remove_api_key) settings.api_key = '';
    else if (values.api_key) settings.api_key = values.api_key;
    save.mutate({ values: settings, revision: query.data.revision });
  };
  return (
    <Card title={'Infrastructure costs'}>
      <Typography.Paragraph>
        Infracost estimates costs during manual and Drift plans. It processes plans locally and
        requests prices from Infracost over the network. Usage-based costs need usage assumptions;
        estimates are not a final bill. The API key is encrypted in storage and is never returned
        here.
      </Typography.Paragraph>
      <Typography.Paragraph>
        New executions take the enabled setting when first dispatched. Retries keep that setting.
        Key changes apply to fresh dispatches. Running jobs and queued commands retain their copied
        credentials. Pricing failures do not stop infrastructure execution.
      </Typography.Paragraph>
      <Form
        form={form}
        layout={'vertical'}
        disabled={!canWrite || save.isPending || save.isError || query.isFetching}
        onFinish={submit}>
        <CostEstimationFields
          configured={query.data.api_key_configured}
          disabled={!canWrite || save.isPending || save.isError || query.isFetching}
          saving={save.isPending}
        />
      </Form>
      {save.isError && (
        <SettingsError
          error={save.error}
          retry={() => {
            form.resetFields(['api_key', 'remove_api_key']);
            save.reset();
            void query.refetch();
          }}
        />
      )}
    </Card>
  );
};
