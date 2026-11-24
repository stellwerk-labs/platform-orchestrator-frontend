import { dump } from 'js-yaml';
import { isEqual } from 'lodash';
import { useEffect, useRef, useState } from 'react';

import type { PipelineDraft } from '@src/models/pipelines';

import {
  type PipelineDocument,
  type SourceFormat,
  validatePipelineDocument,
} from './pipelineDocumentApi';

// JSON omits undefined fields, and property order does not change a document.
export const samePipelineDocument = (left: PipelineDocument, right: PipelineDocument) =>
  isEqual(JSON.parse(JSON.stringify(left)), JSON.parse(JSON.stringify(right)));

export const encodePipelineDocument = (document: PipelineDocument, format: SourceFormat) =>
  format === 'yaml'
    ? dump(document, { noRefs: true, lineWidth: 100 })
    : JSON.stringify(document, null, 2);

export const usePipelineDocument = ({
  orgId,
  projectId,
  base,
  values,
  canEdit,
  onDocument,
}: {
  orgId: string;
  projectId: string;
  base?: PipelineDraft;
  values: PipelineDocument;
  canEdit: boolean;
  onDocument: (document: PipelineDocument) => void;
}) => {
  const [mode, setMode] = useState<'designer' | 'code'>('designer');
  const [format, setFormat] = useState<SourceFormat>('yaml');
  const [source, setSource] = useState(() => encodePipelineDocument(values, 'yaml'));
  const [validation, setValidation] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [valid, setValid] = useState(false);
  const [codeDirty, setCodeDirty] = useState(false);
  const preserved = useRef({ source, document: values, format });
  const pending = useRef<AbortController | undefined>(undefined);
  const current = useRef({
    source,
    format,
    values,
    canEdit,
    orgId,
    projectId,
    revision: base?.resource_version,
  });
  current.current = {
    source,
    format,
    values,
    canEdit,
    orgId,
    projectId,
    revision: base?.resource_version,
  };
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    pending.current?.abort();
    setChecking(false);
    setValid(false);
  }, [canEdit, orgId, projectId, base?.resource_version]);

  const identity = () => JSON.stringify(current.current);
  const validate = async (text = source, language = format) => {
    pending.current?.abort();
    if (!current.current.canEdit) return undefined;
    const snapshot = identity();
    const request = new AbortController();
    pending.current = request;
    setChecking(true);
    setValid(false);
    setValidation(undefined);
    try {
      const result = await validatePipelineDocument(
        orgId,
        projectId,
        text,
        language,
        request.signal,
      );
      const latest = current.current;
      if (request.signal.aborted || identity() !== snapshot || !latest.canEdit) return undefined;
      if (!result.valid || !result.document) {
        setValidation(
          result.errors
            .map((error) => `${error.path || 'Document'}: ${error.message}`)
            .join('\n') || 'The document is invalid.',
        );
        return undefined;
      }
      if (base && result.document.slug !== base.slug) {
        setValidation('The pipeline ID cannot change after creation.');
        return undefined;
      }
      setValid(true);
      return result.document;
    } catch {
      if (!request.signal.aborted && identity() === snapshot)
        setValidation('The document could not be validated. Your source has been kept. Try again.');
      return undefined;
    } finally {
      if (pending.current === request) setChecking(false);
    }
  };
  const changeSource = (text: string) => {
    pending.current?.abort();
    setChecking(false);
    setValidation(undefined);
    setSource(text);
    setValid(false);
    setCodeDirty(true);
  };
  const designerSource = () =>
    samePipelineDocument(preserved.current.document, values) && preserved.current.format === format
      ? preserved.current.source
      : encodePipelineDocument(values, format);
  const changeMode = async (next: 'designer' | 'code') => {
    if (next === mode) return;
    if (next === 'code') {
      setValid(false);
      setSource(designerSource());
      setMode('code');
      return;
    }
    if (!canEdit && !codeDirty) {
      setMode('designer');
      return;
    }
    const document = await validate();
    if (!document) return;
    preserved.current = { source, format, document };
    onDocument(document);
    setMode('designer');
    setCodeDirty(false);
  };
  const changeFormat = async (next: SourceFormat) => {
    if (next === format) return;
    const document = await validate();
    if (!document) return;
    setSource(encodePipelineDocument(document, next));
    setFormat(next);
    setValid(false);
    setCodeDirty(true);
  };
  const prepareSave = async () => {
    const text = mode === 'code' ? source : designerSource();
    const document = await validate(text, format);
    return document ? { document, source: text, format } : undefined;
  };
  const saved = (document: PipelineDocument, text: string, language: SourceFormat) => {
    preserved.current = { source: text, format: language, document };
    setSource(text);
    setCodeDirty(false);
    setValidation(undefined);
  };
  return {
    mode,
    format,
    source,
    validation,
    checking,
    valid,
    codeDirty,
    changeSource,
    changeMode,
    changeFormat,
    validate,
    prepareSave,
    saved,
  };
};
