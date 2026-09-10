# Methodology

## Conditions

Every paired participant receives identical task source bytes, goal, constraints,
tools and permitted history. System instructions implementing the participant may
differ and are part of the treatment. Inputs contain no oracle, route or Mirai IR.
The execution track intentionally supplies a parsed operation table and must
never be described as evidence of text understanding.

In Execution, the native Mirai adapter lowers the supplied operation table to
Program nodes without evaluating the route or invoking a model. Construction of
this representation is not attributed to a model. Pure offline execution is
labelled `execution_harness`, not `live_model`; its preparation remains timed.
The text tracks never invoke this lowering path or receive the operation table.

`system_bundle` compares complete systems. A plain model has no external code
runner; Mirai's internal compiler is part of its treatment. This does not prove
that the underlying model became smarter. `matched_tools` supports the built-in
HTTP and optional native Mirai composition with the same bounded Python tool.
Mirai records each inference turn and tool dispatch through TaskHost; the benchmark
root budget accounts for all turns and phases. Native per-turn ledgers are not
additional spending allowances. Other adapters must not claim matched-tool
conformance until their host-tool transport is tested. Native TaskHost admission
limits can reject large tool outputs even below the common sandbox output ceiling;
such failures remain in the denominator, not silently truncated or bypassed.

## Corpus and memory phases

`legacy-v1` preserves the original LCG semantics, including known short-period
patterns. `sha256-v1` uses seed/counter hashes. Both are one synthetic grammar,
not a random sample of company processes. Task units are seed families; lengths
10/100/1000 and repetitions are nested observations.

Memory phases are ordered: cold, unchanged, source_edit, goal_change, new_scope,
revoked_access. Each phase is a complete replacement packet based on the original
source, except source_edit changes the first layer. Goal change requests the
number of left turns. New scope receives a fresh session view. Revocation clears
participant history and withholds source bytes. Participants must return blocked,
null value, empty trace. A participant's compliance is tested, not assumed.

Each participant/seed/length/repetition group starts fresh and has a shared
call/token/cost/time budget. Compare identical participants with memory true/false
to isolate memory. There is no cache-hit instrumentation claim: calls and
outcomes are observable, internal cache activity needs participant-specific evidence.

## Scoring

Exact success requires status, final value and the entire ordered trace to match
the independently parsed oracle. Count correct transitions and first incorrect
transition separately. A completed status with a wrong result is false completion.
Do not discard failed compilations, malformed outputs, timeouts or missing usage.
Unknown usage remains null. Deadline-truncated latency is censored; inspect status.

Report cold and warm separately and cold-plus-unchanged combined. All measured
processing, compilation, corrections, inference and verification performed by the
participant belongs in trial time; evaluator-only scoring is outside participant
time. Preparation overhead is recorded at group level. External service cost is
based on configured tariffs, not an independently reconciled invoice.

No significance-driven sample extension. Pilot allocation is frozen before
collection. Three repeats are not three new tasks. Fixed-corpus descriptive
results do not establish population independence, transfer or model superiority.
Adaptive routing requires a separate future protocol; v0.1.0 runs fixed routing.
