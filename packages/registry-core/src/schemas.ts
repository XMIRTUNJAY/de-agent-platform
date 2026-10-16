import { z } from 'zod';

export const VERIFICATION_LEVELS = ['community', 'reviewed', 'tested', 'verified'] as const;
export const RESOURCE_TYPES = ['skill', 'mcp', 'plugin', 'hook', 'agent', 'template', 'starter', 'runbook', 'architecture', 'reference', 'policy', 'rule_pack', 'config_template', 'governance_pack'] as const;
export const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const EVIDENCE_CHECKS = [
  'source_reachable',
  'metadata_validated',
  'license_reviewed',
  'tutorial_generated',
  'static_checks_passed',
  'build_passed',
  'tests_passed',
  'smoke_passed',
  'output_validated',
  'security_reviewed',
] as const;

export const VerificationLevelSchema = z.enum(VERIFICATION_LEVELS);
export const ResourceTypeSchema = z.enum(RESOURCE_TYPES);
export const DifficultyLevelSchema = z.enum(DIFFICULTY_LEVELS);
export const EvidenceCheckSchema = z.enum(EVIDENCE_CHECKS);

export const EvidenceEntrySchema = z.object({
  check: EvidenceCheckSchema,
  status: z.enum(['passed', 'failed', 'skipped']),
  at: z.string().datetime(),
  by: z.enum(['human', 'pipeline', 'cli']),
  tool: z.string().optional(),
  version: z.string().optional(),
  summary: z.string(),
  details: z.record(z.unknown()).optional(),
});

export const EvidenceSummarySchema = z.object({
  checks: z.record(z.object({
    status: z.enum(['passed', 'failed', 'unclaimed', 'skipped']),
    at: z.string().datetime().nullable(),
    by: z.string().nullable(),
  })),
  earned: VerificationLevelSchema,
  claimed: VerificationLevelSchema,
  gap: z.number().int().min(0),
});

export const SecurityFlagsSchema = z.object({
  runs_code: z.boolean().default(false),
  network_access: z.boolean().default(false),
  credentials: z.boolean().default(false),
  filesystem_access: z.boolean().default(false),
  external_apis: z.boolean().default(false),
});

// NEW: Marketplace Metrics Schema
export const MarketplaceMetricsSchema = z.object({
  install_count: z.number().int().min(0).default(0),
  install_success_rate: z.number().min(0).max(1).default(0),
  last_installed_at: z.string().datetime().optional(),
  rating_average: z.number().min(0).max(5).default(0),
  rating_count: z.number().int().min(0).default(0),
  rating_distribution: z.record(z.number().int().min(0)).default({}),
  quality_scores: z.object({
    performance: z.number().min(0).max(100).nullable().default(null),
    completeness: z.number().min(0).max(100).default(0),
    test_coverage: z.number().min(0).max(100).nullable().default(null),
    security: z.number().min(0).max(100).default(0),
    documentation: z.number().min(0).max(100).default(0),
    maintainability: z.number().min(0).max(100).default(0),
    community: z.number().min(0).max(100).nullable().default(null),
  }).default({}),
  composite_score: z.number().min(0).max(100).default(0),
  composite_label: z.enum(['exemplary', 'strong', 'adequate', 'weak', 'unproven']).default('unproven'),
  roadmap_stages: z.array(z.string()).default([]),
  roadmap_phase: z.enum(['foundations', 'platforms', 'trust-operations', 'advanced-agentic']).optional(),
  is_featured: z.boolean().default(false),
  is_official: z.boolean().default(false),
  publisher_tier: z.enum(['community', 'verified_publisher', 'official']).default('community'),
  install_manifest: z.object({
    version: z.string(),
    commands: z.array(z.object({
      name: z.string(),
      argv: z.array(z.string()),
      timeout_ms: z.number().int().positive().optional(),
    })).default([]),
    requirements: z.array(z.string()).default([]),
    limits: z.object({
      timeout_ms: z.number().int().positive().optional(),
      max_output_bytes: z.number().int().positive().optional(),
    }).optional(),
  }).optional(),
});

