import { useMutation } from '@tanstack/react-query';
import { useRef } from 'react';

import { publishProjectPipeline } from '@src/api/pipelines';
import type { PipelineDraft } from '@src/models/pipelines';

export const usePipelinePublish = ({
  orgId,
  projectId,
  base,
  dirty,
  canPublish,
  onPublished,
}: {
  orgId: string;
  projectId: string;
  base?: PipelineDraft;
  dirty: boolean;
  canPublish: boolean;
  onPublished: () => void;
}) => {
  const publishKeys = useRef(new Map<number, string>());
  return useMutation({
    mutationFn: (resourceVersion: number) => {
      if (!canPublish || !base || dirty || resourceVersion !== base.resource_version)
        throw new Error('Save the current draft before publishing.');
      let key = publishKeys.current.get(resourceVersion);
      if (!key) {
        key = crypto.randomUUID();
        publishKeys.current.set(resourceVersion, key);
      }
      return publishProjectPipeline(orgId, projectId, base.id, {
        expected_resource_version: resourceVersion,
        request_key: key,
      });
    },
    onSuccess: onPublished,
  });
};
