# Azure Demo Deployment

Created: 2026-06-26

## Purpose

This document describes the simple Azure demo deployment path exposed by the Modernization Workbench.

Read this when publishing the legacy OpenEMR baseline, the modernized OpenEMR target, Modern UI Claude, the public demo portal, or all selected demo targets to public Azure URLs for lightweight demonstrations.

## Scope

The Azure demo deployment is intentionally not a production hosting design. It exists so the project can show the legacy and modernized systems side by side outside the local development machine with minimal operational ceremony.

The first implementation uses Azure Container Apps:

- One public Container App for legacy OpenEMR.
- One public Container App for modernized OpenEMR.
- One public Container App for Modern UI Claude.
- One public Container App for the public Demo Portal landing page.
- A database container inside the same Container App as each OpenEMR target.
- Single warm replica scaling for each demo target, with Workbench controls to park the environment at zero idle replicas when public demos are not needed.
- Resettable synthetic data and demo credentials.
- Demo login preset links that carry only a preset name in the URL and let the target app fill its own synthetic username and password fields.

This keeps the demo small and disposable. Do not use this path for PHI, real patients, production credentials, production identity, durable backups, compliance validation, or anything requiring managed database availability guarantees.

## Workbench Surface

The Modernization Workbench has a dedicated Demo Deployment page.

The page collects:

- Azure subscription ID and optional tenant ID.
- Azure region.
- Resource group.
- Azure Container Apps environment.
- Azure Container Registry name for modernized app images.
- Application name prefix.
- Target selection for legacy OpenEMR, modernized OpenEMR, Modern UI Claude, and the public Demo Portal.
- Reset-on-deploy setting.
- Demo admin/database credentials.

The profile is written under `modernization-workbench/artifacts/azure-demo-deployment/profile.local.json`. The artifacts folder is ignored by Git, so Azure account details and passwords are not committed.

The page can run three actions:

- **Validate** runs `scripts/Test-AzureDemoPrerequisites.ps1`.
- **Deploy latest** runs `scripts/Deploy-AzureDemo.ps1`.
- **Smoke test** runs `scripts/Deploy-AzureDemo.ps1 -SmokeOnly`.

The page also includes a small Azure operations/NOC panel:

- **Shut down all Azure apps** updates every known demo Container App to `minReplicas=0` and `maxReplicas=1`, parking the environment at zero idle replicas without deleting resources or images.
- **Start all Azure apps** updates every known demo Container App to `minReplicas=1` and `maxReplicas=1`, restoring the warm demo shape used after deployment.
- **Refresh ops status** reads the current Container App replica settings, runtime status, and Cost Management data.

Because this installed Azure CLI does not expose Container Apps `stop` / `start` commands, the Workbench uses scale settings for this environment. A parked app can still be woken by public HTTP traffic because `maxReplicas` remains one, so operators should avoid opening public demo links while the environment is parked.

The latest JSON result is written to `modernization-workbench/artifacts/azure-demo-deployment/latest-result.json` and shown back in the Workbench.

When a new save, validate, deploy, or smoke action starts, the page clears the prior visible result so stale failures are not mistaken for the active run. While an action is running, the action row shows a temporary elapsed-time counter so operators can see that long Azure operations are still active. The evidence panel includes copy buttons for the latest JSON result, command output, and combined evidence payload so deployment errors can be pasted directly into Codex Desktop for troubleshooting. Copied deployment evidence redacts sensitive command output such as Azure Container Registry passwords.

