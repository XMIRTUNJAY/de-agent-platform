// Super-type grouping for the marketplace Type filter (audit AUD-005).
// The 14 raw artifact types are implementation metadata; users think in
// intent categories. Legacy ?type=<raw> URLs stay exactly as-is — 'kind'
// is an additive key, and apply() matches both independently.

export const KINDS = {
  automation: {
    label: 'Automation',
    hint: 'skills, hooks, runbooks',
    types: ['skill', 'hook', 'runbook'],
  },
  configuration: {
    label: 'Configuration',
    hint: 'policies, rules, governance',
    types: ['policy', 'rule_pack', 'governance_pack', 'config_template'],
  },
  integration: {
    label: 'Integration',
    hint: 'MCP servers, plugins',
    types: ['mcp', 'plugin'],
  },
  blueprint: {
    label: 'Blueprint',
    hint: 'templates, starters, architectures, references',
    types: ['template', 'starter', 'architecture', 'reference'],
  },
  agents: {
    label: 'AI agents',
    hint: 'ready-to-run agents',
    types: ['agent'],
  },
};

/** kind id for a raw artifact type (null when ungrouped) */
export function kindFor(type) {
  for (const [id, def] of Object.entries(KINDS)) {
    if (def.types.includes(type)) return id;
  }
  return null;
}
