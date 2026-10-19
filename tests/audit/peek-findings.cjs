const f = require('C:/Users/kumar/de-agent-platform/src/data/generated/trust-findings.json');
for (const [url, r] of Object.entries(f.resources)) {
  const actionable = (r.findings ?? []).filter((x) => !x.likelyExample);
  if (!actionable.length) continue;
  const critical = actionable.filter((x) => x.risk === 'critical' || x.risk === 'high');
  if (!critical.length && !r.flags) continue;
  console.log('\n=== ' + url + (r.remote ? '  [' + r.remote.repo + ']' : ''));
  for (const x of critical.slice(0, 4)) {
    console.log(`  [${x.risk}] ${x.rule} @ ${x.file}:${x.line}`);
    console.log('    ' + x.snippet.slice(0, 110));
  }
}
