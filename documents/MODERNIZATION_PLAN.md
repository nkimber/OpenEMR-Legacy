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
- Appointment create, cancel, and delete workflows are covered by Slice 11 for the focused future-appointment lifecycle; recurring appointments, availability validation, reminders, and conversion to encounter workflows remain deferred.

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
- Encounter create, update, and delete workflows are covered by Slice 12 for the focused encounter/vitals/SOAP lifecycle; broader encounter-adjacent workflows such as orders, billing linkage, authorization, and audit history remain deferred.

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
- Allergy create, deactivate, and delete workflows are covered by Slice 13 for the focused allergy lifecycle. Prescription create, active rendering, deactivate, and delete workflows are covered by Slice 15 for the focused prescription lifecycle. Problem-list mutation is covered by Slice 31. Medication-list mutation is covered by Slice 32. Vocabulary lookup, duplicate detection, audit history, medication reconciliation, and broader e-prescribing workflows remain deferred.

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
- Message create, status update, soft-delete, hard-delete, and assignment workflows are covered by Slice 14 for the focused patient-message lifecycle; portal replies, attachments, routing queues, notification delivery, and richer task assignment remain deferred.

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
- Focused procedure order create, completion, report entry, result entry, and cascade-delete workflows are covered by Slice 17.
- Result correction, amendment/versioning, external lab integration, specimen handling, order catalog management, review queues, and audit history remain deferred to later lab/procedure slices.

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
- Focused CPT entry, bill-status update, inactive-line hiding, and billing-line deletion workflows are covered by Slice 16.
- Claim generation, payer adjudication, remittance import, payment posting mutation, charge correction history, and full revenue-cycle workflows remain deferred to later billing slices.
- Patient insurance coverage visibility is covered by Slice 28; focused insurance coverage create/update/delete behavior is covered by Slice 34. Claim generation, payer adjudication, remittance import, payment posting mutation, and full revenue-cycle workflows remain deferred to later billing slices.

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
- Focused facility create, update, inactive status, and delete workflows are covered by Slice 18.
- First-party modernized login, ASP.NET Core Identity, authorization policies, broad role/permission administration, user account mutation workflows, and audit-event logging remain deferred to later administration/security mutation slices.
- The Admin screen clearly labels authentication, authorization, and audit logging as deferred or planned so this directory slice is not mistaken for full security modernization.

### Slice 9: Reports, Documents, And Integrations

Status:

- Implemented first as a read-only operational reports slice under `modernized-openemr/`.
- Verified with local builds, Docker Compose runtime, modernized smoke checks, and matched side-by-side slice-9 reports parity runs against the legacy baseline.

Scope:

- Gold-data operational report snapshot covering patients, portal-enabled patients, appointments, future appointments, current-year activity, encounters, billing totals, lab reports, patient documents, messages, facilities, and providers.
- Provider activity reports with encounter counts, billing-line counts, and seeded charge totals.
- Facility activity reports with appointment counts, encounter counts, billing-line counts, and seeded charge totals.
- Clinical condition summary reports over active problem-list entries.
- React Reports module with report cards and summary panels.
- ASP.NET Core reports API over the modernized PostgreSQL read model.
- Workbench-managed slice-9 reports parity plan for both legacy and modernized targets.

Acceptance:

- Reports module is selectable from the modernized left navigation.
- The modernized API returns the stable operational-report anchors: 1,000 patients, 1,261 future appointments, 1,100 current-year encounters, 3,000 billing lines, `$446,000.00` seeded charges, 1,200 patient documents, `gold-provider-02` activity, NORTH facility activity, and `Asthma, uncomplicated` condition count.
- The `slice-9-reports-readiness` plan passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice is read-only.
- CSV export generation is covered by Slice 24. Read-only patient document visibility is covered by Slice 25. Focused binary patient-document upload/download lifecycle behavior is covered by Slice 33. Saved report definitions, scanned attachments, fax/SMS integrations, CCDA/export workflows, and external integration adapters remain deferred to later reports/documents/integrations slices.

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

### Slice 12: Encounter Mutation

Status:

- Implemented as the third mutation-capable modernized workflow slice under `modernized-openemr/`.
- Verification is the shared `slice-12-encounter-mutation-readiness` plan, which creates, updates, renders, and removes an encounter with vitals and SOAP detail on both legacy and modernized targets.

Scope:

- ASP.NET Core encounter create, summary update, delete, vitals create/delete, and SOAP note create/delete endpoints over the modernized PostgreSQL encounter, vitals, and clinical-note tables.
- PostgreSQL seed schema extensions for encounter billing facility, encounter billing note, and vitals note values so the normalized model preserves legacy-observed mutation facts.
- React Encounters controls for creating an encounter from the finder panel, updating or deleting the selected encounter, and recording vitals and SOAP details from the detail panel.
- Modernized workflow action adapter methods for encounter, vitals, and SOAP lifecycles.
- Workbench-managed slice-12 encounter mutation parity plan for both legacy and modernized targets.
- Modernized smoke coverage for a safe encounter create/update/vitals/SOAP/delete lifecycle with cleanup.

Acceptance:

- The modernized Encounters module can create an encounter for a patient, display it in the encounter list/detail view, update its reason and billing note, record vitals, record SOAP detail, and delete the temporary encounter.
- The mutation path goes through the modernized backend API, not direct UI-to-database access.
- The `slice-12-encounter-mutation-readiness` plan creates an encounter for `MOD-PAT-0002`, verifies encounter, vitals, and SOAP counts and database state, verifies browser-visible updated reason, billing note, blood pressure, and SOAP assessment, deletes the temporary encounter and child rows, and passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice covers a focused encounter summary plus vitals/SOAP lifecycle only.
- Encounter templates, sign-off, authorization, audit history, diagnosis coding workflows, order/billing linkage, document attachment, and multi-form encounter packages remain deferred to later clinical workflow slices.

### Slice 13: Clinical List Allergy Mutation

Status:

- Implemented as the fourth mutation-capable modernized workflow slice under `modernized-openemr/`.
- Verification is the shared `slice-13-clinical-list-mutation-readiness` plan, which creates, renders, deactivates, and removes an allergy list entry on both legacy and modernized targets.

Scope:

- ASP.NET Core clinical-list allergy create, deactivate, and delete endpoints over the modernized PostgreSQL allergy table.
- PostgreSQL seed schema extensions for allergy activity, end date, and list option values so the normalized model preserves legacy OpenEMR list lifecycle semantics.
- React Lists controls for creating a new allergy from the finder panel and deactivating or deleting active allergy entries from the Allergies panel.
- Modernized workflow action adapter methods for allergy create, get, deactivate, and delete behavior.
- Workbench-managed slice-13 clinical-list mutation parity plan for both legacy and modernized targets.
- Modernized smoke coverage for a safe allergy create/deactivate/delete lifecycle with cleanup.

Acceptance:

- The modernized Lists module can create an allergy for a patient, display it as an active allergy, deactivate it so it no longer appears in active lists, and delete the temporary row.
- The mutation path goes through the modernized backend API, not direct UI-to-database access.
- The `slice-13-clinical-list-mutation-readiness` plan creates an allergy for `MOD-PAT-0006`, verifies allergy counts and database state, verifies browser-visible active allergy rendering, deactivates the row, deletes it, and passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice covers allergy entries only.
- Problem-list lifecycle mutation is covered by Slice 31. Medication-list lifecycle mutation is covered by Slice 32. Diagnoses, allergy vocabulary lookup, duplicate detection, audit history, and broader list option management remain deferred to later clinical-list slices.

### Slice 14: Patient Message Mutation

Status:

- Implemented as the fifth mutation-capable modernized workflow slice under `modernized-openemr/`.
- Verification is the shared `slice-14-message-mutation-readiness` plan, which creates, renders, closes, soft-deletes, and removes a patient message on both legacy and modernized targets.

Scope:

- ASP.NET Core patient-message create, status update, soft-delete, and hard-delete endpoints over the modernized PostgreSQL messages table.
- PostgreSQL seed schema extensions for message assignee, deleted flag, and activity values so the normalized model preserves legacy OpenEMR `pnotes` lifecycle semantics.
- React Messages controls for creating a new patient message from the finder panel and closing, archiving, or deleting active message entries from the message list.
- Modernized workflow action adapter methods for patient-message create, get, status update, soft-delete, and delete behavior.
- Workbench-managed slice-14 message mutation parity plan for both legacy and modernized targets.
- Modernized smoke coverage for a safe patient-message create/close/soft-delete/delete lifecycle with cleanup.

Acceptance:

- The modernized Messages module can create a message for a patient, display it as an active message, close it with an updated body and `Done` status, soft-delete it so it no longer appears in active message lists, and delete the temporary row.
- The mutation path goes through the modernized backend API, not direct UI-to-database access.
- The `slice-14-message-mutation-readiness` plan creates a message for `MOD-PAT-0004`, verifies message counts and database state, verifies browser-visible closed message rendering, soft-deletes the row, deletes it, and passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice covers care-team `pnotes` style patient messages only.
- Portal reply threading, attachments, notification delivery, assignment queues, priority/escalation behavior, and audit history remain deferred to later messaging workflow slices.

### Slice 15: Prescription Mutation

Status:

- Implemented as the sixth mutation-capable modernized workflow slice under `modernized-openemr/`.
- Verification is the shared `slice-15-prescription-mutation-readiness` plan, which creates, renders, deactivates, and removes a prescription on both legacy and modernized targets.

Scope:

- ASP.NET Core prescription create, deactivate, and delete endpoints under the clinical-list API over the modernized PostgreSQL prescriptions table.
- PostgreSQL seed schema extensions for prescription RxNorm code, quantity, refills, note, active state, and end date so the normalized target preserves legacy-observed prescription lifecycle facts.
- React Lists controls for creating a prescription from the finder panel and deactivating or deleting active prescription entries from the prescription panel.
- Modernized workflow action adapter methods for prescription lifecycle parity.
- Workbench-managed slice-15 prescription mutation parity plan for both legacy and modernized targets.
- Modernized smoke coverage for a safe prescription create/deactivate/delete lifecycle with cleanup.

Acceptance:

- The modernized Lists module can create a prescription for a patient, display it in the active prescription list, deactivate it so it no longer appears as active, and delete the temporary row.
- The mutation path goes through the modernized backend API, not direct UI-to-database access.
- The `slice-15-prescription-mutation-readiness` plan creates a prescription for `MOD-PAT-0008`, verifies prescription counts and database state, verifies browser-visible active prescription rendering, deactivates the row, deletes it, and passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice covers a focused prescription lifecycle only.
- Focused medication-list mutation is covered by Slice 32. Allergy/problem interactions, pharmacy routing, electronic prescribing, controlled-substance rules, refill requests, medication reconciliation, and audit history remain deferred to later medication workflow slices.

### Slice 16: Billing Mutation

Status:

- Implemented as the seventh mutation-capable modernized workflow slice under `modernized-openemr/`.
- Verification is the shared `slice-16-billing-mutation-readiness` plan, which creates, renders, marks billed, deactivates, and removes a CPT fee-sheet line on both legacy and modernized targets.

Scope:

