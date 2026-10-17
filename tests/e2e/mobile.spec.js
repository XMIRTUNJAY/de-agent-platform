import { test, expect } from '@playwright/test';

// Mobile smoke: page renders, main nav reachable, no horizontal overflow.
test('mobile home renders without overflow', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
