# Modernized OpenEMR Implementation Plan

Created: 2026-06-18

## Purpose

This document defines how the project will rebuild OpenEMR from scratch on the modernized stack while preserving the observable workflow behavior and user-facing familiarity of the legacy OpenEMR baseline.

The target is not a cosmetic clone of old PHP pages. The target is a modern application that existing OpenEMR users can migrate to with minimal workflow shock because navigation, terminology, screen intent, and task outcomes remain recognizable.

## North Star

Rebuild OpenEMR as a modern system with:

- React SPA frontend.
- ASP.NET Core / C# backend API and business tier.
- PostgreSQL database.
- Docker Compose local runtime.
- Shared synthetic gold dataset seeded into both legacy and modernized databases.
- Parity tests that run against both systems.
- Modernization Workbench orchestration, evidence, and comparison.

## Fidelity Rules

The modernized UI should remain faithful where user muscle memory matters:

- Preserve the major OpenEMR module structure and workflow names.
- Preserve patient search, chart, encounter, scheduling, billing, lab, medication, message, and administration task flow.
- Preserve key field names and visible domain concepts unless a documented decision renames them.
- Preserve outcomes and validation behavior before changing interaction patterns.
- Prefer clearer layout, accessibility, responsiveness, and performance while avoiding gratuitous workflow redesign.

The implementation should not preserve legacy technical constraints:

- Do not preserve PHP frames as an architecture pattern.
- Do not keep business rules in UI components.
- Do not encode business logic in database-specific scripts or stored procedures.
- Do not require MariaDB table shapes in the modern API.
- Do not make the React UI call the database directly.

## Target Architecture

### Frontend

- React with TypeScript.
- SPA-like client-side application.
- Route-based modules that mirror OpenEMR user tasks.
- API client layer that calls the modernized backend.
- UI components organized by workflow slice.
- Styling that is familiar to legacy OpenEMR users but cleaner, responsive, and accessible.

### Backend

- ASP.NET Core 10 Web API.
- Minimal APIs grouped by feature for early slices; keep handlers thin.
- Business rules in application services.
- Request/response DTOs separate from database entities.
- Health endpoint for Workbench/runtime checks.
- OpenAPI enabled for discoverable contracts.

### Database

- PostgreSQL.
- Modernized schema designed around domain concepts rather than direct MariaDB table mimicry.
- Migrations or schema scripts owned by the modernized solution.
- Seed adapter that consumes the shared canonical gold dataset.
- Database-specific behavior kept behind backend services.

### Workbench Integration

- Modernized OpenEMR becomes a managed application in `modernization-workbench/config/apps.json`.
- Workbench can start, stop, restart, health-check, seed, and run tests for the modernized target.
- Workbench comparison views should eventually show legacy-vs-modernized parity status by workflow.

## Vertical Slice Strategy

Each slice follows the same loop:

1. Discover legacy behavior and identify seed-data anchors.
2. Ensure or add legacy parity tests for the workflow.
3. Add or extend PostgreSQL seed mapping from the canonical dataset.
4. Implement modern database schema, backend API, and frontend UI.
5. Add modernized target adapters to the parity harness where needed.
6. Run the same tests against legacy and modernized targets.
7. Compare results and document accepted differences.
8. Update Workbench progress and project docs.

## Slice Order

### Slice 1: Patient Search And Chart Summary

Goal:

- Implement the first read-only workflow that existing users immediately recognize.

Status:

- Implemented as the first modernized target slice under `modernized-openemr/`.
- Verified with local builds, Docker Compose runtime, PostgreSQL gold-data seed, modernized smoke checks, and matched side-by-side slice-1 parity runs against the legacy baseline.

Scope:

- PostgreSQL patient seed table from the canonical gold dataset.
- API endpoints for patient search/list and patient chart summary.
- React patient finder and chart summary UI.
- Workbench-managed modernized runtime and seed action.
- Parity target activation for read-only database/API/UI checks where practical.

