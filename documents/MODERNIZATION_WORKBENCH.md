# Modernization Workbench

Created: 2026-06-18
First implemented: 2026-06-18

## Purpose

The Modernization Workbench is the third application in this project. It is an oversight and orchestration website for managing the modernization of OpenEMR from the legacy baseline into the modernized target solution.

The workbench should make the modernization effort observable. A user should be able to open it and understand what exists, what is running, what has been tested, which workflows have been modernized, how the two systems compare, and what evidence supports the current state.

## Current Implementation

The first version is implemented in `modernization-workbench/`.

Technology stack:

- React.
- TypeScript.
- Vite.
- Node.js.
- Express.
- Docker Compose command orchestration.

Run it from the repository root:

```powershell
.\scripts\Start-ModernizationWorkbench.ps1
```

Workbench URLs:

- UI: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:5174`

The Workbench currently manages the legacy OpenEMR baseline and the modernized OpenEMR target as it grows slice by slice. It now uses a left-side application shell with hash-routed pages. It can show status, check health, start, stop, restart, run smoke tests, run OpenEMR-native PHPUnit and Jest tests for the legacy target, run parity test suites and plans for implemented targets, run custom parity runs with selected reset strategy, render recent side-by-side comparison artifacts with expandable drill-ins and safe artifact links, run gold seed actions, run the starter seed action for legacy, display latest smoke-test, native-test, parity-test, and seed results, show Docker Compose logs, display database profiles, list action history, render the project changelog as a build timeline with timing and code-change metrics, and show architecture/progress views. The Architecture page now presents a tabbed model with a versioned stack matrix, project topology map, architecture decisions, and per-system detail views for the legacy baseline, Workbench, and modernized target.

Current pages:

- Dashboard.
- Applications.
- Project Timeline.
- Progress.
- Architecture.
- Test Runs.
- Seed Data.

The navigation model supports nested child items so the Workbench can grow into two-level navigation later without reworking the shell.

The Project Timeline page reads `documents/PROJECT_CHANGELOG.md` as the source of truth for project history. It displays explicit start time, finish time, and duration when entries include `Started:` and `Finished:` metadata. It also displays code-change metrics for files changed, lines added, lines deleted, net lines, and total churn. New changelog entries should record those values in a `Code changes:` section and replace `Commit: pending` with the real Git changeset ID once the commit exists. For older entries, the Workbench backfills code-change metrics and the visible changeset chip from Git when the entry contains a resolvable commit hash, and it uses conservative commit-subject matching for older entries whose commit field says `this commit` or `current slice commit`. If no safe match exists, the chip shows an unresolved changeset instead of repeating the placeholder as though it were a valid commit ID.

The Architecture page now uses sub-tabs. The Overview tab shows a versioned technology-stack matrix for the three project systems: legacy OpenEMR, the Modernization Workbench, and modernized OpenEMR. The matrix groups technologies by UI, server-side runtime, data stores, local runtime/orchestration, and tests/evidence, with logo-style technology chips and explicit versions where the repository or running containers provide them. The Overview tab also includes a project topology diagram and architecture-decision notes. Each system tab provides a focused architecture diagram, runtime summary, data ownership summary, business-logic narrative, responsibilities, and evidence notes.

The legacy app launch link opens `http://localhost:8080` because that is the browser-friendly local URL. The OpenEMR HTTPS endpoint remains available at `https://localhost:9443`, but it uses a self-signed local certificate and browsers will show a privacy warning unless the certificate is trusted or manually bypassed. The Workbench backend supports both `http` and `https` health URLs, still uses `https://localhost:9443/meta/health/readyz` for the legacy health check, and is configured to tolerate the self-signed certificate only for HTTPS internal checks.

The Managed Application panel also displays the local demo OpenEMR login read from `legacy-openemr/.env`. This is intentionally local-only and helps distinguish the actual baseline credential from any browser autofill suggestion on the OpenEMR login page.

The Workbench owns the shared seed-data contract under `modernization-workbench/seed-data/`. The current manifest defines `openemr-shared-synthetic-v1`, the generated 1,000-patient deterministic synthetic gold dataset, now including 2,648 immunization rows for read-only vaccine-history parity and 80 regular appointment recurrence metadata anchors. The legacy MariaDB adapter is implemented through `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`; the modernized PostgreSQL adapter is implemented through `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`.

Verified behavior:

