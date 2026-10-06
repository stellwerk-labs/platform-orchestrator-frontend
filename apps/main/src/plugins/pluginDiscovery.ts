import { useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { customInstance, ErrorType } from '@src/custom-instance';

import type { PluginDiscoveryResponse } from './types';

export const listPlugins = (orgId: string, options?: AxiosRequestConfig, signal?: AbortSignal) =>
  customInstance<PluginDiscoveryResponse>(
    {
      url: `/orgs/${encodeURIComponent(orgId)}/plugins`,
      method: 'GET',
      signal,
    },
    options,
  );

export const getListPluginsQueryKey = (orgId: string) => [`/orgs/${orgId}/plugins`] as const;

export const useListPlugins = (orgId: string) =>
  useQuery<PluginDiscoveryResponse, ErrorType<unknown>>({
    queryKey: getListPluginsQueryKey(orgId),
    queryFn: ({ signal }) => listPlugins(orgId, undefined, signal),
    enabled: orgId.length > 0,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
