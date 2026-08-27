import { supabase } from '../lib/supabase';
import Link from 'next/link';

export const revalidate = 300; // Seite alle 5 Minuten neu aufbauen

function impactColour(score) {
  if (score >= 70) return 'bg-red-500';
  if (score >= 50) return 'bg-amber-500';
  if (score >= 30) return 'bg-slate-400';
  return 'bg-slate-300';
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

export default async function Home() {
  const { data: briefs, error } = await supabase
    .from('briefs')
    .select('id, created_at, topic, headline, summary, category, impact_score, confidence_score, primary_companies, source_count, tier1_count')
    .order('impact_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    return (
      <main className="min-h-screen bg-stone-50 p-8">
        <div className="mx-auto max-w-3xl rounded border border-red-300 bg-red-50 p-6">
          <h2 className="font-semibold text-red-800">Database error</h2>
          <p className="mt-2 text-sm text-red-700">{error.message}</p>
        </div>
      </main>
    );
  }

  const rows = briefs || [];
  const totalSources = rows.reduce((s, r) => s + (r.source_count || 0), 0);
  const totalTier1 = rows.reduce((s, r) => s + (r.tier1_count || 0), 0);
  const companies = new Set();
  rows.forEach(r => (r.primary_companies || []).forEach(c => companies.add(c)));

  return (
    <main className="min-h-screen bg-stone-50">
      {/* Kopfbereich */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-500">
            Payments Intelligence
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
            Automated monitoring of the payments and fintech industry
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">
            Developments are collected from search and primary sources, filtered for
            relevance, scored for impact and confidence, and stored with full source
            attribution. Every claim traces back to a retrievable URL.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded border border-stone-200 bg-stone-200 sm:grid-cols-4">
            {[
              ['Developments', rows.length],
              ['Sources', totalSources],
              ['Primary sources', totalTier1],
              ['Companies', companies.size]
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-4 py-3">
                <div className="text-2xl font-semibold text-stone-900">{value}</div>
                <div className="mt-0.5 text-xs text-stone-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Feed */}
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h2 className="mb-5 text-xs font-medium uppercase tracking-widest text-stone-500">
          Latest developments
        </h2>

        {rows.length === 0 && (
          <p className="rounded border border-stone-200 bg-white p-6 text-sm text-stone-600">
            No developments recorded yet.
          </p>
        )}

        <div className="space-y-3">
          {rows.map(b => (
            <Link
              key={b.id}
              href={`/brief/${b.id}`}
              className="block rounded border border-stone-200 bg-white p-5 transition hover:border-stone-400 hover:shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded text-sm font-semibold text-white ${impactColour(b.impact_score)}`}>
                  {b.impact_score ?? '–'}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-stone-100 px-2 py-0.5 font-medium uppercase tracking-wide text-stone-600">
                      {b.category || 'other'}
                    </span>
                    <span className="text-stone-400">{formatDate(b.created_at)}</span>
                    {b.tier1_count > 0 && (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                        {b.tier1_count} primary
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 font-semibold leading-snug text-stone-900">
                    {b.headline}
                  </h3>

                  <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                    {(b.summary || '').slice(0, 230)}
                    {(b.summary || '').length > 230 ? '…' : ''}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
                    <span>{(b.primary_companies || []).slice(0, 4).join(' · ') || '—'}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <span>Confidence {b.confidence_score ?? '–'}</span>
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-200">
                        <span
                          className="block h-full bg-stone-700"
                          style={{ width: `${b.confidence_score || 0}%` }}
                        />
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-6 text-xs leading-relaxed text-stone-500">
          Impact and confidence scores are model-assigned. Confidence reflects source
          count, source tier and whether full article text was retrieved. Items below
          40 confidence are not stored.
        </div>
      </footer>
    </main>
  );
}