Acceptance:

- Modernized app can start locally and through Docker Compose.
- Modernized database can be seeded from the shared gold dataset.
- Patient search returns Avery Stone / `MOD-PAT-0001` and other canonical patients.
- Patient chart summary displays demographics, contact information, care-team metadata, activity counts, next appointment, and latest encounter faithful to legacy OpenEMR screen intent.
- Workbench can see the modernized target as a running managed application.

Current limitations:

- This slice is read-only.
- Modernized authentication is deferred to the administration/security slice.
- Reusable parity-test adapters now exist for the first read-only slice: PostgreSQL database probes, shared anchor-patient checks, and Playwright chart visibility checks.
- Broader mutation-capable workflow parity remains deferred slice by slice; the first implemented mutation path is patient contact editing in Slice 10.

### Slice 2: Scheduling

Goal:

- Implement the first scheduling workflow that lets existing users find and inspect future appointments from the modernized Calendar module.

Status:

- Implemented as a read-only scheduling slice under `modernized-openemr/`.
- Verified with local builds, Docker Compose runtime, modernized smoke checks, and matched side-by-side slice-2 scheduling parity runs against the legacy baseline.

Scope:

- PostgreSQL appointment queries from the canonical gold dataset.
- API endpoints for future appointment list/search and appointment detail.
- React Calendar module with appointment filter, appointment list, and appointment detail panels.
- Workbench-managed slice-2 scheduling parity plan for both legacy and modernized targets.
- Scheduling parity tests using existing gold scheduling anchors.

Acceptance:

- Calendar module is selectable from the modernized left navigation.
- Future appointments can be filtered by canonical patient ID, public patient ID, or legacy PID.
- Appointment detail displays patient, date, time, duration, status, room, provider, facility, category, and appointment ID.
- The `slice-2-scheduling-readiness` plan passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice is read-only.
- Appointment create, cancel, update, and delete workflows remain deferred to a later scheduling mutation slice.

### Slice 3: Encounters And Clinical Notes

Goal:

- Implement the first clinical-visit workflow that lets users inspect encounter reason, diagnosis, vitals, and SOAP note details from the modernized Encounters module.

Status:

- Implemented as a read-only encounter clinical detail slice under `modernized-openemr/`.
- Verified with local builds, Docker Compose runtime, modernized smoke checks, and matched side-by-side slice-3 encounter parity runs against the legacy baseline.

Scope:

- PostgreSQL encounter, vitals, clinical note, and billing-count queries from the canonical gold dataset.
- API endpoints for encounter list/search and encounter detail.
- React Encounters module with patient/date filters, encounter list, visit metadata, vitals, and SOAP note panels.
- Workbench-managed slice-3 encounters parity plan for both legacy and modernized targets.
- Encounter parity tests using the existing `MOD-PAT-0001` clinical anchor.

Acceptance:

- Encounters module is selectable from the modernized left navigation.
- Encounters can be filtered by canonical patient ID, public patient ID, or legacy PID.
- Encounter detail displays patient, date, encounter number, provider, facility, diagnosis, billing-line count, vitals, and SOAP note.
- The `slice-3-encounters-readiness` plan passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice is read-only.
- Encounter create, update, and delete workflows remain deferred to a later encounter mutation slice.

### Slice 4: Clinical Lists And Medications

Goal:

- Implement the first clinical-list workflow that lets users inspect active problems, allergies, medication list entries, and prescriptions from the modernized Lists module.

Status:

- Implemented as a read-only clinical lists and medications slice under `modernized-openemr/`.
- Verified with local builds, Docker Compose runtime, modernized smoke checks, and matched side-by-side slice-4 clinical-lists parity runs against the legacy baseline.

Scope:

