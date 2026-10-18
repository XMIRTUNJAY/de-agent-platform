const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 320, height: 640 } });
  for (const route of ['/roadmap', '/skills/sql-review', '/taxonomy']) {
    await p.goto('http://127.0.0.1:4321' + route, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(300);
    const bad = await p.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const out = [];
      document.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 && r.width < vw * 3) {
          out.push({ tag: el.tagName, cls: String(el.className).split(' ').slice(0, 2).join('.'), right: Math.round(r.right), w: Math.round(r.width), txt: (el.textContent || '').slice(0, 36) });
        }
      });
      return { sw: document.documentElement.scrollWidth, out: out.slice(0, 6) };
    });
    console.log(route, JSON.stringify(bad, null, 1));
  }
  await b.close();
})();
