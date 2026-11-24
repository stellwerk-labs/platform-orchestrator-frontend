import { Alert, Button, Flex, Spin, Tabs, Tag } from 'antd';
import React from 'react';
import { Outlet, useNavigate, useParams } from 'react-router';

import { ErrorPage } from '@src/components/shared/ErrorPage/ErrorPage';
import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { DataEntry } from '@src/components/shared/ui/DataEntry/DataEntry';
import { MatchParams } from '@src/config/routing';
import { useGetRunner } from '@src/hooks/react-query/v2/controlplane/runner/runner';
import type { Runner } from '@src/models/v2/controlplane';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';

import { NativeRunnerActions } from '../../NativeRunnerActions';
import { nativeRunnerIdentityMatches } from '../../nativeRunnerDocument';

const NativeIdentityDetails = ({ runner }: { runner: Runner }) => {
  if (runner.runner_configuration.type !== 'native-agent') return null;
  return (
    <>
      <Alert
        type={nativeRunnerIdentityMatches(runner, runner) ? 'info' : 'error'}
        showIcon
        message={
          nativeRunnerIdentityMatches(runner, runner)
            ? 'Retained native registration'
            : 'This registration has no usable retained identity. Refresh and review before acting.'
        }
        description={
          'Install this immutable UUID as runner_uuid in the site’s private configuration before initialization. Registration metadata does not start execution or prove site reachability.'
        }
        style={{ marginBottom: 16 }}
      />
      <Flex gap={'middle'} style={{ marginBottom: 16 }}>
        <DataEntry label={'Immutable registration UUID'} value={runner.uuid} copyable />
        <DataEntry
          label={'Public inventory'}
          value={
            <Tag color={runner.runner_configuration.native_execution ? 'green' : undefined}>
              {runner.runner_configuration.native_execution
                ? 'Advertised'
                : 'Absent, new native admission disabled'}
            </Tag>
          }
        />
      </Flex>
    </>
  );
};

export const RunnerDetails = () => {
  // router
  const { orgId, runnerId } = useParams<keyof MatchParams>() as MatchParams;
  const navigate = useNavigate();

  // React Query
  const { data: runner, isPending: isRunnerLoading } = useGetRunner(orgId, runnerId);

  return isRunnerLoading ? (
    <Flex align={'center'} justify={'center'} style={{ height: '100%', width: '100%' }}>
      <Spin />
    </Flex>
  ) : runner ? (
    <>
      <PageHeader
        rightContent={
          runner.runner_configuration.type === 'native-agent' ? (
            <NativeRunnerActions runner={runner} />
          ) : undefined
        }
      />
      <NativeIdentityDetails runner={runner} />
      <Flex gap={'middle'} wrap={'wrap'}>
        <DataEntry
          label={'Created at'}
          value={formatDate(runner?.created_at, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE)}
        />
        {runner.runner_configuration?.type && (
          <DataEntry label={'Type'} value={runner?.runner_configuration?.type} />
        )}
        {runner.state_storage_configuration?.type && (
          <DataEntry label={'State Storage'} value={runner?.state_storage_configuration?.type} />
        )}
        {runner.description && <DataEntry label={'Description'} value={runner?.description} />}
      </Flex>
      <Tabs
        onChange={(key) => navigate(key)}
        items={[
          {
            label: 'Configuration',
            key: 'runner_configuration',
          },
          {
            label: 'State Storage',
            key: 'state_storage_configuration',
          },
          {
            label: 'Rules',
            key: 'rules',
          },
        ]}
      />
      <Outlet />
    </>
  ) : (
    <ErrorPage
      title={'Runner not found'}
      buttons={
        <Button variant={'outlined'} href={`/orgs/${orgId}/runners`}>
          Go to runners list
        </Button>
      }
    />
  );
};
