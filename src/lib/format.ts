/** "1 resource" not "1 resources". */
export function plural(n: number, one: string, many?: string): string {
  return n === 1 ? one : (many ?? `${one}s`);
}

export function count(n: number, one: string, many?: string): string {
  return `${n} ${plural(n, one, many)}`;
}

export type ScoreTone = 'accent' | 'info' | 'warn' | 'danger' | 'dim';
export interface ScoreBand {
  label: string;
  tone: ScoreTone;
  pct: number;
}

/** Composite score as a stable integer string; em dash when unknown. */
export function formatScore(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return '—';
  return String(Math.round(score));
}

/**
 * Band a 0–100 composite score. Thresholds mirror the canonical banding in
 * pipelines/lib/marketplace-score.mjs (80/65/45/25) so UI labels always agree
 * with the registry's real composite_label.
 */
export function scoreBand(score: number | null | undefined): ScoreBand {
  const s = score ?? 0;
  const pct = Math.max(0, Math.min(100, Math.round(s)));
  if (s >= 80) return { label: 'exemplary', tone: 'accent', pct };
  if (s >= 65) return { label: 'strong', tone: 'info', pct };
  if (s >= 45) return { label: 'adequate', tone: 'warn', pct };
  if (s >= 25) return { label: 'weak', tone: 'danger', pct };
  return { label: 'unproven', tone: 'dim', pct };
}
