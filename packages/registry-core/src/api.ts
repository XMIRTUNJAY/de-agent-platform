import { z } from 'zod';
import { ResourceSchema, SearchIndexEntrySchema, VerificationLevelSchema, ResourceTypeSchema, DifficultyLevelSchema, EvidenceCheckSchema } from './schemas.js';
import { FeedbackSchema, WorkspaceSchema, ResourceOverrideSchema, ApiKeySchema } from './workspace.js';

export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
});

export const ResourceFiltersSchema = z.object({
  q: z.string().optional(),
  type: ResourceTypeSchema.optional(),
  category: z.string().optional(),
  technology: z.string().optional(),
  stage: z.string().optional(),
  difficulty: DifficultyLevelSchema.optional(),
  verification: VerificationLevelSchema.optional(),
  verification_earned: VerificationLevelSchema.optional(),
  has_install: z.boolean().optional(),
  security_flags: z.array(z.string()).optional(),
});

export const SearchRequestSchema = PaginationSchema.merge(ResourceFiltersSchema);
export const SearchResponseSchema = z.object({
  data: z.array(SearchIndexEntrySchema),
  pagination: z.object({
    page: z.number().int(),
    per_page: z.number().int(),
    total: z.number().int(),
    total_pages: z.number().int(),
  }),
  facets: z.object({
    types: z.record(z.number().int()),
    categories: z.record(z.number().int()),
    technologies: z.record(z.number().int()),
    stages: z.record(z.number().int()),
    difficulties: z.record(z.number().int()),
    verifications: z.record(z.number().int()),
  }).optional(),
});

export const ResourceResponseSchema = ResourceSchema;

export const EvidenceResponseSchema = z.object({
  resource_id: z.string(),
  evidence: z.array(z.object({
    check: z.string(),
    status: z.enum(['passed', 'failed', 'unclaimed', 'skipped']),
    at: z.string().datetime().nullable(),
    by: z.string().nullable(),
    tool: z.string().optional(),
    version: z.string().optional(),
    summary: z.string(),
  })),
  summary: z.object({
    earned: VerificationLevelSchema,
    claimed: VerificationLevelSchema,
    gap: z.number().int(),
  }),
});

export const FeedbackCreateSchema = FeedbackSchema.omit({ id: true, created_at: true });
export const FeedbackResponseSchema = FeedbackSchema;

export const WorkspaceCreateSchema = WorkspaceSchema.omit({ id: true, created_at: true, updated_at: true, owner_id: true, members: true, stripe_customer_id: true, stripe_subscription_id: true });
export const WorkspaceResponseSchema = WorkspaceSchema;

export const OverrideCreateSchema = ResourceOverrideSchema.omit({ workspace_id: true, created_at: true, updated_at: true });
export const OverrideResponseSchema = ResourceOverrideSchema;

export const ApiKeyCreateSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(['read', 'write:feedback', 'write:overrides', 'admin'])).default(['read']),
  expires_in_days: z.number().int().min(1).max(365).optional(),
});
export const ApiKeyResponseSchema = ApiKeySchema.omit({ hashed_key: true }).extend({
  key: z.string().optional(), // only returned on creation
});

export const CompatibilityMatrixSchema = z.object({
  skill_id: z.string(),
  environments: z.array(z.object({
    name: z.string(),
    version: z.string(),
    status: z.enum(['passed', 'failed', 'running', 'pending', 'not_tested']),
    last_tested: z.string().datetime().optional(),
    evidence: z.array(z.object({
      check: z.string(),
      status: z.enum(['passed', 'failed']),
      summary: z.string(),
    })).default([]),
  })),
});

export const InstallRequestSchema = z.object({
  resource_id: z.string(),
  workspace_id: z.string().optional(),
  target_env: z.string().optional(), // e.g., "databricks-14.3"
});

export const InstallResponseSchema = z.object({
  resource_id: z.string(),
  command: z.string(),
  instructions: z.array(z.string()),
  requirements: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});

export type Pagination = z.infer<typeof PaginationSchema>;
export type ResourceFilters = z.infer<typeof ResourceFiltersSchema>;
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type ResourceResponse = z.infer<typeof ResourceResponseSchema>;
export type EvidenceResponse = z.infer<typeof EvidenceResponseSchema>;
export type FeedbackCreate = z.infer<typeof FeedbackCreateSchema>;
export type FeedbackResponse = z.infer<typeof FeedbackResponseSchema>;
export type WorkspaceCreate = z.infer<typeof WorkspaceCreateSchema>;
export type WorkspaceResponse = z.infer<typeof WorkspaceResponseSchema>;
export type OverrideCreate = z.infer<typeof OverrideCreateSchema>;
export type OverrideResponse = z.infer<typeof OverrideResponseSchema>;
export type ApiKeyCreate = z.infer<typeof ApiKeyCreateSchema>;
export type ApiKeyResponse = z.infer<typeof ApiKeyResponseSchema>;
export type CompatibilityMatrix = z.infer<typeof CompatibilityMatrixSchema>;
export type InstallRequest = z.infer<typeof InstallRequestSchema>;
export type InstallResponse = z.infer<typeof InstallResponseSchema>;