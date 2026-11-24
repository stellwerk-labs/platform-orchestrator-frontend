import { CodeOutlined, FormOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Segmented, Spin, Typography } from 'antd';
import { lazy, Suspense } from 'react';

import { useUserPreferencesStore } from '@src/hooks/zustand/useUserPreferencesStore';

import { NativeRunnerForm } from './NativeRunnerForm';
import type { useNativeRunnerDocument } from './useNativeRunnerDocument';

type DocumentState = ReturnType<typeof useNativeRunnerDocument>;
const Monaco = lazy(() =>
  import('@src/components/shared/SourceMonaco').then((module) => ({
    default: module.SourceMonaco,
  })),
);
const ValidationFeedback = ({ doc }: { doc: DocumentState }) => {
  if (doc.error) return <Alert type={'error'} showIcon message={doc.error} />;
  if (doc.valid)
    return (
      <Alert type={'success'} showIcon message={'Current document matches the public schema.'} />
    );
  if (doc.validation?.status === 'invalid')
    return (
      <Alert
        type={'error'}
        showIcon
        message={'Fix the public configuration before continuing.'}
        description={doc.validation.messages.join('\n')}
      />
    );
  if (doc.validation?.status === 'unavailable')
    return (
      <Alert
        type={'error'}
        showIcon
        message={'Validation unavailable. Save is blocked.'}
        description={doc.validation.messages.join('\n')}
      />
    );
  return <Alert type={'info'} showIcon message={'Validating current public configuration…'} />;
};

export const NativeRunnerDocumentEditor = ({
  doc,
  create,
  disabled,
  saving,
  schema,
}: {
  doc: DocumentState;
  create: boolean;
  disabled: boolean;
  saving: boolean;
  schema: Record<string, unknown>;
}) => {
  const dark = useUserPreferencesStore((state) => state.theme) === 'dark';
  return (
    <>
      <Flex gap={'small'} wrap>
        <Segmented
          aria-label={'Runner editor view'}
          value={doc.mode}
          options={[
            {
              label: (
                <>
                  <FormOutlined aria-hidden /> Form
                </>
              ),
              value: 'form',
              disabled: doc.mode === 'code' && !doc.valid,
            },
            {
              label: (
                <>
                  <CodeOutlined aria-hidden /> Code
                </>
              ),
              value: 'code',
            },
          ]}
          onChange={doc.changeMode}
        />
        <Segmented
          aria-label={'Runner source format'}
          value={doc.format}
          disabled={disabled}
          options={[
            { label: 'YAML', value: 'yaml' },
            { label: 'JSON', value: 'json' },
          ]}
          onChange={doc.changeFormat}
        />
        <Button onClick={doc.retry} disabled={saving}>
          Retry validation
        </Button>
      </Flex>
      <Typography.Text type={'secondary'}>
        Form edits and format changes regenerate formatting and comments. Returning from Code to
        Form and saving require the current document to validate.
      </Typography.Text>
      <ValidationFeedback doc={doc} />
      {doc.mode === 'form' && (
        <NativeRunnerForm
          values={doc.values}
          create={create}
          disabled={disabled}
          onChange={doc.changeValues}
          onImport={doc.importInventory}
        />
      )}
      <div hidden={doc.mode !== 'code'}>
        <Suspense fallback={<Spin tip={'Loading local source editor'} />}>
          <Monaco
            key={doc.editorKey}
            documentName={create ? 'native-runner-create' : 'native-runner-update'}
            ariaLabel={'Native Runner source'}
            value={doc.source}
            format={doc.format}
            schema={schema}
            readOnly={disabled}
            dark={dark}
            onChange={doc.changeSource}
            onValidation={doc.report}
          />
        </Suspense>
      </div>
    </>
  );
};
