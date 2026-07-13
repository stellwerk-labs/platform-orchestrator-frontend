import { Flex, theme } from 'antd';
import { ReactNode } from 'react';

interface ContainerProps {
  children?: ReactNode;
  height?: string;
}
/**
 * Just a flex column that takes full height and has the background color and border of the Card component
 *
 * @param children
 * @constructor
 */
const FullHeightContainer = ({ children, height }: ContainerProps) => {
  const { token } = theme.useToken();
  return (
    <Flex
      vertical
      style={{
        position: 'relative',
        backgroundColor: token.colorBgContainer,
        padding: `${token.paddingLG}px`,
        borderRadius: `${token.borderRadius}px`,
        border: `${token.lineWidth}px solid ${token.colorBorderSecondary}`,
        height: height || '100%',
      }}>
      {children}
    </Flex>
  );
};

export { FullHeightContainer };
