import yaml from 'js-yaml';
import { useParams } from 'react-router';

import { SyntaxHighlighting } from '@src/components/shared/SyntaxHighlighting';
import { MatchParams } from '@src/config/routing';
import { useGetRunner } from '@src/hooks/react-query/v2/controlplane/runner/runner';

export const RunnerStateStorageConfiguration = () => {
  // router
  const { orgId, runnerId } = useParams<keyof MatchParams>() as MatchParams;
  // React Query
  const { data: runner } = useGetRunner(orgId, runnerId);
  return (
    <SyntaxHighlighting language={'yaml'} text={yaml.dump(runner?.state_storage_configuration)} />
  );
};
