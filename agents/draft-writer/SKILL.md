# Draft writer — DE//AGENT registry

You write publishable draft content for the DE//AGENT data-engineering registry.
A corrupted or invented draft wastes reviewer time; a good one clears
`review-draft.mjs` with zero fails on the first pass.

## Inputs

- `DRAFT`: path to one file under `data/drafts/<source>/` (a YAML list; edit the first record only).
- `KIND`: one of tutorial | guide | skill | reference | comparison, plus its brief in `agents/draft-writer/briefs/<KIND>.md`. Follow that brief exactly.

## Invoke

```text
Write draft <DRAFT-FILE> as KIND=<kind> following agents/draft-writer/SKILL.md and agents/draft-writer/briefs/<kind>.md, then clear review-draft.mjs with zero fails.
```

## Steps

1. Read the draft record, its `source_url`, and the brief. Read `docs/style-guide.md` rules 1–13.
2. Use ONLY the draft's source URL and records already in `src/data/generated/registry.json` as facts. Fetch nothing else without asking.
3. Write `body` (markdown) and `related` (registry ids only) into the draft file. Set `draft_kind` to KIND. Never touch `id`, `slug`, `verification`, `evidence`, or `curation_state`.
4. Label every executable step `Validated` (only with an engine run you actually performed via `pipelines/execute.mjs`) or `Not executed`.
5. Put everything unverified in an Unknowns section. Never invent commands, versions, test results, licenses, or compatibility.
6. Run `node pipelines/review-draft.mjs --draft <DRAFT>` and fix every fail. Repeat until zero fails. Report warns you intentionally left.

## Prohibitions

- No auto-promotion: never move the file, never run `promote.mjs --apply`, never claim a level.
- No hallucinated evidence: `by: human` entries are written by the reviewer, not you.
- Plain language per the style guide; banned words fail the gate.

## Check glossary

The gate scores 16 checks; this is what each one wants from your prose:

| Check | What to do |
|---|---|
| length-desc | description 30–280 chars, trigger-first, no aspirations |
| length-body | enough words for the kind (tutorial/guide/comparison ≥400, skill ≥200) |
| structure-headings | required section headings per the kind brief, in order |
| structure-table | comparisons need a criteria table with one row per option |
| code-fences | fenced blocks with language tags; example before abstraction |
| media-diagram | a mermaid diagram, data table, or image where the brief asks for one |
| media-images | every image carries non-empty alt text for screen readers |
| safety-destructive | no destructive commands (rm -rf /, mkfs, fork bombs), ever |
| safety-pipes | no curl-piped-to-shell unless the brief explicitly allows and labels it |
| accuracy-placeholders | no TODO, TBD, FIXME, or half-written sentences |
| accuracy-urls | every url parses and points where the sentence says it points |
| accuracy-ids | every related id exists in the registry — resolve, don't guess |
| voice-gatekeeping | no gatekeeping words: simply, just, obviously, trivial, easy, of course |
| voice-sentences | short sentences (~15 words); one new concept per paragraph |
| voice-passive | active voice: the scheduler retries the task, not the reverse |
| discoverability-words | ≥300 indexable plain words so search and embeddings can find the page |
