---
layout: '@/layouts/DocsLayout.astro'
title: 'Kafka to Lakehouse Ingestion'
description: 'Stream events from Kafka into a lakehouse with deduplication, checkpointing, and lag triage — what runs where, and what to validate first.'
kicker: 'Guides · Build'
related:
  - project-kafka-spark-delta
  - project-postgres-cdc-kafka-lakehouse
  - skill-kafka-lag-triage
  - ref-kafka-docs
  - ref-delta-docs
  - ref-debezium-docs
validation: null
---

Move events from Kafka into queryable tables without duplicates, without losing your place on restart, and without paging someone at every lag spike. This guide maps the moving parts; every cluster step is marked not executed, because there is no cluster here.

## Prerequisites

- A Kafka cluster (or Redpanda), Spark Structured Streaming or equivalent, and Delta Lake or Iceberg tables.
- Familiarity with consumer groups, offsets, and watermarks. The [Kafka documentation](https://kafka.apache.org/documentation/) is the authority for client behavior.

## Step 1 — Sketch the bronze/silver/gold flow (Not executed — design step, no cluster)

Raw events land in bronze (append-only, exactly as received). Silver deduplicates on the event key and enforces schema. Gold aggregates for queries. The [Kafka-to-Delta project](/projects/kafka-spark-delta) implements this with watermark-based late-event handling, and the [Postgres CDC project](/projects/postgres-cdc-kafka-lakehouse) shows the Debezium variant for change-data capture ([Debezium docs](https://debezium.io/documentation/)). Adapt partition counts and retention to your throughput before copying anything.

## Step 2 — Checkpoint and replay safely (Not executed — needs a cluster)

Checkpoint offsets to durable storage on every micro-batch so restarts resume rather than rewind. Validate with the replay invariant: reprocessing the same batch must produce an identical table. [Delta Lake docs](https://docs.delta.io/) describe time travel and idempotent writes for the storage side. Do not trust replay behavior until you have run it against your own topics.

## Step 3 — Triage consumer lag before it pages you (Not executed — needs a running group)

When lag grows, distinguish broker pressure from slow processing from poison pills. The [Kafka lag triage skill](/skills/kafka-consumer-lag-triage) walks that decision tree, and the console plugin surfaces group state. Alert on lag trend, not absolute lag — a steady 10k is a backlog; a climbing 10k is an incident.

## What to inspect before trusting this

- Nothing on this page was executed against a cluster; every claim comes from the linked sources, not from runs.
- Deduplication keys, watermark delays, and retention are workload-specific — the defaults in examples are starting points.
- Validate replay and failure recovery in a staging environment first; streaming bugs compound silently.
