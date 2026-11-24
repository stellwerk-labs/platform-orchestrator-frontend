import { Alert, Button, Flex, Input, Segmented, Spin, Typography } from 'antd';
import { lazy, Suspense, useEffect, useState } from 'react';

import { useUserPreferencesStore } from '@src/hooks/zustand/useUserPreferencesStore';

import { getPipelineSchema, type SourceFormat } from './pipelineDocumentApi';

const Monaco = lazy(() =>
  import('@src/components/shared/SourceMonaco').then((module) => ({
    default: module.SourceMonaco,
  })),
);
export const PipelineSource = ({
  orgId,
  projectId,
  source,
  format,
  disabled,
  onChange,
  onFormat,
  checking,
  valid,
  onValidate,
}: {
  orgId: string;
  projectId: string;
  source: string;
  format: SourceFormat;
  disabled: boolean;
  onChange: (source: string) => void;
  onFormat: (format: SourceFormat) => void;
  checking: boolean;
  valid: boolean;
  onValidate: () => void;
}) => {
  const [schema, setSchema] = useState<Record<string, unknown>>();
  const [schemaError, setSchemaError] = useState(false);
  const dark = useUserPreferencesStore((state) => state.theme) === 'dark';
  useEffect(() => {
    const request = new AbortController();
    setSchema(undefined);
    setSchemaError(false);
    void getPipelineSchema(orgId, projectId, request.signal)
      .then((loaded) => {
        if (!request.signal.aborted) setSchema(loaded);
      })
      .catch(() => {
        if (!request.signal.aborted) setSchemaError(true);
      });
    return () => request.abort();
  }, [orgId, projectId]);
  const fallback = (
    <Input.TextArea
      aria-label={'Pipeline source'}
      rows={22}
      value={source}
      readOnly={disabled}
      onChange={(event) => onChange(event.target.value)}
      style={{ fontFamily: 'monospace' }}
    />
  );
  return (
    <Flex vertical gap={'middle'} className={'amp-block'} data-amp-mask data-dd-privacy={'hidden'}>
      <Flex gap={'small'} align={'center'}>
        <Segmented
          aria-label={'Source format'}
          options={[
            { label: 'YAML', value: 'yaml' },
            { label: 'JSON', value: 'json' },
          ]}
          value={format}
          disabled={disabled || checking}
          onChange={onFormat}
        />
        <Button onClick={onValidate} loading={checking} disabled={disabled}>
          Validate source
        </Button>
      </Flex>
      <Typography.Text type={'secondary'}>
        The API, CLI and Terraform provider use this same document. Returning to Designer requires a
        valid document. Designer edits regenerate formatting and comments.
      </Typography.Text>
      {schemaError && (
        <Alert
          type={'warning'}
          showIcon
          message={'Schema completion could not be loaded. Server validation is still required.'}
        />
      )}
      {valid && <Alert type={'success'} showIcon message={'The current document is valid.'} />}
      {schema ? (
        <Suspense
          fallback={
            <Flex vertical gap={'small'}>
              <Spin />
              {fallback}
            </Flex>
          }>
          <Monaco
            documentName={'pipeline'}
            ariaLabel={'Pipeline source'}
            value={source}
            format={format}
            schema={schema}
            readOnly={disabled}
            dark={dark}
            onChange={onChange}
          />
        </Suspense>
      ) : (
        fallback
      )}
    </Flex>
  );
};
