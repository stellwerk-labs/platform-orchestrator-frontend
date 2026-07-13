import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  getGetResourceTypeResponseMock,
  getListResourceTypesMockHandler,
} from '@src/hooks/react-query/v2/controlplane/resource-type/resource-type.msw';
import { getGetCurrentUserMockHandler } from '@src/hooks/react-query/v2/iam/user/user.msw';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';

import { ResourceTypes } from './ResourceTypes';

describe('ResourceTypes', () => {
  it('should show correct accessible to developers value', async () => {
    server.use(
      getGetCurrentUserMockHandler({
        created_at: '2025-08-11T11:59:09.523385Z',
        dismissed_prompts: [],
        display_name: 'Test user',
        id: 'test-id',
        last_logged_in_at: '2025-09-24T10:26:43.509276Z',
        login_providers: [],
        organization_memberships: [
          {
            id: 'another-org',
          },
          {
            id: 'yet-another-org',
          },
        ],
        primary_email_address: 'test@example.com',
      }),
      getListResourceTypesMockHandler({
        items: [
          { ...getGetResourceTypeResponseMock(), is_developer_accessible: true },
          { ...getGetResourceTypeResponseMock(), is_developer_accessible: false },
        ],
      }),
    );
    render(
      <MockProviders>
        <ResourceTypes />
      </MockProviders>,
    );

    const getRows = async () => {
      return within(await screen.findByRole('table')).findAllByRole('row');
    };

    await waitFor(async () => expect(await getRows()).toHaveLength(3));

    const rows = await getRows();

    expect(within(rows[1]!).getByText('Yes')).toBeTruthy();
    expect(within(rows[2]!).getByText('No')).toBeTruthy();
  });
});
