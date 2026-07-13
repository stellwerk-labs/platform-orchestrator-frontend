import { InteractionStatus } from '@azure/msal-browser';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MicrosoftButton } from './MicrosoftButton';

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

vi.mock('@src/utilities/monitoring', () => ({
  trackError: vi.fn(),
}));

// Mock Microsoft logo
vi.mock('@src/assets/svg/microsoft.svg', () => ({
  default: 'mock-microsoft-logo.svg',
}));

describe('MicrosoftButton', () => {
  const mockMicrosoftAuthSuccess = vi.fn();

  const defaultProps = {
    type: 'login' as const,
    microsoftAuthSuccess: mockMicrosoftAuthSuccess,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render Microsoft button with login text', () => {
    render(<MicrosoftButton {...defaultProps} />);

    const microsoftButton = screen.getByRole('button', { name: /sign in with microsoft/i });
    expect(microsoftButton).toBeInTheDocument();
    expect(microsoftButton).not.toBeDisabled();
  });

  it('should render Microsoft button with register text when type is register', () => {
    render(<MicrosoftButton {...defaultProps} type={'register'} />);

    const microsoftButton = screen.getByRole('button', { name: /sign up with microsoft/i });
    expect(microsoftButton).toBeInTheDocument();
    expect(microsoftButton).not.toBeDisabled();
  });

  it('should be disabled when MSAL authentication is in progress', async () => {
    const msalReact = await import('@azure/msal-react');
    const useMsalSpy = vi.spyOn(msalReact, 'useMsal').mockReturnValue({
      instance: {
        loginPopup: vi.fn(),
        clearCache: vi.fn(),
      } as any,
      inProgress: InteractionStatus.HandleRedirect,
      accounts: [],
      logger: {} as any,
    });

    render(<MicrosoftButton {...defaultProps} />);

    const microsoftButton = screen.getByRole('button', { name: /sign in with microsoft/i });
    expect(microsoftButton).toBeDisabled();

    useMsalSpy.mockRestore();
  });
});
