import { customInstance } from '@src/custom-instance';
import type { PipelineDraft, PipelineDraftCreate } from '@src/models/pipelines';

export type PipelineDocument = PipelineDraftCreate;
export type SourceFormat = 'json' | 'yaml';
export type DocumentError = { path: string; code: string; message: string };
export type DocumentValidation = {
  valid: boolean;
  document?: PipelineDocument;
  errors: DocumentError[];
};
const path = (orgId: string, projectId: string) =>
  `/orgs/${encodeURIComponent(orgId)}/projects/${encodeURIComponent(projectId)}/pipelines`;
const contentType = (format: SourceFormat) =>
  format === 'yaml' ? 'application/yaml' : 'application/json';

export const getPipelineSchema = (orgId: string, projectId: string, signal: AbortSignal) =>
  customInstance<Record<string, unknown>>({
    url: `${path(orgId, projectId)}/schema`,
    signal,
    timeout: 30_000,
  });
export const validatePipelineDocument = (
  orgId: string,
  projectId: string,
  source: string,
  format: SourceFormat,
  signal: AbortSignal,
) =>
  customInstance<DocumentValidation>({
    url: `${path(orgId, projectId)}/validate`,
    method: 'POST',
    timeout: 30_000,
    headers: { 'Content-Type': contentType(format) },
    data: source,
    signal,
    transformRequest: [(value: string) => value],
  });
export const savePipelineDocument = (
  orgId: string,
  projectId: string,
  draft: PipelineDraft,
  source: string,
  format: SourceFormat,
  signal?: AbortSignal,
) =>
  customInstance<PipelineDraft>({
    url: `${path(orgId, projectId)}/${encodeURIComponent(draft.id)}/document`,
    method: 'PUT',
    signal,
    headers: {
      'Content-Type': contentType(format),
      'If-Match': `"${draft.resource_version}"`,
    },
    data: source,
    transformRequest: [(value: string) => value],
  });
