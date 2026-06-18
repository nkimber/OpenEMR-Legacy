# Modernization Workbench

The Modernization Workbench is a local-first oversight application for the OpenEMR modernization project.

The first version manages the legacy OpenEMR baseline:

- Provides a left-side navigation shell with hash-routed pages.
- Shows Docker Compose service status.
- Checks the OpenEMR health endpoint.
- Shows the pinned source tag and commit.
- Displays a small database profile.
- Starts, stops, and restarts the legacy OpenEMR Docker Compose stack.
- Runs the gold legacy seed action and keeps the starter seed available.
- Runs the baseline smoke test.
- Runs the OpenEMR-native isolated PHPUnit stable suite.
- Runs the OpenEMR-native JavaScript Jest suite.
- Runs the legacy parity database, HTTP, UI, workflow mutation, named-plan, and full-suite test commands.
- Displays recent logs and action history.
- Displays latest smoke-test, native-test, and parity-test evidence.
- Renders the project changelog as a designed build timeline.
- Shows architecture and modernization progress views.
- Shows the local demo OpenEMR login from `../legacy-openemr/.env`.

Current pages:

- Dashboard
- Applications
- Project Timeline
- Progress
- Architecture
- Test Runs
- Seed Data

The managed app link opens the legacy site at `http://localhost:8080`. The OpenEMR HTTPS endpoint remains available at `https://localhost:9443`, but browsers will warn about its self-signed local certificate unless it is trusted or bypassed manually.

## Run

From the repository root:

```powershell
.\scripts\Start-ModernizationWorkbench.ps1
```

Or from this folder:

```powershell
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## Local API

The backend listens on:

```text
http://127.0.0.1:5174
```

It is intentionally local-only. Lifecycle actions are implemented through manifest-defined commands in `config/apps.json`.

Native OpenEMR PHPUnit tests are launched through `../legacy-openemr/scripts/Test-LegacyNative.ps1`. Native OpenEMR Jest tests are launched through `../legacy-openemr/scripts/Test-LegacyNativeJs.ps1`. Latest native summaries are read from `../legacy-openemr/artifacts/`.

Parity tests are implemented in `../parity-tests` and launched through `../scripts/Run-OpenEmrParityTests.ps1`. Latest suite summaries are read from `../parity-tests/artifacts/`.

The Workbench also exposes structured project history at:

```text
http://127.0.0.1:5174/api/changelog
```

That endpoint parses `../documents/PROJECT_CHANGELOG.md`, which remains the changelog source of truth.

## Seed Data

The shared seed-data contract lives under:

```text
seed-data/
```

The current manifest defines `openemr-shared-synthetic-v1`, the generated 1,000-patient deterministic gold dataset for both the legacy MariaDB baseline and the future PostgreSQL modernized target. The implemented gold seed action applies the legacy MariaDB adapter and validates expected counts and temporal coverage. The starter example seed remains available for quick small-data checks.

## Safety

The Workbench does not expose a general shell. It can run only the operations defined in the managed-app manifest.
