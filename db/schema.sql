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
--
--   The publication policy is ALSO enforced at the database level, independently
--   of the workflow: a CHECK constraint (briefs_publishable_ck, below) rejects
--   rows that are not publishable, and the anon RLS policy only exposes
--   publishable briefs. A brief is "publishable" when:
--     confidence_score is not null and confidence_score >= 40
--     source_count is not null and source_count >= 3
--     brief_markdown does not carry the "INSUFFICIENT EVIDENCE" refusal marker
--       within its first 500 characters
--   (Five pre-gate rows from 2026-08-26 predate this; clean them up before
--   adding the CHECK — that one-off cleanup is handled separately.)
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

-- Publication policy at the database level. Drop-then-add keeps this re-runnable.
-- Adding this will fail if non-publishable rows still exist — run the one-off
-- cleanup of pre-gate briefs first.
alter table public.briefs drop constraint if exists briefs_publishable_ck;
alter table public.briefs
  add constraint briefs_publishable_ck check (
    confidence_score is not null
    and confidence_score >= 40
    and source_count is not null
    and source_count >= 3
    and left(coalesce(brief_markdown, ''), 500) not like '%INSUFFICIENT EVIDENCE%'
  );

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

-- anon sees only publishable briefs (same predicate as briefs_publishable_ck).
drop policy if exists "public read briefs" on public.briefs;
create policy "public read briefs"
  on public.briefs for select to anon using (
    confidence_score is not null
    and confidence_score >= 40
    and source_count is not null
    and source_count >= 3
    and left(coalesce(brief_markdown, ''), 500) not like '%INSUFFICIENT EVIDENCE%'
  );

-- anon sees a source row only when its parent brief is publishable.
drop policy if exists "public read sources" on public.brief_sources;
create policy "public read sources"
  on public.brief_sources for select to anon using (
    exists (
      select 1 from public.briefs b
      where b.id = brief_sources.brief_id
        and b.confidence_score is not null
        and b.confidence_score >= 40
        and b.source_count is not null
        and b.source_count >= 3
        and left(coalesce(b.brief_markdown, ''), 500) not like '%INSUFFICIENT EVIDENCE%'
    )
  );

drop policy if exists "public read reports" on public.weekly_reports;
create policy "public read reports"
  on public.weekly_reports for select to anon using (true);
