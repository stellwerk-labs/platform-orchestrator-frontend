import { EditOutlined, MinusCircleOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { Flex, Tag, theme } from 'antd';

import type { ResourceChanges as Changes } from './rolloutApi';

export const ResourceChanges = ({ changes }: { changes?: Changes }) => {
  const { token } = theme.useToken();
  if (!changes) return <span>Change counts were not recorded.</span>;
  return (
    <Flex gap={4} wrap aria-label={'Resource changes'}>
      <Tag
        icon={<PlusCircleOutlined aria-hidden />}
        style={{ color: changes.add > 0 ? token.colorSuccessText : token.colorTextSecondary }}>
        {changes.add} add
      </Tag>
      <Tag
        icon={<EditOutlined aria-hidden />}
        style={{ color: changes.change > 0 ? token.colorWarningText : token.colorTextSecondary }}>
        {changes.change} change
      </Tag>
      <Tag
        icon={<MinusCircleOutlined aria-hidden />}
        style={{ color: changes.remove > 0 ? token.colorErrorText : token.colorTextSecondary }}>
        {changes.remove} destroy
      </Tag>
    </Flex>
  );
};
