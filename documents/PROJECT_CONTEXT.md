# OpenEMR Modernization Project Context

Created: 2026-06-18

## Summary

This project uses the open source OpenEMR application as the legacy reference system for an AI-assisted application modernization effort.

The project has three major systems:

- The legacy OpenEMR baseline.
- The Modernization Workbench.
- The modernized OpenEMR target solution.

The first objective is to create a fully reproducible local OpenEMR baseline that can be installed, run, seeded with known test data, and tested through multiple layers. Once that baseline is stable, the project will build the first version of the Modernization Workbench so test execution, progress tracking, evidence, and comparison results can be seen in one place. After that, the project will build the modernized implementation beside the baseline and validate that both systems behave the same for selected workflows.

## Current Project State

As of 2026-06-19, the legacy OpenEMR baseline is installed under `legacy-openemr/`, running through Docker Compose, and verified by smoke, native, parity, and workflow tests. The baseline uses OpenEMR Docker image `openemr/openemr:8.1.0-2026-06-18`, upstream source tag `v8_1_0`, and `mariadb:11.8.8`.

The parent project has been initialized as a local Git repository on branch `main`, connected to GitHub remote `origin`, and pushed to `https://github.com/nkimber/OpenEMR-Legacy.git`.

The smoke test currently verifies:

- OpenEMR health endpoint returns HTTP 200.
- The login page is reachable.
- The local demo admin login reaches the main OpenEMR shell.

The baseline has been seeded with `openemr-shared-synthetic-v1`, the project-owned deterministic 1,000-patient gold dataset. OpenEMR includes small bundled example patient SQL files and developer demo-data tooling, but the project now treats the Workbench-owned gold dataset as the modernization test contract. The shared seed-data contract lives under `modernization-workbench/seed-data/` so the same dataset can be applied to the legacy MariaDB database and the modernized PostgreSQL database.

The first Modernization Workbench version is implemented under `modernization-workbench/`. It uses React, TypeScript, Vite, Node.js, and Express. It can inspect, start, stop, restart, health-check, log, seed, smoke-test, and run named parity plans for the legacy OpenEMR baseline and the modernized target through local-only, allowlisted orchestration commands.

