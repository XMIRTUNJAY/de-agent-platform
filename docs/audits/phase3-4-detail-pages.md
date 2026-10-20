# Phase 3-4 Audit: Detail Pages & Listing Pages

**Date:** 2026-10-20
**Scope:** `ResourceDetail.astro`, `tutorials.astro`, `guides.astro`, `runbooks.astro`, `projects.astro`, `ResourceCard.astro`, `ListingPage.astro`
**Registry snapshot:** 157 resources (41 reference, 24 skill, 15 runbook, 15 architecture, 12 agent, 12 mcp, 10 plugin, 10 hook, 7 template, 6 starter, 1 tutorial, 1 rule_pack, 1 governance_pack, 1 policy, 1 config_template)

---

## 1. Detail Page Section Audit (`ResourceDetail.astro`)

### 1.1 Complete Section Map (lines 111-496)

Every section is rendered inside a single `<section class="prose-de prose-measure min-w-0 space-y-8">` container as a flat, sequential list. There are **31 conditional sections** plus **1 unconditional section** (Rating widget). None are gated by `res.type`.

| # | Lines | Heading | Property | Gated by type? | Notes |
|---|-------|---------|----------|----------------|-------|
| 1 | 111-116 | Purpose | `res.purpose` | No | |
| 2 | 117-122 | Problem | `res.problem` | No | |
| 3 | 123-128 | Solution | `res.solution` | No | |
| 4 | 129-142 | When to use | `res.when_to_use` | No | Handles array or string |
| 5 | 143-152 | When not to use | `res.when_not` | No | |
| 6 | 153-180 | Our assessment | `res.editorial` | No | Rating + limitations + needs_improvement |
| 7 | 181-190 | What you need | `res.what_you_need` | No | |
| 8 | 191-211 | Steps | `res.steps` | No | Renders `s.text` and `s.from_id` links |
| 9 | 212-221 | Check yourself | `res.check_yourself` | No | |
| 10 | 222-235 | Sourced from | `res.source_refs` | No | Cross-references registry by id |
| 11 | 236-285 | Rating | **Unconditional** | No | Always rendered; client-side JS widget |
| 12 | 286-295 | Security scan | `res.vulnerability_scan_at` / `res.secret_findings` | No | |
| 13 | 296-301 | Details | `res.body` | No | Rendered via `marked.parse()` (raw HTML injection) |
| 14 | 302-307 | Context | `res.context` | No | |
| 15 | 308-313 | Forces | `res.forces` | No | Architecture-pattern field |
| 16 | 314-319 | Symptoms | `res.symptoms` | No | Runbook field; **renders raw objects** |
| 17 | 320-325 | Diagnosis | `res.diagnosis` | No | Runbook field; **renders raw objects** |
| 18 | 326-331 | Possible causes | `res.possible_causes` | No | **Renders raw objects** |
| 19 | 332-342 | Commands | `res.commands` | No | Code blocks with copy buttons |
| 20 | 343-348 | Fix | `res.fix` | No | Runbook field |
| 21 | 349-354 | Prevention | `res.prevention` | No | Runbook field |
| 22 | 355-360 | Monitoring | `res.monitoring` | No | Runbook field |
| 23 | 361-366 | Tradeoffs | `res.tradeoffs` | No | |
| 24 | 367-376 | Implementation | `res.implementation` | No | Handles array or string |
| 25 | 377-382 | Tests | `res.tests` | No | |
| 26 | 383-388 | Failure Scenarios | `res.failure_scenarios` | No | Starter/project field |
| 27 | 389-394 | Production Hardening | `res.production_hardening` | No | Starter/project field |
| 28 | 395-400 | Diagram | `res.diagram` | No | Raw `<pre><code>` |
| 29 | 401-406 | Repository Structure | `res.repo_structure` | No | Raw `<pre><code>` |
| 30 | 407-412 | Architecture | `res.architecture` | No | |
| 31 | 413-418 | Setup | `res.setup` | No | |
| 32 | 419-424 | Sample Data | `res.sample_data` | No | |
| 33 | 425-430 | Workflow | `res.workflow` | No | |
| 34 | 431-436 | Inputs | `res.inputs` | No | Agent/skill field |
| 35 | 437-442 | Outputs | `res.outputs` | No | Agent/skill field |
| 36 | 443-448 | Guardrails | `res.guardrails` | No | |
| 37 | 449-454 | Example | `res.example` | No | |
| 38 | 455-460 | Evaluation | `res.evaluation` | No | |
| 39 | 461-466 | Capabilities | `res.capabilities` | No | Agent field |
| 40 | 467-472 | Tools | `res.tools` | No | Agent/skill field |
| 41 | 473-478 | Skills | `res.skills` | No | Renders `s` directly as link text but also uses `s.url`; **if s is a string, renders `[object Object]` or broken href** |
| 42 | 479-484 | Hooks | `res.hooks` | No | Same pattern as Skills |
| 43 | 485-490 | MCP Servers | `res.mcp` | No | Same pattern as Skills |
| 44 | 491-496 | Commands | `res.commands` | No | **DUPLICATE of section 19** |

