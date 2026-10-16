---
name: mcp-tool-contract-auditor
description: Inspects an MCP server's tool list and schemas, flags tools that can write, delete, spend money or exfiltrate data, and produces a least-privilege connection recommendation.
license: Apache-2.0
---

# MCP Tool Contract Auditor

> Review an MCP server's tools for blast radius before you connect it.

Inspects an MCP server's tool list and schemas, flags tools that can write, delete, spend money or exfiltrate data, and produces a least-privilege connection recommendation.

## You will learn

- Read a tool schema and predict its side effects
- Classify tools by blast radius
- Write a least-privilege MCP configuration

## Reference

# MCP Tool Contract Auditor

## Classify every tool
- **Read** — safe, still logs the data it can reach.
- **Write** — can mutate state; needs a sandbox or a dry-run.
- **Destructive** — delete/drop/truncate; require human confirmation.
- **Spend** — provisions resources or runs billable queries.
- **Exfiltrate** — can send data to an external network.

## Deliverable
A table of tools by class, then a config that grants only the Read/Write tools
the task needs. Never connect an unvetted server with broad credentials.

## Install

```
npx de-agent-platform add mcp-tool-contract-auditor
```

---

Source record: https://emanisha.in/de-agent/skills/mcp-tool-contract-auditor
