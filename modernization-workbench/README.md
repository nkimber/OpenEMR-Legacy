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
- Runs custom parity selections with suite/plan, reset mode, headed mode, and optional grep choices.
- Saves a local Azure demo profile and runs validate/deploy/smoke actions for public Container Apps demos, including the public Demo Portal landing page.
- Displays recent logs and action history.
- Displays latest smoke-test, native-test, and parity-test evidence.
- Renders the project changelog as a designed build timeline.
- Shows architecture and modernization progress views.
- Shows a generated Technical Reference for the modernized target.
- Shows the local demo OpenEMR login from `../legacy-openemr/.env`.

Current pages:

- Dashboard
- Applications
- Demo Deployment
- Project Timeline
- Progress
- Architecture
- Technical Reference
- Test Runs
- Seed Data

The managed app link opens the legacy site at `http://localhost:8080`. The Modernized OpenEMR managed app link opens `http://localhost:3000/?entry=chooser` so operators start at the Staff / Patient Portal chooser. The OpenEMR HTTPS endpoint remains available at `https://localhost:9443`, but browsers will warn about its self-signed local certificate unless it is trusted or bypassed manually.

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

The Test Runs page also has a custom parity run builder backed by `../parity-tests/test-manifest.json`.

The Demo Deployment page is backed by `../scripts/Test-AzureDemoPrerequisites.ps1` and `../scripts/Deploy-AzureDemo.ps1`. It stores the local Azure profile, latest result, and latest live-status snapshot under the ignored `artifacts/azure-demo-deployment/` folder, clears stale visible results when a new action starts, shows an elapsed counter while long Azure actions run, redacts sensitive command output, and can copy the latest result/output for troubleshooting. The page summarizes the latest successful deploy or smoke evidence as live deployment status, exposes public target links when available, and can refresh Azure runtime plus resource-group Cost Management estimates from the signed-in Azure CLI account. The validation and deployment scripts resolve Azure CLI from `AZURE_CLI_PATH`, the standard Windows Azure CLI Python module install path, or `az` on `PATH`. The Demo Directory preview reads `config/demo-directory.json` and shows the role-specific app entries, demo preset names, and demo credentials that are baked into the separate Demo Portal static container. Demo preset links append only `demo=staff` or `demo=patient` and let the target app pre-fill its own login form, so demo passwords are not placed in URLs. Missing Container Apps are bootstrapped with a public placeholder image through ordinary CLI flags, then updated with generated root-level sidecar YAML; the deployment and refresh paths verify active images and reject the generic Container Apps placeholder as a live deployment. Legacy deployment builds a small derived OpenEMR image from `../infra/azure/demo/legacy-openemr-demo.Dockerfile` so the Azure staff and patient portal login pages understand those demo preset links, enables the disposable legacy patient portal with `OPENEMR_SETTING_portal_onsite_two_enable=1`, and upserts the single Nora Kim portal demo account. Dirty worktree deploys use timestamped image tags so Azure receives a fresh revision even before the slice is committed. Modernized deployment writes lowercase string seed/reset flags, normalizes those flags in the API entrypoint, smoke-tests both `/health` and the demo `admin` / `pass` login endpoint, and can open directly to `module=admin` or `module=portal` from Demo Portal links. Demo Portal deployment builds a tiny Nginx image from `../infra/azure/demo/demo-portal/`, injects generated directory JSON during Docker build, and smoke-tests the public landing page title. The repo-root `.dockerignore` keeps local build outputs and broad artifacts out of the Azure demo Docker context so the images build from source inside Linux containers.

The Workbench also exposes structured project history at:

```text
http://127.0.0.1:5174/api/changelog
```

That endpoint parses `../documents/PROJECT_CHANGELOG.md`, which remains the changelog source of truth.

## Technical Reference

Regenerate the modernized target reference after meaningful API, schema, frontend, runtime, or parity-plan changes:

```powershell
npm run generate:technical-reference
```

The command writes `../documents/MODERNIZED_OPENEMR_TECHNICAL_REFERENCE.md` and `config/technical-reference.json`. The Technical Reference page reads those files and `/api/technical-reference/markdown` opens the generated Markdown directly.

## Seed Data

The shared seed-data contract lives under:

```text
seed-data/
```

The current manifest defines `openemr-shared-synthetic-v1`, the generated 1,000-patient deterministic gold dataset for both the legacy MariaDB baseline and the future PostgreSQL modernized target. The implemented gold seed action applies the legacy MariaDB adapter and validates expected counts and temporal coverage. The starter example seed remains available for quick small-data checks.

## Safety

The Workbench does not expose a general shell. Managed-app lifecycle actions come from `config/apps.json`, and Azure demo deployment actions are fixed backend routes to the project-owned validation/deployment scripts.
