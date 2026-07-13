import { Navigate, Outlet, RouteObject, UIMatch } from 'react-router';

import { Access as ProjectAccess } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewApplication/components/Access/Access';
import { Environments } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewApplication/components/Environments/Environments';
import { Manifest } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewDeployment/components/Manifest';
import { Resources } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewDeployment/components/Resources';
import { ViewDeployment } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewDeployment/ViewDeployment';
import { Access as EnvAccess } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewEnvironment/components/Access/Access';
import { AvailableResourceTypes } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewEnvironment/components/AvailableResourceTypes/AvailableResourceTypes';
import { Deploys } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewEnvironment/components/Deploys/Deploys';
import { EnvResources } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewEnvironment/components/EnvResources/EnvResources';
import { EnvStatus } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewEnvironment/components/EnvStatus/EnvStatus';
import { ViewEnvironment } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewEnvironment/ViewEnvironment';
import { Project } from '@src/containers/Orgs/Projects/containers/Project/Project';
import { ProjectList } from '@src/containers/Orgs/Projects/containers/ProjectList/ProjectList';
import { BreadcrumbData } from '@src/types/router';
import { getSharedBreadcrumbs } from '@src/utilities/breadcrumbs-utils';
import { generateProjectsUrl } from '@src/utilities/navigation';

const deploymentOrDeltaTabRoutes: RouteObject[] = [
  {
    index: true,
    element: <Navigate to={'resources'} replace />,
  },
  {
    path: 'resources',
    element: <Resources />,
  },
  {
    path: 'manifest',
    element: <Manifest />,
  },
];

export const projectRoutes: RouteObject[] = [
  {
    path: 'projects',
    element: <Outlet />,
    handle: {
      crumbs: (match?: UIMatch) => ({
        name: 'Projects',
        pathname: generateProjectsUrl(match?.params.orgId || ''),
      }),
    },
    children: [
      {
        index: true,
        element: <ProjectList />,
      },
      {
        path: ':projectId',
        element: <Project />,
        handle: {
          crumbs: (match: UIMatch, data: BreadcrumbData) => getSharedBreadcrumbs(match, data),
        },
        children: [
          { index: true, element: <Navigate to={'envs'} replace /> },
          { path: 'envs', element: <Environments /> },
          { path: 'access', element: <ProjectAccess /> },
        ],
      },
    ],
  },
  {
    path: 'projects/:projectId/envs/:envId',
    element: <ViewEnvironment />,
    handle: {
      crumbs: (match: UIMatch, data: BreadcrumbData) => getSharedBreadcrumbs(match, data),
    },
    children: [
      { index: true, element: <Navigate to={'status'} replace /> },
      { path: 'status', element: <EnvStatus /> },
      { path: 'deploys', element: <Deploys /> },
      { path: 'active-resources', element: <EnvResources /> },
      { path: 'available-resource-types', element: <AvailableResourceTypes /> },
      { path: 'access', element: <EnvAccess /> },
    ],
  },
  {
    path: 'projects/:projectId/envs/:envId/deploys/:deployId',
    element: <ViewDeployment />,
    handle: {
      crumbs: (match: UIMatch, data: BreadcrumbData) => [...getSharedBreadcrumbs(match, data)],
    },
    children: deploymentOrDeltaTabRoutes,
  },
];
