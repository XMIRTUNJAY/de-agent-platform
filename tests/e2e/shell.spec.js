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

test('P1-2: every mobile drawer item has an icon', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });
  await page.click('[data-sidebar-toggle]');
  await expect(page.locator('#sidebar.open')).toBeVisible();
  const total = await page.locator('#sidebar a').count();
  const withIcon = await page.locator('#sidebar a:has(svg)').count();
  expect(total).toBeGreaterThan(20);
  expect(withIcon).toBe(total);
  await page.keyboard.press('Escape');
  await expect(page.locator('#sidebar.open')).toHaveCount(0);
});

test('P1-1: footer renders on sidebar pages too', async ({ page }) => {
  await page.goto('/skills', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('footer')).toBeVisible();
});

// multi-route sweep + multi-step filter flows exceed the default 30s in dev
test.describe(() => {
  test.setTimeout(90000);

  test('P0-2: no horizontal overflow at tablet width across shell routes', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    for (const path of ['/', '/marketplace', '/skills', '/skills/sql-review', '/roadmap', '/categories', '/search']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} overflows by ${overflow}px at 768px`).toBeLessThanOrEqual(1);
    }
  });

  test('P1-3: marketplace filter state syncs to URL, survives reload + back/forward', async ({ page }) => {
    await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    // mobile project: the filter panel is an off-canvas drawer — open it first
    const toggle = page.locator('[data-filter-toggle]');
    const useDrawer = page.viewportSize().width < 1024;
    if (useDrawer) {
      await toggle.click();
      await expect(page.locator('#filters.open')).toBeVisible();
    }

    const typeBox = page.locator('#filters input[name="type"][value="skill"]');
    await typeBox.check();
    if (useDrawer) await page.keyboard.press('Escape');

    await expect(page).toHaveURL(/marketplace\?type=skill/);
    const count = await page.locator('#result-count').textContent();
    expect(Number.parseInt(count ?? '0', 10)).toBeGreaterThan(0);

    await page.reload({ waitUntil: 'load' });
    await expect(page.locator('#filters input[name="type"][value="skill"]')).toBeChecked();

    if (useDrawer) {
      await toggle.click();
      await expect(page.locator('#filters.open')).toBeVisible();
    }
    const verificationGroup = page.locator('#filters details', { hasText: 'Verification' }).first();
    if (!(await verificationGroup.getAttribute('open'))) await verificationGroup.locator('summary').click();
    await page.locator('#filters input[name="verification"][value="community"]').check();
    await expect(page).toHaveURL(/type=skill&verification=community/);
    if (useDrawer) await page.keyboard.press('Escape');
    await page.goBack();
    await page.waitForLoadState('load');
    await expect(page).toHaveURL(/marketplace\?type=skill/);
    await expect(page.locator('#filters input[name="verification"][value="community"]')).not.toBeChecked();

    if (useDrawer) {
      await toggle.click();
      await expect(page.locator('#filters.open')).toBeVisible();
    }
    await page.locator('[data-filter-clear]').click();
    await expect(page).toHaveURL(/marketplace/);
    const checked = await page.locator('#filters input:checked').count();
    expect(checked).toBe(0);
  });
});
