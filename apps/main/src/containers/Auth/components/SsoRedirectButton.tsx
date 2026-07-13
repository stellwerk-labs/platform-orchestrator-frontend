/* eslint-disable no-restricted-syntax -- Google SSO button colors must match third-party styling */
import { Button, ConfigProvider, Input, Space } from 'antd';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import SsoLogoUrl from '@src/assets/svg/sso.svg';

import styles from './AuthButton.module.css';

export const SsoRedirectButton = () => {
  const [searchParams] = useSearchParams();
  const prefillOrgId = searchParams.get('orgId') ?? '';
  const [showOrgIdInput, setShowOrgIdInput] = useState(prefillOrgId !== '');
  const [orgId, setOrgId] = useState(prefillOrgId);

  const handleSsoLogin = () => {
    if (orgId.trim()) {
      window.location.href = `${window.location.origin}/sso/${orgId.trim()}`;
    }
  };

  if (!showOrgIdInput) {
    return (
      <button onClick={() => setShowOrgIdInput(true)} className={styles.authButton}>
        <img src={SsoLogoUrl} alt={'SSO'} width={21} height={21} className={styles.authIcon} />
        Sign in with SSO
      </button>
    );
  }

  // Google SSO button colors to match third-party styling
  const googleSsoTheme = {
    components: {
      Input: {
        colorBgContainer: '#ffffff',
        colorBorder: '#dadce0',
        colorText: '#3c4043',
        colorTextPlaceholder: '#9ca3af',
      },
      Button: {
        colorBgContainer: '#ffffff',
        colorBorder: '#dadce0',
        colorBgContainerDisabled: '#f8f9fa',
        colorTextDisabled: '#9ca3af',
      },
    },
  };

  return (
    // this is temporary theme override to make the Input and Button match the other auth buttons as GoogleButton styling is a bit inflexible - however in the longer term we should refactor all auth buttons to use our theming correctly with antd
    <ConfigProvider theme={googleSsoTheme}>
      <Space.Compact className={styles.ssoButtonGroup}>
        <Input
          placeholder={'Enter your organization ID'}
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          onPressEnter={handleSsoLogin}
          allowClear
          onClear={() => setShowOrgIdInput(false)}
        />
        <Button
          type={'primary'}
          onClick={handleSsoLogin}
          disabled={!orgId.trim()}
          style={{ height: '100%' }}>
          Go
        </Button>
      </Space.Compact>
    </ConfigProvider>
  );
};
