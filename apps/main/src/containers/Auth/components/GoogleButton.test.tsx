import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GoogleButton } from './GoogleButton';

// Mock environment
vi.mock('@src/config/environment', () => ({
  windowEnv: {
    GOOGLE_CLIENT_ID: 'test-client-id',
  },
}));

// Mock Google API
const mockGoogleAccounts = {
  id: {
    initialize: vi.fn(),
    renderButton: vi.fn(),
  },
};

describe('GoogleButton', () => {
  const mockGoogleAuthSuccess = vi.fn();
  const defaultProps = {
    googleAuthSuccess: mockGoogleAuthSuccess,
    type: 'login' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Remove any existing Google script from DOM
    delete (window as any).google;

    const existingScript = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]',
    );

    if (existingScript) {
      existingScript.remove();
    }
  });

  it('should error when Google script not found', async () => {
    render(<GoogleButton {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Google Sign-In script not loaded')).toBeInTheDocument();
    });
  });

  it('should have a loading state', async () => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    document.head.appendChild(script);

    render(<GoogleButton {...defaultProps} />);

    // Should show skeleton while waiting
    expect(document.querySelector('.ant-skeleton-button')).toBeInTheDocument();
  });

  it('should call google initialize and render', async () => {
    (window as any).google = {
      accounts: mockGoogleAccounts,
    };

    render(<GoogleButton {...defaultProps} />);

    await waitFor(() => {
      expect(mockGoogleAccounts.id.initialize).toHaveBeenCalledTimes(1);
    });

    expect(mockGoogleAccounts.id.initialize).toHaveBeenCalledWith({
      client_id: 'test-client-id',
      callback: expect.any(Function),
    });

    await waitFor(() => {
      expect(mockGoogleAccounts.id.renderButton).toHaveBeenCalledTimes(1);
    });

    expect(mockGoogleAccounts.id.renderButton).toHaveBeenCalledWith(expect.any(HTMLElement), {
      logo_alignment: 'center',
      locale: 'en',
      width: 300,
      text: 'signin_with',
    });
  });
});
