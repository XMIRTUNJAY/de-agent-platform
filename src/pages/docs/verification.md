---
layout: '@/layouts/DocsLayout.astro'
title: 'Verification'
description: 'The three verification levels and what each one guarantees about a resource.'
kicker: 'Docs · Trust'
---

Not all registry entries carry the same confidence. Every resource is labeled with one of three verification levels — displayed as a chip on cards and a banner on detail pages — so you can gauge trust at a glance.

## The three levels

**Tested** — the strongest signal. The resource has been executed or applied by a maintainer, and critical elements (install steps, configuration snippets, CLI examples) were validated against the current documentation. Tested entries are explicitly version-pinned where the format allows.

**Reviewed** — a maintainer has examined the source material: it exists, its documentation matches the description in this registry, the license is clear, and no known security issues affect it. Reviewed does not mean line-by-line audited; it means the entry is real, current, and correctly described.

**Community** — submitted by the community or automatically harvested, and not yet reviewed. Community entries are usable, but check the linked source and treat configuration snippets as starting points.

## What a check covers

For each level, reviewers look at the same core signals, with increasing depth:

- **Existence & currency** — the upstream source is live and matches the registry description.
- **License** — a declared, compatible license; missing or incompatible licenses block `reviewed`.
- **Security** — no known unfixed vulnerabilities, no suspicious install behavior, no undeclared network calls for executable resources.
- **Metadata accuracy** — type, category, stage, and difficulty tags reflect what the resource actually does.
- **Docs quality** — install/usage instructions complete enough to follow without guesswork.

## Freshness

Every resource records `last_verified` — the date of its most recent check at its current level. Entries older than a reviewer-defined freshness window are re-queued for re-check. If you find a stale or broken entry, see the report path in [Security](/docs/security).
