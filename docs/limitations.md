# Limitations

- Synthetic bounded integer grammar only; no arbitrary-document comprehension.
- Small authorized live diagnostics exist; see [findings](autonomous-live-findings.md).
  No general efficacy claim, production certification or leaderboard.
- Mirai requires a qualified host composition; an adapter interface is not proof
  of end-to-end Mirai readiness.
- JSONL processes are trusted-local and offline; no hostile-process isolation claim.
- Docker isolates the Python tool, not the entire evaluator host.
- Exact full traces can exceed small models' output windows; truncation is failure,
  not excluded data. Plan realistic token limits before collecting trials.
- Providers must match the supported HTTP dialect exactly. Incompatible APIs fail.
- The runner is sequential across trials. Parallel inference within a trusted
  bridge shares reservations; it does not establish general distributed scheduling.
- Resume blocks partially completed sessions instead of reconstructing arbitrary
  participant memory. Reconciliation may require a separately reported new run.
- Reports are descriptive; repeats are not independent tasks. No adaptive routing.
- Publication, real costs and model access require separate operator decisions.
