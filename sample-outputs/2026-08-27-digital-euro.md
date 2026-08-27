<!--
  Sample output — successful brief
  Source: live run of the On-Demand Brief workflow, 2026-08-27.

  The metadata below is verified (reported from the execution / persisted row).
  The brief body and source list are NOT yet included, to avoid reconstructing
  prose from a rendered page. See the TODO block.
-->

# Sample: digital euro (published brief)

**Run input:** `topic: digital euro` · `timeframe: year`
**Outcome:** persisted (`skipped: false`, `was_new: true`)

| Metric | Value |
|---|---|
| source_count | 8 |
| tier1_count | 5 |
| tier2_count | — (to fill from run) |
| impact_score | 78 |
| confidence_score | 82 |
| model_refused | false |
| had_enough_evidence | true |
| sources_written | 8 |

---

## TODO — verbatim artifact to add

Paste, unedited, from **one** of these authoritative sources:

- Supabase → `select brief_markdown from briefs where id = '<brief_id>';`
  (the `<brief_id>` from the run's `Return Result` output), **or**
- the n8n execution → `Assemble Brief` node output → `brief_markdown`.

Add it verbatim below this line as fenced text, followed by the source list from
`brief_sources` (or the `## Sources` section already inside `brief_markdown`).
Also fill `tier2_count` above. Do not edit the prose.
