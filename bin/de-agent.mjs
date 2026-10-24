#!/usr/bin/env node
/**
 * de-agent installer — one command to add a registry artifact to your CLIs.
 *
 *   de-agent add sql-review --agent all          # skill → SKILL.md into agent dirs
 *   de-agent add destructive-sql-guard           # hook → wiring card + config snippet
 *   de-agent mcp mcp-server-motherduck           # MCP server → per-agent config
 *   de-agent new dbt-warehouse-tests             # starter → scaffold skeleton
 *
 * Thin CLI wrapper: matrix + filesystem core lives in src/lib/install-matrix.mjs
 * (unit-tested, no network); this file parses argv and fetches record JSON /
 * SKILL.md from the registry mirror.
 */
import { agentIds, installPlan, installSkill, fetchSkillMd } from '../src/lib/install-matrix.mjs';
import { installArtifact, mcpConfigs, scaffoldStarter } from '../src/lib/install-artifact.mjs';

const DEFAULT_SOURCE = 'https://emanisha.in/de-agent';

function usage(to = console.log) {
  to(`de-agent — install registry artifacts into your coding CLIs
Usage:
  de-agent add <slug> [--agent <id|all>] [--global] [--dry-run] [--source <url>]
  de-agent mcp <slug> [--agent <id>] [--source <url>]      show MCP server config
  de-agent new <slug> [--source <url>]                     scaffold a starter project
Agents: ${agentIds().join(', ')}`);
}

function flag(rest, name) {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? null : (rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : true);
}

async function main(argv) {
  const [cmd, slug, ...rest] = argv;
  if (cmd === '--help' || cmd === '-h') { usage(); process.exitCode = 0; return; }
  if (!cmd) { usage(console.error); process.exitCode = 2; return; }
  if (!slug || !['add', 'mcp', 'new'].includes(cmd)) {
    console.error(!['add', 'mcp', 'new'].includes(cmd) ? `Error: unknown command "${cmd}"` : `Error: ${cmd} requires a slug`);
    usage(console.error); process.exitCode = 2; return;
  }
  const source = String(flag(rest, 'source') ?? DEFAULT_SOURCE).replace(/\/$/, '');
  const agentOpt = flag(rest, 'agent') ?? 'opencode';
  const agents = agentOpt === 'all' ? agentIds() : String(agentOpt).split(',');
  const scope = flag(rest, 'global') ? 'global' : 'project';
  const dryRun = flag(rest, 'dry-run') === true;

  try {
    if (cmd === 'add') {
      // Try the skill path first (SKILL.md); fall back to record-based install
      // for hooks/plugins/templates so one command covers every artifact kind.
      let md = null;
      try { md = await fetchSkillMd(source, slug); } catch { /* not a skill — try records */ }
      if (md) {
        let plan;
        try { plan = installPlan(slug, { agents, scope }); } catch (err) { console.error(`Error: ${err.message}`); process.exitCode = 2; return; }
        for (const { agent, installed, skipped } of installSkill(slug, md, plan, { dryRun })) {
          if (skipped) { console.log(`- ${agent}: skipped (${skipped})`); continue; }
          for (const dest of installed) console.log(`- ${agent}: ${dryRun ? 'would write' : 'installed'} ${dest}`);
        }
        return;
      }
      const out = await installArtifact(slug, { agents, dryRun, source });
      for (const line of out) console.log(line);
      return;
    }

    if (cmd === 'mcp') {
      const out = await mcpConfigs(slug, { agents, source });
      for (const line of out) console.log(line);
      return;
    }

    if (cmd === 'new') {
      const out = await scaffoldStarter(slug, { dryRun, source });
      for (const line of out) console.log(line);
      return;
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

await main(process.argv.slice(2));
// fetch keep-alive sockets would hold the event loop open; exit explicitly.
process.exit(process.exitCode ?? 0);
