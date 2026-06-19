# Test Data Strategy

Created: 2026-06-18

## Purpose

This document records how the project will seed OpenEMR with test data for legacy validation, Workbench reporting, and future side-by-side modernization parity tests.

## Current State

The local legacy baseline is working and has a project-owned synthetic gold dataset applied.

Original local database profile before any seed:

- `patient_data`: 0 rows
- `form_encounter`: 0 rows
- `openemr_postcalendar_events`: 0 rows
- `lists`: 0 rows
- `pnotes`: 0 rows
- `users`: 4 rows

Current verified gold seed profile as of 2026-06-18:

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
- Lab/procedure orders: 1,000
- Lab reports: 700
- Lab results: 2,400
- Messages: 1,200
- Billing line items: 3,000
- Portal-enabled patients: 200

The generated canonical dataset, summary, and legacy MariaDB seed SQL live under `modernization-workbench/seed-data/openemr-shared-synthetic-v1/generated/`.

Current-year temporal coverage verified in the legacy MariaDB baseline on 2026-06-18:

- Appointments: 2,800 in 2026; 1,261 future-dated after 2026-06-18; latest date 2026-12-31.
- Prescriptions: 2,200 in 2026; 1,175 future-starting after 2026-06-18; date range 2026-01-01 to 2026-12-31.
- Medication list entries: 2,200 in 2026; 1,175 future-starting after 2026-06-18; date range 2026-01-01 to 2026-12-31.
- Procedure orders: 1,000 in 2026; 300 future scheduled orders after 2026-06-18; latest date 2026-12-31.
- Procedure results: 2,400 completed results in 2026; date range 2026-02-20 to 2026-05-20.
- Messages: 1,200 in 2026.
- Billing line items: 1,650 in 2026.

Future scheduled procedure orders intentionally do not have final result rows. This gives tests a clean distinction between completed-results workflows and pending/scheduled procedure-order workflows. `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1` verifies both row counts and the generated `temporalCoverage` contract after each legacy reseed.

## Findings

OpenEMR does provide some sample and demo-data mechanisms, but there does not appear to be a single maintained, production-release test database that is suitable as our full modernization parity baseline.

Useful upstream sources:

- OpenEMR ships `sql/example_patient_data.sql` in the `v8_1_0` source tag. It inserts 14 rows into `patient_data`.
- OpenEMR ships `sql/example_patient_users.sql` in the `v8_1_0` source tag. It inserts 2 provider users referenced by the example patients.
- The public OpenEMR demo site has demo users and limited demo data, and the site is reset daily. This is useful for exploration, not for a deterministic local test baseline.
- The OpenEMR development Docker environment documents `dev-reset-install-demodata`, which resets and installs OpenEMR with demo data.
- The OpenEMR development Docker environment documents `import-random-patients`, which uses Synthea to create random patients and import them into OpenEMR.
- The `openemr/demo-data-generator` repository exists, but its README describes it as a work in progress and currently focused on patient and facility data.

Relevant upstream references:

- `https://github.com/openemr/openemr/blob/v8_1_0/sql/example_patient_data.sql`
- `https://github.com/openemr/openemr/blob/v8_1_0/sql/example_patient_users.sql`
- `https://www.open-emr.org/demo/`
- `https://github.com/openemr/demo-data-generator`
- `legacy-openemr/source/CONTRIBUTING.md`

## Decision

Use a layered seed-data strategy.

1. Keep the bundled OpenEMR example patient SQL as the small starter seed for quick baseline checks.
2. Treat `openemr-shared-synthetic-v1` as the project gold test dataset for meaningful workflow and parity tests.
3. Keep all seed data non-PHI, deterministic, resettable, and versioned.
4. Prefer seeding through repeatable scripts and documented import flows exposed through Workbench-managed actions.
5. Extend the dataset workflow by workflow as modernization slices are selected.

The project-owned seed data becomes part of the test contract. The same initial dataset should be usable by:

- Legacy OpenEMR tests.
- Modernized OpenEMR tests.
- Workbench status and comparison views.
- Future CI automation.

The canonical dataset folder is `modernization-workbench/seed-data/`. Target-specific seeders should adapt that canonical dataset into each database:

- Legacy OpenEMR MariaDB through scripts under `legacy-openemr/scripts/`.
- Future modernized OpenEMR PostgreSQL through scripts or services owned by the modernized target.

