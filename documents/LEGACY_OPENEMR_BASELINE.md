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
- `legacy-openemr/scripts/Test-LegacyNative.ps1` - containerized OpenEMR upstream isolated PHPUnit runner.
- `legacy-openemr/scripts/Test-LegacyNativeJs.ps1` - OpenEMR upstream JavaScript Jest runner.
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1` - resets and imports the shared 1,000-patient gold dataset into the legacy MariaDB schema.
- `legacy-openemr/scripts/Seed-LegacyExampleData.ps1` - imports the bundled OpenEMR example users and patient demographics into an empty baseline.
- `legacy-openemr/artifacts/latest-smoke-test.json` - latest smoke-test result, generated locally and ignored by the parent project.
- `legacy-openemr/artifacts/latest-gold-seed-result.json` - latest gold seed result, generated locally and ignored by the parent project.
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

Run the OpenEMR-native isolated PHPUnit stable suite:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyNative.ps1
```

If the ignored upstream Composer dependencies are missing, restore them through Docker:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyNative.ps1 -InstallDependencies
```

Run the OpenEMR-native JavaScript Jest suite:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyNativeJs.ps1 -InstallDependencies
```

Run the full parity test suite from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Suite all -Reset run
```

Run the full named parity plan from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan full-parity -Reset run
```

Run individual parity suites from `parity-tests/`:

```powershell
npm run test:legacy:database
npm run test:legacy:http
npm run test:legacy:ui
npm run test:legacy:workflow
```

Seed the shared gold test dataset:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Seed-LegacyGoldDataset.ps1
```

Seed the bundled OpenEMR example patient data:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Seed-LegacyExampleData.ps1
```

The gold seed action is exposed through the Modernization Workbench. `Seed-LegacyGoldDataset.ps1` is the current legacy MariaDB adapter for the shared Workbench-owned seed-data contract under `modernization-workbench/seed-data/`.

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

The parity test harness under `parity-tests/` has been implemented and verified against the legacy baseline:

- Native OpenEMR isolated PHPUnit stable suite passed inside the pinned OpenEMR container with 2,344 tests and 6,188 assertions. Stable mode excludes the upstream `twig` and `large` groups because the complete upstream suite currently has Windows bind-mount-sensitive CRLF fixture and built-in-server routing failures.
- Native OpenEMR JavaScript Jest suite passed with 12 suites and 105 tests covering CCDA service utilities and jsPDF compatibility.
- Database contract suite passed.
- HTTP functional suite passed.
- Playwright UI suite passed, including login, patient chart, encounter SOAP/vitals, scheduler appointment details, fee sheet billing codes, and procedure-result rendering.
- Workflow mutation suite passed with per-test gold-data resets, including demographics, appointments, clinical lists, messages, prescriptions, encounters with vitals/SOAP details, billing, and lab procedure workflows.
- Full named parity plan passed with database, HTTP, UI, and workflow suites selected.
- Full legacy parity suite passed after a gold-data run reset.

The bundled OpenEMR example seed has been imported with these checks:

- `patient_data` contains 14 rows.
- `users` contains 6 rows, including the baseline users and the two bundled example provider users.
- Bundled sample provider references are remapped so the imported patients point to `davis` and `hamming` rather than the local system-operation account.

The shared gold dataset has been imported and verified with these checks:

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

The shared gold dataset temporal coverage has also been verified in the legacy MariaDB baseline:

- Appointments: 2,800 in 2026, including 1,261 future appointments after 2026-06-18 and through 2026-12-31.
- Prescriptions: 2,200 in 2026, including 1,175 future-starting prescriptions after 2026-06-18 and through 2026-12-31.
- Medication list entries: 2,200 in 2026, including 1,175 future-starting entries after 2026-06-18 and through 2026-12-31.
- Procedure orders: 1,000 in 2026, including 300 future scheduled orders after 2026-06-18 and through 2026-12-31.
- Procedure results: 2,400 completed results in 2026. Future scheduled procedure orders intentionally do not have final result rows.

`Seed-LegacyGoldDataset.ps1` now validates the generated temporal coverage contract after applying the seed, so count and date-coverage regressions are both caught by the same legacy seed action.

## Current Gaps

- The modernized PostgreSQL seed adapter now exists for read-only patient, scheduling, encounter, clinical-list, messaging, procedure-result, fee-sheet billing, and supporting gold-data tables; mutation-oriented seed and workflow behavior will expand slice by slice.
- Modernized parity adapters now exist for normalized PostgreSQL probes and Playwright checks covering patient search/chart summary, read-only scheduling, read-only encounter SOAP/vitals detail, read-only clinical-list facts, read-only patient-message facts, read-only completed procedure results, and read-only fee-sheet billing facts; mutation workflow adapters remain future work.
- The OpenEMR-native PHPUnit stable lane is runnable and verified, but the full upstream isolated suite remains environment-sensitive on the Windows bind-mounted checkout.
- OpenEMR-native Panther browser tests have not been wired into the Workbench yet.
- The parent project is connected to GitHub at `https://github.com/nkimber/OpenEMR-Legacy.git`.
- The first Modernization Workbench version has been implemented and can manage this baseline locally.
