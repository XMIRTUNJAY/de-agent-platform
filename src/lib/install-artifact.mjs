/**
 * INSTALL ARTIFACT — record-based install paths for non-skill artifacts.
 *
 * Sources are the registry's own record fields (fetched as slim JSON from
 * /records/<type>/<slug>.json) — the CLI never invents commands, config
 * shapes, or directory trees:
 * - mcp       → per-agent config snippet derived from `install_command`
 *               (command + args) and `server.name`
 * - hook      → wiring card (trigger, failure_behavior, implementation spec)
 *               written to .agents/hooks/<slug>/ — the record describes the
 *               guard; the card carries it verbatim for the user to wire
 * - plugin/template/starter with a native install_command → printed verbatim
 * - starter   → `de-agent new` scaffolds the directory tree from
 *               `repo_structure` and drops ARCHITECTURE.md from `architecture`
 */
import { join, resolve, relative } from 'node:path';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';

/** Fetch one slim record; throws with a clear message when missing. */
export async function fetchRecord(source, type, slug) {
  const url = `${source}/records/${type}/${slug}.json`;
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(`could not reach ${url}: ${err.cause?.message ?? err.message}`);
  }
  if (!res.ok) throw new Error(`artifact "${slug}" not found (HTTP ${res.status})`);
  return res.json();
}

/** Find a record across the machine-actionable types. */
async function findRecord(source, slug) {
  for (const type of ['mcp', 'hook', 'plugin', 'template', 'starter']) {
    try {
      return { type, record: await fetchRecord(source, type, slug) };
    } catch { /* try next type */ }
  }
  throw new Error(`no skill or installable record found for "${slug}"`);
}

/** Split an install_command into {command, args[]} for MCP config emission. */
export function splitCommand(installCommand) {
  const parts = String(installCommand ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  return { command: parts[0], args: parts.slice(1) };
}

/**
 * Per-agent MCP config for one record — each shape below is the agent's own
 * documented format; nothing here is guessed per-machine.
 */
export function mcpConfigFor(agent, record) {
  const name = record.server?.name ?? record.slug;
  const cmd = splitCommand(record.install_command);
  if (!cmd) return null;
  switch (agent) {
    case 'claude-code':
      return { agent, kind: 'command', text: `claude mcp add ${name} -- ${record.install_command}` };
    case 'cursor':
    case 'gemini-cli':
      return {
        agent,
        kind: 'json',
        text: JSON.stringify({ mcpServers: { [name]: { command: cmd.command, args: cmd.args } } }, null, 2),
        where: agent === 'cursor' ? '~/.cursor/mcp.json' : 'Gemini CLI settings (mcpServers)',
      };
    case 'opencode':
    case 'codex':
    case 'amp':
    case 'antigravity':
      return {
        agent,
        kind: 'json',
        text: JSON.stringify({ mcp: { [name]: { type: record.transport ?? 'local', command: [cmd.command, ...cmd.args] } } }, null, 2),
        where: 'agent config file (mcp section)',
      };
    default:
      return { agent, kind: 'command', text: record.install_command };
  }
}

/** MCP command: print per-agent configs for the requested agents. */
export async function mcpConfigs(slug, { agents = ['opencode'], source } = {}) {
  const { record } = await findRecord(source, slug);
  if (record.type !== 'mcp') throw new Error(`"${slug}" is a ${record.type}, not an MCP server`);
  const out = [
    `${record.title} (${record.server?.publisher ?? 'community'}) · transport: ${record.transport ?? 'stdio'}`,
    `tools: ${(record.tools ?? []).join(', ') || 'see docs'}`,
    '',
  ];
  let shown = 0;
  for (const agent of agents) {
    const cfg = mcpConfigFor(agent, record);
    if (!cfg) continue;
    shown++;
    if (cfg.kind === 'command') {
      out.push(`# ${agent}`);
      out.push(cfg.text);
    } else {
      out.push(`# ${agent} → ${cfg.where}`);
      out.push(cfg.text);
    }
    out.push('');
  }
  if (shown === 0) out.push(`No config shape available for the requested agent(s). Raw command: ${record.install_command}`);
  return out;
}

/** Hook install: write a wiring card carrying the record's own fields verbatim. */
export async function installHookCard(slug, record, { dryRun, cwd = process.cwd() } = {}) {
  const dir = join(cwd, '.agents', 'hooks', slug);
  const dest = join(dir, 'HOOK.md');
  const card = [
    `# ${record.title}`,
    '',
    `> Registry: ${record.url} · failure behavior: ${record.failure_behavior ?? 'unspecified'}`,
    '',
    '## Trigger',
    record.trigger ?? 'unspecified',
    '',
    '## What it enforces (spec from the registry record)',
    record.implementation ?? '(no implementation spec in the record)',
    '',
    '## Wiring (claude-code example — review before use)',
    '```json',
    JSON.stringify({
      hooks: {
        PreToolUse: [{
          matcher: '*',
          hooks: [{ type: 'command', command: `node .agents/hooks/${slug}/guard.js` }],
        }],
      },
    }, null, 2),
    '```',
    '',
    'The registry record describes the guard contract; implement `guard.js` to',
    'that contract (or adapt the check to your tooling). Nothing runs until you wire it.',
    '',
  ].join('\n');
  if (!dryRun) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(dest, card, 'utf8');
  }
  return [`- hook: ${dryRun ? 'would write' : 'installed'} ${dest}`, `- next: review HOOK.md and wire it into your agent's hooks config`];
}

