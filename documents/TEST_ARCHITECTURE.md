# Test Architecture

Created: 2026-06-18

## Purpose

This document defines how the project writes, runs, stores, and compares tests for the legacy OpenEMR baseline and the modernized OpenEMR target.

The goal is not only to test legacy OpenEMR. The goal is to build executable parity specifications that describe observable behavior and domain state so the same tests can run against the modernized implementation as each slice is delivered.

## Current Implementation

The parity test harness lives in `parity-tests/`.

Technology stack:

- TypeScript.
- Playwright Test.
- Node.js command orchestration.
- Legacy MariaDB probes through Docker Compose and the MariaDB CLI.
- Legacy workflow mutation actions through an adapter layer.
- Manifest-defined suites and run plans.
- A run-summary comparator for side-by-side parity evidence.
- JSON, JUnit, HTML, screenshots, videos, and Playwright traces as test evidence.

The legacy baseline is the first implemented target:

- Target id: `legacy-openemr`
- Browser URL: `http://localhost:8080`
- Health URL: `https://localhost:9443/meta/health/readyz`
- Seed dataset: `openemr-shared-synthetic-v1`
- Reset command: `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`

The modernized target is represented in `parity-tests/config/targets.json` as `modernized-openemr` with status `implemented`. It currently supports the slice-1 patient search/chart summary plan, the slice-2 read-only scheduling plan, the slice-3 read-only encounters plan, the slice-4 read-only clinical-lists plan, the slice-5 read-only messaging plan, the slice-6 read-only completed procedures plan, the slice-7 read-only fee-sheet billing plan, the slice-8 read-only administration directory plan, the slice-9 read-only operational reports plan, the slice-10 patient contact mutation plan, the slice-11 appointment mutation plan, the slice-12 encounter mutation plan, the slice-13 clinical-list allergy mutation plan, the slice-14 patient-message mutation plan, the slice-15 prescription mutation plan, the slice-16 billing mutation plan, the slice-17 procedure mutation plan, the slice-18 admin facility mutation plan, the slice-19 admin user mutation plan, the slice-20 access-control read model plan, the slice-21 access-permission mutation plan, the slice-22 user group membership mutation plan, the slice-23 pending/scheduled procedure orders plan, the slice-24 reports export plan, the slice-25 patient documents plan, the slice-26 patient document mutation plan, and the slice-27 patient document content plan.

## Test Layers

### Database Contract

Database tests validate normalized domain facts in the seeded target.

Current legacy coverage:

- Gold dataset row counts.
- Gold dataset temporal coverage.
- Stable named workflow anchor patients.
- Related workflow counts for appointments, encounters, problems, prescriptions, medications, messages, procedure orders, procedure reports, procedure results, billing, and patient documents.

The legacy adapter is `parity-tests/src/db/legacyMariaDbProbe.ts`. It intentionally returns normalized facts instead of exposing test code to every legacy table detail.

The modernized adapter is `parity-tests/src/db/modernizedPostgresProbe.ts`. It follows the same normalized method shape for implemented slices so parity tests do not depend on target-specific table details.

### HTTP Functional Contract

HTTP tests validate server-visible behavior without steering a browser.

Current legacy coverage:

- Health endpoint readiness.
- Login page field contract.
- Admin login reaches the OpenEMR application shell.

### Playwright UI Contract

UI tests validate browser-visible workflows.

The legacy UI helper collects rendered text across OpenEMR frames and form field values from inputs, textareas, and selected options. This matters for legacy clinical forms such as procedure results, where visible result names and values are often stored inside editable fields rather than plain body text.

Current legacy coverage:

- Login with configured local demo credentials.
- Open a known gold patient chart and verify canonical patient details.
- Render a seeded encounter and verify SOAP and vitals detail content across OpenEMR's frame-based encounter UI.
- Render a future seeded appointment in the legacy scheduler edit screen and verify title, patient, date, time, and status form values.
- Render a seeded fee sheet and verify encounter billing codes and descriptions.
- Render completed procedure results for a gold lab patient.
- Render a future scheduled procedure order without report rows for a gold lab patient.
- Render seeded patient documents for a gold patient.

