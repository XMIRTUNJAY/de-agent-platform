/**
 * SERIES — one ordered 10-lesson series per roadmap stage.
 *
 * Tutorials declare `series: <stage-key>`, `series_title`, `lesson: 1..10`.
 * buildSeries() powers /series/<stage>/ pages and the registry's series
 * summary; seriesNeighbors() powers prev/next navigation and the
 * "Lesson N of 10" chip on tutorial detail pages.
 */

export const SERIES_LESSONS = 10;

/**
 * Group tutorial resources into stage series.
 * Returns { [stage]: { stage, title, total, lessons: [{lesson, id, slug, title, description}] } }
 * Only tutorials carrying both series and lesson join their series.
 */
export function buildSeries(resources) {
  const out = {};
  for (const r of resources) {
    if (r.type !== 'tutorial' || !r.series || !Number.isFinite(Number(r.lesson))) continue;
    const stage = r.series;
    out[stage] = out[stage] ?? { stage, title: r.series_title ?? null, lessons: [] };
    out[stage].title = out[stage].title ?? r.series_title ?? null;
    out[stage].lessons.push({
      lesson: Number(r.lesson),
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: (r.description ?? '').slice(0, 240),
    });
  }
  for (const s of Object.values(out)) {
    s.lessons.sort((a, b) => a.lesson - b.lesson);
    s.total = s.lessons.length;
  }
  return out;
}

/**
 * Prev/next within the series for one resource.
 * Returns null for non-series resources; otherwise
 * { series, title, lesson, total, prev, next } where prev/next are
 * { slug, title, lesson } | null.
 */
export function seriesNeighbors(resources, r) {
  if (r.type !== 'tutorial' || !r.series || !Number.isFinite(Number(r.lesson))) return null;
  const lessons = resources
    .filter((x) => x.type === 'tutorial' && x.series === r.series && Number.isFinite(Number(x.lesson)))
    .sort((a, b) => Number(a.lesson) - Number(b.lesson));
  const idx = lessons.findIndex((x) => x.id === r.id);
  if (idx === -1) return null;
  const at = (i) => (i >= 0 && i < lessons.length
    ? { slug: lessons[i].slug, title: lessons[i].title, lesson: Number(lessons[i].lesson) }
    : null);
  return {
    series: r.series,
    title: r.series_title ?? null,
    lesson: Number(r.lesson),
    total: lessons.length,
    prev: at(idx - 1),
    next: at(idx + 1),
  };
}

/**
 * Series-field validation. Returns human-readable error strings (empty when
 * clean):
 *  - tutorial with lesson must have series (and vice versa)
 *  - lesson must be within 1..SERIES_LESSONS
 *  - duplicate lesson numbers within one series are an error
 * Non-tutorial resources must not carry lesson (series alone is tolerated).
 */
export function validateSeriesFields(resources) {
  const errors = [];
  const seen = new Map();
  for (const r of resources) {
    const lesson = r.lesson;
    const series = r.series;
    if (r.type === 'tutorial') {
      if (lesson != null && !series) errors.push(`${r.id}: tutorial has lesson but no series`);
      if (series && lesson == null) errors.push(`${r.id}: tutorial has series but no lesson`);
      if (lesson != null) {
        const n = Number(lesson);
        if (!Number.isFinite(n) || n < 1 || n > SERIES_LESSONS) {
          errors.push(`${r.id}: lesson must be an integer in 1..${SERIES_LESSONS}`);
        } else if (series) {
          const key = `${series}#${n}`;
          if (seen.has(key)) errors.push(`duplicate lesson ${n} in series ${series}: ${seen.get(key)} and ${r.id}`);
          else seen.set(key, r.id);
        }
      }
    } else if (lesson != null) {
      errors.push(`${r.id}: only tutorials may carry lesson`);
    }
  }
  return errors;
}
