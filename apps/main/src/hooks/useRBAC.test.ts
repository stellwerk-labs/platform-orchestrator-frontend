import { describe, expect, it } from 'vitest';

import { permissionAllowed, RBACPermission } from './useRBAC';

describe('scoped permission decisions', () => {
  const check = {
    resource: 'env:environment-one',
    permission: RBACPermission.MODULE_VERSION_UNPIN,
  };

  it('denies missing, denied, and unrelated results', () => {
    expect(permissionAllowed(undefined, check)).toBe(false);
    expect(permissionAllowed({ items: [] }, check)).toBe(false);
    expect(permissionAllowed({ items: [{ permission_check: check, allowed: false }] }, check)).toBe(
      false,
    );
    expect(
      permissionAllowed(
        {
          items: [
            { permission_check: { ...check, resource: 'env:environment-two' }, allowed: true },
          ],
        },
        check,
      ),
    ).toBe(false);
  });

  it('matches both exact scope and exact capability', () => {
    const result = { items: [{ permission_check: check, allowed: true }] };
    expect(permissionAllowed(result, check)).toBe(true);
    expect(
      permissionAllowed(result, { ...check, permission: RBACPermission.MODULE_VERSION_PIN }),
    ).toBe(false);
    expect(permissionAllowed(result, { ...check, resource: 'organization:atlas' })).toBe(false);
  });

  it('does not infer Core permissions from generic or add-on powers', () => {
    for (const permission of [
      'manage',
      'write',
      'rollout.pin-override',
      'module.version.pin-override',
    ]) {
      expect(
        permissionAllowed(
          { items: [{ permission_check: { ...check, permission }, allowed: true }] },
          check,
        ),
      ).toBe(false);
    }
  });
});
