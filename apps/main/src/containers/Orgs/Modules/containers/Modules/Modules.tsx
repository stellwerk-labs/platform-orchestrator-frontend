import { Flex } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';

import { SearchInput } from '@src/components/shared/ui/SearchInput/SearchInput';
import { MatchParams } from '@src/config/routing';
import { ModulesTable } from '@src/containers/Orgs/Modules/components/ModulesTable';
import {
  getListModulesQueryKey,
  listModules,
} from '@src/hooks/react-query/v2/controlplane/modules/modules';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { ModuleSummary } from '@src/models/v2/controlplane';

export const Modules = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;

  // Component state
  const [filteredModuleDefinitions, setFilteredModuleDefinitions] = useState<ModuleSummary[]>([]);

  const [searchValue, setSearchValue] = useState<string>(
    searchParams.get('query')?.toLowerCase() || '',
  );

  // react query
  const { data: allModules, isFetching: moduleDefinitionsLoading } = useAllPages(
    getAllPagesQueryKey(getListModulesQueryKey(orgId)),
    (params) => listModules(orgId, params),
  );

  // i18n
  const { t } = useTranslation();
  const resourcesTranslations = t('ACCOUNT_SETTINGS').RESOURCES;

  useEffect(() => {
    const filterBasedOnSearchValue = searchValue
      ? allModules?.filter(
          (r) =>
            r.id.toLowerCase()?.includes(searchValue) ||
            r.resource_type.toLowerCase()?.includes(searchValue),
        )
      : allModules;

    setFilteredModuleDefinitions(filterBasedOnSearchValue || []);
  }, [searchValue, allModules]);

  const filterResources = useCallback(
    (value: string) => {
      if (value) {
        searchParams.set('query', value);
      } else {
        searchParams.delete('query');
      }
      setSearchParams(searchParams);
      setSearchValue(value.toLowerCase());
    },
    [searchParams, setSearchParams],
  );

  return (
    <Flex vertical gap={'middle'}>
      <SearchInput
        defaultValue={searchValue}
        placeholder={resourcesTranslations.RESOURCES_SEARCH_PLACEHOLDER}
        onChange={filterResources}
        debounceEvent
      />
      <ModulesTable modules={filteredModuleDefinitions} modulesLoading={moduleDefinitionsLoading} />
    </Flex>
  );
};
