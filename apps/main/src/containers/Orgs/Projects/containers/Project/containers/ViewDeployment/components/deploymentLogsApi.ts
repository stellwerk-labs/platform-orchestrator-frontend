const maximumLogBytes = 4 * 1024 * 1024;

const readBoundedLog = async (response: Response): Promise<string | undefined> => {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let content = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return content + decoder.decode();
      bytes += value.byteLength;
      if (bytes > maximumLogBytes) {
        return undefined;
      }
      content += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
};

const statusMessage = (status: number, pipeline: boolean) => {
  if (pipeline && status === 413)
    return 'Execution logs exceed the 4 MiB viewer limit and cannot be displayed.';
  if (pipeline && status === 404)
    return 'Execution logs are not available yet or were not captured for this deployment.';
  if (pipeline && status === 409)
    return 'The execution changed. Reload the deployment status before reading its logs.';
  if (pipeline && status >= 500)
    return 'Execution logs are unavailable. The Runner may be disconnected; this does not establish execution failure.';
  if (status === 409)
    return 'This deployment uses a caller-managed log key. Read it with octl logs --key-file. New deployments can use automatic log access.';
  if (status === 401) return 'Your session expired. Sign in again to read the logs.';
  if (status === 403) return 'You do not have permission to read these deployment logs.';
  if (status === 404)
    return 'Logs are not available. They may still be uploading, may not have been stored, or may no longer be retained.';
  return 'The logs could not be loaded. Try again.';
};

export const loadDeploymentLogs = async (
  apiBaseURL: string,
  orgId: string,
  deploymentId: string,
  signal: AbortSignal,
  pipeline = false,
  selection?: {
    phase: 'plan' | 'apply';
    executionId?: string;
    captureRevision?: number;
    subject?: string;
  },
): Promise<string> => {
  const path = `/orgs/${encodeURIComponent(orgId)}/deployments/${encodeURIComponent(deploymentId)}/actions/get-logs`;
  const url = new URL(`${apiBaseURL.replace(/\/$/u, '')}${path}`);
  url.searchParams.set('decrypt', 'true');
  if (selection) {
    url.searchParams.set('phase', selection.phase);
    if (selection.executionId) url.searchParams.set('execution_id', selection.executionId);
    if (selection.captureRevision)
      url.searchParams.set('capture_revision', String(selection.captureRevision));
    if (selection.phase === 'plan') url.searchParams.set('subject', selection.subject ?? '');
  }
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'text/plain' },
      credentials: 'include',
      redirect: 'error',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal,
    });
  } catch {
    throw new Error(
      'The log request was interrupted or could not reach the Orchestrator. Try again.',
    );
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(
      selection && response.status === 409
        ? 'The retained artifact or managed identity is unavailable. Reload deployment status; this does not establish execution failure.'
        : statusMessage(response.status, pipeline),
    );
  }
  let content: string | undefined;
  try {
    content = await readBoundedLog(response);
  } catch {
    throw new Error(
      'The log request was interrupted or could not reach the Orchestrator. Try again.',
    );
  }
  if (content === undefined) {
    throw new Error(
      pipeline
        ? statusMessage(413, true)
        : 'This log exceeds the 4 MiB viewer limit. Download it with octl logs instead.',
    );
  }
  return content;
};