### 1.2 Duplicated Section: "Commands"

**Finding:** `res.commands` is rendered twice with two different templates.

- **First instance** (`ResourceDetail.astro:332-342`): Renders each command as a full code block (`<pre><code class="language-bash">`) with a copy button.
- **Second instance** (`ResourceDetail.astro:491-496`): Renders each command as an inline `<code class="icode">` inside a `<li>`.

Both are gated by the identical condition `res.commands && res.commands.length`. They will always both render or both be hidden. The first renders copy-pasteable code blocks; the second renders a compact inline list. This is not intentional progressive disclosure — it is a copy-paste duplication that produces contradictory UI for the same data on the same page.

**Root cause:** `ResourceDetail.astro:332-342` and `ResourceDetail.astro:491-496`.

### 1.3 Sections That Render Raw Objects

Several sections attempt to handle items that may be strings or objects, but the fallback rendering is lossy:

| Section | Line | Behavior when item is an object |
|---------|------|--------------------------------|
| Symptoms | 317 | `Object.values(s)[0]` — takes only the first value, discards keys |
| Diagnosis | 323 | `Object.entries(d).map(([k,v]) => k: v).join(' — ')` — flattens all key-value pairs into a single string per item |
| Possible causes | 329 | `Object.values(c)[0]` — same lossy pattern as Symptoms |
| Skills | 476 | `{s}` rendered directly as child of `<a>` — if `s` is an object without `.url`, renders `[object Object]` as link text |
| Hooks | 482 | Same as Skills |
| MCP Servers | 488 | Same as Skills |
| Limitations sidebar | 603 | `JSON.stringify(l)` — dumps raw JSON into the DOM for non-string items |

**Root cause:** `ResourceDetail.astro:317`, `:323`, `:329`, `:476`, `:482`, `:488`, `:603`.

### 1.4 Section Order Analysis by Type

The current order is a single flat sequence regardless of resource type. This produces nonsensical ordering for specific types:

**For a runbook**, the ideal reading order is: Symptoms → Diagnosis → Possible causes → Fix → Commands → Prevention → Monitoring. The actual order places these correctly relative to each other (lines 314-360) but buries them after 10 generic sections (Purpose through Sourced from) and the Rating widget. A user landing on a runbook during an incident must scroll past Purpose, Problem, Solution, When to use, When not to use, Our assessment, What you need, Steps, Check yourself, Sourced from, and Rating before reaching Symptoms at line 314.

**For a skill**, the critical information is: install_command (header, line 99), what_you_need/prerequisites, steps, inputs/outputs, tools, hooks, mcp. Instead, skills get: Purpose → Problem → Solution → ... → Symptoms (empty) → Diagnosis (empty) → ... → Inputs (line 431) → Outputs (line 437) → Tools (line 467) → Skills (line 473) → Hooks (line 479) → MCP (line 485). The skill-specific sections are buried at the bottom after 30+ irrelevant sections.

**For a tutorial**, the critical information is: learning_objectives (not rendered at all in the detail body), steps, check_yourself, source_refs. These appear at lines 191-235 but are preceded by Purpose/Problem/Solution/When to use/When not to use/Our assessment/What you need.

**For an architecture**, the critical information is: context, forces, diagram, repo_structure, architecture. These are scattered across lines 302-412 with runbook fields (symptoms, diagnosis, fix, prevention) interleaved between them.

### 1.5 Header-Area Type Specificity

The header area (lines 60-105) has minimal type-specific behavior:

- `res.type === 'architecture'` triggers `<ArchitectureCanvas />` (line 93-97). This is the **only** type-gated rendering in the entire component.
- `res.install_command` renders a copy-paste code block (line 99-104). Shown for any type that carries this field.
- `res.severity` chip (line 69-87) is relevant primarily to runbooks but is not gated by type.

---

## 2. Thin Content on Listing Pages

### 2.1 Registry Data

