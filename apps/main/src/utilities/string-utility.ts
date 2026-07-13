export const PUBLIC_REGISTRY_IMAGE_REGEX =
  /^(?:[a-zA-Z0-9.-]+(?::[0-9]+)?\/)?(?:[a-z0-9]+(?:(?:\.|-+|__?)[a-z0-9]+)*)(?:\/[a-z0-9]+(?:(?:\.|-+|__?)[a-z0-9]+)*)*:[a-zA-Z0-9](?:[a-zA-Z0-9.-]){0,127}$/;
export const VOLUME_PATH_REGEXP = /\/[A-Za-z0-9-_.]+/;
export const URL_PATH_REGEXP = /^\/.*/;
const ID_PATTERN_STRING = '[a-z0-9](?:-?[a-z0-9]+)+';

export const ID_REGEXP = new RegExp(`^${ID_PATTERN_STRING}$`);

export const EMAIL_PATTERN =
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export const LABEL_KEY_REGEXP =
  /^(?:[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?\/)?[a-z0-9A-Z](?:[a-z0-9A-Z_.-]{0,61}[a-z0-9A-Z])?$/;
export const LABEL_VALUE_REGEXP = /^[a-z0-9A-Z]{1}[a-z0-9A-Z\-_.]*[a-z0-9A-Z]{1}$/;

export const CRONJOB_MINUTE_REGEX =
  /^(\*|(?:\*|(?:[0-9]|(?:[1-5][0-9])))\/(?:[0-9]|(?:[1-5][0-9]))|(?:[0-9]|(?:[1-5][0-9]))(?:(?:-[0-9]|-(?:[1-5][0-9]))?|(?:,(?:[0-9]|(?:[1-5][0-9])))*))$/;
export const CRONJOB_HOUR_REGEX =
  /^(\*|(?:\*|(?:\*|(?:[0-9]|1[0-9]|2[0-3])))\/(?:[0-9]|1[0-9]|2[0-3])|(?:[0-9]|1[0-9]|2[0-3])(?:(?:-(?:[0-9]|1[0-9]|2[0-3]))?|(?:,(?:[0-9]|1[0-9]|2[0-3]))*))$/;
export const CRONJOB_MONTH_DAY_REGEX =
  /^(\*|\?|L(?:W|-(?:[1-9]|(?:[12][0-9])|3[01]))?|(?:[1-9]|(?:[12][0-9])|3[01])(?:W|\/(?:[1-9]|(?:[12][0-9])|3[01]))?|(?:[1-9]|(?:[12][0-9])|3[01])(?:(?:-(?:[1-9]|(?:[12][0-9])|3[01]))?|(?:,(?:[1-9]|(?:[12][0-9])|3[01]))*))$/;
export const CRONJOB_MONTH_REGEX =
  /^(\*|(?:[1-9]|1[012]|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?:(?:-(?:[1-9]|1[012]|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC))?|(?:,(?:[1-9]|1[012]|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC))*))$/;
export const CRONJOB_WEEK_DAY_REGEX =
  /^(\*|\?|[0-6](?:L|#[1-5])?|(?:[0-6]|SUN|MON|TUE|WED|THU|FRI|SAT)(?:(?:-(?:[0-6]|SUN|MON|TUE|WED|THU|FRI|SAT))?|(?:,(?:[0-6]|SUN|MON|TUE|WED|THU|FRI|SAT))*))$/;
// Comment out when add year field to cronjobs
// export const CRONJOB_YEAR_REGEX =
//   /^(\*|(?:[1-9][0-9]{3})(?:(?:-[1-9][0-9]{3})?|(?:,[1-9][0-9]{3})*))$/;
const RESOURCE_ID_PATTERN_STRING = `[a-z0-9](?:-?[a-z0-9]+)+(?:\\.[a-z0-9](?:-?[a-z0-9]+)+)*`;
export const RESOURCE_ID_REGEXP = new RegExp(`^${RESOURCE_ID_PATTERN_STRING}$`);

export const VALID_PLACEHOLDER_REGEX = new RegExp(
  `\\$\{[a-zA-Z0-9_.-]*((?<=resources)\\[["']${RESOURCE_ID_PATTERN_STRING}(\\.${ID_PATTERN_STRING})?(#(${RESOURCE_ID_PATTERN_STRING}))?([<>](${RESOURCE_ID_PATTERN_STRING}))?["']\\][a-zA-Z0-9_.-]*)?}`,
);

export interface GranularRegexMatch {
  regex: RegExp;
  transkey: string;
  /**
   * If true, it means that a string matching this regex is invalid.
   * e.g. For ID, uppercase is not valid. So string matching regex '/[A-Z]/' will be considered an error
   */
  negativeMatch: boolean;
}

export const ID_VALIDATIONS: Record<string, GranularRegexMatch> = {
  MIN_TWO_CHARS: {
    regex: /^.{2,}$/,
    transkey: 'Must be at least 2 characters',
    negativeMatch: false,
  },
  UPPERCASE: { regex: /[A-Z]/, transkey: 'Must be lowercase', negativeMatch: true },
  ALLOWED_CHARS: {
    regex: /^[a-zA-Z0-9-]*$/,
    transkey: 'Can only contain letters, numbers and dashes “-”',
    negativeMatch: false,
  },
  STARTS_WITH_DASH: {
    regex: /^-/,
    transkey: 'Cannot start with a dash',
    negativeMatch: true,
  },
  CONSECUTIVE_DASHES: {
    regex: /--/,
    transkey: 'Cannot have consecutive dashes',
    negativeMatch: true,
  },
  ENDS_WITH_DASH: { regex: /-$/, transkey: 'Cannot end with a dash', negativeMatch: true },
};

// Same as ID except first char must be alphabetic.
export const ID_START_WITH_ALPHABETIC_REGEXP = /^[a-z](?:-?[a-z0-9]+)+$/;
export const ID_START_WITH_APLHABETIC_VALIDATIONS: Record<string, GranularRegexMatch> = {
  ...ID_VALIDATIONS,
  STARTS_WITH_ALPHABETIC: {
    regex: /^[a-z]/,
    transkey: 'Must start with a letter',
    negativeMatch: false,
  },
};

// Name regexp for inputs which handle ids(app name, org name).
export const NAME_REGEXP = /^[A-Za-z0-9 ][A-Za-z0-9 _+&-]+[A-Za-z0-9 ]$/;
export const NAME_VALIDATIONS: Record<string, GranularRegexMatch> = {
  MIN_THREE_CHARS: {
    regex: /^.{3,}$/,
    transkey: 'Must be at least 3 characters',
    negativeMatch: false,
  },
  ALLOWED_CHARS: {
    regex: NAME_REGEXP,
    transkey: 'Must start and end with letters or numbers. May also contain spaces, &, +, - and _',
    negativeMatch: false,
  },
};
// path matches file paths that start with "/" , have at least two "/", allows all characters including special characters, optional extension
export const PATH_REGEXP = /^\/[^/\s]+(\/[^/\s]+){1,}(?:\.[^/\s]+)?$/;

export const PATH_VALIDATIONS: Record<string, GranularRegexMatch> = {
  START_WITH_SLASH: {
    regex: /^\//,
    transkey: 'Must start with /',
    negativeMatch: false,
  },
  CONTAIN_TWO_SLASH: {
    regex: /[^/]*\/[^/]*\/[^/]*/,
    transkey: 'Should contain at least two /',
    negativeMatch: false,
  },
  VALID_PATH: {
    regex: PATH_REGEXP,
    transkey: 'Should be a valid file path',
    negativeMatch: false,
  },
};

export const SUB_PATH_VALIDATIONS: Record<string, GranularRegexMatch> = {
  RELATIVE_PATH: {
    regex: /^[^/]/,
    transkey: 'Must be a relative path',
    negativeMatch: false,
  },
  VALID_PATH: {
    regex: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\/[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/,
    transkey: 'can only contain numbers or letters that are separated by /',
    negativeMatch: false,
  },
};

const NUMBER_REGEX_STRING = '^-?\\d+$';
/* eslint-disable-next-line no-template-curly-in-string */
const PLACEHOLDER_REGEX_STRING = '\\${{1}.*?}{1}';
export const PLACEHOLDER_REGEX = new RegExp(`${PLACEHOLDER_REGEX_STRING}`, 'g');
export const PLACEHOLDER_OR_NUMBER_REGEX = new RegExp(
  `${PLACEHOLDER_REGEX_STRING}|${NUMBER_REGEX_STRING}`,
  'g',
);

/**
 * Function to convert a user entered name to a slugified id and readable name.
 * This function assumes that the name being converted is alphanumeric with whitespace,
 * dashes and underscores. regex: /^[A-Za-z0-9][A-Za-z0-9 _+&-]+[A-Za-z0-9]$/
 *
 * @param name The user entered name.
 */
export const convertToNameAndId = (name: string): { id: string; name: string } => {
  // Replaces multiple spaces to one.
  name = name.trim().replace(/  +/g, ' ');
  return {
    id: convertToId(name),
    name,
  };
};

/**
 * converts name to id
 *
 * @param {string} name
 * @returns {string}
 */
export const convertToId = (name: string): string => {
  name = name.trim().replace(/  +/g, ' ');
  // Replace remaining spaces & underscores with a dash.
  const id = name.replace(/[ _+&-]+/g, '-');
  return id.toLowerCase();
};

/**
 * get index of the end of a search term in a string
 *
 * @param {string} text
 * @param {string} searchTerm
 * @returns {number}
 */
export const indexOfEnd = (text: string, searchTerm: string): number => {
  return text.indexOf(searchTerm) + searchTerm.length + 1;
};

/**
 * converts text to all lowercase but retains case of first word.
 * allLowerCaseExceptFirstWord('AMQL Broker')  // AMQL broker
 *
 * @param {string} text
 * @returns {string}
 */
export const allLowerCaseExceptFirstWord = (text: string) => {
  const words = text.split(' ');

  return words.slice(1, words.length).reduce((newSentence, word) => {
    return newSentence + ' ' + word.toLowerCase();
  }, words[0]);
};

export const isNumeric = (value: string) => {
  return !isNaN(parseFloat(value)) && isFinite(parseFloat(value));
};
