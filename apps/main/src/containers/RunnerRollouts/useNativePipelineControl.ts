import { isAxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';

import {
  createPipelineControl,
  getPipelineControl,
  type PipelineControlIntent,
  type PipelineControlReceipt,
} from './deploymentPipelineApi';

type PendingControl = { key: string; intent: PipelineControlIntent; receiptId?: string };

const restore = (storageKey: string): PendingControl | undefined => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as PendingControl | null;
    if (!saved || typeof saved.key !== 'string' || !saved.intent) return;
    const { action } = saved.intent;
    let intent: PipelineControlIntent;
    if (action === 'approve' || action === 'deny') {
      if (!/^[0-9a-f]{64}$/.test(saved.intent.subject)) return;
      intent = { action, subject: saved.intent.subject };
    } else if (action === 'repair') {
      if (
        typeof saved.intent.failed_step !== 'string' ||
        !saved.intent.failed_step ||
        saved.intent.failed_step.length > 128 ||
        !Number.isSafeInteger(saved.intent.revision) ||
        saved.intent.revision < 1
      )
        return;
      intent = { action, failed_step: saved.intent.failed_step, revision: saved.intent.revision };
    } else if (action === 'cancel') intent = { action };
    else return;
    if (saved.receiptId !== undefined && typeof saved.receiptId !== 'string') return;
    return { key: saved.key, intent, receiptId: saved.receiptId };
  } catch {
    return;
  }
};

export const useNativePipelineControl = (
  orgId: string,
  id: string,
  actorId: string,
  canWrite: boolean,
  onResolved: () => void,
) => {
  const storageKey = JSON.stringify(['pipeline-control', orgId, id, actorId]);
  const [pending, setPending] = useState(() => restore(storageKey));
  const [receipt, setReceipt] = useState<PipelineControlReceipt>();
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const retain = useCallback(
    (next?: PendingControl) => {
      setPending(next);
      try {
        if (next) sessionStorage.setItem(storageKey, JSON.stringify(next));
        else sessionStorage.removeItem(storageKey);
      } catch {
        // The in-memory key still preserves exact retries when browser storage is unavailable.
      }
    },
    [storageKey],
  );

  useEffect(() => {
    if (!canWrite) {
      retain();
      setReceipt(undefined);
      setError(undefined);
      setBusy(false);
      return;
    }
    if (!pending || receipt?.status === 'resolved' || (!pending.receiptId && attempt === 0)) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let reads = 0;
    setBusy(true);
    setError(undefined);
    const read = async () => {
      try {
        const next = pending.receiptId
          ? await getPipelineControl(orgId, id, pending.receiptId, controller.signal)
          : await createPipelineControl(orgId, id, pending.intent, pending.key, controller.signal);
        if (controller.signal.aborted) return;
        if (
          !next.id ||
          !['pending', 'resolved'].includes(next.status) ||
          next.deployment_id !== id ||
          next.action !== pending.intent.action ||
          next.actor_id !== actorId ||
          (pending.receiptId && next.id !== pending.receiptId) ||
          (next.status === 'resolved' &&
            (!next.result ||
              next.result.control_id !== next.id ||
              next.result.rollout_id !== id ||
              next.result.version !== 'stellwerk.pipeline.control-result/v1' ||
              !['applied', 'refused'].includes(next.result.outcome)))
        )
          throw new Error('Invalid control receipt');
        setReceipt(next);
        if (!pending.receiptId) retain({ ...pending, receiptId: next.id });
        if (next.status === 'resolved') {
          setBusy(false);
          onResolved();
        } else if (pending.receiptId && ++reads < 30) timer = setTimeout(() => void read(), 1000);
        else setBusy(false);
      } catch (failure) {
        if (controller.signal.aborted) return;
        setBusy(false);
        if (isAxiosError(failure) && [401, 403].includes(failure.response?.status ?? 0)) {
          retain();
          setReceipt(undefined);
          setError('Current deployment permissions are required. Reload before trying again.');
        } else setError('The request or receipt could not be confirmed. Retry the same request.');
      }
    };
    void read();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [orgId, id, actorId, canWrite, pending, receipt?.status, attempt, retain, onResolved]);

  const submit = (intent: PipelineControlIntent) => {
    if (!canWrite || busy || (pending && receipt?.status !== 'resolved')) return;
    setReceipt(undefined);
    retain({ key: crypto.randomUUID(), intent });
    setAttempt((value) => value + 1);
  };
  return {
    pending,
    receipt,
    busy,
    error,
    blocked: Boolean(pending && receipt?.status !== 'resolved'),
    submit,
    retry: () => {
      if (canWrite && !busy) setAttempt((value) => value + 1);
    },
  };
};
