# Modern UI Claude

Created: 2026-06-24

## Purpose

This document records the plan for "Modern UI Claude": a future, design-first rebuild of the modernized OpenEMR frontend, started as a new top-level application rather than a modification of the existing `modernized-openemr/` work. It exists so the decision and its reasoning survive beyond chat history.

Read this when planning, scoping, or starting work on the new frontend in `modern-ui-claude/`, or when deciding how a new presentation-layer effort should relate to the existing modernized target.

## Background And Motivation

The modernized target in `modernized-openemr/` pairs a React/TypeScript frontend with an ASP.NET Core 10 backend API and PostgreSQL, built slice by slice for behavioral parity with the legacy OpenEMR baseline (see `MODERNIZATION_PLAN.md`). That frontend was built to validate workflow parity quickly, not to be a polished, modern user experience. The project owner considers its current UI dated and not well designed.

Rather than redesign the existing frontend in place, the decision is to build an entirely new frontend, called Modern UI Claude, once the current modernized conversion effort is far enough along. The legacy app and the current modernized app (backend and frontend) are both left untouched.

## Decision: Folder Placement

Modern UI Claude lives in its own top-level folder, `modern-ui-claude/`, as a sibling to `legacy-openemr/`, `modernization-workbench/`, and `modernized-openemr/` - not nested inside `modernized-openemr/`.

Reasoning:

- The existing repo convention is one top-level folder per application. A new application gets a new top-level folder.
- `modernized-openemr/backend` and `modernized-openemr/frontend` are already decoupled: the frontend talks to the backend only through `VITE_API_BASE_URL` and HTTP calls to the OpenAPI-documented API. A second frontend client does not require touching the backend, the database, or the existing frontend.
- Keeping it out of `modernized-openemr/` avoids mixing a fast-moving, design-experimental codebase into a folder whose docs and slice history describe a specific, already-validated implementation.
- It keeps the "leave the modern version as is" constraint unambiguous: no files inside `modernized-openemr/` change because of this work.

## Design Direction: "Calm Clinical"

Before writing code, the functional scope of `modernized-openemr` was reviewed against `modernization-workbench/config/functionality-progress.json` (11 domains, patient chart/registration most complete at 99%, scheduling 83%, admin/security 82%, etc.), and several mockup directions were sketched and reviewed with the project owner for the patient chart, scheduling, and patient portal home screens. The approved direction, "Calm Clinical", was selected over a denser, more traditional EMR layout:

- Light background (`#F7F9F8`), white cards, thin 0.5px borders.
- Teal accent for primary actions and active state (`#0F6E56` on `#E1F5EE`); coral accent reserved for alerts/errors (`#993C1D` on `#FAECE7`).
- Rounded-lg cards, icon-only sidebar, generous whitespace, sentence-case copy.

This palette and component language now govern all screens built in `modern-ui-claude/`, including the login and landing screens described below.

**Bolder pass (2026-06-24):** the sign-in screens (`EntryChooser.tsx`, `ClinicianLogin.tsx`, `PortalLogin.tsx`) and both landing screens' headers (`PortalHome.tsx`, `ClinicianHome.tsx`) were revisited for more visual impact, after the project owner felt the original flat treatment was too plain. The teal/coral palette is unchanged; what's new is a split hero/illustration layout on the three sign-in screens (gradient teal hero panel + hand-drawn flat SVG illustration + value-prop copy, next to the existing form card), a gradient `.dashboard-hero` banner replacing the flat header panel on both landing screens (with icon-badge stat chips and a corner illustration), and deeper card shadows (`--shadow-card`, `--shadow-pop` tokens) plus bigger stat typography throughout. Icons are from the new `lucide-react` dependency (added to `package.json`/`package-lock.json`); decorative artwork is original hand-crafted flat SVG in `src/illustrations.tsx` (not fetched from any external source — outbound fetches to image CDNs/GitHub were blocked in the build sandbox, so these were drawn directly as code, in the same unDraw-style flat aesthetic the project owner asked for).

