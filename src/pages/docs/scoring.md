---
layout: '@/layouts/DocsLayout.astro'
title: 'Scoring'
description: 'Three computed scores — source quality, record completeness, trust — and why stars are not among them.'
kicker: 'Docs · Reference'
---

Every registry entry carries scores, and none of them is a GitHub star count. Three numbers, all **computed by the pipeline at build time** — never hand-written into a record.

## 1. Source quality (0–5)

References — the external documentation, specs and books the registry points at — carry an explicit rubric. Curators score up to ten components on a 0–5 scale (`0 = absent`, `5 = exemplary`):

- **Authority** — standards body > vendor > individual.
- **Documentation quality** — complete and accurate docs.
- **Repository activity** — commit recency and release cadence. Deliberately *not* stars.
- **License clarity** — a clear, machine-readable license.
- **Installation** — reproducible, documented setup.
- **Tests** — checks you can run to trust the artifact.
- **Examples** — runnable and relevant.
- **Security, maintenance, compatibility** — documented posture, evidence of ongoing care, stated agent/version support.

The pipeline averages the components present (nulls are excluded and reported, not graded as zero) and maps the result to a label: **Exemplary** ≥ 4.5, **Strong** ≥ 3.5, **Adequate** ≥ 2.5, **Weak** ≥ 1.5, **Unproven** below that. The scale punishes hype: a popular repo with no tests and no license scores Weak, whatever its star count says.

## 2. Completeness (0–100%)

How much of the [canonical object model](/docs/content-model) the record fills. Sixteen fields — description, category, difficulty, tags, technologies, learning objectives, prerequisites, source URL, license, author, version, last-verified date, compatibility, install command, security declaration, verification status. A record that skips half of them *looks* half-finished in the UI, and its score says why.

## 3. Trust (0–5)

Derived, not voted:

- Start from the verification level (`community` → `reviewed` → `tested`).
- Penalize each declared security flag — a tool that runs code and needs credentials is *more scrutinized*, not less listed.
- Penalize staleness: a record whose `last_verified` date is more than **180 days** old loses trust until re-checked.

## What scores are for

Scores sort recommendations and flag gaps for curators. They are *not* a popularity ranking, and they are never substituted for reading the trust signals: verification level, license, and security posture are always displayed on their own. High quality + low trust can coexist — a superbly documented tool that nobody has installed yet should look exactly like that.
