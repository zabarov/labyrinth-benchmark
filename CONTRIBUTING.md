# Contributing

Use English for code, issues, examples and documentation. Run npm ci and npm test.
Add an independent expected-result check for semantic changes. Never overwrite
legacy corpora: assign a new corpus version. Keep the core independent of Mirai
and other participant runtimes. Do not commit model credentials or private logs.

For published results provide exact revisions, corpus/config digests, model
versions, tools, budgets, all assigned outcomes and limitations. Corrections must
preserve the original failed attempts. Performance improvements need paired cold
and warm measurements including setup cost. Contributions use Apache-2.0.
