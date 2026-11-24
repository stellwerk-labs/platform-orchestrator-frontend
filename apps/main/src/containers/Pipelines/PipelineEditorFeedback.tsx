import { Alert } from 'antd';

import { authoringError } from './pipelineErrors';

export const PipelineEditorFeedback = ({
  canEdit,
  canPublish,
  validation,
  error,
  publishedVersion,
}: {
  canEdit: boolean;
  canPublish: boolean;
  validation?: string;
  error: unknown;
  publishedVersion?: number;
}) => (
  <>
    {!canEdit && <Alert type={'info'} showIcon message={'Read-only pipeline'} />}
    {canEdit && !canPublish && (
      <Alert
        type={'info'}
        showIcon
        message={'You can edit drafts. Publishing requires pipeline publication permission.'}
      />
    )}
    {(validation || error) && (
      <Alert type={'error'} showIcon message={validation || authoringError(error)} />
    )}
    {publishedVersion !== undefined && (
      <Alert
        type={'success'}
        showIcon
        message={`Published version ${publishedVersion}`}
        description={
          'This version is available when project policy is off. If policy is on, add it to the allowed versions before developers can select it.'
        }
      />
    )}
  </>
);
