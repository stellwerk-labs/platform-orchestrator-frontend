import { render, screen, waitFor } from '@testing-library/react';
import { useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getGetSsoCallbackMockHandler,
  getGetSsoCallbackMockHandler401,
  getGetSsoCallbackResponseMock,
} from '@src/hooks/react-query/v2/iam/internal/internal.msw';
import {
  getGetCurrentUserMockHandler,
  getGetCurrentUserResponseMock,
} from '@src/hooks/react-query/v2/iam/user/user.msw';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';

import { SsoCallback } from './SsoCallback';

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

describe('SsoCallback', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as ReturnType<typeof vi.fn>).mockReturnValue(mockNavigate);
  });

  it('should navigate to organization dashboard on successful SSO callback', async () => {
    const mockResponse = getGetSsoCallbackResponseMock();
    server.use(
      getGetSsoCallbackMockHandler((info) => {
        const url = new URL(info.request.url);
        expect(url.searchParams.get('state')).toBe('test-state');
        return mockResponse;
      }),
    );
    server.use(
      getGetCurrentUserMockHandler({
        ...getGetCurrentUserResponseMock(),
        organization_memberships: [{ id: 'org-1' }],
      }),
    );

    render(
      <MockProviders route={{ path: '*', searchParams: 'code=test-code&state=test-state' }}>
        <SsoCallback />
      </MockProviders>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/orgs/org-1/projects');
    });
  });

  it('should display error message and "Try again" link on failed SSO callback', async () => {
    server.use(getGetSsoCallbackMockHandler401());

    render(
      <MockProviders>
        <SsoCallback />
      </MockProviders>,
    );

    expect(await screen.findByText(/Authentication error:/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Try again/i })).toBeInTheDocument();
  });
});
