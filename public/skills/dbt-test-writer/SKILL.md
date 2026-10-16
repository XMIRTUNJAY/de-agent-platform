---
name: dbt-test-writer
description: Proposes dbt tests ranked by blast radius: uniqueness/not-null on the grain key, accepted values on enums, relationships on foreign keys, and freshness on sources.
license: Apache-2.0
---

# dbt Test Writer

> Generate the minimum test set that actually protects a model.

Proposes dbt tests ranked by blast radius: uniqueness/not-null on the grain key, accepted values on enums, relationships on foreign keys, and freshness on sources.

## You will learn

- Rank tests by the cost of the failure they prevent
- Write a custom singular test
- Wire freshness on a source

## Reference

# dbt Test Writer

## Rank by blast radius, not by effort
1. `unique` + `not_null` on the grain key — the model is meaningless without it.
2. `relationships` on every foreign key — catches broken joins upstream.
3. `accepted_values` on low-cardinality enums — catches upstream renames.
4. `freshness` on sources — catches a stalled extractor, the #1 silent outage.

## Avoid
- Row-count equality tests on raw sources: they flake.
- Testing a column nobody reads.
- `warn` severity on a correctness test nobody will see.

## Install

```
npx de-agent-platform add dbt-test-writer
```

---

Source record: https://emanisha.in/de-agent/skills/dbt-test-writer
