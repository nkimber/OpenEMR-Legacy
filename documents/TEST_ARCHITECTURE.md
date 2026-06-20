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

The modernized target is represented in `parity-tests/config/targets.json` as `modernized-openemr` with status `implemented`. It currently supports the slice-1 patient search/chart summary plan, the slice-2 read-only scheduling plan, the slice-3 read-only encounters plan, the slice-4 read-only clinical-lists plan, the slice-5 read-only messaging plan, the slice-6 read-only completed procedures plan, the slice-7 read-only fee-sheet billing plan, the slice-8 read-only administration directory plan, the slice-9 read-only operational reports plan, the slice-10 patient contact mutation plan, the slice-11 appointment mutation plan, the slice-12 encounter mutation plan, the slice-13 clinical-list allergy mutation plan, the slice-14 patient-message mutation plan, the slice-15 prescription mutation plan, the slice-16 billing mutation plan, the slice-17 procedure mutation plan, the slice-18 admin facility mutation plan, the slice-19 admin user mutation plan, the slice-20 access-control read model plan, the slice-21 access-permission mutation plan, the slice-22 user group membership mutation plan, the slice-23 pending/scheduled procedure orders plan, the slice-24 reports export plan, the slice-25 patient documents plan, the slice-26 patient document mutation plan, the slice-27 patient document content plan, the slice-28 patient insurance coverage plan, the slice-29 patient immunization history plan, the slice-30 patient immunization mutation plan, the slice-31 patient problem-list mutation plan, the slice-32 patient medication-list mutation plan, the slice-33 binary patient-document mutation plan, the slice-34 patient insurance mutation plan, the slice-35 encounter metadata mutation plan, the slice-36 patient demographics mutation plan, the slice-37 patient registration plan, the slice-38 patient document sign-off plan, the slice-39 patient document external-link plan, the slice-40 patient document denial plan, the slice-41 patient document metadata plan, the slice-42 patient document archive restore plan, the slice-43 patient document content replacement plan, the slice-44 billing diagnosis plan, the slice-45 billing correction plan, the slice-46 billing modifier plan, the slice-47 claim status plan, the slice-48 payment posting plan, the slice-49 account balance plan, the slice-50 account aging plan, the slice-51 account ledger plan, the slice-52 account statement plan, the slice-53 document preview plan, the slice-54 document revision plan, the slice-55 document replacement revision plan, the slice-56 payment posting mutation plan, the slice-57 claim status mutation plan, the slice-58 patient payment capture plan, the slice-59 statement generation plan, the slice-60 statement PDF export plan, the slice-61 statement batch candidate plan, the slice-62 statement batch package export plan, the slice-63 collections work queue plan, and the slice-64 collections follow-up task plan.

## Test Layers

### Database Contract

Database tests validate normalized domain facts in the seeded target.

Current legacy coverage:

- Gold dataset row counts.
- Gold dataset temporal coverage.
- Stable named workflow anchor patients.
- Related workflow counts for appointments, encounters, problems, prescriptions, medications, immunizations, messages, procedure orders, procedure reports, procedure results, billing, claims, payment sessions, payment activities, and patient documents.

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
- Render seeded patient immunization history for a gold pediatric patient.

The focused UI suite is intentionally read-only. Mutation workflows live in the Workflow Mutation Contract suite, where they can combine database pre/post probes with browser-visible evidence when useful.

### Workflow Mutation Contract

Workflow tests validate CRUD-style domain behavior with explicit setup, mutation, assertion, and cleanup steps.

Current legacy coverage:

- Patient contact update, patient demographics update/restore, and temporary patient registration create/delete with pre/post database probes and browser verification in the patient chart.
- Future appointment create, cancel, and delete lifecycle with patient appointment count probes.
- Clinical allergy list create, deactivate, and delete lifecycle with patient allergy count probes.
- Patient message create, close, soft-delete, and hard-cleanup lifecycle with message count probes.
- Patient document create, render, soft-delete, and hard-cleanup lifecycle with document count probes.
- Prescription create, deactivate, and delete lifecycle with patient prescription count probes.
- Immunization create, render, entered-in-error, and delete lifecycle with patient immunization count probes.
- Encounter create, update, and delete lifecycle with vitals and SOAP detail form links.
- CPT billing line create, bill-status update, deactivate, and delete lifecycle.
- Lab procedure order create, complete, report, result, and cascade-delete lifecycle.
- Administration facility and user lifecycle mutation.
- Focused access-control permission assignment revoke/restore lifecycle.
- Focused access-control user group membership assignment/revoke lifecycle.

