/**
 * DEPTH — content-depth rubric: is this record substantive enough to
 * deserve a public page? Four machine-checkable signal groups, 0–100.
 * Warning-only audit input; never a build gate. Reuses REQUIRED_BY_TYPE
 * so "required" means the same thing here and in validation.
 */
import { REQUIRED_BY_TYPE } from './validate.mjs';

const filled = (v) =>
  v !== undefined && v !== null && v !== '' &&
  (!Array.isArray(v) || v.length > 0) &&
  (Array.isArray(v) || typeof v !== 'object' || Object.keys(v).length > 0);

export function scoreDepth(r) {
  const signals = {};
  const len = String(r.description ?? '').length;
  signals.description = len >= 500 ? 40 : len >= 200 ? 25 : len >= 30 ? 10 : 0;
  const required = REQUIRED_BY_TYPE[r.type] ?? [];
  signals.required = required.length === 0 ? 30 : Math.round((required.filter((k) => filled(r[k])).length / required.length) * 30);
  const hasInstall = filled(r.install_command) || filled(r.installation);
  const hasRunnable = ['example', 'tests', 'evaluation', 'implementations', 'contents'].some((k) => filled(r[k]));
  signals.runnable = (hasInstall ? 10 : 0) + (hasRunnable ? 10 : 0);
  const richCount = [
    Array.isArray(r.tags) && r.tags.length > 0,
    filled(r.learning_objectives),
    filled(r.prerequisites),
    Object.values(r.relationships ?? {}).some((v) => Array.isArray(v) ? v.length > 0 : filled(v)),
  ].filter(Boolean).length;
  signals.richness = richCount >= 2 ? 10 : richCount === 1 ? 5 : 0;
  const score = signals.description + signals.required + signals.runnable + signals.richness;
  return { score, level: score >= 75 ? 'deep' : score >= 50 ? 'adequate' : 'thin', signals };
}

export function depthAll(resources) {
  for (const r of resources) r.depth = scoreDepth(r);
  return resources;
}
