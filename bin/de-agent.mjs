#!/usr/bin/env node
/**
 * de-agent installer — one command to add a registry skill to your CLIs.
 *
 *   npx de-agent add sql-review --agent all
 *   npx de-agent add sql-review --agent claude-code --global
 *   npx de-agent add sql-review --dry-run
 *
 * Thin CLI wrapper: matrix + filesystem core lives in src/lib/install-matrix.mjs
 * (unit-tested, no network); this file only parses argv and fetches SKILL.md.
 */
import { agentIds, installPlan, installSkill, fetchSkillMd } from '../src/lib/install-matrix.mjs';

const DEFAULT_SOURCE = 'https://emanisha.in/de-agent';

function usage(to = console.log) {
  to(`de-agent — install registry skills into your coding CLIs
Usage: de-agent add <slug> [--agent <id|all>] [--global] [--dry-run] [--source <url>]
Agents: ${agentIds().join(', ')}`);
}

async function main(argv) {
  const [cmd, slug, ...rest] = argv;
  if (cmd === '--help' || cmd === '-h') { usage(); process.exitCode = 0; return; }
  if (!cmd) { usage(console.error); process.exitCode = 2; return; }
  if (cmd !== 'add' || !slug) {
    console.error(cmd !== 'add' ? `Error: unknown command "${cmd}"` : 'Error: add requires a skill slug');
    usage(console.error); process.exitCode = 2; return;
  }
  const flag = (name) => {
    const i = rest.indexOf(`--${name}`);
    return i === -1 ? null : (rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : true);
  };
  const agentOpt = flag('agent') ?? 'opencode';
  const agents = agentOpt === 'all' ? agentIds() : String(agentOpt).split(',');
  const scope = flag('global') ? 'global' : 'project';
  const dryRun = flag('dry-run') === true;
  const source = flag('source') ?? DEFAULT_SOURCE;

  let plan;
  try {
    plan = installPlan(slug, { agents, scope });
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 2; return;
  }
  let md;
  try {
    md = await fetchSkillMd(source, slug);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1; return;
  }
  for (const { agent, installed, skipped } of installSkill(slug, md, plan, { dryRun })) {
    if (skipped) { console.log(`- ${agent}: skipped (${skipped})`); continue; }
    for (const dest of installed) console.log(`- ${agent}: ${dryRun ? 'would write' : 'installed'} ${dest}`);
  }
}

await main(process.argv.slice(2));
// fetch keep-alive sockets would hold the event loop open; exit explicitly.
process.exit(process.exitCode ?? 0);
