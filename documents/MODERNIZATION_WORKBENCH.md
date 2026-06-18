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

The Workbench currently manages the legacy OpenEMR baseline. It now uses a left-side application shell with hash-routed pages. It can show status, check health, start, stop, restart, run the smoke test, run parity test suites, run the gold seed action, run the starter seed action, display latest smoke-test, parity-test, and seed results, show Docker Compose logs, display a database profile, list action history, render the project changelog as a build timeline, and show architecture/progress views.

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

The Workbench owns the shared seed-data contract under `modernization-workbench/seed-data/`. The current manifest defines `openemr-shared-synthetic-v1`, the generated 1,000-patient deterministic synthetic gold dataset. The legacy MariaDB adapter is implemented through `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`; the future modernized PostgreSQL adapter is still planned.

Verified behavior:

- Production build passes with `npm run build`.
- The UI renders in desktop and mobile viewports.
- The UI includes a left navigation shell with separate pages for dashboard, applications, timeline, progress, architecture, tests, and seed data.
- The API can read legacy OpenEMR status.
- The API can load recent Docker Compose logs.
- The API can run the baseline smoke test.
- The API can run the legacy parity database, HTTP, UI, workflow mutation, named-plan, and full-suite test commands through allowlisted manifests.
- The API can run and validate the legacy gold seed action.
- The API can parse `documents/PROJECT_CHANGELOG.md` and expose it as structured timeline data.
- The API can stop and restart the legacy OpenEMR Docker Compose stack.
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
- Trigger parity test suites through `scripts/Run-OpenEmrParityTests.ps1`.
- Display latest baseline smoke and parity test results.
- Display recent lifecycle action results, including command status, duration, and logs.
- Display the project changelog as a designed build timeline sourced from `documents/PROJECT_CHANGELOG.md` on its own page.
- Display architecture, progress, test runs, seed data, and managed applications on dedicated pages.
- Display links or paths to logs, screenshots, and reports.
- Show placeholder sections for the modernized target, marked as not started until that system exists.
- Show a project progress view with the three major systems and their current stage.

The first version does not require the modernized target to exist.

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

Future targets:

- Modernized OpenEMR API.
- Modernized OpenEMR UI.
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

The reusable parity test harness lives in `parity-tests/` and is launched by `scripts/Run-OpenEmrParityTests.ps1`. It currently provides database, HTTP, Playwright UI, workflow mutation, named run plans, and full-suite legacy runs. Latest suite and plan summaries are written under `parity-tests/artifacts/` and displayed on the Workbench Test Runs page.

The workflow mutation run covers deterministic demographics, appointment, encounter-detail, clinical-list, patient-message, prescription, billing, and lab procedure lifecycles. The Workbench command uses per-test reseeding for stronger isolation, while the suite also performs cleanup so it can safely run inside the full parity suite.

The Workbench now exposes curated plan actions for legacy readiness, isolated mutations, and the full parity contract. Plan evidence displays the selected suites so an operator can distinguish a plan run from an individual suite run.

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

The seed manifest is the shared contract. Application-specific seeders should consume that contract and apply it to their own database. The legacy app currently has a gold seed action that resets the relevant legacy data tables, applies the 1,000-patient dataset, and validates expected counts. The starter example seed remains available as a small fallback. The modernized app will later get a PostgreSQL seeder that consumes the same canonical dataset.

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
