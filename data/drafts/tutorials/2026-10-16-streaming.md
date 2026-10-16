# DRAFT tutorial brief — NOT served. Verify every step against the cited source field,
# then copy into data/curated/tutorials/ as type: tutorial.
# stage: streaming
# status: draft

proposed_title: Learn with Kafka Consumer Lag Triage
source: skill-kafka-lag-triage (skill)
difficulty: advanced
alternates: agent-kafka-troubleshooter, runbook-cdc-stopped

what_you_need (verbatim from source):
- Prior: skill-kafka-topic-design
- Install: npx de-agent-platform add kafka-consumer-lag-triage

steps (verbatim, in source order — do not rephrase):
1. Is lag rising, flat, or falling? Flat at a high number is fine; rising is not.
   from: skill-kafka-lag-triage#body
2. Is lag even across partitions? Skew means a hot key, not capacity.
   from: skill-kafka-lag-triage#body
3. Is the consumer group stable? Frequent `PreparingRebalance` is the real bug.
   from: skill-kafka-lag-triage#body

check_yourself (verbatim from source):
- (none stated in source — leave empty, do not invent)

gatekeeping_scan: pass
