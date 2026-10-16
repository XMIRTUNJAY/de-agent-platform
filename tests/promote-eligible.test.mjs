import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROBE_DIR = join(ROOT, 'data', 'drafts', 'test-probe');

const SHORT_DRAFT = `# DRAFT probe
- id: ext-probe-short
  slug: probe-short
  type: skill
  title: Probe Short
  description: Far too short to publish.
  category: cat-sql
  url: https://example.com/probe
  source_url: https://example.com/probe
  license: MIT
  verification: community
  version: 0.0.1
  last_verified: 2026-10-16
  curation_state: draft
  draft_kind: extract
  executables: false
`;

describe('promote-eligible', () => {
  before(() => { mkdirSync(PROBE_DIR, { recursive: true }); });
  after(() => { rmSync(PROBE_DIR, { recursive: true, force: true }); });

  it('short drafts stay drafts with reasons, nothing published', () => {
    writeFileSync(join(PROBE_DIR, 'probe.yaml'), SHORT_DRAFT, 'utf8');
    const out = execFileSync(process.execPath,
      [join(ROOT, 'pipelines', 'promote-eligible.mjs'), '--dry', '--limit', '5'],
      { cwd: ROOT, timeout: 60000 }).toString();
    assert.match(out, /stayed draft: 1/);
    assert.equal(existsSync(join(ROOT, 'data', 'curated', 'skills', 'promoted-probe-short.yaml')), false);
    rmSync(join(PROBE_DIR, 'probe.yaml'));
  });
});
