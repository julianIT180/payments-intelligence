-- Payments Intelligence — database schema
-- Postgres (Supabase), schema: public
--
-- Run this in the Supabase SQL editor before importing the n8n workflows.
-- The frontend reads these tables through the anonymous role; see the
-- "Read access for the frontend" section at the bottom — both a GRANT and an
-- RLS policy are required.

-- ---------------------------------------------------------------------------
-- briefs
--   One row per accepted brief. The workflow inserts a row only when all of
--   model_refused = false, had_enough_evidence, source_count >= 3 and
--   confidence_score >= 40 hold; skipped runs never reach this table.
--   Descriptive columns (headline, summary, category, event_type, *_relevance)
--   may be null: the extractor is allowed to return null when the evidence did
--   not support a field. Scores are always present and bounded 0-100.
-- ---------------------------------------------------------------------------

create table if not exists public.briefs (
  id                    uuid        primary key default gen_random_uuid(),
  created_at            timestamptz not null    default now(),
  run_started_at        timestamptz,

  -- request
  topic                 text        not null,
  timeframe             text,

  -- deduplication key: sha256 over topic + sorted canonical source URLs.
  -- Deliberately NOT over the brief text, which differs on every model run.
  content_hash          text        not null unique,

  -- output
  headline              text,
  summary               text,
  category              text,       -- closed vocabulary, enforced in the prompt
  event_type            text,       -- closed vocabulary, enforced in the prompt

  -- scores, 0-100, model-generated and not calibrated against outcomes
  impact_score          integer,
  confidence_score      integer,

  strategic_relevance   text,
  regulatory_relevance  text,
  technology_relevance  text,

  -- extracted entities
  primary_companies     text[],
  affected_segments     text[],
  topics                text[],
  geography             text[],
  key_dates             text[],

  -- what the brief does not establish
  what_to_monitor       text[],
  evidence_gaps         text[],

  -- run diagnostics
  source_count          integer,
  tier1_count           integer,
  tier2_count           integer,
  rss_count             integer,
  triage_dropped        integer,

  brief_markdown        text
);

create index if not exists idx_briefs_created
  on public.briefs using btree (created_at desc);
create index if not exists idx_briefs_impact
  on public.briefs using btree (impact_score desc);
create index if not exists idx_briefs_category
  on public.briefs using btree (category);

-- ---------------------------------------------------------------------------
-- brief_sources
--   The evidence behind each brief, in ranked order.
--   Kept even for headline-only sources: the frontend marks them as such
--   rather than hiding them.
-- ---------------------------------------------------------------------------

create table if not exists public.brief_sources (
  id                   bigserial   primary key,
  brief_id             uuid        not null
                                   references public.briefs (id) on delete cascade,
  created_at           timestamptz not null default now(),

  position             integer,    -- rank after Clean and Rank Sources, 1-based
  title                text,
  url                  text,
  canonical_url        text,       -- anchors, query strings and trailing slash stripped
  domain               text,

  -- 1 regulators/central banks, 2 company primary sources,
  -- 3 established trade and business press, 4 everything else
  tier                 integer,
  origin               text,       -- 'tavily' | 'rss'
  published_date       text,       -- upstream format varies; stored verbatim

  full_text_retrieved  boolean,    -- false = headline only, shown in the UI
  relevance_score      numeric,    -- triage score, 0-100
  content_excerpt      text        -- first 1000 characters, for traceability
);

create index if not exists idx_sources_brief
  on public.brief_sources using btree (brief_id);
create index if not exists idx_sources_domain
  on public.brief_sources using btree (domain);

-- ---------------------------------------------------------------------------
-- weekly_reports
--   One row per calendar week. week_label is unique so a re-run of the
--   weekly workflow updates the existing row instead of duplicating it.
-- ---------------------------------------------------------------------------

create table if not exists public.weekly_reports (
  id               uuid        primary key default gen_random_uuid(),
  created_at       timestamptz not null    default now(),

  week_number      integer,
  week_label       text        unique,     -- e.g. '2026-W35'
  brief_count      integer,

  subject          text,
  report_markdown  text,
  report_html      text,

  sent_at          timestamptz
);

create index if not exists idx_reports_created
  on public.weekly_reports using btree (created_at desc);

-- ---------------------------------------------------------------------------
-- Read access for the frontend
--
--   Two independent layers must both pass:
--     GRANT  — may the role touch the table at all?
--     RLS    — which rows may it see?
--
--   A policy without the grant fails with "permission denied for table briefs",
--   which points at the wrong layer. In this project "Automatically expose new
--   tables" is switched off in the Supabase dashboard, so the grant is manual.
--
--   The frontend uses the publishable (anon) key. Nothing here grants insert,
--   update or delete — only the n8n workflows write, and they connect with a
--   separate database role.
-- ---------------------------------------------------------------------------

alter table public.briefs          enable row level security;
alter table public.brief_sources   enable row level security;
alter table public.weekly_reports  enable row level security;

grant usage on schema public to anon;
grant select on public.briefs         to anon;
grant select on public.brief_sources  to anon;
grant select on public.weekly_reports to anon;

drop policy if exists "public read briefs" on public.briefs;
create policy "public read briefs"
  on public.briefs for select to anon using (true);

drop policy if exists "public read sources" on public.brief_sources;
create policy "public read sources"
  on public.brief_sources for select to anon using (true);

drop policy if exists "public read reports" on public.weekly_reports;
create policy "public read reports"
  on public.weekly_reports for select to anon using (true);