## Target Shape: Login + Landing Slice (Implemented)

The first implemented slice is intentionally narrow: two working sign-in flows and two landing screens.

- Independent React + TypeScript + Vite SPA with its own `package.json`, `tsconfig`, and Dockerfile — no shared build tooling with `modernized-openemr/frontend`.
- Calls the existing `modernized-openemr` backend API directly over HTTP via `VITE_API_BASE_URL`; no new backend, schema, or database was created or changed. One narrow exception: `modernized-openemr/backend/src/OpenEmr.Modernized.Api/Program.cs`'s CORS policy (`local-workbench-and-spa`) had to add `http://localhost:3100` / `http://127.0.0.1:3100` to its origin allowlist, or the browser blocks every request from this app before it reaches the API (both login screens fail identically). This is a configuration-only, additive change to the allowlist — no behavior, schema, or workflow logic changed. Rebuilding the `api` container (`docker compose up -d --build api` from `modernized-openemr/`) is required after this change since it's compiled, not hot-reloaded.
- Routes: `/` (chooser), `/login` and `/home` (professional/clinician sign-in, calling `POST /api/auth/login` and `GET /api/auth/session`), `/portal/login` and `/portal/home` (patient portal sign-in, calling `POST /api/patient-portal/login` and `GET /api/patient-portal/session`).
- Both login forms call real backend endpoints — there is no mocked or fake authentication. Demo credentials already seeded in the modernized backend are pre-filled (`admin` / `pass` for the professional login, `mod-pat-0004@example.test` / `PortalPass207!` for the patient portal) to make the demo runnable without separate provisioning.
- The clinician landing screen (`ClinicianHome.tsx`) remains a "simplified welcome shell": it re-fetches the live session and renders a few real fields (display name, role, session source, last-seen).
- The patient portal landing screen (`PortalHome.tsx`) is a full dashboard, not a welcome shell. It calls real `modernized-openemr` endpoints for: home summary (`GET /api/patient-portal/home`), upcoming appointments + an appointment-request form (`GET .../appointments/request-options`, `POST .../appointments/requests`), inbox + compose (`GET`/`POST .../messages`), documents list + per-document download (`GET .../documents`, `POST .../documents/download`), lab results (`GET .../lab-results`), and a one-click medical report PDF (`POST .../medical-report/pdf`). Two action tiles — "Pay a bill" and "Request a refill" — have no backing API in `modernized-openemr` yet; rather than fake them, they're visibly marked with an "API not available yet" badge and show an explanatory banner on click instead of performing any action.
- Hand-written request/response types in `modern-ui-claude/src/api.ts`, mirrored from the equivalent types already in `modernized-openemr/frontend/src/api.ts` (no generated client yet — revisit if/when the API surface grows further).
- Runs in Docker Desktop via its own `docker-compose.yml` (service `modern-ui-claude`, host port 3100), as a separate stack from `modernized-openemr`'s compose file. It assumes the `modernized-openemr` stack is already running and reachable at `http://localhost:5001`. The compose stack bind-mounts the app folder into the container and enables polling-based Vite file watching, so normal source edits should show through hot reload or browser refresh without rebuilding the image; rebuilds are still needed for dependency, Dockerfile, or container-configuration changes.
- Registered in `modernization-workbench/config/apps.json` as a managed Docker Compose application. The Workbench Applications page can show whether the `modern-ui-claude` service is stopped/running, check `http://localhost:3100/`, start it with `docker compose up -d --build`, stop/restart it, and load recent compose logs.

**Health summary feature (2026-06-24):** the patient portal landing page gained a fourth records action tile, "View health summary", wired to the previously-unused `GET /api/patient-portal/clinical-summary` endpoint. It renders problems, allergies, medications, and prescriptions as four labeled lists inside the same toggle-to-load inline-panel pattern used for documents and lab results, with per-category empty states. No backend changes were needed — the endpoint and DTOs already existed.

