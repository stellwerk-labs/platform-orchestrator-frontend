import { Alert, Form, Input, Modal, Select, Space, Typography } from 'antd';
import { useEffect, useMemo } from 'react';

import { PermissionDefinition, Role, RoleWriteBody } from '@src/models/v2/iam';

interface RoleModalProps {
  open: boolean;
  role?: Role;
  permissions: PermissionDefinition[];
  permissionsLoading: boolean;
  permissionsError: boolean;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (values: RoleWriteBody) => void;
}

export const RoleModal = ({
  open,
  role,
  permissions,
  permissionsLoading,
  permissionsError,
  loading,
  onCancel,
  onSubmit,
}: RoleModalProps) => {
  const [form] = Form.useForm<RoleWriteBody>();
  const groupedPermissions = useMemo(() => {
    const groups = permissions.reduce<Record<string, PermissionDefinition[]>>(
      (result, permission) => {
        result[permission.category] = [...(result[permission.category] ?? []), permission];
        return result;
      },
      {},
    );
    return Object.entries(groups).sort(([left], [right]) => left.localeCompare(right));
  }, [permissions]);
  const knownPermissionIds = useMemo(
    () => new Set(permissions.map((permission) => permission.id)),
    [permissions],
  );
  const legacyPermissions = (role?.permissions ?? []).filter(
    (permission) => !knownPermissionIds.has(permission),
  );

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
      okButtonProps={{ disabled: permissionsLoading || permissionsError }}
      confirmLoading={loading}
      onCancel={onCancel}
      onOk={() => form.submit()}>
      <Typography.Paragraph type={'secondary'}>
        Roles apply at organization, project, or environment scope. Permission changes take effect
        immediately for every assignment.
      </Typography.Paragraph>
      {permissionsError && (
        <Alert
          type={'error'}
          showIcon
          message={'The permission catalog could not be loaded. Try again before saving.'}
          style={{ marginBottom: 16 }}
        />
      )}
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
          extra={
            'Select every capability the role needs. Write permissions do not include read permissions.'
          }
          rules={[
            { required: true, type: 'array', min: 1, message: 'Select at least one permission' },
          ]}>
          <Select
            mode={'multiple'}
            loading={permissionsLoading}
            disabled={permissionsError}
            showSearch
            optionFilterProp={'label'}
            maxTagCount={'responsive'}
            placeholder={'Select granular permissions'}>
            {groupedPermissions.map(([category, categoryPermissions]) => (
              <Select.OptGroup key={category} label={category}>
                {categoryPermissions?.map((permission) => (
                  <Select.Option
                    key={permission.id}
                    value={permission.id}
                    label={`${permission.display_name} (${permission.id})`}>
                    <Space direction={'vertical'} size={0}>
                      <Typography.Text>{permission.display_name}</Typography.Text>
                      <Typography.Text type={'secondary'}>{permission.description}</Typography.Text>
                      <Typography.Text type={'secondary'}>
                        {permission.id} · {permission.scopes.join(', ')}
                      </Typography.Text>
                    </Space>
                  </Select.Option>
                ))}
              </Select.OptGroup>
            ))}
            {legacyPermissions.length > 0 && (
              <Select.OptGroup label={'Legacy permissions'}>
                {legacyPermissions.map((permission) => (
                  <Select.Option
                    key={permission}
                    value={permission}
                    label={`${permission} (legacy)`}>
                    <Space direction={'vertical'} size={0}>
                      <Typography.Text>{permission}</Typography.Text>
                      <Typography.Text type={'secondary'}>
                        Kept for compatibility. Replace it with granular permissions when possible.
                      </Typography.Text>
                    </Space>
                  </Select.Option>
                ))}
              </Select.OptGroup>
            )}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};
