import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  getGetCurrentUserMockHandler,
  getGetCurrentUserResponseMock,
} from '@src/hooks/react-query/v2/iam/user/user.msw';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';

import { MainHeader } from './MainHeader';

describe('MainHeader', () => {
  it("should show switch organization label when there's only 1 organization", async () => {
    server.use(
      getGetCurrentUserMockHandler({
        ...getGetCurrentUserResponseMock(),
        organization_memberships: [{ id: 'my-org' }],
        primary_email_address: 'one@example.com',
      }),
    );
    render(
      <MockProviders>
        <MainHeader />
      </MockProviders>,
    );

    await userEvent.click(await screen.findByText('my-org'));

    await waitFor(async () => expect(await screen.findByText('one@example.com')).toBeVisible());

    expect(await screen.findByText('Switch organization')).toBeVisible();
  });

  it("should show switch organization label when there's more than 1 organization", async () => {
    server.use(
      getGetCurrentUserMockHandler({
        ...getGetCurrentUserResponseMock(),
        organization_memberships: [{ id: 'my-org' }, { id: 'org-2' }],
        primary_email_address: 'one@example.com',
      }),
    );
    render(
      <MockProviders>
        <MainHeader />
      </MockProviders>,
    );

    await userEvent.click(await screen.findByText('my-org'));

    await waitFor(async () => expect(await screen.findByText('one@example.com')).toBeVisible());

    expect(screen.getByText('Switch organization')).toBeTruthy();
  });
});
