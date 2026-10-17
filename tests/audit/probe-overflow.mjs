import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:4322';
const browser = await chromium.launch();

async function probe(name, vp, path, selector) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const wide = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    for (const el of document.querySelectorAll('*')) {
      if (el.closest('aside#nope')) continue;
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') continue; // fixed doesn't create scroll
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) {
        out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0,3).join('.')} L=${Math.round(r.left)} R=${Math.round(r.right)} w=${Math.round(r.width)} pos=${cs.position}`);
      }
      if (out.length >= 10) break;
    }
    return { vw, sw: document.documentElement.scrollWidth, out };
  });
  console.log(`--- ${name} vw=${wide.vw} scrollW=${wide.sw}`);
  for (const w of wide.out) console.log('   ', w);
  await ctx.close();
}

await probe('tablet home', { width: 768, height: 1024 }, '/', 'body');
await probe('tablet marketplace', { width: 768, height: 1024 }, '/marketplace', 'body');
await probe('mobile roadmap', { width: 375, height: 667 }, '/roadmap', 'body');
await probe('mobile category', { width: 375, height: 667 }, '/categories/sql', 'body');
await browser.close();
