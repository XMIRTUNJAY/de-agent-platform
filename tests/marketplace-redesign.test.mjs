// Marketplace redesign round 2: artifact-type filter group, card details
// ordering (technology first), score circle with tone-coded ring.
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, '..', p), 'utf8');

test('marketplace: artifact Type filter group exists and is primary', () => {
  const page = read('src/pages/marketplace.astro');
  if (!page.includes("{ label: 'Type', key: 'type'")) throw new Error("Type filter group missing");
  const panelCall = page.slice(page.indexOf('<FilterPanel'));
  const primaryMatch = panelCall.match(/primary=\{\[([^\]]*)\]/);
  if (!primaryMatch) throw new Error('FilterPanel primary list not found');
  const keys = primaryMatch[1].split(',').map((s) => s.trim().replace(/'/g, ''));
  if (!keys.includes('type')) throw new Error(`'type' must be in the primary filter keys, got: ${keys}`);
});

test('card: details expander lists technologies before difficulty/tags', () => {
  const card = read('src/components/ResourceCard.astro');
  const details = card.slice(card.indexOf('<details'), card.indexOf('</details>'));
  const tech = details.indexOf('r.technologies');
  const diff = details.indexOf('r.difficulty');
  if (tech < 0) throw new Error('technologies missing from card details');
  if (diff < 0) throw new Error('difficulty missing from card details');
  if (tech > diff) throw new Error('technologies must come before difficulty in the details expander');
});

test('score: number sits inside a tone-colored circle (score-circle), not beside it', () => {
  const card = read('src/components/ResourceCard.astro');
  if (!card.includes('score-circle')) throw new Error('score-circle markup missing');
  if (card.includes('score-pill')) throw new Error('old score-pill markup still present');
  const css = card.slice(card.indexOf('<style>'));
  for (const rule of [
    ".score-circle[data-tone='accent']",
    ".score-circle[data-tone='info']",
    ".score-circle[data-tone='warn']",
    ".score-circle[data-tone='danger']",
  ]) {
    if (!css.includes(rule)) throw new Error(`tone color rule missing: ${rule}`);
  }
  // the numeric value must be positioned inside the circle (absolute center)
  const circleBlock = css.slice(css.indexOf('.score-circle {'), css.indexOf('.score-circle-label'));
  if (!circleBlock.includes('place-items: center') || !circleBlock.includes('border-radius: 999px')) {
    throw new Error('score-circle must be a centered circle');
  }
});

test('roadmap: mobile rule overrides inline stage indents with !important', () => {
  const page = read('src/pages/roadmap.astro');
  const media = page.slice(page.indexOf('@media (max-width: 480px)'));
  if (!media.includes('padding-left: 0.5rem !important')) {
    throw new Error('stage-indent mobile override must use !important to beat inline styles');
  }
  if (!media.includes('.gate-callout')) throw new Error('gate-callout mobile margin override missing');
});
