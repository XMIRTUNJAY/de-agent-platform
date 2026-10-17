const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.goto('http://127.0.0.1:4322/marketplace', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  const typeBox = page.locator('#filters input[name="type"][value="skill"]');
  console.log('checkbox count:', await typeBox.count());
  await typeBox.check();
  await page.waitForTimeout(800);
  console.log('URL after check:', page.url());
  console.log('result-count:', await page.locator('#result-count').textContent());
  console.log('chips:', await page.locator('#active-chips .filter-chip').count());
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
