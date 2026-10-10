import test from 'node:test';
import assert from 'node:assert/strict';
import { census } from '../pipelines/lib/page-census.mjs';

test('detects same slug under legacy and typed routes', () => {
  const out = census(
    ['/resources/kafka-x/', '/skills/kafka-x/', '/skills/only-typed/'],
    ['/skills/kafka-x/', '/skills/only-typed/', '/skills/missing-page/']
  );
  assert.equal(out.duplicates.length, 1);
  assert.equal(out.duplicates[0].slug, 'kafka-x');
  assert.deepEqual(out.duplicates[0].urls.sort(), ['/resources/kafka-x/', '/skills/kafka-x/']);
  assert.deepEqual(out.orphans, ['/resources/kafka-x/']);
  assert.deepEqual(out.missing, ['/skills/missing-page/']);
});

test('clean registry audits clean', () => {
  const out = census(['/skills/a/'], ['/skills/a/']);
  assert.equal(out.duplicates.length, 0);
  assert.equal(out.orphans.length, 0);
  assert.equal(out.missing.length, 0);
});
