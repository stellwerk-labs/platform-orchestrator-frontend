import { isAxiosError } from 'axios';

export const authoringError = (error: unknown) => {
  if (!isAxiosError(error))
    return 'The pipeline change could not be confirmed. Reload before trying again.';
  switch (error.response?.status) {
    case 409:
      return 'This draft or policy changed, or the requested transition conflicts with its current state. Reload the latest version before trying again.';
    case 403:
      return 'You do not have permission for this pipeline action.';
    case 400:
    case 422:
      return 'The pipeline configuration is invalid. Check its stages, approval and allowed versions.';
    default:
      return 'The pipeline change could not be confirmed. Reload before trying again.';
  }
};
