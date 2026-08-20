import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { getGetEnvironmentMockHandler } from '@src/hooks/react-query/v2/controlplane/environment/environment.msw';
import { getGetProjectMockHandler } from '@src/hooks/react-query/v2/controlplane/project/project.msw';
import { getListRolesMockHandler } from '@src/hooks/react-query/v2/iam/role/role.msw';
import {
  getDeleteServiceUserMockHandler,
  getListServiceUsersMockHandler,
  getRegenerateServiceUserMockHandler,
  getRegenerateServiceUserResponseMock,
} from '@src/hooks/react-query/v2/iam/service-user/service-user.msw';
import { getCheckPermissionsMockHandler } from '@src/hooks/react-query/v2/iam/user/user.msw';
import { ResourcePermissionCheckResult } from '@src/models/v2/iam';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';

import { ServiceUsers } from './ServiceUsers';

let deleteServiceUserRequestSent = false;
let regenerateServiceUserTokenRequestSent = false;

const onlyReadPermissions: ResourcePermissionCheckResult = {
  items: [
    {
      allowed: false,
      permission_check: {
        permission: 'manage',
        resource: 'organization:my-org',
      },
    },
    {
      allowed: false,
      permission_check: {
        permission: 'write',
        resource: 'organization:my-org',
      },
    },
    {
      allowed: true,
      permission_check: {
        permission: 'read',
        resource: 'organization:my-org',
      },
    },
  ],
};

describe('ServiceUsers', () => {
  beforeEach(async () => {
    deleteServiceUserRequestSent = false;
    regenerateServiceUserTokenRequestSent = false;
    server.use(
      getListServiceUsersMockHandler(),
      getListRolesMockHandler({
        items: [
          {
            created_at: '2025-09-24T12:40:13.570611Z',
            created_by: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
            display_name: 'Admin',
            id: 'c77c670e-8464-4352-9c86-4fef1d523f22',
            is_system: false,
            permissions: ['manage_all'],
          },
          {
            created_at: '2025-09-24T12:40:13.570611Z',
            created_by: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
            display_name: 'Viewer',
            id: '41d9ab07-037d-4138-b111-1527617d01a2',
            is_system: false,
            permissions: ['read_all'],
          },
        ],
      }),
      getCheckPermissionsMockHandler({
        items: [
          {
            allowed: true,
            permission_check: {
              permission: 'manage',
              resource: 'organization:my-org',
            },
          },
          {
            allowed: true,
            permission_check: {
              permission: 'write',
              resource: 'organization:my-org',
            },
          },
          {
            allowed: true,
            permission_check: {
              permission: 'read',
              resource: 'organization:my-org',
            },
          },
        ],
      }),
      getGetProjectMockHandler(),
      getGetEnvironmentMockHandler(),
      getDeleteServiceUserMockHandler(() => {
        deleteServiceUserRequestSent = true;
      }),
      getRegenerateServiceUserMockHandler(() => {
        regenerateServiceUserTokenRequestSent = true;
        return getRegenerateServiceUserResponseMock();
      }),
      getCheckPermissionsMockHandler(),
    );
  });

  it('should send delete when user clicks delete service user', async () => {
    render(
      <MockProviders>
        <ServiceUsers />
      </MockProviders>,
    );

    await userEvent.click((await screen.findAllByRole('button', { name: 'Open menu' }))[0]!);
    await userEvent.click(await screen.findByRole('menuitem', { name: /Delete/ }));

    await userEvent.click(await screen.findByRole('button', { name: 'Yes' }));

    // Assert payload was sent
    await waitFor(() => expect(deleteServiceUserRequestSent).toBeTruthy());
  });

  it('should send regenerate token request', async () => {
    render(
      <MockProviders>
        <ServiceUsers />
      </MockProviders>,
    );

    await userEvent.click((await screen.findAllByRole('button', { name: 'Open menu' }))[0]!);
    await userEvent.click(await screen.findByRole('menuitem', { name: /Regenerate token/ }));

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).queryByLabelText('Role')).toBeFalsy();

    await userEvent.click(await screen.findByRole('button', { name: 'Regenerate token' }));

    // Assert payload was sent
    await waitFor(() => expect(regenerateServiceUserTokenRequestSent).toBeTruthy());
  });

  it("should disable regenerate token action when user doesn't have permissions", async () => {
    server.use(getCheckPermissionsMockHandler(onlyReadPermissions));
    render(
      <MockProviders>
        <ServiceUsers />
      </MockProviders>,
    );

    await userEvent.click((await screen.findAllByRole('button', { name: 'Open menu' }))[0]!);
    await userEvent.click(await screen.findByRole('menuitem', { name: /Regenerate token/ }));

    expect(screen.queryByText('Regenerate Service User token', { exact: true })).toBeFalsy();
  });

  it("should disable delete service user action when user doesn't have permissions", async () => {
    server.use(getCheckPermissionsMockHandler(onlyReadPermissions));
    render(
      <MockProviders>
        <ServiceUsers />
      </MockProviders>,
    );

    await userEvent.click((await screen.findAllByRole('button', { name: 'Open menu' }))[1]!);
    await userEvent.click(await screen.findByRole('menuitem', { name: /Delete/ }));

    expect(screen.queryByText('Delete service user', { exact: true })).toBeFalsy();
  });
});
