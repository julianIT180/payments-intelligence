// Reference copy exported from n8n. The workflow JSON remains the source of truth.
// n8n node: "Clean and Rank Sources"  (workflow: Payments Intelligence - On-Demand Brief)
// This file is NOT imported by anything; it exists so the pipeline logic is readable
// without opening the workflow export. Keep it in sync when the node changes.

// Quellen aus allen Kanaelen normalisieren, filtern, deduplizieren, ranken.

const prep = $('Build Search Query').first().json;
// Rohquellen aus dem Merge holen (Triage liefert nur Scores, keine Quellen)
const rawSources = $('Combine Sources').all().map(i => i.json).filter(x => !x.empty);

// Triage-Scores anwenden
const MIN_RELEVANCE = 25;
let triageDropped = 0;
let incoming = rawSources;

try {
  const t = $('Triage Relevance').first().json;
  const scores = (t.output || t).scores || [];
  const scoreMap = {};
  for (const s of scores) scoreMap[s.index] = s.score;

  incoming = rawSources.filter((src, i) => {
    const sc = typeof scoreMap[i] === 'number' ? scoreMap[i] : 100;
    if (sc < MIN_RELEVANCE) { triageDropped++; return false; }
    src.triage_score = sc;
    return true;
  });
} catch (e) {
  // Triage fehlgeschlagen: lieber alle Quellen behalten als gar keine
  incoming = rawSources;
}

// ---- Harte Sperre: nie in die Evidenz ----------------------------------
// Zweite Verteidigungslinie. Suchmaschinen-Parameter sind Wuensche,
// keine Garantien. Snippets von Plattformen mit nutzergenerierten
// Inhalten enthalten unkontrollierbare Kommentarspalten.
const NEVER_USE = [
  'instagram.com', 'facebook.com', 'x.com', 'twitter.com', 'threads.net',
  'tiktok.com', 'reddit.com', 'quora.com', 'youtube.com', 'pinterest.com',
  'bsky.app', 'mastodon.social', '4chan.org', 'telegram.me', 't.me'
];

// ---- Quellen-Qualitaetsstufen ------------------------------------------
const TIER_1 = [
  'ecb.europa.eu', 'eba.europa.eu', 'europa.eu', 'bis.org',
  'bankingsupervision.europa.eu', 'esrb.europa.eu',
  'bankofengland.co.uk', 'federalreserve.gov', 'bundesbank.de',
  'sec.gov', 'esma.europa.eu'
];
const TIER_2 = [
  'adyen.com', 'stripe.com', 'visa.com', 'mastercard.com', 'paypal.com',
  'klarna.com', 'revolut.com', 'checkout.com', 'worldline.com',
  'nexigroup.com', 'fiserv.com', 'globalpayments.com', 'block.xyz',
  'shift4.com', 'apple.com', 'google.com'
];
const TIER_3 = [
  'reuters.com', 'ft.com', 'bloomberg.com', 'wsj.com', 'cnbc.com',
  'forbes.com', 'economist.com', 'handelsblatt.com',
  'finextra.com', 'thepaypers.com', 'paymentsdive.com', 'pymnts.com',
  'fintechfutures.com', 'thefintechtimes.com', 'fintechmagazine.com',
  'centralbanking.com', 'americanbanker.com', 'bankingdive.com',
  'techcrunch.com', 'theverge.com'
];

