# Project Changelog

Created: 2026-06-18

## Purpose

This document tracks the concrete implementation steps, improvements, and enhancements made during the OpenEMR modernization project.

Use it as the project-level changelog: when code, configuration, test coverage, seed data, orchestration, documentation structure, or durable project behavior changes, add a new entry here in the same work item.

## Maintenance Rules

- Add entries in chronological order.
- Keep each entry concrete: describe what changed, why it matters, and where the evidence or source files live.
- Reference the relevant commit when available.
- Record `Started:` and `Finished:` timestamps for each new entry using ISO 8601 local time with timezone offset, such as `2026-06-19T13:06:12-04:00`.
- Treat `Started:` as the time active implementation work for that changelog section began and `Finished:` as the time verification and document updates for that section were complete.
- Do not manually calculate or write a duration; the Modernization Workbench calculates section duration from `Started:` and `Finished:`.
- Do not replace the detailed project documents. Link to them or name them when the change belongs to a specific area.
- If a later change supersedes an earlier entry, add a new entry that says so rather than silently rewriting history.

## Entry Template

Future entries should use this header shape:

```markdown
### 000. Short Entry Title

Commit: pending
Started: `2026-06-19T13:06:12-04:00`
Finished: `2026-06-19T13:42:30-04:00`

One-paragraph summary of what changed and why it matters.
```

Use the local machine clock, for example PowerShell `Get-Date -Format o`, so the Workbench can display actual clock times and calculate elapsed section duration.

## 2026-06-18

### 001. Project Documentation Foundation

Commit: `5fb6200` and follow-on documentation commits

Established the project documentation model in `documents/` and created `AGENTS.md` so future Codex sessions know to treat the document set as durable project memory.

Key outcomes:

- Created the initial project context and modernization vision.
- Added `documents/INDEX.md` as the routing map for the document library.
- Added `documents/DOCUMENTATION_GOVERNANCE.md` to require documentation updates alongside code, configuration, architecture, test, setup, and decision changes.
- Added the first baseline and GitHub connection documents.

Primary documents:

- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/DOCUMENTATION_GOVERNANCE.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/GITHUB_CONNECTION.md`
- `AGENTS.md`

### 002. Legacy OpenEMR Baseline Installed And Verified

Commit: `5fb6200`

Created the reproducible legacy OpenEMR baseline under `legacy-openemr/`.

Key outcomes:

- Added Docker Compose runtime for OpenEMR and MariaDB.
- Pinned OpenEMR image `openemr/openemr:8.1.0-2026-06-18`.
- Pinned upstream source tag `v8_1_0` and source commit `28dc4f9ba3f3d4de8324980699a072cdaf098927`.
- Pinned MariaDB image `mariadb:11.8.8`.
- Added local environment template and local-only demo credential handling.
- Added the baseline smoke test script.
- Verified the health endpoint, login page, and local admin login.

Primary files:

- `legacy-openemr/docker-compose.yml`
- `legacy-openemr/.env.example`
- `legacy-openemr/scripts/Test-LegacyBaseline.ps1`
- `documents/LEGACY_OPENEMR_BASELINE.md`

### 003. Git Repository And GitHub Remote Established

Commits: `717ad30`, `fb10369`, `1338873`, `89491d5`, `89c3178`, `6b806cc`, `4fc6a82`, `0f80b14`

Initialized the parent modernization workspace as a Git repository and connected it to GitHub.

Key outcomes:

- Established the `main` branch.
- Added ignore rules for local environment files, runtime artifacts, node modules, built frontend output, Playwright local files, and the local OpenEMR source checkout.
- Added helper scripting and documentation for connecting the GitHub remote.
- Connected and pushed to `https://github.com/nkimber/OpenEMR-Legacy.git`.

Primary files:

- `.gitignore`
- `scripts/Connect-GitHubRemote.ps1`
- `documents/GITHUB_CONNECTION.md`
- `README.md`

### 004. Modernization Workbench Concept Documented

Commit: `8dd640a`

Documented the Modernization Workbench as the third application in the project: an oversight and orchestration website for the legacy baseline, future modernized target, tests, status, progress, and architecture comparison.

Key outcomes:

- Defined the Workbench as a local-first control surface and evidence viewer.
- Captured lifecycle control expectations for managed project applications.
- Established that Workbench actions must map to repeatable scripts or commands rather than a general-purpose shell.
- Defined future comparison responsibilities for side-by-side modernization parity.

Primary document:

- `documents/MODERNIZATION_WORKBENCH.md`

### 005. Modernization Workbench V1 Implemented

Commit: `65a291e`

Built the first working version of the Modernization Workbench under `modernization-workbench/`.

Key outcomes:

- Added a React, TypeScript, Vite, Node.js, and Express application.
- Added local-only Workbench API on `http://127.0.0.1:5174`.
- Added Workbench UI on `http://127.0.0.1:5173`.
- Added managed application configuration for the legacy OpenEMR baseline.
- Added status, health, start, stop, restart, logs, smoke-test, architecture, progress, and action-history capabilities.
- Added `scripts/Start-ModernizationWorkbench.ps1` to start the Workbench.
- Verified production build and UI rendering.

Primary files:

- `modernization-workbench/`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `scripts/Start-ModernizationWorkbench.ps1`
- `documents/MODERNIZATION_WORKBENCH.md`

### 006. Browser-Friendly Legacy OpenEMR Launch URL

Commit: `4decff1`

Updated the Workbench legacy OpenEMR launch link to use `http://localhost:8080`.

Key outcomes:

- Avoided the browser privacy warning caused by the self-signed local HTTPS certificate at `https://localhost:9443`.
- Kept the HTTPS health endpoint in place for backend health checks.
- Documented the difference between the browser-friendly app URL and the HTTPS health endpoint.

Primary files:

- `modernization-workbench/config/apps.json`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/MODERNIZATION_WORKBENCH.md`

### 007. Local Demo Login Displayed In Workbench

Commit: `1ff7112`

Updated the Workbench to read and display the actual local demo OpenEMR login from `legacy-openemr/.env`.

Key outcomes:

- Confirmed the local demo username/password are `admin` / `pass`.
- Added a Managed Application panel credential strip so the operator does not rely on browser autofill.
- Documented that the Workbench credential display is local-only and sourced from the ignored environment file.

Primary files:

- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/MODERNIZATION_WORKBENCH.md`

### 008. Test Data Strategy Created

Commit: `c3cd8dd`

Researched OpenEMR seed/demo-data options and documented the project seed-data direction.

Key outcomes:

- Confirmed the installed local baseline initially had no patient or workflow data.
- Identified upstream starter sample files and demo-data tooling as useful but insufficient for the modernization parity baseline.
- Decided that the project needs deterministic, non-PHI, source-controlled synthetic seed data.
- Added a starter legacy seed using OpenEMR bundled example patient/provider SQL.
- Established that the shared seed-data contract should become part of the modernization test contract.

Primary files:

- `documents/TEST_DATA_STRATEGY.md`
- `legacy-openemr/scripts/Seed-LegacyExampleData.ps1`

### 009. Shared Seed Dataset Contract Moved Into Workbench

Commit: `252ec4e`

Moved ownership of the shared synthetic seed-data contract into the Modernization Workbench.

Key outcomes:

- Added `modernization-workbench/seed-data/manifest.json`.
- Added the `openemr-shared-synthetic-v1` dataset folder.
- Defined the intended 1,000-patient dataset shape and target record counts.
- Added Workbench visibility for seed-data status.
- Added Workbench seed orchestration for the starter legacy seed.
- Established that future legacy and modernized database adapters should consume the same canonical dataset.

Primary files:

- `modernization-workbench/seed-data/manifest.json`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/README.md`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/personas/golden-patients.json`
- `modernization-workbench/config/apps.json`
- `documents/TEST_DATA_STRATEGY.md`

### 010. Gold Synthetic Dataset Implemented And Verified

Commit: `ae4f0f8`

Built the project gold test dataset and verified it against the legacy OpenEMR MariaDB baseline.

Key outcomes:

- Added a deterministic generator for `openemr-shared-synthetic-v1`.
- Generated and source-controlled the canonical gold dataset.
- Generated and source-controlled the legacy MariaDB SQL seed adapter.
- Added `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`.
- Added Workbench orchestration for `Gold test dataset v1`.
- Updated Workbench progress, data profile, architecture, and seed-status reporting.
- Verified the standalone seed script.
- Verified the Workbench seed API action.
- Verified the Workbench smoke-test API action after reseeding.
- Verified the Workbench dashboard through a Playwright snapshot.
- Verified the Workbench production build.

Verified gold dataset counts:

- Patients: 1,000
- Providers and staff: 20
- Facilities: 3
- Insurance records: 1,400
- Appointments: 2,800
- Encounters: 2,100
- Vitals: 2,100
- Clinical notes: 2,100
- Problems: 1,500
- Allergies: 900
- Medication list entries: 2,200
- Prescriptions: 2,200
- Lab orders: 700
- Lab reports: 700
- Lab results: 2,400
- Messages: 1,200
- Billing line items: 3,000
- Portal-enabled patients: 200

Primary files:

- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/scripts/generate-gold-dataset.mjs`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/canonical/gold-dataset.json`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/summary.json`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/legacy-mariadb/seed-gold.sql`
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`
- `modernization-workbench/config/apps.json`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/MODERNIZATION_WORKBENCH.md`

### 011. Project Changelog Rendered In The Workbench

Commit: `537d2e5`

Added a Workbench-facing changelog experience so the project build history is visible as a designed timeline instead of only as a markdown document.

Key outcomes:

- Added a local Workbench API endpoint that parses `documents/PROJECT_CHANGELOG.md` into structured timeline data.
- Added typed frontend API access for the changelog.
- Added a Project Build Timeline panel to the Workbench dashboard.
- Rendered each changelog step with its date, step number, title, commit reference, summary, key outcomes, evidence files, and selected metrics.
- Kept `documents/PROJECT_CHANGELOG.md` as the source of truth so documentation and the Workbench stay synchronized.

Primary files:

- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/api.ts`
- `modernization-workbench/src/types.ts`
- `modernization-workbench/src/App.tsx`
- `modernization-workbench/src/styles.css`
- `documents/PROJECT_CHANGELOG.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `modernization-workbench/README.md`

### 012. Workbench Navigation Shell And Dedicated Pages

Commit: `bf3cba1`

Converted the Workbench from a single stacked dashboard into a richer multi-page application shell.

Key outcomes:

- Added a left-side navigation system with stacked menu items.
- Added hash-backed page routing without introducing a heavier routing dependency.
- Kept the navigation model ready for future second-level child items.
- Moved the Project Build Timeline off the dashboard and onto its own Project Timeline page.
- Added dedicated pages for Applications, Progress, Architecture, Test Runs, and Seed Data.
- Kept the Dashboard focused on current operating status while preserving access to application controls and recent action history.
- Added responsive behavior so the navigation remains usable on narrower viewports.

Primary files:

- `modernization-workbench/src/App.tsx`
- `modernization-workbench/src/styles.css`
- `documents/MODERNIZATION_WORKBENCH.md`
- `modernization-workbench/README.md`
- `documents/PROJECT_CHANGELOG.md`

### 013. Gold Dataset 2026 Temporal Coverage Enhanced

Commit: `d0f907c`

Reviewed the live legacy MariaDB seed coverage for 2026 and enhanced the gold dataset so it exercises current-year and future-year workflows more completely.

Key outcomes:

- Moved prescriptions and medication list entries into 2026.
- Added 1,175 future-starting prescriptions and medication list entries after 2026-06-18.
- Extended future appointments through 2026-12-31 while preserving the 2,800 appointment count.
- Increased lab/procedure orders from 700 to 1,000 by adding 300 future scheduled procedure orders.
- Preserved 700 completed procedure orders with 700 reports and 2,400 completed result rows.
- Added generated `temporalCoverage` metadata to the canonical dataset and summary.
- Extended the legacy gold seed script so it verifies `temporalCoverage` as well as row counts.
- Re-applied the enhanced seed to the legacy MariaDB baseline and verified the live temporal counts.

Verified temporal coverage:

- Appointments: 2,800 in 2026; 1,261 future; latest 2026-12-31.
- Prescriptions: 2,200 in 2026; 1,175 future; date range 2026-01-01 to 2026-12-31.
- Medication list entries: 2,200 in 2026; 1,175 future; date range 2026-01-01 to 2026-12-31.
- Procedure orders: 1,000 in 2026; 300 future scheduled; latest 2026-12-31.
- Procedure results: 2,400 completed results in 2026.

Primary files:

- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/scripts/generate-gold-dataset.mjs`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/canonical/gold-dataset.json`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/summary.json`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/legacy-mariadb/seed-gold.sql`
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`
- `modernization-workbench/seed-data/manifest.json`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`

### 014. Legacy Parity Test Harness And Workbench Test Manager

Commits: `db912b1`, `6423108`

Implemented the reusable parity test architecture and a complete first legacy test solution for the current baseline.

Key outcomes:

- Added `parity-tests/` as a TypeScript and Playwright Test project.
- Added target configuration for implemented `legacy-openemr` and planned `modernized-openemr`.
- Added a manifest-driven runner with suite selection, reset modes, headed mode, grep filtering, durable run folders, latest summaries, JSON reports, JUnit reports, HTML reports, traces, screenshots, and videos.
- Added legacy database contract tests for gold seed counts, temporal coverage, stable patient anchors, and workflow-related data.
- Added HTTP functional tests for health, login form, and login-to-application-shell behavior.
- Added Playwright UI tests for legacy login and gold-patient chart navigation.
- Added `scripts/Run-OpenEmrParityTests.ps1` as the Workbench-friendly command entry point.
- Extended the Modernization Workbench app manifest and Test Runs page with selectable smoke, database, HTTP, UI, and full-suite test actions.
- Updated Workbench progress and architecture metadata to reflect implemented parity and Playwright coverage.
- Documented the test architecture, reset strategy, artifacts, and future modernized target extension path.
- Documented the legacy-native PHPUnit lane as optional pending host or container PHPUnit dependencies.

Verified test runs:

- `npm run typecheck` in `parity-tests/`.
- `npm run test:legacy:database -- --reset none`.
- `npm run test:legacy:http -- --reset none`.
- `npm run test:legacy:ui -- --reset none`.
- `npm run test:legacy -- --reset run`.
- `powershell -ExecutionPolicy Bypass -File .\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Suite database -Reset none`.
- `npm run build` in `modernization-workbench/`.

Primary files:

- `parity-tests/`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `modernization-workbench/src/types.ts`
- `modernization-workbench/src/styles.css`
- `documents/TEST_ARCHITECTURE.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`

### 015. Legacy Workflow Mutation Parity Suite

Commit: `2b8fc4c`

Expanded the legacy parity test solution beyond read-only checks by adding deterministic workflow mutation coverage with pre/post probes, cleanup, and Workbench orchestration.

Key outcomes:

- Added a legacy workflow action adapter that performs controlled CRUD-style mutations against the OpenEMR MariaDB schema.
- Added a workflow mutation test suite for patient demographics contact updates, future appointments, clinical allergy list entries, patient messages, and prescriptions.
- Added browser-visible evidence to the demographics workflow by verifying the changed patient contact value in the legacy chart.
- Added workflow suite registration to the parity manifest, npm scripts, root PowerShell runner, and Workbench Test Runs page.
- Configured the Workbench workflow command to use per-test gold-data resets for strong mutation isolation.
- Kept the workflow tests cleanup-aware so they can also run inside the full parity suite with a single run reset.
- Updated Workbench architecture/progress metadata and project documentation to include the workflow mutation lane.

Verified test runs:

- `npm run typecheck` in `parity-tests/`.
- `npm run test:legacy:workflow -- --reset none`.
- `powershell -ExecutionPolicy Bypass -File .\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Suite workflow -Reset test`.
- `npm run test:legacy -- --reset run` with 14 passing tests.
- `npm run build` in `modernization-workbench/`.
- `git diff --check`.

Primary files:

- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/tests/workflow/legacy-workflow-mutations.spec.ts`
- `parity-tests/test-manifest.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `documents/TEST_ARCHITECTURE.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`

### 016. Parity Test Run Plans And Comparison Tooling

Commit: `c297d10`

Added the test-management layer needed to run curated parity plans and compare run evidence when the future modernized target exists.

Key outcomes:

- Added manifest-defined run plans for legacy readiness, isolated workflow mutations, and the full target-neutral parity contract.
- Extended the parity runner with `--plan` and `--list` so operators can run named plans or inspect suites, plans, reset modes, and targets.
- Added plan metadata to run summaries, including selection kind, selection id, selected suites, and plan name.
- Added `parity-tests/src/cli/compare-runs.ts` to compare two run summaries and write durable comparison artifacts.
- Added npm scripts for plan runs, manifest listing, and comparisons.
- Extended `scripts/Run-OpenEmrParityTests.ps1` with `-Plan`.
- Added Workbench Test Runs cards for the legacy readiness plan, isolated mutation plan, and full parity plan.
- Updated Workbench test evidence display so plan runs show the plan name and selected suites.

Verified test runs:

- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- `npm run list` in `parity-tests/`.
- `powershell -ExecutionPolicy Bypass -File .\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan full-parity -Reset run` with 14 passing tests.
- `npm run compare -- --left artifacts/latest-legacy-openemr-plan-full-parity.json --right artifacts/latest-legacy-openemr-plan-full-parity.json --left-target legacy-openemr --right-target legacy-openemr --plan full-parity`.
- `git diff --check`.

Primary files:

- `parity-tests/test-manifest.json`
- `parity-tests/src/cli/run-tests.ts`
- `parity-tests/src/cli/compare-runs.ts`
- `parity-tests/src/core/results.ts`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/src/App.tsx`
- `documents/TEST_ARCHITECTURE.md`
- `documents/MODERNIZATION_WORKBENCH.md`

### 017. Expanded Legacy Workflow Mutation Coverage

Commit: `0a62a65`

Broadened the legacy workflow mutation suite so it covers additional high-value OpenEMR clinical and revenue workflows.

Key outcomes:

- Added normalized patient workflow counts for vitals and SOAP clinical notes.
- Extended the legacy workflow adapter with encounter, vitals, SOAP note, billing line, procedure order, procedure report, and procedure result operations.
- Added an encounter lifecycle test that creates an encounter, links vitals and SOAP details through the legacy `forms` table, updates the encounter reason, and cleans up.
- Added a billing lifecycle test that creates an encounter-scoped CPT line, marks it billed/inactive, and verifies cleanup.
- Added a lab procedure lifecycle test that creates an encounter-scoped order, completes it, adds a report and result, and verifies cascade cleanup.
- Updated Workbench and project documentation so the workflow mutation lane reflects demographics, scheduling, encounters, clinical lists, messages, prescriptions, billing, and labs.

Verified test runs:

- `npm run typecheck` in `parity-tests/`.
- `npm run test:legacy:workflow -- --reset none` with 8 passing workflow tests.
- `powershell -ExecutionPolicy Bypass -File .\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Suite workflow -Reset test` with 8 passing workflow tests.
- `powershell -ExecutionPolicy Bypass -File .\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan full-parity -Reset run` with 17 passing tests.
- `npm run compare -- --left artifacts/latest-legacy-openemr-plan-full-parity.json --right artifacts/latest-legacy-openemr-plan-full-parity.json --left-target legacy-openemr --right-target legacy-openemr --plan full-parity`.
- `npm run build` in `modernization-workbench/`.
- `git diff --check`.

Primary files:

- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/tests/workflow/legacy-workflow-mutations.spec.ts`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `documents/TEST_ARCHITECTURE.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`

### 018. Expanded Legacy Playwright UI Coverage

Commit: `7aeca6a`

Expanded the legacy browser-level parity suite beyond login and patient chart rendering into clinical, scheduling, billing, and lab-result screens.

Key outcomes:

