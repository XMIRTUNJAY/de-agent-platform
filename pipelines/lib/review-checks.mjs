/**
 * REVIEW-CHECKS — prebuilt gates for agent-written drafts.
 * Sixteen named checks across seven dimensions: length, structure, safety,
 * accuracy-hygiene, voice, media, discoverability. Pure string analysis,
 * offline, deterministic. These measure hygiene and shape — never truth.
 * Truth stays human (review) plus engine runs (validation frontmatter).
 */
export const CHECKS = ['length-desc', 'length-body', 'structure-headings', 'structure-table', 'code-fences', 'media-diagram', 'media-images', 'safety-destructive', 'safety-pipes', 'accuracy-placeholders', 'accuracy-urls', 'accuracy-ids', 'voice-gatekeeping', 'voice-sentences', 'voice-passive', 'discoverability-words'];

const BODY_FLOORS = { tutorial: [150, 400], guide: [150, 400], comparison: [150, 400], skill: [80, 200], reference: [0, 50], brief: [0, 0] };
const GATEKEEPING = /\b(simply|just|obviously|trivial(?:ly)?|easy|of course|as we all know)\b/i;
const PLACEHOLDER = /\b(TODO|TBD|FIXME|Lorem ipsum|XXX)\b|<<[^>]+>>|\[insert/i;
const DESTRUCTIVE = /(^|\s)rm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\s+("\/"|'\/'|\/\s|\/$|--no-preserve-root)|\bmkfs\b|:\(\)\s*{\s*:\|:\s*&\s*};/;
const PIPE_TO_SHELL = /\b(curl|wget)\b[^|\n]*\|\s*(sudo\s+)?(sh|bash)\b/;
const FENCED = /```(\w*)\n[\s\S]*?```/g;
const URL_RE = /https?:\/\/[^\s"'<>)]+/g;
const IMG_RE = /!\[([^\]]*)\]\([^)]+\)/g;

