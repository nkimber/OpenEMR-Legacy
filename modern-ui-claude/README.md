# Modern UI Claude

## Status

Active implementation. A first slice exists: two working sign-in flows (professional/clinician and patient portal) and two minimal landing screens, styled in the approved "Calm Clinical" direction. Broader screens (patient chart, scheduling, portal home, etc.) are not built yet — see `documents/MODERN_UI_CLAUDE.md` for the full design rationale and scope notes.

## Purpose

A from-scratch, design-first frontend for the modernized OpenEMR system. The goal is a substantially better-designed UI for the same product, not a second implementation of the backend or database.

## Relationship To Other Applications

- `legacy-openemr/` - untouched. Remains the behavioral reference baseline.
- `modernized-openemr/` - untouched. Remains the system of record for the modernized backend API, database, and its current React frontend. This new UI does not modify, depend on, or live inside that folder.
- `modern-ui-claude/` (this folder) - a new, independent frontend client. It calls the existing `modernized-openemr/backend` API over HTTP exactly as `modernized-openemr/frontend` does today, using its own `VITE_API_BASE_URL` configuration. No backend or database changes were required to build this.

## What's Here

- React + TypeScript SPA built with Vite, own `package.json`, own build tooling, independent of `modernized-openemr/frontend`.
- Routes: `/` (chooser), `/login` + `/home` (professional sign-in and landing), `/portal/login` + `/portal/home` (patient portal sign-in and landing).
- Both login screens call the real modernized backend (`POST /api/auth/login` for staff, `POST /api/patient-portal/login` for patients) — sign-in is real, not mocked.
- Each landing screen re-fetches the live session from the backend and shows a few real fields (name, role, session source) to confirm the integration works end-to-end.

## Running Locally

1. Make sure the existing `modernized-openemr` stack is running (from `modernized-openemr/`: `docker compose up -d`), so its API is reachable at `http://localhost:5001`.
2. From this folder: `npm install`, then `npm run dev`. The app serves at `http://localhost:3100`.
3. Demo credentials are pre-filled on each login screen: `admin` / `pass` for professional sign-in, `mod-pat-0004@example.test` / `PortalPass207!` for the patient portal.

## Running In Docker Desktop

1. Start `modernized-openemr`'s own compose stack first (it is not redefined here).
2. From this folder: `docker compose up --build`. The app is published on `http://localhost:3100` and talks to the API on `http://localhost:5001`.
3. After the container has been built once, normal source edits are reflected by the running Vite dev server through the Docker bind mount. Rebuild only when `package.json`, `package-lock.json`, the Dockerfile, or container-level configuration changes.

## Workbench Management

Modern UI Claude is registered in `modernization-workbench/config/apps.json`. The Modernization Workbench Applications page can show the `modern-ui-claude` Docker Compose service status, check `http://localhost:3100/`, start it with `docker compose up -d --build`, stop/restart it, open the app, and load recent compose logs. Because the compose file mounts the app folder into the container, future source edits should appear through Vite hot reload or a browser refresh without rebuilding the image.

## Next Steps

1. Build out the remaining approved Calm Clinical screens (patient chart, scheduling, patient portal home) on top of this login/landing foundation.
2. Decide on OpenAPI-generated client vs. continuing to hand-write types in `src/api.ts` as the surface grows.

See `documents/MODERN_UI_CLAUDE.md` for the durable project-level record of this plan and its design rationale.
