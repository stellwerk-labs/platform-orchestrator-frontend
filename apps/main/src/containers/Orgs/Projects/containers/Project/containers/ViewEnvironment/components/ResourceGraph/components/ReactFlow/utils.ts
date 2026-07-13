import { Edge, getIncomers, getOutgoers, Node, Position } from '@xyflow/react';
import dagre from 'dagre';

/**
 * Get automatic layouted elements using the dagre layout algorithm.
 *
 * @param {Node[]} nodes - An array of nodes.
 * @param {Edge[]} edges - An array of edges.
 * @param {string} [direction] - The direction of the layout: 'TB', 'BT', 'RL' or 'LR'. Defaults to 'LR'.
 * @param {string} edgeStyle
 * @returns object - An object containing the layouted nodes and edges.
 */
export const getLayoutedElements = <T extends Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  direction: string = 'LR',
  edgeStyle?: 'bezier' | 'smooth-step',
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  const defaultNodeWidth = 300;
  const defaultNodeHeight = 100;

  dagreGraph.setGraph({
    rankdir: direction,
    align: 'UR',
    nodesep: 30,
    ranksep: 150,
    ranker: 'longest-path',
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: node.measured?.width || defaultNodeWidth,
      height: node.measured?.height || defaultNodeHeight,
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
    edge.type = 'colored';
    // Preserve existing data (e.g. isDeleted, isCreated) set before layout
    edge.data = { ...edge.data, edgeStyle };
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = Position.Left;
    node.sourcePosition = Position.Right;

    node.position = {
      x: nodeWithPosition.x,
      y: nodeWithPosition.y,
    };

    return node;
  });

  return { nodes, edges };
};

const getAllIncomers = (
  node: Node,
  nodes: Node[],
  edges: Edge[],
  prevIncomers: Node[] = [],
): Node[] => {
  const incomers = getIncomers(node, nodes, edges);
  return incomers.reduce<Node[]>((memo, incomer) => {
    memo.push(incomer);

    if (prevIncomers.findIndex((n) => n.id === incomer.id) === -1) {
      prevIncomers.push(incomer);

      getAllIncomers(incomer, nodes, edges, prevIncomers).forEach((foundNode) => {
        memo.push(foundNode);

        if (prevIncomers.findIndex((n) => n.id === foundNode.id) === -1) {
          prevIncomers.push(foundNode);
        }
      });
    }
    return memo;
  }, []);
};
const getAllOutgoers = (
  node: Node,
  nodes: Node[],
  edges: Edge[],
  prevOutgoers: Node[] = [],
): Node[] => {
  const outgoers = getOutgoers(node, nodes, edges);
  return outgoers.reduce<Node[]>((memo, outgoer) => {
    memo.push(outgoer);

    if (prevOutgoers.findIndex((n) => n.id === outgoer.id) === -1) {
      prevOutgoers.push(outgoer);

      getAllOutgoers(outgoer, nodes, edges, prevOutgoers).forEach((foundNode) => {
        memo.push(foundNode);

        if (prevOutgoers.findIndex((n) => n.id === foundNode.id) === -1) {
          prevOutgoers.push(foundNode);
        }
      });
    }
    return memo;
  }, []);
};
/**
 * it checks if an edge is related of a given node
 */
export const isEdgeRelatedToNode = (edge: Edge, node: Node, nodes: Node[], edges: Edge[]) => {
  const outgoerIds = getOutgoers(node, nodes, edges).map((o) => o.id);
  const incomerIds = getIncomers(node, nodes, edges).map((i) => i.id);
  return (
    (outgoerIds.includes(edge.target) && edge.source.includes(node.id)) ||
    (incomerIds.includes(edge.source) && edge.target.includes(node.id))
  );
};

/**
 * get related Nodes to a specific node
 */
export const getRelatedNodes = <T extends Record<string, unknown>>(
  node: Node,
  nodes: Node<T>[],
  edges: Edge[],
  includeIncomers = true,
  includeOutgoers = true,
) => {
  const outgoerIds = includeOutgoers ? getAllOutgoers(node, nodes, edges).map((o) => o.id) : [];
  const incomerIds = includeIncomers ? getAllIncomers(node, nodes, edges).map((i) => i.id) : [];
  return nodes?.filter(
    (n) => n.id === node.id || incomerIds.includes(n.id) || outgoerIds.includes(n.id),
  );
};
/**
 * returns an array of edges related to a specific node
 *
 * @param node
 * @param nodes
 * @param edges
 */
export const getRelatedEdges = (node: Node, nodes: Node[], edges: Edge[]) => {
  // Get all related nodes (the node itself, all incomers, and all outgoers)
  const relatedNodeIds = new Set<string>([
    node.id,
    ...getAllIncomers(node, nodes, edges).map((n) => n.id),
    ...getAllOutgoers(node, nodes, edges).map((n) => n.id),
  ]);

  // Return all edges where source or target is in relatedNodeIds
  return edges.filter((edge) => relatedNodeIds.has(edge.source) || relatedNodeIds.has(edge.target));
};
