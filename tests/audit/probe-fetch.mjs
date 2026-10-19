import { fetchText } from '../../pipelines/lib/fetch.mjs';
const t = await fetchText('https://api.github.com/rate_limit');
const j = JSON.parse(t);
console.log('core:', JSON.stringify(j.resources?.core));
