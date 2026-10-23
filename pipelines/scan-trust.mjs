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
import { join, relative, dirname, basename, resolve } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { parse as parseYaml } from 'yaml';
import registry from '../src/data/generated/registry.json' with { type: 'json' };
import { loadRules, scanText, scanFiles, flagCount, familySummary, applyVerdicts } from './lib/trust-rules.mjs';
import { fetchText } from './lib/fetch.mjs';
import { repoIdentity } from './lib/identity.mjs';
import { ROOT } from './lib/load.mjs';

const VERDICTS_PATH = join(ROOT, 'data', 'curated', 'semantic-verdicts.yaml');

/** Load semantic verdicts: explicit map + deterministic verdict rules. */
function loadVerdicts() {
  if (!existsSync(VERDICTS_PATH)) return { explicit: new Map(), rules: [] };
  const doc = parseYaml(readFileSync(VERDICTS_PATH, 'utf8')) ?? {};
  const explicit = new Map();
  for (const v of doc.verdicts ?? []) explicit.set(v.id, v);
  const rules = (doc.verdict_rules ?? []).map((r) => ({
    ...r,
    fileRe: r.when?.file ? new RegExp(r.when.file, 'i') : null,
    snippetRe: r.when?.snippet ? new RegExp(r.when.snippet, 'i') : null,
  }));
  return { explicit, rules };
}

const PUBLIC = join(ROOT, 'public');
const OUT = join(ROOT, 'src', 'data', 'generated', 'trust-findings.json');
const RULES_PATH = join(ROOT, 'data', 'curated', 'trust-rules.yaml');

const SCAN_EXT = /\.(js|mjs|cjs|ts|tsx|py|rb|go|rs|java|php|sh|bash|zsh|ps1|sql|yaml|yml|json|toml|ini|env|txt|md|mdx|dockerfile|cfg)$/i;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.astro', '__pycache__', '.venv', 'venv', 'generated']);
const MAX_FILE_BYTES = 400_000;

const args = process.argv.slice(2);
const ONLY = args.includes('--resource') ? args[args.indexOf('--resource') + 1] : null;
const REMOTE = args.includes('--remote');
// default covers every remote-eligible resource (each repo costs ~7 API calls
// against 5000/hr with GITHUB_TOKEN); override only to cap a debug run
const REMOTE_LIMIT = Number(args.includes('--remote-limit') ? args[args.indexOf('--remote-limit') + 1] : 150);
// remote: same file triage as scan-secrets — small text files, risky names first
const REMOTE_FILE_BYTES = 100_000;
const REMOTE_MAX_FILES = 6;

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

async function ghJson(url) {
  const res = await fetchText(url);
  if (!res?.ok || !res.body) throw new Error(`HTTP ${res?.status ?? 'none'}: ${url}`);
  return JSON.parse(res.body);
}

const RISKY_REMOTE =
  /(^|\/)\.env(\.|$)|credentials|secrets?\.(ya?ml|json|toml|ini)|passwd|shadow|\.pem$|\.key$|id_rsa|\.p12$|\.pfx$|service-account|service_account|install|setup|deploy/i;

/** Remote scan of one repo through the full rule engine (not just secrets). */
async function scanRepoRemote(owner, repo) {
  const files = [];
  let tree;
  try {
    const t = await ghJson(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`);
    if (t.message) throw new Error(t.message);
    tree = (t.tree || []).filter((n) => n.type === 'blob');
  } catch (err) {
    return { skipped: String(err.message || err).slice(0, 120) };
  }
  const candidates = tree
    .filter((n) => SCAN_EXT.test(n.path) && (n.size ?? 0) > 0 && (n.size ?? 0) < REMOTE_FILE_BYTES)
    .sort((a, b) => (RISKY_REMOTE.test(b.path) ? 1 : 0) - (RISKY_REMOTE.test(a.path) ? 1 : 0))
    .slice(0, REMOTE_MAX_FILES);
  for (const n of candidates) {
    try {
      const blob = await ghJson(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(n.path)}`);
      if (!blob.content || blob.encoding !== 'base64') continue;
      files.push({ path: n.path, content: Buffer.from(blob.content, 'base64').toString('utf8') });
    } catch { /* unreadable file: skip */ }
  }
  return scanFiles(files, loadRules(RULES_PATH));
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

/**
 * Run the trust scan over a registry and return the payload. Parameterized so
 * run.mjs can fold a LOCAL scan into every build (the standalone script keeps
 * remote scanning for manual runs). remote=true needs GITHUB_TOKEN.
 */
