import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MockProviders } from '@src/testing-utils/MockProviders';

import { DeploymentErrorDisplay } from './DeploymentErrorDisplay';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

describe('DeploymentErrorDisplay', () => {
  it('should render friendly error message', () => {
    const errorMessage = JSON.stringify({
      summary: 'Module configuration failed',
      detail: 'The S3 bucket could not be created',
    });

    render(
      <MockProviders>
        <DeploymentErrorDisplay statusMessage={errorMessage} />
      </MockProviders>,
    );

    expect(screen.getByText('Module configuration failed')).toBeTruthy();
    expect(screen.getByText('Show full error')).toBeTruthy();
  });

  it('should open drawer when "Show full error" is clicked', async () => {
    const errorMessage = JSON.stringify({
      summary: 'Test error',
    });

    render(
      <MockProviders>
        <DeploymentErrorDisplay statusMessage={errorMessage} />
      </MockProviders>,
    );

    const showButton = screen.getByText('Show full error');
    await userEvent.click(showButton);

    await waitFor(() => {
      expect(screen.getByText('Deployment Error Details')).toBeTruthy();
    });
  });

  it('should display module information when available', async () => {
    const errorMessage = JSON.stringify({
      summary: 'Module error',
      module_id: 'acme/s3-bucket',
      module_version: '1.0.0',
    });

    render(
      <MockProviders>
        <DeploymentErrorDisplay statusMessage={errorMessage} />
      </MockProviders>,
    );

    await userEvent.click(screen.getByText('Show full error'));

    await waitFor(() => {
      expect(screen.getByText('Module ID')).toBeTruthy();
      expect(screen.getByText('acme/s3-bucket')).toBeTruthy();
      expect(screen.getByText('Module Version')).toBeTruthy();
      expect(screen.getByText('1.0.0')).toBeTruthy();
    });
  });

  it('should display provider information when available', async () => {
    const errorMessage = JSON.stringify({
      summary: 'Provider error',
      provider_type: 'aws',
      provider_id: 'my-aws-account',
    });

    render(
      <MockProviders>
        <DeploymentErrorDisplay statusMessage={errorMessage} />
      </MockProviders>,
    );

    await userEvent.click(screen.getByText('Show full error'));

    await waitFor(() => {
      expect(screen.getByText('Provider Type')).toBeTruthy();
      expect(screen.getByText('aws')).toBeTruthy();
      expect(screen.getByText('Provider ID')).toBeTruthy();
      expect(screen.getByText('my-aws-account')).toBeTruthy();
    });
  });

  it('should toggle between Pretty JSON and Raw views', async () => {
    const errorMessage = JSON.stringify({
      summary: 'Test error',
      detail: 'Test detail',
    });

    render(
      <MockProviders>
        <DeploymentErrorDisplay statusMessage={errorMessage} />
      </MockProviders>,
    );

    await userEvent.click(screen.getByText('Show full error'));

    // Should start in Pretty JSON mode
    await waitFor(() => {
      expect(screen.getByText('Pretty JSON')).toBeTruthy();
    });

    // Click Raw button
    const rawButton = screen.getByText('Raw');
    await userEvent.click(rawButton);

    // Should show raw JSON
    await waitFor(() => {
      const preElement = screen.getByText((content, element) => {
        return element?.tagName === 'PRE' && content.includes(errorMessage);
      });
      expect(preElement).toBeTruthy();
    });
  });

  it('should copy error to clipboard when copy button is clicked', async () => {
    const errorMessage = JSON.stringify({ summary: 'Test error message' });
    const writeTextMock = vi.fn(() => Promise.resolve());
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <MockProviders>
        <DeploymentErrorDisplay statusMessage={errorMessage} />
      </MockProviders>,
    );

    await userEvent.click(screen.getByText('Show full error'));

    const copyButton = screen.getByText('Copy');
    await userEvent.click(copyButton);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(errorMessage);
    });
  });

  it('should handle plain text errors', async () => {
    const errorMessage =
      'runner failed with code TF_ERROR: failed to assume role: https response error StatusCode: 403, RequestID: abc123, api error AccessDenied: Not authorized to perform sts:AssumeRoleWithWebIdentity';

    render(
      <MockProviders>
        <DeploymentErrorDisplay statusMessage={errorMessage} />
      </MockProviders>,
    );

    expect(screen.getByText(errorMessage)).toBeTruthy();
    expect(screen.queryByText('Show full error')).toBeNull();
  });

  it('should display workload information when available', async () => {
    const errorMessage = JSON.stringify({
      summary: 'Output error',
      entity_type: 'output',
      workload: 'backend-api',
    });

    render(
      <MockProviders>
        <DeploymentErrorDisplay statusMessage={errorMessage} />
      </MockProviders>,
    );

    await userEvent.click(screen.getByText('Show full error'));

    await waitFor(() => {
      expect(screen.getByText('Workload')).toBeTruthy();
      expect(screen.getByText('backend-api')).toBeTruthy();
    });
  });
});
