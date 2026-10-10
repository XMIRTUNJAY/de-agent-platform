/**
 * EXEC-DOCKER — disposable Linux containers behind the policy gate.
 *
 * Every container: `--rm`, `--network none`, read-only root FS, nobody user,
 * capped memory/CPU/PIDs, declared read-only mounts only. Images must be
 * pinned and already present locally — the engine never pulls. No
 * `--privileged`, no socket mount, no host network: those flags do not exist
 * in the builder below.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { redact } from './exec-runner.mjs';
import { classifyFailure } from './exec-policy.mjs';

const ENV_SECRET = /TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL|AUTH/i;

export async function dockerAvailable(timeoutMs = 10000) {
  try {
    const code = await spawnExit('docker', ['info'], { timeoutMs });
    return code === 0;
  } catch {
    return false;
  }
}

function spawnExit(bin, args, { timeoutMs = 10000 } = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(bin, args, { shell: false, windowsHide: true, stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolvePromise(null); }, timeoutMs);
    child.on('error', () => { clearTimeout(timer); resolvePromise(null); });
    child.on('close', (code) => { clearTimeout(timer); resolvePromise(code); });
  });
}

export async function imagePresent(image, timeoutMs = 15000) {
  return (await spawnExit('docker', ['image', 'inspect', image], { timeoutMs })) === 0;
}

export function buildDockerArgs(cmd, { manifest, root, runId }) {
  const dl = manifest.limits?.docker ?? {};
  const memory = dl.memory ?? '512m';
  const cpus = dl.cpus ?? '1.0';
  const pids = dl.pids ?? 64;
  const argv = [
    'run', '--rm', '-i',
    '--name', `de-agent-exec-${runId}`,
    '--network', 'none',
    '--memory', memory, '--memory-swap', memory,
    '--cpus', String(cpus), '--pids-limit', String(pids),
    '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
    '--user', '65534:65534',
    '--workdir', '/work',
    '--env', 'NODE_ENV=production',
  ];
  for (const [k, v] of Object.entries(manifest.env ?? {})) {
    if (ENV_SECRET.test(k)) continue;
    argv.push('--env', `${k}=${v}`);
  }
  for (const mt of manifest.mounts ?? []) {
    const hostAbs = resolve(root, mt.host);
    if (relative(root, hostAbs).startsWith('..')) throw new Error(`mount host escapes repo root: ${mt.host}`);
    argv.push('-v', `${hostAbs}:${mt.container}:ro`);
  }
  argv.push(manifest.image, ...cmd.argv);
  return argv;
}

export async function runDockerManifest(manifest, { root, limits = {}, policy, provenance, runIdBase = `${process.pid}-${Date.now()}` } = {}) {
  const results = [];
  let transcript = '';
  let state = 'passed';
  let i = 0;
  for (const cmd of manifest.commands ?? []) {
    const r = await runDockerCommand(cmd, { manifest, root, limits, runId: `${runIdBase}-${i++}` });
    results.push(r);
    transcript += `$ ${redact(cmd.argv.join(' '))}  [${manifest.image}]\n${r.output}\n`;
    if (r.exitCode !== 0) state = 'failed';
  }
  return { state, spawned: true, policy, commands: results, log: transcript, resultPath: null, provenance: { ...provenance, finished_at: new Date().toISOString() } };
}

async function runDockerCommand(cmd, { manifest, root, limits, runId }) {
  const timeoutMs = cmd.timeout_ms ?? limits.timeout_ms ?? 60000;
  const maxBytes = limits.max_output_bytes ?? 200000;
  const started = Date.now();
  if (!(await imagePresent(manifest.image))) {
    return {
      name: cmd.name, exitCode: null, timedOut: false, durationMs: Date.now() - started,
      outputBytes: 0, sha256: createHash('sha256').update('').digest('hex'), output: '',
      failure: classifyFailure({ error: { code: 'ENOENT' }, argv0: `image ${manifest.image} (not present locally; pull it explicitly)` }),
    };
  }
  let dockerArgv;
  try {
    dockerArgv = buildDockerArgs(cmd, { manifest, root, runId });
  } catch (error) {
    return {
      name: cmd.name, exitCode: null, timedOut: false, durationMs: Date.now() - started,
      outputBytes: 0, sha256: createHash('sha256').update('').digest('hex'), output: '',
      failure: { category: 'policy-blocked', detail: String(error.message ?? error) },
    };
  }
  return new Promise((resolvePromise) => {
    const child = spawn('docker', dockerArgv, { shell: false, windowsHide: true });
    let output = '';
    let overflow = false;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); resolvePromise(finish()); }, timeoutMs);
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
