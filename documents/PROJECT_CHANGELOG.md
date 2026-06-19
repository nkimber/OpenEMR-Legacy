# Project Changelog

Created: 2026-06-18

## Purpose

This document tracks the concrete implementation steps, improvements, and enhancements made during the OpenEMR modernization project.

Use it as the project-level changelog: when code, configuration, test coverage, seed data, orchestration, documentation structure, or durable project behavior changes, add a new entry here in the same work item.

## Maintenance Rules

- Add entries in chronological order.
- Keep each entry concrete: describe what changed, why it matters, and where the evidence or source files live.
- Reference the relevant commit when available.
- Do not replace the detailed project documents. Link to them or name them when the change belongs to a specific area.
- If a later change supersedes an earlier entry, add a new entry that says so rather than silently rewriting history.

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

Commit: TBD

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

## Next Expected Entries

Likely upcoming changelog entries should cover:

- Legacy-native Panther test-container enablement if practical.
- Reports exports, document storage, scanned attachments, and integration adapters.
- Additional modernized workflow action adapters for billing and procedures.
- Broader encounter workflows for templates, sign-off, diagnosis coding, orders, billing linkage, audit history, and attachments.
- Workbench comparison views that render matched/different comparison artifacts directly.
