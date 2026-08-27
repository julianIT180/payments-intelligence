-- Payments Intelligence — operational metrics
--
-- Each block is independent. Run the one you need.
-- These are the queries behind the numbers quoted anywhere about this project;
-- keeping them in the repo means any figure can be reproduced rather than trusted.

-- ---------------------------------------------------------------------------
-- 1. Headline figures
-- ---------------------------------------------------------------------------

select
  (select count(*) from briefs)                                as briefs_generated,
  (select count(*) from brief_sources)                         as source_records,
  (select count(distinct canonical_url) from brief_sources)    as unique_articles,
  (select count(distinct domain) from brief_sources)           as distinct_domains,
  (select count(*) from brief_sources where tier <= 2)         as primary_sources,
  (select count(distinct c)
     from briefs, unnest(primary_companies) as c)              as companies_tracked,
  (select round(avg(impact_score))     from briefs)            as avg_impact,
  (select round(avg(confidence_score)) from briefs)            as avg_confidence,
  (select min(created_at)::date from briefs)                   as first_brief,
  (select max(created_at)::date from briefs)                   as last_brief,
  (select max(created_at)::date - min(created_at)::date
     from briefs)                                              as days_running;

-- ---------------------------------------------------------------------------
-- 2. Evidence quality mix
--    The share of tier 1-2 sources is the single most honest quality signal.
-- ---------------------------------------------------------------------------

select
  tier,
  count(*)                                                     as sources,
  round(100.0 * count(*) / sum(count(*)) over (), 1)           as pct,
  count(*) filter (where full_text_retrieved)                  as with_full_text,
  count(*) filter (where not full_text_retrieved)              as headline_only
from brief_sources
group by tier
order by tier;

-- ---------------------------------------------------------------------------
-- 3. Retrieval channel comparison
--    Does the RSS branch actually earn its extra HTTP requests?
-- ---------------------------------------------------------------------------

select
  origin,
  count(*)                                                     as sources,
  round(avg(tier), 2)                                          as avg_tier,
  round(100.0 * count(*) filter (where full_text_retrieved)
        / nullif(count(*), 0), 1)                              as pct_full_text,
  round(avg(relevance_score), 1)                               as avg_triage_score
from brief_sources
group by origin
order by origin;

-- ---------------------------------------------------------------------------
-- 4. Score distribution
--    Confidence should spread. If everything lands in one bucket the score
--    is decorative rather than informative.
-- ---------------------------------------------------------------------------

select
  width_bucket(confidence_score, 0, 100, 5) * 20 - 19          as bucket_from,
  width_bucket(confidence_score, 0, 100, 5) * 20               as bucket_to,
  count(*)                                                     as briefs,
  round(avg(source_count), 1)                                  as avg_sources,
  round(avg(impact_score))                                     as avg_impact
from briefs
where confidence_score is not null
group by 1, 2
order by 1;

-- ---------------------------------------------------------------------------
-- 5. Source leaderboard
-- ---------------------------------------------------------------------------

select
  domain,
  min(tier)                                                    as tier,
  count(*)                                                     as appearances,
  count(distinct brief_id)                                     as briefs,
  round(avg(relevance_score), 1)                               as avg_triage_score
from brief_sources
where domain is not null
group by domain
order by appearances desc, domain
limit 25;

-- ---------------------------------------------------------------------------
-- 6. Coverage by topic and category
-- ---------------------------------------------------------------------------

select
  topic,
  count(*)                                                     as briefs,
  round(avg(impact_score))                                     as avg_impact,
  round(avg(confidence_score))                                 as avg_confidence,
  round(avg(source_count), 1)                                  as avg_sources,
  max(created_at)::date                                        as last_seen
from briefs
group by topic
order by briefs desc, topic;

select
  coalesce(category, '(none)')                                 as category,
  count(*)                                                     as briefs,
  round(avg(impact_score))                                     as avg_impact
from briefs
group by 1
order by briefs desc;

-- ---------------------------------------------------------------------------
-- 7. Known limitation, quantified: story-level duplicates
--    The content hash deduplicates on source sets. Two runs that return
--    different articles about the same news produce two rows. This query
--    surfaces likely duplicates so the size of the problem is visible
--    rather than assumed.
-- ---------------------------------------------------------------------------

select
  a.topic,
  a.created_at::date                                           as day,
  a.headline                                                   as headline_a,
  b.headline                                                   as headline_b,
  count(*) over ()                                             as total_pairs
from briefs a
join briefs b
  on a.topic = b.topic
 and a.id < b.id
 and abs(extract(epoch from a.created_at - b.created_at)) < 60 * 60 * 24 * 3
 and exists (
       select 1
       from brief_sources sa
       join brief_sources sb on sa.canonical_url = sb.canonical_url
       where sa.brief_id = a.id and sb.brief_id = b.id
     )
order by a.topic, a.created_at;

-- ---------------------------------------------------------------------------
-- 8. Run health over time
--    triage_dropped is how many candidate sources the model rejected.
--    A sudden drop to zero usually means triage failed and the fallback
--    ("keep everything") silently took over.
-- ---------------------------------------------------------------------------

select
  created_at::date                                             as day,
  count(*)                                                     as briefs,
  round(avg(source_count), 1)                                  as avg_sources,
  round(avg(triage_dropped), 1)                                as avg_triage_dropped,
  round(avg(tier1_count), 1)                                   as avg_tier1,
  round(avg(confidence_score))                                 as avg_confidence
from briefs
group by 1
order by 1 desc;

-- ---------------------------------------------------------------------------
-- 9. Weekly reports
-- ---------------------------------------------------------------------------

select
  week_label,
  brief_count,
  length(report_markdown)                                      as markdown_chars,
  created_at,
  sent_at
from weekly_reports
order by created_at desc;
