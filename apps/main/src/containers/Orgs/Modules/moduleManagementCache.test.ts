import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { invalidateModuleManagementQueries } from './moduleManagementCache';

describe('Module Management lifecycle cache invalidation', () => {
  it('invalidates detail, predecessor, filtered history and catalogue without touching another Module', async () => {
    const client = new QueryClient();
    const changed = [
      ['/orgs/atlas/module-catalogue', { include_archived: true }],
      ['/orgs/atlas/modules'],
      ['/orgs/atlas/modules/redis'],
      ['/orgs/atlas/modules/redis/catalogue'],
      ['/orgs/atlas/modules/redis/versions', { include_deprecated: true }],
      ['/orgs/atlas/modules/redis/versions/previous'],
      ['/orgs/atlas/modules/redis/versions/previous/events'],
      ['/orgs/atlas/modules/redis/versions/current/usage'],
    ];
    const untouched = [
      ['/orgs/atlas/modules/redis-other/catalogue'],
      ['/orgs/elsewhere/module-catalogue'],
    ];
    for (const key of [...changed, ...untouched]) client.setQueryData(key, { current: true });
    await invalidateModuleManagementQueries(client, 'atlas', 'redis');
    for (const key of changed) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of untouched) expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    client.clear();
  });
});
