/**
 * AUTO GATES — the tests content must pass before it publishes without a human.
 *
 * Curator rule: minimum 500 servable words, required structure per type,
 * beginner-friendly (no gatekeeping words), license allowlist, install
 * surface present, no placeholders, no secrets, links resolve.
 *
 * Gates verify STRUCTURE + SAFETY, never truth. A draft that fails any gate
 * stays a draft with reasons attached. Nothing here invents stats, tests, or
 * claims to fill a gap — absence fails, it never generates.
 */
import { REQUIRED_BY_TYPE, GATEKEEPING } from './validate.mjs';
import { EXTRACTABLE_LICENSES } from './repo-extract.mjs';
import { scanText } from '../scan-secrets.mjs';

export const MIN_WORDS = 500;

export function countWords(record) {
  const text = [record.title, record.description, record.body,
    ...(record.steps ?? []).map((s) => (typeof s === 'string' ? s : s.text)),
    ...(record.what_you_need ?? []), ...(record.check_yourself ?? [])].filter(Boolean).join('\n');
  return text.split(/\s+/).filter(Boolean).length;
}

function missingFields(record) {
  const missing = [];
  for (const k of REQUIRED_BY_TYPE[record.type] ?? []) {
    const v = record[k];
    const empty = v === undefined || v === null || v === '' ||
      (Array.isArray(v) && v.length === 0);
    if (empty) missing.push(k);
  }
  return missing;
}

export function runStaticGates(record) {
  const reasons = [];
  if (!EXTRACTABLE_LICENSES.has(record.license)) {
    reasons.push(`license ${record.license ?? 'missing'} not auto-publishable`);
  }
  const words = countWords(record);
  if (words < MIN_WORDS) reasons.push(`only ${words} servable words, need ${MIN_WORDS}`);
  const missing = missingFields(record);
  if (missing.length > 0) reasons.push(`missing structure: ${missing.join(', ')}`);
  const hasInstall = record.install_command || (record.install_candidates ?? []).length > 0 || record.installation;
  if (['skill', 'mcp', 'plugin', 'agent', 'hook'].includes(record.type) && !hasInstall) {
    reasons.push('no install surface (command, candidates, or installation)');
  }
  const prose = [record.title, record.description, record.body].filter(Boolean).join('\n');
  if (GATEKEEPING.test(prose)) reasons.push('gatekeeping word found (not beginner-friendly)');
  if (/\b(TODO|TBD|Lorem ipsum)\b/i.test(prose)) reasons.push('placeholder text present');
  const dirty = scanText(prose).filter((f) => !f.likelyExample);
  if (dirty.length > 0) reasons.push(`${dirty.length} secret-scan finding(s) need review`);
  if (record.type === 'tutorial') {
    for (const [n, step] of (record.steps ?? []).entries()) {
      if (!step || typeof step.text !== 'string' || !step.from_id || !step.from_field) {
        reasons.push(`step ${n + 1} lacks text + from_id + from_field`);
      }
    }
  }
  return { pass: reasons.length === 0, reasons, words };
}

/** Live half: every outbound link must resolve. Heartbeat-only, never build. */
export async function runLinkGates(record, fetchText) {
  const reasons = [];
  for (const url of [record.source_url, record.github_url].filter(Boolean)) {
    try {
      const res = await fetchText(url);
      if (!res.ok) reasons.push(`link dead: ${url} (${res.status})`);
    } catch {
      reasons.push(`link unreachable: ${url}`);
    }
  }
  return { pass: reasons.length === 0, reasons };
}
