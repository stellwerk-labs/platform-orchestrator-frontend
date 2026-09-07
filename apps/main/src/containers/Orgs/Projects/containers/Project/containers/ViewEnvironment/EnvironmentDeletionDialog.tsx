import { DeleteOutlined } from '@ant-design/icons';
import { Alert, Button, List, message, Modal, Space, Spin, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import {
  useDeleteEnvironment,
  useGetEnvironmentDeletionImpact,
} from '@src/hooks/react-query/v2/controlplane/environment/environment';
import { Environment } from '@src/models/v2/controlplane';
import { generateAppUrl } from '@src/utilities/navigation';

interface EnvironmentDeletionDialogProps {
  environment?: Environment;
}

export const EnvironmentDeletionDialog = ({ environment }: EnvironmentDeletionDialogProps) => {
  const { orgId, projectId, envId } = useParams<keyof MatchParams>() as MatchParams;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const impact = useGetEnvironmentDeletionImpact(orgId, projectId, envId, {
    query: { enabled: open },
  });
  const deletion = useDeleteEnvironment();

  const close = () => {
    if (!deletion.isPending) setOpen(false);
  };
  const confirm = () => {
    deletion.mutate(
      { orgId, projectId, envId },
      {
        onSuccess: () => {
          setOpen(false);
          void message.success(`Deletion of ${environment?.display_name ?? envId} started.`);
          navigate(generateAppUrl(orgId, projectId));
        },
        onError: () => void message.error('Environment deletion failed.'),
      },
    );
  };

  return (
    <>
      <Button danger icon={<DeleteOutlined />} onClick={() => setOpen(true)}>
        Delete environment
      </Button>
      <Modal
        open={open}
        title={`Delete ${environment?.display_name ?? envId}?`}
        okText={'Delete environment'}
        okButtonProps={{ danger: true, disabled: !impact.data || impact.data.blocked }}
        confirmLoading={deletion.isPending}
        onCancel={close}
        onOk={confirm}>
        <Space direction={'vertical'} size={'middle'} style={{ width: '100%' }}>
          <Alert
            type={'warning'}
            showIcon
            message={
              'This starts a real destroy deployment. Module Pin and add-on history is retained for audit.'
            }
          />
          {impact.isLoading && <Spin />}
          {impact.isError && (
            <Alert
              type={'error'}
              showIcon
              message={'Deletion impact could not be loaded. No deletion has been started.'}
            />
          )}
          {impact.data?.blocked && (
            <Alert
              type={'error'}
              showIcon
              message={'Deletion is blocked'}
              description={impact.data.blockers.join('\n')}
            />
          )}
          {impact.data && (
            <>
              <div>
                <Typography.Title level={5}>Affected Module Pins</Typography.Title>
                <List
                  size={'small'}
                  locale={{ emptyText: 'No Module Pins' }}
                  dataSource={impact.data.pins}
                  renderItem={(pin) => (
                    <List.Item>
                      <Space wrap>
                        <Tag color={pin.status === 'override_pending' ? 'red' : 'blue'}>
                          {pin.status}
                        </Tag>
                        <Typography.Text code>{pin.module_uuid}</Typography.Text>
                        <Typography.Text type={'secondary'}>@ {pin.version_uuid}</Typography.Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </div>
              <div>
                <Typography.Title level={5}>Related add-on resources</Typography.Title>
                <List
                  size={'small'}
                  locale={{ emptyText: 'No related add-on resources' }}
                  dataSource={impact.data.related_resources}
                  renderItem={(resource) => (
                    <List.Item>
                      <Space direction={'vertical'} size={0}>
                        <Typography.Text>{resource.label}</Typography.Text>
                        <Typography.Text type={'secondary'}>
                          {resource.namespace}/{resource.external_resource_id} (
                          {resource.lifecycle_state})
                        </Typography.Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </div>
            </>
          )}
        </Space>
      </Modal>
    </>
  );
};
