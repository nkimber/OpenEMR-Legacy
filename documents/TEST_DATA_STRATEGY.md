# Test Data Strategy

Created: 2026-06-18

## Purpose

This document records how the project will seed OpenEMR with test data for legacy validation, Workbench reporting, and future side-by-side modernization parity tests.

## Current State

The local legacy baseline is working, but it currently has no patient or workflow data.

Original local database profile before the first seed:

- `patient_data`: 0 rows
- `form_encounter`: 0 rows
- `openemr_postcalendar_events`: 0 rows
- `lists`: 0 rows
- `pnotes`: 0 rows
- `users`: 4 rows

This means the baseline can prove installation, health, and login, but it cannot yet demonstrate realistic OpenEMR workflows.

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

1. Use the bundled OpenEMR example patient SQL as the first small seed so the legacy app has visible patients quickly.
2. Store the project-owned synthetic seed dataset with the Modernization Workbench instead of tying it to only the legacy or modernized implementation.
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

Current status: implemented through the baseline smoke test, but no patient data exists.

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

### Level 2: Project Synthetic Workflow Data

Purpose: support real modernization parity tests.

This dataset should include named synthetic personas and expected workflows, such as:

- Patient search and patient chart navigation.
- Patient creation and demographic editing.
- Appointments.
- Encounters.
- Vitals.
- Notes.
- Messages.
- Problems, allergies, medications, and prescriptions where appropriate.
- Billing and claims later, once the project selects that workflow.

Each workflow slice should define:

- Seed records.
- Setup script.
- Verification query.
- Legacy UI/API tests.
- Expected normalized output for modernized parity tests.

### Level 3: Larger Synthetic Population

Purpose: scale testing, search performance, reporting, and realistic clinical histories.

Potential sources:

- OpenEMR development `import-random-patients` flow with Synthea.
- A project-owned Synthea-based generation process.
- The OpenEMR `demo-data-generator` if it proves compatible with the pinned version.

This level should be introduced only after the deterministic Level 2 workflow data is stable.

## Operating Rules

- Never use real patient data, PHI, production credentials, or production extracts.
- Do not treat public demo servers as the authoritative baseline because they are reset and mutable.
- Do not rely on browser-only manual data entry for core test state.
- Make seed scripts idempotent or provide a reset-before-seed workflow.
- Store generated artifacts under ignored artifact folders unless the artifact is an intentional source-controlled test fixture.
- Record expected counts and named seed personas in this document or a future seed-data manifest.

## Near-Term Next Step

Use the Workbench seed action to run `legacy-openemr/scripts/Seed-LegacyExampleData.ps1`, then build the `openemr-shared-synthetic-v1` generator and database adapters under `modernization-workbench/seed-data/`.