The legacy implementation is `parity-tests/src/workflows/legacyWorkflowActions.ts`. It uses controlled SQL mutations against the legacy MariaDB schema because OpenEMR's internal PHP entry points and OAuth-protected APIs are not yet wrapped as stable modernization parity adapters. The modernized implementation is `parity-tests/src/workflows/modernizedWorkflowActions.ts`, which mutates implemented workflows through the modernized ASP.NET Core API and reads post-state through normalized PostgreSQL probes. The tests are written as workflow intent so each new modernized mutation slice can implement equivalent actions behind the same behavioral contract. Slice 36 adds `workflow-demographics`, which updates and restores `MOD-PAT-0010` identity, DOB, address, marital-status, and occupation fields on both targets. Slice 37 adds `workflow-registration`, which creates, renders, and removes a temporary `TMP-PAT-REG-*` patient on both targets.

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
npm run test:legacy:plan:claims
npm run test:modernized:plan:claims
npm run test:legacy:plan:payments
npm run test:modernized:plan:payments
npm run test:legacy:plan:account-balance
npm run test:modernized:plan:account-balance
npm run test:legacy:plan:account-aging
npm run test:modernized:plan:account-aging
npm run test:legacy:plan:account-ledger
npm run test:modernized:plan:account-ledger
npm run test:legacy:plan:account-statement
npm run test:modernized:plan:account-statement
npm run test:legacy:plan:statement-generation
npm run test:modernized:plan:statement-generation
npm run test:legacy:plan:statement-pdf
npm run test:modernized:plan:statement-pdf
npm run test:legacy:plan:admin
npm run test:modernized:plan:admin
npm run test:legacy:plan:reports
npm run test:modernized:plan:reports
npm run test:legacy:plan:reports-export
npm run test:modernized:plan:reports-export
npm run test:legacy:plan:documents
npm run test:modernized:plan:documents
npm run test:legacy:plan:immunizations
npm run test:modernized:plan:immunizations
npm run test:legacy:plan:immunization-mutation
npm run test:modernized:plan:immunization-mutation
npm run test:legacy:plan:document-mutation
npm run test:modernized:plan:document-mutation
npm run test:legacy:plan:document-denial
npm run test:modernized:plan:document-denial
npm run test:legacy:plan:document-metadata
npm run test:modernized:plan:document-metadata
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
npm run test:legacy:plan:patient-registration
npm run test:modernized:plan:patient-registration
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
- `--suite all|database|http|ui|workflow|workflow-contact|workflow-demographics|workflow-registration|workflow-appointments|workflow-encounters|workflow-encounter-metadata|workflow-clinical-lists|workflow-problems|workflow-medications|workflow-messages|workflow-documents|workflow-document-binary|workflow-document-signoff|workflow-document-external-link|workflow-document-denial|workflow-document-metadata|workflow-document-archive|workflow-document-content-replace|workflow-document-revision-replace|workflow-insurance|workflow-prescriptions|workflow-immunizations|workflow-billing|workflow-billing-diagnosis|workflow-billing-correction|workflow-billing-modifier|workflow-payment-posting|workflow-claims|workflow-patient-payments|workflow-procedures|workflow-admin|workflow-admin-users|workflow-admin-access|workflow-admin-memberships|admin-access-control|slice1|scheduling|encounters|clinical-lists|messages|procedures|procedure-pending-orders|billing|claims|payments|account-balance|account-aging|account-ledger|account-statement|account-statement-generation|account-statement-pdf|account-statement-batch|account-statement-batch-package|account-collections-work-queue|account-collections-follow-up|admin|reports|reports-export|documents|document-content|document-preview|document-revision|insurance|immunizations`
- `--plan slice-1-readiness|slice-2-scheduling-readiness|slice-3-encounters-readiness|slice-4-clinical-lists-readiness|slice-5-messaging-readiness|slice-6-procedures-readiness|slice-7-billing-readiness|slice-8-admin-readiness|slice-9-reports-readiness|slice-10-contact-mutation-readiness|slice-11-appointment-mutation-readiness|slice-12-encounter-mutation-readiness|slice-13-clinical-list-mutation-readiness|slice-14-message-mutation-readiness|slice-15-prescription-mutation-readiness|slice-16-billing-mutation-readiness|slice-17-procedure-mutation-readiness|slice-18-admin-facility-mutation-readiness|slice-19-admin-user-mutation-readiness|slice-20-access-control-readiness|slice-21-access-permission-mutation-readiness|slice-22-user-group-membership-mutation-readiness|slice-23-procedure-pending-orders-readiness|slice-24-reports-export-readiness|slice-25-documents-readiness|slice-26-document-mutation-readiness|slice-27-document-content-readiness|slice-28-insurance-readiness|slice-29-immunizations-readiness|slice-30-immunization-mutation-readiness|slice-31-problem-mutation-readiness|slice-32-medication-list-mutation-readiness|slice-33-binary-document-mutation-readiness|slice-34-insurance-mutation-readiness|slice-35-encounter-metadata-readiness|slice-36-patient-demographics-mutation-readiness|slice-37-patient-registration-readiness|slice-38-document-signoff-readiness|slice-39-document-external-link-readiness|slice-40-document-denial-readiness|slice-41-document-metadata-readiness|slice-42-document-archive-readiness|slice-43-document-content-replace-readiness|slice-44-billing-diagnosis-readiness|slice-45-billing-correction-readiness|slice-46-billing-modifier-readiness|slice-47-claim-status-readiness|slice-48-payment-posting-readiness|slice-49-account-balance-readiness|slice-50-account-aging-readiness|slice-51-account-ledger-readiness|slice-52-account-statement-readiness|slice-53-document-preview-readiness|slice-54-document-revision-readiness|slice-55-document-revision-replace-readiness|slice-56-payment-posting-mutation-readiness|slice-57-claim-status-mutation-readiness|slice-58-patient-payment-capture-readiness|slice-59-statement-generation-readiness|slice-60-statement-pdf-export-readiness|slice-61-statement-batch-readiness|slice-62-statement-batch-package-readiness|slice-63-collections-work-queue-readiness|slice-64-collections-follow-up-readiness|legacy-readiness|mutation-isolated|full-parity`
- `--reset none|run|suite|test`
- `--headed`
- `--grep <pattern>`
- `--workers <n>`
- `--list`

