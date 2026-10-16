---
name: athena-partition-advisor
description: Recommends partition projection, bucketing or file-layout changes to reduce Athena bytes-scanned, and writes the projection DDL.
license: Apache-2.0
---

# Athena Partition Advisor

> Cut scanned bytes — the only thing Athena bills you for.

Recommends partition projection, bucketing or file-layout changes to reduce Athena bytes-scanned, and writes the projection DDL.

## You will learn

- Read the scanned-bytes metric per query
- Apply partition projection for high-cardinality columns
- Compact small files to cut per-request overhead

## Reference

# Athena Partition Advisor

## Bill model
You pay per TB scanned. Every recommendation is judged by "does this reduce
bytes scanned?" — nothing else matters.

## Levers, in order
1. Partition on the dominant filter column (usually date).
2. Partition projection instead of `MSCK REPAIR` for predictable layouts.
3. Compact small files — per-file overhead dominates at < 16 MB.
4. Columnar + compression (Parquet + snappy/zstd) — 10-100x vs CSV.

## Install

```
amp skill add de-agent/athena-partition-advisor
```

---

Source record: https://emanisha.in/de-agent/skills/athena-partition-advisor