function domainOf(url) {
  const m = String(url).match(/^https?:\/\/([^\/?#:]+)/i);
  if (!m) return '';
  return m[1].replace(/^www\./i, '').toLowerCase();
}

function tierOf(domain) {
  if (TIER_1.some(d => domain.endsWith(d))) return 1;
  if (TIER_2.some(d => domain.endsWith(d))) return 2;
  if (TIER_3.some(d => domain.endsWith(d))) return 3;
  return 4;
}

// ---- Themenbezug pruefen (nur fuer RSS noetig) ---------------------------
const topicWords = String(prep.topic || '')
  .toLowerCase()
  .split(/\s+/)
  .filter(w => w.length > 3);

function matchesTopic(item) {
  if (item.origin !== 'rss') return true;      // Tavily ist bereits gefiltert
  if (topicWords.length === 0) return true;
  const hay = (item.title + ' ' + item.content).toLowerCase();
  return topicWords.some(w => hay.includes(w));
}

// ---- Normalisieren, filtern, deduplizieren ------------------------------
const seenUrls = new Set();
const seenTitles = new Set();
const seenContent = new Set();
const cleaned = [];
let dropped = 0;

for (const r of incoming) {
  const url = String(r.url || '').trim();
  const title = String(r.title || '').trim();
  if (!url || !title) { dropped++; continue; }

  if (!matchesTopic(r)) { dropped++; continue; }

  const domain = domainOf(url);

  // Harte Sperre zuerst
  if (NEVER_USE.some(d => domain.endsWith(d))) { dropped++; continue; }

  // Kanonische URL: Tracking-Parameter, Anker, doppelte Slashes entfernen
  const canonical = url
    .split('#')[0]
    .split('?')[0]
    .replace(/([^:])\/\//g, '$1/')
    .replace(/\/$/, '')
    .toLowerCase();
  if (seenUrls.has(canonical)) { dropped++; continue; }
    // Index-, Übersichts- und Marketingseiten ohne Nachrichteninhalt
   if (/\/(resource-filter|all-payments-news)\/?$/i.test(canonical)) {
    dropped++; continue;
  }

  const titleKey = title.toLowerCase().replace(/[^a-z0-9 ]/g, '').slice(0, 60);
  if (titleKey && seenTitles.has(titleKey)) { dropped++; continue; }

  let content = String(r.content || '').replace(/\s+/g, ' ').trim();
  const titleOnly = r.contentIsTitleOnly === true || content === title;

  // Near-Duplicate: gleicher Textanfang trotz anderer Ueberschrift
  // (z.B. Agenturmeldung bei AOL und Yahoo Finance)
  const contentKey = content.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 200);
  if (contentKey.length > 100) {
    if (seenContent.has(contentKey)) { dropped++; continue; }
    seenContent.add(contentKey);
  }

  // Volltext-Quellen muessen substanziell sein; Headline-Only nicht
  if (!titleOnly && content.length < 120) { dropped++; continue; }

  if (!titleOnly) {
    // Boilerplate: typische Footer- und Navigationsphrasen
    const boilerplatePatterns = [
      /is part of the .{0,40}Division of/i,
      /registered office is/i,
      /all copyright resides with them/i,
      /this site is operated by a business/i,
      /cookie|privacy policy|terms of use/i,
      /subscribe to (our|the) newsletter/i
    ];
    const imagePlaceholders = (content.match(/Image \d+:/g) || []).length;
    const boilerplateHits = boilerplatePatterns.filter(p => p.test(content)).length;
    if (boilerplateHits >= 2 || imagePlaceholders >= 3) { dropped++; continue; }

    // Strukturtest: echter Fliesstext hat Saetze, Navigationslisten nicht
    const words = content.split(/\s+/).length;
    const sentenceEnds = (content.match(/[.!?]\s/g) || []).length;
    const wordsPerSentence = sentenceEnds > 0 ? words / sentenceEnds : words;
    if (words > 40 && wordsPerSentence > 60) { dropped++; continue; }

    // Index-/Uebersichtsseiten: viele abgeschnittene Fragmente
    const fragments = (content.match(/\[\.\.\.\]/g) || []).length;
    if (fragments >= 3) { dropped++; continue; }
  }

  content = content.slice(0, 1200);

  const tier = tierOf(domain);

  seenUrls.add(canonical);
  if (titleKey) seenTitles.add(titleKey);

  cleaned.push({
    title, url, canonical, domain, tier,
    published_date: r.published_date || null,
    relevance_score: typeof r.relevance_score === 'number' ? r.relevance_score : 0,
    origin: r.origin || 'unknown',
    titleOnly,
    content
  });
}

// ---- Ranking: Quellenqualitaet vor Suchrelevanz --------------------------
cleaned.sort((a, b) => (a.tier - b.tier) || (b.relevance_score - a.relevance_score));

const selected = cleaned.slice(0, 10);   // KOSTENBREMSE

// ---- Evidenzblock -------------------------------------------------------
const evidence = selected.map((s, i) => {
  const note = s.titleOnly
    ? ' [HEADLINE ONLY — full article text was not retrieved]'
    : '';
  return [
    `[S${i + 1}]`,
    `Title: ${s.title}`,
    `Source: ${s.domain} (quality tier ${s.tier}, via ${s.origin})${note}`,
    `Published: ${s.published_date || 'unknown'}`,
    `URL: ${s.url}`,
    `Excerpt: ${s.content}`
  ].join('\n');
}).join('\n\n---\n\n');

const sourceList = selected.map((s, i) =>
  `[S${i + 1}] ${s.title} — ${s.domain} — ${s.url}`
).join('\n');

return [{
  json: {
    topic: prep.topic,
    timeframe: prep.timeframe,
    sourceCount: selected.length,
    droppedCount: dropped,
    triageDroppedCount: triageDropped,
    tier1Count: selected.filter(s => s.tier === 1).length,
    tier2Count: selected.filter(s => s.tier === 2).length,
    rssCount: selected.filter(s => s.origin === 'rss').length,
    hasEnoughEvidence: selected.length >= 3,
    evidence,
    sourceList,
    sources: selected,
    runStartedAt: prep.runStartedAt
  }
}];