export const ResourceSchema = z.object({
  id: z.string(),
  slug: z.string(),
  type: ResourceTypeSchema,
  typeLabel: z.string(),
  title: z.string(),
  tagline: z.string().optional(),
  description: z.string(),
  summary: z.string().optional(),
  when_to_use: z.union([z.string(), z.array(z.string())]).optional(),
  when_not: z.array(z.string()).optional(),
  editorial: z
    .object({
      rating: z.number().min(0).max(5).optional(),
      limitations: z.array(z.string()).default([]),
      needs_improvement: z.array(z.string()).default([]),
      reviewed_at: z.string().optional(),
    })
    .optional(),
  category: z.string(),
  categorySlug: z.string(),
  categoryTitle: z.string().optional(),
  tags: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  stage: z.string().optional(),
  difficulty: DifficultyLevelSchema.optional(),
  verification: VerificationLevelSchema.default('community'),
  evidence: z.array(EvidenceEntrySchema).default([]),
  evidence_summary: EvidenceSummarySchema.optional(),
  license: z.string(),
  source_url: z.string().url(),
  github_url: z.string().url().optional(),
  install_command: z.string().optional(),
  last_verified: z.string().datetime().optional(),
  stale: z.boolean().default(false),
  freshness: z.object({
    upstream_changed: z.boolean().default(false),
    archived: z.boolean().default(false),
    stale: z.boolean().default(false),
    upstream_checked_at: z.string().datetime().optional(),
    pushed_at: z.string().datetime().optional(),
    last_verified: z.string().datetime().optional(),
  }).optional(),
  depth: z.object({
    level: z.enum(['thin', 'adequate', 'deep']),
    score: z.number(),
  }).optional(),
  scores: z.object({
    quality: z.number().nullable(),
    completeness: z.number().int().min(0).max(100),
  }).optional(),
  related_computed: z.array(z.string()).default([]),
  relationships: z.record(z.array(z.string())).default({}),
  security: SecurityFlagsSchema.default({}),
  security_flags: z.number().int().default(0),
  vulnerability_scan_at: z.string().datetime().optional(),
  secret_findings: z
    .array(z.object({ file: z.string(), line: z.number().nullable(), pattern: z.string(), likelyExample: z.boolean() }))
    .default([]),
  page_eligibility: z.object({
    state: z.enum(['eligible', 'needs_review', 'internal_only']),
    reason: z.string().optional(),
  }).optional(),
  url: z.string(),
  curation_state: z.enum(['curated', 'draft']).default('curated'),

  // NEW: Marketplace fields
  marketplace: z.object({
    install_count: z.number().int().min(0).default(0),
    install_success_rate: z.number().min(0).max(1).default(0),
    last_installed_at: z.string().datetime().optional(),
    rating_average: z.number().min(0).max(5).default(0),
    rating_count: z.number().int().min(0).default(0),
    rating_distribution: z.record(z.number().int().min(0)).default({}),
    quality_scores: z.object({
      performance: z.number().min(0).max(100).nullable().default(null),
      completeness: z.number().min(0).max(100).default(0),
      test_coverage: z.number().min(0).max(100).nullable().default(null),
      security: z.number().min(0).max(100).default(0),
      documentation: z.number().min(0).max(100).default(0),
      maintainability: z.number().min(0).max(100).default(0),
      community: z.number().min(0).max(100).nullable().default(null),
    }).default({}),
    composite_score: z.number().min(0).max(100).default(0),
    composite_label: z.enum(['exemplary', 'strong', 'adequate', 'weak', 'unproven']).default('unproven'),
    roadmap_stages: z.array(z.string()).default([]),
    roadmap_phase: z.enum(['foundations', 'platforms', 'trust-operations', 'advanced-agentic']).optional(),
    is_featured: z.boolean().default(false),
    is_official: z.boolean().default(false),
    publisher_tier: z.enum(['community', 'verified_publisher', 'official']).default('community'),
    install_manifest: z.object({
      version: z.string(),
      commands: z.array(z.object({
        name: z.string(),
        argv: z.array(z.string()),
        timeout_ms: z.number().int().positive().optional(),
      })).default([]),
      requirements: z.array(z.string()).default([]),
      limits: z.object({
        timeout_ms: z.number().int().positive().optional(),
        max_output_bytes: z.number().int().positive().optional(),
      }).optional(),
    }).optional(),
  }).optional(),
});

