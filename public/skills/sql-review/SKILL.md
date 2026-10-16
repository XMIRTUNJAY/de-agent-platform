---
name: sql-review
description: Reviews a SQL statement for fan-out joins, NULL-unsafe predicates, implicit casts, non-deterministic ordering, and functions that silently change grain.
license: Apache-2.0
---

# SQL Review

> A review pass that catches correctness bugs before the query reaches production.

Reviews a SQL statement for fan-out joins, NULL-unsafe predicates, implicit casts, non-deterministic ordering, and functions that silently change grain.

## You will learn

- Prove a join cannot fan out before writing it
- Spot NULL-unsafe `NOT IN` and `=` predicates
- State the grain of a result set in one sentence

## Reference

# SQL Review

## The first question
*What is the grain of this result?* If the author can't answer, stop.

## Rules
1. Every join states its cardinality (1:1, N:1, N:N) and justifies it.
2. `NOT IN (subquery)` is banned where the subquery can return NULL — use `NOT EXISTS`.
3. Comparisons across types must be explicit casts, not implicit.
4. `ORDER BY` without `LIMIT` in a view is meaningless — drop it.
5. `SELECT *` in a persisted model freezes an unstable schema.

## Deliverable
Findings with the exact predicate, the failure case, and a rewritten clause.

## Install

```
amp skill add de-agent/sql-review
```

---

Source record: https://emanisha.in/de-agent/skills/sql-review
