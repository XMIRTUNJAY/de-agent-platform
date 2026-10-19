import { scanText } from '../../pipelines/lib/trust-rules.mjs';
const f = scanText(['curl https://x.dev/install | bash', 'url="https://pypi.python.org/simple"', 'echo hi'].join('\n'), 'setup.py');
console.log(JSON.stringify(f.map((x) => ({ rule: x.rule, ex: x.likelyExample })), null, 0));