- ASP.NET Core billing line create, billed/activity status update, and delete endpoints under the billing API over the modernized PostgreSQL billing table.
- PostgreSQL seed schema extensions for billing units, billed state, and activity state so the normalized target preserves legacy-observed fee-sheet lifecycle facts.
- React Fees controls for creating a CPT line against a loaded encounter and marking or deleting visible fee-sheet lines.
- Modernized workflow action adapter methods for billing-line lifecycle parity.
- Workbench-managed slice-16 billing mutation parity plan for both legacy and modernized targets.
- Modernized smoke coverage for a safe billing line create/status/delete lifecycle with cleanup.

Acceptance:

- The modernized Fees module can create a CPT billing line for an encounter, display it in the active fee-sheet line list, mark it billed and inactive so it no longer appears as active, and delete the temporary row.
- The mutation path goes through the modernized backend API, not direct UI-to-database access.
- The `slice-16-billing-mutation-readiness` plan creates a temporary CPT billing line for seeded encounter `1000013` on `MOD-PAT-0001`, verifies billing counts and direct row state, verifies browser-visible active billing rendering, marks the row billed/inactive, deletes it, and passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice covers a focused encounter-scoped CPT billing line lifecycle only.
- Claim generation, payer/insurance adjudication, remittance import, payment posting mutation, modifier validation rules, diagnosis pointer validation, charge corrections, void history, statement generation, and audit history remain deferred to later revenue-cycle workflow slices.

### Slice 17: Procedure Mutation

Status:

- Implemented as the eighth mutation-capable modernized workflow slice under `modernized-openemr/`.
- Verification is the shared `slice-17-procedure-mutation-readiness` plan, which creates, completes, reports, renders, and removes a lab procedure workflow on both legacy and modernized targets.

Scope:

- ASP.NET Core procedure order create, status update, report create, result create, and order cascade-delete endpoints under the procedure API over the modernized PostgreSQL lab tables.
- PostgreSQL seed schema extensions for procedure order priority, procedure type, instructions, report review status, and report notes so the normalized target preserves the procedure lifecycle facts needed by mutation parity tests.
- React Procedures controls for creating a lab order against a loaded patient encounter, completing an order, adding a reviewed report, adding a final result, and deleting temporary order trees.
- Modernized workflow action adapter methods for procedure order, report, and result lifecycle parity.
- Workbench-managed slice-17 procedure mutation parity plan for both legacy and modernized targets.
- Modernized smoke coverage for a safe procedure order/status/report/result/delete lifecycle with cleanup.

Acceptance:

- The modernized Procedures module can create a lab order for a patient encounter, display it in the procedure order list, mark the order complete, add a reviewed final report, add a final result value, and delete the temporary order tree.
- The mutation path goes through the modernized backend API, not direct UI-to-database access.
- The `slice-17-procedure-mutation-readiness` plan creates a temporary procedure order for `MOD-PAT-0009`, verifies procedure counts and direct row state, verifies browser-visible order/report/result rendering, marks the order complete, deletes the temporary order tree, and passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice covers a focused lab procedure lifecycle only.
- Result correction, amendment/versioning, external electronic lab interfaces, specimen collection/tracking, order catalogs, clinical review queues, provider sign-off, and audit history remain deferred to later lab/procedure workflow slices.

### Slice 18: Administration Facility Mutation

Status:

- Implemented as the ninth mutation-capable modernized workflow slice under `modernized-openemr/`.
- Verification is the shared `slice-18-admin-facility-mutation-readiness` plan, which creates, updates, renders, deactivates, and removes a facility on both legacy and modernized targets.

Scope:

- ASP.NET Core facility create, update, and delete endpoints under the administration API over the modernized PostgreSQL facilities table.
- PostgreSQL seed schema extension for facility inactive state so the normalized target preserves OpenEMR-style facility lifecycle semantics.
- React Admin controls for creating a facility and marking/deleting visible facility directory cards.
- Modernized workflow action adapter methods for facility lifecycle parity.
- Workbench-managed slice-18 admin facility mutation parity plan for both legacy and modernized targets.
- Modernized smoke coverage for a safe facility create/update/inactive/delete lifecycle with cleanup.

Acceptance:

- The modernized Admin module can create a facility, display it in the active facility directory, update it to inactive state so it no longer appears in the default active list, and delete the temporary row.
- The mutation path goes through the modernized backend API, not direct UI-to-database access.
- The `slice-18-admin-facility-mutation-readiness` plan creates a temporary facility, verifies direct row state and browser-visible active facility rendering, updates the facility to inactive state, verifies the updated stored row and default hidden-inactive list behavior, deletes the temporary facility, and passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice covers a focused facility lifecycle only.
- Focused user create, update, inactive status, and delete workflows are covered by Slice 19.
- Role/permission administration, authentication, authorization policies, password management, MFA, audit history, and facility-to-user assignment workflows remain deferred to later administration/security slices.

### Slice 19: Administration User Mutation

Status:

- Implemented as the tenth mutation-capable modernized workflow slice under `modernized-openemr/`.
- Verification is the shared `slice-19-admin-user-mutation-readiness` plan, which creates, updates, renders, deactivates, and removes a user on both legacy and modernized targets.

Scope:

- ASP.NET Core user create, update, and delete endpoints under the administration API over the modernized PostgreSQL staff table.
- PostgreSQL seed schema extension for staff active state, email, and NPI so the normalized target preserves OpenEMR-style user lifecycle semantics.
- React Admin controls for creating users and marking/deleting visible active user directory cards.
- Modernized workflow action adapter methods for user lifecycle parity.
- Workbench-managed slice-19 admin user mutation parity plan for both legacy and modernized targets.
- Modernized smoke coverage for a safe user create/update/inactive/delete lifecycle with cleanup.

Acceptance:

- The modernized Admin module can create a user, display it in the active user directory, update it to inactive state so it no longer appears in the default active list, and delete the temporary row.
- The mutation path goes through the modernized backend API, not direct UI-to-database access.
- The `slice-19-admin-user-mutation-readiness` plan creates a temporary user, verifies direct row state and browser-visible active user rendering, updates the user to inactive state, verifies the updated stored row and default hidden-inactive list behavior, deletes the temporary user, and passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice covers a focused user-directory lifecycle only.
- Default ACL group and permission matrix visibility is covered by Slice 20.
- Focused ACL permission assignment grant/revoke behavior is covered by Slice 21.
- Focused user/group membership assignment grant/revoke behavior is covered by Slice 22.
- Real login/password creation, ASP.NET Core Identity, broad role/permission administration, authorization policies, MFA, audit history, user-facility restriction matrices, provider credentialing, and broad membership administration workflows remain deferred to later administration/security slices.

### Slice 20: Administration Access-Control Read Model

Status:

- Implemented as the tenth read-only modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-20-access-control-readiness` plan, which compares OpenEMR default ACL groups, visible permission objects, group-permission assignments, and default user memberships on both legacy and modernized targets.

Scope:

- PostgreSQL seed schema extension for normalized access-control groups, permissions, group-permission assignments, and default user memberships mirroring the legacy default phpGACL matrix.
- ASP.NET Core administration API extension that exposes access-control counts and matrix detail with the existing users/facilities directory.
- React Admin visibility for access-control counts, leaf groups, and representative permission assignments.
- Normalized legacy MariaDB and modernized PostgreSQL parity probes for ACL facts.
- Workbench-managed slice-20 access-control parity plan for both legacy and modernized targets.
- Modernized smoke coverage for default ACL group, permission, assignment, and user-membership anchors.

Acceptance:

- The modernized Admin module displays an Access Control Matrix with the same default OpenEMR groups visible from the legacy Access Control administration surface.
- The API reports 7 access groups, 65 visible permission objects, 203 group-permission assignments, and 2 default user memberships.
- The `slice-20-access-control-readiness` plan verifies Administrator, Physician, Clinician, Front Office, Accounting, and Emergency Login group anchors; verifies key permission objects such as `admin:acl`, `patients:demo`, `patients:rx`, and `sensitivities:high`; verifies representative group-permission assignments; verifies the default `admin` and `oe-system` Administrator memberships; and passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice is read-only.
- It mirrors the default ACL topology as application data but does not enforce authorization policies at runtime.
- Focused ACL permission assignment grant/revoke behavior is covered by Slice 21.
- Focused user/group membership assignment grant/revoke behavior is covered by Slice 22.
- Broad permission editing, broad membership administration, ASP.NET Core Identity, login/password creation, MFA, audit history, and user-facility restriction matrices remain deferred to later administration/security slices.

### Slice 21: Administration Access Permission Mutation

Status:

- Implemented as the eleventh mutation-capable modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-21-access-permission-mutation-readiness` plan, which revokes, renders, restores, and verifies a focused ACL group-permission assignment on both legacy and modernized targets.

Scope:

- ASP.NET Core administration API endpoints for granting and revoking an access-control group permission assignment.
- React Admin permission-assignment control with group, permission, return-value, Grant, and Revoke inputs.
- Modernized smoke coverage for Front Office `patients:demo` revoke/restore behavior.
- Legacy and modernized workflow action adapters for normalized ACL assignment mutation.
- Workbench-managed slice-21 access-permission mutation plan for both legacy and modernized targets.
- Side-by-side parity coverage that verifies the Front Office demographics write grant drops from 203 to 202 group-permission assignments on revoke and returns to 203 on restore.

Acceptance:

- The modernized Admin module can revoke and restore the Front Office `patients:demo` write assignment through the backend API.
- The mutation path goes through the modernized server tier, not direct browser-to-database access.
- The `slice-21-access-permission-mutation-readiness` plan verifies direct row state, browser-visible matrix state, restoration to the seeded baseline, and passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice covers one focused ACL group-permission assignment lifecycle only.
- It mutates ACL data but does not yet enforce authorization policies at runtime.
- Focused user/group membership assignment grant/revoke behavior is covered by Slice 22.
- Full role/permission administration, broad membership editing, ASP.NET Core Identity, login/password creation, MFA, audit history, user-facility restriction matrices, and policy enforcement remain deferred to later administration/security slices.

### Slice 22: Administration User Group Membership Mutation

Status:

- Implemented as the twelfth mutation-capable modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-22-user-group-membership-mutation-readiness` plan, which creates a temporary user, assigns access-group membership, renders it, revokes it, and cleans up on both legacy and modernized targets.

Scope:

- PostgreSQL seed schema extension for normalized access user memberships seeded from the default legacy `admin` and `oe-system` Administrator memberships.
- ASP.NET Core administration API endpoints for granting and revoking user-to-access-group memberships.
- React Admin User Group Membership control with active-user and leaf-group selectors plus Assign/Revoke actions.
- User directory cards that show assigned access-group membership chips for browser-visible verification.
- Modernized smoke coverage for a temporary user membership grant/revoke lifecycle with cleanup.
- Legacy and modernized workflow action adapters for normalized ACL user-membership mutation.
- Workbench-managed slice-22 user group membership mutation plan for both legacy and modernized targets.

Acceptance:

- The modernized Admin module can assign a temporary active user to the Front Office access group and render the membership in that user's directory card.
- The membership mutation path goes through the modernized backend API, not direct browser-to-database access.
- Deleting a user cleans up its modernized access memberships.
- The `slice-22-user-group-membership-mutation-readiness` plan verifies direct row state, browser-visible membership state, revocation back to the seeded baseline, cleanup, and passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice covers one focused user-to-group membership lifecycle only.
- It mutates ACL membership data but does not yet enforce authorization policies at runtime.
- Full role/permission administration, broad membership editing UX, ASP.NET Core Identity, login/password creation, MFA, audit history, user-facility restriction matrices, and policy enforcement remain deferred to later administration/security slices.

### Slice 23: Pending/Scheduled Procedure Orders

Status:

- Implemented as the eleventh read-only modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-23-procedure-pending-orders-readiness` plan, which compares future scheduled, reportless procedure orders on both legacy and modernized targets.

