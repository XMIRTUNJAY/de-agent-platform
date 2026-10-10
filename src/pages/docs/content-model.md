---
layout: '@/layouts/DocsLayout.astro'
title: 'Content Object Model'
description: 'The canonical Resource shape that every skill, server, runbook and pattern normalizes into — one model, presented ten ways.'
kicker: 'Docs · Reference'
---

Ten different content types live in this registry, and one page can list them side by side, because every entry normalizes into the **same canonical Resource shape**. This page is that shape.

## Ten types, one spine

The registry holds ten resource types: **Skill, MCP server, Plugin, Hook, Agent, Template, Project, Runbook, Pattern, Reference.** Every record shares a common spine; type-specific payloads extend it.

The common spine:

- **Identity** — `id`, `slug`, `type`, `title`, `tagline`, `description`.
- **Classification** — exactly one `category` (which implies its `stage`), plus `subcategory`, `difficulty`, `tags`, `technologies`.
- **Learning** — `learning_objectives` and `prerequisites` (skills and projects carry these).
- **Provenance** — `version`, `license`, `author`, `publisher`, `source_url`, `github_url`, `install_command`.
- **Trust** — `verification` level, `last_verified` date, the five `security` flags and a derived `security_flags` count.
- **Graph** — `relationships` (`related_to`, `uses`, `implements`, `prerequisite_of`, `in_category`) — see [Relationships](/docs/relationships).

## The taxonomy spine

Every resource maps to **exactly one** of 38 categories. Categories map to exactly one of 13 [roadmap](/roadmap) stages. Technologies are a separate, first-class reference list (31 entries) that resources `use`. This is what keeps search, the roadmap and the marketplace from drifting apart.

## Type-specific payloads

The normalization layer keeps each type's real payload verbatim:

- **Skill** — `files` (SKILL.md + references/examples/tests), the skill `body`, `supported_agents`.
- **MCP server** — `server` identity, `transport`, `tools`, `installation`, `environment_variables`.
- **Hook** — `trigger`, `implementation`, `failure_behavior`, an `example` blocked action.
- **Agent** — `inputs`, composed `tools`/`skills`/`mcp`, stepwise `workflow`, `outputs`, `guardrails`, `evaluation`.
- **Plugin** — `runtime`, `capabilities`, bundled `commands`/`hooks`/`skills`, `permissions`.
- **Template** — `contents`, `repo_structure`, `installation`.
- **Project** — `stack`, an `architecture` sketch, `repo_structure`, `tests`, `failure_scenarios`, `production_hardening`.
- **Runbook** — `symptoms`, `possible_causes`, `diagnosis`, `commands`, `fix`, `prevention`, `monitoring`.
- **Pattern** — `context`, `forces`, `solution`, `tradeoffs`, `when_to_use`, `when_not`, `implementations`.
- **Reference** — external `url`, `publisher`, `kind` (documentation / spec / book / guide), a per-component `quality` rubric, and `why` it belongs in the registry.

## Completeness is computed, not vibes

Sixteen fields define a "complete" record — description, category, difficulty, tags, technologies, learning objectives, prerequisites, source URL, license, author, version, last-verified date, compatibility, install command, security flags and verification. The pipeline scores every entry against them (see [Scoring](/docs/scoring)); a record missing swaths of it reads as thin everywhere it appears.

Normalization never invents data: missing fields stay `null` or empty, and the schema validator — not an author — decides whether a record is structurally sound. See [Ingestion pipeline](/docs/ingestion).
