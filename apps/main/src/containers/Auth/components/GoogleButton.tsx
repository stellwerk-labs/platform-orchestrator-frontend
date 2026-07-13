import { Skeleton, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';

import { windowEnv } from '@src/config/environment';

import { AuthButtonsProps } from './AuthButtons';
import styles from './GoogleButton.module.css';

type NewGoogleButtonProps = Pick<AuthButtonsProps, 'googleAuthSuccess' | 'type'>;

export const GoogleButton = ({ googleAuthSuccess, type }: NewGoogleButtonProps) => {
  const buttonDivRef = useRef<HTMLDivElement>(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState('');

  const callbackRef = useRef(googleAuthSuccess);

  useEffect(() => {
    callbackRef.current = googleAuthSuccess;
  }, [googleAuthSuccess]);

  useEffect(() => {
    const initializeGoogle = () => {
      if (isInitialized) {
        return;
      }

      // function to call google initialization
      const handleInitialize = () => {
        (window as any).google.accounts.id.initialize({
          client_id: windowEnv.GOOGLE_CLIENT_ID,
          callback: (response: any) => {
            callbackRef.current(response.credential);
          },
        });

        setIsInitialized(true);
      };

      // check if google is already available
      if ((window as any).google) {
        handleInitialize();
      } else {
        // wait for GIS script load
        const script = document.querySelector(
          'script[src="https://accounts.google.com/gsi/client"]',
        );

        if (!script) {
          setError('Google Sign-In script not loaded');
          return;
        }

        script.addEventListener('load', handleInitialize);

        return () => {
          script.removeEventListener('load', handleInitialize);
        };
      }
    };

    // make sure to return the cleanup function if any
    return initializeGoogle();
  }, [isInitialized]);

  // Render and re-render google button if needed
  useEffect(() => {
    const renderGoogleButton = () => {
      // wait for initialization, sanity check
      if (!isInitialized || !buttonDivRef.current) {
        return;
      }

      // clear any existing button
      buttonDivRef.current.innerHTML = '';

      // render google button
      (window as any).google.accounts.id.renderButton(buttonDivRef.current, {
        logo_alignment: 'center',
        locale: 'en',
        width: 300,
        text: type === 'register' ? 'signup_with' : 'signin_with',
      });
    };

    renderGoogleButton();
  }, [type, isInitialized]);

  return (
    <div
      ref={buttonDivRef}
      className={styles.googleButtonContainer}
      data-testid={'google-button-container'}>
      {error ? (
        <Typography.Text type={'danger'}>{error}</Typography.Text>
      ) : (
        <Skeleton.Button block size={'large'} active />
      )}
    </div>
  );
};