- Added normalized UI anchor probes for future appointments, latest encounters, encounter billing lines, and procedure orders.
- Added frame-aware Playwright text collection for OpenEMR's frame-based encounter UI.
- Added browser checks for seeded encounter SOAP and vitals detail rendering.
- Added browser checks for the legacy scheduler appointment edit screen using actual form values for title, patient, date, time, and status.
- Added browser checks for encounter fee sheet billing codes and descriptions.
- Added browser checks for procedure result rendering for a gold lab patient.
- Updated Workbench metadata, the parity manifest, and documentation to reflect the richer UI contract.

Verified test runs:

- `npm run typecheck` in `parity-tests/`.
- `npm run test:legacy:ui -- --reset none` with 6 passing UI tests.
- `powershell -ExecutionPolicy Bypass -File .\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan full-parity -Reset run` with 21 passing tests.
- `npm run compare -- --left artifacts/latest-legacy-openemr-plan-full-parity.json --right artifacts/latest-legacy-openemr-plan-full-parity.json --left-target legacy-openemr --right-target legacy-openemr --plan full-parity`.
- `npm run build` in `modernization-workbench/`.
- `git diff --check`.

Primary files:

- `parity-tests/tests/ui/legacy-login-and-chart.spec.ts`
- `parity-tests/src/ui/legacyOpenEmr.ts`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/test-manifest.json`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `documents/TEST_ARCHITECTURE.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`

### 019. Legacy Native PHPUnit Test Lane

Commit: `07b4d31`

Added a Workbench-managed OpenEMR-native test lane so the legacy PHP application now has upstream implementation-confidence tests alongside the reusable modernization parity suite.

Key outcomes:

- Added `legacy-openemr/scripts/Test-LegacyNative.ps1` to run OpenEMR's upstream `phpunit-isolated.xml` suite inside the pinned OpenEMR Docker image.
- Implemented a stable native mode that excludes upstream `twig` and `large` groups because the complete upstream suite currently has Windows bind-mount-sensitive CRLF fixture and built-in-server routing failures.
- Added optional `-Mode full` for diagnostic complete-suite runs and `-InstallDependencies` to restore ignored Composer dependencies through Docker.
- Wrote native test evidence to `legacy-openemr/artifacts/latest-native-test.json` plus a companion log file.
- Added a Workbench Test Runs card for the native PHPUnit suite and typed frontend rendering for native test stats.
- Marked the native lane as long-running in the Workbench API so the command has enough time to complete.
- Updated baseline, test architecture, Workbench, README, and document index guidance to include the native lane and remaining native gaps.

Verified test runs:

- `powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyNative.ps1` from `legacy-openemr/` with 2,344 tests, 6,188 assertions, exit code 0.
- `npm run build` in `modernization-workbench/`.
- `git diff --check`.
- `git -C legacy-openemr/source status --short` returned clean after the dependency and test attempts.

Primary files:

- `legacy-openemr/scripts/Test-LegacyNative.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `modernization-workbench/src/types.ts`
- `documents/TEST_ARCHITECTURE.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`

### 020. Legacy Native Jest Test Lane

Commit: `a2e22a5`

Added a Workbench-managed native JavaScript test lane so OpenEMR's upstream Jest tests are part of the local legacy test solution.

Key outcomes:

- Added `legacy-openemr/scripts/Test-LegacyNativeJs.ps1` to run OpenEMR's upstream `npm run test:js` suite.
- Added on-demand dependency restore through `npm ci --ignore-scripts` so the lane can recover missing ignored `node_modules` without running OpenEMR's heavier asset postinstall.
- Wrote a compact Workbench summary to `legacy-openemr/artifacts/latest-native-jest-test.json`.
- Wrote the full Jest JSON report to `legacy-openemr/artifacts/latest-native-jest-report.json` and a companion log file for detailed evidence.
- Added a Workbench Test Runs card for the native Jest suite.
- Added typed frontend rendering for Jest suite/test counts, Node/npm versions, and result report paths.
- Updated architecture/progress metadata and project docs to include the native JavaScript lane.

Verified test runs:

- `powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyNativeJs.ps1 -InstallDependencies` from `legacy-openemr/` with 12 suites and 105 tests passing.
- `npm run build` in `modernization-workbench/`.
- `git diff --check`.
- `git -C legacy-openemr/source status --short` returned clean after the Node dependency and Jest runs.

Primary files:

- `legacy-openemr/scripts/Test-LegacyNativeJs.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/src/App.tsx`
- `modernization-workbench/src/types.ts`
- `documents/TEST_ARCHITECTURE.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`

### 021. Workbench Custom Parity Run Builder

Commit: `7c1c424`

Added a manifest-backed custom parity run builder to the Workbench Test Runs page so operators can choose what to include in a parity run and which database reset strategy to use.

Key outcomes:

- Added a Workbench API endpoint that exposes `parity-tests/test-manifest.json`.
- Added a validated custom parity run endpoint for suite or plan selection.
- Allowed operator-selected reset modes: `none`, `run`, `suite`, and `test`.
- Added optional headed browser mode and Playwright grep filtering.
- Kept execution constrained to the existing `scripts/Run-OpenEmrParityTests.ps1` runner after validating suite, plan, reset, headed, and grep inputs.
- Added a Test Runs page run-builder form that reads the manifest and triggers the custom run endpoint.
- Preserved existing fixed test cards while adding targeted run management for ad hoc suites, plans, and reset-strategy experiments.

Verified test runs:

- `npm run build` in `modernization-workbench/`.
- `git diff --check`.
- Temporary Workbench API runtime check of `/api/parity-manifest`.
- Temporary Workbench API custom run of the `http` suite with `reset=none`, producing 3 passing checks in `parity-tests/artifacts/latest-legacy-openemr-http.json`.

Primary files:

- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `modernization-workbench/src/api.ts`
- `modernization-workbench/src/types.ts`
- `modernization-workbench/src/styles.css`
- `documents/TEST_ARCHITECTURE.md`
- `documents/MODERNIZATION_WORKBENCH.md`

### 022. Modernized OpenEMR Slice 1 Bootstrap

Commit: `6586a4a`

Created the first from-scratch modernized OpenEMR target and implemented the read-only patient search/chart summary vertical slice against the shared gold dataset.

Key outcomes:

- Added `modernized-openemr/` as a separate solution with an ASP.NET Core 10 API, React/TypeScript frontend, PostgreSQL database, and Docker Compose runtime.
- Implemented PostgreSQL seed generation from `openemr-shared-synthetic-v1`, preserving canonical IDs such as `MOD-PAT-0001` and legacy correlation IDs such as `pid` and `pubpid`.
- Added patient search and chart-summary API endpoints with activity counts, care team, next appointment, and latest encounter data.
- Replaced the Vite starter screen with an OpenEMR-like patient workspace using left-side module navigation, patient finder, demographics/contact panels, and clinical activity summaries.
- Added modernized seed and smoke scripts that the Workbench can run as allowlisted managed-app actions.
- Registered `modernized-openemr` in the Workbench as a second managed application with Docker lifecycle actions, health checks, seed action, smoke test, logs, and PostgreSQL data profile.
- Updated architecture/progress metadata and project documents so the target is now in progress rather than planned.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`, loading 1,000 patients, 2,800 appointments, 2,100 encounters, 2,200 prescriptions, 3,000 billing rows, 1,000 lab orders, 1,200 messages, 1,500 problems, 900 allergies, and 2,200 medications.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, passing API health, `MOD-PAT-0001` patient search, and chart summary checks.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`, with frontend `http://localhost:3000` returning HTTP 200 and API smoke passing against the containerized API.

Primary files:

- `modernized-openemr/OpenEmr.Modernized.slnx`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/PatientRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/PatientDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `modernized-openemr/docker-compose.yml`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`

### 023. Slice 1 Side-By-Side Parity

Commit: `be5f634`

Promoted the first modernized patient search/chart summary slice from smoke-only validation into the reusable parity harness with matched legacy-vs-modernized comparison evidence.

Key outcomes:

- Marked `modernized-openemr` as an implemented parity target in `parity-tests/config/targets.json` with API, UI, PostgreSQL, reset, and smoke command metadata.
- Added a PostgreSQL parity probe for the modernized target with normalized gold-count, temporal-coverage, anchor-patient, and patient-workflow-count methods matching the legacy MariaDB probe contract.
- Expanded the modernized PostgreSQL seed adapter to load the full read-only gold contract, including insurance records, vitals, clinical notes, lab reports, and lab results.
- Converted the gold database contract to use a target-neutral database fixture.
- Added a dedicated `slice1` parity suite for patient search/chart summary behavior with the same test inventory on legacy and modernized targets.
- Added a `slice-1-readiness` named plan that runs the database contract plus the slice-1 patient chart suite against both targets.
- Kept mutation workflow parity legacy-only until modernized CRUD slices exist.
- Added modernized parity npm scripts and Workbench-managed slice-1 parity test actions for both legacy and modernized applications.
- Updated the Workbench Test Runs page so it renders test cards and custom parity run builders for every managed application, not only the legacy baseline.

Verified test runs:

- `npm run typecheck` in `parity-tests/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`, loading the expanded PostgreSQL read-only gold schema.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Suite database -Reset none`, passing 4 database contract tests.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Suite http -Reset none`, passing 3 HTTP checks with 2 legacy-only skips.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Suite ui -Reset none`, passing the modernized chart UI check with legacy-only checks skipped.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-1-readiness -Reset run`, passing 7 expected tests with 0 skips.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-1-readiness -Reset run`, passing 7 expected tests with 0 skips.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-1-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- `npm run build` in `modernization-workbench/`.

Primary files:

- `parity-tests/config/targets.json`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/src/fixtures/parityTest.ts`
- `parity-tests/src/config/targets.ts`
- `parity-tests/tests/database/gold-seed-contract.spec.ts`
- `parity-tests/tests/http/legacy-http.spec.ts`
- `parity-tests/tests/ui/legacy-login-and-chart.spec.ts`
- `parity-tests/tests/slice1/patient-search-chart-summary.spec.ts`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`

### 024. Modernized Scheduling Slice 2

Commit: `8b2bc6f`

Implemented the second modernized OpenEMR vertical slice: read-only scheduling with a Calendar module, appointment list/detail API, Workbench orchestration, and matched side-by-side parity against the legacy scheduler.

Key outcomes:

- Added ASP.NET Core appointment DTOs, repository queries, and `/api/appointments` list/detail endpoints over the modernized PostgreSQL seed tables.
- Added a real Calendar module to the modernized React shell with appointment patient/date filters, future appointment results, and an appointment detail workspace.
- Expanded the modernized smoke script to validate anchor appointment search and detail retrieval for `MOD-PAT-0003`.
- Added a target-neutral scheduling parity suite that verifies the same future appointment fact and browser-visible appointment detail behavior against legacy and modernized targets.
- Added the `slice-2-scheduling-readiness` named plan, npm scripts, Workbench test cards, and Workbench progress/architecture metadata.
- Fixed the normalized parity appointment contract so legacy numeric appointment IDs and modernized textual appointment IDs are both supported.
- Updated modernization, workbench, test architecture, seed-data, and document-index guidance so the documented state reflects the implemented scheduling slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `npm run typecheck` in `parity-tests/`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, passing API health, anchor patient search, anchor chart summary, anchor appointment search, and anchor appointment detail checks.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-2-scheduling-readiness -Reset run`, passing 2 expected tests with 0 skips.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-2-scheduling-readiness -Reset run`, passing 2 expected tests with 0 skips.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-2-scheduling-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- `git diff --check`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/AppointmentRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/AppointmentDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/scheduling/appointment-summary.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/src/ui/legacyOpenEmr.ts`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/INDEX.md`

### 025. Modernized Encounters Slice 3

Commit: `c74dc8f`

Implemented the third modernized OpenEMR vertical slice: read-only encounters with SOAP and vitals detail, Workbench orchestration, and matched side-by-side parity against the legacy encounter UI.

Key outcomes:

- Added ASP.NET Core encounter DTOs, repository queries, and `/api/encounters` list/detail endpoints over the modernized PostgreSQL encounter, vitals, clinical-note, and billing tables.
- Added a real Encounters module to the modernized React shell with encounter patient/date filters, encounter results, visit metadata, vitals, and SOAP note detail panels.
- Expanded the modernized smoke script to validate anchor encounter search and detail retrieval for `MOD-PAT-0001`.
- Added normalized encounter clinical-detail probes for both legacy MariaDB and modernized PostgreSQL, hiding OpenEMR's legacy `forms` table linkage behind the parity fixture.
- Added a target-neutral encounter parity suite that verifies the same SOAP/vitals facts and browser-visible encounter detail behavior against legacy and modernized targets.
- Added the `slice-3-encounters-readiness` named plan, npm scripts, Workbench test cards, and Workbench progress/architecture metadata.
- Updated modernization, workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the implemented encounter slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `npm run typecheck` in `parity-tests/`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, passing API health, anchor patient search, anchor chart summary, anchor appointment search/detail, and anchor encounter search/detail checks.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-3-encounters-readiness -Reset run`, passing 2 expected tests with 0 skips.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-3-encounters-readiness -Reset run`, passing 2 expected tests with 0 skips.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-3-encounters-readiness` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/EncounterRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/EncounterDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/encounters/encounter-clinical-detail.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/tests/ui/legacy-login-and-chart.spec.ts`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 049. Modernized Patient Document Content Slice 27

Commit: current slice commit

Implemented the twenty-seventh modernized OpenEMR vertical slice: patient document content retrieval, centered on retrieving, viewing, and downloading the full seeded text payload for database-backed patient documents.

Key outcomes:

- Added modernized ASP.NET Core document content and download endpoints at `/api/documents/{documentId}/content` and `/api/documents/{documentId}/download`.
- Added a React Documents `Document Viewer` panel plus View and Download controls on document cards.
- Added TypeScript API client support for document content retrieval and deterministic download URLs.
- Added normalized full-content document probes for legacy MariaDB and modernized PostgreSQL, including newline-safe handling for multi-line seeded text payloads.
- Added the `document-content` parity suite and `slice-27-document-content-readiness` named plan for both legacy and modernized targets.
- Added Workbench command cards, result paths, and custom-run default plan support for the Slice 27 document content plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects patient document content retrieval behavior.

Verified test runs:

- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `npm run typecheck` in `parity-tests/`.
- `dotnet build .\OpenEmr.Modernized.slnx` in `modernized-openemr/`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `docker compose build api frontend` and `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, including `anchor patient document content`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-27-document-content-readiness -Reset run`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-27-document-content-readiness -Reset run`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-27-document-content-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- Sequential regression checks: `slice-25-documents-readiness` and `slice-26-document-mutation-readiness` against `modernized-openemr`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/DocumentRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/DocumentDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/tests/document-content/patient-document-content.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 026. Modernized Clinical Lists Slice 4

Commit: `0fb425f`

Implemented the fourth modernized OpenEMR vertical slice: read-only clinical lists with problems, allergies, medication list entries, prescriptions, Workbench orchestration, and matched side-by-side parity against the legacy patient-summary clinical-list UI.

Key outcomes:

- Added ASP.NET Core clinical-list DTOs, repository queries, and `/api/clinical-lists/{patientId}` endpoint over the modernized PostgreSQL problems, allergies, medications, and prescriptions tables.
- Added a real Lists module to the modernized React shell with patient lookup and separate panels for problems, allergies, medications, and prescriptions.
- Expanded the modernized smoke script to validate anchor clinical-list facts for `MOD-PAT-0001`.
- Added normalized clinical-list probes for both legacy MariaDB and modernized PostgreSQL.
- Added a target-neutral clinical-lists parity suite that verifies the same problem, allergy, medication-list, and prescription facts plus browser-visible clinical-list behavior against legacy and modernized targets.
- Added the `slice-4-clinical-lists-readiness` named plan, npm scripts, Workbench test cards, and Workbench progress/architecture metadata.
- Updated modernization, workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the implemented clinical-lists slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `npm run typecheck` in `parity-tests/`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, passing API health, anchor patient search, anchor chart summary, anchor appointment search/detail, anchor encounter search/detail, and anchor clinical-list checks.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-4-clinical-lists-readiness -Reset run`, passing 2 expected tests with 0 skips.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-4-clinical-lists-readiness -Reset run`, passing 2 expected tests with 0 skips.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-4-clinical-lists-readiness` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/ClinicalListRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/ClinicalListDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/clinical-lists/clinical-lists-and-medications.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 027. Modernized Messaging Slice 5

Commit: `bbc082c`

Implemented the fifth modernized OpenEMR vertical slice: read-only patient messages and portal-facing status with a Messages module, patient-message API, Workbench orchestration, and matched side-by-side parity against the legacy patient-notes screen.

Key outcomes:

- Added ASP.NET Core message DTOs, repository queries, and `/api/messages/{patientId}` endpoint over the modernized PostgreSQL patients and messages tables.
- Added a real Messages module to the modernized React shell with patient lookup, portal-enabled status, message status counts, and message detail cards.
- Expanded the modernized smoke script to validate portal-enabled patient-message facts for `MOD-PAT-0004`.
- Added normalized patient-message probes for both legacy MariaDB and modernized PostgreSQL.
- Added a target-neutral messaging parity suite that verifies the same portal flag, message title, message body, and message status facts plus browser-visible patient-message behavior against legacy and modernized targets.
- Added the `slice-5-messaging-readiness` named plan, npm scripts, Workbench test cards, and Workbench progress/architecture metadata.
- Added a legacy UI helper for the actual OpenEMR patient-notes screen at `pnotes_full.php`, after confirming the demographics dashboard does not render the complete message set.
- Updated modernization, workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the implemented messaging slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `npm run typecheck` in `parity-tests/`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, passing API health, anchor patient search, anchor chart summary, anchor appointment search/detail, anchor encounter search/detail, anchor clinical-list checks, and anchor patient-message checks.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-5-messaging-readiness -Reset run`, passing 2 expected tests with 0 skips.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-5-messaging-readiness -Reset run`, passing 2 expected tests with 0 skips.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-5-messaging-readiness` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/MessageRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/MessageDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/messages/patient-messages.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/src/ui/legacyOpenEmr.ts`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 028. Modernized Procedures Slice 6

Commit: `630a041`

Implemented the sixth modernized OpenEMR vertical slice: read-only completed procedure/lab results with a Procedures module, procedure-results API, Workbench orchestration, and matched side-by-side parity against the legacy procedure results screen.

Key outcomes:

- Added ASP.NET Core procedure DTOs, repository queries, and `/api/procedures/{patientId}` endpoint over the modernized PostgreSQL lab order, lab report, and lab result tables.
- Added a real Procedures module to the modernized React shell with patient lookup, order/report/result counts, order summary cards, and final result detail cards.
- Expanded the modernized smoke script to validate completed CBC procedure-result facts for `MOD-PAT-0009`.
- Added normalized procedure-result probes for both legacy MariaDB and modernized PostgreSQL, including orders, reports, result rows, values, units, ranges, abnormal flags, and statuses.
- Added a target-neutral procedures parity suite that verifies the same completed lab order, report, result facts, and browser-visible procedure-result behavior against legacy and modernized targets.
- Added the `slice-6-procedures-readiness` named plan, npm scripts, Workbench test cards, custom-run defaults, data-profile counts, and Workbench progress/architecture metadata.
- Updated the legacy UI text helper to include visible form field values across OpenEMR frames, because procedure result names and values render inside editable inputs in the legacy UI.
- Updated modernization, workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the implemented procedures slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `npm run typecheck` in `parity-tests/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, passing API health, anchor patient search, anchor chart summary, anchor appointment search/detail, anchor encounter search/detail, anchor clinical-list checks, anchor patient-message checks, and anchor procedure-result checks.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-6-procedures-readiness -Reset run`, passing 2 expected tests with 0 skips.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-6-procedures-readiness -Reset run`, passing 2 expected tests with 0 skips.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-6-procedures-readiness` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/ProcedureRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/ProcedureDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/procedures/procedure-results.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/src/ui/legacyOpenEmr.ts`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 029. Modernized Billing Slice 7

Commit: `3ff837f`

Implemented the seventh modernized OpenEMR vertical slice: read-only fee-sheet billing with a Fees module, billing API, Workbench orchestration, and matched side-by-side parity against the legacy OpenEMR fee sheet.

Key outcomes:

- Added ASP.NET Core billing DTOs, repository queries, and `/api/billing/{patientId}` endpoint over the modernized PostgreSQL patient, encounter, staff, facility, and billing tables.
- Added a real Fees module to the modernized React shell with patient lookup, billing encounter list, selected fee-sheet code display, CPT descriptions, diagnosis justification, line fees, and encounter totals.
- Expanded the modernized smoke script to validate the stable `MOD-PAT-0001` billing anchor, encounter `1000013`, `99214` established patient office visit, and `36415` routine venipuncture lines.
- Expanded normalized billing probes for both legacy MariaDB and modernized PostgreSQL so billing parity tests can assert code type, CPT code, description, fee, and diagnosis justification.
- Added a target-neutral billing parity suite that verifies the same seeded CPT fee-sheet facts and browser-visible fee-sheet behavior against legacy and modernized targets.
- Added the `slice-7-billing-readiness` named plan, npm scripts, Workbench test cards, custom-run defaults, smoke-test metadata, and Workbench progress/architecture metadata.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the implemented billing slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `npm run typecheck` in `parity-tests/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `git diff --check`.
- Mojibake scan over source, docs, Workbench, and parity-test paths.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, passing API health, anchor patient search, anchor chart summary, anchor appointment checks, anchor encounter checks, anchor clinical-list checks, anchor patient-message checks, anchor procedure-result checks, and anchor fee-sheet billing checks.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-7-billing-readiness -Reset run`, passing 2 expected tests with 0 skips.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-7-billing-readiness -Reset run`, passing 2 expected tests with 0 skips.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-7-billing-readiness` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/BillingRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/BillingDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/billing/fee-sheet-billing.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 030. Modernized Administration Directory Slice 8

Commit: `6553d55`

Implemented the eighth modernized OpenEMR vertical slice: read-only administration directory behavior with an Admin module, administration API, Workbench orchestration, and matched side-by-side parity against the legacy OpenEMR Users and Facilities screens.

Key outcomes:

- Added ASP.NET Core administration DTOs, repository queries, and `/api/administration/directory` endpoint over the modernized PostgreSQL staff and facility tables.
- Added a real Admin module to the modernized React shell with user/facility directory cards, role mix metrics, calendar-user counts, and a visible access-control status summary.
- Kept the slice honest by labeling authentication, authorization, and audit logging as deferred/planned rather than treating the read-only directory as full security modernization.
- Expanded the modernized smoke script to validate the stable seeded admin anchors: 20 users, 12 providers, 12 calendar-enabled users, 3 facilities, `gold-provider-02`, `gold-billing-01`, and MAIN/NORTH facilities.
- Added normalized administration probes for both legacy MariaDB and modernized PostgreSQL, including username, role, authorized flag, active flag, calendar flag, facility assignment, and facility address data.
- Added a target-neutral administration parity suite that verifies the same seeded users, roles, facilities, and browser-visible Users/Facilities behavior against legacy and modernized targets.
- Added the `slice-8-admin-readiness` named plan, npm scripts, Workbench test cards, custom-run defaults, smoke-test metadata, and Workbench progress/architecture metadata.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the implemented administration directory slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `npm run typecheck` in `parity-tests/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `git diff --check`.
- Mojibake scan over source, docs, Workbench, and parity-test paths.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, passing API health, anchor patient search, anchor chart summary, anchor appointment checks, anchor encounter checks, anchor clinical-list checks, anchor patient-message checks, anchor procedure-result checks, anchor fee-sheet billing checks, and anchor administration directory checks.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-8-admin-readiness -Reset run`, passing 2 expected tests with 0 skips.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-8-admin-readiness -Reset run`, passing 2 expected tests with 0 skips.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-8-admin-readiness` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/AdministrationRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/AdministrationDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/admin/administration-directory.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/src/ui/legacyOpenEmr.ts`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 031. Modernized Operational Reports Slice 9

Commit: `6edab8b`

Implemented the ninth modernized OpenEMR vertical slice: read-only operational reporting with a Reports module, reports API, Workbench orchestration, and matched side-by-side parity against legacy OpenEMR report surfaces and normalized report facts.

Key outcomes:

- Added ASP.NET Core report DTOs, repository queries, and `/api/reports/operational` endpoint over the modernized PostgreSQL read model.
- Added a real Reports module to the modernized React shell with gold-data snapshot metrics, provider activity cards, facility activity cards, and clinical condition report cards.
- Kept the slice intentionally read-only and documented exports, saved report definitions, document storage, scanned attachments, and integration adapters as later reports/documents/integrations work.
- Expanded the modernized smoke script to validate the stable seeded report anchors: 1,000 patients, 1,261 future appointments, 1,100 current-year encounters, 3,000 billing lines, `$446,000.00` seeded charges, `gold-provider-02`, NORTH facility, and `Asthma, uncomplicated`.
- Added normalized operational-report probes for both legacy MariaDB and modernized PostgreSQL, including high-level activity counts, provider activity, facility activity, and clinical condition summaries.
- Added a target-neutral reports parity suite that verifies the same operational report facts plus browser-visible report surfaces against legacy and modernized targets.
- Added the `slice-9-reports-readiness` named plan, npm scripts, Workbench test cards, custom-run defaults, smoke-test metadata, and Workbench progress/architecture metadata.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the implemented operational reports slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `git diff --check`.
- Mojibake scan over source, docs, Workbench, and parity-test paths.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `Invoke-RestMethod -Uri 'http://localhost:5001/api/reports/operational' -Method Get -TimeoutSec 20` from `modernized-openemr/`, returning the expected operational report contract.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, passing API health, anchor patient search, anchor chart summary, anchor appointment checks, anchor encounter checks, anchor clinical-list checks, anchor patient-message checks, anchor procedure-result checks, anchor fee-sheet billing checks, anchor administration directory checks, and anchor operational reports checks.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-9-reports-readiness -Reset run`, passing 2 expected tests with 0 skips.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-9-reports-readiness -Reset run`, passing 2 expected tests with 0 skips.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-9-reports-readiness` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/ReportRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/ReportDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/reports/operational-reports.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/src/ui/legacyOpenEmr.ts`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 032. Modernized Patient Contact Mutation Slice 10

Commit: `4638ba8`

Implemented the tenth modernized OpenEMR vertical slice: the first mutation-capable parity workflow, focused on patient contact updates with an inline React chart editor, ASP.NET Core update endpoint, PostgreSQL contact fields, Workbench orchestration, and matched side-by-side parity against the legacy OpenEMR chart.

Key outcomes:

- Expanded the modernized PostgreSQL patient seed mapping with `phone_home`, `phone_cell`, `hipaa_allow_sms`, and `hipaa_allow_email` so contact mutation parity can preserve legacy OpenEMR semantics instead of flattening the data into a single phone field.
- Added the ASP.NET Core `/api/patients/{patientId}/contact` endpoint, `PatientContactUpdateRequest`, and repository update logic that saves home phone, cell phone, email, and HIPAA SMS/email permission flags through the business-tier API.
- Added an inline contact editor to the modernized Patient/Client chart with edit, save, cancel, home phone, cell phone, email, and permission controls.
- Added the first modernized workflow action adapter in `parity-tests/src/workflows/modernizedWorkflowActions.ts`, using PostgreSQL probes for exact pre/post state and the public API for the mutation.
- Added a shared `workflow-contact` parity suite and the `slice-10-contact-mutation-readiness` named plan for both legacy and modernized targets.
- Added Workbench test actions/cards and custom-run defaults for the Slice 10 contact mutation plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the first mutation-capable modernized slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- Direct API update/restore check against `http://localhost:5001/api/patients/MOD-PAT-0001/contact`, returning the expected changed home phone, cell phone, email, and HIPAA permission values.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-10-contact-mutation-readiness -Reset test`, passing 1 expected test with 0 skips.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-10-contact-mutation-readiness -Reset test`, passing 1 expected test with 0 skips.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-10-contact-mutation-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- Direct Playwright check of the modernized contact editor, proving Edit contact, Save, rendered changed values, and restore.
- `git diff --check`.
- Mojibake scan over source, docs, Workbench, and parity-test paths.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/PatientRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/PatientDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-contact/patient-contact-mutation.spec.ts`
- `parity-tests/src/fixtures/parityTest.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 033. Modernized Appointment Mutation Slice 11

Commit: 06db879

Implemented the eleventh modernized OpenEMR vertical slice: the second mutation-capable parity workflow, focused on future appointment create, cancel, render, and delete behavior with React Calendar controls, ASP.NET Core appointment lifecycle endpoints, Workbench orchestration, smoke coverage, and matched side-by-side parity against the legacy OpenEMR scheduler.

Key outcomes:

- Added ASP.NET Core appointment create, status update, and delete endpoints under `/api/appointments`.
- Extended `AppointmentRepository` with appointment lifecycle methods that preserve existing read-only scheduling behavior while adding controlled mutation paths.
- Made optional provider/facility overrides resilient by falling back to the patient's seeded provider/facility when supplied IDs do not exist, avoiding foreign-key 500s for invalid optional overrides.
- Added Calendar UI controls for creating a future appointment, cancelling the selected appointment, and deleting the selected appointment.
- Expanded the modernized smoke script with a safe appointment create/cancel/delete lifecycle check that cleans up its temporary appointment.
- Extended the modernized workflow action adapter with appointment lifecycle methods that mutate through the public API and verify exact post-state through PostgreSQL probes.
- Added a shared `workflow-appointments` parity suite and the `slice-11-appointment-mutation-readiness` named plan for both legacy and modernized targets.
- Added Workbench test actions/cards and custom-run defaults for the Slice 11 appointment mutation plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the appointment mutation slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- Direct API create/cancel/delete check against `http://localhost:5001/api/appointments`, including invalid optional provider/facility fallback to the patient's seeded provider/facility.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, with artifact status `passed`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-11-appointment-mutation-readiness -Reset test`, passing 1 expected test with 0 skips.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-11-appointment-mutation-readiness -Reset test`, passing 1 expected test with 0 skips.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-11-appointment-mutation-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- Direct Playwright check of the modernized Calendar controls, proving Create, Cancel appointment, Delete appointment, and API-confirmed deletion.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/AppointmentRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/AppointmentDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`

- `parity-tests/tests/workflow-appointments/appointment-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 034. Modernized Encounter Mutation Slice 12

Commit: 37accf2

Implemented the twelfth modernized OpenEMR vertical slice: the third mutation-capable parity workflow, focused on encounter create, summary update, vitals recording, SOAP note recording, browser rendering, and cleanup with React Encounters controls, ASP.NET Core encounter lifecycle endpoints, Workbench orchestration, smoke coverage, and matched side-by-side parity against the legacy OpenEMR encounter workflow.

Key outcomes:

- Added ASP.NET Core encounter create, update, delete, vitals create/delete, and SOAP note create/delete endpoints under `/api/encounters`.
- Extended `EncounterRepository` with mutation methods while preserving read-only encounter search/detail behavior and making detail retrieval choose the newest vitals/SOAP rows deterministically.
- Extended the modernized PostgreSQL seed schema with `billing_facility_id`, `billing_note`, and vitals `note` fields so Slice 12 preserves legacy-observed mutation facts instead of dropping them.
- Fixed new modernized encounter ID generation to use the maximum of existing `id` and `encounter` values, preventing collisions where seeded encounter numbers differ from seeded row IDs.
- Added Encounters UI controls for creating an encounter, updating the selected encounter, deleting it, recording vitals, and recording SOAP detail.
- Expanded the modernized smoke script with a safe encounter create/update/vitals/SOAP/delete lifecycle check that cleans up its temporary rows.
- Extended the modernized workflow action adapter with encounter, vitals, and SOAP lifecycle methods that mutate through the public API and verify exact post-state through PostgreSQL probes.
- Added a shared `workflow-encounters` parity suite and the `slice-12-encounter-mutation-readiness` named plan for both legacy and modernized targets.
- Added Workbench test actions/cards and custom-run defaults for the Slice 12 encounter mutation plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the encounter mutation slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, with artifact status `passed`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-12-encounter-mutation-readiness -Reset test`, passing 1 expected test with 0 skips.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-12-encounter-mutation-readiness -Reset test`, passing 1 expected test with 0 skips.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-12-encounter-mutation-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- PostgreSQL cleanup probe confirming zero leftover Slice 12 temporary encounter, vitals, or SOAP rows.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/EncounterRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/EncounterDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-encounters/encounter-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 035. Modernized Clinical List Mutation Slice 13

Commit: 30f314f

Implemented the thirteenth modernized OpenEMR vertical slice: the fourth mutation-capable parity workflow, focused on allergy list create, browser rendering, deactivate, and delete behavior with React Lists controls, ASP.NET Core clinical-list lifecycle endpoints, PostgreSQL allergy activity fields, Workbench orchestration, smoke coverage, and matched side-by-side parity against the legacy OpenEMR clinical-list workflow.

Key outcomes:

- Added ASP.NET Core clinical-list allergy create, deactivate, and delete endpoints under `/api/clinical-lists/allergies`.
- Extended `ClinicalListRepository` with allergy lifecycle methods while preserving read-only clinical-list behavior and filtering active allergies for the visible list contract.
- Extended the modernized PostgreSQL seed schema with allergy `activity`, `end_date`, and `list_option_id` fields so Slice 13 can preserve OpenEMR-style active/inactive list semantics.
- Added React Lists UI controls for creating a new allergy, deactivating active allergy entries, and deleting active allergy entries.
- Expanded the modernized smoke script with a safe allergy create/deactivate/delete lifecycle check that cleans up its temporary row.
- Extended the modernized workflow action adapter with clinical-list lifecycle methods that mutate through the public API and verify exact post-state through PostgreSQL probes.
- Added a shared `workflow-clinical-lists` parity suite and the `slice-13-clinical-list-mutation-readiness` named plan for both legacy and modernized targets.
- Added Workbench test actions/cards and custom-run defaults for the Slice 13 clinical-list mutation plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the clinical-list mutation slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, with artifact status `passed`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-13-clinical-list-mutation-readiness -Reset test`, passing 1 expected test with 0 skips.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-13-clinical-list-mutation-readiness -Reset test`, passing 1 expected test with 0 skips.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-13-clinical-list-mutation-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- PostgreSQL and MariaDB cleanup probes confirming zero leftover Slice 13 temporary allergy rows.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/ClinicalListRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/ClinicalListDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-clinical-lists/clinical-list-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 036. Modernized Patient Message Mutation Slice 14

Commit: dc79a4a

Implemented the fourteenth modernized OpenEMR vertical slice: the fifth mutation-capable parity workflow, focused on patient message create, close/status update, soft-delete/archive, and hard-delete behavior with React Messages controls, ASP.NET Core message lifecycle endpoints, PostgreSQL message activity fields, Workbench orchestration, smoke coverage, and side-by-side parity against the legacy OpenEMR patient-message workflow.

Key outcomes:

- Added ASP.NET Core patient-message create, close/status update, soft-delete, and hard-delete endpoints under `/api/messages`.
- Extended `MessageRepository` with patient-message lifecycle methods while preserving read-only message behavior and filtering active messages for the visible list contract.
- Extended the modernized PostgreSQL seed schema with `assigned_to`, `deleted`, and `activity` message fields so Slice 14 preserves OpenEMR-style assignment and active/deleted message semantics.
- Added React Messages UI controls for creating a new patient message, closing a message with updated detail, archiving an active message, and deleting an active message.
- Expanded the modernized smoke script with a safe patient-message create/close/soft-delete/delete lifecycle check that cleans up its temporary row.
- Extended the modernized workflow action adapter with patient-message lifecycle methods that mutate through the public API and verify exact post-state through PostgreSQL probes.
- Added a shared `workflow-messages` parity suite and the `slice-14-message-mutation-readiness` named plan for both legacy and modernized targets.
- Added Workbench test actions/cards and custom-run defaults for the Slice 14 patient-message mutation plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the patient-message mutation slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, with artifact status `passed`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-14-message-mutation-readiness -Reset test`, passing 1 expected test with 0 skips.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-14-message-mutation-readiness -Reset test`, passing 1 expected test with 0 skips.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-14-message-mutation-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- PostgreSQL and MariaDB cleanup probes confirming zero leftover Slice 14 temporary message rows.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/MessageRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/MessageDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-messages/message-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 037. Modernized Prescription Mutation Slice 15

Commit: ece3f71

Implemented the fifteenth modernized OpenEMR vertical slice: the sixth mutation-capable parity workflow, focused on prescription create, active rendering, deactivate, and hard-delete behavior with React Lists controls, ASP.NET Core prescription lifecycle endpoints, PostgreSQL prescription activity fields, Workbench orchestration, smoke coverage, and side-by-side parity against the legacy OpenEMR prescription workflow.

Key outcomes:

- Added ASP.NET Core prescription create, deactivate, and delete endpoints under `/api/clinical-lists/prescriptions`.
- Extended `ClinicalListRepository` with prescription lifecycle methods while preserving active prescription rendering for the visible list contract.
- Extended the modernized PostgreSQL seed schema with prescription RxNorm code, quantity, refills, note, active state, and end date fields so Slice 15 preserves OpenEMR-style prescription lifecycle semantics.
- Added React Lists UI controls for creating a new prescription, deactivating active prescriptions, and deleting active prescriptions.
- Expanded the modernized smoke script with a safe prescription create/deactivate/delete lifecycle check that cleans up its temporary row.
- Extended the modernized workflow action adapter with prescription lifecycle methods that mutate through the public API and verify exact post-state through PostgreSQL probes.
- Added a shared `workflow-prescriptions` parity suite and the `slice-15-prescription-mutation-readiness` named plan for both legacy and modernized targets.
- Added Workbench test actions/cards and custom-run defaults for the Slice 15 prescription mutation plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the prescription mutation slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, with artifact status `passed`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-15-prescription-mutation-readiness -Reset test`, passing 1 expected test with 0 skips.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-15-prescription-mutation-readiness -Reset test`, passing 1 expected test with 0 skips.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-15-prescription-mutation-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- PostgreSQL and MariaDB cleanup probes confirming zero leftover Slice 15 temporary prescription rows.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/ClinicalListRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/ClinicalListDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-prescriptions/prescription-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 038. Modernized Billing Mutation Slice 16

Commit: 704697e

Implemented the sixteenth modernized OpenEMR vertical slice: the seventh mutation-capable parity workflow, focused on encounter-scoped CPT billing line create, active fee-sheet rendering, billed/inactive status update, and hard-delete behavior with React Fees controls, ASP.NET Core billing lifecycle endpoints, PostgreSQL billing lifecycle fields, Workbench orchestration, smoke coverage, and side-by-side parity against the legacy OpenEMR fee-sheet workflow.

Key outcomes:

- Added ASP.NET Core billing line create, status update, and delete endpoints under `/api/billing/lines`.
- Extended `BillingRepository` with billing line lifecycle methods while preserving active fee-sheet rendering for the visible line contract.
- Extended the modernized PostgreSQL seed schema with billing units, billed state, and activity state so Slice 16 preserves OpenEMR-style fee-sheet lifecycle semantics.
- Added React Fees UI controls for creating a CPT line, marking a line billed/inactive, and deleting active billing lines.
- Expanded the modernized smoke script with a safe billing line create/status/delete lifecycle check that cleans up its temporary row.
- Extended the modernized workflow action adapter with billing lifecycle methods that mutate through the public API and verify exact post-state through PostgreSQL probes.
- Added a shared `workflow-billing` parity suite and the `slice-16-billing-mutation-readiness` named plan for both legacy and modernized targets.
- Added Workbench test actions/cards and custom-run defaults for the Slice 16 billing mutation plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the billing mutation slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, with artifact status `passed`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-16-billing-mutation-readiness -Reset test`, passing 1 expected test with 0 skips.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-16-billing-mutation-readiness -Reset test`, passing 1 expected test with 0 skips.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-16-billing-mutation-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- PostgreSQL and MariaDB cleanup probes confirming zero leftover Slice 16 temporary billing rows.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/BillingRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/BillingDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/tests/workflow-billing/billing-line-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 039. Modernized Procedure Mutation Slice 17

Commit: 328ddc3

Implemented the seventeenth modernized OpenEMR vertical slice: the eighth mutation-capable parity workflow, focused on lab procedure order create, order completion, reviewed final report creation, final result creation, browser-visible order/report/result rendering, and cascade-delete cleanup with React Procedures controls, ASP.NET Core procedure lifecycle endpoints, PostgreSQL lab lifecycle fields, Workbench orchestration, smoke coverage, and side-by-side parity against the legacy OpenEMR procedure-results workflow.

Key outcomes:

- Added ASP.NET Core procedure order create, status update, report create, result create, and order cascade-delete endpoints under `/api/procedures`.
- Extended `ProcedureRepository` with order, report, and result lifecycle methods while preserving completed procedure-result rendering for the existing read-only contract.
- Extended the canonical gold dataset and modernized PostgreSQL seed schema with order priority, procedure type, instructions, report review status, and report notes so Slice 17 preserves OpenEMR-style lab lifecycle semantics.
- Added React Procedures UI controls for creating a lab order, marking an order complete, adding a reviewed report, adding a final result, and deleting temporary procedure order trees.
- Expanded the modernized smoke script with a safe procedure order/status/report/result/delete lifecycle check that cleans up its temporary rows.
- Extended the modernized workflow action adapter with procedure lifecycle methods that mutate through the public API and verify exact post-state through PostgreSQL probes.
- Added a shared `workflow-procedures` parity suite and the `slice-17-procedure-mutation-readiness` named plan for both legacy and modernized targets.
- Added Workbench test actions/cards and custom-run defaults for the Slice 17 procedure mutation plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the procedure mutation slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- JSON validation for `modernization-workbench/config/apps.json` and `parity-tests/test-manifest.json`.
- `npm run generate:seed-data` in `modernization-workbench/`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, with artifact status `passed`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-17-procedure-mutation-readiness -Reset test`, passing the procedure mutation suite.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-17-procedure-mutation-readiness -Reset test`, passing the procedure mutation suite.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-17-procedure-mutation-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- PostgreSQL and MariaDB cleanup probes confirming zero leftover Slice 17 temporary procedure rows.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/ProcedureRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/ProcedureDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/scripts/generate-gold-dataset.mjs`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/canonical/gold-dataset.json`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/legacy-mariadb/seed-gold.sql`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/tests/workflow-procedures/procedure-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 040. Modernized Admin Facility Mutation Slice 18

