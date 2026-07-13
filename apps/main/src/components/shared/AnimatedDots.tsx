import { theme } from 'antd';
import { useEffect, useState } from 'react';

export const AnimatedDots = ({ time = 500 }: { time?: number }) => {
  const { token } = theme.useToken();
  const [dots, setDots] = useState('.');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, time);

    return () => clearInterval(interval);
  }, [time]);

  return (
    <span style={{ display: 'inline-block', width: token.paddingLG, textAlign: 'left' }}>
      {dots}
    </span>
  );
};
