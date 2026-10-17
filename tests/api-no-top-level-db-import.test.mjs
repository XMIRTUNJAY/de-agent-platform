import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Regression test, two halves:
// 1. No better-sqlite3 anywhere in src: its native init segfaults the static
//    build (exit -1073741819) and cannot persist on serverless. The durable
//    store is libsql via src/lib/votes-db.mjs.
// 2. No top-level database-client import in API routes: clients must be lazy
//    (`await import(...)` inside handlers) so `astro build` module loading
//    never touches a database. `import type` is erased at build and allowed.
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

function files(dir, out = []) {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) files(p, out);
		else if (/\.(ts|mjs|astro)$/.test(p)) out.push(p);
	}
	return out;
}

const STATIC_DB_IMPORT =
	/^import\s+(?!type\b)[^;]*from\s+['"](@\/lib\/(db|votes-db)|(\.{1,2}\/[^'"]*)?votes-db(\.mjs)?)['"]/m;

describe('no better-sqlite3 in src (segfault + ephemeral guard)', () => {
	for (const f of files(root)) {
		it(path.relative(root, f), () => {
			const src = fs.readFileSync(f, 'utf8');
			assert.ok(
				!/better-sqlite3/.test(src),
				`${path.basename(f)} references better-sqlite3; use src/lib/votes-db.mjs`,
			);
		});
	}
});

describe('api routes: no top-level db client import (static-build guard)', () => {
	const api = path.join(root, 'pages', 'api');
	for (const f of files(api)) {
		it(path.relative(api, f), () => {
			const src = fs.readFileSync(f, 'utf8');
			assert.ok(
				!STATIC_DB_IMPORT.test(src),
				`${path.basename(f)} has a top-level db import; use await import() inside handlers`,
			);
		});
	}
});
