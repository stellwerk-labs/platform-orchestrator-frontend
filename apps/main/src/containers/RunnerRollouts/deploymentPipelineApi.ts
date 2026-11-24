import { isAxiosError } from 'axios';

import { customInstance } from '@src/custom-instance';
import type { PipelinePolicy, PipelineRecipe } from '@src/models/pipelines';
import type { Deployment, DeploymentCreateBody, DeploymentSummary } from '@src/models/v2/dataplane';

import type { Rollout, RolloutScope } from './rolloutApi';

export type PipelineDefinition = {
  id: string;
  version: number;
  name: string;
  strategy: 'apply' | 'apply_saved' | 'plan' | 'reviewed' | 'destroy';
  steps: {
    id: string;
    tool_id: string;
    phase: 'pre_plan' | 'plan_check' | 'post_apply';
    parameters: Record<string, unknown>;
  }[];
  intended_strategy?: 'apply' | 'reviewed';
  cost?: PipelineRecipe['cost'];
  approval?: PipelineRecipe['approval'];
  pipeline_id?: string;
  project_id?: string;
  digest?: string;
  compatible?: boolean;
  reason?: string;
};

export type PipelineDeployment = DeploymentSummary;
export type PipelineControlAction = 'approve' | 'deny' | 'cancel' | 'repair';
export type PipelineControlIntent =
  | { action: 'approve' | 'deny'; subject: string }
  | { action: 'cancel' }
  | { action: 'repair'; failed_step: string; revision: number };
export type PipelineControlReceipt = {
  id: string;
  deployment_id: string;
  actor_id: string;
  action: PipelineControlAction;
  status: 'pending' | 'resolved';
  created_at: string;
  expires_at: string;
  result?: {
    version: 'stellwerk.pipeline.control-result/v1';
    control_id: string;
    rollout_id: string;
    request_digest: string;
    execution_digest: string;
    outcome: 'applied' | 'refused';
    code: string;
    phase: string;
    revision: number;
  };
};

export type DeploymentPipeline = {
  available_controls?: PipelineControlAction[];
  origin?: {
    plugin_id: string;
    request_id: string;
    operation_ref?: string;
    observation_run_id?: string;
  };
  definition: PipelineDefinition;
  progress: Rollout & { infrastructure_applied: boolean };
  plan?: {
    state: 'ready' | 'superseded' | 'used' | 'busy' | 'unavailable' | 'pending';
    subject?: string;
    base_deployment_id?: string;
    current_deployment_id?: string;
    apply_deployment_id?: string;
    reason?: string;
    can_replan: boolean;
  };
  source_plan_id?: string;
  replanned_from_id?: string;
};
export type CreatePipelineDeployment = DeploymentCreateBody & {
  pipeline?: { id: string; version: number };
};

export const pipelineQueryKey = (orgId: string, id: string) => ['deployment-pipeline', orgId, id];
const segment = encodeURIComponent;

export const listDeploymentPipelines = ({ orgId, projectId, envId }: RolloutScope) =>
  customInstance<{
    items: PipelineDefinition[];
    default_pipeline_id?: string;
    default_source?: 'environment' | 'project' | 'none';
    policy?: PipelinePolicy;
  }>({
    url: `/orgs/${segment(orgId)}/projects/${segment(projectId)}/envs/${segment(envId)}/deployment-pipelines`,
    method: 'GET',
  });

export const getDeploymentPipeline = async (orgId: string, id: string) => {
  try {
    return await customInstance<DeploymentPipeline>({
      url: `/orgs/${segment(orgId)}/deployments/${segment(id)}/pipeline`,
      method: 'GET',
    });
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
};

export const createPipelineDeployment = (
  orgId: string,
  body: CreatePipelineDeployment,
  idempotencyKey: string,
) =>
  customInstance<Deployment>({
    url: `/orgs/${segment(orgId)}/deployments`,
    method: 'POST',
    data: body,
    headers: { 'Idempotency-Key': idempotencyKey },
  });

export const applySavedPlan = (
  orgId: string,
  id: string,
  subject: string,
  idempotencyKey: string,
) =>
  customInstance<Deployment>({
    url: `/orgs/${segment(orgId)}/deployments/${segment(id)}/pipeline/actions/apply-plan`,
    method: 'POST',
    data: { subject },
    headers: { 'Idempotency-Key': idempotencyKey },
  });

export const replanDeployment = (orgId: string, id: string, idempotencyKey: string) =>
  customInstance<Deployment>({
    url: `/orgs/${segment(orgId)}/deployments/${segment(id)}/pipeline/actions/replan`,
    method: 'POST',
    data: {},
    headers: { 'Idempotency-Key': idempotencyKey },
  });

export const executionHasStarted = ({ definition, progress }: DeploymentPipeline) =>
  definition.strategy !== 'plan' &&
  (progress.infrastructure_applied ||
    [
      'applying',
      'applied',
      'post_tasks',
      'post_failed',
      'post_retrying',
      'completed',
      'outcome_unknown',
    ].includes(progress.phase));

export const deploymentPipelineError = (error: unknown) => {
  if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
  return error instanceof Error ? error.message : 'The deployment request could not be confirmed.';
};

const controlsPath = (orgId: string, id: string) =>
  `/orgs/${segment(orgId)}/deployments/${segment(id)}/pipeline/controls`;

export const createPipelineControl = (
  orgId: string,
  id: string,
  intent: PipelineControlIntent,
  idempotencyKey: string,
  signal: AbortSignal,
) =>
  customInstance<PipelineControlReceipt>({
    url: controlsPath(orgId, id),
    method: 'POST',
    data: intent,
    headers: { 'Idempotency-Key': idempotencyKey },
    signal,
    timeout: 10_000,
  });

export const getPipelineControl = (
  orgId: string,
  id: string,
  controlId: string,
  signal: AbortSignal,
) =>
  customInstance<PipelineControlReceipt>({
    url: `${controlsPath(orgId, id)}/${segment(controlId)}`,
    method: 'GET',
    signal,
    timeout: 10_000,
  });
