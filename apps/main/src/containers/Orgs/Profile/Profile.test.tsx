import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Profile } from '@src/containers/Orgs/Profile/Profile';
import {
  getGetCurrentUserMockHandler,
  getListUserSessionTokensMockHandler,
  getRevokeUserSessionTokenMockHandler,
} from '@src/hooks/react-query/v2/iam/user/user.msw';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';

const revokeRequestCallback = vi.fn();
describe('it should list the user sessions', () => {
  beforeEach(async () => {
    server.use(
      getGetCurrentUserMockHandler(),
      getListUserSessionTokensMockHandler({
        items: [
          {
            client_city: 'New York',
            client_ip: '33.4.4.0',
            client_region: 'US',
            created_at: '2025-09-10T15:35:30.549211Z',
            expires_at: '2025-09-11T15:35:30.549211Z',
            hash: 'TXqL20hwZ-oCqx50qUV9JvJUSqvWi0B2vfkVY0JWkKE=',
            provider: 'google',
          },
          {
            client_city: 'Berlin',
            client_ip: '95.91.209.0',
            client_region: 'DE',
            created_at: '2025-08-10T15:35:30.549211Z',
            expires_at: '2025-08-11T15:35:30.549211Z',
            hash: 'assasa-oCqx50qUV9JvJUSqvWi0B2vfkVY0JWkKE=',
            provider: 'google',
          },
        ],
      }),
      getRevokeUserSessionTokenMockHandler(revokeRequestCallback),
    );
    render(
      <MockProviders>
        <Profile />
      </MockProviders>,
    );
  });
  it('should list the user sessions in descending order', async () => {
    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(3);
    });
    expect(screen.getAllByRole('row')[1]).toHaveTextContent(/10 Sep/);
  });
  it('should send a request to revoke the token when the user click on the Revoke button', async () => {
    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(3);
    });
    const tableRows = await screen.findAllByRole('row');
    const revokeButton = within(tableRows[1]!).getByRole('button', { name: 'Revoke' });
    await userEvent.click(revokeButton);
    await userEvent.click(await screen.findByRole('button', { name: 'Yes' }));
    expect(revokeRequestCallback).toHaveBeenCalled();
  });
});
