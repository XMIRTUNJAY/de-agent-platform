import test from 'node:test';
import assert from 'node:assert/strict';
import { proposeManifest } from '../pipelines/generate-install-manifests.mjs';

test('pyproject with matching name + single script => high confidence', () => {
	const { manifest, confidence } = proposeManifest(
		{ 'pyproject.toml': '[project]\nname = "sqlfluff"\n[project.scripts]\nsqlfluff = "sqlfluff.cli:main"\n' },
		'sqlfluff',
	);
	assert.equal(confidence, 'high');
	assert.deepEqual(manifest.commands[0].argv, ['pip', 'install', 'sqlfluff']);
	assert.deepEqual(manifest.commands[1].argv, ['sqlfluff', '--version']);
});

test('pyproject name mismatch => skip (never guess)', () => {
	const { manifest, confidence } = proposeManifest({ 'pyproject.toml': '[project]\nname = "other-lib"\n' }, 'sqlfluff');
	assert.equal(manifest, null);
	assert.equal(confidence, 'skip');
});

test('node package with single bin => high confidence', () => {
	const { manifest, confidence } = proposeManifest(
		{ 'package.json': JSON.stringify({ name: 'prettier', bin: { prettier: './bin.js' } }) },
		'prettier',
	);
	assert.equal(confidence, 'high');
	assert.ok(manifest.commands[0].argv.includes('-g'));
});

test('node library without bin => skip (no install UX)', () => {
	const { manifest } = proposeManifest({ 'package.json': JSON.stringify({ name: 'lodash' }) }, 'lodash');
	assert.equal(manifest, null);
});

test('go module => medium with explicit verify gap', () => {
	const { manifest, confidence } = proposeManifest({ 'go.mod': 'module github.com/foo/bar\n\ngo 1.21\n' }, 'bar');
	assert.equal(confidence, 'medium');
	assert.ok(manifest.commands[0].argv.includes('go'));
});

test('no metadata => skip', () => {
	const { manifest } = proposeManifest({}, 'whatever');
	assert.equal(manifest, null);
});

test('manifest points at upstream registries, never local paths', () => {
	const { manifest } = proposeManifest(
		{ 'pyproject.toml': '[project]\nname = "ruff"\n[project.scripts]\nruff = "ruff:main"\n' },
		'ruff',
	);
	const blob = JSON.stringify(manifest);
	assert.ok(!blob.includes('./') && !blob.includes('/home/') && !blob.includes('C:'));
});
