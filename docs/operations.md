# Running and publishing results

Use `run plan` before any experiment. It reports assigned trials, maximum calls
and maximum configured cost across root groups. The full pilot template has ten
seeds, three lengths and three repetitions; it is not authorization to spend.
Select models, allowed synthetic data and a fresh total budget before live runs.
Live execution requires config.live=true and CLI --live. No API key discovery,
automatic model selection, paid retry or endpoint fallback is performed.

The runner holds an exclusive directory lock. Persistent locks after process
death require operator reconciliation: prove the process is dead and preserve a
backup before removing that lock. Resume never repeats a partially executed
session: unfinished work is blocked because durable participant memory cannot be
assumed. Entirely unstarted groups can continue. Existing results are preserved.
Do not edit journals to manufacture a successful resume. Digests detect binding
mistakes, not a malicious administrator who can rewrite every artifact.

Run directories contain private output and configuration. Export is a separate
allowlisted projection, never a recursive directory copy. Before publication,
inspect the bundle for secrets, local paths and provider content. Model/version
metadata requiring manual release approval is kept in the private run config.
Attach those approved identifiers to a public result before claiming independent
reproducibility. Do not publish raw provider logs or private source data.

The CLI supports `export <run-dir> --out <dir> --metadata <approved.json>`.
PublicMetadata is a strict allowlist bound to the run config and participant
identifiers. Without it the export explicitly states incomplete reproducibility.
See live-launch.md for the no-spend preparation checklist and stop conditions.

Report provenance as author-reported, agent-reviewed or independently reproduced
only with the relevant evidence. Human review is separate. No CI result means
live model quality was measured. No synthetic result means production readiness.
