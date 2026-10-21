/**
 * NORMALIZE — turn heterogeneous curated YAML into one uniform Resource shape.
 * This is the stage that makes a skill, an MCP server and a runbook comparable
 * in the marketplace and searchable from the same index.
 */
import { loadAll } from './load.mjs';

const SECURITY_KEYS = ['runs_code', 'network_access', 'credentials', 'filesystem_access', 'external_apis'];

const TYPE_LABELS = {
  skill: 'Skill', mcp: 'MCP server', plugin: 'Plugin', agent: 'Agent', hook: 'Hook',
  template: 'Template', starter: 'Project', runbook: 'Runbook', architecture: 'Pattern',
  reference: 'Reference', tutorial: 'Tutorial', checklist: 'Checklist', tool: 'Tool',
  policy: 'Policy', rule_pack: 'Rule Pack', config_template: 'Config Template', governance_pack: 'Governance Pack',
};

export function normalizeAll() {
  const { taxonomy, roadmap, meta, raw, provenance } = loadAll();

  const categories = (taxonomy.categories ?? []).map((c) => ({ ...c }));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const catBySlug = new Map(categories.map((c) => [c.slug, c]));
  const stages = (taxonomy.stages ?? []).slice().sort((a, b) => a.order - b.order);
  const technologies = taxonomy.technologies ?? [];
  const techBySlug = new Map(technologies.map((t) => [t.slug, t]));

  const resources = raw.map((r) => normalizeOne(r, { catById, catBySlug, techBySlug, provenance }));

  // stable order: type group then difficulty then title
  const TYPED_ORDER = ['tutorial', 'skill', 'mcp', 'plugin', 'hook', 'agent', 'template', 'starter', 'runbook', 'architecture', 'reference', 'tool', 'checklist'];
  const DIFF = { beginner: 0, intermediate: 1, advanced: 2 };
  resources.sort((a, b) => {
    const t = TYPED_ORDER.indexOf(a.type) - TYPED_ORDER.indexOf(b.type);
    if (t) return t;
    const d = (DIFF[a.difficulty] ?? 9) - (DIFF[b.difficulty] ?? 9);
    if (d) return d;
    return String(a.title ?? a.slug ?? a.id ?? '').localeCompare(String(b.title ?? b.slug ?? b.id ?? ''));
  });

  return {
    taxonomy: { categories, stages, technologies, stagesById: Object.fromEntries(stages.map((s) => [s.id, s])) },
    roadmap,
    meta,
    resources,
    catById, catBySlug, techBySlug,
  };
}

function normalizeCategory(r, ctx) {
  if (!r.category) return null;
  if (ctx.catById.has(r.category)) return r.category;
  const bySlug = ctx.catBySlug.get(r.category);
  if (bySlug) return bySlug.id;
  return r.category; // leave as-is; validation will flag it
}

function normalizeTech(list = [], ctx) {
  return list.map((t) => {
    if (!t) return t;
    if (t.startsWith('tech-')) return t;
    const found = ctx.techBySlug.get(t);
    return found ? found.id : t;
  });
}

function normalizeSecurity(sec) {
  const out = {};
  for (const k of SECURITY_KEYS) out[k] = sec?.[k] ?? null;
  return out;
}

function normalizeOne(r, ctx) {
  const category = normalizeCategory(r, ctx);
  const cat = category ? ctx.catById.get(category) : null;

  const sec = normalizeSecurity(r.security);
  const flags = SECURITY_KEYS.filter((k) => sec[k] === true).length;

  // relationships: flatten to { rel: [ids] }
  const relationships = {};
  for (const [k, v] of Object.entries(r.relationships ?? {})) {
    relationships[k] = (Array.isArray(v) ? v : [v]).filter(Boolean);
  }
  // patterns use `related` / `implementations`
  if (Array.isArray(r.related)) relationships.related_to = [...(relationships.related_to ?? []), ...r.related];
  if (Array.isArray(r.implementations)) relationships.implements = r.implementations;

  const provenanceEntry = ctx.provenance?.[r.id] ?? null;

  return {
    id: r.id,
    slug: r.slug,
    type: r.type,
    typeLabel: TYPE_LABELS[r.type] ?? r.type,
    title: r.title,
    tagline: r.tagline ?? null,
    description: collapse(r.description ?? r.purpose ?? r.summary ?? r.problem ?? r.tagline ?? ''),
    summary: collapse(r.summary ?? r.purpose ?? r.problem ?? r.teaches ?? ''),
    when_to_use: r.when_to_use ?? r.usage ?? undefined,
    when_not: r.when_not ?? undefined,
    editorial: r.editorial ?? undefined,
    purpose: r.purpose ?? null,
    problem: r.problem ?? null,
    category,
    categoryTitle: cat?.title ?? null,
    categorySlug: cat?.slug ?? null,
    stage: cat?.stage ?? null,
    subcategory: r.subcategory ?? null,
    difficulty: r.difficulty ?? null,
    severity: r.severity ?? null,
    tags: r.tags ?? [],
    technologies: normalizeTech(r.technologies ?? [], ctx),
    learning_objectives: r.learning_objectives ?? [],
    prerequisites: r.prerequisites ?? [],
    // type-specific payloads (kept verbatim, minus internals)
    ...typePayload(r),

    // provenance & governance
    version: r.version ?? null,
    license: r.license ?? null,
    author: r.author ?? null,
    publisher: r.publisher ?? r.server?.publisher ?? null,
    source_url: r.source_url ?? r.url ?? null,
    github_url: r.github_url ?? r.server?.repo ?? null,
    homepage: r.url ?? null,
    publisher_source: provenanceEntry,
    install_command: r.install_command ?? r.installation?.command ?? r.installation ?? null,
    install_manifest: r.install_manifest ?? null,
    compatibility: r.compatible_agents ?? r.compatibility ?? [],
    compatible_agents: r.compatible_agents ?? [],

    // verification & security
    verification: r.verification ?? 'community',
    last_verified: r.last_verified ?? null,
    evidence: r.evidence ?? [],
    security: sec,
    security_notes: r.security_requirements ?? null,
    security_flags: flags,
    note: r.note ?? null,

    relationships,
    source_file: r.__source_file ?? null,
  };
}

