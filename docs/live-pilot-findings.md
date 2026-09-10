# Real-model feasibility pilot: 2026-09-07

The frozen benchmark/Mirai composition did not solve the selected short text
labyrinths. This is a negative integration result, not a proof that every Mirai
implementation or every configuration of these models will fail.

## Scope and outcome

- Models: gpt-4o-2024-11-20, gpt-5.6-luna, gpt-5.6-terra, gpt-5.6-sol.
- GPT-5.6 reasoning effort was explicitly none; GPT-4o temperature was zero.
- Four smoke trials, then one different independent seed at length 10, one
  repetition, three conditions and six memory/change phases: 72 pilot trials.
- Conditions: plain model, native Mirai without memory, native Mirai with Files
  working memory. Fixed routing, system_bundle, no external Python tool.
- Mirai package: 2.6.0-alpha.1. Native TaskHost, Cognition, compiler and runtime
  APIs were used; no task-specific generated program or oracle was supplied.
- Correct solving outcomes: 0/64 allocated solving trials, including smoke.
  Failed, blocked and uncertain cases remain in this denominator.
- Revocation controls: 9/12 passed; three were not reached because their groups
  had already stopped. These adapter controls are not model reasoning successes.
- Actual API calls: 57. Three calls have unknown usage/outcome and were not retried.
- Known conservative cost estimate: USD 0.7800598. Unknown-call reserved upper
  estimate: USD 0.421572. Their sum is about USD 1.202, below the USD 20 campaign
  ceiling. Provider billing and account balance were not independently verified.

## Confirmed integration problems

1. The plain prompt mentions an optional Python response even when no tool is
   available. Five retained GPT-4o pilot responses requested that unavailable
   tool. The first smoke output was not retained, so its precise cause is unknown.
   Future prompts must describe only the tools actually available in that mode.
2. The Mirai adapter supplies the compiled IR schema, including a required digest,
   when requesting authored program source. The public compiler can generate
   that digest when it is omitted. Of 30 retained generated programs, all failed
   compilation; 26 first failed the supplied-digest check. This source/IR mismatch
   is an adapter confound. Other inspected candidates also used unsupported node
   kinds, expressions or undeclared state; removing a digest is not a proven fix.
3. Native Mirai operations retain a 30-second cap inside the outer 180-second
   group deadline. Three inference calls outlived the native operation and became
   uncertain. Their groups stopped; independent preregistered groups continued
   only after an explicit local quarantine review. Receipts were not rewritten.
4. The frozen composition uses one-shot generation. It does not demonstrate a
   native defect-directed repair loop. No successful program was available for
   reuse, so this pilot cannot establish a working-memory speedup or quality gain.

## Evidence and limits

TS and independent Python evaluators recomputed matching expected outcomes.
Task packet bytes matched across all 12 pilot conditions. Journal validation,
configuration bindings and no-duplicate-inference checks passed. Exact credential
scanning found no copy of the host key in 414 selected local text artifacts;
this is not an independent security audit or a universal secret-leakage proof.

Local run journals, response diagnostics, model profiles, source archive, analysis
and quarantine receipts are retained in the ignored campaign output directory.
The profiles record transport qualification only, not fabricated program-quality
scores. Mirai installation metadata was captured during the campaign, not before
every call; this limits exact installation-immutability claims.

This is an author/agent-operated feasibility pilot, not human-reviewed research,
an independently reproduced result, a leaderboard entry or a production gate.
One seed and repeated phases do not provide a statistically supported model
ranking. No 100/1000-layer live success, adaptive-routing benefit or general
weak-model capability claim follows from these results.

## Next bounded experiment

Correct tool-aware instructions and the source-language reference in a new
candidate. Verify one small live program-generation path before a larger matrix.
Use supported Mirai correction and cancellation interfaces; do not implement a
replacement cognitive kernel in the benchmark. Preserve this campaign unchanged,
including all failures, and preregister the new configuration and remaining
spending authorization before any new calls. Expand to independent seeds and
longer chains only after the short end-to-end path is functional.