The page also shows a Demo Directory preview, a Public App Links section, and an Azure runtime status panel above the raw evidence. The Demo Directory preview is driven by `modernization-workbench/config/demo-directory.json` and shows the public landing page cards, role-specific entry points, demo credentials, demo preset names, compact technology-stack logo chips, and currently resolved URLs. Demo preset links append values such as `demo=staff` or `demo=patient`; they do not place passwords in the URL. The Public App Links section surfaces direct public links for the main launcher, legacy OpenEMR, modernized OpenEMR, and Modern UI Claude from the latest Azure status evidence, with copy actions for recorded URLs and a pending state when a public URL has not yet been captured. On load, the runtime panel derives a last-known deployment state from the latest successful deploy or smoke result and exposes the public legacy, modernized, Modern UI Claude, and Demo Portal URLs when those links are present in the result artifact. The **Refresh Azure status** action asks Azure CLI for each selected Container App, checks the active container images plus the public URL or health endpoint, rejects the default Azure Container Apps placeholder image as a live deployment, and stores the latest live-status snapshot under `modernization-workbench/artifacts/azure-demo-deployment/live-status.json`. When a Container App has `minReplicas=0`, refresh treats it as `stopped` and skips public HTTP checks so the Workbench does not wake parked apps while checking status.

The same refresh action attempts a resource-group-scoped Azure Cost Management query for month-to-date demo cost, projected current-month cost, month-to-date average cost per day, today's posted cost, and the latest posted daily cost. Operators can run it from **Refresh Azure status**, **Refresh ops status**, or the Cost Tracking panel's **Refresh costs** button. The projection uses the month-to-date posted cost divided by elapsed calendar days in the current month, then multiplies by the number of days in that month. Cost data is best-effort operational guidance only. Azure Cost Management data can lag behind live runtime usage and may require the signed-in account to have Cost Management read access for the selected resource group.

## Runtime Shape

Legacy demo deployment uses:

- A Workbench-built image from `infra/azure/demo/legacy-openemr-demo.Dockerfile`, derived from `openemr/openemr:8.1.0-2026-06-18`.
- `mariadb:11.8.8`.
- Public ingress to the OpenEMR container on port 80.
- OpenEMR demo admin credentials from the Workbench profile.
- A demo-only helper script injected into the legacy staff and patient portal login pages so `demo=staff` fills `admin` / `pass` and `demo=patient` fills the shared Nora Kim portal credentials, including the legacy portal email confirmation field.
- `OPENEMR_SETTING_portal_onsite_two_enable=1`, which uses the upstream OpenEMR container global-setting hook to make the legacy patient portal login page reachable in the disposable demo.
- A minimal demo bootstrap seed that upserts only the synthetic Nora Kim `MOD-PAT-0004` patient portal account needed by the public landing-page credential.
- A lightweight startup wait so OpenEMR starts after the colocated MariaDB sidecar is accepting connections.

Modernized demo deployment uses:

- A Workbench-built API image from `infra/azure/demo/modernized-api-demo.Dockerfile`.
- A Workbench-built frontend image from `infra/azure/demo/modernized-frontend-demo.Dockerfile`.
- `postgres:17-alpine` as the sidecar database.
- Public ingress to the frontend container on port 8080.
- Nginx proxying `/api/` and `/health` to the API sidecar on port 8081.
- Startup seeding from the shared gold synthetic dataset.

Modern UI Claude demo deployment uses:

- A Workbench-built static frontend image from `infra/azure/demo/modern-ui-claude-demo.Dockerfile`.
- Public ingress to the Claude UI container on port 8080.
- Nginx serving the built SPA with a local `/health` endpoint returning `modern-ui-claude-ok`.
- Nginx proxying `/api/` to the public modernized OpenEMR URL resolved during deployment, so the browser calls Claude same-origin while the container forwards API traffic to the modernized backend.
- No separate database or backend container; it depends on the modernized OpenEMR demo target.

Demo Portal deployment uses:

- A tiny Nginx static container built from `infra/azure/demo/demo-portal.Dockerfile`.
- Static assets under `infra/azure/demo/demo-portal/`.
- Generated `demo-portal-data.json` baked into the image from the Workbench demo-directory registry and the latest known Azure app URLs.
- Public ingress to the portal container on port 80.
- Role-specific demo credentials for staff/admin and patient portal entry points, including the shared synthetic Nora Kim patient portal account.
- Role-specific links that use `demoPreset` registry values to ask each target app to pre-fill its own login form without exposing passwords in the link.
- Technology-stack logo chips from the directory registry so viewers can quickly compare legacy PHP, AngularJS, and MariaDB against the modernized React, .NET, and PostgreSQL stack.

