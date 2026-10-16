---
name: data-contract-author
description: Drafts a data contract (schema, semantics, freshness SLA, ownership, breaking- change policy) and the tests that enforce it in CI.
license: Apache-2.0
---

# Data Contract Author

> Turn a vague producer/consumer agreement into an enforceable contract.

Drafts a data contract (schema, semantics, freshness SLA, ownership, breaking- change policy) and the tests that enforce it in CI.

## You will learn

- Specify a freshness and completeness SLA
- Encode a contract as executable tests
- Define a breaking-change policy consumers can rely on

## Reference

# Data Contract Author

## A contract has six parts
1. Owner (a team, with an on-call).
2. Schema (typed, versioned).
3. Semantics (what each field *means*, units, nullability).
4. SLA (freshness, completeness).
5. Breaking-change policy (notice period, deprecation path).
6. Enforcement (which CI test fails on violation).

## Rule
A contract with no enforcement is documentation. Documentation is not a contract.

## Install

```
amp skill add de-agent/data-contract-author
```

---

Source record: https://emanisha.in/de-agent/skills/data-contract-author
