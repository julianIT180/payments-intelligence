# Evaluation

This is an **initial manual validation set**, not a benchmark. Two cases were run by
hand against the live workflow on 2026-08-27 after the evidence/refusal pipeline was
hardened. They check that the pipeline (a) completes without a parser failure on thin
metadata, (b) publishes a well-evidenced brief, and (c) refuses a fabricated subject
even when some topic-adjacent sources survive filtering.

The database currently holds a small number of briefs from a short operating window,
so nothing here is statistically meaningful. It is a record of what was actually
observed, kept so the behaviour can be re-checked as the system evolves.

Both cases were run through the form trigger of
`workflows/Payments Intelligence - On-Demand Brief (5).json`. Retrieval is live, so
exact source sets and scores will vary on re-run; the pass criteria are behavioural.

---

## Case 1 — Well-evidenced brief is published

**Objective.** A real, currently-active topic with strong primary sourcing should pass
every stage and be persisted, with metadata that reflects the evidence.

**Input.** `topic: digital euro` · `timeframe: year`

**Expected outcome.**
- `Extract Metadata` and its structured-output parser complete with no format error.
- `model_refused = false`; `had_enough_evidence = true`.
- `confidence_score >= 40` and `source_count >= 3`, so the publication gate persists.
- `Persist Brief?` takes the TRUE branch; `Insert Brief` and `Insert Sources` run.
- A `briefs` row and matching `brief_sources` rows are written.

**Observed outcome.**
| Field | Value |
|---|---|
| `source_count` | 8 |
| `tier1_count` | 5 |
| `impact_score` | 78 |
| `confidence_score` | 82 |
| `model_refused` | false |
| `had_enough_evidence` | true |
| `skipped` | false |
| `Persist Brief?` branch | TRUE |
| `sources_written` | 8 |
| `was_new` | true |
| Persisted | yes — a `brief_id` was created |

**Why this test matters.** It exercises the whole path end to end: two retrieval
channels, triage, deterministic ranking, structured metadata extraction against the
explicit schema, the Sonnet analysis, and both gate conditions passing. Five of eight
sources being tier-1 (regulators / central banks) is the case the source-tiering was
built for.

**Result: PASS**

---

## Case 2 — Fabricated subject is refused despite surviving sources

**Objective.** A plausible-sounding but invented company/product must not produce a
brief, even when the retrieval stage returns enough topic-adjacent material to clear
the numeric source-count threshold.

**Input.** `topic: Veltrix Pay agentic commerce settlement network` · `timeframe: year`

`Veltrix Pay` is fabricated. It does not correspond to any real company, product or
announcement. It was invented solely for this test. The surrounding terms (agentic
commerce, settlement network) are real and current, which is the point: the search
returns genuine payments articles about that space, none of which are about the
fabricated entity.

**Expected outcome.**
- `Extract Metadata` completes with no parser error, returning low confidence and
  mostly empty descriptive metadata.
- `Analyse and Draft Brief` returns a leading `INSUFFICIENT EVIDENCE`.
- `model_refused = true`; the publication gate skips.
- `Persist Brief?` takes the FALSE branch; `Insert Brief` and `Insert Sources` never
  execute; no row is written.

**Observed outcome.**
| Field | Value |
|---|---|
| `source_count` | 3 |
| `tier1_count` | 0 |
| `tier2_count` | 1 |
| `triageDroppedCount` | 8 |
| `had_enough_evidence` | true |
| `Analyse and Draft Brief` output | leading `INSUFFICIENT EVIDENCE` |
| `model_refused` | true |
| `Prepare DB Record` `skipped` | true |
| `skip_reason` | `model returned INSUFFICIENT EVIDENCE` |
| `Persist Brief?` branch | FALSE |
| `Insert Brief` executed | no |
| `Insert Sources` executed | no |
| `sources_written` | 0 |
| Persisted | no |

**Why this test matters — and why it is stronger than a zero-source refusal.**
A refusal on a topic that returns *no* sources is trivial: with nothing to work from,
any system declines. This case is harder. Eight candidate sources were dropped at
triage, but **three plausible, topic-adjacent sources survived** — enough to satisfy
`had_enough_evidence` and the `source_count >= 3` floor. The model was handed real
articles about agentic commerce and settlement infrastructure and still recognised
that none of them substantiate the specific fabricated company or event, and returned
`INSUFFICIENT EVIDENCE` rather than assembling a plausible-looking brief around
adjacent material. The four-condition publication gate then confirmed the skip and
kept it out of the database.

This is the failure mode that distinguishes a grounded system from a summariser: the
temptation is to write *something* because sources exist. Here the pipeline had that
option and declined it.

**Result: PASS**

---

## Coverage and limits of this set

- Two cases, run once each, on one day. Re-running will pull different sources.
- Case 1 is a "should publish" check; Case 2 is a "should refuse" check. Not covered
  yet: a genuinely thin real topic that should skip on `confidence_score < 40` rather
  than on a model refusal; a duplicate-topic run exercising the `content_hash`
  constraint; weekly-report clustering behaviour.
- Turning this into a repeatable harness (fixed topic list, expected behaviour,
  scripted assertions against the execution output) is a planned next step.
