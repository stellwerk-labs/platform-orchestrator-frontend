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
