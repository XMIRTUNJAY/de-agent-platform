---
name: kafka-consumer-lag-triage
description: Triages consumer lag from the consumer-group offsets: distinguishing a slow consumer, a partitioned hot key, a rebalance storm, and a poison-pill retry loop.
license: Apache-2.0
---

# Kafka Consumer Lag Triage

> Decide whether lag is a capacity problem, a poison message, or skew.

Triages consumer lag from the consumer-group offsets: distinguishing a slow consumer, a partitioned hot key, a rebalance storm, and a poison-pill retry loop.

## You will learn

- Read per-partition lag to separate skew from throughput
- Detect a rebalance loop from consumer-group state
- Find the poison message from retry counts

## Reference

# Kafka Consumer Lag Triage

## Three questions
1. Is lag rising, flat, or falling? Flat at a high number is fine; rising is not.
2. Is lag even across partitions? Skew means a hot key, not capacity.
3. Is the consumer group stable? Frequent `PreparingRebalance` is the real bug.

## Signatures
- Lag on one partition only → key skew; re-key or increase partitions.
- All partitions rising, CPU low → downstream (DB/API) is the bottleneck.
- Lag resets to zero then climbs → rebalance loop; check `session.timeout.ms`.
- One offset stuck, others advance → poison message in a retry loop.

## Never
Do not "fix" lag by resetting offsets. That is data loss wearing a hat.

## Install

```
amp skill add de-agent/kafka-consumer-lag-triage
```

---

Source record: https://emanisha.in/de-agent/skills/kafka-consumer-lag-triage
