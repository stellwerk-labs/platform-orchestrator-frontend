import { Alert } from 'antd';

import type { ErrorType } from '@src/custom-instance';
import type { Error as ApiError } from '@src/models/v2/controlplane';

export const PluginManagerError = ({
  error,
  what,
}: {
  error: ErrorType<ApiError>;
  what: string;
}) => {
  const status = error.response?.status;
  const body = error.response?.data;

  if (status === 403) {
    return (
      <Alert
        type={'error'}
        showIcon
        message={'The Control Plane refused the request'}
        description={`Reading ${what} needs the platform permission plugin_manager_read.`}
      />
    );
  }

  if (status === 404 && body?.error === 'plugin_host_disabled') {
    return (
      <Alert
        type={'info'}
        showIcon
        message={'The plugin host is switched off'}
        description={
          'This Control Plane does not run the Plugin Manager, so there is nothing to show.'
        }
      />
    );
  }

  if (status === 404) {
    return <Alert type={'warning'} showIcon message={`${what} was not found`} />;
  }

  return (
    <Alert
      type={'error'}
      showIcon
      message={`${what} could not be loaded`}
      description={body?.message}
    />
  );
};