Commit: 3754e02

Implemented the eighteenth modernized OpenEMR vertical slice: the ninth mutation-capable parity workflow, focused on administration facility create, browser-visible active facility rendering, facility update to inactive state, default hidden-inactive behavior, and hard-delete cleanup with React Admin controls, ASP.NET Core administration facility lifecycle endpoints, PostgreSQL facility inactive state, Workbench orchestration, smoke coverage, and side-by-side parity against the legacy OpenEMR Facilities administration workflow.

Key outcomes:

- Added ASP.NET Core facility create, update, and delete endpoints under `/api/administration/facilities`.
- Extended `AdministrationRepository` with facility lifecycle methods while preserving the existing users/facilities directory read model.
- Extended the modernized PostgreSQL seed schema with facility inactive state so Slice 18 preserves OpenEMR-style facility lifecycle semantics.
- Added React Admin UI controls for creating facilities and marking/deleting visible facility cards.
- Expanded the modernized smoke script with a safe facility create/update/inactive/delete lifecycle check that cleans up its temporary row.
- Extended the legacy and modernized workflow action adapters with facility lifecycle methods, with modernized mutation going through the public API and verification through PostgreSQL probes.
- Added a shared `workflow-admin` parity suite and the `slice-18-admin-facility-mutation-readiness` named plan for both legacy and modernized targets, including default hidden-inactive list behavior after facility deactivation.
- Added Workbench test actions/cards and custom-run defaults for the Slice 18 admin facility mutation plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the admin facility mutation slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, with artifact status `passed`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-18-admin-facility-mutation-readiness -Reset test`, passing the admin facility mutation suite.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-18-admin-facility-mutation-readiness -Reset test`, passing the admin facility mutation suite.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-18-admin-facility-mutation-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- PostgreSQL and MariaDB cleanup probes confirming zero leftover Slice 18 temporary facility rows.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/AdministrationRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/AdministrationDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/tests/workflow-admin/facility-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 041. Modernized Admin User Mutation Slice 19

Commit: 39b15ac

Implemented the nineteenth modernized OpenEMR vertical slice: the tenth mutation-capable parity workflow, focused on administration user create, browser-visible active user rendering, user update to inactive state, default hidden-inactive behavior, and hard-delete cleanup with React Admin controls, ASP.NET Core administration user lifecycle endpoints, PostgreSQL staff active/email/NPI fields, Workbench orchestration, smoke coverage, and side-by-side parity against the legacy OpenEMR Users administration workflow.

Key outcomes:

- Added ASP.NET Core user create, update, and delete endpoints under `/api/administration/users`.
- Extended `AdministrationRepository` with user lifecycle methods while preserving the existing users/facilities directory read model.
- Extended the modernized PostgreSQL seed schema with staff active state, email, and NPI fields so Slice 19 preserves OpenEMR-style user directory lifecycle semantics.
- Added React Admin UI controls for creating users and marking/deleting visible active user cards.
- Expanded the modernized smoke script with a safe user create/update/inactive/delete lifecycle check that cleans up its temporary row.
- Extended the legacy and modernized workflow action adapters with user lifecycle methods, with modernized mutation going through the public API and verification through PostgreSQL probes.
- Added a shared `workflow-admin-users` parity suite and the `slice-19-admin-user-mutation-readiness` named plan for both legacy and modernized targets, including default hidden-inactive list behavior after user deactivation.
- Added Workbench test actions/cards and custom-run defaults for the Slice 19 admin user mutation plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the admin user mutation slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, with artifact status `passed`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-19-admin-user-mutation-readiness -Reset test`, passing the admin user mutation suite.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-19-admin-user-mutation-readiness -Reset test`, passing the admin user mutation suite.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-19-admin-user-mutation-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- PostgreSQL and MariaDB cleanup probes confirming zero leftover Slice 19 temporary user rows.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/AdministrationRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/AdministrationDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/tests/workflow-admin-users/user-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 042. Modernized Access-Control Read Model Slice 20

Commit: ae99d38

Implemented the twentieth modernized OpenEMR vertical slice: a read-only administration access-control parity workflow, focused on default OpenEMR ACL groups, visible permission objects, group-permission assignments, and browser-visible access-control surfaces with React Admin visibility, ASP.NET Core administration response fields, PostgreSQL access-control tables, Workbench orchestration, smoke coverage, and side-by-side parity against the legacy OpenEMR Access Control administration workflow.

Key outcomes:

- Added normalized modernized PostgreSQL seed tables for `access_groups`, `access_permissions`, and `access_group_permissions`, mirroring 7 default OpenEMR groups, 65 visible permission objects, and 203 group-permission assignments from the legacy phpGACL baseline.
- Extended the ASP.NET Core administration directory response with access-control counts, group rows, permission rows, and group-permission rows.
- Added React Admin UI visibility for the Access Control Matrix, including group counts and representative permission assignments.
- Expanded the modernized smoke script with default ACL group and permission anchor checks.
- Added normalized legacy MariaDB and modernized PostgreSQL access-control probes for default ACL facts.
- Added a shared `admin-access-control` parity suite and the `slice-20-access-control-readiness` named plan for both legacy and modernized targets.
- Added Workbench test actions/cards and custom-run defaults for the Slice 20 access-control plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the access-control read-model slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, with artifact status `passed`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-20-access-control-readiness -Reset run`, passing the access-control suite.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-20-access-control-readiness -Reset run`, passing the access-control suite.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-20-access-control-readiness` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/AdministrationRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/AdministrationDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/src/ui/legacyOpenEmr.ts`
- `parity-tests/tests/admin-access-control/access-control.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 043. Modernized Access Permission Mutation Slice 21

Commit: bdc8041

Implemented the twenty-first modernized OpenEMR vertical slice: a focused administration access-permission mutation workflow, centered on revoking and restoring the Front Office `patients:demo` write assignment with React Admin grant/revoke controls, ASP.NET Core administration ACL assignment endpoints, modernized PostgreSQL mutation behavior, Workbench orchestration, smoke coverage, and side-by-side parity against the legacy OpenEMR phpGACL tables.

Key outcomes:

- Added ASP.NET Core administration endpoints for granting and revoking access-control group-permission assignments.
- Added React Admin Permission Assignment controls with group, permission, return-value, Grant, and Revoke actions.
- Expanded the modernized smoke script with a Front Office `patients:demo` revoke/restore lifecycle that verifies 203-to-202-to-203 assignment counts.
- Added legacy and modernized workflow action adapter methods for normalized ACL assignment read/grant/revoke behavior.
- Added a shared `workflow-admin-access` parity suite and the `slice-21-access-permission-mutation-readiness` named plan for both legacy and modernized targets.
- Added Workbench test actions/cards and custom-run defaults for the Slice 21 access-permission mutation plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the first access-control mutation slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, with artifact status `passed`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-21-access-permission-mutation-readiness -Reset test`, passing the access-permission mutation suite.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-21-access-permission-mutation-readiness -Reset test`, passing the access-permission mutation suite.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-21-access-permission-mutation-readiness` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/AdministrationRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/AdministrationDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-admin-access/access-permission-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 044. Modernized User Group Membership Mutation Slice 22

Commit: `871edae`

Implemented the twenty-second modernized OpenEMR vertical slice: a focused administration user group membership mutation workflow, centered on creating a temporary user, assigning the Front Office access group, rendering the membership, revoking it, and cleaning up with React Admin membership controls, ASP.NET Core administration ACL membership endpoints, modernized PostgreSQL membership rows, Workbench orchestration, smoke coverage, and side-by-side parity against the legacy OpenEMR phpGACL membership tables.

Key outcomes:

- Added normalized modernized `access_user_memberships` seed data for the default `admin` and `oe-system` Administrator memberships.
- Added ASP.NET Core administration endpoints for granting and revoking user-to-access-group memberships, including user-delete cleanup for modernized membership rows.
- Added React Admin User Group Membership controls with active-user and leaf-group selectors plus Assign/Revoke actions.
- Added membership chips to modernized user directory cards so Playwright can verify browser-visible access membership state.
- Expanded the modernized smoke script with a temporary user membership grant/revoke lifecycle that verifies baseline 2-to-3-to-2 membership counts.
- Added legacy and modernized workflow action adapter methods for normalized ACL membership read/grant/revoke behavior.
- Extended read-only access-control parity to verify the default ACL user memberships.
- Added a shared `workflow-admin-memberships` parity suite and the `slice-22-user-group-membership-mutation-readiness` named plan for both legacy and modernized targets.
- Added Workbench test actions/cards and custom-run defaults for the Slice 22 user group membership mutation plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the user group membership mutation slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-20-access-control-readiness -Reset run`, passing the expanded access-control suite with default user membership assertions.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-20-access-control-readiness -Reset run`, passing the expanded access-control suite with default user membership assertions.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-20-access-control-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-22-user-group-membership-mutation-readiness -Reset test`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-22-user-group-membership-mutation-readiness -Reset test`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-22-user-group-membership-mutation-readiness` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/AdministrationRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/AdministrationDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/admin-access-control/access-control.spec.ts`
- `parity-tests/tests/workflow-admin-memberships/user-group-membership-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 045. Modernized Pending Procedure Orders Slice 23

Commit: `278d2f5`

Implemented the twenty-third modernized OpenEMR vertical slice: read-only pending/scheduled procedure-order visibility, centered on the gold dataset's future scheduled, reportless lab orders with React Procedures scheduled-order cards, ASP.NET Core procedure count fields, normalized legacy MariaDB and modernized PostgreSQL probes, Workbench orchestration, smoke coverage, and side-by-side parity against the legacy OpenEMR procedure results screen.

Key outcomes:

- Added explicit procedure counts to the modernized procedure API for total, completed, scheduled, reportless, future scheduled, report, result, and final-result totals.
- Added Pending/Scheduled Orders visibility to the modernized Procedures workspace so reportless procedure orders are not hidden behind completed result workflows.
- Expanded the modernized smoke script with a `MOD-PAT-0701` scheduled CBC order anchor check for `2026-06-25`.
- Added normalized legacy MariaDB and modernized PostgreSQL probes for future scheduled procedure orders with no linked report rows.
- Added a shared `procedure-pending-orders` parity suite and the `slice-23-procedure-pending-orders-readiness` named plan for both legacy and modernized targets.
- Added Workbench test actions/cards and custom-run defaults for the Slice 23 pending procedure orders plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the pending/scheduled procedure-order slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-23-procedure-pending-orders-readiness -Reset run`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-23-procedure-pending-orders-readiness -Reset run`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-23-procedure-pending-orders-readiness` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/ProcedureRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/ProcedureDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/src/ui/legacyOpenEmr.ts`
- `parity-tests/tests/procedure-pending-orders/pending-procedure-orders.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 046. Modernized Operational Reports CSV Export Slice 24

Commit: `cd192f5`

Implemented the twenty-fourth modernized OpenEMR vertical slice: operational reports CSV export, centered on a deterministic `Section, Name, Metric, Value` export of the existing gold-data operational report read model, with a React Reports export action, ASP.NET Core CSV endpoint, normalized legacy MariaDB and modernized PostgreSQL probes, Workbench orchestration, smoke coverage, and side-by-side parity against the legacy OpenEMR report-export affordance.

Key outcomes:

- Added `/api/reports/operational/export` to the modernized reports API, returning a downloadable `text/csv` operational report export.
- Added deterministic CSV generation over the same report DTOs that power the Reports dashboard so JSON and CSV report behavior stay aligned.
- Updated the modernized Reports workspace from deferred export status to a visible `CSV Export` action.
- Expanded the modernized smoke script with content-type and stable gold-data CSV row checks.
- Added normalized legacy MariaDB and modernized PostgreSQL operational report export rows.
- Added a shared `reports-export` parity suite and the `slice-24-reports-export-readiness` named plan for both legacy and modernized targets.
- Added Workbench test actions/cards and custom-run defaults for the Slice 24 reports export plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the reports export slice.

Verified test runs:

- `dotnet build .\modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` from `modernized-openemr/`.
- `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-24-reports-export-readiness -Reset run`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-24-reports-export-readiness -Reset run`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-24-reports-export-readiness` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/ReportRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/tests/reports-export/operational-reports-export.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 047. Modernized Patient Documents Read-Only Slice 25

Commit: current slice commit

Implemented the twenty-fifth modernized OpenEMR vertical slice: read-only patient documents, centered on deterministic gold-data document records, OpenEMR-style document categories, patient document metadata, text payload previews, a React Documents workspace, ASP.NET Core documents API, normalized legacy MariaDB and modernized PostgreSQL probes, Workbench orchestration, smoke coverage, and side-by-side parity against the legacy OpenEMR document-list surface.

Key outcomes:

- Added 1,200 deterministic patient document records to the shared gold dataset, including stable `MOD-PAT-0001` anchors for `Primary care intake packet` and `Advance directive acknowledgement`.
- Extended the legacy seed to populate OpenEMR `documents` and `categories_to_documents` rows, and extended the modernized seed to populate a normalized `patient_documents` table.
- Added `/api/documents/{patientId}` to the modernized ASP.NET Core API for patient document metadata, categories, encounter links, storage method, and content previews.
- Added a React Documents workspace with patient lookup, category summary, document counts, linked encounter counts, page counts, document cards, metadata, and content previews.
- Extended operational reports and CSV export to include the shared 1,200 patient-document count.
- Added normalized legacy MariaDB and modernized PostgreSQL patient document probes.
- Added a shared `documents` parity suite and the `slice-25-documents-readiness` named plan for both legacy and modernized targets.
- Added Workbench test actions/cards and custom-run defaults for the Slice 25 documents plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the documents slice.

Verified test runs:

- `npx --version` from the repository root, confirming `11.8.0`.
- `dotnet --version` from the repository root, confirming SDK `10.0.301`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `npm run typecheck` in `parity-tests/`.
- `dotnet build .\OpenEmr.Modernized.slnx` in `modernized-openemr/`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `docker compose build api frontend` and `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-LegacyGoldDataset.ps1` from `legacy-openemr/`, validating 1,200 patient documents and document temporal coverage.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`, copying 1,200 `patient_documents` rows.
- `.\scripts\Test-LegacyBaseline.ps1` from `legacy-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-25-documents-readiness -Reset run`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-25-documents-readiness -Reset run`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-25-documents-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-9-reports-readiness -Reset run`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-9-reports-readiness -Reset run`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-9-reports-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-24-reports-export-readiness -Reset run`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-24-reports-export-readiness -Reset run`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-24-reports-export-readiness` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/scripts/generate-gold-dataset.mjs`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/canonical/gold-dataset.json`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/legacy-mariadb/seed-gold.sql`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/summary.json`
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/DocumentRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/ReportRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/DocumentDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/ReportDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/src/ui/legacyOpenEmr.ts`
- `parity-tests/tests/documents/patient-documents.spec.ts`
- `parity-tests/tests/reports/operational-reports.spec.ts`
- `parity-tests/tests/reports-export/operational-reports-export.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 048. Modernized Patient Document Mutation Slice 26

Commit: current slice commit

Implemented the twenty-sixth modernized OpenEMR vertical slice: patient document mutation, centered on database-backed text documents that can be created, rendered, soft-deleted/archived, and hard-deleted with cleanup on both legacy and modernized targets.

Key outcomes:

- Added document create, soft-delete/archive, and hard-delete endpoints to the modernized ASP.NET Core Documents API.
- Extended the React Documents workspace with a compact new-document form and Archive/Delete actions on document cards.
- Added TypeScript API client support for patient document lifecycle mutations.
- Added shared legacy and modernized workflow action adapters for patient document lifecycle parity.
- Added the `workflow-documents` parity suite and `slice-26-document-mutation-readiness` named plan for both legacy and modernized targets.
- Added Workbench command cards and result paths for the Slice 26 document mutation plan, and updated the custom parity runner default to the newest slice plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects patient document mutation behavior.

Verified test runs:

- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `npm run typecheck` in `parity-tests/`.
- `dotnet build .\OpenEmr.Modernized.slnx` in `modernized-openemr/`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `docker compose build api frontend` and `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, including `patient document mutation lifecycle`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-26-document-mutation-readiness -Reset test`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-26-document-mutation-readiness -Reset test`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-26-document-mutation-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-25-documents-readiness -Reset run`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-25-documents-readiness -Reset run`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-25-documents-readiness` in `parity-tests/`, producing a matched regression comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/DocumentRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/DocumentDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-documents/document-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 050. Modernized Patient Insurance Coverage Slice 28

Commit: current slice commit

Implemented the twenty-eighth modernized OpenEMR vertical slice: read-only patient insurance coverage in the chart summary, centered on stable primary and secondary coverage for `MOD-PAT-0005`.

Key outcomes:

- Added insurance coverage rows to the modernized ASP.NET Core patient chart summary response.
- Added a React Patient/Client chart Insurance panel showing payer, plan, policy, group, and relationship details.
- Corrected the legacy gold seed mapping so synthetic payers are valid `insurance_companies` rows and `insurance_data.provider` stores OpenEMR payer IDs rather than raw names.
- Added normalized legacy MariaDB and modernized PostgreSQL insurance probes.
- Added the `insurance` parity suite and `slice-28-insurance-readiness` named plan for both legacy and modernized targets.
- Added Workbench command cards, result paths, and custom-run default plan support for the Slice 28 insurance plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects insurance coverage behavior and the corrected legacy seed mapping.

Verified test runs:

- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, `parity-tests/package.json`, and regenerated seed JSON.
- `npm run typecheck` in `parity-tests/`.
- `dotnet build .\OpenEmr.Modernized.slnx` in `modernized-openemr/`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `docker compose build api frontend` and `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-LegacyBaseline.ps1` from `legacy-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, including `anchor insurance coverage`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-28-insurance-readiness -Reset run`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-28-insurance-readiness -Reset run`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-28-insurance-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-1-readiness -Reset run`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-1-readiness -Reset run`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-1-readiness` in `parity-tests/`, producing a matched regression comparison with no differences.

Primary files:

- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/scripts/generate-gold-dataset.mjs`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/legacy-mariadb/seed-gold.sql`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/PatientRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/PatientDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/src/ui/legacyOpenEmr.ts`
- `parity-tests/tests/insurance/insurance-coverage.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 051. Modernized Patient Immunization History Slice 29

Commit: current slice commit

Implemented the twenty-ninth modernized OpenEMR vertical slice: read-only patient immunization history in the clinical lists workspace, centered on stable pediatric vaccine history for `MOD-PAT-0007`.

Key outcomes:

- Expanded the shared gold dataset with 2,648 deterministic immunization rows, including current-year influenza coverage for every patient and richer childhood vaccine history for pediatric anchors.
- Seeded legacy OpenEMR's native `immunizations` table with OpenEMR immunization IDs, CVX codes, manufacturers, lot numbers, VIS dates, route/site, encounter linkage, and completion/source metadata.
- Added normalized modernized PostgreSQL immunization records and aligned the modernized display names with OpenEMR's CVX-first legacy rendering.
- Extended the modernized ASP.NET Core clinical-lists API and React Lists workspace with immunization history display.
- Added legacy and modernized DB probes, legacy UI navigation support, the `immunizations` parity suite, and the `slice-29-immunizations-readiness` named plan.
- Added Workbench command cards, result paths, and custom-run default plan support for the Slice 29 immunization plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects immunization history behavior.

Verified test runs:

- JSON validation for `modernization-workbench/config/apps.json`, `modernization-workbench/seed-data/manifest.json`, `parity-tests/test-manifest.json`, `parity-tests/package.json`, and regenerated seed JSON.
- `npm run typecheck` in `parity-tests/`.
- `dotnet build .\OpenEmr.Modernized.slnx` in `modernized-openemr/`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `docker compose build api frontend` and `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-LegacyGoldDataset.ps1` from `legacy-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-LegacyBaseline.ps1` from `legacy-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, including `anchor immunizations`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-29-immunizations-readiness -Reset run`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-29-immunizations-readiness -Reset run`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-29-immunizations-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Suite database -Reset run`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Suite database -Reset run`.

