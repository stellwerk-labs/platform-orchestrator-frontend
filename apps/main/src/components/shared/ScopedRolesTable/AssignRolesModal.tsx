import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Flex, Form, Modal, Select, Typography } from 'antd';
import { useCallback, useMemo, useState } from 'react';

import { FormWithErrorHandling } from '@src/components/shared/ui/FormWithErrorHandling';
import { MembershipCreate } from '@src/containers/Orgs/OrgMembers/types';
import {
  getListProjectsQueryKey,
  listProjects,
} from '@src/hooks/react-query/v2/controlplane/project/project';
import { getListRolesQueryKey, listRoles } from '@src/hooks/react-query/v2/iam/role/role';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';

import { EnvironmentSelect } from './EnvironmentSelect';

interface Props {
  orgId: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (newMemberships: MembershipCreate[]) => Promise<void>;
}

interface ScopedRoleFormValues {
  scopedRoles: ScopedRoleField[];
}

interface ScopedRoleField {
  project: string | undefined;
  environment: string;
  role: string | undefined;
}

export const AssignRolesModal = ({ open, orgId, onClose, onSubmit }: Props) => {
  const [form] = Form.useForm<ScopedRoleFormValues>();
  const [isFormValid, setIsFormValid] = useState(false);

  // Fetch projects
  const { data: allProjects, isSuccess: projectsDataSucceed } = useAllPages(
    getAllPagesQueryKey(getListProjectsQueryKey(orgId)),
    (params) => listProjects(orgId, params),
  );
  const projects =
    allProjects?.map((project) => ({
      label: project.display_name,
      value: project.uuid,
    })) ?? [];

  const { data: rolesData } = useAllPages(
    getAllPagesQueryKey(getListRolesQueryKey(orgId)),
    (params) => listRoles(orgId, params),
  );

  const roles =
    rolesData?.map((role) => ({
      label: role.display_name,
      value: role.id,
    })) ?? [];

  const checkFormValid = async () => {
    const hasErrors = form.getFieldsError().some(({ errors }) => errors.length > 0);
    const formScopedRoles = form.getFieldValue('scopedRoles') || [];

    const hasFields = formScopedRoles.length > 0;
    const allFieldsValid = formScopedRoles.every(
      (field: ScopedRoleField) => field.project && field.role,
    );

    setIsFormValid(!hasErrors && hasFields && allFieldsValid);
  };

  const initialFormValue = useMemo(
    () => ({ project: undefined, environment: '', role: undefined }),
    [],
  );

  const handleConfirmAssign = async () => {
    const values = form.getFieldValue('scopedRoles');

    const newMemberships: MembershipCreate[] = values.map((membership: ScopedRoleField) => {
      if (!membership.role || !membership.project) {
        throw new Error('Invalid form submission: missing required fields');
      }

      const scope = membership.environment
        ? `env:${membership.environment}`
        : `project:${membership.project}`;

      return {
        roleId: membership.role,
        scope,
      };
    });

    await onSubmit(newMemberships);

    form.resetFields();
    onClose();
  };

  const getSelectedProjectId = useCallback(
    (projectUuid: string): string => {
      if (!projectUuid || !projectsDataSucceed) {
        return '';
      }

      return allProjects.find((p) => p.uuid === projectUuid)?.id || '';
    },
    [allProjects, projectsDataSucceed],
  );

  return (
    <Modal
      open={open}
      title={'Assign new scoped role'}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      okButtonProps={{ disabled: !isFormValid }}
      onOk={() => form.submit()}
      okText={'Assign'}
      cancelText={'Cancel'}
      width={600}>
      <FormWithErrorHandling
        form={form}
        onFieldsChange={checkFormValid}
        onFinish={handleConfirmAssign}>
        <Flex vertical gap={'middle'}>
          <Form.List name={'scopedRoles'} initialValue={[initialFormValue]}>
            {(fields, { add, remove }) => (
              <>
                <Flex gap={'small'} align={'center'}>
                  <Typography.Text type={'secondary'} style={{ flex: '2' }}>
                    Project
                  </Typography.Text>

                  <Typography.Text type={'secondary'} style={{ flex: '2' }}>
                    Environment
                  </Typography.Text>

                  <Typography.Text type={'secondary'} style={{ flex: '2' }}>
                    Role
                  </Typography.Text>
                  <div style={{ width: 32 }} />
                </Flex>

                {fields.map(({ key, name }) => (
                  <Flex gap={'small'} key={key}>
                    {/* Project Select */}
                    <Form.Item
                      name={[name, 'project']}
                      style={{ flex: '2', marginBottom: 0, minWidth: 0 }}
                      rules={[{ required: true, message: 'Please select a project' }]}>
                      <Select
                        options={projects}
                        placeholder={'Project'}
                        aria-label={'Select a project'}
                        onChange={() => {
                          // Clear environment when project changes
                          form.setFieldValue(['scopedRoles', name, 'environment'], '');
                          checkFormValid();
                        }}
                      />
                    </Form.Item>

                    {/* Environment Select */}
                    <Form.Item
                      noStyle
                      shouldUpdate={(prevValues, curValues) =>
                        prevValues.scopedRoles?.[name]?.project !==
                        curValues.scopedRoles?.[name]?.project
                      }>
                      {({ getFieldValue }) => (
                        <Form.Item
                          name={[name, 'environment']}
                          style={{ flex: '2', marginBottom: 0, minWidth: 0 }}>
                          <EnvironmentSelect
                            key={getFieldValue(['scopedRoles', name, 'project']) || 'no-project'}
                            projectId={getSelectedProjectId(
                              getFieldValue(['scopedRoles', name, 'project']),
                            )}
                            orgId={orgId}
                            placeholder={'Environment'}
                            aria-label={'Select an environment'}
                            disabled={!getFieldValue(['scopedRoles', name, 'project'])}
                          />
                        </Form.Item>
                      )}
                    </Form.Item>

                    {/* Role Select */}
                    <Form.Item
                      name={[name, 'role']}
                      style={{ flex: '2', marginBottom: 0, minWidth: 0 }}
                      rules={[{ required: true, message: 'Please select a role' }]}>
                      <Select
                        options={roles}
                        placeholder={'Role'}
                        aria-label={'Select a role'}
                        onChange={() => checkFormValid()}
                      />
                    </Form.Item>

                    {/* Delete row */}
                    <Button
                      icon={<DeleteOutlined />}
                      aria-label={'Delete row'}
                      onClick={() => {
                        if (fields.length !== 1) {
                          remove(name);
                          return;
                        }

                        // Clear the values instead of removing the last row
                        form.setFieldValue(['scopedRoles', name, 'project'], undefined);
                        form.setFieldValue(['scopedRoles', name, 'environment'], '');
                        form.setFieldValue(['scopedRoles', name, 'role'], undefined);

                        // Invalidate the form
                        setIsFormValid(false);
                      }}
                    />
                  </Flex>
                ))}

                <Flex>
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => add(initialFormValue)}
                    aria-label={'Add another scoped role'}>
                    Add another
                  </Button>
                </Flex>
              </>
            )}
          </Form.List>
        </Flex>
      </FormWithErrorHandling>
    </Modal>
  );
};
