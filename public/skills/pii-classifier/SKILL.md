---
name: pii-classifier
description: Scans column names and sample values for PII categories, then proposes classification tags and a masking/pseudonymisation policy.
license: Apache-2.0
---

# PII Classifier

> Find PII in a dataset and propose the masking policy.

Scans column names and sample values for PII categories, then proposes classification tags and a masking/pseudonymisation policy.

## You will learn

- Classify columns into PII categories
- Choose masking vs hashing vs tokenisation
- Record a data-classification tag

## Reference

# PII Classifier

## Caution
Sampling real data to find PII is itself a privacy action. Prefer metadata-only
heuristics first; only sample with authorisation, and never persist samples.

## Categories
Direct identifiers (name, email, phone, national ID), quasi-identifiers
(postcode, DOB), sensitive attributes (health, financial), and free text
(which can contain anything).

## Policy mapping
Direct → mask or tokenise. Quasi → generalise. Free text → never expose raw in
analytics; store separately with restricted access.

## Install

```
npx de-agent-platform add pii-classifier
```

---

Source record: https://emanisha.in/de-agent/skills/pii-classifier
