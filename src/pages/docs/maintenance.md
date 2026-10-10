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
