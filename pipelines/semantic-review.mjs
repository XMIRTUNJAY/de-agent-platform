#!/usr/bin/env node
/**
 * SEMANTIC-REVIEW — offline judge workbench. NO LIVE LLM API.
 *
 * Reads the generated trust findings and emits a review packet
 * (data/enrichment/semantic-review/packet-<date>.md) listing every unjudged
 * actionable finding with its evidence and repo pointer. The packet is
 * reviewed in chat (or by a human curator); conclusions are recorded in
 * data/curated/semantic-verdicts.yaml — versioned, diffable, and re-checkable
 * against the cited file in the upstream repo.
 *
 *   node pipelines/semantic-review.mjs            # packet for unjudged findings
 *   node pipelines/semantic-review.mjs --all      # include already-judged too
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const findingsPath = join(ROOT, 'src', 'data', 'generated', 'trust-findings.json');

const ALL = process.argv.includes('--all');
const scan = JSON.parse(readFileSync(findingsPath, 'utf8'));

const lines = [];
lines.push(`# Semantic review packet — ${new Date().toISOString().slice(0, 10)}`);
lines.push('');
lines.push('Judge each finding below and record the verdict in data/curated/semantic-verdicts.yaml.');
lines.push('Schema per finding: id `<url>::<rule>::<file>` · verdict benign-in-context | confirmed-risk | escalated · scope publisher-ci | docs | runtime | vendor-bootstrap · explanation (cite what the evidence shows).');
lines.push('Re-verify against the upstream repo before deciding. A verdict is a published claim — it can be wrong, and it is diffable forever.');
lines.push('');
lines.push(`Unjudged actionable findings: ${countUnjudged()}`);
lines.push('');

function countUnjudged() {
  let n = 0;
  for (const [url, r] of Object.entries(scan.resources)) {
    for (const f of r.findings ?? []) {
      if (f.likelyExample) continue;
      if (!ALL && f.judged) continue;
      n++;
    }
  }
  return n;
}

for (const [url, r] of Object.entries(scan.resources)) {
  const actionable = (r.findings ?? []).filter((f) => !f.likelyExample);
  if (!actionable.length) continue;
  const rows = actionable.filter((f) => ALL || !f.judged);
  if (!rows.length) continue;
  lines.push(`## ${url}${r.remote ? `  (${r.remote.repo})` : ''}`);
  lines.push('');
  for (const f of rows) {
    lines.push(`### ${f.risk} · ${f.rule} · ${f.file}:${f.line}`);
    lines.push(`- snippet: \`${(f.snippet ?? '').replace(/`/g, "'").slice(0, 160)}\``);
    lines.push(`- definition: ${f.definition}`);
    lines.push(`- verify at: ${r.remote ? `https://github.com/${r.remote.repo}/blob/HEAD/${f.file}` : f.file}`);
    if (f.judged) lines.push(`- CURRENT VERDICT: ${f.judged.verdict} (${f.judged.scope}) — ${f.judged.explanation}`);
    lines.push('');
  }
}

const out = join(ROOT, 'data', 'enrichment', 'semantic-review', `packet-${new Date().toISOString().slice(0, 10)}.md`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, lines.join('\n') + '\n', 'utf8');
console.log(`packet: ${out} (${lines.length} lines, ${countUnjudged()} unjudged)`);
