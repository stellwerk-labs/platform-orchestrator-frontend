import { Empty, Flex, Spin, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router';

import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { matchesSearch, TableToolbar, useTableSearch } from '@src/components/shared/TableToolbar';
import {
  useListPluginInstallations,
  useListPluginPackages,
} from '@src/hooks/react-query/v2/controlplane/plugin-manager/plugin-manager';
import type {
  PluginInstallation,
  PluginInstallationEntitlement,
} from '@src/models/v2/controlplane';
import { generatePluginInstallationUrl } from '@src/utilities/navigation';

import {
  enabledOrganizations,
  grantStateColors,
  packageVersion,
  registrationProblems,
  shortDigest,
} from './pluginInstallationStatus';
import { PluginManagerError } from './PluginManagerError';

export const LicenceSummary = ({
  entitlement,
}: {
  entitlement?: PluginInstallationEntitlement;
}) => {
  if (!entitlement) {
    return <Typography.Text type={'secondary'}>No licence required</Typography.Text>;
  }

  const grant = entitlement.installation_grant;
  if (!grant) {
    return (
      <Flex gap={'small'} align={'center'}>
        <Tag color={'default'}>No installation grant</Tag>
        <Typography.Text type={'secondary'}>
          {entitlement.enabled_organizations} enabled
        </Typography.Text>
      </Flex>
    );
  }

  return (
    <Flex gap={'small'} align={'center'}>
      <Tag color={grantStateColors[grant.state]}>{grant.state}</Tag>
      <Typography.Text>
        {grant.organization_limit
          ? `${entitlement.enabled_organizations} of ${grant.organization_limit} organizations`
          : 'No organization limit'}
      </Typography.Text>
    </Flex>
  );
};

const RegistrationProblems = ({ installation }: { installation: PluginInstallation }) => {
  const { failed, pending } = registrationProblems(installation);
  if (failed.length === 0 && pending.length === 0 && !installation.diagnostic) {
    return <Typography.Text type={'secondary'}>None</Typography.Text>;
  }

  return (
    <Flex gap={'small'} wrap>
      {failed.length > 0 && <Tag color={'red'}>{failed.length} failed</Tag>}
      {pending.length > 0 && <Tag color={'gold'}>{pending.length} pending</Tag>}
      {installation.diagnostic && <Tag color={'red'}>{installation.diagnostic.code}</Tag>}
    </Flex>
  );
};

export const PluginInstallations = () => {
  const search = useTableSearch();
  const installations = useListPluginInstallations();
  const packages = useListPluginPackages();

  const columns: ColumnsType<PluginInstallation> = [
    {
      title: 'Plugin',
      key: 'plugin_id',
      render: (_, installation) => (
        <Link to={generatePluginInstallationUrl(installation.installation_id)}>
          {installation.plugin_id}
        </Link>
      ),
    },
    {
      title: 'Package',
      key: 'package',
      render: (_, { package_sha256, target_package_sha256 }) => (
        <Flex vertical>
          <Typography.Text>
            {packageVersion(packages.data?.items, package_sha256) ?? 'Unknown version'}
          </Typography.Text>
          <Typography.Text type={'secondary'} code title={package_sha256}>
            {shortDigest(package_sha256)}
          </Typography.Text>
          {target_package_sha256 && (
            <Typography.Text type={'secondary'}>
              Upgrade pending: {packageVersion(packages.data?.items, target_package_sha256)}{' '}
              <Typography.Text code title={target_package_sha256}>
                {shortDigest(target_package_sha256)}
              </Typography.Text>
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state',
      render: (state: PluginInstallation['state']) => <Tag>{state}</Tag>,
    },
    {
      title: 'Mode',
      dataIndex: 'organization_mode',
      key: 'organization_mode',
      render: (mode: PluginInstallation['organization_mode']) => <Tag>{mode}</Tag>,
    },
    {
      title: 'Enabled organizations',
      key: 'enabled',
      render: (_, installation) => enabledOrganizations(installation).length,
    },
    {
      title: 'Licence',
      key: 'licence',
      render: (_, { entitlement }) => <LicenceSummary entitlement={entitlement} />,
    },
    {
      title: 'Capability registration problems',
      key: 'problems',
      render: (_, installation) => <RegistrationProblems installation={installation} />,
    },
  ];

  return (
    <>
      <PageHeader />
      {installations.isError ? (
        <PluginManagerError error={installations.error} what={'The plugin installations'} />
      ) : (
        <>
          <TableToolbar
            label={'plugins'}
            {...search}
            filters={[
              { value: 'problems', label: 'Registration problems' },
              { value: 'upgrading', label: 'Upgrade pending' },
              ...[...new Set(installations.data?.items.map((row) => row.state))].map((state) => ({
                value: state,
                label: state,
              })),
            ]}
          />
          <Table
            rowKey={'installation_id'}
            columns={columns}
            loading={installations.isLoading && { indicator: <Spin /> }}
            dataSource={[...(installations.data?.items ?? [])]
              .filter(
                (row) =>
                  matchesSearch(
                    search.query,
                    row.plugin_id,
                    row.installation_id,
                    row.package_sha256,
                    packageVersion(packages.data?.items, row.package_sha256),
                    row.organization_mode,
                  ) &&
                  (search.view === 'all' ||
                    (search.view === 'problems'
                      ? Boolean(
                          row.diagnostic ||
                          registrationProblems(row).failed.length ||
                          registrationProblems(row).pending.length,
                        )
                      : search.view === 'upgrading'
                        ? Boolean(row.target_package_sha256)
                        : row.state === search.view)),
              )
              .sort((a, b) => a.plugin_id.localeCompare(b.plugin_id))}
            pagination={false}
            locale={{
              emptyText: (
                <Empty
                  description={
                    search.query || search.view !== 'all'
                      ? 'No results match these filters.'
                      : 'No plugin is installed.'
                  }
                />
              ),
            }}
          />
        </>
      )}
    </>
  );
};
