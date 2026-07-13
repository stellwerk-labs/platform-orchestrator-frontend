import { CopyOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Button, Drawer, Flex, message, Radio, theme, Typography } from 'antd';
import { useState } from 'react';

import { DataEntry } from '@src/components/shared/ui/DataEntry/DataEntry';
import { parseDeploymentError } from '@src/utilities/deployment/parseDeploymentError';

interface DeploymentErrorDisplayProps {
  statusMessage: string;
}

type ViewMode = 'pretty' | 'raw';

/** Fields to display in the error details drawer, in order. */
const errorDetailFields = [
  { key: 'summary', label: 'Summary' },
  { key: 'detail', label: 'Detail' },
  { key: 'action', label: 'Action' },
  { key: 'entity_type', label: 'Entity Type' },
  { key: 'module_id', label: 'Module ID' },
  { key: 'module_version', label: 'Module Version' },
  { key: 'provider_type', label: 'Provider Type' },
  { key: 'provider_id', label: 'Provider ID' },
  { key: 'workload', label: 'Workload' },
] as const;

export const DeploymentErrorDisplay = ({ statusMessage }: DeploymentErrorDisplayProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('pretty');
  const [messageApi, contextHolder] = message.useMessage();
  const { token } = theme.useToken();

  const parsedError = parseDeploymentError(statusMessage);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(parsedError.rawMessage);
      messageApi.success('Error copied to clipboard');
    } catch (_err) {
      messageApi.error('Failed to copy to clipboard');
    }
  };

  const preStyle: React.CSSProperties = {
    backgroundColor: token.colorBgLayout,
    color: token.colorText,
    padding: token.padding,
    borderRadius: token.borderRadius,
    overflow: 'auto',
    maxHeight: '60vh',
    fontFamily: 'monospace',
    fontSize: token.fontSizeSM,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };

  const errorContent =
    viewMode === 'raw' || !parsedError.isJson
      ? parsedError.rawMessage
      : JSON.stringify(parsedError.parsedJson, null, 2);

  return (
    <>
      {contextHolder}
      <Flex vertical gap={'small'} style={{ width: '100%' }}>
        <DataEntry
          label={'Error'}
          value={
            <Flex align={'flex-start'} gap={'small'}>
              <ExclamationCircleOutlined style={{ color: token.colorError, marginTop: '4px' }} />
              <Typography.Text type={'danger'} style={{ whiteSpace: 'pre-line' }}>
                {parsedError.friendlyMessage}
              </Typography.Text>
            </Flex>
          }
        />
        {parsedError.isJson && (
          <Button
            type={'link'}
            onClick={() => setDrawerOpen(true)}
            style={{ alignSelf: 'flex-start' }}>
            Show full error
          </Button>
        )}
      </Flex>

      <Drawer
        title={'Deployment Error Details'}
        placement={'right'}
        width={600}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}>
        <Flex vertical gap={'middle'}>
          {/* Metadata section */}
          {parsedError.parsedJson && (
            <Flex vertical gap={'small'}>
              {errorDetailFields.map(
                ({ key, label }) =>
                  parsedError.parsedJson?.[key] && (
                    <DataEntry key={key} label={label} value={parsedError.parsedJson[key]} />
                  ),
              )}
            </Flex>
          )}

          {/* View mode toggle */}
          <Flex justify={'space-between'} align={'center'}>
            <Radio.Group
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              disabled={!parsedError.isJson}>
              <Radio.Button value={'pretty'}>Pretty JSON</Radio.Button>
              <Radio.Button value={'raw'}>Raw</Radio.Button>
            </Radio.Group>
            <Button icon={<CopyOutlined />} onClick={handleCopy}>
              Copy
            </Button>
          </Flex>

          {/* Error content */}
          <pre style={preStyle}>{errorContent}</pre>
        </Flex>
      </Drawer>
    </>
  );
};
