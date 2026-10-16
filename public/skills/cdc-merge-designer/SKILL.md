---
name: cdc-merge-designer
description: Produces a MERGE (or Delta/Iceberg merge) that applies inserts, updates and deletes from a CDC stream correctly, including out-of-order events and tombstones.
license: Apache-2.0
---

# CDC Merge Designer

> Design a correct upsert/delete merge from a change stream.

Produces a MERGE (or Delta/Iceberg merge) that applies inserts, updates and deletes from a CDC stream correctly, including out-of-order events and tombstones.

## You will learn

- Order change events deterministically
- Handle deletes (tombstones) without losing history
- Make the merge idempotent under replay

## Reference

# CDC Merge Designer

## Ordering
Events arrive out of order. Rank by `(lsn, ts_ms)` — never by ingestion time.

## Deduplicate before merging
Keep the latest event per primary key with a window function, then merge once.

## Deletes
A delete is an event with `op = 'd'`. Two valid choices:
- hard delete on merge, or
- soft delete + `_deleted_at` (required if you need history or audit).

## Idempotency
Re-running the same micro-batch must produce the same table. Ranking by LSN
guarantees this; ranking by arrival time does not.

## Install

```
amp skill add de-agent/cdc-merge-designer
```

---

Source record: https://emanisha.in/de-agent/skills/cdc-merge-designer
