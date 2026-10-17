import { test, expect } from '@playwright/test';

// Every key page must load with zero console errors. Catches broken inline
// scripts (the old import.meta / non-null-assertion class of bug) at CI time.
const PAGES = ['/', '/roadmap', '/marketplace', '/skills', '/tutorials', '/skills/sql-review', '/tutorials/sql-fanout-review'];

for (const path of PAGES) {
  test(`no console errors: ${path}`, async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    // Let hydrating widgets (rating, analytics) fire their fetches.
    await page.waitForTimeout(1500);
    expect(errors, `${path} console errors`).toEqual([]);
  });
}
