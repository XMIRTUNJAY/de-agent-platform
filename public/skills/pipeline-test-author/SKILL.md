---
name: pipeline-test-author
description: Builds a local DuckDB/pyarrow harness with tiny fixtures so pipeline logic is testable in CI without a cluster, and asserts on invariants, not snapshots.
license: Apache-2.0
---

# Pipeline Test Author

> Write integration tests for a pipeline that run in seconds, offline.

Builds a local DuckDB/pyarrow harness with tiny fixtures so pipeline logic is testable in CI without a cluster, and asserts on invariants, not snapshots.

## You will learn

- Test a transform without a Spark cluster
- Assert invariants instead of golden files
- Make a pipeline test deterministic

## Reference

# Pipeline Test Author

## The harness
Keep fixtures as 3-10 row Parquet/CSV files under `tests/data/`. Load them with
DuckDB or pyarrow. No cluster, no network, < 2s.

## Assert invariants, not snapshots
- `count(*)` is stable across a re-run (idempotency)
- no nulls in the grain key
- sum(revenue) equals the source sum within tolerance
- a quarantined row never appears in the published table

## Rule
If a test needs the network or a running warehouse, it is not a unit test.

## Install

```
npx de-agent-platform add pipeline-test-author
```

---

Source record: https://emanisha.in/de-agent/skills/pipeline-test-author
