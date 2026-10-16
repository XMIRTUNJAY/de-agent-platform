---
name: lineage-explainer
description: Traces column-level lineage from an asset to its upstream sources and downstream consumers, and reports the impact set for a proposed change.
license: Apache-2.0
---

# Lineage Explainer

> Answer "what breaks if I change this column?" with evidence.

Traces column-level lineage from an asset to its upstream sources and downstream consumers, and reports the impact set for a proposed change.

## You will learn

- Read the lineages of an asset from a lineage store
- Compute a downstream impact set
- Distinguish technical from business lineage

## Reference

# Lineage Explainer

## Two questions, two graphs
- **Technical lineage** — which tables/jobs depend on this column.
- **Business lineage** — which metrics/reports depend on it.

A breaking change needs both, because a CFO does not read table names.

## Impact set
Walk downstream from the changed node, stopping at published marts. Report
owner, criticality, and the earliest SLA that will break.

## Install

```
amp skill add de-agent/lineage-explainer
```

---

Source record: https://emanisha.in/de-agent/skills/lineage-explainer
