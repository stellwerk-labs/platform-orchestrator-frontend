import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MockProviders } from '@src/testing-utils/MockProviders';

import { ReactFlow } from './ReactFlow';

describe('FlowDiagram', () => {
  const nodes = [
    { id: 'node1', data: { label: 'Node 1' }, position: { x: 100, y: 100 } },
    { id: 'node2', data: { label: 'Node 2' }, position: { x: 200, y: 200 } },
  ];
  const edges = [{ id: 'edge1', source: 'node1', target: 'node2' }];

  const initialise = (showControls?: boolean) => {
    render(
      <MockProviders>
        <ReactFlow nodes={nodes} edges={edges} showControls={showControls} />
      </MockProviders>,
    );
  };

  it('should render the nodes and edges', async () => {
    initialise();
    expect(screen.getByText('Node 1')).toBeInTheDocument();
    expect(screen.getByText('Node 2')).toBeInTheDocument();
  });

  it('should render the controls if showControls is true', async () => {
    initialise(true);
    expect(screen.getByTestId('rf__controls')).toBeInTheDocument();
  });

  it('should not render the controls if showControls is false', async () => {
    initialise(false);
    expect(screen.queryByTestId('crf__controls')).not.toBeInTheDocument();
  });
});
