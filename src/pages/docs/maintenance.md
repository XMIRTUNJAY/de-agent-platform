---
layout: '@/layouts/DocsLayout.astro'
title: 'Maintenance'
description: 'The weekly cadence that keeps the registry fresh: refresh, rebuild, audit, review oldest first, retire without nostalgia.'
kicker: 'Docs · Project'
---

The registry stays trustworthy through routine, not heroics. This is the routine.

## Weekly cadence

1. **Discover** — `node pipelines/discover.mjs` pulls trusted sources into `data/drafts/`. Review failures per source; one dead feed never blocks the rest.
2. **Refresh provenance** — `node pipelines/refresh-provenance.mjs` records upstream repo state. Unreachable upstreams are data, not errors.
3. **Rebuild** — `node pipelines/run.mjs --check` then `npm run build`. Read the step lines: evidence gaps, thin content, drift, and eligibility all report here.
4. **Audit** — `node pipelines/audit-pages.mjs` (registry vs built pages) and `node pipelines/audit-links.mjs` (links + sitemap coverage). Both exit 1 on drift; fix before deploying.
5. **Review oldest first** — the queue shows draft ages. Anything waiting 90+ days gets a decision: promote, re-scope, or delete the draft.

## Promotion

Drafts ship as `community` unless evidence is attached. The gate is `node pipelines/promote.mjs --draft <file> [--apply]`: unique id/slug, known category, declared license, 200+ character description, and evidence matching any claimed level above community. See [Contributing](/docs/contributing).

## Retirement runbook

Retire without nostalgia; never delete history:

1. Set `retired: true` on the record (and `superseded_by` in relationships when a successor exists).
2. Rebuild and confirm the route is gone: `audit-pages` shows it missing from dist, `audit-links` shows no dangling references to it.
3. Merges go the same way: `duplicates.json` names the candidates, the curator picks the survivor, moves any unique content, retires the rest.

Retired records stay in curated YAML and the knowledge graph — they leave the sitemap and the routes, not the record.

## Backlog discipline

The queue is an editorial backlog, not a publishing queue. Cap promotions per week to what review hours support. If the backlog grows three weeks running, throttle discovery (`--limit`) before quality slips — narrowing intake beats widening standards.

## Deferred to V2 (after first GitHub publish + traction)

Recorded here so deferral is a decision, not drift:

- **Analytics + Search Console.** Hooks ship (`__DE_OUTBOUND__`, opt-in provider config); nothing collects. Enable after the first publish, then let the data pick expansion clusters.
- **Affiliate links.** Policy and disclosure ship; zero links live. Review program terms (eligibility, geography, attribution, thresholds) only once content is listed and getting traction.
- **First-party org (`de-agent/*`).** 111 original records point at a planned `github.com/de-agent` org (8 repos) that does not exist yet; freshness records them unreachable honestly. Decision: create the org and publish the content, then re-run provenance refresh to clear the flags.
- **`backend/` dead code and `astro check` exclusion.** Scoped as future work; the exclusion comment in `ci.yml` tracks the type-debt reason.
