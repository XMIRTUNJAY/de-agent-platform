---
name: delta-optimization-advisor
description: Reads Delta table history and file statistics to decide between OPTIMIZE, Z-ORDER, liquid clustering and partitioning changes.
license: Apache-2.0
---

# Delta Optimization Advisor

> OPTIMIZE, Z-ORDER, or nothing — decide with data, not vibes.

Reads Delta table history and file statistics to decide between OPTIMIZE, Z-ORDER, liquid clustering and partitioning changes.

## You will learn

- Decide if a table needs OPTIMIZE from file stats
- Choose Z-ORDER columns from query predicates
- Know when liquid clustering beats partitioning

## Reference

# Delta Optimization Advisor

## Decide
- Files < 32 MB and many → `OPTIMIZE`.
- Queries filter on 1-2 high-cardinality columns → `ZORDER BY` those columns.
- High-cardinality, many predicates, frequent writes → liquid clustering.
- Predicate on one low-cardinality column (date) → partition (or leave it; Delta
  handles pruning well already).

## Measure
Compare `numFiles` and query `bytes scanned` before and after. If scanning
didn't drop, the Z-ORDER was on the wrong columns.

## Install

```
amp skill add de-agent/delta-optimization-advisor
```

---

Source record: https://emanisha.in/de-agent/skills/delta-optimization-advisor