Primary files:

- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/scripts/generate-gold-dataset.mjs`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/canonical/gold-dataset.json`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/legacy-mariadb/seed-gold.sql`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/ClinicalListRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/ClinicalListDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/src/ui/legacyOpenEmr.ts`
- `parity-tests/tests/immunizations/immunizations-readiness.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 052. Modernized Patient Immunization Mutation Slice 30

Commit: current slice commit

Implemented the thirtieth modernized OpenEMR vertical slice: immunization create, active rendering, entered-in-error, and hard-delete cleanup in the clinical Lists workflow.

Key outcomes:

- Added modernized ASP.NET Core clinical-list endpoints for immunization create, mark entered in error, and delete behavior over the PostgreSQL `immunizations` table.
- Added a New Immunization form and row-level entered-in-error/delete controls to the React Lists Immunizations panel.
- Extended the modernized smoke test with a temporary immunization lifecycle check for `MOD-PAT-0007`.
- Added shared legacy and modernized workflow adapter methods for immunization create, direct row readback, entered-in-error update, and cleanup delete.
- Added the `workflow-immunizations` Playwright parity suite and `slice-30-immunization-mutation-readiness` plan for both targets.
- Added Workbench command cards and result paths for the Slice 30 immunization mutation plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the new lifecycle behavior.

Verified test runs:

- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and package manifests.
- `npm run list` in `parity-tests/`.
- `npm run typecheck` in `parity-tests/`.
- `dotnet build .\modernized-openemr\backend\src\OpenEmr.Modernized.Api\OpenEmr.Modernized.Api.csproj`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `docker compose build api frontend` and `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, including `clinical immunization mutation lifecycle`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-30-immunization-mutation-readiness -Reset test`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-30-immunization-mutation-readiness -Reset test`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-30-immunization-mutation-readiness` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/ClinicalListRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/ClinicalListDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-immunizations/immunization-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 053. Modernized Patient Problem List Mutation Slice 31

Commit: current slice commit

Implemented the thirty-first modernized OpenEMR vertical slice: problem-list create, active rendering, deactivate, and hard-delete cleanup in the clinical Lists workflow.

Key outcomes:

- Added modernized ASP.NET Core clinical-list endpoints for problem create, deactivate, and delete behavior over the PostgreSQL `problems` table.
- Extended the modernized PostgreSQL problem schema and seed generation with OpenEMR-style `activity` and `end_date` fields.
- Added a New Problem form and row-level deactivate/delete controls to the React Lists Problems panel.
- Extended the modernized smoke test with a temporary problem lifecycle check for `MOD-PAT-0006`.
- Added shared legacy and modernized workflow adapter methods for problem create, direct row readback, deactivate, and cleanup delete.
- Added the `workflow-problems` Playwright parity suite and `slice-31-problem-mutation-readiness` plan for both targets.
- Added Workbench command cards and result paths for the Slice 31 problem mutation plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the new lifecycle behavior.

Verified test runs:

- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and package manifests.
- `npm run list` in `parity-tests/`.
- `npm run typecheck` in `parity-tests/`.
- `dotnet build .\modernized-openemr\backend\src\OpenEmr.Modernized.Api\OpenEmr.Modernized.Api.csproj`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `docker compose build api frontend` and `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, including `clinical problem mutation lifecycle`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-31-problem-mutation-readiness -Reset test`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-31-problem-mutation-readiness -Reset test`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-31-problem-mutation-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Suite database -Reset run`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Suite database -Reset run`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/ClinicalListRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/PatientRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/ClinicalListDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-problems/problem-mutation.spec.ts`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`

### 054. Modernized Patient Medication List Mutation Slice 32

Commit: current slice commit

Implemented the thirty-second modernized OpenEMR vertical slice: medication-list create, active rendering, deactivate, and hard-delete cleanup in the clinical Lists workflow.

Key outcomes:

- Added modernized ASP.NET Core clinical-list endpoints for medication-list create, deactivate, and delete behavior over the PostgreSQL `medications` table.
- Extended the modernized PostgreSQL medication-list schema and seed generation with OpenEMR-style `activity` and `end_date` fields.
- Added a New Medication form and row-level deactivate/delete controls to the React Lists Medications panel.
- Extended the modernized smoke test with a temporary medication-list lifecycle check for `MOD-PAT-0006`.
- Added shared legacy and modernized workflow adapter methods for medication-list create, direct row readback, deactivate, and cleanup delete.
- Added the `workflow-medications` Playwright parity suite and `slice-32-medication-list-mutation-readiness` plan for both targets.
- Added Workbench command cards and result paths for the Slice 32 medication-list mutation plan.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the new lifecycle behavior.

Verified test runs:

- JSON validation for `modernization-workbench/config/apps.json` and `parity-tests/test-manifest.json`.
- `npm run list` in `parity-tests/`.
- `npm run typecheck` in `parity-tests/`.
- `dotnet build .\modernized-openemr\backend\src\OpenEmr.Modernized.Api\OpenEmr.Modernized.Api.csproj --nologo -clp:ErrorsOnly`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `docker compose build api frontend` and `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, producing `passed` with 35 checks and including `clinical medication mutation lifecycle`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-32-medication-list-mutation-readiness -Reset test`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-32-medication-list-mutation-readiness -Reset test`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-32-medication-list-mutation-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Suite database -Reset run`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Suite database -Reset run`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --suite database` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/ClinicalListRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/PatientRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/ClinicalListDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-medications/medication-list-mutation.spec.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 055. Modernized Binary Patient Document Mutation Slice 33

Commit: current slice commit

Implemented the thirty-third modernized OpenEMR vertical slice: PDF-style binary patient-document upload, active rendering, MIME-aware byte-preserving download, soft-delete/archive, and hard-delete cleanup in the Documents workflow.

Key outcomes:

- Extended the modernized ASP.NET Core document API with binary document creation and MIME-aware download behavior.
- Extended the modernized PostgreSQL patient-document schema and seed adapter with `file_name` and `content_bytes` fields while keeping existing seeded text documents stable.
- Added an Upload File form to the React Documents workspace, including file selection, category/date/encounter metadata, notes, binary viewer metadata, and row rendering for uploaded filenames.
- Extended the modernized smoke test with a temporary PDF-style binary document lifecycle check for `MOD-PAT-0001`.
- Added shared legacy and modernized workflow adapter methods for binary document create, direct readback, soft-delete/archive, and cleanup delete.
- Added the `workflow-document-binary` Playwright parity suite and `slice-33-binary-document-mutation-readiness` plan for both targets.
- Added Workbench command cards and result paths for the Slice 33 binary document mutation plan.
- Preserved Slice 27 text-document content behavior by making legacy document-key extraction prefer embedded gold-data keys for seeded text documents and use URL-derived keys for new binary document uploads.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the new binary document lifecycle behavior.

Verified test runs:

- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `npm run list` in `parity-tests/`.
- `npm run typecheck` in `parity-tests/`.
- `dotnet build .\modernized-openemr\backend\src\OpenEmr.Modernized.Api\OpenEmr.Modernized.Api.csproj --nologo -clp:ErrorsOnly`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `docker compose build api frontend` and `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, producing `passed` with 36 checks and including `patient binary document mutation lifecycle`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-33-binary-document-mutation-readiness -Reset run`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-33-binary-document-mutation-readiness -Reset run`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-33-binary-document-mutation-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-27-document-content-readiness -Reset run`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-27-document-content-readiness -Reset run`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-27-document-content-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Suite database -Reset run`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Suite database -Reset run`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --suite database` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/DocumentRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/DocumentDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-document-binary/binary-document-mutation.spec.ts`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 056. Modernized Patient Insurance Mutation Slice 34

Commit: current slice commit

Implemented the thirty-fourth modernized OpenEMR vertical slice: patient insurance coverage create, active rendering, update, and hard-delete cleanup in the Patient/Client chart Insurance panel.

Key outcomes:

- Added modernized ASP.NET Core patient insurance lifecycle endpoints for create, update, and delete behavior over the PostgreSQL `insurance_records` table.
- Added a compact insurance coverage add/edit form and row-level Edit/Delete controls to the React Patient/Client chart Insurance panel.
- Extended the modernized smoke test with a temporary tertiary insurance lifecycle check for `MOD-PAT-0005`.
- Added shared legacy and modernized workflow adapter methods for insurance coverage create, direct readback, update, and cleanup delete.
- Added the `workflow-insurance` Playwright parity suite and `slice-34-insurance-mutation-readiness` plan for both targets.
- Added Workbench command cards and result paths for the Slice 34 insurance mutation plan.
- Preserved Slice 28 read-only insurance coverage behavior by using a temporary tertiary row and deleting it so the seeded primary/secondary `MOD-PAT-0005` baseline stays stable.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the new insurance lifecycle behavior.

Verified test runs:

- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `npm run list` in `parity-tests/`.
- `npm run typecheck` in `parity-tests/`.
- `dotnet build .\modernized-openemr\backend\src\OpenEmr.Modernized.Api\OpenEmr.Modernized.Api.csproj --nologo -clp:ErrorsOnly`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `docker compose build api frontend` and `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, producing `passed` with 37 checks and including `patient insurance mutation lifecycle`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-34-insurance-mutation-readiness -Reset run`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-34-insurance-mutation-readiness -Reset run`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-34-insurance-mutation-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-28-insurance-readiness -Reset run`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-28-insurance-readiness -Reset run`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-28-insurance-readiness` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/PatientRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/PatientDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-insurance/insurance-mutation.spec.ts`
- `parity-tests/tests/insurance/insurance-coverage.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 057. Modernized Encounter Metadata Mutation Slice 35

Commit: current slice commit

Implemented the thirty-fifth modernized OpenEMR vertical slice: encounter sensitivity, referral source, external ID, and POS metadata create, active rendering, update, and hard-delete cleanup in the Encounters workflow.

Key outcomes:

- Extended the modernized ASP.NET Core encounter DTOs and repository queries with `sensitivity`, `referralSource`, `externalId`, and `posCode` on search, detail, create, and update.
- Extended the modernized PostgreSQL encounter schema generated by the seed adapter with `sensitivity`, `referral_source`, `external_id`, and `pos_code`.
- Added React Encounters create/update controls for sensitivity, referral source, external ID, and POS code, plus Visit-panel rendering for saved metadata.
- Extended the modernized smoke test with a temporary metadata-rich encounter lifecycle check for `MOD-PAT-0002`.
- Added shared legacy and modernized workflow adapter support for encounter metadata create, direct readback, update, and cleanup delete.
- Added the `workflow-encounter-metadata` Playwright parity suite and `slice-35-encounter-metadata-readiness` plan for both targets.
- Added Workbench command cards and result paths for the Slice 35 encounter metadata plan.
- Aligned the generated parity fixture with the legacy `form_encounter.external_id` field width after the first legacy run exposed the real OpenEMR column constraint.
- Updated modernization, Workbench, test architecture, seed-data, baseline, project-context, and document-index guidance so the documented state reflects the new encounter metadata lifecycle behavior.

Verified test runs:

- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `npm run typecheck` in `parity-tests/`.
- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `docker compose build api frontend` and `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, producing `passed` with 38 checks and including `encounter metadata mutation lifecycle`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-35-encounter-metadata-readiness -Reset run`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-35-encounter-metadata-readiness -Reset run`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-35-encounter-metadata-readiness` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/EncounterRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/EncounterDtos.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-encounter-metadata/encounter-metadata.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

## 2026-06-19

### 058. Workbench HTTP Health Checks Restored

Commit: current slice commit

Fixed the Modernization Workbench backend health checker so managed applications with `http` health URLs can be evaluated without throwing `Protocol "http:" not supported. Expected "https:"`.

Key outcomes:

- Added protocol-aware Workbench health checks using Node's HTTP client for `http` URLs and HTTPS client for `https` URLs.
- Preserved the self-signed certificate bypass only for HTTPS health checks, which keeps the legacy OpenEMR health endpoint behavior intact.
- Restored shared `/api/apps` snapshot loading for every Workbench page when the modernized target health URL is `http://localhost:5001/health`.

Verified test runs:

- `npm run typecheck` in `modernization-workbench/`.
- `npm run build` in `modernization-workbench/`.
- Short-lived Workbench API smoke on port `5197` with `/api/changelog`, confirming entry 060 returned explicit `startedAt`, `finishedAt`, calculated `durationMs`, and `completedAt`.
- Short-lived Workbench API smoke on port `5198` with `/api/changelog`, confirming 59 timeline entries and 46 commit-timed entries.
- `npm run build` in `modernization-workbench/`.
- Short-lived Workbench API smoke on port `5199` with `/api/apps`, confirming both legacy HTTPS and modernized HTTP health URLs load successfully.

Primary files:

- `modernization-workbench/server/index.ts`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/PROJECT_CHANGELOG.md`

### 059. Project Timeline Commit Timing Added

Commit: current slice commit

Enhanced the Modernization Workbench Project Timeline so changelog entries with resolvable Git commit hashes can show actual completion clock time and elapsed time since the previous completed changelog step.

Key outcomes:

- Added Workbench API enrichment that resolves changelog commit hashes against local Git history.
- Added `completedAt`, `completedCommit`, and `elapsedSincePreviousMs` fields to structured changelog entries when commit metadata is available.
- Added compact timeline chips for commit completion time and the elapsed span since the prior completed step.
- Kept the duration label honest as "Since prior step" because the changelog does not record actual human task start times.

Verified test runs:

- `npm run typecheck` in `modernization-workbench/`.

Primary files:

- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/types.ts`
- `modernization-workbench/src/App.tsx`
- `modernization-workbench/src/styles.css`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/PROJECT_CHANGELOG.md`

### 060. Changelog Explicit Timing Convention Added

Commit: current slice commit
Started: `2026-06-19T13:06:12-04:00`
Finished: `2026-06-19T13:08:03-04:00`

Updated the project changelog convention so future entries record explicit section start and finish timestamps, allowing the Modernization Workbench to calculate actual per-section duration.

Key outcomes:

- Added `Started:` and `Finished:` timestamp requirements to the changelog maintenance rules.
- Added an entry template using ISO 8601 local timestamps with timezone offsets.
- Updated documentation governance and the document index so future contributors know changelog timing metadata is required.
- Extended the Workbench changelog parser and timeline types to parse explicit start, finish, and calculated duration fields.
- Updated the Project Timeline UI to show Started, Finished, and Duration chips when explicit timing is present, while preserving commit-time fallback behavior for older entries.

Verified test runs:

- `npm run typecheck` in `modernization-workbench/`.
- `npm run build` in `modernization-workbench/`.

Primary files:

- `documents/PROJECT_CHANGELOG.md`
- `documents/DOCUMENTATION_GOVERNANCE.md`
- `documents/INDEX.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/types.ts`
- `modernization-workbench/src/App.tsx`

### 061. Modernized Patient Demographics Mutation Slice 36

Commit: current slice commit
Started: `2026-06-19T12:47:00-04:00`
Finished: `2026-06-19T13:14:22-04:00`

Implemented the thirty-sixth modernized OpenEMR vertical slice: patient demographics mutation, focused on updating and restoring patient identity, DOB, address, marital status, and occupation through the modernized Patient/Client chart while preserving side-by-side parity against legacy OpenEMR.

Key outcomes:

- Added an ASP.NET Core patient demographics update endpoint and PostgreSQL repository mutation over the modernized `patients` table.
- Added a React Patient/Client chart Demographics editor for first name, last name, preferred name, sex, date of birth, address, marital status, and occupation.
- Added modernized frontend API typing and state synchronization so saved demographics update both the chart header and current search result row.
- Added shared legacy and modernized workflow adapter methods for `getPatientDemographics` and `updatePatientDemographics`.
- Added the `workflow-demographics` Playwright parity suite and `slice-36-patient-demographics-mutation-readiness` plan for both targets.
- Added Workbench commands/cards and result paths for the Slice 36 patient demographics plan.
- Added modernized smoke coverage that updates `MOD-PAT-0010`, verifies returned chart state, and restores the original demographics.
- Documented the verified legacy rendering nuance: all demographic fields are checked by normalized row/API readback, while legacy browser checks assert the fields exposed by OpenEMR's summary/edit surfaces.

Verified test runs:

- JSON parse validation for `parity-tests/test-manifest.json`, `parity-tests/package.json`, and `modernization-workbench/config/apps.json`.
- `npm run typecheck` in `parity-tests/`.
- `npm run typecheck` in `modernization-workbench/`.
- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `npm run list` in `parity-tests/`.
- `docker compose build api frontend` and `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, producing `passed` and including `patient demographics mutation lifecycle`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-36-patient-demographics-mutation-readiness -Reset test`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-36-patient-demographics-mutation-readiness -Reset test`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-36-patient-demographics-mutation-readiness` in `parity-tests/`, producing a matched comparison with no differences.
- `git diff --check`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/PatientRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/PatientDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/ui/legacyOpenEmr.ts`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-demographics/patient-demographics-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 062. Modernized Patient Registration Slice 37

