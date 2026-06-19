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

The modernized OpenEMR target is implemented under `modernized-openemr/` and currently covers fifteen read-only vertical slices plus thirteen mutation-capable slices. The read-only slices are patient search/chart summary, patient insurance coverage, scheduling appointment detail, encounter SOAP/vitals detail, clinical lists with problems, allergies, medication list entries, prescriptions, patient messages with portal-enabled status, completed procedure results with lab order/report/result detail, pending/scheduled procedure orders without report rows, fee-sheet billing with encounter CPT charge detail, administration directory behavior for users and facilities, operational reports over the gold dataset, operational reports CSV export, patient documents with document metadata and content previews, patient document full-content retrieval/download, and default ACL access-control group/permission/membership matrix behavior. Slice 10 adds patient contact mutation through the modernized API and chart UI. Slice 11 adds future appointment create, cancel, and delete behavior through the modernized API and Calendar UI. Slice 12 adds encounter create, summary update, vitals recording, SOAP recording, and delete behavior through the modernized API and Encounters UI. Slice 13 adds allergy clinical-list create, active rendering, deactivate, and delete behavior through the modernized API and Lists UI. Slice 14 adds patient-message create, active rendering, close, soft-delete, and hard-delete behavior through the modernized API and Messages UI. Slice 15 adds prescription create, active rendering, deactivate, and delete behavior through the modernized API and Lists UI. Slice 16 adds CPT billing line create, active fee-sheet rendering, billed/inactive status update, and delete behavior through the modernized API and Fees UI. Slice 17 adds lab procedure order create, order completion, reviewed report creation, final result creation, browser-visible rendering, and cascade-delete cleanup through the modernized API and Procedures UI. Slice 18 adds administration facility create, update, inactive status, browser-visible rendering, and delete cleanup through the modernized API and Admin UI. Slice 19 adds administration user create, update, inactive status, browser-visible rendering, and delete cleanup through the modernized API and Admin UI. Slice 20 adds read-only ACL group, permission, group-permission, and default user-membership matrix visibility through the modernized API and Admin UI. Slice 21 adds focused ACL group-permission assignment grant/revoke behavior through the modernized API and Admin UI. Slice 22 adds focused ACL user-to-group membership grant/revoke behavior through the modernized API and Admin UI. Slice 23 adds pending/scheduled procedure-order visibility through the modernized API and Procedures UI. Slice 24 adds operational report CSV export through the modernized API and Reports UI. Slice 25 adds read-only patient document visibility through the modernized API and Documents UI. Slice 26 adds patient document create, active rendering, soft-delete/archive, and hard-delete cleanup through the modernized API and Documents UI. Slice 27 adds patient document content retrieval, viewer rendering, and text-file download behavior through the modernized API and Documents UI. Slice 28 adds primary and secondary patient insurance coverage to chart summaries and the React chart panel. Each implemented slice has matched side-by-side parity evidence against the legacy baseline.

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
