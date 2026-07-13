import { theme } from 'antd';

import styles from './LoadingBar.module.css';

export const LoadingBar = () => {
  const { token } = theme.useToken();
  return (
    <svg
      style={{ position: 'absolute', top: '0', zIndex: '999' }}
      className={styles.loadingContainer}
      width={'100%'}
      height={'2'}
      xmlns={'http://www.w3.org/2000/svg'}>
      <rect
        className={styles.loadingAnimation}
        width={'100%'}
        height={'2'}
        fill={token.colorPrimary}
        data-testid={'loading-bar'}
      />
    </svg>
  );
};
