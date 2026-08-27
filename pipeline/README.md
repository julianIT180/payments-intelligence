# pipeline/ — reference copies of the workflow's custom code

The On-Demand Brief pipeline runs as an n8n workflow
([`workflows/Payments Intelligence - On-Demand Brief (5).json`](../workflows/Payments%20Intelligence%20-%20On-Demand%20Brief%20(5).json)).
Its interesting logic lives inside n8n **Code** nodes as embedded JavaScript, which is
hard to read in a 50&nbsp;KB JSON export.

Each file here is a **faithful copy** of one Code node, with a header line saying so.
Nothing in this directory is imported or executed — the workflow JSON is the source of
truth. If a node changes in n8n, update the matching file here.

These snippets run in n8n's Code-node sandbox, so they use n8n globals (`$input`,
`$json`, `$('Node Name')`) and cannot use `new URL()` or Node built-ins.

## Where each file sits in the flow

```
On form submission / Called by Monitor
        │
  build-search-query.js .............. turns the topic into a Tavily query, sets per-run cost caps
        ├──────────────┐
   Tavily Search   Feed List
        │              │
 normalize-tavily.js   Fetch Feeds → Parse XML
        │              │
        │        normalize-feed-items.js .... RSS/Atom/RDF → common shape, keyword pre-filter
        │              │
        │        Fetch Article Pages
        │              │
        │        extract-article-text.js .... mainRegion() + stripHtml() + keepProse():
        │                                     isolate the article body, drop nav/boilerplate,
        │                                     keep only prose-looking lines; fall back to
        │                                     headline-only below 200 chars
        └──────┬───────┘
         Combine Sources (merge, append)
               │
         Triage Relevance (Haiku)
               │
  clean-and-rank-sources.js ......... apply triage scores, NEVER_USE hard block, tier 1–4
                                      assignment, canonical-URL + title + content-prefix
                                      dedup, boilerplate/structure tests, rank by tier then
                                      relevance, cap at 10, build the [S#] evidence block
               │
         Extract Metadata (Haiku + JSON Schema)
               │
         Analyse and Draft Brief (Sonnet) → may return a bare "INSUFFICIENT EVIDENCE"
               │
  assemble-brief.js ................. stitch header + analysis + source appendix; set
                                      had_enough_evidence and the strict boolean
                                      model_refused (leading "INSUFFICIENT EVIDENCE" marker)
               │
  prepare-db-record.js ............. compute the dedup content_hash; apply the four-condition
                                      publication gate (model_refused false,
                                      had_enough_evidence, source_count >= 3,
                                      confidence_score >= 40); emit { skipped: true/false, … }
               │
         Persist Brief?  (IF: skipped is false)
          ├─ true  → Insert Brief → Insert Sources → Return Result
          └─ false → Return Result
```

## Not copied here

Prompt text (Triage, Extract Metadata, Analyse and Draft Brief), the Extract Metadata
JSON Schema, and the SQL in the Postgres nodes live in the workflow JSON only. The
weekly report's `Build HTML` node is in
[`workflows/Weekly Payments Report.json`](../workflows/Weekly%20Payments%20Report.json).
