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

The modernized target is represented in `parity-tests/config/targets.json` as `modernized-openemr` with status `implemented`. It currently supports the slice-1 patient search/chart summary plan, the slice-2 read-only scheduling plan, the slice-3 read-only encounters plan, the slice-4 read-only clinical-lists plan, the slice-5 read-only messaging plan, the slice-6 read-only completed procedures plan, the slice-7 read-only fee-sheet billing plan, the slice-8 read-only administration directory plan, the slice-9 read-only operational reports plan, the slice-10 patient contact mutation plan, the slice-11 appointment mutation plan, the slice-93 appointment reschedule plan, the slice-94 appointment arrival plan, the slice-12 encounter mutation plan, the slice-13 clinical-list allergy mutation plan, the slice-14 patient-message mutation plan, the slice-15 prescription mutation plan, the slice-16 billing mutation plan, the slice-17 procedure mutation plan, the slice-129 procedure result correction plan, the slice-130 procedure specimen readiness plan, the slice-131 procedure specimen detail plan, the slice-132 procedure order correction plan, the slice-133 procedure report correction plan, the slice-18 admin facility mutation plan, the slice-19 admin user mutation plan, the slice-20 access-control read model plan, the slice-21 access-permission mutation plan, the slice-22 user group membership mutation plan, the slice-23 pending/scheduled procedure orders plan, the slice-24 reports export plan, the slice-25 patient documents plan, the slice-26 patient document mutation plan, the slice-27 patient document content plan, the slice-28 patient insurance coverage plan, the slice-29 patient immunization history plan, the slice-30 patient immunization mutation plan, the slice-31 patient problem-list mutation plan, the slice-32 patient medication-list mutation plan, the slice-33 binary patient-document mutation plan, the slice-34 patient insurance mutation plan, the slice-35 encounter metadata mutation plan, the slice-36 patient demographics mutation plan, the slice-37 patient registration plan, the slice-38 patient document sign-off plan, the slice-39 patient document external-link plan, the slice-40 patient document denial plan, the slice-41 patient document metadata plan, the slice-42 patient document archive restore plan, the slice-43 patient document content replacement plan, the slice-44 billing diagnosis plan, the slice-45 billing correction plan, the slice-46 billing modifier plan, the slice-47 claim status plan, the slice-48 payment posting plan, the slice-49 account balance plan, the slice-50 account aging plan, the slice-51 account ledger plan, the slice-52 account statement plan, the slice-53 document preview plan, the slice-54 document revision plan, the slice-55 document replacement revision plan, the slice-56 payment posting mutation plan, the slice-57 claim status mutation plan, the slice-58 patient payment capture plan, the slice-59 statement generation plan, the slice-60 statement PDF export plan, the slice-61 statement batch candidate plan, the slice-62 statement batch package export plan, the slice-63 collections work queue plan, the slice-64 collections follow-up task plan, the slice-65 patient-message assignment plan, the slice-66 patient-message content plan, the slice-67 encounter document attachment plan, the slice-68 encounter billing linkage plan, the slice-69 encounter claim linkage plan, the slice-70 encounter procedure order linkage plan, the slice-71 encounter diagnosis coding plan, the slice-72 encounter billing linkage mutation plan, the slice-73 encounter diagnosis coding mutation plan, the slice-74 encounter fee-sheet entry plan, the slice-75 encounter procedure-order entry plan, the slice-76 encounter procedure-result entry plan, the slice-77 encounter sign-off plan, the slice-78 encounter document upload plan, the slice-79 encounter binary document upload plan, the slice-126 encounter scanned attachment readiness plan, the slice-127 encounter binary document content replacement plan, the slice-128 patient binary document content replacement plan, the slice-80 encounter document sign-off plan, the slice-81 encounter document denial plan, the slice-82 encounter document metadata plan, the slice-83 encounter document move plan, the slice-84 encounter document content replacement plan, the slice-85 encounter document archive/restore plan, the slice-86 encounter document lifecycle timeline plan, the slice-87 encounter external-link document plan, the slice-88 patient image document preview plan, the slice-89 patient image document thumbnail plan, the slice-90 patient PDF document inline-preview plan, the slice-91 patient document lifecycle timeline plan, the slice-92 patient scanned attachment plan, the slice-93 appointment reschedule plan, the slice-94 appointment arrival plan, the slice-95 appointment check-out plan, the slice-96 appointment no-show plan, the slice-97 appointment category plan, the slice-98 appointment pending-status plan, the slice-99 appointment provider reassignment plan, the slice-100 appointment facility reassignment plan, the slice-101 appointment billing-location reassignment plan, the slice-102 appointment comments plan, the slice-103 appointment recurrence metadata plan, the slice-104 appointment recurring-series plan, the slice-105 appointment recurrence-exceptions plan, the slice-106 appointment occurrence-cancel plan, the slice-107 appointment occurrence-restore plan, the slice-108 appointment occurrence-reschedule plan, the slice-109 appointment recurrence exception-list edit plan, the slice-110 appointment series root update plan, the slice-111 appointment series root metadata plan, the slice-112 appointment monthly recurrence plan, the slice-113 appointment recurrence unit matrix plan, the slice-114 appointment days-of-week recurrence plan, the slice-115 appointment monthly repeat-on recurrence plan, the slice-116 appointment series recurrence update plan, the slice-117 appointment provider overlap plan, the slice-118 appointment patient overlap plan, the slice-119 appointment room overlap plan, the slice-120 appointment reminders readiness plan, the slice-121 encounter co-signature readiness plan, the slice-122 encounter document revision readiness plan, and the slice-123 encounter document replacement revision readiness plan.

