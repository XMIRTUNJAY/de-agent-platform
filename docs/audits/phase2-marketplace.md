# Phase 2 Marketplace Audit — DE//AGENT

Evidence-based analysis of `src/pages/marketplace.astro`, `src/components/FilterPanel.astro`, `src/lib/filter-state.mjs`, and `src/components/ResourceCard.astro`. All citations reference exact file:line locations. No fabricated data.

---

## 1. Filter Overload

### Exact Counts

**9 filter groups** are defined in `marketplace.astro:83-93`:

| # | Group Label | Key | Source Variable | Option Count (static definition) |
|---|-------------|-----|-----------------|----------------------------------|
| 1 | Type | `type` | `types` array (`marketplace.astro:9`) | 14 values: skill, mcp, plugin, agent, hook, template, starter, runbook, architecture, reference, policy, rule_pack, config_template, governance_pack |
| 2 | Category | `category` | `registry.taxonomy.categories` filtered by usage (`marketplace.astro:10`) | Dynamic — only categories with ≥1 resource |
| 3 | Difficulty | `difficulty` | `difficulties` array (`marketplace.astro:11`) | 3 values: beginner, intermediate, advanced |
| 4 | Verification | `verification` | `verifications` array (`marketplace.astro:12`) | 4 values: verified, tested, reviewed, community |
| 5 | Agent Compatibility | `agent` | `agents` array (`marketplace.astro:13`) | 5 values: claude-code, codex, cursor, amp, gemini-cli |
| 6 | Security | `security` | Computed from `readability` object (`marketplace.astro:54-59`) | 4 values: read-only, needs-credentials, network, runs-code |
| 7 | Technology | `technology` | `registry.taxonomy.technologies` filtered by usage (`marketplace.astro:67`) | Dynamic — only technologies with ≥1 resource |
| 8 | Stage | `stage` | `registry.taxonomy.stages` filtered by usage (`marketplace.astro:68`) | Dynamic |
| 9 | Quality Score | `quality` | `compositeLabels` array (`marketplace.astro:14`) | 5 values: exemplary, strong, adequate, weak, unproven |

**Total static checkbox options**: At minimum **35 + dynamic category/technology/stage counts**. The Type group alone contributes 14 checkboxes.

Only options with `count > 0` are rendered (`FilterPanel.astro:50`), which prunes empty entries but does not reduce the number of *groups* a user must parse.

### Vertical Space: Filter Panel vs Results Area

The layout is defined at `marketplace.astro:104`:

```html
<div class="grid gap-8 min-[1200px]:grid-cols-[280px_1fr]">
```

- **Desktop (≥1200px)**: The filter panel occupies a fixed **280px** left column. The results area gets `1fr` (all remaining space). With 9 `<details>` groups each containing a `<summary>` row plus checkbox lists, the panel will be very tall. Only "Type" and "Category" are open by default (`FilterPanel.astro:21`: `openByDefault = ['type', 'category']`), but even collapsed, 9 `<details>` elements with summaries create significant vertical scan distance before reaching any results.
- **Below 1200px / mobile**: The grid collapses to a single column. The filter toggle button appears (`marketplace.astro:106`: `class="btn btn-sm mb-4 gap-2 lg:hidden"`). The entire filter panel becomes an off-canvas drawer that overlays content. The results grid occupies 100% width but is pushed below the hero section. On initial load before interaction, filters do not compete for vertical space on mobile because they are hidden behind the toggle — but once opened, the drawer covers the results entirely.

The filter panel's height on desktop with only Type (14 options) and Category (dynamic) expanded is roughly: 9 group headers × ~32px + 14 type rows × ~30px + N category rows × ~30px + padding. This easily exceeds 600px before the user scrolls to see many result cards.

### Implementation Metadata vs User Intent

Several filter groups expose internal/system metadata rather than what a user is trying to accomplish:

