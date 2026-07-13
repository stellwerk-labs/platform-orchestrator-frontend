import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getRequestSsoLoginMockHandler,
  getRequestSsoLoginMockHandler200,
  getRequestSsoLoginMockHandler404,
} from '@src/hooks/react-query/v2/iam/internal/internal.msw';
import {
  getGetCurrentUserMockHandler,
  getGetCurrentUserResponseMock,
} from '@src/hooks/react-query/v2/iam/user/user.msw';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';

import { SsoLogin } from './SsoLogin';

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

describe('SsoLogin', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as ReturnType<typeof vi.fn>).mockReturnValue(mockNavigate);

    // Mock window.location.href setter
    delete (window as any).location;
    window.location = { href: 'http://localhost:3000/' } as any;
  });

  it('should render SSO login page with title and SSO button', () => {
    server.use(getGetCurrentUserMockHandler()); // Not logged in
    server.use(getRequestSsoLoginMockHandler());

    render(
      <MockProviders>
        <SsoLogin />
      </MockProviders>,
    );

    expect(screen.getByText('Sign in with SSO')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with sso/i })).toBeInTheDocument();
  });

  it('should redirect to SSO URL on successful SSO button click', async () => {
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost:3000/' },
      writable: true,
    });

    server.use(getGetCurrentUserMockHandler(undefined));
    server.use(
      getRequestSsoLoginMockHandler200({ redirect_url: 'https://sso.example.com/redirect' }),
    );

    render(
      <MockProviders>
        <SsoLogin />
      </MockProviders>,
    );

    await userEvent.click(screen.getByRole('button', { name: /sign in with sso/i }));

    await waitFor(() => {
      expect(window.location.href).toBe('https://sso.example.com/redirect');
    });
  });

  it('should display error message on failed SSO login', async () => {
    server.use(getGetCurrentUserMockHandler(undefined));
    server.use(
      getRequestSsoLoginMockHandler404({
        error: 'SSO not configured',
        message: 'SSO not configured',
      }),
    );

    render(
      <MockProviders>
        <SsoLogin />
      </MockProviders>,
    );

    await userEvent.click(screen.getByRole('button', { name: /sign in with sso/i }));

    expect(await screen.findByText('SSO not configured')).toBeInTheDocument();
  });

  it('should navigate to organization dashboard if current user has memberships', async () => {
    server.use(
      getGetCurrentUserMockHandler({
        ...getGetCurrentUserResponseMock(),
        organization_memberships: [{ id: 'org-1' }, { id: 'org-2' }, { id: 'org-3' }],
      }),
    );

    render(
      <MockProviders>
        <SsoLogin />
      </MockProviders>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/orgs/org-1/projects');
    });
  });

  it('should navigate to no-organization page if current user has no memberships', async () => {
    server.use(
      getGetCurrentUserMockHandler({
        ...getGetCurrentUserResponseMock(),
        organization_memberships: [],
      }),
    );

    render(
      <MockProviders>
        <SsoLogin />
      </MockProviders>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});
