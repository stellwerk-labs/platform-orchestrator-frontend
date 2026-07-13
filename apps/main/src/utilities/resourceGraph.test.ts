import { describe, expect, it } from 'vitest';

import { ActiveResourceNode } from '@src/models/v2/dataplane';

import { getNewNodes, getRemovedNodes, mergeNodes } from './resourceGraph';

const makeNode = (id: string): ActiveResourceNode =>
  ({
    id,
    project_id: 'proj',
    env_id: 'env',
    resource_type: 'type',
    resource_class: 'default',
    resource_id: id,
    deployment_id: 'dep',
    module_id: 'mod',
    module_version: '1',
    edges: {},
    metadata: {},
  }) as ActiveResourceNode;

const a = makeNode('a');
const b = makeNode('b');
const c = makeNode('c');

describe('getNewNodes', () => {
  it('returns nodes in resources that are not in activeResources', () => {
    expect(getNewNodes([a, b, c], [a])).toEqual([b, c]);
  });

  it('returns empty array when all resources already exist', () => {
    expect(getNewNodes([a, b], [a, b, c])).toEqual([]);
  });

  it('returns all resources when activeResources is empty', () => {
    expect(getNewNodes([a, b], [])).toEqual([a, b]);
  });
});

describe('getRemovedNodes', () => {
  it('returns nodes in activeResources that are not in resources', () => {
    expect(getRemovedNodes([a], [a, b, c])).toEqual([b, c]);
  });

  it('returns empty array when all active resources are still planned', () => {
    expect(getRemovedNodes([a, b, c], [a, b])).toEqual([]);
  });

  it('returns all active resources when resources is empty', () => {
    expect(getRemovedNodes([], [a, b])).toEqual([a, b]);
  });
});

describe('mergeNodes', () => {
  it('combines two disjoint lists', () => {
    expect(mergeNodes([a], [b, c])).toEqual([a, b, c]);
  });

  it('deduplicates, keeping node from first list', () => {
    const aModified = { ...a, resource_type: 'other' };
    expect(mergeNodes([aModified], [a, b])).toEqual([aModified, b]);
  });

  it('returns first list when second is empty', () => {
    expect(mergeNodes([a, b], [])).toEqual([a, b]);
  });

  it('returns second list when first is empty', () => {
    expect(mergeNodes([], [a, b])).toEqual([a, b]);
  });
});
