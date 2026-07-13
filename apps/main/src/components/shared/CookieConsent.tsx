import { Button, Space, theme, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { windowEnv } from '@src/config/environment';
import { getCookieConsent, setCookieConsent } from '@src/utilities/local-storage';

const { Text, Link } = Typography;

export const CookieConsent = () => {
  const [visible, setVisible] = useState(false);
  const { token } = theme.useToken();

  useEffect(() => {
    if (!getCookieConsent()) {
      setVisible(true);
    }
  }, []);

  const handleAccept = (): void => {
    setCookieConsent('accepted');
    setVisible(false);
  };

  const handleDecline = (): void => {
    setCookieConsent('declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: token.marginLG,
        left: '50%',
        transform: 'translateX(-50%)',
        background: token.colorBgElevated,
        boxShadow: token.boxShadowSecondary,
        borderRadius: token.borderRadiusLG,
        padding: `${token.paddingSM}px ${token.paddingLG}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: token.marginSM,
        maxWidth: 700,
        width: '90%',
        zIndex: token.zIndexPopupBase,
      }}>
      <Text style={{ flex: 1 }}>
        🍪 We use cookies to improve your experience. See our{' '}
        <Link href={windowEnv.PRIVACY_URL} target={'_blank'}>
          Privacy Policy
        </Link>
        .
      </Text>
      <Space>
        <Button size={'small'} onClick={handleDecline}>
          Decline
        </Button>
        <Button size={'small'} type={'primary'} onClick={handleAccept}>
          Accept
        </Button>
      </Space>
    </div>
  );
};
