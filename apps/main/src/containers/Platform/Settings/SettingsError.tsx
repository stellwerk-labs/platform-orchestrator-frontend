import { Alert, Button } from 'antd';

import { settingsErrorMessage } from './settingsApi';

export const SettingsError = ({ error, retry }: { error: unknown; retry: () => void }) => (
  <Alert
    type={'error'}
    message={settingsErrorMessage(error)}
    action={<Button onClick={retry}>Reload settings</Button>}
  />
);
