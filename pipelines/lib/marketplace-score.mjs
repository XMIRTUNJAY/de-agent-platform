/**
 * MARKETPLACE SCORE — rule-based quality scoring for marketplace artifacts.
 * Computes 7 dimension scores + composite score, all deterministic and evidence-based.
 * Runs offline during pipeline publish phase.
 */

import { CHECKS } from './evidence.mjs';
import { computePopularity } from './popularity.mjs';
import { completenessFor } from './completeness.mjs';
import { phaseKeyForStage } from './stage-phases.mjs';

// Scoring weights (sum = 1.0)
export const MARKETPLACE_WEIGHTS = {
  performance: 0.20,
  completeness: 0.15,
  test_coverage: 0.20,
  security: 0.15,
  documentation: 0.10,
  maintainability: 0.10,
  community: 0.10,
};

// Composite score labels
export const COMPOSITE_LABELS = [
  { min: 80, label: 'exemplary' },
  { min: 65, label: 'strong' },
  { min: 45, label: 'adequate' },
  { min: 25, label: 'weak' },
  { min: 0, label: 'unproven' },
];

// Type-specific required fields for completeness scoring live in
// completeness.mjs — shared with score.mjs so both score paths agree.

/**
 * Compute all marketplace scores for all resources.
 * `votes` (optional): { ratings: { [resource_id]: {average, count, distribution} },
 *                       installs: { [resource_id]: {count, success_rate, last_installed_at} } }
 * Aggregated bulk from the votes DB — the fields were hardcoded zeros before
 * this existed, so the popularity model never saw its rating/engagement inputs.
 */
export function computeMarketplaceScores(resources, meta, executions = {}, votes = {}) {
  const guide = meta.scoring?.guide ?? [];
  const ratings = votes.ratings ?? {};
  const installs = votes.installs ?? {};
  
  for (const r of resources) {
    // Preserve existing marketplace data (e.g., community score from GitHub enrichment)
    const existingMarketplace = r.marketplace || {};
    const existingQualityScores = existingMarketplace.quality_scores || {};
    
    const scores = {
      performance: computePerformanceScore(r, executions),
      completeness: computeCompletenessScore(r),
      test_coverage: computeTestCoverageScore(r),
      security: computeSecurityScore(r),
      documentation: computeDocumentationScore(r),
      maintainability: computeMaintainabilityScore(r),
      community: computeCommunityScore(r, meta, existingQualityScores.community),
    };

    // Composite (AUD-008): missing dimensions are NOT forgiven — a null
    // dimension keeps its weight but contributes 0, so data gaps lower the
    // score. Unchecked verification claims (evidence gap) multiply down.
    let composite = 0;
    for (const [k, v] of Object.entries(scores)) {
      composite += (v ?? 0) * MARKETPLACE_WEIGHTS[k];
    }
    const gap = r.evidence_summary?.gap ?? 0;
    if (gap > 0) composite *= Math.max(0.25, 1 - gap * 0.25);
    composite = Math.round(composite * 100) / 100;

    // Composite label
    let compositeLabel = 'unproven';
    for (const g of COMPOSITE_LABELS) {
      if (composite >= g.min) { compositeLabel = g.label; break; }
    }
    // Labels above 'adequate' require earned evidence (community is not proof)
    const earnedVerification = ['reviewed', 'tested', 'verified'].includes(r.verification);
    if (compositeLabel !== 'unproven' && !earnedVerification) {
      compositeLabel = 'adequate';
    }

    // Roadmap phase from the canonical single table
    const roadmapPhase = r.stage ? phaseKeyForStage(r.stage) ?? undefined : undefined;

    const rating = ratings[r.id] ?? null;
    const install = installs[r.id] ?? null;
    const popularityInputs = {
      community: scores.community ?? 0,
      // github_community kept as the historical key (stats API reads it)
      github_community: scores.community ?? 0,
      rating_avg: rating?.average ?? 0,
      rating_count: rating?.count ?? 0,
      installs: install?.count ?? 0,
      copies: 0,
      views: 0,
    };

    r.marketplace = {
      install_count: install?.count ?? 0,
      install_success_rate: install?.success_rate ?? 0,
      last_installed_at: install?.last_installed_at ?? null,
      rating_average: rating?.average ?? 0,
      rating_count: rating?.count ?? 0,
      rating_distribution: rating?.distribution ?? {},
      quality_scores: scores,
      composite_score: Math.round(composite * 100) / 100,
      composite_label: compositeLabel,
      popularity_base: computePopularity({
        community: popularityInputs.community,
        ratingAvg: popularityInputs.rating_avg,
        ratingCount: popularityInputs.rating_count,
        installs: popularityInputs.installs,
        copies: popularityInputs.copies,
        views: popularityInputs.views,
      }),
      popularity_inputs: popularityInputs,
      roadmap_stages: computeRoadmapStages(r),
      roadmap_phase: roadmapPhase,
      is_featured: false,
      is_official: false,
      publisher_tier: 'community',
      install_manifest: r.install_manifest ?? null,
    };
  }

  return resources;
}