## Test Management

The test manifest now has two selection layers:

- Suites: layer-level groups such as database, HTTP, UI, workflow, patient-chart slice parity, scheduling slice parity, encounter slice parity, encounter metadata mutation parity, clinical-list slice parity, messaging slice parity, procedure-result slice parity, pending procedure-order slice parity, fee-sheet billing slice parity, fee-sheet diagnosis coding parity, fee-sheet charge correction parity, claim status parity, claim status mutation parity, payment posting parity, payment posting mutation parity, patient payment capture parity, collections follow-up task parity, account balance parity, account aging parity, account ledger parity, account statement parity, patient statement generation parity, patient statement PDF export parity, statement batch candidate parity, statement batch package parity, collections work queue parity, insurance coverage parity, insurance mutation parity, immunization history parity, administration directory slice parity, operational reports slice parity, reports export slice parity, patient documents slice parity, patient document content parity, patient document preview parity, patient document revision parity, patient document replacement revision parity, patient document mutation parity, binary patient-document mutation parity, patient document sign-off parity, patient document external-link parity, patient document denial parity, patient document metadata parity, patient document archive restore parity, patient document content replacement parity, problem-list mutation parity, medication-list mutation parity, and immunization mutation parity.
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
- `slice-28-insurance-readiness` runs the patient insurance coverage suite with a run-level reset for both legacy and modernized targets.
- `slice-29-immunizations-readiness` runs the patient immunizations suite with a run-level reset for both legacy and modernized targets.
- `slice-30-immunization-mutation-readiness` runs the patient immunization mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-31-problem-mutation-readiness` runs the patient problem-list mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-32-medication-list-mutation-readiness` runs the patient medication-list mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-33-binary-document-mutation-readiness` runs the binary patient document mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-34-insurance-mutation-readiness` runs the patient insurance mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-35-encounter-metadata-readiness` runs the encounter metadata mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-36-patient-demographics-mutation-readiness` runs the patient demographics mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-37-patient-registration-readiness` runs the patient registration mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-38-document-signoff-readiness` runs the patient document sign-off mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-39-document-external-link-readiness` runs the patient document external-link mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-40-document-denial-readiness` runs the patient document denial mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-41-document-metadata-readiness` runs the patient document metadata mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-42-document-archive-readiness` runs the patient document archive restore mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-43-document-content-replace-readiness` runs the patient document content replacement mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-44-billing-diagnosis-readiness` runs the billing diagnosis coding mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-45-billing-correction-readiness` runs the billing charge correction mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-46-billing-modifier-readiness` runs the billing modifier mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-47-claim-status-readiness` runs the claim status suite with a run-level reset for both legacy and modernized targets.
- `slice-48-payment-posting-readiness` runs the payment posting suite with a run-level reset for both legacy and modernized targets.
- `slice-49-account-balance-readiness` runs the account balance suite with a run-level reset for both legacy and modernized targets.
- `slice-50-account-aging-readiness` runs the account aging suite with a run-level reset for both legacy and modernized targets.
- `slice-51-account-ledger-readiness` runs the account ledger suite with a run-level reset for both legacy and modernized targets.
- `slice-52-account-statement-readiness` runs the account statement suite with a run-level reset for both legacy and modernized targets.
- `slice-53-document-preview-readiness` runs the document preview suite with a run-level reset for both legacy and modernized targets.
- `slice-54-document-revision-readiness` runs the document revision suite with a run-level reset for both legacy and modernized targets.
- `slice-55-document-revision-replace-readiness` runs the document replacement revision mutation suite with a run-level reset for both legacy and modernized targets.
- `slice-56-payment-posting-mutation-readiness` runs the payment posting mutation suite with a test-level reset for both legacy and modernized targets.
- `slice-57-claim-status-mutation-readiness` runs the claim status mutation suite with a test-level reset for both legacy and modernized targets.
- `slice-58-patient-payment-capture-readiness` runs the patient payment capture mutation suite with a test-level reset for both legacy and modernized targets.
- `slice-59-statement-generation-readiness` runs the account statement generation suite with a run-level reset for both legacy and modernized targets.
- `slice-60-statement-pdf-export-readiness` runs the account statement PDF export suite with a run-level reset for both legacy and modernized targets.
- `slice-61-statement-batch-readiness` runs the account statement batch suite with a run-level reset for both legacy and modernized targets.
- `slice-62-statement-batch-package-readiness` runs the account statement batch package suite with a run-level reset for both legacy and modernized targets.
- `slice-63-collections-work-queue-readiness` runs the account collections work queue suite with a run-level reset for both legacy and modernized targets.
- `slice-64-collections-follow-up-readiness` runs the account collections follow-up task suite with a test-level reset for both legacy and modernized targets.
- `legacy-readiness` runs database, HTTP, and UI with a run-level reset for read-only baseline confidence.
- `mutation-isolated` runs legacy workflow mutations and shared patient contact, patient demographics, patient registration, appointment, encounter, encounter metadata, clinical-list allergy, problem-list, medication-list, message, document, binary document, document sign-off, document external-link, document denial, document metadata, document archive restore, document content replacement, document replacement revision, insurance, prescription, immunization, billing, billing diagnosis, billing correction, billing modifier, payment posting, claim status, patient payment capture, collections follow-up task, procedure, admin-facility, admin-user, access-permission, and user-group-membership mutation suites with per-test resets for strongest mutation isolation.
- `full-parity` runs database, HTTP, UI, workflow, patient contact mutation, patient demographics mutation, patient registration mutation, appointment mutation, encounter mutation, encounter metadata mutation, clinical-list mutation, problem-list mutation, medication-list mutation, message mutation, document mutation, binary document mutation, document sign-off mutation, document external-link mutation, document denial mutation, document metadata mutation, document archive restore mutation, document content replacement mutation, document replacement revision mutation, insurance mutation, prescription mutation, immunization mutation, billing mutation, billing diagnosis mutation, billing correction mutation, billing modifier mutation, payment posting mutation, claim status mutation, patient payment capture mutation, collections follow-up task mutation, procedure mutation, admin facility mutation, admin user mutation, access-permission mutation, user-group-membership mutation, access-control read-model coverage, pending/scheduled procedure-order coverage, reports export coverage, patient documents coverage, patient document content coverage, patient document preview coverage, patient document revision coverage, insurance coverage, immunization history coverage, claim status coverage, payment posting coverage, account balance coverage, account aging coverage, account ledger coverage, account statement coverage, patient statement generation coverage, patient statement PDF export coverage, statement batch candidate coverage, statement batch package coverage, and collections work queue coverage as the target-neutral contract intended for future side-by-side legacy and modernized runs.

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
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-28-insurance-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-29-immunizations-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-30-immunization-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-31-problem-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-32-medication-list-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-33-binary-document-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-34-insurance-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-35-encounter-metadata-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-36-patient-demographics-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-37-patient-registration-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-38-document-signoff-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-39-document-external-link-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-40-document-denial-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-41-document-metadata-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-42-document-archive-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-43-document-content-replace-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-44-billing-diagnosis-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-45-billing-correction-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-46-billing-modifier-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-47-claim-status-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-48-payment-posting-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-49-account-balance-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-50-account-aging-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-51-account-ledger-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-52-account-statement-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-53-document-preview-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-54-document-revision-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-55-document-revision-replace-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-56-payment-posting-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-57-claim-status-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-58-patient-payment-capture-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-59-statement-generation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-60-statement-pdf-export-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-61-statement-batch-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-62-statement-batch-package-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-63-collections-work-queue-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-64-collections-follow-up-readiness.json`
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
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-28-insurance-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-29-immunizations-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-30-immunization-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-31-problem-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-32-medication-list-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-33-binary-document-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-34-insurance-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-35-encounter-metadata-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-36-patient-demographics-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-37-patient-registration-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-38-document-signoff-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-39-document-external-link-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-40-document-denial-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-41-document-metadata-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-42-document-archive-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-43-document-content-replace-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-44-billing-diagnosis-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-45-billing-correction-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-46-billing-modifier-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-47-claim-status-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-48-payment-posting-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-49-account-balance-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-50-account-aging-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-51-account-ledger-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-52-account-statement-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-53-document-preview-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-54-document-revision-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-55-document-revision-replace-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-56-payment-posting-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-57-claim-status-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-58-patient-payment-capture-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-59-statement-generation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-60-statement-pdf-export-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-61-statement-batch-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-62-statement-batch-package-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-63-collections-work-queue-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-64-collections-follow-up-readiness.json`

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

For the twenty-eighth modernized patient insurance coverage slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-28-insurance-readiness
```

