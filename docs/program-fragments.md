# Checked Program Fragments

This local candidate separates model-authored state declarations from the
model-authored program body. It uses the native Mirai Program schema and
compiler, not a benchmark-specific language or a supplied solution.

## Flow and API

The opt-in `examples/mirai-fragment-authoring-host.mjs` participant uses:

1. A host-frozen pure envelope: interfaces, output types and resource policy.
2. A model response containing only `{state: [...]}`. Native
   `validateProgramStateFragment` applies the existing identifier, type and
   default-value rules before the body call is permitted.
3. A model response containing only `{entry, nodes}`. Native
   `createProgramFragmentVerifier` binds both raw responses and the envelope,
   composes their exact values, and invokes the full compiler.
4. Existing governed execution and blind source Outcome review. Compilation
   and fragment admission do not establish that the task was solved.

Both inference stages use the same TaskHost root ledger. Declaration output
is a digest-bound dependency of body generation; the original task text stays
available to both calls. There is no supplied route, draft, graph or oracle.
Verified cached programs reuse the ordinary full-source review path. The
fragment mode is separate from the existing decomposition experiment.

Before a scoped correction, `assessProgramSourceRepair` returns
`already_valid`, `candidate_required` or `requires_replan`. Frozen invalid
identities, envelope errors and conservatively unclassified or partially
scoped defects stop diagnosis/repair calls. This is an eligibility policy,
not proof that repair is mathematically impossible or will succeed. An
eligible repair still needs CAS, scope, compiler and Outcome admission.

## Local Evidence

- Native Program, Runtime, TaskHost and Cognition: 438/438 tests.
- Benchmark core: 43/43 tests.
- Authoring, decomposition and fragment integration: 21/21 scenarios.
- New fragment scenarios cover invalid IDs/types, duplicate JSON keys,
  state override, wrong semantic result, qualified and refused correction,
  cancellation, shared budget, warm reuse and replay without provider calls.
- Two saved live failures fail declaration validation and require replanning
  under their historical repair scopes. Each historical run made two later
  diagnosis/repair calls. Avoidance is a retrospective counterfactual, not a
  measured prospective saving; the historical failures remain failures.

Evidence is local and uncommitted:
`source/output/fragments-core-final.tap`,
`source/output/fragments-connected-final.tap`,
`source/output/fragments-historical-qualification.json`, and native
`source/output/native-outcome-economy/fragments-native-final.tap`.

To reproduce the connected checks after building both repositories:

```bash
MIRAI_CANDIDATE_ROOT=/path/to/mirai node --test test/mirai-authoring.integration.mjs test/mirai-decomposition.integration.mjs test/mirai-fragments.integration.mjs
MIRAI_CANDIDATE_ROOT=/path/to/mirai node source/qualify-historical-repairs.mjs
```

The historical command requires the retained local trial artifacts. It is
evaluator-side only and never imported by participants.

## Limits and Next Decision

The body is still generated as one fragment; arbitrary independent node-fragment
compilation and automatic semantic replanning are not implemented. Valid types
do not imply correct source interpretation. Recorded tests prove integration
and rejection behavior, not real-model improvement, latency or cost savings.

No live calls, publication, product changes or Federation rollout occurred in
this stage. Campaign accounting remains: known USD5.8432653, conservative
exposure USD19.74447345, available USD0.25552655 after historical uncertainty
and whole-job reserves. Eight unknown calls remain held. The existing paired
smoke ceiling USD0.26 does not fit that remainder; it was not reduced simply
to force another trial.

This is not a stable-release acceptance. The previously observed full-release
freeze blocker `frozen_2.4_retrieval_surface_changed` remains unresolved; this
stage did not rewrite the frozen lock or perform an independent security review.
Next: reconcile historical reserves or approve additional budget, then freeze
a fresh paired fixed-model trial with equal source packets and all failures
retained. Report cold total cost including the extra declarations call.
