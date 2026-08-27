// Reference copy exported from n8n. The workflow JSON remains the source of truth.
// n8n node: "Prepare DB Record"  (workflow: Payments Intelligence - On-Demand Brief)
// This file is NOT imported by anything; it exists so the pipeline logic is readable
// without opening the workflow export. Keep it in sync when the node changes.

// Datensatz fuer die Datenbank aufbereiten, inkl. Dedup-Hash.

const b = $input.first().json;
const meta = b.metadata || {};
const sources = Array.isArray(b.sources) ? b.sources : [];

// ---- Publikations-Gate: konservativ, vier Bedingungen -------------------
// Speichern nur, wenn ALLE erfuellt sind.
const MIN_SOURCES = 3;
const MIN_CONFIDENCE = 40;

const modelRefused   = b.model_refused === true;
const enoughEvidence = b.had_enough_evidence === true;
const sourceCount    = Number(b.source_count != null ? b.source_count : sources.length);
const confidence     = Number(meta.confidence_score || 0);

const persist =
  modelRefused   === false &&
  enoughEvidence === true  &&
  sourceCount >= MIN_SOURCES &&
  confidence  >= MIN_CONFIDENCE;

if (!persist) {
  return [{
    json: {
      skipped: true,
      skip_reason: modelRefused
        ? 'model returned INSUFFICIENT EVIDENCE'
        : `had_enough_evidence=${enoughEvidence}, sources=${sourceCount}, confidence=${meta.confidence_score}`,
      topic: b.topic
    }
  }];
}

// ---- Dedup-Hash ---------------------------------------------------------
// Gleiches Thema + gleiche Quellenlage = derselbe Brief.
// Der Hash geht in eine UNIQUE-Spalte; Postgres lehnt Duplikate ab.
function simpleHash(str) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 2246822519) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0'));
}

const urlFingerprint = sources
  .map(s => String(s.canonical || s.url || '').toLowerCase())
  .sort()                      // Reihenfolge darf keine Rolle spielen
  .join('|');

const hashInput = String(b.topic || '').toLowerCase().trim() + '::' + urlFingerprint;
const contentHash = simpleHash(hashInput);

// ---- Hilfsfunktionen ----------------------------------------------------
function arr(v) {
  if (Array.isArray(v)) return v.map(x => String(x));
  if (v === null || v === undefined) return [];
  return [String(v)];
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}
function str(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

return [{
  json: {
    skipped: false,
    content_hash: contentHash,
    run_started_at: b.run_started_at || null,

    topic: String(b.topic || 'unknown'),
    timeframe: str(b.timeframe),

    headline: str(meta.headline),
    summary: str(meta.summary),
    category: str(meta.category),
    event_type: str(meta.event_type),

    impact_score: num(meta.impact_score),
    confidence_score: num(meta.confidence_score),
    strategic_relevance: str(meta.strategic_relevance),
    regulatory_relevance: str(meta.regulatory_relevance),
    technology_relevance: str(meta.technology_relevance),

    primary_companies: arr(meta.primary_companies),
    affected_segments: arr(meta.affected_segments),
    topics: arr(meta.topics),
    geography: arr(meta.geography),
    key_dates: arr(meta.key_dates),
    what_to_monitor: arr(meta.what_to_monitor),
    evidence_gaps: arr(meta.evidence_gaps),

    source_count: num(b.source_count),
    tier1_count: num(b.tier1_count),
    tier2_count: num(b.tier2_count),

    brief_markdown: String(b.brief_markdown || ''),

    // Quellen als JSON-String mitgeben, wird im naechsten Node entpackt
    sources_json: JSON.stringify(sources)
  }
}];
