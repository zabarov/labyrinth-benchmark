# Native Outcome Follow-up: Local Readiness

## Decision

Latest bounded-stage result: see [Outcome Repair Findings](outcome-repair-findings.md).
The local implementation and smoke stage is complete, but the broader
reliability claim below remains unproven. Do not confuse stage completion with
release readiness or successful weak-model performance.

The local diagnostic implementation is testable, but the reliability goal is
not complete. Do not release or deploy this candidate as a reliable autonomous
completion system. Do not claim weak-model superiority or general cost savings.

The participant now uses native Program, TaskHost, Cognition, Outcome and Working
Memory APIs. Required review, shared budgets, immutable inputs and replay are
integrated. Integration is distinct from semantic correctness: a live Terra
review accepted an incorrect answer, while a live Sol review rejected a correct
length-100 candidate. Both remain in the failed-trial denominator.

## Latest Live Limitation

The fresh scoped-repair smoke remains 0/1 for plain and Mirai. Its actual
sequence was generation followed by two blind-review attempts, not repair.
Generation produced a valid compact Program with incorrect routing; the final
blind reconstruction was also wrong. Independent post-run TS/Python evaluators
agree. Outcome prevented acceptance, but semantic rejection did not activate
the participant's inference-defect repair path. Follow-up source inspection
corrected the initial diagnosis: native TaskHost already derives an Outcome-bound
refinement defect. The missing piece is participant orchestration, not a new
cause contract. An opt-in integration now uses a read-only host accessor and
retains the accepted inference, rejected Outcome, and original root budget.

A separate native probe also confirms missing state-type enforcement at a call
result assignment: an int64 slot accepted a string while an unrelated valid
output allowed completion. Result assignments now validate the existing state
type before mutation across call, foreach, parallel, await, retry and timeout.
Eight regression cases failed before the fix; the revised Runtime/Program suite
passes 109/109 and Cognition 178/178. A settled invalid effect is not executed
again on resume. These checks do not establish model quality.

Latest accounting: known estimates USD5.80510115; whole-job conservative bound
USD19.7063093 including all previous uncertainty. The new pair cost USD0.0061047
and introduced no unknown calls. No general quality or cost advantage is proven.

## Checked Implementation

- Optional `examples/mirai-scoped-repair-host.mjs` composes native syntax scope,
  raw patch admission, immutable child refinement, exact compiled IR execution
  and blind source review. It is experimental and uses no benchmark-side solver.
  Invalid bases or excessive scopes fail explicitly, without a silent strategy
  switch. Nine recorded scoped scenarios include rejected repairs and warm reuse.
- The warm blind-review route now preserves its configured strategy. The failed
  regression and corrected rerun are both retained; warm reuse is not acceptance.
- Latest repair-local checks: native Cognition + Program 198/198, benchmark core
  43/43, connected source review/reference 2/2. These are not live efficacy data
  or a replacement for the older full-service compatibility run below.

- Generic bounds-checked `pure.list_get` supports compact data-driven Programs.
- Native asynchronous pure verification runs within cancellation and deadlines;
  generation, correction and source review use the same TaskHost root budget.
- Source review is mandatory by default. Memory stores candidates, not approval;
  warm runs execute and review again. Revoked access returns a safe refusal.
- The authoring reference reflects the allowed host subset and no longer both
  requires and forbids compiler-generated fields. Generic examples validate
  against that schema and compile through the installed public compiler.
- Protocol correction localizes duplicate rows, broken state continuity,
  invalid fields and result-contract mismatches. It exposes no expected route
  or oracle and does not weaken the original result criteria.
- Core benchmark tests: 38/38. Diagnostic/refinement/source-review integration:
  7/7, including source-vs-compiler artifact binding and sanitized transport errors.
- Latest native full suite: 712/712 in one invocation with ephemeral PostgreSQL,
  MySQL and S3 services, and a public example.com HTTP smoke. All three owned
  containers were removed and absence was verified. The earlier no-services
  invocation remains recorded as 711/712, not silently replaced.
- These local checks do not constitute independent security review or
  Linux/macOS/Windows clean-room certification.
