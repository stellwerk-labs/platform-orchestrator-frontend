import { Edge, EdgeTypes, Node, NodeTypes, ReactFlowProvider } from '@xyflow/react';

import { FilterByOptions } from '@src/components/shared/ui/MultiFilter/MultiFilter';

import { ReactFlowInternal } from './ReactFlowInternal';

export interface FlowDiagramProps<
  NodeData extends Record<string, unknown> = Record<string, unknown>,
> {
  nodes: Node<NodeData>[];
  edges: Edge[];
  showControls?: boolean;
  nodeTypes?: NodeTypes | undefined;
  edgeTypes?: EdgeTypes | undefined;
  onNodeClick?: (node: Node<NodeData>) => void;
  onPaneClick?: () => void;
  resourceDependencyGraphLink?: string;
  filterByOptions?: FilterByOptions;
  hideOptions?: boolean;
  /** Auto-focus on a node with this resource_type after the graph loads */
  focusOnResourceType?: string;
  /** Show a "click me" callout on the focused node */
  showClickCallout?: boolean;
  /** When true, allows more zoom out to fit all nodes in a smaller viewport */
  compact?: boolean;
}
export const ReactFlow = <T extends Record<string, unknown>>(props: FlowDiagramProps<T>) => {
  return (
    <ReactFlowProvider>
      <ReactFlowInternal {...props} />
    </ReactFlowProvider>
  );
};