Commit: current slice commit
Started: `2026-06-19T13:15:00-04:00`
Finished: `2026-06-19T13:43:58-04:00`

Implemented the thirty-seventh modernized OpenEMR vertical slice: patient registration lifecycle, focused on creating a temporary registered patient, rendering the new chart in both applications, deleting the temporary patient, and proving the baseline returns clean.

Key outcomes:

- Added an ASP.NET Core patient registration endpoint and guarded temporary-patient delete endpoint.
- Added PostgreSQL repository support for registration validation, legacy PID allocation, duplicate-public-ID handling, and safe cleanup of `TMP-PAT-REG-*` patients.
- Added a React Patient/Client registration form in the finder panel with identity, DOB, sex, address, phone, email, and HIPAA contact preference fields.
- Added frontend API helpers and chart/search state synchronization after a successful registration.
- Added legacy and modernized workflow adapter methods for `createPatient` and `deleteTemporaryPatient`.
- Added the `workflow-registration` Playwright parity suite and `slice-37-patient-registration-readiness` plan for both targets.
- Added Workbench commands/cards and result paths for the Slice 37 patient registration plan.
- Expanded modernized smoke coverage so it creates, searches, charts, deletes, and confirms cleanup for a temporary registered patient.
- Captured the legacy dashboard rendering nuance: OpenEMR exposes the assigned chart id on the dashboard, while public ID remains validated by exact backend readback and by the modernized search/rendering path.

Verified test runs:

- JSON parse validation for `parity-tests/test-manifest.json`, `parity-tests/package.json`, and `modernization-workbench/config/apps.json`.
- `npm run typecheck` in `parity-tests/`.
- `npm run typecheck` in `modernization-workbench/`.
- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `npm run list` in `parity-tests/`, confirming `slice-37-patient-registration-readiness` and `workflow-registration`.
- `docker compose build api frontend` and `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, including the patient registration lifecycle smoke.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-37-patient-registration-readiness -Reset test`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-37-patient-registration-readiness -Reset test`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-37-patient-registration-readiness` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/PatientRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/PatientDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-registration/patient-registration-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 063. Modernized Patient Document Sign-Off Slice 38

Commit: current slice commit
Started: `2026-06-19T13:45:00-04:00`
Finished: `2026-06-19T14:04:25-04:00`

Implemented the thirty-eighth modernized OpenEMR vertical slice: patient document sign-off, focused on creating a temporary patient document, approving/signing it, rendering the approved state, archiving it, deleting it, and proving the document baseline returns clean.

Key outcomes:

- Added modernized document review fields: `review_status`, `reviewed_by`, and `reviewed_at`.
- Added an ASP.NET Core patient document sign-off endpoint at `/api/documents/{documentId}/sign`.
- Added review-status and reviewer rendering plus a Sign action to the React Documents workspace.
- Added modernized frontend API typing and helper support for document sign-off.
- Added shared legacy and modernized workflow adapter methods for `signPatientDocument`.
- Added the `workflow-document-signoff` Playwright parity suite and `slice-38-document-signoff-readiness` plan for both targets.
- Added Workbench commands/cards and result paths for the Slice 38 document sign-off plan.
- Expanded modernized smoke coverage so a temporary text document is signed before archive/delete cleanup.
- Documented the legacy mapping: OpenEMR `documents.audit_master_approval_status = 2` is normalized as `approved`.

Verified test runs:

- JSON parse validation for `parity-tests/test-manifest.json`, `parity-tests/package.json`, and `modernization-workbench/config/apps.json`.
- `npm run typecheck` in `parity-tests/`.
- `npm run typecheck` in `modernization-workbench/`.
- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `npm run list` in `parity-tests/`, confirming `slice-38-document-signoff-readiness` and `workflow-document-signoff`.
- `docker compose build api frontend` and `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, including the patient document sign-off smoke.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-38-document-signoff-readiness -Reset test`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-38-document-signoff-readiness -Reset test`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-38-document-signoff-readiness` in `parity-tests/`, producing a matched comparison with no differences.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/DocumentRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/DocumentDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-document-signoff/document-signoff-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 064. Modernized Patient Document External-Link Slice 39

Commit: current slice commit
Started: `2026-06-19T14:05:00-04:00`
Finished: `2026-06-19T14:27:01-04:00`

Implemented the thirty-ninth modernized OpenEMR vertical slice: patient document external-link filing, focused on creating a temporary `web_url` document, rendering URL/storage metadata, archiving it, deleting it, and proving the document baseline returns clean.

Key outcomes:

- Added an ASP.NET Core external-link patient document endpoint at `/api/documents/external-link`.
- Added URL validation and `web_url` document creation in the modernized Documents repository while reusing the normalized `patient_documents` URL/storage fields.
- Added React Documents workspace support for External Link creation, URL/storage rendering, and Open Link actions on document cards and the viewer.
- Added modernized frontend API typing and helper support for external-link patient documents.
- Added shared legacy and modernized workflow adapter methods for `createPatientExternalLinkDocument`.
- Added the `workflow-document-external-link` Playwright parity suite and `slice-39-document-external-link-readiness` plan for both targets.
- Added Workbench commands/cards and result paths for the Slice 39 document external-link plan.
- Expanded modernized smoke coverage so a temporary external-link document is created, read, archived, and deleted.
- Documented the legacy mapping: OpenEMR `documents.type = web_url` is normalized as `storageMethod = web_url`.

Verified test runs:

- JSON parse validation for `parity-tests/test-manifest.json`, `parity-tests/package.json`, and `modernization-workbench/config/apps.json`.
- `npm run typecheck` in `parity-tests/`.
- `npm run typecheck` in `modernization-workbench/`.
- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `npm run list` in `parity-tests/`, confirming `slice-39-document-external-link-readiness` and `workflow-document-external-link`.
- `docker compose build api frontend` and `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, including the patient external-link document smoke.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-39-document-external-link-readiness -Reset test`, producing run id `2026-06-19T182615-907Z-legacy-openemr-plan-slice-39-document-external-link-readiness`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-39-document-external-link-readiness -Reset test`, producing run id `2026-06-19T182638-979Z-modernized-openemr-plan-slice-39-document-external-link-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-39-document-external-link-readiness` in `parity-tests/`, producing matched comparison id `2026-06-19T182655-818Z-legacy-openemr-vs-modernized-openemr-plan-slice-39-document-external-link-readiness`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/DocumentRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/DocumentDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-document-external-link/external-link-document-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 065. Modernized Patient Document Denial Slice 40

Commit: current slice commit
Started: `2026-06-19T14:30:00-04:00`
Finished: `2026-06-19T14:48:17-04:00`

Implemented the fortieth modernized OpenEMR vertical slice: patient document denial/rejection, focused on creating a temporary pending document, denying it as `admin`, rendering the denied state, archiving it, deleting it, and proving the document baseline returns clean.

Key outcomes:

- Added modernized Documents workspace Deny action support beside Sign and disabled both review actions after a document is approved or denied.
- Reused the ASP.NET Core document review endpoint's `reviewStatus = denied` support for focused patient-document denial behavior.
- Added modernized smoke coverage for a temporary patient-document denial lifecycle.
- Added shared legacy and modernized workflow adapter methods for `denyPatientDocument`.
- Normalized legacy `documents.audit_master_approval_status = 3` as `reviewStatus = denied`, with `admin` reviewer metadata for the focused parity workflow.
- Added the `workflow-document-denial` Playwright parity suite and `slice-40-document-denial-readiness` plan for both targets.
- Added Workbench commands/cards and result paths for the Slice 40 document denial plan.
- Documented the legacy mapping and the modernized review-state behavior.

Verified test runs:

- JSON parse validation for `parity-tests/test-manifest.json`, `parity-tests/package.json`, and `modernization-workbench/config/apps.json`.
- `npm run typecheck` in `parity-tests/`.
- `npm run typecheck` in `modernization-workbench/`.
- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `npm run list` in `parity-tests/`, confirming `slice-40-document-denial-readiness` and `workflow-document-denial`.
- `docker compose build api frontend` and `docker compose up -d api frontend` from `modernized-openemr/`.
- `.\scripts\Seed-ModernizedGoldDataset.ps1` from `modernized-openemr/`.
- `.\scripts\Test-ModernizedBaseline.ps1 -ApiBaseUrl 'http://localhost:5001'` from `modernized-openemr/`, including the patient document denial smoke.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-40-document-denial-readiness -Reset test`, producing run id `2026-06-19T184720-613Z-legacy-openemr-plan-slice-40-document-denial-readiness`.
- `.\scripts\Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-40-document-denial-readiness -Reset test`, producing run id `2026-06-19T184747-545Z-modernized-openemr-plan-slice-40-document-denial-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-40-document-denial-readiness` in `parity-tests/`, producing matched comparison id `2026-06-19T184808-790Z-legacy-openemr-vs-modernized-openemr-plan-slice-40-document-denial-readiness`.

Primary files:

- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-document-denial/document-denial-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 066. Modernized Patient Document Metadata Slice 41

Commit: pending
Started: `2026-06-19T15:12:49-04:00`
Finished: `2026-06-19T15:17:49-04:00`

Implemented the forty-first modernized OpenEMR vertical slice: patient document metadata refiling, focused on creating a temporary document, editing its title, category, document date, linked encounter, and notes, rendering the refiled document, archiving it, deleting it, and proving the document baseline returns clean.

Key outcomes:

- Added an ASP.NET Core document metadata update endpoint for focused filing metadata changes without replacing document content.
- Added modernized Documents workspace inline Edit controls on document cards, plus viewer fields for category, document date, encounter, and notes.
- Added modernized smoke coverage for a temporary patient-document metadata lifecycle.
- Added shared legacy and modernized workflow adapter methods for `updatePatientDocumentMetadata`.
- Normalized legacy `documents.name`, `documents.docdate`, `documents.encounter_id`, `documents.documentationOf`, and `categories_to_documents.category_id` into the shared patient-document workflow record.
- Added the `workflow-document-metadata` Playwright parity suite and `slice-41-document-metadata-readiness` plan for both targets.
- Added Workbench commands/cards and result paths for the Slice 41 document metadata plan.
- Documented the legacy mapping, modernized endpoint, seed-data reuse, Workbench action, and side-by-side parity strategy.

Verified test runs:

- JSON parse validation for `parity-tests/test-manifest.json`, `parity-tests/package.json`, and `modernization-workbench/config/apps.json`.
- `npm run typecheck` in `parity-tests/`.
- `npm run typecheck` in `modernization-workbench/`.
- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `docker compose build api frontend` and `docker compose up -d api frontend` in `modernized-openemr/`.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001`; result status `passed`.
- Legacy parity run `2026-06-19T191653-632Z-legacy-openemr-plan-slice-41-document-metadata-readiness`; 1 expected, 1 passed.
- Modernized parity run `2026-06-19T191718-554Z-modernized-openemr-plan-slice-41-document-metadata-readiness`; 1 expected, 1 passed.
- Side-by-side comparison `2026-06-19T191737-183Z-legacy-openemr-vs-modernized-openemr-plan-slice-41-document-metadata-readiness`; status `matched`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/DocumentDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/DocumentRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-document-metadata/document-metadata-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 067. Modernized Patient Document Archive Restore Slice 42

Commit: this commit
Started: `2026-06-19T15:37:44-04:00`
Finished: `2026-06-19T15:43:51-04:00`

Implemented the forty-second modernized OpenEMR vertical slice: patient document archive restore, focused on creating a temporary document, archiving it, verifying active-list hiding and inaccessible content while archived, restoring it, rendering it again, deleting it, and proving the document baseline returns clean.

Key outcomes:

- Added active-only document retrieval by default and explicit `includeArchived=true` retrieval for archived document visibility.
- Added an ASP.NET Core document restore endpoint that sets archived patient documents back to active.
- Added the document `deleted` state to the modernized document DTO and frontend type model.
- Added modernized Documents workspace Show archived documents control, active/archived counts, Archived badges, disabled active-only actions on archived cards, and a Restore action.
- Added modernized smoke coverage for a temporary patient-document archive restore lifecycle.
- Added shared legacy and modernized workflow adapter methods for `restorePatientDocument`.
- Added the `workflow-document-archive` Playwright parity suite and `slice-42-document-archive-readiness` plan for both targets.
- Added Workbench commands/cards and result paths for the Slice 42 document archive restore plan.
- Documented the legacy mapping, modernized endpoint, seed-data reuse, Workbench action, and side-by-side parity strategy.

Verified test runs:

- JSON parse validation for `parity-tests/test-manifest.json`, `parity-tests/package.json`, and `modernization-workbench/config/apps.json`.
- `npm run typecheck` in `parity-tests/`.
- `npm run typecheck` in `modernization-workbench/`.
- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `docker compose build api frontend` in `modernized-openemr/`.
- `docker compose up -d api frontend` in `modernized-openemr/`.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001` passed 44 smoke checks, including `patient document archive restore lifecycle`.
- `scripts/Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-42-document-archive-readiness -Reset test` passed with run `2026-06-19T194247-753Z-legacy-openemr-plan-slice-42-document-archive-readiness`.
- `scripts/Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-42-document-archive-readiness -Reset test` passed with run `2026-06-19T194316-873Z-modernized-openemr-plan-slice-42-document-archive-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-42-document-archive-readiness` matched with comparison `2026-06-19T194337-353Z-legacy-openemr-vs-modernized-openemr-plan-slice-42-document-archive-readiness`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/DocumentDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/DocumentRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-document-archive/document-archive-restore.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 068. Modernized Patient Document Content Replacement Slice 43

Commit: this commit
Started: `2026-06-19T15:59:01-04:00`
Finished: `2026-06-19T16:03:50-04:00`

Implemented the forty-third modernized OpenEMR vertical slice: patient document content replacement, focused on creating a temporary text document, replacing its active payload, verifying updated preview/content/download behavior, rendering it again, archiving it, deleting it, and proving the document baseline returns clean.

Key outcomes:

- Added a modernized ASP.NET Core `PUT /api/documents/{documentId}/content` endpoint for active non-external document text payload replacement.
- Added a document content replacement DTO and repository mutation that updates text payload, MIME type, file name, size, hash, uploaded timestamp, and refreshed patient document list state.
- Added modernized Documents workspace Replace controls and an inline replacement form on active non-external document cards.
- Added frontend API typing and client wrapper for document content replacement.
- Added modernized smoke coverage for a temporary patient-document content replacement lifecycle.
- Added shared legacy and modernized workflow adapter methods for `replacePatientDocumentContent`.
- Added the `workflow-document-content-replace` Playwright parity suite and `slice-43-document-content-replace-readiness` plan for both targets.
- Added Workbench commands/cards and result paths for the Slice 43 document content replacement plan.
- Documented the legacy mapping, modernized endpoint, seed-data reuse, Workbench action, and side-by-side parity strategy.

Verified test runs:

- JSON parse validation for `parity-tests/test-manifest.json`, `parity-tests/package.json`, and `modernization-workbench/config/apps.json`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `docker compose build api frontend` in `modernized-openemr/`.
- `docker compose up -d api frontend` in `modernized-openemr/`.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001` passed 45 smoke checks, including `patient document content replacement lifecycle`.
- `scripts/Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-43-document-content-replace-readiness -Reset test` passed with run `2026-06-19T200257-450Z-legacy-openemr-plan-slice-43-document-content-replace-readiness`.
- `scripts/Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-43-document-content-replace-readiness -Reset test` passed with run `2026-06-19T200324-798Z-modernized-openemr-plan-slice-43-document-content-replace-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-43-document-content-replace-readiness` matched with comparison `2026-06-19T200344-356Z-legacy-openemr-vs-modernized-openemr-plan-slice-43-document-content-replace-readiness`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/DocumentDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/DocumentRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/tests/workflow-document-content-replace/document-content-replace.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 069. Modernized Fee-Sheet Diagnosis Coding Slice 44

Commit: this commit
Started: `2026-06-19T16:04:30-04:00`
Finished: `2026-06-19T16:23:31-04:00`

Implemented the forty-fourth modernized OpenEMR vertical slice: fee-sheet diagnosis coding, focused on creating a temporary `ICD10` billing row, rendering it in the legacy Fee Sheet and modernized Fees workspace, deactivating it, deleting it, and proving the billing baseline returns clean.

Key outcomes:

- Added modernized Fees workspace controls for creating `ICD10` diagnosis lines with zero fee and diagnosis-code justification.
- Reused the existing ASP.NET Core billing line endpoint and PostgreSQL billing row model for diagnosis rows, keeping CPT and diagnosis lifecycle behavior aligned.
- Added modernized smoke coverage for a temporary billing diagnosis lifecycle.
- Added the `workflow-billing-diagnosis` Playwright parity suite and `slice-44-billing-diagnosis-readiness` plan for both targets.
- Added Workbench commands/cards and result paths for the Slice 44 billing diagnosis plan.
- Updated the parity runner wrapper, package scripts, Workbench progress/architecture status, and synchronized project documents.

Verified test runs:

- JSON parse validation for `parity-tests/test-manifest.json`, `parity-tests/package.json`, and `modernization-workbench/config/apps.json`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `docker compose build api frontend` in `modernized-openemr/`.
- `docker compose up -d api frontend` in `modernized-openemr/`.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001` passed 46 smoke checks, including `billing diagnosis mutation lifecycle`.
- `scripts/Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-44-billing-diagnosis-readiness -Reset test` passed with run `2026-06-19T202235-458Z-legacy-openemr-plan-slice-44-billing-diagnosis-readiness`.
- `scripts/Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-44-billing-diagnosis-readiness -Reset test` passed with run `2026-06-19T202306-360Z-modernized-openemr-plan-slice-44-billing-diagnosis-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-44-billing-diagnosis-readiness` matched with comparison `2026-06-19T202323-899Z-legacy-openemr-vs-modernized-openemr-plan-slice-44-billing-diagnosis-readiness`.

Primary files:

- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/workflow-billing-diagnosis/diagnosis-line-mutation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 070. Modernized Fee-Sheet Charge Correction Slice 45

Commit: this commit
Started: `2026-06-19T16:24:30-04:00`
Finished: `2026-06-19T16:48:49-04:00`

Implemented the forty-fifth modernized OpenEMR vertical slice: fee-sheet charge correction, focused on creating a temporary CPT billing row, correcting its description, fee, units, and diagnosis justification, rendering the corrected line in the legacy Fee Sheet and modernized Fees workspace, deactivating it, deleting it, and proving the billing baseline returns clean.

Key outcomes:

- Added an ASP.NET Core billing line update endpoint for focused charge correction.
- Added modernized Fees workspace controls for selecting a billing line and submitting corrected description, fee, units, and justification values.
- Added modernized smoke coverage for a temporary billing correction lifecycle.
- Added shared legacy and modernized workflow adapter support for billing line correction.
- Added the `workflow-billing-correction` Playwright parity suite and `slice-45-billing-correction-readiness` plan for both targets.
- Added Workbench commands/cards and result paths for the Slice 45 billing correction plan.
- Updated the parity runner wrapper, package scripts, Workbench progress/architecture status, and synchronized project documents.

Verified test runs:

- JSON parse validation for `parity-tests/test-manifest.json`, `parity-tests/package.json`, and `modernization-workbench/config/apps.json`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `docker compose build api frontend` in `modernized-openemr/`.
- `docker compose up -d api frontend` in `modernized-openemr/`.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001` passed 47 smoke checks, including `billing correction mutation lifecycle`.
- `scripts/Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-45-billing-correction-readiness -Reset test` passed with run `2026-06-19T204759-012Z-legacy-openemr-plan-slice-45-billing-correction-readiness`.
- `scripts/Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-45-billing-correction-readiness -Reset test` passed with run `2026-06-19T204826-160Z-modernized-openemr-plan-slice-45-billing-correction-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-45-billing-correction-readiness` matched with comparison `2026-06-19T204843-842Z-legacy-openemr-vs-modernized-openemr-plan-slice-45-billing-correction-readiness`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/BillingDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/BillingRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/workflow-billing-correction/billing-line-correction.spec.ts`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 071. Modernized Fee-Sheet Modifier Slice 46

