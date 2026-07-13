import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { DOCS_CLI } from '@src/config/docs-links';
import { Device } from '@src/containers/Device';
import {
  getAcceptDeviceLoginRequestMockHandler404,
  getGetDeviceLoginRequestMockHandler,
  getRejectDeviceLoginRequestMockHandler,
} from '@src/hooks/react-query/v2/iam/device/device.msw';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';

describe('Device login', () => {
  beforeEach(async () => {
    server.use(
      getGetDeviceLoginRequestMockHandler(),
      getAcceptDeviceLoginRequestMockHandler404(),
      getRejectDeviceLoginRequestMockHandler(),
    );
    render(
      <MockProviders>
        <Device />
      </MockProviders>,
    );
    await waitFor(() => {
      expect(screen.getByText('Login Request')).toBeVisible();
    });
  });
  it('should show an error if accepting the login device returns an error', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(
      await screen.findByText(/Your login request has expired. Please log in again via/),
    ).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
    });
    expect(await screen.findByRole('link')).toHaveAttribute('href', DOCS_CLI);
  });
  it('should show the IP, region and city fields', async () => {
    expect(await screen.findByText('IP')).toBeVisible();
    expect(await screen.findByText('City')).toBeVisible();
    expect(await screen.findByText('Region')).toBeVisible();
  });
});
