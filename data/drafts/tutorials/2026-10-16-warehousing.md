# DRAFT tutorial brief — NOT served. Verify every step against the cited source field,
# then copy into data/curated/tutorials/ as type: tutorial.
# stage: warehousing
# status: draft

proposed_title: Learn with dbt Test Writer
source: skill-dbt-test-writer (skill)
difficulty: beginner
alternates: skill-dbt-model-review, runbook-warehouse-query-slow

what_you_need (verbatim from source):
- Prior: skill-dbt-model-review
- Install: amp skill add de-agent/dbt-test-writer

steps (verbatim, in source order — do not rephrase):
1. `unique` + `not_null` on the grain key — the model is meaningless without it.
   from: skill-dbt-test-writer#body
2. `relationships` on every foreign key — catches broken joins upstream.
   from: skill-dbt-test-writer#body
3. `accepted_values` on low-cardinality enums — catches upstream renames.
   from: skill-dbt-test-writer#body
4. `freshness` on sources — catches a stalled extractor, the #1 silent outage.
   from: skill-dbt-test-writer#body

check_yourself (verbatim from source):
- (none stated in source — leave empty, do not invent)

gatekeeping_scan: pass
