import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Regression test: API route modules are loaded by Astro during `astro build`
// (static prerender). A top-level `import ... from '@/lib/db'` executes
// better-sqlite3's native init (new Database + WAL + schema) inside the build
// worker, which segfaults the static build (exit -1073741819). DB access must
// be lazy (`await import('@/lib/db')` inside handlers) so module top level
// stays native-free. `import type` is erased at build and always allowed.
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'pages', 'api');

function files(dir, out = []) {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) files(p, out);
		else if (/\.ts$/.test(p)) out.push(p);
	}
	return out;
}

const STATIC_DB_IMPORT = /^import\s+(?!type\b)[^;]*from\s+['"](@\/lib\/db|\.{1,2}\/[^'"]*lib\/db)['"]/m;

describe('api routes: no top-level @/lib/db import (static-build segfault guard)', () => {
	for (const f of files(root)) {
		it(path.relative(root, f), () => {
			const src = fs.readFileSync(f, 'utf8');
			assert.ok(
				!STATIC_DB_IMPORT.test(src),
				`${path.basename(f)} has a top-level db import; use await import('@/lib/db') inside handlers`,
			);
		});
	}
});