- The broader legacy `npm test` stops at `frozen_2.4_retrieval_surface_changed`.
  Read-only comparison proves `src/retrieval/local.ts` already differs from the
  historical retrieval lock in the starting commit, not because of this batch.
  The old lock/results and validator were not rewritten to force a pass. A
  separate current-retrieval evaluation and historical-evidence boundary decision
  remain necessary before claiming full release readiness.

## Observed Live Results

All results below are diagnostic, not confirmatory. Model aliases and settings
are recorded in individual configurations. Profiles prove API transport, not
semantic-verifier accuracy. Candidate versions and source seeds differ between
stages; do not pool them into a ranking or a causal before/after estimate.

- One short Sol smoke passes with and without Mirai; Mirai is more expensive.
- One shared-source length-10 comparison: plain/Mirai exact outcomes are
  4o 0/0, Luna 0/0, Terra 0/0 and Sol 0/1, one trial per cell.
- In that Terra trial, the reviewer accepts a trace with 2/10 correct transitions.
- In one memory sequence, plain, Mirai without memory and Mirai with memory
  each pass six phases. Mirai memory reduces observed within-Mirai cost by
  about 15.6%, but remains more expensive than plain.
- Two length-100 Mirai trials fail end to end. The first candidate computes
  the correct route but review rejects it; the second fails protocol admission.
  Their plain controls pass. Live length-1000 escalation is therefore withheld.
- Capability-projected 4o and Luna probes remain unsuccessful. Luna can compile
  candidates but produces invalid traces. A later localized-diagnostic Luna
  probe also remains unsuccessful within three generation calls.
- Offline execution of a prepared 1000-level representation passes. It does
  not establish live text-to-program performance at that length.
- Connected Luna recovery on the development seed fails diagnosis admission;
  the revised artifact-scoped candidate also fails because the model changes
  the required diagnostic field structure. Both are retained as 0/1 outcomes.
- A fresh length-10 seed gives plain 0/1 and Mirai an uncertain second call;
  no success is claimed. This trial is not automatically retried. New paid
  stages are held for reconciliation, while local verification may continue.

Known usage estimates after these stages: USD5.78378505. Held unknown exposure:
USD1.6069184. Conservative total: USD7.39070345 of the original USD20. This is
not invoice reconciliation. Uncertain calls are not silently retried.

## Remaining Work, in Order

### Diagnostic Refinement Preparation Checkpoint

`prepareMiraiDiagnosticRefinement` now prepares a native two-operation child
plan: diagnose the settled defect, then rebuild with the original full contract.
It uses installed native qualification and proposal admission, preserves parent
digests, authority and budgets, and never accepts an outcome. Recorded public-API
tests execute the children in the original TaskHost ledger. A two-call root
blocks the third call; a three-call root completes both children. Replay calls
no provider. These are orchestration tests, not real-model quality results.

The participant now uses `createCognitiveTaskReceiver` instead of wrapping the
low-level inference function manually. Known verification rejection retains its
native `failed` classification rather than becoming an uncertain provider
failure. The native receiver also supplies the refinement execution interface.
Historical trials are unchanged; this repair does not retrospectively make them
successful or alter their cost records.

The optional `examples/mirai-refinement-host.mjs` now connects settled rejection
to source-bound diagnosis, native child-plan activation, original-contract
rebuild and ledger-bound semantic review. It reserves a four-call root before
starting, with one initial generation and no recovery of uncertain effects.
Default participant behavior remains unchanged for historical comparisons.

The native `TaskHost.refinementSemanticVerifier` now provides the missing
candidate-specific binding: it checks the refined candidate digest, verified
pure preparation, governed reviewer inference and current authorization while
leaving the original failed task unchanged. The rebuilt native cognition suite
passes 175/175 tests, including supported/contradicted, wrong-candidate and
revoked-access cases. The connected path uses minimal reviewer context and a
separately bounded nested Outcome replay artifact. Four recorded integration
tests pass, including forged quotation, uncertain-effect stop, a shared root
budget and fresh review on cache reuse. These do not prove model judgement quality.

1. Reconcile or explicitly disposition the new uncertain call without retrying
   it, releasing its reservation without evidence or changing its trial result.
   Verify the connected diagnostic refinement on live tasks. A quoted source
   span proves only its location, not the proposed repair's correctness.
   Diagnosis followed by rebuild is structural decomposition, not proof that
   the model's difficult reasoning has been made easier.