- Problems, allergies, medication list, prescriptions.
- React Lists module with patient lookup and separate panels for problems, allergies, medications, and prescriptions.
- ASP.NET Core clinical-list API over the modernized PostgreSQL gold-data tables.
- Workbench-managed slice-4 clinical-lists parity plan for both legacy and modernized targets.
- Clinical-list parity tests using the existing `MOD-PAT-0001` anchor.

Acceptance:

- Lists module is selectable from the modernized left navigation.
- Clinical lists can be loaded by canonical patient ID, public patient ID, or legacy PID.
- The modernized UI displays the same stable anchor problem, allergy, medication-list, and prescription facts used by the legacy UI.
- The `slice-4-clinical-lists-readiness` plan passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice is read-only.
- Create, deactivate, delete, and medication reconciliation workflows remain deferred to a later clinical-list mutation slice.

### Slice 5: Messaging And Portal-Facing Data

Goal:

- Implement the first patient-communication workflow that lets users inspect portal-enabled status and seeded patient messages from the modernized Messages module.

Status:

- Implemented as a read-only messaging and portal-facing data slice under `modernized-openemr/`.
- Verified with local builds, Docker Compose runtime, modernized smoke checks, and matched side-by-side slice-5 messaging parity runs against the legacy baseline.

Scope:

- Patient messages and status lifecycle.
- Portal-enabled patient flags.
- React Messages module with patient lookup, portal flag display, message status counts, and message detail cards.
- ASP.NET Core patient-message API over the modernized PostgreSQL gold-data tables.
- Workbench-managed slice-5 messaging parity plan for both legacy and modernized targets.
- Messaging parity tests using the existing `MOD-PAT-0004` portal-messaging anchor.

Acceptance:

- Messages module is selectable from the modernized left navigation.
- Patient messages can be loaded by canonical patient ID, public patient ID, or legacy PID.
- The modernized UI displays the same stable portal flag, message titles, message bodies, and statuses used by the legacy patient-notes screen.
- The `slice-5-messaging-readiness` plan passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice is read-only.
- Message create, status update, soft-delete, hard-delete, assignment, and portal reply workflows remain deferred to a later messaging mutation slice.

### Slice 6: Labs And Procedure Results

Status:

- Implemented as a read-only procedure-result slice under `modernized-openemr/`.
- Verified with local builds, Docker Compose runtime, modernized smoke checks, and matched side-by-side slice-6 procedure-result parity runs against the legacy baseline.

Scope:

- Procedure orders, reports, and results.
- React Procedures module with patient lookup, order/report/result counts, order cards, and final result detail cards.
- ASP.NET Core procedure-results API over the modernized PostgreSQL lab order, lab report, and lab result tables.
- Workbench-managed slice-6 procedures parity plan for both legacy and modernized targets.
- Procedure-result parity tests using the existing `MOD-PAT-0009` completed-lab anchor.

Acceptance:

- Procedures module is selectable from the modernized left navigation.
- Procedure results can be loaded by canonical patient ID, public patient ID, or legacy PID.
- The modernized UI displays the same stable completed CBC order, complete report, final result rows, result values, units, ranges, and status concepts used by the legacy procedure results screen.
- The `slice-6-procedures-readiness` plan passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice is read-only.
- Procedure order create, completion, report entry, result entry, correction, review, and delete workflows remain deferred to a later procedure mutation slice.

### Slice 7: Billing And Fee Sheet

Status:

- Implemented as a read-only fee-sheet billing slice under `modernized-openemr/`.
- Verified with local builds, Docker Compose runtime, modernized smoke checks, and matched side-by-side slice-7 fee-sheet billing parity runs against the legacy baseline.

Scope:

- Encounter billing lines and charge totals.
- CPT code, description, fee, billing date, and diagnosis justification display.
- React Fees module with patient lookup, billing encounter list, selected fee-sheet line display, and count/total summary.
- ASP.NET Core billing API over the modernized PostgreSQL billing and encounter tables.
- Workbench-managed slice-7 billing parity plan for both legacy and modernized targets.
- Fee-sheet parity tests using the existing `MOD-PAT-0001` clinical/billing anchor.

