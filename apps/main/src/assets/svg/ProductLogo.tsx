import { windowEnv } from '@src/config/environment';
import { Theme } from '@src/hooks/zustand/useUserPreferencesStore';

interface SvgProps {
  className?: string;
  theme: Theme | null;
}

export const ProductLogo = ({ className, theme }: SvgProps) => (
  <svg
    className={`invert ${className}`}
    width={'210px'}
    height={'24px'}
    viewBox={'0 0 210 24'}
    fill={'none'}
    data-testid={'product-logo'}
    xmlns={'http://www.w3.org/2000/svg'}>
    <text
      x={'0'}
      y={'18'}
      fontFamily={'sans-serif'}
      fontSize={'15'}
      fontWeight={'600'}
      fill={theme === 'dark' ? '#FAFAFA' : 'rgba(33, 86, 246, 1)'}>
      {windowEnv.PRODUCT_NAME}
    </text>
  </svg>
);