/**
 * Performance Score (0-100)
 * Based on execution benchmarks: latency, throughput, resource usage
 * Null if no execution data available
 */
function computePerformanceScore(resource, executions) {
  const exec = executions[resource.id];
  if (!exec || !exec.spawned || exec.state !== 'passed') return null;

  const commands = exec.commands ?? [];
  if (commands.length === 0) return null;

  // Metrics: total duration, success rate, output size
  const durations = commands.filter(c => c.durationMs).map(c => c.durationMs);
  const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const successRate = commands.filter(c => c.exitCode === 0).length / commands.length;

  // Score: faster + more successful = higher
  // Baseline: 60s = 50pts, 10s = 90pts, 300s = 10pts
  const durationScore = Math.max(0, 100 - Math.log10(Math.max(1, avgDuration / 1000)) * 30);
  const successScore = successRate * 100;

  return Math.round((durationScore * 0.6 + successScore * 0.4));
}

/**
 * Completeness Score (0-100) — shared implementation (completeness.mjs)
 * used by both score.mjs and this pipeline, so the numbers agree.
 */
function computeCompletenessScore(resource) {
  return completenessFor(resource);
}

/**
 * Test Coverage Score (0-100)
 * Based on evidence checks + CI configs + test files present
 */
function computeTestCoverageScore(resource) {
  const evidence = resource.evidence ?? [];
  const passedChecks = evidence.filter(e => e.status === 'passed').map(e => e.check);
  const evidenceScore = (passedChecks.length / CHECKS.length) * 100;

  // Check for test-related fields
  let testSignals = 0;
  if (resource.tests?.length) testSignals += 20;
  if (resource.ci_config ?? resource.github_actions ?? false) testSignals += 15;
  if (resource.test_command ?? false) testSignals += 10;
  if (passedChecks.includes('tests_passed')) testSignals += 25;
  if (passedChecks.includes('build_passed')) testSignals += 15;
  if (passedChecks.includes('smoke_passed')) testSignals += 15;
  if (passedChecks.includes('output_validated')) testSignals += 15;

  return Math.min(100, Math.round(evidenceScore * 0.5 + testSignals * 0.5));
}

/**
 * Security Score (0-100)
 * Based on security flags, secret handling, least privilege, vulnerability scans
 */
function computeSecurityScore(resource) {
  const sec = resource.security ?? {};
  const flags = resource.security_flags ?? 0;

  // Base penalty for risky capabilities
  const riskFlags = ['runs_code', 'network_access', 'credentials', 'filesystem_access', 'external_apis'];
  const activeRisks = riskFlags.filter(k => sec[k] === true).length;
  const riskPenalty = activeRisks * 10; // -10 per active risk

  // Positive signals
  let positive = 0;
  if (sec.credentials === false) positive += 10;
  if (sec.network_access === false) positive += 10;
  if (sec.runs_code === false) positive += 10;
  if (resource.security_reviewed_at) positive += 20;
  if (resource.vulnerability_scan_at) positive += 20;
  if (resource.dependency_audit_at) positive += 15;
  if (resource.least_privilege_config) positive += 15;

  const base = 70; // Start at 70
  return Math.max(0, Math.min(100, Math.round(base - riskPenalty + positive)));
}

