import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { agentIds, targetDirs, installPlan, manualInstructions, installSkill, fetchSkillMd } from '../src/lib/install-matrix.mjs';
import { buildSkillMd, skillName } from '../pipelines/lib/skill-md.mjs';

describe('install-matrix', () => {
  it('knows every CLI the project targets', () => {
    for (const a of ['opencode', 'claude-code', 'codex', 'cursor', 'amp', 'gemini-cli', 'antigravity', 'hermes']) {
      assert.ok(agentIds().includes(a), `missing agent ${a}`);
    }
  });

  it('resolves project dirs under cwd, globals under home', () => {
    const proj = targetDirs('claude-code', 'sql-review', { scope: 'project', cwd: `${sep}repo`, home: `${sep}home${sep}u` });
    assert.deepEqual(proj, [join(`${sep}repo`, '.claude', 'skills', 'sql-review')]);
    assert.ok(proj[0].startsWith(`${sep}repo`));
    const g2 = targetDirs('antigravity', 'x', { scope: 'global', cwd: `${sep}repo`, home: `${sep}home${sep}u` });
    assert.ok(g2[0].startsWith(`${sep}home${sep}u`));
  });

  it('never invents global paths: unknown globals come back empty with a note', () => {
    const plan = installPlan('x', { agents: ['codex'], scope: 'global', cwd: '/r', home: '/h' });
    assert.equal(plan[0].dirs.length, 0);
    assert.ok(plan[0].note);
    const hermes = installPlan('x', { agents: ['hermes'], cwd: '/r', home: '/h' });
    assert.equal(hermes[0].dirs.length, 0);
    assert.match(hermes[0].note, /Hermes/);
  });

  it('rejects unknown agents loudly', () => {
    assert.throws(() => targetDirs('not-a-cli', 'x'), /unknown agent/);
  });

  it('manual instructions only list matrix paths', () => {
    const text = manualInstructions('sql-review');
    assert.ok(text.includes('.claude/skills/sql-review/SKILL.md'));
    assert.ok(text.includes('.agents/skills/sql-review/SKILL.md'));
  });
});

describe('skill-md', () => {
  it('emits spec frontmatter name + description, body from record fields', () => {
    const md = buildSkillMd({
      slug: 'SQL Review!', title: 'SQL Review', description: 'Reviews SQL for fan-out joins.',
      tagline: 'Catch bugs early', learning_objectives: ['Prove grain'],
      when_to_use: 'Before merge', install_command: 'amp skill add x',
      url: '/skills/sql-review',
    });
    assert.ok(md.startsWith('---\nname: sql-review\ndescription: '));
    assert.ok(md.includes('- Prove grain'));
    assert.ok(md.includes('amp skill add x'));
    assert.ok(md.includes('Source record:'));
    assert.equal(skillName('SQL Review!'), 'sql-review');
  });

  it('never rephrases: record text appears verbatim', () => {
    const sentence = 'Comparisons across types must be explicit casts, not implicit.';
    const md = buildSkillMd({ slug: 's', title: 'T', description: 'D', body: `Rules\n1. ${sentence}` });
    assert.ok(md.includes(sentence));
  });
});

describe('installSkill (no network, no subprocess)', () => {
  const MD = '---\nname: sql-review\n---\n# SQL Review\n';
  let dir;
  before(() => { dir = mkdtempSync(join(tmpdir(), 'de-agent-install-')); });
  after(() => { rmSync(dir, { recursive: true, force: true }); });

  it('writes SKILL.md into each planned dir', () => {
    const plan = installPlan('sql-review', { agents: ['claude-code', 'opencode'], cwd: dir, home: dir });
    const out = installSkill('sql-review', MD, plan);
    assert.equal(out.length, 2);
    for (const dest of [join(dir, '.claude', 'skills', 'sql-review', 'SKILL.md'), join(dir, '.agents', 'skills', 'sql-review', 'SKILL.md')]) {
      assert.equal(existsSync(dest), true);
      assert.ok(readFileSync(dest, 'utf8').startsWith('---\nname: sql-review'));
    }
  });

  it('dry-run writes nothing', () => {
    const plan = installPlan('dry-x', { agents: ['cursor'], cwd: dir, home: dir });
    const out = installSkill('dry-x', MD, plan, { dryRun: true });
    assert.equal(out[0].dryRun, true);
    assert.equal(existsSync(join(dir, '.agents', 'skills', 'dry-x', 'SKILL.md')), false);
  });

  it('skips agents without a verified path, refuses non-SKILL.md payloads', () => {
    const plan = installPlan('x', { agents: ['hermes'], cwd: dir, home: dir });
    const out = installSkill('x', MD, plan);
    assert.match(out[0].skipped, /Hermes/);
    assert.throws(() => installSkill('x', '<html>nope</html>', plan), /not a SKILL\.md/);
  });

  it('fetch errors are clean (no stacks to users)', async () => {
    await assert.rejects(fetchSkillMd('http://127.0.0.1:1', 'x'), /could not reach|not found/);
  });
});
