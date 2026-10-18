const { chromium } = require('@playwright/test');

function lum(rgb) {
  const m = rgb.match(/[\d.]+/g) || ['0', '0', '0'];
  const [r, g, b] = m.slice(0, 3).map(Number);
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(fg, bg) {
  const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript((t) => localStorage.setItem('de-theme', t), theme);
    await page.goto('http://127.0.0.1:4321/marketplace', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      // effective background: walk up until a non-transparent bg is found
      const effBg = (el) => {
        let node = el;
        while (node && node !== document.documentElement) {
          const bg = getComputedStyle(node).backgroundColor;
          const a = bg.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/);
          if (a && (a[4] === undefined || Number(a[4]) > 0.85)) return bg;
          node = node.parentElement;
        }
        return getComputedStyle(document.body).backgroundColor;
      };
      const card = document.querySelector('.card');
      const desc = document.querySelector('.card-desc');
      const label = document.querySelector('.mono-label');
      const title = document.querySelector('.card h3');
      const pair = (el) => (el ? { fg: getComputedStyle(el).color, bg: effBg(el) } : null);
      return {
        body: { fg: getComputedStyle(document.body).color, bg: effBg(document.body) },
        title: pair(title),
        muted: pair(desc),
        dim: pair(label),
      };
    });
    const scores = {
      theme,
      fg_vs_shell: +ratio(m.body.fg, m.body.bg).toFixed(2),
      title_vs_card: m.title ? +ratio(m.title.fg, m.title.bg).toFixed(2) : null,
      muted_vs_card: m.muted ? +ratio(m.muted.fg, m.muted.bg).toFixed(2) : null,
      dim_vs_card: m.dim ? +ratio(m.dim.fg, m.dim.bg).toFixed(2) : null,
    };
    results.push(scores);
    await page.close();
  }
  console.log(JSON.stringify(results, null, 1));
  await browser.close();
})();
