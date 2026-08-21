import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  getCreateRoleMockHandler,
  getDeleteRoleMockHandler,
  getListRolesMockHandler,
  getUpdateRoleMockHandler,
} from '@src/hooks/react-query/v2/iam/role/role.msw';
import { getCheckPermissionsMockHandler } from '@src/hooks/react-query/v2/iam/user/user.msw';
import { RoleWriteBody } from '@src/models/v2/iam';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';

import { Roles } from './Roles';

let createRequest: RoleWriteBody | undefined;
let updateRequest: RoleWriteBody | undefined;
let updatedRoleId: string | undefined;
let deletedRoleId: string | undefined;

describe('Roles', () => {
  beforeEach(() => {
    createRequest = undefined;
    updateRequest = undefined;
    updatedRoleId = undefined;
    deletedRoleId = undefined;
    server.use(
      getCheckPermissionsMockHandler({
        items: [
          {
            allowed: true,
            permission_check: { permission: 'manage', resource: 'organization:my-org' },
          },
        ],
      }),
      getListRolesMockHandler({
        items: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            display_name: 'Admin',
            created_at: '2026-01-01T00:00:00Z',
            created_by: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
            permissions: ['manage_all'],
            is_system: true,
          },
          {
            id: '22222222-2222-2222-2222-222222222222',
            display_name: 'Auditor',
            created_at: '2026-01-01T00:00:00Z',
            created_by: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
            permissions: ['read_all'],
            is_system: false,
          },
        ],
      }),
      getCreateRoleMockHandler(async (info) => {
        createRequest = (await info.request.json()) as RoleWriteBody;
        return {
          id: '33333333-3333-3333-3333-333333333333',
          created_at: '2026-01-01T00:00:00Z',
          created_by: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          is_system: false,
          ...createRequest,
        };
      }),
      getUpdateRoleMockHandler(async (info) => {
        updatedRoleId = info.params.roleId as string;
        updateRequest = (await info.request.json()) as RoleWriteBody;
        return {
          id: updatedRoleId,
          created_at: '2026-01-01T00:00:00Z',
          created_by: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          is_system: false,
          ...updateRequest,
        };
      }),
      getDeleteRoleMockHandler((info) => {
        deletedRoleId = info.params.roleId as string;
      }),
    );
  });

  it('marks built-in roles as immutable and manages custom roles', async () => {
    const user = userEvent.setup();
    render(
      <MockProviders route={{ path: '/orgs/:orgId/roles', url: '/orgs/my-org/roles' }}>
        <Roles />
      </MockProviders>,
    );

    expect(await screen.findByText('Built-in')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Open role menu' })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /Create role/ }));
    const createDialog = await screen.findByRole('dialog');
    await user.type(within(createDialog).getByLabelText('Name'), 'Release operator');
    await user.click(within(createDialog).getByRole('combobox', { name: 'Permissions' }));
    await user.type(
      within(createDialog).getByRole('combobox', { name: 'Permissions' }),
      'write_all{enter}',
    );
    await user.click(within(createDialog).getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(createRequest).toEqual({
        display_name: 'Release operator',
        permissions: ['write_all'],
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Open role menu' }));
    await user.click(await screen.findByRole('menuitem', { name: /Edit/ }));
    const editDialog = await screen.findByRole('dialog');
    const nameInput = within(editDialog).getByLabelText('Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Compliance auditor');
    await user.click(within(editDialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updatedRoleId).toBe('22222222-2222-2222-2222-222222222222');
      expect(updateRequest).toEqual({
        display_name: 'Compliance auditor',
        permissions: ['read_all'],
      });
    });

    await user.click(screen.getByRole('button', { name: 'Open role menu' }));
    await user.click(await screen.findByRole('menuitem', { name: /Delete/ }));
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('dialog')
          .some((dialog) => dialog.textContent?.includes('Delete Auditor?')),
      ).toBe(true),
    );
    const deleteDialog = screen
      .getAllByRole('dialog')
      .find((dialog) => dialog.textContent?.includes('Delete Auditor?'));
    expect(deleteDialog).toBeDefined();
    await user.click(within(deleteDialog!).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deletedRoleId).toBe('22222222-2222-2222-2222-222222222222'));
  });
});
