import { InteractionStatus } from '@azure/msal-browser';
import { useMsal } from '@azure/msal-react';
import { useState } from 'react';

import MicrosoftLogoUrl from '@src/assets/svg/microsoft.svg';
import { trackError } from '@src/utilities/monitoring';

import styles from './AuthButton.module.css';
import { AuthButtonsProps } from './AuthButtons';

type MicrosoftButtonProps = Pick<AuthButtonsProps, 'microsoftAuthSuccess' | 'type'>;

export const MicrosoftButton = ({ microsoftAuthSuccess, type }: MicrosoftButtonProps) => {
  const { instance: msalInstance, inProgress: msalStatus } = useMsal();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (msalStatus !== InteractionStatus.None) {
      return;
    }

    setIsLoading(true);

    const loginRequest = {
      // Claims and scopes:
      // https://docs.azure.cn/en-us/entra/identity-platform/id-token-claims-reference#payload-claims
      // https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc#the-email-scope
      // 'profile': name, preferred_username
      // 'email': email
      // 'openid': must use for OIDC
      scopes: ['openid', 'profile', 'email'],
      prompt: 'select_account',
    };

    msalInstance
      .loginPopup(loginRequest)
      .then((response) => {
        if (!response.idToken) {
          throw new Error('No ID token received from Microsoft');
        }
        microsoftAuthSuccess(response.idToken);
      })
      .catch((error) => {
        // Clear session info in case of error
        msalInstance.clearCache();

        trackError(error, { context: 'Microsoft login failed' });
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const loadingText = type === 'register' ? 'Signing up...' : 'Signing in...';
  const buttonText = type === 'register' ? 'Sign up with Microsoft' : 'Sign in with Microsoft';

  return (
    <button
      onClick={handleLogin}
      disabled={isLoading || msalStatus !== InteractionStatus.None}
      className={styles.authButton}
      aria-label={buttonText}
      aria-busy={isLoading}>
      <img
        src={MicrosoftLogoUrl}
        alt={'Microsoft'}
        width={21}
        height={21}
        className={styles.authIcon}
      />
      {isLoading ? loadingText : buttonText}
    </button>
  );
};
