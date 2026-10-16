# DRAFT tutorial brief — NOT served. Verify every step against the cited source field,
# then copy into data/curated/tutorials/ as type: tutorial.
# stage: lakehouse
# status: draft

proposed_title: Learn with Iceberg Table Maintenance
source: skill-iceberg-maintenance (skill)
difficulty: advanced
alternates: runbook-small-files-explosion

what_you_need (verbatim from source):
- Prior: skill-spark-skew-diagnosis
- Install: amp skill add de-agent/iceberg-table-maintenance

steps (verbatim, in source order — do not rephrase):
1. `rewrite_data_files` with a target size (128-256 MB).
   from: skill-iceberg-maintenance#body
2. `rewrite_manifests` when the manifest list is huge.
   from: skill-iceberg-maintenance#body
3. `expire_snapshots` older than the retention window — but keep at least one
   from: skill-iceberg-maintenance#body
4. `remove_orphan_files` on a schedule, with a safety margin.
   from: skill-iceberg-maintenance#body

check_yourself (verbatim from source):
- (none stated in source — leave empty, do not invent)

gatekeeping_scan: pass
