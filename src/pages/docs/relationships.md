---
layout: '@/layouts/DocsLayout.astro'
title: 'Relationships Graph'
description: 'Five edge types connect 135 resources into a graph — prerequisites before skills, patterns before their implementations.'
kicker: 'Docs · Reference'
---

A list teaches you that things exist; a graph teaches you what to learn next. The registry's resources are connected by a small set of explicit relationships, emitted as `graph.json` at build time — 204 nodes and over 600 edges at current build.

## The edge types

Five relationship kinds, all declared by curators in the source records and flattened during normalization:

- **`in_category`** — the backbone: every resource belongs to exactly one category, every category to exactly one stage. This is what makes the roadmap, the taxonomy and search agree.
- **`prerequisite_of`** — "learn/run this first." The dbt model-review skill is a prerequisite of the dbt test-writer skill; following these edges backwards from any advanced resource gives you a learning path.
- **`uses`** — links a resource to the technologies (dbt, Spark, Kafka, …) it actually exercises, from the first-class technology list.
- **`related_to`** — lateral "see also" edges: a skill related to its category, a pattern related to the quality-gate skills that implement it.
- **`implements`** — the concrete-to-abstract edge: starter projects and skills that *implement* an architecture pattern. Read the pattern for the *why*, then the implementation for the working copy.

## What the graph is for

**For you:** detail pages render their neighbourhood — prerequisites above, related entries beside, patterns below — so no entry is a dead end. The tutorials page is effectively the graph sorted into a queue.

**For agents:** the graph is machine-readable. An agent asked to "teach me data contracts" can walk `in_category` → the data-contracts category → `prerequisite_of` chains → `implements` edges to a runnable project, instead of guessing.

**For curators:** edges are validated like data. A relationship pointing at a slug that doesn't exist is a build error, not a 404 discovered later — referential integrity is enforced by the same [pipeline stage](/docs/ingestion) that validates the schema.

## Why so few edge types

Deliberately. Five relationships are few enough to stay meaningful at 135 resources and dense enough to express learning order. If a relationship can't be said as *prerequisite*, *uses*, *related*, or *implements*, it probably belongs in prose, not in the graph.