The focused UI suite is intentionally read-only. Mutation workflows live in the Workflow Mutation Contract suite, where they can combine database pre/post probes with browser-visible evidence when useful.

### Workflow Mutation Contract

Workflow tests validate CRUD-style domain behavior with explicit setup, mutation, assertion, and cleanup steps.

Current legacy coverage:

- Patient demographics contact update with pre/post database probes and browser verification in the patient chart.
- Future appointment create, cancel, and delete lifecycle with patient appointment count probes.
- Clinical allergy list create, deactivate, and delete lifecycle with patient allergy count probes.
- Patient message create, close, soft-delete, and hard-cleanup lifecycle with message count probes.
- Patient document create, render, soft-delete, and hard-cleanup lifecycle with document count probes.
- Prescription create, deactivate, and delete lifecycle with patient prescription count probes.
- Encounter create, update, and delete lifecycle with vitals and SOAP detail form links.
- CPT billing line create, bill-status update, deactivate, and delete lifecycle.
- Lab procedure order create, complete, report, result, and cascade-delete lifecycle.
- Administration facility and user lifecycle mutation.
- Focused access-control permission assignment revoke/restore lifecycle.
- Focused access-control user group membership assignment/revoke lifecycle.

The legacy implementation is `parity-tests/src/workflows/legacyWorkflowActions.ts`. It uses controlled SQL mutations against the legacy MariaDB schema because OpenEMR's internal PHP entry points and OAuth-protected APIs are not yet wrapped as stable modernization parity adapters. The modernized implementation is `parity-tests/src/workflows/modernizedWorkflowActions.ts`, which mutates implemented workflows through the modernized ASP.NET Core API and reads post-state through normalized PostgreSQL probes. The tests are written as workflow intent so each new modernized mutation slice can implement equivalent actions behind the same behavioral contract.

### Legacy-Native Internal Tests

OpenEMR upstream includes PHPUnit, Jest, and Panther-oriented tests in `legacy-openemr/source/tests/`. These tests are useful as implementation confidence for the legacy PHP and JavaScript application, but they are not the primary modernization parity contract because the modernized target will not run the same PHP internals.

Current local status:

- Host PHP is not installed.
- Host Composer is not installed.
- The pinned OpenEMR container includes PHP and Composer.
- Upstream Composer dependencies have been installed into the ignored local source checkout.
- `legacy-openemr/scripts/Test-LegacyNative.ps1` runs OpenEMR's `phpunit-isolated.xml` suite inside the pinned OpenEMR container.
- `legacy-openemr/scripts/Test-LegacyNativeJs.ps1` runs OpenEMR's upstream JavaScript Jest suite from the ignored local source checkout.
- The Node dependency restore for the Jest lane uses `npm ci --ignore-scripts` so it does not run OpenEMR's heavier asset postinstall.

The default native mode is `stable`. It excludes upstream PHPUnit groups `twig` and `large` because the complete upstream isolated suite currently has Windows bind-mount-sensitive failures:

- Twig render fixtures compare with CRLF line endings from the Windows checkout while rendered output uses LF.
- One built-in PHP server routing test in the `large` group can time out under the local bind mount.

The stable native lane is verified with 2,344 PHPUnit tests and 6,188 assertions. It is a useful legacy implementation-confidence layer, while the parity harness remains the modernization contract that will run against both legacy and modernized targets.

The native runner also supports `-Mode full` as a diagnostic path for the complete upstream isolated suite. Full mode is expected to remain environment-sensitive until the source checkout or test container is made fully Linux-native.

