import yaml from 'js-yaml';
import React from 'react';
import { useParams } from 'react-router';

import { SyntaxHighlighting } from '@src/components/shared/SyntaxHighlighting';
import { MatchParams } from '@src/config/routing';
import { useGetResourceType } from '@src/hooks/react-query/v2/controlplane/resource-type/resource-type';

export const ResourceTypeSchema = () => {
  const { orgId, resourceTypeId } = useParams<keyof MatchParams>() as MatchParams;
  // React Query
  const { data: resourceType } = useGetResourceType(orgId, resourceTypeId);

  return <SyntaxHighlighting language={'yaml'} text={yaml.dump(resourceType?.output_schema)} />;
};