The Workbench should manage both paths from the same seed manifest so the operator can apply the same dataset to both systems before parity tests.

## Recommended Seed Levels

### Level 0: Installation Smoke Data

Purpose: prove the app is installed, healthy, and login works.

Current status: implemented through the baseline smoke test.

### Level 1: Starter Patient Data

Purpose: make the UI visibly useful and enable patient search/navigation tests.

Initial candidate:

- Import `legacy-openemr/source/sql/example_patient_users.sql`.
- Import `legacy-openemr/source/sql/example_patient_data.sql`.

Expected effect:

- Add 2 provider users.
- Add 14 patient demographic records.
- Remap the bundled sample provider references to the provider user IDs created in this local baseline.

Limitations:

- Mostly demographics only.
- Not enough for appointment, encounter, billing, message, portal, or clinical-note parity tests.

### Level 2: Gold Synthetic Workflow Data

Purpose: support real modernization parity tests.

Current status: implemented as `openemr-shared-synthetic-v1` and verified against the legacy MariaDB baseline and the modernized PostgreSQL read-model seed through the implemented read-only slices.

This dataset includes named synthetic personas and workflow data for:

- Patient search and patient chart navigation.
- Patient creation and demographic editing.
- Appointments.
- Encounters.
- Vitals.
- Notes.
- Messages.
- Problems, allergies, medications, and prescriptions where appropriate.
- 2026 current-year and future-dated prescription coverage.
- Billing line-item coverage.
- 2026 current-year and future scheduled procedure-order coverage.
- Deeper claims behavior later, once the project selects that workflow.
- Portal-enabled patient coverage.

Each workflow slice should define:

- Seed records.
- Setup script.
- Verification query.
- Legacy UI/API tests.
- Expected normalized output for modernized parity tests.

Stable tests should reference canonical patient identifiers such as `MOD-PAT-0001`, not legacy database auto-increment IDs.

The first modernized seed adapter lives in `modernized-openemr/scripts/Seed-ModernizedGoldDataset.ps1`. It consumes the canonical gold dataset, generates a PostgreSQL seed script under ignored artifacts, and loads the same patient and workflow records into modernized read-model tables for patient search/chart summary behavior, read-only scheduling behavior, read-only encounter SOAP/vitals behavior, read-only clinical-list behavior, read-only messaging behavior, read-only procedure-result behavior, read-only fee-sheet billing behavior, read-only administration directory behavior, read-only operational reporting behavior, and normalized database parity checks.

The scheduling slice now uses `MOD-PAT-0003` as a stable appointment anchor. Both legacy MariaDB and modernized PostgreSQL probes locate that patient's next future appointment after `2026-06-18`, and the `slice-2-scheduling-readiness` plan verifies the appointment facts plus browser-visible appointment detail behavior against both targets.

The encounter slice now uses `MOD-PAT-0001` as a stable clinical anchor. Both legacy MariaDB and modernized PostgreSQL probes locate that patient's latest encounter in 2026, including SOAP assessment text and vitals blood-pressure data, and the `slice-3-encounters-readiness` plan verifies those facts plus browser-visible encounter detail behavior against both targets.

The clinical-lists slice also uses `MOD-PAT-0001` as a stable clinical-list anchor. Both legacy MariaDB and modernized PostgreSQL probes locate that patient's active problems, allergies, medication list entries, and prescriptions. The current anchor facts include `Type 2 diabetes mellitus without complications`, `Asthma, uncomplicated`, `Penicillin` allergy with rash and moderate severity, `Metformin 500 mg`, `Atorvastatin 20 mg`, `Albuterol inhaler 90 mcg`, and a matching `Metformin` prescription. The `slice-4-clinical-lists-readiness` plan verifies these facts plus browser-visible clinical-list behavior against both targets.

The messaging slice uses `MOD-PAT-0004` as a stable portal-messaging anchor. Both legacy MariaDB and modernized PostgreSQL probes locate that patient's portal-enabled flag and seeded patient messages. The current anchor facts include portal access enabled, a `Care team follow-up` message with `New` status and body `Follow-up message for Nora Kim.`, and a `Portal message` with `Done` status and body `Patient portal question about medications.` The `slice-5-messaging-readiness` plan verifies these facts plus browser-visible patient-message behavior against both targets.

