import { Divider, Modal, Space, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import SsoLogoUrl from '@src/assets/svg/sso.svg';
import { DOCS_SSO } from '@src/config/docs-links';
import { windowEnv } from '@src/config/environment';
import { useGetUrlParam } from '@src/utilities/url-params';

import styles from './AuthButton.module.css';
import { AuthButtons } from './AuthButtons';

const SsoInfoModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  return (
    <Modal title={'Single Sign-On'} open={open} onCancel={onClose} footer={null}>
      <Space direction={'vertical'} size={'middle'}>
        <Typography.Text>
          Platform Orchestrator supports single sign-on (SSO) for organizations.
        </Typography.Text>
        <Typography.Text>
          To set up SSO for your organization, please{' '}
          {windowEnv.SUPPORT_EMAIL ? (
            <>
              reach out to{' '}
              <Typography.Link href={`mailto:${windowEnv.SUPPORT_EMAIL}`}>
                {windowEnv.SUPPORT_EMAIL}
              </Typography.Link>
            </>
          ) : (
            <>reach out to support</>
          )}
          .
        </Typography.Text>
        <Typography.Text>
          For more information, see our{' '}
          <Typography.Link href={DOCS_SSO} target={'_blank'}>
            SSO documentation
          </Typography.Link>
          .
        </Typography.Text>
      </Space>
    </Modal>
  );
};

interface SignUpFormProps {
  googleAuthSuccess: (token: string) => void;
  microsoftAuthSuccess: (token: string) => void;
  errorMessage?: string;
}

const Terms = ({ termsUrl, privacyUrl }: { termsUrl?: string; privacyUrl?: string }) => {
  const { t } = useTranslation();
  const authTranslations = t('AUTHENTICATE');

  if (!termsUrl || !privacyUrl) return null;

  return (
    <Typography.Text className={'txt-sm'}>
      By signing up you agree to our{' '}
      <Typography.Link className={'txt-sm'} href={termsUrl} target={'_blank'}>
        {authTranslations.TERMS_OF_USE}
      </Typography.Link>
      {privacyUrl && (
        <>
          <Typography.Text className={'txt-sm'}>{' & '}</Typography.Text>
          <Typography.Link className={'txt-sm'} href={privacyUrl} target={'_blank'}>
            {authTranslations.PRIVACY_POLICY}
          </Typography.Link>
        </>
      )}
    </Typography.Text>
  );
};

export const RegisterForm = ({
  googleAuthSuccess,
  microsoftAuthSuccess,
  errorMessage,
}: SignUpFormProps) => {
  const [ssoModalOpen, setSsoModalOpen] = useState(false);

  // i18n
  const { t } = useTranslation();
  const authTranslations = t('AUTHENTICATE');
  const inviteToken = useGetUrlParam('inviteToken');

  return (
    <Space direction={'vertical'} align={'center'} size={'large'}>
      <span style={{ textAlign: 'center' }}>
        <Typography.Text className={'txt-sm'}>
          {authTranslations.ALREADY_HAVE_AN_ACCOUNT}
        </Typography.Text>{' '}
        <Link
          className={'txt-sm'}
          to={`/auth/login${inviteToken ? `?inviteToken=${inviteToken}` : ''}`}>
          {authTranslations.LOG_IN}
        </Link>
      </span>
      <AuthButtons
        type={'register'}
        googleAuthSuccess={googleAuthSuccess}
        microsoftAuthSuccess={microsoftAuthSuccess}
        errorMessage={errorMessage}
        ssoButton={
          <button onClick={() => setSsoModalOpen(true)} className={styles.authButton}>
            <img src={SsoLogoUrl} alt={'SSO'} width={21} height={21} className={styles.authIcon} />
            Single Sign-On
          </button>
        }
      />
      <SsoInfoModal open={ssoModalOpen} onClose={() => setSsoModalOpen(false)} />
      <Divider style={{ margin: 0 }} />
      <Terms termsUrl={windowEnv.TERMS_URL} privacyUrl={windowEnv.PRIVACY_URL} />
    </Space>
  );
};
