import { InteractionStatus } from '@azure/msal-browser';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFeatures = vi.hoisted(() => ({ socialLogins: true }));

vi.mock('@src/config/features', () => ({
  get features() {
    return mockFeatures;
  },
}));

// Mock Google API
const mockGoogleAccounts = {
  id: {
    initialize: vi.fn(),
    renderButton: vi.fn((element: HTMLElement) => {
      element.innerHTML = '<div role="button">Sign in with Google</div>';
    }),
  },
};

// Mock Microsoft MSAL
vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({
    instance: {
      loginPopup: vi.fn(),
      clearCache: vi.fn(),
    } as any,
    inProgress: InteractionStatus.None,
    accounts: [],
    logger: {} as any,
  }),
}));

vi.mock('@src/config/environment', () => ({
  windowEnv: {
    GOOGLE_CLIENT_ID: 'mock-google-client-id',
  },
}));

vi.mock('@src/utilities/monitoring', () => ({
  trackError: vi.fn(),
}));

vi.mock('@src/assets/svg/microsoft.svg', () => ({
  default: 'mock-microsoft-logo.svg',
}));

import { AuthButtons } from './AuthButtons';

const defaultProps = {
  type: 'login' as const,
  googleAuthSuccess: vi.fn(),
  microsoftAuthSuccess: vi.fn(),
};

describe('AuthButtons - saas mode', () => {
  beforeEach(() => {
    mockFeatures.socialLogins = true;
    vi.clearAllMocks();
    Object.defineProperty(window, 'google', {
      value: { accounts: mockGoogleAccounts },
      writable: true,
    });
  });

  it('renders Google and Microsoft buttons', async () => {
    render(<AuthButtons {...defaultProps} />);

    await waitFor(() => {
      expect(mockGoogleAccounts.id.initialize).toHaveBeenCalled();
      expect(mockGoogleAccounts.id.renderButton).toHaveBeenCalled();
    });

    expect(document.querySelector('div[class*="googleButtonContainer"]')).toBeInTheDocument();
    expect(screen.getByText(/sign in with google/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with microsoft/i })).toBeInTheDocument();
  });

  it('displays error message when provided', () => {
    render(<AuthButtons {...defaultProps} errorMessage={'Authentication failed'} />);
    expect(screen.getByText('Authentication failed')).toBeInTheDocument();
  });
});

describe('AuthButtons - self-hosted mode', () => {
  beforeEach(() => {
    mockFeatures.socialLogins = false;
    vi.clearAllMocks();
  });

  it('does not render Google or Microsoft buttons', () => {
    render(<AuthButtons {...defaultProps} />);

    expect(
      screen.queryByRole('button', { name: /sign in with microsoft/i }),
    ).not.toBeInTheDocument();
    expect(document.querySelector('div[class*="googleButtonContainer"]')).not.toBeInTheDocument();
  });
});