For the twenty-ninth modernized patient immunization history slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-29-immunizations-readiness
```

For the thirtieth modernized patient immunization mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-30-immunization-mutation-readiness
```

For the thirty-first modernized patient problem-list mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-31-problem-mutation-readiness
```

For the thirty-second modernized patient medication-list mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-32-medication-list-mutation-readiness
```

For the thirty-third modernized binary patient document mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-33-binary-document-mutation-readiness
```

For the thirty-fourth modernized patient insurance mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-34-insurance-mutation-readiness
```

For the thirty-fifth modernized encounter metadata mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-35-encounter-metadata-readiness
```

For the thirty-sixth modernized patient demographics mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-36-patient-demographics-mutation-readiness
```

For the thirty-seventh modernized patient registration slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-37-patient-registration-readiness
```

For the thirty-eighth modernized patient document sign-off slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-38-document-signoff-readiness
```

For the thirty-ninth modernized patient document external-link slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-39-document-external-link-readiness
```

For the fortieth modernized patient document denial slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-40-document-denial-readiness
```

For the forty-first modernized patient document metadata slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-41-document-metadata-readiness
```

For the forty-second modernized patient document archive restore slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-42-document-archive-readiness
```

For the fifty-first modernized account ledger slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-51-account-ledger-readiness
```

For the fifty-second modernized account statement readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-52-account-statement-readiness
```