**Message thread + reply feature (2026-06-24):** the inbox panel gained drill-down conversation viewing. Clicking a message in the inbox list now opens its full thread via the previously-unwired `GET /api/patient-portal/messages/{id}/thread` endpoint, best-effort marks it read via `PUT .../messages/{id}/read`, and shows a reply form wired to `POST .../messages/{id}/reply`; replying re-fetches the thread and refreshes the home summary's unread count. A "Back to inbox" link returns to the list view without leaving the Messages panel. No backend changes were needed — all three endpoints and DTOs already existed.

**Patient portal overhaul (2026-06-24):** the patient portal was restructured from a single mega-page with inline toggles into a multi-section SPA using React Router nested routes under `/portal/*`. A persistent `PortalShell` component handles session validation, renders the gradient hero banner with three clickable stat chips (upcoming appointments count, new-messages count, next-appointment date — each navigates to the appropriate section), and a sticky horizontal tab bar with an unread-message badge. The five sections each have their own page component:

- **`/portal/home` (PortalDashboard):** four quick-action tiles (Messages, Appointments, Records, Download Medical Report — unavailable-API tiles removed), upcoming appointment preview cards with a "See all" link, and a message summary with a compose shortcut.
- **`/portal/messages` (PortalMessages):** full inbox with read/unread visual distinction (unread rows are bold + teal left-border on teal-soft background, with preview snippet and date), compose as a primary pill button opening a full form with subject datalist (General, Insurance, Prior Auth, Bill/Collect, Referral, Pharmacy per Slice 239), and thread view rendered as chat bubbles (received left / sent right) with an inline circular send button for replies.
- **`/portal/appointments` (PortalAppointments):** appointment cards with a date-block column (abbreviated month, day number, weekday), colour-coded status badges (teal=scheduled, amber=pending, grey=completed, coral=cancelled), add-to-calendar .ics download per appointment, and the appointment-request form as a collapsible inline panel.
- **`/portal/records` (PortalRecords):** four sub-tabs (Documents, Lab Results, Health Summary, Medical Report), each lazy-loaded on first visit. Lab results render a full expandable order→report→result tree: each order row expands to show its reports, each report shows a result table with value, units, reference range, and colour-coded abnormal flags (H/HH=coral, L/LL=blue, A=amber). Health summary is a two-column grid with separate categories for Problems, Allergies, Medications, and Prescriptions.
- **`/portal/account` (PortalAccount):** avatar row with display name, account detail fact-list, and a coral sign-out button.

New CSS additions: skeleton shimmer loading rows (no more bare "Loading…" text), empty-state component (icon badge + message + optional CTA), quick-action grid, appointment card layout with date-block, message-row read/unread styles, chat-bubble thread layout with reply send button, records sub-tab pill nav, lab result expandable tree with flagged-row highlighting, health summary 2-column grid, and account avatar/sign-out styles.

## Status

Active implementation as of 2026-06-24. The login + landing slice described above exists and runs in `modern-ui-claude/`. The app is now visible in the Modernization Workbench Applications page as a frontend-only managed Docker Compose service. The patient portal (`/portal/*`) is a fully navigable multi-section SPA with a persistent shell, tab nav, skeleton loading, improved inbox/thread, appointment cards, and an expandable lab-result tree. The clinician landing page (`/home`) is still a minimal welcome shell. Broader clinician-side screens (patient chart, scheduling, etc., per the approved Calm Clinical mockups) are not yet built.

## Related Documents

- `MODERNIZATION_PLAN.md` - target architecture and fidelity rules for the modernized backend/database that this UI will call.
- `MODERNIZATION_WORKBENCH.md` - how applications are registered and managed; includes the Modern UI Claude Applications-page registration.
- `DOCUMENTATION_GOVERNANCE.md` - the rule this document follows by existing alongside the folder it describes.
