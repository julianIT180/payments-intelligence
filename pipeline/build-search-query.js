// Reference copy exported from n8n. The workflow JSON remains the source of truth.
// n8n node: "Build Search Query"  (workflow: Payments Intelligence - On-Demand Brief)
// This file is NOT imported by anything; it exists so the pipeline logic is readable
// without opening the workflow export. Keep it in sync when the node changes.

// Wandelt das Nutzer-Thema in eine Payments-Suchanfrage um
// und setzt die Kosten-/Umfangsgrenzen für diesen Lauf.

const input = $input.first().json;

const topic = String(input.topic || '').trim();
const timeframe = String(input.timeframe || 'month').trim();

if (!topic) {
  throw new Error('Kein Thema uebergeben. Pruefe, ob das Formularfeld "topic" heisst.');
}

// Eingabe-Validierung: kuerzen und Zeichen entfernen, die JSON zerstoeren
const safeTopic = topic.replace(/["\\\n\r]/g, ' ').slice(0, 120);

// Kontextbegriffe lenken die Suchmaschine in Richtung Payments-Berichterstattung
const contextTerms = 'payments fintech acquiring issuing card network merchant';

const query = `${safeTopic} ${contextTerms} news announcement`;

// Quellen, die die KI nie lesen soll
const excludeDomains = [
  'reddit.com', 'quora.com', 'medium.com', 'substack.com',
  'linkedin.com', 'facebook.com', 'instagram.com', 'threads.net',
  'x.com', 'twitter.com', 'youtube.com', 'tiktok.com',
  'pinterest.com', 'bsky.app', 'mastodon.social',
  'aol.co.uk', 'aol.com', 'msn.com'
];

return [{
  json: {
    topic: safeTopic,
    timeframe: timeframe,
    query: query,
    maxResults: 8,
    excludeDomains: excludeDomains,
    runStartedAt: new Date().toISOString()
  }
}];
