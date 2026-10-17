import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TOP_NAV, SIDEBAR, NAV_SECTION_MAP } from '../src/site.config.ts';

// Audit P1-2: every nav destination keeps an icon so short screens and the
// mobile drawer preserve recognition. Audit P2: detail routes resolve to a
// section so the header never goes contextless.

describe('nav model', () => {
  it('every TOP_NAV item has a label, href and icon', () => {
    for (const item of TOP_NAV) {
      assert.ok(item.label, 'missing label');
      assert.match(item.href, /^\//, `${item.label}: href must be root-absolute`);
      assert.ok(item.icon, `${item.label}: missing icon`);
    }
  });

  it('every SIDEBAR item has an icon', () => {
    for (const group of SIDEBAR) {
      for (const item of group.items) {
        assert.ok(item.icon, `${group.title} > ${item.label}: missing icon`);
      }
    }
  });

  it('NAV_SECTION_MAP resolves detail routes to their owning section', () => {
    const resolve = (path) => NAV_SECTION_MAP.find(([prefix]) => path.startsWith(prefix))?.[1];
    assert.equal(resolve('/skills/sql-review'), '/marketplace');
    assert.equal(resolve('/tutorials/sql-fanout-review'), '/tutorials');
    assert.equal(resolve('/categories/sql'), '/categories');
    assert.equal(resolve('/docs/security'), '/docs');
    // every resolved href is a real TOP_NAV destination
    const hrefs = new Set(TOP_NAV.map((t) => t.href));
    for (const [, href] of NAV_SECTION_MAP) {
      assert.ok(hrefs.has(href), `section map target ${href} is not in TOP_NAV`);
    }
  });
});
