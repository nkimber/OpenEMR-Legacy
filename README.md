# OpenEMR Modernization Lab

This repository is a modernization workspace built around OpenEMR.

GitHub repository: `https://github.com/nkimber/OpenEMR-Legacy`

The project has three major systems:

- **Legacy OpenEMR baseline** - the original OpenEMR application running locally in Docker.
- **Modernization Workbench** - an oversight website for status, test orchestration, parity reports, and architecture comparison.
- **Modernized OpenEMR target** - a future modern implementation built in vertical slices.

## Current State

The legacy OpenEMR baseline is installed under `legacy-openemr/`, seeded with the shared gold test dataset, and verified locally.

The first Modernization Workbench version is implemented under `modernization-workbench/`.

The reusable parity test harness is implemented under `parity-tests/`. It currently runs database, HTTP, Playwright UI, and workflow mutation suites against the legacy OpenEMR baseline and is structured so the same test contracts can later target the modernized OpenEMR implementation.

The legacy-native OpenEMR PHPUnit stable lane is implemented under `legacy-openemr/scripts/Test-LegacyNative.ps1`. It runs OpenEMR's upstream isolated PHPUnit suite inside the pinned OpenEMR container.

The legacy-native OpenEMR Jest lane is implemented under `legacy-openemr/scripts/Test-LegacyNativeJs.ps1`. It runs OpenEMR's upstream JavaScript tests for CCDA utility and jsPDF compatibility coverage.

Pinned baseline:

- OpenEMR Docker image: `openemr/openemr:8.1.0-2026-06-18`
- OpenEMR source tag: `v8_1_0`
- MariaDB image: `mariadb:11.8.8`

Start the baseline:

```powershell
cd legacy-openemr
docker compose up -d
```

Open the legacy app in a browser at `http://localhost:8080`. The HTTPS endpoint `https://localhost:9443` is also exposed, but it uses a self-signed local certificate and will show a browser privacy warning unless trusted locally.

Run the baseline smoke test:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyBaseline.ps1
```

Run the legacy-native isolated PHPUnit stable suite:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyNative.ps1
```

Run the legacy-native JavaScript Jest suite:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyNativeJs.ps1 -InstallDependencies
```

Run the full legacy parity suite:

```powershell
cd ..\parity-tests
npm run test:legacy
```

Run the isolated legacy workflow mutation suite:

```powershell
npm run test:legacy:workflow -- --reset test
```

List the available suites, run plans, reset modes, and targets:

```powershell
npm run list
```

Run the target-neutral full parity plan:

```powershell
npm run test:legacy:plan:full
```

Seed the shared gold test dataset:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Seed-LegacyGoldDataset.ps1
```

Run the Modernization Workbench:

```powershell
cd ..
.\scripts\Start-ModernizationWorkbench.ps1
```

Open `http://127.0.0.1:5173`.

## Documentation

Start with `documents/INDEX.md`.

Important documents:

- `documents/PROJECT_CONTEXT.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/TEST_ARCHITECTURE.md`
- `documents/TEST_DATA_STRATEGY.md`
- `documents/DOCUMENTATION_GOVERNANCE.md`
- `documents/GITHUB_CONNECTION.md`

## Safety

Do not store real patient data, PHI, production credentials, or secrets in this repository.

Local runtime files are intentionally ignored, including `legacy-openemr/.env`, `legacy-openemr/source/`, and `legacy-openemr/artifacts/`.
