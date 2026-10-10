/**
 * SOURCE-HEALTH — per-source discovery health, retry backoff math, dead-letter.
 * Pure functions first (testable); thin fs adapters kept here so discover.mjs
 * stays small. A source failure is recorded, never thrown: the run continues.
 */

export function backoffMs(attempt, baseMs = 400) {
  return baseMs * 2 ** Math.max(0, attempt - 1);
}

export function recordResult(state, sourceId, result) {
  const prev = state[sourceId] ?? {
    checks: 0,
    successes: 0,
    failures: 0,
    consecutive_failures: 0,
    last_success: null,
  };
  const now = new Date().toISOString();
  const failed = !result.ok;
  return {
    ...state,
    [sourceId]: {
      checks: prev.checks + 1,
      successes: prev.successes + (failed ? 0 : 1),
      failures: prev.failures + (failed ? 1 : 0),
      consecutive_failures: failed ? prev.consecutive_failures + 1 : 0,
      last_status: failed ? 'error' : 'ok',
      last_error: failed ? String(result.error ?? 'unknown') : null,
      last_run: now,
      last_success: failed ? (prev.last_success ?? null) : now,
      last_items: result.items ?? null,
      last_drafted: result.drafted ?? null,
    },
  };
}

export function loadHealthFile(path, { existsSync, readFileSync } = {}) {
  return loadJsonFile(path, {}, { existsSync, readFileSync });
}

export function saveHealthFile(path, state, { mkdirSync, writeFileSync, dirname } = {}) {
  const payload = { generated_at: new Date().toISOString(), sources: state };
  writeJsonFile(path, payload, { mkdirSync, writeFileSync, dirname });
}

export function appendDeadLetter(path, entry, { existsSync, readFileSync, mkdirSync, writeFileSync, dirname } = {}) {
  const cur = loadJsonFile(path, [], { existsSync, readFileSync });
  cur.push({ at: new Date().toISOString(), ...entry });
  writeJsonFile(path, cur.slice(-500), { mkdirSync, writeFileSync, dirname });
}

function loadJsonFile(path, fallback, fs) {
  try {
    if (fs?.existsSync && !fs.existsSync(path)) return fallback;
    const raw = fs?.readFileSync ? fs.readFileSync(path, 'utf8') : null;
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonFile(path, data, fs) {
  if (fs?.dirname && fs?.mkdirSync) {
    const { existsSync, mkdirSync, dirname } = fs;
    try {
      if (existsSync && !existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
      else if (!existsSync) mkdirSync(dirname(path), { recursive: true });
    } catch {
      // best effort; caller handles write errors
    }
  }
  if (fs?.writeFileSync) fs.writeFileSync(path, JSON.stringify(data, null, 1) + '\n', 'utf8');
}