The procedure-results slice uses `MOD-PAT-0009` as a stable completed-lab anchor. Both legacy MariaDB and modernized PostgreSQL probes locate that patient's completed `Complete blood count` procedure order with code `85025`, completed report, and final result rows for `Erythrocytes`, `Hemoglobin`, `Platelets`, and `Leukocytes`. The current anchor facts include `Hemoglobin` result `13.8 g/dL`, normal range `12.0-17.5`, and `final` result status. The `slice-6-procedures-readiness` plan verifies these facts plus browser-visible procedure-result behavior against both targets.

The fee-sheet billing slice uses `MOD-PAT-0001` as a stable billing anchor. Both legacy MariaDB and modernized PostgreSQL probes locate that patient's latest 2026 encounter `1000013`, diagnosis `E78.5`, and seeded CPT billing lines. The current anchor facts include `99214` / `Established patient office visit` with fee `168` and diagnosis justification `E78.5`, plus `36415` / `Routine venipuncture` with fee `18` and the same diagnosis justification. The `slice-7-billing-readiness` plan verifies these facts plus browser-visible fee-sheet behavior against both targets.

The administration directory slice uses the seeded provider/staff and facility records as stable anchors. Both legacy MariaDB and modernized PostgreSQL probes locate 20 `gold-*` users, 12 provider users with calendar access, and 3 facilities. The current anchor facts include `gold-provider-02` / `Morris, Jordan` as an authorized provider assigned to `North County Clinic`, `gold-billing-01` / `Grant, Drew` as a non-calendar billing user assigned to `Modernization Family Medicine`, and the MAIN/NORTH/EAST facilities. The `slice-8-admin-readiness` plan verifies these facts plus browser-visible Users and Facilities behavior against both targets.

The operational reports slice uses aggregate facts from the existing gold dataset rather than a separate report fixture table. Both legacy MariaDB and modernized PostgreSQL probes normalize the same reporting anchors: 1,000 patients, 200 portal-enabled patients, 2,800 current-year appointments, 1,261 future appointments after the 2026-06-18 dataset base date, 2,100 encounters, 1,100 current-year encounters, 3,000 billing lines, `$446,000.00` seeded charges, 700 lab reports, 1,200 messages, 12 providers, and 3 facilities. The current report anchors include `gold-provider-02` with 176 encounters and 253 billing lines, NORTH facility with 935 appointments and 701 encounters, and `Asthma, uncomplicated` / `ICD10:J45.909` with 188 active-problem rows. The `slice-9-reports-readiness` plan verifies these facts plus browser-visible report surfaces against both targets.

### Level 3: Extended Synthetic Population

Purpose: scale testing, search performance, reporting, and realistic clinical histories.

Current status: optional future extension. The V1 gold dataset already contains 1,000 patients. Future expansions may add richer Synthea-derived clinical history, additional billing/claims depth, documents, immunizations, or reporting-specific fixtures.

Potential future sources:

- OpenEMR development `import-random-patients` flow with Synthea.
- A project-owned Synthea-based generation process.
- The OpenEMR `demo-data-generator` if it proves compatible with the pinned version.

This level should be introduced only after the deterministic V1 gold workflow data is covered by baseline tests.

## Operating Rules

- Never use real patient data, PHI, production credentials, or production extracts.
- Do not treat public demo servers as the authoritative baseline because they are reset and mutable.
- Do not rely on browser-only manual data entry for core test state.
- Make seed scripts idempotent or provide a reset-before-seed workflow.
- Store generated artifacts under ignored artifact folders unless the artifact is an intentional source-controlled test fixture.
- Record expected counts and named seed personas in this document or a future seed-data manifest.

## Near-Term Next Step

Continue expanding reusable modernized parity adapters that consume the gold dataset:

- Add modernized workflow actions behind the same mutation-test intent as CRUD slices are implemented.
- Add PostgreSQL probes for newly implemented domain behavior where normalized database facts are useful.
- Add Playwright tests for each modernized workflow slice using the existing canonical anchors.
- Additional encounter mutation tests once the modernized target supports create/update/delete workflows.
- Procedure-result mutation, clinical-list mutation, messaging mutation, medication reconciliation, and billing tests as the next workflow slices are selected.
