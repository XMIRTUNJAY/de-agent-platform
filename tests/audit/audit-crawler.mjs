// Design audit crawler — visits representative routes at 4 viewports,
// captures screenshots, console errors, layout metrics, sticky/header/nav
// behavior. Run: node tests/audit/audit-crawler.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.AUDIT_BASE ?? 'http://127.0.0.1:4322';
const OUT = path.join('test-results', 'audit');
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = [
  { path: '/', family: 'home' },
  { path: '/marketplace', family: 'marketplace' },
  { path: '/skills', family: 'listing' },
  { path: '/skills/sql-review', family: 'detail' },
  { path: '/mcp', family: 'listing' },
  { path: '/agents', family: 'listing' },
  { path: '/hooks', family: 'listing' },
  { path: '/plugins', family: 'listing' },
  { path: '/templates', family: 'listing' },
  { path: '/patterns', family: 'listing' },
  { path: '/projects', family: 'listing' },
  { path: '/runbooks', family: 'listing' },
  { path: '/references', family: 'listing' },
  { path: '/tutorials', family: 'listing' },
  { path: '/tutorials/sql-fanout-review', family: 'tutorial-detail' },
  { path: '/roadmap', family: 'roadmap' },
  { path: '/categories', family: 'taxonomy' },
  { path: '/categories/cat-sql', family: 'category' },
  { path: '/taxonomy', family: 'taxonomy' },
  { path: '/search', family: 'search' },
  { path: '/agentic', family: 'agentic' },
  { path: '/resources', family: 'listing' },
  { path: '/admin', family: 'admin' },
  { path: '/admin/queue', family: 'admin' },
  { path: '/admin/health', family: 'admin' },
  { path: '/publisher', family: 'publisher' },
  { path: '/dashboard', family: 'dashboard' },
  { path: '/docs/how-it-works', family: 'docs' },
  { path: '/docs/security', family: 'docs' },
  { path: '/404', family: 'notfound' },
];

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'compact', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
];

const browser = await chromium.launch();
const report = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    const errors = [];
    const failed = [];
    const onConsole = (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); };
    const onFailed = (r) => { if (!r.url().includes('favicon')) failed.push(`${r.status()} ${r.url().slice(0, 120)}`); };
    page.on('console', onConsole);
    page.on('response', (r) => { if (r.status() >= 400) onFailed(r); });
    try {
      const resp = await page.goto(BASE + route.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(900);
      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const header = document.querySelector('header');
        const aside = document.querySelector('aside');
        const main = document.getElementById('main');
        const h1 = document.querySelector('h1');
        const navLinks = [...document.querySelectorAll('header nav a')].map(a => ({
          label: a.textContent?.trim(), href: a.getAttribute('href'),
          hasIcon: !!a.querySelector('svg'),
        }));
        // sticky check: scroll and see if header stays at top
        const headerPosBefore = header ? header.getBoundingClientRect().top : null;
        window.scrollTo(0, 700);
        return new Promise((resolve) => setTimeout(() => {
          const headerPosAfter = header ? header.getBoundingClientRect().top : null;
          const headerStyle = header ? getComputedStyle(header).position : 'none';
          const col = document.querySelector('.col');
          const colRect = col ? col.getBoundingClientRect() : null;
          window.scrollTo(0, 0);
          resolve({
            status: 'ok',
            overflowX: doc.scrollWidth - doc.clientWidth,
            headerSticky: headerStyle,
            headerTopAfterScroll: headerPosAfter,
            headerTopBeforeScroll: headerPosBefore,
            hasAsideFilter: !!aside,
            asideSticky: aside ? getComputedStyle(aside).position : null,
            mainWidth: main ? Math.round(main.getBoundingClientRect().width) : null,
            contentLeft: colRect ? Math.round(colRect.left) : null,
            contentRight: colRect ? Math.round(colRect.right) : null,
            colMaxWidth: col ? getComputedStyle(col).maxWidth : null,
            h1: h1 ? h1.textContent?.trim().slice(0, 60) : null,
            navLinks,
            sidebarPresent: !!document.getElementById('sidebar'),
            title: document.title,
          });
        }, 400));
      });
      const shot = path.join(OUT, `${vp.name}--${route.path.replace(/\//g, '_') || 'home'}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      report.push({ viewport: vp.name, ...route, httpStatus: resp?.status() ?? null, errors, failed, ...metrics });
    } catch (e) {
      report.push({ viewport: vp.name, ...route, status: 'crawl-error', error: String(e).slice(0, 200) });
    }
    page.off('console', onConsole);
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'audit-report.json'), JSON.stringify(report, null, 2));
console.log('pages audited:', report.length);
console.log('report:', path.join(OUT, 'audit-report.json'));
