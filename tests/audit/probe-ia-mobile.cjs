const { chromium, devices } = require('@playwright/test');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ ...devices['Pixel 7'] });
  await p.goto('http://127.0.0.1:4321/runbooks', { waitUntil: 'load' });
  const r = await p.evaluate(() => {
    const links = [...document.querySelectorAll('a[href="/agents/incident-assistant"]')];
    return links.map((l) => ({
      visible: !!(l.offsetWidth || l.offsetHeight),
      inHidden: l.closest('[hidden]') !== null,
      display: getComputedStyle(l).display,
      html: l.outerHTML.slice(0, 100),
    }));
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
