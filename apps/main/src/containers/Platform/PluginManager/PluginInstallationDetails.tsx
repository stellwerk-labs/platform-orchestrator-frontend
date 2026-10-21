import type { UseQueryResult } from '@tanstack/react-query';
import { Alert, Card, Descriptions, Empty, Flex, Spin, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useParams } from 'react-router';

import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import type { ErrorType } from '@src/custom-instance';
import {
  useGetPluginInstallation,
  useListPluginPackages,
} from '@src/hooks/react-query/v2/controlplane/plugin-manager/plugin-manager';
import type {
  Error as ApiError,
  PluginAuditEvent,
  PluginEnablement,
  PluginEntitlementGrant,
  PluginInstallation,
  PluginPackage,
  PluginPackagePage,
} from '@src/models/v2/controlplane';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';

import {
  grantStateColors,
  packageVersion,
  registrationStateColors,
  shortDigest,
  useRecentInstallationAuditEvents,
} from './pluginInstallationStatus';
import { PluginManagerError } from './PluginManagerError';

const date = (value: string) => formatDate(value, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE);

const Digest = ({ digest }: { digest: string }) => (
  <Typography.Text code title={digest}>
    {shortDigest(digest)}
  </Typography.Text>
);

const GrantDescription = ({ grant }: { grant: PluginEntitlementGrant }) => (
  <Descriptions column={1} size={'small'}>
    <Descriptions.Item label={'Scope'}>{grant.scope}</Descriptions.Item>
    <Descriptions.Item label={'State'}>
      <Tag color={grantStateColors[grant.state]}>{grant.state}</Tag>
    </Descriptions.Item>
    <Descriptions.Item label={'Issuer'}>{grant.issuer}</Descriptions.Item>
    <Descriptions.Item label={'Sequence'}>{grant.sequence}</Descriptions.Item>
    <Descriptions.Item label={'Trust class'}>{grant.trust_class}</Descriptions.Item>
    <Descriptions.Item label={'Features'}>{grant.features.join(', ') || 'None'}</Descriptions.Item>
    <Descriptions.Item label={'Valid from'}>{date(grant.not_before)}</Descriptions.Item>
    <Descriptions.Item label={'Expires'}>{date(grant.expires_at)}</Descriptions.Item>
    <Descriptions.Item label={'Grace until'}>{date(grant.grace_until)}</Descriptions.Item>
  </Descriptions>
);

const OverviewCard = ({
  installation,
  packages,
}: {
  installation: PluginInstallation;
  packages: PluginPackage[] | undefined;
}) => {
  const { organization_defaults: defaults, observation, diagnostic } = installation;
  const policies = Object.entries(defaults.approval_policies);
  return (
    <Card title={'Installation'}>
      {diagnostic && (
        <Alert
          type={'error'}
          showIcon
          style={{ marginBottom: 16 }}
          message={diagnostic.code}
          description={diagnostic.message}
        />
      )}
      <Descriptions column={2} size={'small'}>
        <Descriptions.Item label={'Installation ID'}>
          {installation.installation_id}
        </Descriptions.Item>
        <Descriptions.Item label={'State'}>
          <Tag>{installation.state}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label={'Package'}>
          {packageVersion(packages, installation.package_sha256) ?? 'Unknown version'}{' '}
          <Digest digest={installation.package_sha256} />
        </Descriptions.Item>
        <Descriptions.Item label={'Availability'}>{installation.availability}</Descriptions.Item>
        {installation.target_package_sha256 && (
          <Descriptions.Item label={'Upgrade pending'}>
            {packageVersion(packages, installation.target_package_sha256) ?? 'Unknown version'}{' '}
            <Digest digest={installation.target_package_sha256} />
          </Descriptions.Item>
        )}
        <Descriptions.Item label={'Backend'}>{installation.backend_url}</Descriptions.Item>
        {installation.ui_origin && (
          <Descriptions.Item label={'UI origin'}>{installation.ui_origin}</Descriptions.Item>
        )}
        <Descriptions.Item label={'Organization mode'}>
          <Tag>{installation.organization_mode}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label={'Default timezone'}>{defaults.timezone}</Descriptions.Item>
        <Descriptions.Item label={'Default approval policies'}>
          {policies.length === 0
            ? 'None'
            : policies.map(([scope, policy]) => `${scope}: ${policy}`).join(', ')}
        </Descriptions.Item>
        <Descriptions.Item label={'Last status read'}>
          {observation
            ? `${date(observation.observed_at)}${observation.failure ? `, ${observation.failure}` : ''}`
            : 'Never'}
        </Descriptions.Item>
        <Descriptions.Item label={'Updated'}>{date(installation.updated_at)}</Descriptions.Item>
      </Descriptions>
    </Card>
  );
};

