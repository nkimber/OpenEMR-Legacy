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

As of 2026-06-18, the legacy OpenEMR baseline is installed under `legacy-openemr/`, running through Docker Compose, and verified by a smoke test. The baseline uses OpenEMR Docker image `openemr/openemr:8.1.0-2026-06-18`, upstream source tag `v8_1_0`, and `mariadb:11.8.8`.

The smoke test currently verifies:

- OpenEMR health endpoint returns HTTP 200.
- The login page is reachable.
- The local demo admin login reaches the main OpenEMR shell.

The baseline has not yet been seeded with project-specific demo data and has not yet been connected to GitHub.

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
- Show test results for unit, functional/API, and Playwright UI test runs.
- Trigger selected test runs through controlled scripts or APIs.
- Run parity checks across both systems when both implementations exist.
- Show workflow modernization progress by slice.
- Display technical architecture information for both solutions.
- Highlight technical differences between the legacy and modernized architectures.
- Preserve evidence from test runs, comparisons, logs, screenshots, and reports.

The workbench should orchestrate and visualize repeatable commands rather than becoming the only way to run tests. The underlying tests and scripts should remain usable from the command line and from future CI workflows.

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

1. Establish baseline seed/demo data.
2. Add the first Playwright login/navigation test.
3. Connect the project to GitHub once the local baseline setup is accepted.
4. Build the first version of the Modernization Workbench around baseline status and test execution.
5. Select the first modernization workflow slice.
6. Build the modernized target implementation for that slice.
7. Run side-by-side parity tests and publish the results through the workbench.