The native JavaScript lane is verified with 12 Jest suites and 105 tests. Current coverage includes CCDA service utilities and jsPDF compatibility used by the Fax/SMS TIFF-to-PDF workflow.

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
npm run test:legacy:plan:readiness
npm run test:legacy:plan:mutation
npm run test:legacy:plan:full
npm run test:legacy:plan:clinical-lists
npm run test:modernized:plan:clinical-lists
npm run test:legacy:plan:messages
npm run test:modernized:plan:messages
npm run test:legacy:plan:procedures
npm run test:modernized:plan:procedures
npm run test:legacy:plan:procedure-pending-orders
npm run test:modernized:plan:procedure-pending-orders
npm run test:legacy:plan:billing
npm run test:modernized:plan:billing
npm run test:legacy:plan:admin
npm run test:modernized:plan:admin
npm run test:legacy:plan:reports
npm run test:modernized:plan:reports
npm run test:legacy:plan:reports-export
npm run test:modernized:plan:reports-export
npm run test:legacy:plan:documents
npm run test:modernized:plan:documents
npm run test:legacy:plan:document-mutation
npm run test:modernized:plan:document-mutation
npm run test:legacy:plan:contact-mutation
npm run test:modernized:plan:contact-mutation
npm run test:legacy:plan:appointment-mutation
npm run test:modernized:plan:appointment-mutation
npm run test:legacy:plan:encounter-mutation
npm run test:modernized:plan:encounter-mutation
npm run test:legacy:plan:clinical-list-mutation
npm run test:modernized:plan:clinical-list-mutation
npm run test:legacy:plan:message-mutation
npm run test:modernized:plan:message-mutation
npm run test:legacy:plan:prescription-mutation
npm run test:modernized:plan:prescription-mutation
npm run test:legacy:plan:billing-mutation
npm run test:modernized:plan:billing-mutation
npm run test:legacy:plan:access-permission-mutation
npm run test:modernized:plan:access-permission-mutation
npm run test:legacy:plan:user-group-membership-mutation
npm run test:modernized:plan:user-group-membership-mutation
```

Inventory command:

```powershell
npm run list
```

The root script used by the Workbench is:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Suite all -Reset run
```

The legacy-native PHPUnit runner is:

```powershell
cd legacy-openemr
powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyNative.ps1
```

If the ignored upstream Composer dependencies are missing, restore them through the same containerized runner:

```powershell
cd legacy-openemr
powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyNative.ps1 -InstallDependencies
```

The legacy-native Jest runner is:

```powershell
cd legacy-openemr
powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyNativeJs.ps1 -InstallDependencies
```

The runner accepts:

- `--target legacy-openemr|modernized-openemr`
- `--suite all|database|http|ui|workflow|workflow-contact|workflow-appointments|workflow-encounters|workflow-clinical-lists|workflow-messages|workflow-documents|workflow-prescriptions|workflow-billing|workflow-procedures|workflow-admin|workflow-admin-users|workflow-admin-access|workflow-admin-memberships|admin-access-control|slice1|scheduling|encounters|clinical-lists|messages|procedures|procedure-pending-orders|billing|admin|reports|reports-export|documents|document-content`
- `--plan slice-1-readiness|slice-2-scheduling-readiness|slice-3-encounters-readiness|slice-4-clinical-lists-readiness|slice-5-messaging-readiness|slice-6-procedures-readiness|slice-7-billing-readiness|slice-8-admin-readiness|slice-9-reports-readiness|slice-10-contact-mutation-readiness|slice-11-appointment-mutation-readiness|slice-12-encounter-mutation-readiness|slice-13-clinical-list-mutation-readiness|slice-14-message-mutation-readiness|slice-15-prescription-mutation-readiness|slice-16-billing-mutation-readiness|slice-17-procedure-mutation-readiness|slice-18-admin-facility-mutation-readiness|slice-19-admin-user-mutation-readiness|slice-20-access-control-readiness|slice-21-access-permission-mutation-readiness|slice-22-user-group-membership-mutation-readiness|slice-23-procedure-pending-orders-readiness|slice-24-reports-export-readiness|slice-25-documents-readiness|slice-26-document-mutation-readiness|slice-27-document-content-readiness|legacy-readiness|mutation-isolated|full-parity`
- `--reset none|run|suite|test`
- `--headed`
- `--grep <pattern>`
- `--workers <n>`
- `--list`

