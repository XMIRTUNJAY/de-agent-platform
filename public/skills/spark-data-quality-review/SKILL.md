---
name: spark-data-quality-review
description: A review skill an agent runs against a Spark/PySpark transform. It checks null propagation, join fan-out, silent type coercion, non-deterministic row counts and missing post-write assertions, then reports findings as a diff-level list.
license: Apache-2.0
---

# Spark Data Quality Review

> Audit a PySpark job for silent data-quality failures before it ships.

A review skill an agent runs against a Spark/PySpark transform. It checks null propagation, join fan-out, silent type coercion, non-deterministic row counts and missing post-write assertions, then reports findings as a diff-level list.

## You will learn

- Identify the five classes of silent failure in a Spark transform
- Add pre/post row-count and null assertions to a job
- Recognise join fan-out caused by non-unique keys

## Reference

# Spark Data Quality Review

## When to use
Run this when a PySpark transform is about to be merged, or when a downstream
table's row count changed without a code change.

## Check order
1. **Null propagation** — every outer join introduces nullable right-side keys.
   Confirm downstream code coalesces or filters them.
2. **Join fan-out** — assert key uniqueness on the intended 1-side before joining.
3. **Silent coercion** — `cast` failures return null, not errors. Prefer `try_cast`
   and count the nulls it produces.
4. **Non-determinism** — `dropDuplicates` without a sort key keeps an arbitrary row.
5. **Missing assertions** — every write should be followed by a row-count and a
   null-rate check on the primary key.

## Output
A findings list: `severity | file:line | rule | suggested patch`.

## Install

```
npx de-agent-platform add spark-data-quality-review
```

---

Source record: https://emanisha.in/de-agent/skills/spark-data-quality-review
