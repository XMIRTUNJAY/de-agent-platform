import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const snapshot = (dir) => new Set(readdirSync(dir));

describe('creation queue', () => {
  it('emits needs-original briefs exactly for stages without step sources', () => {
    // Drafts dirs are committed review queue: clean up anything this run creates.
    const beforeT = snapshot(join(ROOT, 'data', 'drafts', 'tutorials'));
    const beforeC = snapshot(join(ROOT, 'data', 'drafts', 'creation'));
    try {
      const out = execFileSync(process.execPath,
        [join(ROOT, 'pipelines', 'generate-tutorial-briefs.mjs')],
        { cwd: ROOT, timeout: 60000 }).toString();
      assert.match(out, /needs-original: 3/);
      const files = readdirSync(join(ROOT, 'data', 'drafts', 'creation'));
      // Date-robust: today’s run adds files dated today; committed history stays.
      const today = new Date().toISOString().slice(0, 10);
      const fresh = files.filter((f) => f.startsWith(today));
      assert.equal(fresh.length, 3);
      for (const f of fresh) assert.match(f, /\.md$/);
      for (const stage of ['foundations', 'system-design', 'agentic']) {
        assert.ok(fresh.some((f) => f.endsWith(`-${stage}.md`), `missing brief for ${stage}`));
      }
    } finally {
      for (const [dir, before] of [[join(ROOT, 'data', 'drafts', 'tutorials'), beforeT], [join(ROOT, 'data', 'drafts', 'creation'), beforeC]]) {
        for (const f of readdirSync(dir)) {
          if (!before.has(f)) rmSync(join(dir, f));
        }
      }
    }
  });
});
