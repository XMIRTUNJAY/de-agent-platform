---
layout: '@/layouts/DocsLayout.astro'
title: 'Verification'
description: 'Four verification levels earned through recorded checks — what each one guarantees, and what evidence sits behind it.'
kicker: 'Docs · Trust'
---

Not all registry entries carry the same confidence. Every resource has a **claimed** level set by a curator and an **earned** level computed from recorded checks. When they differ, both are shown — the entry stays listed, labeled honestly, until evidence closes the gap.

## The four levels

**Verified** — the strongest signal. The artifact was executed, its behavior matched the documented expectation, and build plus tests passed with evidence on file.

**Tested** — installation and the provided example ran successfully, with the commands and outputs recorded as evidence.

**Reviewed** — a maintainer checked the source (it exists and matches the description), the license (declared and compatible), and the metadata (type, category, stage and difficulty reflect what the resource does). Reviewed does not mean line-by-line audited.

**Community** — found in an external source with metadata captured and nothing checked yet. Usable, but check the linked source and treat configuration snippets as starting points.

## The ten checks

Each check is a separate claim with its own timestamp, tool, and author. Levels are earned by passing groups of them:

| Check | What it means | Gates a level |
|---|---|---|
| `source_reachable` | The upstream URL was fetched successfully | Yes |
| `metadata_validated` | Schema and referential integrity passed | Yes |
| `license_reviewed` | A human confirmed the declared license | Yes |
| `build_passed` | The documented build ran clean | Yes |
| `tests_passed` | The test suite ran with results recorded | Yes |
| `smoke_passed` | A runtime smoke test passed | Yes |
| `output_validated` | Observed output matched the documented expectation | Yes |
| `tutorial_generated` | A tutorial was generated from source evidence | No — shown |
| `static_checks_passed` | Lint or type checks ran | No — shown |
| `security_reviewed` | A human reviewed the security posture | No — shown separately |

Reviewed needs the first three. Tested adds build and tests. Verified adds smoke and output validation. The three supplemental checks are recorded and displayed but never gate a level: a skill without a tutorial is not unreviewed, and security posture always stands apart from verification.

## Recording evidence

Evidence lives on the curated record as an `evidence` list. Each entry names its check, result, date, and author:

```yaml
evidence:
  - check: source_reachable
    status: passed
    at: '2026-10-10'
    by: human
    tool: curl
    version: '8.x'
    ref: 'https://github.com/example/repo'
    summary: 'Repo and docs respond; README matches registry description.'
  - check: license_reviewed
    status: passed
    at: '2026-10-10'
    by: human
    tool: hands
    version: '1'
    summary: 'Apache-2.0 LICENSE file at repo root.'
```

`status` is `passed` or `failed` — a failed check blocks its level but stays on record. `by` is `human` or `pipeline`: only those two count. A model saying code looks correct is not evidence.

The pipeline attests `metadata_validated` itself on every build (tool `de-agent-pipeline`, current version, schema plus referential integrity) because it actually ran those validations. Everything else needs a human entry or a runner that records its tool and version.

## Over-claims and backfill

If a record claims more than its evidence supports, the pipeline reports it and the site shows both values — for example, `evidence: community · claimed reviewed`. Nothing is hidden and nothing is auto-downgraded: the claim says what a curator believes, the earned level says what the file supports.

Most older records predate this system and show a gap. To clear one, work through the level's checks top-down, add an evidence entry per check, and rebuild. Start with `source_reachable` and `license_reviewed` — those two plus the automatic `metadata_validated` earn `reviewed`.

## Freshness

Every resource records `last_verified` — the date of its most recent check at its current level. Entries older than a reviewer-defined freshness window are re-queued for re-check. If you find a stale or broken entry, see the report path in [Security](/docs/security).

## Running checks with the execution engine

Evidence for build, test, and smoke checks comes from the execution engine (`pipelines/execute.mjs`), not from claims. The rules:

- **Manifests are curator-authored.** Nothing runs because a model suggested it. A manifest lists exact commands, pins versions in its arguments, and is reviewed like any other change.
- **Dry is the default.** The engine prints its plan and runs nothing. Local execution needs two explicit keys: `--backend local` and `--local-i-understand`.
- **The policy gate runs first.** Unapproved trust, network access, paths outside the repo, and malformed commands block the run before anything spawns. A blocked run executes zero commands.
- **Runs are recorded.** Every execution writes a checksummed transcript and a machine-readable summary with tool, version, timestamps, and exit codes. Secrets are scrubbed from the environment and redacted from logs.
- **Evidence is assigned by a human.** The engine prints suggested entries; the curator uncomments the checks the run actually proves and pastes them into the record. A passing build earns `build_passed` — it never implies production readiness.
- **Guarded is not isolated.** Timeouts and output caps are enforced on every backend; CPU, memory, and PID caps plus network isolation and disposable environments are enforced by the Docker backend (`--backend docker`: pinned image already present locally, `--network none`, read-only filesystem, nobody user, no pulls, no privileged flags). Run only manifests for projects you have already reviewed.
