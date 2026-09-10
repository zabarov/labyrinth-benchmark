# Live smoke and pilot launch checklist

Status: preparation only; no model calls or publication authorized.

## Freeze before smoke

1. Record exact benchmark and participant revisions, Mirai package revision and
   validated host model profile. Inspect the working tree; do not label uncommitted
   sources as a released revision.
2. Select explicit endpoint/model IDs and synthetic-only data. Check that the
   provider accepts the supported Chat Completions fields. Credentials remain
   host-local; never add them to trial config or public metadata.
3. Set fresh total spending authorization. The configured monetary limit is per
   participant/seed/length/repetition group; run plan reports the total ceiling.
   Do not confuse a per-group dollar limit with an experiment-wide limit.
4. Set token ceilings appropriate for the complete trace and language reference.
   Mirror tariffs in the Mirai profile. No automatic provider/model replacement.
5. Freeze the selected config digest before execution. Keep all assigned failures.

## Smoke

Use one seed, length 10, one repeat, first the plain participant, then the Mirai
participant without memory. After transport correctness, compare memory false
and true across six phases with identical models, sources and limits. Smoke is
operational verification, not a quality claim. Stop on uncertain usage, unexpected
model ID, privacy failure or unaccounted provider calls.

## Variance pilot

The supplied pilot template describes ten seeds, three lengths and three repeats.
It includes plain fixed, Mirai without memory and Mirai with memory: 270 groups,
1620 assigned phase trials, and at most 1620 inference calls at the template's
six-call group ceiling. The zero monetary ceiling and live=false deliberately
prevent execution. The final call and monetary ceilings must be approved anew.
Fill approved model IDs, revisions, prices, budgets and endpoint, then explicitly
enable live mode. Treat seeds as units and lengths/repeats as nested observations.
Cold cost includes preparation and language reference; warm results also show
cold-plus-warm totals. Do not add samples until a preferred result appears.

## Public evidence

Export defaults to identifiers withheld and explicitly incomplete reproducibility.
To include reviewed identifiers, supply `export ... --metadata <file>` using the
PublicMetadata schema: bound config digest, benchmark commit, and each exact
participant id/model/commit/version. Paths, endpoint, credentials and extra fields
are not accepted. This is operator-supplied metadata, not proof that another party
reproduced the experiment. Push and publication remain separate actions.
