import { ArrowLeftOutlined, ExportOutlined, FullscreenExitOutlined } from '@ant-design/icons';
import {
  applyEdgeChanges,
  applyNodeChanges,
  ControlButton,
  Controls,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
} from '@xyflow/react';
import { Button, Flex, Select, Typography } from 'antd';
import { uniqBy } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import '@xyflow/react/dist/style.css';

import { Filters, MultiFilter } from '@src/components/shared/ui/MultiFilter/MultiFilter';
import { SearchInput } from '@src/components/shared/ui/SearchInput/SearchInput';

import { FlowDiagramProps } from './ReactFlow';
import styles from './ReactFlowInternal.module.css';
import {
  getLayoutedElements,
  getRelatedEdges,
  getRelatedNodes,
  isEdgeRelatedToNode,
} from './utils';

export const ReactFlowInternal = <NodeData extends Record<string, unknown>>({
  nodes: initialNodes,
  edges: initialEdges,
  showControls,
  nodeTypes,
  edgeTypes,
  onNodeClick,
  onPaneClick,
  resourceDependencyGraphLink,
  filterByOptions,
  hideOptions,
  focusOnResourceType,
  showClickCallout,
  compact,
}: FlowDiagramProps<NodeData>) => {
  // State
  const [nodes, setNodes] = useState<Node<NodeData>[]>(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node>();
  const [isFocusedView, setIsFocusedView] = useState<boolean>(false);
  const [dagreLayoutChanged, setDagreLayoutChanged] = useState<boolean>();
  const [initialZoomLevel, setInitialZoomLevel] = useState<number>(compact ? 0.5 : 0.8);
  const minZoomLevel = compact ? 0.3 : 0.6;
  const [filters, setFilters] = useState<Filters>();
  const [edgeStyle, setEdgeStyle] = useState<'bezier' | 'smooth-step'>('bezier');
  const [hasAutoFocused, setHasAutoFocused] = useState(false);
  // router
  const [_, setSearchParams] = useSearchParams();

  // i18n
  const { t } = useTranslation();
  const uiTranslations = t('UI');

  const { getNodes, getEdges, setCenter, fitView, getZoom } = useReactFlow<Node<NodeData>>();
  const nodesInitialized = useNodesInitialized();

  const setGraphLayout = useCallback(
    (nodesToLayout: Node<NodeData>[], edgesToLayout: Edge[]) => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements<NodeData>(
        nodesToLayout,
        edgesToLayout,
        undefined,
        edgeStyle,
      );
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setDagreLayoutChanged(true);
    },
    [edgeStyle],
  );

  useEffect(() => {
    if (nodesInitialized) {
      setGraphLayout(getNodes(), getEdges());
    }
  }, [nodesInitialized, getNodes, getEdges, setGraphLayout, edgeStyle]);

  // Sync external prop changes (e.g. data updates like isDeleted/isCreated flags, or new nodes)
  useEffect(() => {
    setNodes((currentNodes) => {
      const positionMap = new Map(currentNodes.map((n) => [n.id, n.position]));
      return initialNodes.map((n) => ({ ...n, position: positionMap.get(n.id) ?? n.position }));
    });
    setEdges(initialEdges);
  }, [initialNodes, initialEdges]);

  useEffect(() => {
    // fit the graph in the viewport after it has been initialised
    // Skip fitView if we're going to auto-focus on a specific node
    if (dagreLayoutChanged) {
      if (!focusOnResourceType) {
        fitView({ minZoom: minZoomLevel, maxZoom: 1, duration: 800 });
      }
      setDagreLayoutChanged(false);
      if (!initialZoomLevel) {
        setInitialZoomLevel(getZoom());
      }
    }
  }, [fitView, dagreLayoutChanged, getZoom, initialZoomLevel, minZoomLevel, focusOnResourceType]);

  // Auto-focus on a specific resource type after layout is complete
  useEffect(() => {
    if (focusOnResourceType && !hasAutoFocused && nodes.length > 0 && !dagreLayoutChanged) {
      const nodeToFocus = nodes.find(
        (node) => (node.data as { resource_type?: string }).resource_type === focusOnResourceType,
      );
      if (nodeToFocus && nodeToFocus.measured?.width) {
        // Delay to ensure layout is fully rendered on slower devices
        setTimeout(() => {
          toggleNodeSelection(nodeToFocus);
          setHasAutoFocused(true);
        }, 300);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toggleNodeSelection is intentionally omitted to prevent re-runs
  }, [focusOnResourceType, hasAutoFocused, nodes, dagreLayoutChanged]);

  // Add click callout to the focused node
  useEffect(() => {
    if (showClickCallout && focusOnResourceType && hasAutoFocused) {
      setNodes((prevNodes) => {
        if (prevNodes.length === 0) return prevNodes;
        return prevNodes.map((node) => {
          const isTargetNode =
            (node.data as { resource_type?: string }).resource_type === focusOnResourceType;
          return {
            ...node,
            data: {
              ...node.data,
              showClickCallout: isTargetNode,
            },
          };
        });
      });
    }
  }, [showClickCallout, focusOnResourceType, hasAutoFocused]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<NodeData>>[]) =>
      setNodes((nds) => applyNodeChanges<Node<NodeData>>(changes, nds)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  /**
   * select/unselect a specific node and highligh the nodes and edges connected to it
   *
   * @param node
   * @param removeHighlight if this is true, the highlighting will be removed
   */
  const toggleNodeSelection = (node: Node, removeHighlight?: boolean) => {
    if (!removeHighlight) {
      setSelectedNode(node);
    }
    if (node && nodes && edges) {
      if (node.measured?.width && node.measured?.height) {
        if (removeHighlight) {
          setTimeout(() => {
            fitView({ minZoom: minZoomLevel, maxZoom: 1, duration: 1000 });
          }, 50);
        } else {
          // move viewport to the selected node
          setCenter(node.position.x + node.measured.width / 2, node.position.y, {
            zoom: initialZoomLevel + 0.05,
            duration: 1000,
          });
        }
      }
      setNodes((prevNodes) => {
        return prevNodes?.map((currentNode) => {
          const highlight = currentNode.id === node.id && !removeHighlight;
          currentNode = {
            ...currentNode,
            data: {
              ...currentNode.data,
              selected: highlight,
            },
            style: {
              ...currentNode.style,
              opacity: highlight || selectedNode ? 1 : 0.25,
            },
          };
          return currentNode;
        });
      });
      setEdges((prevEdges) => {
        return prevEdges?.map((currentEdge) => {
          const highlight =
            isEdgeRelatedToNode(currentEdge, node, initialNodes, initialEdges) && !removeHighlight;
          currentEdge = {
            ...currentEdge,
            data: { ...currentEdge.data, highlight, edgeStyle },
            type: 'colored',
            animated: highlight,
          };
          return currentEdge;
        });
      });
    }
  };

  const focusSelection = () => {
    if (selectedNode) {
      setIsFocusedView(true);
      const relatedNodes = getRelatedNodes<NodeData>(selectedNode, initialNodes, initialEdges);
      const relatedEdges = getRelatedEdges(selectedNode, initialNodes, initialEdges);
      setGraphLayout(relatedNodes, relatedEdges);
      toggleNodeSelection(selectedNode);
    }
  };

  const handleBackToFullGraphClick = () => {
    setIsFocusedView(false);
    setSelectedNode(undefined);
    setFilters({});
    setSearchParams(``);
    setGraphLayout(initialNodes, initialEdges);
    if (onPaneClick) {
      onPaneClick();
    }
  };

  const highlightMatchingNodes = (inputValue: string) => {
    const highlightEdges: string[] = [];
    setNodes((prevNodes: Node<NodeData>[]) => {
      return prevNodes?.map((currentNode) => {
        const highlightNode = Object.entries(currentNode.data).some(
          ([, val]) => typeof val === 'string' && val.includes(inputValue),
        );
        currentNode = {
          ...currentNode,
          style: {
            ...currentNode.style,
            opacity: highlightNode ? 1 : 0.25,
          },
        };
        if (highlightNode) {
          highlightEdges.push(
            ...getRelatedEdges(currentNode, initialNodes, initialEdges).map((e) => e.id),
          );
        }
        return currentNode;
      });
    });
    setEdges((prevEdges) => {
      return prevEdges?.map((currentEdge) => {
        const highlight = highlightEdges?.includes(currentEdge.id);
        currentEdge = {
          ...currentEdge,
          data: { ...currentEdge.data, highlight, edgeStyle },
          type: 'colored',
        };
        return currentEdge;
      });
    });
  };

  const handleFilterChange = (newFilters: Filters) => {
    let filteredNodes: Node<NodeData>[] = [];
    let filteredEdges: Edge[] = [];
    setFilters(newFilters);
    const matchingNodes =
      newFilters.main?.conditions && newFilters.main.conditions.length > 0
        ? initialNodes?.filter((currentNode) =>
            newFilters.main?.conditions?.some((condition) =>
              condition.values?.includes(currentNode.data[condition.filterBy] as string),
            ),
          )
        : initialNodes;
    matchingNodes.forEach((matchingNode) => {
      filteredNodes = uniqBy(
        [
          ...filteredNodes,
          ...getRelatedNodes<NodeData>(
            matchingNode,
            initialNodes,
            initialEdges,
            newFilters.main?.checkboxes?.show_dependants || false,
            newFilters.main?.checkboxes?.show_dependencies || false,
          ),
        ],
        'id',
      );
      filteredEdges = uniqBy(
        [...filteredEdges, ...getRelatedEdges(matchingNode, initialNodes, initialEdges)],
        'id',
      );
    });
    setGraphLayout(filteredNodes, filteredEdges);
  };

  const handleClearFilters = () => {
    setFilters({});
    setSearchParams(``);
    setGraphLayout(initialNodes, initialEdges);
  };

  return (
    <Flex vertical style={{ height: '100%', width: '100%' }}>
      {!hideOptions && (
        <Flex gap={'middle'} align={'center'} wrap={'wrap'}>
          <Flex gap={'small'}>
            {isFocusedView && (
              <Button
                icon={<ArrowLeftOutlined />}
                variant={'outlined'}
                onClick={handleBackToFullGraphClick}>
                {uiTranslations.BACK_TO_FULL_GRAPH}
              </Button>
            )}
            <Button
              icon={<FullscreenExitOutlined />}
              variant={'outlined'}
              disabled={!selectedNode}
              onClick={focusSelection}>
              {uiTranslations.FOCUS_SELECTION}
            </Button>
          </Flex>
          {filterByOptions && (
            <>
              <MultiFilter
                filterByOptions={filterByOptions}
                onFiltersChange={handleFilterChange}
                defaultFilters={filters}
              />
              {filters?.main?.conditions && filters.main.conditions.length > 0 && (
                <Button variant={'link'} onClick={handleClearFilters}>
                  {uiTranslations.CLEAR_FILTERS}
                </Button>
              )}
            </>
          )}
          <Typography.Text>Edge style: </Typography.Text>
          <Select
            style={{ minWidth: '100px' }}
            defaultValue={edgeStyle}
            options={[
              { label: 'Step edge', value: 'smooth-step' },
              { label: 'Curved', value: 'bezier' },
            ]}
            onChange={(value) => setEdgeStyle(value as 'bezier' | 'smooth-step')}
          />
          <SearchInput
            placeholder={uiTranslations.GRAPH_SEARCH_PLACEHOLDER}
            onChange={highlightMatchingNodes}
          />
        </Flex>
      )}

      <Flex flex={1}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          maxZoom={2}
          data-testid={'react-flow-component'}
          minZoom={minZoomLevel}
          zoomOnScroll={false}
          panOnScroll={false}
          preventScrolling={false}
          proOptions={{
            hideAttribution: true,
          }}
          onNodeClick={(e, node) => {
            toggleNodeSelection(node);
            if (onNodeClick) {
              onNodeClick(node);
            }
          }}
          onPaneClick={() => {
            if (selectedNode && !isFocusedView) {
              toggleNodeSelection(selectedNode, true);
              setSelectedNode(undefined);
              if (onPaneClick) {
                onPaneClick();
              }
            }
          }}
          defaultViewport={{ x: 0, y: 0, zoom: initialZoomLevel }}>
          {showControls && (
            <Controls showInteractive={false} className={styles.customControl}>
              {resourceDependencyGraphLink && (
                <ControlButton>
                  <Link
                    className={'default-color'}
                    aria-label={uiTranslations.SHOW_RESOURCE_GRAPH_FULL_SCREEN}
                    to={resourceDependencyGraphLink}
                    target={'_blank'}
                    rel={'noreferrer'}>
                    <ExportOutlined />
                  </Link>
                </ControlButton>
              )}
            </Controls>
          )}
        </ReactFlow>
      </Flex>
    </Flex>
  );
};