The modernized OpenEMR target is implemented under `modernized-openemr/` and currently covers thirty-four read-only vertical slices plus thirty-eight mutation-capable slices. The read-only slices are patient search/chart summary, patient insurance coverage, patient immunization history, scheduling appointment detail, encounter SOAP/vitals detail, encounter document attachment visibility, encounter billing linkage visibility, encounter claim linkage visibility, encounter procedure order linkage visibility, encounter diagnosis coding visibility, clinical lists with problems, allergies, medication list entries, prescriptions, patient messages with portal-enabled status, completed procedure results with lab order/report/result detail, pending/scheduled procedure orders without report rows, fee-sheet billing with encounter CPT charge detail, claim status visibility, payment posting visibility, account balance rollup visibility, account aging bucket visibility, account ledger running-balance visibility, account statement readiness visibility, patient statement generation visibility, patient statement PDF export visibility, statement batch candidate visibility, statement batch package export visibility, collections work queue visibility, administration directory behavior for users and facilities, operational reports over the gold dataset, operational reports CSV export, patient documents with document metadata and content previews, patient document full-content retrieval/download, patient document preview and thumbnail readiness, patient document revision readiness, and default ACL access-control group/permission/membership matrix behavior. Slice 10 adds patient contact mutation through the modernized API and chart UI. Slice 11 adds future appointment create, cancel, and delete behavior through the modernized API and Calendar UI. Slice 12 adds encounter create, summary update, vitals recording, SOAP recording, and delete behavior through the modernized API and Encounters UI. Slice 13 adds allergy clinical-list create, active rendering, deactivate, and delete behavior through the modernized API and Lists UI. Slice 14 adds patient-message create, active rendering, close, soft-delete, and hard-delete behavior through the modernized API and Messages UI. Slice 15 adds prescription create, active rendering, deactivate, and delete behavior through the modernized API and Lists UI. Slice 16 adds CPT billing line create, active fee-sheet rendering, billed/inactive status update, and delete behavior through the modernized API and Fees UI. Slice 17 adds lab procedure order create, order completion, reviewed report creation, final result creation, browser-visible rendering, and cascade-delete cleanup through the modernized API and Procedures UI. Slice 18 adds administration facility create, update, inactive status, browser-visible rendering, and delete cleanup through the modernized API and Admin UI. Slice 19 adds administration user create, update, inactive status, browser-visible rendering, and delete cleanup through the modernized API and Admin UI. Slice 20 adds read-only ACL group, permission, group-permission, and default user-membership matrix visibility through the modernized API and Admin UI. Slice 21 adds focused ACL group-permission assignment grant/revoke behavior through the modernized API and Admin UI. Slice 22 adds focused ACL user-to-group membership grant/revoke behavior through the modernized API and Admin UI. Slice 23 adds pending/scheduled procedure-order visibility through the modernized API and Procedures UI. Slice 24 adds operational report CSV export through the modernized API and Reports UI. Slice 25 adds read-only patient document visibility through the modernized API and Documents UI. Slice 26 adds patient document create, active rendering, soft-delete/archive, and hard-delete cleanup through the modernized API and Documents UI. Slice 27 adds patient document content retrieval, viewer rendering, and text-file download behavior through the modernized API and Documents UI. Slice 28 adds primary and secondary patient insurance coverage to chart summaries and the React chart panel. Slice 29 adds read-only immunization history to the shared seed, clinical-list API, and React Lists workspace. Slice 30 adds immunization create, active rendering, entered-in-error, and hard-delete cleanup through the modernized API and Lists UI. Slice 31 adds problem-list create, active rendering, deactivate, and hard-delete cleanup through the modernized API and Lists UI. Slice 32 adds medication-list create, active rendering, deactivate, and hard-delete cleanup through the modernized API and Lists UI. Slice 33 adds binary patient-document upload, active rendering, MIME-aware byte-preserving download, soft-delete/archive, and hard-delete cleanup through the modernized API and Documents UI. Slice 34 adds patient insurance coverage create, active rendering, update, and hard-delete cleanup through the modernized API and Patient/Client chart Insurance panel. Slice 35 adds encounter sensitivity, referral source, external ID, and POS metadata create/render/update/delete behavior through the modernized API and Encounters UI. Slice 36 adds patient demographics update/restore behavior for identity, DOB, address, marital status, and occupation through the modernized API and Patient/Client chart Demographics panel. Slice 37 adds temporary patient registration create/render/delete behavior through the modernized API and Patient/Client workspace registration form. Slice 38 adds patient document approval/sign-off behavior through the modernized API and Documents workspace. Slice 39 adds external-link patient document create/render/archive/delete behavior through the modernized API and Documents workspace. Slice 40 adds patient document denial/rejection behavior through the modernized API and Documents workspace. Slice 41 adds patient document metadata refiling/edit behavior through the modernized API and Documents workspace. Slice 42 adds patient document archived-record visibility and restore behavior through the modernized API and Documents workspace. Slice 43 adds patient document content replacement behavior through the modernized API and Documents workspace. Slice 44 adds fee-sheet ICD10 diagnosis coding behavior through the modernized API and Fees workspace. Slice 45 adds fee-sheet CPT charge correction behavior through the modernized API and Fees workspace. Slice 46 adds fee-sheet CPT modifier behavior through the modernized API and Fees workspace. Slice 47 adds read-only claim status visibility through the modernized API and Fees workspace. Slice 48 adds read-only payment posting visibility through the modernized API and Fees workspace. Slice 49 adds read-only account balance visibility through charge, payment, adjustment, and remaining-balance rollups in the modernized API and Fees workspace. Slice 50 adds read-only account aging visibility through deterministic current, 31-60, 61-90, and over-90 bucket rollups in the modernized API and Fees workspace. Slice 51 adds read-only account ledger visibility through chronological charge, payment, adjustment, and running-balance entries in the modernized API and Fees workspace. Slice 52 adds read-only account statement readiness visibility through recipient, statement-period, due-date, current-due, past-due, and balance-due facts in the modernized API and Fees workspace. Slice 53 adds read-only patient document preview readiness through preview kind, inline-readiness, thumbnail labels, thumbnail text, and browser-visible document-card thumbnail rendering in the modernized API and Documents workspace. Slice 54 adds read-only patient document revision readiness through current version, revision timestamp, history count, and browser-visible revision rendering in the modernized API and Documents workspace. Slice 55 adds patient document replacement revision readiness by proving content replacement updates the current revision timestamp and hash in place while preserving the single-current-version contract in the modernized API and Documents workspace. Slice 56 adds payment posting mutation readiness through payment create, visible active posting, void, active-row hiding, balance/ledger recalculation, and hard-delete cleanup in the modernized API and Fees workspace. Slice 57 adds claim status mutation readiness through claim create, generated-file state, cleared state, browser-visible rendering, and hard-delete cleanup in the modernized API and Fees workspace. Slice 58 adds patient payment capture readiness through patient-responsibility payment create, visible active posting, void, active-row hiding, balance/ledger recalculation, and hard-delete cleanup in the modernized API and Fees workspace. Slice 59 adds read-only patient statement generation through a deterministic statement document, payment instructions, generated text, line items, totals, and browser-visible Fees workspace rendering. Slice 60 adds read-only patient statement PDF export through a deterministic statement PDF endpoint, download filename, PDF content checks, and browser-visible Fees workspace export action. Slice 61 adds read-only statement batch candidate readiness through a ranked account work queue, statement totals, delivery method metadata, and browser-visible Fees workspace candidate rows. Slice 62 adds read-only statement batch package export through a deterministic ZIP endpoint, package manifest, summary CSV, included PDFs, and browser-visible Fees workspace Batch Export action. Slice 63 adds read-only collections work queue readiness through a deterministic past-due account queue, high-priority/over-90 rollups, recommended collection actions, and browser-visible Fees workspace queue rows. Slice 64 adds collections follow-up task readiness through a pnotes-compatible billing API task create path, browser-visible Fees workspace Create Task action, close/archive/delete lifecycle behavior, and Messages workspace rendering. Slice 65 adds patient-message assignment readiness through a pnotes-compatible assignment API path, browser-visible Messages workspace reassignment controls, unchanged-count verification, and side-by-side parity evidence. Slice 66 adds patient-message content readiness through a pnotes-compatible title/body edit API path, browser-visible Messages workspace inline edit controls, unchanged-count verification, and side-by-side parity evidence. Slice 67 adds read-only encounter document attachment visibility through Encounter detail API fields, browser-visible Encounters workspace attached-document cards, and side-by-side parity evidence. Slice 68 adds read-only encounter billing linkage visibility through Encounter detail API fields, browser-visible Encounters workspace fee-sheet cards, and side-by-side parity evidence. Slice 69 adds read-only encounter claim linkage visibility through Encounter detail API fields, browser-visible Encounters workspace claim-status cards, and side-by-side parity evidence. Slice 70 adds read-only encounter procedure order linkage visibility through Encounter detail API fields, browser-visible Encounters workspace procedure-order/report/result cards, and side-by-side parity evidence. Slice 71 adds read-only encounter diagnosis coding visibility through Encounter detail API diagnosis evidence fields, browser-visible Encounters workspace diagnosis coding cards, and side-by-side parity evidence. Slice 72 adds encounter billing linkage mutation visibility through temporary CPT fee-sheet create/render/deactivate/delete behavior on an existing encounter, Encounter detail API/UI verification, and side-by-side parity evidence. Each implemented slice has matched side-by-side parity evidence against the legacy baseline.