When reset-on-deploy is enabled, the modernized API entrypoint reapplies the generated PostgreSQL seed on startup. When it is disabled, the entrypoint seeds only if the database has not already been initialized.

The generated Container App YAML writes the modernized startup flags as lowercase strings (`DEMO_SEED_ON_STARTUP="true"` and `DEMO_RESET_ON_STARTUP="true"` or `"false"`). The API entrypoint also normalizes those values before testing them. This matters because Azure can otherwise round-trip unquoted YAML booleans as `True`, which a POSIX shell string comparison would not treat as `true`, leaving the demo database unseeded.

The Azure demo image builds use the repository root as their Docker context so the backend, frontend, seed generator, and Azure demo files can be copied into separate stages. The root `.dockerignore` excludes host-generated outputs such as `bin/`, `obj/`, `node_modules/`, `dist/`, and local artifacts so Docker builds use container-generated restore/build metadata instead of copying Windows-local outputs into Linux images.

## Prerequisites

The local machine running the Workbench must have:

- Azure CLI signed in with access to the selected subscription.
- Azure CLI Container Apps and Container Registry commands available.
- Docker running for modernized image builds.
- Git available for image tagging.

Validation resolves Azure CLI from `AZURE_CLI_PATH`, the standard Windows Azure CLI Python module install path, or `az` on `PATH`. It then reports the registration state for the Azure resource providers used by the demo path: `Microsoft.App`, `Microsoft.ContainerRegistry`, and `Microsoft.OperationalInsights`. The deploy action registers those providers automatically when needed and polls until Azure reports them as registered before creating resources. If Azure keeps a provider in `Registering` after the poll window, the next deploy attempt can resume once the subscription-level registration finishes. This handles first-run subscriptions where Container Apps environment creation would otherwise fail because the Log Analytics provider is not registered.

The deployment script creates or updates the resource group, Azure Container Apps environment, Azure Container Registry, and selected Container Apps. Missing Azure resources are expected on the first run: existence checks capture `ResourceNotFound` responses and then create the missing environment, registry, or Container App. Missing Container Apps are first bootstrapped with a small public placeholder image using ordinary `az containerapp create` flags, then immediately updated with generated sidecar YAML. The update YAML uses the Azure CLI `az containerapp update --yaml` shape with root-level `environmentId`, `configuration`, and `template` fields for the final Container App resource body. This avoids Azure CLI `create --yaml` wrapper behavior while still applying the application containers, database sidecars, secrets, ingress, and scale settings.

After each YAML update, the script reads the active Container App template back from Azure and fails the deployment if the expected final images are not present. When the worktree has uncommitted changes, deploy image tags include a `dirty` timestamp suffix so Azure receives a fresh revision instead of reusing an older image for the same Git commit. Smoke checks also poll longer for first startup and reject pages that still contain the generic Azure Container Apps placeholder text, so a public HTTP 200 from the bootstrap image is not treated as a successful OpenEMR deployment. The smoke-only action only checks existing deployed apps and does not report a build image tag.

Legacy smoke checks include the staff login page and the patient portal login page so disabled portal configuration cannot silently ship broken Demo Portal links. Modernized smoke checks include both `/health` and a demo `admin` / `pass` POST to `/api/auth/login`. This verifies that the PostgreSQL seed actually created the authentication tables and seeded the demo administrator account, not just that the API process started. Modern UI Claude smoke checks verify the static app, the Claude `/health` endpoint, and the `/api/auth/login` proxy back to the modernized target. Demo Portal smoke checks verify that the public landing page responds with the expected portal title instead of the Azure Container Apps placeholder.

## Relationship To Other Documents

Read `MODERNIZATION_WORKBENCH.md` for the Workbench control surface and evidence model.

Read `LEGACY_OPENEMR_BASELINE.md` for the local legacy runtime being mirrored into Azure.

Read `MODERNIZATION_PLAN.md` and `TEST_DATA_STRATEGY.md` for the modernized target and gold synthetic dataset used by the demo.
