# Modernization Workbench

The Modernization Workbench is a local-first oversight application for the OpenEMR modernization project.

The first version manages the legacy OpenEMR baseline:

- Shows Docker Compose service status.
- Checks the OpenEMR health endpoint.
- Shows the pinned source tag and commit.
- Displays a small database profile.
- Starts, stops, and restarts the legacy OpenEMR Docker Compose stack.
- Runs the starter legacy seed action.
- Runs the baseline smoke test.
- Displays recent logs and action history.
- Shows architecture and modernization progress views.
- Shows the local demo OpenEMR login from `../legacy-openemr/.env`.

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

## Seed Data

The shared seed-data contract lives under:

```text
seed-data/
```

The current manifest defines `openemr-shared-synthetic-v1`, a planned 1,000-patient deterministic dataset for both the legacy MariaDB baseline and the future PostgreSQL modernized target. The implemented seed action currently applies the bundled OpenEMR starter example patients to the legacy database.

## Safety

The Workbench does not expose a general shell. It can run only the operations defined in the managed-app manifest.
