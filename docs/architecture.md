# Architecture

Three n8n workflows write into one Postgres database. The frontend reads from the same
database and never writes. No workflow calls another over HTTP — the scheduler embeds the
brief workflow as an n8n sub-workflow, so the analysis logic exists in exactly one place.

## System overview

```mermaid
flowchart LR
    subgraph ext["External sources"]
        TAV["Tavily Search API"]
        RSS["RSS feeds<br/>ECB press · ECB blog"]
        WEB["Article pages<br/>(HTTP)"]
    end

    subgraph n8n["n8n (self-hosted, Docker)"]
        W1["<b>Workflow 1</b><br/>On-Demand Brief<br/><i>sub-workflow</i>"]
        W2["<b>Workflow 2</b><br/>Daily Monitor<br/><i>every 2 days, 08:00</i>"]
        W3["<b>Workflow 3</b><br/>Weekly Report<br/><i>Mondays, 08:00</i>"]
    end

    subgraph ai["Anthropic API"]
        HAIKU["Haiku 4.5<br/>triage · extraction"]
        SONNET["Sonnet 5 — analysis<br/>Sonnet 4.6 — synthesis"]
    end

    DB[("Supabase Postgres · eu-central<br/><br/>briefs · brief_sources · weekly_reports")]

    subgraph out["Output"]
        WEBSITE["Next.js on Vercel<br/>payments-intelligence.vercel.app"]
        MAIL["Resend<br/>weekly report by email"]
    end

    FORM(["Form trigger<br/>(manual)"])

    TAV --> W1
    RSS --> W1
    WEB --> W1
    FORM --> W1
    W2 -->|"5 topics, one call each"| W1
    W1 <--> HAIKU
    W1 <--> SONNET
    W1 -->|"insert"| DB
    DB -->|"select, last 7 days"| W3
    W3 <--> SONNET
    W3 -->|"insert"| DB
    W3 --> MAIL
    DB -->|"select · publishable key + RLS"| WEBSITE

    classDef wf fill:#1e3a5f,stroke:#4a90d9,color:#fff
    classDef store fill:#3d2b1f,stroke:#c17f3f,color:#fff
    classDef model fill:#2d1e3d,stroke:#9b6bc7,color:#fff
    class W1,W2,W3 wf
    class DB store
    class HAIKU,SONNET model
```

## Models in use

Exact identifiers as configured in the workflow nodes today. Model choice follows
task difficulty and is not changed without a deliberate test.

| Node | Workflow | Model | max tokens | temperature |
|---|---|---|---|---|
| Triage Relevance | On-Demand Brief | `claude-haiku-4-5-20251001` | 1000 | 0 |
| Extract Metadata | On-Demand Brief | `claude-haiku-4-5-20251001` | 1500 | 0 |
| Analyse and Draft Brief | On-Demand Brief | `claude-sonnet-5` | 4000 | 0.2 |
| Synthesise Report | Weekly Report | `claude-sonnet-4-6` | 4000 | 0.3 |

The weekly synthesis still runs on Sonnet 4.6 while the brief pipeline is on
Sonnet 5. Aligning them is a pending, deliberate change — see `docs/progress.txt`.

## Workflow 1 — the brief pipeline

Two retrieval branches run in parallel and are merged, after which the sources pass through
a chain of filters ordered from *cheap and deterministic* to *expensive and model-based*.
Format and duplicate checks cost nothing and run first; the language model only scores what
survives them.