- Production build passes with `npm run build`.
- The UI renders in desktop and mobile viewports.
- The UI includes a left navigation shell with separate pages for dashboard, applications, timeline, progress, architecture, tests, and seed data.
- The Architecture page renders a versioned visual stack matrix, project topology diagram, architecture-decision notes, and detail tabs for legacy OpenEMR, the Workbench, and modernized OpenEMR.
- The API can read legacy OpenEMR status.
- The API can load recent Docker Compose logs.
- The API can run the baseline smoke test.
- The API can run the containerized OpenEMR-native isolated PHPUnit stable suite.
- The API can run the OpenEMR-native JavaScript Jest suite.
- The API can run the legacy parity database, HTTP, UI, workflow mutation, named-plan, and full-suite test commands through allowlisted manifests.
- The API can run validated custom parity selections from the manifest with operator-selected reset mode, headed mode, and optional grep filter.
- The API can read recent side-by-side comparison artifacts from `parity-tests/artifacts/comparisons/`, and the Test Runs page renders matched/different status, run IDs, suites, metrics, differences, artifact paths, expandable drill-ins, and safe links to run/comparison artifact files.
- The API exposes `/api/artifacts/file` for read-only artifact access under `parity-tests/artifacts/`, `legacy-openemr/artifacts/`, `modernized-openemr/artifacts/`, and `modernization-workbench/artifacts/`; paths outside those roots are rejected.
- The API can run and validate the legacy gold seed action.
- The API can run and validate the modernized PostgreSQL gold seed action.
- The API can run the shared slice-1 readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-2 scheduling readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-3 encounters readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-4 clinical-lists readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-5 messaging readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-6 procedures readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-7 billing readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-8 admin readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-9 reports readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-10 contact mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-11 appointment mutation readiness, slice-93 appointment reschedule readiness, slice-94 appointment arrival readiness, slice-95 appointment check-out readiness, slice-96 appointment no-show readiness, slice-97 appointment category readiness, slice-98 appointment pending-status readiness, slice-99 appointment provider reassignment readiness, slice-100 appointment facility reassignment readiness, slice-101 appointment billing-location reassignment readiness, slice-102 appointment comments readiness, slice-103 appointment recurrence metadata readiness, slice-104 appointment recurring-series readiness, slice-105 appointment recurrence-exceptions readiness, slice-106 appointment occurrence-cancel readiness, slice-107 appointment occurrence-restore readiness, slice-108 appointment occurrence-reschedule readiness, slice-109 appointment recurrence exception-edit readiness, slice-110 appointment series root update readiness, slice-111 appointment series root metadata readiness, slice-112 appointment monthly recurrence readiness, slice-113 appointment recurrence unit matrix readiness, slice-114 appointment days-of-week recurrence readiness, slice-115 appointment monthly repeat-on recurrence readiness, slice-116 appointment series recurrence update readiness, slice-117 appointment provider overlap readiness, slice-118 appointment patient overlap readiness, slice-119 appointment room overlap readiness, and slice-120 appointment reminders readiness parity plans for both legacy and modernized targets.
- The API can run the shared slice-12 encounter mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-13 clinical-list mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-14 message mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-15 prescription mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-16 billing mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-17 procedure mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-18 admin facility mutation readiness parity plan, the shared slice-19 admin user mutation readiness parity plan, the shared slice-20 access-control readiness parity plan, the shared slice-21 access-permission mutation readiness parity plan, and the shared slice-22 user group membership mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-23 pending procedure orders readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-24 reports export readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-25 patient documents readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-26 patient document mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-27 patient document content readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-28 patient insurance coverage readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-29 patient immunizations readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-30 patient immunization mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-31 patient problem-list mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-32 patient medication-list mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-33 binary patient-document mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-34 patient insurance mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-36 patient demographics mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-37 patient registration readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-40 document denial readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-41 document metadata readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-43 document content replacement readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-44 billing diagnosis readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-46 billing modifier readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-47 claim status readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-48 payment posting readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-49 account balance readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-50 account aging readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-60 statement PDF export readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-61 statement batch candidate readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-62 statement batch package export readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-63 collections work queue readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-64 collections follow-up task readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-65 patient-message assignment readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-66 patient-message content readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-67 encounter documents readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-68 encounter billing readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-69 encounter claims readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-70 encounter procedure orders readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-71 encounter diagnosis coding readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-72 encounter billing linkage mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-73 encounter diagnosis coding mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-74 encounter fee-sheet entry readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-75 encounter procedure-order entry readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-76 encounter procedure-result entry readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-77 encounter sign-off readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-121 encounter co-signature readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-122 encounter document revision readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-123 encounter document replacement revision readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-78 encounter document upload readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-79 encounter binary document upload readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-126 encounter scanned attachment readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-127 encounter binary document content replacement readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-128 patient binary document content replacement readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-129 procedure result correction readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-80 encounter document sign-off readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-81 encounter document denial readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-82 encounter document metadata readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-83 encounter document move readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-84 encounter document content replacement readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-85 encounter document archive/restore readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-87 encounter external-link document readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-88 patient image document preview readiness, slice-89 patient image document thumbnail readiness, slice-90 patient PDF document inline-preview readiness, slice-91 patient document lifecycle timeline readiness, and slice-92 patient scanned attachment readiness parity plans for both legacy and modernized targets.
- The API can run the shared slice-93 appointment reschedule readiness, slice-94 appointment arrival readiness, slice-95 appointment check-out readiness, slice-96 appointment no-show readiness, slice-97 appointment category readiness, slice-98 appointment pending-status readiness, slice-99 appointment provider reassignment readiness, slice-100 appointment facility reassignment readiness, slice-101 appointment billing-location reassignment readiness, slice-102 appointment comments readiness, slice-103 appointment recurrence metadata readiness, slice-104 appointment recurring-series readiness, slice-105 appointment recurrence-exceptions readiness, slice-106 appointment occurrence-cancel readiness, slice-107 appointment occurrence-restore readiness, slice-108 appointment occurrence-reschedule readiness, slice-109 appointment recurrence exception-edit readiness, slice-110 appointment series root update readiness, slice-111 appointment series root metadata readiness, slice-112 appointment monthly recurrence readiness, slice-113 appointment recurrence unit matrix readiness, slice-114 appointment days-of-week recurrence readiness, slice-115 appointment monthly repeat-on recurrence readiness, slice-116 appointment series recurrence update readiness, slice-117 appointment provider overlap readiness, slice-118 appointment patient overlap readiness, slice-119 appointment room overlap readiness, and slice-120 appointment reminders readiness parity plans for both legacy and modernized targets.
- The API can parse `documents/PROJECT_CHANGELOG.md`, calculate section duration from explicit `Started:` and `Finished:` timestamps when present, enrich older resolvable commit-backed entries with completion clock time and elapsed time since the previous completed step, backfill code-change metrics from changelog `Code changes:` sections or Git commit stats, and expose the result as structured timeline data.
- The API can stop and restart the legacy OpenEMR Docker Compose stack.
- The API can start, stop, restart, health-check, seed, smoke test, and profile the modernized OpenEMR Docker Compose stack.
- After Workbench restart control, legacy OpenEMR returns to healthy state and the smoke test passes.

## Relationship To The Other Systems

The project has three major systems:

- **Legacy OpenEMR baseline** - the original OpenEMR application running locally in a reproducible Docker-based environment.
- **Modernization Workbench** - the oversight website that tracks status, progress, tests, comparisons, and technical differences.
- **Modernized OpenEMR target** - the new implementation built in vertical slices using a modern UI, API, business tier, and PostgreSQL.

The workbench was built after the baseline could run a minimal meaningful smoke test. It is now the primary visual control surface for the rest of the modernization effort.

The intended operator workflow is that a user runs one local script to start the Modernization Workbench, then uses the Workbench to inspect, start, stop, restart, and test the other project applications such as the legacy OpenEMR site.

## Core Responsibilities

The workbench should help answer:

- Is the legacy OpenEMR baseline running?
- Which OpenEMR version and seed-data version are being used?
- Which tests can be run against the baseline?
- What were the latest test results?
- Is the modernized target running?
- Which applications are stopped, starting, healthy, unhealthy, or stopped with errors?
- Can an operator start, stop, or restart a project application from one controlled interface?
- Which workflow slices have been discovered, implemented, and parity tested?
- How do the legacy and modernized systems compare for a given workflow?
- What are the technical architecture differences between the two systems?
- What evidence exists for the current modernization state?

## Initial Version

The first workbench version is intentionally small and useful.

Implemented capabilities:

- Show legacy OpenEMR environment status.
- Show the configured baseline browser URL, database status, and seed-data status when available.
- Show the current local demo login from `legacy-openemr/.env`.
- Start, stop, and restart the legacy OpenEMR Docker Compose environment through controlled local commands.
- Trigger the gold legacy seed through `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`.
- Trigger the starter legacy seed through `legacy-openemr/scripts/Seed-LegacyExampleData.ps1`.
- Trigger baseline smoke tests through `legacy-openemr/scripts/Test-LegacyBaseline.ps1`.
- Trigger OpenEMR-native isolated PHPUnit tests through `legacy-openemr/scripts/Test-LegacyNative.ps1`.
- Trigger OpenEMR-native JavaScript Jest tests through `legacy-openemr/scripts/Test-LegacyNativeJs.ps1`.
- Trigger parity test suites through `scripts/Run-OpenEmrParityTests.ps1`.
- Trigger custom parity runs through a manifest-backed run builder that validates suite, plan, reset, headed, and grep options.
- Display latest baseline, modernized, smoke, and parity test results.
- Display recent lifecycle action results, including command status, duration, and logs.
- Display the project changelog as a designed build timeline sourced from `documents/PROJECT_CHANGELOG.md` on its own page, including explicit start time, finish time, and calculated duration when available, with Git-derived completion clock times as a fallback for older entries that reference a resolvable commit.
- Display architecture, progress, test runs, seed data, and managed applications on dedicated pages.
- Display links or paths to logs, screenshots, and reports.
- Show the modernized target as a managed application once the first slice exists.
- Show a project progress view with the three major systems and their current stage.

The first version originally did not require the modernized target to exist. As of the first modernization slice, the Workbench includes `modernized-openemr` as a managed application.

## Application Lifecycle Control

The workbench should be able to control the running state of project applications, but only through explicit, allowlisted operations.

Expected lifecycle actions:

- Check status.
- Start.
- Stop.
- Restart.
- Run health check.
- Open application URL.
- View recent logs.

Initial target:

- Legacy OpenEMR baseline in `legacy-openemr/`, controlled through Docker Compose.

Current additional target:

- Modernized OpenEMR in `modernized-openemr/`, controlled through Docker Compose.

Future targets:

- Databases and supporting services used by the modernized target.
- Test runners and comparison services.

Preferred implementation:

- A Workbench startup script starts the Workbench backend and frontend.
- The Workbench backend exposes local-only orchestration APIs.
- Each managed application has a manifest that defines its working directory, start command, stop command, status command, health endpoint, public URL, and log locations.
- The frontend calls the backend for lifecycle actions.
- The backend executes only predefined commands from manifests.

The Workbench should not provide a general-purpose shell. Lifecycle control is powerful enough that it must remain local, explicit, logged, and constrained to known project commands.

## Test Orchestration

The workbench may trigger tests, but tests should remain executable outside the workbench.

Preferred pattern:

- Test suites live in normal source-controlled test projects or scripts.
- The workbench calls a small orchestration API or command runner.
- Test output is written to structured result files.
- The workbench reads and displays those result files.
- The same commands can later run in CI.

The first available baseline test command is `legacy-openemr/scripts/Test-LegacyBaseline.ps1`, which writes `legacy-openemr/artifacts/latest-smoke-test.json`.

The native OpenEMR implementation-confidence command is `legacy-openemr/scripts/Test-LegacyNative.ps1`, which writes `legacy-openemr/artifacts/latest-native-test.json` and a companion log file. Its default stable mode runs OpenEMR's upstream isolated PHPUnit suite inside the pinned OpenEMR container while excluding the upstream `twig` and `large` groups because the complete suite currently has Windows bind-mount-sensitive CRLF fixture and built-in-server routing failures. The verified stable run covers 2,344 tests and 6,188 assertions.

The native JavaScript implementation-confidence command is `legacy-openemr/scripts/Test-LegacyNativeJs.ps1`, which writes `legacy-openemr/artifacts/latest-native-jest-test.json`, a full Jest JSON report, and a companion log file. It runs OpenEMR's upstream Jest suite with 12 verified suites and 105 tests covering CCDA service utilities and jsPDF compatibility.