Scope:

- ASP.NET Core procedure read model now returns procedure-order counts for total, completed, scheduled, reportless, future scheduled, report, result, and final-result totals.
- React Procedures workspace now separates completed result workflows from Pending/Scheduled Orders, showing reportless lab orders with status, code, date, encounter, provider, diagnosis, and no-report state.
- Normalized legacy MariaDB and modernized PostgreSQL parity probes locate future scheduled orders with no linked report rows.
- Workbench-managed slice-23 pending procedure orders plan for both legacy and modernized targets.
- Modernized smoke coverage for `MOD-PAT-0701` scheduled CBC order on `2026-06-25`.

Acceptance:

- The modernized Procedures module can display `MOD-PAT-0701` with the seeded scheduled `Complete blood count` order, code `85025`, status `scheduled`, order date `2026-06-25`, and no report rows.
- The modernized procedure API returns explicit scheduled and reportless counts so pending-order workflows are not hidden behind completed lab-result totals.
- The `slice-23-procedure-pending-orders-readiness` plan verifies the same future scheduled, reportless order through database probes and browser-visible UI checks against both legacy and modernized targets.

Current limitations:

- This slice is read-only and focused on scheduled/reportless procedure-order visibility.
- Order catalogs, clinical order queues, specimen tracking, provider sign-off, result amendment, external lab interfaces, and broader lab workflow state machines remain deferred to later lab/procedure workflow slices.

### Slice 24: Operational Reports CSV Export

Status:

- Implemented as the twelfth read-only modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-24-reports-export-readiness` plan, which compares normalized operational report export rows and browser-visible export affordances on both legacy and modernized targets.

Scope:

- ASP.NET Core reports API now exposes `/api/reports/operational/export` as a deterministic CSV export over the same operational report read model used by the Reports dashboard.
- React Reports workspace now marks exports as CSV ready and exposes a `CSV Export` action linked to the backend export endpoint.
- Normalized legacy MariaDB and modernized PostgreSQL parity probes produce the same `Section, Name, Metric, Value` operational export rows from the gold dataset.
- Workbench-managed slice-24 reports export plan for both legacy and modernized targets.
- Modernized smoke coverage for CSV content type and stable gold-data export rows.

Acceptance:

- The modernized Reports module displays a visible CSV export action.
- The modernized export endpoint returns CSV containing stable report rows such as 1,000 patients, `$446,000.00` seeded charges, `gold-provider-02` encounters, NORTH facility billing total, and the `Asthma, uncomplicated` clinical condition.
- The `slice-24-reports-export-readiness` plan verifies normalized export rows and visible export affordances against both legacy and modernized targets.

Current limitations:

- This slice covers operational report CSV export only.
- Saved report definitions, scanned attachments, fax/SMS integrations, CCDA/export workflows, external integration adapters, and richer downloadable formats remain deferred to later reports/documents/integrations slices. Focused binary patient-document upload/download lifecycle behavior is covered by Slice 33.

### Slice 25: Patient Documents Read-Only

Status:

- Implemented as the thirteenth read-only modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-25-documents-readiness` plan, which compares seeded patient document metadata and browser-visible document lists on both legacy and modernized targets.

Scope:

- Gold dataset now includes 1,200 deterministic patient document records across 900 patients, with OpenEMR-style document categories and text payload previews.
- Legacy seed maps the document records into OpenEMR `documents` and `categories_to_documents` rows.
- Modernized PostgreSQL seed maps the same records into a normalized `patient_documents` table.
- ASP.NET Core documents API exposes `/api/documents/{patientId}` for patient document metadata, categories, dates, encounter links, storage method, and content preview.
- React Documents workspace lets users load a patient by canonical id and review filed documents, categories, linked encounters, page counts, storage metadata, and content previews.
- Operational reports and CSV export include the 1,200 document count so reporting remains aligned with the shared gold dataset.
- Workbench-managed slice-25 documents plan is available for both legacy and modernized targets.
- Modernized smoke coverage validates the `MOD-PAT-0001` document anchors and the operational report document count.

Acceptance:

- The modernized Documents module is selectable from the left navigation.
- `MOD-PAT-0001` shows `Primary care intake packet` in `Medical Record` and `Advance directive acknowledgement` in `Advance Directive`.
- The modernized API returns stable document metadata, category ids, document dates, storage method `database`, and content previews for the same anchor records.
- The `slice-25-documents-readiness` plan verifies the same patient document facts plus browser-visible document behavior against both legacy and modernized targets.

Current limitations:

- This slice is read-only.
- It covers document metadata and text payload previews; focused binary upload/download lifecycle behavior is covered by Slice 33.
- Versioning, thumbnails, encryption/key management, CCDA import/export, document routing, fax/SMS attachments, scanned-document capture, and external document-storage adapters remain deferred to later documents/integrations slices. A focused database-backed text document create/archive/delete lifecycle is covered by Slice 26, full text content retrieval/download is covered by Slice 27, focused document sign-off is covered by Slice 38, focused external-link document filing is covered by Slice 39, focused document denial/rejection is covered by Slice 40, focused document metadata refiling/editing is covered by Slice 41, focused archived-document visibility/restore is covered by Slice 42, and focused text content replacement is covered by Slice 43.

### Slice 26: Patient Document Mutation

Status:

- Implemented as the thirteenth mutation-capable modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-26-document-mutation-readiness` plan, which creates, renders, soft-deletes, and hard-deletes a temporary patient document on both legacy and modernized targets.

Scope:

- ASP.NET Core documents API now exposes document lifecycle endpoints for database-backed text documents: create, soft-delete/archive, and hard-delete cleanup.
- PostgreSQL `patient_documents` remains the normalized document table for seeded and temporary mutation records.
- React Documents workspace now includes a compact `New Document` form with patient, category, document date, encounter, and text body fields.
- React document cards now include Archive and Delete actions so active document state can be changed from the modernized UI.
- Shared parity workflow adapters now include legacy MariaDB document lifecycle actions and modernized API-backed document lifecycle actions behind the same behavioral contract.
- Workbench-managed Slice 26 document mutation plan is available for both legacy and modernized targets.

Acceptance:

- A temporary `Medical Record` text document can be created for `MOD-PAT-0001` against seeded encounter `1000013`.
- The created document appears in the legacy OpenEMR document list and the modernized Documents workspace.
- The active document count increases after create, soft-delete marks the record deleted, and hard-delete cleanup returns counts to the seeded baseline.
- The `slice-26-document-mutation-readiness` plan verifies the same document lifecycle against both targets.

Current limitations:

- This slice intentionally handles database-backed `text/plain` documents only.
- Focused PDF-style binary upload/download lifecycle behavior is covered by Slice 33. Scanned document capture, thumbnails, signing, versioning, encryption/key management, CCDA import/export, document routing, and external document-storage adapters remain deferred.

### Slice 27: Patient Document Content Retrieval

Status:

- Implemented as the fourteenth read-only modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-27-document-content-readiness` plan, which verifies the full stored patient document payload and modernized content viewer/download behavior for the stable `MOD-PAT-0001` document anchor.

Scope:

- ASP.NET Core documents API now exposes `/api/documents/{documentId}/content` for structured active-document content retrieval.
- ASP.NET Core documents API now exposes `/api/documents/{documentId}/download` for browser/file retrieval using the document MIME type and a deterministic text filename for seeded text documents.
- React Documents workspace now includes a `Document Viewer` panel and document-card View/Download controls.
- Shared database probes now compare full stored document payloads, not only content previews.
- Workbench-managed Slice 27 document content plan is available for both legacy and modernized targets.
- Modernized smoke coverage validates the `MOD-PAT-0001` primary-care intake packet content endpoint and download endpoint.

Acceptance:

- `Primary care intake packet` for `MOD-PAT-0001` can be loaded through the modernized Documents viewer.
- The content endpoint returns the full seeded `Gold synthetic document DOC-MOD-PAT-0001-1` text payload with stable metadata, MIME type, hash, file name, and document id.
- The download endpoint returns the same text payload with a `text/plain` content type.
- The `slice-27-document-content-readiness` plan verifies the same full stored document payload against both targets and the modernized browser/API retrieval surface.

Current limitations:

- This slice intentionally handles database-backed text payload retrieval for seeded and mutation-created text documents.
- Focused PDF-style binary upload/download lifecycle behavior is covered by Slice 33. Binary scan streaming, external object storage, thumbnails, signing, version history, encryption/key management, and patient-portal document access rules remain deferred.

### Slice 28: Patient Insurance Coverage

Status:

- Implemented as the fifteenth read-only modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-28-insurance-readiness` plan, which verifies primary and secondary insurance coverage facts and chart visibility for the stable `MOD-PAT-0005` insurance anchor.

Scope:

- ASP.NET Core patient chart summary now returns normalized insurance coverage rows from the modernized PostgreSQL `insurance_records` table.
- React Patient/Client chart now includes an Insurance panel with payer, plan, policy, group, and relationship details.
- Shared database probes now normalize legacy `insurance_data` and modernized `insurance_records` into the same coverage shape.
- Workbench-managed Slice 28 insurance plan is available for both legacy and modernized targets.
- Modernized smoke coverage validates the deterministic `MOD-PAT-0005` primary and secondary coverage rows.

Acceptance:

- `MOD-PAT-0005` returns two coverage rows in the modernized chart summary: primary `Northstar HMO / Medicare Advantage / POL100005 / GRP104` and secondary `Acme Health / Family Choice / SEC100005 / GRP204`.
- The modernized chart displays those coverage values in the Insurance panel.
- The legacy demographics screen and modernized chart expose the same coverage facts through the `slice-28-insurance-readiness` plan.
- The side-by-side Slice 28 comparison produces no run-summary differences.

Current limitations:

- This slice is read-only and patient-chart scoped.
- Focused coverage create/update/delete behavior is covered by Slice 34.
- Eligibility checks, claim generation, payer adjudication, benefit rules, copay workflows, remittance import, payment posting mutation, and full revenue-cycle behavior remain deferred to later billing/insurance slices.

### Slice 29: Patient Immunization History

Goal: add read-only immunization history parity using OpenEMR's native Immunizations table/page and the modernized clinical Lists module.

Status: implemented.

Scope:

- Gold dataset now includes 2,648 deterministic immunization records across the 1,000-patient population, including a rich pediatric vaccine history for `MOD-PAT-0007`.
- Legacy seed maps immunization rows into OpenEMR's native `immunizations` table with vaccine list IDs, CVX codes, manufacturer, lot, administered date, VIS dates, route/site, provider, and encounter linkage.
- Modernized PostgreSQL seed maps the same records into a normalized `immunizations` table.
- ASP.NET Core clinical-list API now returns immunizations with vaccine, CVX, manufacturer, lot, administered date, route/site, VIS date, completion status, provider, encounter, and note fields.
- React Lists workspace now includes an Immunizations section and count alongside problems, allergies, medications, and prescriptions.
- Shared database probes now normalize legacy MariaDB and modernized PostgreSQL immunization rows into the same vaccine-history shape.
- Workbench-managed Slice 29 immunizations plan is available for both legacy and modernized targets.
- Modernized smoke coverage validates the deterministic `MOD-PAT-0007` pediatric immunization anchor.

Acceptance:

- `MOD-PAT-0007` returns at least eight immunization rows, including `Influenza, seasonal, injectable` with CVX `141` and `Hep A, ped/adol, 2 dose` manufactured by `GlaxoSmithKline`.
- The modernized Lists workspace displays the seeded immunization count and vaccine details.
- The legacy Immunizations page and modernized Lists workspace expose the same vaccine facts through the `slice-29-immunizations-readiness` plan.
- The side-by-side Slice 29 comparison produces no run-summary differences.

Current limitations:

- This slice is read-only and focused on immunization history visibility.
- Immunization lifecycle mutation is covered by Slice 30.
- Broader edit workflows, registry submission, refusal workflows, observation rows, forecast rules, reminder logic, inventory coupling, and external vaccine registry integrations remain deferred.

### Slice 30: Patient Immunization Mutation

Goal: add mutation-capable immunization lifecycle parity using OpenEMR's native Immunizations table/page and the modernized clinical Lists module.

Status: implemented.

Scope:

- ASP.NET Core clinical-list API now supports immunization create, mark entered in error, and hard-delete endpoints over the modernized PostgreSQL `immunizations` table.
- React Lists workspace now includes a New Immunization form plus row-level entered-in-error and delete controls in the Immunizations panel.
- Modernized smoke coverage creates a temporary influenza immunization for `MOD-PAT-0007`, verifies it appears in the returned clinical list, marks it entered in error so it no longer appears as active, and hard-deletes the temporary row.
- Shared legacy and modernized workflow adapters now expose `createImmunization`, `getImmunization`, `markImmunizationEnteredInError`, and `deleteImmunization`.
- The `workflow-immunizations` parity suite and `slice-30-immunization-mutation-readiness` plan verify the same create, render, entered-in-error, and cleanup lifecycle against both targets.
- Workbench-managed Slice 30 immunization mutation plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary influenza immunization can be created for `MOD-PAT-0007` with CVX `141`, manufacturer, lot, route/site, VIS date, dose, completion status, source, and note fields.
- The legacy Immunizations page and modernized Lists workspace render the temporary row before it is marked entered in error.
- Marking the row entered in error removes it from active immunization counts and active UI rendering on both targets.
- The temporary row can be hard-deleted during cleanup so the seeded baseline returns to its original count.
- The side-by-side Slice 30 comparison produces no run-summary differences.

Current limitations:

- This slice covers a focused create, entered-in-error, and delete lifecycle only.
- Rich edit screens, immunization refusal workflows, registry submission, observation rows, forecast/reminder logic, inventory coupling, and external vaccine registry integrations remain deferred.

### Slice 31: Patient Problem List Mutation

Goal: add mutation-capable active problem-list lifecycle parity using OpenEMR's `lists` medical-problem rows and the modernized clinical Lists module.

Status: implemented.

Scope:

- ASP.NET Core clinical-list API now supports problem create, deactivate, and hard-delete endpoints over the modernized PostgreSQL `problems` table.
- The modernized PostgreSQL problem schema now preserves OpenEMR-style `activity` and `end_date` state so active problem rendering can hide inactive rows.
- React Lists workspace now includes a New Problem form plus row-level deactivate and delete controls in the Problems panel.
- Modernized smoke coverage creates a temporary problem for `MOD-PAT-0006`, verifies it appears in the returned clinical list, deactivates it so it no longer appears as active, and hard-deletes the temporary row.
- Shared legacy and modernized workflow adapters now expose `createProblem`, `getProblem`, `deactivateProblem`, and `deleteProblem`.
- The `workflow-problems` parity suite and `slice-31-problem-mutation-readiness` plan verify the same create, render, deactivate, and cleanup lifecycle against both targets.
- Workbench-managed Slice 31 problem mutation plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary active medical problem can be created for `MOD-PAT-0006` with title, diagnosis, date, and comments.
- The legacy patient summary clinical-list area and modernized Lists workspace render the temporary active problem.
- Deactivating the row removes it from active problem counts and active UI rendering on both targets.
- The temporary row can be hard-deleted during cleanup so the seeded problem baseline returns to its original count.
- The side-by-side Slice 31 comparison produces no run-summary differences.

Current limitations:

- This slice covers a focused problem create, deactivate, and delete lifecycle only.
- Rich problem editing, diagnosis-code lookup, duplicate detection, audit history, care-plan/problem interactions, and broader list option management remain deferred.

### Slice 32: Patient Medication List Mutation

Goal: add mutation-capable active medication-list lifecycle parity using OpenEMR's `lists` medication rows and the modernized clinical Lists module.

Status: implemented.

Scope:

- ASP.NET Core clinical-list API now supports medication-list create, deactivate, and hard-delete endpoints over the modernized PostgreSQL `medications` table.
- The modernized PostgreSQL medication schema now preserves OpenEMR-style `activity` and `end_date` state so active medication-list rendering can hide inactive rows.
- React Lists workspace now includes a New Medication form plus row-level deactivate and delete controls in the Medication List panel.
- Modernized smoke coverage creates a temporary medication-list entry for `MOD-PAT-0006`, verifies it appears in the returned clinical list, deactivates it so it no longer appears as active, and hard-deletes the temporary row.
- Shared legacy and modernized workflow adapters now expose `createMedication`, `getMedication`, `deactivateMedication`, and `deleteMedication`.
- The `workflow-medications` parity suite and `slice-32-medication-list-mutation-readiness` plan verify the same create, render, deactivate, and cleanup lifecycle against both targets.
- Workbench-managed Slice 32 medication-list mutation plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary active medication-list entry can be created for `MOD-PAT-0006` with title, diagnosis, date, and comments.
- The legacy patient summary clinical-list area and modernized Lists workspace render the temporary active medication-list row.
- Deactivating the row removes it from active medication-list counts and active UI rendering on both targets.
- The temporary row can be hard-deleted during cleanup so the seeded medication-list baseline returns to its original count.
- The side-by-side Slice 32 comparison produces no run-summary differences.

Current limitations:

- This slice covers a focused medication-list create, deactivate, and delete lifecycle only.
- Medication reconciliation, structured dose/frequency fields, allergy/problem interactions, pharmacy routing, electronic prescribing, controlled-substance rules, refill requests, and audit history remain deferred.

### Slice 33: Binary Patient Document Mutation

Goal: add mutation-capable binary patient-document lifecycle parity using OpenEMR's `documents` rows and the modernized Documents module.

Status:

- Implemented as the seventeenth mutation-capable modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-33-binary-document-mutation-readiness` plan, which creates, renders, downloads, archives, and hard-deletes a temporary PDF-style patient document on both legacy and modernized targets.

Scope:

- Modernized PostgreSQL `patient_documents` now stores text payloads and binary payloads separately with `content` preview text, `content_bytes` for byte-preserving file content, and `file_name` for deterministic downloads.
- ASP.NET Core documents API now exposes `/api/documents/binary` for binary document creation and keeps `/api/documents/{documentId}/download` MIME-aware for byte-preserving binary downloads.
- React Documents workspace now includes an `Upload File` form with category, document date, encounter, notes, and file selection controls.
- React document viewer now shows inline text for text documents and binary metadata plus a download action for binary documents.
- Shared legacy and modernized workflow adapters now expose `createPatientBinaryDocument`, with normalized file name, size, MIME type, base64 content, archive, and cleanup readback.
- The `workflow-document-binary` parity suite and `slice-33-binary-document-mutation-readiness` plan verify the same lifecycle against both targets.
- Workbench-managed Slice 33 binary document mutation plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary `application/pdf` document can be created for `MOD-PAT-0001` against seeded encounter `1000013`.
- The created binary document appears in the legacy OpenEMR document list and the modernized Documents workspace.
- Modernized document content retrieval marks the row as binary and exposes the deterministic file name, MIME type, hash, preview text, and base64 content.
- Modernized document download returns the same PDF bytes that were uploaded.
- Soft-delete/archive removes the temporary binary document from active document counts, and hard-delete cleanup returns counts to the seeded baseline.
- The side-by-side Slice 33 comparison produces no run-summary differences.

Current limitations:

- This slice covers a focused PDF-style binary document create, active rendering, download, archive, and delete lifecycle only.
- Scanned-document capture, multi-file uploads, thumbnails, signing, versioning, encryption/key management, CCDA import/export, patient-portal document access rules, and external document-storage adapters remain deferred.

### Slice 34: Patient Insurance Mutation

Goal: add mutation-capable patient insurance lifecycle parity using OpenEMR's `insurance_data` rows and the modernized Patient/Client chart Insurance panel.

Status:

- Implemented as the eighteenth mutation-capable modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-34-insurance-mutation-readiness` plan, which creates, renders, updates, and hard-deletes a temporary tertiary coverage row on both legacy and modernized targets.

Scope:

- ASP.NET Core patient API now supports insurance coverage create, update, and delete endpoints over the modernized PostgreSQL `insurance_records` table.
- React Patient/Client chart now includes an Insurance panel editor for adding coverage, editing existing rows, and deleting temporary coverage rows.
- Modernized smoke coverage creates temporary tertiary coverage for `MOD-PAT-0005`, verifies returned chart state, updates payer and policy details, and hard-deletes the row.
- Shared legacy and modernized workflow adapters now expose `createPatientInsurance`, `getPatientInsurance`, `updatePatientInsurance`, and `deletePatientInsurance`.
- The `workflow-insurance` parity suite and `slice-34-insurance-mutation-readiness` plan verify the same create, render, update, and cleanup lifecycle against both targets.
- Workbench-managed Slice 34 insurance mutation plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary tertiary insurance coverage row can be created for `MOD-PAT-0005` with payer, plan, policy, group, and relationship fields.
- The created row appears in the legacy OpenEMR insurance browse screen and the modernized Patient/Client chart Insurance panel.
- Updating the row changes the payer, plan, policy, and group values on both targets.
- The temporary row can be hard-deleted during cleanup so the seeded insurance baseline returns to its original coverage count.
- The side-by-side Slice 34 comparison produces no run-summary differences.

Current limitations:

- This slice covers a focused coverage create, update, and delete lifecycle only.
- Eligibility checks, payer lookup maintenance, copay workflows, claim generation, payer adjudication, remittance import, payment posting mutation, subscriber detail editing, and revenue-cycle audit history remain deferred.

### Slice 35: Encounter Metadata Mutation

Goal: add mutation-capable encounter metadata parity using OpenEMR's `form_encounter` sensitivity, referral source, external ID, and place-of-service fields and the modernized Encounters workspace.

Status:

- Implemented as the nineteenth mutation-capable modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-35-encounter-metadata-readiness` plan, which creates, renders, updates, and hard-deletes a temporary encounter metadata row on both legacy and modernized targets.

Scope:

- ASP.NET Core encounter API and PostgreSQL seed schema now preserve `sensitivity`, `referral_source`, `external_id`, and `pos_code` on encounter search, detail, create, and update.
- React Encounters create/update forms now expose sensitivity, referral source, external ID, and POS code, and the Visit panel renders the saved metadata.
- Modernized smoke coverage creates a temporary metadata-rich encounter for `MOD-PAT-0002`, updates the metadata, verifies the returned API state, and hard-deletes the row.
- Shared legacy and modernized workflow adapters now expose encounter metadata fields through `createEncounter`, `getEncounter`, and `updateEncounterReason`.
- The `workflow-encounter-metadata` parity suite and `slice-35-encounter-metadata-readiness` plan verify the same create, render, update, and cleanup lifecycle against both targets.
- Workbench-managed Slice 35 encounter metadata plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary encounter can be created for `MOD-PAT-0002` with sensitivity, referral source, external ID, POS code, and billing note fields.
- The created row can be read back directly from both legacy MariaDB and modernized PostgreSQL with matching normalized metadata.
- Updating the row changes sensitivity, referral source, external ID, POS code, reason, and billing note on both targets.
- The updated metadata appears in the modernized Encounters Visit panel and the legacy target remains browser-smoke-renderable for the same patient workflow.
- The temporary encounter can be hard-deleted during cleanup so the seeded encounter baseline returns to its original count.

Current limitations:

- This slice covers focused encounter metadata create, update, and delete parity only.
- Diagnosis coding, encounter locking/sign-off, audit history, authorization rules, billing linkage updates, referrals workflow integration, templates, and attachments remain deferred.

### Slice 36: Patient Demographics Mutation

Goal: add mutation-capable patient demographics parity using OpenEMR's `patient_data` identity, DOB, address, marital-status, and occupation fields and the modernized Patient/Client chart Demographics panel.

Status:

- Implemented as the twentieth mutation-capable modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-36-patient-demographics-mutation-readiness` plan, which updates, renders, and restores a stable patient demographics record on both legacy and modernized targets.

Scope:

- ASP.NET Core patient API now supports a demographics update endpoint over the modernized PostgreSQL `patients` table.
- React Patient/Client chart now includes an editable Demographics panel for first name, last name, preferred name, sex, DOB, address, marital status, and occupation.
- Modernized smoke coverage updates `MOD-PAT-0010`, verifies returned chart state, and restores the original demographics.
- Shared legacy and modernized workflow adapters now expose `getPatientDemographics` and `updatePatientDemographics`.
- The `workflow-demographics` parity suite and `slice-36-patient-demographics-mutation-readiness` plan verify the same update, render, and restore lifecycle against both targets.
- Workbench-managed Slice 36 patient demographics plan actions are available for both legacy and modernized targets.

Acceptance:

- `MOD-PAT-0010` demographics can be updated through the modernized server tier and restored to the seeded baseline.
- The updated record can be read back directly from both legacy MariaDB and modernized PostgreSQL with matching normalized demographic fields.
- The updated identity, DOB, address, marital status, and occupation are verified through normalized row/API readback; the modernized Patient/Client chart renders the updated demographics, and the legacy browser check verifies the demographics fields exposed by OpenEMR's summary/edit surfaces.
- The side-by-side Slice 36 comparison produces no run-summary differences.

Current limitations:

- This slice covers focused demographics update and restore parity only.
- Duplicate detection, guarantor/subscriber demographics, additional contact fields, validation catalogs, patient history, audit history, and authorization enforcement remain deferred.

### Slice 37: Patient Registration Lifecycle

Goal: add mutation-capable patient registration parity using OpenEMR's `patient_data` registration fields and the modernized Patient/Client workspace registration form.

Status:

- Implemented as the twenty-first mutation-capable modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-37-patient-registration-readiness` plan, which creates, renders, and removes a temporary patient record on both legacy and modernized targets.

Scope:

- ASP.NET Core patient API now supports patient registration and guarded temporary-patient deletion over the modernized PostgreSQL `patients` table.
- React Patient/Client workspace now includes a compact Register Patient form in the finder panel, then selects the newly created chart after successful registration.
- Modernized smoke coverage creates a `TMP-PAT-REG-*` patient, verifies direct load and search visibility, deletes the temporary patient, and verifies it no longer loads.
- Shared legacy and modernized workflow adapters now expose `createPatient` and `deleteTemporaryPatient` actions.
- The `workflow-registration` parity suite and `slice-37-patient-registration-readiness` plan verify the same create, render, and cleanup lifecycle against both targets.
- Workbench-managed Slice 37 patient registration plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary patient can be registered through the modernized server tier with public ID, identity, DOB, address, contact, HIPAA permission, marital status, and occupation fields.
- The created patient can be read back directly from both legacy MariaDB and modernized PostgreSQL with matching normalized demographics and contact fields.
- The created patient appears in browser-visible chart workflows for both targets.
- The temporary patient can be hard-deleted during cleanup so the seeded 1,000-patient baseline remains unchanged.

Current limitations:

- This slice covers focused patient registration create/render/delete parity only.
- Duplicate detection, patient merge, guarantor/subscriber capture, portal account provisioning, address validation, facility/provider assignment, audit history, and authorization enforcement remain deferred.

### Slice 38: Patient Document Sign-Off

Goal: add mutation-capable patient document sign-off parity using OpenEMR's document approval status and the modernized Documents workspace review controls.

Status:

- Implemented as the twenty-second mutation-capable modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-38-document-signoff-readiness` plan, which creates, approves, renders, archives, and removes a temporary reviewed document on both legacy and modernized targets.

Scope:

- ASP.NET Core documents API now supports `/api/documents/{documentId}/sign` for focused document approval.
- Modernized PostgreSQL `patient_documents` now includes `review_status`, `reviewed_by`, and `reviewed_at` fields with seeded documents defaulting to `pending`.
- React Documents workspace now renders document review status, reviewer metadata, and a Sign action for pending documents.
- Modernized smoke coverage signs a temporary text document before archive/delete cleanup.
- Shared legacy and modernized workflow adapters now expose `signPatientDocument`, mapping legacy `audit_master_approval_status = 2` to modernized `approved`.
- The `workflow-document-signoff` parity suite and `slice-38-document-signoff-readiness` plan verify the same create, approve, render, archive, and cleanup lifecycle against both targets.
- Workbench-managed Slice 38 document sign-off plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary database-backed text document starts with pending review state on both targets.
- Signing the document updates normalized readback to `approved`, `reviewedBy = admin`, and a non-empty review timestamp.
- The modernized Documents workspace renders the approved status and reviewer, while the legacy document list remains browser-renderable for the same approved document.
- The temporary document can be archived and hard-deleted during cleanup so the seeded 1,200-document baseline remains unchanged.

Current limitations:

- This slice covers focused document approval/sign-off only.
- Multi-reviewer routing, document versioning, thumbnails, scanned-document capture, encryption/key management, CCDA import/export, external storage adapters, and authorization enforcement remain deferred.

### Slice 39: Patient Document External Links

Goal: add mutation-capable patient document external-link parity using OpenEMR's `documents.type = web_url` behavior and the modernized Documents workspace URL controls.

Status:

- Implemented as the twenty-third mutation-capable modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-39-document-external-link-readiness` plan, which creates, renders, archives, and removes a temporary web-url document on both legacy and modernized targets.

Scope:

- ASP.NET Core documents API now supports `/api/documents/external-link` for focused external URL filings.
- Modernized PostgreSQL `patient_documents` uses existing `storage_method`, `url`, MIME, content-preview, and lifecycle fields to represent `web_url` documents without changing the seeded gold rows.
- React Documents workspace now includes an External Link form, displays `web_url` storage metadata and URL references, and exposes an Open Link action on document cards and the viewer.
- Modernized smoke coverage creates a temporary external-link document, verifies content/readback state, then archives and hard-deletes it.
- Shared legacy and modernized workflow adapters now expose `createPatientExternalLinkDocument`, mapping legacy `documents.type = web_url` to modernized `storageMethod = web_url`.
- The `workflow-document-external-link` parity suite and `slice-39-document-external-link-readiness` plan verify the same create, render, archive, and cleanup lifecycle against both targets.
- Workbench-managed Slice 39 document external-link plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary external-link document can be created for `MOD-PAT-0001` on both targets with `mimetype = text/uri-list`, `storageMethod = web_url`, and a stable URL value.
- The modernized Documents workspace renders the URL, storage mode, and Open Link action, while the legacy document list remains browser-renderable for the same filing.
- The temporary document can be archived and hard-deleted during cleanup so the seeded 1,200-document baseline remains unchanged.

Current limitations:

- This slice covers focused external-link document filing only.
- External object storage adapters, scanned-document capture, multi-file uploads, thumbnails, document versioning, encryption/key management, CCDA import/export, patient-portal document access rules, and authorization enforcement remain deferred.

### Slice 40: Patient Document Denial

Goal: add mutation-capable patient document denial/rejection parity using OpenEMR's `documents.audit_master_approval_status = 3` behavior and the modernized Documents workspace review controls.

Status:

- Implemented as the twenty-fourth mutation-capable modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-40-document-denial-readiness` plan, which creates, denies, renders, archives, and removes a temporary reviewed document on both legacy and modernized targets.

Scope:

- ASP.NET Core documents API now supports denial through the existing document review endpoint by accepting `reviewStatus = denied`.
- Modernized PostgreSQL `patient_documents` reuses `review_status`, `reviewed_by`, and `reviewed_at` to preserve denied review decisions without changing seeded gold rows.
- React Documents workspace now includes a Deny action next to Sign, prevents duplicate review decisions after approval or denial, and renders denied review status on document cards and in the viewer.
- Modernized smoke coverage creates a temporary pending document, denies it as `admin`, verifies the denied state, then archives and hard-deletes it.
- Shared legacy and modernized workflow adapters now expose `denyPatientDocument`, mapping legacy `audit_master_approval_status = 3` to modernized `reviewStatus = denied`.
- The `workflow-document-denial` parity suite and `slice-40-document-denial-readiness` plan verify the same create, deny, render, archive, and cleanup lifecycle against both targets.
- Workbench-managed Slice 40 document denial plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary pending text document can be created for `MOD-PAT-0001` on both targets, then denied as `admin`.
- Direct probes normalize the review state as `reviewStatus = denied`, `reviewedBy = admin`, and a review timestamp.
- The modernized Documents workspace renders the denied state and disables both Sign and Deny after the decision, while the legacy document list remains browser-renderable for the same filing.
- The temporary document can be archived and hard-deleted during cleanup so the seeded 1,200-document baseline remains unchanged.

Current limitations:

- This slice covers focused single-reviewer denial/rejection only.
- Multi-reviewer routing, document versioning, thumbnails, scanned-document capture, encryption/key management, CCDA import/export, external storage adapters, patient-portal document access rules, and authorization enforcement remain deferred.

### Slice 41: Patient Document Metadata Refile

Goal: add mutation-capable patient document metadata edit/refile parity for title, category, document date, linked encounter, and notes using the legacy `documents` plus `categories_to_documents` storage pattern and the modernized Documents workspace inline editor.

Status:

- Implemented as the twenty-fifth mutation-capable modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-41-document-metadata-readiness` plan, which creates, refiles, renders, archives, and removes a temporary patient document on both legacy and modernized targets.

Scope:

