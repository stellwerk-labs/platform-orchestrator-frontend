import { ActiveResourceNode } from '@src/models/v2/dataplane';

const nodeIds = (nodes: ActiveResourceNode[]): Set<string> => new Set(nodes.map((n) => n.id));

/** Nodes in `resources` (planned) that do not exist in `activeResources` (current). */
export const getNewNodes = (
  resources: ActiveResourceNode[],
  activeResources: ActiveResourceNode[],
): ActiveResourceNode[] => {
  const activeIds = nodeIds(activeResources);
  return resources.filter((n) => !activeIds.has(n.id));
};

/** Nodes in `activeResources` (current) that do not exist in `resources` (planned). */
export const getRemovedNodes = (
  resources: ActiveResourceNode[],
  activeResources: ActiveResourceNode[],
): ActiveResourceNode[] => {
  const plannedIds = nodeIds(resources);
  return activeResources.filter((n) => !plannedIds.has(n.id));
};

/** Merges two node lists, deduplicating by id. Nodes in `a` take precedence over `b`. */
export const mergeNodes = (
  a: ActiveResourceNode[],
  b: ActiveResourceNode[],
): ActiveResourceNode[] => {
  const aIds = nodeIds(a);
  return [...a, ...b.filter((n) => !aIds.has(n.id))];
};