Slice 175 adds clinical-list authorization-policy readiness to the same modernized target contract with the `workflow-clinical-list-authorization-policy` suite and `slice-175-clinical-list-authorization-policy-readiness` plan. Slice 174 operational reports authorization-policy readiness remains available through the `workflow-reports-authorization-policy` suite and `slice-174-reports-authorization-policy-readiness` plan. Slice 173 administration authorization-policy readiness remains available through the `workflow-admin-authorization-policy` suite and `slice-173-admin-authorization-policy-readiness` plan. Slice 172 procedure protection readiness remains available through the `workflow-procedure-protection` suite and `slice-172-procedure-protection-readiness` plan. Slice 171 billing protection readiness remains available through the `workflow-billing-protection` suite and `slice-171-billing-protection-readiness` plan. Slice 170 patient message protection readiness remains available through the `workflow-message-protection` suite and `slice-170-message-protection-readiness` plan. Slice 169 document protection readiness remains available through the `workflow-document-protection` suite and `slice-169-document-protection-readiness` plan. Slice 168 encounter protection readiness remains available through the `workflow-encounter-protection` suite and `slice-168-encounter-protection-readiness` plan. Slice 167 appointment protection readiness remains available through the `workflow-appointment-protection` suite and `slice-167-appointment-protection-readiness` plan. Slice 166 clinical-list protection readiness remains available through the `workflow-clinical-list-protection` suite and `slice-166-clinical-list-protection-readiness` plan. Slice 165 patient chart protection readiness remains available through the `workflow-patient-protection` suite and `slice-165-patient-protection-readiness` plan. Slice 164 operational reports protection readiness remains available through the `workflow-reports-protection` suite and `slice-164-reports-protection-readiness` plan. Slice 163 admin directory protection readiness remains available through the `workflow-admin-directory-protection` suite and `slice-163-admin-directory-protection-readiness` plan. Slice 162 admin audit protection readiness remains available through the `workflow-admin-audit-protection` suite and `slice-162-admin-audit-protection-readiness` plan. Slice 156 adds patient message reply readiness to the same modernized target contract with the `workflow-message-reply` suite and `slice-156-message-reply-readiness` plan. Slice 154 procedure report reopen review readiness remains available through the `workflow-procedure-report-reopen-review` suite and `slice-154-procedure-report-reopen-review-readiness` plan, Slice 153 procedure report bulk sign-off readiness remains available through the `workflow-procedure-report-bulk-signoff` suite and `slice-153-procedure-report-bulk-signoff-readiness` plan, Slice 151 procedure order transmit readiness remains available through the `workflow-procedure-order-transmit` suite and `slice-151-procedure-order-transmit-readiness` plan, Slice 149 procedure order queue readiness remains available through the `workflow-procedure-order-queue` suite and `slice-149-procedure-order-queue-readiness` plan, Slice 148 procedure vendor compendium import readiness remains available through the `workflow-procedure-vendor-compendium-import` suite and `slice-148-procedure-vendor-compendium-import-readiness` plan, Slice 147 procedure order catalog lifecycle readiness remains available through the `workflow-procedure-order-catalog-lifecycle` suite and `slice-147-procedure-order-catalog-lifecycle-readiness` plan, Slice 145 procedure order catalog readiness remains available through the `workflow-procedure-order-catalog` suite and `slice-145-procedure-order-catalog-readiness` plan, Slice 144 procedure lab provider address-book linkage readiness remains available through the `workflow-procedure-lab-provider-address-book` suite and `slice-144-procedure-lab-provider-address-book-readiness` plan, Slice 142 procedure lab provider configuration readiness remains available through the `workflow-procedure-lab-provider-configuration` suite and `slice-142-procedure-lab-provider-configuration-readiness` plan, Slice 141 procedure lab provider lifecycle readiness remains available through the `workflow-procedure-lab-provider-lifecycle` suite and `slice-141-procedure-lab-provider-lifecycle-readiness` plan, Slice 140 procedure lab provider directory readiness remains available through the `workflow-procedure-lab-provider-directory` suite and `slice-140-procedure-lab-provider-directory-readiness` plan, Slice 139 procedure lab provider catalog readiness remains available through the `workflow-procedure-lab-provider-catalog` suite and `slice-139-procedure-lab-provider-catalog-readiness` plan, Slice 138 procedure report review queue lab filter readiness remains available through the `workflow-procedure-report-review-queue-lab-filters` suite and `slice-138-procedure-report-review-queue-lab-filters-readiness` plan, Slice 137 procedure report review queue provider filter readiness remains available through the `workflow-procedure-report-review-queue-provider-filters` suite and `slice-137-procedure-report-review-queue-provider-filters-readiness` plan, Slice 136 procedure report review queue patient/date filter readiness remains available through the `workflow-procedure-report-review-queue-filters` suite and `slice-136-procedure-report-review-queue-filters-readiness` plan, Slice 135 procedure report review queue readiness remains available through the `workflow-procedure-report-review-queue` suite and `slice-135-procedure-report-review-queue-readiness` plan, and Slice 134 procedure report sign-off remains available through the `workflow-procedure-report-signoff` suite and `slice-134-procedure-report-signoff-readiness` plan.

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
npm run test:legacy:plan:document-scanned-attachment
npm run test:modernized:plan:document-scanned-attachment
npm run test:legacy:plan:contact-mutation
npm run test:modernized:plan:contact-mutation
npm run test:legacy:plan:appointment-mutation
npm run test:modernized:plan:appointment-mutation
npm run test:legacy:plan:appointment-days-of-week-recurrence
npm run test:modernized:plan:appointment-days-of-week-recurrence
npm run test:legacy:plan:encounter-mutation
npm run test:modernized:plan:encounter-mutation
npm run test:legacy:plan:clinical-list-mutation
npm run test:modernized:plan:clinical-list-mutation
npm run test:legacy:plan:message-mutation
npm run test:modernized:plan:message-mutation
npm run test:legacy:plan:message-assignment
npm run test:modernized:plan:message-assignment
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
npm run test:legacy:plan:encounter-documents
npm run test:modernized:plan:encounter-documents
npm run test:legacy:plan:encounter-billing-mutation
npm run test:modernized:plan:encounter-billing-mutation
npm run test:legacy:plan:encounter-diagnosis-mutation
npm run test:modernized:plan:encounter-diagnosis-mutation
npm run test:legacy:plan:encounter-fee-sheet-entry
npm run test:modernized:plan:encounter-fee-sheet-entry
npm run test:legacy:plan:encounter-document-upload
npm run test:modernized:plan:encounter-document-upload
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
- `--suite all|database|http|ui|workflow|workflow-contact|workflow-demographics|workflow-registration|workflow-appointments|workflow-appointment-reschedule|workflow-appointment-arrival|workflow-appointment-checkout|workflow-appointment-noshow|workflow-appointment-category|workflow-appointment-pending|workflow-appointment-provider|workflow-appointment-facility|workflow-appointment-billing-location|workflow-appointment-comments|workflow-appointment-recurrence|workflow-appointment-series|workflow-appointment-recurrence-exceptions|workflow-appointment-occurrence-cancel|workflow-appointment-occurrence-restore|workflow-appointment-occurrence-reschedule|workflow-appointment-recurrence-exception-edit|workflow-appointment-series-root-update|workflow-appointment-series-root-metadata|workflow-appointment-monthly-recurrence|workflow-appointment-recurrence-unit-matrix|workflow-appointment-days-of-week-recurrence|workflow-appointment-monthly-repeat-on-recurrence|workflow-appointment-series-recurrence-update|workflow-appointment-provider-overlap|workflow-appointment-patient-overlap|workflow-appointment-room-overlap|workflow-appointment-reminders|workflow-encounters|workflow-encounter-metadata|workflow-encounter-billing|workflow-encounter-diagnoses|workflow-encounter-fee-sheet|workflow-encounter-procedures|workflow-encounter-procedure-results|workflow-encounter-signoff|workflow-encounter-cosignature|workflow-encounter-documents|workflow-encounter-binary-documents|workflow-encounter-document-scanned-attachment|workflow-encounter-document-binary-content-replace|workflow-encounter-document-signoff|workflow-encounter-document-denial|workflow-encounter-document-metadata|workflow-encounter-document-move|workflow-encounter-document-content-replace|workflow-encounter-document-revision-replace|workflow-encounter-document-archive|workflow-encounter-document-lifecycle|workflow-encounter-document-external-link|workflow-clinical-lists|workflow-problems|workflow-medications|workflow-messages|workflow-message-assignment|workflow-message-content|workflow-message-reply|workflow-message-update-metadata|message-portal-metadata|workflow-documents|workflow-document-binary|workflow-document-binary-content-replace|workflow-document-image-preview|workflow-document-image-thumbnail|workflow-document-pdf-preview|workflow-document-lifecycle|workflow-document-scanned-attachment|workflow-document-signoff|workflow-document-external-link|workflow-document-denial|workflow-document-metadata|workflow-document-archive|workflow-document-content-replace|workflow-document-revision-replace|workflow-insurance|workflow-prescriptions|workflow-immunizations|workflow-billing|workflow-billing-diagnosis|workflow-billing-correction|workflow-billing-modifier|workflow-payment-posting|workflow-claims|workflow-patient-payments|workflow-procedures|workflow-procedure-result-correction|workflow-procedure-specimen|workflow-procedure-specimen-detail|workflow-procedure-order-correction|workflow-procedure-report-correction|workflow-procedure-report-signoff|workflow-procedure-report-review-queue|workflow-procedure-report-review-queue-filters|workflow-procedure-report-review-queue-provider-filters|workflow-procedure-report-review-queue-lab-filters|workflow-procedure-report-bulk-signoff|workflow-procedure-report-reopen-review|workflow-procedure-lab-provider-catalog|workflow-procedure-lab-provider-directory|workflow-procedure-lab-provider-lifecycle|workflow-procedure-lab-provider-configuration|workflow-admin|workflow-admin-users|workflow-admin-access|workflow-admin-memberships|workflow-admin-login|workflow-admin-login-audit|workflow-admin-session|admin-access-control|slice1|scheduling|encounters|clinical-lists|messages|procedures|procedure-pending-orders|encounter-documents|encounter-document-revision|encounter-billing|encounter-claims|encounter-procedures|billing|claims|payments|account-balance|account-aging|account-ledger|account-statement|account-statement-generation|account-statement-pdf|account-statement-batch|account-statement-batch-package|account-collections-work-queue|account-collections-follow-up|admin|reports|reports-export|documents|document-content|document-preview|document-revision|insurance|immunizations`
- `--plan slice-1-readiness|slice-2-scheduling-readiness|slice-3-encounters-readiness|slice-4-clinical-lists-readiness|slice-5-messaging-readiness|slice-6-procedures-readiness|slice-7-billing-readiness|slice-8-admin-readiness|slice-9-reports-readiness|slice-10-contact-mutation-readiness|slice-11-appointment-mutation-readiness|slice-12-encounter-mutation-readiness|slice-13-clinical-list-mutation-readiness|slice-14-message-mutation-readiness|slice-15-prescription-mutation-readiness|slice-16-billing-mutation-readiness|slice-17-procedure-mutation-readiness|slice-129-procedure-result-correction-readiness|slice-130-procedure-specimen-readiness|slice-131-procedure-specimen-detail-readiness|slice-132-procedure-order-correction-readiness|slice-133-procedure-report-correction-readiness|slice-134-procedure-report-signoff-readiness|slice-135-procedure-report-review-queue-readiness|slice-136-procedure-report-review-queue-filters-readiness|slice-137-procedure-report-review-queue-provider-filters-readiness|slice-138-procedure-report-review-queue-lab-filters-readiness|slice-139-procedure-lab-provider-catalog-readiness|slice-140-procedure-lab-provider-directory-readiness|slice-141-procedure-lab-provider-lifecycle-readiness|slice-142-procedure-lab-provider-configuration-readiness|slice-144-procedure-lab-provider-address-book-readiness|slice-147-procedure-order-catalog-lifecycle-readiness|slice-148-procedure-vendor-compendium-import-readiness|slice-149-procedure-order-queue-readiness|slice-151-procedure-order-transmit-readiness|slice-153-procedure-report-bulk-signoff-readiness|slice-154-procedure-report-reopen-review-readiness|slice-18-admin-facility-mutation-readiness|slice-19-admin-user-mutation-readiness|slice-20-access-control-readiness|slice-21-access-permission-mutation-readiness|slice-22-user-group-membership-mutation-readiness|slice-23-procedure-pending-orders-readiness|slice-24-reports-export-readiness|slice-25-documents-readiness|slice-26-document-mutation-readiness|slice-27-document-content-readiness|slice-28-insurance-readiness|slice-29-immunizations-readiness|slice-30-immunization-mutation-readiness|slice-31-problem-mutation-readiness|slice-32-medication-list-mutation-readiness|slice-33-binary-document-mutation-readiness|slice-34-insurance-mutation-readiness|slice-35-encounter-metadata-readiness|slice-36-patient-demographics-mutation-readiness|slice-37-patient-registration-readiness|slice-38-document-signoff-readiness|slice-39-document-external-link-readiness|slice-40-document-denial-readiness|slice-41-document-metadata-readiness|slice-42-document-archive-readiness|slice-43-document-content-replace-readiness|slice-44-billing-diagnosis-readiness|slice-45-billing-correction-readiness|slice-46-billing-modifier-readiness|slice-47-claim-status-readiness|slice-48-payment-posting-readiness|slice-49-account-balance-readiness|slice-50-account-aging-readiness|slice-51-account-ledger-readiness|slice-52-account-statement-readiness|slice-53-document-preview-readiness|slice-54-document-revision-readiness|slice-55-document-revision-replace-readiness|slice-56-payment-posting-mutation-readiness|slice-57-claim-status-mutation-readiness|slice-58-patient-payment-capture-readiness|slice-59-statement-generation-readiness|slice-60-statement-pdf-export-readiness|slice-61-statement-batch-readiness|slice-62-statement-batch-package-readiness|slice-63-collections-work-queue-readiness|slice-64-collections-follow-up-readiness|slice-65-message-assignment-readiness|slice-66-message-content-readiness|slice-156-message-reply-readiness|slice-157-message-portal-metadata-readiness|slice-158-message-update-metadata-readiness|slice-159-admin-login-readiness|slice-160-admin-login-audit-readiness|slice-161-admin-session-readiness|slice-67-encounter-documents-readiness|slice-68-encounter-billing-readiness|slice-69-encounter-claims-readiness|slice-70-encounter-procedures-readiness|slice-71-encounter-diagnoses-readiness|slice-72-encounter-billing-mutation-readiness|slice-73-encounter-diagnosis-mutation-readiness|slice-74-encounter-fee-sheet-entry-readiness|slice-75-encounter-procedure-order-entry-readiness|slice-76-encounter-procedure-result-entry-readiness|slice-77-encounter-signoff-readiness|slice-78-encounter-document-upload-readiness|slice-79-encounter-binary-document-upload-readiness|slice-126-encounter-document-scanned-attachment-readiness|slice-127-encounter-document-binary-content-replace-readiness|slice-128-document-binary-content-replace-readiness|slice-80-encounter-document-signoff-readiness|slice-81-encounter-document-denial-readiness|slice-82-encounter-document-metadata-readiness|slice-83-encounter-document-move-readiness|slice-84-encounter-document-content-replace-readiness|slice-85-encounter-document-archive-readiness|slice-86-encounter-document-lifecycle-readiness|slice-87-encounter-document-external-link-readiness|slice-88-document-image-preview-readiness|slice-89-document-image-thumbnail-readiness|slice-90-document-pdf-preview-readiness|slice-91-document-lifecycle-readiness|slice-92-document-scanned-attachment-readiness|slice-93-appointment-reschedule-readiness|slice-94-appointment-arrival-readiness|slice-95-appointment-checkout-readiness|slice-96-appointment-noshow-readiness|slice-97-appointment-category-readiness|slice-98-appointment-pending-readiness|slice-99-appointment-provider-readiness|slice-100-appointment-facility-readiness|slice-101-appointment-billing-location-readiness|slice-102-appointment-comments-readiness|slice-103-appointment-recurrence-readiness|slice-104-appointment-series-readiness|slice-105-appointment-recurrence-exceptions-readiness|slice-106-appointment-occurrence-cancel-readiness|slice-107-appointment-occurrence-restore-readiness|slice-108-appointment-occurrence-reschedule-readiness|slice-109-appointment-recurrence-exception-edit-readiness|slice-110-appointment-series-root-update-readiness|slice-111-appointment-series-root-metadata-readiness|slice-112-appointment-monthly-recurrence-readiness|slice-113-appointment-recurrence-unit-matrix-readiness|slice-114-appointment-days-of-week-recurrence-readiness|slice-115-appointment-monthly-repeat-on-recurrence-readiness|slice-116-appointment-series-recurrence-update-readiness|slice-117-appointment-provider-overlap-readiness|slice-118-appointment-patient-overlap-readiness|slice-119-appointment-room-overlap-readiness|slice-120-appointment-reminders-readiness|slice-121-encounter-cosignature-readiness|slice-122-encounter-document-revision-readiness|slice-123-encounter-document-revision-replace-readiness|legacy-readiness|mutation-isolated|full-parity`
- Slice 154 adds `workflow-procedure-report-reopen-review` to the suite allow-list and `slice-154-procedure-report-reopen-review-readiness` to the plan allow-list.
- Slice 153 adds `workflow-procedure-report-bulk-signoff` to the suite allow-list and `slice-153-procedure-report-bulk-signoff-readiness` to the plan allow-list.
- Slice 151 adds `workflow-procedure-order-transmit` to the suite allow-list and `slice-151-procedure-order-transmit-readiness` to the plan allow-list.
- Slice 149 adds `workflow-procedure-order-queue` to the suite allow-list and `slice-149-procedure-order-queue-readiness` to the plan allow-list.
- `--reset none|run|suite|test`
- `--headed`
- `--grep <pattern>`
- `--workers <n>`
- `--list`