Acceptance:

- Fees module is selectable from the modernized left navigation.
- Billing can be loaded by canonical patient ID, public patient ID, or legacy PID.
- The modernized UI displays the same stable `99214` established patient office visit and `36415` routine venipuncture fee-sheet lines used by the legacy fee sheet for encounter `1000013`.
- The `slice-7-billing-readiness` plan passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice is read-only.
- CPT entry, bill-status lifecycle, claim generation, payer adjudication, payment posting, and billing deletion workflows remain deferred to later billing mutation slices.
- Insurance-aware billing summaries remain planned.

### Slice 8: Administration, Security, And Audit

Status:

- Implemented as a read-only administration directory slice under `modernized-openemr/`.
- Verified with local builds, Docker Compose runtime, modernized smoke checks, and matched side-by-side slice-8 administration parity runs against the legacy baseline.

Scope:

- Seeded users, provider/staff roles, calendar-enabled provider flags, active status, authorized-provider flags, and assigned facilities.
- Seeded facility directory details, including code, name, phone, address, and color.
- React Admin module with user/facility directory cards and access-control status summary.
- ASP.NET Core administration API over the modernized PostgreSQL staff and facility tables.
- Workbench-managed slice-8 admin parity plan for both legacy and modernized targets.
- Administration parity tests using the seeded `gold-provider-02`, `gold-billing-01`, and MAIN/NORTH/EAST facility anchors.

Acceptance:

- Admin module is selectable from the modernized left navigation.
- The modernized UI displays the same seeded gold users and facilities visible in legacy OpenEMR's Users and Facilities administration pages.
- The API reports 20 seeded users, 12 providers, 12 calendar-enabled users, and 3 seeded facilities.
- The `slice-8-admin-readiness` plan passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice is read-only.
- First-party modernized login, ASP.NET Core Identity, authorization policies, permission editing, user/facility mutation workflows, and audit-event logging remain deferred to later administration/security mutation slices.
- The Admin screen clearly labels authentication, authorization, and audit logging as deferred or planned so this directory slice is not mistaken for full security modernization.

### Slice 9: Reports, Documents, And Integrations

Status:

- Implemented first as a read-only operational reports slice under `modernized-openemr/`.
- Verified with local builds, Docker Compose runtime, modernized smoke checks, and matched side-by-side slice-9 reports parity runs against the legacy baseline.

Scope:

- Gold-data operational report snapshot covering patients, portal-enabled patients, appointments, future appointments, current-year activity, encounters, billing totals, lab reports, messages, facilities, and providers.
- Provider activity reports with encounter counts, billing-line counts, and seeded charge totals.
- Facility activity reports with appointment counts, encounter counts, billing-line counts, and seeded charge totals.
- Clinical condition summary reports over active problem-list entries.
- React Reports module with report cards and summary panels.
- ASP.NET Core reports API over the modernized PostgreSQL read model.
- Workbench-managed slice-9 reports parity plan for both legacy and modernized targets.

Acceptance:

- Reports module is selectable from the modernized left navigation.
- The modernized API returns the stable operational-report anchors: 1,000 patients, 1,261 future appointments, 1,100 current-year encounters, 3,000 billing lines, `$446,000.00` seeded charges, `gold-provider-02` activity, NORTH facility activity, and `Asthma, uncomplicated` condition count.
- The `slice-9-reports-readiness` plan passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice is read-only.
- CSV/export generation, saved report definitions, document storage, scanned attachments, patient document workflows, fax/SMS integrations, CCDA/export workflows, and external integration adapters remain deferred to later reports/documents/integrations slices.

### Slice 10: Patient Contact Mutation

Status:

- Implemented as the first mutation-capable modernized workflow slice under `modernized-openemr/`.
- Verification is the shared `slice-10-contact-mutation-readiness` plan, which updates, renders, and restores the same anchor patient contact record on both legacy and modernized targets.

