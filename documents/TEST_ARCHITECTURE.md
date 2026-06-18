# Test Architecture

Created: 2026-06-18

## Purpose

This document defines how the project writes, runs, stores, and later compares tests for the legacy OpenEMR baseline and the future modernized OpenEMR target.

The goal is not only to test legacy OpenEMR. The goal is to build executable parity specifications that describe observable behavior and domain state so the same tests can run against the modernized implementation once it exists.

## Current Implementation

The parity test harness lives in `parity-tests/`.

Technology stack:

- TypeScript.
- Playwright Test.
- Node.js command orchestration.
- Legacy MariaDB probes through Docker Compose and the MariaDB CLI.
- Legacy workflow mutation actions through an adapter layer.
- JSON, JUnit, HTML, screenshots, videos, and Playwright traces as test evidence.

The legacy baseline is the first implemented target:

- Target id: `legacy-openemr`
- Browser URL: `http://localhost:8080`
- Health URL: `https://localhost:9443/meta/health/readyz`
- Seed dataset: `openemr-shared-synthetic-v1`
- Reset command: `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`

The future modernized target is represented in `parity-tests/config/targets.json` as `modernized-openemr` with status `planned`. It cannot run yet, but the runner and manifest already model the target boundary.

## Test Layers

### Database Contract

Database tests validate normalized domain facts in the seeded target.

Current legacy coverage:

- Gold dataset row counts.
- Gold dataset temporal coverage.
- Stable named workflow anchor patients.
- Related workflow counts for appointments, encounters, problems, prescriptions, medications, messages, procedure orders, and billing.

The legacy adapter is `parity-tests/src/db/legacyMariaDbProbe.ts`. It intentionally returns normalized facts instead of exposing test code to every legacy table detail.

Future modernized database tests should add a PostgreSQL probe with the same normalized method shape.

### HTTP Functional Contract

HTTP tests validate server-visible behavior without steering a browser.

Current legacy coverage:

- Health endpoint readiness.
- Login page field contract.
- Admin login reaches the OpenEMR application shell.

### Playwright UI Contract

UI tests validate browser-visible workflows.

Current legacy coverage:

- Login with configured local demo credentials.
- Open a known gold patient chart and verify canonical patient details.

The focused UI suite is intentionally read-only. Mutation workflows live in the Workflow Mutation Contract suite, where they can combine database pre/post probes with browser-visible evidence when useful.

### Workflow Mutation Contract

Workflow tests validate CRUD-style domain behavior with explicit setup, mutation, assertion, and cleanup steps.

Current legacy coverage:

- Patient demographics contact update with pre/post database probes and browser verification in the patient chart.
- Future appointment create, cancel, and delete lifecycle with patient appointment count probes.
- Clinical allergy list create, deactivate, and delete lifecycle with patient allergy count probes.
- Patient message create, close, soft-delete, and hard-cleanup lifecycle with message count probes.
- Prescription create, deactivate, and delete lifecycle with patient prescription count probes.

The current legacy implementation is `parity-tests/src/workflows/legacyWorkflowActions.ts`. It uses controlled SQL mutations against the legacy MariaDB schema because OpenEMR's internal PHP entry points and OAuth-protected APIs are not yet wrapped as stable modernization parity adapters. The tests are still written as workflow intent, so a future modernized target can implement equivalent actions behind the same behavioral contract.

### Legacy-Native Internal Tests

OpenEMR upstream includes PHPUnit, Jest, and Panther-oriented tests in `legacy-openemr/source/tests/`. These tests are useful as implementation confidence for the legacy PHP application, but they are not the primary modernization parity contract because the modernized target will not run the same PHP internals.

Current local status:

- Host PHP is not installed.
- Host Composer is not installed.
- The OpenEMR container includes PHP and the upstream `tests/` folder.
- The OpenEMR container does not currently include `vendor/bin/phpunit`.

Therefore the current verified test solution focuses on the reusable parity harness. A future legacy-native lane can be added once PHP/Composer/PHPUnit dependencies are installed locally or made available in a dedicated test container.

## Runner

The main runner is:

```powershell
cd parity-tests
npm run test:legacy
```

Suite-specific commands:

```powershell
npm run test:legacy:database
npm run test:legacy:http
npm run test:legacy:ui
npm run test:legacy:ui:headed
npm run test:legacy:workflow
```

The root script used by the Workbench is:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Suite all -Reset run
```

The runner accepts:

- `--target legacy-openemr`
- `--suite all|database|http|ui|workflow`
- `--reset none|run|suite|test`
- `--headed`
- `--grep <pattern>`
- `--workers <n>`

## Reset Strategy

Supported reset modes:

- `none` - run against the current target state.
- `run` - reset once before the selected run.
- `suite` - reset before each selected suite.
- `test` - reset before each individual test.

Default legacy parity runs should use `run`. This balances repeatability with speed. Mutation-heavy workflow tests can opt into `suite` or `test` where stronger isolation is worth the cost.

The Workbench workflow command uses `test` reset mode so each mutation test starts from a fresh gold seed. The suite also performs its own cleanup so it can run as part of the full `all` suite with a single run reset.

## Artifacts

Every parity run writes a durable run folder under:

```text
parity-tests/artifacts/runs/
```

Each run folder contains:

- `run.json`
- `playwright-report.json`
- `junit.xml`
- `html-report/`
- Playwright test artifacts such as traces, screenshots, and videos when applicable.

The runner also writes latest summary files by target and suite:

- `parity-tests/artifacts/latest-legacy-openemr-database.json`
- `parity-tests/artifacts/latest-legacy-openemr-http.json`
- `parity-tests/artifacts/latest-legacy-openemr-ui.json`
- `parity-tests/artifacts/latest-legacy-openemr-workflow.json`
- `parity-tests/artifacts/latest-legacy-openemr-all.json`

Artifacts are local runtime evidence and are intentionally ignored by Git.

## Workbench Integration

The Modernization Workbench reads test definitions from `modernization-workbench/config/apps.json`.

The legacy app currently exposes these test actions:

- Baseline smoke test.
- Gold database contract.
- HTTP functional contract.
- Playwright UI contract.
- Workflow mutation contract.
- Full legacy parity suite.

OpenEMR-native PHPUnit execution is not exposed as a Workbench action yet because the local/container dependency checks above do not currently provide a runnable PHPUnit binary.

The Workbench runs only allowlisted commands. It displays latest evidence per test card and stores lifecycle/test action events in `modernization-workbench/artifacts/events.json`.

## Future Modernized Target

When the modernized target exists:

1. Add its actual runtime config to `parity-tests/config/targets.json`.
2. Add its database probe adapter.
3. Add modernized workflow actions behind the same mutation-test intent.
4. Add modernized UI helpers behind the same browser workflow intent.
5. Run the same suites against both targets.
6. Add comparison views in the Workbench that read the two run summaries and normalized probe outputs.

The test code should continue to assert observable behavior and normalized domain state, not identical implementation details.
