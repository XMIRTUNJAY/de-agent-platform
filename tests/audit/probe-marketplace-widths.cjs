const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const out = [];
  for (const width of [1036, 1280, 1440, 768, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto('http://127.0.0.1:4321/marketplace', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const btn = document.querySelector('[data-filter-toggle]');
      const panel = document.getElementById('filters');
      const results = document.getElementById('results');
      const grid = panel?.parentElement;
      return {
        btnDisplay: btn ? getComputedStyle(btn).display : 'n/a',
        panelRect: panel && ((r) => ({ x: Math.round(r.x), w: Math.round(r.width) }))(panel.getBoundingClientRect()),
        resultsW: Math.round(results.getBoundingClientRect().width),
        gridTemplate: getComputedStyle(grid).gridTemplateColumns,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    out.push({ width, ...m });
    await page.screenshot({ path: `test-results/audit/marketplace-${width}-fixed.png` });
    await page.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
