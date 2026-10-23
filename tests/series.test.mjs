// Series model (13 stages x 10 lessons) — TDD: written before implementation.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('series library', () => {
  test('buildSeries groups tutorials by series, ordered by lesson', async () => {
    const { buildSeries } = await import('../pipelines/lib/series.mjs');
    const resources = [
      { id: 't2', slug: 'l2', type: 'tutorial', series: 'streaming', series_title: 'The Streaming Series', lesson: 2, title: 'Lesson two', description: 'd2' },
      { id: 't1', slug: 'l1', type: 'tutorial', series: 'streaming', series_title: 'The Streaming Series', lesson: 1, title: 'Lesson one', description: 'd1' },
      { id: 's1', slug: 'not-a-lesson', type: 'skill', title: 'not a tutorial' },
      { id: 'tX', slug: 'orphan', type: 'tutorial', title: 'no series yet' },
    ];
    const out = buildSeries(resources);
    const s = out.streaming;
    assert.ok(s, 'stage series exists');
    assert.equal(s.title, 'The Streaming Series');
    assert.equal(s.total, 2);
    assert.deepEqual(s.lessons.map((l) => l.lesson), [1, 2]);
    assert.equal(s.lessons[0].slug, 'l1');
  });
  test('seriesNeighbors returns prev/next and total', async () => {
    const { seriesNeighbors } = await import('../pipelines/lib/series.mjs');
    const resources = [
      { id: 'a', slug: 'a', type: 'tutorial', series: 'st', series_title: 'S', lesson: 1, title: 'A' },
      { id: 'b', slug: 'b', type: 'tutorial', series: 'st', series_title: 'S', lesson: 2, title: 'B' },
      { id: 'c', slug: 'c', type: 'tutorial', series: 'st', series_title: 'S', lesson: 3, title: 'C' },
      { id: 'z', slug: 'z', type: 'skill', title: 'Z' },
    ];
    const mid = seriesNeighbors(resources, resources[1]);
    assert.deepEqual(
      { lesson: mid.lesson, total: mid.total, prev: mid.prev?.slug, next: mid.next?.slug },
      { lesson: 2, total: 3, prev: 'a', next: 'c' },
    );
    const first = seriesNeighbors(resources, resources[0]);
    assert.equal(first.prev, null);
    const last = seriesNeighbors(resources, resources[2]);
    assert.equal(last.next, null);
    const outsider = seriesNeighbors(resources, resources[3]);
    assert.equal(outsider, null);
  });
});

describe('series validation rules', () => {
  test('lesson without series is an error; lesson outside 1..10 is an error', async () => {
    const { validateSeriesFields } = await import('../pipelines/lib/series.mjs');
    const errors = validateSeriesFields([
      { id: 'a', type: 'tutorial', lesson: 3 },
      { id: 'b', type: 'tutorial', series: 'st', lesson: 11 },
      { id: 'c', type: 'tutorial', series: 'st', lesson: 0 },
      { id: 'd', type: 'skill', series: 'st' },
    ]);
    assert.ok(errors.some((e) => e.includes('a') && e.includes('series')), 'lesson without series');
    assert.ok(errors.some((e) => e.includes('b') && e.includes('1..10')), 'lesson > 10');
    assert.ok(errors.some((e) => e.includes('c') && e.includes('1..10')), 'lesson < 1');
    assert.equal(errors.filter((e) => e.includes('d')).length, 0, 'non-tutorials may carry series harmlessly? no — must be flagged or ignored; design: ignore');
  });
  test('duplicate lesson numbers within a series are an error', async () => {
    const { validateSeriesFields } = await import('../pipelines/lib/series.mjs');
    const errors = validateSeriesFields([
      { id: 'a', type: 'tutorial', series: 'st', lesson: 2 },
      { id: 'b', type: 'tutorial', series: 'st', lesson: 2 },
    ]);
    assert.ok(errors.some((e) => e.includes('duplicate') && e.includes('st')), JSON.stringify(errors));
  });
});
