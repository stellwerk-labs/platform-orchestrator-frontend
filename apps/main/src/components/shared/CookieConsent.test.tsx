import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { MockProviders } from '@src/testing-utils/MockProviders';

import { CookieConsent } from './CookieConsent';

const renderCookieConsent = () =>
  render(
    <MockProviders>
      <CookieConsent />
    </MockProviders>,
  );

describe('CookieConsent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the banner when no consent is stored', async () => {
    renderCookieConsent();
    expect(await screen.findByText(/we use cookies/i)).toBeVisible();
  });

  it('does not show the banner when consent is already stored', () => {
    localStorage.setItem('cookieConsent', 'accepted');
    renderCookieConsent();
    expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument();
  });

  it('hides the banner and stores consent when Accept is clicked', async () => {
    renderCookieConsent();
    await userEvent.click(await screen.findByRole('button', { name: /accept/i }));
    expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument();
    expect(localStorage.getItem('cookieConsent')).toBe('accepted');
  });

  it('hides the banner and stores consent when Decline is clicked', async () => {
    renderCookieConsent();
    await userEvent.click(await screen.findByRole('button', { name: /decline/i }));
    expect(screen.queryByText(/we use cookies/i)).not.toBeInTheDocument();
    expect(localStorage.getItem('cookieConsent')).toBe('declined');
  });
});
