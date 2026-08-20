import { Form, Input, Modal, Select, Typography } from 'antd';
import { useEffect } from 'react';

import { Role, RoleWriteBody } from '@src/models/v2/iam';

const permissionOptions = [
  { label: 'Manage everything', value: 'manage_all' },
  { label: 'Read and write', value: 'write_all' },
  { label: 'Read only', value: 'read_all' },
];

interface RoleModalProps {
  open: boolean;
  role?: Role;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (values: RoleWriteBody) => void;
}

export const RoleModal = ({ open, role, loading, onCancel, onSubmit }: RoleModalProps) => {
  const [form] = Form.useForm<RoleWriteBody>();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        display_name: role?.display_name ?? '',
        permissions: role?.permissions ?? [],
      });
    } else {
      form.resetFields();
    }
  }, [form, open, role]);

  return (
    <Modal
      open={open}
      forceRender
      title={role ? 'Edit role' : 'Create role'}
      okText={role ? 'Save' : 'Create'}
      confirmLoading={loading}
      onCancel={onCancel}
      onOk={() => form.submit()}>
      <Typography.Paragraph type={'secondary'}>
        Roles apply at organization, project, or environment scope. Permission changes take effect
        immediately for every assignment.
      </Typography.Paragraph>
      <Form form={form} layout={'vertical'} onFinish={onSubmit}>
        <Form.Item
          name={'display_name'}
          label={'Name'}
          rules={[
            { required: true, message: 'Enter a role name' },
            { min: 2, max: 100, message: 'Use between 2 and 100 characters' },
          ]}>
          <Input autoFocus placeholder={'Release operator'} />
        </Form.Item>
        <Form.Item
          name={'permissions'}
          label={'Permissions'}
          extra={'Choose a standard access level or enter application-specific permission names.'}
          rules={[
            { required: true, type: 'array', min: 1, message: 'Add at least one permission' },
            {
              validator: (_, values: string[] | undefined) =>
                values?.every((value) => /^[a-z][a-z0-9_]{1,62}[a-z0-9]$/.test(value))
                  ? Promise.resolve()
                  : Promise.reject(
                      new Error(
                        'Use lowercase letters, numbers, and underscores (3–64 characters)',
                      ),
                    ),
            },
          ]}>
          <Select
            mode={'tags'}
            tokenSeparators={[',', ' ']}
            options={permissionOptions}
            placeholder={'Select or type permissions'}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
