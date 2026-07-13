import { Card, Spin, Typography } from 'antd';
import yaml from 'js-yaml';
import { useParams } from 'react-router';

import { SyntaxHighlighting } from '@src/components/shared/SyntaxHighlighting';
import { MatchParams } from '@src/config/routing';
import { useGetDeployment } from '@src/hooks/react-query/v2/dataplane/deployment/deployment';

export const Manifest = () => {
  const { orgId, deployId } = useParams<keyof MatchParams>() as MatchParams & {
    deployId: string;
  };

  const { data: deployment, isLoading } = useGetDeployment(orgId, deployId);

  if (isLoading) {
    return <Spin />;
  }

  if (!deployment?.manifest) {
    return (
      <Card>
        <Typography.Text type={'secondary'}>
          No manifest available for this deployment
        </Typography.Text>
      </Card>
    );
  }

  return <SyntaxHighlighting language={'yaml'} text={yaml.dump(deployment.manifest)} />;
};
