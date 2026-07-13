import { ByModeQueryParamParameterItem } from '@src/models/v2/dataplane';

export const USER_VISIBLE_MODES = ['deploy', 'rollback', 'destroy'] as const;
export type UserVisibleMode = (typeof USER_VISIBLE_MODES)[number];

const MODE_TO_API_PARAMS: Record<UserVisibleMode, ByModeQueryParamParameterItem[]> = {
  deploy: [ByModeQueryParamParameterItem.deploy, ByModeQueryParamParameterItem.plan_only],
  rollback: [ByModeQueryParamParameterItem.rollback, ByModeQueryParamParameterItem.rollback_plan],
  destroy: [ByModeQueryParamParameterItem.destroy],
};

export const mapModeFilterToApiParams = (
  modes: UserVisibleMode[] | undefined,
): ByModeQueryParamParameterItem[] | undefined => {
  if (!modes || modes.length === 0) return undefined;
  return modes.flatMap((mode) => MODE_TO_API_PARAMS[mode]);
};
