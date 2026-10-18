import { test, expect } from '@playwright/test';

// Design-overhaul shell contract: markdown bodies render as HTML, chips never
// overflow, drawer has icons. See docs/REDESIGN_AUDIT.md P0-1/P0-3.

test('P0-1: resource body renders markdown as HTML, never literal ##', async ({ page }) => {
  await page.goto('/skills/sql-review', { waitUntil: 'domcontentloaded' });
  const prose = page.locator('div.prose-de'); // sections reuse .prose-de; the body is a div
  await expect(prose).toBeVisible();
  const html = await prose.innerHTML();
  expect(html).toMatch(/<h[1-6]/);
  expect(html).not.toContain('## The first question');
  expect(html).not.toContain('**');
});

test('P0-3: roadmap has no horizontal overflow at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/roadmap', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('P1-2: every mobile drawer item has an icon', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });
  await page.click('[data-sidebar-toggle]');
  await expect(page.locator('#sidebar.open')).toBeVisible();
  const total = await page.locator('#sidebar a').count();
  const withIcon = await page.locator('#sidebar a:has(svg)').count();
  expect(total).toBeGreaterThan(20);
  expect(withIcon).toBe(total);
  await page.keyboard.press('Escape');
  await expect(page.locator('#sidebar.open')).toHaveCount(0);
});

test('P1-1: footer renders on sidebar pages too', async ({ page }) => {
  await page.goto('/skills', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('footer')).toBeVisible();
});

