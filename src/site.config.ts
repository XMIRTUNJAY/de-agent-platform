/**
 * Site-wide configuration and navigation model.
 * This is the single source of truth for chrome (top bar, sidebar, footer),
 * SEO defaults, and the product's positioning copy.
 */

export const SITE = {
  name: 'DE//AGENT',
  longName: 'Data Engineering for the Agent Era',
  url: 'https://de-agent.example.dev',
  tagline: 'Learn the pattern. Install the skill. Run the pipeline.',
  description:
    'An open registry and learning platform for modern Data Engineering: tutorials, architecture patterns, agent skills, MCP servers, agents, hooks and production runbooks — each with provenance, license, compatibility and verification status.',
  author: 'DE//AGENT',
  repo: 'https://github.com/de-agent/platform',
  ogLabel: 'Data Engineering · Agent Era',
  locale: 'en',
  twitter: '',
} as const;

export type NavItem = { label: string; href: string; badge?: string; external?: boolean };
export type NavGroup = { title: string; items: NavItem[] };

/** Top-bar navigation (mirrors a docs-product top bar). */
export const TOP_NAV: NavItem[] = [
  { label: 'Roadmap', href: '/roadmap' },
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Projects', href: '/projects' },
  { label: 'Runbooks', href: '/runbooks' },
];

/** Primary sidebar groups for documentation-style pages. */
export const SIDEBAR: NavGroup[] = [
  {
    title: 'Get Started',
    items: [
      { label: 'Introduction', href: '/docs' },
      { label: 'How the platform works', href: '/docs/how-it-works' },
      { label: 'The Learning Roadmap', href: '/roadmap' },
      { label: 'Verification Levels', href: '/docs/verification' },
      { label: 'Security & Trust', href: '/docs/security' },
    ],
  },
  {
    title: 'Learn',
    items: [
      { label: 'Taxonomy', href: '/taxonomy' },
      { label: 'All categories', href: '/categories' },
      { label: 'Tutorials', href: '/tutorials' },
      { label: 'Guides', href: '/guides' },
    ],
  },
  {
    title: 'Marketplace',
    items: [
      { label: 'Browse all', href: '/marketplace' },
      { label: 'Skills', href: '/skills' },
      { label: 'MCP servers', href: '/mcp' },
      { label: 'Plugins', href: '/plugins' },
      { label: 'Agents', href: '/agents' },
      { label: 'Hooks', href: '/hooks' },
      { label: 'Templates & starters', href: '/templates' },
      { label: 'References', href: '/references' },
    ],
  },
  {
    title: 'Build',
    items: [
      { label: 'Practical projects', href: '/projects' },
      { label: 'Architecture patterns', href: '/patterns' },
    ],
  },
  {
    title: 'Operate',
    items: [
      { label: 'Production playbooks', href: '/runbooks' },
      { label: 'Incident assistant', href: '/agents/incident-assistant' },
    ],
  },
  {
    title: 'Agentic Data Engineering',
    items: [
      { label: 'Capabilities overview', href: '/agentic' },
      { label: 'Skill anatomy', href: '/docs/skill-anatomy' },
      { label: 'Tool & MCP contract', href: '/docs/tooling' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { label: 'Content object model', href: '/docs/content-model' },
      { label: 'Source quality score', href: '/docs/scoring' },
      { label: 'Ingestion pipeline', href: '/docs/ingestion' },
      { label: 'Relationships graph', href: '/docs/relationships' },
      { label: 'Monetization policy', href: '/docs/monetization' },
    ],
  },
  {
    title: 'Curation',
    items: [
      { label: 'Curation workflow', href: '/admin' },
      { label: 'Review queue', href: '/admin/queue' },
      { label: 'Registry health', href: '/admin/health' },
    ],
  },
];

export const FOOTER_COLUMNS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Product',
    items: [
      { label: 'Roadmap', href: '/roadmap' },
      { label: 'Marketplace', href: '/marketplace' },
      { label: 'Projects', href: '/projects' },
      { label: 'Runbooks', href: '/runbooks' },
    ],
  },
  {
    title: 'Registry',
    items: [
      { label: 'Skills', href: '/skills' },
      { label: 'MCP servers', href: '/mcp' },
      { label: 'Agents', href: '/agents' },
      { label: 'Hooks', href: '/hooks' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { label: 'Taxonomy', href: '/taxonomy' },
      { label: 'Content model', href: '/docs/content-model' },
      { label: 'Scoring', href: '/docs/scoring' },
      { label: 'Security', href: '/docs/security' },
    ],
  },
  {
    title: 'Project',
    items: [
      { label: 'Source (GitHub)', href: 'https://github.com/de-agent/platform', external: true },
      { label: 'Contribute a resource', href: '/docs/contributing' },
      { label: 'RSS', href: '/rss.xml' },
      { label: 'Sitemap', href: '/sitemap-index.xml' },
    ],
  },
];