Slice 166 extends these allow-lists with `workflow-clinical-list-protection` and `slice-166-clinical-list-protection-readiness`; Slice 165 remains available with `workflow-patient-protection` and `slice-165-patient-protection-readiness`; Slice 164 remains available with `workflow-reports-protection` and `slice-164-reports-protection-readiness`; Slice 163 remains available with `workflow-admin-directory-protection` and `slice-163-admin-directory-protection-readiness`; Slice 162 remains available with `workflow-admin-audit-protection` and `slice-162-admin-audit-protection-readiness`; Slice 161 remains available with `workflow-admin-session` and `slice-161-admin-session-readiness`; Slice 160 remains available with `workflow-admin-login-audit` and `slice-160-admin-login-audit-readiness`; Slice 159 remains available with `workflow-admin-login` and `slice-159-admin-login-readiness`; Slice 158 remains available with `workflow-message-update-metadata` and `slice-158-message-update-metadata-readiness`; Slice 157 remains available with `message-portal-metadata` and `slice-157-message-portal-metadata-readiness`; Slice 156 remains available with `workflow-message-reply` and `slice-156-message-reply-readiness`; Slice 154 remains available with `workflow-procedure-report-reopen-review` and `slice-154-procedure-report-reopen-review-readiness`; Slice 153 remains available with `workflow-procedure-report-bulk-signoff` and `slice-153-procedure-report-bulk-signoff-readiness`; Slice 151 remains available with `workflow-procedure-order-transmit` and `slice-151-procedure-order-transmit-readiness`; Slice 149 remains available with `workflow-procedure-order-queue` and `slice-149-procedure-order-queue-readiness`; Slice 148 remains available with `workflow-procedure-vendor-compendium-import` and `slice-148-procedure-vendor-compendium-import-readiness`; Slice 147 remains available with `workflow-procedure-order-catalog-lifecycle` and `slice-147-procedure-order-catalog-lifecycle-readiness`; Slice 145 remains available with `workflow-procedure-order-catalog` and `slice-145-procedure-order-catalog-readiness`; Slice 144 remains available with `workflow-procedure-lab-provider-address-book` and `slice-144-procedure-lab-provider-address-book-readiness`; Slice 142 remains available with `workflow-procedure-lab-provider-configuration` and `slice-142-procedure-lab-provider-configuration-readiness`; Slice 141 remains available with `workflow-procedure-lab-provider-lifecycle` and `slice-141-procedure-lab-provider-lifecycle-readiness`; Slice 140 remains available with `workflow-procedure-lab-provider-directory` and `slice-140-procedure-lab-provider-directory-readiness`; Slice 139 remains available with `workflow-procedure-lab-provider-catalog` and `slice-139-procedure-lab-provider-catalog-readiness`; Slice 138 report review queue lab filters remain available with `workflow-procedure-report-review-queue-lab-filters` and `slice-138-procedure-report-review-queue-lab-filters-readiness`; Slice 137 report review queue provider filters remain available with `workflow-procedure-report-review-queue-provider-filters` and `slice-137-procedure-report-review-queue-provider-filters-readiness`; Slice 136 report review queue filters remain available with `workflow-procedure-report-review-queue-filters` and `slice-136-procedure-report-review-queue-filters-readiness`; Slice 135 report review queue remains available with `workflow-procedure-report-review-queue` and `slice-135-procedure-report-review-queue-readiness`; Slice 134 report sign-off remains available with `workflow-procedure-report-signoff` and `slice-134-procedure-report-signoff-readiness`; Slice 133 report correction remains available with `workflow-procedure-report-correction` and `slice-133-procedure-report-correction-readiness`; Slice 132 order correction remains available with `workflow-procedure-order-correction` and `slice-132-procedure-order-correction-readiness`; Slice 131 order-level specimen detail remains available with `workflow-procedure-specimen-detail` and `slice-131-procedure-specimen-detail-readiness`; Slice 130 report-level procedure specimen metadata remains available with `workflow-procedure-specimen` and `slice-130-procedure-specimen-readiness`; Slice 129 procedure result correction remains available with `workflow-procedure-result-correction` and `slice-129-procedure-result-correction-readiness`; Slice 128 patient binary document content replacement remains available with `workflow-document-binary-content-replace` and `slice-128-document-binary-content-replace-readiness`; Slice 127 encounter binary content replacement remains available with `workflow-encounter-document-binary-content-replace` and `slice-127-encounter-document-binary-content-replace-readiness`; Slice 126 encounter scanned attachment readiness, Slice 123 encounter document replacement revision, Slice 122 encounter document revision, and Slice 121 encounter co-signature remain available; Slice 120 appointment reminders, Slice 119 appointment room overlap, Slice 118 appointment patient overlap, Slice 117 appointment provider overlap, Slice 116 appointment series recurrence update, Slice 115 appointment monthly repeat-on recurrence, Slice 114 appointment days-of-week recurrence, Slice 103 appointment recurrence metadata, Slice 104 appointment recurring-series, Slice 105 appointment recurrence-exceptions, Slice 106 appointment occurrence-cancel, Slice 107 appointment occurrence-restore, Slice 108 appointment occurrence-reschedule, Slice 109 appointment recurrence exception-list edit, Slice 110 appointment series root update, Slice 111 appointment series root metadata, Slice 112 monthly recurrence, Slice 113 appointment recurrence unit matrix, and Slice 93 through Slice 102 appointment scheduling entries remain available.

## Test Management

The test manifest now has two selection layers:

- Suites: layer-level groups such as database, HTTP, UI, workflow, patient-chart slice parity, scheduling slice parity, encounter slice parity, encounter metadata mutation parity, encounter billing linkage mutation parity, encounter diagnosis coding mutation parity, encounter fee-sheet entry parity, encounter procedure-order entry parity, encounter procedure-result parity, encounter sign-off parity, encounter co-signature parity, encounter document upload parity, encounter binary document upload parity, encounter document sign-off parity, encounter document denial parity, encounter document metadata parity, encounter document move parity, encounter document content replacement parity, encounter document replacement revision parity, encounter document archive restore parity, encounter document lifecycle timeline parity, encounter external-link document parity, clinical-list slice parity, messaging slice parity, patient-message assignment parity, patient-message content parity, patient-message update metadata parity, encounter document attachment parity, encounter document revision parity, encounter billing linkage parity, encounter claim linkage parity, encounter procedure order linkage parity, procedure-result slice parity, procedure specimen detail parity, procedure order correction parity, pending procedure-order slice parity, fee-sheet billing slice parity, fee-sheet diagnosis coding parity, fee-sheet charge correction parity, claim status parity, claim status mutation parity, payment posting parity, payment posting mutation parity, patient payment capture parity, collections follow-up task parity, account balance parity, account aging parity, account ledger parity, account statement parity, patient statement generation parity, patient statement PDF export parity, statement batch candidate parity, statement batch package parity, collections work queue parity, insurance coverage parity, insurance mutation parity, immunization history parity, administration directory slice parity, operational reports slice parity, reports export slice parity, patient documents slice parity, patient document content parity, patient document preview parity, patient image document preview parity, patient image document thumbnail parity, patient PDF document preview parity, patient document lifecycle timeline parity, patient scanned attachment parity, appointment reschedule parity, appointment arrival parity, appointment check-out parity, appointment no-show parity, appointment category parity, appointment pending-status parity, appointment provider reassignment parity, appointment facility reassignment parity, appointment billing-location reassignment parity, appointment comments parity, appointment recurrence metadata parity, appointment recurring-series parity, appointment recurrence-exceptions parity, appointment occurrence-cancel parity, appointment occurrence-restore parity, appointment occurrence-reschedule parity, appointment recurrence exception-list edit parity, appointment series root update parity, appointment series root metadata parity, appointment monthly recurrence parity, appointment recurrence unit matrix parity, appointment days-of-week recurrence parity, appointment monthly repeat-on recurrence parity, appointment series recurrence update parity, appointment provider overlap parity, appointment patient overlap parity, appointment room overlap parity, appointment reminders parity, patient document revision parity, patient document replacement revision parity, patient document mutation parity, binary patient-document mutation parity, patient document sign-off parity, patient document external-link parity, patient document denial parity, patient document metadata parity, patient document archive restore parity, patient document content replacement parity, patient binary document content replacement parity, problem-list mutation parity, medication-list mutation parity, and immunization mutation parity.
- Plans: operator-facing run plans that select suites, reset behavior, target support, and intent.

Current plans:

- `slice-1-readiness` runs database and patient chart parity with a run-level reset for both legacy and modernized targets.
- `slice-2-scheduling-readiness` runs the scheduling parity suite with a run-level reset for both legacy and modernized targets.
- `slice-3-encounters-readiness` runs the encounter SOAP/vitals parity suite with a run-level reset for both legacy and modernized targets.
- `slice-4-clinical-lists-readiness` runs the clinical-lists parity suite with a run-level reset for both legacy and modernized targets.
- `slice-5-messaging-readiness` runs the messages parity suite with a run-level reset for both legacy and modernized targets.
- `slice-157-message-portal-metadata-readiness` runs the patient-message portal metadata suite with a run-level reset for both legacy and modernized targets.
- `slice-158-message-update-metadata-readiness` runs the patient-message update metadata suite with a per-test reset for both legacy and modernized targets.
- `slice-6-procedures-readiness` runs the procedures parity suite with a run-level reset for both legacy and modernized targets.
- `slice-7-billing-readiness` runs the billing parity suite with a run-level reset for both legacy and modernized targets.
- `slice-8-admin-readiness` runs the admin parity suite with a run-level reset for both legacy and modernized targets.
- `slice-159-admin-login-readiness` runs the admin login readiness parity suite with a run-level reset for both legacy and modernized targets.
- `slice-160-admin-login-audit-readiness` runs the admin login audit readiness parity suite with a run-level reset for both legacy and modernized targets.
- `slice-161-admin-session-readiness` runs the admin session readiness parity suite with a run-level reset for both legacy and modernized targets.
- `slice-162-admin-audit-protection-readiness` runs the admin audit protection readiness parity suite with a run-level reset for both legacy and modernized targets.
- `slice-163-admin-directory-protection-readiness` runs the admin directory protection readiness parity suite with a run-level reset for both legacy and modernized targets.
- `slice-164-reports-protection-readiness` runs the operational reports protection readiness parity suite with a run-level reset for both legacy and modernized targets.
- `slice-166-clinical-list-protection-readiness` runs the clinical-list protection readiness parity suite with a run-level reset for both legacy and modernized targets.
- `slice-165-patient-protection-readiness` runs the patient chart protection readiness parity suite with a run-level reset for both legacy and modernized targets.
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
- `slice-65-message-assignment-readiness` runs the patient-message assignment suite with a test-level reset for both legacy and modernized targets.
- `slice-66-message-content-readiness` runs the patient-message content edit suite with a test-level reset for both legacy and modernized targets.
- `slice-67-encounter-documents-readiness` runs the encounter document attachment suite with a run-level reset for both legacy and modernized targets.
- `slice-122-encounter-document-revision-readiness` runs the encounter document revision suite with a run-level reset for both legacy and modernized targets.
- `slice-123-encounter-document-revision-replace-readiness` runs the encounter document replacement revision suite with a test-level reset for both legacy and modernized targets.
- `slice-126-encounter-document-scanned-attachment-readiness` runs the encounter scanned attachment readiness suite with a test-level reset for both legacy and modernized targets.
- `slice-127-encounter-document-binary-content-replace-readiness` runs the encounter binary document content replacement suite with a test-level reset for both legacy and modernized targets.
- `slice-128-document-binary-content-replace-readiness` runs the patient binary document content replacement suite with a test-level reset for both legacy and modernized targets.
- `slice-68-encounter-billing-readiness` runs the encounter billing linkage suite with a run-level reset for both legacy and modernized targets.
- `slice-69-encounter-claims-readiness` runs the encounter claim linkage suite with a run-level reset for both legacy and modernized targets.
- `slice-70-encounter-procedures-readiness` runs the encounter procedure order linkage suite with a run-level reset for both legacy and modernized targets.
- `slice-71-encounter-diagnoses-readiness` runs the encounter diagnosis coding suite with a run-level reset for both legacy and modernized targets.
- `slice-72-encounter-billing-mutation-readiness` runs the encounter billing linkage mutation suite with a test-level reset for both legacy and modernized targets.
- `slice-73-encounter-diagnosis-mutation-readiness` runs the encounter diagnosis coding mutation suite with a test-level reset for both legacy and modernized targets.
- `slice-74-encounter-fee-sheet-entry-readiness` runs the encounter fee-sheet entry suite with a test-level reset for both legacy and modernized targets.
- `slice-75-encounter-procedure-order-entry-readiness` runs the encounter procedure-order entry suite with a test-level reset for both legacy and modernized targets.
- `slice-76-encounter-procedure-result-entry-readiness` runs the encounter procedure-result entry suite with a test-level reset for both legacy and modernized targets.
- `slice-129-procedure-result-correction-readiness` runs the procedure result correction suite with a test-level reset for both legacy and modernized targets.
- `slice-130-procedure-specimen-readiness` runs the procedure specimen metadata suite with a test-level reset for both legacy and modernized targets.
- `slice-131-procedure-specimen-detail-readiness` runs the order-level procedure specimen detail suite with a test-level reset for both legacy and modernized targets.
- `slice-132-procedure-order-correction-readiness` runs the procedure order correction suite with a test-level reset for both legacy and modernized targets.
- `slice-133-procedure-report-correction-readiness` runs the procedure report correction suite with a test-level reset for both legacy and modernized targets.
- `slice-134-procedure-report-signoff-readiness` runs the procedure report sign-off suite with a test-level reset for both legacy and modernized targets.
- `slice-135-procedure-report-review-queue-readiness` runs the procedure report review queue suite with a test-level reset for both legacy and modernized targets.
- `slice-136-procedure-report-review-queue-filters-readiness` runs the procedure report review queue filters suite with a test-level reset for both legacy and modernized targets.
- `slice-137-procedure-report-review-queue-provider-filters-readiness` runs the procedure report review queue provider filters suite with a test-level reset for both legacy and modernized targets.
- `slice-138-procedure-report-review-queue-lab-filters-readiness` runs the procedure report review queue lab filters suite with a test-level reset for both legacy and modernized targets.
- `slice-77-encounter-signoff-readiness` runs the encounter sign-off suite with a test-level reset for both legacy and modernized targets.
- `slice-121-encounter-cosignature-readiness` runs the encounter co-signature suite with a test-level reset for both legacy and modernized targets.
- `slice-78-encounter-document-upload-readiness` runs the encounter document upload suite with a test-level reset for both legacy and modernized targets.
- `slice-79-encounter-binary-document-upload-readiness` runs the encounter binary document upload suite with a test-level reset for both legacy and modernized targets.
- `slice-80-encounter-document-signoff-readiness` runs the encounter document sign-off suite with a test-level reset for both legacy and modernized targets.
- `slice-81-encounter-document-denial-readiness` runs the encounter document denial suite with a test-level reset for both legacy and modernized targets.
- `slice-82-encounter-document-metadata-readiness` runs the encounter document metadata suite with a test-level reset for both legacy and modernized targets.
- `slice-83-encounter-document-move-readiness` runs the encounter document move suite with a test-level reset for both legacy and modernized targets.
- `slice-84-encounter-document-content-replace-readiness` runs the encounter document content replacement suite with a test-level reset for both legacy and modernized targets.
- `slice-85-encounter-document-archive-readiness` runs the encounter document archive/restore suite with a test-level reset for both legacy and modernized targets.
- `slice-86-encounter-document-lifecycle-readiness` runs the encounter document lifecycle timeline suite with a test-level reset for both legacy and modernized targets.
- `slice-87-encounter-document-external-link-readiness` runs the encounter external-link document suite with a test-level reset for both legacy and modernized targets.
- `slice-88-document-image-preview-readiness` runs the patient image document preview suite with a test-level reset for both legacy and modernized targets.
- `slice-89-document-image-thumbnail-readiness` runs the patient image document thumbnail suite with a test-level reset for both legacy and modernized targets.
- `slice-90-document-pdf-preview-readiness` runs the patient PDF document inline-preview suite with a test-level reset for both legacy and modernized targets.
- `slice-91-document-lifecycle-readiness` runs the patient document lifecycle timeline suite with a test-level reset for both legacy and modernized targets.
- `slice-92-document-scanned-attachment-readiness` runs the patient scanned attachment suite with a test-level reset for both legacy and modernized targets.
- `slice-93-appointment-reschedule-readiness` runs the appointment reschedule suite with a test-level reset for both legacy and modernized targets.
- `slice-94-appointment-arrival-readiness` runs the appointment arrival suite with a test-level reset for both legacy and modernized targets.
- `slice-95-appointment-checkout-readiness` runs the appointment check-out suite with a test-level reset for both legacy and modernized targets.
- `slice-96-appointment-noshow-readiness` runs the appointment no-show suite with a test-level reset for both legacy and modernized targets.
- `slice-97-appointment-category-readiness` runs the appointment category suite with a test-level reset for both legacy and modernized targets.
- `slice-98-appointment-pending-readiness` runs the appointment pending-status suite with a test-level reset for both legacy and modernized targets.
- `slice-99-appointment-provider-readiness` runs the appointment provider reassignment suite with a test-level reset for both legacy and modernized targets.
- `slice-100-appointment-facility-readiness` runs the appointment facility reassignment suite with a test-level reset for both legacy and modernized targets.
- `slice-101-appointment-billing-location-readiness` runs the appointment billing-location reassignment suite with a test-level reset for both legacy and modernized targets.
- `slice-102-appointment-comments-readiness` runs the appointment comments suite with a test-level reset for both legacy and modernized targets.
- `slice-103-appointment-recurrence-readiness` runs the appointment recurrence metadata suite with a test-level reset for both legacy and modernized targets.
- `slice-104-appointment-series-readiness` runs the appointment recurring-series suite with a run-level reset for both legacy and modernized targets.
- `slice-105-appointment-recurrence-exceptions-readiness` runs the appointment recurrence-exceptions suite with a run-level reset for both legacy and modernized targets.
- `slice-106-appointment-occurrence-cancel-readiness` runs the appointment occurrence-cancel suite with a test-level reset for both legacy and modernized targets.
- `slice-107-appointment-occurrence-restore-readiness` runs the appointment occurrence-restore suite with a test-level reset for both legacy and modernized targets.
- `slice-108-appointment-occurrence-reschedule-readiness` runs the appointment occurrence-reschedule suite with a test-level reset for both legacy and modernized targets.
- `slice-109-appointment-recurrence-exception-edit-readiness` runs the appointment recurrence exception-edit suite with a test-level reset for both legacy and modernized targets.
- `slice-110-appointment-series-root-update-readiness` runs the appointment series root update suite with a test-level reset for both legacy and modernized targets.
- `slice-111-appointment-series-root-metadata-readiness` runs the appointment series root metadata suite with a test-level reset for both legacy and modernized targets.
- `slice-112-appointment-monthly-recurrence-readiness` runs the appointment monthly recurrence suite with a test-level reset for both legacy and modernized targets.
- `slice-113-appointment-recurrence-unit-matrix-readiness` runs the appointment recurrence unit matrix suite with a test-level reset for both legacy and modernized targets.
- `slice-114-appointment-days-of-week-recurrence-readiness` runs the appointment days-of-week recurrence suite with a test-level reset for both legacy and modernized targets.
- `slice-115-appointment-monthly-repeat-on-recurrence-readiness` runs the appointment monthly repeat-on recurrence suite with a test-level reset for both legacy and modernized targets.
- `slice-116-appointment-series-recurrence-update-readiness` runs the appointment series recurrence update suite with a test-level reset for both legacy and modernized targets.
- `slice-117-appointment-provider-overlap-readiness` runs the appointment provider overlap suite with a test-level reset for both legacy and modernized targets.
- `slice-118-appointment-patient-overlap-readiness` runs the appointment patient overlap suite with a test-level reset for both legacy and modernized targets.
- `slice-119-appointment-room-overlap-readiness` runs the appointment room overlap suite with a test-level reset for both legacy and modernized targets.
- `slice-120-appointment-reminders-readiness` runs the appointment reminders suite with a run-level reset for both legacy and modernized targets.
- `legacy-readiness` runs database, HTTP, and UI with a run-level reset for read-only baseline confidence.
- `mutation-isolated` runs legacy workflow mutations and shared patient contact, patient demographics, patient registration, appointment, appointment recurrence exception-list edit, appointment series root update, appointment series root metadata, appointment monthly recurrence, appointment recurrence unit matrix, appointment days-of-week recurrence, appointment monthly repeat-on recurrence, appointment series recurrence update, appointment provider overlap, appointment patient overlap, appointment room overlap, encounter, encounter metadata, encounter billing linkage mutation, encounter diagnosis coding mutation, encounter fee-sheet entry mutation, encounter procedure-order entry mutation, encounter procedure-result entry mutation, encounter sign-off mutation, encounter co-signature mutation, encounter document upload mutation, encounter binary document upload mutation, encounter document sign-off mutation, encounter document denial mutation, encounter document metadata mutation, encounter document move mutation, encounter document content replacement mutation, encounter document archive/restore mutation, encounter document lifecycle timeline mutation, encounter external-link document mutation, clinical-list allergy, problem-list, medication-list, message, message assignment, message content, document, binary document, document sign-off, document external-link, document denial, document metadata, document archive restore, document content replacement, document binary content replacement, document replacement revision, document scanned attachment, insurance, prescription, immunization, billing, billing diagnosis, billing correction, billing modifier, payment posting, claim status, patient payment capture, collections follow-up task, procedure, procedure-result correction, procedure specimen metadata, procedure specimen detail, procedure order correction, procedure report sign-off, admin-facility, admin-user, access-permission, and user-group-membership mutation suites with per-test resets for strongest mutation isolation.
- `full-parity` runs database, HTTP, UI, workflow, appointment recurrence-exceptions, appointment occurrence-cancel mutation, appointment occurrence-restore mutation, appointment occurrence-reschedule mutation, appointment recurrence exception-list edit mutation, appointment series root update mutation, appointment series root metadata mutation, appointment monthly recurrence mutation, appointment recurrence unit matrix mutation, appointment days-of-week recurrence mutation, appointment monthly repeat-on recurrence mutation, appointment series recurrence update mutation, appointment provider overlap mutation, appointment patient overlap mutation, appointment room overlap mutation, appointment reminders coverage, patient contact mutation, patient demographics mutation, patient registration mutation, appointment mutation, appointment reschedule mutation, appointment arrival mutation, encounter mutation, encounter metadata mutation, encounter billing linkage mutation, encounter diagnosis coding mutation, encounter fee-sheet entry mutation, encounter procedure-order entry mutation, encounter procedure-result entry mutation, encounter sign-off mutation, encounter co-signature mutation, encounter document upload mutation, encounter binary document upload mutation, encounter document sign-off mutation, encounter document denial mutation, encounter document metadata mutation, encounter document move mutation, encounter document content replacement mutation, encounter document archive/restore mutation, encounter document lifecycle timeline mutation, encounter external-link document mutation, clinical-list mutation, problem-list mutation, medication-list mutation, message mutation, message assignment mutation, message content mutation, document mutation, binary document mutation, document sign-off mutation, document external-link mutation, document denial mutation, document metadata mutation, document archive restore mutation, document content replacement mutation, document binary content replacement mutation, document replacement revision mutation, document scanned attachment mutation, insurance mutation, prescription mutation, immunization mutation, billing mutation, billing diagnosis mutation, billing correction mutation, billing modifier mutation, payment posting mutation, claim status mutation, patient payment capture mutation, collections follow-up task mutation, procedure mutation, procedure result correction mutation, procedure specimen metadata mutation, procedure specimen detail mutation, procedure order correction mutation, procedure report correction mutation, procedure report sign-off mutation, admin facility mutation, admin user mutation, access-permission mutation, user-group-membership mutation, access-control read-model coverage, pending/scheduled procedure-order coverage, reports export coverage, patient documents coverage, patient document content coverage, patient document preview coverage, patient document revision coverage, patient document scanned attachment coverage, insurance coverage, immunization history coverage, claim status coverage, payment posting coverage, account balance coverage, account aging coverage, account ledger coverage, account statement coverage, patient statement generation coverage, patient statement PDF export coverage, statement batch candidate coverage, statement batch package coverage, collections work queue coverage, encounter document attachment coverage, encounter billing linkage coverage, encounter claim linkage coverage, encounter procedure-order linkage coverage, and encounter diagnosis coding coverage as the target-neutral contract intended for future side-by-side legacy and modernized runs.

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
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-65-message-assignment-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-66-message-content-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-67-encounter-documents-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-68-encounter-billing-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-69-encounter-claims-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-70-encounter-procedures-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-71-encounter-diagnoses-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-72-encounter-billing-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-73-encounter-diagnosis-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-74-encounter-fee-sheet-entry-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-75-encounter-procedure-order-entry-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-76-encounter-procedure-result-entry-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-77-encounter-signoff-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-92-document-scanned-attachment-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-93-appointment-reschedule-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-94-appointment-arrival-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-95-appointment-checkout-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-96-appointment-noshow-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-97-appointment-category-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-98-appointment-pending-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-99-appointment-provider-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-100-appointment-facility-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-101-appointment-billing-location-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-102-appointment-comments-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-103-appointment-recurrence-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-104-appointment-series-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-105-appointment-recurrence-exceptions-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-106-appointment-occurrence-cancel-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-107-appointment-occurrence-restore-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-108-appointment-occurrence-reschedule-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-109-appointment-recurrence-exception-edit-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-110-appointment-series-root-update-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-111-appointment-series-root-metadata-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-112-appointment-monthly-recurrence-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-113-appointment-recurrence-unit-matrix-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-114-appointment-days-of-week-recurrence-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-115-appointment-monthly-repeat-on-recurrence-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-116-appointment-series-recurrence-update-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-117-appointment-provider-overlap-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-118-appointment-patient-overlap-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-119-appointment-room-overlap-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-120-appointment-reminders-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-121-encounter-cosignature-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-122-encounter-document-revision-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-123-encounter-document-revision-replace-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-126-encounter-document-scanned-attachment-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-127-encounter-document-binary-content-replace-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-128-document-binary-content-replace-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-129-procedure-result-correction-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-130-procedure-specimen-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-131-procedure-specimen-detail-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-132-procedure-order-correction-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-133-procedure-report-correction-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-134-procedure-report-signoff-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-135-procedure-report-review-queue-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-136-procedure-report-review-queue-filters-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-137-procedure-report-review-queue-provider-filters-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-138-procedure-report-review-queue-lab-filters-readiness.json`
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
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-65-message-assignment-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-66-message-content-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-67-encounter-documents-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-68-encounter-billing-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-69-encounter-claims-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-70-encounter-procedures-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-71-encounter-diagnoses-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-72-encounter-billing-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-73-encounter-diagnosis-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-74-encounter-fee-sheet-entry-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-75-encounter-procedure-order-entry-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-76-encounter-procedure-result-entry-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-77-encounter-signoff-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-92-document-scanned-attachment-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-93-appointment-reschedule-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-94-appointment-arrival-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-95-appointment-checkout-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-96-appointment-noshow-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-97-appointment-category-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-98-appointment-pending-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-99-appointment-provider-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-100-appointment-facility-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-101-appointment-billing-location-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-102-appointment-comments-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-103-appointment-recurrence-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-104-appointment-series-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-105-appointment-recurrence-exceptions-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-106-appointment-occurrence-cancel-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-107-appointment-occurrence-restore-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-108-appointment-occurrence-reschedule-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-109-appointment-recurrence-exception-edit-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-110-appointment-series-root-update-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-111-appointment-series-root-metadata-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-112-appointment-monthly-recurrence-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-113-appointment-recurrence-unit-matrix-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-114-appointment-days-of-week-recurrence-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-115-appointment-monthly-repeat-on-recurrence-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-116-appointment-series-recurrence-update-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-117-appointment-provider-overlap-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-118-appointment-patient-overlap-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-119-appointment-room-overlap-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-120-appointment-reminders-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-121-encounter-cosignature-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-122-encounter-document-revision-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-123-encounter-document-revision-replace-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-126-encounter-document-scanned-attachment-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-127-encounter-document-binary-content-replace-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-128-document-binary-content-replace-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-129-procedure-result-correction-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-130-procedure-specimen-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-131-procedure-specimen-detail-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-132-procedure-order-correction-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-133-procedure-report-correction-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-134-procedure-report-signoff-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-135-procedure-report-review-queue-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-136-procedure-report-review-queue-filters-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-137-procedure-report-review-queue-provider-filters-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-138-procedure-report-review-queue-lab-filters-readiness.json`

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

