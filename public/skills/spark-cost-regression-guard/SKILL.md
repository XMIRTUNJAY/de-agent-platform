---
name: spark-cost-regression-guard
description: Compares a job's shuffle/spill/scan metrics against a stored baseline and fails the change if cost-per-run regresses beyond a threshold, with the diff explained.
license: Apache-2.0
---

# Spark Cost Regression Guard

> Detect the 4x cost jump in CI, before it reaches the invoice.

Compares a job's shuffle/spill/scan metrics against a stored baseline and fails the change if cost-per-run regresses beyond a threshold, with the diff explained.

## You will learn

- Capture cost-relevant metrics from a Spark run
- Store and compare a baseline
- Explain which stage caused a regression

## Reference

# Spark Cost Regression Guard

## Metrics worth baselining
shuffle read/write bytes, spill (disk) bytes, task count, max task duration,
input bytes. These predict cost far better than wall-clock time.

## Threshold
Fail if any metric grows > 25% vs the stored median of the last 5 runs. A 4x
regression is then caught at 1.25x, in CI, for free.

## Explain the diff
Name the stage whose metric moved, and whether it was a join, an aggregation,
or a partition count change.

## Install

```
amp skill add de-agent/spark-cost-regression-guard
```

---

Source record: https://emanisha.in/de-agent/skills/spark-cost-regression-guard
