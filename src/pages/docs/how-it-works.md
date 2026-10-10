---
layout: '@/layouts/DocsLayout.astro'
title: 'How it works'
description: 'The content pipeline: how raw resources become verified, browsable registry entries.'
kicker: 'Docs · Architecture'
---

The registry is a **static pipeline**: structured metadata in → typed pages out. Nothing is fetched at runtime; everything on the site is generated at build time from a single source of truth.

## Pipeline stages

1. **Source records.** Each resource is authored as a metadata record (slug, name, type, description, source, tags, plus category/stage/difficulty/verification fields).
2. **Generated data.** A build-time script normalizes records, derives the taxonomy tree, stage mappings, filter facets, and stats (`stats.json`), and emits JSON consumed by the pages.
3. **Astro pages.** Listing, detail, taxonomy, roadmap, and search pages are statically rendered from the generated data. Search runs client-side against the same index — there is no backend.

## Resource → category → stage

Three independent classifications let you slice the same catalog three ways:

- **Type** answers *what form* it takes (a skill file, an MCP server, a runbook).
- **Category** answers *what domain* it belongs to (dimensional modeling, streaming, governance).
- **Stage** answers *when in the lifecycle* it applies (ingestion, quality, observability).

A single resource can address one stage while belonging to a category that spans many — the roadmap view joins resources to lifecycle stages.

## Provenance and verification

Every record carries provenance fields: upstream source, license, and security notes where applicable. Verification status is assigned per resource; see [Verification](/docs/verification) for the three levels. The date of the last check is stored as `last_verified` and is displayed on cards and detail pages.

## Agent integration

Adoption follows a simple flow: pick a resource in the [marketplace](/marketplace), read its detail page for configuration and any prerequisites, then install the artifact (skill file, MCP config, plugin) into your agent environment. Detail pages surface copy-ready configuration snippets where the resource format supports them.
