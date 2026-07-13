import { describe, expect, it } from 'vitest';

import { buildQueryString } from '@src/hooks/react-query/query-utils';

describe('query-utils', () => {
  describe('buildQueryString', () => {
    it('should return the correct query param string', () => {
      const filters = {
        name: 'test-name',
        age: '50',
        hobby: ['football', 'basketball'],
      };
      expect(buildQueryString(filters)).toEqual(
        '?name=test-name&age=50&hobby=football&hobby=basketball',
      );
    });
  });
});