The reusable parity test harness lives in `parity-tests/` and is launched by `scripts/Run-OpenEmrParityTests.ps1`. It currently provides database, HTTP, Playwright UI, workflow mutation, named run plans, a side-by-side slice-1 readiness plan through a side-by-side slice-129 procedure result correction readiness plan, and full-suite legacy runs. The UI suite covers login, chart, encounter SOAP/vitals, scheduler appointment details, appointment monthly recurrence rendering/action behavior, appointment recurrence unit matrix rendering/action behavior, appointment days-of-week recurrence rendering/action behavior, appointment monthly repeat-on recurrence rendering/action behavior, appointment series recurrence update rendering/action behavior, appointment provider overlap rendering/action behavior, appointment patient overlap rendering/action behavior, appointment room overlap rendering/action behavior, appointment reminder rendering, fee sheet billing codes, claim status rendering, payment posting rendering, account balance rendering, account aging rendering, account ledger rendering, account statement readiness rendering, patient statement generation rendering, patient statement PDF export rendering, statement batch candidate rendering, statement batch package export rendering, collections work queue rendering, collections follow-up task rendering/action behavior, patient-message reassignment rendering/action behavior, patient-message content editing/rendering/action behavior, encounter document attachment rendering, encounter document revision rendering, encounter document replacement revision rendering/action behavior, encounter document upload rendering/action behavior, encounter binary document upload rendering/action/download behavior, encounter document sign-off rendering/action behavior, encounter document denial rendering/action behavior, encounter document metadata rendering/action behavior, encounter document move rendering/action behavior, encounter document content replacement rendering/action behavior, encounter document archive/restore rendering/action behavior, encounter document lifecycle timeline rendering/action behavior, encounter external-link document rendering/action behavior, encounter billing linkage rendering, encounter billing linkage mutation rendering, encounter claim linkage rendering, encounter procedure order linkage rendering, encounter diagnosis coding rendering, encounter diagnosis coding mutation rendering, encounter fee-sheet entry rendering/action behavior, encounter procedure-order entry rendering/action behavior, encounter procedure-result entry rendering/action behavior, encounter sign-off rendering/action behavior, encounter co-signature rendering/action behavior, completed procedure-result rendering, procedure result correction rendering/action behavior, pending scheduled procedure-order rendering, report-screen rendering, report export affordances, patient document rendering, patient document content rendering, patient document preview rendering, patient image document preview rendering, patient image document thumbnail rendering, patient PDF document inline-preview rendering, patient document lifecycle timeline rendering, patient scanned attachment rendering, patient document revision rendering, binary patient-document rendering/download behavior, patient binary document content replacement rendering/action/download behavior, patient insurance coverage rendering, patient immunization rendering, and administration directory rendering. Latest suite and plan summaries are written under `parity-tests/artifacts/` and displayed on the Workbench Test Runs page.

