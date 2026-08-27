# Public-readiness checklist

Objective gates for making the repository public. Only items actually verified are
marked done. Last updated: 2026-08-27, branch `feat/portfolio-proof`.

| # | Gate | How it is checked | Status |
|---|---|---|---|
| 1 | `npm run build` green | `cd web && npm run build` (also with CI placeholder env, no `.env.local`) | ✅ done |
| 2 | `npm run lint` green | `cd web && npm run lint` | ✅ done |
| 3 | All `workflows/*.json` valid JSON | `node -e "JSON.parse(...)"` over each; also `evaluation`/CI | ✅ done |
| 4 | CI green | `.github/workflows/ci.yml` on push/PR | ⏳ pending first GitHub run (config added; not yet executed on GitHub) |
| 5 | Current-tree secret scan clean | `git grep` for key patterns over tracked files (excl. lockfile) | ✅ done — 0 matches |
| 6 | Full Git-history secret scan clean | `git log --all -p` piped through the same patterns; check for any `.env`/key files ever added | ✅ done — 0 matches; only `web/.env.local.example` (placeholders) was ever committed |
| 7 | LICENSE present | file at repo root | ✅ done — MIT |
| 8 | README screenshots present | `docs/img/` contains the three referenced PNGs | ❌ not done — placeholders only; filenames listed in `docs/img/README.md` |
| 9 | Successful sample present | `sample-outputs/2026-08-27-digital-euro.md` contains the verbatim brief | ⚠️ partial — verified metadata + TODO; brief body not yet pasted |
| 10 | Refusal sample present | `sample-outputs/2026-08-27-veltrix-pay-refusal.md` contains the verbatim refusal text | ⚠️ partial — verified metadata + TODO; refusal text not yet pasted |
| 11 | Architecture docs current | `docs/architecture.md` matches the committed workflow export (nodes, gate, models, ERD) | ✅ done — re-synced after the evidence-gate and metadata-schema changes |
| 12 | HTML sanitisation implemented | `/reports` renders `report_html` through `web/lib/sanitizeReportHtml.js` (allowlist) | ✅ done |
| 13 | No client / employer / confidential information | manual review of all docs, workflows, samples; project uses only public sources and (planned) synthetic data | ✅ done |
| 14 | n8n form-trigger has no auth — documented | `README.md` limitations, `docs/architecture.md`, `docs/progress.txt` open points | ✅ done — see note below |
| 15 | Tavily pay-as-you-go decision documented | `docs/progress.txt` open points + note below | ✅ done — decision of record: left enabled at current low volume; disable before any volume/frequency increase |
| 16 | Repository still private until final approval | GitHub repo visibility | ✅ private — do not change without explicit approval |
| 17 | Evaluation harness runs | `node evaluation/validate.mjs` exits 0 | ✅ done — 22 pass / 0 fail / 2 incomplete (case-01 `brief_id`, `db_rows_for_topic`) |

## Notes

**Item 14 — form-trigger auth.** The On-Demand Brief workflow's form trigger has
`Authentication: None`. This is acceptable only while n8n runs locally and is not
exposed. It must be secured (or the form trigger removed) before the n8n instance is
hosted anywhere reachable. This does not block making the *repository* public — no
credential or endpoint is exposed by the code — but it is a stated limitation.

**Item 15 — Tavily.** Pay-as-you-go billing is enabled on the Tavily account. At the
current cadence (basic search depth, `max_results: 8`, one scheduled run every two
days over five topics) usage is a small fraction of the free tier. Decision of
record: leave as-is now; disable pay-as-you-go before raising volume, frequency, or
search depth. Tracked in `docs/progress.txt`.

## Blocking vs non-blocking for "make public"

- **Blocking:** items 1–7, 11–13, 16 — all ✅.
- **Recommended before public (not strictly blocking):** 4 (let CI run once and go
  green), 8 (screenshots), 9–10 (paste the two verbatim samples).
- **Not blocking the repo, tracked as limitations:** 14, 15.
