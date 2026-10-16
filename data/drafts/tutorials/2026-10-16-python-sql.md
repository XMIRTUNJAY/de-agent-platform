# DRAFT tutorial brief — NOT served. Curator: verify every step against
# the cited source field, then copy into data/curated/tutorials/ as type: tutorial.
# stage: python-sql
# status: draft

proposed_title: Learn with SQL Review
source: skill-sql-review (skill)
difficulty: beginner
alternates: agent-sql-reviewer, skill-sql-query-plan

what_you_need (verbatim from source):
- Install: amp skill add de-agent/sql-review

steps (verbatim, in source order — do not rephrase):
1. Every join states its cardinality (1:1, N:1, N:N) and justifies it.
   from: skill-sql-review#body
2. `NOT IN (subquery)` is banned where the subquery can return NULL — use `NOT EXISTS`.
   from: skill-sql-review#body
3. Comparisons across types must be explicit casts, not implicit.
   from: skill-sql-review#body
4. `ORDER BY` without `LIMIT` in a view is meaningless — drop it.
   from: skill-sql-review#body
5. `SELECT *` in a persisted model freezes an unstable schema.
   from: skill-sql-review#body

check_yourself (verbatim from source):
- (none stated in source — leave empty, do not invent)

gatekeeping_scan: pass
