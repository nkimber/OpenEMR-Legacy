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

The first Modernization Workbench version is implemented under `modernization-workbench/`. It uses React, TypeScript, Vite, Node.js, and Express. It can inspect, start, stop, restart, health-check, log, seed, smoke-test, run named parity plans, render recent side-by-side comparison artifacts, expand comparison cards into run-artifact/suite/difference drill-ins, and open run/comparison artifact files through a safe artifact endpoint for the legacy OpenEMR baseline and the modernized target through local-only, allowlisted orchestration and artifact routes.

The modernized OpenEMR target is implemented under `modernized-openemr/` and currently covers forty read-only vertical slices plus one hundred mutation-capable slices. The read-only slices are patient search/chart summary, patient insurance coverage, patient immunization history, scheduling appointment detail, encounter SOAP/vitals detail, encounter document attachment visibility, encounter document revision readiness, encounter billing linkage visibility, encounter claim linkage visibility, encounter procedure order linkage visibility, encounter diagnosis coding visibility, clinical lists with problems, allergies, medication list entries, prescriptions, patient messages with portal-enabled status, completed procedure results with lab order/report/result detail, pending/scheduled procedure orders without report rows, fee-sheet billing with encounter CPT charge detail, claim status visibility, payment posting visibility, account balance rollup visibility, account aging bucket visibility, account ledger running-balance visibility, account statement readiness visibility, patient statement generation visibility, patient statement PDF export visibility, statement batch candidate visibility, statement batch package export visibility, collections work queue visibility, administration directory behavior for users and facilities, operational reports over the gold dataset, operational reports CSV export, patient documents with document metadata and content previews, patient document full-content retrieval/download, patient document preview and thumbnail readiness, patient document revision readiness, default ACL access-control group/permission/membership matrix behavior, seeded procedure lab-provider catalog ownership behavior, and procedure lab provider directory behavior. Appointment recurrence work now includes Slice 103 recurrence metadata, Slice 104 recurring-series expansion, Slice 105 seeded exception-date skipping, Slice 106 generated-occurrence cancellation through `exdate` mutation, Slice 107 generated-occurrence restoration through recurrence exception-date removal and Calendar `Restore occurrence` controls, Slice 108 individual occurrence rescheduling into a standalone appointment while skipping the original generated date, Slice 109 direct recurrence exception-list editing on the recurring root, Slice 110 recurring root title/time update propagation into generated future occurrences, Slice 111 recurring root metadata propagation for provider, facility, billing location, category, status, room, and comments, Slice 112 monthly interval recurrence creation/update/expansion behavior, Slice 113 day, workday, and yearly recurrence-unit creation/expansion behavior, Slice 114 OpenEMR days-of-week recurrence selection/expansion behavior, Slice 115 OpenEMR monthly repeat-on recurrence selection/expansion behavior, Slice 116 seeded recurring-series cadence/end-date update propagation behavior, Slice 117 provider-overlap tolerance behavior for same-provider, same-time appointments, Slice 118 patient-overlap tolerance behavior for same-patient, same-time appointments, Slice 119 room-overlap tolerance behavior for same-room, same-time appointments, and Slice 120 appointment reminder readiness for due status, channel, contact, and lead-day derivation from seeded contact consent. Encounter sign-off work now includes Slice 77 focused attestation and Slice 121 co-signature readiness with two signers, locked co-signature rendering, signature ordering, and cleanup. Encounter document work now includes Slice 67 attachment visibility, Slice 122 current revision readiness for version label, revision timestamp, history count, hash, API payload, and modernized attachment-card rendering, Slice 123 replacement revision lifecycle parity for temporary encounter-attached documents, Slice 126 scanned attachment readiness for temporary encounter-scoped PDFs with scan-source/OCR metadata, and Slice 127 binary document content replacement for encounter-attached PDF bytes. Patient document mutation work now includes Slice 128 binary document content replacement for patient-scoped PDF bytes from the Documents workspace. Lab/procedure mutation work now includes Slice 129 procedure result correction for temporary lab result rows, Slice 130 report collected-date/specimen-number readiness, Slice 131 order-level specimen detail readiness, Slice 132 order metadata correction readiness, Slice 133 report metadata correction readiness, Slice 134 report review sign-off readiness, Slice 135 report review queue readiness from the Reports workspace, Slice 136 report review queue patient/date filter readiness, Slice 137 report review queue provider filter readiness, and Slice 138 report review queue lab filter readiness. Procedure lab catalog work now includes Slice 139 permanent gold-data lab-provider ownership for seeded lab orders and reviewed report queue rendering, Slice 140 provider-directory readiness over the same permanent five-provider catalog, Slice 141 temporary provider lifecycle readiness for create, deactivate/include-inactive, render, and delete behavior, and Slice 142 temporary provider configuration readiness for HL7/transport settings. Each implemented OpenEMR workflow slice has matched side-by-side parity evidence against the legacy baseline, Slice 124 adds Workbench comparison drill-ins, and Slice 125 adds safe artifact links that open run/comparison JSON evidence directly from those drill-ins.

