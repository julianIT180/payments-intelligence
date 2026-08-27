// Reference copy exported from n8n. The workflow JSON remains the source of truth.
// n8n node: "Normalize Feed Items"  (workflow: Payments Intelligence - On-Demand Brief)
// This file is NOT imported by anything; it exists so the pipeline logic is readable
// without opening the workflow export. Keep it in sync when the node changes.

// RSS/Atom/RDF in dasselbe Format bringen wie die Tavily-Ergebnisse.

const KEYWORDS = [
  'payment', 'payments', 'instant payment', 'digital euro', 'sepa',
  'card', 'retail payment', 'settlement', 'tips', 'target',
  'psd2', 'psd3', 'psr', 'stablecoin', 'tokenis', 'tokeniz', 'fraud'
];

function toArray(x) {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

// xml2js legt Textinhalte teils unter "_" ab, Attribute unter "$"
function text(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object') {
    if (typeof v._ === 'string') return v._.trim();
    if (v.$ && typeof v.$.href === 'string') return v.$.href.trim();
  }
  return '';
}

function findItems(root) {
  if (root?.rss?.channel?.item) return toArray(root.rss.channel.item);
  if (root?.feed?.entry) return toArray(root.feed.entry);
  const rdf = root?.['rdf:RDF'] || root?.RDF;
  if (rdf?.item) return toArray(rdf.item);
  if (root?.channel?.item) return toArray(root.channel.item);
  return [];
}

const out = [];

for (const input of $input.all()) {
  const meta = $('Feed List').all()
    .map(i => i.json)
    .find(f => true); // Fallback, falls Zuordnung fehlschlaegt

  const root = input.json.data || input.json;
  const items = findItems(root);

  for (const it of items.slice(0, 25)) {   // max. 25 Eintraege pro Feed
    const title = text(it.title);
    const link = text(it.link) || text(it.guid) || text(it.id);
    const desc = text(it.description) || text(it.summary) || text(it.content);
    const date = text(it.pubDate) || text(it['dc:date']) || text(it.published) || text(it.updated);

    if (!title || !link) continue;

    // Themenfilter: RSS liefert ALLES, wir wollen nur Payments-Relevantes
    const haystack = (title + ' ' + desc).toLowerCase();
    const matched = KEYWORDS.filter(k => haystack.includes(k));
    if (matched.length === 0) continue;

    out.push({
      json: {
        title: title,
        url: link,
        content: desc || title,
        contentIsTitleOnly: !desc,
        published_date: date || null,
        origin: 'rss',
        matchedKeywords: matched
      }
    });
  }
}

return out;
