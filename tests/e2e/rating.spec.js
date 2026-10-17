import { test, expect } from '@playwright/test';

// Exactly one rating widget per detail page (the old Install & Review block
// is gone), and the full vote round-trip works: POST rate -> stats reflect it.
test('single rating widget + live vote round-trip', async ({ page, request }) => {
  await page.goto('/skills/sql-review', { waitUntil: 'domcontentloaded' });
  const widgets = page.locator('[data-rate-widget]');
  await expect(widgets).toHaveCount(1);
  await expect(widgets.locator('[data-rate-value]')).toHaveCount(5);

  const before = await (await request.get('/api/marketplace/stats?resource_id=skill-sql-review')).json();
  const vote = await request.post('/api/marketplace/rate', {
    data: { resource_id: 'skill-sql-review', rating: 5 },
  });
  expect(vote.ok()).toBeTruthy();
  const receipt = await vote.json();
  expect(receipt.ok).toBe(true);

  const after = await (await request.get('/api/marketplace/stats?resource_id=skill-sql-review')).json();
  // Identity is server-derived (salt|ip|resource): repeat runs UPDATE the same
  // vote rather than adding a row, so assert the round-trip result, not +1.
  expect(after.data.rating_count).toBeGreaterThanOrEqual(1);
  expect(after.data.rating_average).toBeGreaterThan(0);
  expect(after.data.popularity).not.toBeNull();
});
