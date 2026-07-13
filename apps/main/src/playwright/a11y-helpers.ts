import AxeBuilder from '@axe-core/playwright';
import { Page } from '@playwright/test';

import { test } from '@src/playwright/testFixtures';

const formatViolations = (violations: any[]) => {
  if (!violations.length) {
    return '✅ No accessibility violations found!';
  }

  return violations
    .map((v) => {
      const nodes = v.nodes.map((n: any) => `    - ${n.html}`).join('\n');
      return `
❌ ${v.id} (${v.help})
Impact: ${v.impact}
Description: ${v.description}
Help: ${v.helpUrl}
Affected Nodes:
${nodes}
      `;
    })
    .join('\n');
};

export const runA11yAudit = async (page: Page) => {
  const results = await new AxeBuilder({ page }).withTags(['wcag2aa', 'wcag21aa']).analyze();
  test.expect(results.violations, formatViolations(results.violations)).toEqual([]);
  await page.getByRole('img', { name: 'moon' }).click(); // switch to dark theme
  await page.waitForTimeout(1000);
  const resultsDarkTheme = await new AxeBuilder({ page })
    .withTags(['wcag2aa', 'wcag21aa'])
    .analyze();
  test
    .expect(resultsDarkTheme.violations, formatViolations(resultsDarkTheme.violations))
    .toEqual([]);
};
