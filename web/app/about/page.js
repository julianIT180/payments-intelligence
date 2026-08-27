export const metadata = {
    title: 'About — Payments Intelligence'
  };
  
  const steps = [
    ['Retrieval', 'Each topic is queried against a search API and, in parallel, against RSS feeds from regulators such as the ECB. Feed items are fetched in full and the article body is extracted from the page.'],
    ['Triage', 'A lightweight model scores every retrieved source 0–100 on whether it actually addresses the requested topic. Marketing pages, index pages and off-topic material are dropped before anything expensive runs.'],
    ['Filtering and ranking', 'Rule-based checks remove duplicates, boilerplate and navigation text. Sources are ranked by editorial tier — regulators first, then company primary sources, then trade press — which deliberately overrides the search engine\u2019s own ordering.'],
    ['Analysis', 'A stronger model produces the written brief. It may use only the retrieved evidence, must cite every factual claim, and must state "insufficient evidence" rather than fill gaps.'],
    ['Structured extraction', 'A second model call extracts machine-readable fields: impact score, confidence score, companies, segments, geography and what to monitor next.'],
    ['Storage', 'Records are deduplicated at database level using a hash of the topic and the canonical source URLs. Briefs below a confidence threshold are not stored at all.']
  ];
  
  export default function About() {
    return (
      <main className="min-h-screen bg-stone-50">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            About this project
          </h1>
  
          <p className="mt-4 leading-relaxed text-stone-700">
            An automated pipeline that monitors developments in the payments and
            fintech industry. It retrieves material from live sources, filters it,
            analyses it and stores the result with full attribution. Every factual
            claim in a brief traces back to a URL that was actually fetched.
          </p>
  
          <h2 className="mt-10 border-b border-stone-200 pb-1.5 text-sm font-semibold uppercase tracking-wide text-stone-900">
            How it works
          </h2>
          <ol className="mt-4 space-y-4">
            {steps.map((s, i) => (
              <li key={s[0]} className="flex gap-4">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <div>
                  <div className="font-medium text-stone-900">{s[0]}</div>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">{s[1]}</p>
                </div>
              </li>
            ))}
          </ol>
  
          <h2 className="mt-10 border-b border-stone-200 pb-1.5 text-sm font-semibold uppercase tracking-wide text-stone-900">
            On the scores
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-stone-700">
            <strong>Impact</strong> estimates how consequential a development is for
            the payments industry, from routine to structural change across the value
            chain. <strong>Confidence</strong> reflects the evidence, not the claim:
            how many independent sources were available, whether any were primary,
            and whether full article text could be retrieved. A source available only
            as a headline caps confidence regardless of how authoritative it is.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-stone-700">
            Both scores are model-assigned. They are useful for ranking and filtering,
            not as precise measurements. Low-confidence items are flagged rather than
            hidden.
          </p>
  
          <h2 className="mt-10 border-b border-stone-200 pb-1.5 text-sm font-semibold uppercase tracking-wide text-stone-900">
            Limitations
          </h2>
          <ul className="mt-4 ml-5 list-disc space-y-2 text-sm leading-relaxed text-stone-700">
            <li>Coverage depends on what the search API surfaces. A development that is not indexed will not appear.</li>
            <li>Some sources publish only headlines in their feeds. These are marked and the model is instructed not to infer beyond them.</li>
            <li>Analytical judgements in a brief are the model&apos;s interpretation, not sourced statements. They are labelled as such.</li>
            <li>The system does not verify claims against each other across time. A retracted story would remain in the archive.</li>
          </ul>
  
          <h2 className="mt-10 border-b border-stone-200 pb-1.5 text-sm font-semibold uppercase tracking-wide text-stone-900">
            Stack
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-stone-700">
            n8n for orchestration, Tavily for search, Anthropic models for triage and
            analysis, Supabase (PostgreSQL) for storage, Next.js on Vercel for this
            site. Built as a personal project.
          </p>
        </div>
      </main>
    );
  }