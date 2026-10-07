import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PluginAvailabilityNotice } from './PluginAvailabilityNotice';
import type { PluginDescriptor, PluginFeatureAccess } from './types';

const access: PluginFeatureAccess = {
  state: 'valid',
  trust_class: 'production',
  forward: true,
  read: true,
  safety: true,
};

const graceUntil = '2026-10-14T12:00:00Z';

const plugin: PluginDescriptor = {
  id: 'dev.example.plugin',
  display_name: 'Example plugin',
  state: 'available',
  mode: 'full',
  operations: [],
};

describe('plugin availability notice', () => {
  it('does not label unlicensed or production plugins as development', () => {
    const { rerender } = render(<PluginAvailabilityNotice plugin={plugin} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    rerender(
      <PluginAvailabilityNotice
        plugin={{ ...plugin, entitlement: { features: { example: access } } }}
      />,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('visibly marks development-only trust supplied by Core', () => {
    render(
      <PluginAvailabilityNotice
        plugin={{
          ...plugin,
          entitlement: { features: { example: { ...access, trust_class: 'development' } } },
        }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Example plugin: development licence');
    expect(screen.getByRole('alert')).toHaveTextContent('not a production licence');
  });

  it.each(['not_enabled', 'not_entitled'] as const)(
    'explains retained safety without promising permissions when %s',
    (state) => {
      render(<PluginAvailabilityNotice plugin={{ ...plugin, state, mode: 'safety_only' }} />);
      expect(screen.getByRole('alert')).toHaveTextContent('new work disabled');
      expect(screen.getByRole('alert')).toHaveTextContent('according to your permissions');
      expect(screen.getByRole('alert')).toHaveTextContent('Renewal does not restart paused work');
    },
  );

  it('shows partial feature access without claiming all forward work is disabled', () => {
    render(
      <PluginAvailabilityNotice
        plugin={{
          ...plugin,
          entitlement: {
            features: {
              available: access,
              expired: { ...access, state: 'expired', forward: false },
            },
          },
        }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('limited licence access');
    expect(screen.getByRole('alert')).not.toHaveTextContent('new work disabled');
  });

  it('shows the Core grace warning with its end next to a fully usable plugin', () => {
    render(
      <PluginAvailabilityNotice
        plugin={{
          ...plugin,
          entitlement: {
            features: { example: { ...access, state: 'grace', grace_until: graceUntil } },
            warning: {
              code: 'plugin_entitlement_grace',
              message:
                'The signed plugin licence is in its grace period. Ask an administrator to renew it.',
              grace_until: graceUntil,
              features: ['example'],
            },
          },
        }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Example plugin: licence grace period until 14 Oct 2026, 12:00 UTC',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The signed plugin licence is in its grace period. Ask an administrator to renew it.',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('new work disabled');
  });

  it.each([
    ['not an object', 'renew soon'],
    [
      'an empty message',
      { code: 'plugin_entitlement_grace', message: ' ', grace_until: graceUntil, features: [] },
    ],
    [
      'an unreadable end',
      { code: 'plugin_entitlement_grace', message: 'renew', grace_until: 'soon', features: [] },
    ],
    [
      'malformed features',
      {
        code: 'plugin_entitlement_grace',
        message: 'renew',
        grace_until: graceUntil,
        features: [1],
      },
    ],
  ])('ignores a grace warning with %s', (_, warning) => {
    render(
      <PluginAvailabilityNotice
        plugin={{ ...plugin, entitlement: { features: { example: access }, warning } }}
      />,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('updates from development expiry to valid production without retaining stale warnings', () => {
    const { rerender } = render(
      <PluginAvailabilityNotice
        plugin={{
          ...plugin,
          state: 'not_entitled',
          mode: 'safety_only',
          entitlement: {
            features: {
              example: { ...access, state: 'expired', trust_class: 'development', forward: false },
            },
          },
        }}
      />,
    );
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    rerender(
      <PluginAvailabilityNotice
        plugin={{ ...plugin, entitlement: { features: { example: access } } }}
      />,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
