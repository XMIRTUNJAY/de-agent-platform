# DE//AGENT — ampcode.com-Format Redesign (Deep Reskin)

Date: 2026-10-07
Status: Approved design (pending spec review)

## Goal

Redesign `de-agent-platform` (Astro 5 + Tailwind 4) so the site follows the
**format/layout grammar of https://ampcode.com/** while keeping DE//AGENT's own
visual identity, and using **only real registry data** (no fake videos, tweets,
or testimonial content). Scope is a **whole-site sweep with a deep reskin** of
inner pages, plus bundling fixes for known defects.

Identity to keep:
- Dark-first theme (`--shell: #0b0d0b`) with green accent (`#4ade80`), light theme stays available.
- Fonts: Instrument Serif (display), Inter Variable (body), JetBrains Mono Variable (mono) via fontsource.

Layout grammar to adopt from ampcode.com:
- Mono kicker → serif display headline → muted lede → content.
- Marketing sections use a narrower content column (~1120px; current pages use 1600px shell with full-bleed marketing blocks).
- Generous vertical rhythm (~96–120px between major sections).
- Hairline borders, minimal shadows, arrow links (`→`).
- Restrained animation: keep `mount`/`reveal` family; **delete** `char-bounce` headline and `pulse-glow` CTA theatrics.

## Homepage (`src/pages/index.astro`) — full amp-format rebuild

Sections in ampcode.com order, all populated from `registry.json` / `stats.json`:

1. **Hero with rotating headline.** Fixed prefix + rotating phrase from:
   "Learn the pattern." → "Install the skill." → "Run the pipeline." → "Ship agent-native data."
   Rotation via small inline script (respects `prefers-reduced-motion`, has static
   no-JS fallback showing the first phrase). Lede = `SITE.description`.
   CTAs: accent "Explore the Roadmap →" (`/roadmap`), ghost "Browse the Marketplace" (`/marketplace`).