From the registry analysis:
- **Total resources:** 157
- **Resources with summary/tagline under 80 chars:** 117 (74.5%)
- **Tutorials in registry:** 1 (only 1 resource has `type: 'tutorial'`)
- **Tutorials with summary under 80 chars:** 1 (100%)

### 2.2 Tutorials Page (`tutorials.astro`)

**Filter logic** (`tutorials.astro:18`):
```js
const teaching = registry.resources.filter(r => r.learning_objectives?.length > 0 && (r.page_eligibility?.state ?? 'eligible') !== 'internal_only');
```

This filters for resources with `learning_objectives`, not for `type === 'tutorial'`. The page splits results into:
- `editorial`: items where `type === 'tutorial'` (line 19) — currently **1 item**
- `practicum`: items where `type !== 'tutorial'` (line 20) — skills/starters that happen to carry learning objectives

The editorial section renders a `SectionHeader` claiming "Full written walkthroughs with checkpoints and validation" for a single entry. The practicum section groups by difficulty level.

**Card rendering** (`tutorials.astro:44,56`): Both sections use `<ResourceCard resource={r} />`.

### 2.3 ResourceCard Content (`ResourceCard.astro`)

The card shows (`ResourceCard.astro:78-79`):
```html
{(r.tagline || r.summary) && (
  <p class="card-desc" style="flex: 1;">{r.tagline || r.summary}</p>
)}
```

With 74.5% of resources having tagline/summary under 80 characters, most cards display a fragment like `"Handles X"` or `"A guide to Y"` — insufficient to differentiate entries on a listing page. The card does not show:
- `learning_objectives` (the very property that qualified the resource for the tutorials page)
- `steps` count or estimated time
- `difficulty` is shown as a chip but only if present (`ResourceCard.astro:82`)
- `description` (the longer body text)

**Impact on tutorials listing:** A user visiting `/tutorials` sees cards with sub-80-character taglines, no indication of what they will learn (objectives are invisible), no step count, and no time estimate. The page's own lede promises "explicit learning objectives" but the cards never surface them.

### 2.4 Projects Page (`projects.astro`)

Delegates entirely to `ListingPage.astro` (`projects.astro:10-15`) which renders the same `ResourceCard` grid. Starters typically have richer data (setup, sample_data, failure_scenarios, production_hardening) but none of this appears on the card.

### 2.5 Runbooks Page (`runbooks.astro`)

Also uses `ResourceCard` inside severity-filtered wrappers (`runbooks.astro:56-60`). The card does not show `severity` visually within itself — severity is only used as a `data-runbook-severity` attribute on the wrapper div (line 57) and as a filter chip. A runbook card looks identical to a reference card except for the type badge.

### 2.6 Guides Page (`guides.astro`)

Uses a custom inline card rather than `ResourceCard` (`guides.astro:42-48`). Shows kicker, title, description, and optional validation result. This is actually better than the registry-based listings because it surfaces `validation.result`. However, guides sourced from markdown frontmatter lack the composite score gauge that registry-based cards have.

---

## 3. Type-Specific Rendering

### 3.1 Finding: Everything Gets the Same Flat List

**There is zero type-specific section ordering or prominence in `ResourceDetail.astro`.** The component treats all 157 resources identically regardless of type. The only type gate in the entire file is the architecture canvas at line 93.

### 3.2 Runbook Fields Lack Prominence

Runbook-critical fields (symptoms, diagnosis, possible_causes, fix, commands, prevention, monitoring) occupy lines 314-360. They are positioned **after** 20 other sections including generic ones (Purpose, Problem, Solution, When to use, Context, Forces) and the unconditional Rating widget. During an incident, a user must scroll past ~20 empty or irrelevant sections to reach Symptoms.

### 3.3 Skill Fields Lack Prominence

Skill-critical fields (inputs, outputs, tools, hooks, mcp, capabilities) occupy lines 431-490 — the very end of the content area. Prerequisites are relegated to the sidebar (`ResourceDetail.astro:629-638`) rather than appearing in the main content flow. The `install_command` does appear in the header (line 99-104) which is appropriate, but `what_you_need` (line 181) is buried mid-page.

### 3.4 Tutorial Fields Missing Entirely

`learning_objectives` — the defining property of a tutorial — is **never rendered** in `ResourceDetail.astro`. It is used only as a filter on the tutorials listing page. A user clicking through to a tutorial's detail page cannot see its stated learning objectives.

### 3.5 Starter/Project Fields Buried

Starter-specific fields (failure_scenarios, production_hardening, setup, sample_data, repo_structure) are scattered across lines 383-424, interleaved with runbook and architecture fields.

