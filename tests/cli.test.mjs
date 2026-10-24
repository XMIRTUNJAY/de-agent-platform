// CLI end-to-end: spawn bin/de-agent.mjs exactly as npm users would.
// Covers argv parsing, exit codes, dry-run vs real install, the
// refuse-non-SKILL.md guard, and the all-agents matrix — the pre-publish
// dress rehearsal for `npx de-agent-platform add <slug>`.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(ROOT, 'bin', 'de-agent.mjs');

const GOOD_SKILL_MD = `---
name: test-skill
description: Fixture skill for CLI tests.
---

# Test skill

Body.`;

let server, baseUrl;

before(async () => {
  server = createServer((req, res) => {
    if (req.url === '/skills/test-skill/SKILL.md') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(GOOD_SKILL_MD);
    } else if (req.url === '/skills/html-trap/SKILL.md') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><p>not a skill</p>');
    } else {
      res.writeHead(404);
      res.end('not found');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((r) => server.close(r)));

function run(args, cwd = ROOT) {
  return exec(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
}

describe('de-agent CLI', () => {
  test('--help prints usage on stdout and exits 0', async () => {
    const { stdout } = await run(['--help']);
    assert.match(stdout, /Usage: de-agent add/);
  });

  test('no command prints usage on stderr and exits 2', async () => {
    await assert.rejects(
      () => run([]),
      (e) => e.code === 2 && /Usage: de-agent add/.test(e.stderr ?? ''),
    );
  });

  test('unknown command prints the mistake on stderr and exits 2', async () => {
    await assert.rejects(
      () => run(['install', 'x']),
      (e) => e.code === 2 && /unknown command "install"/.test(e.stderr ?? ''),
    );
  });

  test('unknown agent exits 2 with a loud error', async () => {
    await assert.rejects(
      () => run(['add', 'test-skill', '--agent', 'not-a-cli', '--source', baseUrl]),
      (e) => e.code === 2 && /unknown agent/.test(e.stderr ?? ''),
    );
  });

  test('dry-run writes nothing and reports the plan', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'deagent-cli-'));
    try {
      const { stdout } = await run(['add', 'test-skill', '--agent', 'claude-code', '--dry-run', '--source', baseUrl], cwd);
      assert.match(stdout, /would write/);
      const dest = join(cwd, '.claude', 'skills', 'test-skill', 'SKILL.md');
      assert.equal(existsSync(dest), false, 'dry-run must not create files');
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });

  test('real install lands SKILL.md with frontmatter', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'deagent-cli-'));
    try {
      const { stdout } = await run(['add', 'test-skill', '--agent', 'claude-code', '--source', baseUrl], cwd);
      assert.match(stdout, /installed/);
      const dest = join(cwd, '.claude', 'skills', 'test-skill', 'SKILL.md');
      assert.ok(existsSync(dest), 'file installed');
      assert.ok(readFileSync(dest, 'utf8').startsWith('---'));
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });

  test('refuses non-SKILL.md payloads (never plants arbitrary files)', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'deagent-cli-'));
    try {
      await assert.rejects(
        () => run(['add', 'html-trap', '--agent', 'claude-code', '--source', baseUrl], cwd),
        (e) => e.code === 1 && /refusing to install/.test(e.stderr ?? ''),
      );
      assert.equal(existsSync(join(cwd, '.claude', 'skills', 'html-trap')), false);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });

  test('missing slug exits 1 with a clear message', async () => {
    await assert.rejects(
      () => run(['add', 'no-such-skill', '--source', baseUrl]),
      (e) => e.code === 1 && /not found/.test(e.stderr ?? ''),
    );
  });

  test('--agent all plans every agent; hermes is guidance-only', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'deagent-cli-'));
    try {
      const { stdout } = await run(['add', 'test-skill', '--agent', 'all', '--dry-run', '--source', baseUrl], cwd);
      for (const a of ['opencode', 'claude-code', 'codex', 'cursor', 'amp', 'gemini-cli', 'antigravity']) {
        assert.match(stdout, new RegExp(`- ${a}:`), `missing ${a} line`);
      }
      assert.match(stdout, /hermes: skipped/);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });
});
