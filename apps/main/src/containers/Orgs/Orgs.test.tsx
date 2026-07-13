import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Orgs } from '@src/containers/Orgs/Orgs';
import { getGetCurrentUserMockHandler } from '@src/hooks/react-query/v2/iam/user/user.msw';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';

describe('Orgs', () => {
  it("should show an error page and list possible organizations if the user navigates to an organization which they don't have access to", async () => {
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
    );
    render(
      <MockProviders>
        <Orgs />
      </MockProviders>,
    );
    expect(await screen.findByText("You don't have access to this organization")).toBeVisible();
    expect(await screen.findByRole('link', { name: 'another-org' })).toBeVisible();
    expect(await screen.findByRole('link', { name: 'yet-another-org' })).toBeVisible();
  });
});
