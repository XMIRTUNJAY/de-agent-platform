---
layout: '@/layouts/DocsLayout.astro'
title: 'Ingestion Pipeline'
description: 'How a URL becomes a registry entry: discover, normalize, license-check, score, verify, publish — reproducibly, at build time.'
kicker: 'Docs · Reference'
---

The registry is not a hand-edited database. Content moves through a pipeline, and the same pipeline runs on every build, so the published artifacts are always regenerated from source-of-truth records.

## The ten stages

1. **Discover** — find candidate resources from curated sources (standards bodies, official vendor docs, communities with authority ratings recorded in the registry metadata).
2. **Fetch metadata** — collect upstream facts: license, version, activity.
3. **Extract** — pull the content the curation record will *reference* (documents are rewritten in our own words; see the license rule below).
4. **Classify** — assign the single canonical category (which implies the roadmap stage) and type.
5. **Normalize** — heterogeneous curated YAML becomes the uniform [Resource shape](/docs/content-model): one category, flattened relationships, the five security flags.
6. **Deduplicate** — slugs must be unique; collisions fail the build loudly.
7. **License check** — every entry's license is checked against the licence catalogue. **Proprietary and non-reproducible sources are linked and summarised only — their content is never redistributed in the registry.** This is a policy the build enforces, not a style note.
8. **Quality score** — [quality, completeness and trust](/docs/scoring) are computed for every resource.
9. **Verify** — the curator asserts a [verification level](/docs/verification) and stamps `last_verified`. Entries older than 180 days go stale.
10. **Publish** — four artifacts are emitted: `registry.json`, `search-index.json`, `graph.json` and `stats.json`. The site reads *only* these generated files.

## Build-time, not runtime

Discovery and provenance refresh touch the network, so they are **separate commands that never run implicitly during a build** — `npm run discover` (feeds the [review queue](/admin/queue)) and `npm run pipeline` are deliberately distinct. A site build re-normalizes, re-validates and re-scores the curated records — deterministic, offline, and fast — then emits fresh artifacts. If validation fails (broken references, unknown categories, schema violations), the build halts instead of publishing a degraded registry.

## Curated YAML is the input

Reviewed resources live as human-readable YAML records, one file per domain (the dbt skills live in `skills/04-dbt.yaml`, and so on). The pipeline treats them as the reviewed input: it normalizes, validates, scores and publishes — it does not make editorial decisions. To add or change a resource, edit the record, run the build, and let the validator argue with you. See [Contributing](/docs/contributing).
