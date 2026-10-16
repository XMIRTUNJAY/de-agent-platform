---
name: schema-change-contract-review
description: Diffs an old and new schema, classifies the change (compatible / risky / breaking) against consumers, and produces the migration and comms plan.
license: Apache-2.0
---

# Schema Change Contract Review

> Classify a schema change as safe, risky, or breaking — before it ships.

Diffs an old and new schema, classifies the change (compatible / risky / breaking) against consumers, and produces the migration and comms plan.

## You will learn

- Apply backward/forward compatibility rules to a diff
- Detect a breaking change hidden behind a "safe" rename
- Write a deprecation plan with dates

## Reference

# Schema Change Contract Review

## Classification
- **Compatible** — new nullable column, widened type that preserves values.
- **Risky** — narrowing a type, adding a NOT NULL without a default, changing units.
- **Breaking** — rename, remove, or semantic change to an existing column.

## The hidden breaking change
A rename + a new column with the old name looks compatible to a schema differ
but breaks every consumer that read the old semantics. Always diff *semantics*,
not just names.

## Migration skeleton
Add → dual-write → backfill → announce → migrate consumers → remove (dated).

## Install

```
amp skill add de-agent/schema-change-contract-review
```

---

Source record: https://emanisha.in/de-agent/skills/schema-change-contract-review