| Filter | Classification | Evidence | Problem |
|--------|---------------|----------|---------|
| **Type** (14 values) | Implementation metadata | `marketplace.astro:9` lists raw registry types: `rule_pack`, `config_template`, `governance_pack`, `architecture`, `reference`. These are taxonomy internals. A user searching for "how do I secure my pipeline" doesn't think in terms of `rule_pack` vs `policy`. | 14 types is too many for a flat checkbox list. Users must understand the registry schema to use this filter. |
| **Quality Score** | Implementation metadata | `marketplace.astro:14`: labels like `exemplary`, `strong`, `adequate`, `weak`, `unproven` come from `r.marketplace?.composite_label` (`marketplace.astro:64`). This is an internal scoring rubric. | Users want "reliable" or "well-reviewed" resources, not to learn the platform's composite scoring terminology. |
| **Verification** | Mixed | `marketplace.astro:12`: `verified`, `tested`, `reviewed`, `community`. Partly user-meaningful (is it trustworthy?) but the distinction between `verified`, `tested`, and `reviewed` is an implementation detail of the audit pipeline. | Without documentation, users cannot meaningfully distinguish these levels. |
| **Security** | Mixed | `marketplace.astro:54-59`: derived from `r.security_flags`, `r.security?.credentials`, `r.security?.network_access`, `r.security?.runs_code`. | Useful for power users; confusing as a primary filter for newcomers who don't know what `security_flags === 0` means. |
| **Agent Compatibility** | User intent | `marketplace.astro:13`: `claude-code`, `codex`, `cursor`, `amp`, `gemini-cli`. | Directly answers "does this work with my tool?" — this is user-intent-aligned. |
| **Difficulty** | User intent | `marketplace.astro:11` | Answers "can I use this?" — user-intent-aligned. |
| **Category** | User intent | `marketplace.astro:10` | Answers "what domain is this for?" — user-intent-aligned. |
| **Technology** | User intent | `marketplace.astro:67` | Answers "does this work with my stack?" — user-intent-aligned. |
| **Stage** | Implementation metadata | `marketplace.astro:68`: references `r.stage` against `registry.taxonomy.stages`. | "Stage" is ambiguous without context — stage of what? Development lifecycle? Registry workflow? |

**Summary**: 4 of 9 filter groups (Type, Quality Score, Verification distinctions, Stage) primarily expose implementation metadata. Only Category, Difficulty, Agent Compatibility, Technology, and partially Security map to user intent.

---

## 2. Card Problems — Line-by-Line Analysis of ResourceCard.astro

### Badge/Chip Inventory Per Card

Counting every visual element rendered inside a single card:

| Element | Location | Type | Count |
|---------|----------|------|-------|
| Type badge | `ResourceCard.astro:50-53` | `.type-badge` with dot | 1 |
| Score gauge (SVG circle + label) | `ResourceCard.astro:55-75` | Custom SVG component | 1 |
| Title | `ResourceCard.astro:77` | `<h3>` | 1 |
| Tagline/summary | `ResourceCard.astro:78-80` | `<p>` | 0–1 |
| Difficulty chip | `ResourceCard.astro:82` | `.chip` | 0–1 |
| Tag chips | `ResourceCard.astro:83` | `.chip` × up to 3 | 0–3 |
| Star rating chip | `ResourceCard.astro:84-86` | `.chip` with inline HTML stars | 0–1 |
| Install count chip | `ResourceCard.astro:87-91` | `.chip` | 0–1 |
| Verification/evidence chip | `ResourceCard.astro:92-99` | `.chip`, `.chip-warn`, or `.chip-accent` | 0–1 |
| Copy-install button | `ResourceCard.astro:101-116` | `<button>` | 0–1 |

**Maximum badges/chips per card: 10** (type badge + score gauge + difficulty + 3 tags + rating + installs + verification + copy button). In the worst case, a card is more chrome than content.

### Title Analysis

`ResourceCard.astro:77`:
```html
<h3 style="...">{r.title}</h3>
```

