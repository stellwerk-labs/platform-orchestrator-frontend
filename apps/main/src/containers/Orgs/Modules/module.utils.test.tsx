import { describe, expect, it } from 'vitest';

import { getModuleSourceUrl } from '@src/containers/Orgs/Modules/module-utils';

describe('module utils', () => {
  it('should return the correct module source url', () => {
    expect(getModuleSourceUrl('git::http://example.com')).toEqual('http://example.com');
    expect(getModuleSourceUrl('ssh::http://example.com')).toEqual('http://example.com');
    expect(getModuleSourceUrl('http://example.com')).toEqual('http://example.com');
  });
});
