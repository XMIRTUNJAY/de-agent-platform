---
name: airflow-dag-reviewer
description: Checks a DAG for non-idempotent tasks, unsafe retries, missing catchup policy, ambiguous catchup/backfill semantics and unbounded concurrency.
license: Apache-2.0
---

# Airflow DAG Reviewer

> Review a DAG for idempotency, retry safety, and backfill behaviour.

Checks a DAG for non-idempotent tasks, unsafe retries, missing catchup policy, ambiguous catchup/backfill semantics and unbounded concurrency.

## You will learn

- Make every task safe to re-run
- Choose retries and timeouts deliberately
- Predict what a backfill will do before running it

## Reference

# Airflow DAG Reviewer

## The idempotency test
"If this task runs twice for the same logical date, is the output the same?"
If no, fix it before anything else — retries will happen.

## Checklist
1. Every task writes to a partition keyed by the logical date, or uses MERGE.
2. `catchup` is a deliberate choice, not a default.
3. Retries have a backoff; a task that retries instantly will hammer a downstream.
4. `max_active_runs` and pool limits prevent a backfill from starving the daily run.
5. Sensors use `reschedule`, not `poke`, so they don't hold a worker slot.

## Install

```
npx de-agent-platform add airflow-dag-reviewer
```

---

Source record: https://emanisha.in/de-agent/skills/airflow-dag-reviewer