The legacy workflow mutation run covers deterministic demographics, patient registration, insurance coverage, appointment, appointment reschedule, appointment arrival, appointment check-out, appointment no-show, appointment category, appointment pending-status, appointment provider reassignment, appointment facility reassignment, appointment billing-location reassignment, encounter-detail, encounter metadata, clinical-list, problem-list, medication-list, patient-message, patient-message content, text patient-document, binary patient-document, patient binary document content replacement, image patient-document preview, image patient-document thumbnail, patient-document sign-off, patient-document denial, patient-document metadata, patient-document archive restore, patient-document content replacement, patient-document binary content replacement, patient-document replacement revision, patient scanned attachment, external-link patient-document, prescription, immunization, billing, billing diagnosis, billing correction, billing modifier, lab procedure, lab procedure result correction, administration facility, administration user, access-permission, and user group membership lifecycles. The shared patient contact, patient demographics, patient registration, patient insurance, appointment, appointment reschedule, appointment arrival, appointment check-out, appointment no-show, appointment category, appointment pending-status, appointment provider reassignment, appointment facility reassignment, appointment billing-location reassignment, encounter, encounter metadata, clinical-list, problem-list, medication-list, message, message content, text patient-document, binary patient-document, patient binary document content replacement, image patient-document preview, image patient-document thumbnail, patient-document sign-off, patient-document denial, patient-document metadata, patient-document archive restore, patient-document content replacement, patient-document binary content replacement, patient-document replacement revision, patient scanned attachment, external-link patient-document, prescription, immunization, billing, billing diagnosis, billing correction, billing modifier, procedure, procedure result correction, admin facility, admin user, access-permission, and user group membership mutation plans now run against both legacy and modernized targets, updating/rendering/restoring the same anchor patient contact record, updating/rendering/restoring the same anchor patient demographics record, creating/rendering/deleting a temporary registered patient, creating/rendering/updating/deleting the same anchor patient's insurance coverage row, creating/cancelling/deleting the same anchor patient's future appointment lifecycle, creating/rescheduling/deleting the same anchor patient's future appointment lifecycle, creating/marking-arrived/deleting the same anchor patient's future appointment lifecycle, creating/marking-arrived/checking-out/deleting the same anchor patient's future appointment lifecycle, creating/marking-no-show/deleting the same anchor patient's future appointment lifecycle, creating/updating-category/rendering/deleting the same anchor patient's future appointment lifecycle, creating/updating-provider/rendering/deleting the same anchor patient's future appointment lifecycle, creating/updating-facility/rendering/deleting the same anchor patient's future appointment lifecycle, creating/updating-billing-location/rendering/deleting the same anchor patient's future appointment lifecycle, creating/updating/rendering/deleting the same anchor patient's encounter with vitals and SOAP details, creating/rendering/updating/deleting the same anchor patient's encounter sensitivity/referral/external-ID/POS metadata, creating/rendering/deactivating/deleting the same anchor patient's allergy list entry, creating/rendering/deactivating/deleting the same anchor patient's medical-problem list entry, creating/rendering/deactivating/deleting the same anchor patient's medication-list entry, creating/rendering/closing/soft-deleting/hard-deleting the same anchor patient's message entry, editing/rendering the same anchor patient message title/body, creating/rendering/soft-deleting/hard-deleting the same anchor patient's database-backed text document entry, creating/rendering/downloading/soft-deleting/hard-deleting the same anchor patient's PDF-style binary document entry, creating/replacing/downloading/hard-deleting the same anchor patient's PDF-style binary document entry, creating/rendering/inline-previewing/downloading/archiving/hard-deleting the same anchor patient's image document entry, creating/rendering/thumbnailing/archiving/hard-deleting the same anchor patient's image document entry, creating/approving/rendering/archiving/hard-deleting the same anchor patient's reviewed text document entry, creating/denying/rendering/archiving/hard-deleting the same anchor patient's reviewed text document entry, creating/refiling/rendering/archiving/hard-deleting the same anchor patient's text document metadata entry, creating/archiving/restoring/rendering/hard-deleting the same anchor patient's text document entry, creating/replacing/verifying-revision/archiving/hard-deleting the same anchor patient's text document entry, creating/rendering/scanned-readiness/archiving/hard-deleting the same anchor patient's scanned PDF document entry, creating/rendering/archiving/hard-deleting the same anchor patient's external web-url document entry, creating/rendering/deactivating/deleting the same anchor patient's prescription entry, creating/rendering/marking-entered-in-error/deleting the same anchor patient's immunization entry, creating/rendering/marking billed/deactivating/deleting the same anchor patient's CPT fee-sheet line, creating/rendering/deactivating/deleting the same anchor patient's ICD10 fee-sheet diagnosis line, creating/correcting/rendering/deactivating/deleting the same anchor patient's CPT fee-sheet charge line, creating/completing/reporting/resulting/rendering/deleting the same anchor patient's lab procedure lifecycle, correcting/rendering/deleting the same anchor patient's temporary lab result lifecycle, creating/rendering/updating to inactive/default-hiding/deleting a temporary administration facility, creating/rendering/updating to inactive/default-hiding/deleting a temporary administration user, revoking/rendering/restoring a focused Front Office ACL permission assignment, and assigning/rendering/revoking a focused temporary-user Front Office membership. The shared access-control plan runs read-only against both targets and verifies default ACL groups, permission objects, group-permission assignments, and default user memberships. The shared encounter documents plan runs read-only against both targets and verifies linked encounter document facts plus legacy and modernized UI rendering. The shared encounter billing plan runs read-only against both targets and verifies active encounter fee-sheet line facts plus legacy and modernized UI rendering. The shared encounter claims plan runs read-only against both targets and verifies linked encounter claim-status facts plus modernized API/UI rendering. The shared encounter procedures plan runs read-only against both targets and verifies linked encounter procedure-order/report/result facts plus legacy procedure-result rendering and modernized API/UI rendering. The shared pending procedure orders plan runs read-only against both targets and verifies future scheduled lab orders with no linked report rows. The shared reports export plan runs read-only against both targets and verifies normalized operational export rows plus visible CSV export affordances. The shared patient documents plan runs read-only against both targets and verifies seeded document metadata, category mapping, content previews, and visible document lists. The shared patient document content plan runs read-only against both targets and verifies the full stored `MOD-PAT-0001` document payload plus modernized API/viewer/download retrieval. The shared binary patient-document plan runs against both targets and verifies temporary PDF-style upload, visible filing, byte-preserving modernized download, archive, and cleanup. The shared patient binary document content replacement plan runs against both targets and verifies temporary PDF-style filing, in-place byte replacement, replacement download, UI rendering, and cleanup. The shared procedure result correction plan runs against both targets and verifies temporary lab order/report/result creation, in-place result correction, corrected UI/API/database facts, and cleanup. The shared patient image document preview plan runs against both targets and verifies temporary `image/svg+xml` filing, inline-preview metadata, browser-visible modernized image rendering, byte-preserving download, archive, and cleanup. The shared patient image document thumbnail plan runs against both targets and verifies temporary `image/svg+xml` filing, stored-byte thumbnail data URI facts, browser-visible modernized document-card thumbnail rendering, archive, and cleanup. The shared patient document sign-off plan runs against both targets and verifies temporary text document pending state, approval/sign-off, browser-visible rendering, archive, and cleanup. The shared patient document denial plan runs against both targets and verifies temporary text document pending state, denied review state, browser-visible rendering, archive, and cleanup. The shared patient document metadata plan runs against both targets and verifies temporary text document refiled title, category, date, encounter, notes, browser-visible rendering, archive, and cleanup. The shared patient document archive restore plan runs against both targets and verifies temporary text document archive hiding, inaccessible content while archived, restore, browser-visible rendering, and cleanup. The shared patient document replacement revision plan runs against both targets and verifies temporary text document replacement updates current revision timestamp/hash while preserving the single current-version contract, browser-visible rendering, archive, and cleanup. The shared patient document external-link plan runs against both targets and verifies temporary `web_url` filing, URL/storage metadata, browser-visible rendering, archive, and cleanup. The shared billing diagnosis plan runs against both targets and verifies temporary `ICD10` fee-sheet row create/render/deactivate/delete behavior. The shared billing correction plan runs against both targets and verifies temporary CPT fee-sheet row create/correct/render/deactivate/delete behavior. The shared billing modifier plan runs against both targets and verifies temporary CPT fee-sheet row create/modify/render/deactivate/delete behavior. The shared claim status plan runs read-only against both targets and verifies seeded OpenEMR claim rows plus modernized Fees rendering. The shared payment posting plan runs read-only against both targets and verifies seeded OpenEMR AR sessions/activities plus modernized Fees rendering. The shared account balance plan runs read-only against both targets and verifies charge, payment, adjustment, and balance rollups plus modernized Fees rendering. The shared account aging plan runs read-only against both targets and verifies deterministic Current, 31-60, 61-90, and Over 90 AR buckets plus modernized Fees rendering. The shared account ledger plan runs read-only against both targets and verifies chronological charge, payment, adjustment, and running-balance rows plus modernized Fees rendering. The shared account statement plan runs read-only against both targets and verifies statement-ready recipient, period, due-date, current-due, past-due, oldest-open, and balance-due facts plus modernized Fees rendering. The shared insurance plan runs read-only against both targets and verifies the primary and secondary `MOD-PAT-0005` coverage rows plus browser-visible chart rendering. The shared insurance mutation plan runs against both targets and verifies temporary tertiary coverage create/render/update/delete behavior. The shared encounter metadata mutation plan runs against both targets and verifies temporary encounter sensitivity/referral/external-ID/POS create/render/update/delete behavior. The shared patient demographics mutation plan runs against both targets and verifies `MOD-PAT-0010` identity, DOB, address, marital-status, and occupation update/render/restore behavior. The shared patient registration plan runs against both targets and verifies temporary `TMP-PAT-REG-*` demographics/contact creation, chart rendering, and deletion. The shared immunizations plan runs read-only against both targets and verifies the `MOD-PAT-0007` pediatric vaccine-history anchor plus browser-visible legacy Immunizations and modernized Lists rendering. The Workbench mutation commands use per-test reseeding for stronger isolation, while the tests also perform cleanup so they can safely run inside broader plans.

Slice 102 and Slice 103 extend the shared appointment mutation family with comments update parity and regular recurrence metadata parity, both using temporary future appointments on `MOD-PAT-0003`, browser-visible legacy and modernized rendering, and hard-delete cleanup.

The shared document preview plan runs read-only against both targets and verifies preview kind, inline-readiness, thumbnail label, thumbnail text, and modernized Documents card rendering.

The shared document revision plan runs read-only against both targets and verifies current revision timestamp, version label, version-history count, revision hash, and modernized Documents card/viewer rendering.

