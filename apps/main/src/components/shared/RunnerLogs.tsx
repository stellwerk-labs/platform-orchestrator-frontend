import { Button, Space, theme as antDesignTheme } from 'antd';
import { useMemo, useState } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';

import { useUserPreferencesStore } from '@src/hooks/zustand/useUserPreferencesStore';

import { parseRunnerLogs, type RunnerLogRecord } from './runnerLogFormat';

const logTextStyle = {
  whiteSpace: 'pre-wrap' as const,
  overflowWrap: 'anywhere' as const,
  margin: 0,
};

const RunnerLogRow = ({ record }: { record: RunnerLogRecord }) => {
  const { token } = antDesignTheme.useToken();
  const theme = useUserPreferencesStore((state) => state.theme);
  const levelColors: Record<string, string> = {
    error: token.colorErrorText,
    fatal: token.colorErrorText,
    warn: token.colorWarningText,
  };
  const levelColor = levelColors[record.level?.toLowerCase() ?? ''] ?? token.colorTextSecondary;

  return (
    <div>
      {record.metadata && (
        <pre
          style={{
            ...logTextStyle,
            color: levelColor,
          }}>
          {record.metadata}
        </pre>
      )}
      {(!record.json || record.text) && <pre style={logTextStyle}>{record.text || '\n'}</pre>}
      {record.json && (
        <SyntaxHighlighter
          language={'json'}
          style={theme === 'dark' ? atomOneDark : atomOneLight}
          wrapLongLines
          customStyle={{ margin: 0, padding: token.paddingXS, background: token.colorBgContainer }}>
          {record.json}
        </SyntaxHighlighter>
      )}
    </div>
  );
};

export const RunnerLogs = ({ content }: { content: string }) => {
  const [raw, setRaw] = useState(false);
  const records = useMemo(() => parseRunnerLogs(content), [content]);

  return (
    <Space direction={'vertical'} style={{ width: '100%' }}>
      <Button onClick={() => setRaw(!raw)} aria-pressed={raw}>
        {raw ? 'Show formatted logs' : 'Show raw logs'}
      </Button>
      {!records && (
        <div role={'note'}>Large log: formatting is disabled. Raw content is shown in full.</div>
      )}
      <div aria-label={'Runner logs'} style={{ maxHeight: '65vh', overflow: 'auto' }}>
        {raw || !records ? (
          <pre style={logTextStyle}>{content}</pre>
        ) : (
          records.map((record, index) => (
            // Stored log lines never reorder, and repeated lines need distinct keys.
            // eslint-disable-next-line react/no-array-index-key
            <RunnerLogRow key={index} record={record} />
          ))
        )}
      </div>
    </Space>
  );
};
