/**
 * Site-wide configuration and navigation model.
 * This is the single source of truth for chrome (top bar, sidebar, footer),
 * SEO defaults, and the product's positioning copy.
 */

export const SITE = {
  name: 'DE//AGENT',
  longName: 'Data Engineering for the Agent Era',
  url: 'https://de-agent-platform.vercel.app',
  tagline: 'Learn the pattern. Install the skill. Run the pipeline.',
  description:
    'An open registry and learning platform for modern Data Engineering: tutorials, architecture patterns, agent skills, MCP servers, agents, hooks and production runbooks — each with provenance, license, compatibility and verification status.',
  author: 'DE//AGENT',
  repo: 'https://github.com/XMIRTUNJAY/de-agent-platform',
  ogLabel: 'Data Engineering · Agent Era',
  locale: 'en',
  twitter: '',
} as const;

export type NavItem = { label: string; href: string; badge?: string; external?: boolean; icon?: string };
export type NavGroup = { title: string; items: NavItem[] };

/** Optional privacy-friendly analytics. Null provider ships zero third-party requests. */
export const ANALYTICS: { provider: null | 'plausible' | 'umami' | 'internal'; domain: string; script: string; endpoint: string; enabled: boolean } = {
  provider: 'internal',
  domain: '',
  script: '',
  endpoint: '/api/analytics/collect',
  enabled: true,
};

/** Top-bar navigation. Icons come from components/Icon.astro; every item
 * carries one so the mobile drawer and short screens keep recognition
 * (audit P1-2). */
export const TOP_NAV: NavItem[] = [
  { label: 'Roadmap', href: '/roadmap', icon: 'roadmap' },
  { label: 'Marketplace', href: '/marketplace', icon: 'market' },
  { label: 'Categories', href: '/categories', icon: 'categories' },
  { label: 'Tutorials', href: '/tutorials', icon: 'tutorials' },
  { label: 'Runbooks', href: '/runbooks', icon: 'runbooks' },
  { label: 'Docs', href: '/docs', icon: 'docs' },
];

/** Which top-nav section owns a route — gives detail/listing pages an active
 * nav context instead of a headless header (audit P2). Order matters: first
 * prefix match wins. */
export const NAV_SECTION_MAP: [prefix: string, href: string][] = [
  ['/skills/', '/marketplace'],
  ['/mcp/', '/marketplace'],
  ['/agents/', '/marketplace'],
  ['/hooks/', '/marketplace'],
  ['/plugins/', '/marketplace'],
  ['/templates/', '/marketplace'],
  ['/patterns/', '/marketplace'],
  ['/references/', '/marketplace'],
  ['/skills', '/marketplace'],
  ['/mcp', '/marketplace'],
  ['/agents', '/marketplace'],
  ['/hooks', '/marketplace'],
  ['/plugins', '/marketplace'],
  ['/templates', '/marketplace'],
  ['/patterns', '/marketplace'],
  ['/references', '/marketplace'],
  ['/tutorials/', '/tutorials'],
  ['/tutorials', '/tutorials'],
  ['/guides', '/tutorials'],
  ['/categories/', '/categories'],
  ['/categories', '/categories'],
  ['/taxonomy', '/categories'],
  ['/projects', '/roadmap'],
  ['/runbooks', '/runbooks'],
  ['/docs/', '/docs'],
  ['/docs', '/docs'],
  ['/resources', '/marketplace'],
];

/** Primary sidebar groups for documentation-style pages. Every item carries
 * an icon for recognition on short/mobile screens (audit P1-2). */
export const SIDEBAR: NavGroup[] = [
  {
    title: 'Get Started',
    items: [
      { label: 'Introduction', href: '/docs', icon: 'book' },
      { label: 'How the platform works', href: '/docs/how-it-works', icon: 'wrench' },
      { label: 'The Learning Roadmap', href: '/roadmap', icon: 'roadmap' },
      { label: 'Verification Levels', href: '/docs/verification', icon: 'shield' },
      { label: 'Security & Trust', href: '/docs/security', icon: 'shield' },
    ],
  },
  {
    title: 'Learn',
    items: [
      { label: 'Taxonomy', href: '/taxonomy', icon: 'categories' },
      { label: 'All categories', href: '/categories', icon: 'categories' },
      { label: 'Tutorials', href: '/tutorials', icon: 'tutorials' },
      { label: 'Guides', href: '/guides', icon: 'book' },
    ],
  },
  {
    title: 'Marketplace',
    items: [
      { label: 'Browse all', href: '/marketplace', icon: 'market' },
      { label: 'Skills', href: '/skills', icon: 'wrench' },
      { label: 'MCP servers', href: '/mcp', icon: 'market' },
      { label: 'Plugins', href: '/plugins', icon: 'market' },
      { label: 'Agents', href: '/agents', icon: 'market' },
      { label: 'Hooks', href: '/hooks', icon: 'market' },
      { label: 'Templates & starters', href: '/templates', icon: 'projects' },
      { label: 'References', href: '/references', icon: 'docs' },
    ],
  },
  {
    title: 'Build',
    items: [
      { label: 'Practical projects', href: '/projects', icon: 'projects' },
      { label: 'Architecture patterns', href: '/patterns', icon: 'roadmap' },
    ],
  },
  {
    title: 'Operate',
    items: [
      { label: 'Production playbooks', href: '/runbooks', icon: 'runbooks' },
      { label: 'Incident assistant', href: '/agents/incident-assistant', icon: 'shield' },
    ],
  },
  {
    title: 'Agentic Data Engineering',
    items: [
      { label: 'Capabilities overview', href: '/agentic', icon: 'roadmap' },
      { label: 'Skill anatomy', href: '/docs/skill-anatomy', icon: 'docs' },
      { label: 'Tool & MCP contract', href: '/docs/tooling', icon: 'wrench' },
      { label: 'Trust rule catalog', href: '/docs/trust-rules', icon: 'shield' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { label: 'Content object model', href: '/docs/content-model', icon: 'docs' },
      { label: 'Source quality score', href: '/docs/scoring', icon: 'runbooks' },
      { label: 'Ingestion pipeline', href: '/docs/ingestion', icon: 'wrench' },
      { label: 'Relationships graph', href: '/docs/relationships', icon: 'categories' },
      { label: 'Monetization policy', href: '/docs/monetization', icon: 'shield' },
      { label: 'Measurement', href: '/docs/measurement', icon: 'runbooks' },
      { label: 'Maintenance', href: '/docs/maintenance', icon: 'wrench' },
    ],
  },
  {
    title: 'Curation',
    items: [
      { label: 'Curation workflow', href: '/admin', icon: 'shield' },
      { label: 'Review queue', href: '/admin/queue', icon: 'docs' },
      { label: 'Registry health', href: '/admin/health', icon: 'runbooks' },
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
      { label: 'Source (GitHub)', href: 'https://github.com/XMIRTUNJAY/de-agent-platform', external: true },
      { label: 'eManisha (home)', href: 'https://emanisha.in/', external: true },
      { label: 'Contribute a resource', href: '/docs/contributing' },
      { label: 'RSS', href: '/rss.xml' },
      { label: 'Sitemap', href: '/sitemap-index.xml' },
    ],
  },
];
