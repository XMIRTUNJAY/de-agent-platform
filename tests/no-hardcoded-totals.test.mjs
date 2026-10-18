import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Brief §D: "Never hard-code totals in page templates." Registry totals change
// with every pipeline run — templates must derive counts, not paste them.

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.astro')) out.push(p);
  }
  return out;
}

describe('no hard-coded registry totals in templates', () => {
  it('templates never paste canonical counts as literal copy', () => {
    const offenders = [];
    for (const file of walk('src/pages').concat(walk('src/components'))) {
      const src = readFileSync(file, 'utf8');
      // digits + unit words in literal text (not inside {expressions})
      const stripped = src.replace(/\{[^}]*\}/g, '');
      for (const m of stripped.matchAll(/\b\d{2,4}\s+(?:canonical\s+)?(categories|stages|resources)\b/gi)) {
        offenders.push(`${file}: ${m[0]}`);
      }
    }
    assert.deepEqual(offenders, []);
  });
});
