# evaluation/ — initial reproducible validation harness

This is an **initial, manual validation set**, not a benchmark and not a statistical
evaluation. It records the behaviour observed on 2026-08-27 (see
[`../docs/evaluation.md`](../docs/evaluation.md)) in a form that can be re-checked as
the pipeline changes.

The harness **does not call n8n**. You run a case in n8n by hand, export the relevant
result fields into a fixture file, and the script checks them against the case's
expectations.

## Layout

```
evaluation/
  cases/       <id>.json           case definition: input, objective, expected assertions
  fixtures/    <id>.result.json    recorded result of one run (you fill these in)
  validate.mjs                     compares fixtures to cases, prints PASS/FAIL/INCOMPLETE
```

## Running

```bash
node evaluation/validate.mjs            # lenient: unfilled fields report INCOMPLETE, do not fail
node evaluation/validate.mjs --strict   # INCOMPLETE also fails — use once fixtures are complete
```

Exit code is non-zero if any assertion FAILs (or, with `--strict`, if any is
INCOMPLETE). CI runs the lenient form.

## The two cases

| id | kind | input | expectation |
|---|---|---|---|
| `case-01-digital-euro` | positive | `digital euro` / `year` | published: not refused, ≥3 sources, confidence ≥ 40, row written |
| `case-02-veltrix-pay` | adversarial | `Veltrix Pay agentic commerce settlement network` / `year` (**fabricated**) | refused: 3 sources survived triage but `model_refused`, skipped, no row |

## Fixture schema

A fixture is a flat JSON object. Fields the current cases assert:

| field | source in n8n | type |
|---|---|---|
| `extract_metadata_ok` | did `Extract Metadata` + `Structured Output Parser` complete without a format error | bool |
| `source_count` | `Clean and Rank Sources` output `.sourceCount` | number |
| `tier1_count`, `tier2_count` | `Clean and Rank Sources` output | number |
| `triage_dropped_count` | `Clean and Rank Sources` output `.triageDroppedCount` | number |
| `had_enough_evidence` | `Assemble Brief` output `.had_enough_evidence` | bool |
| `model_refused` | `Assemble Brief` output `.model_refused` | bool |
| `analyse_and_draft_first_line` | first line of `Analyse and Draft Brief` output `.text` | string |
| `extract_metadata.confidence_score` / `.impact_score` / `.category` | `Extract Metadata` output (`.output` object) | number / string |
| `prepare_db_record.skipped` / `.skip_reason` | `Prepare DB Record` output | bool / string |
| `persist_brief_branch` | which output of `Persist Brief?` fired: `"true"` or `"false"` | string |
| `insert_brief_executed`, `insert_sources_executed` | did those nodes run this execution | bool |
| `return_result.was_new` / `.brief_id` / `.sources_written` / `.skipped` | `Return Result` output | mixed |
| `db_rows_for_topic` | `select count(*) from briefs where lower(topic) like '<topic>%'` | number |

Add `"_incomplete": ["field.path", ...]` for any field you could not capture; the
harness reports those as INCOMPLETE rather than PASS/FAIL.

## Minimum JSON to export later

The `case-02-veltrix-pay` fixture is complete. For `case-01-digital-euro`, capture
and fill:

- `extract_metadata.category` — from the persisted `briefs` row or the `Extract
  Metadata` node output
- `return_result.brief_id` — from the run's `Return Result` output
- `db_rows_for_topic` — `select count(*) from briefs where lower(topic) like 'digital euro%';`

Then `node evaluation/validate.mjs --strict` should be all PASS.
