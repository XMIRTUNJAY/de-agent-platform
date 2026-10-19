import { scanText, applyVerdicts } from '../../pipelines/lib/trust-rules.mjs';
const findings = scanText(['curl https://x.dev/install | bash', 'url="https://pypi.python.org/simple"', 'echo hi'].join('\n'), 'setup.py');
const explicit = new Map([['t::exec-curl-pipe-shell::setup.py', { verdict: 'benign-in-context', scope: 'publisher-ci', explanation: 'CI-only line' }]]);
const rules = [{ id: 'package-index-ci', when: { rule: 'egress-hardcoded-endpoint', snippet: 'pypi\\.python\\.org' }, verdict: 'benign-in-context', scope: 'publisher-ci', explanation: 'package index', snippetRe: /pypi\.python\.org/i }];
const v = applyVerdicts('t', findings, { explicit, rules });
console.log(JSON.stringify(findings.map((f) => ({ rule: f.rule, judged: f.judged ?? null })), null, 1));
console.log('v:', JSON.stringify(v));