---

## 4. Rating Widget: Dead Code in Static Builds

### 4.1 Build Configuration

`astro.config.mjs:34`:
```js
output: onVercel ? 'server' : 'static',
```

When not deployed to Vercel, the site builds as fully static. API routes under `src/pages/api/` are **not available** in static output mode.

### 4.2 The Widget Code

`ResourceDetail.astro:236-285` contains an unconditional `<section>` with:
- Server-rendered popularity base value (line 239-241)
- Five star buttons (line 243-245)
- Client-side `<script>` (line 249-285) that:
  - Fetches `/api/marketplace/stats?resource_id=...` on load (line 264)
  - POSTs to `/api/marketplace/rate` on star click (line 272)

### 4.3 API Endpoints Exist But Are SSR-Only

The endpoints exist as source files:
- `src/pages/api/marketplace/rate.ts` — declares `export const prerender = false` (line 8), meaning it requires a server runtime
- `src/pages/api/marketplace/stats.ts` — exists in the glob results
- `src/pages/api/marketplace/install.ts` — exists in the glob results

All use `export const prerender = false` or dynamic database imports. In static builds, these endpoints do not exist in the output.

### 4.4 Verdict

**Not dead code in source, but functionally dead in static builds.** The widget is unconditionally rendered into the HTML. The client-side script executes on page load, fires `fetch('/api/marketplace/stats?...')`, receives a 404 or network error, hits the `.catch(() => {})` at line 269, and silently fails. Clicking a star fires `fetch('/api/marketplace/rate', ...)`, which also fails silently at line 281. The widget renders stars that do nothing.

On Vercel (SSR mode), the endpoints work. But the widget still has issues:
- It is rendered unconditionally for every resource type (architectures, policies, references all get a rating widget)
- There is no `prerender = false` guard on the component itself to exclude it from static builds
- The `.catch(() => {})` swallows errors with no user feedback — the user clicks stars and nothing happens

**Root cause:** `ResourceDetail.astro:236-285`, `astro.config.mjs:34`, `rate.ts:8`.

### 4.5 Install Button Has the Same Problem

`ResourceDetail.astro:773-815` defines `installResource()` which calls `fetch('/api/marketplace/install', ...)`. This also fails silently in static builds. The button at line 760 is rendered whenever `mp?.install_manifest` exists, with no static-build guard.

---

## 5. Root Cause Summary

| # | Finding | File:Line |
|---|---------|-----------|
| 1 | Commands section duplicated | `ResourceDetail.astro:332-342` and `ResourceDetail.astro:491-496` |
| 2 | No type-gated section ordering | `ResourceDetail.astro:111-496` (entire content area) |
| 3 | Only type gate is architecture canvas | `ResourceDetail.astro:93-97` |
| 4 | learning_objectives never rendered | `ResourceDetail.astro` (absent entirely) |
| 5 | Raw object rendering in symptoms/diagnosis/causes | `ResourceDetail.astro:317,323,329` |
| 6 | Skills/Hooks/MCP render objects as link text | `ResourceDetail.astro:476,482,488` |
| 7 | Limitations sidebar dumps JSON.stringify | `ResourceDetail.astro:603` |
| 8 | Rating widget unconditional, no static guard | `ResourceDetail.astro:236-285` |
| 9 | API endpoints excluded from static builds | `rate.ts:8`, `astro.config.mjs:34` |
| 10 | Error swallowing hides widget failure | `ResourceDetail.astro:269,281` |
| 11 | Install button fails silently in static | `ResourceDetail.astro:784-814` |
| 12 | ResourceCard omits learning_objectives | `ResourceCard.astro:78-79` |
| 13 | 74.5% of resources have <80 char summaries | Registry data (117/157) |
| 14 | ResourceCard doesn't show step count, time, or objectives | `ResourceCard.astro` (entire file) |
| 15 | Runbook severity not visible on card itself | `runbooks.astro:57` (attribute only) |
| 16 | Tutorials page has 1 editorial tutorial | `tutorials.astro:19` |
| 17 | Runbook fields buried after 20 generic sections | `ResourceDetail.astro:314` (Symptoms starts here) |
| 18 | Skill fields at the very end of content | `ResourceDetail.astro:431-490` |

---

## 6. Recommendations

### 6.1 Type-Specific Section Ordering

Define section-order arrays per type and render them via a loop rather than 31 hardcoded conditionals. Proposed orders:

