/**
 * FETCH — polite HTTP for the discovery pipeline.
 * Rules: explicit User-Agent, timeout, limited redirects, never throw on
 * a source being down (down sources are skipped, the run continues).
 */

const UA = 'de-agent-discovery/0.1 (+https://github.com/de-agent/platform; registry crawler)';
const TIMEOUT_MS = 15_000;
// Some hosts (YouTube feed endpoint) 404/500 non-browser UAs, including our
// polite crawler signature, so they get a plain browser-like UA instead.
const UA_OVERRIDES = [
  [/youtube\.com$/, 'Mozilla/5.0'],
];

export async function fetchText(url, { timeout = TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  const host = new URL(url).hostname.replace(/^www\./, '');
  const override = UA_OVERRIDES.find(([re]) => re.test(host))?.[1] ??
    UA_OVERRIDES.find(([re]) => re.test(new URL(url).hostname))?.[1];
  const headers = {
    'User-Agent': override ?? UA,
    Accept: 'application/rss+xml, application/atom+xml, application/json, text/xml, */*',
  };
  // GitHub rest API is ~60 req/h unauthenticated; with a token it's 5k.
  if (/^api\.github\.com$/.test(host) && process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers, redirect: 'follow' });
    if (!res.ok) return { ok: false, status: res.status, body: null };
    const body = await res.text();
    return { ok: true, status: res.status, body };
  } catch (err) {
    return { ok: false, status: null, body: null, error: String(err?.message ?? err) };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url, opts = {}) {
  const res = await fetchText(url, opts);
  if (!res.ok) return { ...res, json: null };
  try {
    return { ...res, json: JSON.parse(res.body) };
  } catch {
    return { ...res, ok: false, json: null, error: 'invalid JSON' };
  }
}

/**
 * fetchWithRetry — retry a fetch-shaped thunk on failure with exponential
 * backoff. Never throws; returns the last result. `sleep` is injectable
 * so tests run without real timers.
 */
export async function fetchWithRetry(fn, { retries = 2, baseMs = 400, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let last = { ok: false, error: 'no attempts' };
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    last = await fn();
    if (last.ok) return last;
    if (attempt <= retries) await sleep(baseMs * 2 ** (attempt - 1));
  }
  return last;
}
