// Pipeline audit fixes (quick wins 1-6, 8-10) — TDD: these tests were written
// BEFORE the fixes and watched failing. Each test names the production change
// that would make it pass.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempRoot = () => mkdtempSync(join(tmpdir(), 'deagent-paf-'));

// ---------------------------------------------------------------- QW1: ghJson
// ghJson must read fetchText's {ok,status,body} shape — the old code tested the
// always-truthy result object and JSON.parse("[object Object]") threw for
// every file, so install-manifest proposals never worked.
describe('QW1 ghJson reads fetchText body', () => {
  test('parses body on ok response', async () => {
    const { ghJson } = await import('../pipelines/generate-install-manifests.mjs');
    const out = await ghJson('https://api.github.com/x', async () => ({ ok: true, status: 200, body: '{"x":1}' }));
    assert.deepEqual(out, { x: 1 });
  });
  test('throws with status on non-ok response', async () => {
    const { ghJson } = await import('../pipelines/generate-install-manifests.mjs');
    await assert.rejects(
      () => ghJson('https://api.github.com/x', async () => ({ ok: false, status: 404, body: 'Not Found' })),
      /404/,
    );
  });
});

// ------------------------------------------------- QW2: repo-extract res.body
// fetchText returns {ok,status,body}; consumers reading res.text stringified
// undefined into every lane-2 draft.
describe('QW2 repo-extract reads body not text', () => {
  test('fetchSkillDoc returns SKILL.md content', async () => {
    const { fetchSkillDoc } = await import('../pipelines/lib/repo-extract.mjs');
    const doc = await fetchSkillDoc('o', 'r', 'main', ['SKILL.md'], {
      fetchText: async () => ({ ok: true, status: 200, body: '---\nname: demo\n---\nUse this skill.' }),
    });
    assert.equal(doc, '---\nname: demo\n---\nUse this skill.');
  });
  test('fetchSkillDoc returns empty on non-ok', async () => {
    const { fetchSkillDoc } = await import('../pipelines/lib/repo-extract.mjs');
    const doc = await fetchSkillDoc('o', 'r', 'main', ['SKILL.md'], {
      fetchText: async () => ({ ok: false, status: 404, body: '404' }),
    });
    assert.equal(doc, '');
  });
  test('extractRepo carries real readme, not "undefined"', async () => {
    const { extractRepo } = await import('../pipelines/lib/repo-extract.mjs');
    const fetchJson = async (url) => {
      if (/api\.github\.com\/repos\/o\/r$/.test(url)) {
        const meta = { default_branch: 'main', license: { spdx_id: 'MIT' }, stargazers_count: 5, forks_count: 1, description: 'd', topics: [] };
        return { ok: true, status: 200, body: JSON.stringify(meta), json: meta };
      }
      if (/\/git\/trees\//.test(url)) {
        const tree = { tree: [], truncated: false };
        return { ok: true, status: 200, body: JSON.stringify(tree), json: tree };
      }
      return { ok: false, status: 404, body: '', json: null };
    };
    const out = await extractRepo('https://github.com/o/r', {
      fetchJson,
      fetchText: async () => ({ ok: true, status: 200, body: '# Demo\n\n## Install\n\n```bash\npip install demo\n```' }),
    });
    assert.equal(out.lane, 'extract');
    assert.ok(out.installSection.includes('pip install demo'), 'install section must carry fetched body');
    assert.ok(out.installCandidates.some((c) => c.includes('pip install demo')), 'install candidates parsed from readme body');
  });
});