// multi-route sweep + multi-step filter flows exceed the default 30s in dev
test.describe(() => {
  test.setTimeout(90000);

  test('P0-2: no horizontal overflow at tablet width across shell routes', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    for (const path of ['/', '/marketplace', '/skills', '/skills/sql-review', '/roadmap', '/categories', '/search']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} overflows by ${overflow}px at 768px`).toBeLessThanOrEqual(1);
    }
  });

  test('P1-3: marketplace filter state syncs to URL, survives reload + back/forward', async ({ page }) => {
    await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    // mobile project: the filter panel is an off-canvas drawer — open it first
    const toggle = page.locator('[data-filter-toggle]');
    const useDrawer = page.viewportSize().width < 1024;
    if (useDrawer) {
      await toggle.click();
      await expect(page.locator('#filters.open')).toBeVisible();
    }

    const typeBox = page.locator('#filters input[name="type"][value="skill"]');
    await typeBox.check();
    if (useDrawer) await page.keyboard.press('Escape');

    await expect(page).toHaveURL(/marketplace\?type=skill/);
    const count = await page.locator('#result-count').textContent();
    expect(Number.parseInt(count ?? '0', 10)).toBeGreaterThan(0);

    await page.reload({ waitUntil: 'load' });
    await expect(page.locator('#filters input[name="type"][value="skill"]')).toBeChecked();

    if (useDrawer) {
      await toggle.click();
      await expect(page.locator('#filters.open')).toBeVisible();
    }
    const verificationGroup = page.locator('#filters details', { hasText: 'Verification' }).first();
    if (!(await verificationGroup.getAttribute('open'))) await verificationGroup.locator('summary').click();
    await page.locator('#filters input[name="verification"][value="community"]').check();
    await expect(page).toHaveURL(/type=skill&verification=community/);
    if (useDrawer) await page.keyboard.press('Escape');
    await page.goBack();
    await page.waitForLoadState('load');
    await expect(page).toHaveURL(/marketplace\?type=skill/);
    await expect(page.locator('#filters input[name="verification"][value="community"]')).not.toBeChecked();

    if (useDrawer) {
      await toggle.click();
      await expect(page.locator('#filters.open')).toBeVisible();
    }
    await page.locator('[data-filter-clear]').click();
    await expect(page).toHaveURL(/marketplace/);
    const checked = await page.locator('#filters input:checked').count();
    expect(checked).toBe(0);
  });
});

test.describe(() => {
  test.setTimeout(60000);

  test('P1-4: detail prose sits in a centered 72ch measure at 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/skills/sql-review', { waitUntil: 'load' });
    const prose = page.locator('.prose-measure').first();
    await expect(prose).toBeVisible();
    const { width, offset } = await prose.evaluate((el) => {
      const r = el.getBoundingClientRect();
      // center within its grid column (main minus the 320px aside + gap)
      const grid = el.closest('.grid').getBoundingClientRect();
      const aside = el.closest('.grid').querySelector('aside');
      const asideW = aside ? aside.getBoundingClientRect().width + 32 : 0;
      const colLeft = grid.left;
      const colRight = grid.right - asideW;
      return { width: r.width, offset: Math.abs(r.left - colLeft - (colRight - colLeft - r.width) / 2) };
    });
    // 72ch at 16px ≈ 720-780px depending on the font; allow slack
    expect(width).toBeLessThanOrEqual(800);
    expect(offset, `centered within column: offset ${offset}px`).toBeLessThanOrEqual(32);
  });

  test('P1-4: docs body uses a 72ch measure aligned with the hero', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/docs/how-it-works', { waitUntil: 'load' });
    const article = page.locator('article.prose-measure-l');
    await expect(article).toBeVisible();
    const width = await article.evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeLessThanOrEqual(800);
  });
});

// P2 — /categories catalogue contract (brief §7): URL-synced search/filter/sort,
// full catalogue always in static HTML, no hard-coded totals.

test.describe(() => {
  test.setTimeout(90000);

  test('P2-cat: catalogue filters sync to URL and survive reload', async ({ page }) => {
    await page.goto('/categories', { waitUntil: 'load' });

    // full catalogue present regardless of client filtering
    const totalRows = await page.locator('.catalogue-row').count();
    expect(totalRows).toBeGreaterThanOrEqual(35);

    await page.locator('#cat-q').fill('lake');
    await expect(page).toHaveURL(/categories\?q=lake/);
    const visible = await page.locator('.catalogue-row:visible').count();
    expect(visible).toBeGreaterThan(0);
    expect(visible).toBeLessThan(totalRows);

    await page.reload({ waitUntil: 'load' });
    await expect(page.locator('#cat-q')).toHaveValue('lake');
    expect(await page.locator('.catalogue-row:visible').count()).toBeLessThan(totalRows);

    // phase filter combines with q
    await page.locator('#cat-phase').selectOption('4');
    await expect(page).toHaveURL(/q=lake&phase=4/);
    await expect(page.locator('#cat-empty')).toBeVisible();

    // clear restores everything
    await page.locator('#cat-empty-clear').click();
    await expect(page).toHaveURL(/categories/);
    expect(await page.locator('.catalogue-row:visible').count()).toBe(totalRows);

    // back returns to the filtered state
    await page.goBack();
    await expect(page).toHaveURL(/q=lake&phase=4/);
  });

  test('P2-cat: Escape in the search box clears and blurs, no keyboard trap', async ({ page }) => {
    await page.goto('/categories?q=sql', { waitUntil: 'load' });
    const q = page.locator('#cat-q');
    await q.focus();
    await page.keyboard.press('Escape');
    await expect(q).toHaveValue('');
    await expect(page).toHaveURL(/categories\/?.*$/);
    const visible = await page.locator('.catalogue-row:visible').count();
    expect(visible).toBeGreaterThanOrEqual(35);
  });

  test('P2-cat: stage sections link to roadmap anchors that exist', async ({ page }) => {
    await page.goto('/categories', { waitUntil: 'load' });
    const hrefs = await page.locator('.stage-group a[href^="/roadmap#"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThanOrEqual(13);
    const unique = [...new Set(hrefs)];
    expect(unique.length).toBeGreaterThanOrEqual(13);
    for (const href of unique) expect(href, 'well-formed stage anchor').toMatch(/^\/roadmap#[a-z0-9-]+$/);
    // targets exist on the roadmap page
    await page.goto('/roadmap', { waitUntil: 'load' });
    for (const href of unique) {
      const id = href.split('#')[1];
      expect(await page.locator(`#${id}`).count(), href).toBeGreaterThan(0);
    }
  });
});

test('P2-tax: taxonomy tables render derived structure', async ({ page }) => {
  await page.goto('/taxonomy', { waitUntil: 'load' });
  await expect(page.locator('h1')).toContainText('taxonomy');
  const catRows = await page.locator('table tbody tr a[href^="/categories/"]').count();
  expect(catRows).toBeGreaterThanOrEqual(35);
  const techRows = await page.locator('table tbody tr[id]').count();
  expect(techRows).toBeGreaterThanOrEqual(25);
});