/**
 * Documentation Score (0-100)
 * README length, examples, diagrams, inline docs, type-specific docs
 */
function computeDocumentationScore(resource) {
  let score = 0;

  // Description quality
  const descLen = (resource.description ?? '').length;
  if (descLen >= 200) score += 20;
  else if (descLen >= 100) score += 15;
  else if (descLen >= 50) score += 10;
  else score += 5;

  // Tagline
  if (resource.tagline?.length > 20) score += 5;

  // Type-specific documentation
  switch (resource.type) {
    case 'skill':
      if (resource.body?.length > 500) score += 25;
      else if (resource.body?.length > 200) score += 15;
      if (resource.files?.length) score += 10;
      if (resource.example) score += 10;
      break;
    case 'mcp':
      if (resource.tools?.length) score += 20;
      if (resource.installation?.length > 100) score += 15;
      break;
    case 'starter':
      if (resource.setup?.length) score += 15;
      if (resource.implementation?.length) score += 15;
      if (resource.repo_structure?.length > 200) score += 10;
      break;
    case 'runbook':
      if (resource.commands?.length) score += 15;
      if (resource.monitoring?.length) score += 10;
      break;
    case 'architecture':
      if (resource.diagram) score += 20;
      if (resource.tradeoffs?.length >= 3) score += 15;
      break;
  }

  // Common docs
  if (resource.readme_url) score += 10;
  if (resource.changelog_url) score += 10;
  if (resource.examples?.length) score += 10;

  return Math.min(100, Math.round(score));
}

/**
 * Maintainability Score (0-100)
 * Versioning, changelog, deprecation policy, release cadence, update frequency
 */
function computeMaintainabilityScore(resource) {
  let score = 0;

  // Version format (semver)
  if (resource.version && /^\d+\.\d+\.\d+/.test(resource.version)) score += 15;

  // Recent verification
  if (resource.last_verified) {
    const days = (Date.now() - new Date(resource.last_verified).getTime()) / 86400000;
    if (days <= 30) score += 25;
    else if (days <= 90) score += 15;
    else if (days <= 180) score += 10;
    else score += 5;
  }

  // Changelog / release notes
  if (resource.changelog_url) score += 15;
  if (resource.release_notes_url) score += 10;

  // Deprecation policy
  if (resource.deprecation_policy) score += 10;

  // Update frequency (from freshness)
  if (resource.freshness?.upstream_checked_at) {
    const days = (Date.now() - new Date(resource.freshness.upstream_checked_at).getTime()) / 86400000;
    if (days <= 30) score += 15;
    else if (days <= 90) score += 10;
    else if (days <= 180) score += 5;
  }

  // Active maintenance signals
  if (resource.github_url && !resource.freshness?.archived) score += 10;
  if (resource.issue_response_time_hours && resource.issue_response_time_hours < 72) score += 10;

  return Math.min(100, Math.round(score));
}

/**
 * Community Score (0-100) — Null if not applicable (e.g., private/internal)
 * GitHub stars, forks, contributors, issue response, release frequency
 * Requires GitHub API enrichment — returns existing score if already set, otherwise null
 */
function computeCommunityScore(resource, meta, existingCommunityScore) {
  // Use existing community score if already set by GitHub enrichment
  if (existingCommunityScore !== null && existingCommunityScore !== undefined) {
    return existingCommunityScore;
  }
  // This requires external GitHub data — return null for now
  // Can be enriched later via a separate GitHub enrichment pipeline step
  return null;
}

/**
 * Compute roadmap stages this artifact maps to
 */
function computeRoadmapStages(resource) {
  const stages = [];
  if (resource.stage) stages.push(resource.stage);
  if (resource.category) {
    // Map category to stage via taxonomy
    // This would need taxonomy lookup - simplified for now
  }
  return [...new Set(stages)];
}

/**
 * Label for composite score
 */
export function compositeLabel(score) {
  for (const g of COMPOSITE_LABELS) {
    if (score >= g.min) return g.label;
  }
  return 'unproven';
}

/**
 * Round helper
 */
function round(n) {
  return Math.round(n * 100) / 100;
}