import { describe, expect, it } from 'vitest';

import { createFilterConditionsDictionary } from '../MultiFilter/multi-filter-utils';
import { FilterCondition } from '../MultiFilter/MultiFilterConditions';

describe('multi-filter-utils', () => {
  it('createFilterConditionsDictionary should convert the conditions to a disctionary', () => {
    const mockConditions: FilterCondition[] = [
      { filterBy: 'env', values: ['one', 'two', 'three'] },
      { filterBy: 'app', values: ['one', 'two', 'three'] },
    ];
    const expectedResult = {
      env: ['one', 'two', 'three'],
      app: ['one', 'two', 'three'],
    };
    expect(createFilterConditionsDictionary(mockConditions)).toEqual(expectedResult);
  });
});
