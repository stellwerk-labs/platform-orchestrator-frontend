import { Flex, Modal, Typography } from 'antd';

import { EnrichedScopedRole } from '@src/hooks/useEnrichScopedRoles';

import { ALL_ENVIRONMENTS } from './EnvironmentSelect';

interface DeleteRoleModalProps {
  record: EnrichedScopedRole;
  onConfirm: () => void;
  onCancel: () => void;
}

export const RemoveRoleModal = ({ record, onConfirm, onCancel }: DeleteRoleModalProps) => {
  return (
    <Modal title={'Unassign scoped role'} open okText={'Yes'} onOk={onConfirm} onCancel={onCancel}>
      <Flex vertical gap={'middle'} style={{ padding: '16px 0' }}>
        <Typography.Text>Are you sure you want to unassign this role?</Typography.Text>

        <Flex vertical gap={'small'}>
          <Flex gap={'middle'} align={'center'}>
            <Typography.Text type={'secondary'} style={{ width: '100px' }}>
              Project
            </Typography.Text>
            <Typography.Text>{record.projectId}</Typography.Text>
          </Flex>

          <Flex gap={'middle'} align={'center'}>
            <Typography.Text type={'secondary'} style={{ width: '100px' }}>
              Environment
            </Typography.Text>
            <Typography.Text>
              {record.environment?.display_name || ALL_ENVIRONMENTS}
            </Typography.Text>
          </Flex>

          <Flex gap={'middle'} align={'center'}>
            <Typography.Text type={'secondary'} style={{ width: '100px' }}>
              Role
            </Typography.Text>
            <Typography.Text>{record.role.display_name}</Typography.Text>
          </Flex>
        </Flex>
      </Flex>
    </Modal>
  );
};
