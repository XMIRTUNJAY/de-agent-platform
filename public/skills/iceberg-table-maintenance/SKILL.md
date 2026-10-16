---
name: iceberg-table-maintenance
description: Diagnoses small-file and manifest bloat and generates the compaction, snapshot expiry and orphan-file cleanup plan for an Iceberg table.
license: Apache-2.0
---

# Iceberg Table Maintenance

> Keep an Iceberg table fast — compaction, snapshots, and manifest hygiene.

Diagnoses small-file and manifest bloat and generates the compaction, snapshot expiry and orphan-file cleanup plan for an Iceberg table.

## You will learn

- Read an Iceberg metadata table to size the problem
- Pick a compaction strategy and rewrite interval
- Expire snapshots without breaking time travel

## Reference

# Iceberg Table Maintenance

## Diagnose from metadata
```sql
SELECT count(*) files, avg(file_size_in_bytes)/1e6 avg_mb
FROM db.tbl.files;
```
avg_mb < 32 and a growing count → compact.

## Plan
1. `rewrite_data_files` with a target size (128-256 MB).
2. `rewrite_manifests` when the manifest list is huge.
3. `expire_snapshots` older than the retention window — but keep at least one
   full snapshot for time travel.
4. `remove_orphan_files` on a schedule, with a safety margin.

## Do not
Run compaction during peak ingestion; it conflicts with concurrent writers.

## Install

```
amp skill add de-agent/iceberg-table-maintenance
```

---

Source record: https://emanisha.in/de-agent/skills/iceberg-table-maintenance
