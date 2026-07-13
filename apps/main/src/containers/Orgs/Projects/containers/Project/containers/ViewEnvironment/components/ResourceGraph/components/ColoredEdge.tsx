import { EdgeProps, getBezierPath, getSmoothStepPath, useReactFlow } from '@xyflow/react';
import { theme } from 'antd';

import { ResourceTypes } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewEnvironment/components/ResourceGraph/components/resource-types';
import { getResourceNodeColor } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewEnvironment/components/ResourceGraph/components/ResourceNode';

type EdgeStateFlags = {
  isDeleted?: boolean;
  isCreated?: boolean;
  highlight?: boolean;
};

export const ColoredEdge = ({
  id,
  source,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
}: EdgeProps) => {
  const { getNode } = useReactFlow();

  const { token } = theme.useToken();

  const getEdgeColor = (flags: EdgeStateFlags, resourceType?: ResourceTypes): string => {
    if (flags.highlight) return token.colorPrimary;
    if (flags.isDeleted) return token.colorError;
    if (flags.isCreated) return token.colorSuccess;
    if (resourceType) return getResourceNodeColor(resourceType);
    return token.colorTextSecondary;
  };

  const sourceNode = getNode(source);

  const path =
    data?.edgeStyle === 'smooth-step'
      ? getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
        })[0]
      : getBezierPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
        })[0];

  const isDeleted = data?.isDeleted as boolean | undefined;
  const isCreated = data?.isCreated as boolean | undefined;

  const color = getEdgeColor(
    { isDeleted, isCreated, highlight: data?.highlight as boolean | undefined },
    sourceNode?.data.resource_type as ResourceTypes | undefined,
  );

  const markerId = `arrow-${id}`;

  return (
    <>
      <defs>
        <marker
          id={markerId}
          viewBox={'0 0 10 10'}
          refX={8}
          refY={5}
          markerWidth={5}
          markerHeight={5}
          orient={'auto'}>
          <path d={'M 0 0 L 10 5 L 0 10 z'} fill={color} />
        </marker>
      </defs>
      <path
        id={id}
        d={path}
        markerEnd={`url(#${markerId})`}
        style={{
          ...style,
          strokeWidth: 2,
          stroke: color,
          strokeDasharray: isDeleted || isCreated ? '6 3' : undefined,
          opacity: isDeleted ? 0.4 : 0.8,
          fill: 'none',
        }}
      />
    </>
  );
};
