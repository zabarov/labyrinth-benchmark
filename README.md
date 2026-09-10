# Labyrinth Benchmark

A reproducible benchmark for AI planning, execution, memory, and adaptation.

**Local 0.1.0 candidate. No published live-model results.** Mirai is an optional
participant, not the evaluator. Recorded results only establish harness behavior.

## Quickstart

Requires Node.js 22 and Python 3.12. No model account is needed for the demo.

```sh
npm ci --ignore-scripts
npm test
npm run labyrinth -- corpus generate --config examples/corpus.json --out output/corpus
npm run labyrinth -- corpus verify output/corpus
node scripts/recorded-demo.mjs
npm run labyrinth -- run plan --config examples/offline.json
npm run labyrinth -- run --config examples/offline.json --out output/demo
npm run labyrinth -- report output/demo --out output/report
npm run labyrinth -- export output/demo --out output/export
```

Run directories must be new and empty. Run `resume output/demo` to inspect and
continue an existing allocation; uncertain sessions are blocked, not replayed.
Set `LABYRINTH_PYTHON` to a Python executable if `python3` is not the desired one.

## What is measured?

| Track | Input | Meaning |
|---|---|---|
| Execution | Text and parsed operation table | Execution reliability only |
| Text-to-Outcome | Text, goal, constraints | Full construction and execution |
| Memory & Change | Cold task and five updates | Reuse, invalidation, isolation |

The text defines bounded integer operations and branch decisions. The evaluator
checks every transition, not just the final number. All assigned trials remain
in the denominator, including timeouts and compilation failures.

Start with [Methodology](docs/methodology.md), [Adapters](docs/adapters.md),
[Operations](docs/operations.md), and [Limitations](docs/limitations.md).
See [Provenance](docs/provenance.md) and [Contributing](CONTRIBUTING.md).
Local readiness is tracked in the [Acceptance matrix](docs/acceptance-matrix.md).
Run `node scripts/audit-source.mjs` for documentation and source-inventory checks;
see the [Live launch checklist](docs/live-launch.md) before any model expenditure.

No leaderboard, model weights, credentials, or paid calls are bundled.
Code and synthetic corpus: Apache-2.0; dependencies retain their own licenses.
