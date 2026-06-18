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

## Next Expected Entries

Likely upcoming changelog entries should cover:

- Legacy-native Panther test-container enablement if practical.
- Selection of the first modernization workflow slice.
- Modernized workflow action adapters for the parity suite.
- Modernized target project bootstrap.
- PostgreSQL seed adapter for the modernized target.
