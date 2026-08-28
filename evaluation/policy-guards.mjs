#!/usr/bin/env node
// Static regression guard for the Public V1 publication policy.
//
// After the 2026-08 hardening, the Weekly Report read path and the documented
// schema both enforce that only *publishable* briefs are used / exposed:
//   confidence_score is not null and >= 40
//   source_count is not null and >= 3
//   brief_markdown has no leading "INSUFFICIENT EVIDENCE" refusal marker
//   (read path also) at least 3 ACTUAL brief_sources child rows
//
// This script fails CI if any of those defenses are removed or weakened.
// It does not touch a database; it inspects the tracked source files.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const norm = (s) => s.replace(/\s+/g, ' ').toLowerCase();

const failures = [];
const check = (label, ok) => {
  console.log(`${ok ? 'PASS ' : 'FAIL '} ${label}`);
  if (!ok) failures.push(label);
};

// --- Weekly Report "Fetch Week Data" SQL -----------------------------------
const wr = JSON.parse(read('workflows/Weekly Payments Report.json'));
const fw = wr.nodes.find((n) => n.name === 'Fetch Week Data');
const q = norm((fw && fw.parameters && fw.parameters.query) || '');

check('weekly report: 7-day window preserved',
  q.includes("created_at >= now() - interval '7 days'"));
check('weekly report: confidence_score is not null',
  q.includes('confidence_score is not null'));
check('weekly report: confidence_score >= 40',
  /confidence_score\s*>=\s*40/.test(q));
check('weekly report: source_count is not null',
  q.includes('source_count is not null'));
check('weekly report: source_count >= 3',
  /source_count\s*>=\s*3/.test(q));
check('weekly report: refusal marker excluded from brief_markdown',
  /left\(brief_markdown,\s*\d+\)\s*not like '%insufficient evidence%'/.test(q));
check('weekly report: verifies ACTUAL brief_sources child rows >= 3',
  /select\s+count\(\*\)\s+from\s+brief_sources\s+\w+\s+where\s+\w+\.brief_id\s*=\s*briefs\.id\s*\)\s*>=\s*3/.test(q));

// --- db/schema.sql --------------------------------------------------------
const schemaRaw = read('db/schema.sql');
const schema = norm(schemaRaw);

check('schema: briefs publication CHECK constraint present',
  /add constraint briefs_publishable_ck check \(/.test(schema));
check('schema: CHECK enforces confidence_score is not null and >= 40',
  /briefs_publishable_ck check \([^;]*confidence_score is not null[^;]*confidence_score >= 40/.test(schema));
check('schema: CHECK enforces source_count is not null and >= 3',
  /briefs_publishable_ck check \([^;]*source_count is not null[^;]*source_count >= 3/.test(schema));
check('schema: CHECK excludes INSUFFICIENT EVIDENCE marker',
  /briefs_publishable_ck check \([^;]*not like '%insufficient evidence%'/.test(schema));

const briefsPolicy = norm(
  (schemaRaw.match(/create policy "public read briefs"[\s\S]*?;/i) || [''])[0],
);
check('schema: briefs RLS policy exists', briefsPolicy.length > 0);
check('schema: briefs RLS is NOT using(true)',
  briefsPolicy.length > 0 && !/using \( true \)/.test(briefsPolicy) && !/using\(true\)/.test(briefsPolicy.replace(/ /g, '')));
check('schema: briefs RLS scopes to publishable (confidence >= 40, source_count >= 3)',
  /confidence_score\s*>=\s*40/.test(briefsPolicy) && /source_count\s*>=\s*3/.test(briefsPolicy));
check('schema: briefs RLS excludes refusal marker',
  /not like '%insufficient evidence%'/.test(briefsPolicy));

const sourcesPolicy = norm(
  (schemaRaw.match(/create policy "public read sources"[\s\S]*?;/i) || [''])[0],
);
check('schema: brief_sources RLS policy exists', sourcesPolicy.length > 0);
check('schema: brief_sources RLS is NOT using(true)',
  sourcesPolicy.length > 0 && !/using\(true\)/.test(sourcesPolicy.replace(/ /g, '')));
check('schema: brief_sources RLS requires a publishable parent brief',
  /exists \( select 1 from public\.briefs/.test(sourcesPolicy)
    && /confidence_score\s*>=\s*40/.test(sourcesPolicy)
    && /source_count\s*>=\s*3/.test(sourcesPolicy));

console.log(`\n${failures.length === 0 ? 'OK — all publication-policy guards hold' : `${failures.length} FAILURE(S)`}`);
process.exit(failures.length === 0 ? 0 : 1);
