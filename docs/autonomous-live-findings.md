# Autonomous live diagnostics - 2026-09-07

The tested Mirai composition can generate and execute a correct program from
unseen task text, and working memory can reuse that program without another
model call. This does **not** establish superiority over a plain model. The final
small comparison favored plain Sol on total cost and completed outcomes.

## Final preregistered feasibility comparison

One fresh seed, 10 layers, one repetition, five solving phases followed by one
revoked-access control. All three conditions used gpt-5.6-sol, low reasoning,
system_bundle without Python, the same text and explicit result criteria, and
the same per-group ceilings: 12 calls, 200000 input tokens, 32768 output tokens,
USD3.50 and 300 seconds. Mirai used its public 2.6.0-alpha.1 APIs.

| Condition | Exact solving phases | Revocation control | Calls | Conservative API cost |
|---|---:|---:|---:|---:|
| Plain model | 5/5 | 1/1 | 5 | USD0.079245 |
| Mirai, memory off | 3/5 | 1/1 | 5 | USD0.757685 |
| Mirai, memory on | 3/5 | 1/1 | 6 | USD0.866730 |

These phases are correlated, not five independent tasks. Revocation is enforced
by the participant boundary without model inference; it is not a model reasoning
success. Two failed phases in the memory-on run followed exhaustion of its shared
output-token budget. The memory-off new-scope phase also exhausted that budget.
The memory-off cold program returned a non-successful result. Failed phases stay
in the denominator; a source-scope failure caused by budget exhaustion does not
demonstrate successful live scope isolation.

## What working memory demonstrated

The memory-on cold run needed three model calls and USD0.505330. Its unchanged
repeat reused the identical source/program digests, returned the independently
verified full result in 0.706 seconds, and used zero model calls and zero new API
tokens. The memory-off unchanged phase needed one call, USD0.178965 and 65.075
seconds. This is one observed warm-reuse contrast, not a population speedup.

After a source edit, memory was not reused: a new program digest was generated
with two model calls and the edited task passed. Goal change exhausted the shared
output allowance, and the following new-scope phase could not infer. Cold plus
warm cost was USD0.505330 with memory versus USD0.338090 without it; across this
entire pilot, memory did **not** save total cost or raise the success count.

## How the diagnostic progressed

- Historical pilot: 57 real calls, no exact solving outcome. Preserve it.
- Corrected one-shot smoke: four models, eight assigned cold trials, no exact
  outcomes. It fixed a plain-model unavailable-tool prompt and a Mirai digest
  authoring mismatch, not model reasoning itself.
- Medium-reasoning plain Terra and Sol each solved a new short task. The first
  matching Mirai jobs failed before inference because the experiment requested
  a 600-second TaskHost policy, above the public 300-second ceiling.
- Correcting that configuration exposed a different limit: both Mirai models
  consumed an 8192-token completion allowance entirely on reasoning. This was
  not evidence of an incorrect executed program.
- A low-reasoning, larger-output diagnostic produced real compiled programs.
  Sol's first candidate failed compilation; native Cognitive Kernel correction
  generated a compilable second candidate. All ten transitions were correct,
  but it returned left_count instead of the requested final state and an invalid
  status. It remained an exact failure, not a retrospectively repaired success.
- Audit found unequal clarity of output requirements in the adapters. After
  making the permitted statuses and goal/value mapping explicit, Sol solved a
  fresh text-to-program task in one call, costing USD0.150865. That task was not
  selected into the final memory pilot.

Compiler acceptance, successful execution, and exact task completion remain
different verdicts. Mirai's compiler-directed correction worked on real outputs;
this narrow bridge does not implement a complete semantic Outcome repair loop.
None of the observed problems alone proves a defect in all possible Mirai
compositions. GPT-4o and Luna were not rerun under the final corrected conditions,
so the final experiment does not establish weak-model amplification.

## Accounting and evidence boundaries

Across the historical campaign and all new diagnostics: 89 API calls, known
conservative usage estimate USD3.27613255, retained unknown-call reservations
USD1.310326, cumulative upper accounting USD4.58645855 against the owner's USD20
ceiling. USD15.41354145 remains unallocated. This is not a billing reconciliation.
No uncertain call was retried; historical records and reservations were preserved.

The host transport now accounts for validated usage on length-terminated replies
but rejects their content, even if it looks like complete JSON. Earlier records
are not rewritten to use this newer classification.

Local evidence lives under `source/output/`: separate frozen campaign configs,
source digests and backups, profiles, immutable historical run bindings,
per-phase reports, compiler diagnostics, native program/episode/cache artifacts,
and `autonomous-diagnostic-summary.json`. Raw API content is host-local synthetic
evidence, not included in public exports. No key, production document, product
installation, Mirai repository, or Federation installation was changed.

## Next platform work

1. Connect explicit result contracts, execution verification and bounded semantic
   correction through public Mirai operations. Do not equate compilation with
   completion or insert the benchmark oracle into a participant.
2. Reduce text-to-program construction overhead using audited native semantic
   drafts and compilation, rather than requiring a model to emit large verbose IR.
   Do not implement a maze-solving replacement kernel inside this benchmark.
3. Preserve warm reuse while measuring cold construction and correction costs.
   Distinguish candidate caching from evidence-based semantic acceptance.
4. Freeze a revised candidate, then use multiple independent seeds, repeats,
   matched reasoning/tool budgets, and the weaker models. Keep all failures.

This is an author-run engineering diagnostic on a tiny synthetic corpus. It is
not an independent replication, human review, production certification, variance
pilot, long-chain live proof, or claim that Mirai generally improves weak models.
