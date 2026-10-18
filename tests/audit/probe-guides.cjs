const http = require('http');
http.get('http://127.0.0.1:4321/guides', (r) => {
  let d = '';
  r.on('data', (c) => (d += c));
  r.on('end', () => {
    const links = [...d.matchAll(/href="(\/guides\/[^"]+)"/g)].map((m) => m[1]);
    console.log('links:', [...new Set(links)]);
    const sections = [...d.matchAll(/<p class="mono-label"[^>]*>([^<]+)<\/p>/g)].map((m) => m[1]).slice(0, 6);
    console.log('badges:', sections);
  });
}).on('error', (e) => console.log('ERR', e.message));