export async function runTrustScan({ registry: reg = registry, remote = false, only = null, write = false, outPath = OUT } = {}) {
  const ONLY = only;
  const REMOTE = remote && !!process.env.GITHUB_TOKEN;
  const rules = loadRules(RULES_PATH);
  const fam = familySummary(rules);
  const verdicts = loadVerdicts();
  console.log(`  rules: ${rules.length} across ${Object.keys(fam).length} families · explicit verdicts: ${verdicts.explicit.size} · verdict rules: ${verdicts.rules.length}`);

  /**
   * Semantic verdicts — applied via the shared lib (see applyVerdicts there
   * for the merge policy).
   */
  const applyVerdictsTo = (url, findings) => applyVerdicts(url, findings, verdicts);

  const perResource = {};
  let totalFindings = 0, flagged = 0, scanned = 0;

  for (const r of reg.resources) {
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
    const v = applyVerdictsTo(r.url, result.findings);
    result.summary.byRiskActionable = v.byRiskActionable;
    result.summary.actionable = v.actionableCount;
    result.summary.examples = result.findings.length - v.actionableCount;
    result.summary.maxRisk = v.maxRisk;
    scanned++;
    perResource[r.url] = {
      slug: r.slug,
      type: r.type,
      files_scanned: files.length,
      ...result.summary,
      flags: v.flagTotal,
      findings: result.findings.slice(0, 25),
    };
    totalFindings += result.summary.total;
    if (v.flagTotal > 0) flagged++;
  }

  if (REMOTE) {
    console.log(`\n  remote pass: top ${REMOTE_LIMIT} repos by composite score`);
    const targets = reg.resources
      .map((r) => ({ r, s: r.marketplace?.composite_score ?? -1 }))
        .filter(({ r }) => {
          const id = repoIdentity(r.github_url ?? '');
          return id && !/de-agent-platform/i.test(r.github_url ?? '');
        })
        .sort((a, b) => b.s - a.s)
        .slice(0, REMOTE_LIMIT);
      let remoteScanned = 0, remoteSkipped = 0, remoteFindings = 0;
      for (const { r } of targets) {
        const id = repoIdentity(r.github_url);
        const res = await scanRepoRemote(id.owner, id.repo);
        if (res.skipped) { remoteSkipped++; continue; }
        const v = applyVerdictsTo(r.url, res.findings);
        remoteScanned++;
        remoteFindings += res.findings.length;
        const entry = perResource[r.url];
        if (!entry) {
          perResource[r.url] = {
            slug: r.slug, type: r.type, files_scanned: 0,
            total: res.findings.length,
            byRisk: res.summary.byRisk, byRiskActionable: v.byRiskActionable,
            actionable: v.actionableCount,
            examples: res.findings.length - v.actionableCount,
            maxRisk: v.maxRisk,
            rulesApplied: res.summary.rulesApplied,
            flags: v.flagTotal,
            findings: res.findings.slice(0, 25),
            remote: { repo: `${id.owner}/${id.repo}`, files_scanned: REMOTE_MAX_FILES },
          };
          if (v.flagTotal > 0) flagged++;
        } else {
          entry.findings = [...entry.findings, ...res.findings].slice(0, 40);
          entry.total += res.findings.length;
          entry.actionable += v.actionableCount;
          entry.flags += v.flagTotal;
          entry.remote = { repo: `${id.owner}/${id.repo}`, files_scanned: REMOTE_MAX_FILES };
          if (entry.flags > 0) flagged++;
        }
      }
      totalFindings += remoteFindings;
      console.log(`  remote scanned: ${remoteScanned} · skipped: ${remoteSkipped} · findings: ${remoteFindings}`);
  }

  const payload = {
    generated_at: new Date().toISOString(),
    engine: { rules: rules.length, families: fam },
    stats: { resources_scanned: scanned, total_findings: totalFindings, flagged_resources: flagged },
    resources: perResource,
  };
  if (write) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(payload, null, 1) + '\n', 'utf8');
  }

  console.log(`  resources scanned: ${scanned} · findings: ${totalFindings} (actionable: ${totalFindings - Object.values(perResource).reduce((a, r) => a + r.examples, 0)}) · flagged: ${flagged}`);
  for (const [url, r] of Object.entries(perResource)
    .sort((a, b) => (b[1].flags - a[1].flags) || (b[1].actionable - a[1].actionable))
    .slice(0, 10)) {
    if (r.actionable === 0 && r.total === 0) continue;
    console.log(`  ! ${url}  actionable:${r.actionable} examples:${r.examples} flags:${r.flags}  top: ${r.findings.find((f) => !f.likelyExample)?.rule ?? r.findings[0]?.rule ?? '-'}`);
  }
  return payload;
}

/** CLI entry — direct invocation only (importing for pipeline use must not
 *  run this, and never process.exit from a module). */
import { pathToFileURL } from 'node:url';
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().then(
    () => process.exit(0),
    (e) => { console.error(e); process.exit(1); },
  );
}

async function main() {
  console.log('\n  \x1b[1mDE//AGENT trust scan\x1b[0m  \x1b[2m(static rule engine)\x1b[0m\n');
  return runTrustScan({ remote: REMOTE, only: ONLY, write: true });
}

/** True when the trust-findings payload is recent enough to show. Missing or
 *  unparsable payloads hide the card — a stale trust claim is worse than none. */
const TRUST_MAX_AGE_MS = 7 * 86400000;
export function isTrustScanFresh(scan, now = Date.now(), maxAgeMs = TRUST_MAX_AGE_MS) {
  if (!scan?.generated_at) return false;
  const t = Date.parse(scan.generated_at);
  if (Number.isNaN(t)) return false;
  return now - t >= 0 && now - t <= maxAgeMs;
}
