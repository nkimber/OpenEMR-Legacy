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
- 1,000 lab or procedure orders: 700 completed historical orders with reports/results and 300 future scheduled orders.
- 2,400 lab results or observations.
- 1,200 messages.
- 200 portal-enabled patients.
- 3,000 billing line items.

## Source Layers

1. Curated golden personas for deterministic workflow tests.
2. Project-owned deterministic synthetic population generation for broad coverage and repeatability.
3. Project-owned mapping adapters for each target database.

## Current State

The V1 gold dataset is generated and checked into this folder as an intentional test fixture. It has also been applied to the legacy OpenEMR MariaDB baseline and count-verified on 2026-06-18.

The current V1 temporal contract is anchored to `2026-06-18` and includes:

- 2,800 appointments in 2026, including 1,261 future appointments through 2026-12-31.
- 2,200 prescriptions and 2,200 medication list entries in 2026, including 1,175 future-starting records through 2026-12-31.
- 1,000 procedure orders in 2026, including 300 future scheduled orders through 2026-12-31.
- 2,400 completed procedure results in 2026. Future scheduled procedure orders intentionally do not have final result rows.

The generated summary includes a `temporalCoverage` section so tests and future Workbench views can assert date coverage as well as row counts. The legacy seed script validates this temporal contract after applying the SQL seed.

Generated artifacts:

- `generated/canonical/gold-dataset.json` - canonical project-owned dataset consumed by database adapters and future tests.
- `generated/summary.json` - version, counts, cohorts, and named test anchors.
- `generated/legacy-mariadb/seed-gold.sql` - reset-and-seed SQL for the legacy OpenEMR MariaDB schema.

Supporting files:

- `scripts/generate-gold-dataset.mjs` - deterministic generator for the canonical dataset and target seed artifacts.
- `personas/golden-patients.json` - curated workflow anchors for stable end-to-end tests.

Run the generator from `modernization-workbench/`:

```powershell
npm run generate:seed-data
```

Apply the legacy seed from `legacy-openemr/`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Seed-LegacyGoldDataset.ps1
```

The legacy seed is also exposed through the Modernization Workbench as `Gold test dataset v1`.

## Test Anchors

Tests should prefer canonical IDs from `generated/summary.json` and `generated/canonical/gold-dataset.json`, not OpenEMR auto-increment IDs. The first anchor records cover patient search, chronic care, scheduling, portal messaging, billing, allergies, pediatrics, medications, labs, and encounter-history workflows.

## Rules

- No real patient data.
- No production extracts.
- Generated data must be deterministic from versioned inputs and seed values.
- Each target database gets an adapter from the same canonical dataset.
- Test expectations should reference canonical patient identifiers, not database auto-increment IDs.
