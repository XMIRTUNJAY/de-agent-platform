import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:4322';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE + '/skills/sql-review', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
const res = await page.evaluate(async () => {
  const sb = document.getElementById('sidebar');
  const before = sb ? { top: Math.round(sb.getBoundingClientRect().top), pos: getComputedStyle(sb).position, h: Math.round(sb.getBoundingClientRect().height) } : null;
  window.scrollTo(0, 1500);
  await new Promise(r => setTimeout(r, 500));
  const after = sb ? { top: Math.round(sb.getBoundingClientRect().top), pos: getComputedStyle(sb).position } : null;
  // header
  const header = document.querySelector('header');
  const hTop = header ? Math.round(header.getBoundingClientRect().top) : null;
  // main column
  const col = document.querySelector('.col');
  const colR = col ? col.getBoundingClientRect() : null;
  const main = document.getElementById('main');
  return { before, after, headerTop: hTop, col: colR ? { l: Math.round(colR.left), r: Math.round(colR.right), w: Math.round(colR.width) } : null, mainW: main ? Math.round(main.getBoundingClientRect().width) : null };
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
