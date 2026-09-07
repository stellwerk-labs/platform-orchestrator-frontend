import { Alert, Button, Flex } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';

import { SearchInput } from '@src/components/shared/ui/SearchInput/SearchInput';
import { MatchParams } from '@src/config/routing';
import { ModulesTable } from '@src/containers/Orgs/Modules/components/ModulesTable';
import { useListModuleCatalogueEntries } from '@src/hooks/react-query/v2/controlplane/modules/modules';

export const Modules = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;

  // Component state
  const [searchValue, setSearchValue] = useState<string>(
    searchParams.get('query')?.toLowerCase() || '',
  );
  const [migrationOnly, setMigrationOnly] = useState(false);

  // react query
  const { data: allModules, isFetching: moduleDefinitionsLoading } =
    useListModuleCatalogueEntries(orgId);

  // i18n
  const { t } = useTranslation();
  const resourcesTranslations = t('ACCOUNT_SETTINGS').RESOURCES;

  const filteredModuleDefinitions = useMemo(
    () =>
      allModules?.filter(
        (r) =>
          (!migrationOnly ||
            (r.current_default_version_uuid && r.managed_default_generation === 0)) &&
          (!searchValue ||
            r.slug.toLowerCase().includes(searchValue) ||
            r.display_name.toLowerCase().includes(searchValue) ||
            r.resource_type.toLowerCase()?.includes(searchValue)),
      ) ?? [],
    [searchValue, migrationOnly, allModules],
  );
  const legacyModules =
    allModules?.filter(
      (module) => module.current_default_version_uuid && module.managed_default_generation === 0,
    ) ?? [];

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
      {legacyModules.length > 0 && (
        <Alert
          type={'warning'}
          showIcon
          message={`${legacyModules.length} Module${legacyModules.length === 1 ? '' : 's'} still use a Legacy v0 Default`}
          description={
            'Migration is not blocked by missing historical SemVer or digests. Publish one complete stable managed Version and promote it to establish the v1 lineage.'
          }
          action={
            <Button size={'small'} onClick={() => setMigrationOnly((current) => !current)}>
              {migrationOnly ? 'Show all Modules' : 'Open migration view'}
            </Button>
          }
        />
      )}
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
