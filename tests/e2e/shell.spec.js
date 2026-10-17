import { test, expect } from '@playwright/test';

// Design-overhaul shell contract: markdown bodies render as HTML, chips never
// overflow, drawer has icons. See docs/REDESIGN_AUDIT.md P0-1/P0-3.

test('P0-1: resource body renders markdown as HTML, never literal ##', async ({ page }) => {
  await page.goto('/skills/sql-review', { waitUntil: 'domcontentloaded' });
  const prose = page.locator('div.prose-de'); // sections reuse .prose-de; the body is a div
  await expect(prose).toBeVisible();
  const html = await prose.innerHTML();
  expect(html).toMatch(/<h[1-6]/);
  expect(html).not.toContain('## The first question');
  expect(html).not.toContain('**');
});

test('P0-3: roadmap has no horizontal overflow at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/roadmap', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('P0-2: no horizontal overflow at tablet width across shell routes', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  for (const path of ['/', '/marketplace', '/skills', '/skills/sql-review', '/roadmap', '/categories', '/search']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${path} overflows by ${overflow}px at 768px`).toBeLessThanOrEqual(1);
  }
});
