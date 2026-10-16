# DRAFT tutorial brief — NOT served. Verify every step against the cited source field,
# then copy into data/curated/tutorials/ as type: tutorial.
# stage: data-processing
# status: draft

proposed_title: Learn with Spark Data Quality Review
source: skill-spark-data-quality-review (skill)
difficulty: intermediate
alternates: skill-spark-skew-diagnosis, agent-spark-optimizer

what_you_need (verbatim from source):
- Prior: skill-sql-review
- Install: npx de-agent-platform add spark-data-quality-review

steps (verbatim, in source order — do not rephrase):
1. **Null propagation** — every outer join introduces nullable right-side keys.
   from: skill-spark-data-quality-review#body
2. **Join fan-out** — assert key uniqueness on the intended 1-side before joining.
   from: skill-spark-data-quality-review#body
3. **Silent coercion** — `cast` failures return null, not errors. Prefer `try_cast`
   from: skill-spark-data-quality-review#body
4. **Non-determinism** — `dropDuplicates` without a sort key keeps an arbitrary row.
   from: skill-spark-data-quality-review#body
5. **Missing assertions** — every write should be followed by a row-count and a
   from: skill-spark-data-quality-review#body

check_yourself (verbatim from source):
- (none stated in source — leave empty, do not invent)

gatekeeping_scan: pass
