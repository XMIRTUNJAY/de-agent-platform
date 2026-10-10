---
layout: '@/layouts/DocsLayout.astro'
title: 'Tool & MCP Contract'
description: 'How MCP servers, plugins, hooks and agents declare what an agent is allowed to touch — transports, permissions and trust signals.'
kicker: 'Docs · Agentic'
---

An agent that can only talk is a chatbot. An agent that can act needs **tools**, and every tool in this registry declares a contract: what it does, how you install it, and exactly what it can touch.

## MCP servers

The [Model Context Protocol](https://modelcontextprotocol.io/) is the standard way agents call live tools. Each MCP entry declares:

- **`server`** — name, registry (`vendor`, `community`, …) and publisher, so you know whose artifact you are running.
- **`transport`** — e.g. `stdio` for a local process the agent spawns.
- **`tools`** — the callable surface, named explicitly (`query`, `list_tables`, `describe_table`). Small, named tools beat one big escape hatch.
- **`installation`** — the exact command and a ready-to-merge client config snippet (`mcpServers → … → command/args`).
- **`environment_variables`** — every variable the server reads, with its name — so credentials are provisioned deliberately rather than discovered in an error message.

## Hooks

A hook intercepts an agent action *before it executes*:

- **`trigger`** — when it fires (e.g. `on-tool-call` before a database tool runs).
- **`implementation`** — the match logic, in plain language you can audit.
- **`failure_behavior`** — what happens when the hook itself fails (deny by default is the safe default).
- **`example`** — a concrete blocked action, e.g. a `DROP TABLE prod.orders` denied and surfaced.

## Plugins and agents

- **Plugins** declare a `runtime` and bundle `skills`, `hooks`, `commands` and `permissions` — a one-command install (`amp plugin add …`) with an explicit capability list.
- **Agents** compose the other primitives: declared `inputs`, the `tools` / `skills` / `mcp` servers they call, a stepwise `workflow`, expected `outputs`, and `guardrails`. An agent entry is a *composition*, not a black box.

## The trust contract

Three rules hold across every executable entry:

1. **Blast radius is declared, not discovered.** Five flags — `runs_code`, `network_access`, `credentials`, `filesystem_access`, `external_apis` — are normalized on every resource and feed the counts you see on detail pages and the [capabilities overview](/agentic).
2. **Verification is separate from capability.** A hook that blocks destructive SQL is *more* trusted when `reviewed`, but its flags still show you what it intercepts. See [Verification levels](/docs/verification).
3. **Install lines are written down.** No "download and figure it out" — every executable entry carries a reproducible `install_command`.

If a resource doesn't declare these fields, its [completeness score](/docs/scoring) drops and it shows on the detail page.
