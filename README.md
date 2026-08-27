# Payments Intelligence

An automated research pipeline that turns fragmented payments-industry news into
evidence-scored analyst briefs — and refuses to write one when the evidence is not
good enough.

**Live site:** https://payments-intelligence.vercel.app/
**Architecture:** [`docs/architecture.md`](docs/architecture.md) ·
**Workflows:** [`workflows/`](workflows/) ·
**Evaluation:** [`docs/evaluation.md`](docs/evaluation.md)

At a glance:

- **A running system, not a prompt.** Three n8n workflows on a schedule: an on-demand
  brief pipeline, a monitor that runs it over a watchlist every two days, and a weekly
  report that clusters and emails the results. Retry logic, cost caps, unattended.
- **Source-grounded.** Every factual claim in a brief carries a `[S#]` marker tied to a
  URL that was actually fetched. The model may use only the retrieved evidence.
- **Rules and models do different jobs.** Deterministic checks handle format, domain
  tiering and de-duplication; language models handle topical relevance and analysis.
  Cheap checks run first.
- **Provenance is stored.** Each source keeps its tier (regulator → company → trade
  press → other), its origin (search vs RSS), and whether full article text was retrieved.
- **Two refusal layers.** The analysis model returns `INSUFFICIENT EVIDENCE` rather than
  fill gaps; a separate publication gate then stores a brief only when it is not a
  refusal, has ≥ 3 ranked sources and clears a confidence threshold. Skipped runs never
  touch the database.
- **Validated by hand.** Two live cases are recorded in
  [`docs/evaluation.md`](docs/evaluation.md) — one well-evidenced topic that publishes,
  one fabricated company that is refused *despite* three topic-adjacent sources
  surviving the filters.

---

## Why this exists

Anyone tracking payments — regulators, card schemes, PSPs, the digital euro file — reads
the same twenty sources every morning and throws away most of what they find. The tedious
part is not summarising an article. It is deciding, before reading, which of thirty search
results is a regulatory primary source, which is a vendor blog wearing a news headline, and
which is a job posting that happens to mention Stripe.

Most "AI news summariser" projects skip that question entirely: they retrieve, they
summarise, and they present the result with the same confident tone regardless of whether
it rests on a European Central Bank press release or on a content-marketing page. The
output looks identical either way, which makes it useless for anything that matters.

This system is built around the opposite premise: **the retrieval and filtering stage is
the product, and the model is only allowed to write once that stage has produced something
worth writing about.**

## What it produces

Each brief is a structured record, not a blob of text:

- a headline and a two-sentence summary
- an **impact score** (0–100) and a **confidence score** (0–100), scored separately —
  a high-impact story on thin evidence stays visibly thin
- a category and event type from a fixed vocabulary, so scores stay comparable across runs
- extracted entities: primary companies, affected segments, geography, key dates
- **`what_to_monitor`** and **`evidence_gaps`** — what the brief does *not* establish
- a full source list, each with tier, origin, and a flag for headline-only retrieval

A weekly report synthesises seven days of briefs: it clusters duplicate stories, excludes
briefs that describe no development, ranks what remains, and publishes a **coverage note**
stating what it merged and what it dropped.

## How it works

```
                Tavily Search API          RSS (ECB press, ECB blog)
                        |                            |
                Normalize + tier            Parse -> topic filter
                        |                            |
                        |                    Fetch article pages
                        |                            |
                        |                    Extract prose from HTML
                        \____________________________/
                                     |
                        Triage Relevance   (Haiku 4.5, score 0-100)
                                     |
                        Clean and Rank     (rules: boilerplate, dedup, tiering)
                                     |
                        Extract Metadata   (Haiku 4.5, structured output)
                                     |
                        Analyse and Draft  (Sonnet 5)
                                     |
                        Quality gate -> Postgres (or discarded)
```

Three n8n workflows share one Postgres database. The on-demand brief workflow is also the
sub-workflow the scheduler calls, so the analysis logic exists in exactly one place. Full
diagrams — including the data model and the frontend access layers — are in
[`docs/architecture.md`](docs/architecture.md).

## The part that was actually hard: evidence quality

### Rules judge format, models judge substance

An early version tried to filter by URL pattern — discard anything under `/news`, on the
theory that those are index pages. It matched legitimate article URLs and cut the source
count from 9 to 2. URL structure says nothing about relevance.

The reverse failure was just as instructive. A marketing page from a corporate-services
firm passed every structural check: well-formed prose, correct sentence density, no
boilerplate phrases, a plausible headline. It was structurally perfect and topically
irrelevant.

So the pipeline splits the work by what each tool is actually good at:

