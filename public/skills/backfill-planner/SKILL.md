---
name: backfill-planner
description: Produces a backfill plan: date ranges, blast radius, resource contention, idempotency check, validation gates and rollback.
license: Apache-2.0
---

# Backfill Planner

> Plan a backfill that doesn't melt production or corrupt the target.

Produces a backfill plan: date ranges, blast radius, resource contention, idempotency check, validation gates and rollback.

## You will learn

- Scope a backfill by date and by dependency
- Detect which downstream tables must also be rebuilt
- Stage a backfill gradually with validation between batches

## Reference

# Backfill Planner

## Before running anything
1. **Why** — which dates are wrong, and what does "correct" look like?
2. **Blast radius** — list every downstream model/table that reads the target.
3. **Contention** — will this run beside the daily job? At what hour is the cluster idle?
4. **Idempotency** — can each date be re-run safely?
5. **Rollback** — snapshot the target, or write to a shadow table first.

## Execution
Backfill in date batches, smallest first, validating a sample after each batch.

## Install

```
amp skill add de-agent/backfill-planner
```

---

Source record: https://emanisha.in/de-agent/skills/backfill-planner