**Runbook:**
1. Severity banner (move from header chip to prominent callout)
2. Symptoms
3. Diagnosis
4. Possible causes
5. Fix
6. Commands (single rendering, code-block format only)
7. Prevention
8. Monitoring
9. Security scan
10. Details (body)
11. Related resources (from sidebar into main flow)

**Skill:**
1. Install command (already in header — keep)
2. What you need
3. Prerequisites (move from sidebar to main flow)
4. Steps
5. Inputs
6. Outputs
7. Tools
8. Hooks
9. MCP Servers
10. Capabilities
11. Example
12. Tests
13. Details (body)

**Tutorial:**
1. Learning objectives (**add this section** — currently missing from detail page)
2. What you need
3. Steps
4. Check yourself
5. Sourced from
6. Details (body)

**Architecture:**
1. Context
2. Problem
3. Forces
4. Solution
5. Diagram
6. Repository Structure
7. Architecture
8. Tradeoffs
9. Details (body)

**Starter/Project:**
1. Setup
2. Repository Structure
3. Sample Data
4. Steps
5. Tests
6. Failure Scenarios
7. Production Hardening
8. Details (body)

**Reference/Generic (fallback):**
Current order is acceptable minus the duplicates.

### 6.2 Remove the Duplicate Commands Section

Delete `ResourceDetail.astro:491-496`. Keep `:332-342` (the code-block version with copy buttons) as it is more usable. If a compact inline list is desired for certain types, make it a named variant selected by type, not a duplicate.

### 6.3 Hide Empty Sections More Aggressively

Current guards check for truthiness/array length, which is correct. But several sections should additionally be hidden based on type relevance:
- Don't render "Symptoms", "Diagnosis", "Possible causes", "Fix", "Prevention", "Monitoring" for non-runbook types even if the fields accidentally contain data.
- Don't render "Inputs", "Outputs", "Hooks", "MCP Servers", "Capabilities" for non-skill/non-agent types.
- Gate these behind `res.type === 'runbook'` etc., not just field presence.

### 6.4 Fix Raw Object Rendering

Replace `Object.values(s)[0]` patterns with proper template rendering:
- For symptoms/diagnosis/causes: if the item is an object, render the key as a `<strong>` label and the value as text.
- For skills/hooks/mcp: if the item is a string, render it as text (not as a link with `href="#"`). If it is an object, use `s.title || s.name || s.id` as link text instead of `{s}`.

### 6.5 Rating Widget: Static-Build Guard

Wrap the entire Rating section in a build-mode check:
```astro
{import.meta.env.MODE !== 'static' && (
  <section class="mount" data-rate-widget ...>...</section>
)}
```
Or check `Astro.site` / a config flag. Alternatively, add `export const prerender = false` awareness to the component so it skips client-side fetches when the endpoint won't exist. At minimum, replace the silent `.catch(() => {})` with user-visible feedback ("Rating unavailable in preview mode").

### 6.6 Tutorial Card Enrichment

Modify `ResourceCard.astro` or create a `TutorialCard.astro` variant that surfaces:
- **Learning objectives count** or first 2 objectives as bullet points
- **Step count** from `r.steps?.length`
- **Difficulty** (already shown as chip, ensure it's always present for tutorials)
- **Estimated time** if available

Alternatively, modify `tutorials.astro` to use a custom card template instead of the generic `ResourceCard`, similar to how `guides.astro` already uses its own inline card template (`guides.astro:42-48`).

### 6.7 Add learning_objectives to Detail Page

Add a new section before "Steps" in `ResourceDetail.astro`:
```astro
{(res.learning_objectives ?? []).length > 0 && (
  <section class="mount">
    <h2>Learning Objectives</h2>
    <ul>
      {res.learning_objectives.map((o: any) => (<li>{o}</li>))}
    </ul>
  </section>
)}
```

### 6.8 Runbook Card Severity Visibility

In `runbooks.astro`, the severity is set as `data-runbook-severity` on a wrapper div but not passed to `ResourceCard`. Either:
- Pass severity as a prop/card attribute so the card can render a severity indicator inline, or
- Use CSS `[data-runbook-severity="critical"] .card { border-left: 3px solid var(--color-danger); }` to visually differentiate without modifying ResourceCard.

### 6.9 Tutorials Page Editorial Section

With only 1 tutorial in the registry, the "Editorial tutorials" section header promising "Full written walkthroughs" overpromises. Consider:
- Hiding the editorial section header when `editorial.length < 3`
- Merging editorial and practicum into a single list until tutorial count grows
- Adding a "Contribute a tutorial" CTA to encourage growth
