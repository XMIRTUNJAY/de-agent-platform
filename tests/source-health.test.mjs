import test from 'node:test';
import assert from 'node:assert/strict';
import { recordResult, backoffMs, appendDeadLetter, loadHealthFile } from '../pipelines/lib/source-health.mjs';

test('recordResult tracks success and consecutive failures', () => {
  let s = {};
  s = recordResult(s, 'aws-big-data', { ok: true, items: 5, drafted: 2 });
  assert.equal(s['aws-big-data'].consecutive_failures, 0);
  assert.equal(s['aws-big-data'].last_status, 'ok');
  assert.equal(s['aws-big-data'].last_items, 5);
  s = recordResult(s, 'aws-big-data', { ok: false, error: 'boom' });
  assert.equal(s['aws-big-data'].consecutive_failures, 1);
  assert.equal(s['aws-big-data'].last_status, 'error');
  assert.equal(s['aws-big-data'].last_error, 'boom');
  assert.ok(s['aws-big-data'].last_success, 'success timestamp preserved across failure');
});

test('backoff grows exponentially', () => {
  assert.ok(backoffMs(1, 200) >= 200);
  assert.ok(backoffMs(2, 200) > backoffMs(1, 200));
  assert.equal(backoffMs(1, 400), 400);
  assert.equal(backoffMs(3, 400), 1600);
});

test('fetchWithRetry retries then succeeds', async () => {
  const { fetchWithRetry } = await import('../pipelines/lib/fetch.mjs');
  let n = 0;
  const r = await fetchWithRetry(async () => (++n < 2 ? { ok: false, error: 'flaky' } : { ok: true }), {
    retries: 3,
    baseMs: 1,
  });
  assert.equal(r.ok, true);
  assert.equal(n, 2);
});

test('fetchWithRetry returns last failure after exhausting retries', async () => {
  const { fetchWithRetry } = await import('../pipelines/lib/fetch.mjs');
  let n = 0;
  const r = await fetchWithRetry(
    async () => {
      n++;
      return { ok: false, error: `e${n}` };
    },
    { retries: 1, baseMs: 1 }
  );
  assert.equal(r.ok, false);
  assert.equal(n, 2);
  assert.equal(r.error, 'e2');
});

test('dead-letter appends with a 500-entry cap', () => {
  const store = new Map();
  const fs = {
    existsSync: (p) => store.has(p),
    readFileSync: (p) => store.get(p),
    mkdirSync: () => {},
    dirname: (p) => '.',
    writeFileSync: (p, v) => store.set(p, String(v)),
  };
  for (let i = 0; i < 505; i++) appendDeadLetter('dl.json', { source: 's', error: `e${i}` }, fs);
  const cur = JSON.parse(store.get('dl.json'));
  assert.equal(cur.length, 500);
  assert.equal(cur.at(-1).error, 'e504');
});

test('loadHealthFile returns {} when missing or corrupt', () => {
  const missing = { existsSync: () => false, readFileSync: () => '' };
  assert.deepEqual(loadHealthFile('x.json', missing), {});
  const corrupt = { existsSync: () => true, readFileSync: () => '{nope' };
  assert.deepEqual(loadHealthFile('x.json', corrupt), {});
});
