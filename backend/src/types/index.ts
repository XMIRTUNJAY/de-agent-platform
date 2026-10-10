/**
 * Core type definitions for DE//AGENT Skill Collector
 * Canonical schemas for all registry entities
 */

// ============================================================================
// Base Types
// ============================================================================

export type VerificationLevel = 'community' | 'reviewed' | 'tested' | 'verified';
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';
export type ResourceType = 
  | 'skill' | 'mcp' | 'plugin' | 'agent' | 'hook' 
  | 'template' | 'starter' | 'runbook' | 'architecture' | 'reference';

export type SecurityFlag = 
  | 'runs_code' 
  | 'network_access' 
  | 'credentials' 
  | 'filesystem_access' 
  | 'external_apis';

export type LicenseType = 
  | 'Apache-2.0' 
  | 'MIT' 
  | 'BSD-3-Clause' 
  | 'CC-BY-4.0' 
  | 'Proprietary' 
  | 'Other';

export type SourceKind = 
  | 'github' 
  | 'npm' 
  | 'docs' 
  | 'blog' 
  | 'registry' 
  | 'marketplace' 
  | 'custom';

export type CurationState = 
  | 'discovered' 
  | 'pending_review' 
  | 'license_checked' 
  | 'reviewed' 
  | 'tested' 
  | 'verified' 
  | 'published' 
  | 'deprecated';

// ============================================================================
// Entity Definitions
// ============================================================================

export interface BaseEntity {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: ResourceType;
  category: string;
  subcategory?: string;
  difficulty: DifficultyLevel;
  tags: string[];
  technologies: string[];
  learningObjectives: string[];
  prerequisites: string[];
  version?: string;
  license?: LicenseType;
  author?: string;
  publisher?: string;
  sourceUrl?: string;
  githubUrl?: string;
  homepage?: string;
  verification: VerificationLevel;
  lastVerified?: string;
  security: Record<SecurityFlag, boolean>;
  securityNotes?: string;
  relationships: Record<string, string[]>;
  sourceFile?: string;
  provenance?: ProvenanceRecord;
  curationState: CurationState;
  createdAt: string;
  updatedAt: string;
  scores?: QualityScores;
}

export interface ProvenanceRecord {
  sourceKind: SourceKind;
  sourceUrl: string;
  sourceAuthor?: string;
  sourceLicense?: string;
  fetchedAt: string;
  fetchedBy: string;
  checksum?: string;
  originalData?: Record<string, unknown>;
}

export interface QualityScores {
  quality: number | null;        // 0-5 source quality
  completeness: number;          // 0-100 field completeness
  trust: number;                 // 0-5 trust score
  qualityLabel: string | null;
  lastScored: string;
}

// ============================================================================
// Type-Specific Payloads
// ============================================================================

export interface SkillPayload extends BaseEntity {
  type: 'skill';
  files: string[];
  body: string;
  supportedAgents: string[];
  installCommand?: string;
}

export interface MCPPayload extends BaseEntity {
  type: 'mcp';
  server: {
    name: string;
    registry: 'official' | 'vendor' | 'community';
    publisher: string;
  };
  transport: 'stdio' | 'sse' | 'http';
  tools: string[];
  installation: {
    command: string;
    configSnippet: Record<string, unknown>;
  };
  environmentVariables: EnvVar[];
}

export interface AgentPayload extends BaseEntity {
  type: 'agent';
  purpose: string;
  inputs: string[];
  tools: string[];
  skills: string[];
  mcp: string[];
  workflow: string[];
  outputs: string[];
  guardrails: string[];
  example?: string;
  evaluation?: string;
}

export interface HookPayload extends BaseEntity {
  type: 'hook';
  trigger: string;
  implementation: string;
  example?: string;
  failureBehavior: 'block' | 'warn' | 'confirm' | 'redact';
  supportedAgents: string[];
}

export interface PluginPayload extends BaseEntity {
  type: 'plugin';
  runtime: string;
  capabilities: string[];
  tools: string[];
  commands: string[];
  hooks: string[];
  skills: string[];
  installation: string;
  permissions: {
    filesystem: 'none' | 'read' | 'read-write';
    network: 'none' | 'specific' | 'any';
    credentials: 'none' | 'specific' | 'any';
  };
}

export interface TemplatePayload extends BaseEntity {
  type: 'template';
  technologies: string[];
  contents: string[];
  repoStructure: string;
  installation: string;
}

