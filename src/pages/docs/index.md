---
layout: '@/layouts/DocsLayout.astro'
title: 'Introduction'
description: 'What the DE Agent Registry is, what it contains, and how to find your way around.'
---

The **DE Agent Registry** is a curated catalog of reusable **data engineering resources for AI coding agents**. It exists so that when you ask an agent to help with a pipeline, a dbt project, a data quality check, or an orchestration setup, it starts from proven, verified material instead of improvising.

Right now the registry holds **135 resources across 38 categories**, organized against a 13-stage data lifecycle and 31 technologies. Every entry carries structured metadata — type, category, lifecycle stage, difficulty, verification status, provenance — so both humans and agents can filter precisely.

## The three pillars

Everything in the registry clusters around what agents actually consume:

- **Context** — *skills, guidelines, references.* Knowledge artifacts that teach an agent how data engineering is done: naming conventions, modeling patterns, platform docs, domain runbooks. These shape *what the agent knows*.
- **Capabilities** — *MCP servers, plugins, hooks.* Executable tools that give agents new powers: querying warehouses, validating schemas, generating awesome pipelines. These shape *what the agent can do*.
- **Quality** — *verification, metadata, provenance.* Every resource declares where it came from, when it was last verified, and who or what checked it. This shapes *what you can trust*.

## Content model

Each resource is described by a compact, consistent record:

| Field | Meaning |
| --- | --- |
| `type` | One of ten kinds: skill, agent, MCP server, plugin, hook, template, starter, runbook, architecture, reference |
| `category` / `subcategory` | Where it sits in the taxonomy |
| `stage` | The lifecycle stage it belongs to (e.g. data quality, orchestration, observability) |
| `difficulty` | `beginner`, `intermediate`, or `advanced` |
| `verification` | `community`, `reviewed`, or `tested` — see [Verification](/docs/verification) |
| `source` / `license` / `security` | Provenance and trust signals |

## Browsing the registry

- **Marketplace** (`/marketplace`) — the full catalog with search and filters by type, category, stage, difficulty, and verification.
- **Categories** (`/categories`) — browse the taxonomy tree.
- **Search** (`/search`) — full-text search across all resources.
- **Roadmap** (`/roadmap`) — every resource mapped onto the data lifecycle.

## For agents

The registry ships with machine-readable artifacts: `agents.md` instructions for using each resource type, an OpenAPI-era JSON/skill index, and category-specific installation patterns. Load the registry into an agent session via project-level `CLAUDE.md` wiring so the agent can recommend and validate resources instead of hallucinating package names.
