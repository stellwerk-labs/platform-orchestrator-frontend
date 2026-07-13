/* eslint-disable no-template-curly-in-string */
import { describe, expect, it } from 'vitest';

import {
  allLowerCaseExceptFirstWord,
  convertToId,
  convertToNameAndId,
  CRONJOB_HOUR_REGEX,
  CRONJOB_MINUTE_REGEX,
  CRONJOB_MONTH_DAY_REGEX,
  CRONJOB_MONTH_REGEX,
  CRONJOB_WEEK_DAY_REGEX,
  EMAIL_PATTERN,
  GranularRegexMatch,
  ID_REGEXP,
  ID_START_WITH_ALPHABETIC_REGEXP,
  ID_START_WITH_APLHABETIC_VALIDATIONS,
  ID_VALIDATIONS,
  indexOfEnd,
  isNumeric,
  LABEL_KEY_REGEXP,
  LABEL_VALUE_REGEXP,
  NAME_REGEXP,
  NAME_VALIDATIONS,
  PATH_REGEXP,
  PATH_VALIDATIONS,
  PLACEHOLDER_OR_NUMBER_REGEX,
  PLACEHOLDER_REGEX,
  PUBLIC_REGISTRY_IMAGE_REGEX,
  RESOURCE_ID_REGEXP,
  SUB_PATH_VALIDATIONS,
  URL_PATH_REGEXP,
  VALID_PLACEHOLDER_REGEX,
  VOLUME_PATH_REGEXP,
} from './string-utility';

interface Case {
  enteredName: string;
  expected: {
    id: string;
    name: string;
  };
}

const convertCases: Case[] = [
  {
    enteredName: 'app',
    expected: {
      id: 'app',
      name: 'app',
    },
  },
  {
    enteredName: 'camelCase',
    expected: {
      id: 'camelcase',
      name: 'camelCase',
    },
  },
  {
    enteredName: 'space between',
    expected: {
      id: 'space-between',
      name: 'space between',
    },
  },
  {
    enteredName: 'lots of spaces        between',
    expected: {
      id: 'lots-of-spaces-between',
      name: 'lots of spaces between',
    },
  },
  {
    enteredName: '   space around   ',
    expected: {
      id: 'space-around',
      name: 'space around',
    },
  },
  {
    enteredName: 'RaNdOm CaPs',
    expected: {
      id: 'random-caps',
      name: 'RaNdOm CaPs',
    },
  },
  {
    enteredName: 'under_score',
    expected: {
      id: 'under-score',
      name: 'under_score',
    },
  },
];

const ID_CASES = [
  {
    input: 'aa',
    expected: true,
  },
  {
    input: 'a',
    expected: false,
  },
  {
    input: 'UPPERCASE',
    expected: false,
  },
  {
    input: 'specialchar!@#$',
    expected: false,
  },
  {
    input: 'spaceafter ',
    expected: false,
  },
  {
    input: ' spacebefore',
    expected: false,
  },
  {
    input: 'dashend-',
    expected: false,
  },
  {
    input: '-dashstart',
    expected: false,
  },
  {
    input: 'a-------b',
    expected: false,
  },
];

const allLowerCaseExceptFirstWordTestCases = [
  {
    input: 'MYSQL',
    expected: 'MYSQL',
  },
  {
    input: 'MYSQL Database',
    expected: 'MYSQL database',
  },
  {
    input: 'kubernetes Cluster',
    expected: 'kubernetes cluster',
  },
];

/**
 * @param granular - the object with the granular regexes
 * @param testCases - the different use case
 * @param original - in the case that there is an original regex to test against
 */