Scope:

- PostgreSQL patient contact fields for home phone, cell phone, email, and HIPAA SMS/email permission flags.
- ASP.NET Core `/api/patients/{patientId}/contact` update endpoint that owns the contact mutation behavior.
- React chart-summary contact editor with inline edit, save, cancel, and refreshed chart state.
- Modernized workflow action adapter in the parity harness so mutation tests can use the same workflow intent on both targets.
- Workbench-managed slice-10 contact mutation parity plan for both legacy and modernized targets.

Acceptance:

- The modernized patient chart can edit and save home phone, cell phone, email, SMS permission, and email permission.
- The update path goes through the modernized backend API, not direct UI-to-database access.
- The `slice-10-contact-mutation-readiness` plan updates `MOD-PAT-0001`, verifies database state, verifies browser-visible contact values, restores the original record, and passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice covers patient contact only.
- Full demographics editing, validation parity, audit history, patient create/merge/deactivate workflows, and broader registration workflows remain deferred to later patient-administration mutation slices.

### Slice 11: Scheduling Appointment Mutation

Status:

- Implemented as the second mutation-capable modernized workflow slice under `modernized-openemr/`.
- Verification is the shared `slice-11-appointment-mutation-readiness` plan, which creates, cancels, renders, and removes a future appointment on both legacy and modernized targets.

Scope:

- ASP.NET Core appointment create, status update, and delete endpoints over the modernized PostgreSQL appointment table.
- React Calendar controls for creating a future appointment from the scheduler panel and cancelling or deleting the selected appointment from the detail panel.
- Modernized workflow action adapter methods for appointment create, get, cancel/status update, and delete.
- Workbench-managed slice-11 appointment mutation parity plan for both legacy and modernized targets.
- Modernized smoke coverage for a safe create/cancel/delete appointment lifecycle with cleanup.

Acceptance:

- The modernized Calendar module can create a future appointment for a patient, display it in the appointment list/detail view, mark it cancelled, and delete it.
- The mutation path goes through the modernized backend API, not direct UI-to-database access.
- The `slice-11-appointment-mutation-readiness` plan creates a future appointment for `MOD-PAT-0003`, verifies appointment counts and database state, verifies browser-visible cancelled appointment values, deletes the appointment, and passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice covers a single future appointment lifecycle only.
- Recurring appointments, provider availability validation, resource scheduling, appointment categories beyond the seeded default, reminders, check-in/check-out, waitlist flows, and billing/encounter conversion remain deferred to later scheduling slices.

## Test Strategy

Modernization testing uses the existing layers:

- Native legacy tests remain implementation confidence for the baseline.
- Shared parity tests define cross-system behavior.
- Database probes normalize domain facts for MariaDB and PostgreSQL.
- HTTP/API tests validate backend-visible behavior.
- Playwright UI tests validate user-facing workflows.
- Workflow mutation tests validate CRUD lifecycle behavior.
- Comparison artifacts prove side-by-side parity.

For modernized work, a slice is not done until the relevant parity tests can run against both targets or a documented gap explains why the slice is not yet comparable.

## Data Migration Strategy

The first implementation uses the canonical gold dataset rather than a live legacy dump. This keeps the modernization test loop deterministic and non-PHI.

For each slice:

- Define modern PostgreSQL tables for the slice.
- Map canonical dataset records into the modern schema.
- Keep source dataset IDs such as `canonicalId`, `pid`, and `pubpid` available for parity lookup.
- Avoid coupling modern business logic to legacy MariaDB column names.
- Document any semantic mapping decision that is not obvious.

## UI Fidelity Strategy

The modern UI should look and feel like a cleaner OpenEMR application:

