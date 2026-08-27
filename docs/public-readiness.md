# Public-readiness checklist

Objective gates for making the repository public. Only items actually verified are
marked done. Last updated: 2026-08-27, branch `feat/portfolio-proof`.

| # | Gate | How it is checked | Status |
|---|---|---|---|
| 1 | `npm run build` green | `cd web && npm run build`; also with CI placeholder env and no `.env.local` | ✅ done |
| 2 | `npm run lint` green | `cd web && npm run lint` | ✅ done |
| 3 | All `workflows/*.json` valid JSON | `node -e "JSON.parse(...)"` per file; also in CI | ✅ done |
| 4 | GitHub Actions CI green | `.github/workflows/ci.yml` on push/PR | ✅ done — green on `feat/portfolio-proof` |
| 5 | Current-tree secret scan clean | `git grep` for key/token/PEM/DSN patterns over tracked files (excl. lockfile) | ✅ done — 0 matches |
| 6 | Full Git-history secret scan clean | `git log --all -p` through the same patterns; check for any `.env`/key files ever added | ✅ done — 0 matches; only `web/.env.local.example` (placeholders) ever committed |
| 7 | LICENSE present | file at repo root | ✅ done — MIT |
| 8 | README screenshots present | `docs/img/feed.png`, `brief-digital-euro.png`, `about-limitations.png` embedded in `README.md` | ✅ done |
| 9 | Positive behaviour shown | published `digital euro` brief: live feed, `docs/img/brief-digital-euro.png`, `docs/evaluation.md` Case 1, `evaluation/` fixture (all captured fields PASS) | ✅ done |
| 10 | Refusal behaviour shown | adversarial `Veltrix Pay` run: `docs/evaluation.md` Case 2, `evaluation/fixtures/case-02-veltrix-pay.result.json` (complete, all PASS) | ✅ done |
| 11 | Architecture docs current | `docs/architecture.md` matches the committed workflow export (nodes, publication gate, models, ERD, metadata schema, HTML trust boundary) | ✅ done |
| 12 | HTML sanitisation implemented | `/reports` renders `report_html` through `web/lib/sanitizeReportHtml.js` (allowlist) | ✅ done |
| 13 | No client / employer / confidential information | manual review of docs, workflows, evaluation; only public sources, (planned) synthetic data | ✅ done |
| 14 | n8n form-trigger has no auth — documented | `README.md` limitations + Roadmap, `docs/architecture.md`, `docs/progress.txt` | ✅ done — see note |
| 15 | Tavily pay-as-you-go decision documented | `README.md` Cost section + `docs/progress.txt` | ✅ done — see note |
| 16 | Repository still private until final approval | GitHub repo visibility | ✅ private — do not change without explicit approval |
| 17 | Evaluation harness runs | `node evaluation/validate.mjs` exits 0 | ✅ done — 22 pass / 0 fail / 2 not-captured (both optional `case-01` fields) |

## Optional, not blocking

- **Verbatim sample files.** `sample-outputs/` intentionally contains only a note
  explaining why raw briefs are not committed yet. The two behaviours are already
  demonstrated by the live site, the screenshots, and the evaluation record, none of
  which can be silently edited. Pinning specific verbatim runs can happen later.
- **`evaluation/validate.mjs --strict`.** Passes on every field that was recorded.
  Three optional `case-01` values (`extract_metadata.category`,
  `return_result.brief_id`, `db_rows_for_topic`) were not captured at run time and are
  marked `_not_captured`; filling them would let `--strict` pass too. The published
  brief already proves the positive case.

## Notes

**Item 14 — form-trigger auth.** The On-Demand Brief workflow's form trigger has
`Authentication: None`. Acceptable only while n8n runs locally and unexposed; it must
be secured (or removed) before the instance is hosted anywhere reachable. This does
not block making the *repository* public — no credential or endpoint is exposed by the
code.

**Item 15 — Tavily.** Pay-as-you-go billing is enabled. At the current cadence (basic
depth, `max_results: 8`, one scheduled run every two days over five topics) usage is a
small fraction of the free tier. Decision of record: leave as-is now; disable before
raising volume, frequency or search depth.

## Verdict

All blocking gates (1–16) are ✅. The two "optional, not blocking" items are cosmetic
given the screenshots and evaluation record. The repository is ready for a final human
review and, on approval, for going public.