## Test Management

The test manifest now has two selection layers:

- Suites: layer-level groups such as database, HTTP, UI, workflow, patient-chart slice parity, scheduling slice parity, encounter slice parity, clinical-list slice parity, messaging slice parity, procedure-result slice parity, pending procedure-order slice parity, fee-sheet billing slice parity, administration directory slice parity, operational reports slice parity, reports export slice parity, patient documents slice parity, patient document content parity, and patient document mutation parity.
- Plans: operator-facing run plans that select suites, reset behavior, target support, and intent.

Current plans:

- `slice-1-readiness` runs database and patient chart parity with a run-level reset for both legacy and modernized targets.
- `slice-2-scheduling-readiness` runs the scheduling parity suite with a run-level reset for both legacy and modernized targets.
- `slice-3-encounters-readiness` runs the encounter SOAP/vitals parity suite with a run-level reset for both legacy and modernized targets.
- `slice-4-clinical-lists-readiness` runs the clinical-lists parity suite with a run-level reset for both legacy and modernized targets.
- `slice-5-messaging-readiness` runs the messages parity suite with a run-level reset for both legacy and modernized targets.
- `slice-6-procedures-readiness` runs the procedures parity suite with a run-level reset for both legacy and modernized targets.
- `slice-7-billing-readiness` runs the billing parity suite with a run-level reset for both legacy and modernized targets.
- `slice-8-admin-readiness` runs the admin parity suite with a run-level reset for both legacy and modernized targets.
- `slice-9-reports-readiness` runs the reports parity suite with a run-level reset for both legacy and modernized targets.
- `slice-10-contact-mutation-readiness` runs the patient contact mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-11-appointment-mutation-readiness` runs the appointment mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-12-encounter-mutation-readiness` runs the encounter mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-13-clinical-list-mutation-readiness` runs the clinical-list allergy mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-14-message-mutation-readiness` runs the patient-message mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-15-prescription-mutation-readiness` runs the prescription mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-16-billing-mutation-readiness` runs the billing line mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-17-procedure-mutation-readiness` runs the lab procedure mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-18-admin-facility-mutation-readiness` runs the administration facility mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-19-admin-user-mutation-readiness` runs the administration user mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-20-access-control-readiness` runs the administration access-control suite with a run-level reset for both legacy and modernized targets.
- `slice-21-access-permission-mutation-readiness` runs the administration access-permission mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-22-user-group-membership-mutation-readiness` runs the administration user group membership mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-23-procedure-pending-orders-readiness` runs the pending/scheduled procedure-order suite with a run-level reset for both legacy and modernized targets.
- `slice-24-reports-export-readiness` runs the reports export suite with a run-level reset for both legacy and modernized targets.
- `slice-25-documents-readiness` runs the patient documents suite with a run-level reset for both legacy and modernized targets.
- `slice-26-document-mutation-readiness` runs the patient document mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-27-document-content-readiness` runs the patient document content suite with a run-level reset for both legacy and modernized targets.
- `legacy-readiness` runs database, HTTP, and UI with a run-level reset for read-only baseline confidence.
- `mutation-isolated` runs legacy workflow mutations and shared patient contact/appointment/encounter/clinical-list/message/document/prescription/billing/procedure/admin-facility/admin-user/access-permission/user-group-membership mutation suites with per-test resets for strongest mutation isolation.
- `full-parity` runs database, HTTP, UI, workflow, patient contact mutation, appointment mutation, encounter mutation, clinical-list mutation, message mutation, document mutation, prescription mutation, billing mutation, procedure mutation, admin facility mutation, admin user mutation, access-permission mutation, user-group-membership mutation, access-control read-model coverage, pending/scheduled procedure-order coverage, reports export coverage, patient documents coverage, and patient document content coverage as the target-neutral contract intended for future side-by-side legacy and modernized runs.

Every plan run records `selectionKind`, `selectionId`, `selectedSuites`, and plan metadata in `run.json`. This makes result files self-describing and lets the Workbench show whether evidence came from a suite or a named plan.

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
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-1-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-2-scheduling-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-3-encounters-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-4-clinical-lists-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-5-messaging-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-6-procedures-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-7-billing-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-8-admin-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-9-reports-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-10-contact-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-11-appointment-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-12-encounter-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-13-clinical-list-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-14-message-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-15-prescription-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-16-billing-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-17-procedure-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-18-admin-facility-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-19-admin-user-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-20-access-control-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-21-access-permission-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-22-user-group-membership-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-23-procedure-pending-orders-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-24-reports-export-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-25-documents-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-26-document-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-27-document-content-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-http.json`
- `parity-tests/artifacts/latest-legacy-openemr-ui.json`
- `parity-tests/artifacts/latest-legacy-openemr-workflow.json`
- `parity-tests/artifacts/latest-legacy-openemr-all.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-full-parity.json`
- `parity-tests/artifacts/latest-modernized-openemr-database.json`
- `parity-tests/artifacts/latest-modernized-openemr-http.json`
- `parity-tests/artifacts/latest-modernized-openemr-ui.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-1-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-2-scheduling-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-3-encounters-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-4-clinical-lists-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-5-messaging-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-6-procedures-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-7-billing-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-8-admin-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-9-reports-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-10-contact-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-11-appointment-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-12-encounter-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-13-clinical-list-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-14-message-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-15-prescription-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-16-billing-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-17-procedure-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-18-admin-facility-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-19-admin-user-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-20-access-control-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-21-access-permission-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-22-user-group-membership-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-23-procedure-pending-orders-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-24-reports-export-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-25-documents-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-26-document-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-27-document-content-readiness.json`

