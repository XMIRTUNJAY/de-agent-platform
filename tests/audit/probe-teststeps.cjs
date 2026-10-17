const { chromium, devices } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4322' });
  const page = await ctx.newPage();
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) console.log('NAV:', f.url()); });
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text()); });

  console.log('step: goto');
  await page.goto('/marketplace', { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('step: goto done');

  const toggle = page.locator('[data-filter-toggle]');
  console.log('toggle visible:', await toggle.isVisible());
  const typeBox = page.locator('#filters input[name="type"][value="skill"]');
  console.log('typeBox count:', await typeBox.count());
  console.log('step: check (10s timeout, force off)');
  await typeBox.check({ timeout: 10000 });
  console.log('step: check done, URL =', page.url());

  await browser.close();
})().catch((e) => { console.error('FAILED:', e.message.split('\n')[0]); process.exit(1); });
