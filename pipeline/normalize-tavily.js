// Reference copy exported from n8n. The workflow JSON remains the source of truth.
// n8n node: "Normalize Tavily"  (workflow: Payments Intelligence - On-Demand Brief)
// This file is NOT imported by anything; it exists so the pipeline logic is readable
// without opening the workflow export. Keep it in sync when the node changes.

// Tavily-Ergebnisse in dieselbe flache Struktur bringen wie die RSS-Items.

const raw = $input.first().json;
const results = Array.isArray(raw.results) ? raw.results : [];

if (results.length === 0) {
  // Leeres Ergebnis: ein Platzhalter-Item, damit der Merge-Node nicht haengt
  return [{ json: { origin: 'tavily', empty: true } }];
}

return results.map(r => ({
  json: {
    title: String(r.title || '').trim(),
    url: String(r.url || '').trim(),
    content: String(r.content || '').trim(),
    published_date: r.published_date || null,
    relevance_score: typeof r.score === 'number' ? r.score : 0,
    origin: 'tavily',
    contentIsTitleOnly: false
  }
}));
