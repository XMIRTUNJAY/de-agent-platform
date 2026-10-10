/**
 * EXEC-RUNNER — guarded command execution behind the policy gate.
 *
 * Backends: `dry` (default, never spawns — prints the plan) and `local`
 * (spawns with cwd jail, scrubbed env, timeout, output cap, redacted logs,
 * sha256 transcripts, and provenance). No shell is ever used (`shell: false`).
 * Guarded is not isolated: CPU/memory/disk quotas and network namespaces need
 * the future Docker backend. Run only curator-approved manifests.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { evaluatePolicy, classifyFailure } from './exec-policy.mjs';

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/g,
  /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}/g,
  /github_pat_[A-Za-z0-9_]{80,}/g,
  /\bxox[bap]-[A-Za-z0-9-]{10,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  /\bnpm_[A-Za-z0-9]{36,}/g,
  /password\s*[:=]\s*\S+/gi,
];

export function redact(text) {
  let out = String(text ?? '');
  for (const re of SECRET_PATTERNS) out = out.replace(re, '[REDACTED]');
  return out;
}

const ENV_ALLOW = new Set(['PATH', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'LANG', 'LC_ALL', 'COMSPEC', 'PATHEXT']);
const ENV_SECRET = /TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL|AUTH/i;

export function scrubEnv(env) {
  const out = {};
  for (const [k, v] of Object.entries(env ?? {})) {
    if (!ENV_ALLOW.has(k)) continue;
    if (ENV_SECRET.test(k)) continue;
    out[k] = v;
  }
  out.NODE_ENV = 'production';
  return out;
}

function toolVersion(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function runManifest(manifest, { backend = 'dry', root = process.cwd(), env = process.env } = {}) {
  const policy = evaluatePolicy(manifest);
  const started_at = new Date().toISOString();
  const provenance = { tool: 'de-agent-exec', version: toolVersion(root), manifest: manifest.id, backend, started_at };
  if (!policy.eligible) {
    return { state: 'blocked', spawned: false, policy, commands: [], log: '', resultPath: null, provenance };
  }
  if (backend === 'dry') {
    return {
      state: 'eligible_for_execution', spawned: false, policy,
      commands: (manifest.commands ?? []).map((c) => ({ name: c.name, skipped: true })),
      log: `# dry run — nothing executed. Re-run with --backend local to execute.\n`,
      resultPath: null, provenance,
    };
  }
  if (backend !== 'local' && backend !== 'docker') throw new Error(`unknown backend: ${backend} (supported: dry, local, docker)`);
  if (backend === 'docker') {
    const { runDockerManifest } = await import('./exec-docker.mjs');
    return runDockerManifest(manifest, { root, env, limits: manifest.limits ?? {}, policy, provenance });
  }
  const cwd = resolve(root, manifest.workdir ?? '.');
  if (relative(root, cwd).startsWith('..') || !cwd.startsWith(resolve(root))) {
    return { state: 'blocked', spawned: false, policy: { eligible: false, reasons: [{ code: 'path-escape', detail: 'workdir escapes repo root' }] }, commands: [], log: '', resultPath: null, provenance };
  }
  const results = [];
  let transcript = '';
  let state = 'passed';
  for (const cmd of manifest.commands ?? []) {
    const r = await runOne(cmd, { cwd, env, limits: manifest.limits ?? {} });
    results.push(r);
    transcript += `$ ${redact(cmd.argv.join(' '))}\n${r.output}\n`;
    if (r.exitCode !== 0 || r.timedOut) state = 'failed';
  }
  const finished_at = new Date().toISOString();
  return { state, spawned: true, policy, commands: results, log: transcript, resultPath: null, provenance: { ...provenance, finished_at } };
}

async function runOne(cmd, { cwd, env, limits }) {
  const timeoutMs = cmd.timeout_ms ?? limits.timeout_ms ?? 60000;
  const maxBytes = limits.max_output_bytes ?? 200000;
  const started = Date.now();
  return new Promise((resolvePromise) => {
    const child = spawn(cmd.argv[0], cmd.argv.slice(1), { cwd, env: scrubEnv(env), shell: false, windowsHide: true });
    let output = '';
    let overflow = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
      resolvePromise(finish());
    }, timeoutMs);
    const onData = (d) => {
      output += d;
      if (Buffer.byteLength(output) > maxBytes && !overflow) { overflow = true; child.kill('SIGKILL'); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (error) => { clearTimeout(timer); resolvePromise(finish({ error })); });
    child.on('close', (exitCode) => { clearTimeout(timer); resolvePromise(finish({ exitCode })); });
    function finish(extra = {}) {
      const redacted = redact(output.slice(0, maxBytes));
      const rec = { name: cmd.name, exitCode: extra.exitCode ?? (timedOut || overflow ? null : 1), timedOut, durationMs: Date.now() - started, outputBytes: Buffer.byteLength(output), sha256: createHash('sha256').update(redacted).digest('hex'), output: redacted, ...extra };
      if (rec.error) delete rec.error.stack;
      if (timedOut || overflow || (rec.exitCode !== 0 && rec.exitCode !== null)) {
        rec.failure = classifyFailure({ timedOut, overflow, maxBytes, timeoutMs, exitCode: rec.exitCode, error: extra.error, argv0: cmd.argv[0] });
      }
      return rec;
    }
  });
}
