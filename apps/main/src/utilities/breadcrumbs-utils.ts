import { UIMatch } from 'react-router';

import { i18n } from '@src/i18n/i18n';
import { BreadcrumbData } from '@src/types/router';
import { generateAppUrl, generateDeploymentUrl } from '@src/utilities/navigation';

const translations = i18n.t('NAVIGATION');

export const getSharedBreadcrumbs = (match?: UIMatch, data?: BreadcrumbData) => {
  const sharedCrumbs = [
    {
      name: data?.project?.display_name,
      label: translations?.PROJECT,
      pathname: generateAppUrl(match?.params.orgId || '', match?.params.projectId),
    },
  ];

  if (match?.params.envId) {
    sharedCrumbs.push({
      name: data?.env?.display_name,
      label: translations?.ENV,
      pathname: generateAppUrl(
        match?.params.orgId || '',
        match?.params.projectId,
        match?.params.envId,
      ),
    });
  }

  if (match?.params.deployId) {
    // Add "Deployments" breadcrumb that links to the deploys page
    sharedCrumbs.push({
      name: 'Deployments',
      label: 'Deployments',
      pathname: `${generateAppUrl(
        match?.params.orgId || '',
        match?.params.projectId,
        match?.params.envId,
      )}/deploys`,
    });

    // Add specific deployment breadcrumb if deployment data is available
    if (data?.deployment) {
      sharedCrumbs.push({
        label: translations?.DEPLOY,
        name: data?.deployment.id,
        pathname: generateDeploymentUrl(
          match?.params.orgId || '',
          match?.params.projectId || '',
          match?.params.envId || '',
          match?.params.deployId || '',
          'resources',
        ),
      });
    }
  }

  return sharedCrumbs;
};