For the sixty-fifth modernized patient-message assignment readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-65-message-assignment-readiness
```

For the sixty-sixth modernized patient-message content readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-66-message-content-readiness
```

For the one-hundred-fifty-sixth modernized patient-message reply readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-156-message-reply-readiness
```

For the sixty-seventh modernized encounter document attachment readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-67-encounter-documents-readiness
```

For the sixty-eighth modernized encounter billing linkage readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-68-encounter-billing-readiness
```

For the sixty-ninth modernized encounter claim linkage readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-69-encounter-claims-readiness
```

For the seventieth modernized encounter procedure order linkage readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-70-encounter-procedures-readiness
```

For the seventy-first modernized encounter diagnosis coding readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-71-encounter-diagnoses-readiness
```

For the seventy-second modernized encounter billing linkage mutation readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-72-encounter-billing-mutation-readiness
```

For the seventy-third modernized encounter diagnosis coding mutation readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-73-encounter-diagnosis-mutation-readiness
```

For the seventy-fourth modernized encounter fee-sheet entry readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-74-encounter-fee-sheet-entry-readiness
```

For the eightieth modernized encounter document sign-off readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-80-encounter-document-signoff-readiness
```

For the eighty-fifth modernized encounter document archive/restore readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-85-encounter-document-archive-readiness
```

For the eighty-seventh modernized encounter external-link document readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-87-encounter-document-external-link-readiness
```

For the ninety-second modernized patient scanned attachment readiness slice, compare the side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-92-document-scanned-attachment-readiness
```

For the ninety-third modernized appointment reschedule readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-93-appointment-reschedule-readiness
```

