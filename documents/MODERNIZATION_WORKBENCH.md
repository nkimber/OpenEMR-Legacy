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

The Workbench currently manages the legacy OpenEMR baseline and the modernized OpenEMR target as it grows slice by slice. It now uses a left-side application shell with hash-routed pages. It can show status, check health, start, stop, restart, run smoke tests, run OpenEMR-native PHPUnit and Jest tests for the legacy target, run parity test suites and plans for implemented targets, run custom parity runs with selected reset strategy, run gold seed actions, run the starter seed action for legacy, display latest smoke-test, native-test, parity-test, and seed results, show Docker Compose logs, display database profiles, list action history, render the project changelog as a build timeline, and show architecture/progress views.

Current pages:

- Dashboard.
- Applications.
- Project Timeline.
- Progress.
- Architecture.
- Test Runs.
- Seed Data.

The navigation model supports nested child items so the Workbench can grow into two-level navigation later without reworking the shell.

The legacy app launch link opens `http://localhost:8080` because that is the browser-friendly local URL. The OpenEMR HTTPS endpoint remains available at `https://localhost:9443`, but it uses a self-signed local certificate and browsers will show a privacy warning unless the certificate is trusted or manually bypassed. The Workbench backend still uses `https://localhost:9443/meta/health/readyz` for health checks and is configured to tolerate the self-signed certificate for that internal check.

The Managed Application panel also displays the local demo OpenEMR login read from `legacy-openemr/.env`. This is intentionally local-only and helps distinguish the actual baseline credential from any browser autofill suggestion on the OpenEMR login page.

The Workbench owns the shared seed-data contract under `modernization-workbench/seed-data/`. The current manifest defines `openemr-shared-synthetic-v1`, the generated 1,000-patient deterministic synthetic gold dataset. The legacy MariaDB adapter is implemented through `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`; the modernized PostgreSQL adapter is implemented through `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`.

Verified behavior:

- Production build passes with `npm run build`.
- The UI renders in desktop and mobile viewports.
- The UI includes a left navigation shell with separate pages for dashboard, applications, timeline, progress, architecture, tests, and seed data.
- The API can read legacy OpenEMR status.
- The API can load recent Docker Compose logs.
- The API can run the baseline smoke test.
- The API can run the containerized OpenEMR-native isolated PHPUnit stable suite.
- The API can run the OpenEMR-native JavaScript Jest suite.
- The API can run the legacy parity database, HTTP, UI, workflow mutation, named-plan, and full-suite test commands through allowlisted manifests.
- The API can run validated custom parity selections from the manifest with operator-selected reset mode, headed mode, and optional grep filter.
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
- The API can run the shared slice-11 appointment mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-12 encounter mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-13 clinical-list mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-14 message mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-15 prescription mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-16 billing mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-17 procedure mutation readiness parity plan for both legacy and modernized targets.
- The API can run the shared slice-18 admin facility mutation readiness parity plan for both legacy and modernized targets.
- The API can parse `documents/PROJECT_CHANGELOG.md` and expose it as structured timeline data.
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
- Display the project changelog as a designed build timeline sourced from `documents/PROJECT_CHANGELOG.md` on its own page.
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

The reusable parity test harness lives in `parity-tests/` and is launched by `scripts/Run-OpenEmrParityTests.ps1`. It currently provides database, HTTP, Playwright UI, workflow mutation, named run plans, a side-by-side slice-1 readiness plan, a side-by-side slice-2 scheduling readiness plan, a side-by-side slice-3 encounters readiness plan, a side-by-side slice-4 clinical-lists readiness plan, a side-by-side slice-5 messaging readiness plan, a side-by-side slice-6 procedures readiness plan, a side-by-side slice-7 billing readiness plan, a side-by-side slice-8 admin readiness plan, a side-by-side slice-9 reports readiness plan, a side-by-side slice-10 contact mutation readiness plan, a side-by-side slice-11 appointment mutation readiness plan, a side-by-side slice-12 encounter mutation readiness plan, a side-by-side slice-13 clinical-list mutation readiness plan, a side-by-side slice-14 message mutation readiness plan, a side-by-side slice-15 prescription mutation readiness plan, a side-by-side slice-16 billing mutation readiness plan, a side-by-side slice-17 procedure mutation readiness plan, a side-by-side slice-18 admin facility mutation readiness plan, and full-suite legacy runs. The UI suite covers login, chart, encounter SOAP/vitals, scheduler appointment details, fee sheet billing codes, procedure-result rendering, report-screen rendering, and administration directory rendering. Latest suite and plan summaries are written under `parity-tests/artifacts/` and displayed on the Workbench Test Runs page.

