import { z } from 'zod';
import { VerificationLevelSchema, ResourceTypeSchema } from './schemas.js';

export const WorkspacePlanSchema = z.enum(['free', 'team', 'enterprise']);
export const WorkspaceRoleSchema = z.enum(['admin', 'member', 'viewer']);

export const WorkspaceMemberSchema = z.object({
  user_id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  avatar_url: z.string().url().optional(),
  role: WorkspaceRoleSchema.default('member'),
  joined_at: z.string().datetime(),
});

export const WorkspaceSettingsSchema = z.object({
  private_registry: z.boolean().default(false),
  sso_enabled: z.boolean().default(false),
  sso_provider: z.enum(['github', 'gitlab', 'oidc', 'saml']).optional(),
  audit_log_retention_days: z.number().int().min(1).max(365).default(90),
  allowed_domains: z.array(z.string()).default([]),
});

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  owner_id: z.string(),
  plan: WorkspacePlanSchema.default('free'),
  members: z.array(WorkspaceMemberSchema).default([]),
  settings: WorkspaceSettingsSchema.default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  stripe_customer_id: z.string().optional(),
  stripe_subscription_id: z.string().optional(),
});

export const ResourceOverrideSchema = z.object({
  workspace_id: z.string(),
  resource_id: z.string(),
  verification: VerificationLevelSchema,
  notes: z.string().optional(),
  tested_at: z.string().datetime().optional(),
  tested_by: z.string().optional(),
  evidence: z.array(z.object({
    check: z.string(),
    status: z.enum(['passed', 'failed']),
    at: z.string().datetime(),
    by: z.string(),
    summary: z.string(),
  })).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const AuditLogEntrySchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  user_id: z.string(),
  action: z.enum([
    'resource_view',
    'resource_install',
    'resource_verify',
    'override_create',
    'override_update',
    'member_invite',
    'member_remove',
    'settings_change',
    'feedback_submit',
  ]),
  resource_id: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
  ip_hash: z.string().optional(),
  user_agent: z.string().optional(),
  created_at: z.string().datetime(),
});

export const FeedbackSchema = z.object({
  id: z.string(),
  resource_id: z.string(),
  workspace_id: z.string().optional(),
  user_id: z.string().optional(),
  email: z.string().email().optional(),
  helpful: z.enum(['yes', 'partial', 'no']),
  comment: z.string().max(2000).optional(),
  user_agent: z.string().optional(),
  created_at: z.string().datetime(),
});

export const ApiKeySchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  name: z.string(),
  prefix: z.string(),
  hashed_key: z.string(),
  scopes: z.array(z.enum(['read', 'write:feedback', 'write:overrides', 'admin'])).default(['read']),
  last_used_at: z.string().datetime().optional(),
  expires_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
});

export type WorkspacePlan = z.infer<typeof WorkspacePlanSchema>;
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;
export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;
export type WorkspaceSettings = z.infer<typeof WorkspaceSettingsSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type ResourceOverride = z.infer<typeof ResourceOverrideSchema>;
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;
export type Feedback = z.infer<typeof FeedbackSchema>;
export type ApiKey = z.infer<typeof ApiKeySchema>;