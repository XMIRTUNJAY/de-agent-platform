const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 320, height: 640 } });
  await p.goto('http://127.0.0.1:4321/skills/sql-review', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(300);
  const chain = await p.evaluate(() => {
    const sec = document.querySelector('section.prose-measure');
    const out = [];
    let el = sec;
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      out.push({ tag: el.tagName, cls: String(el.className).split(' ').slice(0, 3).join('.'), w: Math.round(el.getBoundingClientRect().width), disp: cs.display, minw: cs.minWidth, gridCols: cs.gridTemplateColumns.split(' ').slice(0, 3).join(' ') });
      el = el.parentElement;
    }
    // widest min-content contributor inside the section
    let widest = null;
    sec.querySelectorAll('*').forEach((c) => {
      const w = c.scrollWidth;
      if (!widest || w > widest.w) widest = { tag: c.tagName, cls: String(c.className).split(' ').slice(0, 2).join('.'), w, sw: c.scrollWidth };
    });
    return { chain: out, widest };
  });
  console.log(JSON.stringify(chain, null, 1));
  await b.close();
})();