2. Strengthen source-semantic admission with auditable, tool-checked evidence
   where available. A model verdict, even explained, is insufficient by itself.
   Separate extraction correctness, Program construction and execution checks;
   preserve uncertainty for criteria without a trustworthy verification method.
3. Re-test known failures and fresh held-out seeds separately. Do not optimize
   on one seed and report it as independent confirmation. Compare fixed and
   explicitly authorized adaptive conditions separately.
4. Proceed to longer live tasks only after short and 100-level gates pass and
   full-trace output, token, time and cumulative cost ceilings are feasible.

Source-reviewed matched-tools remains an explicit incompatibility, not a silent
fallback. Product systems and the installed Federation are unchanged. No push,
tag, npm publication or production rollout is authorized by these checks.

Local evidence is retained under `source/output/source-review-*`; the post-trial
reporter `source/summarize-source-review.mjs` checks journal bindings and emits
the per-campaign summary. See [implementation notes](native-outcome-economy.md).

## Offline Diagnostic Transport Follow-up

The adapter now requests a direct diagnostic JSON object instead of JSON nested
inside program source. Native refinement IO and original Outcome requirements
are unchanged. Diagnostic protocol version is bound to recovery, receiver and
memory processor identities; cached candidates never carry acceptance.

A frozen-adapter comparison with identical recorded outputs reduced diagnostic
input from 38,045 to 20,657 UTF-8 bytes (45.7%) and total cold input from 80,708
to 63,320 bytes (21.5%). This is one offline transport case, not measured token
savings, model quality, cost or latency. Artifact:
`source/output/diagnostic-transport-measurement.json`. No paid calls were made.
Malformed diagnostic objects and null outputs fail verification while retaining
known usage. Real-model quality and the uncertain-call reconciliation remain
open; this follow-up does not change release readiness.

## Settled Reviewer Output

Malformed reviewer JSON is now a host verification defect, not an unknown
provider effect when usage was received. A host-generated transport validity
flag is required for admission; invalid payloads become sanitized non-accepting
diagnostics. The model cannot supply this flag. Retry remains within the same
TaskHost root budget. Missing usage and genuine response loss remain uncertain.

Core tests pass 39/39. Connected source-review integration covers recovery on
the second review and repeated malformed output: both retain usage, consume
three total calls including generation, replay without providers, and the latter
never accepts completion. These are recorded tests, not live quality evidence.
Historical uncertain calls are not reclassified by this fix.

## Experimental Blind Reconstruction

`examples/mirai-blind-review-host.mjs` explicitly selects bounded refinement
with `review_strategy: blind`. Existing verdict review remains the baseline.
The same fixed model independently reconstructs a full result from the original
text, goal and constraints. The reviewer prompt omits the executor result and
its digest. No task parser, generator or evaluator is imported by the comparator.

The host compares every node, before/after state, branch and final goal value.
Malformed or truncated reconstructions fail admission; unavailable reconstruction
is uncertain. Recorded output retains reconstruction chunks, the program-output
digest and the executed-value digest separately. The strategy version is bound
to receiver, review and memory processing identities. All calls use TaskHost
authorization and its existing shared budget; no separate runtime is introduced.

This tests whether removing answer anchoring reduces false acceptance. Agreement
is not semantic proof: the same model can independently repeat the same error.
A regression explicitly preserves that limitation rather than hiding it. Full
reconstruction adds output cost and can hit output ceilings on longer tasks.
It has not yet been tested live and is not a replacement for evaluator scoring.

## Authoring Reference Follow-up

The fresh fixed-Luna smoke reached verified diagnosis but failed program rebuild;
the blind reviewer was not reached. The historical failure is unchanged.

Language reference chunks are now reassembled and decoded into a JSON object
at the model boundary. The decoded reference must match its pinned digest;
native typed context storage remains chunked. Receiver and memory processor
identities bind the transport version. No task instructions, route or solution
are supplied by the reference decoder.

The reference now explicitly requires implementations for every control-flow
target. It also distinguishes raw match equals data from expressions; the
historical generated program used an expression object to match a string.
Actual native compiler/interpreter tests confirm the two have different behavior.
Using the unchanged historical reference content, structured transport takes
11,140 versus 12,832 bytes for that field (13.2% reduction), not the whole
prompt. No live quality, token, latency or cost improvement is claimed.
