# OpenEMR Modernization Lab

This repository is a modernization workspace built around OpenEMR.

The project has three major systems:

- **Legacy OpenEMR baseline** - the original OpenEMR application running locally in Docker.
- **Modernization Workbench** - a planned oversight website for status, test orchestration, parity reports, and architecture comparison.
- **Modernized OpenEMR target** - a future modern implementation built in vertical slices.

## Current State

The legacy OpenEMR baseline is installed under `legacy-openemr/` and verified locally.

Pinned baseline:

- OpenEMR Docker image: `openemr/openemr:8.1.0-2026-06-18`
- OpenEMR source tag: `v8_1_0`
- MariaDB image: `mariadb:11.8.8`

Start the baseline:

```powershell
cd legacy-openemr
docker compose up -d
```

Run the baseline smoke test:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyBaseline.ps1
```

## Documentation

Start with `documents/INDEX.md`.

Important documents:

- `documents/PROJECT_CONTEXT.md`
- `documents/LEGACY_OPENEMR_BASELINE.md`
- `documents/MODERNIZATION_WORKBENCH.md`
- `documents/DOCUMENTATION_GOVERNANCE.md`

## Safety

Do not store real patient data, PHI, production credentials, or secrets in this repository.

Local runtime files are intentionally ignored, including `legacy-openemr/.env`, `legacy-openemr/source/`, and `legacy-openemr/artifacts/`.
