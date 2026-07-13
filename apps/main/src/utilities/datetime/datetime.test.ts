import { subDays, subHours, subMinutes, subMonths, subSeconds, subYears } from 'date-fns';
import { format } from 'date-fns-tz';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  convertSecondsToTimeUnitsDHMS,
  DATE_FORMATS_TYPES,
  DateTillNowDifference,
  formatDate,
} from './datetime';

describe('the formatDate function', () => {
  describe('if a dateformat is specified', () => {
    it('should return valid date in the desired format', () => {
      const datetime = formatDate(
        '2022-06-15T12:57:07.699429Z',
        DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE,
      );
      expect(datetime).toEqual(
        format(
          new Date('2022-06-15T12:57:07.699429Z'),
          `${DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE}`,
        ),
      );
    });

    it("should return undefined as default if dateString isn't specified or is falsy", () => {
      expect(formatDate(undefined, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE)).toEqual(
        undefined,
      );
    });

    it("should return the current date in the desired format if dateString isn't specified or is falsy and returnCurrentDateAsDefault is set to true", () => {
      expect(formatDate(undefined, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE, true)).toEqual(
        format(new Date(), `${DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE}`),
      );
    });

    it('should return the date in the desired format with timezone when time format is specified', () => {
      const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      expect(formatDate(undefined, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE, true)).toEqual(
        format(new Date(), DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE, {
          timeZone: userTimeZone,
        }),
      );
    });

    it('should show timezone if available', () => {
      vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
        timeZone: 'America/New_York',
        locale: 'en-US',
        calendar: 'gregory',
        numberingSystem: 'latn',
      });

      expect(formatDate(undefined, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE, true)).toEqual(
        format(new Date(), DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE, {
          timeZone: 'America/New_York',
        }),
      );
    });

    it('should default to UTC if timezone is not available', () => {
      vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
        timeZone: '',
        locale: 'en-US',
        calendar: 'gregory',
        numberingSystem: 'latn',
      });
      expect(formatDate(undefined, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE, true)).toEqual(
        format(new Date(), DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE, { timeZone: 'UTC' }),
      );
    });

    it('should hide timezone', () => {
      expect(formatDate(undefined, DATE_FORMATS_TYPES.RFC, true)).toEqual(
        format(new Date(), DATE_FORMATS_TYPES.RFC),
      );
    });
  });
  describe('if no dateformat is specified', () => {
    it('should return the date passed in ISO format', () => {
      const dateToFormat = '2010-10-2';
      expect(formatDate(dateToFormat)).toEqual(
        format(new Date(dateToFormat), DATE_FORMATS_TYPES.RFC),
      );
    });
    it('should return the current date in ISO format if no dateString is passed', () => {
      expect(formatDate()).toEqual(format(new Date(), DATE_FORMATS_TYPES.RFC));
    });
  });
});

describe('convertSecondsToTimeUnitsDHMS', () => {
  it('should return "0 s" when given 0 seconds', () => {
    expect(convertSecondsToTimeUnitsDHMS(0)).toBe('0 s');
  });

  it('should convert seconds to days, hours, minutes, and seconds', () => {
    expect(convertSecondsToTimeUnitsDHMS(86400)).toBe('1 d');
    expect(convertSecondsToTimeUnitsDHMS(90000)).toBe('1 d 1 h');
    expect(convertSecondsToTimeUnitsDHMS(3660)).toBe('1 h 1 m');
    expect(convertSecondsToTimeUnitsDHMS(65)).toBe('1 m 5 s');
    expect(convertSecondsToTimeUnitsDHMS(123456)).toBe('1 d 10 h');
  });

  it('should handle invalid inputs', () => {
    expect(convertSecondsToTimeUnitsDHMS(-100)).toBe('0 s');
    expect(convertSecondsToTimeUnitsDHMS(NaN)).toBe('0 s');
  });
});

describe('DateTillNowDifference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the correct time difference in years', () => {
    expect(DateTillNowDifference(subYears(new Date(), 12))).toBe('12 yr(s)');
  });

  it('should return the correct time difference in months', () => {
    expect(DateTillNowDifference(subMonths(new Date(), 9))).toBe('9 mo(s)');
  });

  it('should return the correct time difference in days', () => {
    expect(DateTillNowDifference(subDays(new Date(), 3))).toBe('3 day(s)');
  });

  it('should return the correct time difference in hours', () => {
    expect(DateTillNowDifference(subHours(new Date(), 2))).toBe('2 hr(s)');
  });

  it('should return the correct time difference in minutes', () => {
    expect(DateTillNowDifference(subMinutes(new Date(), 5))).toBe('5 min(s)');
  });

  it('should return the correct time difference in seconds', () => {
    expect(DateTillNowDifference(subSeconds(new Date(), 5))).toBe('5 sec(s)');
  });
});
