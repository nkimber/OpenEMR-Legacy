# OpenEMR Shared Synthetic Dataset V1

This folder owns the canonical seed-data contract for the modernization project.

The dataset is stored with the Modernization Workbench because the Workbench is responsible for applying the same test contract to multiple systems:

- Legacy OpenEMR on MariaDB.
- Future modernized OpenEMR on PostgreSQL.

## Target Shape

V1 targets 1,000 synthetic patients with appropriately scaled workflow data:

- 20 providers and staff.
- 3 facilities.
- 6 synthetic insurance companies and 1,400 insurance coverage records.
- 2,800 appointments.
- 2,100 encounters.
- 2,100 vitals and clinical notes.
- 1,500 problems.
- 900 allergies.
- 2,200 medications or prescriptions.
- 2,648 immunizations.
- 1,000 lab or procedure orders: 700 completed historical orders with reports/results and 300 future scheduled orders.
- 2,400 lab results or observations.
- 1,200 messages.
- 200 portal-enabled patients.
- 200 provisioned portal account rows for the portal-enabled cohort.
- 3,000 billing line items.
- 700 claim status rows.
- 420 payment sessions and 617 payment activity rows.
- Deterministic mother, guardian contact, guardian demographic/address, social-detail, and employer fields for every patient.

## Source Layers

1. Curated golden personas for deterministic workflow tests.
2. Project-owned deterministic synthetic population generation for broad coverage and repeatability.
3. Project-owned mapping adapters for each target database.

## Current State

The V1 gold dataset is generated and checked into this folder as an intentional test fixture. It has also been applied to the legacy OpenEMR MariaDB baseline and count-verified on 2026-06-18.

The current V1 temporal contract is anchored to `2026-06-18` and includes:

- 2,800 appointments in 2026, including 1,261 future appointments through 2026-12-31.
- 2,200 prescriptions and 2,200 medication list entries in 2026, including 1,175 future-starting records through 2026-12-31.
- 2,648 immunizations, including 1,149 administered in 2026 and a stable pediatric anchor at `MOD-PAT-0007`.
- 1,000 procedure orders in 2026, including 300 future scheduled orders through 2026-12-31.
- 2,400 completed procedure results in 2026. Future scheduled procedure orders intentionally do not have final result rows.
- 617 payment activities, including 422 posted in 2026 and 227 future-current-year postings through 2026-07-09.

The generated summary includes a `temporalCoverage` section so tests and future Workbench views can assert date coverage as well as row counts. The legacy seed script validates this temporal contract after applying the SQL seed.

Slice 194 adds deterministic mother name, guardian name, guardian relationship, guardian phone, and guardian email values to the canonical patient contract. Slice 195 extends that same contract with guardian sex, address, city, state, postal code, country, and work phone. Slice 196 extends it again with race, ethnicity, interpreter, family size, monthly income, homeless status, and financial review date values. Slice 197 adds deterministic employer name, street, city, state, postal code, and country values. These values seed legacy OpenEMR `patient_data` plus `employer_data`, and the modernized PostgreSQL `patients` plus `patient_employers` tables, so guardian-contact, guardian-detail, social-detail, and employer parity tests can mutate and restore `MOD-PAT-0010` from a shared baseline. Slice 204 provisions portal account readiness for the existing 200 portal-enabled patients: legacy receives `patient_data.cmsportal_login` plus `patient_access_onsite` rows, while the modernized PostgreSQL seed receives `patients.cms_portal_login` plus `patient_portal_accounts` rows.

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
