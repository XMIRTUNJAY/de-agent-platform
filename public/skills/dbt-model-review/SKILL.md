---
name: dbt-model-review
description: Checks a dbt model's grain statement, ref/dependency hygiene, incremental strategy and late-arriving-data handling, then proposes a test set.
license: Apache-2.0
---

# dbt Model Review

> Review a dbt model for grain, materialisation, and incremental correctness.

Checks a dbt model's grain statement, ref/dependency hygiene, incremental strategy and late-arriving-data handling, then proposes a test set.

## You will learn

- State a model's grain and match it to its unique key test
- Choose table vs incremental vs view deliberately
- Handle late data in an incremental model

## Reference

# dbt Model Review

## Grain first
Every model must answer: "one row = one ___". The `unique` test goes on that key.

## Materialisation picker
- `view` — cheap, and the model is small or rarely queried.
- `table` — the source is huge and consumers need speed.
- `incremental` — the source grows monotonically and you can define the watermark.

## Incremental traps
1. Late-arriving rows older than the watermark are silently dropped. Add a
   lookback window (e.g. `>= max(updated_at) - interval '3 days'`).
2. `is_incremental()` must guard the filter or every full run is a full reload.
3. Deletes never arrive. Decide explicitly: soft-delete, or periodic full-refresh.

## Install

```
npx de-agent-platform add dbt-model-review
```

---

Source record: https://emanisha.in/de-agent/skills/dbt-model-review