For the ninety-fourth modernized appointment arrival readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-94-appointment-arrival-readiness
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
- Slice 129 procedure result correction plan.
- Slice 130 procedure specimen metadata plan.
- Slice 131 procedure specimen detail plan.
- Slice 132 procedure order correction plan.
- Slice 133 procedure report correction plan.
- Slice 134 procedure report sign-off plan.
- Slice 135 procedure report review queue plan.
- Slice 136 procedure report review queue filters plan.
- Slice 137 procedure report review queue provider filters plan.
- Slice 138 procedure report review queue lab filters plan.
- Slice 145 procedure order catalog plan.
- Slice 147 procedure order catalog lifecycle plan.
- Slice 148 procedure vendor compendium import plan.
- Slice 149 procedure order queue plan.
- Slice 151 procedure order transmit plan.
- Slice 153 procedure report bulk sign-off plan.
- Slice 154 procedure report reopen review plan.
- Slice 144 procedure lab provider address-book plan.
- Slice 142 procedure lab provider configuration plan.
- Slice 141 procedure lab provider lifecycle plan.
- Slice 140 procedure lab provider directory plan.
- Slice 139 procedure lab provider catalog plan.
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
- Slice 65 patient-message assignment plan.
- Slice 66 patient-message content plan.
- Slice 156 patient-message reply plan.
- Slice 157 patient-message portal metadata plan.
- Slice 159 admin login readiness plan.
- Slice 160 admin login audit readiness plan.
- Slice 161 admin session readiness plan.
- Slice 162 admin audit protection readiness plan.
- Slice 163 admin directory protection readiness plan.
- Slice 164 operational reports protection readiness plan.
- Slice 166 clinical-list protection readiness plan.
- Slice 165 patient chart protection readiness plan.
- Slice 158 patient-message update metadata plan.
- Slice 67 encounter documents plan.
- Slice 68 encounter billing plan.
- Slice 69 encounter claims plan.
- Slice 70 encounter procedures plan.
- Slice 71 encounter diagnoses plan.
- Slice 72 encounter billing linkage mutation plan.
- Slice 73 encounter diagnosis coding mutation plan.
- Slice 74 encounter fee-sheet entry plan.
- Slice 75 encounter procedure-order entry plan.
- Slice 76 encounter procedure-result entry plan.
- Slice 77 encounter sign-off plan.
- Slice 78 encounter document upload plan.
- Slice 79 encounter binary document upload plan.
- Slice 80 encounter document sign-off plan.
- Slice 81 encounter document denial plan.
- Slice 82 encounter document metadata plan.
- Slice 83 encounter document move plan.
- Slice 84 encounter document content replacement plan.
- Slice 85 encounter document archive/restore plan.
- Slice 86 encounter document lifecycle timeline plan.
- Slice 87 encounter external-link document plan.
- Slice 88 patient image document preview plan.
- Slice 89 patient image document thumbnail plan.
- Slice 90 patient PDF document inline-preview plan.
- Slice 91 patient document lifecycle timeline plan.
- Slice 92 patient scanned attachment plan.
- Slice 93 appointment reschedule plan.
- Slice 94 appointment arrival plan.
- Slice 95 appointment check-out plan.
- Slice 96 appointment no-show plan.
- Slice 97 appointment category plan.
- Slice 98 appointment pending-status plan.
- Slice 99 appointment provider reassignment plan.
- Slice 100 appointment facility reassignment plan.
- Slice 101 appointment billing-location reassignment plan.
- Full parity plan.
- Full legacy parity suite.

The modernized app currently exposes these test actions:

- Modernized smoke test for API health, anchor patient search, anchor chart summary, patient demographics mutation, patient registration lifecycle, insurance coverage, insurance mutation, anchor immunization history, anchor appointment search/detail, anchor encounter search/detail, encounter document attachment readiness, encounter document revision readiness, encounter document upload lifecycle, encounter binary document upload lifecycle, encounter document metadata lifecycle, encounter document move lifecycle, encounter document content replacement lifecycle, encounter document archive restore lifecycle, encounter document lifecycle timeline, encounter external-link document lifecycle, encounter document sign-off lifecycle, encounter document denial lifecycle, encounter billing linkage readiness, encounter billing linkage mutation visibility, encounter claim linkage readiness, encounter procedure order linkage readiness, encounter diagnosis coding readiness, encounter diagnosis coding mutation visibility, encounter sign-off lifecycle, encounter co-signature lifecycle, encounter metadata mutation, clinical lists, patient messages, patient documents, patient document content retrieval, patient document preview readiness, patient image document preview lifecycle, patient image document thumbnail readiness, patient PDF inline preview readiness, patient document lifecycle timeline, patient scanned attachment readiness, patient document revision readiness, patient document replacement revision lifecycle, patient binary document content replacement lifecycle, procedure result correction lifecycle, procedure report specimen metadata, procedure specimen detail lifecycle, procedure order correction lifecycle, procedure report correction lifecycle, procedure report sign-off lifecycle, procedure report review queue lifecycle, procedure report review queue filter lifecycle, procedure report review queue provider filter lifecycle, procedure report review queue lab filter lifecycle, procedure lab provider lifecycle, procedure lab provider configuration, binary patient-document mutation, patient document sign-off, patient document denial, patient document metadata refiling, patient document archive restore, patient document content replacement, external-link patient-document mutation, procedure results, pending/scheduled procedure orders, fee-sheet billing, claim status summary, claim status mutation, payment posting summary, payment posting mutation, patient payment capture, account balance summary, account aging summary, account ledger summary, account statement readiness, patient statement generation, patient statement PDF export, statement batch candidates, statement batch package export, collections work queue, collections follow-up task lifecycle, administration directory, administration access control, operational reports, operational reports CSV export, appointment mutation, appointment reschedule mutation, appointment arrival mutation, appointment check-out mutation, encounter mutation, clinical-list allergy mutation, problem-list mutation, medication-list mutation, patient-message mutation, patient-message content update, patient-message reply update, patient-message assignment update, patient-document mutation, prescription mutation, immunization mutation, billing mutation, billing diagnosis mutation, billing correction mutation, billing modifier mutation, procedure mutation, procedure result correction mutation, procedure specimen metadata mutation, procedure specimen detail mutation, procedure order correction mutation, procedure report correction mutation, procedure lab provider configuration mutation, admin facility mutation, admin user mutation, access-permission mutation, and user group membership mutation.
- Slice 144 extends the shared mutation plans with procedure lab provider address-book linkage parity for temporary order-service organizations, derived provider names, linked organization/type rendering, and cleanup behavior. Slice 142 remains available for procedure lab provider configuration parity for protocol, usage/direction, sender/receiver IDs, remote host, credentials, paths, notes, rendering, and cleanup behavior. Slice 141 remains available for procedure lab provider lifecycle parity for temporary create/deactivate/include-inactive/delete behavior, Slice 140 remains available for read-only provider directory parity over the permanent five-provider catalog, Slice 139 remains available for permanent lab-provider catalog ownership coverage, Slice 138 remains available for lab-filter coverage, Slice 137 remains available for provider-filter coverage, Slice 136 remains available for patient/date-filter coverage, and Slice 135 remains available for unreviewed/reviewed queue transition coverage.
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
- Slice 129 procedure result correction plan for side-by-side corrected lab result parity.
- Slice 130 procedure specimen metadata plan for side-by-side report collected-date and specimen-number parity.
- Slice 131 procedure specimen detail plan for side-by-side order-level specimen identifier, accession, collection, location, volume, and condition parity.
- Slice 132 procedure order correction plan for side-by-side order date, code, name, type, diagnosis, priority, status, instructions, and post-correction result parity.
- Slice 133 procedure report correction plan for side-by-side collected date, report date, specimen number, report status, review status, notes, and linked result parity.
- Slice 134 procedure report sign-off plan for side-by-side reviewed status, reviewer, signed timestamp, report metadata, linked result preservation, and cleanup parity.
- Slice 135 procedure report review queue plan for side-by-side unreviewed/reviewed queue membership, queue counts, report metadata, reviewer transition, and cleanup parity.
- Slice 136 procedure report review queue filters plan for side-by-side patient/date-filtered queue inclusion, outside-date exclusion, reviewed queue transition, and cleanup parity.
- Slice 137 procedure report review queue provider filters plan for side-by-side provider-filtered queue inclusion, outside-provider exclusion, reviewed queue transition, and cleanup parity.
- Slice 138 procedure report review queue lab filters plan for side-by-side lab-filtered queue inclusion, outside-lab exclusion, reviewed queue transition, and cleanup parity.
- Slice 145 procedure order catalog plan for side-by-side permanent catalog root, provider groups, orderable panel rows, legacy `procedure_type` rendering, and modernized catalog API/UI parity.
  - Slice 147 procedure order catalog lifecycle plan for side-by-side temporary catalog item create, update, active-state, browser rendering, delete, and cleanup parity.
  - Slice 148 procedure vendor compendium import plan for side-by-side PathGroup-style order/result CSV import, legacy-compatible deactivate/reactivate semantics, browser rendering, and cleanup parity.
  - Slice 149 procedure order queue plan for side-by-side ready-to-send/reportless lab order queue membership, reported queue transition, browser rendering, and cleanup parity.
  - Slice 153 procedure report bulk sign-off plan for side-by-side two-report review queue bulk sign-off, reviewed queue membership, browser rendering, and cleanup parity.
  - Slice 154 procedure report reopen review plan for side-by-side signed-report reopen, received/unreviewed queue membership, browser rendering, and cleanup parity.
  - Slice 151 procedure order transmit plan for side-by-side ready-to-send/reportless lab order transmit marking, sent-awaiting-results queue membership, browser rendering, and cleanup parity.
