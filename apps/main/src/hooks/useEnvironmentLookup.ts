import { useCallback, useMemo } from 'react';

import {
  getListEnvironmentsInOrgQueryKey,
  listEnvironmentsInOrg,
} from '@src/hooks/react-query/v2/controlplane/environment/environment';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { Environment } from '@src/models/v2/controlplane';

export const useEnvironmentLookup = (orgId: string) => {
  const { data: environments, isLoading } = useAllPages(
    getAllPagesQueryKey(getListEnvironmentsInOrgQueryKey(orgId)),
    (params) => listEnvironmentsInOrg(orgId, params),
    undefined,
    { enabled: !!orgId },
  );

  const environmentLookup = useMemo(() => {
    const lookup: Record<string, Environment> = {};

    environments?.forEach((env) => {
      lookup[env.uuid] = env;
    });

    return lookup;
  }, [environments]);

  const findEnvironmentByUuid = useCallback(
    (environmentUuid: string): Environment | null => {
      return environmentLookup[environmentUuid] || null;
    },
    [environmentLookup],
  );

  return {
    findEnvironmentByUuid,
    isEnvironmentLookupLoading: isLoading,
  };
};
