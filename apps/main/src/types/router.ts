import { UIMatch } from 'react-router';

import { BreadcrumbItem } from '@src/hooks/useBreadcrumbs';
import { Environment, Project } from '@src/models/v2/controlplane';
import { DeploymentSummary } from '@src/models/v2/dataplane';

export interface BreadcrumbData {
  project?: Project;
  env?: Environment;
  deployment?: DeploymentSummary;
}

export interface RouteHandle {
  crumbs: (match: UIMatch, data: BreadcrumbData) => BreadcrumbItem[];
}
