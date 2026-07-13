import yaml from 'js-yaml';
import React from 'react';
import { useParams } from 'react-router';

import { SyntaxHighlighting } from '@src/components/shared/SyntaxHighlighting';
import { MatchParams } from '@src/config/routing';
import { useGetModuleProvider } from '@src/hooks/react-query/v2/controlplane/providers/providers';

export const ProviderConfiguration = () => {
  // router
  const { orgId, providerType, providerId } = useParams<keyof MatchParams>() as MatchParams;
  // React Query
  const { data: provider } = useGetModuleProvider(orgId, providerType, providerId);
  return <SyntaxHighlighting language={'yaml'} text={yaml.dump(provider?.configuration)} />;
};