/**
 * Starter scaffold: create the directory tree declared by repo_structure and
 * drop ARCHITECTURE.md from the record. The tree is parsed from the record's
 * own ASCII structure — directories only, no invented files.
 */
export function parseRepoStructure(tree) {
  const dirs = new Set();
  for (const line of String(tree ?? '').split(/\r?\n/)) {
    // strip ASCII/box-drawing tree decoration, keep the path
    const clean = line.replace(/[|`+├└─│]+/g, ' ').trim();
    const m = clean.match(/^([^\s#][^#]*?)\/\s*(?:#.*)?$/);
    if (m) {
      const seg = m[1].trim();
      if (seg && !seg.includes(' ') && seg !== '/') dirs.add(seg);
    }
  }
  return [...dirs];
}

export async function scaffoldStarter(slug, { dryRun = false, cwd = process.cwd(), source } = {}) {
  const { record } = await findRecord(source, slug);
  if (record.type !== 'starter') throw new Error(`"${slug}" is a ${record.type}, not a starter project`);
  const rootName = `${slug}`;
  const root = resolve(cwd, rootName);
  if (!existsSync(cwd) || (relative(cwd, root) ?? '').startsWith('..')) throw new Error('refusing to scaffold outside the working directory');
  if (existsSync(root) && require0(root)) throw new Error(`refusing: ${rootName}/ already exists here`);
  const dirs = parseRepoStructure(record.repo_structure);
  const created = [];
  const rootPrefix = new RegExp(`^${rootName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`);
  for (const d of dirs) {
    // strip the project's own root name if the tree nests under it — keep
    // nested paths (models/staging) intact
    const rel = d === rootName ? '' : d.replace(rootPrefix, '');
    const target = rel ? join(root, rel) : root;
    if (!dryRun) mkdirSync(target, { recursive: true });
    created.push(d);
  }
  const arch = join(root, 'ARCHITECTURE.md');
  if (!dryRun) {
    mkdirSync(root, { recursive: true });
    writeFileSync(arch, `# ${record.title}\n\n${record.architecture ?? ''}\n\n> Scaffolded by de-agent — structure from the registry record.\n`, 'utf8');
  }
  const out = [`- starter: ${dryRun ? 'would scaffold' : 'scaffolded'} ${rootName}/ (${dirs.length} paths)`];
  for (const d of created) out.push(`  - ${d}/`);
  out.push(`  - ARCHITECTURE.md`);
  out.push(`- next: cd ${rootName} and follow ARCHITECTURE.md`);
  return out;
}

function require0(dir) {
  // starter dirs are created fresh; refuse to clobber an existing directory
  return existsSync(dir);
}

/**
 * Record-based `add`: hooks get wiring cards; plugin/template/starter records
 * print their native install command verbatim.
 */
export async function installArtifact(slug, { agents = ['opencode'], dryRun = false, cwd = process.cwd(), source } = {}) {
  const { type, record } = await findRecord(source, slug);
  if (type === 'hook') return installHookCard(slug, record, { dryRun, cwd });
  if (record.install_command) {
    return [
      `- ${type}: install with the artifact's own command:`,
      `  ${record.install_command}`,
      record.installation && record.installation !== record.install_command ? `  (docs: ${record.installation})` : '',
    ].filter(Boolean);
  }
  if (type === 'starter') return scaffoldStarter(slug, { dryRun, cwd, source });
  return [`- ${type}: "${record.title}" — no install command on record; see ${record.url}`];
}