The title renders `r.title` directly from the registry data. There is no transformation, no outcome-oriented framing. If the registry entry is named `"eslint-config"`, that is what displays. The title identifies **the thing**, not **what the thing accomplishes**. Whether this is a problem depends on the data contract (whether `r.title` is required to be descriptive), but the component itself does nothing to enforce outcome-oriented naming.

### Description/Tagline Analysis

`ResourceCard.astro:78-80`:
```html
{(r.tagline || r.summary) && (
  <p class="card-desc" style="flex: 1;">{r.tagline || r.summary}</p>
)}
```

The description falls back from `r.tagline` to `r.summary`. There is no guarantee either differs from `r.title`. If a resource has `title: "Docker MCP Server"` and `tagline: "Docker MCP Server"`, the card shows the same text twice. The component does not deduplicate or truncate. The `flex: 1` style forces the paragraph to fill vertical space, which can create inconsistent card heights when descriptions vary wildly in length.

### Install Action Buried

The install action is a `<button>` at `ResourceCard.astro:101-116`, placed **after** all meta chips. It is the last child of the card anchor. Several problems:

1. **Position**: It sits at the bottom of the card, after difficulty, tags, ratings, install counts, and verification chips. A user scanning for "how do I install this" must visually traverse all metadata first.
2. **Visual weight**: It uses class `copy-install` (not a primary button class). The label shows only the first 3 tokens of the install command (`ResourceCard.astro:30`: `cmdPrefix = cmdFirstLine.split(' ').slice(0, 3).join(' ')`), which may be cryptic (e.g., `"npx @anthropic-ai/claude-code"` truncated to `"npx @anthropic-ai/claude-code"` or just `"de-agent install"`).
3. **Entire card is a link**: The outermost element is `<a href={r.url}>` (`ResourceCard.astro:48`). The install button must call `event.preventDefault(); event.stopPropagation()` (`ResourceCard.astro:108`) to avoid navigating away. This means clicking the card navigates to a detail page, while installing requires finding and clicking a small button at the bottom. The primary marketplace action (install) is secondary to the navigation action.
4. **Conditional rendering**: The button only appears if `r.install_command && !cmdIsComment` (`ResourceCard.astro:101`). Resources whose install command starts with `#` get no install affordance at all.

### Additional Card Issues

- **No image/icon**: Cards have no visual identifier beyond the type badge dot. Scanning a grid of text-only cards is slow.
- **Inline styles everywhere**: `ResourceCard.astro:48,77,79,81,85,88,93,95,98` all use inline `style` attributes instead of CSS classes, making consistent restyling difficult.
- **set:html for star rating**: `ResourceCard.astro:85` uses `set:html={starRatingHtml(...)}` which injects raw HTML built by string concatenation (`ResourceCard.astro:39-43`). This works but is fragile and bypasses Astro's escaping.
- **Prop type is `any`**: `ResourceCard.astro:6`: `resource: any`. No type safety on the data contract.

---

## 3. Information Hierarchy

### Mobile: Cards Before Filters?

**No.** On mobile (below `lg` breakpoint), the DOM order in `marketplace.astro:103-155` is:

1. Toggle button (`marketplace.astro:106-108`)
2. `<FilterPanel>` (`marketplace.astro:109`)
3. Results `<section>` with toolbar and card grid (`marketplace.astro:112-154`)

The filter panel appears first in DOM order. On mobile, it is visually hidden via CSS (the `lg:hidden` class on the toggle implies the panel is off-screen until toggled), but there is no evidence in these files of CSS that reorders the grid to show cards first. The filter panel is an overlay drawer, not a repositioned element. When closed, the cards are visible, but the toggle button still sits above them. When open, the drawer covers the cards.

There is no progressive rendering strategy where cards appear immediately and filters load lazily. Everything is server-rendered in one pass.

### Progressive Disclosure

**Partial, but insufficient.** The filter panel uses `<details>` elements (`FilterPanel.astro:44`), which is native progressive disclosure. However:

- Only `type` and `category` are open by default (`FilterPanel.astro:21`). The other 7 groups are collapsed. This is good.
- But within an open group, **all** options render at once. There is no "show top 5 / show more" pattern. The Type group with 14 options dumps all 14 checkboxes when expanded.
- The card itself has no progressive disclosure. All badges, chips, and metadata render simultaneously. There is no hover-to-reveal or expand-for-details pattern.
- The sort dropdown (`marketplace.astro:118-124`) is always visible — no progressive disclosure applied to sorting.

### Empty States

`marketplace.astro:153`:
```html
<p id="empty" class="hidden mt-8 text-center text-muted py-8">No resources match the current filters.</p>
```

This is a single sentence shown when `visible === 0` (`marketplace.astro:240`). Problems:

- **No guidance**: It does not suggest which filters to remove, which filter combination might be too restrictive, or offer a "clear all filters" action inline.
- **No partial matches**: There is no fallback showing "closest matches" or relaxing filters automatically.
- **Hidden by default**: Uses `class="hidden"` and is toggled via JS (`marketplace.astro:240`: `empty.hidden = visible > 0`). If JS fails, the empty state never appears.
- **Styling is minimal**: Just centered muted text. No icon, no illustration, no actionable next step.

---

## 4. Root Causes

Each identified problem traced to its origin layer:

### Filter Overload

| Problem | Root Cause Layer | Citation |
|---------|-----------------|----------|
| 14 type values exposed as flat checkboxes | **Data contract**: The registry defines 14 distinct types (`marketplace.astro:9`) with no grouping hierarchy. The component faithfully renders all of them. | `marketplace.astro:9`, `marketplace.astro:84` |
| 9 filter groups treated equally | **Page layout**: The `filters` array at `marketplace.astro:83-93` is a flat list passed to `FilterPanel`. There is no primary/secondary distinction. | `marketplace.astro:83-93` |
| Implementation-metadata filters (Quality Score, Stage) shown alongside user-intent filters | **Data contract + Page layout**: The registry exposes `composite_label` and `stage` fields; the page includes them in the same `filters` array without categorization. | `marketplace.astro:14,64,68,92` |
| All options within a group visible when expanded | **Component**: `FilterPanel.astro:50` maps all `f.options.filter(o => o.count > 0)` with no truncation or "show more" mechanism. | `FilterPanel.astro:50` |
| Fixed 280px sidebar consumes space regardless of screen size | **Page layout**: `marketplace.astro:104` hardcodes `min-[1200px]:grid-cols-[280px_1fr]`. Below 1200px it collapses, but between 1200px and wider screens, 280px is constant even if results need more room. | `marketplace.astro:104` |

### Card Problems

| Problem | Root Cause Layer | Citation |
|---------|-----------------|----------|
| Up to 10 badges/chips per card | **Component**: `ResourceCard.astro:50-99` renders every available metadata field without prioritization. | `ResourceCard.astro:50-99` |
| Title names the thing, not the outcome | **Data contract**: `r.title` comes from the registry. The component at `ResourceCard.astro:77` renders it verbatim. No `outcome` or `use_case` field exists in the data contract. | `ResourceCard.astro:77` |
| Tagline may duplicate title | **Data contract + Component**: No deduplication logic at `ResourceCard.astro:78-80`. If `r.tagline === r.title`, both display. | `ResourceCard.astro:78-80` |
| Install button buried at bottom | **Component**: Placed after all `.card-meta` chips at `ResourceCard.astro:101`. Should be higher in visual hierarchy. | `ResourceCard.astro:101-116` |
| Entire card is `<a>`, install button fights it | **Component**: Architectural decision at `ResourceCard.astro:48` makes the card a link. The install button requires `stopPropagation` hack at `ResourceCard.astro:108`. | `ResourceCard.astro:48,108` |
| `resource: any` prop type | **Component**: `ResourceCard.astro:6` provides no type enforcement. | `ResourceCard.astro:6` |
| Inline styles throughout | **Component**: `ResourceCard.astro:48,77,79,81,85,88,93,95,98` | Multiple lines |

