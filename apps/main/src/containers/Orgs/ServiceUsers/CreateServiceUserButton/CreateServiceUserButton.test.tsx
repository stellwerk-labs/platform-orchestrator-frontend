import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { getListRolesMockHandler } from '@src/hooks/react-query/v2/iam/role/role.msw';
import {
  getCreateServiceUserMockHandler,
  getCreateServiceUserResponseMock,
  getListServiceUsersMockHandler,
} from '@src/hooks/react-query/v2/iam/service-user/service-user.msw';
import {
  getCheckPermissionsMockHandler,
  getGetCurrentUserMockHandler,
} from '@src/hooks/react-query/v2/iam/user/user.msw';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';

import { CreateServiceUserButton } from './CreateServiceUserButton';

let request: any;
describe('CreateServiceUserButton', () => {
  beforeEach(async () => {
    request = null;
    server.use(
      getListServiceUsersMockHandler(),
      getGetCurrentUserMockHandler(),
      getListRolesMockHandler({
        items: [
          {
            created_at: '2025-09-24T12:40:13.570611Z',
            created_by: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
            display_name: 'Admin',
            id: 'c77c670e-8464-4352-9c86-4fef1d523f22',
            permissions: ['manage_all'],
          },
          {
            created_at: '2025-09-24T12:40:13.570611Z',
            created_by: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
            display_name: 'Viewer',
            id: '41d9ab07-037d-4138-b111-1527617d01a2',
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
      getCreateServiceUserMockHandler(async (info) => {
        request = await info.request.json();
        return getCreateServiceUserResponseMock();
      }),
    );
  });

  it("should disable Create Service User button when user doesn't have permissions", async () => {
    server.use(
      getCheckPermissionsMockHandler({
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
      }),
    );
    render(
      <MockProviders>
        <CreateServiceUserButton />
      </MockProviders>,
    );

    expect(await screen.findByRole('button', { name: /Create service user/ })).toBeDisabled();
  });

  it('should send the correct payload', async () => {
    render(
      <MockProviders>
        <CreateServiceUserButton />
      </MockProviders>,
    );

    // Open modal
    await userEvent.click(await screen.findByRole('button', { name: /Create service user/ }));

    await userEvent.type(await screen.findByLabelText('Name'), 'the-service-user-id');
    await userEvent.click(await screen.findByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(request).toEqual({
        display_name: 'the-service-user-id',
        expiry_in_days: 30,
        roles: [
          {
            id: '41d9ab07-037d-4138-b111-1527617d01a2',
          },
        ],
      }),
    );
  });
});
