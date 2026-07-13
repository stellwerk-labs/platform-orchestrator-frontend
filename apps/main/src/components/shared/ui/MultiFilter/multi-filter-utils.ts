import { FilterCondition } from '../MultiFilter/MultiFilterConditions';

/**
 * maps the filter conditions to a dictionary with the following format
 * {
 * filterBy: [...values]
 * }
 *
 * @param conditions
 */
export const createFilterConditionsDictionary = (conditions?: FilterCondition[]) => {
  return conditions?.reduce((obj: Record<string, string[]>, condition) => {
    if (condition.values && condition.values.length > 0) {
      obj[condition.filterBy] = condition.values;
    }
    return obj;
  }, {});
};