### Information Hierarchy

| Problem | Root Cause Layer | Citation |
|---------|-----------------|----------|
| Filters precede cards in DOM on mobile | **Page layout**: `marketplace.astro:106-109` places toggle + FilterPanel before the results `<section>`. | `marketplace.astro:106-109` |
| No progressive disclosure within filter groups | **Component**: `FilterPanel.astro:49-58` renders all options in a flat `<ul>`. | `FilterPanel.astro:49-58` |
| Empty state is non-actionable | **Page layout**: `marketplace.astro:153` is a static string with no clear-filters CTA. | `marketplace.astro:153` |
| Filter state serialized as flat key-value pairs | **Data contract**: `filter-state.mjs:4-7` defines `FILTER_KEYS` as a flat array with no grouping semantics. | `filter-state.mjs:4-7` |
| URL sync treats all filters identically | **Data contract**: `filter-state.mjs:25-33` serializes all keys the same way. No concept of primary filters appearing in URL differently from secondary ones. | `filter-state.mjs:25-33` |

---

## 5. Recommendations

### Primary vs Secondary Filter Split

Split the 9 filter groups into two tiers. This is a **page layout** and **data contract** change.

**Primary filters** (shown prominently, always visible, mapped to user intent):

| Filter | Rationale |
|--------|-----------|
| Category | Domain-level browsing ("I need something for CI/CD") |
| Type (grouped) | Collapse 14 types into 4–5 super-categories (e.g., "Automation" = skill + hook + runbook; "Configuration" = config_template + rule_pack + governance_pack + policy; "Integration" = mcp + plugin; "Blueprint" = template + starter + architecture + reference; "AI" = agent) |
| Agent Compatibility | "Does it work with my tool?" — highest-intent filter |
| Difficulty | Skill-level matching |

**Secondary filters** (collapsed behind "Advanced filters" toggle or `<details>`):

| Filter | Rationale |
|--------|-----------|
| Verification | Power-user concern; trust signals already shown on cards |
| Security | Important but not a primary browsing axis |
| Technology | Stack-specific filtering; useful but long tail |
| Stage | Internal workflow metadata |
| Quality Score | Internal metric; replace with sort-by-quality (already exists at `marketplace.astro:119`) |

**Implementation specifics**:

1. In `marketplace.astro:83-93`, split the `filters` array into `primaryFilters` and `secondaryFilters`.
2. In `FilterPanel.astro`, render primary filters as always-visible checkbox groups (no `<details>` wrapper) at the top. Render secondary filters inside a single collapsible `<details>` labeled "Advanced filters".
3. In `filter-state.mjs:4-7`, maintain a single `FILTER_KEYS` array for URL serialization but add a `PRIMARY_KEYS` export for UI differentiation.
4. For the Type group specifically, create a mapping layer in `marketplace.astro` that groups the 14 raw types into 4–5 super-categories. The `data-type` attribute on cards (`marketplace.astro:130`) should retain the raw type for filtering, but the checkbox labels should show super-categories. Alternatively, add a `superType` field to the data contract.

### Card Hierarchy Changes

Restructure `ResourceCard.astro` to establish a clear visual hierarchy. This is a **component** change.

**Proposed card layout (top to bottom)**:

```
┌─────────────────────────────────────────┐
│ [Type badge]              [Score gauge] │  ← Row 1: Identity + quality signal
│                                         │
│ Title (outcome-oriented if available)   │  ← Row 2: Primary information
│ Tagline (only if ≠ title, max 2 lines)  │  ← Row 3: Supporting context
│                                         │
│ [Install button]                        │  ← Row 4: PRIMARY ACTION, moved up
│                                         │
│ [Difficulty] [Tag] [Tag]    [Verified]  │  ← Row 5: Secondary metadata
│ ★★★★★ (4.2 · 18)           120 installs│  ← Row 6: Social proof
└─────────────────────────────────────────┘
```

