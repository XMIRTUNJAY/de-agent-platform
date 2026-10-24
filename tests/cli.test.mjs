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
    const json = (body) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.url === '/skills/test-skill/SKILL.md') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(GOOD_SKILL_MD);
    } else if (req.url === '/skills/html-trap/SKILL.md') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><p>not a skill</p>');
    } else if (req.url === '/records/mcp/mcpx.json') {
      json({ id: 'mcp-mcpx', slug: 'mcpx', type: 'mcp', title: 'MCPX', server: { name: 'mcp-server-mcpx', publisher: 'Test' }, transport: 'stdio', tools: ['a', 'b'], install_command: 'uvx mcp-server-mcpx --db-path /d.duckdb', url: '/mcp/mcpx/' });
    } else if (req.url === '/records/hook/guardx.json') {
      json({ id: 'hook-guardx', slug: 'guardx', type: 'hook', title: 'GuardX', trigger: 'on-tool-call', implementation: 'Deny destructive SQL without WHERE.', failure_behavior: 'block', url: '/hooks/guardx/' });
    } else if (req.url === '/records/starter/newproj.json') {
      json({ id: 'starter-newproj', slug: 'newproj', type: 'starter', title: 'NewProj', repo_structure: 'newproj/\n  models/staging/\n  models/marts/\n', architecture: 'raw ─▶ stg ─▶ marts', url: '/projects/newproj/' });
    } else if (req.url === '/records/plugin/ampx.json') {
      json({ id: 'plugin-ampx', slug: 'ampx', type: 'plugin', title: 'AmpX', install_command: 'amp plugin add de-agent/ampx', url: '/plugins/ampx/' });
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
    assert.match(stdout, /de-agent add <slug>/);
  });

  test('no command prints usage on stderr and exits 2', async () => {
    await assert.rejects(
      () => run([]),
      (e) => e.code === 2 && /de-agent add <slug>/.test(e.stderr ?? ''),
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
      (e) => e.code === 1 && /not found|no skill or installable record found/.test(e.stderr ?? ''),
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

  test('mcp command prints per-agent configs derived from the record', async () => {
    const { stdout } = await run(['mcp', 'mcpx', '--agent', 'claude-code', '--source', baseUrl]);
    assert.match(stdout, /claude mcp add mcp-server-mcpx -- uvx mcp-server-mcpx --db-path \/d\.duckdb/);
    const { stdout: jsonOut } = await run(['mcp', 'mcpx', '--agent', 'cursor', '--source', baseUrl]);
    assert.match(jsonOut, /"mcpServers"/);
    assert.match(jsonOut, /"command": "uvx"/);
  });

  test('add on a hook writes a wiring card (no invented code)', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'deagent-cli-'));
    try {
      const { stdout } = await run(['add', 'guardx', '--source', baseUrl], cwd);
      assert.match(stdout, /installed .*HOOK\.md/);
      const card = readFileSync(join(cwd, '.agents', 'hooks', 'guardx', 'HOOK.md'), 'utf8');
      assert.match(card, /Deny destructive SQL without WHERE\./);
      assert.match(card, /failure behavior: block/);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });

  test('new scaffolds a starter from repo_structure + ARCHITECTURE.md', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'deagent-cli-'));
    try {
      const { stdout } = await run(['new', 'newproj', '--source', baseUrl], cwd);
      assert.match(stdout, /scaffolded newproj\//);
      assert.ok(existsSync(join(cwd, 'newproj', 'models', 'staging')));
      assert.ok(existsSync(join(cwd, 'newproj', 'models', 'marts')));
      assert.match(readFileSync(join(cwd, 'newproj', 'ARCHITECTURE.md'), 'utf8'), /raw ─▶ stg ─▶ marts/);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });

  test('add on a plugin prints the native command verbatim', async () => {
    const { stdout } = await run(['add', 'ampx', '--source', baseUrl]);
    assert.match(stdout, /amp plugin add de-agent\/ampx/);
  });
});
