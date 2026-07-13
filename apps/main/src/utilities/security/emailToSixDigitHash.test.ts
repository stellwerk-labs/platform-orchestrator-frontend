import { describe, expect, it } from 'vitest';

import { emailToSixDigitHash } from './emailToSixDigitHash';

describe('emailToSixDigitHash', () => {
  it('should change email to six digit hash', async () => {
    expect(await emailToSixDigitHash('example@example.com')).toBe('015740');
  });
  it('should change short email to six digit hash', async () => {
    expect(await emailToSixDigitHash('a@a.ie')).toBe('041929');
  });
});
