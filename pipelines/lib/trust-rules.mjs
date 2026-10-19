/**
 * TRUST-RULES — the static rule engine behind artifact trust scanning.
 *
 * Loads the curated rule catalog (data/curated/trust-rules.yaml) and scans
 * text line-by-line. Pure and offline: no fetches, no mutation. Findings cite
 * { rule, family, risk, file, line, snippet } and NEVER echo secret values —
 * matched substrings are trimmed and, for secret-family rules, redacted.
 *
 * The notebook contract, per check:
 *   written definition (what it detects) → evidence it looks for →
 *   risk level → redemption advice. All four ship with every rule.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let cache = null;

/** Load and compile the rule catalog (cached per process). */
export function loadRules(path = join(ROOT, 'data', 'curated', 'trust-rules.yaml')) {
  if (cache && cache.path === path) return cache.rules;
  const doc = parseYaml(readFileSync(path, 'utf8')) ?? {};
  const rules = (doc.rules ?? []).map((r) => ({
    ...r,
    compiled: (r.patterns ?? []).map((p) => {
      try {
        return new RegExp(p, 'i');
      } catch {
        return null; // a broken pattern disables one rule, never the engine
      }
    }).filter(Boolean),
  }));
  cache = { path, rules };
  return rules;
}

/** Families present in the catalog, with counts — used by docs + stats. */
export function familySummary(rules = loadRules()) {
  const fam = {};
  for (const r of rules) fam[r.family] = (fam[r.family] ?? 0) + 1;
  return fam;
}

/**
 * A hit is *likely an example* when the line smells like documentation ABOUT
 * the pattern rather than a live occurrence — audits describing what they
 * detect, quoted fragments, example fixtures. Flagged either way (full
 * transparency), but examples do not count toward security_flags — exactly
 * the semantics scan-secrets.mjs established.
 */
const LIKELY_EXAMPLE =
  /\b(detects?|detections?|blocks?|flags?|catch(es)?|scans?|scanning|looks? for|example|e\.g\.|such as|forbidden|prevents?|document(ed|ation)|docs|reference|fixture|sample|demo|placeholder|your-|<[^>]+>)\b|\*\*[^*]+\*\*\s*—/i;
const FENCE = /^\s*(```|~~~)/;

/** Secret-family hits must not echo the matched value into the snippet. */
function snippetFor(line, family, start, end) {
  if (family === 'secrets') {
    return line.slice(0, Math.max(0, start)) + '⟨redacted⟩' + line.slice(Math.max(start, end));
  }
  const from = Math.max(0, start - 20);
  const to = Math.min(line.length, end + 40);
  return (from > 0 ? '…' : '') + line.slice(from, to).trim() + (to < line.length ? '…' : '');
}

/**
 * Scan one text blob. Returns findings sorted by risk order.
 * Each finding: { rule, family, title, risk, definition, remediation,
 * file, line, snippet, likelyExample }. Code fences are scanned (real
 * commands live there); documentation context marks likelyExample.
 */
export function scanText(text, filePath = '', rules = loadRules()) {
  const RISK_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  const findings = [];
  const lines = String(text ?? '').split('\n');
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (FENCE.test(raw)) { inFence = !inFence; continue; }
    const line = raw;
    if (!line || line.length > 4000) continue; // skip minified/very long lines
    // list-intro carry-over: "…detects the following:" makes the NEXT line's
    // hit documentation context too
    const prev = i > 0 ? lines[i - 1] : '';
    const intro = !inFence && /[:,]\s*$/.test(prev) && LIKELY_EXAMPLE.test(prev);
    const docContext = !inFence && (LIKELY_EXAMPLE.test(line) || intro);
    for (const rule of rules) {
      for (const re of rule.compiled) {
        re.lastIndex = 0;
        const m = re.exec(line);
        if (m) {
          findings.push({
            rule: rule.id,
            family: rule.family,
            title: rule.title,
            risk: rule.risk,
            definition: rule.definition,
            remediation: rule.remediation,
            file: filePath,
            line: i + 1,
            snippet: snippetFor(line, rule.family, m.index, m.index + m[0].length),
            inCode: inFence,
            likelyExample: docContext,
          });
          break; // one finding per rule per line
        }
      }
    }
  }
  return findings.sort((a, b) => (RISK_ORDER[a.risk] ?? 9) - (RISK_ORDER[b.risk] ?? 9));
}

/** Scan a set of files: [{ path, content }] → { findings, summary }. */
export function scanFiles(files, rules = loadRules()) {
  const findings = [];
  for (const f of files) findings.push(...scanText(f.content, f.path, rules));
  const byRisk = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) byRisk[f.risk] = (byRisk[f.risk] ?? 0) + 1;
  const actionable = findings.filter((f) => !f.likelyExample);
  const byRiskActionable = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of actionable) byRiskActionable[f.risk] = (byRiskActionable[f.risk] ?? 0) + 1;
  return {
    findings,
    summary: {
      total: findings.length,
      byRisk,
      byRiskActionable,
      actionable: actionable.length,
      examples: findings.length - actionable.length,
      maxRisk: actionable[0]?.risk ?? findings[0]?.risk ?? null,
      rulesApplied: rules.length,
    },
  };
}

/**
 * SEMANTIC VERDICTS — apply curated judgments to findings.
 *
 * Explicit verdicts (keyed "<url>::<rule>::<file>") win over deterministic
 * verdict rules. benign-in-context stays visible but never flags;
 * confirmed-risk counts as scanned; escalated counts as critical.
 * Mutates findings (adds f.judged), returns the actionable summary.
 */
export function applyVerdicts(url, findings, { explicit = new Map(), rules = [] }) {
  for (const f of findings) {
    const v = explicit.get(`${url}::${f.rule}::${f.file}`);
    if (v) {
      f.judged = { verdict: v.verdict, scope: v.scope, explanation: v.explanation, via: 'explicit' };
      continue;
    }
    const vr = rules.find((r) => matchVerdictRule(r, f));
    if (vr) {
      f.judged = { verdict: vr.verdict, scope: vr.scope, explanation: vr.explanation, via: `rule:${vr.id}` };
    }
  }
  const actionable = findings.filter((f) => {
    if (f.likelyExample) return false;
    if (f.judged) return f.judged.verdict !== 'benign-in-context';
    return true;
  });
  const byRiskActionable = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of actionable) {
    const risk = f.judged?.verdict === 'escalated' ? 'critical' : f.risk;
    byRiskActionable[risk] = (byRiskActionable[risk] ?? 0) + 1;
  }
  return {
    actionableCount: actionable.length,
    byRiskActionable,
    maxRisk: actionable[0]?.risk ?? null,
    flagTotal: (byRiskActionable.critical ?? 0) + (byRiskActionable.high ?? 0),
  };
}

function matchVerdictRule(vr, f) {
  if (!vr.when) return false;
  if (vr.when.rule && vr.when.rule !== f.rule) return false;
  if (vr.fileRe && !vr.fileRe.test(f.file ?? '')) return false;
  if (vr.snippetRe && !vr.snippetRe.test(f.snippet ?? '')) return false;
  return true;
}

/**
 * security_flags contribution — the number the registry trust score consumes.
 * Critical and high findings count as flags; medium/low stay advisory; and
 * documentation-context (likelyExample) hits never flag.
 */
export function flagCount(result) {
  return (result.summary.byRiskActionable.critical ?? 0) + (result.summary.byRiskActionable.high ?? 0);
}