const testGranularRegex = (
  granular: Record<string, GranularRegexMatch>,
  testCases: { input: string; expected: boolean }[],
  original?: RegExp,
) => {
  testCases.forEach((testCase) => {
    const amountOfGranularValidations = Object.keys(granular).length;
    describe(`value: ${testCase.input}`, () => {
      if (original) {
        // Test against the master regex. An ID matching this is always valid.
        it(`should ${testCase.expected ? 'pass' : 'fail'} master regex`, () => {
          expect(original.test(testCase.input)).toBe(testCase.expected);
        });
      }
      // Test the granular regex's
      it(`should ${
        testCase.expected ? 'pass all' : 'fail at least one'
      } granular validations`, () => {
        const passed: string[] = [];
        const failed: string[] = [];

        Object.entries(granular).forEach(([key, validation]) => {
          const matched = validation.regex.test(testCase.input);
          if (validation.negativeMatch ? !matched : matched) {
            passed.push(key);
          } else {
            failed.push(key);
          }
        });

        // If testCase.expected is 'true', all granular validations should pass.
        // If testCase.expected is 'false', at least one should fail.
        if (testCase.expected) {
          expect(passed.length).toBe(amountOfGranularValidations);
          expect(failed.length).toBe(0);
        } else {
          expect(failed.length).toBeTruthy();
        }
      });
    });
  });
};

