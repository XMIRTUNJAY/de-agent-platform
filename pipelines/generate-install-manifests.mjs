#!/usr/bin/env node
/**
 * INSTALL MANIFEST PROPOSALS — derive install commands from upstream repos.
 *
 * Safety doctrine (non-negotiable): manifests EXECUTE on user machines via
 * the install API. This script only ever PROPOSES, into data/drafts/ for
 * human review. Nothing merges automatically; a curator promotes a draft by
 * copying the block into the curated record after testing on a clean machine.
 *
 * Source-pointer rule: manifests reference UPSTREAM artifacts only
 * (PyPI/npm registry, upstream repo). Nothing is vendored into this repo.
 *
 * Confidence policy:
 *  - high:   package name unambiguous + single binary/script entry (verifiable)
 *  - medium: package name clear, verify step unknown (install only)
 *  - skip:   libraries without binaries, skills (convention varies by agent),
 *            MCP servers (config snippets need humans), ambiguous names.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { fetchText } from './lib/fetch.mjs';
import { repoIdentity } from './lib/identity.mjs';
import { ROOT } from './lib/load.mjs';

const norm = (s) => String(s ?? '').toLowerCase().replace(/[-_.]+/g, '');

/**
 * Fetch a GitHub API JSON resource. fetchText resolves to {ok,status,body} —
 * the old code tested the always-truthy result object and then fed
 * "[object Object]" to JSON.parse, so every fetch threw and the feature
 * never proposed anything. Second param is injectable for tests.
 */
export async function ghJson(url, fetchImpl = fetchText) {
	const res = await fetchImpl(url);
	if (!res?.ok) throw new Error(`gh ${res?.status ?? 'network'}: ${url}`);
	try {
		return JSON.parse(res.body);
	} catch (e) {
		throw new Error(`gh invalid JSON from ${url}: ${e.message}`);
	}
}

