---
layout: '@/layouts/DocsLayout.astro'
title: 'Testing a dbt Warehouse'
description: 'Grain-key tests, relationship tests, and review skills that catch warehouse bugs before stakeholders do.'
kicker: 'Guides · Build'
related:
  - project-dbt-warehouse-tests
  - skill-dbt-test-writer
  - ref-dbt-docs
  - ref-dbt-best-practices
validation: null
---

Most warehouse bugs are not logic errors — they are grain violations: duplicate keys, orphaned foreign keys, unexpected nulls. A small set of dbt tests catches the majority. This guide shows the set; every warehouse step is marked not executed, because dbt needs your warehouse connection.

## Prerequisites

- A dbt project connected to your warehouse ([dbt docs](https://docs.getdbt.com/)).
- Familiarity with models, sources, and `dbt test`. The [best-practices guide](https://www.getdbt.com/blog) covers project structure.

## Step 1 — Test the grain key first (Not executed — run against your warehouse)

On every fact model, add three tests before anything else: `unique` and `not_null` on the grain key, `relationships` from fact to each dimension, `accepted_values` on status columns. The [warehouse-tests project](/projects/dbt-warehouse-tests) demonstrates exactly this set. Grain tests fail fast and localize the break — start here, not with custom logic tests.

## Step 2 — Generate tests from models (Not executed — needs your model files)

Writing these by hand for fifty models is toil. The [dbt test writer skill](/skills/dbt-test-writer) generates test blocks from your model definitions. Review every generated test before merging — generated coverage of the wrong grain is worse than no coverage, because it looks safe.

## Step 3 — Run tests in CI, not just locally (Not executed — needs your CI)

`dbt test` belongs in the merge pipeline with a failing build on failure. Seed data plus the grain suite gives every pull request a warehouse contract check. What CI ran, against which warehouse state, is the evidence that matters — record the run, not just the green check.

## What to inspect before trusting this

- Nothing on this page executed against a warehouse; the test lists come from the linked project, skill, and official docs.
- Test names must match your actual grain — copy the pattern, not the columns.
- dbt version differences change test syntax; confirm against the docs for the version you pin.
