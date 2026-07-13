import { DeleteOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Flex, Form, Input, Modal, Select, theme, Tooltip, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';

import { FormWithErrorHandling } from '@src/components/shared/ui/FormWithErrorHandling';
import { MatchParams } from '@src/config/routing';
import { getListRolesQueryKey, listRoles } from '@src/hooks/react-query/v2/iam/role/role';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';

const { Text } = Typography;

const ROLE_DESCRIPTIONS: Record<string, string> = {
  Viewer: 'Has read-only access to everything within the organization.',
  Deployer: 'Has access to create deployments, read all objects within the organization.',
  Admin: 'Has full read/write access to everything within the organization.',
};

export interface UserField {
  email: string;
  role: string;
}

interface InviteUserModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (userFields: UserField[]) => void;
}

interface InviteUsersFormValues {
  userFields: UserField[];
}

export const InviteUserModal = ({ open, onClose, onSubmit }: InviteUserModalProps) => {
  const [form] = Form.useForm<InviteUsersFormValues>();
  const [isFormValid, setIsFormValid] = useState(false);
  const [lastSelectedRole, setLastSelectedRole] = useState<string | undefined>();

  const { token } = theme.useToken();

  const { orgId } = useParams<keyof MatchParams>() as MatchParams;

  const { data: roles, isSuccess: isRolesLoaded } = useAllPages(
    getAllPagesQueryKey(getListRolesQueryKey(orgId)),
    (params) => listRoles(orgId, params),
  );

  const checkFormValid = async () => {
    const hasErrors = form.getFieldsError().some(({ errors }) => errors.length > 0);
    const userFields = form.getFieldValue('userFields') || [];

    const hasFields = userFields.length > 0;
    const allFieldsValid = userFields.every((field: UserField) => field.email && field.role);

    setIsFormValid(!hasErrors && hasFields && allFieldsValid);
  };

  const handleConfirmInvite = async () => {
    onSubmit(form.getFieldValue('userFields'));
    onClose();
  };

  const getNewRowValue = useMemo(() => ({ email: '', role: lastSelectedRole }), [lastSelectedRole]);

  const initialFormValue = useMemo(() => ({ email: '', role: undefined }), []);

  const rolesItems = roles?.map((role) => {
    const description = ROLE_DESCRIPTIONS[role.display_name];
    const roleLabel = (
      <Typography.Text ellipsis style={{ flex: 1 }}>
        {role.display_name}
      </Typography.Text>
    );

    return {
      label: (
        <Flex gap={'small'} align={'center'}>
          {roleLabel}
          {description && (
            <Tooltip title={description}>
              <InfoCircleOutlined style={{ color: token.colorTextTertiary }} />
            </Tooltip>
          )}
        </Flex>
      ),
      value: role.id,
    };
  });

  useEffect(() => {
    if (isRolesLoaded) {
      form.setFieldValue('userFields', [initialFormValue]);
    }
  }, [form, initialFormValue, isRolesLoaded]);

  return (
    <Modal
      open={open}
      title={'Invite users'}
      okText={'Send invites'}
      onCancel={() => onClose()}
      okButtonProps={{ disabled: !isFormValid }}
      onOk={() => form.submit()}
      width={600}>
      <FormWithErrorHandling
        form={form}
        onFieldsChange={checkFormValid}
        onFinish={handleConfirmInvite}>
        <Flex vertical gap={'middle'}>
          <Form.List name={'userFields'} initialValue={[initialFormValue]}>
            {(fields, { add, remove }) => (
              <>
                <Flex gap={'small'} align={'center'}>
                  <Typography.Text type={'secondary'} style={{ flex: '3' }}>
                    Email
                  </Typography.Text>
                  <Typography.Text type={'secondary'} style={{ flex: '2' }}>
                    Organization Role
                  </Typography.Text>
                  <div style={{ width: 32 }} />
                </Flex>

                {fields.map(({ key, name }) => (
                  <Flex gap={'small'} key={key}>
                    <Form.Item
                      name={[name, 'email']}
                      style={{ flex: '3', marginBottom: 0, minWidth: 0 }}
                      rules={[
                        { required: true, message: 'Please enter an email' },
                        { type: 'email', message: 'Please enter a valid email' },
                      ]}>
                      <Input placeholder={'Email'} />
                    </Form.Item>
                    <Form.Item
                      name={[name, 'role']}
                      style={{ flex: '2', marginBottom: 0, minWidth: 0 }}
                      rules={[{ required: true, message: 'Please select an organization role' }]}>
                      <Select
                        options={rolesItems}
                        placeholder={'Organization Role'}
                        aria-label={'Select an organization role'}
                        onChange={(value) => setLastSelectedRole(value)}
                      />
                    </Form.Item>
                    <Button
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        if (fields.length !== 1) {
                          remove(name);
                          return;
                        }

                        // Clear the values instead of removing the last row
                        form.setFieldValue(['userFields', name, 'email'], '');
                        form.setFieldValue(['userFields', name, 'role'], undefined);

                        // Reset last selected role
                        setLastSelectedRole(undefined);

                        // Invalidate the form
                        setIsFormValid(false);
                      }}
                    />
                  </Flex>
                ))}

                <Flex>
                  <Button icon={<PlusOutlined />} onClick={() => add(getNewRowValue)}>
                    Add another
                  </Button>
                </Flex>
              </>
            )}
          </Form.List>

          <Text>
            Once the user accepts the invite, admins can assign scoped roles (e.g. Deployer on a
            specific project) from the user details page.
          </Text>
        </Flex>
      </FormWithErrorHandling>
    </Modal>
  );
};