The shared document replacement revision plan runs against both targets and verifies that content replacement advances the current revision timestamp, changes the current hash, preserves `Version 1`/`Current version`, and renders the replacement state in the modernized Documents workspace.

The shared patient document lifecycle timeline plan runs against both targets and verifies temporary patient document create/sign/archive/restore/delete behavior, derived filed/current-version/review/active/archive lifecycle events, and modernized Documents card and viewer timeline rendering.

The shared patient scanned attachment plan runs against both targets and verifies temporary scanned PDF document create/archive/delete behavior, derived scan status, capture source, scanned page count, OCR status, and modernized Documents card and viewer scan-readiness rendering. The shared appointment reschedule plan runs against both targets and verifies temporary future appointment create/update/delete behavior, changed date/time/duration/status/room facts, and modernized Calendar reschedule rendering. The shared appointment arrival plan runs against both targets and verifies temporary future appointment create/mark-arrived/delete behavior, arrived status facts, and modernized Calendar `Mark arrived` rendering. The shared appointment check-out plan runs against both targets and verifies temporary future appointment create/mark-arrived/check-out/delete behavior, checked-out status facts, and modernized Calendar `Mark checked out` rendering. The shared appointment no-show plan runs against both targets and verifies temporary future appointment create/mark-no-show/delete behavior, no-show status facts, and modernized Calendar `Mark no-show` rendering. The shared appointment category plan runs against both targets and verifies temporary future appointment category `13` create/render behavior, category update to `10`, legacy `form_category` rendering, modernized Calendar category selection/rendering, and cleanup. The shared appointment comments plan runs against both targets and verifies temporary future appointment comment create/update/render behavior, legacy `form_comments`, modernized Calendar comments controls, and cleanup. The shared appointment recurrence metadata plan runs against both targets and verifies temporary future appointment regular recurrence create/update/render behavior, legacy repeat controls, modernized Calendar repeat controls, recurrence label rendering, and cleanup. The shared appointment recurring-series plan runs against both targets and verifies seeded regular recurrence expansion from the `MOD-PAT-0003` preventive-care anchor, generated occurrence numbers/dates, modernized Calendar generated-occurrence labels, read-only generated occurrence actions, and unchanged seeded appointment rows. The shared appointment recurrence exception-edit plan runs against both targets and verifies editing the seeded `MOD-PAT-0013` skipped-date list, hiding the newly skipped generated occurrence, restoring the seeded exception list, and modernized Calendar `Skipped dates` rendering. The shared appointment series root update plan runs against both targets and verifies changing the seeded `MOD-PAT-0013` recurring root title/time, generated occurrence propagation, restored seeded root cleanup, and modernized recurring-root edit rendering. The shared appointment series root metadata plan runs against both targets and verifies changing the same seeded root provider, facility, billing location, category, status, room, and comments, generated occurrence metadata propagation, restored seeded root cleanup, and modernized recurring-root metadata edit rendering. The shared appointment monthly recurrence plan runs against both targets and verifies temporary monthly recurring appointment creation, update to every two months, generated occurrence expansion, legacy repeat controls, modernized Calendar repeat controls, generated occurrence rendering, and cleanup deletion. The shared appointment recurrence unit matrix plan runs against both targets and verifies temporary daily, workday, and yearly recurring appointment creation, generated occurrence expansion, legacy repeat controls, modernized Calendar repeat controls, generated occurrence rendering, and cleanup deletion. The shared appointment days-of-week recurrence plan runs against both targets and verifies temporary Monday/Wednesday/Friday recurrence creation, OpenEMR `REPEAT_DAYS` weekday controls, modernized weekday controls, generated occurrence rendering, and cleanup deletion. The shared appointment monthly repeat-on recurrence plan runs against both targets and verifies temporary second-Tuesday and last-Friday monthly recurrence creation, OpenEMR `REPEAT_ON` controls, modernized repeat-on controls, generated occurrence rendering, and cleanup deletion. The shared appointment series recurrence update plan runs against both targets and verifies seeded recurring root cadence/end-date editing, OpenEMR repeat controls, modernized Calendar recurrence controls, generated occurrence changes, skipped-date preservation, and cleanup restoration. The shared appointment provider overlap plan runs against both targets and verifies temporary same-provider, same-time appointments for two patients, distinct appointment rendering, modernized provider-overlap count/ID detail, and cleanup deletion. The shared appointment patient overlap plan runs against both targets and verifies temporary same-patient, same-time appointments with two providers, distinct appointment rendering, modernized patient-overlap count/ID detail, and cleanup deletion. The shared appointment room overlap plan runs against both targets and verifies temporary same-room, same-time appointments for two patients, distinct appointment rendering, modernized room-overlap count/ID detail, and cleanup deletion.

The shared payment posting mutation plan runs against both targets and verifies temporary payment posting create/render/void/delete behavior, active-row hiding after void, account balance rollback, ledger effects, and cleanup.

The shared claim status mutation plan runs against both targets and verifies temporary claim create/render, generated-file status, cleared status, and cleanup.

The shared patient payment capture plan runs against both targets and verifies temporary patient-responsibility payment create/render/void/delete behavior, payer-type-zero semantics, active-row hiding after void, balance/ledger recalculation, cleanup, and modernized Fees workspace rendering.

The shared statement generation plan runs against both targets and verifies deterministic printable patient statement number, payment instructions, generated text, line items, totals, and modernized Fees workspace rendering.

The shared statement batch plan runs against both targets and verifies ranked positive-balance statement candidates, aggregate candidate totals, delivery metadata, and modernized Fees workspace work-queue rendering.

The shared statement batch package plan runs against both targets and verifies deterministic package manifest rows, summary CSV rows, included statement PDFs, and modernized Fees workspace package export rendering.

The shared collections work queue plan runs against both targets and verifies deterministic past-due account ranking, high-priority and over-90 rollups, recommended collection actions, contact metadata, and modernized Fees workspace collections queue rendering.

The shared collections follow-up task plan runs against both targets and verifies pnotes-compatible task creation from the collections queue, close/archive/delete cleanup, legacy pnotes rendering, modernized Messages rendering, and modernized Fees workspace Create Task behavior.

