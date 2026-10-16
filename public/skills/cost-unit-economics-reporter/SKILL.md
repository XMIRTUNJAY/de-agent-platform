---
name: cost-unit-economics-reporter
description: Turns cluster/warehouse billing into unit economics (cost per 1M rows, per run, per model) so a 4x regression shows up as a number, not a surprise invoice.
license: Apache-2.0
---

# Cost Unit-Economics Reporter

> Attribute pipeline cost per row, per table, per team.

Turns cluster/warehouse billing into unit economics (cost per 1M rows, per run, per model) so a 4x regression shows up as a number, not a surprise invoice.

## You will learn

- Attribute compute cost to a pipeline run
- Define a unit metric that resists regressions
- Set an alert on cost-per-run, not on total spend

## Reference

# Cost Unit-Economics Reporter

## Unit metrics that don't lie
- $ per pipeline run (stable denominator)
- $ per 1M rows processed
- DBU/credits per model build

## Why total spend is the wrong alert
Total spend rises with growth and hides regressions. Cost-per-unit is flat when
growth is healthy and spikes the day a join starts fanning out.

## Install

```
amp skill add de-agent/cost-unit-economics-reporter
```

---

Source record: https://emanisha.in/de-agent/skills/cost-unit-economics-reporter