const words = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length;
const sentences = (s) => String(s ?? '').replace(/\s+/g, ' ').split(/[.!?]+/).map((x) => x.trim()).filter(Boolean);
const stripMd = (s) => String(s ?? '').replace(/```[\s\S]*?```/g, ' ').replace(/[#>*`|\-[\]()]/g, ' ');

function passiveShare(text) {
  const ss = sentences(text);
  if (!ss.length) return 0;
  const passive = ss.filter((x) => /\b(am|is|are|was|were|be|been|being)\b\s+\w+ed\b/i.test(x)).length;
  return passive / ss.length;
}

function avgSentence(text) {
  const ss = sentences(text);
  if (!ss.length) return 0;
  return ss.reduce((a, x) => a + words(x), 0) / ss.length;
}

export function reviewDraft(draft, { ids = new Set() } = {}) {
  const kind = draft.draft_kind ?? 'brief';
  const body = String(draft.body ?? '');
  const desc = String(draft.description ?? '');
  const checks = [];
  const add = (id, dimension, status, detail, value = null) => checks.push({ id, dimension, status, detail, value });

  const dl = desc.length;
  add('length-desc', 'length', dl >= 30 && dl <= 280 ? 'pass' : 'fail', `${dl} chars (need 30–280)`, dl);

  const [lo, hi] = BODY_FLOORS[kind] ?? [0, 0];
  const bw = words(body);
  add('length-body', 'length', kind === 'brief' || (kind === 'reference' && lo === 0 && bw === 0) ? 'pass' : bw >= hi ? 'pass' : bw >= lo ? 'warn' : 'fail', `${bw} words (warn <${lo}, pass ≥${hi})`, bw);

  const low = body.toLowerCase();
  const need = { tutorial: ['prereq', 'step'], guide: ['prereq', 'step'], skill: ['example'], comparison: ['criteria', 'verdict'], reference: [], brief: [] }[kind] ?? [];
  const need2 = { tutorial: ['unknown', 'inspect', 'verdict', 'trust'], guide: ['unknown', 'inspect', 'verdict', 'trust'] }[kind] ?? [];
  const missing = [...need.filter((h) => !low.includes(h)), ...(need2.length && !need2.some((h) => low.includes(h)) ? ['trust-section'] : [])];
  add('structure-headings', 'structure', need.length === 0 ? 'pass' : missing.length === 0 ? 'pass' : 'fail', missing.length ? `missing: ${missing.join(', ')}` : 'required sections present');

  const hasTable = body.split('\n').filter((l) => l.trim().startsWith('|')).length >= 2;
  add('structure-table', 'structure', kind !== 'comparison' ? 'pass' : hasTable ? 'pass' : 'fail', hasTable ? 'table present' : kind === 'comparison' ? 'comparison needs a criteria table' : 'n/a');

  const fences = [...body.matchAll(FENCED)];
  const needCode = ['tutorial', 'guide', 'skill'].includes(kind);
  add('code-fences', 'structure', !needCode ? 'pass' : fences.length === 0 ? 'fail' : fences.some((f) => !f[1]) ? 'warn' : 'pass', `${fences.length} fenced block(s)`);

  const hasMermaid = /```mermaid/.test(body);
  const hasImg = IMG_RE.test(body);
  IMG_RE.lastIndex = 0;
  const mediaOk = hasMermaid || hasTable || hasImg;
  add('media-diagram', 'media', ['tutorial', 'guide', 'comparison'].includes(kind) ? (mediaOk ? 'pass' : 'warn') : 'pass', mediaOk ? 'diagram/table/image present' : 'advisory: add a diagram, table, or image');

  const badImg = [...body.matchAll(IMG_RE)].filter((m) => !m[1].trim());
  add('media-images', 'media', badImg.length ? 'fail' : 'pass', badImg.length ? `${badImg.length} image(s) missing alt text` : 'all images have alt text');

  add('safety-destructive', 'safety', DESTRUCTIVE.test(body) ? 'fail' : 'pass', DESTRUCTIVE.test(body) ? 'destructive command pattern found' : 'no destructive patterns');
  add('safety-pipes', 'safety', PIPE_TO_SHELL.test(body) ? 'warn' : 'pass', PIPE_TO_SHELL.test(body) ? 'curl|sh pipe — review before running' : 'no shell-pipe downloads');

  add('accuracy-placeholders', 'accuracy-hygiene', PLACEHOLDER.test(body + desc) ? 'fail' : 'pass', 'placeholder scan');
  const urls = [...new Set([...(body.match(URL_RE) ?? []), ...(desc.match(URL_RE) ?? [])])];
  const badUrls = urls.filter((u) => { try { new URL(u); return false; } catch { return true; } });
  add('accuracy-urls', 'accuracy-hygiene', badUrls.length ? 'fail' : 'pass', `${urls.length} URL(s), ${badUrls.length} malformed (reachability never checked)`);
  const unknownIds = (draft.related ?? []).filter((id) => !ids.has(id));
  add('accuracy-ids', 'accuracy-hygiene', unknownIds.length ? 'fail' : 'pass', unknownIds.length ? `unknown ids: ${unknownIds.join(', ')}` : 'all related ids resolve');

  const gate = body.match(GATEKEEPING) ?? desc.match(GATEKEEPING);
  add('voice-gatekeeping', 'voice', gate ? 'fail' : 'pass', gate ? `banned word: "${gate[0]}"` : 'no gatekeeping words');
  const avg = avgSentence(body || desc);
  add('voice-sentences', 'voice', avg <= 18 ? 'pass' : avg <= 24 ? 'warn' : 'fail', `avg ${avg.toFixed(1)} words/sentence (guide ~15)`, Number(avg.toFixed(1)));
  const ps = passiveShare(body || desc);
  add('voice-passive', 'voice', ps > 0.25 ? 'warn' : 'pass', `${Math.round(ps * 100)}% passive (advisory)`, Number(ps.toFixed(2)));

  const dw = words(stripMd(body));
  add('discoverability-words', 'discoverability', kind === 'brief' ? 'pass' : dw >= 300 ? 'pass' : dw >= 100 ? 'warn' : 'fail', `${dw} indexable words`, dw);

  const score = { pass: checks.filter((c) => c.status === 'pass').length, warn: checks.filter((c) => c.status === 'warn').length, fail: checks.filter((c) => c.status === 'fail').length };
  return { score, checks };
}