The shared patient-message assignment plan runs against both targets and verifies temporary message reassignment from `admin` to `billing`, unchanged message counts, legacy pnotes rendering, modernized Messages reassignment controls, and cleanup.

The shared patient-message content plan runs against both targets and verifies temporary message title/body editing, unchanged message counts, legacy pnotes rendering, modernized Messages Save Edit controls, and cleanup.

The shared encounter documents plan runs read-only against both targets and verifies `MOD-PAT-0001` encounter `1000013`, two linked document records, legacy document-category rendering, modernized Encounter detail API document fields, and modernized Encounters workspace attached-document cards.

The shared encounter billing plan runs read-only against both targets and verifies `MOD-PAT-0001` encounter `1000013`, two active CPT4 fee-sheet rows, legacy fee-sheet rendering, modernized Encounter detail API billing fields, and modernized Encounters workspace Fee Sheet Linkage cards.

The shared encounter billing linkage mutation plan runs against both targets and verifies a temporary `CPT4 99499` fee-sheet row on `MOD-PAT-0001` encounter `1000013`, legacy Fee Sheet rendering, modernized Encounter detail API/UI rendering, billed/inactive hiding, and hard-delete cleanup.

The shared encounter procedure-result entry plan runs against both targets and verifies a temporary pending `80053` laboratory order plus reviewed final report/result on `MOD-PAT-0001` encounter `1000013`, legacy Procedure Results rendering, modernized Encounters workspace result-entry behavior, Procedure Orders panel report/result rendering, and hard-delete cleanup. The shared encounter sign-off plan runs against both targets and verifies a temporary `MOD-PAT-0002` encounter attestation, legacy `esign_signatures` facts, modernized `encounter_signatures` facts, modernized Encounter Sign-Off rendering, signature deletion, and encounter cleanup. The shared encounter co-signature plan runs against both targets and verifies temporary `admin` and locked `gold-provider-02` encounter signatures on a temporary `MOD-PAT-0002` encounter, database ordering/hash/amendment facts, modernized `2 signatures` rendering, signature deletion, and encounter cleanup. The shared encounter document revision plan runs against both targets and verifies seeded encounter-attached document current-version metadata, revision timestamps, revision-hash parity, modernized Encounter attachment-card rendering, and side-by-side comparison evidence. The shared encounter document replacement revision plan runs against both targets and verifies a temporary encounter-attached document, replacement payload mutation, current revision hash/timestamp facts, modernized Encounter attachment-card/API rendering, and cleanup. The shared encounter document upload plan runs against both targets and verifies a temporary text document attached to `MOD-PAT-0001` encounter `1000013`, legacy document-category rendering, modernized Encounter attached-document rendering, document deletion, and cleanup. The shared encounter binary document upload plan runs against both targets and verifies a temporary PDF document on the same encounter, legacy document-category rendering, modernized Encounter attached-document rendering, download content, document deletion, and cleanup. The shared encounter document sign-off plan runs against both targets and verifies a temporary text document on the same encounter, pending review state, `admin` approval/sign-off metadata, modernized Encounter approved-state rendering, document deletion, and cleanup. The shared encounter document denial plan runs against both targets and verifies a temporary text document on the same encounter, pending review state, `admin` denied metadata, modernized Encounter denied-state rendering with reviewed actions disabled, document deletion, and cleanup. The shared encounter document metadata plan runs against both targets and verifies a temporary text document on the same encounter, metadata refiling, preserved encounter link, modernized Encounter inline Edit rendering, document deletion, and cleanup. The shared encounter document move plan runs against both targets and verifies a temporary text document moving from `MOD-PAT-0001` encounter `1000013` to same-patient encounter `1000011`, source removal, target attachment, modernized Encounter inline Move rendering, document deletion, and cleanup. The shared encounter document content replacement plan runs against both targets and verifies a temporary text document on `MOD-PAT-0001` encounter `1000013`, in-place payload replacement, replacement preview/current-version facts, modernized Encounter inline Replace rendering, document deletion, and cleanup. The shared encounter document archive/restore plan runs against both targets and verifies a temporary text document on the same encounter, archive hiding from active detail, archived-detail visibility, modernized Encounter inline Restore rendering, document restoration, document deletion, and cleanup. The shared encounter document lifecycle timeline plan runs against both targets and verifies a temporary text document on the same encounter, filed/current-version/review/active/archive lifecycle state, modernized Encounter lifecycle timeline rendering, document restoration, document deletion, and cleanup. The shared encounter external-link document plan runs against both targets and verifies a temporary web URL document on the same encounter, URL-backed `web_url` storage facts, modernized Encounter external-link rendering, archive behavior, document deletion, and cleanup. The shared patient image document preview plan runs against both targets and verifies a temporary `image/svg+xml` document on `MOD-PAT-0001`, inline-preview metadata, modernized Documents viewer image rendering, byte-preserving download behavior, archive behavior, document deletion, and cleanup. The shared patient image document thumbnail plan runs against both targets and verifies a temporary `image/svg+xml` document on `MOD-PAT-0001`, stored-byte thumbnail data URI facts, modernized Documents card thumbnail rendering, archive behavior, document deletion, and cleanup. The prior encounter procedure-order entry plan remains available and verifies pending order create/render/delete behavior on the same anchor.

The shared encounter claims plan runs read-only against both targets and verifies `MOD-PAT-0001` encounter `1000013`, claim `CLAIM-1000013-1`, payer `Acme Health`, `HCFA` target, cleared claim status facts, modernized Encounter detail API claim fields, and modernized Encounters workspace Claim Linkage cards.

The Workbench now exposes curated plan actions for legacy readiness, slice-1 side-by-side readiness through slice-123 encounter document replacement revision readiness, isolated mutations, and the full legacy parity contract. Plan evidence displays the selected suites so an operator can distinguish a plan run from an individual suite run.

The Workbench also exposes a custom parity run builder on the Test Runs page for each managed application. It reads the parity manifest through the Workbench API and lets an operator choose a suite or plan, reset mode, headed mode, and optional grep filter. The backend validates these values before constructing `scripts/Run-OpenEmrParityTests.ps1`, preserving the allowlisted-command model while making targeted runs and reset-strategy experiments available from the UI.

