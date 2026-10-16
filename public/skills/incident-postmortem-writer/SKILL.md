---
name: incident-postmortem-writer
description: Structures incident notes into a blameless postmortem: timeline, impact, detection gap, contributing factors, and action items with owners and dates.
license: Apache-2.0
---

# Incident Postmortem Writer

> Turn a pipeline incident into a blameless postmortem with real action items.

Structures incident notes into a blameless postmortem: timeline, impact, detection gap, contributing factors, and action items with owners and dates.

## You will learn

- Write a blameless timeline
- Separate trigger from contributing factors
- Convert findings into dated, owned action items

## Reference

# Incident Postmortem Writer

## Structure
1. **Impact** — who/what, in business terms, with a duration.
2. **Timeline** — timestamped, factual, no blame.
3. **Detection** — how we found out; if a human told us, that's a gap.
4. **Contributing factors** — plural; incidents are rarely single-cause.
5. **Action items** — each with an owner and a date, and a "done" definition.

## Anti-pattern
"Be more careful" is not an action item. Change the system so a careful mistake
is harmless.

## Install

```
npx de-agent-platform add incident-postmortem-writer
```

---

Source record: https://emanisha.in/de-agent/skills/incident-postmortem-writer