- Operational app shell, not a marketing page.
- Familiar patient finder and chart workspace.
- Dense, scannable clinical information.
- Clear module navigation.
- No decorative hero layouts.
- Use modern spacing, responsive behavior, and accessible controls.
- Keep labels and screen vocabulary close to legacy OpenEMR.

## Definition Of Done For A Slice

A slice is complete when:

- Modernized schema/API/UI are implemented.
- Seed adapter loads the required canonical data into PostgreSQL.
- Unit or service tests exist where business logic is non-trivial.
- HTTP/API checks pass.
- Playwright UI checks pass for user-facing behavior.
- Parity evidence is generated and, when both targets are implemented, compared.
- Workbench reflects runtime, seed, and test status.
- Documents and changelog are updated.

## Current Starting Point

As of 2026-06-19:

- Legacy OpenEMR baseline is implemented, seeded, and testable.
- Modernization Workbench is implemented.
- Shared gold dataset is implemented.
- Legacy parity plan passes.
- Native legacy PHPUnit and Jest lanes pass.
- Modernized OpenEMR target exists under `modernized-openemr/`.
- The first modernized vertical slice implements React patient search/chart summary, ASP.NET Core patient APIs, PostgreSQL seed mapping from the shared gold dataset, Docker Compose runtime, Workbench app registration, and side-by-side slice-1 parity evidence.
- The second modernized vertical slice implements read-only scheduling with a React Calendar module, ASP.NET Core appointment APIs, PostgreSQL appointment queries, expanded modernized smoke checks, Workbench scheduling plan actions, and matched side-by-side slice-2 parity evidence.
- The third modernized vertical slice implements read-only encounters with a React Encounters module, ASP.NET Core encounter APIs, PostgreSQL SOAP/vitals queries, expanded modernized smoke checks, Workbench encounters plan actions, and matched side-by-side slice-3 parity evidence.
- The fourth modernized vertical slice implements read-only clinical lists with a React Lists module, ASP.NET Core clinical-list API, PostgreSQL problem/allergy/medication/prescription queries, expanded modernized smoke checks, Workbench clinical-lists plan actions, and matched side-by-side slice-4 parity evidence.
- The fifth modernized vertical slice implements read-only patient messages with a React Messages module, ASP.NET Core patient-message API, PostgreSQL message and portal-flag queries, expanded modernized smoke checks, Workbench messaging plan actions, and matched side-by-side slice-5 parity evidence.
- The sixth modernized vertical slice implements read-only completed procedure/lab results with a React Procedures module, ASP.NET Core procedure-results API, PostgreSQL lab order/report/result queries, expanded modernized smoke checks, Workbench procedures plan actions, and matched side-by-side slice-6 parity evidence.
- The seventh modernized vertical slice implements read-only fee-sheet billing with a React Fees module, ASP.NET Core billing API, PostgreSQL billing-line queries, expanded modernized smoke checks, Workbench billing plan actions, and side-by-side slice-7 parity evidence.
- The eighth modernized vertical slice implements read-only administration directory behavior with a React Admin module, ASP.NET Core administration API, PostgreSQL staff/facility queries, expanded modernized smoke checks, Workbench admin plan actions, and matched side-by-side slice-8 parity evidence.
- The ninth modernized vertical slice implements read-only operational reports with a React Reports module, ASP.NET Core reports API, PostgreSQL aggregate report queries, expanded modernized smoke checks, Workbench reports plan actions, and matched side-by-side slice-9 parity evidence.
- The tenth modernized vertical slice implements patient contact mutation with a React chart contact editor, ASP.NET Core contact update endpoint, PostgreSQL contact fields, modernized workflow action adapter, Workbench contact mutation plan action, and side-by-side slice-10 parity evidence.
- The eleventh modernized vertical slice implements appointment mutation with React Calendar create/cancel/delete controls, ASP.NET Core appointment lifecycle endpoints, modernized workflow action adapter methods, Workbench appointment mutation plan action, smoke coverage, and side-by-side slice-11 parity evidence.
