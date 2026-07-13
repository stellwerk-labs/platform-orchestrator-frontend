import { Navigate, RouteObject, UIMatch } from 'react-router';

import { ErrorPage } from '@src/components/shared/ErrorPage/ErrorPage';
import { EnvironmentTypes } from '@src/containers/Orgs/EnvironmentTypes/containers/EnvironmentTypes';
import { MembershipDetails } from '@src/containers/Orgs/OrgMembers/MembershipDetails';
import { OrgMembers } from '@src/containers/Orgs/OrgMembers/OrgMembers';
import { OrgsRoot } from '@src/containers/Orgs/OrgsRoot';
import { Profile } from '@src/containers/Orgs/Profile/Profile';
import { ProviderConfiguration } from '@src/containers/Orgs/Providers/containers/ProviderDetails/components/ProviderConfiguration';
import { ProviderDetails } from '@src/containers/Orgs/Providers/containers/ProviderDetails/ProviderDetails';
import { ProvidersList } from '@src/containers/Orgs/Providers/containers/ProvidersList';
import { Providers } from '@src/containers/Orgs/Providers/Providers';
import { ResourceTypes } from '@src/containers/Orgs/ResourceTypes/containers/ResourceTypes';
import { ResourceTypeSchema } from '@src/containers/Orgs/ResourceTypes/containers/ResourceTypesDetails/containers/ResourceTypeSchema';
import { ResourceTypesDetails } from '@src/containers/Orgs/ResourceTypes/containers/ResourceTypesDetails/ResourceTypesDetails';
import { RunnerConfiguration } from '@src/containers/Orgs/Runners/containers/RunnerDetails/components/RunnerConfiguration';
import { RunnerRules } from '@src/containers/Orgs/Runners/containers/RunnerDetails/components/RunnerRules';
import { RunnerStateStorageConfiguration } from '@src/containers/Orgs/Runners/containers/RunnerDetails/components/RunnerStateStorageConfiguration';
import { RunnerDetails } from '@src/containers/Orgs/Runners/containers/RunnerDetails/RunnerDetails';
import { RunnersList } from '@src/containers/Orgs/Runners/containers/RunnersList';
import { Runners } from '@src/containers/Orgs/Runners/Runners';
import { ServiceUserDetails } from '@src/containers/Orgs/ServiceUsers/ServiceUserDetails';
import { ServiceUsers } from '@src/containers/Orgs/ServiceUsers/ServiceUsers';
import { i18n } from '@src/i18n/i18n';
import { moduleRoutes } from '@src/router/module-routes';
import {
  generateOrgMembersUrl,
  generateProvidersUrl,
  generateResourceTypesUrl,
  generateRunnersUrl,
  generateServiceUsersUrl,
} from '@src/utilities/navigation';

import { projectRoutes } from './project-routes';

const translations = i18n.t('NAVIGATION');

export const orgRoutes: RouteObject[] = [
  { index: true, element: <OrgsRoot /> },
  ...projectRoutes,
  ...moduleRoutes,
  {
    path: 'environment-types',
    handle: {
      crumbs: () => [{ label: translations.SETTINGS, name: translations.ENVIRONMENT_TYPES }],
    },
    element: <EnvironmentTypes />,
  },
  {
    path: 'resource-types',
    handle: {
      crumbs: () => [{ label: translations.SETTINGS, name: 'Resource types' }],
    },
    element: <ResourceTypes />,
  },
  {
    path: 'resource-types/:resourceTypeId',
    element: <ResourceTypesDetails />,
    children: [
      {
        index: true,
        element: <Navigate to={'schema'} replace />,
      },
      {
        path: 'schema',
        element: <ResourceTypeSchema />,
      },
    ],
    handle: {
      crumbs: (match: UIMatch) => [
        {
          label: translations.SETTINGS,
          name: 'Resource types',
          pathname: generateResourceTypesUrl(match?.params?.orgId || ''),
        },
        {
          label: 'Resource type',
          name: match?.params.resourceTypeId,
        },
      ],
    },
  },
  {
    path: 'runners',
    handle: {
      crumbs: () => [{ label: translations.SETTINGS, name: 'Runners' }],
    },
    children: [
      {
        index: true,
        element: <Navigate to={'list'} replace />,
      },
      {
        path: 'list',
        element: <RunnersList />,
      },
    ],
    element: <Runners />,
  },
  {
    path: 'runners/:runnerId',
    element: <RunnerDetails />,
    children: [
      {
        index: true,
        element: <Navigate to={'runner_configuration'} replace />,
      },
      {
        path: 'runner_configuration',
        element: <RunnerConfiguration />,
      },
      {
        path: 'state_storage_configuration',
        element: <RunnerStateStorageConfiguration />,
      },
      {
        path: 'rules',
        element: <RunnerRules />,
      },
    ],
    handle: {
      crumbs: (match: UIMatch) => [
        {
          label: translations.SETTINGS,
          name: 'Runners',
          pathname: generateRunnersUrl(match?.params?.orgId || ''),
        },
        {
          label: 'Runner',
          name: match?.params.runnerId,
        },
      ],
    },
  },
  {
    path: 'providers',
    handle: {
      crumbs: () => [{ label: translations.SETTINGS, name: 'Providers' }],
    },
    children: [
      {
        index: true,
        element: <Navigate to={'list'} replace />,
      },
      {
        path: 'list',
        element: <ProvidersList />,
      },
    ],
    element: <Providers />,
  },
  {
    path: 'providers/:providerType/:providerId',
    element: <ProviderDetails />,
    children: [
      {
        index: true,
        element: <Navigate to={'configuration'} replace />,
      },
      {
        path: 'configuration',
        element: <ProviderConfiguration />,
      },
    ],
    handle: {
      crumbs: (match: UIMatch) => [
        {
          label: translations.SETTINGS,
          name: 'Providers',
          pathname: generateProvidersUrl(match?.params?.orgId || ''),
        },
        {
          label: 'Provider',
          name: match?.params.providerId,
        },
      ],
    },
  },
  {
    path: 'members',
    handle: {
      crumbs: () => [{ label: translations.SETTINGS, name: 'Memberships' }],
    },
    element: <OrgMembers />,
  },
  {
    path: 'members/:userId',
    handle: {
      crumbs: (match: UIMatch) => [
        {
          label: translations.SETTINGS,
          name: 'Members',
          pathname: generateOrgMembersUrl(match?.params?.orgId || ''),
        },
        {
          label: translations.MEMBER,
          name: match?.params.userId,
        },
      ],
    },
    element: <MembershipDetails />,
  },
  {
    path: 'service-users',
    handle: {
      crumbs: () => [{ label: translations.SETTINGS, name: 'Service users' }],
    },
    element: <ServiceUsers />,
  },
  {
    path: 'service-users/:serviceUserId',
    handle: {
      crumbs: (match: UIMatch) => [
        {
          label: translations.SETTINGS,
          name: 'Service users',
          pathname: generateServiceUsersUrl(match?.params?.orgId || ''),
        },
        {
          label: 'Service user',
          name: match?.params.serviceUserId,
        },
      ],
    },
    element: <ServiceUserDetails />,
  },
  {
    path: 'profile',
    handle: {
      crumbs: () => [{ label: translations.SETTINGS, name: 'Profile' }],
    },
    element: <Profile />,
  },
  { path: '*', element: <ErrorPage /> },
];