2. **"A Day in the Platform"** walkthrough section (maps amp's video+chapters).
   - Left: featured panel describing the end-to-end journey (Learn → Build → Install → Operate).
   - Right: numbered chapter list = the 13 real roadmap stages from
     `registry.taxonomy.stages`, each linking to `/roadmap#<slug>`.

3. **Five feature cards with faux UI** (maps amp's orb feature cards). Each card
   renders a small purpose-built mock widget populated with real data:
   1. *One command to install* — faux terminal showing a real `install_command`.
   2. *Verification you can audit* — mock resource header with real verification chip + `last_verified`.
   3. *Security posture at a glance* — real counts for read-only / credentials / network-access resources.
   4. *Symptom → diagnosis → fix* — a real runbook title with 3-step structure.
   5. *A marketplace, not a pile of links* — a real resource card with license + compatibility chips.

4. **"Learn by building" series cards** (maps "Orbs from Zero") — numbered cards
   from real `starter` and `architecture` resources (title, tagline, difficulty).

5. **"Registry in numbers" stat band** (replaces the tweet wall — honest social
   proof): totals computed from `stats.json` (135 resources, 121 reviewed/verified,
   38 categories, 13 stages, 31 technologies at time of writing; rendered
   dynamically, never hardcoded). No fabricated testimonials.

6. **Install band** (maps amp's CLI section): faux terminal with 2–3 real
   `install_command` values (e.g. one skill, one MCP server), plus a copy affordance
   consistent with existing `.codeblock`/`.copy-btn` patterns.

7. **"Fresh from the registry" announcements grid** (maps amp's news grid): 6
   most recent resources by `last_verified`, each with type chip + date, plus
   "View all → `/marketplace`".

Footer stays (already column-based); content unchanged except spacing polish.

## Inner pages — deep reskin

New shared components:
- `PageHero.astro` — mono kicker, serif H1, muted lede, optional stat chips row.
- `SectionHeader.astro` — kicker + serif H2 + optional "view all" arrow link.
- `ResourceCard.astro` — the one canonical resource card (type chip, title, tagline,
  verification chip, difficulty, hover treatment). Replaces per-page ad-hoc cards.

Per-route changes:
- `/roadmap` → **chapter timeline**: numbered 01–13 stages on an accent spine,
  each stage an anchor-target card (`#<slug>`) — mirrors amp's chapter DNA.
- `/marketplace` → featured-resources row + filter rail (existing FilterGroup,
  restyled) + uniform ResourceCard grid.
- `/skills`, `/mcp`, `/agents`, `/hooks`, `/projects`, `/runbooks` → one shared
  template: PageHero + stat chips + ResourceCard grid.
- `/resources/[slug]` → amp-docs style article: prose column (existing `.prose-de`)
  + sticky meta rail (verification, license, install command, security flags, related).
- `/taxonomy`, `/categories/[slug]`, `/search` → PageHero + consistent grids.

## Chrome fixes (bundled)

In files already being touched:
1. Fix broken `⌘K`: BaseLayout registers two competing keydown listeners (the
   palette opens then instantly closes). Consolidate into a single handler.
2. Remove duplicate `id="sidebar-scrim"` rendered by both TopBar and SidebarNav
   (single instance owned by BaseLayout).
3. Fix skip-link: `focus:btn` / `focus:btn-accent` cannot work (`.btn` is not a
   Tailwind utility); give the skip link a plain CSS class.
4. Delete dead `@font-face` blocks referencing missing `/fonts/*.woff2`
   (fontsource already provides the fonts; the block only generates 404s).
5. Add `public/og.svg` (1200×630 branded card: logo + name + tagline) — the
   layout already references it; social cards are currently broken.
6. Add missing `/rss.xml` endpoint — `@astrojs/rss` is already a dependency and
   the footer links to it, but no endpoint exists.
7. Replace undefined `.surface` class usages (FilterGroup, marketplace, roadmap,
   resources/[slug], search, categories/[slug]) with the proper card classes.
8. Prune dead CSS: `.toast*`, `.avatar*`, `.divider*`, `.line-draw`, `.shimmer`,
   `.card-bordered`, `.shell-x`, `.mono-label-sm`, `.btn-icon`, unused tokens
   (`--border-focus`, `--stagger-max`, `--shadow-xs`), and the duplicated
   `prefers-reduced-motion` block. Also remove `.char-bounce`/`.pulse-glow`
   once the homepage stops using them.

## Navigation 404s

TOP_NAV points to `/docs`, which has no page. The sidebar references ~17 routes
that don't exist (`/tutorials`, `/plugins`, `/templates`, `/patterns`, `/agentic`,
`/admin`, `/admin/health`, `/docs/*`…).

Plan:
- TOP_NAV contains only routes that exist.
- Sidebar entries for not-yet-built routes get a `soon` badge and are rendered
  as non-links (no dead ends).
- Add a branded `404.astro` so unknown URLs get a styled page with links home
  and to the marketplace.

## Non-goals

- No new content types or pipeline changes (registry.json shape unchanged).
- No fabricated social proof, videos, or news posts.
- No framework migration; stays Astro + Tailwind 4.
- `/admin*` curation tooling is out of scope.

## Verification

- `npm run build` (runs the data pipeline then `astro build`) passes.
- `npm run check` (`astro check`) passes.
- Spot-check generated HTML for `/`, `/roadmap`, `/marketplace`, one
  `/resources/<slug>` page, `/404.html`: hero rotator markup present, chapter
  anchors match roadmap stage slugs, feature cards contain real resource titles,
  no references to deleted classes (`.surface`, `.char-bounce`, …).
- After implementation: run the full audit with the web-design-guidelines skill.

## Risks

- **Animation cleanup** touches shared CSS used by all pages — keep `mount`/`reveal`
  names stable so inner pages don't break.
- **Rotator script** must not break the static build or a11y (aria-live off,
  reduced-motion shows a static headline).
- **rss.xml** must serialize only fields that exist (`last_verified` may be absent
  on some resources — fall back to `generated_at`).
