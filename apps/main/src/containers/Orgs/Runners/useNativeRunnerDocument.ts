import { dump } from 'js-yaml';
import { isEqual } from 'lodash';
import { useRef, useState } from 'react';

import type { SourceValidation } from '@src/components/shared/sourceModelValidation';

import {
  type NativeRunnerDocument,
  parseRunnerInventory,
  parseRunnerSource,
  type RunnerSourceFormat,
} from './nativeRunnerDocument';

export type NativeRunnerEditorValues = NativeRunnerDocument & { id?: string };
const encode = (values: NativeRunnerEditorValues, format: RunnerSourceFormat) =>
  format === 'json'
    ? JSON.stringify(values, null, 2)
    : dump(values, { noRefs: true, lineWidth: 100 });

export const useNativeRunnerDocument = (
  initial: NativeRunnerEditorValues,
  schema: Record<string, unknown>,
) => {
  const [values, setValues] = useState(initial);
  const [source, setSource] = useState(() => encode(initial, 'yaml'));
  const [format, setFormat] = useState<RunnerSourceFormat>('yaml');
  const [mode, setMode] = useState<'form' | 'code'>('form');
  const [validation, setValidation] = useState<SourceValidation>();
  const [error, setError] = useState<string>();
  const [editorKey, setEditorKey] = useState(0);
  const importFailure = useRef<string | undefined>(undefined);
  const latest = useRef({ source, format, schema, validation });
  latest.current = { source, format, schema, validation: latest.current.validation };
  const invalidate = () => {
    importFailure.current = undefined;
    latest.current.validation = undefined;
    setValidation(undefined);
    setError(undefined);
  };
  const changeSource = (next: string) => {
    invalidate();
    latest.current.source = next;
    setSource(next);
  };
  const changeValues = (next: NativeRunnerEditorValues) => {
    if (isEqual(values, next)) return;
    setValues(next);
    changeSource(encode(next, format));
  };
  const currentDocument = () => {
    const current = latest.current;
    if (importFailure.current) return undefined;
    if (
      current.validation?.status !== 'valid' ||
      current.validation.source !== current.source ||
      current.validation.format !== current.format ||
      current.validation.schema !== current.schema
    )
      return undefined;
    try {
      return parseRunnerSource(current.source, current.format) as NativeRunnerEditorValues;
    } catch {
      return undefined;
    }
  };
  const report = (result: SourceValidation) => {
    const current = latest.current;
    if (
      result.source !== current.source ||
      result.format !== current.format ||
      result.schema !== current.schema
    )
      return;
    try {
      parseRunnerSource(result.source, result.format);
    } catch (failure) {
      latest.current.validation = undefined;
      setValidation(undefined);
      setError((failure as Error).message);
      return;
    }
    latest.current.validation = result;
    setValidation(result);
    setError(importFailure.current);
  };
  const changeMode = (next: 'form' | 'code') => {
    if (next === 'form') {
      const document = currentDocument();
      if (!document) return;
      setValues(document);
    }
    setMode(next);
  };
  const changeFormat = (next: RunnerSourceFormat) => {
    if (next === format) return;
    let text = source;
    try {
      text = encode(parseRunnerSource(source, format) as NativeRunnerEditorValues, next);
    } catch {
      /* Keep invalid source available in the selected language. */
    }
    invalidate();
    latest.current.format = next;
    latest.current.source = text;
    setFormat(next);
    setSource(text);
  };
  const importInventory = (text: string) => {
    try {
      const inventory = parseRunnerInventory(text, 'yaml');
      changeSource(
        encode(
          {
            ...values,
            runner_configuration: {
              type: 'native-agent',
              ...values.runner_configuration,
              ...inventory,
            },
          },
          format,
        ),
      );
      setMode('code');
      return true;
    } catch (failure) {
      importFailure.current = (failure as Error).message;
      setError(importFailure.current);
      return false;
    }
  };
  const retry = () => {
    invalidate();
    setEditorKey((key) => key + 1);
  };
  return {
    values,
    source,
    format,
    mode,
    validation,
    error,
    editorKey,
    valid: validation?.status === 'valid' && Boolean(currentDocument()),
    changeSource,
    changeValues,
    changeMode,
    changeFormat,
    report,
    currentDocument,
    importInventory,
    retry,
  };
};
