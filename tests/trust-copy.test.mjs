import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Brief §I/§D: trust vocabulary is fixed (community/reviewed/tested/verified)
// and evidence is never fabricated. New marketing-ish pages must not invent
// verification claims the registry does not back.

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(astro|tsx|html)$/.test(p)) out.push(p);
  }
  return out;
}

const BANNED = [
  /independently verified/i,
  /independently audited/i,
  /\baudited\b/i,
  /secure by default/i,
  /enterprise-grade/i,
  /certified/i,
  /guaranteed\b/i,
];

describe('no fabricated trust claims in templates', () => {
  it('pages/components never claim more than the verification policy backs', () => {
    const offenders = [];
    for (const file of walk('src/pages').concat(walk('src/components'))) {
      const src = readFileSync(file, 'utf8');
      // strip JS/TS expressions, HTML comments AND CSS comments — only
      // user-facing text is gated
      const stripped = src
        .replace(/\{[^}]*\}/g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      for (const re of BANNED) {
        const m = stripped.match(re);
        if (m) offenders.push(`${file}: ${m[0]}`);
      }
    }
    assert.deepEqual(offenders, []);
  });
});