const OrganizationsCard = ({ installation }: { installation: PluginInstallation }) => {
  const licensed = Boolean(installation.entitlement);
  const columns: ColumnsType<PluginEnablement> = [
    { title: 'Organization', dataIndex: 'org_id', key: 'org_id' },
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state',
      render: (state: PluginEnablement['state']) => (
        <Tag color={state === 'enabled' ? 'green' : 'default'}>{state}</Tag>
      ),
    },
    { title: 'Timezone', dataIndex: 'timezone', key: 'timezone' },
    {
      title: 'Capability registration',
      key: 'registration',
      render: (_, { capability_registration: registration }) => (
        <Flex vertical>
          <Tag color={registrationStateColors[registration.state]}>{registration.state}</Tag>
          {registration.detail && (
            <Typography.Text type={'danger'}>{registration.detail}</Typography.Text>
          )}
          {registration.reconciled_at && (
            <Typography.Text type={'secondary'}>
              Reconciled {date(registration.reconciled_at)}
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    {
      title: 'Covering grant',
      key: 'grant',
      render: (_, { entitlement_grant: grant }) => {
        if (!licensed) {
          return <Typography.Text type={'secondary'}>No licence required</Typography.Text>;
        }
        if (!grant) {
          return <Tag color={'red'}>Not entitled</Tag>;
        }
        return (
          <Flex vertical>
            <span>
              <Tag>{grant.scope}</Tag>
              <Tag color={grantStateColors[grant.state]}>{grant.state}</Tag>
            </span>
            <Typography.Text type={'secondary'}>Expires {date(grant.expires_at)}</Typography.Text>
          </Flex>
        );
      },
    },
  ];

  return (
    <Card title={'Organizations'}>
      <Table
        rowKey={'org_id'}
        columns={columns}
        dataSource={installation.organizations}
        pagination={false}
        locale={{ emptyText: <Empty description={'No organization has an enablement.'} /> }}
      />
      <Typography.Title level={5} style={{ marginTop: 24 }}>
        Pending organizations
      </Typography.Title>
      {installation.pending_organizations?.length ? (
        <Flex gap={'small'} wrap>
          {installation.pending_organizations.map((org) => (
            <Tag key={org}>{org}</Tag>
          ))}
        </Flex>
      ) : (
        <Typography.Text type={'secondary'}>
          No organization waits for an enablement.
        </Typography.Text>
      )}
    </Card>
  );
};

const LicenceCard = ({ installation }: { installation: PluginInstallation }) => {
  const { entitlement } = installation;
  return (
    <Card title={'Installation grant'}>
      {!entitlement ? (
        <Typography.Text type={'secondary'}>This package requires no licence.</Typography.Text>
      ) : (
        <>
          <Descriptions column={1} size={'small'}>
            <Descriptions.Item label={'Enabled organizations'}>
              {entitlement.enabled_organizations}
            </Descriptions.Item>
            <Descriptions.Item label={'Organization limit'}>
              {entitlement.installation_grant?.organization_limit ?? 'None'}
            </Descriptions.Item>
          </Descriptions>
          {entitlement.installation_grant ? (
            <GrantDescription grant={entitlement.installation_grant} />
          ) : (
            <Typography.Text type={'secondary'}>
              No installation-wide grant is imported. Organizations are covered only by grants of
              their own.
            </Typography.Text>
          )}
        </>
      )}
    </Card>
  );
};

const PackagesCard = ({
  installation,
  packages,
}: {
  installation: PluginInstallation;
  packages: UseQueryResult<PluginPackagePage, ErrorType<ApiError>>;
}) => {
  const columns: ColumnsType<PluginPackage> = [
    { title: 'Version', dataIndex: 'version', key: 'version' },
    {
      title: 'Digest',
      key: 'digest',
      render: (_, { manifest_sha256 }) => <Digest digest={manifest_sha256} />,
    },
    {
      title: 'Role',
      key: 'role',
      render: (_, { manifest_sha256 }) => {
        if (manifest_sha256 === installation.package_sha256)
          return <Tag color={'green'}>Served</Tag>;
        if (manifest_sha256 === installation.target_package_sha256)
          return <Tag>Upgrade target</Tag>;
        return null;
      },
    },
    {
      title: 'Registered',
      key: 'created_at',
      render: (_, { created_at }) => date(created_at),
    },
  ];

  return (
    <Card title={'Packages'}>
      {packages.isError ? (
        <PluginManagerError error={packages.error} what={'The plugin packages'} />
      ) : (
        <Table
          rowKey={'manifest_sha256'}
          loading={packages.isLoading}
          columns={columns}
          dataSource={(packages.data?.items ?? []).filter(
            ({ plugin_id }) => plugin_id === installation.plugin_id,
          )}
          pagination={false}
          locale={{
            emptyText: <Empty description={'No package is registered for this plugin.'} />,
          }}
        />
      )}
    </Card>
  );
};

const AuditCard = ({ installationId }: { installationId: string }) => {
  const events = useRecentInstallationAuditEvents(installationId);
  const columns: ColumnsType<PluginAuditEvent> = [
    { title: 'When', key: 'occurred_at', render: (_, { occurred_at }) => date(occurred_at) },
    { title: 'Action', dataIndex: 'action', key: 'action' },
    { title: 'Organization', dataIndex: 'org_id', key: 'org_id' },
    { title: 'Actor', dataIndex: 'actor', key: 'actor' },
    { title: 'Reason', dataIndex: 'reason', key: 'reason' },
  ];

  return (
    <Card title={'Recent audit events'}>
      {events.isError ? (
        <PluginManagerError error={events.error} what={'The audit events'} />
      ) : (
        <Table
          rowKey={'id'}
          columns={columns}
          loading={events.isLoading}
          dataSource={events.data}
          pagination={false}
          locale={{ emptyText: <Empty description={'No audit event names this installation.'} /> }}
        />
      )}
    </Card>
  );
};

export const PluginInstallationDetails = () => {
  const { installationId = '' } = useParams<{ installationId: string }>();
  const installation = useGetPluginInstallation(installationId);
  const packages = useListPluginPackages();

  if (installation.isError) {
    return <PluginManagerError error={installation.error} what={'The plugin installation'} />;
  }

  if (!installation.data) {
    return (
      <Flex justify={'center'} style={{ padding: 48 }}>
        <Spin />
      </Flex>
    );
  }

  return (
    <>
      <PageHeader customHeading={installation.data.plugin_id} />
      <Flex vertical gap={'large'}>
        <OverviewCard installation={installation.data} packages={packages.data?.items} />
        <OrganizationsCard installation={installation.data} />
        <LicenceCard installation={installation.data} />
        <PackagesCard installation={installation.data} packages={packages} />
        <AuditCard installationId={installation.data.installation_id} />
      </Flex>
    </>
  );
};
