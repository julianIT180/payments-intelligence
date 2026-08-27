import { supabase } from '../../lib/supabase';

export const revalidate = 300;

export default async function Reports() {
  const { data, error } = await supabase
    .from('weekly_reports')
    .select('id, week_label, week_number, brief_count, report_html, created_at')
    .order('created_at', { ascending: false })
    .limit(12);

  if (error) {
    return (
      <main className="min-h-screen bg-stone-50 p-8">
        <p className="mx-auto max-w-4xl text-sm text-red-700">{error.message}</p>
      </main>
    );
  }

  const reports = data || [];

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Weekly reports
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          Each report clusters related developments, excludes items without an
          underlying event, and states explicitly what was merged or dropped.
        </p>

        {reports.length === 0 && (
          <p className="mt-8 rounded border border-stone-200 bg-white p-6 text-sm text-stone-600">
            No reports generated yet.
          </p>
        )}

        <div className="mt-8 space-y-6">
          {reports.map((r) => (
            <details key={r.id} className="rounded border border-stone-200 bg-white">
              <summary className="cursor-pointer px-5 py-4 font-semibold text-stone-900">
                {r.week_label}
                <span className="ml-3 text-xs font-normal text-stone-500">
                  {r.brief_count} developments
                </span>
              </summary>
              <div
                className="border-t border-stone-100 px-2 pb-4"
                dangerouslySetInnerHTML={{ __html: r.report_html }}
              />
            </details>
          ))}
        </div>
      </div>
    </main>
  );
}