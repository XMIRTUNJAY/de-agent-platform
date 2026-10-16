# DRAFT tutorial brief — NOT served. Verify every step against the cited source field,
# then copy into data/curated/tutorials/ as type: tutorial.
# stage: orchestration
# status: draft

proposed_title: Learn with Airflow DAG Reviewer
source: skill-airflow-dag-reviewer (skill)
difficulty: intermediate
alternates: skill-backfill-planner, agent-pipeline-reviewer

what_you_need (verbatim from source):
- Prior: skill-pipeline-test-author
- Install: npx de-agent-platform add airflow-dag-reviewer

steps (verbatim, in source order — do not rephrase):
1. Every task writes to a partition keyed by the logical date, or uses MERGE.
   from: skill-airflow-dag-reviewer#body
2. `catchup` is a deliberate choice, not a default.
   from: skill-airflow-dag-reviewer#body
3. Retries have a backoff; a task that retries instantly will hammer a downstream.
   from: skill-airflow-dag-reviewer#body
4. `max_active_runs` and pool limits prevent a backfill from starving the daily run.
   from: skill-airflow-dag-reviewer#body
5. Sensors use `reschedule`, not `poke`, so they don't hold a worker slot.
   from: skill-airflow-dag-reviewer#body

check_yourself (verbatim from source):
- (none stated in source — leave empty, do not invent)

gatekeeping_scan: pass
