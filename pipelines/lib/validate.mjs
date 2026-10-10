/**
 * VALIDATE — schema + referential integrity. The build fails loudly rather than
 * publishing a broken registry.
 */
const REQUIRED_COMMON = ['id', 'slug', 'type', 'title', 'description', 'category'];
const REQUIRED_BY_TYPE = {
  skill: ['version', 'license', 'verification', 'last_verified'],
  mcp: ['server', 'transport', 'tools'],
  agent: ['purpose', 'workflow', 'outputs'],
  hook: ['trigger', 'implementation', 'failure_behavior'],
  plugin: ['runtime', 'installation'],
  template: ['installation', 'repo_structure'],
  starter: ['architecture', 'repo_structure', 'agent_skills'],
  runbook: ['symptoms', 'diagnosis', 'fix'],
  architecture: ['solution', 'tradeoffs'],
  reference: ['url', 'publisher'],
};
const VERIFICATION = ['community', 'reviewed', 'tested', 'verified'];
const DIFFICULTY = ['beginner', 'intermediate', 'advanced'];
// docs/style-guide.md rule 6 — gatekeeping words, warn-only
const GATEKEEPING = /\b(simply|obviously|trivial(?:ly)?|of course|as we all know)\b/i;

export function validate({ resources, taxonomy, meta }) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const slugs = new Set();
  const catIds = new Set(taxonomy.categories.map((c) => c.id));
  const techIds = new Set(taxonomy.technologies.map((t) => t.id));
  const licenseIds = new Set((meta.licenses ?? []).map((l) => l.spdx));

  const find = (id) => resources.find((r) => r.id === id);

  for (const r of resources) {
    const where = `${r.id ?? '(no id)'} [${r.source_file ?? '?'}]`;

    for (const k of REQUIRED_COMMON) {
      if (r[k] === undefined || r[k] === null || r[k] === '') errors.push(`${where}: missing required field "${k}"`);
    }
    for (const k of REQUIRED_BY_TYPE[r.type] ?? []) {
      const v = r[k];
      const empty = v === undefined || v === null || v === '' ||
        (Array.isArray(v) && v.length === 0) ||
        (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
      if (empty) errors.push(`${where}: type "${r.type}" missing required field "${k}"`);
    }

    if (ids.has(r.id)) errors.push(`${where}: duplicate id "${r.id}"`);
    ids.add(r.id);
    if (slugs.has(r.slug)) errors.push(`${where}: duplicate slug "${r.slug}"`);
    slugs.add(r.slug);

    if (!catIds.has(r.category)) errors.push(`${where}: unknown category "${r.category}"`);
    if (r.type !== 'reference' && r.type !== 'tool' && !r.difficulty) errors.push(`${where}: difficulty required for type "${r.type}"`);
    if (r.difficulty && !DIFFICULTY.includes(r.difficulty)) errors.push(`${where}: invalid difficulty "${r.difficulty}"`);
    if (r.verification && !VERIFICATION.includes(r.verification)) errors.push(`${where}: invalid verification "${r.verification}"`);

    for (const t of r.technologies ?? []) {
      if (!techIds.has(t)) warnings.push(`${where}: unknown technology "${t}"`);
    }

    // license policy: anything sourced externally must declare a license
    const external = r.type === 'reference' ? r.url : (r.github_url || (r.source_url && !r.source_url.includes('de-agent')));
    if (external && !r.license) errors.push(`${where}: external resource has no license declared`);
    if (r.license && !licenseIds.has(r.license) && !String(r.license).startsWith('Proprietary')) {
      warnings.push(`${where}: license "${r.license}" not in the license catalogue`);
    }

    // security block must always be present and fully specified
    if (!r.security || Object.values(r.security).some((v) => v === undefined)) {
      errors.push(`${where}: security block incomplete`);
    }

    // stub / placeholder detection
    if (r.description && r.description.length < 30) warnings.push(`${where}: description unusually short`);
    if (/\b(TODO|TBD|Lorem ipsum)\b/i.test(r.description ?? '')) errors.push(`${where}: placeholder text in description`);

    // plain-language lint (style guide): gatekeeping words are never beginner-friendly
    const prose = [r.title, r.description, r.summary].filter(Boolean).join('. ');
    if (GATEKEEPING.test(prose)) warnings.push(`${where}: gatekeeping word in copy (style guide rule 6)`);
  }

  // referential integrity for relationships & prerequisites
  const checkRef = (from, to, kind) => {
    if (!to) return;
    const ok = find(to) || catIds.has(to) || techIds.has(to) ||
      (meta.states ?? []).some((s) => s.id === to) ||
      to.startsWith('doc-');
    if (!ok) warnings.push(`${from}: ${kind} references unknown id "${to}"`);
  };
  for (const r of resources) {
    for (const p of r.prerequisites ?? []) checkRef(r.id, p, 'prerequisite');
    for (const [rel, list] of Object.entries(r.relationships ?? {})) {
      for (const target of list) checkRef(r.id, target, rel);
    }
    for (const key of ['skills', 'hooks', 'mcp', 'agent_skills', 'agents', 'implementations']) {
      for (const target of r[key] ?? []) checkRef(r.id, target, key);
    }
  }

  return { errors, warnings, counts: { resources: resources.length, ids: ids.size } };
}
