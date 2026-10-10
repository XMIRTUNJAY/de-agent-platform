---
layout: '@/layouts/DocsLayout.astro'
title: 'Delta Lake vs Apache Iceberg'
description: 'Choosing an open table format for your lakehouse: what each guarantees, where they differ, and which constraints should decide.'
kicker: 'Guides · Decide'
kind: comparison
related:
  - ref-delta-docs
  - ref-iceberg-docs
  - pattern-medallion-zones
  - pattern-small-files-compaction
  - project-kafka-spark-delta
validation: null
---

Both Delta Lake and Apache Iceberg add transactions, time travel, and schema evolution to Parquet files in object storage. For most new lakehouses the choice matters less than the discipline around it — but the formats differ in ways that should drive the decision. Nothing below was benchmarked here; format claims cite the official docs, operational claims cite registry patterns.

## Criteria

| Criterion | Delta Lake ([docs](https://docs.delta.io/)) | Apache Iceberg ([docs](https://iceberg.apache.org/docs/latest/)) |
|---|---|---|
| Origin & governance | Created at Databricks, now Linux Foundation; Databricks is its primary commercial driver | Created at Netflix, now Apache top-level; multi-vendor by design |
| Engine support | Deepest in Spark and Databricks Runtime; growing elsewhere | Broad: Spark, Trino, Presto, Flink, Snowflake, BigQuery, Athena |
| Time travel | Yes, versioned reads and restores | Yes, snapshot reads and rollbacks |
| Schema evolution | Column mapping modes, enforcement + evolution | Schema evolution with field IDs; partition evolution without rewrites |
| Partitioning | Partitioned by columns; small-file handling is your job (see [compaction](/patterns/small-files-compaction)) | Hidden partitioning; evolve partition specs without rewriting data |
| Streaming writes | Native in Spark Structured Streaming ([example project](/projects/kafka-spark-delta)) | Supported via Spark/Flink sinks; check your engine version |
| Ecosystem fit | Natural if you already run Databricks or Spark-first | Natural for multi-engine shops (Trino + Spark + warehouse readers) |

## Unknowns — not reproduced here

- **Performance comparisons.** Vendor benchmarks exist for both; none were rerun in this registry. Treat relative speed claims as marketing until you test your own workload.
- **Operational cost.** Compaction, clustering, and snapshot expiry dominate table-format cost far more than the format choice. Measure with your retention settings.
- **CDC specifics.** Debezium-to-lakehouse behavior depends on connector and sink versions ([Debezium docs](https://debezium.io/documentation/)); verify merge semantics per release.

## Verdict

- **Choose Delta Lake when:** you run Databricks or Spark-first, your team already knows its operations, and your readers are Spark or Databricks SQL. The [medallion pattern](/patterns/medallion-zones) maps onto it directly.
- **Choose Iceberg when:** multiple engines must read the same tables (Spark + Trino + Snowflake), or you need partition evolution without rewrites. Verify each reader's version supports the Iceberg spec version you write.
- **Either way (Not executed — validate in staging):** set up compaction and snapshot expiry on day one, test replay idempotency, and put the quarantine pattern in front of silver. The format never substitutes for those.

## What to inspect before trusting this

- This comparison was assembled from documentation and registry patterns, not from running both formats. No cluster executed anything on this page.
- Both projects move fast — confirm the current docs for the versions you pin.
- Related resources carry their own evidence states; check each entry's checklist before adopting its commands.