export interface StarterPayload extends BaseEntity {
  type: 'starter';
  stack: string[];
  architecture: string;
  repoStructure: string;
  sampleData?: string;
  setup: string[];
  implementation: string[];
  tests: string[];
  failureScenarios: string[];
  productionHardening: string[];
  agentSkills: string[];
}

export interface RunbookPayload extends BaseEntity {
  type: 'runbook';
  severity: 'critical' | 'high' | 'medium' | 'low';
  symptoms: string[];
  possibleCauses: string[];
  diagnosis: string[];
  commands: string[];
  fix: string[];
  prevention: string[];
  monitoring: string[];
  agentSkills: string[];
  agents: string[];
}

export interface ArchitecturePayload extends BaseEntity {
  type: 'architecture';
  context: string;
  forces: string[];
  solution: string;
  diagram?: string;
  tradeoffs: string[];
  whenToUse: string[];
  whenNot: string[];
  implementations: string[];
}

export interface ReferencePayload extends BaseEntity {
  type: 'reference';
  url: string;
  publisher: string;
  kind: 'documentation' | 'spec' | 'book' | 'guide' | 'repo';
  why: string;
  quality: Record<string, number | null>;
}

// ============================================================================
// Union Types
// ============================================================================

export type TypedPayload = 
  | SkillPayload 
  | MCPPayload 
  | AgentPayload 
  | HookPayload 
  | PluginPayload 
  | TemplatePayload 
  | StarterPayload 
  | RunbookPayload 
  | ArchitecturePayload 
  | ReferencePayload;

export type AnyPayload = BaseEntity & { payload?: TypedPayload };

// ============================================================================
// Collector Types
// ============================================================================

export interface CollectorConfig {
  name: string;
  kind: SourceKind;
  enabled: boolean;
  rateLimit?: { requests: number; windowMs: number };
  auth?: AuthConfig;
  selectors?: SelectorConfig;
  filters?: FilterConfig;
}

export interface AuthConfig {
  type: 'token' | 'oauth' | 'basic' | 'none';
  tokenEnvVar?: string;
  usernameEnvVar?: string;
  passwordEnvVar?: string;
}

export interface SelectorConfig {
  listSelector?: string;
  itemSelectors: Record<string, string>;
  pagination?: {
    type: 'page' | 'cursor' | 'offset';
    selector?: string;
    maxPages?: number;
  };
}

export interface FilterConfig {
  includePatterns?: string[];
  excludePatterns?: string[];
  minStars?: number;
  minUpdatedDays?: number;
  requiredTopics?: string[];
}

export interface CollectionResult {
  source: string;
  items: RawCollectedItem[];
  errors: CollectionError[];
  stats: CollectionStats;
}

export interface RawCollectedItem {
  sourceId: string;
  sourceUrl: string;
  rawData: Record<string, unknown>;
  fetchedAt: string;
}

export interface CollectionError {
  url: string;
  error: string;
  timestamp: string;
}

export interface CollectionStats {
  totalFetched: number;
  newItems: number;
  updatedItems: number;
  errors: number;
  durationMs: number;
}

// ============================================================================
// Generation Types
// ============================================================================

export interface GenerationOptions {
  outputDir: string;
  formats: ('json' | 'yaml' | 'md' | 'sql')[];
  includeUnverified: boolean;
  groupByType: boolean;
  groupByCategory: boolean;
  generateSummarySheet: boolean;
  generateSitemap: boolean;
  generateSearchIndex: boolean;
}

export interface SummarySheet {
  generatedAt: string;
  totalResources: number;
  byType: Record<ResourceType, number>;
  byCategory: Record<string, number>;
  byVerification: Record<VerificationLevel, number>;
  byDifficulty: Record<DifficultyLevel, number>;
  bySecurity: Record<SecurityFlag, number>;
  topTechnologies: { technology: string; count: number }[];
  curationStatus: Record<CurationState, number>;
  staleResources: StaleResource[];
  qualityDistribution: { range: string; count: number }[];
  missingFields: { field: string; missingCount: number }[];
}

export interface StaleResource {
  id: string;
  title: string;
  type: ResourceType;
  lastVerified: string | null;
  daysSinceVerification: number;
  verification: VerificationLevel;
}

// ============================================================================
// Environment Variable
// ============================================================================

export interface EnvVar {
  name: string;
  description: string;
  required: boolean;
  example?: string;
}