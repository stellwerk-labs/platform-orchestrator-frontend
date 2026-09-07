import { Flex, Typography } from 'antd';
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

  return (
    <Flex vertical gap={'middle'}>
      <Typography.Title level={4}>Output interface</Typography.Title>
      <SyntaxHighlighting language={'yaml'} text={yaml.dump(resourceType?.output_schema)} />
      <Typography.Title level={4}>Module publication contract</Typography.Title>
      {resourceType?.module_contract ? (
        <>
          <Typography.Paragraph type={'secondary'}>
            Validates the declared Module definition before publication. It does not verify the
            external artifact or future runtime values. Resource Type contracts are immutable.
          </Typography.Paragraph>
          <SyntaxHighlighting language={'yaml'} text={yaml.dump(resourceType.module_contract)} />
        </>
      ) : (
        <Typography.Paragraph type={'secondary'}>
          No additional input, parameter, provider or dependency constraints declared. The output
          interface above still applies to new Module Versions.
        </Typography.Paragraph>
      )}
    </Flex>
  );
};