- Slice 144 procedure lab provider address-book plan for side-by-side order-service address-book organization linkage, derived provider name rendering, update-to-second-organization behavior, and cleanup parity.
- Slice 142 procedure lab provider configuration plan for side-by-side provider protocol, usage, direction, sender/receiver IDs, remote host, credentials, paths, notes, rendering, and cleanup parity.
- Slice 141 procedure lab provider lifecycle plan for side-by-side temporary provider create/deactivate/include-inactive/delete parity.
- Slice 140 procedure lab provider directory plan for side-by-side provider list, active filtering, NPI, and balanced order/report/future-order count parity.
- Slice 139 procedure lab provider catalog plan for side-by-side seeded lab ownership, outside-lab exclusion, and reviewed queue rendering parity.
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
- Slice 65 patient-message assignment plan for side-by-side pnotes/message reassignment parity.
- Slice 66 patient-message content plan for side-by-side pnotes/message title and body edit parity.
- Slice 156 patient-message reply plan for side-by-side pnotes/message reply append parity.
- Slice 157 patient-message portal metadata plan for side-by-side seeded pnotes portal relation and encryption metadata parity.
- Slice 159 admin login readiness plan for side-by-side successful admin credential and invalid-password rejection parity.
- Slice 160 admin login audit readiness plan for side-by-side successful and failed login audit row parity.
- Slice 161 admin session readiness plan for side-by-side login-created session and logout invalidation parity.
- Slice 162 admin audit protection readiness plan for side-by-side protected audit log access parity.
- Slice 163 admin directory protection readiness plan for side-by-side protected administration directory access parity.
- Slice 164 operational reports protection readiness plan for side-by-side protected operational report access parity.
- Slice 166 clinical-list protection readiness plan for side-by-side protected clinical-list access parity.
- Slice 165 patient chart protection readiness plan for side-by-side protected patient chart access parity.
- Slice 158 patient-message update metadata plan for side-by-side pnotes/message update_by and update_date parity.
- Slice 67 encounter documents plan for side-by-side encounter-attached document visibility parity.
- Slice 68 encounter billing plan for side-by-side encounter fee-sheet linkage parity.
- Slice 69 encounter claims plan for side-by-side encounter claim-status linkage parity.
- Slice 70 encounter procedures plan for side-by-side encounter procedure-order/result linkage parity.
- Slice 71 encounter diagnoses plan for side-by-side encounter diagnosis-coding parity.
- Slice 72 encounter billing linkage mutation plan for side-by-side temporary fee-sheet create/render/deactivate/delete parity.
- Slice 73 encounter diagnosis coding mutation plan for side-by-side temporary ICD10 fee-sheet diagnosis create/render/deactivate/delete parity.
- Slice 74 encounter fee-sheet entry plan for side-by-side temporary CPT/ICD encounter-workspace create/render/deactivate/delete parity.
- Slice 75 encounter procedure-order entry plan for side-by-side temporary pending lab-order encounter-workspace create/render/delete parity.
- Slice 76 encounter procedure-result entry plan for side-by-side temporary lab order/report/result encounter-workspace create/render/delete parity.
- Slice 77 encounter sign-off plan for side-by-side temporary encounter attestation create/render/delete parity.
- Slice 78 encounter document upload plan for side-by-side temporary encounter-scoped text document create/render/delete parity.
- Slice 79 encounter binary document upload plan for side-by-side temporary encounter-scoped PDF/binary document create/render/download/delete parity.
- Slice 80 encounter document sign-off plan for side-by-side temporary encounter-scoped document create/sign/render/delete parity.
- Slice 81 encounter document denial plan for side-by-side temporary encounter-scoped document create/deny/render/delete parity.
- Slice 82 encounter document metadata plan for side-by-side temporary encounter-scoped document create/refile/render/delete parity.
- Slice 83 encounter document move plan for side-by-side temporary encounter-scoped document create/move/render/delete parity.
- Slice 84 encounter document content replacement plan for side-by-side temporary encounter-scoped document create/replace/render/delete parity.
- Slice 85 encounter document archive/restore plan for side-by-side temporary encounter-scoped document create/archive/hide/restore/render/delete parity.
- Slice 86 encounter document lifecycle timeline plan for side-by-side temporary encounter-scoped document create/sign/archive/restore/render/delete lifecycle parity.
- Slice 87 encounter external-link document plan for side-by-side temporary encounter-scoped web URL document create/render/archive/delete lifecycle parity.
- Slice 88 patient image document preview plan for side-by-side temporary patient image document create/render/inline-preview/download/archive/delete lifecycle parity.
- Slice 89 patient image document thumbnail plan for side-by-side temporary patient image document create/render/thumbnail/archive/delete lifecycle parity.
- Slice 90 patient PDF document inline-preview plan for side-by-side temporary patient PDF document create/render/inline-preview/download/archive/delete lifecycle parity.
- Slice 91 patient document lifecycle timeline plan for side-by-side temporary patient document create/sign/archive/restore/render/delete lifecycle parity.
- Slice 92 patient scanned attachment plan for side-by-side temporary scanned PDF document create/render/scan-readiness/archive/delete parity.
- Slice 93 appointment reschedule plan for side-by-side temporary future appointment create/update/render/delete parity.
- Slice 94 appointment arrival plan for side-by-side temporary future appointment create/mark-arrived/render/delete parity.
- Slice 95 appointment check-out plan for side-by-side temporary future appointment create/mark-arrived/check-out/render/delete parity.
- Slice 96 appointment no-show plan for side-by-side temporary future appointment create/mark-no-show/render/delete parity.
- Slice 97 appointment category plan for side-by-side temporary future appointment create/render/category-update/delete parity.
- Slice 98 appointment pending-status plan for side-by-side temporary future appointment create/status-update/render/delete parity.
- Slice 99 appointment provider reassignment plan for side-by-side temporary future appointment create/provider-update/render/delete parity.
- Slice 100 appointment facility reassignment plan for side-by-side temporary future appointment create/facility-update/render/delete parity.
- Slice 101 appointment billing-location reassignment plan for side-by-side temporary future appointment create/billing-location-update/render/delete parity.
- Slice 102 appointment comments plan for side-by-side temporary future appointment create/comments-update/render/delete parity.
- Slice 103 appointment recurrence metadata plan for side-by-side temporary future appointment create/recurrence-update/render/delete parity.
- Slice 104 appointment recurring-series plan for side-by-side seeded recurrence expansion and modernized generated-occurrence rendering parity.
- Slice 105 appointment recurrence-exceptions plan for side-by-side seeded `exdate` skipping and modernized skipped-date rendering parity.
- Slice 106 appointment occurrence-cancel plan for side-by-side generated occurrence skip behavior, restored seeded exception cleanup, and modernized `Skip occurrence` rendering parity.
- Slice 107 appointment occurrence-restore plan for side-by-side skipped generated occurrence restoration, restored seeded exception cleanup, and modernized `Restore occurrence` rendering parity.
- Slice 108 appointment occurrence-reschedule plan for side-by-side generated occurrence movement into a standalone appointment, restored seeded exception cleanup, and modernized `Reschedule occurrence` rendering parity.
- Slice 109 appointment recurrence exception-edit plan for side-by-side skipped-date list editing, restored seeded exception cleanup, and modernized `Skipped dates` rendering parity.
- Slice 110 appointment series root update plan for side-by-side recurring root title/time propagation, restored seeded root cleanup, and modernized recurring-root edit rendering parity.
- Slice 111 appointment series root metadata plan for side-by-side recurring root provider/facility/category/status/room/comment propagation, restored seeded root cleanup, and modernized recurring-root metadata edit rendering parity.
- Slice 112 appointment monthly recurrence plan for side-by-side temporary monthly recurring appointment create/update/expand/render/delete parity.
- Slice 113 appointment recurrence unit matrix plan for side-by-side temporary daily, workday, and yearly recurring appointment create/expand/render/delete parity.
- Slice 114 appointment days-of-week recurrence plan for side-by-side temporary Monday/Wednesday/Friday recurring appointment create/expand/render/delete parity.
- Slice 115 appointment monthly repeat-on recurrence plan for side-by-side temporary second-Tuesday and last-Friday monthly recurring appointment create/expand/render/delete parity.
- Slice 116 appointment series recurrence update plan for side-by-side seeded recurring-root cadence/end-date edit/render/restore parity.
- Slice 117 appointment provider overlap plan for side-by-side temporary same-provider overlapping appointment create/render/delete parity.
- Slice 118 appointment patient overlap plan for side-by-side temporary same-patient overlapping appointment create/render/delete parity.
- Slice 119 appointment room overlap plan for side-by-side temporary same-room overlapping appointment create/render/delete parity.
- Slice 120 appointment reminders plan for side-by-side seeded future appointment reminder readiness parity.
- Slice 167 appointment protection plan for side-by-side scheduler access protection parity, unauthenticated modernized appointment API `401` evidence, authenticated appointment search/detail retrieval, and Calendar sign-in gating.
- Slice 168 encounter protection plan for side-by-side protected encounter access parity, unauthenticated modernized encounter API `401` evidence, authenticated encounter search/detail retrieval, and Encounters sign-in gating.
- Slice 169 document protection plan for side-by-side protected patient document access parity, unauthenticated modernized document list/content/create `401` evidence, authenticated document retrieval, and Documents sign-in gating.
- Slice 170 message protection plan for side-by-side protected patient message access parity, unauthenticated modernized message list/create `401` evidence, authenticated message retrieval, and Messages sign-in gating.
- Slice 121 encounter co-signature plan for side-by-side temporary two-signer locked encounter signature parity.
- Slice 122 encounter document revision plan for side-by-side seeded encounter-attachment current-version parity.
- Slice 123 encounter document replacement revision plan for side-by-side temporary encounter-attachment current-revision mutation parity.
- Slice 126 encounter scanned attachment plan for side-by-side temporary encounter-scoped scanned PDF readiness parity.

The Workbench runs only allowlisted commands. It displays latest evidence per test card and stores lifecycle/test action events in `modernization-workbench/artifacts/events.json`.

The Test Runs page also includes a custom parity run builder for each managed app. The Workbench API exposes `parity-tests/test-manifest.json`, and the UI lets an operator choose suite or plan, a specific suite or plan id, reset mode, headed mode, and an optional Playwright grep filter. The backend validates those choices against the manifest before it constructs the existing `scripts/Run-OpenEmrParityTests.ps1` command. This gives the project a real test manager for targeted runs while keeping command execution local and constrained.

The Workbench Test Runs page also renders recent side-by-side comparison artifacts. Its `/api/parity-comparisons` route reads bounded `comparison.json` summaries from `parity-tests/artifacts/comparisons/`, normalizes left/right run metadata, exposes difference counts and previews, and leaves command execution to the existing runner/compare scripts. Slice 124 adds expandable card drill-ins so operators can review legacy/modernized run artifact paths, comparison JSON paths, artifact directories, selected suites, full difference detail, and matched-state confirmation from the Workbench without manually opening the artifact directory. Slice 125 adds safe artifact links through `/api/artifacts/file`, restricted to `parity-tests/artifacts/`, `legacy-openemr/artifacts/`, `modernized-openemr/artifacts/`, and `modernization-workbench/artifacts/`, so run and comparison JSON evidence can be opened directly from drill-ins while non-artifact paths are rejected. Slice 155 enriches comparison sides from their run summary artifacts and exposes direct drill-in links to the run JSON, Playwright JSON, JUnit XML, and HTML report only when those files exist under the same safe artifact roots.

## Modernized Target Parity Path

The modernized target now exists and includes implemented workflow slices through Slice 175. The smoke test proves that the target can run, consume the shared gold dataset, retrieve deterministic anchors across patient, insurance coverage, immunization history, scheduling, encounter, revenue-cycle, procedure lab-provider ownership, directory, lifecycle, configuration, address-book, order-catalog, and clinical order queue views, document, administration, access-control, reporting, and clinical-list workflows, create/validate/end an admin session, record login audit evidence, enforce protected login-audit access, enforce protected administration directory access, enforce ACL-backed administration authorization, enforce protected operational reports and CSV export access, enforce ACL-backed operational reports authorization, enforce protected patient search/chart access, enforce protected clinical-list access, enforce ACL-backed clinical-list authorization, enforce protected appointment search access, enforce protected encounter search access, enforce protected patient document access, enforce protected patient message access, enforce protected billing access, enforce protected procedure access, and perform safe cleanup-backed mutation lifecycles for patient, patient-message reply/content/assignment, scheduling, encounter, document, revenue-cycle, procedure lab-provider lifecycle/configuration/address-book, procedure order catalog lifecycle/import, procedure order queue/transmit, procedure report bulk sign-off/reopen review, administration, and ACL workflow slices.

