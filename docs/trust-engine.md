# Trust Engine — architecture and roadmap

The trust engine is DE//AGENT's differentiator: an evidence-based, two-layer
rating system for agent artifacts (skills, MCP servers, hooks, agents) in the
data-engineering vertical. Built from the product notebook's contract:

> **Check** = written definition + evidence it looks for + risk level +
> redemption advice.
> **Pipeline**: Discover → Fingerprint → Parse/IR → Detect (static, config,
> semantic, provenance) → Contextualize.
> **Stack**: Access (web + CLI) · Trust Engine (static scanner, semantic
> scanner, sandbox runner) · Registry (scores, findings, versions) · Insights.

## Layer 1 — Static rule engine (shipped)

- Catalog: `data/curated/trust-rules.yaml` — 30 rules, 11 families
  (secrets, remote-execution, hidden-instruction, sql-destructive, data-egress,
  unix-destructive, platform-destructive, git-destructive, overbroad-permission,
  skill-hygiene, rerun-safety). One rule = one failure mode, with the notebook's
  four fields.
- Engine: `pipelines/lib/trust-rules.mjs` — pure, offline, line-based. Secret
  values are redacted from snippets. Documentation context is marked
  `likelyExample` (list-intro carry-over, bold-glossary, docs markers) and
  never counts toward flags; code fences still count (real commands live there).
- Runner: `pipelines/scan-trust.mjs` — scans vendored artifact trees
  (`public/<type>s/<slug>/`), curated prose, and (with `--remote`) the top
  repos' live GitHub trees through the full engine. Output:
  `src/data/generated/trust-findings.json`.
- UI: "Static trust scan" card on every detail page; `/docs/trust-rules`
  publishes the full catalog — the transparency layer competitors lack.
- Calibration invariant: findings are evidence for review, never an automatic
  verdict. `security_flags` still comes only from curated `security:` booleans.

## Layer 2 — Semantic review (shipped, offline by design)

No live LLM API. The judge is an offline workbench:

1. `pipelines/semantic-review.mjs` emits a packet of unjudged actionable
   findings (evidence + upstream repo pointers) to
   `data/enrichment/semantic-review/packet-<date>.md`.
2. Review happens in chat (agent-judge) or by a human curator.
3. Conclusions are recorded in `data/curated/semantic-verdicts.yaml`:
   - **explicit verdicts** for contextual calls (e.g. the `curl | bash` in
     kafka's publisher CI — tooling, not runtime),
   - **verdict rules** for mechanical classes (package metadata URLs, PyPI/npm
     indexes, license headers, self-canonical links, docs links, local Docker
     hosts) — deterministic, published, reviewable.
4. Merge policy: `benign-in-context` stays visible but never flags;
   `confirmed-risk` counts as scanned; `escalated` counts as critical.
   Explicit verdicts win over rules.

Every verdict is a published, diffable claim that can be re-verified against
the cited file upstream. This keeps builds deterministic and offline while
still capturing judgment — and the verdicts file itself is training material
for a future batch-judge, if one is ever wanted.

## Layer 3 — Sandbox runner (planned)

`exec-policy.mjs` already gates execution (curator-approved manifests, network
off, workdir-jailed, no shell, pinned images, read-only mounts). Next:
container-based dynamic verification of install manifests → evidence for the
`tested` verification level. Run under the existing policy; capture exit codes,
network attempts (blocked), and output — attach as `verification evidence`.

## Discovery (50+ sources)

`data/curated/sources.yaml` currently holds 57 sources (RSS/Atom + GitHub
search/org kinds) feeding FETCH → EXTRACT → CLASSIFY → DRAFT with batch PRs,
seen-dedup, source health, and dead-lettering. Expansion plan, in order:

1. **GitHub topic search widening** — dbt, airflow, data-quality, iceberg,
   duckdb, lakehouse, mcp tools (kinds already supported; no new plumbing).
2. **Registry crawls** — skills.sh leaderboard + MCP registries (official
   registry JSON) as new `kind:` entries; parse + classify like feeds.
3. **GitLab source kind** — same shape as github-org via GitLab API.
4. **Awesome-list mining** — parse awesome-* markdown link tables.
5. **Fingerprinting** — normalize (owner/repo, package name) so the same
   artifact arriving from two sources deduplicates into one record.

## Insights (planned)

Telemetry hooks (usage, blocks, adoption, safety, cost) stay behind the
existing bounded in-memory outbound log until a real backend exists — nothing
fabricated on the site.

## UI/UX cues taken from competitors

- Smithery/Glama: verification + risk chips with explanations (done), catalog
  APIs (planned — expose `/api` or JSON endpoints for agent discovery).
- skills.sh: public audits page (our `/docs/trust-rules` + verdict history);
  install-first framing (copy-install cards, done).
- roadmap.sh: roadmap-as-SEO wedge (done — phase stepper + gates).
