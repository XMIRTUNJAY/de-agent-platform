// Gap sweep against the brief's named routes + widths + 404 + breadcrumbs.
const { chromium } = require('@playwright/test');
const http = require('http');

const NAMED = [
  '/', '/marketplace', '/roadmap', '/projects', '/runbooks',
  '/skills', '/mcp', '/agents', '/hooks', '/plugins', '/templates', '/references',
  '/tutorials', '/guides', '/patterns', '/taxonomy',
  '/docs/content-model', '/docs/scoring', '/docs/security',
  '/docs/ingestion', '/docs/relationships', '/docs/monetization', '/docs/measurement', '/docs/maintenance',
  '/docs/verification', '/curation', '/review-queue', '/registry-health', '/introduction',
  '/capabilities', '/docs/skill-anatomy', '/docs/tool-contract', '/agents/incident-assistant',
];

const up = () => new Promise((res) => {
  http.get('http://127.0.0.1:4321/', (r) => res(r.statusCode === 200)).on('error', () => res(false));
});

(async () => {
  if (!(await up())) { console.log('DEV SERVER DOWN'); process.exit(2); }
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });

  // 1. named routes exist
  const missing = [];
  for (const route of NAMED) {
    const resp = await p.goto('http://127.0.0.1:4321' + route, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null);
    if (!resp || resp.status() !== 200) missing.push(route);
  }
  console.log('missing named routes:', JSON.stringify(missing));

  // 2. 404 page quality
  const nf = await p.goto('http://127.0.0.1:4321/definitely-not-a-page', { waitUntil: 'domcontentloaded' });
  const nfTitle = await p.title();
  const nfHasNav = await p.locator('[data-sidebar-toggle]').count();
  const nfHasHome = await p.locator('a[href="/"]').count();
  console.log('404:', nf.status(), '| title:', nfTitle.slice(0, 50), '| toggle:', nfHasNav, '| home-link:', nfHasHome);

  // 3. resource-detail breadcrumbs
  await p.goto('http://127.0.0.1:4321/skills/sql-review', { waitUntil: 'domcontentloaded' });
  const crumb = await p.locator('nav[aria-label*="readcrumb"], .breadcrumb, [data-breadcrumbs]').count();
  console.log('detail breadcrumbs:', crumb);

  // 4. 320px overflow across key routes
  await p.setViewportSize({ width: 320, height: 640 });
  const overflow320 = [];
  for (const route of ['/', '/marketplace', '/roadmap', '/runbooks', '/skills/sql-review', '/taxonomy']) {
    await p.goto('http://127.0.0.1:4321' + route, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(300);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    const vw = await p.evaluate(() => document.documentElement.clientWidth);
    if (sw > vw + 1) overflow320.push({ route, sw, vw });
  }
  console.log('320px overflow:', JSON.stringify(overflow320));

  // 5. palette highlight/category state
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto('http://127.0.0.1:4321/marketplace', { waitUntil: 'domcontentloaded' });
  await p.click('[data-cmd-palette-open]');
  await p.fill('.cmd-input', 'sql');
  await p.waitForTimeout(400);
  const hasMark = await p.locator('.cmd-item mark, .cmd-item .cmd-hl').count();
  const itemHtml = await p.locator('.cmd-item').first().innerHTML().catch(() => 'NO RESULTS');
  console.log('palette <mark> highlight count:', hasMark);
  console.log('palette item sample:', itemHtml.slice(0, 160));

  await b.close();
})();
