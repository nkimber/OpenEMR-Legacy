# OpenEMR Shared Synthetic Dataset V1

This folder owns the canonical seed-data contract for the modernization project.

The dataset is stored with the Modernization Workbench because the Workbench is responsible for applying the same test contract to multiple systems:

- Legacy OpenEMR on MariaDB.
- Future modernized OpenEMR on PostgreSQL.

## Target Shape

V1 targets 1,000 synthetic patients with appropriately scaled workflow data:

- 20 providers and staff.
- 3 facilities.
- 2,800 appointments.
- 2,100 encounters.
- 2,100 vitals and clinical notes.
- 1,500 problems.
- 900 allergies.
- 2,200 medications or prescriptions.
- 700 lab or procedure orders.
- 2,400 lab results or observations.
- 1,200 messages.
- 200 portal-enabled patients.
- 3,000 billing line items.

## Source Layers

1. Curated golden personas for deterministic workflow tests.
2. Synthea-generated synthetic clinical history for broad population realism.
3. Project-owned mapping adapters for each target database.

## Current State

The legacy baseline currently supports the starter seed action, which imports OpenEMR's bundled example provider users and 14 patient demographics. The full 1,000-patient V1 dataset is planned but not generated yet.

## Rules

- No real patient data.
- No production extracts.
- Generated data must be deterministic from versioned inputs and seed values.
- Each target database gets an adapter from the same canonical dataset.
- Test expectations should reference canonical patient identifiers, not database auto-increment IDs.
