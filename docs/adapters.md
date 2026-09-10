# Participant SDK

Public TypeScript interfaces are exported from `dist/index.js`. Schema contracts
are version 1.0.0. A participant implements prepare, execute, update, reset, cancel.
All model calls in a host bridge must use `context.infer`; direct service calls
are outside measured conformance. A trusted host remains responsible for this.

## Recorded

`module` names a local JSON map from task_id to Result. Missing recordings return
failed. Evaluator-generated demo recordings are deliberately not model results.
Recorded participants never run as an unlabelled live baseline.

## OpenAI-compatible HTTP

Manifest kind is `openai`. Set endpoint to the exact Chat Completions URL, model
to a pinned returned model ID, key_env to an environment variable name and commit
to the participant revision. Credentials are read only by the host HTTP adapter.
Use HTTPS except for loopback test servers. Redirects are rejected. The provider
must support nonstreaming JSON object responses and finish_reason=stop.
The default dialect uses max_tokens and temperature=0. Explicit
api_dialect=chat_completions_reasoning uses max_completion_tokens, an explicit
reasoning_effort (default none), default service tier and no sampling override.
No dialect switch happens automatically. Requests set store=false.
The first bounded real request also checks response shape and
model identity. Incompatible endpoints fail explicitly; there is no fallback.
Provider usage is structurally checked and bounded, but provider-reported usage
is not cryptographically verifiable. A host ceiling is required for unknown prices.

## JSONL process

Launch the command without a shell in a fresh working directory with only PATH
in its environment. Requests are `{id,method,params}` and responses are
`{id,result}` or `{id,error}`. stdout is protocol-only; logs go to stderr.
Methods: prepare, update(packet), reset, execute({packet,program}), cancel.
Output is bounded and requests time out. Process participants currently support
offline trusted-local trials only; they do not receive provider credentials.
They are not OS-isolated from a malicious same-user filesystem reader.

## Mirai host bridge

Mirai is not a dependency. An explicitly installed host module exports
`miraiVersion` and `createParticipant({manifest,cwd})`. It composes the pinned
public Mirai APIs and implements the SDK; all inference uses context.infer.
Version mismatch or absent composition returns an incompatibility diagnostic.
The benchmark does not invent a replacement Mirai runtime or supply generated
drafts in live text-to-outcome runs. The bundled optional composition has local
recorded integration coverage, not live-model qualification.

An initial concrete composition is now available in `examples/mirai-host.mjs`.
Set LABYRINTH_MIRAI_ROOT to an explicitly installed package and
LABYRINTH_MIRAI_PROFILE to a validated host-owned model profile. Version is pinned
to 2.6.0-alpha.1. It uses public TaskHost, Cognition, Program and Runtime APIs;
model output proposes a pure Program source, not an oracle result. A recorded
negative integration test proves structural execution does not imply correct
semantic outcome. Native FilesWorkingMemoryStore retains extraction candidates
bound to source, goal, processor, contract, policy and principal/session. Cache
hits recompile and re-execute: semantic acceptance is never cached. A six-phase
integration checks reuse, edits, new scope and revocation. Pure execution runs
in a bounded worker without inherited credentials; this is termination isolation,
not an OS security boundary against a malicious installed package. Language
reference context is supplied from the installed public Program schema, not a
maze solution. The authoring projection omits the required IR digest and
explicitly forbids supplying a guessed digest. It includes a task-independent
addition example checked by the installed compiler before inference. The
compiler, not the reference projection, still validates every generated program;
supplied invalid digests are rejected, never silently stripped or repaired.
The reference digest is included in memory processor identity and saved run
artifacts; changing the guide invalidates reuse under the previous processor.
Profile tariffs must equal the trial tariffs. Inference receives
an explicit output cap within the root budget; no separate fixed $100 allowance
is used. Other host bridges should pass the optional output ceiling to infer.
The in-process infer options also accept an AbortSignal. It is combined with
the root signal, not cloned as JSON. Pre-aborted operations cannot reserve a call;
in-flight cancellation leaves an uncertain receipt and stops the group without
retry. Native inference deadlines follow the approved root time budget instead
of an implicit 30-second limit. The root deadline always wins; compiled pure
program execution still has its separate 30-second cap.

General pure arithmetic/list primitives are registered as `benchmark.multiply`,
`modulo`, `record`, and `append`; they contain no maze traversal or expected
answer. The test-only proposed-program fixture selects branches and computes
state inside Mirai. It is not loaded by a live participant. Provider-generated
source is split losslessly into bounded chunks for TaskHost's string limit and
rejoined before compilation; this transport does not change program semantics.

## Python tool

Use a locally installed Python Docker image pinned by sha256. The tool mounts no
host directories, has no network, runs as uid 65534, drops capabilities, limits
CPU/memory/pids/time/output, and has a small ephemeral tmpfs. Image downloads are
not automatic. The HTTP participant requests a tool with `{"python":"..."}`;
tool output is marked untrusted and supplied to the next model call. All calls
consume the same root budget. Docker absence fails closed.
Instructions advertise Python only when it appears in the packet and a host
tool implementation is available. A host function alone never grants permission.

The native Mirai composition uses the same Python facility through a program
receiver in TaskHost. Each subsequent model turn is a separate native inference
and root reservation. Both participants have at most eight tool requests per
trial, one running tool, and the same container limits. Unawaited or out-of-scope
tools cannot produce accepted completion. The runner blocks native inference
in the offline Execution lane, which lowers the supplied table without an LLM.
# Native Compiler Correction

The optional Mirai composition permits up to three native Cognitive Kernel
attempts, bounded by the configured call budget. A one-call run remains one-shot.
Correction passes the previous candidate and compiler diagnostics, not oracle
feedback. Aggregate token and cost limits remain host-owned; model selection is
fixed. Compilation acceptance does not imply a correct task outcome.
