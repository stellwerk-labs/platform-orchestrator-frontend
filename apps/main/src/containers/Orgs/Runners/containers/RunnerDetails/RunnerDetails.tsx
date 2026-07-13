import { Button, Flex, Spin, Tabs } from 'antd';
import React from 'react';
import { Outlet, useNavigate, useParams } from 'react-router';

import { ErrorPage } from '@src/components/shared/ErrorPage/ErrorPage';
import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { DataEntry } from '@src/components/shared/ui/DataEntry/DataEntry';
import { MatchParams } from '@src/config/routing';
import { useGetRunner } from '@src/hooks/react-query/v2/controlplane/runner/runner';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';

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
      <PageHeader />
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
