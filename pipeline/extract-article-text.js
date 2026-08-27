// Reference copy exported from n8n. The workflow JSON remains the source of truth.
// n8n node: "Extract Article Text"  (workflow: Payments Intelligence - On-Demand Brief)
// This file is NOT imported by anything; it exists so the pipeline logic is readable
// without opening the workflow export. Keep it in sync when the node changes.

// Artikeltext aus roher HTML-Seite herausschneiden.

const feedItems = $('Normalize Feed Items').all().map(i => i.json);
const pages = $input.all().map(i => i.json);

// Zuerst den inhaltlichen Bereich isolieren — spart 90 % der Arbeit
function mainRegion(html) {
  const s = String(html || '');
  const patterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<body[^>]*>([\s\S]*?)<\/body>/i
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m && m[1] && m[1].length > 500) return m[1];
  }
  return s;
}

function stripHtml(html) {
  let s = String(html || '');

  // Bereiche, die nie Artikeltext sind
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  s = s.replace(/<nav[\s\S]*?<\/nav>/gi, ' ');
  s = s.replace(/<header[\s\S]*?<\/header>/gi, ' ');
  s = s.replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
  s = s.replace(/<aside[\s\S]*?<\/aside>/gi, ' ');
  s = s.replace(/<form[\s\S]*?<\/form>/gi, ' ');
  s = s.replace(/<figcaption[\s\S]*?<\/figcaption>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');

  // Absatzenden markieren, damit Saetze getrennt bleiben
  s = s.replace(/<\/(p|div|li|h1|h2|h3|h4|br)>/gi, '\n');

  // Restliche Tags entfernen
  s = s.replace(/<[^>]+>/g, ' ');

  // HTML-Entities aufloesen
  const entities = {
    '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
    '&quot;': '"', '&#39;': "'", '&rsquo;': "'", '&lsquo;': "'",
    '&ldquo;': '"', '&rdquo;': '"', '&ndash;': '-', '&mdash;': '—',
    '&euro;': '€', '&hellip;': '...'
  };
  for (const [k, v] of Object.entries(entities)) {
    s = s.split(k).join(v);
  }
  s = s.replace(/&#\d+;/g, ' ');

  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/\n\s*\n+/g, '\n');
  return s.trim();
}

// Nur Zeilen behalten, die wie echte Prosa aussehen
function keepProse(text) {
  const lines = text.split('\n');
  const good = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length < 60) continue;            // zu kurz = Menuepunkt
    if (!/[.!?]/.test(line)) continue;         // kein Satzzeichen
    const words = line.split(/\s+/).length;
    if (words < 10) continue;
    const capsWords = (line.match(/\b[A-Z][a-z]*\b/g) || []).length;
    if (capsWords / words > 0.6) continue;     // Navigation
    good.push(line);
  }
  return good.join(' ');
}

const out = [];

for (let i = 0; i < feedItems.length; i++) {
  const item = { ...feedItems[i] };
  const page = pages[i] || {};
  const html = page.html || page.data || '';

  let fullText = '';
  if (html && !page.error) {
    fullText = keepProse(stripHtml(mainRegion(html)));
  }

  if (fullText.length >= 200) {
    item.content = fullText.slice(0, 1500);   // KOSTENBREMSE
    item.contentIsTitleOnly = false;
    item.fullTextRetrieved = true;
  } else {
    item.contentIsTitleOnly = true;
    item.fullTextRetrieved = false;
  }
  out.push({ json: item });
}

return out;
