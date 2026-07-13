import { Flex, Form, Modal, Select, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { FormWithErrorHandling } from '@src/components/shared/ui/FormWithErrorHandling';
import { getListRolesQueryKey, listRoles } from '@src/hooks/react-query/v2/iam/role/role';
import { EnrichedScopedRole } from '@src/hooks/useEnrichScopedRoles';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';

import { ALL_ENVIRONMENTS } from './EnvironmentSelect';

const { Text } = Typography;

interface UpdateRoleModalProps {
  open: boolean;
  membership: EnrichedScopedRole;
  onClose: () => void;
  onSubmit: (roleId: string) => void;
  orgId: string;
  isLoading?: boolean;
}

interface ManageRolesFormValues {
  role: string;
}

export const UpdateRoleModal = ({
  open,
  membership,
  onClose,
  onSubmit,
  orgId,
  isLoading = false,
}: UpdateRoleModalProps) => {
  const { data: roles } = useAllPages(getAllPagesQueryKey(getListRolesQueryKey(orgId)), (params) =>
    listRoles(orgId, params),
  );
  const [form] = Form.useForm<ManageRolesFormValues>();
  const [hasRoleChanged, setHasRoleChanged] = useState(false);

  const currentRole = membership.role;

  const checkRoleChanged = async () => {
    const selectedRole = form.getFieldValue('role');
    const hasChanged = selectedRole && selectedRole !== currentRole?.id;
    setHasRoleChanged(hasChanged);
  };

  useEffect(() => {
    // Set initial role value when modal opens
    if (currentRole) {
      form.setFieldValue('role', currentRole.id);
      setHasRoleChanged(false);
    }

    return () => {
      // Reset form state when component unmounts
      form.resetFields();
      setHasRoleChanged(false);
    };
  }, [currentRole, form]);

  const handleConfirmRoleChange = async () => {
    const selectedRole = form.getFieldValue('role');
    onSubmit(selectedRole);
    onClose();
  };

  const generateTitle = (resourceType: string): string => {
    return `Update ${resourceType} scoped role`;
  };

  if (!membership) {
    return null;
  }

  return (
    <Modal
      open={open}
      title={generateTitle(membership.environment ? 'environment' : 'project')}
      onCancel={() => onClose()}
      okButtonProps={{ disabled: !hasRoleChanged || isLoading }}
      cancelButtonProps={{ disabled: isLoading }}
      onOk={() => form.submit()}
      okText={'Update'}
      cancelText={'Cancel'}>
      <FormWithErrorHandling
        form={form}
        onFieldsChange={checkRoleChanged}
        onFinish={handleConfirmRoleChange}>
        <Flex vertical gap={'middle'} style={{ padding: '16px 0' }}>
          <Flex gap={'middle'} align={'center'}>
            <Text type={'secondary'} style={{ width: '150px' }}>
              Project
            </Text>
            <Text style={{ paddingLeft: '2px', flex: 1 }}>{membership.projectId}</Text>
          </Flex>

          <Flex gap={'middle'} align={'center'}>
            <Text type={'secondary'} style={{ width: '150px' }}>
              Environment
            </Text>
            <Text style={{ paddingLeft: '2px', flex: 1 }}>
              {membership.environment ? membership.environment.display_name : ALL_ENVIRONMENTS}
            </Text>
          </Flex>

          <Flex gap={'middle'} align={'center'}>
            <Text type={'secondary'} style={{ width: '150px' }}>
              Role
            </Text>
            <Form.Item name={'role'} style={{ margin: 0, flex: 1 }}>
              <Select
                disabled={isLoading}
                options={roles?.map((role) => ({
                  label: role.display_name,
                  value: role.id,
                }))}
                style={{ width: '150px' }}
              />
            </Form.Item>
          </Flex>
        </Flex>
      </FormWithErrorHandling>
    </Modal>
  );
};
