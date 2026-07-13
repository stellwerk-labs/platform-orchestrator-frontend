import { Handle, Position } from '@xyflow/react';
import { Flex, theme, Typography } from 'antd';
import React from 'react';

import { ResourceIcon } from '@src/components/shared/ResourceIcon';
import { ActiveResourceNode } from '@src/models/v2/dataplane';

import styles from './ResourceNode.module.css';

interface ResourceNodeProps {
  data: ActiveResourceNode & {
    selected: boolean;
    incomers: string[];
    showClickCallout?: boolean;
    hasError?: boolean;
    isDeleted?: boolean;
    isCreated?: boolean;
  };
}

const graphCategoricalPalette = {
  purple: '#722ED1',
  cyan: '#2e9999',
  lime: '#A0D911',
  magenta: '#EB2F96',
  red: '#F5222D',
};

export const getResourceNodeColor = (type: string) => {
  const dataSourceResourceTypes = ['mariadb', 'mysql', 's3'];
  const routingResourceTypes = ['ingress', 'dns'];

  if (dataSourceResourceTypes.includes(type)) {
    return graphCategoricalPalette.lime;
  } else if (routingResourceTypes.includes(type)) {
    return graphCategoricalPalette.red;
  } else if (type === 'k8s-cluster') {
    return graphCategoricalPalette.cyan;
  } else if (type === 'workload' || type === 'environment') {
    return graphCategoricalPalette.magenta;
  } else {
    return graphCategoricalPalette.purple;
  }
};
type NodeStateFlags = Pick<
  ResourceNodeProps['data'],
  'hasError' | 'isDeleted' | 'isCreated' | 'selected'
>;

const getNodeBoxShadow = (
  { hasError }: NodeStateFlags,
  token: ReturnType<typeof theme.useToken>['token'],
): string | undefined => {
  if (hasError) return `0 0 8px ${token.colorError}`;
  return undefined;
};

const getNodeBorder = (
  { hasError, isDeleted, isCreated }: NodeStateFlags,
  token: ReturnType<typeof theme.useToken>['token'],
): string | undefined => {
  if (hasError) return `2px solid ${token.colorError}`;
  if (isDeleted) return `2px dashed ${token.colorError}`;
  if (isCreated) return `2px dashed ${token.colorSuccess}`;
  return undefined;
};

const getNodeStyle = (
  flags: NodeStateFlags,
  token: ReturnType<typeof theme.useToken>['token'],
): React.CSSProperties => ({
  backgroundColor: flags.selected ? token.controlItemBgActive : token.colorBgElevated,
  position: 'relative',
  border: getNodeBorder(flags, token),
  boxShadow: getNodeBoxShadow(flags, token),
  opacity: flags.isDeleted ? 0.4 : undefined,
});

export const ResourceNode = ({ data }: ResourceNodeProps) => {
  const { token } = theme.useToken();
  const initialMarginTop =
    data.incomers && data.incomers.length > 1 ? data.incomers?.length * -2 : 1;
  const MAXIMUM_HANDLES_PER_NODE = 10;

  return (
    <div
      className={styles.resourceNode}
      style={getNodeStyle(data, token)}
      id={data.id}
      data-testid={`${data.resource_id}-resource-node`}>
      {data.showClickCallout && (
        <div className={styles.clickCallout} aria-label={'Click to inspect this resource'}>
          <span className={styles.clickCalloutText}>Click to inspect</span>
        </div>
      )}
      {data.incomers?.map((dep, index) => (
        <Handle
          type={'target'}
          position={Position.Left}
          id={dep}
          key={dep}
          style={{ marginTop: index < MAXIMUM_HANDLES_PER_NODE ? initialMarginTop + 5 * index : 0 }}
        />
      ))}
      <Handle className={'mb-md'} type={'target'} position={Position.Left} />

      <Flex align={'center'} gap={'small'}>
        <Flex
          data-testid={'icon-wrapper'}
          style={{
            backgroundColor: getResourceNodeColor(data.resource_type),
            borderRadius: token.borderRadius,
            padding: token.paddingXS,
          }}>
          <ResourceIcon type={data.resource_type} size={30} color={token.colorBgBase} />
        </Flex>
        <Flex vertical>
          <Typography.Text type={'secondary'} data-testid={'active-resource-card-type'}>
            {data.resource_type}
          </Typography.Text>
          <Typography.Text data-testid={'active-resource-card-title'}>
            {data.resource_id}
          </Typography.Text>
        </Flex>
      </Flex>
      <Handle className={'mb-md'} type={'source'} position={Position.Right} />
    </div>
  );
};