test('P3-shell: detail pages show breadcrumbs with a category link', async ({ page }) => {
  await page.goto('/skills/sql-review', { waitUntil: 'load' });
  const crumbs = page.locator('nav[aria-label="Breadcrumb"] a, nav[aria-label="Breadcrumb"] [aria-current]');
  await expect(crumbs.first()).toBeVisible();
  const hrefs = await page.locator('nav[aria-label="Breadcrumb"] a').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  expect(hrefs.some((h) => (h ?? '').startsWith('/categories/'))).toBe(true);
});

test('P3-shell: kbd hint is platform-aware (Ctrl on Windows)', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  await expect(page.locator('kbd[data-platform-hint]')).toHaveText(/Ctrl|⌘/);
});

test('P3-shell: reduced-motion users get no reveal transforms', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/taxonomy', { waitUntil: 'load' });
  const duration = await page.locator('.reveal').first().evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(duration === '0s' || duration === '0.01ms' || duration === '').toBe(true);
});

test('P2-road: roadmap journey rail links to phase anchors that exist', async ({ page }) => {
  await page.goto('/roadmap', { waitUntil: 'load' });
  const railLinks = page.locator('.phase-rail a[href^="#phase-"]');
  expect(await railLinks.count()).toBe(4);
  for (let i = 1; i <= 4; i++) {
    expect(await page.locator(`#phase-${i}`).count()).toBe(1);
  }
  // outcomes chips render (data-backed, no fabricated prerequisites)
  expect(await page.locator('text=You can, after this stage').count()).toBeGreaterThan(10);
  // all 13 stage anchors still resolve
  const stageLinks = await page.locator('.chapter-stage[href^="#"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  expect(new Set(stageLinks).size).toBeGreaterThanOrEqual(13);
});

test('P2-tut: tutorials distinguish editorial walkthroughs from practicum', async ({ page }) => {
  await page.goto('/tutorials', { waitUntil: 'load' });
  await expect(page.locator('h1')).toContainText('tutorials');
  // derived totals rendered (no hardcoded counts)
  const chips = await page.locator('main .chip').allTextContents();
  expect(chips.some((c) => /entries/.test(c))).toBe(true);
  expect(chips.some((c) => /learning objectives/.test(c))).toBe(true);
});

test('P2-guide: guides index derives from markdown frontmatter', async ({ page }) => {
  await page.goto('/guides', { waitUntil: 'load' });
  const links = await page.locator('a[href^="/guides/"]:not([href="/guides"])').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  expect(links.length).toBeGreaterThanOrEqual(4);
  // every linked guide page exists
  for (const href of [...new Set(links)]) {
    const res = await page.request.get(href);
    expect(res.status(), href).toBe(200);
  }
});

test('P2-list: type listings show derived, differentiated hero stats', async ({ page }) => {
  await page.goto('/skills', { waitUntil: 'load' });
  const skillsChips = await page.locator('main .chip').allTextContents();
  expect(skillsChips.some((c) => /avg composite/.test(c))).toBe(true);
  expect(skillsChips.some((c) => /entries/.test(c))).toBe(true);

  await page.goto('/references', { waitUntil: 'load' });
  const refChips = await page.locator('main .chip').allTextContents();
  // different type, different derived numbers — pages are not clones
  expect(refChips.join(' ')).not.toBe(skillsChips.join(' '));
});

test('P2-op: runbooks show severity with icon + text, symptoms section', async ({ page }) => {
  await page.goto('/runbooks', { waitUntil: 'load' });
  const runbookHref = page.locator('a[href^="/runbooks/"]').first();
  const href = await runbookHref.getAttribute('href');
  await page.goto(href, { waitUntil: 'load' });
  const sev = page.locator('.severity-chip');
  await expect(sev).toBeVisible();
  const text = (await sev.textContent()) ?? '';
  expect(text).toMatch(/severity:\s*(critical|high|medium|low)/);
  expect(await sev.locator('svg').count()).toBe(1);
  await expect(page.locator('h2', { hasText: 'Symptoms' })).toBeVisible();
});

test('P2-op: architecture patterns render the canvas diagram', async ({ page }) => {
  await page.goto('/patterns', { waitUntil: 'load' });
  const href = await page.locator('a[href^="/patterns/"]').first().getAttribute('href');
  await page.goto(href, { waitUntil: 'load' });
  const svg = page.locator('svg[aria-labelledby^="arch-title"]');
  await expect(svg).toBeVisible();
});