**Specific field changes**:

| Action | Field | Current Location | Proposed Change |
|--------|-------|-----------------|-----------------|
| **Move up** | Install button | `ResourceCard.astro:101-116` (last child) | Place immediately after title/tagline, before meta chips. Make it a primary-styled button, not a ghost copy button. Remove the `stopPropagation` hack by separating the card link from the install action (see below). |
| **Show** | Type badge | `ResourceCard.astro:50-53` | Keep in header row. If types are grouped into super-categories, show the super-category label here. |
| **Show** | Score gauge | `ResourceCard.astro:55-75` | Keep in header row, right-aligned. |
| **Show** | Title | `ResourceCard.astro:77` | Keep, but add data contract recommendation for `r.outcome_title` fallback. |
| **Conditionally show** | Tagline | `ResourceCard.astro:78-80` | Add deduplication: `{(r.tagline \|\| r.summary) && (r.tagline \|\| r.summary) !== r.title && ...}`. Add CSS `display: -webkit-box; -webkit-line-clamp: 2; overflow: hidden;` to cap at 2 lines. |
| **Show** | Difficulty | `ResourceCard.astro:82` | Move to secondary metadata row. |
| **Reduce** | Tags | `ResourceCard.astro:83` | Reduce from `.slice(0, 3)` to `.slice(0, 2)`. Three tags plus difficulty plus verification overflows on narrow cards. |
| **Show** | Star rating | `ResourceCard.astro:84-86` | Move to bottom social-proof row. |
| **Show** | Install count | `ResourceCard.astro:87-91` | Move to bottom social-proof row. Drop the success rate percentage from the chip label — it is implementation metadata. Show just "{N} installs". |
| **Conditionally show** | Verification chip | `ResourceCard.astro:92-99` | Keep, but simplify: merge the three conditional branches (gap warning, earned verification, community) into a single badge with tone variants. |
| **Hide** | Install success rate | `ResourceCard.astro:89` | Remove `(installSuccessRate * 100).toFixed(0)}% success` from the chip label. This is implementation metadata that clutters the card. |
| **Hide** | `cmdPrefix` label | `ResourceCard.astro:114` | Replace the truncated command preview with a clear "Copy install" or "Install" label. The truncated command (`ResourceCard.astro:30`) is not meaningful to users. |

**Architectural fix for the card-link problem**:

The current pattern (`ResourceCard.astro:48`) wraps everything in `<a href={r.url}>`, forcing the install button to fight the anchor. Two options:

1. **Preferred**: Remove the wrapping `<a>`. Make the title an `<a>` linking to the detail page. Make the install button a standalone `<button>`. This eliminates `stopPropagation` hacks and improves accessibility.
2. **Alternative**: Use CSS `pointer-events` or separate interactive zones within the card without nesting interactive elements.

**Remove inline styles**: Extract all `style="..."` attributes from `ResourceCard.astro:48,77,79,81,85,88,93,95,98` into a scoped `<style>` block or external CSS module. This is necessary for any responsive adjustments to the card layout.

**Add prop typing**: Replace `resource: any` at `ResourceCard.astro:6` with a TypeScript interface matching the expected registry shape. This prevents rendering undefined fields silently.

### Data Contract Recommendations

These require changes to `registry.json` generation, not just the frontend:

1. **Add `outcome_title` field**: A short phrase describing what the resource accomplishes (e.g., "Automatically lint PRs" instead of "pr-lint-hook"). Fall back to `title` if absent.
2. **Add `super_type` grouping**: Map the 14 raw types to 4–5 browsable categories so the Type filter is usable.
3. **Enforce tagline ≠ title**: The registry generator should skip or nullify `tagline` when it matches `title`.
4. **Deprecate `composite_label` as a filter**: It is already available as a sort option (`marketplace.astro:119`: `value="composite-desc"`). Sorting serves the same user need without consuming filter panel space.
