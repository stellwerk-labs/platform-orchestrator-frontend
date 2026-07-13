import { Flex, Form, Modal, Select, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { FormWithErrorHandling } from '@src/components/shared/ui/FormWithErrorHandling';
import { getListRolesQueryKey, listRoles } from '@src/hooks/react-query/v2/iam/role/role';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { Member } from '@src/models/v2/iam';

const { Text } = Typography;
export type MembershipRow = Member & { type: 'member' };

interface ManageRolesModalProps {
  open: boolean;
  membership: MembershipRow | null;
  onClose: () => void;
  onSubmit: (membership: MembershipRow, roleId: string) => void;
  orgId: string;
  isLoading?: boolean;
}

interface ManageRolesFormValues {
  role: string;
}

export const ManageRolesModal = ({
  open,
  membership,
  onClose,
  onSubmit,
  orgId,
  isLoading = false,
}: ManageRolesModalProps) => {
  const { data: roles } = useAllPages(getAllPagesQueryKey(getListRolesQueryKey(orgId)), (params) =>
    listRoles(orgId, params),
  );
  const [form] = Form.useForm<ManageRolesFormValues>();
  const [hasRoleChanged, setHasRoleChanged] = useState(false);

  const currentRole = roles?.find(
    (role) => membership?.type === 'member' && role.id === membership.subject,
  );

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

  if (!membership) {
    return null;
  }

  const handleConfirmRoleChange = async () => {
    const selectedRole = form.getFieldValue('role');
    onSubmit(membership, selectedRole);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={'Manage membership'}
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
        <Flex gap={'small'} align={'center'}>
          <Text style={{ flex: '1', marginBottom: 0 }}>
            {membership.user_primary_email_address}
          </Text>

          <Form.Item name={'role'} style={{ flex: '1', marginBottom: 0 }}>
            <Select
              disabled={isLoading}
              options={roles?.map((role) => ({
                label: role.display_name,
                value: role.id,
              }))}
            />
          </Form.Item>
        </Flex>
      </FormWithErrorHandling>
    </Modal>
  );
};