// ------------------------------------------ QW3+QW8: enrichment cache freshness
// Cache entries stored the repo's GitHub updated_at, so the 24h TTL never hit
// and every run refetched everything; 404s were never negatively cached so
// dead repos retried forever.
describe('QW3+QW8 enrichment cache', () => {
  const H = 3600 * 1000;
  test('isCacheFresh uses fetched_at, missing fetched_at is stale', async () => {
    const m = await import('../pipelines/github-enrichment.mjs');
    const now = Date.now();
    assert.equal(m.isCacheFresh(null), false);
    assert.equal(m.isCacheFresh({ stars: 1 }), false, 'legacy entry without fetched_at must refetch once');
    assert.equal(m.isCacheFresh({ stars: 1, fetched_at: new Date(now - 1 * H).toISOString() }), true);
    assert.equal(m.isCacheFresh({ stars: 1, fetched_at: new Date(now - 25 * H).toISOString() }), false);
  });
  test('negative (missing) entries have their own TTL', async () => {
    const m = await import('../pipelines/github-enrichment.mjs');
    const now = Date.now();
    assert.equal(m.isNegativeCacheFresh({ missing: true, fetched_at: new Date(now - 1 * H).toISOString() }), true);
    assert.equal(m.isNegativeCacheFresh({ missing: true, fetched_at: new Date(now - 200 * H).toISOString() }), false);
    assert.equal(m.isNegativeCacheFresh({ stars: 1, fetched_at: new Date().toISOString() }), false, 'positive entries are not negative entries');
  });
  test('enrichResources skips fetch for fresh cache, no refetch for fresh 404', async () => {
    const m = await import('../pipelines/github-enrichment.mjs');
    const root = tempRoot();
    try {
      const cacheDir = join(root, 'github');
      mkdirSync(cacheDir, { recursive: true });
      const now = new Date().toISOString();
      writeFileSync(join(cacheDir, 'enrichment.json'), JSON.stringify({
        updated_at: now,
        repos: {
          'live/repo': { stars: 100, forks: 10, contributors_count: 4, recent_commits: 5, releases_count: 2, open_issues: 3, fetched_at: now },
          'dead/repo': { missing: true, fetched_at: now },
        },
      }), 'utf8');
      let fetchCalls = 0;
      const resources = [
        { id: 'a', github_url: 'https://github.com/live/repo' },
        { id: 'b', github_url: 'https://github.com/dead/repo' },
      ];
      await m.enrichResources(resources, {
        fetchRepo: async () => { fetchCalls++; return { stars: 1 }; },
        cacheDir,
      });
      assert.equal(fetchCalls, 0, 'fresh cache + fresh negative entry must not hit the API');
      assert.ok(resources[0].marketplace.quality_scores.community > 0, 'cached entry yields community score');
      assert.ok(!('community' in (resources[1].marketplace?.quality_scores ?? {})), 'negative entry must not score');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

// ------------------------------------------------- QW4: executions by resource
// Executions were keyed by manifest.id but looked up by resource.id, so the
// 0.20 performance weight was dead for every resource.
describe('QW4 execution provenance carries resource_id', () => {
  test('runManifest records resource_id in provenance', async () => {
    const { runManifest } = await import('../pipelines/lib/exec-runner.mjs');
    const manifest = { id: 'm1', version: '1', commands: [{ name: 'c', argv: ['echo', 'hi'], timeout_ms: 1000 }], requirements: [], limits: {} };
    const out = await runManifest(manifest, { backend: 'dry', resourceId: 'my-resource' });
    assert.equal(out.provenance.resource_id, 'my-resource');
  });
  test('loadExecutions keys on resource_id, legacy files fall back to manifest', async () => {
    const { loadExecutions } = await import('../pipelines/lib/exec-runner.mjs');
    const root = tempRoot();
    try {
      const dir = join(root, 'executions');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'a.json'), JSON.stringify({ provenance: { manifest: 'm1', resource_id: 'res-1' }, state: 'passed', commands: [] }), 'utf8');
      writeFileSync(join(dir, 'b.json'), JSON.stringify({ provenance: { manifest: 'legacy-m' }, state: 'passed', commands: [] }), 'utf8');
      const exec = loadExecutions(dir);
      assert.ok(exec['res-1'], 'resource-keyed');
      assert.ok(exec['legacy-m'], 'legacy manifest-keyed fallback');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  test('loadExecutions warns on unparsable files instead of silently skipping', async () => {
    const { loadExecutions } = await import('../pipelines/lib/exec-runner.mjs');
    const root = tempRoot();
    const errs = [];
    const origErr = console.error;
    console.error = (m) => errs.push(String(m));
    try {
      const dir = join(root, 'executions');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'bad.json'), '{broken', 'utf8');
      loadExecutions(dir);
      assert.ok(errs.some((m) => m.includes('bad.json')), 'parse failures must be reported');
    } finally { console.error = origErr; rmSync(root, { recursive: true, force: true }); }
  });
});

// ------------------------------------- QW5: freshness before marketplace score
// r.stale was only set inside emit(), so VERIFY/FRESHNESS/ELIGIBILITY read
// undefined; archived repos got the maintenance bonus.
describe('QW5 applyFreshness sets r.stale + counts', () => {
  test('marks stale records and returns counts', async () => {
    const { applyFreshness } = await import('../pipelines/lib/freshness.mjs');
    const old = new Date(Date.now() - 200 * 86400000).toISOString();
    const resources = [
      { id: 'fresh', last_verified: new Date().toISOString() },
      { id: 'moldy', last_verified: old },
      { id: 'never' },
    ];
    const counts = applyFreshness(resources, new Date().toISOString());
    assert.equal(resources[0].stale, false);
    assert.equal(resources[1].stale, true, 'over 180 days must be stale');
    assert.equal(resources[2].stale, true, 'never verified must be stale');
    assert.ok(counts.stale === 2 && 'archived' in counts && 'upstream_changed' in counts);
  });
});

// -------------------------------------- QW6: contributors via Link header
// The per_page:1 response was discarded then paginate() walked the entire
// contributor list (30+ API calls on big repos).
describe('QW6 contributor count from Link header', () => {
  test('counts last page from rel=last without paginating', async () => {
    const m = await import('../pipelines/github-enrichment.mjs');
    let paginateCalls = 0;
    const kit = {
      repos: {
        get: async () => ({ data: { stargazers_count: 1, forks_count: 1, open_issues_count: 0, license: { spdx_id: 'MIT' }, default_branch: 'main', created_at: '', updated_at: '', pushed_at: '' } }),
        listContributors: async () => ({ data: [{ login: 'a' }], headers: { link: '<https://api.github.com/repos/o/r/contributors?per_page=1&page=41>; rel="prev", <https://api.github.com/repos/o/r/contributors?per_page=1&page=42>; rel="last"' } }),
        listCommits: async () => ({ data: [{}, {}] }),
        listReleases: async () => ({ data: [] }),
      },
      paginate: async () => { paginateCalls++; return []; },
    };
    const data = await m.fetchRepoData('o', 'r', kit);
    assert.equal(data.contributors_count, 42, 'per_page=1 + rel=last page number = total contributors');
    assert.equal(paginateCalls, 0, 'must not walk the contributor list');
  });
  test('small repos without Link header count from data', async () => {
    const m = await import('../pipelines/github-enrichment.mjs');
    const kit = {
      repos: {
        get: async () => ({ data: { stargazers_count: 1, forks_count: 1, open_issues_count: 0, license: null, default_branch: 'main', created_at: '', updated_at: '', pushed_at: '' } }),
        listContributors: async () => ({ data: [{ login: 'a' }, { login: 'b' }], headers: {} }),
        listCommits: async () => ({ data: [] }),
        listReleases: async () => ({ data: [] }),
      },
      paginate: async () => [],
    };
    const data = await m.fetchRepoData('o', 'r', kit);
    assert.equal(data.contributors_count, 2);
  });
});

// ---------------------------------------------------- QW9: slim search index
// search-index.json carried a ~230KB duplicated text blob the palette never
// searched; a truncated keywords field keeps long-tail search at low cost.
describe('QW9 search-index entries carry keywords, not text', () => {
  test('entry has keywords with long-tail fields and no text', async () => {
    const { buildSearchIndex } = await import('../pipelines/lib/emit.mjs');
    const entries = buildSearchIndex([{
      id: 'r1', slug: 'r1', type: 'skill', typeLabel: 'Skill', title: 'T', tagline: 'tg',
      description: 'd', summary: 's', category: 'c', categoryTitle: 'ct', stage: 'st',
      difficulty: 'beginner', verification: 'registry', tags: ['tag1'],
      technologies: ['apache/spark'], learning_objectives: ['learn X'],
      symptoms: ['symptom Y'], possible_causes: [], when_to_use: ['when Z'],
      url: '/skills/r1/', security_flags: [], eligibility: 'eligible',
    }], {});
    const e = entries[0];
    assert.ok(!('text' in e), 'duplicated text blob must go');
    assert.ok(e.keywords.includes('learn X') && e.keywords.includes('symptom Y') && e.keywords.includes('when Z') && e.keywords.includes('tag1'));
    assert.ok(e.keywords.length <= 200, 'keywords must be truncated, not another unbounded blob');
  });
});

// ------------------------------------------------------- QW10: atomic writes
// Direct writeFileSync to final paths could leave a truncated registry.json
// behind if the process died mid-write.
describe('QW10 atomicWrite via tmp+rename', () => {
  test('writes content and leaves no tmp files', async () => {
    const { atomicWrite } = await import('../pipelines/lib/emit.mjs');
    const root = tempRoot();
    try {
      const file = join(root, 'out.json');
      atomicWrite(file, '{"a":1}\n');
      assert.equal(readFileSync(file, 'utf8'), '{"a":1}\n');
      assert.deepEqual(readdirSync(root), ['out.json'], 'no .tmp leftovers');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