async function ghFile(owner, repo, filePath) {
	const blob = await ghJson(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`);
	if (!blob.content || blob.encoding !== 'base64') return null;
	const text = Buffer.from(blob.content, 'base64').toString('utf8');
	if (text.length > 200_000) return null;
	return text;
}

/**
 * Pure: propose a manifest from fetched package files.
 * files: { 'package.json'?: string, 'pyproject.toml'?: string, 'setup.py'?: string, 'go.mod'?: string }
 * repoName: upstream repo slug, used for the name-match confidence gate.
 * Returns { manifest, confidence, evidence, reason? } — manifest null when skipping.
 */
export function proposeManifest(files, repoName) {
	const want = norm(repoName).replace(/^(python|node|js|ts)-/, '');
	// Python: pyproject [project] name + [project.scripts] single entry.
	if (files['pyproject.toml']) {
		const name = (files['pyproject.toml'].match(/^\s*name\s*=\s*["']([^"']+)["']/m) || [])[1];
		const scripts = [...files['pyproject.toml'].matchAll(/^\s*([A-Za-z0-9_.-]+)\s*=\s*["'][^"']+:[^"']+["']/gm)].map((m) => m[1]);
		if (name && (norm(name) === want || want.includes(norm(name)) || norm(name).includes(want))) {
			const manifest = {
				commands: [{ name: `install-${name}`, argv: ['pip', 'install', name], timeout_ms: 180000 }],
				requirements: ['python >= 3.8', 'pip'],
				limits: { timeout_ms: 240000, max_output_bytes: 500000 },
			};
			if (scripts.length === 1) {
				manifest.commands.push({ name: 'verify-install', argv: [scripts[0], '--version'], timeout_ms: 15000 });
				return { manifest, confidence: 'high', evidence: ['pyproject.toml name + single script entry'] };
			}
			return { manifest, confidence: 'medium', evidence: ['pyproject.toml name match; verify step needs a human'] };
		}
		return { manifest: null, confidence: 'skip', reason: 'pyproject name does not match repo; ambiguous' };
	}
	if (files['setup.py']) {
		const name = (files['setup.py'].match(/name\s*=\s*['"]([^'"]+)['"]/) || [])[1];
		if (name && (norm(name) === want || want.includes(norm(name)))) {
			return {
				manifest: {
					commands: [{ name: `install-${name}`, argv: ['pip', 'install', name], timeout_ms: 180000 }],
					requirements: ['python >= 3.8', 'pip'],
					limits: { timeout_ms: 240000, max_output_bytes: 500000 },
				},
				confidence: 'medium',
				evidence: ['setup.py name match; verify step needs a human'],
			};
		}
		return { manifest: null, confidence: 'skip', reason: 'setup.py name ambiguous' };
	}
	// Node: package.json name + single bin entry.
	if (files['package.json']) {
		let pkg = null;
		try {
			pkg = JSON.parse(files['package.json']);
		} catch {
			return { manifest: null, confidence: 'skip', reason: 'package.json unparseable' };
		}
		const bins = pkg.bin && typeof pkg.bin === 'object' ? Object.keys(pkg.bin) : typeof pkg.bin === 'string' ? [pkg.name] : [];
		if (pkg.name && (norm(pkg.name.replace(/^@[^/]+\//, '')) === want || want.includes(norm(pkg.name)))) {
			if (bins.length === 1) {
				return {
					manifest: {
						commands: [
							{ name: `install-${pkg.name}`, argv: ['npm', 'install', '-g', pkg.name], timeout_ms: 180000 },
							{ name: 'verify-install', argv: [bins[0], '--version'], timeout_ms: 15000 },
						],
						requirements: ['node >= 18', 'npm'],
						limits: { timeout_ms: 240000, max_output_bytes: 500000 },
					},
					confidence: 'high',
					evidence: ['package.json name + single bin entry'],
				};
			}
			return { manifest: null, confidence: 'skip', reason: 'node library without a single binary; no install UX' };
		}
		return { manifest: null, confidence: 'skip', reason: 'package name does not match repo; ambiguous' };
	}
	// Go: module path install.
	if (files['go.mod']) {
		const mod = (files['go.mod'].match(/^module\s+(\S+)/m) || [])[1];
		if (mod) {
			return {
				manifest: {
					commands: [{ name: `install-module`, argv: ['go', 'install', `${mod}@latest`], timeout_ms: 300000 }],
					requirements: ['go >= 1.21'],
					limits: { timeout_ms: 360000, max_output_bytes: 500000 },
				},
				confidence: 'medium',
				evidence: ['go.mod module path; verify step needs a human'],
			};
		}
	}
	return { manifest: null, confidence: 'skip', reason: 'no recognizable package metadata' };
}

/** Fetch candidate metadata files for one repo. Returns { filename: content }. */
async function fetchMetadata(owner, repo) {
	const files = {};
	for (const name of ['pyproject.toml', 'setup.py', 'package.json', 'go.mod']) {
		try {
			const text = await ghFile(owner, repo, name);
			if (text) {
				files[name] = text;
				break; // first ecosystem wins; avoids mixed signals
			}
		} catch {
			/* missing file: try next */
		}
	}
	return files;
}

/**
 * Propose manifests for top resources lacking one. Writes drafts only.
 * Returns { proposed, skipped, noToken }.
 */
export async function proposeInstallManifests(resources, opts = {}) {
	const limit = Number(process.env.INSTALL_MANIFEST_LIMIT ?? opts.limit ?? 50);
	const withManifest = new Set(resources.filter((r) => r.marketplace?.install_manifest).map((r) => r.id));
	const candidates = [...resources]
		.filter((r) => !withManifest.has(r.id))
		.map((r) => ({ r, q: r.scores?.quality ?? r.quality ?? 0, id: repoIdentity(r.github_url ?? '') }))
		.filter(({ id, r }) => id && !/de-agent-platform/i.test(r.github_url ?? ''))
		.sort((a, b) => b.q - a.q)
		.slice(0, limit);
	if (!process.env.GITHUB_TOKEN) return { proposed: 0, skipped: candidates.length, noToken: true };
	let proposed = 0;
	let skipped = 0;
	const day = new Date().toISOString().slice(0, 10);
	const outDir = join(ROOT, 'data', 'drafts', 'install-manifests');
	mkdirSync(outDir, { recursive: true });
	for (const { r, id } of candidates) {
		let files = {};
		try {
			files = await fetchMetadata(id.owner, id.repo);
		} catch {
			skipped++;
			continue;
		}
		const { manifest, confidence, evidence, reason } = proposeManifest(files, id.repo);
		if (!manifest) {
			skipped++;
			continue;
		}
		const doc = [
			'# DRAFT install manifest — NOT served. Test on a clean machine, then copy',
			'# the install_manifest block into the curated record. Never auto-merge:',
			'# manifests execute on user machines.',
			`- id: ${r.id}`,
			`  type: ${r.type}`,
			`  title: ${JSON.stringify(r.title ?? r.id)}`,
			`  source: ${r.github_url}`,
			`  curation_state: draft-manifest`,
			`  confidence: ${confidence}`,
			`  evidence: ${JSON.stringify(evidence)}`,
			`  generated_at: ${new Date().toISOString()}`,
			`  install_manifest:`,
		];
		const yaml =
			doc.join('\n') +
			'\n  # version: fill from the upstream release under test (never invent)\n' +
			stringifyYaml({ install_manifest: manifest }).replace(/^/gm, '  ').trimEnd() +
			'\n';
		writeFileSync(join(outDir, `${day}-${r.id}.yaml`), yaml);
		proposed++;
	}
	return { proposed, skipped, noToken: false };
}