function typePayload(r) {
  switch (r.type) {
    case 'skill':
      return { files: r.files ?? [], body: r.body ?? '', supported_agents: r.supported_agents ?? [] };
    case 'mcp':
      return {
        server: r.server ?? {},
        transport: r.transport ?? null,
        tools: r.tools ?? [],
        installation: r.installation ?? null,
        environment_variables: r.environment_variables ?? [],
      };
    case 'agent':
      return {
        inputs: r.inputs ?? [], tools: r.tools ?? [], skills: r.skills ?? [], mcp: r.mcp ?? [],
        workflow: r.workflow ?? [], outputs: r.outputs ?? [], guardrails: r.guardrails ?? [],
        example: r.example ?? null, evaluation: r.evaluation ?? null,
      };
    case 'tutorial':
      // Steps stay verbatim with source provenance; beginner-friendliness
      // comes from structure (need/steps/check), never from rephrasing.
      return {
        steps: r.steps ?? [], what_you_need: r.what_you_need ?? [],
        check_yourself: r.check_yourself ?? [], source_refs: r.source_refs ?? [],
        gotchas: r.gotchas ?? [], production_notes: r.production_notes ?? [],
        why: r.why ?? null, diagram: r.diagram ?? null, tradeoffs: r.tradeoffs ?? [],
      };
    case 'hook':
      return {
        trigger: r.trigger ?? null, implementation: r.implementation ?? null,
        example: r.example ?? null, failure_behavior: r.failure_behavior ?? null,
        supported_agents: r.supported_agents ?? [],
      };
    case 'plugin':
      return {
        runtime: r.runtime ?? null, capabilities: r.capabilities ?? [], tools: r.tools ?? [],
        commands: r.commands ?? [], hooks: r.hooks ?? [], skills: r.skills ?? [],
        installation: r.installation ?? null, permissions: r.permissions ?? {},
      };
    case 'template':
      return { technologies: r.technologies ?? [], contents: r.contents ?? [], repo_structure: r.repo_structure ?? null, installation: r.installation ?? null };
    case 'starter':
      return {
        stack: r.stack ?? [], architecture: r.architecture ?? null, repo_structure: r.repo_structure ?? null,
        sample_data: r.sample_data ?? null, setup: r.setup ?? [], implementation: r.implementation ?? [],
        tests: r.tests ?? [], failure_scenarios: r.failure_scenarios ?? [],
        production_hardening: r.production_hardening ?? [], agent_skills: r.agent_skills ?? [],
      };
    case 'runbook':
      return {
        symptoms: r.symptoms ?? [], possible_causes: r.possible_causes ?? [], diagnosis: r.diagnosis ?? [],
        commands: r.commands ?? [], fix: r.fix ?? [], prevention: r.prevention ?? [],
        monitoring: r.monitoring ?? [], agent_skills: r.agent_skills ?? [], agents: r.agents ?? [],
        gotchas: r.gotchas ?? [], production_notes: r.production_notes ?? [],
        why: r.why ?? null, diagram: r.diagram ?? null, tradeoffs: r.tradeoffs ?? [],
        // incident notebook: what responders need beyond the technical fix
        impact: r.impact ?? null, escalation: r.escalation ?? null,
        evidence_to_collect: r.evidence_to_collect ?? [], rollback: r.rollback ?? null,
        follow_up: r.follow_up ?? [],
      };
    case 'architecture':
      return {
        context: r.context ?? null, forces: r.forces ?? [], solution: r.solution ?? null,
        diagram: r.diagram ?? null, tradeoffs: r.tradeoffs ?? [], when_to_use: r.when_to_use ?? [],
        when_not: r.when_not ?? [], implementations: r.implementations ?? [],
      };
    case 'reference':
      return { url: r.url ?? null, publisher: r.publisher ?? null, kind: r.kind ?? null, why: r.why ?? null, quality: r.quality ?? null };
    case 'policy':
      return { policy_engine: r.policy_engine ?? null, policy_language: r.policy_language ?? null, rules: r.rules ?? [], test_cases: r.test_cases ?? [] };
    case 'rule_pack':
      return { target_tool: r.target_tool ?? null, rules: r.rules ?? [], test_files: r.test_files ?? [], config_schema: r.config_schema ?? null };
    case 'config_template':
      return { target_system: r.target_system ?? null, parameters: r.parameters ?? [], example_values: r.example_values ?? {}, validation_rules: r.validation_rules ?? [] };
    case 'governance_pack':
      return { scope: r.scope ?? null, tag_taxonomy: r.tag_taxonomy ?? [], glossary_terms: r.glossary_terms ?? [], classification_rules: r.classification_rules ?? [], access_policies: r.access_policies ?? [] };
    default:
      return {};
  }
}

function collapse(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}