Current update: Slice 72 adds encounter billing linkage mutation readiness through a temporary `CPT4 99499` fee-sheet row on `MOD-PAT-0001` encounter `1000013`, active encounter-linked billing and diagnosis visibility checks, billed/inactive hiding, hard-delete cleanup, and side-by-side parity evidence. The target now covers thirty-four read-only vertical slices plus thirty-eight mutation-capable slices through Slice 72.

## Why OpenEMR

OpenEMR is a mature, open source electronic health records and medical practice management application. It is large enough to contain real modernization challenges: legacy UI patterns, server-side business behavior, database coupling, authentication and authorization concerns, reporting, healthcare workflows, and integration surfaces.

That makes it useful as a realistic modernization example rather than a toy application.

## Baseline System

The baseline system is the original OpenEMR application running locally in a reproducible environment.

Expected baseline capabilities:

- Download or clone the OpenEMR source or use an official containerized release.
- Run OpenEMR locally using Docker Desktop.
- Use a database container compatible with the selected OpenEMR baseline.
- Seed the system with known non-PHI demonstration data.
- Run automated tests against the baseline.
- Support UI-level functional tests through Playwright.

The baseline is not disposable. It is the behavioral reference for the modernization effort.

## Modernization Workbench

The Modernization Workbench is a third website that provides oversight into the modernization effort.

