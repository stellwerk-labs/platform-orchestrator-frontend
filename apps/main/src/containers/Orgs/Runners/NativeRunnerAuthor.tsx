import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Spin, Typography } from 'antd';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { DataEntry } from '@src/components/shared/ui/DataEntry/DataEntry';
import { MatchParams } from '@src/config/routing';
import { useGetRunner } from '@src/hooks/react-query/v2/controlplane/runner/runner';
import { RBACPermission, RBACStatus, useRBAC } from '@src/hooks/useRBAC';
import type { Runner } from '@src/models/v2/controlplane';
import { generateRunnerDetailUrl, generateRunnersUrl } from '@src/utilities/navigation';

import { nativeRunnerDocument } from './nativeRunnerDocument';
import { NativeRunnerDocumentEditor } from './NativeRunnerDocumentEditor';
import schemas from './nativeRunnerSchemas.json';
import { useNativeRunnerDocument } from './useNativeRunnerDocument';
import { useNativeRunnerSave } from './useNativeRunnerSave';

const MutationFeedback = ({ state }: { state: ReturnType<typeof useNativeRunnerSave> }) => {
  if (!state.failure) return null;
  const advertised =
    state.attention?.runner.runner_configuration?.type === 'native-agent' &&
    state.attention.runner.runner_configuration.native_execution;
  return (
    <>
      <Alert
        type={state.attention ? 'warning' : 'error'}
        showIcon
        message={state.failure}
        action={
          state.attention ? (
            <Button href={state.attention.reviewUrl} target={'_blank'} rel={'noopener noreferrer'}>
              Open current registration
            </Button>
          ) : undefined
        }
      />
      {state.attention && (
        <Typography.Text>
          Current server inventory: {advertised ? 'advertised' : 'absent or changed'}. The original
          UUID and source are retained here.
        </Typography.Text>
      )}
    </>
  );
};

const NativeRunnerEditor = ({
  orgId,
  base,
  canEdit,
}: {
  orgId: string;
  base?: Runner;
  canEdit: boolean;
}) => {
  const [captured] = useState(base);
  const create = !captured;
  const operation = captured
    ? {
        schema: schemas.update,
        values: nativeRunnerDocument(captured),
        back: generateRunnerDetailUrl(orgId, captured.id),
        backLabel: 'Runner',
        title: `Edit ${captured.id}`,
        submit: 'Save Runner',
        intro: 'Only changed public fields will be saved.',
      }
    : {
        schema: schemas.create,
        values: {
          id: '',
          runner_configuration: { type: 'native-agent' as const, key: '', max_parallel_jobs: 1 },
        },
        back: generateRunnersUrl(orgId),
        backLabel: 'runners',
        title: 'Register native Runner',
        submit: 'Register Runner',
        intro: 'Register the installed site’s public configuration.',
      };
  const { schema, back } = operation;
  const doc = useNativeRunnerDocument(operation.values, schema);
  const save = useNativeRunnerSave(orgId, captured, canEdit, doc.currentDocument);
  return (
    <Flex vertical gap={'middle'} className={'amp-block'} data-amp-mask data-dd-privacy={'hidden'}>
      <Link to={back}>
        <ArrowLeftOutlined aria-hidden /> Back to {operation.backLabel}
      </Link>
      <PageHeader customHeading={operation.title} />
      {captured && (
        <DataEntry label={'Immutable registration UUID'} value={captured.uuid} copyable />
      )}
      <Alert
        type={'info'}
        showIcon
        message={operation.intro}
        description={
          'Keep private runtime configuration at the site. After registration, install the returned UUID as runner_uuid before site initialization. Public metadata does not start execution.'
        }
      />
      {!canEdit && (
        <Alert
          type={'warning'}
          showIcon
          message={'Runner write permission is required. Your document is read-only.'}
        />
      )}
      {!save.identityValid && (
        <Alert
          type={'error'}
          showIcon
          message={
            'This registration has no usable retained identity. Refresh and review before editing.'
          }
        />
      )}
      <MutationFeedback state={save} />
      <NativeRunnerDocumentEditor
        doc={doc}
        create={create}
        disabled={save.disabled}
        saving={save.busy}
        schema={schema}
      />
      <Flex gap={'small'}>
        <Button
          type={'primary'}
          aria-label={operation.submit}
          icon={<SaveOutlined aria-hidden />}
          disabled={save.disabled || !doc.valid}
          loading={save.busy}
          onClick={() => void save.save()}>
          {operation.submit}
        </Button>
        <Button href={back}>Cancel</Button>
      </Flex>
    </Flex>
  );
};

export const NativeRunnerAuthor = ({ create }: { create?: boolean }) => {
  const { orgId, runnerId } = useParams<keyof MatchParams>() as MatchParams;
  const read = useRBAC(RBACPermission.RUNNER_READ);
  const write = useRBAC(RBACPermission.RUNNER_WRITE);
  const {
    data: runner,
    isPending,
    isError,
  } = useGetRunner(orgId, runnerId, {
    query: { enabled: !create && read === RBACStatus.ALLOWED, retry: false },
  });
  if (write === RBACStatus.LOADING || read === RBACStatus.LOADING) return <Spin />;
  if (create)
    return (
      <NativeRunnerEditor
        key={`${orgId}:create`}
        orgId={orgId}
        canEdit={write === RBACStatus.ALLOWED}
      />
    );
  if (read !== RBACStatus.ALLOWED)
    return <Alert type={'warning'} showIcon message={'Runner read permission is required.'} />;
  if (isPending) return <Spin />;
  if (isError || !runner)
    return <Alert type={'error'} showIcon message={'The native Runner could not be loaded.'} />;
  if (runner.runner_configuration.type !== 'native-agent')
    return <Alert type={'error'} showIcon message={'The native Runner could not be loaded.'} />;
  return (
    <NativeRunnerEditor
      key={`${orgId}:${runnerId}`}
      orgId={orgId}
      base={runner}
      canEdit={write === RBACStatus.ALLOWED}
    />
  );
};