```mermaid
flowchart TD
    TRIG(["On form submission<br/><i>or</i><br/>Called by Monitor"]) --> BSQ["Build Search Query"]

    BSQ --> TAVILY["Tavily Search<br/><i>search_depth basic · max_results 8</i>"]
    BSQ --> FEEDS["Feed List"]

    TAVILY --> NORMT["Normalize Tavily"]

    FEEDS --> FETCH["Fetch Feeds<br/><i>response format: Text</i>"]
    FETCH --> PARSE["Parse XML"]
    PARSE --> NORMF["Normalize Feed Items"]
    NORMF --> FETCHA["Fetch Article Pages"]
    FETCHA --> EXTRACT["Extract Article Text<br/><i>mainRegion + keepProse</i>"]

    NORMT --> COMBINE["Combine Sources<br/><i>merge mode: append</i>"]
    EXTRACT --> COMBINE

    COMBINE --> TRIAGE["Triage Relevance<br/><b>Haiku 4.5</b> · score 0-100<br/><i>threshold 25 · one call per run</i>"]
    TRIAGE --> CLEAN["Clean and Rank Sources<br/><i>never-use list · tiering · dedup · boilerplate</i>"]
    CLEAN --> META["Extract Metadata<br/><b>Haiku 4.5</b> + structured output parser<br/><i>closed vocabulary</i>"]
    META --> DRAFT["Analyse and Draft Brief<br/><b>Sonnet 5</b> · max_tokens 4000"]
    DRAFT --> ASM["Assemble Brief"]
    ASM --> PREP["Prepare DB Record<br/><i>content hash + quality gate</i>"]

    PREP --> GATE{"confidence >= 40<br/>sources >= 2"}
    GATE -->|"below threshold"| DROP(["discarded"])
    GATE -->|"pass"| INS["Insert Brief<br/><i>on conflict do update</i><br/><i>returning id, (xmax = 0)</i>"]
    INS --> INSS["Insert Sources"]
    INSS --> RET(["Return Result"])

    classDef model fill:#2d1e3d,stroke:#9b6bc7,color:#fff
    classDef gate fill:#3d2b1f,stroke:#c17f3f,color:#fff
    classDef drop fill:#3d1f1f,stroke:#c74a4a,color:#fff
    class TRIAGE,META,DRAFT model
    class GATE gate
    class DROP drop
```

### Why this order

| Stage | Mechanism | What it checks |
|---|---|---|
| Normalize Tavily / Feed Items | rules | shape, origin tagging, topic keywords for RSS |
| Extract Article Text | rules | prose vs. navigation |
| Triage Relevance | Haiku | **topical relevance** — rules cannot do this |
| Clean and Rank Sources | rules | never-use domains, tiers, canonical-URL dedup, near-duplicate text, boilerplate |
| Extract Metadata | Haiku | companies, category, event type |
| Analyse and Draft Brief | Sonnet | meaning, thesis, framing |

Rules recognise **format**; models recognise **substance**. An intermediate attempt to
infer relevance from URL patterns (discard anything under `/news`) matched legitimate
article URLs and cut the source count from 9 to 2.

### Inside "Clean and Rank Sources"

Deterministic, in this order:

1. Apply triage scores; drop anything below 25. On a triage failure, keep everything —
   losing all sources is worse than keeping weak ones.
2. `NEVER_USE`: 15 user-generated-content domains, enforced in code regardless of what the
   search API returned.
3. Tier assignment (1–4) by domain suffix.
4. Topic keyword check — RSS only; search results are already topic-filtered.
5. Canonical URL: strip anchors, query strings, duplicate slashes, trailing slash, lowercase.
6. Duplicate elimination on canonical URL, then on a normalised 60-character title key,
   then on a normalised 200-character content prefix. The third catches wire copy
   republished under different headlines.
7. Boilerplate: two or more footer/navigation phrase matches, or three or more image
   placeholders, drops the source.
8. Structure test: over 40 words **and** over 60 words per sentence means a navigation
   list, not prose.

## Workflow 2 — Daily Monitor

```mermaid
flowchart LR
    S(["Schedule<br/>every 2 days, 08:00"]) --> WL["Watchlist<br/>5 topics, MAX_PER_RUN = 5"]
    WL --> LOOP{"Process Each Topic"}
    LOOP -->|"per item"| SUB["Run Brief Workflow<br/><i>run once for each item</i><br/><i>on error: continue</i>"]
    SUB --> WAIT["Pause 5 s"]
    WAIT --> LOOP
    LOOP -->|"done"| SUM(["Run Summary"])
```

Two settings are not optional:

- **Run once for each item** — otherwise all five topics arrive in a *single* call and
  `Build Search Query` only reads `$input.first()`.
- **On error: continue** — five topics are 15 API calls. If topic 3 fails, stopping the
  workflow would also suppress 4 and 5.

`MAX_PER_RUN` is a hard cost brake, not a convenience: it bounds the worst case per run
regardless of how long the watchlist grows.