Recent patient-document continuation: Slice 128 follows the binary patient-document mutation, patient scanned-attachment, replacement-revision, and encounter binary replacement slices by proving that an existing patient-scoped binary PDF document can have its stored bytes, MIME type, file name, size, hash, revision facts, preview metadata, and download payload replaced in place while preserving its patient/document identity.

Recent lab/procedure continuation: Slice 129 follows the procedure mutation and encounter procedure-result entry slices by proving that an existing temporary lab result can be corrected in place, with corrected text, value, units, range, abnormal flag, date, status, database probes, API detail, and UI rendering matching across legacy and modernized targets.

Recent specimen continuation: Slice 131 follows the report-level collected-date/specimen-number slice by proving that order-level specimen identifier, accession, type, collection method, location, collected date/time, volume, condition, and comments are preserved in the modernized PostgreSQL schema, procedure API, Encounter/Procedures UI cards, workflow probes, and side-by-side parity tests.

Recent Workbench continuation: Slice 125 follows the comparison drill-in slice by adding safe direct links from each run/comparison artifact path to the underlying artifact file.

Recent order-correction continuation: Slice 132 follows the specimen detail slice by proving that an existing temporary lab order can have date, procedure code/name/type, diagnosis, priority, status, and instructions corrected in place from the modernized Procedures workspace while matching legacy Procedure Results behavior after report/result creation.

Recent report sign-off continuation: Slice 134 follows the report correction slice by proving that an existing temporary lab report can be signed/reviewed as `admin`, store modernized `reviewed_by` / `reviewed_at` facts, preserve linked result rows, and match the legacy `procedure_report.source` plus `review_status` representation through normalized parity probes.

Recent report review queue continuation: Slice 135 follows the sign-off slice by proving that an unreviewed temporary lab report appears in the received/unreviewed queue, moves to the reviewed queue after `admin` sign-off, and matches legacy `list_reports.php` review-filter behavior through normalized database probes and browser-visible Reports workspace rendering.

Recent report review queue filter continuation: Slice 136 follows the queue slice by proving that patient and order-date filters select the same temporary lab report on both targets, exclude it for an outside date, and preserve the reviewed queue transition after `admin` sign-off.

Recent report review queue provider filter continuation: Slice 137 follows the patient/date filter slice by proving that provider filters select the same temporary lab report on both targets, exclude it for an outside provider, and preserve the reviewed queue transition after `admin` sign-off.

Recent report review queue lab filter continuation: Slice 138 follows the provider filter slice by adding modernized `lab_orders.lab_id` / `lab_providers` seed support and proving that `form_lab_search` / `procedure_order.lab_id` behavior matches the modernized Reports workspace Lab filter before and after `admin` sign-off.

Recent procedure lab provider catalog continuation: Slice 139 follows the lab filter slice by promoting lab providers into permanent gold data, assigning all seeded lab orders to lab providers, and proving the reviewed report queue renders the same seeded lab ownership on legacy OpenEMR and the modernized Reports workspace.

Recent procedure lab provider directory continuation: Slice 140 follows the catalog slice by rendering the permanent five-provider lab catalog as a directory, including active filtering, NPI values, and balanced order/report/future-order counts on legacy OpenEMR and the modernized Reports workspace.

Recent procedure lab provider lifecycle continuation: Slice 141 follows the directory slice by adding mutation-capable temporary lab provider lifecycle behavior with create, deactivate, include-inactive rendering, and delete coverage on legacy OpenEMR and the modernized Reports workspace/API.

Recent procedure lab provider configuration continuation: Slice 142 follows the lifecycle slice by adding mutation-capable temporary lab provider configuration behavior with usage, direction, sender/receiver IDs, remote host, login/password, order/result paths, notes, and protocol rendering on legacy OpenEMR and the modernized Reports workspace/API.

Current update: Slice 142 adds procedure lab provider configuration readiness. The latest Workbench-specific slice remains Slice 125, which adds safe artifact links; the latest modernized OpenEMR workflow slice is Slice 142, and the target now covers forty read-only vertical slices plus one hundred mutation-capable slices through Slice 142.

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
