---
layout: '@/layouts/DocsLayout.astro'
title: 'Security'
description: 'Trust signals on each resource, what reviewed means, and how to report a problem.'
kicker: 'Docs · Trust'
---

Agent-consumable content is executable trust: a skill file shapes an agent's behavior, an MCP server runs code, a hook executes in your environment. The registry is designed to make that trust explicit rather than assumed.

## Trust signals you can check

Every detail page surfaces the signals we track:

- **Verification level** — `tested`, `reviewed`, or `community` (see [Verification](/docs/verification)).
- **License** — the declared license of the upstream source.
- **Source** — the canonical upstream repository or document, linked so you can inspect the real thing.
- **Last verified** — when the entry was last checked.
- **Security notes** — where a resource has specific hardening steps (e.g. required permissions, network access, credential handling), they are called out on the detail page.

## Your responsibilities

Verification is a signal, not a guarantee. Before installing executable resources:

1. **Read the source.** Follow the upstream link and skim what you're about to run — especially hooks and MCP servers.
2. **Pin versions** where the format supports it.
3. **Scope credentials.** Give agent tools the minimum access the task needs.
4. **Prefer `tested`/`reviewed`** for anything that executes code or touches production systems.

## Reporting a problem

If you find a resource that is broken, mis-described, insecure, or license-incompatible, open an issue on the registry's upstream repository and include the resource slug, what you observed, and the level it was verified at. Problem entries are demoted to `community` until re-checked.

## Out of scope

The registry does **not** scan for malicious code continuously, audit upstream dependencies, or guarantee that a `reviewed` resource is free of defects. Treat verification levels as confidence tiers, not certifications.