| Stage | Mechanism | Question it answers |
|---|---|---|
| Normalize | rules | Is this domain permitted? What tier? |
| Extract article text | rules | Is this prose or a navigation menu? |
| **Triage relevance** | **Haiku 4.5** | **Is this about the topic at all?** |
| Clean and rank | rules | Boilerplate, near-duplicates, ranking |
| Extract metadata | Haiku 4.5 | Which companies, which category? |
| Analyse and draft | Sonnet 5 | What does this mean? |

Cheap deterministic checks run first; the model only scores what survives them. Triage
runs as a single call over the whole candidate set rather than once per source.

### Four source tiers

| Tier | What | Examples |
|---|---|---|
| 1 | Regulators and central banks | ECB, EBA, BIS, Bundesbank, Federal Reserve, SEC, ESMA |
| 2 | Company primary sources | Adyen, Stripe, Visa, Mastercard, PayPal, Klarna, Worldline |
| 3 | Established trade and business press | Reuters, FT, Bloomberg, Finextra, PaymentsDive, American Banker |
| 4 | Everything else | — |

Tier feeds the ranking, and ranking deliberately overrides the search engine's own
relevance score: a tier-1 source that the engine ranked eighth outranks a tier-4 source it
ranked first.

### A hard block that does not trust the search API

An early run surfaced an `instagram.com` result whose snippet contained user comments with
antisemitic coding. The search API's `exclude_domains` parameter had not caught it.

The fix has two layers: the exclusion list was extended **and** a `NEVER_USE` list of
fifteen user-generated-content domains is enforced in the pipeline's own code, after
results come back. Search-engine parameters are requests, not guarantees. Aggregator
snippets carry comment sections with them.

### Deduplication that survives a non-deterministic writer

The dedup hash is computed over **topic + sorted canonical source URLs**, never over the
brief text — the model's prose differs slightly on every run, so a text hash would never
collide. The sort is required because search engines do not return results in a stable
order.

`on conflict (content_hash) do nothing` turned out to be wrong for a different reason: on a
duplicate it returns no row, so the follow-up insert of source records wrote `null` into a
`not null` column. The working form is `do update set topic = excluded.topic` with
`returning id, (xmax = 0) as was_inserted` — which both guarantees an id and reports
whether the row was new.

### The system is allowed to say no

Two independent refusals sit between retrieval and the database.

**Model-level.** When fewer than three sources survive filtering, or the survivors do
not address the topic, the analysis model returns a single line —
`INSUFFICIENT EVIDENCE — …` — instead of a brief. `Assemble Brief` detects that
leading marker and sets a strict boolean, `model_refused`.

**Publication policy.** A brief is written to Postgres only when all four hold:
`model_refused` is false, the pipeline's `had_enough_evidence` flag is set,
`source_count >= 3`, and the model-assigned `confidence_score >= 40`. Anything else is
marked skipped and routed straight to the run summary — `Insert Brief` and
`Insert Sources` never run for it, so no partial row is written.

An earlier calibration briefly dropped the source-count floor, on the argument that the
confidence score already accounts for it. It was reinstated: a conservative publication
policy is worth more here than one extra stored brief.

The behaviour was tested against a topic that does not exist: *"Zyloric Payments
Consortium"*. The retrieval stage returned eight plausible payments articles, and the model
declined to use them:

> *"None can be repurposed to support claims about the requested topic."*

`INSUFFICIENT EVIDENCE`. That is the intended behaviour, and one of the most revealing
tests for a retrieval-augmented system.

### Validation runs

Two cases were run by hand against the live workflow on 2026-08-27. Full detail in
[`docs/evaluation.md`](docs/evaluation.md); this is an initial manual set, not a
benchmark.

| Input | Sources | Result |
|---|---|---|
| `digital euro` (real, active) | 8 (5 tier-1) | Published — impact 78, confidence 82 |
| `Veltrix Pay agentic commerce settlement network` (**fabricated**) | 3 survived filtering, 8 dropped at triage | Refused — `model_refused`, skipped, no row written |

The second case is the harder one: the fabricated company still drew three plausible,
topic-adjacent sources — enough to pass the source-count floor — and the model still
declined to build a brief around adjacent material.

## Design decisions

