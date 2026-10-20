const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const routes = [
    ['/learn/', 2, 'Every topic'],
    ['/learn/spark/', 6, 'Compare the registry'],
    ['/stages/foundations/', 4, 'Exit gate'],
    ['/compare/data-quality/', 4, 'Side by side'],
    ['/sources/confluent/', 4, 'Contribution to the registry'],
    ['/learn-path/sql/', 3, 'guided path'],
  ];
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  for (const [route, minSections, marker] of routes) {
    const resp = await p.goto('http://127.0.0.1:4321' + route, { waitUntil: 'domcontentloaded' }).catch(() => null);
    const html = resp ? await p.content() : '';
    const sections = (html.match(/<h2/g) || []).length;
    const ok = resp && resp.status() === 200 && sections >= minSections && html.includes(marker);
    console.log(route, resp ? resp.status() : 'FAIL', '| sections:', sections, '| marker:', html.includes(marker), ok ? 'OK' : '<<< PROBLEM');
  }
  // sitemap coverage of new families
  const sm = await p.goto('http://127.0.0.1:4321/sitemap-0.xml', { waitUntil: 'domcontentloaded' });
  const xml = await p.content();
  for (const probe of ['/learn/spark', '/stages/foundations', '/compare/', '/sources/confluent', '/learn-path/']) {
    console.log('sitemap', probe, xml.includes(probe) ? 'INCLUDED' : 'MISSING <<<');
  }
  console.log('console errors:', errors.length);
  await b.close();
})();
