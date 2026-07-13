import { describe, expect, it } from 'vitest';

import { ByModeQueryParamParameterItem } from '@src/models/v2/dataplane';

import { mapModeFilterToApiParams } from './modes';

describe('mapModeFilterToApiParams', () => {
  it('returns undefined for undefined input', () => {
    expect(mapModeFilterToApiParams(undefined)).toBeUndefined();
  });

  it('returns undefined for empty array', () => {
    expect(mapModeFilterToApiParams([])).toBeUndefined();
  });

  it("maps 'deploy' to deploy and plan_only", () => {
    expect(mapModeFilterToApiParams(['deploy'])).toEqual([
      ByModeQueryParamParameterItem.deploy,
      ByModeQueryParamParameterItem.plan_only,
    ]);
  });

  it("maps 'rollback' to rollback and rollback_plan", () => {
    expect(mapModeFilterToApiParams(['rollback'])).toEqual([
      ByModeQueryParamParameterItem.rollback,
      ByModeQueryParamParameterItem.rollback_plan,
    ]);
  });

  it("maps 'destroy' to destroy only", () => {
    expect(mapModeFilterToApiParams(['destroy'])).toEqual([ByModeQueryParamParameterItem.destroy]);
  });

  it('combines params for multiple modes', () => {
    expect(mapModeFilterToApiParams(['deploy', 'rollback'])).toEqual([
      ByModeQueryParamParameterItem.deploy,
      ByModeQueryParamParameterItem.plan_only,
      ByModeQueryParamParameterItem.rollback,
      ByModeQueryParamParameterItem.rollback_plan,
    ]);
  });
});
