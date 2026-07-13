import { CheckCircleFilled, CloseCircleFilled, LoadingOutlined } from '@ant-design/icons';
import { Flex, theme as antDesignTheme } from 'antd';

import { getDeploymentStatus } from '@src/utilities/deployment-status';

interface DeploymentTopRowProps {
  date: string;
  hash?: string;
  status?: string;
  activeDeployment?: boolean;
  isClone?: boolean;
  deploymentEnvId?: string;
}

interface DisplayDeploymentStatusProps extends Required<
  Pick<DeploymentTopRowProps, 'status' | 'activeDeployment'>
> {
  greyIcon?: boolean;
}

export const DeploymentStatus = ({ status }: DisplayDeploymentStatusProps) => {
  const { token } = antDesignTheme.useToken(); // Access Ant Design theme colors
  return (
    <Flex gap={'small'}>
      {status === 'executing' && <LoadingOutlined />}
      {status === 'succeeded' && <CheckCircleFilled style={{ color: token.colorSuccess }} />}
      {status === 'failed' && <CloseCircleFilled style={{ color: token.colorError }} />}
      {getDeploymentStatus(status)}
    </Flex>
  );
};
