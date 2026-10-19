#!/usr/bin/env node
/**
 * SCAN-TRUST — static rule-engine sweep over registry artifacts.
 *
 * LOCAL pass scans, per registry resource:
 *   1. vendored artifact files under public/<type>s/<slug>/ (SKILL.md trees)
 *   2. the record's own curated YAML prose (hidden-instruction/hygiene in copy)
 * attributing findings to the resource url. Optional REMOTE pass over GitHub
 * repos is handled by scan-secrets.mjs (same plumbing, secrets family).
 *
 * Output: src/data/generated/trust-findings.json — per-resource findings +
 * summary, consumed by the detail pages ("static trust scan" card) and by
 * future auto-gates. Curated YAML is NEVER modified; the scan is evidence
 * for review, not an automatic verdict.
 *
 *   node pipelines/scan-trust.mjs
 *   node pipelines/scan-trust.mjs --resource <slug>
 */
import { readdirSync, readFileSync, statSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import registry from '../src/data/generated/registry.json' with { type: 'json' };
import { loadRules, scanFiles, flagCount, familySummary } from './lib/trust-rules.mjs';
import { ROOT } from './lib/load.mjs';

const PUBLIC = join(ROOT, 'public');
const OUT = join(ROOT, 'src', 'data', 'generated', 'trust-findings.json');
const RULES_PATH = join(ROOT, 'data', 'curated', 'trust-rules.yaml');

const SCAN_EXT = /\.(js|mjs|cjs|ts|tsx|py|rb|go|rs|java|php|sh|bash|zsh|ps1|sql|yaml|yml|json|toml|ini|env|txt|md|mdx|dockerfile|cfg)$/i;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.astro', '__pycache__', '.venv', 'venv', 'generated']);
const MAX_FILE_BYTES = 400_000;

const args = process.argv.slice(2);
const ONLY = args.includes('--resource') ? args[args.indexOf('--resource') + 1] : null;

/** Vendored artifact tree for a resource: public/skills/<slug>/ etc. */
const TYPE_DIRS = { skill: 'skills', mcp: 'mcp', plugin: 'plugins', agent: 'agents', hook: 'hooks', runbook: 'runbooks', pattern: 'patterns', reference: 'references', template: 'templates', project: 'projects' };

function vendoredFiles(type, slug, out = []) {
  const base = join(PUBLIC, TYPE_DIRS[type] ?? `${type}s`, slug);
  if (!existsSync(base) || !statSync(base).isDirectory()) return out;
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(f)) walk(p); continue; }
      if (!SCAN_EXT.test(p) || statSync(p).size > MAX_FILE_BYTES) continue;
      try {
        out.push({ path: relative(PUBLIC, p).replace(/\\/g, '/'), content: readFileSync(p, 'utf8') });
      } catch { /* unreadable — skip, never crash the scan */ }
    }
  };
  walk(base);
  return out;
}

function curatedRecordFiles(r) {
  // the record's own YAML prose — prompt-injection and hygiene live in copy too
  const block = stringifyYaml({
    title: r.title, tagline: r.tagline, description: r.description,
    purpose: r.purpose, problem: r.problem, note: r.note,
    security_notes: r.security_notes, when_not: r.when_not, tradeoffs: r.tradeoffs,
  });
  return [{ path: `curated:${r.source_file ?? r.category}#${r.id}`, content: block }];
}

async function main() {
  console.log('\n  \x1b[1mDE//AGENT trust scan\x1b[0m  \x1b[2m(static rule engine)\x1b[0m\n');
  const rules = loadRules(RULES_PATH);
  const fam = familySummary(rules);
  console.log(`  rules: ${rules.length} across ${Object.keys(fam).length} families`);

  const perResource = {};
  let totalFindings = 0, flagged = 0, scanned = 0;

  for (const r of registry.resources) {
    if (ONLY && r.slug !== ONLY) continue;
    const files = [...vendoredFiles(r.type, r.slug), ...curatedRecordFiles(r)];
    if (!files.length) continue;
    const result = scanFiles(files, rules);
    // curated copy is human-reviewed at PR time — it IS the control. Findings
    // there are documentation context; live detection comes from vendored
    // artifact trees fetched from external repos.
    for (const f of result.findings) {
      if (f.file.startsWith('curated:')) f.likelyExample = true;
    }
    // recompute actionable summary after the policy mark
    const actionable = result.findings.filter((f) => !f.likelyExample);
    const byRiskActionable = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of actionable) byRiskActionable[f.risk] = (byRiskActionable[f.risk] ?? 0) + 1;
    result.summary.byRiskActionable = byRiskActionable;
    result.summary.actionable = actionable.length;
    result.summary.examples = result.findings.length - actionable.length;
    result.summary.maxRisk = actionable[0]?.risk ?? null;
    scanned++;
    perResource[r.url] = {
      slug: r.slug,
      type: r.type,
      files_scanned: files.length,
      ...result.summary,
      flags: (byRiskActionable.critical ?? 0) + (byRiskActionable.high ?? 0),
      findings: result.findings.slice(0, 25),
    };
    totalFindings += result.summary.total;
    if (perResource[r.url].flags > 0) flagged++;
  }

  const payload = {
    generated_at: new Date().toISOString(),
    engine: { rules: rules.length, families: fam },
    stats: { resources_scanned: scanned, total_findings: totalFindings, flagged_resources: flagged },
    resources: perResource,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 1) + '\n', 'utf8');

  console.log(`  resources scanned: ${scanned} · findings: ${totalFindings} (actionable: ${totalFindings - Object.values(perResource).reduce((a, r) => a + r.examples, 0)}) · flagged: ${flagged}`);
  for (const [url, r] of Object.entries(perResource)
    .sort((a, b) => (b[1].flags - a[1].flags) || (b[1].actionable - a[1].actionable))
    .slice(0, 10)) {
    if (r.actionable === 0 && r.total === 0) continue;
    console.log(`  ! ${url}  actionable:${r.actionable} examples:${r.examples} flags:${r.flags}  top: ${r.findings.find((f) => !f.likelyExample)?.rule ?? r.findings[0]?.rule ?? '-'}`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
