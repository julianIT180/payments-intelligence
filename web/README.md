# Frontend

Next.js (App Router) reader for the Payments Intelligence database. Read-only: every page
is a server component that queries Supabase directly. There are no API routes and no
mutations.

For the project as a whole — what it does, why, and how the pipeline works — see the
[repository README](../README.md).

## Stack

Next.js 16 · React 19 · Tailwind CSS 4 · `@supabase/supabase-js` · `sanitize-html`
(allowlist for the stored weekly-report HTML) · deployed on Vercel.

Pages are written as `.js` rather than `.tsx` deliberately. `create-next-app` installs the
TypeScript toolchain and the config stays in place; the application code is plain
JavaScript because the type surface here is one Supabase client and a handful of row
shapes.

## Routes

| Route | Reads | Content |
|---|---|---|
| `/` | `briefs` | Feed — key figures and brief cards, impact colour-coded, confidence as a bar |
| `/brief/[id]` | `briefs`, `brief_sources` | Full brief, ranked source list with tier, origin and headline-only markers |
| `/companies` | `briefs` | Grouped by company, sorted by frequency |
| `/reports` | `weekly_reports` | Weekly reports, newest first — stored HTML passed through an allowlist sanitiser (`lib/sanitizeReportHtml.js`) before render |
| `/about` | — | Method, score definitions, stated limitations |

## Local development

```bash
npm install
cp .env.local.example .env.local   # then fill in the two values below
npm run dev
```

`.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
```

Use the **publishable** key. `service_role` bypasses row-level security and must never
reach the browser. Both variables are `NEXT_PUBLIC_*` and are therefore visible in the
client bundle by design — the security boundary is the database grant and the RLS policy,
not the key.

`.env.local` is gitignored and is **not** uploaded to Vercel. Deployment environment
variables have to be set separately in the Vercel project settings.

## Database access

Reading requires two independent things to be true:

1. `grant select on public.briefs to anon` — may the role touch the table?
2. a row-level-security policy — which rows may it see?

A policy without the grant fails with `permission denied for table briefs`, which points at
the wrong layer. Because *Automatically expose new tables* is switched off in the Supabase
project, the grant is issued manually. Both are in [`db/schema.sql`](../db/schema.sql).

## Deployment

Vercel, with **Root Directory set to `web`**. Left at the repository root, the build fails
with `No Next.js version detected`.