It should show the state of the legacy OpenEMR baseline, the state of the modernized target solution, and the current progress of workflow-by-workflow conversion. It should also provide active capabilities, such as running tests against one platform, running the same tests against both platforms, and comparing the results.

Expected workbench capabilities:

- Display environment status for the legacy baseline and modernized target.
- Start, stop, and restart project applications through controlled local orchestration.
- Show test results for unit, functional/API, and Playwright UI test runs.
- Trigger selected test runs through controlled scripts or APIs.
- Run parity checks across both systems when both implementations exist.
- Show workflow modernization progress by slice.
- Display technical architecture information for both solutions.
- Highlight technical differences between the legacy and modernized architectures.
- Preserve evidence from test runs, comparisons, logs, screenshots, and reports.

The workbench should orchestrate and visualize repeatable commands rather than becoming the only way to run tests or manage app lifecycle. The underlying start, stop, health-check, and test commands should remain usable from the command line and from future CI workflows where appropriate.

## Modernized Target System

The modernized system will be built beside the baseline rather than replacing it all at once.

Target direction:

- A modern SPA-style web UI, likely React.
- A backend API layer built with a modern server stack such as .NET/C# or Node.js.
- PostgreSQL as the target database.
- Business logic moved into the server-side business tier.
- Database-specific behavior minimized.
- UI-contained business logic extracted into testable backend services where appropriate.
- Public API contracts that can support both the new UI and automated tests.

The modernized implementation should preserve observable workflow behavior while allowing the internal architecture to change.

## Validation Strategy

The central idea is behavioral parity.

For each selected workflow, the project should define tests that can run against the legacy baseline and the modernized implementation. The tests should compare externally visible behavior and normalized outputs rather than relying on identical internal implementation details.

Expected test layers:

- **Unit tests** for isolated business rules and data transformations.
- **Functional/API tests** for backend behavior and workflow operations.
- **Playwright UI tests** for full user-facing workflows.
- **Seed-data verification** to prove each test starts from a known state.
- **Side-by-side comparison** between the legacy and modernized systems.
- **Workbench reporting** to make test status, parity evidence, and architectural differences visible.

## Initial Modernization Shape

The safest path is vertical-slice modernization.

Rather than trying to rewrite all of OpenEMR at once, choose one bounded workflow, prove the full loop, and then expand. A good first slice might include patient search, patient creation, patient detail editing, or appointment scheduling.

Each slice should include:

- Legacy behavior discovery.
- Test data setup.
- Golden-master tests against OpenEMR.
- Modern API and UI implementation.
- Postgres schema and migration mapping for the slice.
- Side-by-side test execution.
- Documented differences and decisions.

## Key Risks

- Hidden business rules in legacy PHP, templates, JavaScript, or database access code.
- UI behavior that users rely on but that is not formally documented.
- Authorization and audit behavior that must be preserved.
- Healthcare compliance expectations.
- Data migration ambiguity between MySQL/MariaDB and PostgreSQL.
- Reports, billing, documents, and integrations that may have deep coupling.
- Test brittleness if UI tests rely too heavily on incidental layout details.

## Guiding Principles

- Keep the legacy OpenEMR baseline running and testable.
- Build the Modernization Workbench after the baseline can run meaningful tests.
- Use tests as the contract for modernization.
- Prefer workflow parity over table-by-table mimicry.
- Migrate by vertical slices.
- Keep seed data synthetic and safe.
- Keep documents synchronized with the current state of the codebase, setup, tests, and decisions.
- Document assumptions before they become hidden architecture.
- Make modernization decisions explicit and easy to revisit.

## Near-Term Next Steps

1. Continue implementing modernized workflow slices until the major OpenEMR clinical, billing, lab, message, administration, reports, documents, integration, and mutation paths have parity coverage.
2. Add modernized workflow action adapters for the remaining CRUD-capable slices as they are selected.
3. Promote mature read-only and mutation slices into broader side-by-side parity plans.
4. Expand Workbench comparison views so matched and differing run artifacts are visible without reading JSON files directly.
