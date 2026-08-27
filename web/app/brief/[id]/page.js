import { supabase } from '../../../lib/supabase';
import Link from 'next/link';

export const revalidate = 300;

function impactColour(score) {
  if (score >= 70) return 'bg-red-500';
  if (score >= 50) return 'bg-amber-500';
  if (score >= 30) return 'bg-slate-400';
  return 'bg-slate-300';
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function renderMarkdown(md) {
  const lines = String(md || '').split('\n');
  const out = [];
  let listItems = [];

  const inline = (s) => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={i}>{p.slice(2, -2)}</strong>
        : <span key={i}>{p}</span>
    );
  };

  const flushList = (key) => {
    if (listItems.length) {
      out.push(
        <ul key={'ul-' + key} className="my-3 ml-5 list-disc space-y-1.5 text-stone-700">
          {listItems.map((li, i) => <li key={i}>{inline(li)}</li>)}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();

    if (line === '' || line === '---') {
      flushList(idx);
      return;
    }

    if (line.startsWith('## ')) {
      flushList(idx);
      out.push(
        <h2 key={idx} className="mt-8 mb-2 border-b border-stone-200 pb-1.5 text-sm font-semibold uppercase tracking-wide text-stone-900">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('# ')) {
      flushList(idx);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(line.slice(2));
    } else if (/^\d+\.\s/.test(line)) {
      listItems.push(line.replace(/^\d+\.\s/, ''));
    } else {
      flushList(idx);
      out.push(
        <p key={idx} className="my-2.5 leading-relaxed text-stone-700">
          {inline(line)}
        </p>
      );
    }
  });

  flushList('end');
  return out;
}

export default async function BriefPage({ params }) {
  const { id } = await params;

  const { data: brief, error } = await supabase
    .from('briefs')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !brief) {
    return (
      <main className="min-h-screen bg-stone-50 p-8">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="text-sm text-stone-600 hover:text-stone-900">
            &larr; Back to feed
          </Link>
          <div className="mt-6 rounded border border-stone-200 bg-white p-6">
            <h2 className="font-semibold text-stone-900">Brief not found</h2>
            <p className="mt-2 text-sm text-stone-600">
              {error ? error.message : 'No record with this id.'}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const { data: sources } = await supabase
    .from('brief_sources')
    .select('position, title, url, domain, tier, origin, published_date, full_text_retrieved')
    .eq('brief_id', id)
    .order('position');

  const srcRows = sources || [];
  const companies = brief.primary_companies || [];

  const stats = [
    ['Impact', brief.impact_score ?? '-'],
    ['Confidence', brief.confidence_score ?? '-'],
    ['Sources', brief.source_count ?? 0],
    ['Primary', brief.tier1_count ?? 0]
  ];

  return (
    <main className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-900">
            &larr; Back to feed
          </Link>

          <div className="mt-5 flex items-start gap-4">
            <div className={'flex h-12 w-12 shrink-0 items-center justify-center rounded text-base font-semibold text-white ' + impactColour(brief.impact_score)}>
              {brief.impact_score ?? '-'}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-stone-100 px-2 py-0.5 font-medium uppercase tracking-wide text-stone-600">
                  {brief.category || 'other'}
                </span>
                <span className="text-stone-400">{formatDate(brief.created_at)}</span>
                <span className="text-stone-400">Topic: {brief.topic}</span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-stone-900">
                {brief.headline}
              </h1>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded border border-stone-200 bg-stone-200 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s[0]} className="bg-white px-4 py-2.5">
                <div className="text-lg font-semibold text-stone-900">{s[1]}</div>
                <div className="text-xs text-stone-500">{s[0]}</div>
              </div>
            ))}
          </div>

          {companies.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {companies.map((c) => (
                <span key={c} className="rounded border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-700">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <article className="rounded border border-stone-200 bg-white px-7 py-6 text-[15px]">
          {renderMarkdown(brief.brief_markdown)}
        </article>

        <section className="mt-6 rounded border border-stone-200 bg-white px-7 py-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-900">
            Sources ({srcRows.length})
          </h2>
          <ol className="space-y-3">
            {srcRows.map((s) => (
              <li key={s.position} className="flex gap-3 text-sm">
                <span className="mt-0.5 shrink-0 text-xs font-medium text-stone-400">
                  S{s.position}
                </span>
                <div className="min-w-0">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-stone-900 underline decoration-stone-300 underline-offset-2 hover:decoration-stone-900"
                  >
                    {s.title}
                  </a>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    <span>{s.domain}</span>
                    <span className={'rounded px-1.5 py-0.5 ' + (s.tier <= 2 ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600')}>
                      tier {s.tier}
                    </span>
                    <span>via {s.origin}</span>
                    {!s.full_text_retrieved && (
                      <span className="text-amber-700">headline only</span>
                    )}
                    {s.published_date && <span>{s.published_date}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}