---
name: sql-query-plan-explainer
description: Reads EXPLAIN / EXPLAIN ANALYZE output and explains scans, joins, spills and estimated-vs-actual row skew, then proposes the single highest-impact change.
license: Apache-2.0
---

# SQL Query Plan Explainer

> Translate an EXPLAIN plan into plain language and the one change worth making.

Reads EXPLAIN / EXPLAIN ANALYZE output and explains scans, joins, spills and estimated-vs-actual row skew, then proposes the single highest-impact change.

## You will learn

- Read a plan bottom-up and name the expensive node
- Detect cardinality misestimation from stale statistics
- Decide between an index, a rewrite, or a stats refresh

## Reference

# SQL Query Plan Explainer

## Method
1. Read bottom-up; the deepest node is the first data touched.
2. Compare `rows` (estimate) to `actual rows`. >10x off means stale stats.
3. Look for `Seq Scan` on a large table that should use an index.
4. Look for `Sort` / `Hash` spilling to disk (`disk usage` in the plan).

## Output
One sentence per expensive node, then exactly one recommended change with
the expected effect and a way to measure it.

## Install

```
amp skill add de-agent/sql-query-plan-explainer
```

---

Source record: https://emanisha.in/de-agent/skills/sql-query-plan-explainer
