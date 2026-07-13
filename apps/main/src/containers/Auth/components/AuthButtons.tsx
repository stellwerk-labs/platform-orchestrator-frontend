import { Space, Typography } from 'antd';
import { ReactNode } from 'react';

import { features } from '@src/config/features';

import { GoogleButton } from './GoogleButton';
import { MicrosoftButton } from './MicrosoftButton';

export interface AuthButtonsProps {
  type: 'login' | 'register';
  googleAuthSuccess: (token: string) => void;
  microsoftAuthSuccess: (token: string) => void;
  errorMessage?: string;
  ssoButton?: ReactNode;
}

export const AuthButtons = ({
  type = 'login',
  errorMessage,
  googleAuthSuccess,
  microsoftAuthSuccess,
  ssoButton,
}: AuthButtonsProps) => {
  return (
    <Space direction={'vertical'}>
      {features.socialLogins && <GoogleButton googleAuthSuccess={googleAuthSuccess} type={type} />}

      {features.socialLogins && (
        <MicrosoftButton microsoftAuthSuccess={microsoftAuthSuccess} type={type} />
      )}

      {ssoButton}

      {errorMessage && <Typography.Text type={'danger'}>{errorMessage}</Typography.Text>}
    </Space>
  );
};
