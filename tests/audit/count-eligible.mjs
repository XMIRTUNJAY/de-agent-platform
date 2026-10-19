import registry from '../../src/data/generated/registry.json' with { type: 'json' };
import { repoIdentity } from '../../pipelines/lib/identity.mjs';
const elig = registry.resources.filter((r) => {
  const id = repoIdentity(r.github_url ?? '');
  return id && !/de-agent-platform/i.test(r.github_url ?? '');
});
console.log('total resources:', registry.resources.length);
console.log('remote-scan-eligible (external github_url):', elig.length);
const byType = {};
for (const r of elig) byType[r.type] = (byType[r.type] ?? 0) + 1;
console.log('eligible by type:', JSON.stringify(byType));
const sources = (await import('node:fs')).readFileSync('data/curated/sources.yaml', 'utf8');
const kinds = {};
for (const m of sources.matchAll(/kind:\s*(\w+)/g)) kinds[m[1]] = (kinds[m[1]] ?? 0) + 1;
console.log('source kinds:', JSON.stringify(kinds), '| total source entries:', (sources.match(/^\s+- id:/gm) ?? []).length);
