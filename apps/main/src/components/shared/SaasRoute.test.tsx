import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MockProviders } from '@src/testing-utils/MockProviders';

import { SaasRoute } from './SaasRoute';

const mockIsSelfHosted = vi.hoisted(() => ({ value: false }));

vi.mock('@src/config/features', () => ({
  get isSelfHosted() {
    return mockIsSelfHosted.value;
  },
}));

const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid={'location'}>{location.pathname}</div>;
};

const renderSelfHostedRoute = (path: string, url: string) => {
  const router = createMemoryRouter(
    [
      {
        path,
        element: (
          <SaasRoute>
            <div>saas content</div>
          </SaasRoute>
        ),
      },
      { path: '*', element: <LocationDisplay /> },
    ],
    { initialEntries: [url] },
  );

  return render(<RouterProvider router={router} />);
};

describe('SaasRoute - self hosted mode', () => {
  beforeEach(() => {
    mockIsSelfHosted.value = true;
  });

  it('should not render children', () => {
    render(
      <MockProviders route={{ path: '/orgs/:orgId', url: '/orgs/my-org' }}>
        <SaasRoute>
          <div>saas content</div>
        </SaasRoute>
      </MockProviders>,
    );

    expect(screen.queryByText('saas content')).not.toBeInTheDocument();
  });

  it('should redirect to projects when orgId is present', () => {
    renderSelfHostedRoute('/orgs/:orgId/saas-only-route', '/orgs/my-org/saas-only-route');

    expect(screen.queryByText('saas content')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/orgs/my-org/projects');
  });

  it('should redirect to "/" when orgId is not present', () => {
    renderSelfHostedRoute('/saas-only-route', '/saas-only-route');

    expect(screen.queryByText('saas content')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });
});

describe('SaasRoute - saas mode', () => {
  beforeEach(() => {
    mockIsSelfHosted.value = false;
  });

  it('should render children', () => {
    render(
      <MockProviders route={{ path: '/orgs/:orgId', url: '/orgs/my-org' }}>
        <SaasRoute>
          <div>saas content</div>
        </SaasRoute>
      </MockProviders>,
    );

    expect(screen.getByText('saas content')).toBeVisible();
  });

  it('should not redirect orgId in route', () => {
    renderSelfHostedRoute('/orgs/:orgId/self-hosted-route', '/orgs/my-org/self-hosted-route');

    expect(screen.getByText('saas content')).toBeVisible();
  });

  it('should not redirect', () => {
    renderSelfHostedRoute('/saas-only-route', '/saas-only-route');

    expect(screen.getByText('saas content')).toBeVisible();
  });
});
