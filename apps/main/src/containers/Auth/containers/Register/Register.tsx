import { useQueryClient } from '@tanstack/react-query';
import { Flex, Splitter, Typography } from 'antd';
import useBreakpoint from 'antd/es/grid/hooks/useBreakpoint';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { useRegisterUser } from '@src/hooks/react-query/v2/iam/internal/internal';
import { getGetCurrentUserQueryKey } from '@src/hooks/react-query/v2/iam/user/user';
import { checkUserAgentIsMobile } from '@src/utilities/check-mobile';
import { getLastVisitedURL } from '@src/utilities/local-storage';
import { trackError } from '@src/utilities/monitoring';

import { RegisterForm } from '../../components/RegisterForm';
import { TrialSection } from './components/TrialSection';
import styles from './Register.module.css';

export const Register = () => {
  const navigate = useNavigate();

  const { mutate: verifyProviderSignUp, isSuccess: isSignUpSuccess } = useRegisterUser();
  const queryClient = useQueryClient();

  const [isMobile, setIsMobile] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    setIsMobile(checkUserAgentIsMobile());
  }, []);

  const handleAuthSuccess = useCallback(
    (provider: 'google' | 'microsoft', token: string): void => {
      // Block registration on mobile devices
      if (isMobile) {
        setErrorMessage('Sorry, there was a problem during registration.');
        trackError(new Error('Mobile device detected - blocking Registration.'));
        return;
      }

      setErrorMessage(undefined);

      verifyProviderSignUp(
        {
          data: {
            provider,
            provider_token: token,
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
          },
        },
      );
    },
    [verifyProviderSignUp, isMobile, queryClient],
  );

  useEffect(() => {
    const lastURL = getLastVisitedURL();

    if (isSignUpSuccess) {
      if (lastURL) {
        navigate(lastURL);
      } else {
        navigate('/');
      }
    }
  }, [isSignUpSuccess, navigate]);

  const screens = useBreakpoint();
  const isSmallScreen = !screens.lg;

  return (
    <Splitter layout={isSmallScreen ? 'vertical' : 'horizontal'}>
      <Splitter.Panel resizable={false} style={{ display: 'flex', alignItems: 'center' }}>
        <div className={styles.signUpWrapper}>
          <Flex vertical flex={1}>
            <div className={styles.logoSignupWrapper}>
              <TrialSection />
            </div>
          </Flex>
        </div>
      </Splitter.Panel>
      <Splitter.Panel resizable={false} style={{ display: 'flex', alignItems: 'center' }}>
        <div className={styles.signUpWrapper}>
          <Flex vertical flex={1} align={'center'}>
            <div className={styles.logoSignupWrapper}>
              <Flex vertical align={'center'} gap={'middle'}>
                <Typography.Title level={1} style={{ marginBottom: 0 }}>
                  Sign up for free
                </Typography.Title>
                <RegisterForm
                  googleAuthSuccess={(token) => handleAuthSuccess('google', token)}
                  microsoftAuthSuccess={(token) => handleAuthSuccess('microsoft', token)}
                  errorMessage={errorMessage}
                />
              </Flex>
            </div>
          </Flex>
        </div>
      </Splitter.Panel>
    </Splitter>
  );
};
