import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:4322';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } });
const page = await ctx.newPage();
await page.goto(BASE + '/roadmap', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
const wide = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1) {
      out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 4).join('.')} R=${Math.round(r.right)} w=${Math.round(r.width)} pos=${cs.position} disp=${cs.display} grid=${cs.gridTemplateColumns.slice(0, 40)}`);
    }
    if (out.length >= 14) break;
  }
  return { vw, sw: document.documentElement.scrollWidth, out };
});
console.log(`roadmap mobile vw=${wide.vw} scrollW=${wide.sw}`);
for (const w of wide.out) console.log('  ', w);
await browser.close();
