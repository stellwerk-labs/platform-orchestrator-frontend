import { Empty, Flex, Table, TableColumnProps, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { ResourceIcon } from '@src/components/shared/ResourceIcon';
import { DOCS_GET_STARTED_EMPTY_STATE, DOCS_MODULES } from '@src/config/docs-links';
import { MatchParams } from '@src/config/routing';
import {
  useGetModuleVersionUsage,
  useListModuleVersions,
} from '@src/hooks/react-query/v2/controlplane/modules/modules';
import type { ModuleCatalogueEntry } from '@src/models/v2/controlplane';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';
import { generateModuleUrl, generateResourceTypeDetailsUrl } from '@src/utilities/navigation';

interface ResourcesTableProps {
  modules: ModuleCatalogueEntry[];
  modulesLoading?: boolean;
}

const ModuleLifecycleSummary = ({ module }: { module: ModuleCatalogueEntry }) => {
  const versions = useListModuleVersions(module.org_id, module.slug, {
    include_deprecated: true,
    include_defective: true,
  });
  const items = versions.data?.items ?? [];
  const currentDefault = items.find(
    (item) => item.version.uuid === module.current_default_version_uuid,
  );
  const proposed = items.find((item) => item.version.lifecycle_status === 'proposed');
  const defective = items.some((item) => item.version.lifecycle_status === 'defective');
  const unverified = items.some((item) => item.version.verification_status === 'unverified');
  const usage = useGetModuleVersionUsage(
    module.org_id,
    module.slug,
    currentDefault?.version.uuid ?? '',
    { query: { enabled: Boolean(currentDefault) } },
  );

  return (
    <Flex vertical gap={4}>
      <Flex gap={4} wrap={'wrap'}>
        <Tag color={currentDefault ? 'green' : 'default'}>
          Default {currentDefault?.version.semantic_version ?? 'none'}
        </Tag>
        {currentDefault?.version.migration_generation === 'v0' && (
          <Tag color={'gold'}>Legacy v0</Tag>
        )}
        {proposed && <Tag color={'blue'}>Proposed {proposed.version.semantic_version}</Tag>}
        {defective && <Tag color={'red'}>Defective history</Tag>}
        {unverified && <Tag>Unverified</Tag>}
      </Flex>
      <Typography.Text type={'secondary'}>
        {usage.data
          ? `${usage.data.active_environment_count} active Environments${
              usage.data.unknown_environments.length
                ? `, ${usage.data.unknown_environments.length} unknown`
                : ''
            }`
          : currentDefault
            ? 'Loading adoption…'
            : 'Incomplete Module, no versions'}
      </Typography.Text>
    </Flex>
  );
};

const LastPublication = ({ module }: { module: ModuleCatalogueEntry }) => {
  const versions = useListModuleVersions(module.org_id, module.slug, {
    include_deprecated: true,
    include_defective: true,
  });
  const latest = versions.data?.items.reduce<string | undefined>(
    (current, item) =>
      !current || item.version.created_at > current ? item.version.created_at : current,
    undefined,
  );
  return latest ? formatDate(latest, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE) : 'Never';
};

export const ModulesTable = ({ modules, modulesLoading }: ResourcesTableProps) => {
  const { t } = useTranslation();
  const tableTranslations = t('ACCOUNT_SETTINGS').RESOURCES.TABLE;
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;

  const columns: TableColumnProps<ModuleCatalogueEntry>[] = [
    {
      title: 'Module',
      dataIndex: 'display_name',
      sorter: (left, right) => left.display_name.localeCompare(right.display_name),
      render: (_, row) => (
        <Flex align={'center'} gap={'small'}>
          <ResourceIcon type={row.resource_type} />
          <Flex vertical>
            <Link to={generateModuleUrl(orgId, row.slug)} tabIndex={0}>
              {row.display_name}
            </Link>
            <Typography.Text type={'secondary'}>{row.slug}</Typography.Text>
          </Flex>
        </Flex>
      ),
    },
    {
      title: tableTranslations.TYPE,
      sorter: (left, right) => left.resource_type.localeCompare(right.resource_type),
      dataIndex: 'resource_type',
      render: (resourceType) => (
        <Link target={'_blank'} to={generateResourceTypeDetailsUrl(orgId, resourceType)}>
          {resourceType}
        </Link>
      ),
    },
    {
      title: 'Lifecycle and adoption',
      render: (_, module) => <ModuleLifecycleSummary module={module} />,
    },
    {
      title: 'Catalogue',
      dataIndex: 'status',
      render: (status) => <Tag color={status === 'archived' ? 'orange' : 'green'}>{status}</Tag>,
    },
    {
      title: 'Last publication',
      render: (_, module) => <LastPublication module={module} />,
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={modules}
      loading={modulesLoading}
      rowKey={'uuid'}
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
