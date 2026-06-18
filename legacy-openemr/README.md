# Legacy OpenEMR Baseline

This folder contains the reproducible local baseline for the original OpenEMR application.

## Pinned Baseline

- OpenEMR Docker image: `openemr/openemr:8.1.0-2026-06-18`
- OpenEMR source tag: `v8_1_0`
- Database image: `mariadb:11.8.8`

The Docker image runs the application. The local source checkout in `source/` is for inspection, tests, and modernization analysis. The source checkout is ignored by the parent repository so the orchestration project can later be connected to GitHub without vendoring the entire upstream project by accident.

## Local Setup

Copy the environment template:

```powershell
Copy-Item .env.example .env
```

Start the baseline:

```powershell
docker compose up -d
```

Check container status:

```powershell
docker compose ps
```

Run the baseline smoke test:

```powershell
.\scripts\Test-LegacyBaseline.ps1
```

The smoke test checks the health endpoint, login page, and local demo admin login. It writes the latest structured result to `artifacts/latest-smoke-test.json`.

Seed the shared gold dataset:

```powershell
.\scripts\Seed-LegacyGoldDataset.ps1
```

The gold seed script resets the legacy test data tables, applies the shared 1,000-patient synthetic dataset, and validates row counts and temporal coverage.

Run the full parity test suite from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Suite all -Reset run
```

The parity suite lives in `..\parity-tests` and writes durable run evidence under `..\parity-tests\artifacts`.

Seed the bundled OpenEMR example patient data:

```powershell
.\scripts\Seed-LegacyExampleData.ps1
```

The seed script imports the OpenEMR `example_patient_users.sql` and `example_patient_data.sql` files from the local source checkout. It also remaps the bundled sample provider references to the provider user IDs created in this local baseline. It writes the latest structured result to `artifacts/latest-seed-result.json`.

OpenEMR should be available at:

- HTTP: `http://localhost:8080`
- HTTPS: `https://localhost:9443`

The default local demo login from `.env.example` is:

- Username: `admin`
- Password: `pass`

## Stop And Reset

Stop containers while keeping data:

```powershell
docker compose down
```

Reset all local OpenEMR data and volumes:

```powershell
docker compose down --volumes
```

## Notes

- Do not use real patient data in this baseline.
- Do not commit `.env` files.
- Test output and generated artifacts should be written under `artifacts/`.
