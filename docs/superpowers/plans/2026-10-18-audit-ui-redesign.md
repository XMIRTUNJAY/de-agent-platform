# Audit-Driven UI Redesign Plan (judgment-filtered)

> Source: external UI/UX audit of the live site (2026-10-18). Filtered per human
> partner instruction: adopt what works, reject what conflicts with the standing
> brief (`docs/superpowers/plans/2026-10-17-de-agent-design-overhaul.md` §A/§F)
> and the no-fabrication rule. Foundation fix already pushed: `381d3bb`
> (cascade-layer root cause of the shattered marketplace).

## Adopted / Rejected / Already-built

**Adopt:** contrast overhaul of both themes; SVG score gauge; per-type colored
badges; copy-install on cards; trust tiering pipeline (real counts only);
roadmap phase stepper; runbook symptom triage + incident-assistant CTA; docs
"On this page" TOC; terminal chrome.

**Rejected (with reason):** glassmorphism / 3D / glowing particles (brief §A
anti-goals — generic AI-startup aesthetic); Geist/Jakarta font swap (Instrument
Serif + Inter + JetBrains Mono IS the brand, brief §3); "99.9% uptime · v2.4"
status pill (fabricated metrics); tabbed npx/pnpm/pip/uv installers (only one
real install path exists — inventing others violates §F); embedded interactive
previews inside every card (bundle weight, restrained-motion requirement).

**Stale audit claims (already built):** filters as static text lists (FilterPanel
with URL sync, chips, clear-all, drawers — the audit crawler hit the site while
the cascade bug shattered it); missing copy buttons on code blocks (exist);
score meter (exists as text — upgraded to gauge this sprint).

## Global Constraints (unchanged)

- No new dependencies; counts derived from canonical data; verification
  vocabulary fixed (community/reviewed/tested/verified); no fabricated metrics,
  commands, or completion tracking; preserve URLs/static rendering; WCAG 2.2 AA;
  every task leaves `npm test` + shell e2e + `npm run check` green; commits to main.

---

### S1.1 Theme tokens — high-contrast dark + crisp light
**Files:** `src/styles/global.css` (token blocks only, lines 17–195)
- Dark: shell `#0a0f0d`-family, surfaces clearly elevated, borders stronger
  (8%/14%), fg scale raised (`#eef2ea` / `#a8b3a9` / `#71806f`).
- Light: neutral bg (not green-tinted), pure white surfaces, stronger text
  (`#101710` / `#414b43` / `#6a776c`), borders 10%/18%.
- Accept: contrast probe script — body text ≥ 4.5:1, muted ≥ 4.5:1 on their
  surfaces in BOTH modes (computed, not eyeballed). No component markup changes.

### S1.2 Score gauge (SVG ring) on cards
**Files:** `src/components/ResourceCard.astro`, `src/styles/global.css`
- 28px ring: track + arc (stroke-dasharray from `scoreBand().pct`), integer
  centered, tone from band; label + tooltip keep canonical `composite_label`.
- Header row: type badge (S1.3) left, gauge right — no more 3-line wrapping.

### S1.3 Per-type colored badges
**Files:** `src/styles/global.css`, `ResourceCard.astro`, `ListingPage.astro`
- `.type-badge[data-type=…]` — skill=emerald, mcp=cyan, hook=amber,
  agent=violet, runbook=rose, template/plugin/reference/pattern=neutral.
  Colors as border-left + tinted text (restrained, not filled pills).
- Derived from `r.type`; unknown types fall back to neutral (no invented colors).

### S1.4 Copy-install on cards
**Files:** `ResourceCard.astro`
- Small copy icon-button in card footer ONLY when `r.install_command` exists
  (real command, verbatim); copies via existing clipboard pattern; "Copied"
  feedback inline. No invented package-manager variants.

### S1.5 Terminal chrome
**Files:** `src/styles/global.css` `.codeblock`
- Header bar: three dots + `terminal` label + existing Copy button restyled;
  works for hero/install/detail blocks. Real commands only.

### S2.1 Runbook triage console
**Files:** `src/pages/runbooks.astro`
- Top: severity quick-filter chips (All / critical / high / medium) — derived
  counts, URL `?severity=` sync via existing filter-state pattern.
- Each card: severity badge (icon+word), symptom-first first line (real
  `symptoms[0]`), link to incident assistant agent (real registry id — resolve
  at build; omit section if absent).

### S2.2 Roadmap phase stepper
**Files:** `src/pages/roadmap.astro`
- Replace rail cards with a connected stepper: phase number + name + derived
  resource count, progress-line connector. Exit gates get a high-contrast
  callout treatment (mono "GATE" tag + deliverable link). No completion %.

### S2.3 Marketplace control bar
**Files:** `src/pages/marketplace.astro`
- Single toolbar row: result count left, active-chips inline, sort right;
  chips row merges into the bar (removes the double-row feel at 1200+).

### S3.1 Docs "On this page" TOC
**Files:** `src/layouts/DocsLayout.astro`, `src/styles/global.css`
- Right rail (≥1200px): h2/h3 anchors extracted from rendered article, sticky,
  scroll-spy highlight, keyboard reachable. Hidden < 1200px.

### S3.2 Trust pipeline framing (home)
**Files:** `src/pages/index.astro`
- Four verification levels presented as a pipeline (Community → Reviewed →
  Tested → Verified) with real counts and one-line "what it means"; CTA to
  /docs/verification. Counts untouched, framing only.

### S3.3 Final QA
- Contrast probe both modes (S1.1 script, all pages sampled), crawler 120
  pages 0/0, full e2e, `npm run check`, `VERCEL=1 npm run build`, screenshots
  at 375/768/1036/1280/1440, push + QA doc v3 section.

## Review Focus
1. Token flip must not break dark-mode code highlighting (shiki vars) — verify
   a detail page code block in both modes.
2. Gauge arc math from pct (0–100) — clamp; NaN-safe for missing scores.
3. `?severity=` must round-trip like marketplace filters (popstate).
4. TOC scroll-spy must not trap focus or jitter layout (CLS ≤ 0 at 1200+).
5. Light-theme surfaces: chip/badge text ≥ 4.5:1 — badges are the risk spot.