## Workflow 3 — Weekly Report

```mermaid
flowchart LR
    S(["Schedule<br/>Mondays, 08:00"]) --> FETCH["Fetch Week Data<br/><i>SQL, 7 days, limit 25</i>"]
    FETCH --> GROUP["Group by Category"]
    GROUP --> SYN["Synthesise Report<br/><b>Sonnet 4.6</b><br/><i>editorial brief, not a summary</i>"]
    SYN --> HTML["Build HTML"]
    HTML --> SAVE["Save Report<br/><i>on conflict (week_label) do update</i>"]
    SAVE --> SEND(["Send Report via Resend"])

    classDef model fill:#2d1e3d,stroke:#9b6bc7,color:#fff
    class SYN model
```

The prompt is written as an editorial assignment — cluster, exclude, rank, connect — rather
than as a summarisation task. The report publishes a **coverage note** stating which briefs
it merged and which it dropped, and why.

## Data model

```mermaid
erDiagram
    briefs ||--o{ brief_sources : "has"
    briefs {
        uuid id PK
        text content_hash UK "topic + sorted canonical URLs"
        timestamptz run_started_at
        text topic
        text timeframe
        text headline
        text summary
        text category "closed vocabulary"
        text event_type "closed vocabulary"
        int impact_score "0-100"
        int confidence_score "0-100"
        text strategic_relevance
        text regulatory_relevance
        text technology_relevance
        text_arr primary_companies "text[]"
        text_arr affected_segments "text[]"
        text_arr topics "text[]"
        text_arr geography "text[]"
        text_arr key_dates "text[]"
        text_arr what_to_monitor "text[]"
        text_arr evidence_gaps "text[]"
        int source_count
        int tier1_count
        int tier2_count
        int rss_count
        int triage_dropped
        text brief_markdown
        timestamptz created_at
    }
    brief_sources {
        bigint id PK
        uuid brief_id FK
        timestamptz created_at
        int position
        text title
        text url
        text canonical_url
        text domain
        int tier "1-4"
        text origin "tavily | rss"
        text published_date
        bool full_text_retrieved
        numeric relevance_score
        text content_excerpt "max 1000 chars"
    }
    weekly_reports {
        uuid id PK
        int week_number
        text week_label UK
        int brief_count
        text subject
        text report_markdown
        text report_html
        timestamptz created_at
        timestamptz sent_at
    }
```

The dedup hash is computed over **topic + sorted canonical source URLs**, never over the
brief text: the model's prose differs slightly on every run, so a text hash would never
collide. `.sort()` is required because search engines do not return a stable ordering.

`on conflict do nothing` was the original form and was wrong: on a duplicate it returns no
row, so the follow-up source insert wrote `null` into a `not null` column.
`do update set topic = excluded.topic ... returning id, (xmax = 0) as was_inserted`
guarantees an id and reports whether the row was newly inserted.

All writes are parameterised (`$1`, `$2`, …) — values travel separately from the statement.

## Frontend access layers

```mermaid
flowchart LR
    B(["Browser"]) -->|"publishable key"| API["Supabase REST"]
    API --> G{"GRANT SELECT<br/><i>may the role touch the table?</i>"}
    G -->|"no"| DENY(["permission denied<br/>for table briefs"])
    G -->|"yes"| R{"RLS policy<br/><i>which rows?</i>"}
    R -->|"no"| EMPTY(["empty result"])
    R -->|"yes"| DATA(["rows"])

    classDef err fill:#3d1f1f,stroke:#c74a4a,color:#fff
    class DENY,EMPTY err
```

Both layers must pass. Because *Automatically expose new tables* is deliberately off in the
Supabase project, the `GRANT` has to be issued by hand — an RLS policy alone is not enough,
and the resulting error (`permission denied for table briefs`) points at the wrong layer.

## Pages

| Route | Content |
|---|---|
| `/` | Feed — key figures, brief cards, impact colour-coded, confidence as a bar |
| `/brief/[id]` | Full brief, source list with tier, origin, headline-only marker, links to primary sources |
| `/companies` | Grouped by company, sorted by frequency |
| `/reports` | Weekly reports, newest first |
| `/about` | Method in six steps, score definitions, stated limitations |
