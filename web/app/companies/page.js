import { supabase } from '../../lib/supabase';
import Link from 'next/link';

export const revalidate = 300;

export default async function Companies() {
  const { data, error } = await supabase
    .from('briefs')
    .select('id, headline, category, impact_score, confidence_score, primary_companies, created_at')
    .order('impact_score', { ascending: false })
    .limit(200);

  if (error) {
    return (
      <main className="min-h-screen bg-stone-50 p-8">
        <p className="mx-auto max-w-4xl text-sm text-red-700">{error.message}</p>
      </main>
    );
  }

  const rows = data || [];
  const byCompany = {};

  rows.forEach((b) => {
    (b.primary_companies || []).forEach((c) => {
      if (!byCompany[c]) byCompany[c] = [];
      byCompany[c].push(b);
    });
  });

  const sorted = Object.keys(byCompany).sort((a, b) => {
    const diff = byCompany[b].length - byCompany[a].length;
    return diff !== 0 ? diff : a.localeCompare(b);
  });

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Companies
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          Organisations identified as central actors in a development. A company
          appears here only when the evidence places it at the centre of the story,
          not when it is mentioned in passing.
        </p>

        <div className="mt-8 space-y-4">
          {sorted.map((company) => {
            const items = byCompany[company];
            const maxImpact = Math.max(...items.map((i) => i.impact_score || 0));

            return (
              <section key={company} className="rounded border border-stone-200 bg-white">
                <div className="flex items-baseline justify-between border-b border-stone-100 px-5 py-3">
                  <h2 className="font-semibold text-stone-900">{company}</h2>
                  <span className="text-xs text-stone-500">
                    {items.length} {items.length === 1 ? 'development' : 'developments'}
                    {' · '}max impact {maxImpact}
                  </span>
                </div>
                <ul className="divide-y divide-stone-100">
                  {items.map((b) => (
                    <li key={b.id}>
                      <Link
                        href={'/brief/' + b.id}
                        className="flex items-center gap-3 px-5 py-3 transition hover:bg-stone-50"
                      >
                        <span className="w-8 shrink-0 text-xs font-semibold text-stone-500">
                          {b.impact_score ?? '-'}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-stone-800">
                          {b.headline}
                        </span>
                        <span className="shrink-0 rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                          {b.category || 'other'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}