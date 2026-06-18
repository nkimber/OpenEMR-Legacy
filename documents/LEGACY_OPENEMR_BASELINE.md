# Legacy OpenEMR Baseline

Created: 2026-06-18
Last verified: 2026-06-18

## Purpose

This document describes the installed original OpenEMR baseline. This is the reference application that future modernization work will compare against.

## Location

The baseline lives in `legacy-openemr/`.

Key files and folders:

- `legacy-openemr/docker-compose.yml` - Docker Compose runtime for OpenEMR and MariaDB.
- `legacy-openemr/.env.example` - local environment template.
- `legacy-openemr/.env` - local ignored environment file copied from the template.
- `legacy-openemr/source/` - local upstream OpenEMR source checkout for inspection and modernization analysis.
- `legacy-openemr/scripts/Test-LegacyBaseline.ps1` - baseline smoke test.
- `legacy-openemr/scripts/Seed-LegacyExampleData.ps1` - imports the bundled OpenEMR example users and patient demographics into an empty baseline.
- `legacy-openemr/artifacts/latest-smoke-test.json` - latest smoke-test result, generated locally and ignored by the parent project.
- `legacy-openemr/artifacts/latest-seed-result.json` - latest seed result, generated locally and ignored by the parent project.

## Pinned Versions

- OpenEMR Docker image: `openemr/openemr:8.1.0-2026-06-18`
- OpenEMR upstream source tag: `v8_1_0`
- OpenEMR source commit: `28dc4f9ba3f3d4de8324980699a072cdaf098927`
- Database image: `mariadb:11.8.8`

The Docker image is used to run the baseline application. The source checkout is kept for analysis and test development.

## Local URLs

- Browser-friendly app URL: `http://localhost:8080`
- HTTPS: `https://localhost:9443`
- Health endpoint: `https://localhost:9443/meta/health/readyz`

The HTTPS endpoint uses a self-signed local certificate. Browsers such as Chrome will show a privacy warning for `https://localhost:9443` unless that local certificate is trusted or the warning is bypassed manually. Use `http://localhost:8080` when opening the app in a browser during local development. The Workbench can still use the HTTPS health endpoint internally because its backend health check is configured to tolerate the self-signed local certificate.

## Local Demo Login

The local demo admin login is configured through `legacy-openemr/.env`.

- Username: `admin`
- Password: `pass`

These are local-only demo credentials. Do not use real patient data or production secrets in this environment.

The Modernization Workbench reads these values from `legacy-openemr/.env` and displays them in the Managed Application panel. If a browser pre-fills different values on the OpenEMR login page, use the Workbench values as the source of truth for the local baseline.

## Commands

Run commands from `legacy-openemr/`.

Start the baseline:

```powershell
docker compose up -d
```

Check status:

```powershell
docker compose ps
```

Run the smoke test:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyBaseline.ps1
```

Seed the bundled OpenEMR example patient data:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Seed-LegacyExampleData.ps1
```

The same seed action is exposed through the Modernization Workbench. Longer term, this script is the legacy MariaDB adapter for the shared Workbench-owned seed-data contract under `modernization-workbench/seed-data/`.

Stop containers while keeping data:

```powershell
docker compose down
```

Reset the local baseline data:

```powershell
docker compose down --volumes
```

## Verified State

On 2026-06-18, Docker Compose successfully started both containers:

- `openemr-legacy-baseline-mysql-1`
- `openemr-legacy-baseline-openemr-1`

Both containers reported healthy status.

The smoke test passed with these checks:

- Health endpoint returned HTTP 200.
- Login page was reachable and contained the expected login form.
- Posting the local demo admin credentials reached the main OpenEMR shell.

The bundled OpenEMR example seed has been imported with these checks:

- `patient_data` contains 14 rows.
- `users` contains 6 rows, including the baseline users and the two bundled example provider users.
- Bundled sample provider references are remapped so the imported patients point to `davis` and `hamming` rather than the local system-operation account.

## Current Gaps

- No project-specific synthetic seed dataset has been created yet.
- Only the bundled OpenEMR example patient data has been imported; this is not yet enough for appointments, messages, encounters, billing, or clinical-note parity tests.
- No Playwright UI test suite has been added yet.
- The parent project is connected to GitHub at `https://github.com/nkimber/OpenEMR-Legacy.git`.
- The first Modernization Workbench version has been implemented and can manage this baseline locally.
