import { z } from 'zod';

export const AnalyticsEventNameSchema = z.enum([
  'page_view',
  'search_query',
  'search_results',
  'resource_view',
  'install_click',
  'install_copy',
  'feedback_submit',
  'feedback_dismiss',
  'signup_newsletter',
  'signup_waitlist',
  'cli_install',
  'cli_search',
  'cli_verify',
  'api_request',
  'auth_login',
  'auth_logout',
  'workspace_create',
  'workspace_invite',
  'override_create',
  'override_update',
]);

export const BaseEventSchema = z.object({
  event: AnalyticsEventNameSchema,
  timestamp: z.string().datetime(),
  session_id: z.string().uuid(),
  user_id: z.string().optional(),
  workspace_id: z.string().optional(),
  anonymous_id: z.string().optional(),
  page: z.object({
    path: z.string(),
    referrer: z.string().optional(),
    title: z.string().optional(),
  }).optional(),
  context: z.object({
    user_agent: z.string().optional(),
    locale: z.string().optional(),
    timezone: z.string().optional(),
    screen_width: z.number().int().optional(),
    screen_height: z.number().int().optional(),
  }).optional(),
});

export const SearchQueryPropsSchema = z.object({
  query: z.string(),
  filters: z.record(z.unknown()).default({}),
  results_count: z.number().int().min(0),
  took_ms: z.number().int().min(0),
  page: z.number().int().min(1).default(1),
});

export const SearchResultsPropsSchema = z.object({
  query: z.string(),
  clicked_position: z.number().int().min(1).optional(),
  clicked_resource_id: z.string().optional(),
  results_count: z.number().int().min(0),
});

export const ResourceViewPropsSchema = z.object({
  resource_id: z.string(),
  resource_type: z.string(),
  resource_verification: z.string(),
  source: z.enum(['search', 'direct', 'browse', 'related', 'api', 'cli']),
  time_on_page_ms: z.number().int().min(0).optional(),
  scroll_depth: z.number().min(0).max(1).optional(),
});

export const InstallClickPropsSchema = z.object({
  resource_id: z.string(),
  resource_type: z.string(),
  command: z.string(),
  source: z.enum(['resource_page', 'search_result', 'homepage', 'api', 'cli']),
});

export const InstallCopyPropsSchema = z.object({
  resource_id: z.string(),
  command: z.string(),
  success: z.boolean(),
});

export const FeedbackSubmitPropsSchema = z.object({
  resource_id: z.string(),
  helpful: z.enum(['yes', 'partial', 'no']),
  has_comment: z.boolean(),
  comment_length: z.number().int().min(0).optional(),
});

export const FeedbackDismissPropsSchema = z.object({
  resource_id: z.string(),
});

export const SignupNewsletterPropsSchema = z.object({
  email: z.string().email(),
  source_page: z.string(),
  source_resource_id: z.string().optional(),
});

export const CliInstallPropsSchema = z.object({
  resource_id: z.string(),
  resource_type: z.string(),
  target_env: z.string().optional(),
  success: z.boolean(),
  error: z.string().optional(),
  duration_ms: z.number().int().min(0),
});

export const CliSearchPropsSchema = z.object({
  query: z.string(),
  filters: z.record(z.unknown()).default({}),
  results_count: z.number().int().min(0),
});

export const CliVerifyPropsSchema = z.object({
  resource_id: z.string(),
  target_env: z.string(),
  success: z.boolean(),
  checks_passed: z.number().int().min(0),
  checks_total: z.number().int().min(0),
  duration_ms: z.number().int().min(0),
});

export const ApiRequestPropsSchema = z.object({
  method: z.string(),
  path: z.string(),
  status_code: z.number().int(),
  duration_ms: z.number().int().min(0),
  workspace_id: z.string().optional(),
  api_key_id: z.string().optional(),
});

export const SearchQueryEventSchema = BaseEventSchema.extend({
  event: z.literal('search_query'),
  properties: SearchQueryPropsSchema,
});

export const SearchResultsEventSchema = BaseEventSchema.extend({
  event: z.literal('search_results'),
  properties: SearchResultsPropsSchema,
});

export const ResourceViewEventSchema = BaseEventSchema.extend({
  event: z.literal('resource_view'),
  properties: ResourceViewPropsSchema,
});

export const InstallClickEventSchema = BaseEventSchema.extend({
  event: z.literal('install_click'),
  properties: InstallClickPropsSchema,
});

export const InstallCopyEventSchema = BaseEventSchema.extend({
  event: z.literal('install_copy'),
  properties: InstallCopyPropsSchema,
});

export const FeedbackSubmitEventSchema = BaseEventSchema.extend({
  event: z.literal('feedback_submit'),
  properties: FeedbackSubmitPropsSchema,
});

export const FeedbackDismissEventSchema = BaseEventSchema.extend({
  event: z.literal('feedback_dismiss'),
  properties: FeedbackDismissPropsSchema,
});

export const SignupNewsletterEventSchema = BaseEventSchema.extend({
  event: z.literal('signup_newsletter'),
  properties: SignupNewsletterPropsSchema,
});

export const CliInstallEventSchema = BaseEventSchema.extend({
  event: z.literal('cli_install'),
  properties: CliInstallPropsSchema,
});

export const CliSearchEventSchema = BaseEventSchema.extend({
  event: z.literal('cli_search'),
  properties: CliSearchPropsSchema,
});

export const CliVerifyEventSchema = BaseEventSchema.extend({
  event: z.literal('cli_verify'),
  properties: CliVerifyPropsSchema,
});

export const ApiRequestEventSchema = BaseEventSchema.extend({
  event: z.literal('api_request'),
  properties: ApiRequestPropsSchema,
});

export const AllEventSchemas = z.discriminatedUnion('event', [
  SearchQueryEventSchema,
  SearchResultsEventSchema,
  ResourceViewEventSchema,
  InstallClickEventSchema,
  InstallCopyEventSchema,
  FeedbackSubmitEventSchema,
  FeedbackDismissEventSchema,
  SignupNewsletterEventSchema,
  CliInstallEventSchema,
  CliSearchEventSchema,
  CliVerifyEventSchema,
  ApiRequestEventSchema,
]);

export type AnalyticsEvent = z.infer<typeof AllEventSchemas>;
export type BaseEvent = z.infer<typeof BaseEventSchema>;
export type SearchQueryEvent = z.infer<typeof SearchQueryEventSchema>;
export type SearchResultsEvent = z.infer<typeof SearchResultsEventSchema>;
export type ResourceViewEvent = z.infer<typeof ResourceViewEventSchema>;
export type InstallClickEvent = z.infer<typeof InstallClickEventSchema>;
export type InstallCopyEvent = z.infer<typeof InstallCopyEventSchema>;
export type FeedbackSubmitEvent = z.infer<typeof FeedbackSubmitEventSchema>;
export type FeedbackDismissEvent = z.infer<typeof FeedbackDismissEventSchema>;
export type SignupNewsletterEvent = z.infer<typeof SignupNewsletterEventSchema>;
export type CliInstallEvent = z.infer<typeof CliInstallEventSchema>;
export type CliSearchEvent = z.infer<typeof CliSearchEventSchema>;
export type CliVerifyEvent = z.infer<typeof CliVerifyEventSchema>;
export type ApiRequestEvent = z.infer<typeof ApiRequestEventSchema>;

export const EVENT_VERSION = '1.0.0';

export function validateEvent(event: unknown): AnalyticsEvent {
  return AllEventSchemas.parse(event);
}