---
# GUIDE SCAFFOLD — copy this file to <slug>.md and fill every section.
# Files starting with _ never build to a URL (Astro convention), so this
# template is documentation, not a page. Delete these comments in the copy.
layout: '@/layouts/DocsLayout.astro'
title: 'Guide title — the outcome, not the tool'
description: 'One sentence: what the reader will have built or decided.'
kicker: 'Guides · Build'
kind: guide # or: comparison (requires ## Criteria + ## Verdict sections)
related:
  - record-id-one # must exist in registry.json — the contract test checks
  - record-id-two
validation: null # or: { manifest: <id>, at: <ISO>, result: passed, ref: <result json> }
---

<!-- One paragraph: the problem and why the naive approach fails. -->

## Prerequisites

<!-- Runtimes, accounts, and background knowledge. Link registry records. -->

## Step 1 — Name the outcome (Validated | Not executed)

<!-- Every step carries exactly one label. Validated = engine run recorded in
     frontmatter. Not executed = honest about needing the reader's system. -->

```bash
# commands in fenced blocks, pinned versions, expected output below
```

## Unknowns — not reproduced here

<!-- Claims you could not verify go here, not in the steps. -->

## What to inspect before trusting this

<!-- Distribution skew, retention needs, version pins, evidence scope. -->
