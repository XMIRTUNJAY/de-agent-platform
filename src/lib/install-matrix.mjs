/**
 * INSTALL MATRIX — where one skill's files go, per coding agent.
 *
 * Sources: Agent Skills spec directory conventions (Vercel Skills CLI agent
 * table) + this machine's own layout (.agents/skills). Rules:
 * - `project` paths are spec-standard and confident for every agent listed.
 * - `global` paths are included ONLY where documented; otherwise [] and the
 *   installer says so instead of guessing.
 * - hermes ships SKILL.md-compatible output but has no stable user-level
 *   install path we can verify — installer prints guidance, writes nothing.
 */
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';

export const AGENTS = {
  opencode: { project: '.agents/skills', global: ['.config/opencode/skills'] },
  'claude-code': { project: '.claude/skills', global: ['.claude/skills'] },
  codex: { project: '.agents/skills', global: [] },
  cursor: { project: '.agents/skills', global: [] },
  amp: { project: '.agents/skills', global: [] },
  'gemini-cli': { project: '.agents/skills', global: [] },
  antigravity: { project: '.agent/skills', global: ['.gemini/antigravity/skills'] },
  hermes: { project: null, global: [], note: 'Copy SKILL.md into your Hermes skills directory (see Hermes optional-skills catalog layout).' },
};

export function agentIds() {
  return Object.keys(AGENTS);
}

/** Absolute target dirs for one skill slug. scope: 'project' | 'global'. */
export function targetDirs(agent, slug, { scope = 'project', cwd = process.cwd(), home = homedir() } = {}) {
  const entry = AGENTS[agent];
  if (!entry) throw new Error(`unknown agent: ${agent}`);
  if (scope === 'global') {
    return (entry.global ?? []).map((g) => join(home, g, slug));
  }
  if (!entry.project) return [];
  return [join(cwd, entry.project, slug)];
}

/** Full install plan: every dir that will receive SKILL.md. */
export function installPlan(slug, { agents = ['opencode'], scope = 'project', ...rest } = {}) {
  const plan = [];
  for (const agent of agents) {
    const dirs = targetDirs(agent, slug, { scope, ...rest });
    if (dirs.length === 0) {
      plan.push({ agent, dirs, note: AGENTS[agent]?.note ?? 'no verified install path for this scope' });
    } else {
      plan.push({ agent, dirs });
    }
  }
  return plan;
}

/** One-line manual instructions derived from the matrix (never invented paths). */
export function manualInstructions(slug) {
  const lines = [`Install "${slug}" manually:`];
  for (const agent of agentIds()) {
    const entry = AGENTS[agent];
    const proj = entry.project ? `${entry.project}/${slug}/SKILL.md` : null;
    const glob = (entry.global ?? []).map((g) => `~/${g}/${slug}/SKILL.md`).join(' or ');
    lines.push(`- ${agent}: ${[proj && `project ${proj}`, glob && `global ${glob}`, entry.note].filter(Boolean).join('; ')}`);
  }
  return lines.join('\n');
}

/**
 * Write SKILL.md text into every planned dir. Pure filesystem, no network —
 * the unit-testable core. Returns per-agent outcomes. Rejects non-SKILL.md
 * payloads so a wrong URL can never plant arbitrary files.
 */
export function installSkill(slug, md, plan, { dryRun = false } = {}) {
  if (typeof md !== 'string' || !md.startsWith('---')) {
    throw new Error('refusing to install: payload is not a SKILL.md file');
  }
  return plan.map(({ agent, dirs, note }) => {
    if (dirs.length === 0) return { agent, installed: [], skipped: note };
    const installed = [];
    for (const dir of dirs) {
      const dest = join(dir, 'SKILL.md');
      if (!dryRun) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(dest, md, 'utf8');
      }
      installed.push(dest);
    }
    return { agent, installed, dryRun };
  });
}

/** Network half: fetch the registry-emitted SKILL.md for a slug. */
export async function fetchSkillMd(source, slug) {
  const url = `${String(source).replace(/\/$/, '')}/skills/${slug}/SKILL.md`;
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(`could not reach ${url}: ${err.cause?.message ?? err.message}`);
  }
  if (!res.ok) throw new Error(`skill "${slug}" not found (HTTP ${res.status})`);
  return res.text();
}
