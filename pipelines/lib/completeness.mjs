/**
 * COMPLETENESS — the single canonical field contract shared by score.mjs
 * (r.scores.completeness) and marketplace-score.mjs (marketplace
 * quality_scores.completeness). One list, one alias, same number (AUD-007).
 *
 * `what_you_need` is an accepted alias for `prerequisites` — tutorial-style
 * records use it and must earn the same credit (AUD-014).
 */
export const CANONICAL_FIELDS = [
  'description', 'category', 'difficulty', 'tags', 'technologies', 'learning_objectives',
  'prerequisites', 'source_url', 'license', 'author', 'version', 'last_verified',
  'compatibility', 'install_command', 'security', 'verification',
];

export const TYPE_REQUIRED_FIELDS = {
  skill: ['version', 'license', 'verification', 'last_verified', 'install_command', 'supported_agents', 'files'],
  mcp: ['server', 'transport', 'tools', 'installation'],
  agent: ['purpose', 'workflow', 'outputs', 'guardrails'],
  hook: ['trigger', 'implementation', 'failure_behavior'],
  plugin: ['runtime', 'installation', 'capabilities'],
  template: ['installation', 'repo_structure', 'contents'],
  starter: ['architecture', 'repo_structure', 'agent_skills', 'setup', 'implementation'],
  runbook: ['symptoms', 'diagnosis', 'fix', 'prevention'],
  architecture: ['solution', 'tradeoffs', 'forces', 'context'],
  reference: ['url', 'publisher', 'kind'],
  policy: ['policy_engine', 'policy_language', 'rules'],
  rule_pack: ['target_tool', 'rules'],
  config_template: ['target_system', 'parameters'],
  governance_pack: ['scope', 'tag_taxonomy'],
};

export function isFilled(v) {
  return Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== '';
}

/**
 * Completeness 0-100 over canonical + type-specific fields, with
 * what_you_need credited as prerequisites (never double-counted).
 */
export function completenessFor(resource) {
  const aliased = (resource.what_you_need ?? []).length > 0 && (resource.prerequisites ?? []).length === 0;
  // what_you_need earns the prerequisites credit (only when prerequisites is
  // absent) — the denominator stays fixed so parity with prerequisites holds
  const typeSpecific = TYPE_REQUIRED_FIELDS[resource.type] ?? [];
  const denominator = CANONICAL_FIELDS.length + typeSpecific.length;
  let present = 0;
  for (const f of CANONICAL_FIELDS) if (isFilled(resource[f])) present++;
  if (aliased) present++;
  for (const f of typeSpecific) if (isFilled(resource[f])) present++;
  return Math.round((present / denominator) * 100);
}