- ASP.NET Core documents API now supports `/api/documents/{documentId}/metadata` for focused document filing metadata changes.
- Modernized PostgreSQL `patient_documents` reuses category, date, encounter, and notes fields to preserve refiling behavior without changing seeded gold rows.
- React Documents workspace now includes an inline Edit action on each document card, with Save Metadata controls for category, date, encounter, and notes.
- Modernized smoke coverage creates a temporary text document, updates its metadata, verifies document-list and content readback, then archives and hard-deletes it.
- Shared legacy and modernized workflow adapters now expose `updatePatientDocumentMetadata`, mapping legacy `documents.name`, `documents.docdate`, `documents.encounter_id`, `documents.documentationOf`, and `categories_to_documents.category_id` to the modernized document metadata endpoint.
- The `workflow-document-metadata` parity suite and `slice-41-document-metadata-readiness` plan verify the same create, refile, render, archive, and cleanup lifecycle against both targets.
- Workbench-managed Slice 41 document metadata plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary text document can be created for `MOD-PAT-0001` on both targets and refiled from Medical Record to Advance Directive with updated title, date, encounter, and notes.
- Direct probes normalize the edited metadata as `categoryName = Advance Directive`, `docDate = 2026-06-19`, `encounter = 1000014`, and the updated notes while preserving the original content payload.
- The modernized Documents workspace renders and edits the metadata through the document card, while the legacy document list remains browser-renderable for the refiled category.
- The temporary document can be archived and hard-deleted during cleanup so the seeded 1,200-document baseline remains unchanged.

Current limitations:

- This slice covers focused document filing metadata only.
- Full version history, multi-file uploads, scanned-document capture, thumbnails, encryption/key management, CCDA import/export, external storage adapters, patient-portal document access rules, and authorization enforcement remain deferred. Focused active text content replacement is covered by Slice 43.

### Slice 42: Patient Document Archive Restore

Goal: add mutation-capable patient document archive restore parity so archived documents are hidden from active document views by default, visible on explicit archived-document request, restorable to active state, and browser-renderable again after restore.

Status:

- Implemented as the twenty-sixth mutation-capable modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-42-document-archive-readiness` plan, which creates, archives, restores, renders, and removes a temporary patient document on both legacy and modernized targets.

Scope:

- ASP.NET Core documents API now supports active-only document retrieval by default, `includeArchived=true` document retrieval for explicit archived views, and `/api/documents/{documentId}/restore` for restoring archived documents.
- Modernized PostgreSQL `patient_documents.deleted` is now returned through the document DTO so the React workspace can distinguish active and archived records.
- React Documents workspace now includes a Show archived documents checkbox, active/archived counts, archived badges, disabled active-only actions on archived records, and a Restore action.
- Modernized smoke coverage creates a temporary text document, archives it, verifies active-only hiding plus archived-list visibility and content inaccessibility, restores it, verifies content readback, then hard-deletes it.
- Shared legacy and modernized workflow adapters now expose `restorePatientDocument`, mapping legacy `documents.deleted = 0` to the modernized restore endpoint.
- The `workflow-document-archive` parity suite and `slice-42-document-archive-readiness` plan verify the same create, archive, hidden-content, restore, render, and cleanup lifecycle against both targets.
- Workbench-managed Slice 42 document archive restore plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary text document can be created for `MOD-PAT-0001` on both targets, archived, hidden from active document counts/content retrieval, restored, and rendered again.
- Direct probes normalize the archive state as `deleted = 1`, verify active document counts drop back to the pre-create baseline, and verify content retrieval is unavailable while archived.
- The modernized Documents workspace renders archived rows only when Show archived documents is enabled and exposes Restore on archived cards, while the legacy document list remains browser-renderable after restore.
- The temporary document can be hard-deleted during cleanup so the seeded 1,200-document baseline remains unchanged.

Current limitations:

- This slice covers focused document archive restore only.
- Bulk restore, role-based document trash permissions, retention-policy enforcement, content version rollback, scanned-document capture, thumbnails, encryption/key management, CCDA import/export, external storage adapters, patient-portal document access rules, and authorization enforcement remain deferred.

### Slice 43: Patient Document Content Replacement

Goal: add mutation-capable patient document content replacement parity so active database-backed text documents can have their payload replaced, their preview/download hash/size updated, and their browser-visible rendering rechecked without changing seeded document rows.

Status:

- Implemented as the twenty-seventh mutation-capable modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-43-document-content-replace-readiness` plan, which creates, replaces, renders, archives, and removes a temporary text document on both legacy and modernized targets.

Scope:

- ASP.NET Core documents API now exposes `PUT /api/documents/{documentId}/content` for active non-external patient documents, replacing the text payload, MIME type, file name, byte size, hash, and uploaded timestamp.
- React Documents workspace now exposes a Replace action and compact replacement form on active non-external document cards.
- Modernized smoke coverage creates a temporary text document, replaces its payload, verifies updated list preview, content API, and download body, archives it, and hard-deletes it.
- Shared legacy and modernized workflow adapters now expose `replacePatientDocumentContent`, mapping legacy `documents.document_data`, `size`, `hash`, and `revision` updates to the modernized content replacement endpoint.
- The `workflow-document-content-replace` parity suite and `slice-43-document-content-replace-readiness` plan verify the same create, replace, render, archive, and cleanup lifecycle against both targets.
- Workbench-managed Slice 43 document content replacement plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary text document can be created for `MOD-PAT-0001` on both targets, have its payload replaced, and still render through the target browser workflow.
- Direct probes verify the replacement payload is present, the original payload is absent, the document remains active, and active document counts remain one above baseline until archive/delete cleanup.
- The modernized Documents workspace renders the updated content preview and viewer text after using the Replace control.
- The temporary document can be archived and hard-deleted during cleanup so the seeded 1,200-document baseline remains unchanged.

Current limitations:

- This slice covers focused active text payload replacement only.

### Slice 44: Fee-Sheet Diagnosis Coding Mutation

Status:

- Implemented as the twenty-eighth mutation-capable modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-44-billing-diagnosis-readiness` plan, which creates, renders, deactivates, and removes a temporary ICD10 fee-sheet diagnosis line on both legacy and modernized targets.

Scope:

- React Fees workspace now exposes a New Diagnosis Line form that creates `ICD10` billing rows with zero fee and diagnosis-code justification.
- The existing ASP.NET Core billing line endpoint and PostgreSQL billing row model are used for diagnosis lines, preserving the same lifecycle semantics as legacy OpenEMR fee-sheet rows.
- Modernized smoke coverage creates, verifies, deactivates, and deletes a temporary diagnosis line for `MOD-PAT-0001`.
- The `workflow-billing-diagnosis` parity suite and `slice-44-billing-diagnosis-readiness` plan verify direct row state plus browser-visible legacy Fee Sheet and modernized Fees rendering.
- Workbench-managed Slice 44 billing diagnosis plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary `ICD10` row can be created for `MOD-PAT-0001` on both targets without changing seeded CPT charge rows.
- Direct probes verify `code_type`, code, text, zero fee, justification, billed state, active state, and cleanup counts.
- Legacy OpenEMR Fee Sheet and modernized Fees workspace both render the diagnosis code and description before deactivation.
- The temporary diagnosis row can be deactivated and hard-deleted so the seeded billing baseline remains unchanged.

Current limitations:

- This slice covers focused fee-sheet diagnosis row lifecycle only.
- Diagnosis search/autocomplete, multi-code clinical assessment authoring, and claim adjudication behavior remain future slices.

### Slice 45: Fee-Sheet Charge Correction Mutation

Status:

- Implemented as the twenty-ninth mutation-capable modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-45-billing-correction-readiness` plan, which creates, corrects, renders, deactivates, and removes a temporary CPT fee-sheet billing line on both legacy and modernized targets.

Scope:

- React Fees workspace now exposes a Correct Billing Line flow: selecting a fee-sheet row fills a correction form, and the operator can update description, fee, units, and diagnosis justification.
- ASP.NET Core billing API now exposes a billing line update endpoint that preserves the existing code and lifecycle state while updating correction fields.
- PostgreSQL billing row lifecycle now supports focused charge-correction behavior without adding a separate claim or payment model.
- Modernized smoke coverage creates, corrects, verifies, deactivates, and deletes a temporary CPT line for `MOD-PAT-0001`.
- The `workflow-billing-correction` parity suite and `slice-45-billing-correction-readiness` plan verify direct row state plus browser-visible legacy Fee Sheet and modernized Fees rendering.
- Workbench-managed Slice 45 billing correction plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary CPT row can be created for `MOD-PAT-0001` on both targets without changing seeded charge rows.
- Direct probes verify corrected text, fee, units, justification, billed state, active state, and cleanup counts.
- Legacy OpenEMR Fee Sheet and modernized Fees workspace both render the corrected billing line before deactivation.
- The temporary billing row can be deactivated and hard-deleted so the seeded billing baseline remains unchanged.

Current limitations:

- This slice covers focused fee-sheet charge correction only.
- Claim generation, payer adjudication, remittance import, payment posting mutation, charge correction history, statement generation, and revenue-cycle audit history remain future billing slices.

### Slice 46: Fee-Sheet Modifier Mutation

Status:

- Implemented as the thirtieth mutation-capable modernized vertical slice under `modernized-openemr/`.
- Verification is the shared `slice-46-billing-modifier-readiness` plan, which creates, applies modifier `25`, renders, deactivates, and removes a temporary CPT fee-sheet billing line on both legacy and modernized targets.

Scope:

- The shared gold dataset now carries OpenEMR-style `billing.modifier` values for selected seeded CPT follow-up visits, with 334 modifier-bearing billing rows in the canonical dataset.
- PostgreSQL billing schema and seed mapping now include a `modifier` column that mirrors the legacy `billing.modifier` field.
- ASP.NET Core billing create/update/read behavior now accepts and returns billing modifiers.
- React Fees workspace now exposes modifier fields in the New CPT Line and Correct Billing Line flows and renders modifier-bearing lines as `code:modifier`.
- Modernized smoke coverage creates, modifies, verifies, deactivates, and deletes a temporary modifier-bearing CPT line for `MOD-PAT-0001`.
- The `workflow-billing-modifier` parity suite and `slice-46-billing-modifier-readiness` plan verify direct row state plus browser-visible legacy Fee Sheet and modernized Fees rendering.
- Workbench-managed Slice 46 billing modifier plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary CPT row can be created for `MOD-PAT-0001` on both targets without changing seeded charge rows.
- Direct probes verify modifier, corrected text, fee, units, justification, billed state, active state, and cleanup counts.
- Legacy OpenEMR Fee Sheet and modernized Fees workspace both render the modifier-bearing billing line before deactivation.
- The temporary billing row can be deactivated and hard-deleted so the seeded billing baseline remains unchanged.

Current limitations:

- This slice covers focused CPT fee-sheet modifier behavior only.
- Modifier validation catalogs, modifier compatibility rules, claim generation, payer adjudication, remittance import, payment posting mutation, statement generation, and revenue-cycle audit history remain future billing slices.

### Slice 47: Claim Status Readiness

Status:

- Implemented as a read-only modernized revenue-cycle slice under `modernized-openemr/`.
- Verification is the shared `slice-47-claim-status-readiness` plan, which validates seeded OpenEMR `claims` rows and modernized claim-status rendering for the stable billing anchor on both legacy and modernized targets.

Scope:

- The shared gold dataset now includes 700 deterministic claim status rows in OpenEMR's native `claims` shape.
- The `MOD-PAT-0005` billing anchor has stable queued, generated-to-file, and cleared claim examples for repeatable tests.
- PostgreSQL seed mapping now includes a normalized `claims` table sourced from the same canonical dataset.
- ASP.NET Core billing read behavior returns claim status rows alongside each billing encounter.
- React Fees workspace now shows claim status cards, payer, target, billing time, process time, generated file, and submitted-claim payload availability.
- Modernized smoke coverage validates the anchor claim status summary.
- The `claims` parity suite and `slice-47-claim-status-readiness` plan verify normalized legacy MariaDB and modernized PostgreSQL state, plus browser-visible modernized Fees rendering.
- Workbench-managed Slice 47 claim status plan actions are available for both legacy and modernized targets.

