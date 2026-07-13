import { Select, SelectProps } from 'antd';
import { useMemo } from 'react';

import {
  getListEnvironmentsQueryKey,
  listEnvironments,
} from '@src/hooks/react-query/v2/controlplane/environment/environment';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';

export const ALL_ENVIRONMENTS = 'All environments';

interface EnvironmentSelectProps extends SelectProps {
  orgId: string;
  projectId: string;
}

export const EnvironmentSelect = ({ orgId, projectId, ...props }: EnvironmentSelectProps) => {
  const { data: allEnvironments, isSuccess: environmentsDataSuccess } = useAllPages(
    getAllPagesQueryKey(getListEnvironmentsQueryKey(orgId, projectId)),
    (params) => listEnvironments(orgId, projectId, params),
    undefined,
    { enabled: !!projectId },
  );

  const environmentOptions = useMemo(() => {
    const baseOptions = [{ label: ALL_ENVIRONMENTS, value: '' }];

    if (!environmentsDataSuccess || !projectId) {
      return baseOptions;
    }

    return [
      ...baseOptions,
      ...allEnvironments.map((env) => ({
        label: env.display_name,
        value: env.uuid,
      })),
    ];
  }, [projectId, allEnvironments, environmentsDataSuccess]);

  return <Select {...props} options={environmentOptions} />;
};
