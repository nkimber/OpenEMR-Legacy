# OpenEMR Parity Tests

This project contains the reusable modernization parity test harness.

The first implemented target is `legacy-openemr`. The `modernized-openemr` target is present as a planned target so the same runner, manifest, result format, and test abstractions can be reused when the modernized application exists.

## Test Layers

- `database` - normalized database probes against the seeded target.
- `http` - health and server-rendered functional checks.
- `ui` - Playwright browser workflows.
- `workflow` - deterministic CRUD-style workflows with pre/post probes, cleanup, and UI evidence where useful.

## Run Plans

Named plans live in `test-manifest.json` and are the operator-facing test manager layer:

- `legacy-readiness` - read-only database, HTTP, and UI suites for baseline confidence.
- `mutation-isolated` - workflow mutation suite with per-test reseeding.
- `full-parity` - database, HTTP, UI, and workflow suites for the future side-by-side parity contract.

## Commands

Run all implemented legacy suites:

```powershell
npm run test:legacy
```

Run individual suites:

```powershell
npm run test:legacy:database
npm run test:legacy:http
npm run test:legacy:ui
npm run test:legacy:workflow
npm run test:legacy:plan:readiness
npm run test:legacy:plan:mutation
npm run test:legacy:plan:full
```

Run the UI suite headed:

```powershell
npm run test:legacy:ui:headed
```

The runner also accepts explicit options:

```powershell
npm run test:legacy -- --reset none
npm run test:legacy -- --suite database --reset run
npm run test:legacy -- --suite all --reset suite
npm run test:legacy -- --suite workflow --reset test
npm run test:legacy -- --plan full-parity --reset run
npm run list
```

Compare two run summaries:

```powershell
npm run compare -- --left artifacts/latest-legacy-openemr-plan-full-parity.json --right artifacts/latest-legacy-openemr-plan-full-parity.json --left-target legacy-openemr --right-target legacy-openemr --plan full-parity
```

Reset modes:

- `none` - use current database state.
- `run` - reset once before the whole run.
- `suite` - reset before each selected suite.
- `test` - reset before each test through the Playwright fixture.

## Artifacts

Each run writes a durable folder under `parity-tests/artifacts/runs/` with:

- `run.json`
- `playwright-report.json`
- `junit.xml`
- `html-report/`
- Playwright traces, screenshots, and videos when failures occur.

The runner also writes a latest summary per target and suite, for example:

- `parity-tests/artifacts/latest-legacy-openemr-all.json`
- `parity-tests/artifacts/latest-legacy-openemr-database.json`
- `parity-tests/artifacts/latest-legacy-openemr-workflow.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-full-parity.json`

Comparison runs write:

- `parity-tests/artifacts/latest-comparison-<left>-<right>-<selection-kind>-<selection-id>.json`
- `parity-tests/artifacts/comparisons/<comparison-id>/comparison.json`

Artifacts are local runtime evidence and are intentionally ignored by Git.
