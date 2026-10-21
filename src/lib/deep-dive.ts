// Deep-dive display helpers. Everything here DERIVES from registry fields —
// stats and at-a-glance rows never invent data (no-fabrication rule); new
// prose fields (gotchas, production_notes, why, diagram) are authored in the
// curated YAML and pass through the pipeline untouched.

export interface TradeoffRow {
  kind: 'pro' | 'con' | 'neutral';
  text: string;
}

export interface GlanceRow {
  label: string;
  value: string;
}

export interface StatRow {
  label: string;
  value: any;
}

const dateFmt = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' });

/** first complete sentence ending in . ? ! (min 12 chars) */
function firstSentence(text: unknown): string {
  const s = String(text ?? '').trim();
  if (!s) return '';
  const m = s.match(/(.{12,}?[.?!])(\s|$)/s);
  return m ? m[1] : s;
}

/** Parse tradeoff strings into table rows. "pro: x"/"con: x" become typed
 *  rows; anything else stays neutral. */
export function tradeoffRows(tradeoffs: unknown): TradeoffRow[] {
  const list = Array.isArray(tradeoffs) ? tradeoffs : [];
  return list
    .map((t: any): TradeoffRow | null => {
      const text = String(t ?? '').trim();
      if (!text) return null;
      const m = text.match(/^(pro|con)\s*:\s*(.+)$/i);
      if (m) return { kind: m[1].toLowerCase() as 'pro' | 'con', text: m[2].trim() };
      return { kind: 'neutral', text };
    })
    .filter((t): t is TradeoffRow => t !== null);
}

/** What / When / Where / Why rows. Rows without data are omitted entirely. */
export function atAGlanceRows(res: any): GlanceRow[] {
  const rows: GlanceRow[] = [];
  const what = res.tagline ?? res.summary ?? res.purpose ?? firstSentence(res.description);
  if (what) rows.push({ label: 'What', value: String(what).trim() });

  const when = res.when_to_use;
  if (Array.isArray(when) ? when.length > 0 : when) {
    const value = Array.isArray(when) ? when.map((w: any) => String(w).trim()).join('; ') : String(when).trim();
    if (value) rows.push({ label: 'When', value });
  }

  const where = [res.categoryTitle, ...(Array.isArray(res.technologies) ? res.technologies.slice(0, 3) : [])]
    .filter(Boolean)
    .join(' · ');
  if (where) rows.push({ label: 'Where', value: where });

  const why = res.why;
  if (why) rows.push({ label: 'Why', value: String(why).trim() });
  return rows;
}

/** Registry stats table rows — pure derivation, omitted when the field is absent. */
export function statRows(res: any): StatRow[] {
  const rows: StatRow[] = [];
  if (res.verification) {
    const v = res.last_verified
      ? `${res.verification} · ${dateFmt.format(new Date(res.last_verified))}`
      : res.verification;
    rows.push({ label: 'Verification', value: v });
  }
  const completeness = res.scores?.completeness;
  if (completeness != null) rows.push({ label: 'Completeness', value: completeness });
  const trust = res.scores?.trust;
  if (trust != null) rows.push({ label: 'Trust multiplier', value: `×${trust}` });
  const composite = res.marketplace?.composite_score;
  if (composite != null) {
    const label = res.marketplace?.composite_label;
    rows.push({ label: 'Composite', value: label ? `${composite} · ${label}` : String(composite) });
  }
  if (res.stale_days != null) {
    rows.push({
      label: 'Freshness',
      value: res.stale
        ? `stale — ${res.stale_days} days since last source check`
        : `${res.stale_days} days since last source check`,
    });
  }
  if (res.difficulty) rows.push({ label: 'Difficulty', value: res.difficulty });
  if (res.severity) rows.push({ label: 'Severity', value: res.severity });
  if (res.version) rows.push({ label: 'Version', value: res.version });
  if (res.license) rows.push({ label: 'License', value: res.license });
  if (res.security_flags != null)
    rows.push({ label: 'Security flags', value: res.security_flags === 0 ? 'none' : String(res.security_flags) });
  return rows;
}
