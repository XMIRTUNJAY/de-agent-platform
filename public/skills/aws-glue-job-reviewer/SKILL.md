---
name: aws-glue-job-reviewer
description: Reviews Glue/Spark jobs for worker sizing, job bookmarks, partition pruning, and the catalogue/schema pitfalls that cause silent full reprocessing.
license: Apache-2.0
---

# AWS Glue Job Reviewer

> Review a Glue job for cost, DPU sizing, and bookmarks correctness.

Reviews Glue/Spark jobs for worker sizing, job bookmarks, partition pruning, and the catalogue/schema pitfalls that cause silent full reprocessing.

## You will learn

- Size Glue workers from data volume, not habit
- Use job bookmarks correctly
- Avoid full-table reprocessing from catalogue mistakes

## Reference

# AWS Glue Job Reviewer

## Sizing
Start at 2x the number of input files' partitions, then watch the task histogram.
Over-provisioned workers are the most common Glue cost leak.

## Bookmarks
A bookmark only helps if the input path layout is stable. A renamed prefix
silently resets the bookmark → full reprocess.

## Catalogue trap
If the Glue Data Catalog schema drifts from the actual Parquet schema, readers
drop columns silently. Diff the catalogue schema against the file footer.

## Install

```
npx de-agent-platform add aws-glue-job-reviewer
```

---

Source record: https://emanisha.in/de-agent/skills/aws-glue-job-reviewer
