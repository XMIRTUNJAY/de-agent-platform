---
layout: '@/layouts/DocsLayout.astro'
title: 'Anatomy of a Skill'
description: 'What a skill actually is: a SKILL.md file plus references, examples and tests — modelled on the open Agent Skills format.'
kicker: 'Docs · Agentic'
---

A **skill** is portable expertise for a coding agent. Not a prompt you copy-paste — a small, versioned package the agent loads when the task matches, and ignores when it doesn't. The registry's Skill object is modelled on the open [Agent Skills format](https://agentskills.io/) documented in the reference entries.

## The package

Every skill ships the same four parts, listed in its `files` field:

- **`SKILL.md`** — the entrypoint. Front-matter (`name`, `description`) tells the agent *when* to load it; the body tells it *how* to do the job.
- **`references/`** — deeper material the agent opens on demand: catalogues, edge cases, decision tables. This keeps the main file short.
- **`examples/`** — concrete, runnable input/output the agent can imitate instead of improvising.
- **`tests/`** — rules or checks that let you verify the skill behaves as documented.

This layering is *progressive disclosure*: the agent reads the short description first, loads the body only when relevant, and pulls references only when stuck. Context windows are expensive; the format is built to spend them carefully.

## What a skill in this registry encodes

Beyond the package, each registry entry declares:

- **Learning objectives** — what *you* should be able to do after working through it. Skills double as the hands-on step of the roadmap.
- **Prerequisites** — other skills to run first, so a complex review doesn't assume knowledge you don't have yet.
- **Difficulty** — beginner / intermediate / advanced.
- **Compatibility** — the agent runtimes the skill has been written for (e.g. `claude-code`, `codex`, `cursor`, `amp`, `gemini-cli`).
- **Security flags** — whether the skill touches the filesystem, runs code, calls the network, or needs credentials (see [Security](/docs/security)).
- **Provenance** — license, author, source repo, and the install command.

## A minimal example

The registry's own skills follow this shape — for instance a dbt skill lists `SKILL.md`, `references/incremental-patterns.md`, `examples/models.yml` and `tests/test_rules.py`, with prerequisites pointing at a more basic SQL skill. Skills compose: review skills assume the SQL review skill, streaming skills assume orchestration basics.

## Writing a good one

1. **Name the trigger.** The `description` is what the agent matches against — "reviews a dbt model for grain and incremental correctness" beats "dbt helper".
2. **Rank by blast radius.** Put the failure that costs the most first (e.g. grain tests before stylistic ones).
3. **Show, don't tell.** One worked example beats three paragraphs of advice.
4. **Declare your blast radius.** If the skill never runs code, say so — the security flags let users filter on exactly that.

New skills enter the registry as curated YAML records; see [Contributing](/docs/contributing) and the [content object model](/docs/content-model).
