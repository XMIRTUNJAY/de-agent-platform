import { test, expect } from '@playwright/test';

// Roadmap honesty, rendered: substance counts with correct plurals, upcoming
// gap chips, and no cards leading to empty category pages.
test('roadmap counts, gaps, and no dead-end cards', async ({ page }) => {
  await page.goto('/roadmap', { waitUntil: 'domcontentloaded' });
  const text = await page.locator('main').innerText();

  expect(text).not.toMatch(/\b[01] resources\b/);
  expect(text).toMatch(/guides & tools/);
  // Upcoming chips render for gap stages but link nowhere (intentions, not pages).
  const upcoming = page.locator('text=upcoming:');
  expect(await upcoming.count()).toBeGreaterThan(0);

  // Every category card must lead somewhere non-empty: no card text claims 0.
  const cards = page.locator('a.card');
  const n = await cards.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const cardText = await cards.nth(i).innerText();
    expect(cardText).not.toMatch(/^0 /m);
  }
});
