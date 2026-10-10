import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECKS, reviewDraft } from '../pipelines/lib/review-checks.mjs';

const good = (over = {}) => ({
  id: 'x', draft_kind: 'tutorial', title: 'T', description: 'A full sentence describing the thing well.',
  related: [], body: `## What\n\nShort lines here.\n\n## Prerequisites\n\nNode.\n\n## Step 1\n\n\`\`\`bash\necho hi\n\`\`\`\n\n## Unknowns\n\nNone yet.\n` + 'Word. '.repeat(400), ...over,
});
const ids = new Set(['a']);

test('sixteen named checks exist', () => {
  assert.equal(CHECKS.length, 16);
});

test('clean tutorial passes', () => {
  const out = reviewDraft(good(), { ids });
  assert.ok(out.checks.every((c) => c.status !== 'fail'), JSON.stringify(out.checks.filter((c) => c.status === 'fail')));
});

test('gatekeeping, placeholders, and destructive commands fail', () => {
  const out = reviewDraft(good({ body: 'Simply run rm -rf / now TODO.' }), { ids });
  const failed = new Set(out.checks.filter((c) => c.status === 'fail').map((c) => c.id));
  assert.ok(failed.has('voice-gatekeeping') && failed.has('accuracy-placeholders') && failed.has('safety-destructive'));
});

test('unknown related id fails', () => {
  const out = reviewDraft(good({ related: ['nope'] }), { ids });
  assert.ok(out.checks.some((c) => c.id === 'accuracy-ids' && c.status === 'fail'));
});
