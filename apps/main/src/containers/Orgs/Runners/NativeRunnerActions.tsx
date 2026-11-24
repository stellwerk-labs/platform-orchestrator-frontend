import { EditOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Flex, Popconfirm } from 'antd';
import { useRef, useState } from 'react';

import {
  getGetRunnerQueryKey,
  getListRunnersQueryKey,
  updateRunner,
} from '@src/hooks/react-query/v2/controlplane/runner/runner';
import { getAllPagesQueryKey } from '@src/hooks/useFetchAllPages';
import { RBACPermission, RBACStatus, useRBAC } from '@src/hooks/useRBAC';
import type { Runner, RunnerUpdateBody } from '@src/models/v2/controlplane';
import { generateRunnerDetailUrl } from '@src/utilities/navigation';

import { nativeRunnerIdentityMatches, nativeRunnerResponseMatches } from './nativeRunnerDocument';

export const NativeRunnerActions = ({ runner }: { runner: Runner }) => {
  const canWrite = useRBAC(RBACPermission.RUNNER_WRITE) === RBACStatus.ALLOWED;
  const permission = useRef(canWrite);
  permission.current = canWrite;
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [attention, setAttention] = useState(false);
  const query = useQueryClient();
  const validIdentity = nativeRunnerIdentityMatches(runner, runner);
  const advertised =
    runner.runner_configuration.type === 'native-agent' &&
    Boolean(runner.runner_configuration.native_execution);
  const disabled = !canWrite || busy || !validIdentity || attention;
  const cannotDisable = disabled || !advertised;
  const disable = async () => {
    if (!permission.current || inFlight.current || !validIdentity || !advertised || attention)
      return;
    inFlight.current = true;
    setBusy(true);
    setFailure(undefined);
    const patch: RunnerUpdateBody = {
      runner_configuration: { type: 'native-agent', native_execution: null },
    };
    try {
      const actual = await updateRunner(runner.org_id, runner.id, patch);
      if (!nativeRunnerResponseMatches(runner, patch, actual)) {
        setAttention(true);
        setFailure(
          'The Runner changed beyond this action. Admission may already be disabled. Refresh and review the current registration before acting again.',
        );
        return;
      }
      await query.cancelQueries({ queryKey: getGetRunnerQueryKey(runner.org_id, runner.id) });
      query.setQueryData(getGetRunnerQueryKey(runner.org_id, runner.id), actual);
      await Promise.all([
        query.invalidateQueries({ queryKey: getListRunnersQueryKey(runner.org_id) }),
        query.invalidateQueries({
          queryKey: getAllPagesQueryKey(getListRunnersQueryKey(runner.org_id)),
        }),
      ]);
    } catch {
      setFailure(
        'Native admission could not be disabled. Check permission and connection, then retry.',
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <Flex vertical gap={'small'} align={'flex-end'}>
      <Flex gap={'small'} wrap>
        <Button
          icon={<EditOutlined aria-hidden />}
          href={`${generateRunnerDetailUrl(runner.org_id, runner.id)}/edit`}
          disabled={disabled}>
          {advertised ? 'Edit / replace inventory' : 'Re-enable / edit registration'}
        </Button>
        <Popconfirm
          title={'Disable new native admission?'}
          description={
            'Clears approved inventory only. Retained identity, key and capacity stay in place. Already accepted execution is not stopped.'
          }
          onConfirm={disable}
          okText={'Disable admission'}
          disabled={cannotDisable}>
          <Button
            aria-label={'Disable native admission'}
            icon={<PauseCircleOutlined aria-hidden />}
            danger
            disabled={cannotDisable}
            loading={busy}>
            Disable native admission
          </Button>
        </Popconfirm>
      </Flex>
      {failure && (
        <Alert
          type={'warning'}
          showIcon
          message={failure}
          action={
            attention ? (
              <Button href={generateRunnerDetailUrl(runner.org_id, runner.id)}>
                Refresh registration
              </Button>
            ) : undefined
          }
        />
      )}
    </Flex>
  );
};
