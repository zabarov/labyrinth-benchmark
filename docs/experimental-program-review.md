# Experimental Program-backed Review

`examples/mirai-program-review-host.mjs` selects the explicit `program` review
strategy for an installed compatible Mirai candidate. It is an experimental
participant composition, not a new runtime or a benchmark evaluator.

The reviewer receives the original text, goal, constraints and a generic language
reference. It does not receive the executor's source or answer. It authors a
separate pure Mirai Program; the same public compiler, operation boundaries and
bounded worker execute it. Source chunks, Program digest and reconstructed output
are retained in host-local inference evidence. Model calls consume the same root
TaskHost budget. Invalid programs can only retry within that budget.

Executed outputs must agree and pass the existing Outcome admission. Disagreement
is uncertainty, not proof that the executor is wrong, and does not automatically
authorize program rewriting. Agreement can share interpretation errors. Neither
agreement nor compilation alone establishes semantic truth.

The participant never receives benchmark oracle data. Evaluator scoring remains
separate and includes failed, uncertain and incomplete trials in the denominator.
Recorded integration tests demonstrate boundaries and replay, not model quality.
The initial three-task live smoke is too small for general effectiveness claims;
one call was uncertain and its reservation remains held. No production readiness,
weak-model advantage, memory benefit or cost advantage is established here.

Provider failures retain only allowlisted diagnostic categories in the local
call journal. An optional `failure_code` distinguishes transport, cancellation,
response decoding and usage validation failures without copying raw errors or
response bodies. Older journals remain valid. An uncertain call still holds its
reservation and is not retried by resume; a diagnostic is not proof of billing
or remote completion. Historical calls are not retroactively reclassified.

The same allowlist applies to the Mirai generation and source-review adapters.
An arbitrary exception is replaced before entering native dispatch, so its raw
message cannot escape through the participant's rejected promise. A wrapper
failure does not overwrite an already-classified provider failure. Synthetic
integration tests cover generation and reviewer failures, absence of the private
marker in the recorded result, and no retry of the uncertain invocation. This
does not claim comprehensive secret detection in arbitrary model content.

The existing bounded Mirai worker also accepts an optional typed input object
for isolated pure-program checks. The default remains empty for the Labyrinth
arms. Inputs are structured-cloned into the worker and validated by the installed
Mirai Runtime; no JavaScript implementation or evaluator is added to model
packets. This worker is a bounded execution resource for the known Runtime, not
an OS security sandbox for arbitrary generated host code. Typed-input tests are
engineering preparation for operational tasks, not completed domain pilots.