Commit: this commit
Started: `2026-06-19T17:09:42-04:00`
Finished: `2026-06-19T17:14:59-04:00`

Implemented the forty-sixth modernized OpenEMR vertical slice: fee-sheet modifier support, focused on carrying OpenEMR's `billing.modifier` field through the shared dataset, modernized PostgreSQL schema, ASP.NET Core billing API, React Fees workspace, smoke checks, and side-by-side parity testing.

Key outcomes:

- Added `modifier` to canonical billing rows and regenerated the shared gold dataset with 334 modifier-bearing CPT office-visit rows.
- Added PostgreSQL billing modifier schema/copy support for the modernized seed adapter.
- Added ASP.NET Core billing create/update/read support for modifiers.
- Added modifier inputs and modifier rendering to the modernized Fees workspace.
- Added modernized smoke coverage for a temporary billing modifier lifecycle.
- Added shared legacy and modernized workflow adapter support for billing modifiers.
- Added the `workflow-billing-modifier` Playwright parity suite and `slice-46-billing-modifier-readiness` plan for both targets.
- Added Workbench commands/cards and result paths for the Slice 46 billing modifier plan.
- Updated the parity runner wrapper, package scripts, Workbench progress/architecture status, and synchronized project documents.

Verified test runs:

- `npm run generate:seed-data` in `modernization-workbench/` regenerated the canonical and legacy SQL gold dataset artifacts with 3,000 billing rows and 334 modifier-bearing billing rows.
- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- `docker compose build api frontend` in `modernized-openemr/`.
- `docker compose up -d api frontend` in `modernized-openemr/`.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`; PostgreSQL billing table confirmed 3,000 billing rows and 334 modifier-bearing billing rows.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001` passed 48 smoke checks, including `billing modifier mutation lifecycle`.
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`; MariaDB billing table confirmed 3,000 billing rows and 334 modifier-bearing billing rows.
- `scripts/Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-46-billing-modifier-readiness -Reset test` passed with run `2026-06-19T211403-807Z-legacy-openemr-plan-slice-46-billing-modifier-readiness`.
- `scripts/Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-46-billing-modifier-readiness -Reset test` passed with run `2026-06-19T211433-788Z-modernized-openemr-plan-slice-46-billing-modifier-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-46-billing-modifier-readiness` matched with comparison `2026-06-19T211450-872Z-legacy-openemr-vs-modernized-openemr-plan-slice-46-billing-modifier-readiness`.

Primary files:

- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/scripts/generate-gold-dataset.mjs`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/canonical/gold-dataset.json`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/legacy-mariadb/seed-gold.sql`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/BillingDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/BillingRepository.cs`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/workflow-billing-modifier/billing-line-modifier.spec.ts`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 072. Modernized Claim Status Slice 47

Commit: this commit
Started: `2026-06-19T17:32:34-04:00`
Finished: `2026-06-19T17:41:40-04:00`

Implemented the forty-seventh modernized OpenEMR vertical slice: read-only claim status visibility, focused on carrying OpenEMR's native `claims` rows through the shared dataset, modernized PostgreSQL schema, ASP.NET Core billing API, React Fees workspace, smoke checks, and side-by-side parity testing.

Key outcomes:

- Added 700 deterministic claim status rows to the canonical gold dataset and legacy MariaDB seed output.
- Stabilized `MOD-PAT-0005` with queued, generated-to-file, and cleared claim examples for repeatable parity checks.
- Added PostgreSQL `claims` schema/copy support for the modernized seed adapter.
- Added ASP.NET Core billing read support for claim status rows attached to billing encounters.
- Added claim status cards, counts, payer, target, process file, and submitted-payload visibility to the modernized Fees workspace.
- Added modernized smoke coverage for the anchor claim status summary.
- Added shared legacy and modernized database probes for normalized claim status facts.
- Added the `claims` Playwright parity suite and `slice-47-claim-status-readiness` plan for both targets.
- Added Workbench commands/cards and result paths for the Slice 47 claim status plan.
- Updated the parity runner wrapper, package scripts, Workbench progress/architecture status, and synchronized project documents.

Verified test runs:

- `npm run generate:seed-data` in `modernization-workbench/` regenerated the canonical and legacy SQL gold dataset artifacts with 700 claim status rows.
- `node scripts/generate-postgres-seed.mjs` in `modernized-openemr/` regenerated the PostgreSQL seed artifact with 700 claim rows.
- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` in `modernized-openemr/`.
- `docker compose up -d api frontend` in `modernized-openemr/`.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`; PostgreSQL `claims` table confirmed 700 rows.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001` passed 49 smoke checks, including `anchor claim status summary`.
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`; MariaDB `claims` table confirmed 700 rows.
- `scripts/Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-47-claim-status-readiness -Reset run` passed with run `2026-06-19T214103-328Z-legacy-openemr-plan-slice-47-claim-status-readiness`.
- `scripts/Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-47-claim-status-readiness -Reset run` passed with run `2026-06-19T214117-354Z-modernized-openemr-plan-slice-47-claim-status-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-47-claim-status-readiness` matched with comparison `2026-06-19T214131-925Z-legacy-openemr-vs-modernized-openemr-plan-slice-47-claim-status-readiness`.

Primary files:

- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/scripts/generate-gold-dataset.mjs`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/canonical/gold-dataset.json`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/legacy-mariadb/seed-gold.sql`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/BillingDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/BillingRepository.cs`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/claims/claim-status.spec.ts`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 073. Modernized Payment Posting Slice 48

Commit: this commit
Started: `2026-06-19T17:42:00-04:00`
Finished: `2026-06-19T18:09:02-04:00`

Implemented the forty-eighth modernized OpenEMR vertical slice: read-only payment posting visibility, focused on carrying OpenEMR's native `ar_session` and `ar_activity` rows through the shared dataset, modernized PostgreSQL schema, ASP.NET Core billing API, React Fees workspace, smoke checks, Workbench actions, and side-by-side parity testing.

Key outcomes:

- Added 420 deterministic payment sessions and 617 payment activity rows to the canonical gold dataset and legacy MariaDB seed output.
- Stabilized `MOD-PAT-0005` encounter `1000052` with insurance payment reference `EOB-NSTAR-1000052`, payer `Northstar HMO`, payment `$126.00`, adjustment `$42.00`, reason `CO-45`, and payer claim number `NSTAR-CLM-1000052`.
- Added PostgreSQL `payment_sessions` and `payment_activities` schema/copy support for the modernized seed adapter.
- Added ASP.NET Core billing read support for payment postings attached to billing encounters.
- Added payment posting cards, payer/reference data, payment method, post date, paid amount, adjusted amount, account/reason codes, and payer-claim-number visibility to the modernized Fees workspace.
- Added modernized smoke coverage for the anchor payment posting summary.
- Added shared legacy and modernized database probes for normalized payment posting facts.
- Added the `payments` Playwright parity suite and `slice-48-payment-posting-readiness` plan for both targets.
- Added Workbench commands/cards and result paths for the Slice 48 payment posting plan.
- Updated the parity runner wrapper, package scripts, Workbench progress/architecture status, seed-data README, and synchronized project documents.

Verified test runs:

- `npm run generate:seed-data` in `modernization-workbench/` regenerated the canonical and legacy SQL gold dataset artifacts with 420 payment sessions and 617 payment activity rows.
- `node scripts/generate-postgres-seed.mjs` in `modernized-openemr/` regenerated the PostgreSQL seed artifact with payment session/activity tables.
- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, `parity-tests/package.json`, and the generated seed summary.
- `docker compose build api frontend` in `modernized-openemr/`.
- `docker compose up -d postgres api frontend` in `modernized-openemr/`.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`; PostgreSQL seed output confirmed 420 payment sessions and 617 payment activities.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001` passed 50 smoke checks, including `anchor payment posting summary`.
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`; MariaDB `ar_session` and `ar_activity` counts confirmed 420 and 617 rows, with payment-posting temporal coverage validated.
- `scripts/Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-48-payment-posting-readiness -Reset run` passed with run `2026-06-19T220824-842Z-legacy-openemr-plan-slice-48-payment-posting-readiness`.
- `scripts/Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-48-payment-posting-readiness -Reset run` passed with run `2026-06-19T220840-800Z-modernized-openemr-plan-slice-48-payment-posting-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-48-payment-posting-readiness` matched with comparison `2026-06-19T220856-893Z-legacy-openemr-vs-modernized-openemr-plan-slice-48-payment-posting-readiness`.

Primary files:

- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/scripts/generate-gold-dataset.mjs`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/canonical/gold-dataset.json`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/legacy-mariadb/seed-gold.sql`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/summary.json`
- `modernized-openemr/scripts/generate-postgres-seed.mjs`
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/BillingDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/BillingRepository.cs`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/payments/payment-posting.spec.ts`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `modernization-workbench/seed-data/openemr-shared-synthetic-v1/README.md`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 074. Modernized Account Balance Slice 49

Commit: this commit
Started: `2026-06-19T18:10:00-04:00`
Finished: `2026-06-19T18:36:00-04:00`

Implemented the forty-ninth modernized OpenEMR vertical slice: read-only account balance visibility, focused on computing patient-level and encounter-level charge, payment, adjustment, and remaining-balance totals from the existing gold billing and payment-posting records.

Key outcomes:

- Added ASP.NET Core billing account summaries to the patient billing response.
- Computed per-encounter charge, payment, adjustment, and balance rollups from active billing lines and payment activities.
- Added an Account Balance panel to the modernized Fees workspace and surfaced per-encounter balance facts beside billing lines, claims, and payments.
- Added modernized smoke coverage for the `MOD-PAT-0005` account balance anchor.
- Added normalized legacy MariaDB and modernized PostgreSQL account-balance probes.
- Added the `account-balance` Playwright parity suite and `slice-49-account-balance-readiness` plan for both targets.
- Added Workbench commands/cards and result paths for the Slice 49 account balance plan.
- Completed the Workbench client architecture-model builder required by the enriched architecture API client types.
- Updated the parity runner wrapper, package scripts, Workbench progress/architecture status, and synchronized project documents.
- Reused the existing gold billing, claim, and payment-posting records; no new seed-data records were required for this slice.

Verified test runs:

- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run typecheck` in `parity-tests/`.
- `npm run build` in `modernization-workbench/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `git diff --check`.
- `docker compose build api frontend` in `modernized-openemr/`.
- `docker compose up -d postgres api frontend` in `modernized-openemr/`.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001` passed 51 smoke checks, including `anchor account balance summary`.
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`; MariaDB seed output confirmed 617 payment activities and the existing billing/payment records used by the balance rollups.
- `scripts/Run-OpenEmrParityTests.ps1 -Target modernized-openemr -Plan slice-49-account-balance-readiness -Reset run` passed with run `2026-06-19T223510-827Z-modernized-openemr-plan-slice-49-account-balance-readiness`.
- `scripts/Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan slice-49-account-balance-readiness -Reset run` passed with run `2026-06-19T223536-846Z-legacy-openemr-plan-slice-49-account-balance-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-49-account-balance-readiness` matched with comparison `2026-06-19T223554-291Z-legacy-openemr-vs-modernized-openemr-plan-slice-49-account-balance-readiness`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/BillingDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/BillingRepository.cs`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/account-balance/account-balance.spec.ts`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `modernization-workbench/src/architectureModel.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 075. Workbench Architecture Screen Redesigned

Commit: this commit
Started: `2026-06-19T18:37:00-04:00`
Finished: `2026-06-19T18:47:04-04:00`

Redesigned the Modernization Workbench Architecture page from a flat three-card summary into a visual, tabbed architecture map for the three project systems: legacy OpenEMR, the Modernization Workbench, and modernized OpenEMR.

Key outcomes:

- Added a versioned architecture model for technology chips, comparison layers, topology diagrams, per-system diagrams, narratives, responsibilities, evidence notes, and architecture decisions.
- Added the Architecture Overview tab with a stack matrix grouped by UI technology, server-side technology, data stores, runtime/orchestration, and tests/evidence.
- Added system detail tabs for legacy OpenEMR, the Workbench, and modernized OpenEMR.
- Added logo-style chips for major technologies with explicit versions, including OpenEMR, PHP, Apache, MariaDB, React, TypeScript, Vite, Node.js, Express, ASP.NET Core, .NET, Npgsql, PostgreSQL, Docker Compose, PHPUnit, Jest, and Playwright.
- Updated the architecture endpoint's existing stack summaries to include verified or pinned version numbers.
- Updated Workbench documentation so the Architecture page behavior and version-source expectations are durable project guidance.

Verified test runs:

- `npm run build` in `modernization-workbench/`.
- `git diff --check`.
- `Invoke-WebRequest http://127.0.0.1:5173` returned HTTP 200.
- `Invoke-WebRequest http://127.0.0.1:5174/api/architecture` returned HTTP 200 with the three expected systems.
- Local version checks verified Docker Compose `v5.0.2`, Node.js `v24.13.1`, ASP.NET Core runtime `10.0.9`, PHP `8.5.6`, Apache/httpd `2.4.67`, MariaDB `11.8.8`, PostgreSQL `17.10`, and package-lock versions for React, TypeScript, Vite, and Express.
- Browser smoke check opened `http://127.0.0.1:5173/#/architecture` in desktop `1440x1000` and mobile `390x900` viewports, verified key Architecture page text, and confirmed no body-level horizontal overflow.

Primary files:

- `modernization-workbench/src/App.tsx`
- `modernization-workbench/src/architectureModel.ts`
- `modernization-workbench/src/styles.css`
- `modernization-workbench/server/index.ts`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/PROJECT_CHANGELOG.md`

### 076. Modernized Account Aging Slice 50

Commit: this commit
Started: `2026-06-19T18:48:00-04:00`
Finished: `2026-06-19T19:15:21-04:00`

Implemented the fiftieth modernized OpenEMR vertical slice: read-only account aging visibility, focused on deriving deterministic Current, 31-60, 61-90, and Over 90 AR buckets from the existing seeded billing and payment-posting records.

Key outcomes:

- Added billing aging DTO fields to the ASP.NET Core billing response and encounter rows.
- Computed patient-level aging totals from the shared dataset base date `2026-06-18`.
- Rendered an Aging Summary panel in the modernized Fees workspace with per-encounter aging bucket and age-day labels.
- Added modernized smoke coverage for the `MOD-PAT-0005` account aging anchor.
- Added normalized legacy MariaDB and modernized PostgreSQL account-aging probes.
- Added the `account-aging` parity suite and `slice-50-account-aging-readiness` plan.
- Added Workbench commands/cards and result paths for the Slice 50 account aging plan.
- Updated the parity runner wrapper, package scripts, Workbench progress/architecture status, and synchronized project documents.
- Reused the existing gold billing and payment-posting records; no new seed-data records were required for this slice.

Verified test runs:

- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `npm run typecheck` in `parity-tests/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` in `modernized-openemr/`.
- `docker compose up -d postgres api frontend` in `modernized-openemr/`.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001` passed 52 smoke checks, including `anchor account aging summary`.
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`.
- `npm run test:legacy:plan:account-aging` passed with run `2026-06-19T231431-060Z-legacy-openemr-plan-slice-50-account-aging-readiness`.
- `npm run test:modernized:plan:account-aging` passed with run `2026-06-19T231452-764Z-modernized-openemr-plan-slice-50-account-aging-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-50-account-aging-readiness` matched with comparison `2026-06-19T231514-900Z-legacy-openemr-vs-modernized-openemr-plan-slice-50-account-aging-readiness`.
- `git diff --check`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/BillingDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/BillingRepository.cs`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/account-aging/account-aging.spec.ts`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `modernization-workbench/src/architectureModel.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 077. Modernized Account Ledger Slice 51

Commit: this commit
Started: `2026-06-19T19:31:38-04:00`
Finished: `2026-06-19T19:43:47-04:00`

Implemented the fifty-first modernized OpenEMR vertical slice: read-only account ledger visibility, focused on deriving chronological charge, payment, adjustment, and running-balance rows from the existing seeded fee-sheet billing and payment-posting records.

Key outcomes:

- Added account ledger DTO fields to the ASP.NET Core billing response.
- Built canonical ledger entries from billing rows and AR/payment activity rows using a stable date, encounter, type, code, description, and reference ordering.
- Added patient-level ledger summary totals for entry count, first/last entry dates, charges, payments, adjustments, and ending balance.
- Rendered an Account Ledger panel in the modernized Fees workspace with per-entry amount, code/reference, and running balance details.
- Added modernized smoke coverage for the `MOD-PAT-0005` account ledger anchor.
- Added normalized legacy MariaDB and modernized PostgreSQL account-ledger probes.
- Added the `account-ledger` parity suite and `slice-51-account-ledger-readiness` plan.
- Added Workbench commands/cards and result paths for the Slice 51 account ledger plan.
- Updated the parity runner wrapper, package scripts, Workbench progress/architecture status, and synchronized project documents.
- Reused the existing gold billing and payment-posting records; no new seed-data records were required for this slice.

Verified test runs:

- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `npm run typecheck` in `parity-tests/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` in `modernized-openemr/`.
- `docker compose up -d postgres api frontend` in `modernized-openemr/`.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001` passed 53 smoke checks, including `anchor account ledger summary`.
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`.
- `npm run test:legacy:plan:account-ledger` passed with run `2026-06-19T234306-319Z-legacy-openemr-plan-slice-51-account-ledger-readiness`.
- `npm run test:modernized:plan:account-ledger` passed with run `2026-06-19T234323-081Z-modernized-openemr-plan-slice-51-account-ledger-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-51-account-ledger-readiness` matched with comparison `2026-06-19T234339-578Z-legacy-openemr-vs-modernized-openemr-plan-slice-51-account-ledger-readiness`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/BillingDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/BillingRepository.cs`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/account-ledger/account-ledger.spec.ts`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `modernization-workbench/src/architectureModel.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 078. Modernized Account Statement Slice 52

Commit: this commit
Started: `2026-06-19T19:48:00-04:00`
Finished: `2026-06-19T20:08:55-04:00`

Implemented the fifty-second modernized OpenEMR vertical slice: read-only account statement readiness, focused on deriving statement recipient, mailing address, statement period, due date, current-due amount, past-due amount, oldest-open balance age, and balance-due facts from the existing seeded demographics, fee-sheet billing, payment-posting, account aging, and account ledger records.

Key outcomes:

- Added account statement summary DTO fields to the ASP.NET Core billing response.
- Built canonical statement-readiness facts from the stable `MOD-PAT-0005` billing anchor, including recipient/contact details, open encounter count, ledger count, total charges, total payments, total adjustments, current due, past due, balance due, and statement status.
- Rendered a Statement Readiness panel in the modernized Fees workspace with status, balance, period, due date, address, phone, current/past due, oldest open balance, and ledger-entry facts.
- Added modernized smoke coverage for the `MOD-PAT-0005` account statement readiness anchor.
- Added normalized legacy MariaDB and modernized PostgreSQL account-statement probes.
- Added the `account-statement` parity suite and `slice-52-account-statement-readiness` plan.
- Added Workbench commands/cards and result paths for the Slice 52 account statement plan.
- Updated the parity runner wrapper, package scripts, Workbench progress/architecture status, and synchronized project documents.
- Reused the existing gold demographics, billing, payment-posting, account aging, and account ledger records; no new seed-data records were required for this slice.

Verified test runs:

- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `npm run typecheck` in `parity-tests/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` in `modernized-openemr/`.
- `docker compose up -d postgres api frontend` in `modernized-openemr/`.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001` passed 54 smoke checks, including `anchor account statement readiness`.
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`.
- `npm run test:legacy:plan:account-statement` passed with run `2026-06-20T000809-690Z-legacy-openemr-plan-slice-52-account-statement-readiness`.
- `npm run test:modernized:plan:account-statement` passed with run `2026-06-20T000827-804Z-modernized-openemr-plan-slice-52-account-statement-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-52-account-statement-readiness` matched with comparison `2026-06-20T000844-869Z-legacy-openemr-vs-modernized-openemr-plan-slice-52-account-statement-readiness`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/BillingDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/BillingRepository.cs`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/account-statement/account-statement.spec.ts`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `modernization-workbench/src/architectureModel.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 079. Modernized Document Preview Slice 53