The slice readiness plans from `slice-1-readiness` through `slice-175-clinical-list-authorization-policy-readiness` prove the same normalized database facts, browser-visible behavior, mutation/session/audit post-state where applicable, cleanup, and restoration expectations against both legacy and modernized targets. Slice 175 verifies ACL-backed clinical-list authorization on both targets; the legacy side proves the ACL matrix grants Medical/History access to Administrators and not Front Office, while the modernized side proves a front-desk demo session authenticates but receives 403 for clinical-list retrieval and allergy mutation, and an admin session still loads clinical-list data and the Lists UI. Slice 174 verifies ACL-backed operational reports authorization on both targets; the legacy side proves the ACL matrix grants Patient Report access to Administrators and not Front Office, while the modernized side proves a front-desk demo session authenticates but receives 403 for operational report JSON and CSV export, and an admin session still loads report JSON, CSV, and the Reports UI. Slice 173 verifies ACL-backed administration authorization on both targets; the legacy side proves the ACL matrix grants `admin:acl write` to Administrators and not Front Office, while the modernized side proves a front-desk demo session authenticates but receives 403 for administration directory and mutation access, and an admin session still loads the directory and Admin UI. Slice 172 verifies protected procedure visibility on both targets; the legacy side proves unauthenticated procedure result access does not expose the anchor lab order and authenticated admin access renders it, while the modernized side proves `/api/procedures` result, catalog, and create calls return 401 without an active `X-OpenEMR-Session`, authenticated procedure retrieval returns the anchor lab facts, and the Procedures workspace gates lookup and mutation controls until sign-in. Slice 171 verifies protected billing visibility on both targets; the legacy side proves unauthenticated fee-sheet access does not expose seeded billing lines and authenticated admin access renders them, while the modernized side proves `/api/billing` retrieval, batch, and create calls return 401 without an active `X-OpenEMR-Session`, authenticated billing retrieval returns the anchor fee-sheet facts, and the Fees workspace gates fee-sheet and revenue-cycle controls until sign-in. Slice 170 verifies protected patient message visibility on both targets; the legacy side proves unauthenticated patient-notes access does not expose the anchor message titles and authenticated admin access renders them, while the modernized side proves `/api/messages` list and create calls return 401 without an active `X-OpenEMR-Session`, authenticated message retrieval returns the anchor messages, and the Messages workspace gates search and mutation controls until sign-in. Slice 169 verifies protected patient document visibility on both targets; the legacy side proves unauthenticated document-page access does not expose the anchor document and authenticated admin access renders it after expanding the Medical Record category, while the modernized side proves `/api/documents` list, content, and create calls return 401 without an active `X-OpenEMR-Session`, authenticated document retrieval returns the anchor, and the Documents workspace gates search and mutation controls until sign-in. Slice 168 verifies protected encounter visibility on both targets; the legacy side proves unauthenticated encounter-page access does not expose the clinical reason and authenticated admin access renders it, while the modernized side proves `/api/encounters` search and create return 401 without an active `X-OpenEMR-Session`, authenticated search/detail retrieve the anchor encounter, and the Encounters workspace gates search/detail and mutation controls until sign-in. Slice 167 verifies protected appointment schedule visibility on both targets; the legacy side proves unauthenticated scheduler access does not expose the seeded appointment title and authenticated admin access renders it, while the modernized side proves `/api/appointments` search and create return 401 without an active `X-OpenEMR-Session`, authenticated search/detail retrieve the anchor appointment, and the Calendar workspace gates schedule search/detail and mutation controls until sign-in. Slice 166 verifies protected clinical-list visibility on both targets; the legacy side proves unauthenticated patient summary access does not expose the anchor clinical-list facts and authenticated admin access renders problem, allergy, medication, prescription, and immunization facts, while the modernized side proves `/api/clinical-lists/{patientId}` and clinical-list mutations return 401 without an active `X-OpenEMR-Session`, return list rows with an active session, and gate the Lists workspace until sign-in. Slice 165 verifies protected patient chart visibility on both targets; the legacy side proves unauthenticated patient summary access does not expose the anchor chart and authenticated admin access renders patient facts, while the modernized side proves `/api/patients` search and chart endpoints return 401 without an active `X-OpenEMR-Session`, return patient rows with an active session, and gate the Patient/Client workspace until sign-in. Slice 164 verifies protected operational reports visibility on both targets; the legacy side proves unauthenticated `patient_list.php` and `clinical_reports.php` access does not expose report controls and authenticated admin access renders report facts, while the modernized side proves `/api/reports/operational` and `/api/reports/operational/export` return 401 without an active `X-OpenEMR-Session`, return report/CSV rows with an active session, and gate the Reports workspace operational report data until sign-in. Slice 163 verifies protected administration directory visibility on both targets; the legacy side proves unauthenticated `usergroup_admin.php` and `facilities.php` access does not expose admin directory data and authenticated admin access renders user/facility administration facts, while the modernized side proves `/api/administration/directory` and administration mutations return 401 without an active `X-OpenEMR-Session`, return directory rows with an active session, and gate the Admin directory until sign-in. Slice 162 verifies protected audit log visibility on both targets; the legacy side proves unauthenticated `interface/logview/logview.php` access is blocked and authenticated admin access renders the Logs Viewer/Main Log, while the modernized side proves `/api/auth/login-audit` returns 401 without an active `X-OpenEMR-Session`, returns audit rows with an active session, rejects an ended session after logout, and gates the Admin Login Audit panel until sign-in. Slice 161 verifies a successful admin login creates a usable session and logout invalidates it on both targets; the legacy side checks the `OpenEMR` cookie and logout behavior, while the modernized side covers `auth_sessions`, `/api/auth/session`, `/api/auth/logout`, and the Admin Session Readiness panel. Slice 160 verifies a successful admin login and failed admin login create comparable audit rows on both targets; the legacy side reads OpenEMR `log` rows with decoded `success:` / `failure:` comments, while the modernized side covers `auth_audit_events`, `/api/auth/login-audit`, and the Admin Login Audit panel. Slice 159 verifies the configured local admin credential succeeds and a bad password is rejected on both targets; the modernized side covers the `/api/auth/login` contract and Admin Login Readiness panel, while the legacy side covers the OpenEMR login POST and failed-login redirect script. Slice 158 patient-message update metadata remains available for temporary pnotes-compatible update_by/update_date stamping. Slice 157 patient-message portal metadata remains available for permanent seeded portal relation and encryption-flag projection. Slice 156 patient message reply remains available for temporary reply append behavior. Slice 154 procedure report reopen review remains available for a temporary signed lab report moving back to received/unreviewed state, clears visible reviewer metadata, confirms reviewed-queue exclusion and unreviewed-queue membership, renders legacy `list_reports.php` option `3`, renders modernized Procedures and Reports workspace facts through `/api/procedures/reports/{reportId}/reopen-review`, deletes the temporary order tree, and cleans up. Slice 153 procedure report bulk sign-off remains available for two temporary unreviewed lab reports in the procedure report review queue, one bulk sign operation, reviewed queue membership, legacy `list_reports.php` reviewed rendering, modernized `/api/procedures/reports/bulk-sign` and Reports workspace rendering, order-tree deletion, and cleanup. Slice 151 procedure order transmit remains available for temporary reportless lab order ready-to-send queue membership, transmit marking into sent-awaiting-results/transmitted-pending state, legacy `list_reports.php` option `4` rendering, modernized `/api/procedures/orders/{orderId}/transmit` and Reports workspace rendering, order-tree deletion, and cleanup. Slice 149 procedure order queue remains available for temporary reportless lab order ready-to-send membership, exclusion from the reported queue before report attachment, transition into the reported queue after a temporary report is added, legacy `list_reports.php` rendering, modernized `/api/procedures/order-queue` and Reports workspace rendering, order-tree deletion, and cleanup. Slice 148 procedure vendor compendium import remains available for temporary catalog group creation, PathGroup-style order/result CSV import, re-import deactivate/reactivate semantics, legacy `procedure_type`/`types_ajax.php` rendering, modernized `/api/procedures/order-catalog/import-compendium`, modernized Reports rendering, subtree deletion, and cleanup. Slice 147 procedure order catalog lifecycle remains available for temporary orderable catalog item creation, update, active-state change, legacy `procedure_type`/`types_ajax.php` rendering, modernized `/api/procedures/order-catalog`, modernized Reports rendering, deletion, and cleanup. Slice 145 procedure order catalog remains available for the permanent `Gold Lab Order Catalog` tree, five lab-provider groups, three orderable panels per provider, legacy `procedure_type`/`types_ajax.php` rendering, modernized `/api/procedures/order-catalog`, and modernized Reports rendering. Slice 144 procedure lab provider address-book remains available for temporary order-service address-book organization creation, provider name derivation through `labDirectorId`, update-to-second-organization behavior, linked organization/type rendering, legacy `Procedure Providers` rendering, modernized Reports workspace rendering, and cleanup. Slice 142 procedure lab provider configuration remains available for temporary provider protocol, usage, direction, sender/receiver IDs, remote host, login/password, order/result paths, notes, legacy `Procedure Providers` rendering, and modernized Reports workspace rendering. Slice 141 procedure lab provider lifecycle remains available for temporary provider create/deactivate/include-inactive/delete behavior, durable protocol state, legacy `Procedure Providers` rendering, and modernized Reports workspace rendering. Slice 140 procedure lab provider directory remains available for the permanent five-provider gold-data directory, active filtering, NPI values, OpenEMR's default `DL` protocol value, 200 assigned orders per provider, 140 reviewed reports per provider, 60 future scheduled orders per provider, legacy `Procedure Providers` rendering, and modernized Reports workspace rendering. Earlier workflow plans remain stable for the implemented patient, scheduling, encounter, document, revenue-cycle, lab/procedure, administration, ACL, reporting, and clinical-list slices.

For the one-hundred-fifty-fourth modernized procedure report reopen review readiness slice, compare the still-available side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-154-procedure-report-reopen-review-readiness
```

Next parity steps:

1. Add additional modernized workflow actions behind the same mutation-test intent as CRUD slices are implemented.
2. Add modernized UI helpers behind the same browser workflow intent for each new mutation slice.
3. Add additional slice readiness plans or graduate slices into the full parity plan once both targets support them.
4. Expand the Workbench comparison artifact drill-ins with screenshot thumbnails, normalized probe details, accepted-difference tracking, and historical trend charts.

The test code should continue to assert observable behavior and normalized domain state, not identical implementation details.