For the fifty-third modernized document preview readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-53-document-preview-readiness
```

For the fifty-fourth modernized document revision readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-54-document-revision-readiness
```

For the fifty-fifth modernized document replacement revision readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-55-document-revision-replace-readiness
```

For the fifty-sixth modernized payment posting mutation readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-56-payment-posting-mutation-readiness
```

For the fifty-seventh modernized claim status mutation readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-57-claim-status-mutation-readiness
```

For the fifty-eighth modernized patient payment capture readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-58-patient-payment-capture-readiness
```

For the fifty-ninth modernized patient statement generation readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-59-statement-generation-readiness
```

For the sixtieth modernized patient statement PDF export readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-60-statement-pdf-export-readiness
```

For the sixty-first modernized statement batch candidate readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-61-statement-batch-readiness
```

For the sixty-second modernized statement batch package export readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-62-statement-batch-package-readiness
```

For the sixty-third modernized collections work queue readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-63-collections-work-queue-readiness
```

For the sixty-fourth modernized collections follow-up task readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-64-collections-follow-up-readiness
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
- Slice 28 insurance plan.
- Slice 29 immunizations plan.
- Slice 30 immunization mutation plan.
- Slice 31 problem mutation plan.
- Slice 32 medication-list mutation plan.
- Slice 33 binary patient-document mutation plan.
- Slice 34 insurance mutation plan.
- Slice 35 encounter metadata plan.
- Slice 36 patient demographics mutation plan.
- Slice 37 patient registration plan.
- Slice 38 document sign-off plan.
- Slice 39 document external-link plan.
- Slice 40 document denial plan.
- Slice 41 document metadata plan.
- Slice 42 document archive restore plan.
- Slice 43 document content replacement plan.
- Slice 44 billing diagnosis plan.
- Slice 45 billing correction plan.
- Slice 46 billing modifier plan.
- Slice 47 claim status plan.
- Slice 48 payment posting plan.
- Slice 49 account balance plan.
- Slice 50 account aging plan.
- Slice 51 account ledger plan.
- Slice 52 account statement plan.
- Slice 53 document preview plan.
- Slice 54 document revision plan.
- Slice 55 document replacement revision plan.
- Slice 56 payment posting mutation plan.
- Slice 57 claim status mutation plan.
- Slice 58 patient payment capture plan.
- Slice 59 statement generation plan.
- Slice 60 statement PDF export plan.
- Slice 61 statement batch plan.
- Slice 62 statement batch package plan.
- Slice 63 collections work queue plan.
- Slice 64 collections follow-up task plan.
- Full parity plan.
- Full legacy parity suite.

The modernized app currently exposes these test actions:

- Modernized smoke test for API health, anchor patient search, anchor chart summary, patient demographics mutation, patient registration lifecycle, insurance coverage, insurance mutation, anchor immunization history, anchor appointment search/detail, anchor encounter search/detail, encounter metadata mutation, clinical lists, patient messages, patient documents, patient document content retrieval, patient document preview readiness, patient document revision readiness, patient document replacement revision lifecycle, binary patient-document mutation, patient document sign-off, patient document denial, patient document metadata refiling, patient document archive restore, patient document content replacement, external-link patient-document mutation, procedure results, pending/scheduled procedure orders, fee-sheet billing, claim status summary, claim status mutation, payment posting summary, payment posting mutation, patient payment capture, account balance summary, account aging summary, account ledger summary, account statement readiness, patient statement generation, patient statement PDF export, statement batch candidates, statement batch package export, collections work queue, collections follow-up task lifecycle, administration directory, administration access control, operational reports, operational reports CSV export, appointment mutation, encounter mutation, clinical-list allergy mutation, problem-list mutation, medication-list mutation, patient-message mutation, patient-document mutation, prescription mutation, immunization mutation, billing mutation, billing diagnosis mutation, billing correction mutation, billing modifier mutation, procedure mutation, admin facility mutation, admin user mutation, access-permission mutation, and user group membership mutation.
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
- Slice 28 insurance plan for side-by-side patient coverage parity.
- Slice 29 immunizations plan for side-by-side pediatric vaccine-history parity.
- Slice 30 immunization mutation plan for side-by-side vaccine create/render/entered-in-error/delete parity.
- Slice 31 problem mutation plan for side-by-side problem-list create/render/deactivate/delete parity.
- Slice 32 medication-list mutation plan for side-by-side medication-list create/render/deactivate/delete parity.
- Slice 33 binary patient-document mutation plan for side-by-side PDF-style document create/render/download/archive/delete parity.
- Slice 34 insurance mutation plan for side-by-side patient coverage create/render/update/delete parity.
- Slice 35 encounter metadata plan for side-by-side encounter sensitivity/referral/external-ID/POS create/render/update/delete parity.
- Slice 36 patient demographics mutation plan for side-by-side identity, DOB, address, marital-status, and occupation update/render/restore parity.
- Slice 37 patient registration plan for side-by-side temporary patient create/render/delete parity.
- Slice 38 document sign-off plan for side-by-side patient document approve/render/archive/delete parity.
- Slice 39 document external-link plan for side-by-side patient document web-url create/render/archive/delete parity.
- Slice 40 document denial plan for side-by-side patient document deny/render/archive/delete parity.
- Slice 41 document metadata plan for side-by-side patient document refile/render/archive/delete parity.
- Slice 42 document archive restore plan for side-by-side patient document archive/restore/render/delete parity.
- Slice 43 document content replacement plan for side-by-side patient document replace/render/archive/delete parity.
- Slice 44 billing diagnosis plan for side-by-side fee-sheet ICD10 create/render/deactivate/delete parity.
- Slice 45 billing correction plan for side-by-side fee-sheet CPT create/correct/render/deactivate/delete parity.
- Slice 46 billing modifier plan for side-by-side fee-sheet CPT create/modify/render/deactivate/delete parity.
- Slice 47 claim status plan for side-by-side read-only claim status parity.
- Slice 48 payment posting plan for side-by-side read-only AR payment posting parity.
- Slice 49 account balance plan for side-by-side read-only charge/payment/adjustment/balance parity.
- Slice 50 account aging plan for side-by-side read-only AR aging bucket parity.
- Slice 51 account ledger plan for side-by-side read-only chronological running-balance parity.
- Slice 52 account statement plan for side-by-side read-only statement readiness parity.
- Slice 53 document preview plan for side-by-side read-only document preview readiness parity.
- Slice 54 document revision plan for side-by-side read-only document revision readiness parity.
- Slice 55 document replacement revision plan for side-by-side document content replacement revision parity.
- Slice 56 payment posting mutation plan for side-by-side payment posting create/render/void/delete parity.
- Slice 57 claim status mutation plan for side-by-side claim create/generate/clear/delete parity.
- Slice 58 patient payment capture plan for side-by-side patient payment create/render/void/delete parity.
- Slice 59 statement generation plan for side-by-side printable patient statement generation parity.
- Slice 60 statement PDF export plan for side-by-side deterministic patient statement PDF export parity.
- Slice 61 statement batch plan for side-by-side ranked statement candidate parity.
- Slice 62 statement batch package plan for side-by-side deterministic package export parity.
- Slice 63 collections work queue plan for side-by-side past-due account queue parity.
- Slice 64 collections follow-up task plan for side-by-side pnotes-compatible task lifecycle parity.

The Workbench runs only allowlisted commands. It displays latest evidence per test card and stores lifecycle/test action events in `modernization-workbench/artifacts/events.json`.

The Test Runs page also includes a custom parity run builder for each managed app. The Workbench API exposes `parity-tests/test-manifest.json`, and the UI lets an operator choose suite or plan, a specific suite or plan id, reset mode, headed mode, and an optional Playwright grep filter. The backend validates those choices against the manifest before it constructs the existing `scripts/Run-OpenEmrParityTests.ps1` command. This gives the project a real test manager for targeted runs while keeping command execution local and constrained.

## Modernized Target Parity Path

The modernized target now exists and currently includes twenty-nine read-only slices plus thirty-five mutation-capable slices through Slice 64. The smoke test proves that the target can run, consume the shared gold dataset, retrieve deterministic anchors across patient, insurance coverage, immunization history, scheduling, encounter, clinical-list, messaging, completed procedure-result, pending procedure-order, billing, claim status, payment posting, account balance, account aging, account ledger, account statement readiness, patient statement generation, patient statement PDF export, statement batch candidates, statement batch package export, collections work queue, administration, access-control, reporting, report export, patient document, patient document content, patient document preview, and patient document revision workflows, and perform safe cleanup-backed mutation lifecycles for patient contact, patient demographics, patient registration, insurance coverage, appointments, encounters, encounter metadata, allergies, problem lists, medication lists, messages, collections follow-up tasks, text/binary/sign-off/denial/metadata/archive/content-replacement/replacement-revision/external-link patient documents, prescriptions, immunizations, billing lines, billing diagnosis lines, billing correction lines, billing modifier lines, claim statuses, payment postings, patient payments, procedures, facilities, users, ACL permission assignments, and ACL user group memberships.

The slice readiness plans from `slice-1-readiness` through `slice-64-collections-follow-up-readiness` prove the same normalized database facts, browser-visible behavior, mutation post-state where applicable, cleanup, and restoration expectations against both legacy and modernized targets. The newest collections follow-up task plan covers pnotes-compatible task creation from the collections queue, close/archive/delete cleanup, legacy pnotes rendering, modernized Messages rendering, and modernized Fees workspace Create Task behavior; the collections work queue plan covers past-due account ranking, high-priority and over-90 exposure rollups, recommended collection actions, contact method selection, and modernized Fees workspace Collections Work Queue rendering; the statement batch package plan covers deterministic package ID, manifest rows, summary CSV, included statement PDFs, and modernized Fees workspace Batch Export rendering; the statement batch plan covers ranked positive-balance candidates, all-candidate balance totals, due dates, delivery metadata, and modernized Fees workspace work-queue rendering; the statement PDF export plan covers deterministic PDF content, response headers, download filename, generated statement number, payment instructions, EOB-backed payment references, and modernized Fees workspace download rendering; the statement generation plan covers printable statement number, payment instructions, generated text, statement line items, totals, and modernized Fees workspace rendering; the patient payment capture plan covers temporary patient-responsibility payment create/render/void/delete behavior, payer-type-zero semantics, active payment hiding after void, balance/ledger recalculation, cleanup, and modernized Fees workspace rendering; the claim status mutation plan covers temporary claim create/generate/clear/delete behavior, versioning, process-file state, cleanup, and modernized Fees workspace rendering; the payment posting mutation plan covers temporary AR payment create/render/void/delete behavior, active payment hiding after void, balance/ledger recalculation, cleanup, and modernized Fees workspace rendering; the document replacement revision plan covers temporary document content replacement, current revision timestamp movement, revision hash changes, single-current-version state, cleanup, and modernized Documents workspace rendering; the document revision plan covers current revision timestamp, version label, history count, revision hash, and modernized Documents workspace revision rendering; the document preview plan covers preview kind, inline-readiness, thumbnail label, thumbnail text, and modernized Documents workspace thumbnail rendering; the account statement plan covers statement-ready recipient, period, due-date, current-due, past-due, oldest-open, and balance-due facts plus modernized Fees workspace Statement Readiness rendering; the account ledger plan covers chronological charge, payment, adjustment, and running-balance rows plus modernized Fees workspace Account Ledger rendering; the account aging plan covers deterministic Current, 31-60, 61-90, and Over 90 AR buckets plus modernized Fees workspace Aging Summary rendering; the account balance plan covers charge, payment, adjustment, and balance rollups plus modernized Fees workspace Account Balance rendering; the payment posting plan covers seeded OpenEMR `ar_session` and `ar_activity` rows and modernized Fees workspace payment-posting rendering; the claim status plan covers seeded OpenEMR `claims` rows and modernized Fees workspace claim-status rendering; the billing modifier plan covers temporary fee-sheet CPT create/modify/render/deactivate/delete behavior with direct modifier verification and modernized Fees workspace modifier controls; the billing correction plan covers temporary fee-sheet CPT create/correct/render/deactivate/delete behavior with direct billing row verification and modernized Fees workspace correction controls; the billing diagnosis plan covers temporary fee-sheet `ICD10` diagnosis create/render/deactivate/delete behavior with direct billing row verification and modernized Fees workspace diagnosis controls; the document content replacement plan covers temporary patient document create/replace-content/render/archive/delete behavior with explicit modernized Replace controls; the document archive restore plan covers temporary patient document create/archive/hidden-content/restore/render/delete behavior with explicit modernized archived-record visibility and Restore controls; the document metadata plan covers temporary patient document create/refile/render/archive/delete behavior with direct metadata verification and modernized inline Edit controls; the document denial plan covers temporary patient document create/pending-read/deny/render/archive/delete behavior with direct review-status verification; the document external-link plan covers temporary patient document `web_url` create/read/render/archive/delete behavior with direct URL/storage verification; the document sign-off plan covers temporary patient document create/pending-read/approve/render/archive/delete behavior with direct review-status verification; the patient registration plan covers temporary `TMP-PAT-REG-*` patient create/read/render/delete behavior with direct row verification for demographics and contact fields plus browser-visible chart checks; the patient demographics plan covers identity, DOB, address, marital-status, and occupation update/restore behavior with direct row verification for all fields and browser-visible checks for the demographics fields each target exposes; the encounter metadata plan covers temporary encounter sensitivity/referral/external-ID/POS create/render/update/delete behavior in the legacy workflow database and modernized Encounters workspace; the insurance mutation plan covers temporary tertiary coverage create/render/update/delete behavior in the legacy insurance browse screen and modernized Patient/Client chart; the binary patient-document mutation plan covers temporary PDF-style document create/render/download/archive/delete behavior in the legacy document list and modernized Documents workspace; the medication-list mutation plan covers temporary medication-list create/render/deactivate/delete behavior in the legacy patient summary and modernized Lists workspace; the problem-list mutation plan covers temporary medical-problem create/render/deactivate/delete behavior in the legacy patient summary and modernized Lists workspace; the immunization mutation plan covers temporary influenza create/render/entered-in-error/delete behavior in the legacy Immunizations page and modernized Lists workspace; the immunizations plan covers pediatric vaccine-history comparison; the insurance plan covers primary and secondary coverage comparison in the legacy demographics screen and modernized chart; the document content plan covers full stored document payload comparison plus modernized content API, viewer, and download behavior; the document mutation plan covers database-backed text document create/render/archive/delete behavior; the read-only documents plan covers seeded patient document metadata and visible document lists; the reports plans cover deterministic operational-report facts and CSV export rows; the lab plan covers seeded future scheduled procedure orders without report rows; the administration/security plans cover seeded ACL groups, visible permission objects, representative group-permission assignments, default `admin` and `oe-system` memberships, focused Front Office `patients:demo` assignment revoke/restore behavior, and focused temporary-user Front Office membership assignment/revoke behavior.

Next parity steps:

1. Add additional modernized workflow actions behind the same mutation-test intent as CRUD slices are implemented.
2. Add modernized UI helpers behind the same browser workflow intent for each new mutation slice.
3. Add additional slice readiness plans or graduate slices into the full parity plan once both targets support them.
4. Add comparison views in the Workbench that read the two run summaries and normalized probe outputs.

The test code should continue to assert observable behavior and normalized domain state, not identical implementation details.