The legacy workflow mutation run covers deterministic demographics, appointment, encounter-detail, clinical-list, patient-message, prescription, billing, lab procedure, and administration facility lifecycles. The shared patient contact, appointment, encounter, clinical-list, message, prescription, billing, procedure, and admin facility mutation plans now run against both legacy and modernized targets, updating/rendering/restoring the same anchor patient contact record, creating/cancelling/deleting the same anchor patient's future appointment lifecycle, creating/updating/rendering/deleting the same anchor patient's encounter with vitals and SOAP details, creating/rendering/deactivating/deleting the same anchor patient's allergy list entry, creating/rendering/closing/soft-deleting/hard-deleting the same anchor patient's message entry, creating/rendering/deactivating/deleting the same anchor patient's prescription entry, creating/rendering/marking billed/deactivating/deleting the same anchor patient's CPT fee-sheet line, creating/completing/reporting/resulting/rendering/deleting the same anchor patient's lab procedure lifecycle, and creating/rendering/updating to inactive/default-hiding/deleting a temporary administration facility. The Workbench mutation commands use per-test reseeding for stronger isolation, while the tests also perform cleanup so they can safely run inside broader plans.

The Workbench now exposes curated plan actions for legacy readiness, slice-1 side-by-side readiness, slice-2 scheduling readiness, slice-3 encounters readiness, slice-4 clinical-lists readiness, slice-5 messaging readiness, slice-6 procedures readiness, slice-7 billing readiness, slice-8 admin readiness, slice-9 reports readiness, slice-10 contact mutation readiness, slice-11 appointment mutation readiness, slice-12 encounter mutation readiness, slice-13 clinical-list mutation readiness, slice-14 message mutation readiness, slice-15 prescription mutation readiness, slice-16 billing mutation readiness, slice-17 procedure mutation readiness, slice-18 admin facility mutation readiness, isolated mutations, and the full legacy parity contract. Plan evidence displays the selected suites so an operator can distinguish a plan run from an individual suite run.

The Workbench also exposes a custom parity run builder on the Test Runs page for each managed application. It reads the parity manifest through the Workbench API and lets an operator choose a suite or plan, reset mode, headed mode, and optional grep filter. The backend validates these values before constructing `scripts/Run-OpenEmrParityTests.ps1`, preserving the allowlisted-command model while making targeted runs and reset-strategy experiments available from the UI.

The modernized target test command is `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`, which writes `modernized-openemr/artifacts/latest-modernized-smoke-test.json`. It checks API health, deterministic anchor patient search for `MOD-PAT-0001`, the anchor chart summary response, appointment search/detail for `MOD-PAT-0003`, appointment create/cancel/delete lifecycle cleanup, encounter search/detail with SOAP and vitals for `MOD-PAT-0001`, encounter create/update/vitals/SOAP/delete lifecycle cleanup, clinical-list facts for `MOD-PAT-0001`, allergy create/deactivate/delete lifecycle cleanup for `MOD-PAT-0006`, portal-enabled patient messages and patient-message create/close/soft-delete/delete lifecycle cleanup for `MOD-PAT-0004`, prescription create/deactivate/delete lifecycle cleanup for `MOD-PAT-0008`, completed procedure results and procedure order/status/report/result/delete lifecycle cleanup for `MOD-PAT-0009`, fee-sheet billing lines and billing line create/status/delete lifecycle cleanup for `MOD-PAT-0001`, administration directory facts for seeded users and facilities, administration facility create/update/inactive/delete lifecycle cleanup, and operational-report facts for the seeded gold dataset. The reusable side-by-side commands include the `slice-1-readiness`, `slice-2-scheduling-readiness`, `slice-3-encounters-readiness`, `slice-4-clinical-lists-readiness`, `slice-5-messaging-readiness`, `slice-6-procedures-readiness`, `slice-7-billing-readiness`, `slice-8-admin-readiness`, `slice-9-reports-readiness`, `slice-10-contact-mutation-readiness`, `slice-11-appointment-mutation-readiness`, `slice-12-encounter-mutation-readiness`, `slice-13-clinical-list-mutation-readiness`, `slice-14-message-mutation-readiness`, `slice-15-prescription-mutation-readiness`, `slice-16-billing-mutation-readiness`, `slice-17-procedure-mutation-readiness`, and `slice-18-admin-facility-mutation-readiness` parity plans, which write latest summaries for both `legacy-openemr` and `modernized-openemr` under `parity-tests/artifacts/` and can be compared with the parity comparison runner.

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

The modernized app now has a PostgreSQL seeder that consumes the same canonical dataset, generates `modernized-openemr/artifacts/postgres/seed-gold.sql`, resets the modernized read-model tables, applies the canonical gold dataset, and validates counts for patients, insurance records, appointments, encounters, vitals, clinical notes, prescriptions, billing, lab orders, lab reports, lab results, messages, problems, allergies, and medications.

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

- Legacy technology stack and runtime components.
- Modernized technology stack and runtime components.
- Data stores used by each system.
- API boundaries and integration points.
- Where business logic lives in each system.
- Authentication and authorization model differences.
- Test coverage by layer for each system.
- Migration status by workflow, table, API, or domain area.

This information may initially come from curated project documents and static metadata. Over time, some of it may be generated from repository scans, build metadata, service health endpoints, or test manifests.

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
