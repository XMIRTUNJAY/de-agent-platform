import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { CHECKS } from '../pipelines/lib/review-checks.mjs';

test('every check id is addressed by the pack', () => {
  const skill = readFileSync(new URL('../agents/draft-writer/SKILL.md', import.meta.url), 'utf8');
  const briefs = ['tutorial', 'guide', 'skill', 'reference', 'comparison'].map((k) =>
    readFileSync(new URL(`../agents/draft-writer/briefs/${k}.md`, import.meta.url), 'utf8').toLowerCase());
  const hay = (skill + '\n' + briefs.join('\n')).toLowerCase();
  const need = { 'length-desc': 'description', 'length-body': 'words', 'structure-headings': 'section', 'structure-table': 'table', 'code-fences': 'fenced', 'media-diagram': 'diagram', 'media-images': 'alt', 'safety-destructive': 'destructive', 'safety-pipes': 'curl', 'accuracy-placeholders': 'placeholder', 'accuracy-urls': 'url', 'accuracy-ids': 'related', 'voice-gatekeeping': 'gatekeeping', 'voice-sentences': 'sentence', 'voice-passive': 'passive', 'discoverability-words': 'indexable' };
  assert.deepEqual(Object.keys(need).sort(), [...CHECKS].sort());
  for (const [id, word] of Object.entries(need)) assert.ok(hay.includes(word), `pack never mentions ${id} (needs "${word}")`);
});

test('all five briefs exist with section checklists', () => {
  for (const k of ['tutorial', 'guide', 'skill', 'reference', 'comparison']) {
    const p = new URL(`../agents/draft-writer/briefs/${k}.md`, import.meta.url);
    assert.ok(existsSync(p), `brief missing: ${k}`);
  }
});
