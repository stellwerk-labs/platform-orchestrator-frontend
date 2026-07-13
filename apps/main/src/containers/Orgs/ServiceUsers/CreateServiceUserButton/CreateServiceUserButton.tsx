import { useQueryClient } from '@tanstack/react-query';
import { Form, Input, InputNumber, Modal, Select } from 'antd';
import { Dispatch, SetStateAction, useState } from 'react';
import { useParams } from 'react-router';

import { CheckRBAC } from '@src/components/shared/CheckRBAC';
import { ProtectedButton } from '@src/components/shared/ProtectedButton';
import { FormWithErrorHandling } from '@src/components/shared/ui/FormWithErrorHandling';
import { MatchParams } from '@src/config/routing';
import { getListRolesQueryKey, listRoles } from '@src/hooks/react-query/v2/iam/role/role';
import {
  getListServiceUsersQueryKey,
  useCreateServiceUser,
  useRegenerateServiceUser,
} from '@src/hooks/react-query/v2/iam/service-user/service-user';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { RBACPermission } from '@src/hooks/useRBAC';
import { ServiceUserSummary } from '@src/models/v2/iam';

import { showTokenModal } from '../service-user-utils';

interface ServiceUserModal {
  openState: [boolean, Dispatch<SetStateAction<boolean>>];
  mode: 'create' | 'regenerate';
  serviceUserToRegenerate?: ServiceUserSummary;
}

export const ServiceUserModal = ({
  openState,
  mode,
  serviceUserToRegenerate,
}: ServiceUserModal) => {
  // Component state
  const [open, setOpen] = openState;
  const [successModal, contextHolder] = Modal.useModal();

  // Router hooks
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;

  const [form] = Form.useForm<{ display_name: string; expiry_in_days: number; role: string }>();

  // React Query
  const { mutateAsync: createServiceUser, isPending: isCreateServiceUserPending } =
    useCreateServiceUser();
  const { mutateAsync: regenerateUser, isPending: isRegenerateServiceUserPending } =
    useRegenerateServiceUser();
  const queryClient = useQueryClient();
  const { data: roles } = useAllPages(getAllPagesQueryKey(getListRolesQueryKey(orgId)), (params) =>
    listRoles(orgId, params),
  );

  const handleCreate = async () => {
    const { display_name, expiry_in_days, role } = await form.validateFields();
    const serviceUser = await createServiceUser({
      orgId,
      data: {
        display_name,
        expiry_in_days,
        roles: [{ id: role }],
      },
    });
    form.resetFields();
    setOpen(false);
    showTokenModal(successModal, serviceUser.display_name, serviceUser.token);
    await queryClient.invalidateQueries({
      queryKey: getAllPagesQueryKey(getListServiceUsersQueryKey(orgId)),
    });
  };

  const handleRegenerateUser = async () => {
    if (!serviceUserToRegenerate) {
      return;
    }
    const values = await form.validateFields();
    const serviceUser = await regenerateUser({
      orgId,
      serviceUserId: serviceUserToRegenerate?.id,
      data: { expiry_in_days: values.expiry_in_days },
    });
    await queryClient.invalidateQueries({
      queryKey: getAllPagesQueryKey(getListServiceUsersQueryKey(orgId)),
    });
    setOpen(false);
    showTokenModal(successModal, serviceUser.display_name, serviceUser.token, true);
  };

  return (
    <Modal
      title={mode === 'create' ? 'Create service user' : 'Regenerate service user token'}
      open={open}
      onCancel={() => setOpen(false)}
      onOk={() => form.submit()}
      confirmLoading={isCreateServiceUserPending || isRegenerateServiceUserPending}
      okText={mode === 'create' ? 'Create' : 'Regenerate token'}>
      {contextHolder}
      <FormWithErrorHandling
        form={form}
        layout={'vertical'}
        initialValues={{ expiry_in_days: 30 }}
        onFinish={mode === 'create' ? handleCreate : handleRegenerateUser}
        customErrorMessage={
          mode === 'create'
            ? 'Failed to create service user. Please try again.'
            : 'Failed to regenerate service user.'
        }>
        {mode === 'create' && (
          <Form.Item
            name={'display_name'}
            label={'Name'}
            rules={[
              { required: true, message: 'Display name is required' },
              { min: 2, message: 'Must be at least 2 characters' },
              { max: 200, message: 'Cannot exceed 200 characters' },
            ]}>
            <Input placeholder={'Enter a display name'} />
          </Form.Item>
        )}

        <Form.Item
          name={'expiry_in_days'}
          label={'Expiry in days'}
          rules={[
            { required: true, message: 'Expiry is required' },
            {
              type: 'number',
              min: 1,
              max: 3660,
              message: 'Must be between 1 and 3660 days',
            },
          ]}>
          <InputNumber type={'number'} style={{ width: '100%' }} />
        </Form.Item>
        {mode === 'create' && (
          <Form.Item
            name={'role'}
            style={{ flex: '1', marginBottom: 0 }}
            label={'Organization role'}
            initialValue={roles?.find((role) => role.display_name === 'Viewer')?.id}>
            <Select
              options={roles?.map((role) => ({
                label: role.display_name,
                value: role.id,
              }))}
              aria-label={'Select a role'}
            />
          </Form.Item>
        )}
      </FormWithErrorHandling>
    </Modal>
  );
};

export const CreateServiceUserButton = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <CheckRBAC permission={RBACPermission.MANAGE}>
        {(allowed) => (
          <ProtectedButton
            allowed={allowed}
            message={
              "You don't have permission to perform this action. Please contact an organization admin."
            }
            type={'primary'}
            onClick={() => setIsModalOpen(true)}>
            Create service user
          </ProtectedButton>
        )}
      </CheckRBAC>

      <ServiceUserModal openState={[isModalOpen, setIsModalOpen]} mode={'create'} />
    </>
  );
};
