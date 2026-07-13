import { Tag } from 'antd';

import { UserVisibleMode } from '../modes';

const MODE_COLORS: Record<UserVisibleMode, string> = {
  deploy: 'processing',
  rollback: 'warning',
  destroy: 'error',
};

interface DeploymentModeProps {
  mode: UserVisibleMode;
  planOnly: boolean;
}

export const DeploymentMode = ({ mode, planOnly }: DeploymentModeProps) => (
  <span>
    <Tag color={MODE_COLORS[mode]}>{mode}</Tag>
    {planOnly && <Tag color={'default'}>plan only</Tag>}
  </span>
);
