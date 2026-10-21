// Command palette search bug: typing a full word was impossible because
// renderResults() moved DOM focus to the first result item after every
// keystroke (items[0].focus()), stealing it from the input. Fix keeps focus
// in the input; arrow keys move a visual selection, Enter navigates from the
// input's keydown handler.
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, '..', p), 'utf8');

test('palette: focus stays in the input — results never call .focus() on items', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  if (/items\[0\]\.focus\(\)/.test(layout)) {
    throw new Error('renderResults still steals focus to items[0] — typing full words impossible');
  }
  if (/item\.addEventListener\('focus'|\.focus\(\);\s*\}\);/.test(layout)) {
    throw new Error('item-level focus handling still present');
  }
});

test('palette: arrow keys + Enter are handled on the input, selection is visual (aria-activedescendant/selected class)', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  for (const marker of ["paletteInput.addEventListener('keydown'", 'selectedIdx', 'updateSelection']) {
    if (!layout.includes(marker)) throw new Error(`missing input-level keyboard handling marker: ${marker}`);
  }
  // input keydown must handle ArrowDown, ArrowUp and Enter
  const block = layout.slice(layout.indexOf("paletteInput.addEventListener('keydown'"));
  for (const key of ['ArrowDown', 'ArrowUp', "'Enter'"]) {
    if (!block.slice(0, block.indexOf('renderResults(this.value)') + 500).includes(key)) {
      throw new Error(`input keydown missing ${key} handling`);
    }
  }
});

test('palette: empty query shows first resources instead of "No matches for """', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  const fn = layout.slice(layout.indexOf('function renderResults'), layout.indexOf("paletteInput.addEventListener('input'"));
  if (!fn.includes('q ? scored :')) throw new Error('empty query must list default resources, not an empty result set');
});
