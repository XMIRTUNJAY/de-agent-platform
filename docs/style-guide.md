# Plain-language style guide

Every word published in this registry — whether drafted by a person or an agent —
follows these rules. Style violations are build warnings, the same as schema
violations. The audience is a **self-taught beginner**, not a senior engineer.

## Sentences

1. **Short.** Aim for ~15 words. If a sentence has a comma list and an "and",
   split it.
2. **One new concept per paragraph.** Never stack two unfamiliar ideas.
3. **Active voice.** "The scheduler retries the task" — not "the task is
   retried by the scheduler".

## Words

4. **Everyday words first.** Say "the machines doing the work" before
   "compute cluster". Say "saved copy" before "snapshot" until the term is taught.
5. **Define every acronym on first use.** "Change data capture (CDC)" — then CDC
   is fine for the rest of the page.
6. **No gatekeeping words.** Ban: *simply, just, obviously, trivial, easy,
   of course, as we all know*. (These are linted in `validate.mjs`.)
7. **Concrete nouns over abstract ones.** "the file lands in the bucket every
   hour" beats "periodic ingestion to object storage" — then name the jargon
   once: *"Engineers call this 'ingestion to object storage'."*

## Structure

8. **Example before abstraction.** Show the tiny SQL query or YAML snippet,
   *then* explain the general rule it demonstrates.
9. **Every page answers, in order:** What is this? When would I reach for it?
   What does a tiny version look like? What can go wrong?
10. **Reading level.** Roughly "smart 16-year-old". Long clauses, semicolons
    and nested parentheses are the enemy.

## Skills & resources

11. **Front-load the trigger.** The `description` says when to use it:
    "Review a dbt model for grain and incremental correctness" — not "dbt helper".
12. **Blast radius is declared, not implied.** If a resource runs code, calls
    the network, or needs credentials, the page says so in plain words.
13. **Honest difficulty.** Beginner means *no prerequisites beyond reading*. If
    the reader must already know X, it is not beginner.

## Agent-drafted content

14. Agent drafts must pass the same bar. The drafting prompt embeds rules 1–13.
15. A draft that cannot cite its source URLs in the record is rejected.
16. Reviewers edit toward this guide; when in doubt, delete the sentence.
