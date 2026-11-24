import { isAxiosError } from 'axios';

import { customInstance } from '@src/custom-instance';

export type ResourceChanges = { add: number; change: number; remove: number };
export type CostEstimate = {
  version: string;
  estimator: string;
  build: string;
  currency: string;
  status: 'complete' | 'partial' | 'unknown';
  before_monthly?: string;
  after_monthly?: string;
  delta_monthly?: string;
  before_coverage?: CostCoverage;
  after_coverage?: CostCoverage;
  reason?: string;
  generated_at: string;
};
type CostCoverage = {
  resources: number;
  priced: number;
  free: number;
  unknown: number;
  unpriced: number;
  missing_usage: number;
};
export type ApprovalDecision = {
  source: 'human' | 'policy';
  decision: 'approve' | 'deny';
  actor_id?: string;
  policy_id?: string;
  policy_version?: string;
  decided_at: string;
  reason?: string;
  subject: string;
  evidence_digest?: string;
};
export type RolloutStep = {
  id: string;
  phase: string;
  status: string;
  code?: string;
  outcome?: {
    verdict: 'allow' | 'deny';
    meaning?: string;
    tool_id?: string;
    tool_name?: string;
    tool_version?: string;
  };
};

export type Rollout = {
  id: string;
  environment_id: string;
  phase: string;
  subject?: string;
  error_code?: string;
  failed_step?: string;
  revision: number;
  created_at: string;
  last_received_at?: string;
  infrastructure_applied?: boolean;
  changes?: ResourceChanges;
  plan_changes?: ResourceChanges;
  apply_changes?: ResourceChanges;
  approval_decision?: ApprovalDecision;
  cost?: CostEstimate;
  steps?: RolloutStep[];
};

export type RolloutScope = { orgId: string; projectId: string; envId: string };

const base = ({ orgId, projectId, envId }: RolloutScope) =>
  `/orgs/${encodeURIComponent(orgId)}/projects/${encodeURIComponent(projectId)}/envs/${encodeURIComponent(envId)}/runner-rollouts`;

/** Calls the authenticated environment rollout API and exposes safe failure messages. */
async function request<T>(scope: RolloutScope, path: string, body: unknown): Promise<T> {
  try {
    return await customInstance<T>({
      url: base(scope) + path,
      method: 'POST',
      data: body,
    });
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    const reason =
      status === 409
        ? 'The deployment changed or this request conflicts with an earlier decision. Reload its status.'
        : status === 403
          ? 'You do not have permission for this rollout action, or this environment uses another Runner.'
          : 'The pipeline action is unavailable or was refused.';
    throw new Error(reason);
  }
}

export const rolloutApi = {
  approve: (scope: RolloutScope, id: string, subject: string) =>
    request<Rollout>(scope, `/${encodeURIComponent(id)}/approve`, { subject }),
  cancel: (scope: RolloutScope, id: string) =>
    request<Rollout>(scope, `/${encodeURIComponent(id)}/cancel`, {}),
  repair: (scope: RolloutScope, id: string, step: string) =>
    request<Rollout>(scope, `/${encodeURIComponent(id)}/repair`, { step_id: step }),
};
