import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInMonths,
  differenceInSeconds,
  differenceInYears,
} from 'date-fns';
import { format } from 'date-fns-tz';

import { i18n } from '@src/i18n/i18n';

export enum DATE_FORMATS_TYPES {
  DATE_MONTH_YEAR_HOUR_MINUTE = 'dd MMM yyy, HH:mm z',
  RFC = "yyyy-MM-dd'T'HH:mm:ss'Z'", // for filter via api
}

/**
 * Abstraction for date formatting using the date-fns library's format function.
 * Use this function instead of calling format() directly from date-fns.
 *
 * @param {string|undefined} dateString - The date string to be formatted (optional).
 * @param {DATE_FORMATS_TYPES} dateFormat - The format specifier for the date (optional).
 * @param {boolean} returnCurrentDateAsDefault - Whether to return the current date if dateString is falsy (default: false).
 * @param {boolean} withTimeZone - Whether to include the time zone information in the formatted date (default: true).
 *
 * @example
 * formatDate(); // Returns the current date in ISO format.
 * formatDate("01-01-2014"); // Returns "2014-01-01T00:00:00Z" (ISO format).
 * formatDate("01-01-2014", DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE); // Returns "01 Jan 2014, 00:00".
 * formatDate("", DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE); // Returns undefined.
 * formatDate("", DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE, returnCurrentDateAsDefault); // Returns the current date in "dd MMM yyy, HH:mm".
 * formatDate("01-01-2014", DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE, false, false); // Returns "01 Jan 2014, 00:00" without time zone information.
 *
 * @returns {string|undefined} The formatted date or undefined if no valid date or format is provided.
 */
const dateTranslations = i18n.t('DATE');

export const formatDate = (
  dateString?: string | undefined,
  dateFormat?: DATE_FORMATS_TYPES,
  returnCurrentDateAsDefault: boolean = false,
) => {
  if (!dateFormat) {
    return format(dateString ? new Date(dateString) : new Date(), DATE_FORMATS_TYPES.RFC); // Return formatted date in ISO if no date-format is passed.
  }

  let dateToReturn;

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  if (dateString) {
    dateToReturn = format(new Date(dateString), dateFormat, { timeZone: userTimeZone }); // Return formatted date in specified format if dateString is specified. If an invalid dateString is passed the `new Date()` function would throw a RangeError.
  } else if (returnCurrentDateAsDefault) {
    dateToReturn = format(new Date(), dateFormat, { timeZone: userTimeZone });
  }
  return dateToReturn;
};

/**
 * Converts a given number of seconds into a formatted string representation of time units (days, hours, minutes, and seconds).
 *
 * @param {number} seconds - The number of seconds to be converted.
 * @returns {string} A formatted string representation of the time units in the following format: "X days, X hours, X minutes, X seconds".
 */
export const convertSecondsToTimeUnitsDHMS = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const remainingSecondsAfterDays = seconds % 86400;
  const hours = Math.floor(remainingSecondsAfterDays / 3600);
  const remainingSecondsAfterHours = remainingSecondsAfterDays % 3600;
  const minutes = Math.floor(remainingSecondsAfterHours / 60);
  const remainingSeconds = remainingSecondsAfterHours % 60;

  let result = '';
  let count = 0;

  if (days > 0) {
    result += `${days} d`;
    count++;
  }

  if (hours > 0 && count < 2) {
    result += `${count > 0 ? ' ' : ''}${hours} h`;
    count++;
  }

  if (minutes > 0 && count < 2) {
    result += `${count > 0 ? ' ' : ''}${minutes} m`;
    count++;
  }

  if (remainingSeconds > 0 && count < 2) {
    result += `${count > 0 ? ' ' : ''}${remainingSeconds} s`;
  }

  return result.trim() || '0 s';
};

/**
 * Gets how long a time is till current time
 *
 * @param givenDate
 * @returns string e.g. 2 yr(s), 3 mo(s), 2 sec(s)
 */
export const DateTillNowDifference = (givenDate: Date) => {
  const seconds = differenceInSeconds(new Date(), givenDate);
  const minutes = differenceInMinutes(new Date(), givenDate);
  const hours = differenceInHours(new Date(), givenDate);
  const days = differenceInDays(new Date(), givenDate);
  const months = differenceInMonths(new Date(), givenDate);
  const years = differenceInYears(new Date(), givenDate);

  // Format the result based on the largest unit
  let result = '';
  if (years >= 1) {
    result = years + ` ${dateTranslations.YEARS}`;
  } else if (months >= 1) {
    result = months + ` ${dateTranslations.MONTHS}`;
  } else if (days >= 1) {
    result = days + ` ${dateTranslations.DAYS}`;
  } else if (hours >= 1) {
    result = hours + ` ${dateTranslations.HOURS}`;
  } else if (minutes >= 1) {
    result = minutes + ` ${dateTranslations.MINUTES}`;
  } else {
    result = seconds + ` ${dateTranslations.SECONDS}`;
  }

  return result;
};
