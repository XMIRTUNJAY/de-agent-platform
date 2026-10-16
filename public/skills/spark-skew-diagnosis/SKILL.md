---
name: spark-skew-diagnosis
description: Walks an agent through reading the Spark UI/event log to distinguish key skew, partition skew, and shuffle-write amplification, then selects between salting, AQE skew join, broadcast, and repartition strategies.
license: Apache-2.0
---

# Spark Skew Diagnosis

> Turn "one task is 40 minutes behind" into a named root cause and a fix.

Walks an agent through reading the Spark UI/event log to distinguish key skew, partition skew, and shuffle-write amplification, then selects between salting, AQE skew join, broadcast, and repartition strategies.

## You will learn

- Read task-level duration histograms to confirm skew
- Choose between AQE skew join, salting and broadcast
- Reproduce skew locally with a bounded dataset

## Reference

# Spark Skew Diagnosis

## Signals
- Median task duration ~p50, but p99 is 30x+ → key skew.
- All tasks slow and shuffle read is huge → partition/scan problem, not skew.
- One executor at 100% while others idle → hot partition.

## Decision order
1. Confirm with `spark.sql.adaptive.skewJoin.enabled=true` — if it fixes it, ship that.
2. If not, salt the hot key on both sides and aggregate twice.
3. Broadcast only if the small side is < 100 MB *after* filtering.
4. Never `repartition(1)` to "fix" skew; it serialises the stage.

## Evidence to attach
The task-duration histogram, the shuffle read/write bytes, and the top-10 keys
by row count — the review is not complete without them.

## Install

```
amp skill add de-agent/spark-skew-diagnosis
```

---

Source record: https://emanisha.in/de-agent/skills/spark-skew-diagnosis
