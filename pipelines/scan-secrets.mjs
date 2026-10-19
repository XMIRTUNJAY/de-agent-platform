#!/usr/bin/env node
/**
 * SECRET SCAN — hardcoded-credential sweep over registry records.
 *
 * Two halves, both read-only:
 *  1. LOCAL: every file under data/curated/, attributed to the nearest
 *     record (directory slug or id match). Catches our own accidents.
 *  2. REMOTE: top resources by quality score with an external github_url —
 *     repo tree via GitHub API, then content-scan of risky/small text files.
 *     Needs GITHUB_TOKEN (5000/hr); without it the remote half is skipped
 *     with a warning (60/hr anonymous is not enough for 50 repos).
 *
 * Findings NEVER include secret values — only { file, line, pattern,
 * likelyExample }. A resource earns `vulnerability_scan_at` only when the
 * scan completes with zero non-example hits; dirty ones keep their findings
 * and no timestamp (so the marketplace security score cannot reward them).
 * Curated YAML is never modified; everything merges in-memory like the
 * GitHub enrichment step.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { fetchText } from './lib/fetch.mjs';
import { repoIdentity } from './lib/identity.mjs';
import { ROOT } from './lib/load.mjs';

export const SECRET_PATTERNS = [
	{ id: 'aws-key', re: /\bAKIA[0-9A-Z]{16}\b/g },
	{ id: 'github-token', re: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g },
	{ id: 'github-pat', re: /github_pat_[A-Za-z0-9_]{80,}/g },
	{ id: 'private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
	{ id: 'npm-token', re: /\bnpm_[A-Za-z0-9]{36}\b/g },
	{ id: 'slack-token', re: /\bxox[bap]-[A-Za-z0-9-]{10,}\b/g },
	{ id: 'password-assign', re: /\b(password|passwd|pwd|secret)\s*[:=]\s*['"][^'"]{4,}['"]/gi },
	{ id: 'api-key-assign', re: /\b(api[_-]?key|apikey)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
];

// A hit is *likely* an example when the path or the value smells like one.
// Flagged either way — but only non-example hits block the clean timestamp.
const LIKELY_EXAMPLE = /(example|sample|test|fixture|mock|demo|placeholder|xxx|your-|todo|<|>|\.\.\.|changeme|password123)/i;
const RISKY_FILENAMES =
	/(^|\/)\.env(\.|$)|credentials|secrets?\.(ya?ml|json|toml|ini)|passwd|shadow|\.pem$|\.key$|id_rsa|\.p12$|\.pfx$|service-account|service_account/i;
const SCAN_EXT = /\.(js|mjs|cjs|ts|tsx|py|rb|go|rs|java|php|sh|bash|yaml|yml|json|toml|ini|env|txt|md|mdx|dockerfile)$/i;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.astro', '__pycache__', '.venv', 'venv']);

/** Scan text; returns findings without any secret values. */
export function scanText(text, filePath = '') {
	const findings = [];
	const lines = String(text ?? '').split('\n');
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		for (const { id, re } of SECRET_PATTERNS) {
			re.lastIndex = 0;
			if (re.test(line)) {
				findings.push({
					file: filePath,
					line: i + 1,
					pattern: id,
					likelyExample: LIKELY_EXAMPLE.test(filePath) || LIKELY_EXAMPLE.test(line),
				});
			}
		}
	}
	return findings;
}

function walkFiles(dir, out = []) {
	let entries = [];
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const e of entries) {
		const p = join(dir, e.name);
		if (e.isDirectory()) {
			if (!SKIP_DIRS.has(e.name)) walkFiles(p, out);
		} else if (SCAN_EXT.test(p)) {
			out.push(p);
		}
	}
	return out;
}

/** Attribute a local file to record ids: curated YAML holds LISTS of records,
 *  so parse each file and map it to every id/slug it declares. */
function buildFileIdMap() {
	const map = new Map(); // abs path -> string[]
	const root = join(ROOT, 'data', 'curated');
	const walk = (dir) => {
		let entries = [];
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const e of entries) {
			const p = join(dir, e.name);
			if (e.isDirectory()) {
				walk(p);
				continue;
			}
			if (!/\.(yaml|yml)$/.test(p)) continue;
			try {
				const doc = parseYaml(readFileSync(p, 'utf8'));
				const recs = Array.isArray(doc) ? doc : [doc];
				const ids = recs.flatMap((r) => (r && typeof r === 'object' ? [r.id, r.slug].filter(Boolean) : []));
				if (ids.length) map.set(p, [...new Set(ids)]);
			} catch {
				/* unparseable: skipped, never attributed */
			}
		}
	};
	walk(root);
	return map;
}

function attributeLocal(file, bySlugOrId, fileIdMap) {
	if (fileIdMap.has(file)) return fileIdMap.get(file);
	// Non-YAML content (SKILL.md, examples): nearest ancestor dir matching a slug/id.
	const rel = relative(join(ROOT, 'data', 'curated'), file).replace(/\\/g, '/');
	const parts = rel.split('/');
	for (let i = parts.length - 1; i >= 0; i--) {
		const stem = parts[i].replace(/\.(yaml|yml|md|mdx)$/, '');
		if (bySlugOrId.has(stem)) return [stem];
	}
	return [];
}

