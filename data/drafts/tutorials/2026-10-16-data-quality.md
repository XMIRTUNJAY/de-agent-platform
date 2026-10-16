# DRAFT tutorial brief — NOT served. Verify every step against the cited source field,
# then copy into data/curated/tutorials/ as type: tutorial.
# stage: data-quality
# status: draft

proposed_title: Learn with Data Contract Author
source: skill-data-contract-author (skill)
difficulty: intermediate
alternates: agent-data-quality-reviewer, agent-schema-reviewer

what_you_need (verbatim from source):
- Prior: skill-schema-change-contract-review
- Install: amp skill add de-agent/data-contract-author

steps (verbatim, in source order — do not rephrase):
1. Owner (a team, with an on-call).
   from: skill-data-contract-author#body
2. Schema (typed, versioned).
   from: skill-data-contract-author#body
3. Semantics (what each field *means*, units, nullability).
   from: skill-data-contract-author#body
4. SLA (freshness, completeness).
   from: skill-data-contract-author#body
5. Breaking-change policy (notice period, deprecation path).
   from: skill-data-contract-author#body
6. Enforcement (which CI test fails on violation).
   from: skill-data-contract-author#body

check_yourself (verbatim from source):
- (none stated in source — leave empty, do not invent)

gatekeeping_scan: pass
