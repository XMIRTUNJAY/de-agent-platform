---
layout: '@/layouts/DocsLayout.astro'
title: 'Data Quality Starter Kit'
description: 'Quarantine bad rows instead of losing them: a starter pattern with a runnable demo, dbt tests, and review skills.'
kicker: 'Guides · Build'
related:
  - project-pipeline-dq-quarantine
  - skill-dbt-test-writer
  - skill-spark-data-quality-review
  - ref-soda-core
validation:
  manifest: dq-quarantine-demo
  at: '2026-10-10T10-55-48.048Z'
  result: passed
  ref: 'data/cache/executions/dq-quarantine-demo-2026-10-10T10-55-48.json'
---

Every pipeline eventually meets a bad row: a null business key, a negative amount, a duplicate event. You have three options — drop it silently (lose data), fail the batch (lose the SLA), or quarantine it (keep both). This guide builds the third option.

## Prerequisites

- Node.js 20+ for the runnable demo (no other dependencies).
- For production use: a warehouse or lakehouse, dbt or Spark, and one of the related resources below.

## Step 1 — Run the quarantine demo (Validated)

The demo seeds five rows, three of them bad, applies one rule, and asserts the three quarantine invariants: every row accounted for, published rows clean, nothing silently dropped.

```bash
node pipelines/execute.mjs --manifest data/executions/dq-quarantine-demo.yaml --backend local --local-i-understand
```

Expected output ends with:

```text
PASS: 2 published, 3 quarantined, 0 lost
```

This run was executed under the policy gate on 2026-10-10 (see `validation` in this page's frontmatter). The rule itself — `order_id` present and `amount > 0` — is an example; replace it with your grain key and business rules.

## Step 2 — Encode the rule in dbt tests (Not executed — run against your warehouse)

Translate the demo rule into dbt tests on your fact table: `unique` + `not_null` on the grain key, `accepted_values` on status columns, `relationships` from fact to dimensions. The [dbt test writer skill](/skills/dbt-test-writer) generates these from your model files, and the [pipeline quarantine project](/projects/pipeline-dq-quarantine) shows the publish-or-quarantine branching in a full pipeline. Neither was executed here — dbt needs your warehouse connection.

## Step 3 — Review at scale with Spark (Not executed — needs a cluster)

For batch volumes, the [Spark data-quality review skill](/skills/spark-data-quality-review) applies the same invariants to DataFrames: null-key rates, duplicate counts, partition alignment. [Soda Core](https://www.soda.io/) offers the same checks as YAML contracts if you prefer declarative rules. Cluster steps are documented, not run — adapt the thresholds before trusting them.

## What to inspect before trusting this

- The demo proves the pattern on five rows, not your data distribution. Seed your own bad rows first.
- Quarantine tables need retention and alerting, or they become a second silent drop.
- Evidence for this guide covers the demo only; warehouse and cluster steps carry their source claims, not execution proof.