The Test Runs page now renders recent side-by-side comparison artifacts from `parity-tests/artifacts/comparisons/`. The Workbench API exposes `/api/parity-comparisons`, reads bounded `comparison.json` summaries from that fixed artifact root, and returns normalized comparison rows. The UI shows the selection id, matched/different status, left and right target run IDs, selected suites, check counts, durations, difference counts, difference previews, and the comparison artifact path. Slice 124 adds an icon-driven expand/collapse drill-in on each comparison card that shows the legacy and modernized run artifact paths, comparison JSON path, artifact directory, selected suites, complete difference list, and a matched-state confirmation when no differences are recorded. Slice 125 adds icon links that open the legacy run artifact, modernized run artifact, and comparison JSON through the safe `/api/artifacts/file` endpoint while rejecting non-artifact paths. This keeps comparison review in the Workbench instead of requiring operators to inspect raw JSON folders after each `npm run compare` execution.

The modernized target test command is `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`, which writes `modernized-openemr/artifacts/latest-modernized-smoke-test.json`. It checks API health, deterministic anchor patient search for `MOD-PAT-0001`, the anchor chart summary response, patient demographics update/restore lifecycle for `MOD-PAT-0010`, temporary patient registration create/search/load/delete lifecycle, anchor insurance coverage and insurance coverage mutation lifecycle for `MOD-PAT-0005`, anchor immunization history for `MOD-PAT-0007`, appointment search/detail for `MOD-PAT-0003`, appointment create/cancel/delete lifecycle cleanup, appointment reschedule lifecycle cleanup, appointment arrival lifecycle cleanup, appointment check-out lifecycle cleanup, appointment no-show lifecycle cleanup, appointment category lifecycle cleanup, appointment pending-status lifecycle cleanup, appointment provider reassignment lifecycle cleanup, appointment facility reassignment lifecycle cleanup, appointment billing-location reassignment lifecycle, appointment comments lifecycle cleanup, appointment recurrence metadata lifecycle cleanup, appointment monthly recurrence lifecycle cleanup, appointment recurrence unit matrix lifecycle cleanup, appointment days-of-week recurrence lifecycle cleanup, appointment monthly repeat-on recurrence lifecycle cleanup, appointment series recurrence update propagation, appointment provider overlap tolerance, appointment patient overlap tolerance, appointment room overlap tolerance, appointment recurring-series expansion, appointment recurrence-exception expansion, appointment occurrence cancellation exception, appointment occurrence restore exception, appointment occurrence reschedule exception, appointment recurrence exception-list edit, appointment series root update propagation, appointment series root metadata propagation, encounter co-signature readiness, encounter document revision readiness, encounter document replacement revision readiness, encounter scanned attachment readiness, patient binary document content replacement lifecycle, procedure result correction lifecycle, and the existing encounter, clinical-list, message, document, prescription, immunization, procedure, billing, administration, access-control, operational-report, and CSV export smoke checks. The reusable side-by-side commands include the `slice-1-readiness` through `slice-129-procedure-result-correction-readiness` parity plans, which write latest summaries for both `legacy-openemr` and `modernized-openemr` under `parity-tests/artifacts/` and can be compared with the parity comparison runner.

This keeps the workbench honest: it reports real automation evidence instead of inventing its own private test flow.

## Seed Data Orchestration

The Workbench owns seed-data visibility and orchestration.

Current seed-data files:

- `modernization-workbench/seed-data/manifest.json`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/README.md`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/personas/golden-patients.json`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/scripts/generate-gold-dataset.mjs`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/canonical/gold-dataset.json`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/summary.json`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/legacy-mariadb/seed-gold.sql`

The seed manifest is the shared contract. Application-specific seeders should consume that contract and apply it to their own database. The legacy app currently has a gold seed action that resets the relevant legacy data tables, applies the 1,000-patient dataset, and validates expected counts. The starter example seed remains available as a small fallback.

The modernized app now has a PostgreSQL seeder that consumes the same canonical dataset, generates `modernized-openemr/artifacts/postgres/seed-gold.sql`, resets the modernized read-model tables, applies the canonical gold dataset, and validates counts for patients, insurance records, appointments, encounters, vitals, clinical notes, prescriptions, billing, claims, payment sessions, payment activities, lab orders, lab reports, lab results, messages, problems, allergies, medications, and patient documents.

## Comparison Capabilities

Once the modernized target exists, the workbench should support side-by-side comparison.

Comparison views should include:

- Test pass/fail comparison by suite and workflow.
- Normalized API response differences.
- Normalized database or domain-state differences where appropriate.
- Playwright screenshots or traces for UI workflows.
- Timing and reliability trends.
- Known accepted differences.
- Blocking differences that prevent parity signoff.

The comparison should focus on observable behavior and domain outcomes rather than identical internal implementation details.

## Technical Architecture Comparison

The workbench should also make the technical modernization visible.

Architecture comparison views should show:

- Legacy, Workbench, and modernized technology stack and runtime components.
- Version numbers for key technologies, images, frameworks, and runtime components when they are pinned or observable from the repo or running containers.
- Data stores used by each system.
- API boundaries and integration points.
- Where business logic lives in each system.
- Authentication and authorization model differences.
- Test coverage by layer for each system.
- Migration status by workflow, table, API, or domain area.

This information currently comes from curated Workbench UI metadata, project documents, package manifests, Docker Compose configuration, and verified running-container versions. Over time, more of it may be generated from repository scans, build metadata, service health endpoints, or test manifests.

## Progress Model

Workflow progress should be tracked by modernization slice.

Suggested states:

- Not started.
- Legacy behavior discovery.
- Legacy tests written.
- Modern API designed.
- Modern database mapping designed.
- Modern implementation in progress.
- Modern tests written.
- Side-by-side parity testing.
- Parity verified.
- Deferred or blocked.

Each workflow should link to the relevant documents, tests, logs, and known decisions.

## Design Principle

The workbench is a control surface and evidence viewer. It should not hide the underlying modernization process.

Every action it performs should map to a repeatable command, script, API call, test suite, or documented workflow that can be inspected and run without the workbench.