Comparison artifacts are written under:

```text
parity-tests/artifacts/comparisons/
```

The comparison runner can compare two `run.json` or latest-summary files:

```powershell
npm run compare -- --left artifacts/latest-legacy-openemr-plan-full-parity.json --right artifacts/latest-modernized-openemr-plan-full-parity.json --plan full-parity
```

For the first modernized slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-1-readiness
```

For the second modernized scheduling slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-2-scheduling-readiness
```

For the third modernized encounters slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-3-encounters-readiness
```

For the fourth modernized clinical-lists slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-4-clinical-lists-readiness
```

For the fifth modernized messaging slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-5-messaging-readiness
```

For the sixth modernized procedures slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-6-procedures-readiness
```

For the seventh modernized fee-sheet billing slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-7-billing-readiness
```

For the eighth modernized administration directory slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-8-admin-readiness
```

For the ninth modernized operational reports slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-9-reports-readiness
```

For the tenth modernized patient contact mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-10-contact-mutation-readiness
```

For the eleventh modernized appointment mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-11-appointment-mutation-readiness
```

For the twelfth modernized encounter mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-12-encounter-mutation-readiness
```

For the thirteenth modernized clinical-list mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-13-clinical-list-mutation-readiness
```

For the fourteenth modernized patient-message mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-14-message-mutation-readiness
```

For the fifteenth modernized prescription mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-15-prescription-mutation-readiness
```

For the sixteenth modernized billing mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-16-billing-mutation-readiness
```

For the seventeenth modernized procedure mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-17-procedure-mutation-readiness
```

For the eighteenth modernized admin facility mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-18-admin-facility-mutation-readiness
```

