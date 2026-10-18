const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const viewports = [[375, 667], [768, 1024], [1024, 768], [1440, 900]];
  for (const [width, height] of viewports) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${width}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`${width}: PAGEERROR ${e.message}`));
    await page.goto('http://127.0.0.1:4321/', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(`${width}px overflow=${overflow}`);
    await page.screenshot({ path: `test-results/audit/home-${width}-after.png`, fullPage: false });
    await page.close();
  }
  console.log('console errors:', errors.length ? errors : 'none');
  await browser.close();
})();
