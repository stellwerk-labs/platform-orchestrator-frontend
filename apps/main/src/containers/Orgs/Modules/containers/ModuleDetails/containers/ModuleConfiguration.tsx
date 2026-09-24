import yaml from 'js-yaml';
import { useParams } from 'react-router';

import { SyntaxHighlighting } from '@src/components/shared/SyntaxHighlighting';
import { MatchParams } from '@src/config/routing';
import {
  useGetModule,
  useGetModuleCatalogueEntry,
} from '@src/hooks/react-query/v2/controlplane/modules/modules';

export const ModuleConfiguration = () => {
  // router
  const { orgId, moduleId } = useParams<keyof MatchParams>() as MatchParams;
  // React Query
  const { data: catalogue } = useGetModuleCatalogueEntry(orgId, moduleId);
  const { data: moduleDefinition } = useGetModule(orgId, moduleId, {
    query: { enabled: Boolean(catalogue?.current_default_version_uuid) },
  });

  return (
    <SyntaxHighlighting
      language={'yaml'}
      text={yaml.dump({ catalogue, current_default_definition: moduleDefinition ?? null })}
    />
  );
};
