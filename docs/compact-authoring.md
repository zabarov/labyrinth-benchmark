# Compact Program Authoring

## Scope

The optional `examples/mirai-compact-authoring-host.mjs` participant uses the
same Mirai Program language and installed compiler. It does not receive a
prepared maze program, graph, route or oracle. All actual behavior and data
must still be produced from the participant's text packet by the model.

Changes from the earlier scoped-repair participant:

- The model returns direct authored JSON, not a JSON-encoded program_source
  string. Raw bytes, including malformed or duplicate-key output, are retained
  in the inference record and rejected through native verification.
- A compact task-independent authoring guide replaces the full schema in the
  model context. An executable inventory example demonstrates reading a record
  from a list and then accessing a field. It does not implement a maze.
- For repair, short host-scoped target handles replace model-generated source
  and item checksums. Native Mirai supplies frozen integrity bindings and
  validates the ordinary expanded CAS edit proposal. Proposed values remain
  model output; no missing behavior is inferred by the host.

The default participant and explicit CAS repair transport remain unchanged.
This participant is currently `system_bundle` only. `matched_tools` with direct
authoring fails explicitly rather than silently using a different protocol.

## Binding and Safety

A short-handle response is not a portable patch. It is meaningful only in the
frozen host session identified by source, scope and target-map bindings in the
request/verification context. The same handle may name another entry in a
different session. Inference records retain the raw output digest separately
from the expanded repair digest.

Unknown or repeated handles, altered entry IDs, new fields, duplicate JSON
keys, nonfinite values and unauthorized sections fail closed. The full compiler,
typed runtime, bounded root ledger and separate Outcome review remain required.
Neither a short handle nor a compiled program grants execution or acceptance.
Warm reuse still requires a fresh source review.

## Measured Format Overhead

On task-independent reference examples:

| Material | Earlier bytes | Compact bytes |
| --- | --- | --- |
| Language reference | 11558 | 4610 |
| Example program response | 2023 wrapped | 1646 direct |
| One source repair | 276 CAS | 77 handles |

The two repair representations produce identical compiled Program digests.
These are UTF-8 byte measurements, not tokenizer counts, monetary savings or
proof of better model reasoning. The local measurement script is
`source/measure-authoring-overhead.mjs`.

## Verification

Local native TaskHost/Cognition/Runtime/Program suite: 431/431. Core benchmark:
43/43. Four new connected scenarios cover direct cold/warm execution, native
handle repair and warm review, unknown-handle refusal, and duplicate-JSON
refusal with retained usage through the existing bounded retry policy.
Recorded results establish transport integration, not live model efficacy.

No publication or release is implied. The previous broader release and
independent-review limitations still apply.

## Fresh Live Smoke

One previously unused length-10 task, seed `blind-compact-source-01`, was run
once with fixed `gpt-5.6-luna` in `system_bundle` mode. Both participants received
identical task bytes. Independent TypeScript/Python evaluators agreed after
execution. This is a connection smoke, not a statistically supported comparison.
Plain had a one-call ceiling; Mirai had a five-call ceiling, not matched tools
or equal call budgets.

| Participant | Exact outcome | Calls | Known cost estimate, USD |
| --- | --- | --- | --- |
| Plain | 0/1 | 1 | 0.0004518 |
| Mirai compact authoring | 0/1 | 3 | 0.0079134 |

Plain returned 2 instead of 17, with 0/10 correct transitions. Mirai followed
generation, diagnosis and rebuild; the repair failed compiler, result protocol
and source-repair admission. No source Outcome review was reached and no false
Mirai completion was accepted. This trial therefore does not demonstrate live
semantic correction or a weak-model advantage.

Mirai input/output tokens by call were 2171/2297, 5273/514 and 6176/946.
The generation input was smaller than the prior smoke's 3900 tokens, but the
seeds differ: this is descriptive evidence, not a controlled estimate of cost
or quality improvement. The complete pair cost estimate was USD0.0083652.
Failures remain in the denominator; previous trials were not rescored.

Local evidence: `source/output/blind-smoke-compact-2026-09-07/`, including frozen
preparation, terminal journals and `post-run-analysis.json`. Cumulative known
estimates are USD5.8243777; retaining eight historical uncertain calls and
whole-job reserves yields USD19.72558585 conservative exposure out of USD20.
The remaining conservative headroom is USD0.27441415. No new uncertain calls
or active runners were observed. This is accounting from receipts/reservations,
not a reconciled provider invoice.

The bounded local stage is complete. Full release readiness is not established:
the historical frozen 2.4 retrieval-surface gate remains unresolved, and this
candidate has no new independent security review or cross-platform release
matrix. Further work should investigate verified semantic decomposition on
offline regression cases before paying for a larger, preregistered comparison.
