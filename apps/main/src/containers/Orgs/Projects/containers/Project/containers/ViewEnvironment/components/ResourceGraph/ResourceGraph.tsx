import { Edge, MarkerType, Node } from '@xyflow/react';
import { Drawer, Empty, Flex, Spin, theme, Typography } from 'antd';
import { uniqBy } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import '@xyflow/react/dist/style.css';

import { ResourceIcon } from '@src/components/shared/ResourceIcon';
import { DataEntry } from '@src/components/shared/ui/DataEntry/DataEntry';
import { FilterByOptions } from '@src/components/shared/ui/MultiFilter/MultiFilter';
import { MatchParams } from '@src/config/routing';
import { ColoredEdge } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewEnvironment/components/ResourceGraph/components/ColoredEdge';
import { ReactFlow } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewEnvironment/components/ResourceGraph/components/ReactFlow/ReactFlow';
import { ResourceNode } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewEnvironment/components/ResourceGraph/components/ResourceNode';
import {
  getListResourceTypesQueryKey,
  listResourceTypes,
} from '@src/hooks/react-query/v2/controlplane/resource-type/resource-type';
import {
  getListActiveResourceNodesQueryKey,
  listActiveResourceNodes,
} from '@src/hooks/react-query/v2/dataplane/active-resource/active-resource';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { i18n } from '@src/i18n/i18n';
import { ActiveResourceNode } from '@src/models/v2/dataplane';
import { generateAppUrl, generateModuleUrl } from '@src/utilities/navigation';

const nodeTypes = {
  resourceNode: ResourceNode,
};

const edgeTypes = {
  colored: ColoredEdge,
};

/** Delay to allow the Ant Design Drawer to fully render before scrolling to highlighted content */
const DRAWER_RENDER_DELAY_MS = 300;

/** Padding above the highlighted element when auto-scrolling in the drawer */
const HIGHLIGHT_SCROLL_OFFSET_PX = 20;

type ActiveResourceGraphNode = ActiveResourceNode & Record<any, any>;

