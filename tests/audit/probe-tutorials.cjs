const http = require('http');
http.get('http://127.0.0.1:4321/tutorials', (r) => {
  let d = '';
  r.on('data', (c) => (d += c));
  r.on('end', () => {
    const chips = [...d.matchAll(/<span class="chip[^"]*"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]).slice(0, 8);
    console.log('chips:', chips);
    console.log('h1:', (d.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]);
  });
}).on('error', (e) => console.log('ERR', e.message));