describe('string utilities', () => {
  describe('allLowerCaseExceptFirstWord function', () => {
    it('should return the correctly formatted text', () => {
      allLowerCaseExceptFirstWordTestCases.forEach((value) => {
        expect(allLowerCaseExceptFirstWord(value.input)).toEqual(value.expected);
      });
    });
  });

  describe('convertToNameAndId function', () => {
    it('should return the correct name and Id', () => {
      convertCases.forEach((value) => {
        if (value.expected) {
          expect(convertToNameAndId(value.enteredName)).toEqual(value.expected);
        }
      });
    });
  });
  describe('convertToId function', () => {
    it('should return the correct id', () => {
      convertCases.forEach((value) => {
        if (value.expected.id) {
          expect(convertToId(value.enteredName)).toEqual(value.expected.id);
        }
      });
    });
  });

  it('indexOfEnd', () => {
    const testString = '/modules/containers/aziz-container/files/';
    expect(indexOfEnd(testString, 'files')).toEqual(41);
  });

  it('PATH_REGEXP passes tests', () => {
    expect(PATH_REGEXP.test('noslash')).toBeFalsy();
    expect(PATH_REGEXP.test('/nosecondslash')).toBeFalsy();
    expect(PATH_REGEXP.test('textbeforeslash/')).toBeFalsy();
    expect(PATH_REGEXP.test('/textbeforeslash/')).toBeFalsy();
    expect(PATH_REGEXP.test('/two/slash')).toBeTruthy();
  });

  it('VOLUME_PATH_REGEXP passes tests', () => {
    expect(VOLUME_PATH_REGEXP.test('/a')).toBeTruthy();
    expect(VOLUME_PATH_REGEXP.test('/a/b')).toBeTruthy();
    expect(VOLUME_PATH_REGEXP.test('a')).toBeFalsy();
    expect(VOLUME_PATH_REGEXP.test('/')).toBeFalsy();
  });
  describe('Subpath validation', () => {
    const regexpCases = [
      {
        input: 'mysql',
        expected: true,
      },
      {
        input: 'mysql/db/one',
        expected: true,
      },
      {
        input: 'db/one',
        expected: true,
      },
      {
        input: '/mysql',
        expected: false,
      },
      {
        input: '/db/one',
        expected: false,
      },
      {
        input: 'mysql/!!!/&§&',
        expected: false,
      },
    ];
    testGranularRegex(SUB_PATH_VALIDATIONS, regexpCases);
  });

  describe('Path validation', () => {
    const regexpCases = [
      {
        input: '/mysql/gh',
        expected: true,
      },
      {
        input: '/mysql/db',
        expected: true,
      },
      {
        input: '/mysql/gh.ts',
        expected: true,
      },
      {
        input: '/db',
        expected: false,
      },
      {
        input: 'mysql/gh.ts',
        expected: false,
      },
      {
        input: 'path1$/path2',
        expected: false,
      },
      {
        input: '/path1$/path2',
        expected: true,
      },
    ];
    testGranularRegex(PATH_VALIDATIONS, regexpCases);
  });

  it('PATH_ONE_SLASH_REGEXP passes tests', () => {
    expect(URL_PATH_REGEXP.test('noslash')).toBeFalsy();
    expect(URL_PATH_REGEXP.test('textbeforeslash/')).toBeFalsy();
    expect(URL_PATH_REGEXP.test('/nosecondslash')).toBeTruthy();
    expect(URL_PATH_REGEXP.test('/two/slash')).toBeTruthy();
  });

  it('Should validate email', () => {
    expect(EMAIL_PATTERN.test('aziz@example.cloud')).toBeTruthy();
    expect(EMAIL_PATTERN.test('aziz@example.c')).toBeFalsy();
    expect(EMAIL_PATTERN.test('azizexample.c')).toBeFalsy();
  });

  it('LABEL_KEY_REGEXP passes tests', () => {
    expect(LABEL_KEY_REGEXP.test('my-label')).toBeTruthy();
    expect(LABEL_KEY_REGEXP.test('/my-label')).toBeFalsy();
    expect(LABEL_KEY_REGEXP.test('test/my-label')).toBeTruthy();
    expect(LABEL_KEY_REGEXP.test('test.com/my-label')).toBeTruthy();
    expect(LABEL_KEY_REGEXP.test('-test.com/my-label')).toBeFalsy();
    expect(LABEL_KEY_REGEXP.test('my-label-value')).toBeTruthy();
  });

  it('LABEL_VALUE_REGEXP passes tests', () => {
    expect(LABEL_VALUE_REGEXP.test('val-.ue')).toBeTruthy();
    expect(LABEL_VALUE_REGEXP.test('/my-label')).toBeFalsy();
    expect(LABEL_VALUE_REGEXP.test('.value')).toBeFalsy();
    expect(LABEL_VALUE_REGEXP.test('my-label-')).toBeFalsy();
  });

  it('CRONJOB_MINUTE_REGEX passes tests', () => {
    expect(CRONJOB_MINUTE_REGEX.test('15')).toBeTruthy();
    expect(CRONJOB_MINUTE_REGEX.test('70')).toBeFalsy();
    expect(CRONJOB_MINUTE_REGEX.test('*')).toBeTruthy();
    expect(CRONJOB_MINUTE_REGEX.test('*/*')).toBeFalsy();
    expect(CRONJOB_MINUTE_REGEX.test('15-30')).toBeTruthy();
    expect(CRONJOB_MINUTE_REGEX.test('5,15,1')).toBeTruthy();
    expect(CRONJOB_MINUTE_REGEX.test('5,15,70')).toBeFalsy();
  });

  it('CRONJOB_HOUR_REGEX passes tests', () => {
    expect(CRONJOB_HOUR_REGEX.test('15')).toBeTruthy();
    expect(CRONJOB_HOUR_REGEX.test('25')).toBeFalsy();
    expect(CRONJOB_HOUR_REGEX.test('*')).toBeTruthy();
    expect(CRONJOB_HOUR_REGEX.test('*/5')).toBeTruthy();
    expect(CRONJOB_HOUR_REGEX.test('15-30')).toBeFalsy();
    expect(CRONJOB_HOUR_REGEX.test('4-24')).toBeFalsy();
    expect(CRONJOB_HOUR_REGEX.test('5,15,20')).toBeTruthy();
    expect(CRONJOB_HOUR_REGEX.test('5,15,70')).toBeFalsy();
  });

  it('CRONJOB_MONTH_DAY_REGEX passes tests', () => {
    expect(CRONJOB_MONTH_DAY_REGEX.test('15')).toBeTruthy();
    expect(CRONJOB_MONTH_DAY_REGEX.test('25')).toBeTruthy();
    expect(CRONJOB_MONTH_DAY_REGEX.test('*')).toBeTruthy();
    expect(CRONJOB_MONTH_DAY_REGEX.test('15-50')).toBeFalsy();
    expect(CRONJOB_MONTH_DAY_REGEX.test('5,15,30')).toBeTruthy();
    expect(CRONJOB_MONTH_DAY_REGEX.test('5,15,70')).toBeFalsy();
  });

  it('CRONJOB_MONTH_REGEX passes teste', () => {
    expect(CRONJOB_MONTH_REGEX.test('15')).toBeFalsy();
    expect(CRONJOB_MONTH_REGEX.test('25')).toBeFalsy();
    expect(CRONJOB_MONTH_REGEX.test('*')).toBeTruthy();
    expect(CRONJOB_MONTH_REGEX.test('10-12')).toBeTruthy();
    expect(CRONJOB_MONTH_REGEX.test('4-24')).toBeFalsy();
    expect(CRONJOB_MONTH_REGEX.test('5,6,10')).toBeTruthy();
    expect(CRONJOB_MONTH_REGEX.test('JAN')).toBeTruthy();
    expect(CRONJOB_MONTH_REGEX.test('5,15,70')).toBeFalsy();
  });

  it('CRONJOB_WEEK_DAY_REGEX passes tests', () => {
    expect(CRONJOB_WEEK_DAY_REGEX.test('1')).toBeTruthy();
    expect(CRONJOB_WEEK_DAY_REGEX.test('7')).toBeFalsy();
    expect(CRONJOB_WEEK_DAY_REGEX.test('*')).toBeTruthy();
    expect(CRONJOB_WEEK_DAY_REGEX.test('1-6')).toBeTruthy();
    expect(CRONJOB_WEEK_DAY_REGEX.test('1-7')).toBeFalsy();
    expect(CRONJOB_WEEK_DAY_REGEX.test('1,2,5')).toBeTruthy();
    expect(CRONJOB_WEEK_DAY_REGEX.test('SUN')).toBeTruthy();
    expect(CRONJOB_WEEK_DAY_REGEX.test('1,6,7')).toBeFalsy();
  });
  // TODO un comment after adding year field to cronjobs
  // it('CRONJOB_YEAR_REGEX passes tests', () => {
  //   expect(CRONJOB_YEAR_REGEX.test('2015')).toBeTruthy();
  //   expect(CRONJOB_YEAR_REGEX.test('7')).toBeFalsy();
  //   expect(CRONJOB_YEAR_REGEX.test('*')).toBeTruthy();
  //   expect(CRONJOB_YEAR_REGEX.test('1990-2022')).toBeTruthy();
  //   expect(CRONJOB_YEAR_REGEX.test('1-7')).toBeFalsy();
  //   expect(CRONJOB_YEAR_REGEX.test('1999,2010,2020')).toBeTruthy();
  // });

  it('RESOURCE_ID_REGEXP passes tests', () => {
    expect(RESOURCE_ID_REGEXP.test('modules.my-workload.external.my-db')).toBeTruthy();
    expect(RESOURCE_ID_REGEXP.test('shared.dns')).toBeTruthy();
    expect(RESOURCE_ID_REGEXP.test('some-id')).toBeTruthy();
    expect(RESOURCE_ID_REGEXP.test('s3')).toBeTruthy();
  });

  it('PUBLIC_REGISTRY_IMAGE_REGEX passes tests', () => {
    expect(PUBLIC_REGISTRY_IMAGE_REGEX.test('gametron/minecraft:java-17')).toBeTruthy();
    expect(PUBLIC_REGISTRY_IMAGE_REGEX.test('myregistry:5000/postgres/httpd:1.0')).toBeTruthy();
    expect(
      PUBLIC_REGISTRY_IMAGE_REGEX.test('registry.docker.io:5000/gametron/minecraft:java-17'),
    ).toBeTruthy();
    expect(PUBLIC_REGISTRY_IMAGE_REGEX.test('blackicebird/2048:latest')).toBeTruthy();
    expect(PUBLIC_REGISTRY_IMAGE_REGEX.test('image-name:version')).toBeTruthy();
    expect(PUBLIC_REGISTRY_IMAGE_REGEX.test('redis:latest')).toBeTruthy();
    expect(PUBLIC_REGISTRY_IMAGE_REGEX.test('rabbitmq:latest')).toBeTruthy();
  });

  it('PLACEHOLDER_REGEX passes tests', () => {
    expect(PLACEHOLDER_REGEX.test('${context.org_id}')).toBeTruthy();
    expect(PLACEHOLDER_REGEX.test('${sadsad}')).toBeFalsy();
    expect(PLACEHOLDER_REGEX.test('${sadsad')).toBeFalsy();
  });

  it('PLACEHOLDER_OR_NUMBER_REGEX passes tests', () => {
    expect(PLACEHOLDER_OR_NUMBER_REGEX.test('${context.org_id}')).toBeTruthy();
    expect(PLACEHOLDER_OR_NUMBER_REGEX.test('${sadsad}5')).toBeFalsy();
    expect(PLACEHOLDER_OR_NUMBER_REGEX.test('${sadsad')).toBeFalsy();
    expect(PLACEHOLDER_OR_NUMBER_REGEX.test('sadsad')).toBeFalsy();
    expect(PLACEHOLDER_OR_NUMBER_REGEX.test('5')).toBeTruthy();
  });

  it('VALID_PLACEHOLDER_REGEX passes tests', () => {
    expect(VALID_PLACEHOLDER_REGEX.test('${context.org_id}')).toBeTruthy();
    expect(
      VALID_PLACEHOLDER_REGEX.test('${resources["s3.external#public-bucket"].outputs.name}'),
    ).toBeTruthy();
    expect(
      VALID_PLACEHOLDER_REGEX.test('${resources["s3.external#shared.public-bucket"].outputs.name}'),
    ).toBeTruthy();
    expect(
      VALID_PLACEHOLDER_REGEX.test('${resources["s3.external#shared<test"].outputs.name}'),
    ).toBeTruthy();
    expect(
      VALID_PLACEHOLDER_REGEX.test('${resources["s3.external<test"].outputs.name}'),
    ).toBeTruthy();
    expect(VALID_PLACEHOLDER_REGEX.test('${resources["s3<test"].outputs.name}')).toBeTruthy();
    expect(
      VALID_PLACEHOLDER_REGEX.test('${test["s3.external#public-bucket"].outputs.name}'),
    ).toBeFalsy();
    expect(
      VALID_PLACEHOLDER_REGEX.test(
        '${resources["s3.external#sha#red.pub.lic-bucket"].outputs.name}',
      ),
    ).toBeFalsy();
  });

  it('isNumeric should check if a string is a numerical value', () => {
    expect(isNumeric('5')).toBeTruthy();
    expect(isNumeric('-24323')).toBeTruthy();
    expect(isNumeric('33.23')).toBeTruthy();
    expect(isNumeric('asda4s')).toBeFalsy();
  });

  describe('ID validation', () => {
    testGranularRegex(
      ID_VALIDATIONS,
      [
        ...ID_CASES,
        {
          input: '12345',
          expected: true,
        },
      ],
      ID_REGEXP,
    );
  });

  describe('Name validation', () => {
    const regexpCases = [
      {
        input: 'My App',
        expected: true,
      },
      {
        input: 'app',
        expected: true,
      },
      {
        input: 'SpecialChars$%^&',
        expected: false,
      },
      {
        input: 'ümlaut',
        expected: false,
      },
      {
        input: 'aa',
        expected: false,
      },
    ];
    testGranularRegex(NAME_VALIDATIONS, regexpCases, NAME_REGEXP);
  });

  describe('ID start with alphabetical validation', () => {
    testGranularRegex(
      ID_START_WITH_APLHABETIC_VALIDATIONS,
      [
        ...ID_CASES,
        {
          input: '12345',
          expected: false,
        },
      ],
      ID_START_WITH_ALPHABETIC_REGEXP,
    );
  });
});
