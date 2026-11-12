import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Form, Input } from 'antd';
import { useEffect } from 'react';

import { announceSessionPolicyChange } from '@src/session/browserSession';

import {
  getSessionPolicy,
  putSessionPolicy,
  sessionPath,
  type SessionPolicyValues,
  settingsErrorMessage,
} from './settingsApi';
import { SettingsError } from './SettingsError';

const sessionFields = [
  {
    name: 'browser_idle_timeout',
    label: 'Console inactivity timeout',
    help: 'Default: 15m. Use a Go duration such as 30m. Minimum: 1s. Background requests do not count as activity.',
  },
  {
    name: 'cli_token_ttl',
    label: 'CLI user-token lifetime',
    help: 'Default: 2h. Use a Go duration such as 8h. Minimum: 1s. API activity does not extend it. Service and Runner tokens are unaffected.',
  },
] as const;

export const SessionSettingsCard = ({ canWrite }: { canWrite: boolean }) => {
  const client = useQueryClient();
  const { modal, message } = App.useApp();
  const [form] = Form.useForm<SessionPolicyValues>();
  const query = useQuery({ queryKey: [sessionPath], queryFn: getSessionPolicy });
  const save = useMutation({
    mutationFn: putSessionPolicy,
    onError: (error) => void message.error(settingsErrorMessage(error)),
    onSuccess: (value) => {
      client.setQueryData([sessionPath], value);
      announceSessionPolicyChange();
      void message.success('Session settings saved. They apply immediately.');
    },
  });
  useEffect(() => {
    if (query.data)
      form.setFieldsValue({
        browser_idle_timeout: query.data.browser_idle_timeout,
        cli_token_ttl: query.data.cli_token_ttl,
      });
  }, [form, query.data]);
  if (query.isPending) return <Card title={'User sessions'} loading />;
  if (query.isError)
    return <SettingsError error={query.error} retry={() => void query.refetch()} />;
  const confirm = (values: SessionPolicyValues) => {
    const revision = query.data.revision;
    modal.confirm({
      title: 'Apply session settings now?',
      content:
        'The new limits apply to existing sessions immediately. Shorter limits can sign users out, including you. Expired sessions will not be restored by a later increase.',
      okText: 'Apply settings',
      onOk: () =>
        save.mutateAsync({ values, revision }).then(
          () => undefined,
          () => undefined,
        ),
    });
  };
  return (
    <Card title={'User sessions'}>
      <Form
        form={form}
        layout={'vertical'}
        disabled={!canWrite || save.isPending}
        onFinish={confirm}>
        {sessionFields.map(({ name, label, help }) => (
          <Form.Item
            key={name}
            name={name}
            label={label}
            extra={help}
            rules={[{ required: true, whitespace: true }]}>
            <Input maxLength={64} />
          </Form.Item>
        ))}
        <Button type={'primary'} htmlType={'submit'} loading={save.isPending}>
          Save session settings
        </Button>
      </Form>
      {save.isError && (
        <SettingsError
          error={save.error}
          retry={() => {
            save.reset();
            void query.refetch();
          }}
        />
      )}
    </Card>
  );
};
