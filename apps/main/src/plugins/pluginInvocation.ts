import type { AxiosRequestConfig } from 'axios';

import { customInstance } from '@src/custom-instance';

import type { PluginInvocationRequest, PluginInvocationResponse } from './types';

export const invokePluginOperation = (
  orgId: string,
  pluginId: string,
  body: PluginInvocationRequest,
  options?: AxiosRequestConfig,
) =>
  customInstance<PluginInvocationResponse>(
    {
      url: `/orgs/${encodeURIComponent(orgId)}/plugins/${encodeURIComponent(pluginId)}/invoke`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: body,
    },
    options,
  );
