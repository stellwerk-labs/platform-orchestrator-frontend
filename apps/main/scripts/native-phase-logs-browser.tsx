import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App, ConfigProvider } from 'antd';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';

import { Logs } from '../src/containers/Orgs/Projects/containers/Project/containers/ViewDeployment/components/Logs';
import { getGetEnvironmentQueryKey } from '../src/hooks/react-query/v2/controlplane/environment/environment';
import {
  getCheckPermissionsQueryKey,
  getGetCurrentUserQueryKey,
} from '../src/hooks/react-query/v2/iam/user/user';
import { RBACPermission } from '../src/hooks/useRBAC';

// Frontend fixture only. Real ciphertext, Vault custody and IAM run in DP tests.
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false } },
});
client.setQueryData(getGetCurrentUserQueryKey(), { id: 'actor' });
client.setQueryData(getGetEnvironmentQueryKey('org', 'project', 'env'), { uuid: 'environment' });
const checks = [RBACPermission.DEPLOYMENT_LOGS_READ, RBACPermission.DEPLOYMENT_READ].flatMap(
  (permission) => [
    { resource: 'organization:org', permission },
    { resource: 'env:environment', permission },
  ],
);
const grant = (allowed: boolean) =>
  client.setQueryData(getCheckPermissionsQueryKey(checks), {
    items: checks.map((permission_check) => ({ permission_check, allowed })),
  });
grant(true);
const Viewer = () => {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(true);
  return (
    <>
      <button
        onClick={() => {
          grant(!allowed);
          setAllowed(!allowed);
        }}>
        Toggle fixture permission
      </button>
      <button onClick={() => navigate('/away')}>Leave fixture deployment</button>
      <Logs />
    </>
  );
};
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <ConfigProvider>
      <App>
        <MemoryRouter
          initialEntries={['/orgs/org/projects/project/envs/env/deploys/child/logs?log=plan']}>
          <Routes>
            <Route
              path={'/orgs/:orgId/projects/:projectId/envs/:envId/deploys/:deployId/logs'}
              element={<Viewer />}
            />
            <Route path={'/away'} element={<div>Fixture deployment closed</div>} />
          </Routes>
        </MemoryRouter>
      </App>
    </ConfigProvider>
  </QueryClientProvider>,
);
