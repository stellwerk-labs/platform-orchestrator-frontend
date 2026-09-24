import type { QueryClient } from '@tanstack/react-query';

import {
  getGetModuleQueryKey,
  getListModuleCatalogueEntriesQueryKey,
  getListModulesQueryKey,
} from '@src/hooks/react-query/v2/controlplane/modules/modules';

export const invalidateModuleManagementQueries = (
  queryClient: QueryClient,
  orgId: string,
  moduleId: string,
) => {
  const [modulePath] = getGetModuleQueryKey(orgId, moduleId);
  const listPaths: string[] = [
    getListModuleCatalogueEntriesQueryKey(orgId)[0],
    getListModulesQueryKey(orgId)[0],
  ];
  return queryClient.invalidateQueries({
    predicate: ({ queryKey }) => {
      const path = queryKey[0];
      return (
        typeof path === 'string' &&
        (path === modulePath || path.startsWith(`${modulePath}/`) || listPaths.includes(path))
      );
    },
  });
};
