#!/usr/bin/env node
/**
 * EXECUTE — run a curator-approved manifest under the policy gate.
 * Default backend is dry (prints the plan, runs nothing). Local execution
 * needs BOTH --backend local AND --local-i-understand. Never runs during build.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { stringify } from 'yaml';
import { readYaml, ROOT } from './lib/load.mjs';
import { runManifest } from './lib/exec-runner.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : (args[i + 1] ?? true);
};
const manifestArg = flag('manifest');
const backendArg = flag('backend') ?? 'dry';
const ack = args.includes('--local-i-understand');

if (!manifestArg) { console.error('usage: node pipelines/execute.mjs --manifest <file> [--backend dry|local|docker] [--local-i-understand]'); process.exit(2); }
const manifestPath = resolve(ROOT, String(manifestArg));
if (relative(ROOT, manifestPath).startsWith('..')) { console.error('manifest must live under the repo root'); process.exit(2); }
const manifest = readYaml(manifestPath);
if (!manifest || typeof manifest !== 'object') { console.error('manifest is empty or invalid YAML'); process.exit(2); }

let backend = backendArg;
if (!['dry', 'local', 'docker'].includes(backend)) { console.error(`unknown backend: ${backend} (supported: dry, local, docker)`); process.exit(2); }
if (backend !== 'dry' && !ack) {
  console.log(`warning: --backend ${backend} without --local-i-understand; degrading to dry (nothing executed)`);
  backend = 'dry';
}
const out = await runManifest(manifest, { backend, root: ROOT });
console.log(`state: ${out.state}\nbackend: ${backend}`);
for (const c of out.commands) {
  console.log(`- ${c.name}: ${c.skipped ? 'skipped (dry)' : `exit ${c.exitCode} in ${c.durationMs}ms sha256 ${c.sha256}`}${c.failure ? ` [${c.failure.category}]` : ''}`);
}
if (out.state === 'blocked') {
  for (const r of out.policy.reasons) console.log(`  blocked: [${r.code}] ${r.detail}`);
}
if (out.spawned) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = join(ROOT, 'data', 'cache', 'executions');
  mkdirSync(dir, { recursive: true });
  const base = join(dir, `${manifest.id}-${stamp}`);
  const slim = out.commands.map(({ output, ...rest }) => rest);
  writeFileSync(`${base}.json`, JSON.stringify({ provenance: out.provenance, policy: out.policy, state: out.state, commands: slim }, null, 1) + '\n', 'utf8');
  writeFileSync(`${base}.log`, out.log, 'utf8');
  const rel = `${base}.json`.replace(ROOT, '').replace(/^[\\/]/, '');
  console.log(`result: ${rel}`);
  if (out.state === 'passed') {
    console.log('--- evidence (paste into the curated record; uncomment the checks this run actually proves) ---');
    const names = out.commands.map((c) => c.name).join(', ');
    const entries = [
      { check: 'build_passed', status: 'passed', at: out.provenance.finished_at, by: 'human', tool: 'de-agent-exec', version: out.provenance.version, ref: rel, summary: `${names} ran under the policy gate; transcript checksummed.` },
    ];
    console.log(stringify(entries).split('\n').map((l) => `# ${l}`).join('\n'));
  }
}
process.exit(out.state === 'passed' || out.state === 'eligible_for_execution' ? 0 : out.state === 'blocked' ? 2 : 1);
