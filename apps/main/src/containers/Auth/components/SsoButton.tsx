import { LoginOutlined } from '@ant-design/icons';

import styles from './AuthButton.module.css';

interface SsoButtonProps {
  onSsoClick: () => void;
  label?: string;
}

export const SsoButton = ({ onSsoClick, label = 'Sign in with SSO' }: SsoButtonProps) => {
  return (
    <button onClick={onSsoClick} className={styles.authButton} aria-label={'Sign in with SSO'}>
      <LoginOutlined className={styles.authIcon} />
      {label}
    </button>
  );
};
