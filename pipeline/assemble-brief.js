// Reference copy exported from n8n. The workflow JSON remains the source of truth.
// n8n node: "Assemble Brief"  (workflow: Payments Intelligence - On-Demand Brief)
// This file is NOT imported by anything; it exists so the pipeline logic is readable
// without opening the workflow export. Keep it in sync when the node changes.

// KI-Analyse mit einem ueberpruefbaren Quellenanhang kombinieren.

const ctx = $('Clean and Rank Sources').first().json;
const llm = $('Analyse and Draft Brief').first().json;

const analysis = String(llm.text || llm.response || '').trim();

// Modellseitige Vollverweigerung erkennen. Vertrag (Analyse-Prompt, Regel 4):
// die Antwort besteht dann NUR aus dem Grossbuchstaben-Marker am Anfang.
const model_refused = /^INSUFFICIENT EVIDENCE\b/.test(analysis);

// Strukturierte Metadaten aus dem Haiku-Zweig
let meta = {};
try {
  const rawMeta = $('Extract Metadata').first().json;
  meta = rawMeta.output || rawMeta;
} catch (e) {
  meta = { extraction_error: String(e) };
}

const now = new Date();
const dateStr = now.toISOString().slice(0, 10);

const header = [
  `# Payments Intelligence Brief`,
  ``,
  `**Topic:** ${ctx.topic}`,
  `**Generated:** ${dateStr}`,
  `**Evidence window:** last ${ctx.timeframe}`,
  `**Sources analysed:** ${ctx.sourceCount} (${ctx.tier1Count} regulator/official, ${ctx.tier2Count} company primary)`,
  ``,
  `---`,
  ``
].join('\n');

const appendix = [
  ``,
  `---`,
  ``,
  `## Sources`,
  ``,
  ctx.sourceList,
  ``,
  `---`,
  ``,
  `*Generated automatically. All factual claims carry [S#] markers referring to the numbered sources above. Analytical judgements are the model's interpretation and are not sourced.*`
].join('\n');

const brief = header + analysis + appendix;

return [{
  json: {
    topic: ctx.topic,
    timeframe: ctx.timeframe,
    run_started_at: ctx.runStartedAt,
    generated_at: now.toISOString(),
    source_count: ctx.sourceCount,
    tier1_count: ctx.tier1Count,
    tier2_count: ctx.tier2Count,
    had_enough_evidence: ctx.hasEnoughEvidence,
    model_refused: model_refused,
    brief_markdown: brief,
    sources: ctx.sources,
    metadata: meta
  }
}];