async function ghJson(url) {
	const res = await fetchText(url);
	if (!res?.ok || !res.body) throw new Error(`HTTP ${res?.status ?? 'none'}: ${url}`);
	return JSON.parse(res.body);
}

/** Remote scan of one repo. Returns findings (file paths are repo-relative). */
async function scanRepo(owner, repo, maxFiles = 6) {
	const findings = [];
	let tree;
	try {
		const t = await ghJson(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`);
		if (t.message) throw new Error(t.message);
		tree = (t.tree || []).filter((n) => n.type === 'blob');
	} catch (err) {
		return { skipped: 'tree failed: ' + String(err.message || err).slice(0, 120) };
	}
	const risky = tree.filter((n) => RISKY_FILENAMES.test(n.path));
	for (const n of risky) {
		findings.push({ file: n.path, line: null, pattern: 'risky-filename', likelyExample: /example|sample|test|fixture|docs/i.test(n.path) });
	}
	const candidates = tree
		.filter((n) => SCAN_EXT.test(n.path) && (n.size ?? 0) > 0 && (n.size ?? 0) < 100_000)
		.sort((a, b) => (RISKY_FILENAMES.test(b.path) ? 1 : 0) - (RISKY_FILENAMES.test(a.path) ? 1 : 0))
		.slice(0, maxFiles);
	for (const n of candidates) {
		try {
			const blob = await ghJson(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(n.path)}`);
			if (!blob.content || blob.encoding !== 'base64') continue;
			const text = Buffer.from(blob.content, 'base64').toString('utf8');
			for (const f of scanText(text, n.path)) findings.push(f);
		} catch {
			/* unreadable file: skip, tree already recorded */
		}
	}
	return { findings };
}

/**
 * Scan top resources. Mutates resource objects in place:
 *  - r.secret_findings = [...] (always, possibly empty)
 *  - r.vulnerability_scan_at = now (only when zero non-example hits)
 * Returns { scanned, skipped, dirty }.
 */
export async function scanResources(resources, opts = {}) {
	const now = new Date().toISOString();
	const limit = Number(process.env.SECRET_SCAN_LIMIT ?? opts.limit ?? 50);
	const token = !!process.env.GITHUB_TOKEN;
	const bySlugOrId = new Map();
	for (const r of resources) {
		bySlugOrId.set(r.id, r);
		if (r.slug) bySlugOrId.set(r.slug, r);
	}
	let scanned = 0;
	let skipped = 0;
	const dirty = [];

	// 1. LOCAL: our own curated tree (no network, always runs).
	const fileIdMap = buildFileIdMap();
	const localFiles = walkFiles(join(ROOT, 'data', 'curated'));
	const localHits = new Map();
	for (const f of localFiles) {
		let text = '';
		try {
			text = readFileSync(f, 'utf8');
		} catch {
			continue;
		}
		const rel = relative(ROOT, f).replace(/\\/g, '/');
		for (const hit of scanText(text, rel)) {
			for (const id of attributeLocal(f, bySlugOrId, fileIdMap)) {
				if (!localHits.has(id)) localHits.set(id, []);
				localHits.get(id).push(hit);
			}
		}
	}

	// 2. REMOTE: top external repos by quality score.
	const scored = [...resources]
		.map((r) => ({ r, q: r.scores?.quality ?? r.quality ?? 0 }))
		.filter(({ r }) => {
			const id = repoIdentity(r.github_url ?? '');
			return id && !/de-agent-platform/i.test(r.github_url ?? '');
		})
		.sort((a, b) => b.q - a.q)
		.slice(0, limit);

	const applyFindings = (r, findings) => {
		r.secret_findings = findings;
		const real = findings.filter((f) => !f.likelyExample);
		if (real.length === 0) {
			r.vulnerability_scan_at = now;
		} else {
			dirty.push({ id: r.id, hits: real.length });
		}
		scanned++;
	};

	for (const [id, hits] of localHits) {
		const r = bySlugOrId.get(id);
		if (r && !r._secretScanned) {
			applyFindings(r, hits);
			r._secretScanned = true;
		}
	}
	// Records whose local files were all clean still count as scanned.
	{
		const seen = new Set();
		for (const f of localFiles) {
			for (const id of attributeLocal(f, bySlugOrId, fileIdMap)) seen.add(id);
		}
		for (const id of seen) {
			const r = bySlugOrId.get(id);
			if (r && !r._secretScanned) {
				applyFindings(r, []);
				r._secretScanned = true;
			}
		}
	}
	if (!token) {
		skipped = scored.length;
	} else {
		for (const { r } of scored) {
			if (r._secretScanned) continue;
			const id = repoIdentity(r.github_url ?? '');
			if (!id) {
				skipped++;
				continue;
			}
			const res = await scanRepo(id.owner, id.repo);
			if (res.skipped) {
				skipped++;
				continue;
			}
			applyFindings(r, res.findings);
			r._secretScanned = true;
		}
	}
	// Drop internal flags; untouched resources simply carry no findings
	// and no timestamp (never claim a scan that did not happen).
	for (const r of resources) {
		delete r._secretScanned;
	}
	return { scanned, skipped, dirty };
}
