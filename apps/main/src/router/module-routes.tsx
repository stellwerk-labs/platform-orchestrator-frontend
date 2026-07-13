import { Navigate, RouteObject, UIMatch } from 'react-router';

import { ModuleConfiguration } from '@src/containers/Orgs/Modules/containers/ModuleDetails/containers/ModuleConfiguration';
import { ModuleRules } from '@src/containers/Orgs/Modules/containers/ModuleDetails/containers/ModuleRules/ModuleRules';
import { ModuleDetails } from '@src/containers/Orgs/Modules/containers/ModuleDetails/ModuleDetails';
import { Modules } from '@src/containers/Orgs/Modules/containers/Modules/Modules';
import { ModulesMain } from '@src/containers/Orgs/Modules/ModulesMain';
import { i18n } from '@src/i18n/i18n';
import { generateModulesUrl } from '@src/utilities/navigation';

const translations = i18n.t('NAVIGATION');

export const moduleRoutes: RouteObject[] = [
  {
    path: 'modules',
    handle: {
      crumbs: () => [
        {
          label: translations.SETTINGS,
          name: translations.MODULE_DEFINITIONS,
        },
      ],
    },
    element: <ModulesMain />,
    children: [
      {
        index: true,
        element: <Navigate to={'definitions'} replace />,
      },
      {
        path: 'definitions',
        element: <Modules />,
      },
    ],
  },
  {
    path: 'modules/:moduleId',
    element: <ModuleDetails />,
    children: [
      {
        path: 'configuration',
        element: <ModuleConfiguration />,
      },
      {
        path: 'rules',
        element: <ModuleRules />,
      },
    ],
    handle: {
      crumbs: (match: UIMatch) => [
        {
          label: translations.SETTINGS,
          name: translations.MODULE_DEFINITIONS,
          pathname: generateModulesUrl(match?.params?.orgId || ''),
        },
        {
          label: translations.DEFINITION,
          name: match?.params.moduleId,
        },
      ],
    },
  },
];
