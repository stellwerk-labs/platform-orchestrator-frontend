import type { RolloutScope } from './rolloutApi';

const maximumLogBytes = 4 * 1024 * 1024;
const unavailable =
  'The plan logs could not be loaded. The Runner may be disconnected; this does not establish execution failure.';

const statusMessage = (status: number) => {
  switch (status) {
    case 401:
      return 'Your session expired. Sign in again to read the plan logs.';
    case 403:
      return 'You do not have permission to read these plan logs.';
    case 404:
      return 'Plan logs are not available yet or were not captured for this older run.';
    case 409:
      return 'The plan changed. Reload the pipeline status before reviewing its logs.';
    case 413:
      return 'The complete plan log exceeds the 4 MiB viewer limit and cannot be displayed.';
    default:
      return unavailable;
  }
};

const readLog = async (response: Response): Promise<string> => {
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
      if (bytes > maximumLogBytes) throw new Error(statusMessage(413));
      content += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
};

/** Loads only the log artifact bound to the displayed saved-plan subject. */
export const loadPlanLogs = async (
  apiBaseURL: string,
  scope: RolloutScope,
  id: string,
  subject: string,
  signal: AbortSignal,
): Promise<string> => {
  const segments = [scope.orgId, scope.projectId, scope.envId, id].map(encodeURIComponent);
  const path = `/orgs/${segments[0]}/projects/${segments[1]}/envs/${segments[2]}/runner-rollouts/${segments[3]}/plan-logs`;
  const url = new URL(`${apiBaseURL.replace(/\/$/u, '')}${path}`);
  url.searchParams.set('subject', subject);
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
    throw new Error(unavailable);
  }
  if (!response.ok || response.headers.get('X-Stellwerk-Plan-Subject') !== subject) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(statusMessage(response.ok ? 409 : response.status));
  }
  try {
    return await readLog(response);
  } catch (error) {
    if (error instanceof Error && error.message === statusMessage(413)) throw error;
    throw new Error(unavailable);
  }
};
