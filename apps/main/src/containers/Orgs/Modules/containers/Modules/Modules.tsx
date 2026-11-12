import { Alert, Button, Checkbox, Flex, Input, Select, Tooltip } from 'antd';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import { ModulesTable } from '@src/containers/Orgs/Modules/components/ModulesTable';
import { useListModuleCatalogueEntries } from '@src/hooks/react-query/v2/controlplane/modules/modules';

import { filterModules, ModuleFilters } from './module-filters';

const emptyFilters: ModuleFilters = {
  search: '',
  hasProposed: false,
  defaultVerified: false,
  noDefault: false,
  migrationOnly: false,
};

export const Modules = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;
  const [filters, setFilters] = useState<ModuleFilters>({
    ...emptyFilters,
    search: searchParams.get('query') || '',
  });
  const { data: allModules = [], isFetching: moduleDefinitionsLoading } =
    useListModuleCatalogueEntries(orgId);
  const summaryAvailable = allModules.every(
    (module) => module.has_proposed !== undefined && module.default_verified !== undefined,
  );
  const versionFilters = summaryAvailable ? filters : emptyFilters;
  const filteredModules = filterModules(allModules, {
    ...filters,
    hasProposed: versionFilters.hasProposed,
    defaultVerified: versionFilters.defaultVerified,
  });
  const legacyModules = allModules.filter(
    (module) => module.current_default_version_uuid && module.managed_default_generation === 0,
  );
  const resourceTypes = [...new Set(allModules.map((module) => module.resource_type))].sort();
  const hasFilters = Object.values(filters).some(Boolean);
  const updateSearch = (search: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (search) nextParams.set('query', search);
    else nextParams.delete('query');
    setSearchParams(nextParams);
    setFilters((current) => ({ ...current, search }));
  };

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
            <Button
              size={'small'}
              onClick={() =>
                setFilters((current) => ({ ...current, migrationOnly: !current.migrationOnly }))
              }>
              {filters.migrationOnly ? 'Show all Modules' : 'Open migration view'}
            </Button>
          }
        />
      )}
      <Flex wrap gap={'middle'} align={'center'}>
        <Input.Search
          value={filters.search}
          placeholder={'Search name, slug or resource type'}
          aria-label={'Search modules'}
          allowClear
          onChange={(event) => updateSearch(event.target.value)}
          style={{ maxWidth: 320 }}
        />
        <Select
          aria-label={'Resource type'}
          placeholder={'Resource type'}
          value={filters.resourceType}
          options={resourceTypes.map((value) => ({ value, label: value }))}
          allowClear
          style={{ minWidth: 180 }}
          onChange={(resourceType) => setFilters((current) => ({ ...current, resourceType }))}
        />
        <Checkbox
          checked={versionFilters.hasProposed}
          disabled={!summaryAvailable}
          onChange={(event) =>
            setFilters((current) => ({ ...current, hasProposed: event.target.checked }))
          }>
          Has proposed
        </Checkbox>
        <Tooltip
          title={
            'Versions currently only support unverified status. This filter will match no modules until verified versions are supported.'
          }>
          <Checkbox
            checked={versionFilters.defaultVerified}
            disabled={!summaryAvailable}
            onChange={(event) =>
              setFilters((current) => ({ ...current, defaultVerified: event.target.checked }))
            }>
            Default verified
          </Checkbox>
        </Tooltip>
        <Checkbox
          checked={filters.noDefault}
          onChange={(event) =>
            setFilters((current) => ({ ...current, noDefault: event.target.checked }))
          }>
          No default
        </Checkbox>
        <Button
          disabled={!hasFilters}
          onClick={() => {
            updateSearch('');
            setFilters(emptyFilters);
          }}>
          Reset filters
        </Button>
      </Flex>
      {!summaryAvailable && (
        <Alert
          type={'warning'}
          showIcon
          message={
            'Version summaries are unavailable. Has proposed and Default verified filters require module.version.read and a server that provides catalogue summaries.'
          }
        />
      )}
      <ModulesTable
        modules={filteredModules}
        modulesLoading={moduleDefinitionsLoading}
        filtered={hasFilters}
      />
    </Flex>
  );
};
