import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runStaticGates, countWords, MIN_WORDS } from '../pipelines/lib/auto-gates.mjs';
import {
  parseRepoUrl, hintTypeFromTree, extractInstallSection, candidateInstallCommands,
} from '../pipelines/lib/repo-extract.mjs';

const filler = Array(140).fill('servable content word').join(' ');

function goodDraft() {
  return {
    type: 'skill', title: 'Good Skill', license: 'MIT',
    description: filler, body: filler,
    version: '0.1.0', verification: 'community', last_verified: '2026-10-16',
    install_command: 'amp skill add de-agent/good',
  };
}

describe('auto-gates', () => {
  it('passes a complete, clean, permissive draft', () => {
    const r = runStaticGates(goodDraft());
    assert.equal(r.pass, true);
    assert.ok(r.words >= MIN_WORDS);
  });

  it('fails short, unlicensed, unstructured, or gated copy', () => {
    assert.ok(runStaticGates({ ...goodDraft(), description: 'tiny' }).reasons.some((x) => /words/.test(x)));
    assert.ok(runStaticGates({ ...goodDraft(), license: 'GPL-3.0' }).reasons.some((x) => /license/.test(x)));
    assert.ok(runStaticGates({ ...goodDraft(), install_command: undefined }).reasons.some((x) => /install/.test(x)));
    assert.ok(runStaticGates({ ...goodDraft(), description: `${filler} simply the best` }).reasons.some((x) => /gatekeeping/.test(x)));
    assert.ok(runStaticGates({ ...goodDraft(), body: 'TODO fill this' }).reasons.some((x) => /placeholder/.test(x)));
  });

  it('never invents: absence fails instead of generating', () => {
    const r = runStaticGates({ ...goodDraft(), body: '' });
    assert.equal(r.pass, false); // short count, stays draft — no filler written
  });
});

describe('repo-extract pure helpers', () => {
  it('parses repo urls', () => {
    assert.deepEqual(parseRepoUrl('https://github.com/anthropics/skills'), { owner: 'anthropics', repo: 'skills' });
    assert.equal(parseRepoUrl('https://example.com/x'), null);
  });

  it('hints types from tree layout', () => {
    assert.equal(hintTypeFromTree(['SKILL.md', 'README.md']), 'skill');
    assert.equal(hintTypeFromTree(['.claude-plugin/plugin.json']), 'plugin');
    assert.equal(hintTypeFromTree(['src/server.ts']), 'mcp');
    assert.equal(hintTypeFromTree(['docs/guide.md']), null);
  });

  it('pulls install sections, bounded', () => {
    const md = '# Intro\ntext\n## Installation\n```\nnpm i -g foo\n```\n## Usage\nrun it';
    const section = extractInstallSection(md);
    assert.ok(section.includes('npm i -g foo'));
    assert.ok(!section.includes('run it'));
  });

  it('finds install command candidates', () => {
    const cmds = candidateInstallCommands('run `npm i -g foo` or `pip install bar` today');
    assert.ok(cmds.some((c) => c.includes('npm i -g foo')));
    assert.ok(cmds.some((c) => c.includes('pip install bar')));
  });

  it('counts words across all servable fields', () => {
    assert.ok(countWords(goodDraft()) >= MIN_WORDS);
  });
});
