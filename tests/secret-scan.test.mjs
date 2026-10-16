import test from 'node:test';
import assert from 'node:assert/strict';
import { scanText, SECRET_PATTERNS } from '../pipelines/scan-secrets.mjs';

test('patterns catch real secrets', () => {
	const hits = scanText('aws_access_key_id = "AKIAIOSFODNN7EXAMPLE"\n', 'config/prod.py');
	assert.equal(hits.length, 1);
	assert.equal(hits[0].pattern, 'aws-key');
	assert.equal(hits[0].line, 1);
});

test('findings never carry secret values', () => {
	const hits = scanText('password = "s3cr3t-hunter2-99"\n', 'app/settings.py');
	assert.equal(hits.length, 1);
	const blob = JSON.stringify(hits[0]);
	assert.ok(!blob.includes('s3cr3t-hunter2-99'), 'value leaked into finding');
	assert.ok(hits[0].file.includes('app/settings.py'));
});

test('prose about passwords does not match', () => {
	const hits = scanText('Use a strong password for your account.\n', 'docs/guide.md');
	assert.equal(hits.length, 0);
});

test('example-looking hits are flagged likelyExample', () => {
	const hits = scanText('password = "test1234"\n', 'examples/demo.py');
	assert.equal(hits.length, 1);
	assert.equal(hits[0].likelyExample, true);
});

test('private keys match', () => {
	const hits = scanText('-----BEGIN RSA PRIVATE KEY-----\n', 'certs/server.pem');
	assert.equal(hits.length, 1);
	assert.equal(hits[0].pattern, 'private-key');
});

test('line numbers are 1-based and per-pattern', () => {
	const hits = scanText('ok = 1\npassword = "abcd1234"\nok = 2\n', 'x.py');
	assert.equal(hits.length, 1);
	assert.equal(hits[0].line, 2);
});

test('SECRET_PATTERNS are all global regexes', () => {
	for (const p of SECRET_PATTERNS) {
		assert.ok(p.id && p.re instanceof RegExp && p.re.global, `bad pattern ${p.id}`);
	}
});