Acceptance:

- Legacy and modernized seed actions load 700 claim rows from the same canonical dataset.
- Direct probes find the `MOD-PAT-0005` queued, generated, and cleared claim statuses with primary payer data.
- The modernized billing API and Fees workspace render the same claim statuses without changing seeded billing rows.
- The side-by-side Slice 47 parity comparison matches.

Current limitations:

- This slice is read-only and covers claim status visibility only.
- Legacy billing-report UI steering, claim generation, payer adjudication, remittance import, payment posting mutation, statement generation, and revenue-cycle audit history remain future billing slices.

### Slice 48: Payment Posting Readiness

Status:

- Implemented as a read-only modernized revenue-cycle slice under `modernized-openemr/`.
- Verification is the shared `slice-48-payment-posting-readiness` plan, which validates seeded OpenEMR `ar_session` and `ar_activity` rows and modernized payment-posting rendering for the stable billing anchor on both legacy and modernized targets.

Scope:

- The shared gold dataset now includes 420 deterministic payment sessions and 617 payment activity rows in OpenEMR's native AR shape.
- The `MOD-PAT-0005` billing anchor has a stable insurance payment and contractual adjustment for encounter `1000052`, reference `EOB-NSTAR-1000052`, payer `Northstar HMO`, payment `$126.00`, adjustment `$42.00`, reason `CO-45`, and payer claim number `NSTAR-CLM-1000052`.
- PostgreSQL seed mapping now includes normalized `payment_sessions` and `payment_activities` tables sourced from the same canonical dataset.
- ASP.NET Core billing read behavior returns payment activity rows alongside each billing encounter.
- React Fees workspace now shows payment posting cards, payer/reference details, post date, payment method, paid and adjusted amounts, account/reason codes, and payer claim numbers.
- Modernized smoke coverage validates the anchor payment posting summary.
- The `payments` parity suite and `slice-48-payment-posting-readiness` plan verify normalized legacy MariaDB and modernized PostgreSQL state, plus browser-visible modernized Fees rendering.
- Workbench-managed Slice 48 payment posting plan actions are available for both legacy and modernized targets.

Acceptance:

- Legacy and modernized seed actions load 420 payment sessions and 617 payment activity rows from the same canonical dataset.
- Direct probes find the `MOD-PAT-0005` payment and adjustment facts with payer, method, reason, and claim-number data.
- The modernized billing API and Fees workspace render the same payment posting facts without changing seeded billing rows.
- The side-by-side Slice 48 parity comparison matches.

Current limitations:

- This slice is read-only and covers payment posting visibility only.
- Full ERA/EOB import, payer adjudication, payment posting mutations, patient statements, payment reversal/void handling, and revenue-cycle audit history remain future billing slices.

### Slice 49: Account Balance Readiness

Status:

- Implemented as a read-only modernized revenue-cycle slice under `modernized-openemr/`.
- Verification is the shared `slice-49-account-balance-readiness` plan, which validates seeded charge, payment, adjustment, and balance rollups for the stable billing anchor on both legacy and modernized targets.

Scope:

- The slice reuses the existing seeded billing rows plus Slice 48 payment posting rows; it does not add new gold-data records.
- ASP.NET Core billing read behavior now returns patient-level and encounter-level account summaries with charge, payment, adjustment, and balance amounts.
- React Fees workspace now shows an Account Balance panel and per-encounter charges, paid amount, adjusted amount, and remaining balance.
- Modernized smoke coverage validates the `MOD-PAT-0005` account balance summary and encounter `1000052` balance facts.
- The `account-balance` parity suite and `slice-49-account-balance-readiness` plan verify normalized legacy MariaDB and modernized PostgreSQL rollups, plus browser-visible modernized Fees rendering.
- Workbench-managed Slice 49 account balance plan actions are available for both legacy and modernized targets.

Acceptance:

- Direct probes compute `MOD-PAT-0005` patient totals of `$635.00` charges, `$206.00` paid, `$64.25` adjusted, and `$364.75` balance from the same seeded data.
- Direct probes compute encounter `1000052` totals of `$186.00` charges, `$126.00` paid, `$42.00` adjusted, and `$18.00` balance.
- The modernized billing API and Fees workspace render those same patient and encounter balance facts without changing seeded billing or payment rows.
- The side-by-side Slice 49 parity comparison matches.

Current limitations:

- This slice is read-only and covers balance visibility only.
- Patient statement generation, collection workflows, payment mutation/reversal behavior, claim adjudication, payer remittance import, and revenue-cycle audit history remain future billing slices.

### Slice 50: Account Aging Readiness

Status:

- Implemented as a read-only modernized revenue-cycle slice under `modernized-openemr/`.
- Verification is the shared `slice-50-account-aging-readiness` plan, which validates deterministic AR aging buckets for the stable billing anchor on both legacy and modernized targets.

Scope:

- The slice reuses the existing seeded billing rows plus Slice 48 payment posting rows; it does not add new gold-data records.
- ASP.NET Core billing read behavior now returns a patient-level aging summary using the dataset base date `2026-06-18`.
- React Fees workspace now shows an Aging Summary panel and per-encounter aging bucket/age-day labels.
- Modernized smoke coverage validates the `MOD-PAT-0005` account aging summary and encounter bucket facts.
- The `account-aging` parity suite and `slice-50-account-aging-readiness` plan verify normalized legacy MariaDB and modernized PostgreSQL aging rows, plus browser-visible modernized Fees rendering.
- Workbench-managed Slice 50 account aging plan actions are available for both legacy and modernized targets.

Acceptance:

- Direct probes compute `MOD-PAT-0005` aging totals of `$83.75` Current, `$18.00` 31-60, `$0.00` 61-90, `$263.00` Over 90, and `$364.75` total balance.
- Direct probes compute encounter `1000053` as Current at 6 days old, encounter `1000052` as 31-60 at 56 days old, and encounter `1000051` as Over 90 at 361 days old.
- The modernized billing API and Fees workspace render those same patient and encounter aging facts without changing seeded billing or payment rows.
- The side-by-side Slice 50 parity comparison matches.

Current limitations:

- This slice is read-only and covers aging visibility only.
- Patient statement generation, collection work queues, dunning rules, write-off workflows, payment mutation/reversal behavior, payer remittance import, and revenue-cycle audit history remain future billing slices.

### Slice 51: Account Ledger Readiness

Status:

- Implemented as a read-only modernized revenue-cycle slice under `modernized-openemr/`.
- Verification is the shared `slice-51-account-ledger-readiness` plan, which validates chronological charge, payment, adjustment, and running-balance ledger entries for the stable billing anchor on both legacy and modernized targets.

Scope:

- The slice reuses the existing seeded billing rows plus Slice 48 payment posting rows; it does not add new gold-data records.
- ASP.NET Core billing read behavior now returns a patient-level ledger summary and canonical ordered ledger entries.
- React Fees workspace now shows an Account Ledger panel with entry count, first/last entry dates, charge/paid/adjusted totals, ending balance, and per-entry running balance.
- Modernized smoke coverage validates the `MOD-PAT-0005` account ledger summary and final running balance.
- The `account-ledger` parity suite and `slice-51-account-ledger-readiness` plan verify normalized legacy MariaDB and modernized PostgreSQL ledger rows, plus browser-visible modernized Fees rendering.
- Workbench-managed Slice 51 account ledger plan actions are available for both legacy and modernized targets.

Acceptance:

- Direct probes compute 10 ledger entries for `MOD-PAT-0005`.
- Direct probes compute `$635.00` charges, `$206.00` payments, `$64.25` adjustments, and `$364.75` ending balance.
- The canonical ledger starts on `2025-06-22`, ends on `2026-06-25`, includes `EOB-NSTAR-1000052`, and renders `Running $364.75` in the modernized Fees workspace.
- The side-by-side Slice 51 parity comparison matches.

Current limitations:

- This slice is read-only and covers ledger visibility only.
- Patient statement generation, collection work queues, payment mutation/reversal behavior, payer remittance import, write-off workflows, and revenue-cycle audit history remain future billing slices.

### Slice 52: Account Statement Readiness

Status:

- Implemented as a read-only modernized revenue-cycle slice under `modernized-openemr/`.
- Verification is the shared `slice-52-account-statement-readiness` plan, which validates statement-ready recipient, period, due-date, current-due, past-due, and balance facts for the stable billing anchor on both legacy and modernized targets.

Scope:

- The slice reuses existing `MOD-PAT-0005` demographics, billing, AR payment, account aging, and account ledger facts; it does not add new gold-data records.
- ASP.NET Core billing read behavior now returns a patient-level statement readiness summary with recipient mailing details, statement period, statement date, due date, open encounter count, oldest open date/age, current due, past due, charges, payments, adjustments, and balance due.
- React Fees workspace now shows a Statement Readiness panel with status, balance due, recipient/address, period/due-date, current/past due split, and oldest open account facts.
- Modernized smoke coverage validates the `MOD-PAT-0005` statement readiness summary.
- The `account-statement` parity suite and `slice-52-account-statement-readiness` plan verify normalized legacy MariaDB and modernized PostgreSQL statement readiness rows, plus browser-visible modernized Fees rendering.
- Workbench-managed Slice 52 account statement plan actions are available for both legacy and modernized targets.

Acceptance:

- Direct probes compute `MOD-PAT-0005` recipient `Elias Morgan`, mailing address `105 Test Patient Avenue`, `Carlsbad, CA 92008`, statement period `2025-06-22` to `2026-06-25`, statement date `2026-06-25`, due date `2026-07-25`, and status `Past due review`.
- Direct probes compute 3 open encounters, 10 ledger entries, oldest open date `2025-06-22`, oldest open age 361 days, `$83.75` current due, `$281.00` past due, and `$364.75` balance due.
- The modernized billing API and Fees workspace render those same statement readiness facts without changing seeded billing, payment, ledger, or demographic rows.
- The side-by-side Slice 52 parity comparison matches.

Current limitations:

