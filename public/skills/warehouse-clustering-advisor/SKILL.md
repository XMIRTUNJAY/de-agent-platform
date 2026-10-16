---
name: warehouse-clustering-advisor
description: Advises on Snowflake/BigQuery/Redshift tuning: clustering keys, warehouse sizing, result caching, and the difference between a scan problem and a compute problem.
license: Apache-2.0
---

# Warehouse Clustering Advisor

> Choose warehouse size, clustering keys, and caching — measured.

Advises on Snowflake/BigQuery/Redshift tuning: clustering keys, warehouse sizing, result caching, and the difference between a scan problem and a compute problem.

## You will learn

- Separate scan inefficiency from compute inefficiency
- Choose a clustering key from predicate selectivity
- Right-size a virtual warehouse from queue time

## Reference

# Warehouse Clustering Advisor

## Diagnose first
- Query scans far more partitions than it needs → clustering/partition problem.
- Scan is optimal but the query waits → warehouse sizing or concurrency problem.

## Clustering key choice
Pick the column that appears in the WHERE clause of the *most expensive* queries,
with reasonable cardinality. Order matters: put the most selective first.

## Right-sizing from queue time
If queue time >> execution time for short queries, scale out (more clusters),
not up (bigger warehouse). Different problems, different knobs.

## Install

```
amp skill add de-agent/warehouse-clustering-advisor
```

---

Source record: https://emanisha.in/de-agent/skills/warehouse-clustering-advisor
