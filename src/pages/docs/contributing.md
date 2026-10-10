---
layout: '@/layouts/DocsLayout.astro'
title: 'Contributing a Resource'
description: 'How to propose a new registry entry: what gets accepted, what the record needs, and how curation works.'
kicker: 'Docs · Project'
---

The registry grows by curation, not by submission volume. One well-scored, verified entry beats ten unreviewed links. Here's how to contribute.

## What belongs

Resources that help someone do data engineering **with an agent alongside**:

- **Skills, MCP servers, hooks, plugins, agents** — executable primitives with clear contracts (see the [tool contract](/docs/tooling) and [skill anatomy](/docs/skill-anatomy)).
- **Templates, starter projects, runbooks, patterns** — the buildable and the reusable.
- **References** — documentation, specs and books worth pointing at, scored on the [quality rubric](/docs/scoring), *not* on popularity.

Hard rules, enforced by the build: one canonical category per resource; a declared license; and for proprietary sources, we **link and summarise — we never reproduce content**.

## The process

1. **Open an issue** on the repository with the resource's URL, what it does, and which category you think it fits. Check the [taxonomy](/taxonomy) first — if you can't find its category, that conversation is worth having before you write the record.
2. **A curator drafts the record** as YAML (or you can draft it following the existing files as a template) against the [content object model](/docs/content-model): classification, provenance, security flags, learning objectives where they apply.
3. **Verification is asserted, not assumed.** New entries land at `community` (metadata captured, nothing checked) and are promoted to `reviewed` (source, license and docs checked) and `tested` (install + example actually run) as the checks are performed. See [Verification levels](/docs/verification).
4. **The build decides.** Normalization, schema validation, referential integrity checks and scoring run on every build; a malformed record fails loudly instead of shipping half-broken.

## The bar

- Would a data engineer with an agent actually use this within a month?
- Is the blast radius honestly declared (code execution, network, credentials)?
- Is the license identified and respected?
- Does the description say what it does — not what it aspires to?

If all four are yes, it belongs here.
