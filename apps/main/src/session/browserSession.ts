export interface BrowserSession {
  user_id: string;
  idle_timeout_ms: number;
  server_time: string;
  expires_at: string;
}

// At most one renewal per reporting window. There is no heartbeat: a trailing
// renewal exists only when an input event occurred during that window.
export const activityReportingWindow = 10_000;
const sessionPolicyRefreshInterval = 30_000;
const sessionChannelName = 'stellwerk-session';

export class SessionRejectedError extends Error {}

export const announceSessionPolicyChange = () => {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(sessionChannelName);
  channel.postMessage('policy');
  channel.close();
};
export const sessionInputEvents = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'touchstart',
] as const;

export const sessionDeadline = (session: BrowserSession, requestStartedAt: number) => {
  const remaining = Date.parse(session.expires_at) - Date.parse(session.server_time);
  if (!Number.isFinite(remaining) || remaining <= 0) throw new Error('Session expired');
  return requestStartedAt + remaining;
};

export const startBrowserSession = ({
  request,
  onChecking,
  onActive,
  onExpired,
}: {
  request: (activity: boolean, signal: AbortSignal) => Promise<BrowserSession>;
  onChecking: () => void;
  onActive: () => void;
  onExpired: () => void;
}) => {
  const abort = new AbortController();
  const channel =
    typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(sessionChannelName);
  let deadline = 0;
  let userId: string | undefined;
  let busy = false;
  let stopped = false;
  let lastReport = 0;
  let reportingWindow = activityReportingWindow;
  let expiryTimer: ReturnType<typeof setTimeout>;
  let activityTimer: ReturnType<typeof setTimeout> | undefined;

  const expire = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(expiryTimer);
    clearTimeout(activityTimer);
    clearInterval(policyTimer);
    onExpired();
  };

  const check = async (recordActivity = false) => {
    if (busy || stopped) return;
    busy = true;
    const startedAt = Date.now();
    try {
      const session = await request(recordActivity, abort.signal);
      if (stopped) return;
      if (userId && userId !== session.user_id) {
        expire();
        return;
      }
      userId = session.user_id;
      if (!Number.isFinite(session.idle_timeout_ms) || session.idle_timeout_ms < 1000) {
        expire();
        return;
      }
      reportingWindow = Math.min(activityReportingWindow, session.idle_timeout_ms / 4);
      deadline = sessionDeadline(session, startedAt);
      if (Date.now() >= deadline) {
        expire();
        return;
      }
      clearTimeout(expiryTimer);
      expiryTimer = setTimeout(() => {
        onChecking();
        void check();
      }, deadline - Date.now());
      if (recordActivity) channel?.postMessage('activity');
      onActive();
    } catch (error) {
      if (!stopped && (error instanceof SessionRejectedError || Date.now() >= deadline)) expire();
    } finally {
      busy = false;
    }
  };

  const activity = () => {
    if (stopped || document.visibilityState !== 'visible' || !deadline) return;
    // The server rejects an already expired token even if a timer was suspended.
    if (Date.now() >= deadline) {
      onChecking();
      void check();
      return;
    }
    if (busy || activityTimer) return;
    const delay = Math.max(0, lastReport + reportingWindow - Date.now());
    if (delay === 0) {
      lastReport = Date.now();
      void check(true);
    } else {
      activityTimer = setTimeout(() => {
        activityTimer = undefined;
        lastReport = Date.now();
        void check(true);
      }, delay);
    }
  };
  const input = (event: Event) => {
    if (event.isTrusted) activity();
  };
  const resume = () => {
    if (stopped) return;
    if (document.visibilityState === 'visible') {
      if (Date.now() >= deadline) onChecking();
      void check();
    }
  };
  // Cross-tab messages are only hints to re-read authoritative state. Never
  // accept a deadline or a credential from another tab.
  if (channel) channel.onmessage = () => void check();
  for (const event of sessionInputEvents)
    document.addEventListener(event, input, { passive: true });
  window.addEventListener('focus', resume);
  window.addEventListener('pageshow', resume);
  document.addEventListener('visibilitychange', resume);
  const policyTimer = setInterval(() => void check(), sessionPolicyRefreshInterval);
  onChecking();
  void check();

  return {
    activity,
    stop: () => {
      stopped = true;
      abort.abort();
      clearInterval(policyTimer);
      clearTimeout(expiryTimer);
      clearTimeout(activityTimer);
      channel?.close();
      for (const event of sessionInputEvents) document.removeEventListener(event, input);
      window.removeEventListener('focus', resume);
      window.removeEventListener('pageshow', resume);
      document.removeEventListener('visibilitychange', resume);
    },
  };
};
