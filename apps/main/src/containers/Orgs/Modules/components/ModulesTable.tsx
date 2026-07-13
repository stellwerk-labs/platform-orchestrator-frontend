import { Empty, Flex, Table, TableColumnProps } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { ResourceIcon } from '@src/components/shared/ResourceIcon';
import { DOCS_GET_STARTED_EMPTY_STATE, DOCS_MODULES } from '@src/config/docs-links';
import { MatchParams } from '@src/config/routing';
import { getModuleSourceUrl } from '@src/containers/Orgs/Modules/module-utils';
import { ModuleSummary } from '@src/models/v2/controlplane';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';
import {
  generateModuleUrl,
  generateProviderDetailUrl,
  generateResourceTypeDetailsUrl,
} from '@src/utilities/navigation';

interface ResourcesTableProps {
  modules: ModuleSummary[];
  modulesLoading?: boolean;
}

export const ModulesTable = ({ modules, modulesLoading }: ResourcesTableProps) => {
  // i18n
  const { t } = useTranslation();
  const tableTranslations = t('ACCOUNT_SETTINGS').RESOURCES.TABLE;

  // Router hooks
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;

  const columns: TableColumnProps<ModuleSummary>[] = [
    {
      title: tableTranslations.ID,
      dataIndex: 'id',
      sorter: (a, b) => a.id.localeCompare(b.id),
      render: (_, row) => (
        <Flex align={'center'} gap={'small'}>
          <ResourceIcon type={row.resource_type} />
          <Link to={generateModuleUrl(orgId, row.id)} tabIndex={0}>
            {row.id}
          </Link>
        </Flex>
      ),
    },
    {
      title: tableTranslations.TYPE,
      sorter: (a, b) => a.resource_type.localeCompare(b.id),
      dataIndex: 'resource_type',
      render: (resource_type) => (
        <Link
          target={'_blank'}
          to={generateResourceTypeDetailsUrl(orgId, resource_type)}
          tabIndex={0}>
          {resource_type || '-'}
        </Link>
      ),
    },
    {
      title: 'Module source',
      dataIndex: 'module_source',
      render: (module_source) => (
        <Link target={'_blank'} to={getModuleSourceUrl(module_source)} tabIndex={0}>
          Source
        </Link>
      ),
    },
    {
      title: 'Provider',
      dataIndex: 'provider_mapping',
      render: (provider_mapping) => (
        <>
          {Object.values(provider_mapping).length > 0 ? (
            <Flex vertical gap={'small'}>
              {Object.values(provider_mapping).map(
                (provider) =>
                  typeof provider === 'string' &&
                  provider && (
                    <Link
                      to={generateProviderDetailUrl(
                        orgId,
                        provider.split('.')[0] ?? '',
                        provider.split('.')[1] ?? '',
                      )}
                      key={provider}>
                      {provider}
                    </Link>
                  ),
              )}
            </Flex>
          ) : (
            <span>-</span>
          )}
        </>
      ),
    },
    {
      title: 'Created at',
      dataIndex: 'created_at',
      width: '300px',
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (value) => formatDate(value, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={modules}
      loading={modulesLoading}
      rowKey={'id'}
      size={'small'}
      locale={{
        emptyText: (
          <Empty
            description={
              <>
                No modules found, see{' '}
                <a href={DOCS_MODULES} target={'_blank'} rel={'noreferrer noopener'}>
                  modules docs
                </a>{' '}
                for details, or follow the{' '}
                <a
                  href={DOCS_GET_STARTED_EMPTY_STATE}
                  target={'_blank'}
                  rel={'noreferrer noopener'}>
                  tutorial
                </a>{' '}
                to explore the full setup flow.
              </>
            }
            styles={{ image: { display: 'none' } }}
          />
        ),
      }}
    />
  );
};
