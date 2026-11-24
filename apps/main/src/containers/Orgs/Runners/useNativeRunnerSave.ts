import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  createRunner,
  getGetRunnerQueryKey,
  getListRunnersQueryKey,
  updateRunner,
} from '@src/hooks/react-query/v2/controlplane/runner/runner';
import { getAllPagesQueryKey } from '@src/hooks/useFetchAllPages';
import type { Runner, RunnerCreateBody } from '@src/models/v2/controlplane';
import { generateRunnerDetailUrl } from '@src/utilities/navigation';

import {
  nativeRunnerIdentityMatches,
  nativeRunnerPatch,
  nativeRunnerResponseMatches,
} from './nativeRunnerDocument';
import type { NativeRunnerEditorValues } from './useNativeRunnerDocument';

const writeNativeRunner = async (
  orgId: string,
  base: Runner | undefined,
  values: NativeRunnerEditorValues,
) => {
  if (base) {
    const patch = nativeRunnerPatch(base, values);
    if (!Object.keys(patch).length) return undefined;
    return { actual: await updateRunner(orgId, base.id, patch), expected: base, patch };
  }
  const request = values as RunnerCreateBody;
  const actual = await createRunner(orgId, request);
  const expected: Runner = {
    ...request,
    org_id: orgId,
    uuid: actual.uuid,
    created_at: actual.created_at,
    updated_at: actual.updated_at,
  };
  return { actual, expected, patch: {} };
};

export const useNativeRunnerSave = (
  orgId: string,
  base: Runner | undefined,
  allowed: boolean,
  currentDocument: () => NativeRunnerEditorValues | undefined,
) => {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [attention, setAttention] = useState<{ runner: Runner; reviewUrl: string }>();
  const permission = useRef(allowed);
  permission.current = allowed;
  const inFlight = useRef(false);
  const unexpected = useRef<Runner | undefined>(undefined);
  const query = useQueryClient();
  const navigate = useNavigate();
  const identityValid = !base || nativeRunnerIdentityMatches(base, base);
  const save = async () => {
    const values = currentDocument();
    if (!values || !permission.current || inFlight.current || unexpected.current || !identityValid)
      return;
    inFlight.current = true;
    setBusy(true);
    setFailure(undefined);
    try {
      const result = await writeNativeRunner(orgId, base, values);
      if (!result) {
        setFailure('Nothing changed.');
        return;
      }
      const { actual, expected, patch } = result;
      if (!nativeRunnerResponseMatches(expected, patch, actual)) {
        unexpected.current = actual;
        setAttention({ runner: actual, reviewUrl: generateRunnerDetailUrl(orgId, expected.id) });
        setFailure(
          'The Runner changed beyond this edit. Requested fields may already have been saved. Your source is kept. Open the current registration and review before editing again.',
        );
        return;
      }
      await query.cancelQueries({ queryKey: getGetRunnerQueryKey(orgId, actual.id) });
      query.setQueryData(getGetRunnerQueryKey(orgId, actual.id), actual);
      await Promise.all([
        query.invalidateQueries({ queryKey: getListRunnersQueryKey(orgId) }),
        query.invalidateQueries({ queryKey: getAllPagesQueryKey(getListRunnersQueryKey(orgId)) }),
      ]);
      navigate(generateRunnerDetailUrl(orgId, actual.id));
    } catch {
      setFailure(
        'The Runner could not be saved. Your source has been kept. Check the public configuration, write permission and connection, then retry.',
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return {
    busy,
    failure,
    attention,
    identityValid,
    disabled: !allowed || busy || Boolean(attention) || !identityValid,
    save,
  };
};
