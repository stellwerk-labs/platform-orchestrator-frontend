import { theme as antDesignTheme } from 'antd';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';

import { useUserPreferencesStore } from '@src/hooks/zustand/useUserPreferencesStore';

interface SyntaxHighlightingProps {
  /**
   * code to be highlighted
   */
  text: string;
  /**
   * The language syntax being used eg. yaml, javascript
   */
  language: string;
}
export const SyntaxHighlighting = ({ language, text }: SyntaxHighlightingProps) => {
  const { token } = antDesignTheme.useToken();
  const { theme } = useUserPreferencesStore();

  return (
    <SyntaxHighlighter
      customStyle={{
        borderRadius: token.borderRadius,
        backgroundColor: token.colorBgContainer,
        padding: token.paddingLG,
      }}
      style={theme === 'dark' ? atomOneDark : atomOneLight}
      language={language}
      minHeight={'600px'}>
      {text}
    </SyntaxHighlighter>
  );
};