export const ResourceGraph = (props: {
  orgId?: string;
  projectId?: string;
  envId?: string;
  hideOptions?: boolean;
  showFakeDataHint?: boolean;
  emptyStateDescription?: React.ReactNode;
  /** Custom image/icon for the empty state */
  emptyStateImage?: React.ReactNode;
  /** Auto-focus on a node with this resource_type after the graph loads */
  focusOnResourceType?: string;
  /** Override the minimum height of the graph container */
  minHeight?: string;
  /** Metadata keys to highlight in the drawer */
  highlightMetadataKeys?: string[];
  /** Show a "click me" callout on the focused resource node */
  showClickCallout?: boolean;
  /** Use compact mode with no minimum height */
  compact?: boolean;
  highlightedModuleIds?: string[];
  /** Node IDs to style as deleted (transparent + dashed border) */
  deletedNodeIds?: string[];
  /** Node IDs to style as created (green border + glow) */
  createdNodeIds?: string[];
  /** Externally provided resource nodes. When set, skips the internal active-resources fetch. */
  resources?: ActiveResourceNode[];
}) => {
  // theme tokens
  const { token } = theme.useToken();

  // state
  const [selectedResource, setSelectedResource] = useState<ActiveResourceNode>();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const hasScrolledToHighlight = useRef(false);
  const highlightScrollRef = useRef<HTMLDivElement>(null);
  const {
    hideOptions,
    showFakeDataHint,
    emptyStateDescription,
    emptyStateImage,
    focusOnResourceType,
    minHeight,
    highlightMetadataKeys,
    highlightedModuleIds,
    deletedNodeIds,
    createdNodeIds,
    showClickCallout,
    compact,
    resources,
  } = props;

  // i18n
  const { t } = useTranslation();
  const graphTranslations = t('UI');

  // Router
  const {
    orgId: routerOrgId,
    projectId: routerProjectId,
    envId: routerEnvId,
  } = useParams<keyof MatchParams>() as MatchParams;

  const orgId = (routerOrgId || props.orgId) as string;
  const projectId = routerProjectId || props.projectId;
  const envId = routerEnvId || props.envId;

  // React Query
  const { data: allResourceTypes } = useAllPages(
    getAllPagesQueryKey(getListResourceTypesQueryKey(orgId)),
    (params) => listResourceTypes(orgId, params),
  );
  const activeResourceNodeParams = { project_id: projectId, env_id: envId };
  const { data: fetchedResourceNodes, isFetching: activeResourceNodesFetching } = useAllPages(
    getAllPagesQueryKey(getListActiveResourceNodesQueryKey(orgId, activeResourceNodeParams)),
    (params) => listActiveResourceNodes(orgId, { ...activeResourceNodeParams, ...params }),
    undefined,
    { enabled: Boolean(projectId && envId) && resources === undefined },
  );

  const activeResourceNodes = resources ?? fetchedResourceNodes;
  const isFetching = resources === undefined && activeResourceNodesFetching;

  // Reset scroll flag when selected resource changes so we scroll again for new selections
  useEffect(() => {
    hasScrolledToHighlight.current = false;
  }, [selectedResource]);

  // Scroll to highlighted metadata when drawer opens (only within the drawer)
  useEffect(() => {
    if (
      sidebarOpen &&
      selectedResource &&
      highlightMetadataKeys &&
      highlightMetadataKeys.length > 0 &&
      !hasScrolledToHighlight.current
    ) {
      // Mark as initiated before starting timer to prevent re-triggering if dependencies change
      hasScrolledToHighlight.current = true;
      const timer = setTimeout(() => {
        if (highlightScrollRef.current) {
          // Find the drawer body (scrollable container) and scroll within it only
          const drawerBody = highlightScrollRef.current.closest('.ant-drawer-body');
          if (drawerBody && typeof drawerBody.scrollTo === 'function') {
            try {
              const elementTop = highlightScrollRef.current.offsetTop;
              drawerBody.scrollTo({
                top: elementTop - HIGHLIGHT_SCROLL_OFFSET_PX,
                behavior: 'smooth',
              });
            } catch {
              // Silently fail if scrolling is not supported
            }
          }
        }
      }, DRAWER_RENDER_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [sidebarOpen, selectedResource, highlightMetadataKeys]);

  const nodes: Node<ActiveResourceGraphNode>[] = useMemo(() => {
    return allResourceTypes
      ? activeResourceNodes?.map((node) => ({
          id: node.id,
          position: { x: 0, y: 0 },
          type: 'resourceNode',
          data: {
            ...node,
            incomers: activeResourceNodes
              .filter((activeNode) => Object.values(activeNode.edges).includes(node.id))
              .map((activeNode) => activeNode.id),
            hasError: highlightedModuleIds?.includes(node.module_id || '') ?? false,
            isDeleted: deletedNodeIds?.includes(node.id) ?? false,
            isCreated: createdNodeIds?.includes(node.id) ?? false,
          },
        })) || []
      : [];
  }, [activeResourceNodes, allResourceTypes, highlightedModuleIds, deletedNodeIds, createdNodeIds]);

  const edges = useMemo(
    () =>
      activeResourceNodes?.reduce((acc: Edge[], node: ActiveResourceNode) => {
        return Object.entries(node.edges) && Object.entries(node.edges).length > 0
          ? [
              ...acc,
              ...Object.entries(node.edges)?.map(([, value]) => ({
                id: `${node.id}-${value}`,
                source: node.id,
                target: value,
                markerEnd: { type: MarkerType.ArrowClosed, strokeWidth: 5 },
                data: {
                  isDeleted:
                    (deletedNodeIds?.includes(node.id) || deletedNodeIds?.includes(value)) ?? false,
                  isCreated:
                    (createdNodeIds?.includes(node.id) || createdNodeIds?.includes(value)) ?? false,
                },
              })),
            ]
          : acc;
      }, []) || [],
    [activeResourceNodes, deletedNodeIds, createdNodeIds],
  );

  const handleNodeClick = (selectedNode: Node<ActiveResourceGraphNode>) => {
    const activeResource = activeResourceNodes?.find((node) => node.id === selectedNode.data.id);
    if (activeResource) {
      setSelectedResource(activeResource);
    }
    setSidebarOpen(true);
  };

  const handlePaneClick = () => {
    if (selectedResource) {
      setSelectedResource(undefined);
    }
  };

  const filterByOptions: FilterByOptions = {
    main: {
      options: [
        {
          label: graphTranslations.RESOURCE_TYPE,
          value: 'resource_type',
          comboSelectOptions: uniqBy(
            activeResourceNodes
              ?.map((node) => node.resource_type)
              .map((resourceType) => ({
                id: resourceType,
                label: resourceType,
                searchString: resourceType,
                value: resourceType,
              })),
            'id',
          ),
        },
        {
          label: graphTranslations.RESOURCE_CLASS,
          value: 'resource_class',
          comboSelectOptions: uniqBy(
            activeResourceNodes
              ?.map((node) => node.resource_class)
              .map((resourceClass) => ({
                label: resourceClass,
                value: resourceClass,
              })),
            'id',
          ),
        },
        {
          label: graphTranslations.RESOURCE_ID,
          value: 'resource_id',
          comboSelectOptions: uniqBy(
            activeResourceNodes
              ?.map((node) => node.resource_id)
              .map((id) => ({
                label: id,
                value: id,
              })),
            'id',
          ),
        },
      ],
      checkboxes: [
        {
          label: graphTranslations.SHOW_DEPENDANTS,
          name: 'show_dependants',
        },
        {
          label: graphTranslations.SHOW_DEPENDENCIES,
          name: 'show_dependencies',
        },
      ],
    },
  };

  return (
    <I18nextProvider i18n={i18n}>
      <Flex
        wrap={'wrap'}
        style={{ height: '100%', minHeight: compact ? undefined : (minHeight ?? '700px') }}>
        <Flex vertical style={{ width: '100%' }}>
          {activeResourceNodes && activeResourceNodes.length > 0 ? (
            <>
              {/* graph */}
              {nodes.length > 0 && (
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  showControls
                  onNodeClick={handleNodeClick}
                  onPaneClick={handlePaneClick}
                  filterByOptions={filterByOptions}
                  resourceDependencyGraphLink={`${generateAppUrl(orgId, projectId, envId)}/resource-graph`}
                  hideOptions={hideOptions}
                  focusOnResourceType={focusOnResourceType}
                  showClickCallout={showClickCallout}
                  compact={compact}
                />
              )}

              {/* drawer */}
              {sidebarOpen && selectedResource && (
                <Drawer
                  mask={false}
                  title={
                    <Flex
                      align={'centered'}
                      gap={'small'}
                      className={'flex-row flex-centered mb-lg'}>
                      <ResourceIcon type={selectedResource.resource_type} />
                      <Typography.Text className={'mr-md'}>
                        {selectedResource.resource_id}
                      </Typography.Text>
                    </Flex>
                  }
                  placement={'right'}
                  closable
                  onClose={() => setSidebarOpen(false)}
                  open={sidebarOpen}
                  getContainer={false}>
                  <Flex vertical gap={'small'}>
                    {Object.entries(selectedResource).map(
                      ([key, value]) =>
                        typeof value === 'string' &&
                        value &&
                        key !== 'id' && (
                          <DataEntry
                            key={key}
                            label={key}
                            value={
                              key === 'module_id' ? (
                                <Link target={'_blank'} to={generateModuleUrl(orgId, value)}>
                                  {value}
                                  {/* <Icon name={'link'} overrideColor={'main'} /> */}
                                </Link>
                              ) : (
                                <Typography.Text>{value}</Typography.Text>
                              )
                            }
                          />
                        ),
                    )}
                    {Object.keys(selectedResource.metadata || {}).length > 0 && (
                      <Typography.Title level={4} className={'mb-md'}>
                        Metadata
                      </Typography.Title>
                    )}
                    {(() => {
                      const metadataKeys = Object.keys(selectedResource.metadata);
                      const firstHighlightedKey = metadataKeys.find((k) =>
                        highlightMetadataKeys?.includes(k),
                      );
                      return Object.entries(selectedResource.metadata).map(([key, value]) => {
                        if (typeof value !== 'string' || !value || key === 'id') {
                          return null;
                        }
                        const isHighlighted = highlightMetadataKeys?.includes(key);
                        const isFirstHighlighted = key === firstHighlightedKey;

                        const entry = isHighlighted ? (
                          <div
                            key={key}
                            style={{
                              backgroundColor: token.colorWarningBg,
                              padding: '8px 12px',
                              borderRadius: token.borderRadius,
                              border: `2px solid ${token.colorWarningBorder}`,
                              marginBottom: 4,
                            }}>
                            <Flex vertical gap={4}>
                              <Typography.Text
                                strong
                                style={{ color: token.colorWarningTextActive, fontSize: 12 }}>
                                {showFakeDataHint && value.startsWith('http')
                                  ? `${key} (example link only)`
                                  : key}
                              </Typography.Text>
                              <Typography.Text
                                strong
                                style={{ fontSize: 16, color: token.colorWarningTextActive }}>
                                {value}
                              </Typography.Text>
                            </Flex>
                          </div>
                        ) : (
                          <DataEntry
                            key={key}
                            label={
                              showFakeDataHint && value.startsWith('http')
                                ? `${key} (example link only)`
                                : key
                            }
                            value={
                              value.startsWith('http') ? (
                                <Link to={value} target={'_blank'}>
                                  {value}
                                </Link>
                              ) : (
                                <Typography.Text>{value}</Typography.Text>
                              )
                            }
                          />
                        );

                        return isFirstHighlighted ? (
                          <div key={`${key}-wrapper`} ref={highlightScrollRef}>
                            {entry}
                          </div>
                        ) : (
                          entry
                        );
                      });
                    })()}
                  </Flex>
                </Drawer>
              )}
            </>
          ) : isFetching ? (
            <Flex align={'center'} justify={'center'} style={{ flex: 1 }}>
              <Spin />
            </Flex>
          ) : (
            <Flex align={'center'} justify={'center'} style={{ flex: 1 }}>
              <Empty
                image={emptyStateImage}
                description={
                  emptyStateDescription ??
                  (activeResourceNodes === undefined
                    ? graphTranslations.NO_GRAPH_AVAILABLE
                    : graphTranslations.GRAPH_NO_RESOURCES)
                }
                styles={
                  emptyStateImage ? { image: { marginBottom: 8, height: 'auto' } } : undefined
                }
              />
            </Flex>
          )}
        </Flex>
      </Flex>
    </I18nextProvider>
  );
};