export const RegistrySchema = z.object({
  generated_at: z.string().datetime(),
  counts: z.object({
    total: z.number().int(),
    byType: z.record(z.number().int()),
    byDifficulty: z.record(z.number().int()),
    byVerification: z.record(z.number().int()),
    categories: z.number().int(),
    technologies: z.number().int(),
    stages: z.number().int(),
  }),
  taxonomy: z.object({
    categories: z.array(z.object({
      id: z.string(),
      slug: z.string(),
      title: z.string(),
      stage: z.string(),
      group: z.string(),
      order: z.number().int(),
      summary: z.string(),
      keywords: z.array(z.string()),
      tools: z.array(z.string()),
    })),
    technologies: z.array(z.object({
      id: z.string(),
      name: z.string(),
      category: z.string().optional(),
    })),
    stages: z.array(z.object({
      id: z.string(),
      title: z.string(),
      slug: z.string(),
      order: z.number().int(),
      phase: z.string(),
    })),
  }),
  resources: z.array(ResourceSchema),
});

export const SearchIndexEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  tagline: z.string().optional(),
  description: z.string(),
  type: ResourceTypeSchema,
  typeLabel: z.string(),
  category: z.string(),
  categorySlug: z.string(),
  tags: z.array(z.string()),
  technologies: z.array(z.string()),
  stage: z.string().optional(),
  difficulty: DifficultyLevelSchema.optional(),
  verification: VerificationLevelSchema,
  verification_earned: VerificationLevelSchema,
  eligibility: z.enum(['eligible', 'needs_review', 'internal_only']),
  url: z.string(),
  source_url: z.string().url(),
  install_command: z.string().optional(),
  last_verified: z.string().datetime().optional(),
  security: SecurityFlagsSchema,
});

export const SearchIndexSchema = z.object({
  generated_at: z.string().datetime(),
  entries: z.array(SearchIndexEntrySchema),
});

export type VerificationLevel = z.infer<typeof VerificationLevelSchema>;
export type ResourceType = z.infer<typeof ResourceTypeSchema>;
export type DifficultyLevel = z.infer<typeof DifficultyLevelSchema>;
export type EvidenceCheck = z.infer<typeof EvidenceCheckSchema>;
export type EvidenceEntry = z.infer<typeof EvidenceEntrySchema>;
export type EvidenceSummary = z.infer<typeof EvidenceSummarySchema>;
export type SecurityFlags = z.infer<typeof SecurityFlagsSchema>;
export type Resource = z.infer<typeof ResourceSchema>;
export type Registry = z.infer<typeof RegistrySchema>;
export type SearchIndexEntry = z.infer<typeof SearchIndexEntrySchema>;
export type SearchIndex = z.infer<typeof SearchIndexSchema>;

// NEW: Marketplace types
export type MarketplaceMetrics = z.infer<typeof MarketplaceMetricsSchema>;
export type QualityScores = MarketplaceMetrics['quality_scores'];
export type InstallManifest = NonNullable<MarketplaceMetrics['install_manifest']>;
export type CompositeLabel = 'exemplary' | 'strong' | 'adequate' | 'weak' | 'unproven';
export type PublisherTier = 'community' | 'verified_publisher' | 'official';
export type RoadmapPhase = 'foundations' | 'platforms' | 'trust-operations' | 'advanced-agentic';