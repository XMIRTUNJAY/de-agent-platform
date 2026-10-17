import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:4322';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } });
const page = await ctx.newPage();
await page.goto(BASE + '/skills/sql-review', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(700);
await page.click('[data-sidebar-toggle]');
await page.waitForTimeout(600);
const state = await page.evaluate(() => {
  const sb = document.getElementById('sidebar');
  const scrim = document.getElementById('sidebar-scrim');
  const items = [...(sb?.querySelectorAll('a, span') ?? [])].slice(0, 40).map(el => ({
    text: el.textContent?.trim().slice(0, 24),
    hasIcon: !!el.querySelector('svg'),
  }));
  return {
    open: sb?.classList.contains('open'),
    sbRect: sb ? { l: Math.round(sb.getBoundingClientRect().left), r: Math.round(sb.getBoundingClientRect().right) } : null,
    scrimVisible: scrim?.classList.contains('visible'),
    itemCount: items.length,
    anyIcons: items.some(i => i.hasIcon),
    sample: items.slice(0, 6),
  };
});
console.log(JSON.stringify(state, null, 1));
await page.screenshot({ path: 'test-results/audit/drawer-open-mobile.png' });
await browser.close();
