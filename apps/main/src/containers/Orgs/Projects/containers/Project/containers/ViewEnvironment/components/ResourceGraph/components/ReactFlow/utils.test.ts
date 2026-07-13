import { Edge, Node, Position } from '@xyflow/react';
import dagre from 'dagre';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getLayoutedElements } from './utils';

describe('getLayoutedElements', () => {
  const nodes: Node[] = [
    { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
    { id: 'node-2', position: { x: 0, y: 0 }, data: {} },
    { id: 'node-3', position: { x: 0, y: 0 }, data: {} },
  ];
  const edges: Edge[] = [
    { id: '', source: 'node-1', target: 'node-2' },
    { id: '', source: 'node-2', target: 'node-3' },
  ];

  beforeEach(() => {
    // Clear any previous mock implementation
    vi.clearAllMocks();
  });

  it('should return layouted elements with correct positions and connections', () => {
    const expectedNodes: Node[] = [
      {
        id: 'node-1',
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
        position: {
          x: 150,
          y: 50,
        },
        data: {},
      },
      {
        id: 'node-2',
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
        position: {
          x: 600,
          y: 50,
        },
        data: {},
      },
      {
        id: 'node-3',
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
        position: {
          x: 1050,
          y: 50,
        },
        data: {},
      },
    ];
    const expectedEdges: Edge[] = [
      {
        id: '',
        source: 'node-1',
        target: 'node-2',
        type: 'colored',
        data: {
          edgeStyle: undefined,
        },
      },
      {
        id: '',
        source: 'node-2',
        target: 'node-3',
        type: 'colored',
        data: {
          edgeStyle: undefined,
        },
      },
    ];

    const result = getLayoutedElements(nodes, edges);

    expect(result.nodes).toEqual(expectedNodes);
    expect(result.edges).toEqual(expectedEdges);
  });

  it('should set the correct node width and height', () => {
    const setNodeSpy = vi.spyOn(dagre.graphlib.Graph.prototype, 'setNode');

    getLayoutedElements(nodes, edges);

    nodes.forEach((node) => {
      expect(setNodeSpy).toHaveBeenCalledWith(
        node.id,
        expect.objectContaining({
          width: 300,
          height: 100,
        }),
      );
    });
  });

  it('should set the correct edge connections', () => {
    const setEdgeSpy = vi.spyOn(dagre.graphlib.Graph.prototype, 'setEdge');
    getLayoutedElements(nodes, edges);

    edges.forEach((edge) => {
      expect(setEdgeSpy).toHaveBeenCalledWith(edge.source, edge.target);
    });
  });
});
