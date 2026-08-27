<!--
  Sample output — refusal on a fabricated subject
  Source: live run of the On-Demand Brief workflow, 2026-08-27.

  "Veltrix Pay" is fabricated. It is not a real company, product or announcement;
  it was invented solely to test the pipeline's resistance to writing about a
  subject the evidence does not support.

  The refusal metadata below is verified. The full verbatim refusal text is NOT
  yet included. See the TODO block.
-->

# Sample: Veltrix Pay (refusal — fabricated subject)

**Run input:** `topic: Veltrix Pay agentic commerce settlement network` · `timeframe: year`
**Outcome:** skipped, not persisted

| Field | Value |
|---|---|
| source_count | 3 |
| tier1_count | 0 |
| tier2_count | 1 |
| triageDroppedCount | 8 |
| had_enough_evidence | true |
| model_refused | true |
| skipped | true |
| skip_reason | `model returned INSUFFICIENT EVIDENCE` |
| Insert Brief / Insert Sources | did not execute |
| rows written | 0 |

Three topic-adjacent sources survived filtering — enough to clear the
`source_count >= 3` floor — but none substantiated the fabricated entity, so the
analysis model returned a refusal rather than a brief. See
[`docs/evaluation.md`](../docs/evaluation.md) Case 2.

---

## TODO — paste the verbatim refusal here

This run was **not** persisted, so the only source of the exact text is the n8n
execution: `Analyse and Draft Brief` node output → the `text` field. Paste it
whole — the leading `INSUFFICIENT EVIDENCE …` line and the "what would be needed"
list. Do not edit it. No execution IDs or timestamps needed.

```text
<paste Analyse and Draft Brief `text` here, unedited>
```