- This slice is read-only and covers statement readiness only.
- Printable patient statement generation, statement archival, batch statement runs, collection work queues, payment mutation/reversal behavior, payer remittance import, write-off workflows, and revenue-cycle audit history remain future billing slices.

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
- The twelfth modernized vertical slice implements encounter mutation with React Encounters create/update/delete, vitals, and SOAP controls, ASP.NET Core encounter lifecycle endpoints, PostgreSQL encounter/vitals/clinical-note mutation fields, modernized workflow action adapter methods, Workbench encounter mutation plan action, smoke coverage, and side-by-side slice-12 parity evidence.
- The thirteenth modernized vertical slice implements clinical-list allergy mutation with React Lists create/deactivate/delete controls, ASP.NET Core allergy lifecycle endpoints, PostgreSQL clinical-list activity fields, modernized workflow action adapter methods, Workbench clinical-list mutation plan action, smoke coverage, and side-by-side slice-13 parity evidence.
- The fourteenth modernized vertical slice implements patient-message mutation with React Messages create/close/archive/delete controls, ASP.NET Core message lifecycle endpoints, PostgreSQL message activity fields, modernized workflow action adapter methods, Workbench message mutation plan action, smoke coverage, and side-by-side slice-14 parity evidence.
- The fifteenth modernized vertical slice implements prescription mutation with React Lists prescription create/deactivate/delete controls, ASP.NET Core prescription lifecycle endpoints, PostgreSQL prescription active/end-date/refill fields, modernized workflow action adapter methods, Workbench prescription mutation plan action, smoke coverage, and side-by-side slice-15 parity evidence.
- The sixteenth modernized vertical slice implements billing mutation with React Fees CPT create/status/delete controls, ASP.NET Core billing line lifecycle endpoints, PostgreSQL billing units/billed/activity fields, modernized workflow action adapter methods, Workbench billing mutation plan action, smoke coverage, and side-by-side slice-16 parity evidence.
- The seventeenth modernized vertical slice implements procedure mutation with React Procedures order/status/report/result/delete controls, ASP.NET Core procedure lifecycle endpoints, PostgreSQL lab order/report lifecycle fields, modernized workflow action adapter methods, Workbench procedure mutation plan action, smoke coverage, and side-by-side slice-17 parity evidence.
- The eighteenth modernized vertical slice implements administration facility mutation with React Admin facility create/inactivate/delete controls, ASP.NET Core administration facility lifecycle endpoints, PostgreSQL facility inactive state, modernized workflow action adapter methods, Workbench admin facility mutation plan action, smoke coverage, and side-by-side slice-18 parity evidence.
- The nineteenth modernized vertical slice implements administration user mutation with React Admin user create/inactivate/delete controls, ASP.NET Core administration user lifecycle endpoints, PostgreSQL staff active/email/NPI fields, modernized workflow action adapter methods, Workbench admin user mutation plan action, smoke coverage, and side-by-side slice-19 parity evidence.
- The twentieth modernized vertical slice implements a read-only administration access-control matrix with React Admin visibility, ASP.NET Core administration access-control response fields, PostgreSQL access group/permission/assignment tables, normalized parity probes, Workbench access-control plan action, smoke coverage, and side-by-side slice-20 parity evidence.
- The twenty-first modernized vertical slice implements focused administration access-permission assignment mutation with React Admin grant/revoke controls, ASP.NET Core administration ACL assignment endpoints, modernized workflow action adapter methods, Workbench access-permission mutation plan action, smoke coverage, and side-by-side slice-21 parity evidence.
- The twenty-second modernized vertical slice implements focused administration user group membership mutation with React Admin Assign/Revoke controls, ASP.NET Core administration ACL membership endpoints, PostgreSQL access membership rows, modernized workflow action adapter methods, Workbench user group membership mutation plan action, smoke coverage, and side-by-side slice-22 parity evidence.
- The twenty-third modernized vertical slice implements pending/scheduled procedure-order visibility with React Procedures scheduled-order cards, ASP.NET Core procedure count fields, normalized reportless-order probes, Workbench pending procedure order plan action, smoke coverage, and side-by-side slice-23 parity evidence.
- The twenty-fourth modernized vertical slice implements operational reports CSV export with a React Reports export action, ASP.NET Core CSV endpoint, normalized report export rows, Workbench reports export plan action, smoke coverage, and side-by-side slice-24 parity evidence.
- The twenty-fifth modernized vertical slice implements read-only patient documents with a React Documents workspace, ASP.NET Core documents API, PostgreSQL patient document mapping, expanded gold-data document records, Workbench documents plan action, smoke coverage, and side-by-side slice-25 parity evidence.
- The twenty-sixth modernized vertical slice implements patient document mutation with React Documents create/archive/delete controls, ASP.NET Core documents lifecycle endpoints, modernized workflow action adapter methods, Workbench document mutation plan action, smoke coverage, and side-by-side slice-26 parity evidence.
- The twenty-seventh modernized vertical slice implements patient document content retrieval with ASP.NET Core content/download endpoints, React Documents viewer and download controls, full-content parity probes, Workbench document content plan action, smoke coverage, and side-by-side slice-27 parity evidence.
- The twenty-eighth modernized vertical slice implements patient insurance coverage visibility with chart-summary coverage rows, a React chart Insurance panel, normalized insurance probes, Workbench insurance plan action, smoke coverage, and side-by-side slice-28 parity evidence.
- The twenty-ninth modernized vertical slice implements read-only patient immunization history with expanded gold-data vaccine rows, a PostgreSQL `immunizations` table, ASP.NET Core clinical-list API immunization rows, a React Lists Immunizations panel, normalized immunization probes, Workbench immunizations plan action, smoke coverage, and side-by-side slice-29 parity evidence.
- The thirtieth modernized vertical slice implements immunization mutation with React Lists create/entered-in-error/delete controls, ASP.NET Core immunization lifecycle endpoints, modernized workflow action adapter methods, Workbench immunization mutation plan action, smoke coverage, and side-by-side slice-30 parity evidence.
- The thirty-first modernized vertical slice implements problem-list mutation with React Lists create/deactivate/delete controls, ASP.NET Core problem lifecycle endpoints, PostgreSQL problem activity fields, modernized workflow action adapter methods, Workbench problem mutation plan action, smoke coverage, and side-by-side slice-31 parity evidence.
- The thirty-second modernized vertical slice implements medication-list mutation with React Lists create/deactivate/delete controls, ASP.NET Core medication-list lifecycle endpoints, PostgreSQL medication activity fields, modernized workflow action adapter methods, Workbench medication-list mutation plan action, smoke coverage, and side-by-side slice-32 parity evidence.
- The thirty-third modernized vertical slice implements binary patient-document mutation with React Documents file upload/view/download controls, ASP.NET Core binary document lifecycle endpoints, PostgreSQL document byte storage fields, modernized workflow action adapter methods, Workbench binary document mutation plan action, smoke coverage, and side-by-side slice-33 parity evidence.
- The thirty-fourth modernized vertical slice implements patient insurance mutation with React Patient/Client chart coverage add/edit/delete controls, ASP.NET Core patient insurance lifecycle endpoints, modernized workflow action adapter methods, Workbench insurance mutation plan action, smoke coverage, and side-by-side slice-34 parity evidence.
- The thirty-fifth modernized vertical slice implements encounter metadata mutation with React Encounters sensitivity/referral/external-ID/POS controls, ASP.NET Core encounter metadata fields, PostgreSQL encounter metadata columns, modernized workflow action adapter methods, Workbench encounter metadata plan action, smoke coverage, and side-by-side slice-35 parity evidence.
- The thirty-sixth modernized vertical slice implements patient demographics mutation with React Patient/Client chart demographics edit controls, an ASP.NET Core patient demographics update endpoint, PostgreSQL patient demographic fields, modernized workflow action adapter methods, Workbench patient demographics plan action, smoke coverage, and side-by-side slice-36 parity evidence.
- The thirty-seventh modernized vertical slice implements patient registration with a React Patient/Client registration form, ASP.NET Core patient registration and guarded temporary-delete endpoints, PostgreSQL patient insert/delete behavior, modernized workflow action adapter methods, Workbench patient registration plan action, smoke coverage, and side-by-side slice-37 parity evidence.
- The thirty-eighth modernized vertical slice implements patient document sign-off with React Documents review controls, ASP.NET Core document approval endpoint, PostgreSQL document review-status fields, modernized workflow action adapter methods, Workbench document sign-off plan action, smoke coverage, and side-by-side slice-38 parity evidence.
- The thirty-ninth modernized vertical slice implements patient document external links with a React Documents External Link form, ASP.NET Core document external-link endpoint, PostgreSQL document URL/storage metadata, modernized workflow action adapter methods, Workbench document external-link plan action, smoke coverage, and side-by-side slice-39 parity evidence.
- The fortieth modernized vertical slice implements patient document denial with React Documents Deny controls, ASP.NET Core document review endpoint support for `denied`, PostgreSQL document review-status fields, modernized workflow action adapter methods, Workbench document denial plan action, smoke coverage, and side-by-side slice-40 parity evidence.
- The forty-first modernized vertical slice implements patient document metadata refiling with React Documents inline Edit controls, ASP.NET Core document metadata endpoint support, PostgreSQL document filing metadata fields, modernized workflow action adapter methods, Workbench document metadata plan action, smoke coverage, and side-by-side slice-41 parity evidence.
- The forty-second modernized vertical slice implements patient document archive restore with React Documents archived-record visibility and Restore controls, ASP.NET Core include-archived retrieval and restore endpoint support, PostgreSQL document deleted-state mapping, modernized workflow action adapter methods, Workbench document archive plan action, smoke coverage, and side-by-side slice-42 parity evidence.
- The forty-third modernized vertical slice implements patient document content replacement with React Documents Replace controls, ASP.NET Core document content replacement endpoint support, PostgreSQL text payload/hash/size updates, modernized workflow action adapter methods, Workbench document content replacement plan action, smoke coverage, and side-by-side slice-43 parity evidence.
- The forty-fourth modernized vertical slice implements fee-sheet diagnosis coding with React Fees ICD10 diagnosis controls, the existing ASP.NET Core billing line endpoint, PostgreSQL billing row lifecycle reuse, Workbench billing diagnosis plan action, smoke coverage, and side-by-side slice-44 parity evidence.
- The forty-fifth modernized vertical slice implements fee-sheet charge correction with React Fees correction controls, ASP.NET Core billing line update endpoint support, PostgreSQL billing row update reuse, Workbench billing correction plan action, smoke coverage, and side-by-side slice-45 parity evidence.
- The forty-sixth modernized vertical slice implements fee-sheet modifier behavior with canonical billing modifier seed data, React Fees modifier controls and rendering, ASP.NET Core billing modifier create/update/read support, PostgreSQL billing modifier mapping, Workbench billing modifier plan action, smoke coverage, and side-by-side slice-46 parity evidence.
- The forty-seventh modernized vertical slice implements read-only claim status visibility with canonical claim seed data, PostgreSQL claim mapping, ASP.NET Core billing claim read support, React Fees claim-status rendering, Workbench claim status plan action, smoke coverage, and side-by-side slice-47 parity evidence.
- The forty-eighth modernized vertical slice implements read-only payment posting visibility with canonical AR session/activity seed data, PostgreSQL payment mapping, ASP.NET Core billing payment read support, React Fees payment-posting rendering, Workbench payment posting plan action, smoke coverage, and side-by-side slice-48 parity evidence.
- The forty-ninth modernized vertical slice implements read-only account balance visibility by computing charge, payment, adjustment, and balance rollups over existing seeded billing/payment rows, adding ASP.NET Core billing account summaries, React Fees Account Balance rendering, Workbench account balance plan action, smoke coverage, and side-by-side slice-49 parity evidence.
- The fiftieth modernized vertical slice implements read-only account aging visibility by computing deterministic current, 31-60, 61-90, and over-90 buckets over existing seeded billing/payment rows using the dataset base date, adding ASP.NET Core billing aging summaries, React Fees Aging Summary rendering, Workbench account aging plan action, smoke coverage, and side-by-side slice-50 parity evidence.
- The fifty-first modernized vertical slice implements read-only account ledger visibility by deriving canonical chronological charge, payment, adjustment, and running-balance entries from existing seeded billing/payment rows, adding ASP.NET Core billing ledger summaries, React Fees Account Ledger rendering, Workbench account ledger plan action, smoke coverage, and side-by-side slice-51 parity evidence.
- The fifty-second modernized vertical slice implements read-only account statement readiness by deriving recipient, statement-period, due-date, current-due, past-due, oldest-open, and balance-due facts from existing seeded demographics, billing, payment, aging, and ledger rows, adding ASP.NET Core billing statement summaries, React Fees Statement Readiness rendering, Workbench account statement plan action, smoke coverage, and side-by-side slice-52 parity evidence.