Commit: this commit
Started: `2026-06-19T20:10:00-04:00`
Finished: `2026-06-19T20:37:56-04:00`

Implemented the fifty-third modernized OpenEMR vertical slice: read-only patient document preview readiness, focused on deriving preview kind, preview status, inline-preview capability, thumbnail labels, and thumbnail text from existing seeded patient-document metadata and stored text payloads.

Key outcomes:

- Added document preview readiness DTO fields to the ASP.NET Core document list and content responses.
- Built canonical preview facts for text, PDF, image, external-link, and binary document shapes without adding new seed records.
- Rendered a compact thumbnail/readiness row in the modernized Documents workspace for seeded patient documents.
- Added modernized smoke coverage for the `MOD-PAT-0001` document preview readiness anchor.
- Added shared legacy MariaDB and modernized PostgreSQL preview normalization logic.
- Added the `document-preview` parity suite and `slice-53-document-preview-readiness` plan.
- Added Workbench commands/cards and result paths for the Slice 53 document preview plan.
- Updated the parity runner wrapper, package scripts, Workbench progress/architecture status, and synchronized project documents.
- Reused the existing gold patient-document metadata and stored text payloads; no new seed-data records were required for this slice.

Verified test runs:

- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `npm run typecheck` in `parity-tests/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` in `modernized-openemr/`.
- `docker compose up -d postgres api frontend` in `modernized-openemr/`.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001` passed 55 smoke checks, including `anchor patient document preview readiness`.
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`.
- `npm run test:legacy:plan:document-preview` passed with run `2026-06-20T003711-378Z-legacy-openemr-plan-slice-53-document-preview-readiness`.
- `npm run test:modernized:plan:document-preview` passed with run `2026-06-20T003733-979Z-modernized-openemr-plan-slice-53-document-preview-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-53-document-preview-readiness` matched with comparison `2026-06-20T003749-954Z-legacy-openemr-vs-modernized-openemr-plan-slice-53-document-preview-readiness`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/DocumentDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/DocumentRepository.cs`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/document-preview/document-preview.spec.ts`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `modernization-workbench/src/architectureModel.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 080. Modernized Document Revision Slice 54

Commit: this commit
Started: `2026-06-19T20:38:00-04:00`
Finished: `2026-06-19T20:59:54-04:00`

Implemented the fifty-fourth modernized OpenEMR vertical slice: read-only patient document revision readiness, focused on exposing current revision/version facts from existing seeded document metadata so the modernized Documents workspace can show the same current-version state as the legacy baseline.

Key outcomes:

- Added current-version DTO fields to the ASP.NET Core document list and content responses: revision timestamp, version number, version label, version status, history count, prior-version state, and revision hash.
- Mapped legacy `documents.revision` and modernized `uploaded_at` into a shared read-only revision-readiness contract without adding new seed records.
- Rendered document revision facts in the modernized Documents workspace, including document cards, latest filing details, and the document viewer metadata.
- Added modernized smoke coverage for the `MOD-PAT-0001` document revision readiness anchor.
- Added shared legacy MariaDB and modernized PostgreSQL revision normalization logic.
- Added the `document-revision` parity suite and `slice-54-document-revision-readiness` plan.
- Added Workbench commands/cards and result paths for the Slice 54 document revision plan.
- Updated the parity runner wrapper, package scripts, Workbench progress/architecture status, and synchronized project documents.
- Reused the existing gold patient-document metadata and hashes; no new seed-data records were required for this slice.

Verified test runs:

- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `npm run typecheck` in `parity-tests/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose build api frontend` in `modernized-openemr/`.
- `docker compose up -d postgres api frontend` in `modernized-openemr/`.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001` passed 56 smoke checks, including `anchor patient document revision readiness`.
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`.
- `npm run test:legacy:plan:document-revision` passed with run `2026-06-20T005912-657Z-legacy-openemr-plan-slice-54-document-revision-readiness`.
- `npm run test:modernized:plan:document-revision` passed with run `2026-06-20T005929-781Z-modernized-openemr-plan-slice-54-document-revision-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-54-document-revision-readiness` matched with comparison `2026-06-20T005946-834Z-legacy-openemr-vs-modernized-openemr-plan-slice-54-document-revision-readiness`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/DocumentDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/DocumentRepository.cs`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/document-revision/document-revision.spec.ts`
- `parity-tests/src/db/legacyMariaDbProbe.ts`
- `parity-tests/src/db/modernizedPostgresProbe.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `modernization-workbench/src/architectureModel.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 081. Modernized Document Replacement Revision Slice 55

Commit: this commit
Started: `2026-06-19T21:00:00-04:00`
Finished: `2026-06-19T21:22:00-04:00`

Implemented the fifty-fifth modernized OpenEMR vertical slice: patient document replacement revision readiness, focused on proving that content replacement updates the current document revision timestamp and hash in place while preserving OpenEMR's single-current-version behavior.

Key outcomes:

- Added the `workflow-document-revision-replace` parity suite for temporary document create, replace, revision verification, archive, and cleanup.
- Added the `slice-55-document-revision-replace-readiness` plan for both legacy and modernized targets.
- Verified legacy `documents.revision` and `documents.hash` advance after replacement without exposing prior-version rows.
- Verified modernized replacement revision behavior through the existing ASP.NET Core document replacement endpoint and revision DTO fields.
- Verified browser-visible modernized Documents rendering after replacement, including replacement content, `Version 1 / Current version`, and no-prior-version state.
- Added modernized smoke coverage for the temporary document replacement revision lifecycle.
- Added Workbench commands/cards and result paths for the Slice 55 document replacement revision plan.
- Updated the parity runner wrapper, package scripts, Workbench progress/architecture status, and synchronized project documents.
- Reused temporary `MOD-PAT-0001` document records; no permanent gold seed-data records were added for this slice.

Verified test runs:

- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `npm run typecheck` in `parity-tests/`.
- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `docker compose up -d postgres api frontend` in `modernized-openemr/`.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001` passed 57 smoke checks, including `patient document replacement revision lifecycle`.
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`.
- `npm run test:legacy:plan:document-revision-replace` passed with run `2026-06-20T012058-218Z-legacy-openemr-plan-slice-55-document-revision-replace-readiness`.
- `npm run test:modernized:plan:document-revision-replace` passed with run `2026-06-20T012127-152Z-modernized-openemr-plan-slice-55-document-revision-replace-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-55-document-revision-replace-readiness` matched with comparison `2026-06-20T012149-094Z-legacy-openemr-vs-modernized-openemr-plan-slice-55-document-revision-replace-readiness`.

Primary files:

- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/workflow-document-revision-replace/document-revision-replace.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/App.tsx`
- `modernization-workbench/src/architectureModel.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 082. Modernized Payment Posting Mutation Slice 56

Commit: this commit
Started: `2026-06-19T21:23:00-04:00`
Finished: `2026-06-19T21:58:18-04:00`

Implemented the fifty-sixth modernized OpenEMR vertical slice: payment posting mutation readiness, focused on proving a temporary AR payment posting can be created, rendered, voided, removed from active balance/ledger calculations, and hard-deleted in both legacy OpenEMR and the modernized target.

Key outcomes:

- Added payment posting create, void, and delete endpoints to the modernized ASP.NET Core billing API.
- Added modernized PostgreSQL payment activity identifiers to billing DTOs so active payment rows can be mutated safely.
- Added a React Fees Payment Posting form plus active-row Void and Delete controls.
- Added legacy and modernized workflow action adapters for temporary AR payment posting create/read/void/delete behavior.
- Added the `workflow-payment-posting` parity suite and `slice-56-payment-posting-mutation-readiness` plan for both legacy and modernized targets.
- Verified account balance and account ledger effects after create, verified active-row hiding and balance rollback after void, and verified cleanup returns payment session/activity counts to baseline.
- Added modernized smoke coverage for the payment posting mutation lifecycle.
- Added Workbench commands/cards and result paths for the Slice 56 payment posting mutation plan.
- Updated the parity runner wrapper, package scripts, Workbench progress/architecture status, and synchronized project documents.
- Reused the existing `MOD-PAT-0005` billing/payment anchor; no permanent gold seed-data records were added for this slice.

Verified test runs:

- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `npm run typecheck` in `parity-tests/`.
- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `docker compose up -d --build api frontend` in `modernized-openemr/` so the running API container included the new payment endpoints.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001` passed 58 smoke checks, including `payment posting mutation lifecycle`.
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`.
- `npm run test:legacy:plan:payment-posting-mutation` passed with run `2026-06-20T014543-567Z-legacy-openemr-plan-slice-56-payment-posting-mutation-readiness`.
- `npm run test:modernized:plan:payment-posting-mutation` passed with run `2026-06-20T014608-516Z-modernized-openemr-plan-slice-56-payment-posting-mutation-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-56-payment-posting-mutation-readiness` matched with comparison `2026-06-20T014648-029Z-legacy-openemr-vs-modernized-openemr-plan-slice-56-payment-posting-mutation-readiness`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/BillingDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/BillingRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/workflow-payment-posting/payment-posting-mutation.spec.ts`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/architectureModel.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 083. Modernized Claim Status Mutation Slice 57

Commit: this commit
Started: `2026-06-19T22:00:00-04:00`
Finished: `2026-06-19T22:27:00-04:00`

Implemented the fifty-seventh modernized OpenEMR vertical slice: claim status mutation readiness, focused on proving a temporary claim can be created, rendered, moved through generated and cleared states, and hard-deleted in both legacy OpenEMR and the modernized target.

Key outcomes:

- Added claim status create, status update, and delete endpoints to the modernized ASP.NET Core billing API.
- Added modernized claim identifiers to billing DTOs so individual claim rows can be mutated safely.
- Added a React Fees Claim Status form plus row-level Generate, Clear, and Delete controls.
- Added legacy and modernized workflow action adapters for temporary claim create/read/update/delete behavior.
- Added the `workflow-claims` parity suite and `slice-57-claim-status-mutation-readiness` plan for both legacy and modernized targets.
- Verified queued claim creation, generated X12/file state, cleared HCFA/no-file state, browser-visible modernized Fees rendering, and cleanup back to seeded claim counts.
- Added modernized smoke coverage for the claim status mutation lifecycle.
- Added Workbench commands/cards and result paths for the Slice 57 claim status mutation plan.
- Updated the parity runner wrapper, package scripts, Workbench progress/architecture status, and synchronized project documents.
- Reused the existing `MOD-PAT-0005` billing/claim anchor; no permanent gold seed-data records were added for this slice.

Verified test runs:

- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `npm run typecheck` in `parity-tests/`.
- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `docker compose up -d --build api frontend` in `modernized-openemr/` so the running API container included the new claim endpoints.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001` passed 59 smoke checks, including `claim status mutation lifecycle`.
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`.
- `npm run test:legacy:plan:claim-status-mutation` passed with run `2026-06-20T022609-664Z-legacy-openemr-plan-slice-57-claim-status-mutation-readiness`.
- `npm run test:modernized:plan:claim-status-mutation` passed with run `2026-06-20T022633-706Z-modernized-openemr-plan-slice-57-claim-status-mutation-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-57-claim-status-mutation-readiness` matched with comparison `2026-06-20T022655-945Z-legacy-openemr-vs-modernized-openemr-plan-slice-57-claim-status-mutation-readiness`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/BillingDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/BillingRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/workflow-claims/claim-status-mutation.spec.ts`
- `parity-tests/src/workflows/legacyWorkflowActions.ts`
- `parity-tests/src/workflows/modernizedWorkflowActions.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/architectureModel.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 084. Modernized Patient Payment Capture Slice 58

Commit: this commit
Started: `2026-06-19T22:28:00-04:00`
Finished: `2026-06-19T22:54:00-04:00`

Implemented the fifty-eighth modernized OpenEMR vertical slice: patient payment capture readiness, focused on proving a temporary patient-responsibility payment can be created, rendered, voided, and hard-deleted in both legacy OpenEMR and the modernized target.

Key outcomes:

- Updated the modernized ASP.NET Core billing payment-create path to accept patient-responsibility payments with `payer_id = 0` and `payer_type = 0`.
- Added React Fees source-aware payment posting controls so operators can choose Insurance or Patient payments, while patient payments hide insurance-only adjustment, reason, and payer-claim fields.
- Added patient-payment display formatting so payer-type-zero rows render as `Patient` in the modernized Fees workspace.
- Added modernized smoke coverage for the patient payment capture lifecycle, including create, visible active payment, balance impact, void, balance rollback, and hard-delete cleanup.
- Added the `workflow-patient-payments` parity suite and `slice-58-patient-payment-capture-readiness` plan for both legacy and modernized targets.
- Added Workbench commands/cards and result paths for the Slice 58 patient payment capture plan.
- Updated the parity runner wrapper, package scripts, Workbench progress/architecture status, and synchronized project documents.
- Reused the existing `MOD-PAT-0005` billing/payment anchor; no permanent gold seed-data records were added for this slice.

Verified test runs:

- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `npm run typecheck` in `parity-tests/`.
- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `docker compose up -d --build api frontend` in `modernized-openemr/` so the running API and UI containers included the patient payment capture changes.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001` passed 60 smoke checks, including `patient payment capture lifecycle`.
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`.
- `npm run test:legacy:plan:patient-payment-capture` passed with run `2026-06-20T025257-662Z-legacy-openemr-plan-slice-58-patient-payment-capture-readiness`.
- `npm run test:modernized:plan:patient-payment-capture` passed with run `2026-06-20T025324-729Z-modernized-openemr-plan-slice-58-patient-payment-capture-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-58-patient-payment-capture-readiness` matched with comparison `2026-06-20T025350-379Z-legacy-openemr-vs-modernized-openemr-plan-slice-58-patient-payment-capture-readiness`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/BillingRepository.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/workflow-patient-payments/patient-payment-capture.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/architectureModel.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 085. Modernized Statement Generation Slice 59

Commit: this commit
Started: `2026-06-19T22:55:00-04:00`
Finished: `2026-06-19T23:22:00-04:00`

Implemented the fifty-ninth modernized OpenEMR vertical slice: statement generation readiness, focused on proving a deterministic printable patient statement can be generated from the same legacy and modernized billing ledger facts.

Key outcomes:

- Added a modernized billing `statementDocument` contract with statement number, title, status, period, statement date, due date, recipient/address, payment instructions, generated text, totals, and normalized line items.
- Derived the statement document from the existing `MOD-PAT-0005` statement readiness summary and chronological billing ledger, with no permanent gold-data additions.
- Added React Fees workspace rendering for the Patient Statement panel, payment instructions, generated statement text, and statement line-item rows.
- Added modernized smoke coverage for the anchor patient statement generation document.
- Added the `account-statement-generation` parity suite and `slice-59-statement-generation-readiness` plan for both legacy and modernized targets.
- Added Workbench commands/cards and result paths for the Slice 59 statement generation plan.
- Updated the parity runner wrapper, package scripts, Workbench progress/architecture status, and synchronized project documents.

Verified test runs:

- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `npm run typecheck` in `parity-tests/`.
- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `docker compose up -d --build api frontend` in `modernized-openemr/` so the running API and UI containers included the statement generation changes.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001` passed 61 smoke checks, including `anchor patient statement generation`.
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`.
- `npm run test:legacy:plan:statement-generation` passed with run `2026-06-20T032023-648Z-legacy-openemr-plan-slice-59-statement-generation-readiness`.
- `npm run test:modernized:plan:statement-generation` passed with run `2026-06-20T032044-765Z-modernized-openemr-plan-slice-59-statement-generation-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-59-statement-generation-readiness` matched with comparison `2026-06-20T032106-276Z-legacy-openemr-vs-modernized-openemr-plan-slice-59-statement-generation-readiness`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Models/BillingDtos.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/BillingRepository.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/account-statement-generation/account-statement-generation.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/architectureModel.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

### 086. Modernized Statement PDF Export Slice 60

Commit: this commit
Started: `2026-06-19T23:23:00-04:00`
Finished: `2026-06-19T23:47:17-04:00`

Implemented the sixtieth modernized OpenEMR vertical slice: patient statement PDF export readiness, focused on proving the generated statement document can be exported as deterministic PDF content and launched from the modernized Fees workspace.

Key outcomes:

- Added a modernized billing statement PDF endpoint at `GET /api/billing/{patientId}/statement.pdf`, returning `application/pdf` content named with the generated statement number.
- Added a React Fees `PDF Export` action in the Patient Statement panel with the expected statement-specific download filename.
- Added modernized smoke coverage for the anchor statement PDF export response, including response headers, PDF header, statement number, payment instructions, EOB-backed payment line, and PDF filename.
- Added the `account-statement-pdf` parity suite and `slice-60-statement-pdf-export-readiness` plan for both legacy and modernized targets.
- Added Workbench commands/cards and result paths for the Slice 60 statement PDF export plan.
- Updated the parity runner wrapper, package scripts, Workbench progress/architecture status, and synchronized project documents.
- Reused the existing `MOD-PAT-0005` billing/payment/account-statement anchor; no permanent gold seed-data records were added for this slice.

Verified test runs:

- JSON validation for `modernization-workbench/config/apps.json`, `parity-tests/test-manifest.json`, and `parity-tests/package.json`.
- `npm run typecheck` in `parity-tests/`.
- `dotnet build modernized-openemr\OpenEmr.Modernized.slnx`.
- `npm run build` in `modernized-openemr/frontend/`.
- `npm run build` in `modernization-workbench/`.
- `docker compose up -d --build api frontend` in `modernized-openemr/` so the running API and UI containers included the statement PDF export changes.
- `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`.
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1 -ApiBaseUrl http://localhost:5001` passed 62 smoke checks, including `anchor patient statement PDF export`.
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`.
- `npm run test:legacy:plan:statement-pdf` passed with run `2026-06-20T034558-283Z-legacy-openemr-plan-slice-60-statement-pdf-export-readiness`.
- `npm run test:modernized:plan:statement-pdf` passed with run `2026-06-20T034651-650Z-modernized-openemr-plan-slice-60-statement-pdf-export-readiness`.
- `npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-60-statement-pdf-export-readiness` matched with comparison `2026-06-20T034712-054Z-legacy-openemr-vs-modernized-openemr-plan-slice-60-statement-pdf-export-readiness`.

Primary files:

- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Data/BillingRepository.cs`
- `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`
- `modernized-openemr/frontend/src/App.tsx`
- `modernized-openemr/frontend/src/App.css`
- `modernized-openemr/frontend/src/api.ts`
- `modernized-openemr/scripts/Test-ModernizedBaseline.ps1`
- `parity-tests/tests/account-statement-pdf/account-statement-pdf.spec.ts`
- `parity-tests/test-manifest.json`
- `parity-tests/package.json`
- `scripts/Run-OpenEmrParityTests.ps1`
- `modernization-workbench/config/apps.json`
- `modernization-workbench/server/index.ts`
- `modernization-workbench/src/architectureModel.ts`
- `documents/MODERNIZATION_PLAN.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/PROJECT_CONTEXT.md`
- `documents/INDEX.md`
- `documents/PROJECT_CHANGELOG.md`

## Next Expected Entries

Likely upcoming changelog entries should cover:

- Legacy-native Panther test-container enablement if practical.
- Scanned attachments, document thumbnails, full document versioning, external storage adapters, and integration workflows.
- Additional modernized workflow action adapters for reports, broader ACL administration, and deeper billing/lab workflows.
- Broader encounter workflows for templates, sign-off, diagnosis coding, orders, billing linkage, audit history, and attachments.
- Workbench comparison views that render matched/different comparison artifacts directly.
