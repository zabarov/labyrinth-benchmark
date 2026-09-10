# Source-Bound Decomposition

## What Changed

The optional `examples/mirai-decomposition-host.mjs` participant first asks the
fixed model for a planning candidate, then generates a Program using that
candidate and the unchanged original text. Planning, generation, repair and
review use one native TaskHost ledger and shared call/token/cost ceilings.
No evaluator, maze parser, prepared program or route is available to this host.

The installed public Cognition API `createSourceDecompositionVerifier` segments
nonblank source lines into bounded, source-offset-bound units without domain
parsing. The model proposes 2-16 steps with tasks, source references, criterion
references, checks and dependencies. Native admission requires complete reference
coverage, valid unique references and an acyclic DAG with one terminal. Explicit
unknowns stop authoring. The admitted artifact binds source, criteria and output
digests but grants neither semantic acceptance nor execution authority.

Generation consumes the verified prerequisite through native dependency results.
Diagnosis and scoped repair retain the same frozen candidate and original text.
Warm program reuse does not replan unchanged input, but still requires source
Outcome review. Changed source/goal/scope uses the existing memory isolation and
invalidation contracts. No additional cache, runtime, language or profile exists.

## Limits

Reference coverage is NOT proof of meaning. A model can reference every line yet
misunderstand it; a bad step description can pass structural admission. Final
compiler, typed execution and separate Outcome review remain mandatory. The
same-model blind reviewer can still share an error, so the independent benchmark
evaluator remains the source of exact scores.

This is planning followed by generation, not automatic independent execution
of every proposed step or verified semantic equivalence between text and code.
No claim of complete general-purpose decomposition is made. The native helper
supports up to 100000 source characters, 256 nonblank units of at most 2000
characters, 32 criteria and a 64000-byte planning output. Larger inputs fail
closed, rather than silently dropping text. Length-1000 support is not claimed.

The participant is `system_bundle`, fixed-model, synthetic-input only for this
stage. Direct-source `matched_tools` remains unsupported. Historical tests are
not rescored, and the compact participant remains independently selectable.

## Failure Analysis and Verification

The previous compact trial failed because of undeclared intermediate state,
an unqualified reference, one-character IDs and an extra declaration property.
The repair remained uncompilable. The existing guide already specified minimum
identifier length; this was not a newly discovered language requirement.
The trial never reached source review, so its semantic understanding is unknown.
Post-run reproduction is in `source/output/decomposition-failure-analysis.json`.

Native tests cover missing references/criteria, forged or duplicate references,
cycles, multiple disconnected terminals, extra authority fields, mutation of
returned context, unknowns, duplicate JSON and limits. Connected recorded tests
cover success and warm reuse, missing coverage, uncertainty, incorrect executed
result, repair preserving the planning input, cancellation and insufficient
budget. Recorded success proves integration, not live model quality.

Release limitations remain: no independent security review or cross-platform
release matrix for this candidate, and the historical frozen 2.4 retrieval gate
has not been bypassed or rewritten. No publication or rollout is authorized.

## Fresh Live Result

Fixed `gpt-5.6-luna`, seed `blind-decomposition-source-01`, length 10, one repeat.
Plain and Mirai received identical original task bytes. TypeScript and Python
evaluators agreed after both jobs became terminal. These are descriptive smoke
results, not a model ranking or a matched-budget comparison.

| Participant | Exact outcome | Actual calls | Known cost estimate, USD |
| --- | --- | --- | --- |
| Plain | 0/1 | 1 | 0.00045055 |
| Mirai source decomposition | 0/1 | 4 | 0.01843705 |

Plain returned 5 rather than 23; 1/10 transitions matched. Mirai produced a
six-step planning candidate that passed structural admission, then generated,
diagnosed and attempted to repair a program. Compilation failed before any
source Outcome review. No Mirai completion was accepted. The plan's meanings
were not independently accepted merely because all references were covered.

| Operation | Input tokens | Output tokens | Known cost estimate, USD |
| --- | --- | --- | --- |
| Decompose | 3554 | 751 | 0.0017897 |
| Generate | 3086 | 6604 | 0.0086963 |
| Diagnose | 11992 | 475 | 0.003568 |
| Rebuild | 12977 | 949 | 0.00438305 |

Post-run diagnosis reproduced invalid record-field access and one-character
identifiers. The repair attempted to rename frozen target identities (for
example a target for `a` received an entry named `a1`), which existing scope
admission correctly rejected. The current narrow edit scope cannot safely
express that rename; retrying it unchanged would be unproductive. This is an
identified limitation of the repair path, not evidence that the source meaning
was correct or that the task is impossible for the model.

Evidence: `source/output/blind-smoke-decomposition-2026-09-07/` contains frozen
inputs, terminal journals, `post-run-analysis.json` and `failure-analysis.json`.
Independent evaluator packet digest:
`sha256:f48d43330c841b3c4d074cd12b31bbbf92833a0ce705f73e82f1a895e821e250`.
The prior compact trial remains unchanged. No warm/live memory benefit was
tested here. Different seeds preclude causal before/after quality or cost claims.

## Local Decision

Local suites passed: native 434/434, benchmark 43/43, connected authoring and
decomposition 11/11. This establishes integration and rejection boundaries,
not successful live text-to-Program quality. The bounded implementation and
experimental stage is complete; the broader reliable-generation objective is
not achieved. No larger live series or release is justified by these results.

Next proposal: early type/symbol checks on smaller model-authored program
fragments and explicit qualification of which defects a scoped repair can
express. Do not weaken IDs, widen grants, silently rewrite behavior or supply
the benchmark algorithm to make this failed task pass. Keep this task as a
regression; use new tasks for subsequent live comparisons.

The new pair used an estimated USD0.0188876 with no new uncertain calls.
Cumulative known estimates are USD5.8432653; preserving eight uncertain calls
and historical job reserves gives USD19.74447345 conservative exposure and
USD0.25552655 headroom under USD20. This is not a provider invoice or proof that
the held amounts were actually spent. No runner remained active after accounting.