For the nineteenth modernized admin user mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-19-admin-user-mutation-readiness
```

For the twentieth modernized access-control read-model slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-20-access-control-readiness
```

For the twenty-first modernized access-permission mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-21-access-permission-mutation-readiness
```

For the twenty-second modernized user group membership mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-22-user-group-membership-mutation-readiness
```

For the twenty-third modernized pending/scheduled procedure-order slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-23-procedure-pending-orders-readiness
```

For the twenty-fourth modernized reports export slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-24-reports-export-readiness
```

For the twenty-fifth modernized patient documents slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-25-documents-readiness
```

For the twenty-sixth modernized patient document mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-26-document-mutation-readiness
```

For the twenty-seventh modernized patient document content slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-27-document-content-readiness
```

The comparator is now active evidence for implemented slices. It should continue to be the Workbench and CI input for side-by-side parity status as new slices join the modernized target.

Artifacts are local runtime evidence and are intentionally ignored by Git.

## Workbench Integration

The Modernization Workbench reads test definitions from `modernization-workbench/config/apps.json`.

The legacy app currently exposes these test actions:

- Baseline smoke test.
- Native PHPUnit isolated suite.
- Native Jest JavaScript suite.
- Gold database contract.
- HTTP functional contract.
- Playwright UI contract.
- Workflow mutation contract.
- Legacy readiness plan.
- Isolated mutation plan.
- Slice 1 readiness plan.
- Slice 2 scheduling plan.
- Slice 3 encounters plan.
- Slice 4 clinical-lists plan.
- Slice 5 messaging plan.
- Slice 6 procedures plan.
- Slice 7 billing plan.
- Slice 8 admin plan.
- Slice 9 reports plan.
- Slice 10 contact mutation plan.
- Slice 11 appointment mutation plan.
- Slice 12 encounter mutation plan.
- Slice 13 clinical-list mutation plan.
- Slice 14 message mutation plan.
- Slice 15 prescription mutation plan.
- Slice 16 billing mutation plan.
- Slice 17 procedure mutation plan.
- Slice 18 admin facility mutation plan.
- Slice 19 admin user mutation plan.
- Slice 20 access-control plan.
- Slice 21 access-permission mutation plan.
- Slice 22 user group membership mutation plan.
- Slice 23 pending procedure orders plan.
- Slice 24 reports export plan.
- Slice 25 patient documents plan.
- Slice 26 document mutation plan.
- Slice 27 document content plan.
- Full parity plan.
- Full legacy parity suite.

The modernized app currently exposes these test actions:

- Modernized smoke test for API health, anchor patient search, anchor chart summary, anchor appointment search/detail, anchor encounter search/detail, clinical lists, patient messages, patient documents, patient document content retrieval, procedure results, pending/scheduled procedure orders, fee-sheet billing, administration directory, administration access control, operational reports, operational reports CSV export, appointment mutation, encounter mutation, clinical-list allergy mutation, patient-message mutation, patient-document mutation, prescription mutation, billing mutation, procedure mutation, admin facility mutation, admin user mutation, access-permission mutation, and user group membership mutation.
- Slice 1 readiness plan for side-by-side patient search/chart summary parity.
- Slice 2 scheduling plan for side-by-side future appointment detail parity.
- Slice 3 encounters plan for side-by-side SOAP and vitals detail parity.
- Slice 4 clinical-lists plan for side-by-side problem, allergy, medication-list, and prescription parity.
- Slice 5 messaging plan for side-by-side portal-enabled patient message parity.
- Slice 6 procedures plan for side-by-side completed lab result parity.
- Slice 7 billing plan for side-by-side fee-sheet billing parity.
- Slice 8 admin plan for side-by-side users and facilities parity.
- Slice 9 reports plan for side-by-side operational-reporting parity.
- Slice 10 contact mutation plan for side-by-side patient contact update parity.
- Slice 11 appointment mutation plan for side-by-side future appointment lifecycle parity.
- Slice 12 encounter mutation plan for side-by-side encounter, vitals, and SOAP lifecycle parity.
- Slice 13 clinical-list mutation plan for side-by-side allergy lifecycle parity.
- Slice 14 message mutation plan for side-by-side patient-message lifecycle parity.
- Slice 15 prescription mutation plan for side-by-side prescription lifecycle parity.
- Slice 16 billing mutation plan for side-by-side fee-sheet CPT lifecycle parity.
- Slice 17 procedure mutation plan for side-by-side lab order/report/result lifecycle parity.
- Slice 18 admin facility mutation plan for side-by-side facility lifecycle parity.
- Slice 19 admin user mutation plan for side-by-side user lifecycle parity.
- Slice 20 access-control plan for side-by-side default ACL group and permission parity.
- Slice 21 access-permission mutation plan for side-by-side ACL assignment parity.
- Slice 22 user group membership mutation plan for side-by-side ACL membership parity.
- Slice 23 pending procedure orders plan for side-by-side scheduled, reportless lab-order parity.
- Slice 24 reports export plan for side-by-side operational CSV export parity.
- Slice 25 patient documents plan for side-by-side seeded patient document parity.
- Slice 26 document mutation plan for side-by-side patient document lifecycle parity.
- Slice 27 document content plan for side-by-side full document content parity.

The Workbench runs only allowlisted commands. It displays latest evidence per test card and stores lifecycle/test action events in `modernization-workbench/artifacts/events.json`.

The Test Runs page also includes a custom parity run builder for each managed app. The Workbench API exposes `parity-tests/test-manifest.json`, and the UI lets an operator choose suite or plan, a specific suite or plan id, reset mode, headed mode, and an optional Playwright grep filter. The backend validates those choices against the manifest before it constructs the existing `scripts/Run-OpenEmrParityTests.ps1` command. This gives the project a real test manager for targeted runs while keeping command execution local and constrained.

## Modernized Target Parity Path

The modernized target now exists and currently includes fourteen read-only slices plus thirteen mutation-capable slices through Slice 27. The smoke test proves that the target can run, consume the shared gold dataset, retrieve deterministic anchors across patient, scheduling, encounter, clinical-list, messaging, completed procedure-result, pending procedure-order, billing, administration, access-control, reporting, report export, patient document, and patient document content workflows, and perform safe cleanup-backed mutation lifecycles for patient contact, appointments, encounters, allergies, messages, patient documents, prescriptions, billing lines, procedures, facilities, users, ACL permission assignments, and ACL user group memberships.

The slice readiness plans from `slice-1-readiness` through `slice-27-document-content-readiness` prove the same normalized database facts, browser-visible behavior, mutation post-state where applicable, cleanup, and restoration expectations against both legacy and modernized targets. The newest document content plan covers full stored document payload comparison plus modernized content API, viewer, and download behavior; the document mutation plan covers database-backed text document create/render/archive/delete behavior; the read-only documents plan covers seeded patient document metadata and visible document lists; the newest reports plans cover deterministic operational-report facts and CSV export rows; the newest lab plan covers seeded future scheduled procedure orders without report rows; the newest administration/security plans cover seeded ACL groups, visible permission objects, representative group-permission assignments, default `admin` and `oe-system` memberships, focused Front Office `patients:demo` assignment revoke/restore behavior, and focused temporary-user Front Office membership assignment/revoke behavior.

Next parity steps:

1. Add additional modernized workflow actions behind the same mutation-test intent as CRUD slices are implemented.
2. Add modernized UI helpers behind the same browser workflow intent for each new mutation slice.
3. Add additional slice readiness plans or graduate slices into the full parity plan once both targets support them.
4. Add comparison views in the Workbench that read the two run summaries and normalized probe outputs.

The test code should continue to assert observable behavior and normalized domain state, not identical implementation details.