| Decision | Alternative considered | Why | Trade-off accepted |
|---|---|---|---|
| Haiku for triage and extraction, Sonnet for analysis | Sonnet throughout | Triage is classification, not reasoning; roughly half the cost per call | Haiku extracts too generously — it pulled companies from off-topic sources that Sonnet ignored. Mitigated by a fixed output vocabulary. |
| Structured output parser with a closed vocabulary | Free-text categories | Without it the model invents new category names on every run, and scores stop being comparable | Genuinely novel event types get forced into an existing bucket |
| Supabase Postgres | Google Sheets | Sheets needs a Google Cloud project and OAuth (~20 steps); real SQL enables a `unique` constraint for dedup; the frontend needs Postgres anyway | Another hosted dependency |
| Existing workflow gets a second trigger | Rebuild the pipeline inside the scheduler | The analysis logic lives in exactly one place | n8n requires the sub-workflow to be published before the scheduler can call it |
| `On Error: Continue` on the sub-workflow node | Stop on error | Five topics are 15 API calls; a failure on topic 3 must not suppress 4 and 5 | Partial runs need to be visible in the run summary |
| Search timeframe `month`, not `week` | `week` | On single companies a one-week window returned one source and produced briefs about job postings | More duplicates — absorbed by the dedup hash |
| Full-text retrieval for RSS items | Headlines only | ECB feeds ship headlines only; confidence sat at 48 | An extra HTTP request per item |
| Falls back to headline-only below 200 chars | Use whatever was extracted | Honest degradation beats fabricated context | Some briefs carry visibly weaker sources — which is the point |

### Full-text extraction, measured

ECB feeds provide headlines only, which capped confidence at 48. Adding per-link retrieval
plus extraction — `mainRegion()` isolates `article`/`main`/`body` (ECB pages carry ~60 KB
of navigation), `keepProse()` keeps only lines over 60 characters with sentence punctuation
and under 60 % uppercase words — moved confidence from **48 to 72** and impact from **72 to
78**. Briefs began citing concrete figures (92 % cash acceptance; mobile 36 % → 68 %).

## What this system cannot do

- **No story-level deduplication.** The hash deduplicates on source sets. Two runs that
  return different articles about the same news produce two database rows. The weekly
  synthesis step catches this in the output; the database still contains near-duplicates.
- **Coverage is bounded by the source list.** Two RSS feeds and one search API. Anything
  outside them is invisible.
- **Scores are model-generated, not calibrated against outcomes.** Impact and confidence
  are internally consistent and useful for ranking. They are not validated predictions.
- **English-language sources dominate.** The tier lists are Europe- and US-weighted.
- **No human review.** Nothing between the model and the published page.
- **Small evidence base per brief.** The gate requires two sources, not ten.

The live site states the same limitations on its `/about` page.

## Cost

| Item | Cost |
|---|---|
| Anthropic API | ~$4 / month at the current cadence |
| Tavily search | < 60 of 1,500 free credits used to date |
| Supabase, Vercel, Resend | free tier |

Two-thirds of the pipeline's LLM calls run on Haiku. A monthly cap and a warning threshold
are set on the Anthropic account, and auto-reload is deliberately off — a runaway loop
should fail, not bill.

## Repository layout

```
db/          schema and metric queries
docs/        architecture diagrams, development log
sample-outputs/  placeholder; samples will be regenerated from the live workflow
screenshots/  one screenshot of the on-demand brief workflow
web/         Next.js frontend (App Router, Tailwind), deployed on Vercel
workflows/   the three n8n workflows as exported JSON
```

## Running it yourself

**Prerequisites:** Docker, an Anthropic API key, a Tavily API key, a Supabase project.

1. Create the schema: run [`db/schema.sql`](db/schema.sql) in the Supabase SQL editor.
2. Start n8n (`docker run` with `--restart unless-stopped`) and import the three files
   from [`workflows/`](workflows/).
3. Configure credentials in n8n: Anthropic, Tavily (HTTP header auth), Postgres, Resend.
   For the Postgres connection use the **session pooler**, port 5432, SSL required. The
   pooler presents a self-signed intermediate certificate, so *Ignore SSL Issues* must be
   enabled — TLS stays active, only chain verification is skipped. Set max connections to 5.
4. Publish the on-demand workflow; the scheduler cannot call an unpublished sub-workflow.
5. Frontend: `cd web && npm install`, then set `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (use the **publishable** key, not `service_role`) in
   `.env.local`, and `npm run dev`.

Reading from the browser requires **both** a `GRANT SELECT` to the anonymous role and a
row-level-security policy. A policy alone yields `permission denied for table briefs`.

## Roadmap

- Story-level deduplication (clustering across runs, not just source sets)
- Live metrics page fed from the database
- Additional primary feeds: EBA, European Commission, company newsrooms
- Watchlist moved from code into the database
- Authentication on the public form trigger before the n8n instance is exposed

---

Built by [Julian Schnetzer](https://github.com/julianIT180). Briefs are generated
automatically and are not investment advice.
