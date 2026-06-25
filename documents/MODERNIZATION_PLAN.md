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
- Workbench Test Runs now renders recent side-by-side comparison artifacts with matched/different status, run IDs, suite coverage, difference counts, accepted/unreviewed difference counts, artifact paths, Slice 124 expandable drill-ins, Slice 125 safe links to run/comparison artifact files, Slice 155 direct links to run JSON, Playwright JSON, JUnit XML, and HTML report files, Slice 256 screenshot thumbnails, Slice 257 normalized probe detail views, Slice 258 accepted-difference tracking, Slice 259 reliability trend summaries, and Slice 260 safe text-like probe attachment previews; deeper historical reliability charts remain future work.

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
9. Commit the completed slice to Git, and push to the configured remote when available.

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
- Appointment create, cancel, and delete workflows are covered by Slice 11, appointment date/time/duration/status rescheduling is covered by Slice 93, appointment arrival/check-in status is covered by Slice 94, appointment check-out status is covered by Slice 95, appointment no-show status is covered by Slice 96, appointment category preservation/rendering is covered by Slice 97, appointment pending status is covered by Slice 98, appointment provider reassignment is covered by Slice 99, appointment facility reassignment is covered by Slice 100, appointment billing-location reassignment is covered by Slice 101, appointment comments are covered by Slice 102, regular appointment recurrence metadata is covered by Slice 103, recurring-series read expansion is covered by Slice 104 for seeded regular recurrence anchors, seeded recurrence exception-date read expansion is covered by Slice 105, generated occurrence cancellation through recurrence exception dates is covered by Slice 106, skipped occurrence restoration is covered by Slice 107, generated occurrence rescheduling into a standalone appointment is covered by Slice 108, recurrence exception-list editing is covered by Slice 109, recurring root title/time propagation is covered by Slice 110, recurring root provider/facility/category/status/room/comment metadata propagation is covered by Slice 111, monthly interval recurrence is covered by Slice 112, day/workday/year interval recurrence is covered by Slice 113, OpenEMR days-of-week recurrence selection is covered by Slice 114, OpenEMR monthly repeat-on recurrence is covered by Slice 115, seeded recurring-series cadence/end-date propagation is covered by Slice 116, provider-overlap tolerance is covered by Slice 117, patient-overlap tolerance is covered by Slice 118, room-overlap/resource tolerance is covered by Slice 119, appointment reminder readiness is covered by Slice 120, and appointment schedule protection is covered by Slice 167; stricter availability validation, waitlist flows, and billing/encounter conversion remain deferred.

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
- Encounter create, update, and delete workflows are covered by Slice 12 for the focused encounter/vitals/SOAP lifecycle, encounter search/detail/mutation access protection is covered by Slice 168, and signature-derived amendment history is covered by Slice 190. Broader encounter-adjacent workflows such as templates, amendment policy controls, billing expansion, authorization policy depth, and audit history remain deferred.

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
- Message create, status update, soft-delete, hard-delete, assignment, content edit, basic reply-append, and portal metadata readiness workflows are covered by Slices 14, 65, 66, 156, and 157 for the focused patient-message lifecycle; full portal reply threading, attachments, routing queues, notification delivery, and richer task assignment remain deferred.

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
- Focused procedure order create, completion, report entry, result entry, and cascade-delete workflows are covered by Slice 17. Focused procedure result correction is covered by Slice 129. Focused report collected-date/specimen-number readiness is covered by Slice 130. Focused order-level specimen detail is covered by Slice 131. Focused procedure order metadata correction is covered by Slice 132. Focused procedure report metadata correction is covered by Slice 133. Focused procedure report review/sign-off readiness is covered by Slice 134. Focused report review queue readiness is covered by Slice 135. Focused review queue patient/date filtering is covered by Slice 136. Focused review queue provider filtering is covered by Slice 137.
- Amendment/versioning, external lab integration, specimen chain-of-custody beyond order-level specimen detail, order catalog management, broader review queue workflow operations, and audit history remain deferred to later lab/procedure slices.

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
- CSV export generation is covered by Slice 24. Read-only patient document visibility is covered by Slice 25. Focused binary patient-document upload/download lifecycle behavior is covered by Slice 33. Patient scanned attachment readiness is covered by Slice 92. Appointment reschedule/update readiness is covered by Slice 93, appointment arrival/check-in readiness is covered by Slice 94, appointment check-out readiness is covered by Slice 95, appointment no-show readiness is covered by Slice 96, appointment category readiness is covered by Slice 97, appointment pending-status readiness is covered by Slice 98, appointment provider reassignment readiness is covered by Slice 99, appointment facility reassignment readiness is covered by Slice 100, and appointment billing-location reassignment readiness is covered by Slice 101. Saved report definitions, scanner-device ingestion, fax/SMS integrations, CCDA/export workflows, and external integration adapters remain deferred to later reports/documents/integrations slices.

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
- Workbench-managed slice-11 appointment mutation parity plan, slice-93 appointment reschedule parity plan, and slice-94 appointment arrival parity plan for both legacy and modernized targets.
- Modernized smoke coverage for a safe create/cancel/delete appointment lifecycle with cleanup.

Acceptance:

- The modernized Calendar module can create a future appointment for a patient, display it in the appointment list/detail view, mark it cancelled, and delete it.
- The mutation path goes through the modernized backend API, not direct UI-to-database access.
- The `slice-11-appointment-mutation-readiness` plan creates a future appointment for `MOD-PAT-0003`, verifies appointment counts and database state, verifies browser-visible cancelled appointment values, deletes the appointment, and passes against both legacy and modernized targets with no comparison differences.

Current limitations:

- This slice covers a single future appointment lifecycle only.
- Appointment reschedule/update readiness is covered by Slice 93, appointment arrival/check-in readiness is covered by Slice 94, appointment check-out readiness is covered by Slice 95, appointment no-show readiness is covered by Slice 96, seeded OpenEMR appointment category preservation/rendering is covered by Slice 97, pending-status update/rendering is covered by Slice 98, provider reassignment rendering/editing is covered by Slice 99, facility reassignment rendering/editing is covered by Slice 100, billing-location reassignment rendering/editing is covered by Slice 101, comments are covered by Slice 102, regular recurrence metadata is covered by Slice 103, recurring-series read expansion is covered by Slice 104, seeded recurrence exception-date read expansion is covered by Slice 105, generated occurrence cancellation through recurrence exception dates is covered by Slice 106, skipped occurrence restoration is covered by Slice 107, generated occurrence rescheduling is covered by Slice 108, recurrence exception-list editing is covered by Slice 109, recurring root title/time propagation is covered by Slice 110, recurring root metadata propagation is covered by Slice 111, monthly interval recurrence is covered by Slice 112, day/workday/year interval recurrence is covered by Slice 113, OpenEMR days-of-week recurrence selection is covered by Slice 114, monthly repeat-on rules are covered by Slice 115, seeded recurring-series cadence/end-date propagation is covered by Slice 116, provider-overlap tolerance/readiness is covered by Slice 117, patient-overlap tolerance/readiness is covered by Slice 118, room-overlap/resource tolerance/readiness is covered by Slice 119, and appointment reminder readiness is covered by Slice 120. Stricter provider availability validation, resource scheduling beyond same-room overlap warnings, appointment category administration beyond the seeded categories, reminder delivery/audit workflows, waitlist flows, and billing/encounter conversion remain deferred to later scheduling slices.

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
- Encounter templates, authorization, audit history, broader billing linkage updates, and multi-form encounter packages remain deferred to later clinical workflow slices. Read-only encounter-attached document visibility is covered by Slice 67, focused encounter document current-revision readiness is covered by Slice 122, focused encounter document replacement-revision readiness is covered by Slice 123, read-only encounter fee-sheet linkage visibility is covered by Slice 68, read-only encounter claim-status linkage visibility is covered by Slice 69, read-only encounter procedure-order linkage visibility is covered by Slice 70, read-only encounter diagnosis-coding visibility is covered by Slice 71, temporary encounter-linked billing create/deactivate/delete visibility is covered by Slice 72, temporary encounter-linked ICD diagnosis coding create/deactivate/delete visibility is covered by Slice 73, focused encounter-workspace CPT/ICD fee-sheet entry is covered by Slice 74, focused encounter-workspace procedure-order entry is covered by Slice 75, focused encounter-workspace procedure result entry is covered by Slice 76, focused encounter sign-off is covered by Slice 77, focused encounter co-signature readiness is covered by Slice 121, signature-derived encounter amendment history is covered by Slice 190, focused encounter-scoped text document upload is covered by Slice 78, focused encounter-scoped PDF/binary upload is covered by Slice 79, focused encounter-scoped scanned attachment readiness is covered by Slice 126, focused encounter-scoped binary document content replacement is covered by Slice 127, focused encounter-scoped document signing is covered by Slice 80, focused encounter-scoped document denial is covered by Slice 81, focused encounter-scoped document metadata refiling is covered by Slice 82, focused same-patient encounter document movement is covered by Slice 83, focused encounter-scoped document content replacement/current-version readiness is covered by Slice 84, focused encounter-scoped document archive/restore readiness is covered by Slice 85, focused encounter-scoped document lifecycle timeline readiness is covered by Slice 86, and focused encounter-scoped external-link attachment is covered by Slice 87; direct scanner hardware integration, full encounter document routing, full historical encounter document version chains, templates, amendment policy controls, code search, coding validation, claim scrubbing, order catalogs, specimen collection, external lab integration, comprehensive audit-log export, and richer charge-capture workflows remain future work.

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
- Claim generation, payer/insurance adjudication, remittance import, payment posting mutation, modifier validation rules, diagnosis pointer validation, charge corrections, void history, statement delivery, and audit history remain deferred to later revenue-cycle workflow slices. Deterministic printable statement generation is covered by Slice 59.

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
- Amendment/versioning, external electronic lab interfaces, specimen chain-of-custody tracking beyond report metadata and order-level specimen detail, order catalogs, clinical review queue workflow actions beyond the focused queue view/sign-off path, authorization policy, and audit history remain deferred to later lab/procedure workflow slices. Focused in-place result correction is covered by Slice 129, focused report specimen metadata is covered by Slice 130, focused order-level specimen detail is covered by Slice 131, focused order metadata correction is covered by Slice 132, focused report metadata correction is covered by Slice 133, focused report review/sign-off is covered by Slice 134, focused report review queue readiness is covered by Slice 135, focused review queue patient/date filtering is covered by Slice 136, and focused review queue provider filtering is covered by Slice 137.

### Slice 129: Procedure Result Correction Readiness

Status:

- Implemented as a mutation-capable modernized lab/procedure result correction slice under `modernized-openemr/`.
- Verification is the shared `slice-129-procedure-result-correction-readiness` plan, which creates a temporary encounter/order/report/result, corrects the result in place, validates database/API/UI state, and deletes the temporary procedure tree and encounter on both legacy and modernized targets.

Scope:

- ASP.NET Core exposes `PUT /api/procedures/results/{resultId}` for focused result correction over the modernized PostgreSQL lab result tables.
- `ProcedureRepository.UpdateResultAsync` locates the result through report/order context, updates result code/text/date/status/value/units/range/abnormal flag, and returns refreshed patient procedure detail.
- The React Procedures workspace and Encounter procedure-result cards expose compact `Correct` controls that edit existing result rows without creating a new order or report.
- Legacy and modernized workflow adapters share a procedure-result correction operation so the same parity test can update the legacy `procedure_result` row and the modernized API route.
- The modernized smoke test includes a `procedure result correction lifecycle` check that creates a temporary lab workflow on `MOD-PAT-0001`, corrects the result, verifies the refreshed procedure API, and deletes the temporary order tree.
- Workbench-managed Slice 129 procedure result correction plan actions are available for both legacy and modernized targets.

Acceptance:

- The shared plan creates a temporary lab workflow for `MOD-PAT-0009`, corrects the existing result from a final high glucose value to a corrected borderline value, and preserves order/report/result identity.
- The corrected result text, value, units, range, abnormal flag, result date, and corrected status are visible in the modernized Procedures workspace and normalized database probes.
- The legacy Procedure Results screen renders the corrected result after the shared workflow adapter updates the legacy row.
- Hard-delete cleanup restores procedure counts and removes the temporary encounter/order/report/result rows.
- The side-by-side Slice 129 parity comparison matches.

Current limitations:

- This slice proves focused in-place correction only. It does not implement lab amendment history, prior-result versioning, HL7 inbound correction reconciliation, reviewer notification workflow, authorization policy, audit-log export, or order-to-charge conversion.

### Slice 130: Procedure Specimen Readiness

Status:

- Implemented as a mutation-capable modernized lab/procedure report specimen metadata slice under `modernized-openemr/`.
- Verification is the shared `slice-130-procedure-specimen-readiness` plan, which creates a temporary encounter/order/report/result with collected date and specimen number, validates database/API/UI state, and deletes the temporary procedure tree and encounter on both legacy and modernized targets.

Scope:

- The modernized PostgreSQL seed schema now stores `lab_reports.date_collected` and `lab_reports.specimen_number`, populated from the existing gold dataset report date and legacy-style `SP-{report id}` specimen number.
- The procedure and encounter repositories now read report collected date and specimen number, and procedure report creation persists the submitted values.
- The React Procedures workspace and Encounter procedure report cards render collected date and specimen number alongside report date, review status, status, and notes.
- Legacy and modernized workflow/database probes now include collected date and specimen number for procedure reports.
- The modernized smoke test procedure lifecycle checks now fail if report collected date or specimen number is missing from the API response.
- Workbench-managed Slice 130 procedure specimen plan actions are available for both legacy and modernized targets.

Acceptance:

- The shared plan creates a temporary lab workflow for `MOD-PAT-0009` with a deterministic compact specimen number and collected date.
- The legacy Procedure Results screen renders the specimen number for the temporary report.
- The modernized Procedures workspace renders both `Collected 2026-06-18 12:30` and the specimen number for the temporary report.
- Normalized database probes on both targets report the same collected date, report date, specimen number, report status, review status, and result row.
- Hard-delete cleanup restores procedure counts and removes the temporary encounter/order/report/result rows.
- The side-by-side Slice 130 parity comparison matches.

Current limitations:

- This slice proves focused report-level collected date and specimen number parity only. Detailed order-level specimen rows are covered by Slice 131. It does not implement chain-of-custody events, label printing, accessioning workflow, external lab pickup, HL7 specimen reconciliation, or full specimen workflow audit history.

### Slice 131: Procedure Specimen Detail Readiness

Status:

- Implemented as a mutation-capable modernized order-level lab/procedure specimen detail slice under `modernized-openemr/`.
- Verification is the shared `slice-131-procedure-specimen-detail-readiness` plan, which creates a temporary encounter, procedure order, and specimen row, validates database/API/UI state, and deletes the temporary procedure tree and encounter on both legacy and modernized targets.

Scope:

- The modernized PostgreSQL seed schema now includes `lab_specimens`, matching the legacy `procedure_specimen` concept while keeping the permanent gold baseline row count empty until seeded specimen fixtures are intentionally added.
- ASP.NET Core exposes `POST /api/procedures/specimens` and loads specimen rows into procedure-order detail for both Procedures and Encounter-linked procedure views.
- Procedure order deletion now removes linked specimen rows before deleting the order tree.
- The React Procedures workspace renders specimen identifier, accession identifier, type, collection method, location, collected date/time, volume, condition, and comments on procedure order cards, scheduled-order cards, report groups, and Encounter procedure-order cards.
- The Procedures workspace exposes a compact Add Specimen action for focused order-level specimen creation.
- Legacy and modernized workflow/database probes now create, read, normalize, and clean up order-level specimen detail rows.
- The modernized smoke test procedure lifecycle validates specimen creation and refreshed API visibility.
- Workbench-managed Slice 131 procedure specimen detail plan actions are available for both legacy and modernized targets.

Acceptance:

- The shared plan creates a temporary lab workflow for `MOD-PAT-0009` with deterministic compact specimen and accession identifiers.
- The modernized Procedures workspace renders the temporary specimen identifier, accession, collection method, location, collected date/time, volume, condition, and linked procedure name.
- Normalized database probes on both targets report the same specimen identifier, accession, type, collection method, location, collected date/time, volume, condition, comments, and order linkage.
- Hard-delete cleanup restores encounter/order counts and removes the temporary specimen row.
- The side-by-side Slice 131 parity comparison matches.

Current limitations:

- This slice proves focused order-level specimen detail only. It does not implement chain-of-custody events, label printing, accessioning workflow, external lab pickup, HL7 specimen reconciliation, external lab result import, or specimen audit history.

### Slice 132: Procedure Order Correction Readiness

Status:

- Implemented as a mutation-capable modernized lab/procedure order correction slice under `modernized-openemr/`.
- Verification is the shared `slice-132-procedure-order-correction-readiness` plan, which creates a temporary encounter and procedure order, corrects order metadata, validates database/API/UI state, creates a report/result after correction, and deletes the temporary procedure tree and encounter on both legacy and modernized targets.

Scope:

- ASP.NET Core exposes `PUT /api/procedures/orders/{orderId}` for focused order metadata correction over the modernized PostgreSQL lab order table.
- `ProcedureRepository.UpdateOrderAsync` validates the submitted order date/code/name/type/diagnosis/priority/status values, updates the existing order row, and returns refreshed patient procedure detail.
- The React Procedures workspace exposes a compact `Correct Order` action on procedure order cards for editing order date, procedure code/name/type, diagnosis, priority, status, and instructions.
- Legacy and modernized workflow/database probes now normalize corrected order priority, procedure type, diagnosis, and instructions alongside existing order/report/result facts.
- The modernized smoke test procedure lifecycle now verifies corrected order metadata through the API response.
- Workbench-managed Slice 132 procedure order correction plan actions are available for both legacy and modernized targets.

Acceptance:

- The shared plan creates a temporary lab workflow for `MOD-PAT-0009`, corrects the existing order from an initial CMP-style order to a corrected CBC-style order, and preserves the order identity.
- The corrected order date, code, name, type, diagnosis, priority, status, and instructions are visible in the modernized Procedures workspace and normalized database probes.
- The legacy Procedure Results screen renders the corrected order and result after the shared workflow adapter updates the legacy rows.
- Hard-delete cleanup restores encounter/order counts and removes the temporary order/report/result rows.
- The side-by-side Slice 132 parity comparison matches.

Current limitations:

- This slice proves focused order metadata correction only. It does not implement order amendment history, reviewer authorization, notification workflow, external lab reconciliation, order catalog governance, charge capture, or audit-log export.

### Slice 133: Procedure Report Correction Readiness

Status:

- Implemented as a mutation-capable modernized lab/procedure report correction slice under `modernized-openemr/`.
- Verification is the shared `slice-133-procedure-report-correction-readiness` plan, which creates a temporary encounter, procedure order, report, and result, corrects report metadata, validates database/API/UI state, and deletes the temporary procedure tree and encounter on both legacy and modernized targets.

Scope:

- ASP.NET Core exposes `PUT /api/procedures/reports/{reportId}` for focused report metadata correction over the modernized PostgreSQL lab report table.
- `ProcedureRepository.UpdateReportAsync` validates collected/report dates plus required specimen/status/review values, updates the existing report row, and returns refreshed patient procedure detail.
- The React Procedures workspace exposes a compact `Correct Report` action on procedure report cards for editing collected date, report date, specimen number, report status, review status, and notes.
- Legacy and modernized workflow/database probes now normalize report date and report notes alongside existing report status, review status, collected date, specimen number, order, and result facts.
- The modernized smoke test procedure lifecycle now verifies corrected report metadata through the API response before creating the result row.
- Workbench-managed Slice 133 procedure report correction plan actions are available for both legacy and modernized targets.

Acceptance:

- The shared plan creates a temporary lab workflow for `MOD-PAT-0009`, corrects the existing report from an initial pending/final report to a corrected reviewed report, and preserves the report identity.
- The corrected collected date, report date, specimen number, report status, review status, notes, and linked result row are visible in the modernized Procedures workspace and normalized database probes.
- The legacy Procedure Results screen renders the corrected specimen number and result after the shared workflow adapter updates the legacy row.
- Hard-delete cleanup restores encounter/order counts and removes the temporary order/report/result rows.
- The side-by-side Slice 133 parity comparison matches.

Current limitations:

- This slice proves focused report metadata correction only. Focused report sign-off is covered by Slice 134. It does not implement report amendment history, prior-report versioning, reviewer authorization policy, notification workflow, external lab reconciliation, or audit-log export.

### Slice 134: Procedure Report Sign-Off Readiness

Status:

- Implemented as a mutation-capable modernized lab/procedure report sign-off slice under `modernized-openemr/`.
- Verification is the shared `slice-134-procedure-report-signoff-readiness` plan, which creates a temporary encounter, procedure order, report, and result, signs/reviews the report, validates database/API/UI state, and deletes the temporary procedure tree and encounter on both legacy and modernized targets.

Scope:

- ASP.NET Core exposes `PUT /api/procedures/reports/{reportId}/sign` for focused report review/sign-off over the modernized PostgreSQL lab report table.
- The modernized PostgreSQL seed schema now carries `lab_reports.reviewed_by` and `lab_reports.reviewed_at`, while legacy parity normalizes OpenEMR's `procedure_report.source` plus `review_status` representation.
- The React Procedures workspace exposes a compact `Sign Report` action on procedure report cards and renders `Signed by admin` plus the signed timestamp after the mutation refreshes the patient procedure detail.
- Procedure report read models in both the Procedures and Encounter workspaces include signed review metadata.
- Legacy and modernized workflow/database probes share a procedure-report sign-off operation and normalize signed reviewer/timestamp facts.
- The modernized smoke test includes report sign-off in the procedure mutation lifecycle.
- Workbench-managed Slice 134 procedure report sign-off plan actions are available for both legacy and modernized targets.

Acceptance:

- The shared plan creates a temporary lab workflow for `MOD-PAT-0009`, signs the existing report as `admin` at `2026-06-19 14:15`, and preserves order/report/result identity.
- The signed reviewer, signed timestamp, reviewed status, report metadata, and linked result are visible in the modernized Procedures workspace and normalized database/API probes.
- The legacy Procedure Results screen still renders the signed report/result after the shared workflow adapter updates the legacy `procedure_report` row.
- Hard-delete cleanup restores procedure counts and removes the temporary encounter/order/report/result rows.
- The side-by-side Slice 134 parity comparison matches.

Current limitations:

- This slice proves focused report review/sign-off parity only. Procedure report reopen review is covered by Slice 154. It does not implement role-based reviewer authorization, multi-reviewer queues, notification workflow, legal attestation text, external lab reconciliation, amendment history, or audit-log export.

### Slice 135: Procedure Report Review Queue Readiness

Status:

- Implemented as a mutation-capable modernized lab/procedure report review queue slice under `modernized-openemr/`.
- Verification is the shared `slice-135-procedure-report-review-queue-readiness` plan, which creates a temporary unreviewed report, verifies received/unreviewed queue membership, signs the report, verifies reviewed queue membership, and deletes the temporary procedure tree and encounter on both legacy and modernized targets.

Scope:

- ASP.NET Core exposes `GET /api/procedures/report-review-queue` with `unreviewed`, `reviewed`, and `all` filters over modernized `lab_reports`.
- `ProcedureRepository.GetReportReviewQueueAsync` normalizes queue counts and rows across report, order, patient, provider, status, specimen, note, reviewer, and review timestamp facts.
- The React Reports workspace renders a `Procedure Report Review Queue` panel with segmented Received/unreviewed, Reviewed, and All filters plus queue summary counts and report cards.
- Legacy and modernized database probes now share normalized procedure report review queue facts.
- The modernized smoke test validates that an unreviewed temporary report appears before sign-off, moves into the reviewed queue after sign-off, and leaves the unreviewed queue.
- Workbench-managed Slice 135 procedure report review queue plan actions are available for both legacy and modernized targets.

Acceptance:

- The shared plan creates a temporary lab workflow for `MOD-PAT-0009`, initially stores the report as `received`, and verifies that it appears in the unreviewed queue.
- The legacy `Procedure Orders and Reports` screen is exercised through the same reviewed/unreviewed filter semantics as OpenEMR `list_reports.php`.
- The modernized Reports workspace shows the temporary report in the received/unreviewed queue, then shows the same report in the reviewed queue after `admin` sign-off.
- Normalized database probes prove reviewed/unreviewed counts and queue membership on both MariaDB and PostgreSQL.
- Hard-delete cleanup restores procedure counts and removes the temporary encounter/order/report rows.
- The side-by-side Slice 135 parity comparison matches.

Current limitations:

- This slice proves focused report review queue visibility and queue-state transition only. Procedure report bulk sign-off is covered by Slice 153. It does not implement reviewer assignment, queue notifications, queue export, role-based reviewer authorization, external lab reconciliation, amendment history, or audit-log export.

### Slice 136: Procedure Report Review Queue Filters Readiness

Status:

- Implemented as a mutation-capable modernized lab/procedure report review queue filter slice under `modernized-openemr/`.
- Verification is the shared `slice-136-procedure-report-review-queue-filters-readiness` plan, which creates a temporary received report, verifies patient/order-date filtered unreviewed queue inclusion, verifies outside-date exclusion, signs the report, verifies filtered reviewed queue membership, and deletes the temporary procedure tree and encounter on both legacy and modernized targets.

Scope:

- ASP.NET Core extends `GET /api/procedures/report-review-queue` with optional `patientId`, `fromDate`, and `toDate` query filters while preserving `unreviewed`, `reviewed`, and `all` status filters.
- `ProcedureRepository.GetReportReviewQueueAsync` applies the filters against patient canonical ID, public patient ID, legacy PID, and lab order date to match the legacy `list_reports.php` patient/date semantics.
- The React Reports workspace renders Patient, From, and To filter controls inside the `Procedure Report Review Queue` panel.
- Legacy and modernized database probes now share normalized filtered procedure report review queue facts.
- The modernized smoke test validates filtered queue inclusion, outside-date exclusion, and filtered reviewed queue membership during the procedure mutation lifecycle.
- Workbench-managed Slice 136 procedure report review queue filters plan actions are available for both legacy and modernized targets.

Acceptance:

- The shared plan creates a temporary lab workflow for `MOD-PAT-0009`, stores the report as `received`, and verifies patient/order-date filtered membership in the unreviewed queue.
- The same patient filter with an outside order-date range excludes the temporary report.
- The legacy `Procedure Orders and Reports` screen is exercised through OpenEMR `list_reports.php` patient and order-date filter parameters.
- The modernized Reports workspace applies the Patient, From, and To controls to the same queue endpoint and renders matching inclusion/exclusion behavior.
- After `admin` sign-off, the filtered reviewed queue contains the same report with normalized reviewer metadata.
- Hard-delete cleanup restores procedure counts and removes the temporary encounter/order/report rows.
- The side-by-side Slice 136 parity comparison matches.

Current limitations:

- This slice proves focused patient/date filtering for the report review queue only. Provider filtering is covered by Slice 137, and procedure report bulk sign-off is covered by Slice 153. It does not implement saved queue filters, reviewer assignment, queue notifications, queue export, role-based reviewer authorization, external lab reconciliation, amendment history, or audit-log export.

### Slice 137: Procedure Report Review Queue Provider Filters Readiness

Status:

- Implemented as a mutation-capable modernized lab/procedure report review queue provider filter slice under `modernized-openemr/`.
- Verification is the shared `slice-137-procedure-report-review-queue-provider-filters-readiness` plan, which creates a temporary received report with a known provider, verifies provider-filtered unreviewed queue inclusion, verifies outside-provider exclusion, signs the report, verifies filtered reviewed queue membership, and deletes the temporary procedure tree and encounter on both legacy and modernized targets.

Scope:

- ASP.NET Core extends `GET /api/procedures/report-review-queue` with optional `providerId` filtering while preserving status, patient, and date filters.
- `ProcedureRepository.GetReportReviewQueueAsync` applies the provider filter against `lab_orders.provider_id`, matching the legacy `list_reports.php` `form_provider` / `procedure_order.provider_id` semantics.
- The React Reports workspace renders a Provider number control in the procedure report review queue filter grid and displays provider IDs on queue cards.
- Legacy and modernized database probes now share normalized provider-filtered procedure report review queue facts.
- The modernized smoke test validates provider-filtered queue inclusion, outside-provider exclusion, and filtered reviewed queue membership during the procedure mutation lifecycle.
- Workbench-managed Slice 137 procedure report review queue provider filters plan actions are available for both legacy and modernized targets.

Acceptance:

- The shared plan creates a temporary lab workflow for `MOD-PAT-0009`, stores the report as `received`, and verifies provider-filtered membership in the unreviewed queue.
- An outside provider filter excludes the temporary report from the unreviewed queue.
- The legacy `Procedure Orders and Reports` screen is exercised through OpenEMR `list_reports.php` provider filter parameters.
- The modernized Reports workspace applies the Provider control to the same queue endpoint and renders matching inclusion/exclusion behavior.
- After `admin` sign-off, the provider-filtered reviewed queue contains the same report with normalized reviewer metadata.
- Hard-delete cleanup restores procedure counts and removes the temporary encounter/order/report rows.
- The side-by-side Slice 137 parity comparison matches.

Current limitations:

- This slice proves focused provider filtering for the report review queue only. Lab filtering through `form_lab_search` / `procedure_order.lab_id` is covered by Slice 138, and procedure report bulk sign-off is covered by Slice 153. Saved queue filters, reviewer assignment, queue notifications, queue export, role-based reviewer authorization, external lab reconciliation, amendment history, and audit-log export remain deferred.

### Slice 138: Procedure Report Review Queue Lab Filters Readiness

Status:

- Implemented as a mutation-capable modernized lab/procedure report review queue lab filter slice under `modernized-openemr/`.
- Verification is the shared `slice-138-procedure-report-review-queue-lab-filters-readiness` plan, which creates temporary lab providers, creates a received report assigned to the matching lab, verifies lab-filtered unreviewed queue inclusion, verifies outside-lab exclusion, signs the report, verifies filtered reviewed queue membership, and deletes the temporary procedure tree, encounter, and lab-provider rows on both legacy and modernized targets.

Scope:

- Modernized PostgreSQL seed generation now includes `lab_orders.lab_id`, an empty `lab_providers` table, and a `lab_id` index so lab ownership can be exercised by temporary parity fixtures without changing permanent gold-data counts.
- `GET /api/procedures/report-review-queue` accepts optional `labId` filtering and returns `labId` / `labName` facts on queue items.
- Procedure order creation accepts optional `labId`, allowing parity and smoke flows to create lab-owned temporary orders.
- The React Reports workspace renders a Lab number control in the procedure report review queue filter grid and displays lab IDs/names on queue cards.
- Legacy and modernized workflow adapters can create/delete temporary lab providers while leaving the gold dataset stable.
- The modernized smoke test validates lab-filtered queue inclusion, outside-lab exclusion, and lab-filtered reviewed queue membership during the procedure mutation lifecycle.
- Workbench-managed Slice 138 procedure report review queue lab filters plan actions are available for both legacy and modernized targets.

Acceptance:

- The shared parity suite proves that legacy `list_reports.php` `form_lab_search` / `procedure_order.lab_id` filtering and modernized `labId` filtering select the same temporary report.
- The outside-lab filter excludes the temporary report on both targets.
- The modernized Reports workspace applies the Lab control to the same queue endpoint and renders matching inclusion/exclusion behavior.
- After `admin` sign-off, the lab-filtered reviewed queue contains the same report with normalized reviewer metadata.
- Hard-delete cleanup restores procedure counts and removes the temporary encounter/order/report rows and temporary lab-provider rows.
- The side-by-side Slice 138 parity comparison matches.

Current limitations:

- This slice proves focused lab filtering for the report review queue only. Permanent gold-data lab-provider catalogs are covered by Slice 139, and procedure report bulk sign-off is covered by Slice 153. Saved queue filters, reviewer assignment, queue notifications, queue export, role-based reviewer authorization, external lab reconciliation, amendment history, and audit-log export remain deferred.

### Slice 139: Procedure Lab Provider Catalog Readiness

Status:

- Implemented as a read-only gold-data enrichment and parity slice under `modernization-workbench/seed-data/`, `modernized-openemr/`, and `parity-tests/`.
- Verification is the shared `slice-139-procedure-lab-provider-catalog-readiness` plan, which resets each target to the shared gold dataset, verifies permanent lab-provider ownership for seeded reviewed procedure reports, verifies outside-lab exclusion, and renders the same reviewed queue row through legacy OpenEMR and the modernized Reports workspace.

Scope:

- The shared synthetic gold dataset now includes five permanent lab providers with stable IDs `501` through `505`.
- All 1,000 seeded lab orders are deterministically assigned to those lab providers, including both the 700 completed/reviewed lab reports and the 300 future/scheduled lab orders.
- Legacy MariaDB seed SQL inserts the gold lab providers into `procedure_providers` and writes `procedure_order.lab_id` for seeded procedure orders.
- Modernized PostgreSQL seed generation imports the same catalog into `lab_providers` and writes `lab_orders.lab_id`.
- The read-only `workflow-procedure-lab-provider-catalog` Playwright parity suite anchors on `MOD-PAT-0009`, order `5000009`, report `6000009`, and lab `504` (`Pacific Women's Health Laboratory`) to prove database and browser-visible reviewed queue behavior.
- Workbench-managed Slice 139 procedure lab provider catalog plan actions are available for both legacy and modernized targets.

Acceptance:

- The shared seed dataset reports `labProviders: 5`, `labOrders: 1000`, `labReports: 700`, and `labResults: 2400`.
- The legacy target contains matching `procedure_providers` rows and `procedure_order.lab_id` assignments for seeded procedure orders.
- The modernized target contains matching `lab_providers` rows and `lab_orders.lab_id` assignments for seeded procedure orders.
- The reviewed report queue for `MOD-PAT-0009`, lab `504`, and order date `2026-02-26` contains report `6000009` with the normalized lab name, code, specimen number, reviewer, and reviewed timestamp.
- The same patient/date query with outside lab `501` excludes the anchor report on both targets.
- The legacy `Procedure Orders and Reports` page and the modernized Reports workspace render the seeded reviewed report row through their lab filters.
- The side-by-side Slice 139 parity comparison matches.

Current limitations:

- This slice makes the lab-provider catalog permanent in the gold dataset. Directory-level lab-provider list behavior is covered by Slice 140, and procedure report bulk sign-off is covered by Slice 153. Saved queue filters, reviewer assignment, queue notifications, queue export, role-based reviewer authorization, external lab reconciliation, amendment history, and audit-log export remain deferred.

### Slice 140: Procedure Lab Provider Directory Readiness

Status:

- Implemented as a read-only procedure/lab directory slice under `modernized-openemr/`, `parity-tests/`, and Workbench managed parity actions.
- Verification is the shared `slice-140-procedure-lab-provider-directory-readiness` plan, which resets each target to the shared gold dataset, verifies the five permanent provider rows, NPI values, active filtering, and balanced order/report/future-order counts, and renders the same directory through legacy OpenEMR and the modernized Reports workspace.

Scope:

- `GET /api/procedures/lab-providers` returns the modernized lab-provider directory with dataset metadata, active/inactive totals, provider identifiers, NPI, protocol, active state, total order count, reviewed report count, and future scheduled order count.
- The React Reports workspace renders a Procedure Lab Providers panel with an Include inactive providers toggle, active/inactive/total counters, and provider cards matching the seeded gold-data catalog.
- Legacy browser parity opens `interface/orders/procedure_provider_list.php`, preserving the native `Procedure Providers` page semantics and its default active-provider filter.
- The shared `workflow-procedure-lab-provider-directory` suite normalizes the legacy `procedure_providers` rows and modernized `lab_providers` rows for stable comparison.
- Workbench-managed Slice 140 procedure lab provider directory plan actions are available for both legacy and modernized targets.

Acceptance:

- Both targets expose exactly the five permanent gold-data providers `501` through `505` in active-provider mode.
- Each provider has the expected NPI, OpenEMR's default `DL` protocol value, active state, 200 assigned lab orders, 140 reviewed reports, and 60 future scheduled orders.
- The include-inactive option preserves the same five-provider directory because the current gold catalog has no inactive lab providers.
- The legacy `Procedure Providers` page renders the seeded provider names and NPI values.
- The modernized Reports workspace renders the provider directory, active/total counts, NPI values, and order/report/future-order counts.
- The side-by-side Slice 140 parity comparison matches.

Current limitations:

- This slice is read-only. Provider lifecycle add/deactivate/delete behavior is covered by Slice 141; protocol setup beyond default `DL` is covered by Slice 142; address-book organization linking is covered by Slice 144. Compendium imports, credential management, external lab ordering integration, and audit history remain deferred.

### Slice 141: Procedure Lab Provider Lifecycle Readiness

Status:

- Implemented as a mutation-capable procedure/lab provider lifecycle slice under `modernized-openemr/`, `parity-tests/`, and Workbench managed parity actions.
- Verification is the shared `slice-141-procedure-lab-provider-lifecycle-readiness` plan, which resets each target to the shared gold dataset, creates a temporary provider, verifies active-provider rendering, deactivates it, verifies include-inactive rendering, deletes it, and confirms cleanup.

Scope:

- The modernized PostgreSQL `lab_providers` table now stores provider protocol as durable state instead of hardcoding it in API responses.
- The modernized procedures API exposes `POST /api/procedures/lab-providers`, `PUT /api/procedures/lab-providers/{providerId}`, and `DELETE /api/procedures/lab-providers/{providerId}` for temporary provider lifecycle behavior.
- The React Reports workspace Procedure Lab Providers panel now supports adding a provider and toggling/deleting visible provider cards while preserving the include-inactive directory view.
- Legacy and modernized workflow adapters can create, read, update/deactivate, and delete temporary provider rows using each target's native storage/API path.
- The shared `workflow-procedure-lab-provider-lifecycle` suite proves the lifecycle against both legacy OpenEMR and the modernized target.
- Workbench-managed Slice 141 procedure lab provider lifecycle plan actions are available for both legacy and modernized targets.

Acceptance:

- Both targets can create a temporary active lab provider with the same name, NPI, protocol, and active state.
- The active provider renders in legacy OpenEMR's `Procedure Providers` page and in the modernized Reports workspace provider directory.
- Both targets can deactivate the temporary provider and preserve it for include-inactive rendering while hiding it from the default active-provider list.
- Both targets can delete the temporary provider and confirm it is absent after cleanup.
- The side-by-side Slice 141 parity comparison matches.

Current limitations:

- This slice covers focused temporary-provider lifecycle behavior only. Provider transport/settings fields are covered by Slice 142 and address-book organization linking is covered by Slice 144. Compendium imports, external lab ordering execution, linked-provider deletion policies, audit history, and role-specific authorization remain deferred.

### Slice 142: Procedure Lab Provider Configuration Readiness

Status:

- Implemented as a mutation-capable procedure/lab provider configuration slice under `modernized-openemr/`, `parity-tests/`, and Workbench managed parity actions.
- Verification is the shared `slice-142-procedure-lab-provider-configuration-readiness` plan, which resets each target to the shared gold dataset, creates a temporary provider, updates its protocol and transport settings, verifies database/API and browser rendering, deletes it, and confirms cleanup.

Scope:

- The modernized PostgreSQL `lab_providers` table now stores legacy-aligned provider configuration fields for usage, direction, sender/receiver application and facility IDs, remote host, login, password, orders path, results path, and notes.
- The modernized procedures API create/update/read provider contract now round-trips those configuration fields while preserving OpenEMR defaults of `DL` protocol, `D` usage, and `B` direction.
- The React Reports workspace Procedure Lab Providers panel now exposes configuration inputs and renders the saved provider setup on provider cards.
- Legacy and modernized workflow adapters can create, read, update, and delete temporary provider rows with the same configuration fields through each target's native storage/API path.
- The shared `workflow-procedure-lab-provider-configuration` suite proves the configuration contract against both legacy OpenEMR and the modernized target.
- Workbench-managed Slice 142 procedure lab provider configuration plan actions are available for both legacy and modernized targets.

Acceptance:

- Both targets can create a temporary lab provider and then update name, NPI, protocol, usage, direction, sender IDs, receiver IDs, remote host, login, password, order/result paths, notes, and active state.
- The updated provider renders in legacy OpenEMR's `Procedure Providers` page and in the modernized Reports workspace provider directory with the same normalized values.
- The modernized seed adapter imports the permanent five-provider catalog with empty-string transport defaults instead of SQL nulls for legacy-style not-set fields.
- Both targets delete the temporary provider and confirm it is absent after cleanup.
- The side-by-side Slice 142 parity comparison matches.

Current limitations:

- This slice covers focused configuration persistence and rendering only. Lab-director/address-book organization linking is covered by Slice 144. Compendium imports, external SFTP/filesystem/web-service execution, credential encryption/rotation policy, role-specific authorization, and audit history remain deferred.

### Slice 144: Procedure Lab Provider Address Book Linkage Readiness

Status:

- Implemented as a mutation-capable procedure/lab provider address-book linkage slice under `modernized-openemr/`, `parity-tests/`, and Workbench managed parity actions.
- Verification is the shared `slice-144-procedure-lab-provider-address-book-readiness` plan, which resets each target to the shared gold dataset, creates temporary order-service address-book organizations, links a procedure lab provider to those organizations, verifies provider name derivation and rendering, deletes the provider and organizations, and confirms cleanup.

Scope:

- The modernized PostgreSQL seed schema now includes `lab_provider_address_book` plus `lab_providers.lab_director_id` so the target can model OpenEMR's `users.abook_type LIKE 'ord_%'` and `procedure_providers.lab_director` relationship without adding permanent address-book seed rows.
- The modernized procedures API exposes `GET`, `POST`, and `DELETE` endpoints under `/api/procedures/lab-provider-address-book` for parity-managed temporary order-service organizations.
- Modernized lab-provider create/update now accepts `labDirectorId`; when provided, the provider name is derived from the linked address-book organization just as legacy OpenEMR copies `users.organization` into `procedure_providers.name`.
- The React Reports workspace provider cards render linked address-book organization and type alongside the existing provider configuration fields.
- Legacy and modernized workflow adapters can create/read/update/delete temporary address-book organizations and linked provider rows using each target's native storage/API path.
- Workbench-managed Slice 144 procedure lab provider address-book plan actions are available for both legacy and modernized targets.

Acceptance:

- Both targets can create temporary order-service address-book organizations with type `ord_lab`.
- Both targets can create a procedure lab provider linked to an address-book organization and derive the provider name from the organization instead of the fallback manual name.
- Both targets can update the provider to a second address-book organization and update the derived provider name, linked organization ID, linked organization type, NPI, protocol, usage, direction, and browser-visible rendering.
- The legacy `Procedure Providers` page renders the derived organization name and not the fallback update name.
- The modernized Reports workspace renders the derived organization name, linked address-book organization, address-book type, NPI, protocol, usage, and direction.
- Both targets delete the temporary provider and address-book organizations during cleanup.
- The side-by-side Slice 144 parity comparison matches.

Current limitations:

- This slice covers focused address-book linkage semantics only. It does not implement full address-book administration UI, compendium imports, external SFTP/filesystem/web-service execution, credential encryption/rotation policy, linked-provider deletion policy, role-specific authorization, or audit history.

### Slice 145: Procedure Order Catalog Readiness

Status:

- Implemented as a read-only procedure/lab order catalog slice under `modernized-openemr/`, `parity-tests/`, shared gold seed data, and Workbench managed parity actions.
- Verification is the shared `slice-145-procedure-order-catalog-readiness` plan, which resets each target to the shared gold dataset, verifies the permanent procedure order catalog tree, checks provider groups and orderable panel rows, renders legacy OpenEMR's Configure Orders and Results catalog/AJAX rows, renders the modernized Reports procedure order catalog panel, and compares the two target runs.

Scope:

- The shared gold dataset now includes 21 permanent procedure order catalog items: one `Gold Lab Order Catalog` root, five provider groups for lab providers `501` through `505`, and 15 orderable panel rows for Hemoglobin A1c, comprehensive metabolic panel, and complete blood count under each provider.
- The legacy seed inserts those rows into OpenEMR `procedure_type` IDs `9000` through `9999` with `grp` and `ord` row types, provider `lab_id`, `procedure_code`, `procedure_type_name`, specimen, standard code, sequence, and active state.
- The modernized PostgreSQL seed imports the same canonical rows into `lab_order_catalog`, preserving stable IDs, parent relationships, provider links, order codes, order names, specimen, standard code, sequence, and active state.
- The modernized procedures API exposes `GET /api/procedures/order-catalog` with dataset metadata, aggregate counts, and normalized catalog items.
- The React Reports workspace renders a read-only Procedure Order Catalog panel with provider groups and orderable panel rows, and the Procedures workspace new-order form exposes catalog pick buttons to fill procedure code/name from the shared catalog.
- Workbench-managed Slice 145 procedure order catalog plan actions are available for both legacy and modernized targets.

Acceptance:

- Both targets expose the same catalog counts: 21 total items, 6 groups, 15 order rows, and 5 lab providers.
- Both targets preserve the `Gold Lab Order Catalog` root, five provider child groups, and three order rows per provider.
- The anchor provider group `9040` maps to lab `504` (`Pacific Women's Health Laboratory`) and exposes procedure codes `83036`, `80053`, and `85025` with `laboratory` type and `blood` specimen.
- Legacy OpenEMR renders the catalog through `interface/orders/types.php` and `types_ajax.php`; the modernized target renders the same normalized facts in the Reports procedure order catalog panel and API.
- The side-by-side Slice 145 parity comparison matches.

Current limitations:

- This slice covers permanent seed/read catalog behavior only. Focused orderable-row catalog lifecycle behavior is covered by Slice 147, and focused vendor compendium import behavior is covered by Slice 148; bulk catalog administration, external lab reconciliation, role-specific authorization, audit history, and production external lab ordering remain deferred.

### Slice 146: Workbench Progress Completion Estimates

Status:

- Implemented as a Workbench-specific progress-ledger slice under `modernization-workbench/`.
- Verification is the Workbench production build plus JSON parsing for the progress configuration consumed by `/api/progress`.

Scope:

- The Workbench functionality progress ledger now records `completionEstimatePercent` and `estimateRationale` for each tracked domain area.
- The `/api/progress` contract and TypeScript UI model expose those estimate fields so the frontend and backend stay aligned with the curated ledger shape.
- The Progress page now shows an aggregate estimated-complete metric and per-area meter cards with rationale text.
- The estimate is intentionally directional and scope-adjusted. It is a planning signal for Workbench operators, not a contractual pass/fail measure.
- The ledger version is updated to `0.2.0` and includes the Slice 145 procedure order catalog evidence in the Labs and Procedures area.

Acceptance:

- The Workbench production build passes.
- The progress configuration parses successfully and contains estimate/rationale fields for all tracked areas.
- The Progress page can render overall and per-area estimated completion without changing the existing completed/outstanding/deferred ledger model.
- Documentation explains that completion estimates may move up or down as legacy discovery changes the known scope.

Current limitations:

- This slice does not attempt to calculate completion automatically from test counts. The estimates remain curated project metadata until enough historical evidence exists to justify a more formal scoring model.

### Slice 147: Procedure Order Catalog Lifecycle Readiness

Status:

- Implemented as a mutation-capable procedure/lab order catalog slice under `modernized-openemr/`, `parity-tests/`, and Workbench managed parity actions.
- Verification is the shared `slice-147-procedure-order-catalog-lifecycle-readiness` plan, which resets each target to the shared gold dataset, creates a temporary orderable catalog row under the permanent provider group `9040`, updates its code/name/specimen/description/sequence, deactivates it, deletes it, verifies cleanup, and compares the two target runs.

Scope:

- The modernized procedures API now exposes `POST`, `PUT`, and `DELETE` endpoints under `/api/procedures/order-catalog` for focused catalog item lifecycle behavior.
- The modernized PostgreSQL `lab_order_catalog` table supports temporary orderable item creation without changing the permanent gold catalog contract.
- The React Reports workspace Procedure Order Catalog panel now includes a compact catalog item creation form plus active-state and delete controls for orderable catalog rows.
- Legacy and modernized workflow adapters can create, update, deactivate, read, and delete temporary order catalog rows using each target's native storage/API path.
- Workbench-managed Slice 147 procedure order catalog lifecycle plan actions are available for both legacy and modernized targets.

Acceptance:

- Both targets can create a temporary orderable catalog row under provider group `9040` for lab `504`.
- Both targets can render the temporary row through legacy `types_ajax.php` and the modernized Reports Procedure Order Catalog panel.
- Both targets can update code, name, specimen, description, standard code, sequence, and active state.
- Both targets delete the temporary catalog row and confirm it is absent after cleanup.
- The side-by-side Slice 147 parity comparison matches.

Current limitations:

- This slice covers focused orderable-row lifecycle behavior only. Focused vendor compendium import behavior is covered by Slice 148, and clinical order queue readiness is covered by Slice 149; bulk catalog administration, role-specific authorization, audit-log export, and production external lab ordering remain deferred.

### Slice 148: Procedure Vendor Compendium Import Readiness

Status:

- Implemented as a mutation-capable procedure/lab order catalog import slice under `modernized-openemr/`, `parity-tests/`, and Workbench managed parity actions.
- Verification is the shared `slice-148-procedure-vendor-compendium-import-readiness` plan, which resets each target to the shared gold dataset, creates a temporary catalog group, imports PathGroup-style order/result CSV rows, re-imports a changed CSV to verify legacy-compatible deactivate/reactivate semantics, verifies database and browser-visible behavior, cleans up the temporary subtree, and compares the two target runs.

Scope:

- The modernized procedures API now exposes `POST /api/procedures/order-catalog/import-compendium` for focused vendor compendium imports.
- The import contract supports PathGroup-style order/result CSV rows and YPMG/DPMG-style order-only CSV rows, matching the legacy OpenEMR `load_compendium.php` order-definition branches at the catalog-storage level.
- The modernized import marks existing active `ord` rows under the selected group inactive, upserts imported order rows, and for PathGroup rows upserts `res` children under imported orders.
- The React Reports workspace Procedure Order Catalog panel now includes a compact compendium import form with vendor format, provider group, CSV payload, and import-count feedback.
- Legacy and modernized workflow adapters can import vendor compendium CSV text, read imported catalog rows back by parent/code/type, and delete temporary catalog subtrees during cleanup.
- Workbench-managed Slice 148 procedure vendor compendium import plan actions are available for both legacy and modernized targets.

Acceptance:

- Both targets can create a temporary catalog group under root group `9000` for lab `504`.
- Both targets can import two PathGroup-style order rows and two result rows into that temporary group.
- Both targets can re-import a changed CSV so one order/result pair is updated/reactivated, one previous order is left inactive, and one new order/result pair is created.
- Legacy OpenEMR renders imported order rows through `types_ajax.php`; the modernized target renders imported order rows in the Reports Procedure Order Catalog panel.
- Both targets delete the temporary catalog subtree and confirm the permanent 21-row gold catalog remains untouched after cleanup.
- The side-by-side Slice 148 parity comparison matches.

Current limitations:

- This slice covers focused order-definition import semantics only. It does not implement uploaded-file storage, asynchronous import jobs, order-entry question imports, OE question option imports, full vendor credential management, external SFTP/filesystem/web-service execution, audit-log export, or production external lab ordering. Clinical order queue readiness is covered by Slice 149, and procedure order transmit readiness is covered by Slice 151.

### Slice 149: Procedure Order Queue Readiness

Status:

- Implemented.

Scope:

- The modernized procedures API now exposes `GET /api/procedures/order-queue` for OpenEMR-style procedure order worklist behavior.
- The queue supports ready-to-send/reportless orders, transmitted-pending orders, reported orders, scheduled orders, completed orders, and all orders, with patient, provider, lab, and order-date filters.
- The modernized Reports workspace now renders a Procedure Order Queue panel with queue counts, segmented queue-state filters, patient/provider/lab/date filters, and order cards showing patient, encounter, lab, provider, report/result/specimen counts, transmit readiness, and instructions.
- Legacy and modernized database probes now normalize order queue facts from legacy `procedure_order` / `procedure_order_code` / `procedure_report` rows and modernized `lab_orders` / `lab_reports` rows.
- Workbench-managed Slice 149 procedure order queue plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary reportless lab order appears in the ready-to-send order queue on both targets with the same patient, provider, lab, procedure, priority, status, report count, and transmit-readiness facts.
- After attaching a report to the temporary order, the order disappears from the ready-to-send queue and appears in the reported queue on both targets.
- Legacy OpenEMR `interface/orders/list_reports.php` renders the order under the corresponding OpenEMR queue filters, and the modernized Reports workspace renders the same order through the Procedure Order Queue panel.
- Cleanup deletes the temporary procedure order/report and encounter, returning patient workflow counts to their pre-test values.
- The side-by-side Slice 149 parity comparison matches.

Current limitations:

- This slice covers clinical order queue visibility and queue-state transition into reported status only. Procedure order transmit readiness is covered by Slice 151 and procedure report bulk sign-off is covered by Slice 153. It does not implement actual HL7 generation, external transmission, filesystem/SFTP/web-service execution, bulk transmit, queue notifications, reviewer assignment, or audit export.

### Slice 151: Procedure Order Transmit Readiness

Status:

- Implemented.

Scope:

- The modernized PostgreSQL `lab_orders` seed schema now includes nullable `date_transmitted` state aligned with legacy OpenEMR `procedure_order.date_transmitted`.
- The modernized procedures API returns real transmitted timestamps in `GET /api/procedures/order-queue` and exposes `POST /api/procedures/orders/{orderId}/transmit` for eligible reportless, not-yet-transmitted orders.
- The modernized Reports workspace Procedure Order Queue panel can mark ready-to-send orders as sent and refresh into the sent-awaiting-results filter.
- Legacy and modernized workflow adapters can mark a temporary procedure order transmitted, while database probes normalize ready-to-send and transmitted-pending queue facts for both targets.
- Workbench-managed Slice 151 procedure order transmit plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary reportless lab order appears in the ready-to-send order queue on both targets with no transmitted timestamp and `canTransmit` true.
- After transmit marking, the order disappears from the ready-to-send queue and appears in the transmitted-pending/sent-awaiting-results queue on both targets with the same transmitted timestamp, patient, lab, procedure, report count, result count, and cleanup behavior.
- Legacy OpenEMR `interface/orders/list_reports.php` renders the transmitted order through option `4` (`Sent, not received`), while the modernized Reports workspace renders the same order through the `Sent, awaiting results` filter.
- Cleanup deletes the temporary procedure order and encounter, returning patient workflow counts to their pre-test values.
- The side-by-side Slice 151 parity comparison matches.

Current limitations:

- This slice proves the OpenEMR-compatible `date_transmitted` state transition only. Procedure report bulk sign-off is covered by Slice 153. It does not generate HL7 payloads, write outbound files, call SFTP/filesystem/web-service transports, model external lab acknowledgements, implement retry/failure queues, queue notifications, reviewer assignment, bulk transmit, or audit export.

### Slice 153: Procedure Report Bulk Sign-Off Readiness

Status:

- Implemented.

Scope:

- The modernized procedures API exposes `PUT /api/procedures/reports/bulk-sign` for signing multiple unreviewed procedure reports in one request while preserving reviewed reports that were already signed.
- The modernized Reports workspace Procedure Report Review Queue panel adds a compact `Sign visible` action for the current unreviewed queue result set and refreshes into reviewed queue state.
- Legacy and modernized workflow adapters can bulk-sign a shared set of temporary procedure reports with normalized reviewer/timestamp facts.
- The shared `workflow-procedure-report-bulk-signoff` suite and `slice-153-procedure-report-bulk-signoff-readiness` plan create two temporary unreviewed lab reports for `MOD-PAT-0009`, sign both in one operation, verify reviewed queue membership, and clean up.
- Workbench-managed Slice 153 procedure report bulk sign-off plan actions are available for both legacy and modernized targets.

Acceptance:

- Two temporary unreviewed lab reports appear in the unreviewed procedure report queue on both targets with matching patient, order, report, specimen, status, and notes facts.
- A single bulk sign operation marks both reports reviewed as `admin` at `2026-06-21 11:25:00`.
- The reports disappear from the unreviewed queue and appear in the reviewed queue on both targets with normalized `2026-06-21 11:25` review time.
- Legacy OpenEMR `interface/orders/list_reports.php` renders the reviewed reports through option `2`, while the modernized Reports workspace renders the same reports through the reviewed queue filter.
- Cleanup deletes both temporary procedure order trees and the temporary encounter, returning patient workflow counts to their pre-test values.
- The side-by-side Slice 153 parity comparison matches.

Current limitations:

- This slice proves focused bulk report sign-off only. Procedure report reopen review is covered by Slice 154. It does not implement reviewer assignment, role-specific review authorization, queue notifications, saved review batches, legal attestation text, external lab reconciliation, amendment history, or audit-log export.

### Slice 154: Procedure Report Reopen Review Readiness

Status:

- Implemented.

Scope:

- The modernized procedures API exposes `PUT /api/procedures/reports/{reportId}/reopen-review` for returning a signed procedure report to received/unreviewed queue state and clearing modernized reviewer metadata.
- The modernized Procedures workspace report card adds a compact `Reopen Review` action for reviewed reports, while the Reports workspace review queue reflects the reopened report in the unreviewed filter.
- Legacy and modernized workflow adapters can reopen the same temporary signed report with normalized received/unreviewed queue facts.
- The shared `workflow-procedure-report-reopen-review` suite and `slice-154-procedure-report-reopen-review-readiness` plan create a temporary signed report for `MOD-PAT-0009`, reopen review, verify queue movement, and clean up.
- Workbench-managed Slice 154 procedure report reopen review plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary final lab report is signed as `admin` at `2026-06-21 12:25:00` and appears in the reviewed queue on both targets.
- Reopening review changes the normalized review status to `received`, removes visible reviewer/timestamp metadata, removes the report from the reviewed queue, and returns it to the unreviewed queue.
- Legacy OpenEMR `interface/orders/list_reports.php` renders the reopened report through option `3`, while the modernized Procedures workspace provides the reopen action and the Reports workspace renders the reopened queue row.
- Cleanup deletes the temporary procedure order tree and encounter, returning patient workflow counts to their pre-test values.
- The side-by-side Slice 154 parity comparison matches.

Current limitations:

- This slice proves focused signed-report reopen behavior only. It does not implement reviewer assignment, role-specific review authorization, queue notifications, saved review batches, legal attestation text, external lab reconciliation, amendment history, or audit-log export.

### Slice 155: Workbench Comparison Report Links

Status:

- Implemented as a Workbench-specific project slice under `modernization-workbench/`.
- This slice did not add a modernized OpenEMR workflow; at the time Slice 154 remained the latest modernized workflow slice.

Scope:

- The Workbench `/api/parity-comparisons` route enriches each comparison side by reading the referenced run summary and exposing only existing report paths that resolve under approved artifact roots.
- Comparison drill-ins now show direct links for the run JSON, Playwright JSON, JUnit XML, and HTML report files when those files are present.
- The links reuse `/api/artifacts/file`, preserving the existing read-only artifact boundary across `parity-tests/artifacts/`, `legacy-openemr/artifacts/`, `modernized-openemr/artifacts/`, and `modernization-workbench/artifacts/`.
- The functionality progress ledger records comparison report links as completed Workbench evidence scope.

Acceptance:

- Recent side-by-side comparison cards continue to show matched/different state, run IDs, suite coverage, difference counts, artifact paths, and expandable drill-ins.
- Each drill-in can open the comparison-side run JSON and run-level Playwright JSON, JUnit XML, and HTML reports directly from the Workbench when those files exist.
- Missing optional reports are hidden rather than shown as broken links.
- Non-artifact paths remain rejected by the safe artifact endpoint.

Current limitations:

- This slice improves Workbench evidence navigation only. Screenshot thumbnails are added by Slice 256 and normalized Playwright probe detail views are added by Slice 257; accepted-difference tracking, reliability trends, historical progress charts, and long-term evidence retention remain future scope.

### Slice 256: Workbench Comparison Screenshot Thumbnail Readiness

Status:

- Implemented as a Workbench evidence-inspection slice under `modernization-workbench/`.
- Verification is the Workbench production build, which typechecks the Express API enrichment and React thumbnail rendering.

Scope:

- The Workbench `/api/parity-comparisons` route now enriches each comparison side by reading the referenced run artifact directory and collecting up to eight existing PNG/JPEG/WebP visual artifacts.
- Visual artifacts are classified as test screenshots, HTML report images, or generic images and remain served through the existing `/api/artifacts/file` safe artifact boundary.
- The Test Runs comparison cards now show compact screenshot previews for each comparison side, and expanded drill-ins show larger visual evidence lists with size metadata and open-image links.
- Runs without screenshots render a quiet empty state instead of broken images.
- The functionality progress ledger records screenshot thumbnails as completed Workbench evidence scope.

Acceptance:

- Recent comparison cards continue to show matched/different state, run IDs, suite coverage, differences, direct report links, and artifact paths.
- When a comparison-side run has image artifacts, the card renders stable, fixed-ratio thumbnails that can be opened in a new tab through the safe artifact endpoint.
- When no visual artifacts exist, the UI explicitly reports that no screenshots were recorded.

Current limitations:

- This slice surfaces existing Playwright images only. It does not force every parity test to capture passing-state screenshots, normalize database probe details, track accepted differences, calculate reliability trends, or define long-term evidence-retention policy.

### Slice 257: Workbench Comparison Probe Detail Readiness

Status:

- Implemented as a Workbench evidence-inspection slice under `modernization-workbench/`.
- Verification is the Workbench production build, which typechecks the Express API enrichment and React probe-detail rendering.

Scope:

- The Workbench `/api/parity-comparisons` route now reads each comparison side's Playwright JSON report and normalizes spec-level probe details into title, file/line, status, expected status, project, duration, retry, tags, errors, and attachment count.
- The Test Runs comparison side summaries now show probe counts.
- Expanded comparison drill-ins now render normalized probe lists for each side alongside artifact links and visual evidence thumbnails.
- Runs without a Playwright JSON report or without parsed specs render a quiet empty state instead of broken links or raw JSON.
- The functionality progress ledger records normalized probe details as completed Workbench evidence scope.

Acceptance:

- Recent comparison cards continue to show matched/different state, run IDs, suite coverage, differences, report links, screenshot thumbnails, and artifact paths.
- When a comparison-side run has Playwright JSON, the drill-in exposes human-readable probe titles, statuses, source files, durations, tags, attachment counts, and any recorded errors.
- Missing optional Playwright probe details are hidden behind an explicit empty state rather than shown as malformed raw JSON.

Current limitations:

- This slice normalizes Playwright test/spec details only. It does not yet normalize target database probe payloads, persist accepted differences, calculate reliability trends, or define long-term evidence-retention policy.

### Slice 258: Workbench Accepted-Difference Tracking Readiness

Status:

- Implemented as a Workbench evidence-governance slice under `modernization-workbench/`.
- Verification is the Workbench production build, which typechecks accepted-difference config loading, comparison enrichment, and React rendering.

Scope:

- The Workbench now owns `modernization-workbench/config/accepted-differences.json` as a curated registry for intentional legacy-vs-modernized differences.
- The `/api/parity-comparisons` route applies active accepted-difference entries to recent comparison artifacts without mutating the original comparison JSON.
- Accepted-difference entries can be scoped by selection kind, selection ID, difference path, and message text.
- The Test Runs comparison cards now show accepted and unreviewed difference counts when differences exist.
- Expanded comparison drill-ins show accepted/unreviewed chips, accepted rule IDs, and accepted reasons for each difference.
- The functionality progress ledger records accepted-difference tracking as completed Workbench evidence scope.

Acceptance:

- Recent comparison cards continue to show matched/different state, run IDs, suite coverage, differences, report links, screenshot thumbnails, probe details, and artifact paths.
- When a comparison has differences, the Workbench identifies whether each difference is accepted by the curated registry or still unreviewed.
- With an empty registry, all differences remain unreviewed and matched comparisons show no accepted differences needed.

Current limitations:

- This slice tracks curated accepted differences only. It does not add an in-browser editor for the registry, reliability trend summaries, historical failure-rate analytics, or long-term evidence-retention policy.

### Slice 259: Workbench Reliability Trend Summaries

Status:

- Implemented as a Workbench evidence-analytics slice under `modernization-workbench/`.
- Verification is the Workbench production build plus a runtime probe of `/api/parity-reliability` against stored parity artifacts.

Scope:

- The Workbench API now exposes `/api/parity-reliability`.
- The endpoint scans bounded recent `parity-tests/artifacts/runs/*/run.json` and `parity-tests/artifacts/comparisons/*/comparison.json` artifacts without loading screenshot or Playwright probe payloads.
- The Test Runs page now shows rolling run pass rate, comparison match rate, failed run count, different comparison count, average run duration, unreviewed differences, recent pass/fail strips, and selection-level comparison summaries.
- The functionality progress ledger records reliability trend summaries as completed Workbench evidence scope.

Acceptance:

- Recent comparison cards continue to render the richer drill-ins from `/api/parity-comparisons`.
- The reliability panel remains read-only and derived from stored artifacts rather than inventing a separate test history.
- The reliability endpoint responds quickly enough for the Workbench polling cycle because it uses lightweight summary artifacts.

Current limitations:

- This slice adds rolling summaries, not a full historical reliability chart, saved report definition model, or long-term evidence-retention policy.

### Slice 260: Workbench Probe Attachment Payload Previews

Status:

- Implemented as a Workbench comparison drill-in evidence slice under `modernization-workbench/`.
- Verification is the Workbench production build plus a runtime probe of `/api/parity-comparisons`.

Scope:

- Normalized Playwright probe details now include attachment metadata and capped previews for text-like artifacts.
- Attachment paths are normalized through the existing safe artifact-root policy before they are exposed to the UI.
- Markdown, text, JSON, XML, CSV, and log artifacts can be previewed inline.
- Binary artifacts such as traces remain links/metadata only.
- The comparison route now sorts and slices comparison artifact directories before deep enrichment so the latest comparison cards do not enrich the entire historical artifact set.

Acceptance:

- Existing comparison drill-ins still show visual artifacts, probe metadata, error messages, report links, differences, and accepted-difference status.
- When a probe has safe text-like attachments, the drill-in shows attachment name, content type, size, artifact link, and a capped preview.
- When a probe has only binary attachments, the drill-in avoids inline binary preview and leaves the artifact available through the safe link.

Current limitations:

- This slice renders probe attachment payloads when Playwright artifacts provide them. Slice 261 starts that payload generation in the database contract suite; broader workflow and mutation parity tests still need normalized database query/result payload attachments for richer database-probe evidence.

### Slice 261: Database Probe Payload Attachments

Status:

- Implemented as parity-test evidence infrastructure under `parity-tests/`.
- Verification is the parity typecheck plus legacy and modernized database suite runs.

Scope:

- Added a reusable `attachDatabaseProbeEvidence` helper that writes JSON evidence files into Playwright test output directories and attaches them by path.
- The gold-seed database contract suite now emits expected/actual payload attachments for dataset counts, temporal coverage, stable workflow anchors, and selected anchor related-record counts.
- Legacy MariaDB and modernized PostgreSQL count probes now include `portalMailboxMessages` so the shared generated summary, database adapters, and attachment payloads agree.

Acceptance:

- `npm run test:legacy:database` and `npm run test:modernized:database` pass against freshly reseeded targets.
- The Playwright JSON report records `db-probe-*` attachments with file paths, allowing the Workbench Slice 260 preview path to render their JSON payloads.
- The generated count contract continues to validate `portalMailboxMessages` instead of silently omitting the table from actual counts.

Current limitations:

- This slice covers the database gold-seed contract suite only. Workflow and mutation suites still need richer pre/post database probe payload attachments.

### Slice 262: Slice 1 Workflow Probe Payload Attachments

Status:

- Implemented as parity-test evidence infrastructure under `parity-tests/`.
- Verification is the parity typecheck, legacy and modernized Slice 1 readiness plans, and the side-by-side Slice 1 comparison.

Scope:

- Extended the Slice 1 patient search/chart summary suite with path-backed JSON database probe attachments.
- The anchor patient database facts test now attaches expected and actual demographics plus workflow activity counts for `MOD-PAT-0001`.
- The chart UI test now attaches the database patient lookup used as the UI steering precondition before opening the legacy or modernized chart surface.

Acceptance:

- Both legacy and modernized `slice-1-readiness` plan runs pass with 7 expected tests.
- Both Playwright JSON reports record `db-probe-slice-1-*` attachments with file paths, allowing Workbench probe attachment previews to show the workflow payloads.
- The side-by-side `slice-1-readiness` comparison remains matched with no differences.

Current limitations:

- This slice covers the first read-only workflow suite only. Additional read-only and mutation suites still need normalized pre/post database payload attachments.

### Slice 263: Slice 2 Scheduling Probe Payload Attachments

Status:

- Implemented as parity-test evidence infrastructure under `parity-tests/`.
- Verification is the parity typecheck, legacy and modernized Slice 2 scheduling readiness plans, and the side-by-side Slice 2 comparison.

Scope:

- Extended the Slice 2 scheduling suite with path-backed JSON database probe attachments.
- The future appointment database fact test now attaches the scheduling anchor patient plus selected future appointment facts after `2026-06-18`.
- The scheduling UI test now attaches the database patient and appointment lookup used before steering the legacy or modernized scheduling surface.

Acceptance:

- Both legacy and modernized `slice-2-scheduling-readiness` plan runs pass with 2 expected tests.
- Both Playwright JSON reports record `db-probe-slice-2-*` attachments with file paths, allowing Workbench probe attachment previews to show the scheduling payloads.
- The side-by-side `slice-2-scheduling-readiness` comparison remains matched with no differences.

Current limitations:

- This slice covers the second read-only workflow suite only. Additional read-only and mutation suites still need normalized pre/post database payload attachments.

### Slice 156: Patient Message Reply Readiness

Status:

- Implemented as a mutation-capable modernized patient-message slice under `modernized-openemr/`.
- Verification is the shared `slice-156-message-reply-readiness` plan, which validates pnotes/message reply appending, unchanged message counts, browser-visible legacy pnotes rendering, and modernized Messages `Reply` behavior on both legacy and modernized targets.

Scope:

- The slice reuses the existing seeded `MOD-PAT-0004` portal-messaging anchor and temporary pnotes-compatible message rows; it does not add permanent gold-data records.
- Legacy behavior is represented by appending a timestamped `admin to {assignee}` reply line to the OpenEMR `pnotes.body` field for a temporary active patient message.
- ASP.NET Core message behavior now exposes `PUT /api/messages/{messageId}/reply` to append a reply line and preserve active message state.
- React Messages workspace now provides an inline reply text area and `Reply` action on each message card.
- Modernized smoke coverage validates patient-message creation, content update, reply update, assignment update, close, archive, and hard-delete cleanup.
- The `workflow-message-reply` parity suite and `slice-156-message-reply-readiness` plan verify normalized legacy and modernized database state, count stability, legacy pnotes rendering, modernized UI reply submission, cleanup, and side-by-side result matching.
- Workbench-managed Slice 156 message reply plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary patient message can be created for `MOD-PAT-0004`, replied to with appended body text, and kept at the same active message count.
- The replied message remains active with `New` status, the expected assignee, and `deleted = 0`.
- Legacy OpenEMR renders the replied temporary message through the patient notes surface.
- The modernized Messages workspace renders the reply text area and can append the reply through the visible control.
- The temporary message can still be archived and hard-deleted so the seeded 1,200-message baseline remains unchanged.
- The side-by-side Slice 156 parity comparison matches.

Current limitations:

- This slice proves focused same-message reply body appending only. It does not implement full portal thread objects, separate inbound/outbound message records, patient-authored portal replies, attachments, read receipts, notification delivery, routing queues, or audit history.

### Slice 157: Patient Message Portal Metadata Readiness

Status:

- Implemented as a read-only modernized patient-message metadata slice under `modernized-openemr/`.
- Verification is the shared `slice-157-message-portal-metadata-readiness` plan, which validates legacy `pnotes.portal_relation` and `pnotes.is_msg_encrypted` facts against modernized PostgreSQL message metadata and modernized Messages card rendering.

Scope:

- The shared gold dataset now assigns patient messages to `admin`, sets deterministic `portal:{canonicalId}` relations on seeded `Portal message` rows, and keeps `isEncrypted` false because seeded bodies remain plaintext.
- The legacy seed maps those facts to `pnotes.assigned_to`, `pnotes.portal_relation`, and `pnotes.is_msg_encrypted`; the modernized seed maps the same facts to `messages.assigned_to`, `messages.portal_relation`, and `messages.is_encrypted`.
- ASP.NET Core patient-message responses now expose `portalRelation` and `isEncrypted`.
- React Messages cards now render compact portal-relation and plaintext/encrypted metadata chips.
- The `message-portal-metadata` parity suite and `slice-157-message-portal-metadata-readiness` plan verify seeded database facts on both targets and modernized UI metadata rendering for `MOD-PAT-0004`.
- Workbench-managed Slice 157 message portal metadata plan actions are available for both legacy and modernized targets.

Acceptance:

- The seeded `MOD-PAT-0004` `Portal message` has portal relation `portal:MOD-PAT-0004` and `isEncrypted = false` on both targets.
- The seeded `Care team follow-up` message has no portal relation and `isEncrypted = false`.
- The modernized Messages workspace renders `Portal relation portal:MOD-PAT-0004` and `Plain text message`.
- The side-by-side Slice 157 parity comparison matches.

Current limitations:

- This slice preserves and renders portal metadata only. It does not implement encrypted body storage, full portal thread objects, patient-authored portal replies, attachments, notification delivery, routing queues, read receipts, or audit history.

### Slice 158: Patient Message Update Metadata Readiness

Status:

- Implemented as a mutation-capable modernized patient-message metadata slice under `modernized-openemr/`.
- Verification is the shared `slice-158-message-update-metadata-readiness` plan, which validates legacy `pnotes.update_by` / `pnotes.update_date` behavior against modernized PostgreSQL message metadata, API responses, and modernized Messages card rendering.

Scope:

- The modernized `messages` table now carries `updated_by` and `updated_at` fields equivalent to legacy `pnotes.update_by` and `pnotes.update_date`.
- Patient-message create keeps update metadata blank, matching legacy pnotes insert behavior for newly created temporary messages.
- Patient-message status, title/body, assignment, reply, and archive mutations now stamp `updated_by = 1` and `updated_at = now()` on the modernized side, matching the legacy workflow helper's OpenEMR-compatible pnotes update behavior.
- ASP.NET Core patient-message responses now expose `updatedBy` and `updatedAt`.
- React Messages cards now render the update user and timestamp after an edit while leaving untouched seeded messages visually unchanged.
- The `workflow-message-update-metadata` parity suite and `slice-158-message-update-metadata-readiness` plan verify temporary message create/edit/update-metadata behavior on both targets, modernized UI rendering, cleanup, and side-by-side result matching.
- Workbench-managed Slice 158 message update metadata plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary patient message can be created for `MOD-PAT-0004` with blank update metadata on both targets.
- Editing the title/body stamps `updatedBy = 1` and a normalized timestamp on both targets without changing active message counts.
- Legacy OpenEMR renders the edited temporary message through the patient notes surface.
- The modernized Messages workspace can perform the edit through the visible `Save Edit` control and renders `Updated by user 1`.
- The temporary message can still be archived and hard-deleted so the seeded 1,200-message baseline remains unchanged.
- The side-by-side Slice 158 parity comparison matches.

Current limitations:

- This slice preserves the latest-update metadata only. It does not implement full historical audit rows, portal thread objects, encrypted body storage, patient-authored portal replies, attachments, notification delivery, routing queues, or read receipts.

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
- Order catalogs are covered by Slices 145, 147, and 148; clinical order queue readiness is covered by Slice 149, and procedure order transmit readiness is covered by Slice 151. Specimen tracking depth, provider sign-off depth, result amendment, external lab interfaces, and broader lab workflow state machines remain deferred to later lab/procedure workflow slices.

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
- Focused PDF-style binary upload/download lifecycle behavior is covered by Slice 33. Binary scan streaming, external object storage, thumbnails, signing, version history, encryption/key management, and broader patient-portal document access rules beyond active owned list/download remain deferred.

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
- Scanned-document capture, multi-file uploads, thumbnails, signing, versioning, encryption/key management, CCDA import/export, broader patient-portal document access rules beyond active owned list/download, and external document-storage adapters remain deferred. Focused patient binary document content replacement is covered by Slice 128.

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
- Patient duplicate detection is covered by Slice 191, registration validation is covered by Slice 192, deceased-status date/reason administration is covered by Slice 193, mother/guardian contact administration is covered by Slice 194, guardian demographic/address administration is covered by Slice 195, patient social-detail administration is covered by Slice 196, employer identity/address administration is covered by Slice 197, primary-provider assignment administration is covered by Slice 198, care-team lead-member administration is covered by Slice 199, multi-member care-team administration is covered by Slice 200, contact-backed related-person care-team roles are covered by Slice 201, patient history/lifestyle is covered by Slice 202, insurance subscriber detail is covered by Slice 203, patient portal account readiness is covered by Slice 204, patient portal one-time reset readiness is covered by Slice 205, patient portal access readiness is covered by Slice 206, patient portal authentication readiness is covered by Slice 207, patient portal session logout readiness is covered by Slice 208, patient portal home readiness is covered by Slice 209, patient portal secure-message inbox readiness is covered by Slice 210, patient portal secure-message compose/sent readiness is covered by Slice 211, patient portal secure-message reply readiness is covered by Slice 212, patient portal secure-message thread view readiness is covered by Slice 213, patient portal secure-message archive readiness is covered by Slice 214, patient portal secure-message read-status readiness is covered by Slice 215, patient portal secure-message batch-archive readiness is covered by Slice 216, patient portal secure-message All-folder readiness is covered by Slice 217, patient portal document list/download readiness is covered by Slice 218, patient portal appointment list readiness is covered by Slice 219, and patient portal appointment request readiness is covered by Slice 220. Patient merge, broader guarantor workflows, validation catalogs, broader portal password rotation/MFA, attachments, broader portal appointment workflow depth, broader portal report downloads, lifecycle audit history, and broader administration policy enforcement remain deferred.

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
- Patient duplicate detection is covered by Slice 191, OpenEMR-style registration validation readiness is covered by Slice 192, deceased-status date/reason administration is covered by Slice 193, mother/guardian contact administration is covered by Slice 194, guardian demographic/address administration is covered by Slice 195, patient social-detail administration is covered by Slice 196, employer identity/address administration is covered by Slice 197, primary-provider assignment is covered by Slice 198, care-team lead-member administration is covered by Slice 199, multi-member care-team administration is covered by Slice 200, contact-backed related-person care-team roles are covered by Slice 201, patient history/lifestyle read models are covered by Slice 202, patient insurance subscriber capture is covered by Slice 203, patient portal account readiness is covered by Slice 204, patient portal one-time reset readiness is covered by Slice 205, patient portal access readiness is covered by Slice 206, patient portal authentication readiness is covered by Slice 207, patient portal session logout readiness is covered by Slice 208, patient portal home readiness is covered by Slice 209, patient portal secure-message inbox readiness is covered by Slice 210, patient portal secure-message compose/sent readiness is covered by Slice 211, patient portal secure-message reply readiness is covered by Slice 212, patient portal secure-message thread view readiness is covered by Slice 213, patient portal secure-message archive readiness is covered by Slice 214, patient portal secure-message read-status readiness is covered by Slice 215, patient portal secure-message batch-archive readiness is covered by Slice 216, patient portal secure-message All-folder readiness is covered by Slice 217, patient portal document list/download readiness is covered by Slice 218, patient portal appointment list readiness is covered by Slice 219, and patient portal appointment request readiness is covered by Slice 220. Patient merge, broader guarantor insurance-party workflows, broader portal password rotation/MFA, attachments, broader portal appointment workflow depth, broader portal report downloads, address validation, lifecycle audit history, and broader administration policy enforcement remain deferred.

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
- External object storage adapters, scanned-document capture, multi-file uploads, thumbnails, document versioning, encryption/key management, CCDA import/export, broader patient-portal document access rules beyond active owned list/download, and authorization enforcement remain deferred.

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
- Multi-reviewer routing, document versioning, thumbnails, scanned-document capture, encryption/key management, CCDA import/export, external storage adapters, broader patient-portal document access rules beyond active owned list/download, and authorization enforcement remain deferred.

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
- Full version history, multi-file uploads, scanned-document capture, thumbnails, encryption/key management, CCDA import/export, external storage adapters, broader patient-portal document access rules beyond active owned list/download, and authorization enforcement remain deferred. Focused active text content replacement is covered by Slice 43.

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
- Bulk restore, role-based document trash permissions, retention-policy enforcement, content version rollback, scanned-document capture, thumbnails, encryption/key management, CCDA import/export, external storage adapters, broader patient-portal document access rules beyond active owned list/download, and authorization enforcement remain deferred.

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

- This slice covers focused active text payload replacement only. Focused active binary patient document replacement is covered by Slice 128.

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
- Claim generation, payer adjudication, remittance import, payment posting mutation, charge correction history, statement delivery, and revenue-cycle audit history remain future billing slices. Deterministic printable statement generation is covered by Slice 59.

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
- Modifier validation catalogs, modifier compatibility rules, claim generation, payer adjudication, remittance import, payment posting mutation, statement delivery, and revenue-cycle audit history remain future billing slices. Deterministic printable statement generation is covered by Slice 59.

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
- Legacy billing-report UI steering, claim generation, payer adjudication, remittance import, payment posting mutation, statement delivery, and revenue-cycle audit history remain future billing slices. Deterministic printable statement generation is covered by Slice 59.

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
- Full ERA/EOB import, payer adjudication, statement delivery, payment reversal/refund workflows, and revenue-cycle audit history remain future billing slices. Focused manual payment posting create/void/delete behavior is covered by Slice 56, focused patient payment capture is covered by Slice 58, and printable patient statement generation is covered by Slice 59.

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
- Statement delivery, collection workflows, payment mutation/reversal behavior, claim adjudication, payer remittance import, and revenue-cycle audit history remain future billing slices. Deterministic printable statement generation is covered by Slice 59.

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
- Statement delivery, collection work queues, dunning rules, write-off workflows, payment mutation/reversal behavior, payer remittance import, and revenue-cycle audit history remain future billing slices. Deterministic printable statement generation is covered by Slice 59.

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
- Statement delivery, collection work queues, payment mutation/reversal behavior, payer remittance import, write-off workflows, and revenue-cycle audit history remain future billing slices. Printable patient statement generation is covered by Slice 59.

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
- Statement archival, delivery workflows, richer export workflows, collection work queues, payment mutation/reversal behavior, payer remittance import, write-off workflows, and revenue-cycle audit history remain future billing slices. Deterministic printable statement generation is covered by Slice 59, deterministic statement PDF export is covered by Slice 60, and statement batch candidate readiness is covered by Slice 61.

### Slice 53: Document Preview Readiness

Status:

- Implemented as a read-only modernized patient-document slice under `modernized-openemr/`.
- Verification is the shared `slice-53-document-preview-readiness` plan, which validates preview kind, inline-readiness, thumbnail labels, thumbnail text, and modernized document-card preview rendering for the stable document anchor on both legacy and modernized targets.

Scope:

- The slice reuses existing `MOD-PAT-0001` patient-document metadata and stored text payload facts; it does not add new gold-data records.
- ASP.NET Core document read behavior now returns preview-readiness fields for every document row: preview kind, preview status, thumbnail label, thumbnail text, inline preview availability, and download availability.
- React Documents workspace now shows a compact thumbnail/readiness row for each document card while preserving the existing list, viewer, download, metadata, archive, review, external-link, and content-replacement behavior.
- Modernized smoke coverage validates the `MOD-PAT-0001` seeded document preview readiness facts.
- The `document-preview` parity suite and `slice-53-document-preview-readiness` plan verify normalized legacy MariaDB and modernized PostgreSQL preview-readiness rows, plus browser-visible modernized Documents rendering.
- Workbench-managed Slice 53 document preview plan actions are available for both legacy and modernized targets.

Acceptance:

- Direct probes compute `Primary care intake packet` and `Advance directive acknowledgement` as `text` preview kind with `Inline text preview` status, `TXT` thumbnail labels, inline preview enabled, and download enabled.
- Direct probes compute thumbnail text containing `Gold synthetic document DOC-MOD-PAT-0001-1` and `Gold synthetic document DOC-MOD-PAT-0001-2`.
- The modernized document API and Documents workspace render those same preview-readiness facts without changing seeded document rows.
- The side-by-side Slice 53 parity comparison matches.

Current limitations:

- This slice is read-only and derives preview readiness from existing metadata/content rather than generating image thumbnails.
- Scanned attachment ingestion, rendered PDF/image thumbnails, multi-version history, OCR, external storage adapters, and document exchange integrations remain future document slices.

### Slice 54: Document Revision Readiness

Status:

- Implemented as a read-only modernized patient-document slice under `modernized-openemr/`.
- Verification is the shared `slice-54-document-revision-readiness` plan, which validates current revision timestamp, current version label, version-history count, revision hash, and modernized document-card/viewer rendering for the stable document anchor on both legacy and modernized targets.

Scope:

- The slice reuses existing `MOD-PAT-0001` patient-document metadata, `documents.revision` facts in legacy MariaDB, and current uploaded/revision timestamps in the modernized PostgreSQL document rows; it does not add new gold-data records.
- ASP.NET Core document read behavior now returns current revision-readiness fields for every document row: revision timestamp, current version number, version label, version status, history count, prior-version flag, and revision hash.
- React Documents workspace now shows current revision-readiness facts on each document card and in the document viewer while preserving the existing list, preview, download, metadata, archive, review, external-link, and content-replacement behavior.
- Modernized smoke coverage validates the `MOD-PAT-0001` seeded document revision readiness facts.
- The `document-revision` parity suite and `slice-54-document-revision-readiness` plan verify normalized legacy MariaDB and modernized PostgreSQL revision-readiness rows, plus browser-visible modernized Documents rendering.
- Workbench-managed Slice 54 document revision plan actions are available for both legacy and modernized targets.

Acceptance:

- Direct probes compute `Primary care intake packet` and `Advance directive acknowledgement` as `Version 1`, `Current version`, one current history entry, no prior versions, and revision hashes matching the stored document hash.
- Direct probes compute current revision timestamps of `2026-06-10 14:30:00` and `2026-06-12 15:00:00` for the two anchor documents.
- The modernized document API and Documents workspace render those same revision-readiness facts without changing seeded document rows.
- The side-by-side Slice 54 parity comparison matches.

Current limitations:

- This slice is read-only and models the current legacy document revision row rather than implementing full document version history.
- Prior-version browsing, rollback, diffing, retention-policy enforcement, rendered thumbnails, scanner-device ingestion, OCR extraction/queueing, external storage adapters, and document exchange integrations remain future document slices.

### Slice 55: Document Replacement Revision Readiness

Status:

- Implemented as a mutation-capable modernized patient-document slice under `modernized-openemr/`.
- Verification is the shared `slice-55-document-revision-replace-readiness` plan, which validates that content replacement updates the current document revision timestamp and hash in place on both legacy and modernized targets.

Scope:

- The slice reuses the existing temporary text document replacement workflow from Slice 43 and the current revision-readiness fields from Slice 54; it does not add new gold-data records.
- Legacy behavior updates the current `documents` row by replacing `document_data`, `size`, `hash`, and `revision` without exposing a prior-version row.
- ASP.NET Core document replacement behavior already updates `patient_documents.content`, `size_bytes`, `hash`, and `uploaded_at`; the revision-readiness DTO fields now make that observable after replacement.
- React Documents workspace keeps rendering the current version label and no-prior-version state after replacement while showing the replacement payload.
- Modernized smoke coverage validates the temporary document replacement revision lifecycle.
- The `workflow-document-revision-replace` parity suite and `slice-55-document-revision-replace-readiness` plan verify normalized legacy MariaDB and modernized PostgreSQL replacement revision behavior plus browser-visible modernized Documents rendering.
- Workbench-managed Slice 55 document replacement revision plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary `Medical Record` text document can be created for `MOD-PAT-0001`, then have its content replaced.
- Direct probes show the replacement payload is current, the original payload is no longer current, the content hash changes, and the revision hash matches the current stored hash.
- Direct probes show the current revision timestamp moves forward after replacement while the visible version contract remains `Version 1`, `Current version`, one current history entry, and no prior versions.
- The modernized Documents workspace renders the replacement payload and the same current-version facts.
- The side-by-side Slice 55 parity comparison matches.

Current limitations:

- This slice preserves the legacy in-place current-revision behavior rather than adding true prior-version storage. Slice 128 applies the same current-revision readiness contract to patient-scoped binary document replacement.
- Prior-version browsing, rollback, diffing, retention-policy enforcement, rendered thumbnails, scanner-device ingestion, OCR extraction/queueing, external storage adapters, and document exchange integrations remain future document slices.

### Slice 56: Payment Posting Mutation Readiness

Status:

- Implemented as a mutation-capable modernized billing/revenue-cycle slice under `modernized-openemr/`.
- Verification is the shared `slice-56-payment-posting-mutation-readiness` plan, which validates payment posting create, browser-visible rendering, void, active-row hiding, balance/ledger recalculation, and hard-delete cleanup on both legacy and modernized targets.

Scope:

- The slice uses the existing `MOD-PAT-0005` billing/payment anchor and encounter `1000052`; it does not add permanent gold-data records.
- Legacy behavior creates one temporary OpenEMR AR session/activity posting, verifies it affects active payment, balance, and ledger views, voids it through `ar_activity.deleted`, and hard-deletes the temporary session/activity cleanup rows.
- ASP.NET Core billing behavior now exposes payment posting create, void, and delete endpoints over the modernized `payment_sessions` and `payment_activities` tables.
- React Fees workspace now includes a Payment Posting form plus row-level Void and Delete controls for active payment postings.
- Modernized smoke coverage validates the temporary payment posting lifecycle, including visible payment summary changes and balance rollback after void.
- The `workflow-payment-posting` parity suite and `slice-56-payment-posting-mutation-readiness` plan verify normalized legacy MariaDB and modernized PostgreSQL mutation behavior plus browser-visible modernized Fees rendering.
- Workbench-managed Slice 56 payment posting mutation plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary insurance payment posting can be created for `MOD-PAT-0005` encounter `1000052` with payer `Northstar HMO`, reference `EOB-PARITY-*`, payment `$21.00`, adjustment `$3.50`, and reason `CO-45`.
- Direct probes show one new payment session and one new payment activity after create, active payment rows include the posting, account balance decreases by the payment plus adjustment, and the account ledger gains corresponding payment/adjustment entries.
- Direct probes show voiding the posting marks it deleted, removes it from active payment/balance calculations, and restores the active account balance while preserving the session for audit-like history.
- Hard-delete cleanup removes the temporary activity/session rows so seeded payment counts return to baseline.
- The modernized Fees workspace renders the temporary posting while active and hides it after void.
- The side-by-side Slice 56 parity comparison matches.

Current limitations:

- This slice implements manual payment posting lifecycle behavior only.
- ERA/EOB import, payer remittance reconciliation, refunds, audit history, batch posting, claim adjudication state transitions, and statement delivery workflows remain future revenue-cycle slices. Focused patient payment capture is covered by Slice 58, and printable patient statement generation is covered by Slice 59.

### Slice 57: Claim Status Mutation Readiness

Status:

- Implemented as a mutation-capable modernized billing/revenue-cycle slice under `modernized-openemr/`.
- Verification is the shared `slice-57-claim-status-mutation-readiness` plan, which validates temporary claim create, generated-file state, cleared state, browser-visible rendering, and hard-delete cleanup on both legacy and modernized targets.

Scope:

- The slice uses the existing `MOD-PAT-0005` billing anchor and encounter `1000052`; it does not add permanent gold-data records.
- Legacy behavior creates one temporary OpenEMR `claims` row, moves it from queued to generated and cleared status, verifies the composite claim key, and hard-deletes the temporary row during cleanup.
- ASP.NET Core billing behavior now exposes claim-status create, update, and delete endpoints over the modernized `claims` table.
- React Fees workspace now includes a Claim Status form plus row-level Generate, Clear, and Delete controls for claim rows.
- Modernized smoke coverage validates the temporary claim status lifecycle, including queued, generated, cleared, and cleanup states.
- The `workflow-claims` parity suite and `slice-57-claim-status-mutation-readiness` plan verify normalized legacy MariaDB and modernized PostgreSQL mutation behavior plus browser-visible modernized Fees rendering.
- Workbench-managed Slice 57 claim status mutation plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary primary-payer claim can be created for `MOD-PAT-0005` encounter `1000052` with payer `Northstar HMO`, target `HCFA`, queued status, and a new version number.
- Direct probes show one new claim row after create, generated state stores an X12 target and `837P` process file, and cleared state removes the process file while preserving the claim version.
- Hard-delete cleanup removes the temporary claim row so seeded claim counts return to baseline.
- The modernized Fees workspace renders the temporary queued, generated, and cleared states with payer, target, version, and claim-file details.
- The side-by-side Slice 57 parity comparison matches.

Current limitations:

- This slice implements focused manual claim-status lifecycle behavior only.
- Full claim generation, payer adjudication, ERA import, rejection handling, statement integration, and revenue-cycle audit history remain future billing slices.

### Slice 58: Patient Payment Capture Readiness

Status:

- Implemented as a mutation-capable modernized billing/revenue-cycle slice under `modernized-openemr/`.
- Verification is the shared `slice-58-patient-payment-capture-readiness` plan, which validates patient payment capture, browser-visible rendering, voiding, active-row hiding, balance/ledger recalculation, and hard-delete cleanup on both legacy and modernized targets.

Scope:

- The slice uses the existing `MOD-PAT-0005` billing/payment anchor and encounter `1000052`; it does not add permanent gold-data records.
- Legacy behavior creates one temporary OpenEMR patient payment AR session/activity posting with `payer_id = 0` and `payer_type = 0`, verifies it affects active payment, balance, and ledger views, voids it through `ar_activity.deleted`, and hard-deletes the temporary session/activity cleanup rows.
- ASP.NET Core billing behavior now accepts patient-responsibility payment postings through the existing payment create/void/delete endpoints.
- React Fees workspace now lets operators choose Insurance or Patient payment source and renders patient-responsibility postings as `Patient`.
- Modernized smoke coverage validates the temporary patient payment lifecycle, including visible payment summary changes and balance rollback after void.
- The `workflow-patient-payments` parity suite and `slice-58-patient-payment-capture-readiness` plan verify normalized legacy MariaDB and modernized PostgreSQL mutation behavior plus browser-visible modernized Fees rendering.
- Workbench-managed Slice 58 patient payment capture plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary patient-responsibility payment can be captured for `MOD-PAT-0005` encounter `1000052` with receipt reference `RCPT-PARITY-*`, payment `$35.00`, payment method `credit_card`, and no insurance adjustment or payer claim number.
- Direct probes show one new payment session and one new active payment activity after create, active payment rows include `payer_type = 0`, account balance decreases by the payment amount, and the account ledger gains one payment entry.
- Direct probes show voiding the payment marks it deleted, removes it from active payment/balance calculations, and restores the active account balance while preserving the session for audit-like history.
- Hard-delete cleanup removes the temporary activity/session rows so seeded payment counts return to baseline.
- The modernized Fees workspace renders the temporary patient payment while active and hides it after void.
- The side-by-side Slice 58 parity comparison matches.

Current limitations:

- This slice implements focused patient payment capture only.
- Refunds, payment reversal workflows beyond voiding, receipt printing, online card processing integration, statement delivery, collections, and revenue-cycle audit history remain future billing slices. Printable patient statement generation is covered by Slice 59, deterministic statement PDF export is covered by Slice 60, and statement batch candidate readiness is covered by Slice 61.

### Slice 59: Statement Generation Readiness

Status:

- Implemented as a read-only modernized billing/revenue-cycle slice under `modernized-openemr/`.
- Verification is the shared `slice-59-statement-generation-readiness` plan, which validates deterministic printable statement generation, browser-visible rendering, and parity against the legacy-derived billing ledger on both legacy and modernized targets.

Scope:

- The slice reuses the existing `MOD-PAT-0005` billing/payment/account-statement anchor; it does not add permanent gold-data records.
- Legacy behavior is represented by the normalized parity probe that derives a printable statement document from OpenEMR patient demographics, account statement readiness facts, and chronological ledger rows.
- ASP.NET Core billing read behavior now returns a `statementDocument` with statement number, title, status, period, statement date, due date, recipient/address, payment instructions, generated text, totals, and normalized statement line items.
- React Fees workspace now shows a Patient Statement panel with statement number, recipient, due date, balance due, payment instructions, generated text, and line-item rows for charges, payments, adjustments, and running balance.
- Modernized smoke coverage validates the `MOD-PAT-0005` statement document.
- The `account-statement-generation` parity suite and `slice-59-statement-generation-readiness` plan verify normalized legacy MariaDB and modernized PostgreSQL/API/UI statement generation behavior.
- Workbench-managed Slice 59 statement generation plan actions are available for both legacy and modernized targets.

Acceptance:

- The generated statement number for `MOD-PAT-0005` is `STMT-MOD-PAT-0005-20260625`.
- Direct probes and API responses produce payment instructions `Please pay $364.75 by 2026-07-25.`, balance due `$364.75`, 10 statement line items, charges `$635.00`, payments `$206.00`, and adjustments `$64.25`.
- The first statement line is the `2025-06-22` routine venipuncture charge for encounter `1000051`, and the final line is the `2026-06-25` contractual adjustment for encounter `1000053` with balance `$364.75`.
- The modernized Fees workspace renders the statement number, payment instructions, generated text, and EOB-backed line-item references.
- The side-by-side Slice 59 parity comparison matches.

Current limitations:

- This slice generates a deterministic printable statement document only.
- Deterministic statement PDF export is covered by Slice 60.
- Statement batch candidate readiness is covered by Slice 61.
- Statement batch package export readiness is covered by Slice 62.
- Actual batch execution, statement delivery, portal delivery, collections work queues, and revenue-cycle audit history remain future billing slices.

### Slice 60: Statement PDF Export Readiness

Status:

- Implemented as a read-only modernized billing/revenue-cycle slice under `modernized-openemr/`.
- Verification is the shared `slice-60-statement-pdf-export-readiness` plan, which validates deterministic patient statement PDF export, browser-visible download affordance, and parity against the legacy-derived billing ledger on both legacy and modernized targets.

Scope:

- The slice reuses the existing `MOD-PAT-0005` billing/payment/account-statement anchor and the Slice 59 generated statement document; it does not add permanent gold-data records.
- Legacy behavior is represented by the normalized parity probe that derives the same statement number, payment instructions, totals, and line-item facts from OpenEMR patient demographics, account statement readiness facts, and chronological ledger rows.
- ASP.NET Core billing read behavior now exposes `GET /api/billing/{patientId}/statement.pdf`, returning a deterministic `application/pdf` download named with the generated statement number.
- React Fees workspace now shows a `PDF Export` action in the Patient Statement panel.
- Modernized smoke coverage validates the `MOD-PAT-0005` PDF endpoint, response headers, PDF header, payment instructions, EOB-backed payment line, and statement number.
- The `account-statement-pdf` parity suite and `slice-60-statement-pdf-export-readiness` plan verify normalized legacy MariaDB and modernized PostgreSQL/API/UI statement PDF export behavior.
- Workbench-managed Slice 60 statement PDF export plan actions are available for both legacy and modernized targets.

Acceptance:

- The exported file for `MOD-PAT-0005` is named `STMT-MOD-PAT-0005-20260625.pdf`.
- The modernized endpoint returns `application/pdf` content beginning with `%PDF-1.4`.
- The PDF source includes `Patient Statement STMT-MOD-PAT-0005-20260625`, payment instructions `Please pay $364.75 by 2026-07-25.`, balance due `$364.75`, `Northstar HMO insurance payment`, and `EOB-NSTAR-1000052`.
- The modernized Fees workspace renders a visible `PDF Export` link with the expected statement PDF URL and download filename.
- The side-by-side Slice 60 parity comparison matches.

Current limitations:

- This slice exports a deterministic one-patient statement PDF from the current generated statement document only.
- Statement batch candidate readiness is covered by Slice 61.
- Statement batch package export readiness is covered by Slice 62.
- Actual batch execution, richer PDF layout/branding, statement delivery, portal delivery, collections work queues, and revenue-cycle audit history remain future billing slices.

### Slice 61: Statement Batch Candidate Readiness

Status:

- Implemented as a read-only modernized billing/revenue-cycle slice under `modernized-openemr/`.
- Verification is the shared `slice-61-statement-batch-readiness` plan, which validates ranked statement batch candidates, aggregate candidate totals, modernized API behavior, and Fees workspace rendering on both legacy and modernized targets.

Scope:

- The slice reuses the existing seeded billing and AR payment population; it does not add permanent gold-data records.
- Legacy behavior is represented by normalized MariaDB probes that derive positive-balance statement candidates from OpenEMR billing and AR activity rows.
- ASP.NET Core billing read behavior now exposes `GET /api/billing/statements/batch?limit=5`, returning dataset metadata, as-of date, all-candidate count, all-candidate balance totals, and top ranked statement candidates.
- Ranking is deterministic: past-due amount descending, balance due descending, oldest open age descending, then legacy PID ascending.
- React Fees workspace now shows a compact Statement Batch work queue with totals, top candidate rows, delivery method metadata, and an `Open` action that loads the selected candidate into the existing Fees detail workflow.
- Modernized smoke coverage validates the statement batch endpoint shape, candidate count, aggregate totals, first-candidate statement number/status/balance, open encounter count, and delivery method.
- The `account-statement-batch` parity suite and `slice-61-statement-batch-readiness` plan verify normalized legacy MariaDB and modernized PostgreSQL/API/UI statement batch behavior.
- Workbench-managed Slice 61 statement batch plan actions are available for both legacy and modernized targets.

Acceptance:

- The endpoint returns the gold dataset as-of date `2026-06-18`, more than five ready candidates, five top candidates for `limit=5`, and positive total balance, past-due, and current-due amounts.
- Each top candidate includes patient ID, display name, statement number, statement status, statement date, due date, balance, current/past due, open encounter count, ledger entry count, oldest open age/date, and delivery method.
- The modernized API response normalizes to the same candidate queue derived directly from the modernized PostgreSQL tables.
- The modernized Fees workspace renders the Statement Batch panel and lets the operator open a candidate into the patient fee-sheet detail.
- The side-by-side Slice 61 parity comparison matches.

Current limitations:

- This slice identifies candidates for a future statement run; it does not execute a batch, persist a batch record, export a package, deliver statements, archive statements, or create collection follow-up tasks.
- Statement batch package export readiness is covered by Slice 62. Collections work queue readiness is covered by Slice 63. Collections follow-up task lifecycle is covered by Slice 64. Rich statement batch layout, delivery, portal messaging, recurring collection programs, and revenue-cycle audit history remain future billing slices.

### Slice 62: Statement Batch Package Export Readiness

Status:

- Implemented as a read-only modernized billing/revenue-cycle slice under `modernized-openemr/`.
- Verification is the shared `slice-62-statement-batch-package-readiness` plan, which validates the deterministic statement package manifest, summary CSV, included PDFs, modernized API behavior, and Fees workspace export link on both legacy and modernized targets.

Scope:

- The slice reuses the existing seeded billing and AR payment population plus the Slice 61 ranked candidate queue; it does not add permanent gold-data records.
- Legacy behavior is represented by normalized MariaDB probes that derive the same top statement candidates and expected package manifest from OpenEMR billing and AR activity rows.
- ASP.NET Core billing read behavior now exposes `GET /api/billing/statements/batch/package.zip?limit=5`, returning `application/zip` content named `statement-batch-20260618-top5.zip`.
- The package contains `manifest.json`, `summary.csv`, and one generated statement PDF under `statements/` for each included candidate.
- React Fees workspace now shows a `Batch Export` link in the Statement Batch panel with the expected package URL and download filename.
- Modernized smoke coverage validates the package response, ZIP entries, manifest package ID, included statement count, first PDF content, and download filename.
- The `account-statement-batch-package` parity suite and `slice-62-statement-batch-package-readiness` plan verify normalized legacy MariaDB expectations and modernized PostgreSQL/API/UI package behavior.
- Workbench-managed Slice 62 statement batch package plan actions are available for both legacy and modernized targets.

Acceptance:

- The package endpoint returns the gold dataset package ID `STMT-BATCH-20260618-TOP5`, as-of date `2026-06-18`, five included statements, and the same all-candidate totals as the Slice 61 statement batch response.
- `manifest.json` lists each included candidate with pubpid, legacy PID, display name, statement number/status/date, due date, balance/current/past-due amounts, delivery method, and PDF file name.
- `summary.csv` lists the same statement rows in deterministic candidate order.
- Each included PDF is the existing deterministic generated patient statement PDF for that candidate.
- The modernized Fees workspace renders the `Batch Export` link with the expected URL and filename.
- The side-by-side Slice 62 parity comparison matches.

Current limitations:

- This slice exports a deterministic package for the current top candidates; it does not persist a batch record, mark statements as sent, deliver statements, archive statements, or create collection follow-up tasks.
- Collections work queue readiness is covered by Slice 63. Collections follow-up task lifecycle is covered by Slice 64. Rich statement batch layout, branded PDF design, delivery, portal messaging, recurring collection programs, and revenue-cycle audit history remain future billing slices.

### Slice 63: Collections Work Queue Readiness

Status:

- Implemented as a read-only modernized billing/revenue-cycle slice under `modernized-openemr/`.
- Verification is the shared `slice-63-collections-work-queue-readiness` plan, which validates deterministic past-due account ranking, priority labels, recommended collection actions, modernized API behavior, and Fees workspace rendering on both legacy and modernized targets.

Scope:

- The slice reuses the existing seeded billing and AR payment population; it does not add permanent gold-data records.
- Legacy behavior is represented by normalized MariaDB probes that derive past-due account exposure from OpenEMR billing and AR activity rows.
- ASP.NET Core billing read behavior now exposes `GET /api/billing/collections/work-queue?limit=5`.
- The work queue ranks positive past-due accounts by over-90 exposure, total past due, total balance, oldest open age, and legacy PID.
- Each queue row includes patient identity, generated statement number/date/due date, balance/current/past-due/over-90 amounts, open encounter and ledger counts, oldest open age/date, collection tier, recommended action, and contact method.
- React Fees workspace now shows a `Collections Work Queue` panel below Statement Batch with aggregate queue metrics, top ranked rows, tier pills, recommended actions, and `Open` actions that load the selected patient account.
- Modernized smoke coverage validates the queue API response, account counts, high-priority count, past-due/over-90 totals, first row tier/action, and first row statement metadata.
- The `account-collections-work-queue` parity suite and `slice-63-collections-work-queue-readiness` plan verify normalized legacy MariaDB expectations and modernized PostgreSQL/API/UI queue behavior.
- Workbench-managed Slice 63 collections work queue plan actions are available for both legacy and modernized targets.

Acceptance:

- The endpoint returns dataset as-of date `2026-06-18`, total past-due account count, high-priority account count, total balance, total past-due amount, total over-90 amount, and the top five ranked queue rows.
- Queue ordering is deterministic and matches normalized legacy probes for both targets.
- High-priority rows expose `High` tier and `Final notice review` when over-90 exposure is present.
- Contact method is deterministic from email/phone availability.
- The modernized Fees workspace renders the collections panel with the same top patient, statement number, tier, recommended action, over-90 amount, and patient-open behavior.
- The side-by-side Slice 63 parity comparison matches.

Current limitations:

- This slice identifies past-due accounts for follow-up; it does not persist collection tasks, send reminders, record phone calls, generate dunning letters, assign staff queues, suppress accounts, or write revenue-cycle audit history.
- Collection follow-up task lifecycle is covered by Slice 64. Basic pnotes/message reassignment is covered by Slice 65. Focused pnotes/message title and body editing is covered by Slice 66. Basic pnotes/message reply appending is covered by Slice 156. Actual statement delivery, reminder templates, richer staff assignment queues beyond pnotes assignment, payment-plan negotiation, write-off workflows, and audit history remain future billing slices.

### Slice 64: Collections Follow-Up Task Readiness

Status:

- Implemented as a mutation-capable modernized billing/revenue-cycle slice under `modernized-openemr/`.
- Verification is the shared `slice-64-collections-follow-up-readiness` plan, which validates pnotes-compatible collections follow-up task create, render, close, archive, delete, and modernized Fees task action behavior on both legacy and modernized targets.

Scope:

- The slice reuses the existing seeded billing, AR payment, statement, and pnotes/message infrastructure; it does not add permanent gold-data records.
- Legacy behavior is represented by inserting and mutating an OpenEMR `pnotes` row tied to the selected past-due patient.
- ASP.NET Core billing behavior now exposes `POST /api/billing/collections/follow-ups`, which creates a patient-message-compatible collections task from a work-queue patient.
- The follow-up task title is deterministic from the generated statement number, and the body includes patient identity, statement number, recommended action, priority, past-due amount, over-90 amount, total balance, oldest open date/age, due date, and operator note.
- React Fees workspace now provides a `Create Task` action on each Collections Work Queue row and reports the created task assignment.
- Modernized smoke coverage validates follow-up task creation from the top queue item, closes it through the existing message status route, verifies patient-message visibility, and removes the temporary row.
- The `account-collections-follow-up` parity suite and `slice-64-collections-follow-up-readiness` plan verify normalized legacy pnotes behavior, modernized API behavior, modernized UI task creation, cleanup, and side-by-side result matching.
- Workbench-managed Slice 64 collections follow-up plan actions are available for both legacy and modernized targets.

Acceptance:

- A follow-up task can be created from a ranked collections queue item without adding new seed records.
- The created task is stored in the same patient message/pnotes behavior model used by legacy OpenEMR.
- The task starts as `New`, is assigned to `billing`, and includes the deterministic statement number, action, priority, past-due amount, and operator note.
- The task can be closed to `Done`, rendered in the legacy patient notes screen or modernized Messages workspace, soft-deleted/archived, and hard-deleted for cleanup.
- The modernized Fees workspace can create the same task from a visible queue row.
- The side-by-side Slice 64 parity comparison matches.

Current limitations:

- This slice creates a focused pnotes-compatible follow-up task. Basic task reassignment is covered by Slice 65, focused task/message content editing is covered by Slice 66, basic reply appending is covered by Slice 156, and reminder templates, phone-call disposition tracking, dunning letters, escalation queues, payment-plan negotiation, write-off workflows, suppressions, and revenue-cycle audit history remain future work.

### Slice 65: Patient Message Assignment Readiness

Status:

- Implemented as a mutation-capable modernized patient-message slice under `modernized-openemr/`.
- Verification is the shared `slice-65-message-assignment-readiness` plan, which validates pnotes/message assignment updates, unchanged message counts, browser-visible legacy pnotes rendering, and modernized Messages reassignment behavior on both legacy and modernized targets.

Scope:

- The slice reuses the existing seeded portal-messaging anchor, message lifecycle infrastructure, and pnotes-compatible task rows; it does not add permanent gold-data records.
- Legacy behavior is represented by updating the OpenEMR `pnotes.assigned_to` field for a temporary patient message tied to `MOD-PAT-0004`.
- ASP.NET Core message behavior now exposes `PUT /api/messages/{messageId}/assignment` to update the assignee for active messages.
- React Messages workspace now provides an inline `Assign To` field and `Reassign` action on each message card.
- Modernized smoke coverage validates patient-message creation, assignment update, close, archive, and hard-delete cleanup.
- The `workflow-message-assignment` parity suite and `slice-65-message-assignment-readiness` plan verify normalized legacy and modernized database state, count stability, legacy pnotes rendering, modernized UI reassignment, cleanup, and side-by-side result matching.
- Workbench-managed Slice 65 message assignment plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary patient message can be created for `MOD-PAT-0004`, assigned to `admin`, and reassigned to `billing` without changing the patient message count.
- The reassigned message remains active with `New` status and `deleted = 0`.
- Legacy OpenEMR renders the reassigned temporary message through the patient notes surface.
- The modernized Messages workspace renders the current assignee and can update it through the visible reassignment control.
- The temporary message can be archived and hard-deleted so the seeded 1,200-message baseline remains unchanged.
- The side-by-side Slice 65 parity comparison matches.

Current limitations:

- This slice proves focused single-message reassignment. It does not implement role-aware work queues, assignment notifications, escalation policies, bulk reassignment, user lookup/autocomplete, or assignment audit history.

### Slice 66: Patient Message Content Readiness

Status:

- Implemented as a mutation-capable modernized patient-message slice under `modernized-openemr/`.
- Verification is the shared `slice-66-message-content-readiness` plan, which validates pnotes/message title and body edits, unchanged message counts, browser-visible legacy pnotes rendering, and modernized Messages `Save Edit` behavior on both legacy and modernized targets.

Scope:

- The slice reuses the existing seeded portal-messaging anchor, message lifecycle infrastructure, and temporary pnotes-compatible rows; it does not add permanent gold-data records.
- Legacy behavior is represented by updating the OpenEMR `pnotes.title` and `pnotes.body` fields for a temporary patient message tied to `MOD-PAT-0004`.
- ASP.NET Core message behavior now exposes `PUT /api/messages/{messageId}/content` to update title and body for active messages.
- React Messages workspace now provides inline title/body editing and a `Save Edit` action on each message card.
- Modernized smoke coverage validates patient-message creation, content update, assignment update, close, archive, and hard-delete cleanup.
- The `workflow-message-content` parity suite and `slice-66-message-content-readiness` plan verify normalized legacy and modernized database state, count stability, legacy pnotes rendering, modernized UI content editing, cleanup, and side-by-side result matching.
- Workbench-managed Slice 66 message content plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary patient message can be created for `MOD-PAT-0004`, edited with a new title and body, and kept at the same message count.
- The edited message remains active with `New` status, the expected assignee, and `deleted = 0`.
- Legacy OpenEMR renders the edited temporary message through the patient notes surface.
- The modernized Messages workspace renders editable title/body fields and can save the content update through the visible control.
- The temporary message can still be reassigned, archived, and hard-deleted so the seeded 1,200-message baseline remains unchanged.
- The side-by-side Slice 66 parity comparison matches.

Current limitations:

- This slice proves focused single-message title/body editing. Basic reply body appending is covered by Slice 156. It does not implement rich-text editing, attachments, full threaded portal replies, read receipts, bulk edits, audit history, or notification side effects.

### Slice 67: Encounter Document Attachment Readiness

Status:

- Implemented as a read-only modernized encounter-document slice under `modernized-openemr/`.
- Verification is the shared `slice-67-encounter-documents-readiness` plan, which validates encounter-attached document facts, browser-visible legacy document categories, modernized Encounter detail API document fields, and Encounters workspace rendering on both legacy and modernized targets.

Scope:

- The slice reuses the existing seeded `MOD-PAT-0001` encounter `1000013` document anchors; it does not add permanent gold-data records.
- ASP.NET Core encounter detail responses now include linked document attachments with document key, category, title, document date, upload timestamp, MIME type, file name, storage method, size, hash, notes, preview kind/status, thumbnail label/text, inline-preview readiness, and download capability.
- React Encounters workspace now renders an `Attached Documents` section for the selected encounter, including category/date metadata, inline text preview state, document reference, and download/open actions where supported.
- Modernized smoke coverage validates that encounter `1000013` exposes the two expected attached documents.
- The `encounter-documents` parity suite and `slice-67-encounter-documents-readiness` plan verify normalized legacy and modernized database state, legacy document-category rendering, modernized API fields, modernized UI rendering, and side-by-side result matching.
- Workbench-managed Slice 67 encounter documents plan actions are available for both legacy and modernized targets.

Acceptance:

- Encounter detail for `MOD-PAT-0001` encounter `1000013` exposes exactly two active linked documents: `Primary care intake packet` and `Advance directive acknowledgement`.
- The document categories, document keys, dates, MIME types, storage methods, preview kind, preview status, and thumbnail labels match between legacy and modernized probes.
- Legacy OpenEMR renders the linked documents under the expected document categories.
- The modernized Encounters workspace renders the linked documents in the encounter detail surface without requiring the user to switch to the standalone Documents workspace.
- The side-by-side Slice 67 parity comparison matches.

Current limitations:

- This slice proves read-only encounter-attached document visibility. It does not implement encounter-scoped document upload, scanning, document signing, attachment deletion, template-generated encounter forms, or full multi-form encounter package behavior.

### Slice 68: Encounter Billing Linkage Readiness

Status:

- Implemented as a read-only modernized encounter-billing linkage slice under `modernized-openemr/`.
- Verification is the shared `slice-68-encounter-billing-readiness` plan, which validates active fee-sheet billing lines linked to the same encounter anchor on both legacy and modernized targets.

Scope:

- The slice reuses the existing seeded `MOD-PAT-0001` encounter `1000013` billing anchors; it does not add permanent gold-data records.
- ASP.NET Core encounter detail responses now include active linked fee-sheet lines with billing id, encounter, billing date, code type, code, modifier, text, fee, justification, units, billed state, and activity state.
- React Encounters workspace now renders a `Fee Sheet Linkage` section for the selected encounter, including linked-code count, total linked fee amount, line-level code/text, fee, date, units, billed/active state, justification, and modifier/id context.
- Modernized smoke coverage validates that encounter `1000013` exposes the two expected active fee-sheet lines.
- The `encounter-billing` parity suite and `slice-68-encounter-billing-readiness` plan verify normalized legacy and modernized database state, legacy fee-sheet rendering, modernized API fields, modernized UI rendering, and side-by-side result matching.
- Workbench-managed Slice 68 encounter billing plan actions are available for both legacy and modernized targets.

Acceptance:

- Encounter detail for `MOD-PAT-0001` encounter `1000013` exposes exactly two active linked fee-sheet lines: CPT4 `99214` for `Established patient office visit` at `$168.00` and CPT4 `36415` for `Routine venipuncture` at `$18.00`.
- The code types, codes, descriptions, fees, justifications, units, billed state, and active state match between legacy and modernized probes.
- Legacy OpenEMR renders the linked fee-sheet codes and descriptions for the same encounter.
- The modernized Encounters workspace renders linked billing lines inside the encounter detail surface without requiring the user to switch to the standalone Fees workspace.
- The side-by-side Slice 68 parity comparison matches.

Current limitations:

- This slice proves read-only encounter-to-fee-sheet linkage visibility. It does not implement encounter-scoped billing creation, diagnosis association editing, charge correction, modifier changes, claim generation, payment posting, or billing workflow side effects from the encounter screen.

### Slice 69: Encounter Claim Linkage Readiness

Status:

- Implemented as a read-only modernized encounter-claim linkage slice under `modernized-openemr/`.
- Verification is the shared `slice-69-encounter-claims-readiness` plan, which validates claim-status rows linked to the same encounter anchor on both legacy and modernized targets.

Scope:

- The slice reuses the existing seeded `MOD-PAT-0001` encounter `1000013` claim anchor; it does not add permanent gold-data records.
- ASP.NET Core encounter detail responses now include linked claim-status rows with claim id, encounter, version, payer id/name/type, raw status, normalized status label, billing-process state, billing time, process time, process file, target, and submitted-claim payload marker.
- React Encounters workspace now renders a `Claim Linkage` section for the selected encounter, including linked-claim count, payer/status, version, target, timestamps, payer type, raw status, process file, and claim id/payload context.
- Modernized smoke coverage validates that encounter `1000013` exposes the expected linked `CLAIM-1000013-1` status row.
- The `encounter-claims` parity suite and `slice-69-encounter-claims-readiness` plan verify normalized legacy and modernized database state, modernized API fields, modernized UI rendering, and side-by-side result matching.
- Workbench-managed Slice 69 encounter claims plan actions are available for both legacy and modernized targets.

Acceptance:

- Encounter detail for `MOD-PAT-0001` encounter `1000013` exposes exactly one linked claim: `CLAIM-1000013-1`.
- The linked claim has payer `Acme Health`, payer type `1`, version `1`, raw status `3`, normalized status label `Marked as cleared`, bill process `0`, target `HCFA`, and bill time `2026-06-12 12:00`.
- The modernized Encounters workspace renders linked claim status inside the encounter detail surface without requiring the user to switch to the standalone Fees workspace.
- The side-by-side Slice 69 parity comparison matches.

Current limitations:

- This slice proves read-only encounter-to-claim-status visibility. It does not implement encounter-scoped claim creation, claim generation, clearing, denial workflow, payer edits, X12 submission, or payment posting from the encounter screen.

### Slice 70: Encounter Procedure Order Linkage Readiness

Status:

- Implemented as a read-only modernized encounter-procedure-order linkage slice under `modernized-openemr/`.
- Verification is the shared `slice-70-encounter-procedures-readiness` plan, which validates lab procedure orders, reports, and results linked to the same encounter anchor on both legacy and modernized targets.

Scope:

- The slice reuses the existing seeded `MOD-PAT-0001` encounter `1000011` procedure-order anchor; it does not add permanent gold-data records.
- ASP.NET Core encounter detail responses now include linked procedure orders with order id, encounter, provider, order date, priority, code, name, procedure type, diagnosis, instructions, status, reports, and result rows.
- React Encounters workspace now renders a `Procedure Orders` section for the selected encounter, including linked-order count, result count, order metadata, report review/status metadata, and result value/range cards.
- Modernized smoke coverage validates that encounter `1000011` exposes order `5000001`, report `6000001`, and four final result rows including `Hemoglobin A1c` value `5.7 %`.
- The `encounter-procedures` parity suite and `slice-70-encounter-procedures-readiness` plan verify normalized legacy and modernized database state, legacy procedure-result rendering, modernized API fields, modernized UI rendering, and side-by-side result matching.
- Workbench-managed Slice 70 encounter procedure-order plan actions are available for both legacy and modernized targets.

Acceptance:

- Encounter detail for `MOD-PAT-0001` encounter `1000011` exposes exactly one linked procedure order: `5000001`.
- The linked order has code `83036`, name `Hemoglobin A1c`, order date `2026-02-18`, status `complete`, priority `routine`, diagnosis `E11.9`, one reviewed/complete report `6000001`, and four final result rows.
- The modernized Encounters workspace renders linked procedure order/report/result detail inside the encounter detail surface without requiring the user to switch to the standalone Procedures workspace.
- The side-by-side Slice 70 parity comparison matches.

Current limitations:

- This slice proves read-only encounter-to-procedure-order visibility. It does not implement encounter-scoped order creation, order signing, result amendment, specimen collection, external lab interface workflows, or order/result mutation from the encounter screen.

### Slice 71: Encounter Diagnosis Coding Readiness

Status:

- Implemented as a read-only modernized encounter diagnosis-coding linkage slice under `modernized-openemr/`.
- Verification is the shared `slice-71-encounter-diagnoses-readiness` plan, which validates encounter diagnosis, fee-sheet justification, and procedure-order diagnosis evidence on both legacy and modernized targets.

Scope:

- The slice reuses existing seeded `MOD-PAT-0001` encounter anchors and does not add permanent gold-data records.
- ASP.NET Core encounter detail responses now include `diagnosisCodes`, a composed diagnosis evidence list with normalized code, description, source labels, linked billing-line count, linked procedure-order count, and supporting billing codes.
- React Encounters workspace now renders a `Diagnosis Coding` section for the selected encounter, including diagnosis-code cards, source evidence, billing-link count, procedure-order-link count, and supporting fee-sheet codes.
- Modernized smoke coverage validates encounter `1000013` diagnosis `E78.5` with two fee-sheet justification links and encounter `1000011` diagnosis `E11.9` with one linked procedure-order diagnosis.
- The `encounter-diagnoses` parity suite and `slice-71-encounter-diagnoses-readiness` plan verify normalized legacy and modernized database facts, legacy encounter/fee-sheet/procedure-result rendering, modernized API fields, modernized UI rendering, and side-by-side result matching.
- Workbench-managed Slice 71 encounter diagnosis-coding plan actions are available for both legacy and modernized targets.

Acceptance:

- Encounter detail for `MOD-PAT-0001` encounter `1000013` exposes diagnosis code `E78.5`, description `Hyperlipidemia, unspecified`, sources `Encounter diagnosis` and `Fee sheet justification`, two billing-line links, and supporting codes `CPT4 99214` and `CPT4 36415`.
- Encounter detail for `MOD-PAT-0001` encounter `1000011` exposes diagnosis code `E11.9`, description `Type 2 diabetes mellitus without complications`, sources `Encounter diagnosis` and `Procedure order diagnosis`, and one procedure-order link.
- The modernized Encounters workspace renders diagnosis coding evidence inside the encounter detail surface without requiring the user to switch to the Fees or Procedures workspaces.
- The side-by-side Slice 71 parity comparison matches.

Current limitations:

- This slice proves read-only encounter diagnosis-coding visibility. It does not implement encounter-scoped diagnosis create/update/delete workflows, coding search, code-system validation, claim-scrubbing rules, or diagnosis changes from the encounter screen.

### Slice 72: Encounter Billing Linkage Mutation Readiness

Status:

- Implemented as a mutation-capable modernized encounter billing-linkage readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-72-encounter-billing-mutation-readiness` plan, which creates a temporary CPT fee-sheet row, validates encounter-linked rendering, deactivates it, and deletes it on both legacy and modernized targets.

Scope:

- The slice reuses `MOD-PAT-0001` encounter `1000013` and does not add permanent gold-data records.
- The shared parity workflow creates a temporary `CPT4` billing line with code `99499`, fee `$42.00`, and diagnosis justification `E78.5`.
- Legacy verification opens the encounter Fee Sheet and confirms the temporary code/text render, including the legacy UI's visible `E78.` justification truncation behavior.
- Modernized verification reads the Encounter detail API, confirms the temporary billing row appears in `billingLines`, confirms the diagnosis evidence includes supporting code `CPT4 99499`, and verifies the Encounters workspace Fee Sheet Linkage and Diagnosis Coding panels.
- The workflow marks the row billed/inactive, verifies it is hidden from active encounter billing surfaces, hard-deletes it, and proves patient workflow counts return to baseline.
- Workbench-managed Slice 72 encounter billing linkage mutation plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating a temporary fee-sheet line for encounter `1000013` increases the encounter-linked active billing rows by one without changing encounter count.
- The created `CPT4 99499` row is visible through the legacy Fee Sheet and the modernized Encounter detail API/UI.
- Diagnosis justification `E78.5` continues to support the modernized diagnosis coding evidence while the legacy Fee Sheet visible-field truncation is treated as an accepted display quirk.
- Deactivation hides the row from active encounter-linked billing lists, and hard-delete cleanup restores the seeded billing count.
- The side-by-side Slice 72 parity comparison matches.

Current limitations:

- This slice proves encounter-linked billing mutation visibility through the existing billing-row lifecycle. It does not add a dedicated encounter-scoped billing editor, claim-scrubbing workflow, order-to-charge conversion, charge capture templates, or diagnosis mutation from the encounter screen.

### Slice 73: Encounter Diagnosis Coding Mutation Readiness

Status:

- Implemented as a mutation-capable modernized encounter diagnosis-coding readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-73-encounter-diagnosis-mutation-readiness` plan, which creates a temporary ICD10 fee-sheet diagnosis row, validates encounter-linked diagnosis rendering, deactivates it, and deletes it on both legacy and modernized targets.

Scope:

- The slice reuses `MOD-PAT-0001` encounter `1000013` and does not add permanent gold-data records.
- The shared parity workflow creates a temporary `ICD10 R73.03` fee-sheet diagnosis row with zero fee and stored justification `R73.03`.
- Legacy verification opens the encounter Fee Sheet and confirms the temporary diagnosis code and text render.
- Modernized verification reads the Encounter detail API, confirms diagnosis code `R73.03` appears with `Fee sheet diagnosis line` and `Fee sheet justification` sources, verifies supporting code `ICD10 R73.03`, and checks the Encounters workspace Diagnosis Coding panel.
- The workflow marks the row billed/inactive, verifies it is hidden from active encounter diagnosis-coding surfaces, hard-deletes it, and proves patient workflow counts return to baseline.
- Workbench-managed Slice 73 encounter diagnosis coding mutation plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating a temporary ICD10 diagnosis row for encounter `1000013` increases active encounter-linked billing rows by one without changing encounter count.
- The created `ICD10 R73.03` row is visible through the legacy Fee Sheet and the modernized Encounter detail API/UI Diagnosis Coding surface.
- Deactivation hides the diagnosis from active encounter-linked diagnosis evidence, and hard-delete cleanup restores the seeded billing count.
- The side-by-side Slice 73 parity comparison matches.

Current limitations:

- This slice proves encounter diagnosis-coding mutation visibility through the existing billing-row lifecycle. It does not add a dedicated encounter-screen diagnosis editor, code search, code-system validation, claim-scrubbing workflow, or broader diagnosis management workflow.

### Slice 74: Encounter Fee Sheet Entry Readiness

Status:

- Implemented as a mutation-capable modernized encounter fee-sheet entry readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-74-encounter-fee-sheet-entry-readiness` plan, which adds temporary CPT and ICD10 rows for an encounter, validates encounter-linked billing and diagnosis rendering, deactivates the rows, and deletes them on both legacy and modernized targets.

Scope:

- The modernized Encounters workspace now includes an `Encounter fee sheet entry` form beside the Fee Sheet Linkage and Diagnosis Coding panels.
- The form supports focused `CPT4` and `ICD10` entry with date, code, modifier for CPT rows, description, fee, units, and justification fields.
- The form calls the existing server-side billing line API, then refreshes the selected encounter so the billing and diagnosis panels show the newly linked rows.
- The parity workflow reuses `MOD-PAT-0001` encounter `1000013`, creates a temporary `CPT4 99499` row and temporary `ICD10 R73.03` row, verifies legacy Fee Sheet rendering, verifies modernized Encounter workspace rendering, marks both rows billed/inactive, and hard-deletes both rows.
- Workbench-managed Slice 74 encounter fee-sheet entry plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating temporary CPT and ICD10 fee-sheet rows for encounter `1000013` increases active encounter-linked billing rows by two without changing encounter count.
- The CPT row appears in the modernized Encounter Fee Sheet Linkage panel with fee, units, and justification.
- The ICD10 row appears in both the Fee Sheet Linkage panel and the Diagnosis Coding panel, with fee-sheet diagnosis and justification evidence.
- Deactivation hides both rows from active encounter-linked surfaces, and hard-delete cleanup restores the seeded billing count.
- The side-by-side Slice 74 parity comparison matches.

Current limitations:

- This slice proves focused encounter-workspace fee-sheet entry for CPT and ICD10 rows. It does not implement code search, code-system validation, claim-scrubbing workflow, order-to-charge conversion, charge templates, authorization, audit history, or broader encounter coding management.

### Slice 75: Encounter Procedure Order Entry Readiness

Status:

- Implemented as a mutation-capable modernized encounter procedure-order entry readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-75-encounter-procedure-order-entry-readiness` plan, which adds a temporary pending lab order from an encounter workflow, validates encounter-linked procedure-order rendering, and deletes the order on both legacy and modernized targets.

Scope:

- The modernized Encounters workspace now includes an `Encounter procedure order entry` form beside the Procedure Orders panel.
- The form supports focused procedure/lab order entry with order date, code, name, diagnosis, priority, status, type, and instructions.
- The form calls the existing server-side procedure order API with the selected encounter id, then refreshes the selected encounter so the Procedure Orders panel shows the newly linked pending order.
- The modernized smoke test now includes an `encounter procedure order entry lifecycle` check that creates a temporary pending order on `MOD-PAT-0001` encounter `1000013`, verifies the Encounter detail API, deletes the order, and verifies it is gone.
- The parity workflow reuses `MOD-PAT-0001` encounter `1000013`, creates a temporary `80053` pending laboratory order, verifies legacy Procedure Orders and Reports rendering, verifies modernized Encounter workspace/API rendering, and hard-deletes the order.
- Workbench-managed Slice 75 encounter procedure-order entry plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating a temporary pending procedure order for encounter `1000013` increases procedure-order count by one without changing encounter count.
- The created order appears in the modernized Encounter Procedure Orders panel with code, diagnosis, priority, type, instructions, pending status, and no reports/results.
- The legacy Procedure Orders and Reports screen renders the same temporary order after the shared workflow adapter creates it.
- Hard-delete cleanup restores the seeded procedure-order count.
- The side-by-side Slice 75 parity comparison matches.

Current limitations:

- This slice proves focused encounter-workspace pending procedure-order entry. It does not implement order catalogs, result entry, provider sign-off, specimen collection, external lab integration, authorization, audit history, or order-to-charge conversion.

### Slice 76: Encounter Procedure Result Entry Readiness

Status:

- Implemented as a mutation-capable modernized encounter procedure-result entry readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-76-encounter-procedure-result-entry-readiness` plan, which creates a temporary encounter-linked lab order, records a reviewed final report/result, validates encounter-linked procedure report/result rendering, and deletes the order on both legacy and modernized targets.

Scope:

- The modernized Encounters workspace now renders a focused `Result Entry` form on each Procedure Orders card.
- The form supports report date, specimen number, review status, result status, result code, result text, value, units, reference range, abnormal flag, and notes.
- The form calls the existing server-side procedure report and procedure result APIs for the selected procedure order, then refreshes the selected encounter so the Procedure Orders panel shows the new report and final result.
- The modernized smoke test now includes an `encounter procedure result entry lifecycle` check that creates a temporary order, report, and final result on `MOD-PAT-0001` encounter `1000013`, verifies the Encounter detail API, deletes the order, and verifies cascade cleanup.
- The parity workflow reuses `MOD-PAT-0001` encounter `1000013`, creates a temporary `80053` pending laboratory order, verifies legacy procedure-result rendering after the legacy adapter creates the report/result, verifies modernized Encounter workspace/API result-entry behavior, and hard-deletes the order.
- Workbench-managed Slice 76 encounter procedure-result entry plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating a temporary reviewed final procedure result for encounter `1000013` increases procedure-order count by one without changing encounter count.
- The created order appears in the modernized Encounter Procedure Orders panel with one report and one final result.
- The modernized panel renders result code, result text, value, units, range, abnormal flag, final status, and reviewed report status after entry.
- The legacy Procedure Results screen renders the same temporary order and result after the shared workflow adapter creates it.
- Hard-delete cleanup restores the seeded procedure-order count and removes the temporary report/result.
- The side-by-side Slice 76 parity comparison matches.

Current limitations:

- This slice proves focused encounter-workspace procedure result entry for an existing encounter-linked order. It does not implement order catalogs, multi-result panels in one submit, specimen collection workflow, external lab integration, authorization, audit history, or order-to-charge conversion. Focused in-place procedure result correction is covered by Slice 129.

### Slice 77: Encounter Sign-Off Readiness

Status:

- Implemented as a mutation-capable modernized encounter sign-off readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-77-encounter-signoff-readiness` plan, which creates a temporary encounter, records a provider/admin attestation, validates persisted signature facts and modernized Encounter workspace rendering, deletes the signature, and removes the encounter on both legacy and modernized targets.

Scope:

- The modernized PostgreSQL seed schema now includes an `encounter_signatures` table mapped to legacy-style encounter e-signature facts without adding permanent seeded signature records.
- The ASP.NET Core encounter API exposes sign and signature-delete endpoints for selected encounters.
- The modernized Encounters workspace now includes a Sign-Off panel with signer, signed-at, mode, note, persisted signature cards, hash preview, and delete action.
- The modernized smoke test now includes an `encounter sign-off lifecycle` check that signs `MOD-PAT-0001` encounter `1000013`, verifies the returned signature facts, deletes the signature, and verifies cleanup.
- The parity workflow creates a temporary encounter for `MOD-PAT-0002`, signs it as `admin`, verifies legacy `esign_signatures` or modernized `encounter_signatures` post-state, renders the modernized Sign-Off panel, deletes the signature, and deletes the encounter.
- Workbench-managed Slice 77 encounter sign-off plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating a temporary signed encounter increases encounter count and encounter-signature count by one.
- The signature records table name, signer username, signed-at timestamp, lock mode, amendment/note, hash, and signature hash consistently across both targets.
- The modernized Encounter Sign-Off panel renders the saved signed state and signature note.
- Deleting the signature restores the encounter-signature count, and deleting the temporary encounter restores the encounter count.
- The side-by-side Slice 77 parity comparison matches.

Current limitations:

- This slice proves focused encounter sign-off/attestation parity. Focused encounter co-signature readiness is covered by Slice 121, and signature-derived amendment history is covered by Slice 190; role-based signing authorization, full clinical locking semantics, revocation policy, legal attestation text, or audit-log export remain future work.

### Slice 78: Encounter Document Upload Readiness

Status:

- Implemented as a mutation-capable modernized encounter-scoped document upload readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-78-encounter-document-upload-readiness` plan, which creates a temporary text document attached to an existing encounter, validates normalized document facts and browser-visible rendering, deletes the document, and verifies cleanup on both legacy and modernized targets.

Scope:

- The ASP.NET Core encounter API exposes `POST /api/encounters/{encounter}/documents`, deriving the patient from the selected encounter before reusing the existing document persistence behavior.
- The modernized Encounters workspace now includes an attached-document upload form with category, document date, name, notes, text content, save state, and immediate detail refresh.
- The modernized smoke test now includes an `encounter document attachment lifecycle` check that creates a temporary text document on `MOD-PAT-0001` encounter `1000013`, verifies returned document facts, deletes it, and verifies cleanup.
- The parity workflow reuses `MOD-PAT-0001` encounter `1000013`, creates a temporary `Medical Record` text document through target-specific workflow adapters, verifies legacy `documents.encounter_id` or modernized encounter detail post-state, renders the legacy Documents category view or modernized Encounter attached-document panel, and hard-deletes the document.
- Workbench-managed Slice 78 encounter document upload plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating a temporary encounter-scoped text document increases the patient's document count and the selected encounter's attached-document count by one.
- The created document records category, date, name, notes, encounter id, `text/plain` MIME type, database storage method, text preview, preview kind, and thumbnail label consistently across both targets.
- The modernized Encounter attached-document panel renders the uploaded document and the upload controls after creation.
- Hard-delete cleanup restores the seeded patient document count and the seeded encounter-attached document count.
- The side-by-side Slice 78 parity comparison matches.

Current limitations:

- This slice proves focused encounter-scoped text attachment parity from the Encounter workspace. Binary encounter attachments are covered by Slice 79, focused encounter-scoped document signing is covered by Slice 80, focused encounter-scoped document denial is covered by Slice 81, focused encounter-scoped document metadata refiling is covered by Slice 82, focused same-patient encounter document movement is covered by Slice 83, focused encounter-scoped content replacement is covered by Slice 84, focused encounter-scoped archive/restore is covered by Slice 85, focused encounter-scoped lifecycle timeline readiness is covered by Slice 86, and focused encounter-scoped external-link attachment is covered by Slice 87. Scanned upload capture, document routing, full document version history from the encounter screen, authorization, and comprehensive audit-log export remain future work.

### Slice 79: Encounter Binary Document Upload Readiness

Status:

- Implemented as a mutation-capable modernized encounter-scoped binary/PDF document upload readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-79-encounter-binary-document-upload-readiness` plan, which creates a temporary PDF document attached to an existing encounter, validates normalized binary-document facts, downloads the payload, verifies browser-visible rendering, deletes the document, and verifies cleanup on both legacy and modernized targets.

Scope:

- The ASP.NET Core encounter API exposes `POST /api/encounters/{encounter}/documents/binary`, deriving the patient from the selected encounter before reusing the existing binary document persistence behavior.
- The modernized Encounters workspace now includes an attached binary-document upload form with category, document date, name, file selection, notes, save state, and immediate detail refresh.
- The modernized smoke test now includes an `encounter binary document attachment lifecycle` check that creates a temporary PDF-like binary document on `MOD-PAT-0001` encounter `1000013`, verifies returned preview/download metadata, downloads the content, deletes it, and verifies cleanup.
- The parity workflow reuses `MOD-PAT-0001` encounter `1000013`, creates a temporary `Medical Record` PDF document through target-specific workflow adapters, verifies legacy `documents.encounter_id` or modernized encounter detail post-state, renders the legacy Documents category view or modernized Encounter attached-document panel, verifies download content, and hard-deletes the document.
- Workbench-managed Slice 79 encounter binary document upload plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating a temporary encounter-scoped PDF document increases the patient's document count and the selected encounter's attached-document count by one.
- The created document records category, date, name, notes, encounter id, `application/pdf` MIME type, database storage method, PDF preview kind, thumbnail label, downloadable state, file name, content bytes, and size consistently across both targets.
- The modernized Encounter attached-document panel renders the uploaded binary document and the binary upload controls after creation.
- Downloading the created document returns the same binary payload that was uploaded.
- Hard-delete cleanup restores the seeded patient document count and the seeded encounter-attached document count.
- The side-by-side Slice 79 parity comparison matches.

Current limitations:

- This slice proves focused encounter-scoped PDF/binary attachment parity from the Encounter workspace. Focused encounter-scoped scanned attachment readiness is covered by Slice 126, focused encounter-scoped binary content replacement is covered by Slice 127, focused encounter-scoped document signing is covered by Slice 80, focused encounter-scoped document denial is covered by Slice 81, focused encounter-scoped document metadata refiling is covered by Slice 82, focused same-patient encounter document movement is covered by Slice 83, focused encounter-scoped content replacement is covered by Slice 84, focused encounter-scoped archive/restore is covered by Slice 85, focused encounter-scoped lifecycle timeline readiness is covered by Slice 86, focused encounter-scoped external-link attachment is covered by Slice 87, patient image inline preview readiness is covered by Slice 88, patient image thumbnail readiness is covered by Slice 89, and patient PDF inline preview readiness is covered by Slice 90. Direct scanner integration, generated PDF thumbnails, external object storage, document routing queues, full version history from the encounter screen, authorization, and comprehensive audit-log export remain future work.

### Slice 126: Encounter Scanned Attachment Readiness

Status:

- Implemented as a mutation-capable modernized encounter-scoped scanned attachment readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-126-encounter-document-scanned-attachment-readiness` plan, which creates a temporary scanned PDF attached to an existing encounter, validates normalized scan facts, renders the modernized encounter attachment card, deletes the document, and verifies cleanup on both legacy and modernized targets.

Scope:

- Encounter document API responses now expose derived scan readiness fields: `isScannedAttachment`, `scanStatus`, `captureSource`, `scanPageCount`, and `ocrStatus`.
- The modernized Encounters workspace renders scan readiness on attached-document cards when document metadata/notes indicate a scanned attachment.
- The modernized smoke test includes an `encounter scanned attachment readiness` check that creates a temporary scanned PDF on `MOD-PAT-0001` encounter `1000013`, verifies scan-source/OCR fields in returned and reloaded encounter detail, deletes it, and verifies cleanup.
- The parity workflow reuses `MOD-PAT-0001` encounter `1000013`, creates a temporary `Medical Record` PDF with `Scan source: front-desk scanner; OCR pending` notes, verifies normalized database/content/API facts, renders the legacy Documents category view or modernized Encounter attached-document panel, and hard-deletes the document.
- Workbench-managed Slice 126 encounter scanned attachment plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating a temporary encounter-scoped scanned PDF increases the patient's document count and the selected encounter's attached-document count by one.
- The created document records category, date, name, notes, encounter id, `application/pdf` MIME type, database storage method, PDF preview kind, downloadable state, and derived scan-readiness facts consistently across both targets.
- The modernized Encounter attached-document panel renders `Scanned attachment`, `front-desk scanner`, `1 scanned page`, and `OCR pending`.
- Hard-delete cleanup restores the seeded patient document count and the seeded encounter-attached document count.
- The side-by-side Slice 126 parity comparison matches.

Current limitations:

- This slice proves metadata-derived encounter scanned attachment readiness. Direct scanner hardware integration, OCR execution, generated PDF thumbnails, external object storage, document routing queues, full historical version chains from the encounter screen, role-based document workflow authorization, and comprehensive audit-log export remain future work.

### Slice 127: Encounter Binary Document Content Replacement Readiness

Status:

- Implemented as a mutation-capable modernized encounter-scoped binary document replacement slice under `modernized-openemr/`.
- Verification is the shared `slice-127-encounter-document-binary-content-replace-readiness` plan, which creates a temporary PDF attached to an existing encounter, replaces its stored binary payload in place, validates preview/download/revision facts, renders the modernized encounter attachment card, deletes the document, and verifies cleanup on both legacy and modernized targets.

Scope:

- The ASP.NET Core document repository now supports binary content replacement for database-backed documents, updating MIME type, file name, size, page count, hash, binary bytes, preview text, storage URL, and uploaded/revision timestamp.
- The ASP.NET Core encounter API exposes `PUT /api/encounters/{encounter}/documents/{documentId}/content/binary`, validating that the selected document belongs to the selected encounter before replacing its binary payload.
- The modernized frontend API exposes encounter binary content replacement as a named helper.
- The modernized Encounters workspace adds a file-picker based `Binary File` replacement mode on attached-document cards while preserving the existing text `Replace` action.
- The shared parity workflow reuses `MOD-PAT-0001` encounter `1000013`, creates a temporary `Medical Record` PDF, replaces it with a second PDF, verifies byte-for-byte content, MIME type, file name, hash/revision facts, PDF preview facts, download payload, legacy or modernized UI evidence, and hard-delete cleanup.
- The modernized smoke test includes an `encounter binary document content replacement lifecycle` check.
- Workbench-managed Slice 127 encounter binary content replacement plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating a temporary encounter-scoped PDF increases the patient's document count and the selected encounter's attached-document count by one.
- Replacing the binary payload preserves the same document id and encounter id while updating file name, MIME type, byte size, hash/revision fields, preview facts, and downloadable content.
- The modernized Encounter attached-document panel renders the replacement filename, PDF preview metadata, and current-version facts.
- The modernized document download endpoint returns the replacement bytes.
- Hard-delete cleanup restores the seeded patient document count and the seeded encounter-attached document count.
- The side-by-side Slice 127 parity comparison matches.

Current limitations:

- This slice proves focused database-backed binary replacement from the Encounter workspace. True historical version rows, generated PDF thumbnails, external object storage, scanner routing, role-based replacement authorization, document routing queues, and comprehensive audit-log export remain future work.

### Slice 128: Patient Binary Document Content Replacement Readiness

Status:

- Implemented as a mutation-capable modernized patient-document binary replacement slice under `modernized-openemr/`.
- Verification is the shared `slice-128-document-binary-content-replace-readiness` plan, which creates a temporary PDF on `MOD-PAT-0001`, replaces its stored binary payload in place from the modernized Documents workspace, validates preview/download/revision facts, deletes the document, and verifies cleanup on both legacy and modernized targets.

Scope:

- The ASP.NET Core documents API exposes `PUT /api/documents/{documentId}/content/binary` for active database-backed patient documents.
- The existing binary replacement repository behavior is now available directly from patient-document workflows, updating MIME type, file name, size, page count, hash, binary bytes, preview text, storage URL, and uploaded/revision timestamp.
- The modernized frontend API exposes patient binary content replacement as a named helper.
- The modernized Documents workspace adds a file-picker based `Binary File` replacement mode on patient document cards while preserving the existing text `Replace` action.
- The modernized workflow adapter now calls the patient-document binary replacement endpoint directly instead of reusing encounter-scoped replacement as a workaround.
- The shared parity workflow reuses `MOD-PAT-0001` and seeded encounter `1000013`, creates a temporary `Medical Record` PDF, replaces it with a second PDF, verifies byte-for-byte content, MIME type, file name, hash/revision facts, PDF preview facts, download payload, legacy or modernized UI evidence, and hard-delete cleanup.
- The modernized smoke test includes a `patient binary document content replacement lifecycle` check.
- Workbench-managed Slice 128 patient binary content replacement plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating a temporary patient-scoped PDF increases the patient's document count by one.
- Replacing the binary payload preserves the same document id, patient id, document category, document date, encounter link, and review status while updating file name, MIME type, byte size, hash/revision fields, preview facts, and downloadable content.
- The modernized Documents card renders the replacement filename, PDF preview metadata, and current-version facts.
- The modernized document download endpoint returns the replacement bytes.
- Hard-delete cleanup restores the seeded patient document count.
- The side-by-side Slice 128 parity comparison matches.

Current limitations:

- This slice proves focused database-backed binary replacement from the patient Documents workspace. True historical version rows, generated PDF thumbnails, external object storage, OCR extraction, scanner routing, role-based replacement authorization, patient-portal distribution, document routing queues, and comprehensive audit-log export remain future work.

### Slice 80: Encounter Document Sign-Off Readiness

Status:

- Implemented as a mutation-capable modernized encounter-scoped document sign-off readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-80-encounter-document-signoff-readiness` plan, which creates a temporary document attached to an existing encounter, approves/signs it, validates normalized review facts and browser-visible rendering, deletes the document, and verifies cleanup on both legacy and modernized targets.

Scope:

- The ASP.NET Core encounter API exposes `PUT /api/encounters/{encounter}/documents/{documentId}/sign`, validating that the selected document is attached to the selected encounter before reusing the document review persistence behavior.
- Encounter detail document responses now include review status, reviewer, and review timestamp fields.
- The modernized Encounters workspace renders attached-document review metadata and exposes a Sign action that approves a pending encounter document, refreshes the encounter detail, and disables the action once reviewed.
- The modernized smoke test now includes an `encounter document sign-off lifecycle` check that creates a temporary text document on `MOD-PAT-0001` encounter `1000013`, verifies pending review state, signs it as `admin`, verifies approved review metadata, deletes it, and verifies cleanup.
- The parity workflow reuses `MOD-PAT-0001` encounter `1000013`, creates a temporary `Medical Record` text document through target-specific workflow adapters, signs it as `admin`, verifies legacy or modernized review facts, renders the legacy Documents category view or modernized Encounter attached-document panel, verifies the modernized Sign action is disabled after approval, and hard-deletes the document.
- Workbench-managed Slice 80 encounter document sign-off plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating a temporary encounter-scoped text document increases the patient's document count and the selected encounter's attached-document count by one.
- The created document starts with pending review metadata before sign-off.
- Signing the encounter-attached document records `approved` review status, reviewer `admin`, and a review timestamp consistently across both targets.
- The modernized Encounter attached-document panel renders approved state and reviewer metadata, and prevents signing an already reviewed document.
- Hard-delete cleanup restores the seeded patient document count and the seeded encounter-attached document count.
- The side-by-side Slice 80 parity comparison matches.

Current limitations:

- This slice proves focused encounter-scoped document sign-off parity from the Encounter workspace. Denial from the encounter-attached document panel is covered by Slice 81, metadata refiling from the encounter-attached document panel is covered by Slice 82, same-patient encounter movement from the panel is covered by Slice 83, content replacement from the panel is covered by Slice 84, archive/restore from the panel is covered by Slice 85, current revision readiness from the panel is covered by Slice 122, and replacement-revision readiness is covered by Slice 123. Role-based signing authorization, route queues, co-signature/amendment policy, full historical version chains from the encounter screen, and audit-log export remain future work.

### Slice 81: Encounter Document Denial Readiness

Status:

- Implemented as a mutation-capable modernized encounter-scoped document denial readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-81-encounter-document-denial-readiness` plan, which creates a temporary document attached to an existing encounter, denies it, validates normalized review facts and browser-visible rendering, deletes the document, and verifies cleanup on both legacy and modernized targets.

Scope:

- The existing ASP.NET Core encounter document review endpoint accepts `reviewStatus = denied` after validating that the selected document belongs to the selected encounter.
- The modernized frontend API now exposes encounter document denial as a named helper instead of relying on generic document review behavior.
- The modernized Encounters workspace renders a Deny action beside Sign for attached documents, records denial as `admin`, refreshes the encounter detail, and disables both review actions once the document is reviewed.
- The modernized smoke test now includes an `encounter document denial lifecycle` check that creates a temporary text document on `MOD-PAT-0001` encounter `1000013`, verifies pending review state, denies it as `admin`, verifies denied review metadata, deletes it, and verifies cleanup.
- The parity workflow reuses `MOD-PAT-0001` encounter `1000013`, creates a temporary `Medical Record` text document through target-specific workflow adapters, denies it as `admin`, verifies legacy or modernized review facts, renders the legacy Documents category view or modernized Encounter attached-document panel, verifies the modernized Sign and Deny actions are disabled after denial, and hard-deletes the document.
- Workbench-managed Slice 81 encounter document denial plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating a temporary encounter-scoped text document increases the patient's document count and the selected encounter's attached-document count by one.
- The created document starts with pending review metadata before denial.
- Denying the encounter-attached document records `denied` review status, reviewer `admin`, and a review timestamp consistently across both targets.
- The modernized Encounter attached-document panel renders denied state and reviewer metadata, and prevents duplicate review actions for an already reviewed document.
- Hard-delete cleanup restores the seeded patient document count and the seeded encounter-attached document count.
- The side-by-side Slice 81 parity comparison matches.

Current limitations:

- This slice proves focused encounter-scoped document denial parity from the Encounter workspace. Encounter document metadata refiling from the encounter-attached document panel is covered by Slice 82, same-patient encounter movement from the panel is covered by Slice 83, content replacement from the panel is covered by Slice 84, archive/restore from the panel is covered by Slice 85, current revision readiness from the panel is covered by Slice 122, and replacement-revision readiness is covered by Slice 123. Role-based denial authorization, routing queues, co-signature/amendment policy, full historical version chains from the encounter screen, and audit-log export remain future work.

### Slice 82: Encounter Document Metadata Readiness

Status:

- Implemented as a mutation-capable modernized encounter-scoped document metadata readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-82-encounter-document-metadata-readiness` plan, which creates a temporary document attached to an existing encounter, refiles its metadata while keeping it attached to the same encounter, validates normalized document facts and browser-visible rendering, deletes the document, and verifies cleanup on both legacy and modernized targets.

Scope:

- The ASP.NET Core encounter API exposes `PUT /api/encounters/{encounter}/documents/{documentId}/metadata`, validating that the selected document belongs to the selected encounter and preserving the selected encounter link during the metadata update.
- The modernized frontend API exposes encounter document metadata updates as a named helper instead of relying only on generic patient-document refiling behavior.
- The modernized Encounters workspace renders inline Edit controls on attached-document cards for name, category, document date, linked encounter, and notes, refreshes the encounter detail after save, and displays metadata save feedback.
- The modernized smoke test now includes an `encounter document metadata lifecycle` check that creates a temporary text document on `MOD-PAT-0001` encounter `1000013`, refiles it to `Advance Directive`, verifies updated metadata, deletes it, and verifies cleanup.
- The parity workflow reuses `MOD-PAT-0001` encounter `1000013`, creates a temporary `Medical Record` text document through target-specific workflow adapters, updates name/category/date/notes while preserving the encounter link, verifies legacy or modernized document facts, renders the legacy Documents category view or modernized Encounter attached-document panel, and hard-deletes the document.
- Workbench-managed Slice 82 encounter document metadata plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating a temporary encounter-scoped text document increases the patient's document count and the selected encounter's attached-document count by one.
- Refiling the encounter-attached document records updated name, `Advance Directive` category, document date, notes, and preserved encounter id consistently across both targets.
- The modernized Encounter attached-document panel renders the updated metadata and notes after the inline Save Metadata action.
- Hard-delete cleanup restores the seeded patient document count and the seeded encounter-attached document count.
- The side-by-side Slice 82 parity comparison matches.

Current limitations:

- This slice proves focused encounter-scoped document metadata refiling parity from the Encounter workspace while keeping the document attached to the selected encounter. Moving documents between same-patient encounters is covered by Slice 83, content replacement/current-version readiness is covered by Slice 84, and archive/restore from the encounter-attached document panel is covered by Slice 85. Scanner routing, role-based metadata authorization, full version history from the encounter screen, and audit-log export remain future work.

### Slice 83: Encounter Document Move Readiness

Status:

- Implemented as a mutation-capable modernized encounter-scoped document move readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-83-encounter-document-move-readiness` plan, which creates a temporary document attached to a source encounter, moves it to another encounter for the same patient, validates normalized source and target encounter document facts plus browser-visible rendering, deletes the document, and verifies cleanup on both legacy and modernized targets.

Scope:

- The ASP.NET Core encounter API exposes `PUT /api/encounters/{encounter}/documents/{documentId}/move`, validating that the selected document belongs to the source encounter and that the target encounter belongs to the same patient before updating the document encounter link.
- The modernized frontend API exposes encounter document movement as a named helper.
- The modernized Encounters workspace renders inline Move controls on attached-document cards, refreshes the workspace to the target encounter after a successful move, and displays move feedback.
- The modernized smoke test now includes an `encounter document move lifecycle` check that creates a temporary text document on `MOD-PAT-0001` encounter `1000013`, moves it to encounter `1000011`, verifies source removal and target attachment, deletes it, and verifies cleanup.
- The parity workflow reuses `MOD-PAT-0001` encounters `1000013` and `1000011`, creates a temporary `Medical Record` text document through target-specific workflow adapters, moves it between same-patient encounters, verifies legacy or modernized document facts, renders the legacy Documents category view or modernized Encounter attached-document panel, and hard-deletes the document.
- Workbench-managed Slice 83 encounter document move plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating a temporary encounter-scoped text document increases the patient's document count and the source encounter's attached-document count by one.
- Moving the document removes it from the source encounter and adds it to the target encounter while preserving name, category, date, notes, content, pending review state, and active document status.
- The modernized Encounter attached-document panel renders the moved document after the inline Move action and refreshes to the target encounter detail.
- Hard-delete cleanup restores the seeded patient document count plus the seeded source and target encounter-attached document counts.
- The side-by-side Slice 83 parity comparison matches.

Current limitations:

- This slice proves focused same-patient encounter document movement from the Encounter workspace. Encounter-scoped content replacement and current-version readiness are covered by Slice 84, and encounter-scoped archive/restore is covered by Slice 85. Scanner routing, cross-patient safety workflows, role-based movement authorization, full version history from the encounter screen, and audit-log export remain future work.

### Slice 84: Encounter Document Content Replacement Readiness

Status:

- Implemented as a mutation-capable modernized encounter-scoped document content replacement readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-84-encounter-document-content-replace-readiness` plan, which creates a temporary encounter-attached document, replaces its text payload in place, validates normalized content, preview, and current-version facts plus browser-visible rendering, deletes the document, and verifies cleanup on both legacy and modernized targets.

Scope:

- The ASP.NET Core encounter API exposes `PUT /api/encounters/{encounter}/documents/{documentId}/content`, validating that the selected document belongs to the selected encounter before delegating to the shared patient-document content replacement service.
- Encounter-attached document API responses now include current-version readiness fields: revision timestamp, version label/status, history count, prior-version flag, and revision hash.
- The modernized frontend API exposes encounter document content replacement as a named helper.
- The modernized Encounters workspace renders current-version facts on attached-document cards and adds inline Replace controls for file name and replacement body, while preventing replacement for external-link attachments.
- The modernized smoke test now includes an `encounter document content replacement lifecycle` check that creates a temporary text document on `MOD-PAT-0001` encounter `1000013`, replaces its payload, verifies preview and revision hash facts, deletes it, and verifies cleanup.
- The parity workflow reuses `MOD-PAT-0001` encounter `1000013`, creates a temporary `Medical Record` text document through target-specific workflow adapters, replaces the document payload through legacy storage or the modernized Encounter UI, verifies normalized content and revision-readiness facts, renders the legacy Documents category view or modernized Encounter attached-document panel, and hard-deletes the document.
- Workbench-managed Slice 84 encounter document content replacement plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating a temporary encounter-scoped text document increases the patient's document count and the selected encounter's attached-document count by one.
- Replacing content preserves encounter attachment, document name, category, date, notes, active status, and pending review state while updating stored text, file name, preview text, revision timestamp, and revision hash.
- The modernized Encounter attached-document panel renders `Version 1`, current-version status, no-prior-version readiness, and the replacement preview after the inline Save Content action.
- Hard-delete cleanup restores the seeded patient document count and the seeded encounter-attached document count.
- The side-by-side Slice 84 parity comparison matches.

Current limitations:

- This slice proves focused encounter-scoped text content replacement and current-version readiness from the Encounter workspace. Encounter-scoped binary content replacement is covered by Slice 127, and encounter-scoped archive/restore is covered by Slice 85. True historical version rows, scanner routing, external storage adapters, role-based replacement authorization, and audit-log export remain future work.

### Slice 85: Encounter Document Archive Restore Readiness

Status:

- Implemented as a mutation-capable modernized encounter-scoped document archive/restore readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-85-encounter-document-archive-readiness` plan, which creates a temporary encounter-attached document, archives it, validates active-detail hiding and archived-detail visibility, restores it, validates active rendering again, deletes the document, and verifies cleanup on both legacy and modernized targets.

Scope:

- The ASP.NET Core encounter detail API accepts `includeArchivedDocuments=true` so the Encounters workspace can deliberately show archived attached documents for restore workflows.
- Encounter-attached document API responses now include the `deleted` archive state.
- The ASP.NET Core encounter API exposes `PUT /api/encounters/{encounter}/documents/{documentId}/soft-delete` and `PUT /api/encounters/{encounter}/documents/{documentId}/restore`, validating that the selected document belongs to the selected encounter before delegating to shared patient-document archive/restore behavior.
- The modernized frontend API exposes encounter document archive and restore helpers.
- The modernized Encounters workspace adds a `Show archived attached documents` toggle, archived count badge, attached-document archived badge, Archive action, and Restore action while disabling edit/move/replace/review/download behavior for archived attachments.
- The modernized smoke test now includes an `encounter document archive restore lifecycle` check that creates a temporary text document on `MOD-PAT-0001` encounter `1000013`, archives it, verifies active-detail hiding and archived-detail inclusion, restores it, verifies active visibility, deletes it, and verifies cleanup.
- The parity workflow reuses `MOD-PAT-0001` encounter `1000013`, creates a temporary `Medical Record` text document through target-specific workflow adapters, archives and restores it through legacy storage or the modernized Encounter UI, verifies normalized active/archived state and browser-visible rendering, and hard-deletes the document.
- Workbench-managed Slice 85 encounter document archive/restore plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating a temporary encounter-scoped text document increases the patient's active document count and the selected encounter's active attached-document count by one.
- Archiving the document sets `deleted = 1`, hides it from normal active encounter detail, keeps it visible when archived documents are included, and decreases active document and encounter-attached counts back to baseline.
- Restoring the document sets `deleted = 0`, returns it to normal active encounter detail, preserves name/category/date/notes/content/pending review state, and restores active document and encounter-attached counts to one above baseline.
- The modernized Encounter attached-document panel renders the archived badge, Restore action, archive-state feedback, and restored active card after the inline actions.
- Hard-delete cleanup restores the seeded patient document count and the seeded encounter-attached document count.
- The side-by-side Slice 85 parity comparison matches.

Current limitations:

- This slice proves focused encounter-scoped archive/restore from the Encounter workspace. Encounter document lifecycle timeline readiness is covered by Slice 86. Bulk archive/restore, role-based archive authorization, comprehensive audit-log export, scanner routing, route queues, and full historical version rows remain future work.

### Slice 86: Encounter Document Lifecycle Timeline Readiness

Status:

- Implemented as a mutation-capable modernized encounter-scoped document lifecycle timeline readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-86-encounter-document-lifecycle-readiness` plan, which creates a temporary encounter-attached document, checks filed/current-version/review/active lifecycle state, signs it, checks approved lifecycle state, archives it, checks archived lifecycle state, restores it, validates active rendering again, deletes the document, and verifies cleanup on both legacy and modernized targets.

Scope:

- Encounter-attached document API responses now include a normalized `lifecycleEvents` timeline with `filed`, `current-version`, review-state, and active/archive-state events derived from existing persisted document facts.
- The modernized frontend API carries lifecycle event metadata for encounter document attachments.
- The modernized Encounters workspace renders the lifecycle timeline on attached-document cards so users can see filed, version, review, and active/archive state at a glance.
- The modernized smoke test now includes an `encounter document lifecycle timeline` check that creates a temporary text document on `MOD-PAT-0001` encounter `1000013`, verifies pending/active lifecycle codes, signs it, verifies approved lifecycle codes, archives it, verifies archived lifecycle codes, restores it, verifies active lifecycle codes, deletes it, and verifies cleanup.
- The parity workflow reuses `MOD-PAT-0001` encounter `1000013`, derives the expected legacy lifecycle state from existing document fields, verifies the modernized API exposes matching lifecycle event codes and labels, renders the lifecycle timeline in the modernized Encounter attached-document panel, and hard-deletes the temporary document.
- Workbench-managed Slice 86 encounter document lifecycle plan actions are available for both legacy and modernized targets.

Acceptance:

- A newly created temporary encounter-scoped text document yields `filed`, `current-version`, `review-pending`, and `active` lifecycle states.
- Signing the document yields `review-approved` while preserving filed/current-version and active states.
- Archiving the document yields `archived` while preserving filed/current-version and approved review state.
- Restoring the document yields `active` while preserving filed/current-version and approved review state.
- The modernized Encounter attached-document panel renders filed, current-version, review, and active/archive lifecycle facts for the temporary document.
- Hard-delete cleanup restores the seeded patient document count and the seeded encounter-attached document count.
- The side-by-side Slice 86 parity comparison matches.

Current limitations:

- This slice exposes a derived lifecycle timeline from existing document fields. Encounter-scoped external-link attachment is covered by Slice 87. It is not a comprehensive audit-log export and does not yet model every user action, historical version row, scanner-routing state, authorization decision, or route-queue transition.

### Slice 87: Encounter External-Link Document Readiness

Status:

- Implemented as a mutation-capable modernized encounter-scoped external-link document readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-87-encounter-document-external-link-readiness` plan, which creates a temporary encounter-attached web URL document, verifies normalized storage/link facts, renders it, archives it, deletes it, and verifies cleanup on both legacy and modernized targets.

Scope:

- ASP.NET Core now exposes an encounter-scoped external-link document attach endpoint at `/api/encounters/{encounter}/documents/external-link`, reusing the existing patient-document `web_url` storage semantics while resolving the selected encounter's patient server-side.
- The modernized frontend API and Encounters workspace can attach URL-backed encounter documents with category, date, name, URL, and notes from the attached-documents panel.
- Existing encounter attached-document cards render external links with the `LINK` thumbnail, `External link` preview state, URL footnote, and `Open Link` action while keeping replacement disabled for URL-backed records.
- The modernized smoke test now includes an `encounter external-link document lifecycle` check that creates a temporary web URL document on `MOD-PAT-0001` encounter `1000013`, verifies `text/uri-list`, `web_url`, URL, preview, and cleanup behavior.
- The parity workflow reuses `MOD-PAT-0001` encounter `1000013`, creates an equivalent legacy `documents.type = web_url` row, verifies normalized direct-row facts, checks legacy document-category rendering or modernized Encounter card rendering, archives the record, and hard-deletes it.
- Workbench-managed Slice 87 encounter external-link document plan actions are available for both legacy and modernized targets.

Acceptance:

- A newly created temporary encounter-scoped external-link document is attached to the selected encounter and patient on both targets.
- The normalized document facts report category `Medical Record`, MIME type `text/uri-list`, storage method `web_url`, the supplied URL, pending review state, and active document state.
- The modernized Encounter attached-document panel renders the URL-backed document with an external-link preview and an `Open Link` action.
- Archiving hides the document from active encounter document counts while preserving the archived row until hard-delete cleanup.
- Hard-delete cleanup restores the seeded patient document count and the seeded encounter-attached document count.
- The side-by-side Slice 87 parity comparison matches.

Current limitations:

- This slice proves focused encounter-scoped web URL document attachment from the Encounter workspace. Scanner ingestion, external object-storage adapters, route queues, role-based link authorization, link health checks, and comprehensive audit-log export remain future work.

### Slice 88: Patient Image Document Preview Readiness

Status:

- Implemented as a mutation-capable modernized patient image document preview readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-88-document-image-preview-readiness` plan, which creates a temporary image document, verifies normalized inline-preview metadata and byte-preserving content/download behavior, renders it, archives it, deletes it, and verifies cleanup on both legacy and modernized targets.

Scope:

- ASP.NET Core document preview metadata now treats `image/*` documents as `previewKind = image`, `previewStatus = Inline image preview`, thumbnail label `IMG`, and `canPreviewInline = true`.
- Encounter document preview metadata uses the same image inline-readiness contract so encounter-attached image rows do not regress from the patient-document preview rule.
- The modernized Documents viewer renders image document content as an inline `<img>` from the API-provided base64 payload while preserving the existing download action and file/MIME metadata.
- The frontend keeps non-image binary behavior unchanged: generic binary documents still show download-focused metadata, while image documents show the actual preview. PDF inline preview is covered by Slice 90.
- The modernized smoke test now includes a `patient image document preview lifecycle` check that creates a temporary `image/svg+xml` document on `MOD-PAT-0001`, verifies `IMG` thumbnail metadata, inline preview readiness, content retrieval, download content type, byte-for-byte payload preservation, and cleanup.
- The parity workflow creates an equivalent temporary patient image document on both targets, verifies direct-row/content facts, checks legacy document-category rendering or modernized inline image rendering, archives the record, and hard-deletes it.
- Workbench-managed Slice 88 patient image document preview plan actions are available for both legacy and modernized targets.

Acceptance:

- A newly created temporary patient image document is stored on both targets with category `Medical Record`, MIME type `image/svg+xml`, storage method `database`, pending review state, active document state, and matching content bytes.
- Normalized preview metadata reports `image`, `Inline image preview`, `IMG`, `canPreviewInline = true`, and `canDownload = true`.
- The modernized Documents workspace document card renders image-preview readiness, and the Document Viewer renders the image with an accessible image name matching the document name.
- Download returns the original image bytes with an image MIME type.
- Archiving hides the document from active document counts while preserving the archived row until hard-delete cleanup.
- Hard-delete cleanup restores the seeded patient document count.
- The side-by-side Slice 88 parity comparison matches.

Current limitations:

- This slice proves inline image preview readiness for temporary patient image documents and aligns encounter image-preview metadata. It does not yet generate raster thumbnails, integrate scanners, implement OCR, route document work queues, or add external object-storage adapters. PDF inline preview is covered by Slice 90.

### Slice 89: Patient Image Document Thumbnail Readiness

Status:

- Implemented as a mutation-capable modernized patient image document thumbnail readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-89-document-image-thumbnail-readiness` plan, which creates a temporary image document, verifies normalized thumbnail data URI facts, renders the modernized document-card thumbnail, archives it, deletes it, and verifies cleanup on both legacy and modernized targets.

Scope:

- ASP.NET Core patient document list responses now include `thumbnailDataUri` for database-backed `image/*` documents with stored content bytes while leaving text, PDF, external-link, and generic binary documents as label-based thumbnails.
- React Documents cards render a real `<img>` thumbnail when `thumbnailDataUri` is available, preserving the existing fixed thumbnail square and fallback label behavior for other document types.
- Legacy and modernized parity probes/workflow adapters now normalize the same image thumbnail data URI from stored bytes for temporary image documents.
- The modernized smoke test now includes a `patient image document thumbnail readiness` check that proves the created image document list row carries the expected data URI.
- Workbench-managed Slice 89 patient image document thumbnail plan actions are available for both legacy and modernized targets.

Acceptance:

- A newly created temporary patient image document is stored on both targets with matching image bytes and normalized `thumbnailDataUri = data:image/svg+xml;base64,...`.
- The modernized Documents workspace document card renders an accessible thumbnail image whose `src` exactly matches the normalized data URI.
- Non-image document thumbnail behavior remains unchanged.
- Archiving and hard-delete cleanup restore the seeded patient document count.
- The side-by-side Slice 89 parity comparison matches.

Current limitations:

- This slice proves byte-backed image thumbnails for small database-backed patient image documents. It does not yet generate raster thumbnails for PDFs, resize very large images, integrate scanner/OCR pipelines, add document routing queues, or introduce external object-storage adapters.

### Slice 90: Patient PDF Document Inline Preview Readiness

Status:

- Implemented as a mutation-capable modernized patient PDF document inline-preview readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-90-document-pdf-preview-readiness` plan, which creates a temporary PDF document, verifies normalized inline-preview metadata, renders the modernized PDF viewer iframe, downloads the original bytes, archives it, deletes it, and verifies cleanup on both legacy and modernized targets.

Scope:

- ASP.NET Core patient and encounter document preview metadata now treats `application/pdf` documents as `previewKind = pdf`, `previewStatus = Inline PDF preview`, thumbnail label `PDF`, and `canPreviewInline = true`.
- The modernized Documents viewer renders PDF documents in a browser-visible iframe backed by the same byte-preserving `/api/documents/{id}/download` endpoint used by the download action.
- The viewer keeps the PDF file name, preview status, generated binary preview text, byte size, and MIME metadata visible below the iframe.
- Legacy and modernized parity probes normalize the same PDF inline-preview facts for temporary database-backed PDF documents.
- The modernized smoke test now includes a `patient PDF inline preview readiness` check that proves both list and content responses expose the PDF inline-preview contract.
- Workbench-managed Slice 90 patient PDF document preview plan actions are available for both legacy and modernized targets.

Acceptance:

- A newly created temporary patient PDF document is stored on both targets with category `Medical Record`, MIME type `application/pdf`, storage method `database`, pending review state, active document state, and matching content bytes.
- Normalized preview metadata reports `pdf`, `Inline PDF preview`, `PDF`, `canPreviewInline = true`, and `canDownload = true`.
- The modernized Documents workspace document card renders PDF preview readiness, and the Document Viewer renders an accessible PDF iframe whose `src` points at the document download endpoint.
- Download returns the original PDF bytes with a PDF MIME type.
- Archiving hides the document from active document counts while preserving the archived row until hard-delete cleanup.
- Hard-delete cleanup restores the seeded patient document count.
- The side-by-side Slice 90 parity comparison matches.
- The existing Slice 79 encounter binary-document upload plan still matches after the shared PDF preview metadata changes from `Download preview` to `Inline PDF preview`.

Current limitations:

- This slice proves browser-native inline PDF preview for database-backed patient PDF documents. It does not yet generate raster page thumbnails, implement OCR, integrate scanner capture pipelines, add document routing queues, support PDF annotations, or introduce external object-storage adapters.

### Slice 91: Patient Document Lifecycle Timeline Readiness

Status:

- Implemented as a mutation-capable modernized patient document lifecycle timeline readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-91-document-lifecycle-readiness` plan, which creates a temporary patient document, verifies derived lifecycle events, signs it, archives it, restores it, renders lifecycle events in the modernized Documents workspace, deletes it, and verifies cleanup on both legacy and modernized targets.

Scope:

- ASP.NET Core patient document list and content responses now include `lifecycleEvents` derived from existing filed, current-version, review, and active/archive fields.
- React Documents cards and the Document Viewer render the same lifecycle event grid used by encounter-attached documents.
- Lifecycle events currently include `filed`, `current-version`, `review-pending` or `review-approved` or `review-denied`, and `active` or `archived`.
- The modernized smoke test now includes a `patient document lifecycle timeline` check that proves list and viewer responses expose the expected event transitions.
- Workbench-managed Slice 91 patient document lifecycle plan actions are available for both legacy and modernized targets.

Acceptance:

- A newly created temporary patient document is stored on both targets with category `Medical Record`, pending review state, active document state, and matching content preview.
- Initial lifecycle events report filed/current-version/review-pending/active.
- Signing the document as `admin` changes the lifecycle to review-approved while preserving active state.
- Archiving changes the lifecycle to archived and removes the document from active counts while preserving it in archived list views.
- Restoring changes the lifecycle back to active and the modernized Documents workspace card and viewer render the lifecycle labels.
- Hard-delete cleanup restores the seeded patient document count.
- The side-by-side Slice 91 parity comparison matches.

Current limitations:

- This slice exposes a derived patient document lifecycle timeline from current document fields. It is not a comprehensive audit-log export and does not yet model every user action, historical version row, scanner-routing state, authorization decision, route-queue transition, OCR state, or external storage event.

### Slice 92: Patient Scanned Attachment Readiness

Status:

- Implemented as a mutation-capable modernized patient scanned attachment readiness slice under `modernized-openemr/`.
- Verification is the shared `slice-92-document-scanned-attachment-readiness` plan, which creates a temporary scanned PDF patient document, verifies scan-readiness facts, renders them in the modernized Documents workspace, archives and deletes the document, and verifies cleanup on both legacy and modernized targets.

Scope:

- ASP.NET Core patient document list and content responses now include `isScannedAttachment`, `scanStatus`, `captureSource`, `scanPageCount`, and `ocrStatus` derived from existing document metadata and notes.
- React Documents cards render scan-readiness details for scanned attachments, and the Document Viewer renders the same status, capture source, page count, and OCR state.
- Legacy and modernized parity probes normalize the same scan-readiness fields from the temporary document notes and metadata so both targets can be compared without changing permanent seed rows.
- The modernized smoke test now includes a `patient scanned attachment readiness` check that creates a temporary PDF, verifies list/content scan facts, and deletes the document.
- Workbench-managed Slice 92 patient scanned attachment plan actions are available for both legacy and modernized targets.

Acceptance:

- A newly created temporary patient PDF document is stored on both targets with category `Medical Record`, MIME type `application/pdf`, storage method `database`, pending review state, and active document state.
- Normalized scan-readiness metadata reports `Scanned attachment`, capture source `front-desk scanner`, one scanned page, and `OCR pending`.
- The modernized Documents workspace document card and Document Viewer render the same scan-readiness facts.
- Archiving hides the document from active document counts while preserving the archived row until hard-delete cleanup.
- Hard-delete cleanup restores the seeded patient document count.
- The side-by-side Slice 92 parity comparison matches.

Current limitations:

- This slice derives scan readiness from document metadata and notes. It does not implement scanner-device ingestion, OCR text extraction, scan queues, DICOM/TWAIN/WIA integration, multi-page image splitting, barcode routing, or external storage adapters.

### Slice 93: Appointment Reschedule Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-93-appointment-reschedule-readiness` plan, which creates a temporary future appointment, updates the schedule fields, renders the changed appointment, deletes it, and verifies cleanup on both legacy and modernized targets.

Scope:

- ASP.NET Core appointment APIs now include a full appointment update endpoint for title, date, start time, duration, facility/category defaults, room, and status.
- React Calendar appointment detail now exposes reschedule controls using the existing appointment edit panel style.
- Legacy and modernized parity workflow adapters share an `updateAppointment` action so the same Playwright suite can drive both systems.
- The modernized smoke test now includes an `appointment reschedule lifecycle` check that creates, updates, verifies, and deletes a temporary appointment.
- Workbench-managed Slice 93 appointment reschedule plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary appointment for `MOD-PAT-0003` can be created, rescheduled to `2026-10-22` at `14:15` for 45 minutes, marked with status `@`, moved to room `Resched`, rendered, and deleted.
- Direct database probes normalize the updated date, start/end time, status, and room for both MariaDB and PostgreSQL.
- The modernized Calendar workspace renders the rescheduled title, date, time, duration, room, and status.
- Hard-delete cleanup restores the seeded appointment count.
- The side-by-side Slice 93 parity comparison matches.

Current limitations:

- This slice covers focused single-appointment updates. Recurring-series propagation, provider availability validation, resource conflict checks, waitlist behavior, reminders, and encounter/billing conversion remain deferred.

### Slice 94: Appointment Arrival Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-94-appointment-arrival-readiness` plan, which creates a temporary future appointment, marks it arrived, renders the arrived appointment, deletes it, and verifies cleanup on both legacy and modernized targets.

Scope:

- React Calendar appointment detail now exposes a focused `Mark arrived` action for the selected future appointment.
- The action uses the existing ASP.NET Core appointment status endpoint and OpenEMR-compatible arrived status `@`.
- The shared parity suite drives the modernized Calendar button, verifies the normalized appointment row, checks legacy appointment edit rendering, and deletes the temporary appointment.
- The modernized smoke test now includes an `appointment arrival lifecycle` check that creates, marks arrived, verifies, and deletes a temporary appointment.
- Workbench-managed Slice 94 appointment arrival plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary appointment for `MOD-PAT-0003` can be created for `2026-10-29` at `09:00`, marked arrived with status `@`, rendered in room `Arrival`, and deleted.
- Direct database probes normalize the arrived title, date, start/end time, status, and room for both MariaDB and PostgreSQL.
- The modernized Calendar workspace renders the selected appointment, performs the `Mark arrived` action, disables the action once status is `@`, and shows the arrived title/status.
- Hard-delete cleanup restores the seeded appointment count.
- The side-by-side Slice 94 parity comparison matches.

Current limitations:

- This slice covers the focused appointment arrival/check-in status transition only. Appointment no-show is covered by Slice 96; recurring-series propagation, provider availability validation, resource conflict checks, waitlist behavior, reminders, and encounter/billing conversion remain deferred.

### Slice 95: Appointment Check-Out Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-95-appointment-checkout-readiness` plan, which creates a temporary future appointment, marks it arrived, checks it out, renders the checked-out appointment, deletes it, and verifies cleanup on both legacy and modernized targets.

Scope:

- React Calendar appointment detail now exposes a focused `Mark checked out` action for the selected future appointment.
- The action uses the existing ASP.NET Core appointment status endpoint and OpenEMR-compatible checked-out status `>`.
- The shared parity suite drives the modernized Calendar arrival and check-out buttons, verifies the normalized appointment row, checks legacy appointment edit rendering, and deletes the temporary appointment.
- The modernized smoke test now includes an `appointment check-out lifecycle` check that creates, marks arrived, checks out, verifies, and deletes a temporary appointment.
- Workbench-managed Slice 95 appointment check-out plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary appointment for `MOD-PAT-0003` can be created for `2026-11-05` at `11:00`, marked arrived with status `@`, checked out with status `>`, rendered in room `Checkout`, and deleted.
- Direct database probes normalize the checked-out title, date, start/end time, status, and room for both MariaDB and PostgreSQL.
- The modernized Calendar workspace renders the selected appointment, performs the `Mark arrived` and `Mark checked out` actions, disables each action once the matching status is reached, and shows the checked-out title/status.
- Hard-delete cleanup restores the seeded appointment count.
- The side-by-side Slice 95 parity comparison matches.

Current limitations:

- This slice covers the focused appointment check-out status transition only. Appointment no-show is covered by Slice 96; recurring-series propagation, provider availability validation, resource conflict checks, waitlist behavior, reminders, and encounter/billing conversion remain deferred.

### Slice 96: Appointment No-Show Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-96-appointment-noshow-readiness` plan, which creates a temporary future appointment, marks it no-show, renders the no-show appointment, deletes it, and verifies cleanup on both legacy and modernized targets.

Scope:

- React Calendar appointment detail now exposes a focused `Mark no-show` action for the selected future appointment.
- The action uses the existing ASP.NET Core appointment status endpoint and OpenEMR-compatible no-show status `?`.
- The shared parity suite drives the modernized Calendar no-show button, verifies the normalized appointment row, checks legacy appointment edit rendering, and deletes the temporary appointment.
- The modernized smoke test now includes an `appointment no-show lifecycle` check that creates, marks no-show, verifies, and deletes a temporary appointment.
- Workbench-managed Slice 96 appointment no-show plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary appointment for `MOD-PAT-0003` can be created for `2026-11-12` at `13:00`, marked no-show with status `?`, rendered in room `NoShow`, and deleted.
- Direct database probes normalize the no-show title, date, start/end time, status, and room for both MariaDB and PostgreSQL.
- The modernized Calendar workspace renders the selected appointment, performs the `Mark no-show` action, disables arrival, check-out, and no-show actions once status is `?`, and shows the no-show title/status.
- Hard-delete cleanup restores the seeded appointment count.
- The side-by-side Slice 96 parity comparison matches.

Current limitations:

- This slice covers the focused appointment no-show status transition only. Appointment category preservation and rendering is covered by Slice 97; recurring-series propagation, provider availability validation, resource conflict checks, waitlist behavior, reminders, and encounter/billing conversion remain deferred.

### Slice 97: Appointment Category Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-97-appointment-category-readiness` plan, which creates a temporary future appointment with a non-default category, renders the category, updates it, deletes the appointment, and verifies cleanup on both legacy and modernized targets.

Scope:

- ASP.NET Core appointment list/detail responses now expose `categoryName` alongside the persisted `categoryId`.
- The modernized Calendar create and reschedule forms now allow category selection for the seeded OpenEMR scheduling categories: `9` Established Patient, `10` New Patient, and `13` Preventive Care Services.
- Legacy and modernized workflow adapters now preserve appointment category ids during create/update and normalize category names for parity assertions.
- The shared parity suite verifies the legacy `form_category` dropdown, the modernized Calendar category rendering/edit control, direct database facts, and cleanup.
- The modernized smoke test now includes an `appointment category lifecycle` check that creates category `13`, updates to category `10`, verifies category labels, and deletes the temporary appointment.
- Workbench-managed Slice 97 appointment category plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary appointment for `MOD-PAT-0003` can be created for `2026-11-19` at `09:15` with category `13` Preventive Care Services, rendered, updated to category `10` New Patient, and deleted.
- Direct database probes normalize the title, date, start/end time, status, room, `categoryId`, and `categoryName` for both MariaDB and PostgreSQL.
- The legacy appointment edit form shows `form_category = 13` after create and `form_category = 10` after update.
- The modernized Calendar workspace renders the selected appointment category, exposes category selection in create/reschedule forms, saves category changes, and shows `New Patient (10)` after update.
- Hard-delete cleanup restores the seeded appointment count.
- The side-by-side Slice 97 parity comparison matches.

Current limitations:

- This slice covers explicit category preservation and rendering only. Pending-status update/rendering is covered by Slice 98, provider reassignment rendering/editing is covered by Slice 99, facility reassignment rendering/editing is covered by Slice 100, and billing-location reassignment rendering/editing is covered by Slice 101; recurring-series propagation, provider availability validation, resource conflict checks, waitlist behavior, reminders, and encounter/billing conversion remain deferred.

### Slice 98: Appointment Pending Status Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-98-appointment-pending-readiness` plan, which creates a temporary future appointment, updates it to OpenEMR-compatible pending status `~`, renders the pending appointment, deletes it, and verifies cleanup on both legacy and modernized targets.

Scope:

- The modernized Calendar reschedule/edit form already exposes the OpenEMR-compatible `Pending` status option with persisted value `~`.
- The shared parity suite drives the modernized Calendar edit form, verifies the legacy `form_apptstatus` dropdown, checks normalized database facts, and deletes the temporary appointment.
- The modernized smoke test now includes an `appointment pending-status lifecycle` check that creates, updates to pending, verifies, and deletes a temporary appointment.
- Workbench-managed Slice 98 appointment pending-status plan actions are available for both legacy and modernized targets.

Acceptance:

- A temporary appointment for `MOD-PAT-0003` can be created for `2026-11-26` at `10:45`, updated to pending status `~`, rendered in room `Pending`, and deleted.
- Direct database probes normalize the pending title, date, start/end time, status, and room for both MariaDB and PostgreSQL.
- The legacy appointment edit form shows `form_apptstatus = ~` after update.
- The modernized Calendar workspace renders the selected appointment, exposes the `Pending` status option in the edit form, saves status `~`, and shows the pending title/status.
- Hard-delete cleanup restores the seeded appointment count.
- The side-by-side Slice 98 parity comparison matches.

Current limitations:

- This slice covers the focused appointment pending-status transition only. Recurring-series propagation, provider availability validation, resource conflict checks, waitlist behavior, reminders, and encounter/billing conversion remain deferred.

### Slice 99: Appointment Provider Reassignment Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-99-appointment-provider-readiness` plan, which creates a temporary future appointment, reassigns it from provider `101` to provider `102`, renders the reassigned provider, deletes it, and verifies cleanup on both legacy and modernized targets.

Scope:

- The modernized appointment APIs now return `providerId` and `facilityId` in list and detail responses so scheduling ownership can be asserted without relying only on display names.
- The modernized Calendar create/edit forms expose provider and facility ID controls, persist reassignment through the existing appointment update endpoint, and show provider/facility IDs in the care-location detail panel.
- The shared parity suite drives the modernized Calendar edit form, verifies the legacy provider control on the OpenEMR appointment edit screen, checks normalized database facts, and deletes the temporary appointment.
- The modernized smoke test now includes an `appointment provider reassignment lifecycle` check that creates, updates provider/facility IDs, verifies, and deletes a temporary appointment.
- Workbench-managed Slice 99 appointment provider reassignment plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating or loading an appointment returns provider and facility IDs when present.
- Updating a future appointment can change provider assignment while preserving patient, category, status, date/time, and cleanup behavior.
- The modernized Calendar workspace renders the selected appointment, exposes editable provider/facility ID controls, saves the reassigned provider, and shows the updated care-location facts.
- The legacy parity path verifies the provider dropdown state for the same temporary appointment.
- Hard-delete cleanup restores the seeded appointment count.
- The side-by-side Slice 99 parity comparison matches.

Current limitations:

- This slice covers focused appointment provider reassignment only. Provider availability validation, resource conflict checks, recurring-series propagation, waitlist behavior, reminders, and encounter/billing conversion remain deferred.

### Slice 100: Appointment Facility Reassignment Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-100-appointment-facility-readiness` plan, which creates a temporary future appointment, reassigns it from facility `10` to facility `11`, renders the reassigned facility, deletes it, and verifies cleanup on both legacy and modernized targets.

Scope:

- The slice reuses the provider and facility IDs exposed by the appointment APIs in Slice 99 so facility ownership can be asserted directly.
- The modernized Calendar create/edit forms persist facility ID changes through the appointment update endpoint and show updated facility facts in the selected appointment detail panel.
- The shared parity suite verifies the legacy `facility` select on the OpenEMR appointment edit screen, the modernized `Edit appointment facility ID` control, normalized appointment facts, and hard-delete cleanup.
- The modernized smoke test now includes an `appointment facility reassignment lifecycle` check that creates, updates, verifies, and deletes a temporary appointment.
- Workbench-managed Slice 100 appointment facility reassignment plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating or loading an appointment returns the facility ID when present.
- Updating a future appointment can change facility assignment while preserving patient, provider, category, status, date/time, and cleanup behavior.
- The modernized Calendar workspace renders the selected appointment, exposes the editable facility ID control, saves the reassigned facility, and shows the updated care-location facts.
- The legacy parity path verifies the facility dropdown state for the same temporary appointment.
- Hard-delete cleanup restores the seeded appointment count.
- The side-by-side Slice 100 parity comparison matches.

Current limitations:

- This slice covers focused appointment facility reassignment only. Billing-location separation is covered by Slice 101; facility availability validation, resource conflict checks, recurring-series propagation, waitlist behavior, reminders, and encounter/billing conversion remain deferred.

### Slice 101: Appointment Billing-Location Reassignment Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-101-appointment-billing-location-readiness` plan, which creates a temporary future appointment, keeps service facility `10`, reassigns billing location from `10` to `11`, renders both facility values, deletes the appointment, and verifies cleanup on both legacy and modernized targets.

Scope:

- The modernized PostgreSQL appointment seed schema now carries `billing_location_id` separately from `facility_id`, defaulting seeded records to the service facility until a workflow explicitly changes billing location.
- The modernized appointment APIs return `billingLocationId` and `billingLocationName` in list and detail responses, and accept `billingLocationId` in create/update requests.
- The modernized Calendar create/edit forms expose billing facility ID controls independently from service facility ID, and the care-location detail panel shows billing facility alongside provider, facility, and category.
- The shared parity suite verifies the legacy `facility` and `billing_facility` controls on the OpenEMR appointment edit screen, the modernized `Edit appointment billing facility ID` control, normalized appointment facts, and hard-delete cleanup.
- The modernized smoke test now includes an `appointment billing-location reassignment lifecycle` check that creates, updates, verifies, and deletes a temporary appointment.
- Workbench-managed Slice 101 appointment billing-location reassignment plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating or loading an appointment returns separate service facility and billing location IDs when present.
- Updating a future appointment can change billing location while preserving patient, provider, service facility, category, status, date/time, and cleanup behavior.
- The modernized Calendar workspace renders the selected appointment, exposes the editable billing facility ID control, saves the reassigned billing location, and shows the updated care-location facts.
- The legacy parity path verifies the service facility dropdown and billing facility dropdown state for the same temporary appointment.
- Hard-delete cleanup restores the seeded appointment count.
- The side-by-side Slice 101 parity comparison matches.

Current limitations:

- This slice covers focused appointment billing-location reassignment only. Appointment comments are covered by Slice 102 and regular recurrence metadata is covered by Slice 103; billing rules, facility availability validation, resource conflict checks, recurring-series propagation, waitlist behavior, reminders, and encounter/billing conversion remain deferred.

### Slice 102: Appointment Comments Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-102-appointment-comments-readiness` plan, which creates a temporary future appointment, updates its scheduling comments, renders those comments, deletes the appointment, and verifies cleanup on both legacy and modernized targets.

Scope:

- The canonical gold dataset generator now treats appointment comments as a first-class appointment property, and the modernized PostgreSQL appointment seed schema maps that value into an appointment `comments` column.
- The modernized appointment APIs return `comments` in list and detail responses, and accept `comments` in create/update requests.
- The modernized Calendar create/edit forms expose comments controls, and the schedule detail panel renders the saved comments.
- The shared parity suite verifies the legacy `form_comments` control on the OpenEMR appointment edit screen, the modernized `Edit appointment comments` control, normalized appointment facts, and hard-delete cleanup.
- The modernized smoke test now includes an `appointment comments lifecycle` check that creates, updates, verifies, and deletes a temporary appointment.
- Workbench-managed Slice 102 appointment comments plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating or loading an appointment returns scheduling comments when present.
- Updating a future appointment can change comments while preserving patient, provider, facility, billing location, category, status, date/time, and cleanup behavior.
- The modernized Calendar workspace renders the selected appointment, exposes the editable comments control, saves the updated comments, and shows the updated comments in the detail panel.
- The legacy parity path verifies the `form_comments` field for the same temporary appointment.
- Hard-delete cleanup restores the seeded appointment count.
- The side-by-side Slice 102 parity comparison matches.

Current limitations:

- This slice covers focused appointment comments only. Appointment recurrence metadata is covered by Slice 103; comment history, billing rules, facility availability validation, resource conflict checks, recurring-series propagation, waitlist behavior, reminders, and encounter/billing conversion remain deferred.

### Slice 103: Appointment Recurrence Metadata Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-103-appointment-recurrence-readiness` plan, which creates a temporary future appointment with regular repeat metadata, updates its repeat cadence and end date, renders those fields, deletes the appointment, and verifies cleanup on both legacy and modernized targets.

Scope:

- The canonical gold dataset generator now includes deterministic regular recurrence metadata anchors for a subset of seeded preventive-care appointments.
- The legacy seed projection maps recurrence metadata to OpenEMR `pc_recurrtype`, serialized `pc_recurrspec`, and `pc_endDate` fields.
- The modernized PostgreSQL appointment seed schema stores recurrence type, repeat frequency, repeat unit, and recurrence end date.
- The modernized appointment APIs return recurrence fields plus a human-readable recurrence label in list and detail responses, and accept recurrence fields in create/update requests.
- The modernized Calendar create/edit forms expose repeat controls, and the schedule detail panel renders the recurrence label.
- The shared parity suite verifies the legacy `form_repeat`, `form_repeat_freq`, `form_repeat_type`, and `form_enddate` controls, the modernized repeat controls, normalized appointment recurrence facts, and hard-delete cleanup.
- The modernized smoke test now includes an `appointment recurrence metadata lifecycle` check that creates, updates, verifies, and deletes a temporary appointment.
- Workbench-managed Slice 103 appointment recurrence plan actions are available for both legacy and modernized targets.

Acceptance:

- Creating or loading an appointment returns recurrence metadata when present.
- Updating a future appointment can change repeat frequency and end date while preserving patient, provider, facility, billing location, category, status, date/time, comments, and cleanup behavior.
- The modernized Calendar workspace renders the selected appointment, exposes editable repeat controls, saves the updated recurrence metadata, and shows the recurrence label in the detail panel.
- The legacy parity path verifies the equivalent OpenEMR repeat controls for the same temporary appointment.
- Hard-delete cleanup restores the seeded appointment count.
- The side-by-side Slice 103 parity comparison matches.

Current limitations:

- This slice covers regular appointment recurrence metadata preservation and rendering only. Recurring-series read expansion is covered by Slice 104, and monthly interval recurrence is covered by Slice 112. It does not update an expanded recurring series beyond the covered slice paths, cover monthly repeat-on rules, support days-of-week recurrence editing, validate provider availability/resource conflicts, send reminders, manage waitlists, or convert appointments into encounters/billing.

### Slice 104: Appointment Recurring Series Readiness

Status:

- Implemented as a read-only modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-104-appointment-series-readiness` plan, which expands seeded regular recurring appointment anchors into dated occurrences and verifies the modernized Calendar generated-occurrence rendering.

Scope:

- The modernized appointment search API expands stored recurrence metadata into virtual occurrences without duplicating appointment rows in PostgreSQL.
- Virtual occurrence IDs use the root appointment ID plus an occurrence date, and detail lookup validates that requested virtual dates belong to the stored recurrence series.
- Appointment list/detail responses identify the series root, generated occurrence state, and occurrence number.
- The modernized Calendar list labels generated occurrences and the detail panel shows occurrence/root facts.
- Generated occurrence actions are read-only in this slice; root-appointment mutation remains available through the root appointment entry.
- The shared parity suite expands the seeded `MOD-PAT-0003` preventive-care recurrence anchor from `2026-08-14` through `2026-10-09` on both targets and verifies the modernized Calendar rendering.
- The modernized smoke test now includes an `appointment recurring series expansion` check.
- Workbench-managed Slice 104 appointment recurring-series plan actions are available for both legacy and modernized targets.

Acceptance:

- Searching from a date inside a seeded regular recurrence range returns generated occurrences on or after the requested date.
- The generated occurrence dates, recurrence cadence, recurrence end date, occurrence number, and series-root identity match the legacy recurrence metadata expansion.
- Selecting a generated occurrence in the modernized Calendar opens detail for that occurrence date and labels it as a generated occurrence.
- Mutating generated occurrences is disabled until an individual-occurrence propagation/exception slice is implemented.
- The side-by-side Slice 104 parity comparison matches.

Current limitations:

- This slice covers read-only expansion for regular recurrence metadata. Seeded exception-date skipping is covered by Slice 105, and monthly interval recurrence is covered by Slice 112. It does not support monthly repeat-on rules, days-of-week recurrence editing, provider availability/resource conflicts, reminders, waitlists, or appointment-to-encounter/billing conversion.

### Slice 105: Appointment Recurrence Exceptions Readiness

Status:

- Implemented as a read-only modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-105-appointment-recurrence-exceptions-readiness` plan, which expands seeded recurring appointment metadata while skipping OpenEMR `exdate` exception dates.

Scope:

- The canonical gold dataset now marks `APPT-MOD-PAT-0013-3` with a single recurrence exception date, `2026-12-16`.
- The legacy seed projection serializes that exception into `openemr_postcalendar_events.pc_recurrspec` as `exdate`.
- The modernized PostgreSQL seed stores recurrence exception dates in `appointments.recurrence_exdates`.
- The modernized appointment APIs expose `recurrenceExdates` and `recurrenceExceptionCount`, skip exception dates during virtual occurrence expansion, and reject detail lookup for excluded virtual dates.
- The modernized Calendar renders skipped-date metadata. Generated occurrence mutation is introduced in Slice 106 for occurrence cancellation and Slice 107 for skipped-occurrence restoration.
- The shared parity suite verifies that the `MOD-PAT-0013` preventive-care series returns `2026-12-02`, `2026-12-30`, `2027-01-13`, and `2027-01-27`, preserving occurrence numbers `3`, `5`, `6`, and `7` while skipping `2026-12-16`.
- The modernized smoke test now includes an `appointment recurrence exception expansion` check.
- Workbench-managed Slice 105 appointment recurrence-exceptions plan actions are available for both legacy and modernized targets.

Acceptance:

- Searching from a date inside a seeded recurrence range skips any `exdate` occurrences on both targets.
- The skipped date remains visible as recurrence metadata in the modernized Calendar detail view.
- Occurrence numbers continue to reflect the original recurrence series positions rather than renumbering after a skipped date.
- The side-by-side Slice 105 parity comparison matches.

Current limitations:

- This slice covers read-only seeded exception-date expansion only. Generated occurrence cancellation through new exception dates is covered by Slice 106, generated occurrence restoration through exception-date removal is covered by Slice 107, generated occurrence rescheduling is covered by Slice 108, direct recurrence exception-list editing is covered by Slice 109, recurring root title/time propagation is covered by Slice 110, recurring root metadata propagation is covered by Slice 111, and monthly interval recurrence is covered by Slice 112. It does not cover monthly repeat-on rules, days-of-week recurrence editing, provider availability/resource conflicts, reminders, waitlists, or appointment conversion into encounters/billing.

### Slice 106: Appointment Occurrence Cancel Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-106-appointment-occurrence-cancel-readiness` plan, which cancels one generated recurring appointment occurrence by appending a recurrence exception date and restoring the seeded exception list during cleanup.

Scope:

- The modernized appointment `DELETE` endpoint now distinguishes root appointment IDs from virtual occurrence IDs.
- Deleting a root appointment still deletes the appointment row, while deleting a generated occurrence ID appends that occurrence date to `appointments.recurrence_exdates` after validating that the date belongs to the recurrence series.
- The modernized Calendar enables generated occurrence cancellation with a `Skip occurrence` action and keeps broader generated occurrence editing disabled.
- The legacy parity workflow mutates the same `pc_recurrspec` `exdate` field so both targets exercise the same recurrence exception behavior.
- The shared parity suite cancels the generated `2026-12-30` occurrence on the seeded `MOD-PAT-0013` preventive-care series, verifies remaining occurrences `2026-12-02`, `2027-01-13`, and `2027-01-27`, preserves occurrence numbers `3`, `6`, and `7`, and restores the original seeded `2026-12-16` exception date.
- The modernized smoke test now includes an `appointment occurrence cancellation exception` check.
- Workbench-managed Slice 106 appointment occurrence-cancel plan actions are available for both legacy and modernized targets.

Acceptance:

- Deleting a generated occurrence creates a recurrence exception date instead of deleting the series root.
- The cancelled occurrence disappears from subsequent generated series expansion on both targets.
- Existing occurrence numbers remain tied to their original series positions after the new skipped date.
- The seeded recurrence exception list is restored after mutation tests, keeping the gold dataset stable for later slices.
- The side-by-side Slice 106 parity comparison matches.

Current limitations:

- This slice covers cancelling/skipping a generated occurrence only. Restoring a skipped generated occurrence is covered by Slice 107, rescheduling an individual generated occurrence is covered by Slice 108, editing the recurrence exception-date list is covered by Slice 109, recurring root title/time propagation is covered by Slice 110, recurring root metadata propagation is covered by Slice 111, and monthly interval recurrence is covered by Slice 112. It does not cover monthly repeat-on rules, days-of-week recurrence editing, provider availability/resource conflicts, reminders, waitlists, or appointment conversion into encounters/billing.

### Slice 107: Appointment Occurrence Restore Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-107-appointment-occurrence-restore-readiness` plan, which restores one skipped generated recurring appointment occurrence by removing a recurrence exception date and preserving the seeded exception list during cleanup.

Scope:

- The modernized appointment API now exposes `POST /api/appointments/{appointmentId}/recurrence-exceptions/{occurrenceDate}/restore`.
- The restore path validates that the requested date is currently skipped, removes it from `appointments.recurrence_exdates`, verifies the date belongs to the recurrence series after removal, normalizes the exception list, and returns the updated series root.
- The modernized Calendar renders each skipped date with a compact `Restore occurrence` action in the schedule detail panel.
- The shared parity suite temporarily skips generated occurrence `2026-12-30` on the seeded `MOD-PAT-0013` preventive-care series, restores it through the legacy `pc_recurrspec` `exdate` field or the modernized Calendar/API path, verifies generated dates `2026-12-02`, `2026-12-30`, `2027-01-13`, and `2027-01-27`, preserves occurrence numbers `3`, `5`, `6`, and `7`, and restores the original seeded `2026-12-16` exception list.
- The modernized smoke test now includes an `appointment occurrence restore exception` check.
- Workbench-managed Slice 107 appointment occurrence-restore plan actions are available for both legacy and modernized targets.

Acceptance:

- Removing a generated occurrence exception restores the skipped occurrence to subsequent series expansion on both targets.
- Existing occurrence numbers remain tied to their original series positions after the restoration.
- The modernized Calendar gives operators a visible restore action for skipped dates while keeping broader generated occurrence editing disabled.
- The seeded recurrence exception list is restored after mutation tests, keeping the gold dataset stable for later slices.
- The side-by-side Slice 107 parity comparison matches.

Current limitations:

- This slice covers restoring a skipped generated occurrence by removing one recurrence exception date. Rescheduling an individual generated occurrence into a standalone appointment is covered by Slice 108, editing the recurrence exception-date list is covered by Slice 109, recurring root title/time propagation is covered by Slice 110, recurring root metadata propagation is covered by Slice 111, and monthly interval recurrence is covered by Slice 112. It does not cover monthly repeat-on rules, days-of-week recurrence editing, provider availability/resource conflicts, reminders, waitlists, or appointment conversion into encounters/billing.

### Slice 108: Appointment Occurrence Reschedule Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-108-appointment-occurrence-reschedule-readiness` plan, which moves one generated recurring appointment occurrence into a standalone appointment while preserving recurrence-series numbering and restoring seeded cleanup state.

Scope:

- The modernized appointment API now exposes `POST /api/appointments/{appointmentId}/occurrences/{occurrenceDate}/reschedule`.
- The reschedule path validates that the requested generated occurrence belongs to the recurrence series, appends the original occurrence date to `appointments.recurrence_exdates`, inserts a non-recurring standalone appointment row at the requested date/time, and returns the standalone appointment detail.
- The modernized Calendar enables the existing edit panel for generated occurrences as `Reschedule occurrence`, disables repeat controls in that mode, and keeps the broader series/root update path separate.
- The shared parity suite reschedules generated occurrence `2026-12-30` on the seeded `MOD-PAT-0013` preventive-care series to a standalone `2027-01-06 14:00` appointment, verifies remaining generated dates `2026-12-02`, `2027-01-13`, and `2027-01-27`, preserves occurrence numbers `3`, `6`, and `7`, verifies the standalone preventive-care appointment, and restores the original seeded `2026-12-16` exception list.
- The modernized smoke test now includes an `appointment occurrence reschedule exception` check.
- Workbench-managed Slice 108 appointment occurrence-reschedule plan actions are available for both legacy and modernized targets.

Acceptance:

- Rescheduling a generated occurrence creates a standalone appointment for the new date/time instead of mutating the whole recurring series.
- The original generated occurrence date is skipped through a recurrence exception on both targets.
- Existing occurrence numbers remain tied to their original series positions after the move.
- The seeded recurrence exception list and temporary standalone appointment are cleaned up after mutation tests, keeping the gold dataset stable for later slices.
- The side-by-side Slice 108 parity comparison matches.

Current limitations:

- This slice covers one generated occurrence move into a standalone appointment. Direct recurrence exception-list editing is covered by Slice 109, recurring root title/time propagation is covered by Slice 110, recurring root metadata propagation is covered by Slice 111, and monthly interval recurrence is covered by Slice 112. It does not cover monthly repeat-on rules, days-of-week recurrence editing, provider availability/resource conflicts, reminders, waitlists, or appointment conversion into encounters/billing.

### Slice 109: Appointment Recurrence Exception Edit Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-109-appointment-recurrence-exception-edit-readiness` plan, which edits the skipped-date list on a recurring appointment root, verifies generated occurrence expansion, and restores the seeded exception list.

Scope:

- The modernized Calendar edit form now exposes a `Skipped dates` field for recurring appointment roots.
- The root appointment update path parses comma, semicolon, and whitespace separated `YYYY-MM-DD` values, normalizes them, and sends the resulting recurrence exception-date list through the existing appointment update API.
- The shared parity suite edits the seeded `MOD-PAT-0013` preventive-care series by adding `2026-12-30` beside the seeded `2026-12-16` exception, verifies that the generated `2026-12-30` occurrence disappears while occurrence numbers remain tied to original series positions, and restores the original seeded exception list.
- The modernized smoke test now includes an `appointment recurrence exception-list edit` check with cleanup restoration.
- Workbench-managed Slice 109 appointment recurrence exception-edit plan actions are available for both legacy and modernized targets.

Acceptance:

- A recurring appointment root can persist an edited recurrence exception-date list on both targets.
- The edited exception list immediately changes generated occurrence expansion.
- Existing occurrence numbers remain tied to their original series positions after the additional skip.
- The seeded recurrence exception list is restored after mutation tests, keeping the gold dataset stable for later slices.
- The side-by-side Slice 109 parity comparison matches.

Current limitations:

- This slice covers direct exception-date list editing on a recurring appointment root. Recurring root title/time propagation is covered by Slice 110, root metadata propagation is covered by Slice 111, and monthly interval recurrence is covered by Slice 112. It does not cover monthly repeat-on rules, support days-of-week recurrence editing, validate provider availability/resource conflicts, send reminders, manage waitlists, or convert appointments into encounters/billing.

### Slice 110: Appointment Series Root Update Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-110-appointment-series-root-update-readiness` plan, which edits a recurring appointment root, verifies generated occurrence title/time propagation, and restores the seeded root.

Scope:

- The modernized appointment update path already updates recurring root fields through the standard appointment edit API, and generated occurrences inherit root title and start time from API expansion.
- The modernized recurring-series workflow adapter now normalizes list `startTime` values to the same `HH:mm:ss` shape used by detail records and legacy probes.
- The shared parity suite edits the seeded `MOD-PAT-0013` preventive-care root on `2026-11-04`, changes title to `Preventive Care Root Update`, changes start time to `16:15`, verifies generated dates `2026-11-04`, `2026-11-18`, `2026-12-02`, `2026-12-30`, `2027-01-13`, and `2027-01-27`, preserves occurrence numbers `1`, `2`, `3`, `5`, `6`, and `7`, and restores the original seeded root title/time and `2026-12-16` exception list.
- The modernized Calendar UI path is exercised for the modernized target by editing the recurring root with `Save schedule` and verifying the generated `2026-11-18` occurrence reflects the updated title/time.
- The modernized smoke test now includes an `appointment series root update propagation` check with cleanup restoration.
- Workbench-managed Slice 110 appointment series root update plan actions are available for both legacy and modernized targets.

Acceptance:

- Updating a recurring appointment root title and start time propagates to generated future occurrences on both targets.
- Seeded exception dates remain stable while root fields change.
- Existing occurrence numbers remain tied to their original series positions after the root update.
- The seeded root title/time and exception list are restored after mutation tests, keeping the gold dataset stable for later slices.
- The side-by-side Slice 110 parity comparison matches.

Current limitations:

- This slice covers recurring root title and start-time propagation only. Recurring root provider, facility, billing-location, category, status, room, and comments metadata propagation is covered by Slice 111, and monthly interval recurrence is covered by Slice 112. It does not cover monthly repeat-on rules, days-of-week recurrence editing, provider availability/resource conflicts, reminders, waitlists, or appointment conversion into encounters/billing.

### Slice 111: Appointment Series Root Metadata Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-111-appointment-series-root-metadata-readiness` plan, which edits recurring appointment root metadata, verifies generated occurrence propagation, and restores the seeded root.

Scope:

- The shared parity suite edits the seeded `MOD-PAT-0013` preventive-care root on `2026-11-04`, changes provider to `101`, service facility to `10`, billing facility to `10`, category to `10`, status to `~`, room to `Series Meta`, and comments to `Slice 111 recurring root metadata propagation check.`.
- The workflow verifies generated dates `2026-11-04`, `2026-11-18`, `2026-12-02`, `2026-12-30`, `2027-01-13`, and `2027-01-27`, preserves occurrence numbers `1`, `2`, `3`, `5`, `6`, and `7`, and confirms every generated occurrence exposes the updated root metadata.
- The modernized Calendar UI path is exercised for the modernized target by editing the recurring root provider, facility, billing location, category, status, room, and comments with `Save schedule`, then opening the generated `2026-11-18` occurrence.
- The modernized smoke test now includes an `appointment series root metadata propagation` check with cleanup restoration.
- Workbench-managed Slice 111 appointment series root metadata plan actions are available for both legacy and modernized targets.

Acceptance:

- Updating recurring appointment root metadata propagates provider, facility, billing location, category, status, room, and comments to generated future occurrences on both targets.
- Seeded exception dates remain stable while root metadata changes.
- Existing occurrence numbers remain tied to their original series positions after the root metadata update.
- The seeded root metadata and exception list are restored after mutation tests, keeping the gold dataset stable for later slices.
- The side-by-side Slice 111 parity comparison matches.

Current limitations:

- This slice covers root metadata propagation for the already-supported fields only. Monthly interval recurrence is covered by Slice 112. It does not cover monthly repeat-on rules, days-of-week recurrence editing, provider availability/resource conflicts, reminders, waitlists, or appointment conversion into encounters/billing.

### Slice 112: Appointment Monthly Recurrence Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-112-appointment-monthly-recurrence-readiness` plan, which creates a monthly recurring appointment, updates it to every two months, verifies generated occurrence expansion, renders the workflow, and removes the temporary appointment.

Scope:

- The shared parity suite creates a temporary `MOD-PAT-0003` appointment on `2026-12-15` with monthly recurrence ending `2027-04-15`.
- The workflow verifies initial generated dates `2026-12-15`, `2027-01-15`, `2027-02-15`, `2027-03-15`, and `2027-04-15`, then updates the cadence to every two months through `2027-08-15`.
- The legacy path verifies OpenEMR repeat controls for repeat frequency `2`, repeat unit `Month`, and the updated end date in the appointment editor.
- The modernized Calendar path verifies repeat labels, edit controls, the generated `2027-02-15` occurrence, and the `Generated occurrence 2` rendering.
- The modernized smoke test now includes an `appointment monthly recurrence lifecycle` check with self-cleaning create/update/delete behavior.
- Workbench-managed Slice 112 appointment monthly recurrence plan actions are available for both legacy and modernized targets.

Acceptance:

- Monthly interval appointment recurrence can be created, expanded, updated, rendered, and removed on both targets.
- Updating the recurring root from monthly to every two months changes generated dates to `2026-12-15`, `2027-02-15`, `2027-04-15`, `2027-06-15`, and `2027-08-15`.
- Occurrence numbers stay tied to the original monthly series positions for the generated rows being displayed.
- The temporary monthly appointment is hard-deleted during cleanup, keeping seeded appointment counts stable.
- The side-by-side Slice 112 parity comparison matches.

Current limitations:

- This slice covers simple monthly interval recurrence only. Day, workday, and yearly recurrence units are covered by Slice 113, and explicit weekday selection is covered by Slice 114. It does not cover monthly repeat-on rules such as first Monday, provider availability/resource conflicts, reminders, waitlists, or appointment conversion into encounters/billing.

### Slice 113: Appointment Recurrence Unit Matrix Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-113-appointment-recurrence-unit-matrix-readiness` plan, which creates daily, workday, and yearly recurring appointments, verifies generated occurrence expansion, renders the workflow, and removes the temporary appointments.

Scope:

- The shared parity suite creates three temporary `MOD-PAT-0003` appointments: every two days from `2026-12-07` through `2026-12-13`, every workday from `2026-12-11` through `2026-12-16`, and every year from `2026-06-30` through `2028-06-30`.
- The workflow verifies generated dates `2026-12-07`, `2026-12-09`, `2026-12-11`, `2026-12-13`; `2026-12-11`, `2026-12-14`, `2026-12-15`, `2026-12-16`; and `2026-06-30`, `2027-06-30`, `2028-06-30`.
- The legacy path verifies OpenEMR repeat controls for repeat frequency, repeat unit, and recurrence end date in the appointment editor.
- The modernized Calendar path verifies repeat labels, edit controls, generated occurrence cards, and generated occurrence detail rendering for the daily, workday, and yearly units.
- The modernized smoke test now includes an `appointment recurrence unit matrix lifecycle` check with self-cleaning create/delete behavior.
- Workbench-managed Slice 113 appointment recurrence unit matrix plan actions are available for both legacy and modernized targets.

Acceptance:

- Daily, workday, and yearly appointment recurrence can be created, expanded, rendered, and removed on both targets.
- Workday recurrence skips weekends, including the Friday `2026-12-11` to Monday `2026-12-14` transition.
- Occurrence numbers stay tied to the original recurrence series positions for the generated rows being displayed.
- The temporary recurring appointments are hard-deleted during cleanup, keeping seeded appointment counts stable.
- The side-by-side Slice 113 parity comparison matches.

Current limitations:

- This slice covers simple interval recurrence units for day, workday, and year. Explicit weekday selection is covered by Slice 114. It does not cover monthly repeat-on rules, provider availability/resource conflicts, reminders, waitlists, or appointment conversion into encounters/billing.

### Slice 114: Appointment Days-Of-Week Recurrence Readiness

Status:

- Implemented as a mutation-capable modernized scheduling slice under `modernized-openemr/`.
- Verification is the shared `slice-114-appointment-days-of-week-recurrence-readiness` plan, which creates an OpenEMR days-of-week recurring appointment, verifies generated occurrence expansion, renders the workflow, and removes the temporary appointment.

Scope:

- The shared parity suite creates a temporary `MOD-PAT-0003` appointment on `2026-12-07` with OpenEMR `REPEAT_DAYS` semantics for Monday, Wednesday, and Friday through `2026-12-18`.
- The workflow verifies generated dates `2026-12-07`, `2026-12-09`, `2026-12-11`, `2026-12-14`, `2026-12-16`, and `2026-12-18`.
- The legacy path verifies `pc_recurrtype = 3`, repeat unit `6`, weekday serialization, and OpenEMR repeat-day checkboxes in the appointment editor.
- The modernized backend stores normalized selected weekdays in `appointments.recurrence_days`, expands only matching OpenEMR weekdays, and exposes the same metadata in appointment list/detail DTOs.
- The modernized Calendar path adds specific-weekday repeat controls, weekday labels, generated occurrence cards, and generated occurrence detail rendering.
- The modernized smoke test now includes an `appointment days-of-week recurrence lifecycle` check with self-cleaning create/delete behavior.
- Workbench-managed Slice 114 appointment days-of-week recurrence plan actions are available for both legacy and modernized targets.

Acceptance:

- OpenEMR-specific days-of-week appointment recurrence can be created, expanded, rendered, and removed on both targets.
- Monday/Wednesday/Friday recurrence expands across consecutive weeks without emitting unselected weekdays.
- Occurrence numbers stay tied to the emitted selected weekday occurrences.
- The temporary recurring appointment is hard-deleted during cleanup, keeping seeded appointment counts stable.
- The side-by-side Slice 114 parity comparison matches.

Current limitations:

- This slice covers explicit weekday selection for weekly recurrence. Later slices cover monthly repeat-on rules and seeded recurring-series cadence/end-date propagation; provider availability/resource conflicts, reminders, waitlists, and appointment conversion into encounters/billing remain deferred.

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

As of 2026-06-20:

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
- The fifty-third modernized vertical slice implements read-only patient document preview readiness by deriving preview kind, inline-readiness, thumbnail labels, and thumbnail text from existing seeded document metadata/content rows, adding ASP.NET Core document preview fields, React Documents thumbnail rendering, Workbench document preview plan action, smoke coverage, and side-by-side slice-53 parity evidence.
- The fifty-fourth modernized vertical slice implements read-only patient document revision readiness by deriving current version, revision timestamp, history count, prior-version state, and revision hash from existing seeded document metadata rows, adding ASP.NET Core document revision fields, React Documents revision rendering, Workbench document revision plan action, smoke coverage, and side-by-side slice-54 parity evidence.
- The fifty-fifth modernized vertical slice implements patient document replacement revision readiness by proving content replacement updates the current revision timestamp and hash in place while preserving the single-current-version contract, adding a dedicated parity suite, Workbench document replacement revision plan action, smoke coverage, and side-by-side slice-55 parity evidence.
- The fifty-sixth modernized vertical slice implements payment posting mutation readiness with ASP.NET Core payment posting create/void/delete endpoints, React Fees payment posting controls, normalized legacy/modernized workflow actions, Workbench payment posting mutation plan actions, smoke coverage, and side-by-side slice-56 parity evidence.
- The fifty-seventh modernized vertical slice implements claim status mutation readiness with ASP.NET Core claim create/update/delete endpoints, React Fees claim status controls, normalized legacy/modernized workflow actions, Workbench claim status mutation plan actions, smoke coverage, and side-by-side slice-57 parity evidence.
- The fifty-eighth modernized vertical slice implements patient payment capture readiness with payer-type-zero payment support, React Fees source-aware payment controls, normalized legacy/modernized workflow actions, Workbench patient payment capture plan actions, smoke coverage, and side-by-side slice-58 parity evidence.
- The fifty-ninth modernized vertical slice implements patient statement generation readiness with a deterministic statement document contract, React Fees Patient Statement rendering, normalized legacy/modernized statement-generation probes, Workbench statement generation plan actions, smoke coverage, and side-by-side slice-59 parity evidence.
- The sixtieth modernized vertical slice implements patient statement PDF export readiness with a deterministic ASP.NET Core PDF endpoint, React Fees PDF Export action, normalized legacy/modernized statement-PDF probes, Workbench statement PDF plan actions, smoke coverage, and side-by-side slice-60 parity evidence.
- The sixty-first modernized vertical slice implements statement batch candidate readiness with a deterministic ranked work queue, ASP.NET Core statement batch endpoint, React Fees Statement Batch panel, normalized legacy/modernized statement-batch probes, Workbench statement batch plan actions, smoke coverage, and side-by-side slice-61 parity evidence.
- The sixty-second modernized vertical slice implements statement batch package export readiness with a deterministic ASP.NET Core ZIP endpoint, manifest/summary/PDF package content, React Fees Batch Export action, normalized legacy/modernized package probes, Workbench statement batch package plan actions, smoke coverage, and side-by-side slice-62 parity evidence.
- The sixty-third modernized vertical slice implements collections work queue readiness with full-population past-due account ranking, high-priority and over-90 exposure rollups, recommended collection actions, React Fees Collections Work Queue panel, normalized legacy/modernized queue probes, Workbench collections work queue plan actions, smoke coverage, and side-by-side slice-63 parity evidence.
- The sixty-fourth modernized vertical slice implements collections follow-up task readiness with a pnotes-compatible ASP.NET Core task create endpoint, React Fees Create Task action, normalized legacy/modernized workflow actions, Workbench collections follow-up plan actions, smoke coverage, and side-by-side slice-64 parity evidence.
- The sixty-fifth modernized vertical slice implements patient message assignment readiness with an ASP.NET Core message assignment endpoint, React Messages reassignment controls, normalized legacy/modernized workflow actions, Workbench message assignment plan actions, smoke coverage, and side-by-side slice-65 parity evidence.
- The sixty-sixth modernized vertical slice implements patient message content readiness with an ASP.NET Core title/body edit endpoint, React Messages inline edit controls, normalized legacy/modernized workflow actions, Workbench message content plan actions, smoke coverage, and side-by-side slice-66 parity evidence.
- The sixty-seventh modernized vertical slice implements encounter document attachment readiness with ASP.NET Core encounter detail document fields, React Encounters attached-document rendering, normalized legacy/modernized document probes, Workbench encounter documents plan actions, smoke coverage, and side-by-side slice-67 parity evidence.
- The sixty-eighth modernized vertical slice implements encounter billing linkage readiness with ASP.NET Core encounter detail billing fields, React Encounters Fee Sheet Linkage rendering, normalized legacy/modernized billing probes, Workbench encounter billing plan actions, smoke coverage, and side-by-side slice-68 parity evidence.
- The sixty-ninth modernized vertical slice implements encounter claim linkage readiness with ASP.NET Core encounter detail claim fields, React Encounters Claim Linkage rendering, normalized legacy/modernized claim probes, Workbench encounter claims plan actions, smoke coverage, and side-by-side slice-69 parity evidence.
- The seventieth modernized vertical slice implements encounter procedure order linkage readiness with ASP.NET Core encounter detail procedure-order/report/result fields, React Encounters Procedure Orders rendering, normalized legacy/modernized procedure probes, Workbench encounter procedure-order plan actions, smoke coverage, and side-by-side slice-70 parity evidence.
- The seventy-first modernized vertical slice implements encounter diagnosis coding readiness with ASP.NET Core encounter detail diagnosis evidence fields, React Encounters Diagnosis Coding rendering, normalized legacy/modernized billing/procedure diagnosis probes, Workbench encounter diagnosis plan actions, smoke coverage, and side-by-side slice-71 parity evidence.
- The seventy-second modernized vertical slice implements encounter billing linkage mutation readiness with temporary CPT fee-sheet create/render/deactivate/delete behavior, active encounter-linked billing visibility checks, normalized legacy/modernized workflow probes, Workbench encounter billing mutation plan actions, smoke coverage, and side-by-side slice-72 parity evidence.
- The seventy-third modernized vertical slice implements encounter diagnosis coding mutation readiness with temporary ICD10 fee-sheet diagnosis create/render/deactivate/delete behavior, active encounter-linked diagnosis-coding visibility checks, normalized legacy/modernized workflow probes, Workbench encounter diagnosis mutation plan actions, smoke coverage, and side-by-side slice-73 parity evidence.
- The seventy-fourth modernized vertical slice implements focused encounter fee-sheet entry readiness with React Encounters CPT/ICD entry controls, existing ASP.NET Core billing-line API behavior, active encounter billing and diagnosis panel refresh, normalized legacy/modernized workflow probes, Workbench encounter fee-sheet entry plan actions, and side-by-side slice-74 parity evidence.
- The seventy-fifth modernized vertical slice implements focused encounter procedure-order entry readiness with React Encounters pending lab-order controls, existing ASP.NET Core procedure-order API behavior, active encounter procedure-order panel refresh, normalized legacy/modernized workflow probes, Workbench encounter procedure-order entry plan actions, smoke coverage, and side-by-side slice-75 parity evidence.
- The seventy-sixth modernized vertical slice implements focused encounter procedure-result entry readiness with React Encounters per-order report/result controls, existing ASP.NET Core procedure report/result API behavior, active encounter procedure-order panel refresh, normalized legacy/modernized workflow probes, Workbench encounter procedure-result entry plan actions, smoke coverage, and side-by-side slice-76 parity evidence.
- The seventy-seventh modernized vertical slice implements encounter sign-off readiness with a normalized encounter-signature table, ASP.NET Core encounter sign/delete endpoints, React Encounters Sign-Off controls, normalized legacy/modernized workflow probes, Workbench encounter sign-off plan actions, smoke coverage, and side-by-side slice-77 parity evidence.
- The seventy-eighth modernized vertical slice implements encounter document upload readiness with an ASP.NET Core encounter-scoped document endpoint, React Encounters attached-document upload controls, normalized legacy/modernized workflow probes, Workbench encounter document upload plan actions, smoke coverage, and side-by-side slice-78 parity evidence.
- The seventy-ninth modernized vertical slice implements encounter binary document upload readiness with an ASP.NET Core encounter-scoped binary document endpoint, React Encounters file upload controls, normalized legacy/modernized workflow probes, Workbench encounter binary document upload plan actions, smoke coverage, download verification, and side-by-side slice-79 parity evidence.
- The eightieth modernized vertical slice implements encounter document sign-off readiness with an ASP.NET Core encounter-scoped sign endpoint, React Encounters attached-document review controls, normalized legacy/modernized workflow probes, Workbench encounter document sign-off plan actions, smoke coverage, and side-by-side slice-80 parity evidence.
- The eighty-first modernized vertical slice implements encounter document denial readiness with React Encounters attached-document Deny controls, existing ASP.NET Core encounter-scoped review endpoint support for `denied`, normalized legacy/modernized workflow probes, Workbench encounter document denial plan actions, smoke coverage, and side-by-side slice-81 parity evidence.
- The eighty-second modernized vertical slice implements encounter document metadata readiness with an ASP.NET Core encounter-scoped metadata endpoint, React Encounters attached-document Edit controls, normalized legacy/modernized workflow probes, Workbench encounter document metadata plan actions, smoke coverage, and side-by-side slice-82 parity evidence.
- The eighty-third modernized vertical slice implements encounter document move readiness with an ASP.NET Core same-patient encounter document move endpoint, React Encounters attached-document Move controls, normalized legacy/modernized workflow probes, Workbench encounter document move plan actions, smoke coverage, and side-by-side slice-83 parity evidence.
- The eighty-fourth modernized vertical slice implements encounter document content replacement readiness with an ASP.NET Core encounter-scoped content endpoint, React Encounters attached-document Replace controls plus current-version rendering, normalized legacy/modernized workflow probes, Workbench encounter document content replacement plan actions, smoke coverage, and side-by-side slice-84 parity evidence.
- The eighty-fifth modernized vertical slice implements encounter document archive/restore readiness with ASP.NET Core encounter-scoped archive/restore endpoints, archived attachment detail inclusion, React Encounters archive toggle and Restore controls, normalized legacy/modernized workflow probes, Workbench encounter document archive plan actions, smoke coverage, and side-by-side slice-85 parity evidence.
- The eighty-sixth modernized vertical slice implements encounter document lifecycle timeline readiness with ASP.NET Core lifecycle event derivation, React Encounters lifecycle timeline rendering, normalized legacy/modernized workflow probes, Workbench encounter document lifecycle plan actions, smoke coverage, and side-by-side slice-86 parity evidence.
- The eighty-seventh modernized vertical slice implements encounter external-link document readiness with an ASP.NET Core encounter-scoped external-link endpoint, React Encounters URL attach controls, normalized legacy/modernized workflow probes, Workbench encounter external-link document plan actions, smoke coverage, and side-by-side slice-87 parity evidence.
- The eighty-eighth modernized vertical slice implements patient image document preview readiness with inline image preview metadata, React Documents viewer image rendering, byte-preserving image content/download checks, normalized legacy/modernized workflow probes, Workbench image document preview plan actions, smoke coverage, and side-by-side slice-88 parity evidence.
- The eighty-ninth modernized vertical slice implements patient image document thumbnail readiness with ASP.NET Core image thumbnail data URIs, React Documents card image thumbnails, normalized legacy/modernized workflow probes, Workbench image document thumbnail plan actions, smoke coverage, and side-by-side slice-89 parity evidence.
- The ninetieth modernized vertical slice implements patient PDF document inline preview readiness with ASP.NET Core PDF inline-preview metadata, a React Documents viewer PDF iframe backed by the download endpoint, normalized legacy/modernized workflow probes, Workbench PDF document preview plan actions, smoke coverage, and side-by-side slice-90 parity evidence.
- The ninety-first modernized vertical slice implements patient document lifecycle timeline readiness with ASP.NET Core lifecycle event derivation, React Documents card and viewer lifecycle rendering, normalized legacy/modernized workflow probes, Workbench document lifecycle plan actions, smoke coverage, and side-by-side slice-91 parity evidence.
- The ninety-second modernized vertical slice implements patient scanned attachment readiness with ASP.NET Core scan-readiness derivation, React Documents card and viewer rendering, normalized legacy/modernized workflow probes, Workbench scanned attachment plan actions, smoke coverage, and side-by-side slice-92 parity evidence. The ninety-third modernized vertical slice implements appointment reschedule readiness with ASP.NET Core appointment update endpoints, React Calendar reschedule controls, normalized legacy/modernized workflow actions, Workbench reschedule plan actions, smoke coverage, and side-by-side slice-93 parity evidence. The ninety-fourth modernized vertical slice implements appointment arrival readiness with a React Calendar Mark arrived action, normalized legacy/modernized workflow probes, Workbench appointment arrival plan actions, smoke coverage, and side-by-side slice-94 parity evidence. The ninety-fifth modernized vertical slice implements appointment check-out readiness with a React Calendar Mark checked out action, normalized legacy/modernized workflow probes, Workbench appointment check-out plan actions, smoke coverage, and side-by-side slice-95 parity evidence. The ninety-sixth modernized vertical slice implements appointment no-show readiness with a React Calendar Mark no-show action, normalized legacy/modernized workflow probes, Workbench appointment no-show plan actions, smoke coverage, and side-by-side slice-96 parity evidence. The ninety-seventh modernized vertical slice implements appointment category readiness with ASP.NET Core category labels, React Calendar category selectors/rendering, normalized legacy/modernized workflow probes, Workbench appointment category plan actions, smoke coverage, and side-by-side slice-97 parity evidence. The ninety-eighth modernized vertical slice implements appointment pending-status readiness with the React Calendar edit status selector, OpenEMR-compatible pending status `~`, normalized legacy/modernized workflow probes, Workbench appointment pending-status plan actions, smoke coverage, and side-by-side slice-98 parity evidence. The ninety-ninth modernized vertical slice implements appointment provider reassignment readiness with provider/facility IDs in appointment responses, React Calendar provider/facility edit controls, normalized legacy/modernized workflow probes, Workbench appointment provider plan actions, smoke coverage, and side-by-side slice-99 parity evidence. The one-hundredth modernized vertical slice implements appointment facility reassignment readiness with those same appointment response IDs, React Calendar facility edit controls, normalized legacy/modernized workflow probes, Workbench appointment facility plan actions, smoke coverage, and side-by-side slice-100 parity evidence. The one-hundred-first modernized vertical slice implements appointment billing-location reassignment readiness with separate service and billing facility IDs, React Calendar billing facility edit controls, normalized legacy/modernized workflow probes, Workbench appointment billing-location plan actions, smoke coverage, and side-by-side slice-101 parity evidence. The one-hundred-second modernized vertical slice implements appointment comments readiness with appointment comments in canonical seed data, ASP.NET Core appointment comments fields, React Calendar comments controls/rendering, normalized legacy/modernized workflow probes, Workbench appointment comments plan actions, smoke coverage, and side-by-side slice-102 parity evidence. The one-hundred-third modernized vertical slice implements appointment recurrence metadata readiness with canonical recurrence anchors, legacy `pc_recurrspec` projection, PostgreSQL recurrence fields, ASP.NET Core recurrence labels, React Calendar repeat controls/rendering, normalized legacy/modernized workflow probes, Workbench appointment recurrence plan actions, smoke coverage, and side-by-side slice-103 parity evidence. The one-hundred-fourth modernized vertical slice implements appointment recurring-series readiness with API-level virtual occurrence expansion, React Calendar generated-occurrence rendering, normalized legacy/modernized workflow probes, Workbench appointment series plan actions, smoke coverage, and side-by-side slice-104 parity evidence. The one-hundred-fifth modernized vertical slice implements appointment recurrence-exceptions readiness with seeded `exdate` metadata, API-level skipped occurrence expansion, React Calendar skipped-date rendering, normalized legacy/modernized workflow probes, Workbench appointment recurrence-exceptions plan actions, smoke coverage, and side-by-side slice-105 parity evidence. The one-hundred-sixth modernized vertical slice implements appointment occurrence-cancel readiness with generated occurrence delete semantics that append recurrence exception dates, React Calendar `Skip occurrence` behavior, normalized legacy/modernized workflow probes, Workbench appointment occurrence-cancel plan actions, smoke coverage, cleanup restoration, and side-by-side slice-106 parity evidence. The one-hundred-seventh modernized vertical slice implements appointment occurrence-restore readiness with an API endpoint that removes recurrence exception dates, React Calendar `Restore occurrence` controls for skipped dates, normalized legacy/modernized workflow probes, Workbench appointment occurrence-restore plan actions, smoke coverage, cleanup restoration, and side-by-side slice-107 parity evidence. The one-hundred-eighth modernized vertical slice implements appointment occurrence-reschedule readiness with a transactional API endpoint that adds the original generated date as an exception and inserts a standalone moved appointment, React Calendar `Reschedule occurrence` behavior, normalized legacy/modernized workflow probes, Workbench appointment occurrence-reschedule plan actions, smoke coverage, cleanup restoration, and side-by-side slice-108 parity evidence. The one-hundred-ninth modernized vertical slice implements appointment recurrence exception-list edit readiness with modernized Calendar skipped-date editing on the recurring root, normalized legacy/modernized workflow probes, Workbench appointment recurrence exception-edit plan actions, smoke coverage, cleanup restoration, and side-by-side slice-109 parity evidence. The one-hundred-tenth modernized vertical slice implements appointment series root update readiness with recurring root title/time propagation into generated occurrences, normalized legacy/modernized workflow probes, Workbench appointment series root update plan actions, smoke coverage, cleanup restoration, and side-by-side slice-110 parity evidence. The one-hundred-eleventh modernized vertical slice implements appointment series root metadata readiness with recurring root provider, facility, billing-location, category, status, room, and comments propagation into generated occurrences, normalized legacy/modernized workflow probes, Workbench appointment series root metadata plan actions, smoke coverage, cleanup restoration, and side-by-side slice-111 parity evidence. The one-hundred-twelfth modernized vertical slice implements appointment monthly recurrence readiness with temporary monthly recurring appointment creation, every-two-month update, generated occurrence expansion, modernized Calendar repeat rendering, normalized legacy/modernized workflow probes, Workbench appointment monthly recurrence plan actions, smoke coverage, cleanup deletion, and side-by-side slice-112 parity evidence. The one-hundred-thirteenth modernized vertical slice implements appointment recurrence unit matrix readiness with temporary daily, workday, and yearly recurring appointment creation, generated occurrence expansion, legacy and modernized repeat rendering, normalized workflow probes, Workbench appointment recurrence unit matrix plan actions, smoke coverage, cleanup deletion, and side-by-side slice-113 parity evidence. The one-hundred-fourteenth modernized vertical slice implements appointment days-of-week recurrence readiness with OpenEMR `REPEAT_DAYS` weekday serialization, modernized `recurrence_days` storage, Calendar weekday controls, normalized workflow probes, Workbench appointment days-of-week recurrence plan actions, smoke coverage, cleanup deletion, and side-by-side slice-114 parity evidence. The one-hundred-fifteenth modernized vertical slice implements appointment monthly repeat-on recurrence readiness with OpenEMR `REPEAT_ON` nth-weekday and last-weekday serialization, modernized repeat-on storage, Calendar repeat-on controls, normalized workflow probes, Workbench appointment monthly repeat-on recurrence plan actions, smoke coverage, cleanup deletion, and side-by-side slice-115 parity evidence. The one-hundred-sixteenth modernized vertical slice implements appointment series recurrence update readiness with seeded recurring-root repeat-frequency and recurrence-end-date edits, generated occurrence propagation, skipped-date preservation, Calendar recurrence edit rendering, normalized workflow probes, Workbench appointment series recurrence update plan actions, smoke coverage, cleanup restoration, and side-by-side slice-116 parity evidence. The one-hundred-seventeenth modernized vertical slice implements appointment provider overlap readiness with provider-overlap count/ID derivation, non-blocking Calendar overlap rendering, normalized legacy/modernized workflow probes, Workbench appointment provider overlap plan actions, smoke coverage, cleanup deletion, and side-by-side slice-117 parity evidence.
- The one-hundred-eighteenth modernized vertical slice implements appointment patient overlap readiness with patient-overlap count/ID derivation, non-blocking Calendar patient-overlap rendering, normalized legacy/modernized workflow probes, Workbench appointment patient overlap plan actions, smoke coverage, cleanup deletion, and side-by-side slice-118 parity evidence.
- The one-hundred-nineteenth modernized vertical slice implements appointment room overlap readiness with room-overlap count/ID derivation, non-blocking Calendar room/resource overlap rendering, normalized legacy/modernized workflow probes, Workbench appointment room overlap plan actions, smoke coverage, cleanup deletion, and side-by-side slice-119 parity evidence.
- The one-hundred-twentieth modernized vertical slice implements appointment reminder readiness with deterministic due/status/channel/contact/lead derivation from the gold dataset base date and patient contact consent, modernized Calendar reminder rendering, smoke coverage, Workbench appointment reminder plan actions, and side-by-side slice-120 parity evidence.
- The one-hundred-twenty-first modernized vertical slice implements encounter co-signature readiness with two encounter signatures from distinct users, locked co-signature ordering, modernized Sign-Off count rendering, smoke coverage, Workbench co-signature plan actions, cleanup deletion, and side-by-side slice-121 parity evidence.
- The one-hundred-twenty-second modernized vertical slice implements encounter document revision readiness with seeded encounter attachment current-version facts, revision timestamp/hash parity, modernized attachment-card revision rendering, smoke coverage, Workbench document revision plan actions, and side-by-side slice-122 parity evidence.
- The one-hundred-twenty-third modernized vertical slice implements encounter document replacement revision readiness with a temporary encounter-attached document, replacement payload mutation, current revision hash/timestamp verification, modernized attachment-card/API rendering, cleanup deletion, Workbench replacement-revision plan actions, and side-by-side slice-123 parity evidence.
- The one-hundred-twenty-fourth project slice implements Workbench comparison drill-ins on the Test Runs page, expanding comparison cards into legacy/modernized run artifact paths, comparison JSON and artifact-directory paths, selected suites, complete difference details, matched-state confirmation, responsive styling, and refreshed Workbench architecture/progress metadata.
- The one-hundred-twenty-fifth project slice implements safe Workbench artifact links by adding a constrained `/api/artifacts/file` route for known artifact roots and icon links from comparison drill-ins to legacy run, modernized run, and comparison JSON artifacts.
- The one-hundred-twenty-sixth modernized vertical slice implements encounter scanned attachment readiness with scan-source/OCR metadata derivation for temporary encounter PDFs, modernized attached-document scan rendering, smoke coverage, Workbench scanned-attachment plan actions, cleanup deletion, and side-by-side slice-126 parity evidence.
- The one-hundred-twenty-seventh modernized vertical slice implements encounter binary document content replacement readiness with an encounter-scoped binary replacement endpoint, React Encounters `Binary File` replacement controls, normalized legacy/modernized byte/hash/revision/download probes, Workbench binary replacement plan actions, smoke coverage, cleanup deletion, and side-by-side slice-127 parity evidence.
- The one-hundred-twenty-eighth modernized vertical slice implements patient binary document content replacement readiness with a patient-document binary replacement endpoint, React Documents `Binary File` replacement controls, normalized legacy/modernized byte/hash/revision/download probes, Workbench patient binary replacement plan actions, smoke coverage, cleanup deletion, and side-by-side slice-128 parity evidence.
- The one-hundred-twenty-ninth modernized vertical slice implements procedure result correction readiness with a focused result update endpoint, React Procedures and Encounter correction controls, normalized legacy/modernized result probes, Workbench procedure result correction plan actions, smoke coverage, cleanup deletion, and side-by-side slice-129 parity evidence.
- The one-hundred-thirtieth modernized vertical slice implements procedure specimen readiness with report collected date/specimen number columns, API/DTO propagation, React Procedures and Encounter report rendering, normalized legacy/modernized specimen probes, Workbench procedure specimen plan actions, smoke coverage, cleanup deletion, and side-by-side slice-130 parity evidence.
- The one-hundred-thirty-first modernized vertical slice implements procedure specimen detail readiness with `lab_specimens`, a focused specimen-create endpoint, React Procedures and Encounter specimen rendering/actions, normalized legacy/modernized specimen-detail probes, Workbench procedure specimen detail plan actions, smoke coverage, cleanup deletion, and side-by-side slice-131 parity evidence.
- The one-hundred-thirty-second modernized vertical slice implements procedure order correction readiness with a focused order update endpoint, React Procedures order correction controls, normalized legacy/modernized order probes, Workbench procedure order correction plan actions, smoke coverage, cleanup deletion, and side-by-side slice-132 parity evidence.
- The one-hundred-thirty-third modernized vertical slice implements procedure report correction readiness with a focused report update endpoint, React Procedures report correction controls, normalized legacy/modernized report probes, Workbench procedure report correction plan actions, smoke coverage, cleanup deletion, and side-by-side slice-133 parity evidence.
- The one-hundred-thirty-fourth modernized vertical slice implements procedure report sign-off readiness with modernized report review metadata, a focused report sign endpoint, React Procedures sign controls, normalized legacy/modernized signed report probes, Workbench procedure report sign-off plan actions, smoke coverage, cleanup deletion, and side-by-side slice-134 parity evidence.
- The one-hundred-thirty-fifth modernized vertical slice implements procedure report review queue readiness with a filtered Reports workspace queue, a focused review-queue API endpoint, normalized legacy/modernized queue probes, Workbench procedure report review queue plan actions, smoke coverage, cleanup deletion, and side-by-side slice-135 parity evidence.
- The one-hundred-thirty-sixth modernized vertical slice implements procedure report review queue patient/date filtering with API/query-string filters, Reports workspace filter controls, normalized legacy/modernized filtered queue probes, Workbench procedure report review queue filter plan actions, smoke coverage, cleanup deletion, and side-by-side slice-136 parity evidence.
- The one-hundred-thirty-seventh modernized vertical slice implements procedure report review queue provider filtering with API/query-string provider filters, Reports workspace Provider controls, normalized legacy/modernized provider-filtered queue probes, Workbench procedure report review queue provider filter plan actions, smoke coverage, cleanup deletion, and side-by-side slice-137 parity evidence.
- The one-hundred-thirty-eighth modernized vertical slice implements procedure report review queue lab filtering with PostgreSQL lab ownership mapping, API/query-string lab filters, Reports workspace Lab controls, normalized legacy/modernized lab-filtered queue probes, temporary lab-provider workflow actions, Workbench procedure report review queue lab filter plan actions, smoke coverage, cleanup deletion, and side-by-side slice-138 parity evidence.
- The one-hundred-thirty-ninth modernized vertical slice implements permanent procedure lab provider catalog readiness with five shared gold-data lab providers, deterministic legacy `procedure_order.lab_id` and modernized `lab_orders.lab_id` assignments across all seeded lab orders, Workbench procedure lab provider catalog plan actions, read-only browser/database parity coverage, and side-by-side slice-139 parity evidence.
- The one-hundred-fortieth modernized vertical slice implements procedure lab provider directory readiness with a modernized `/api/procedures/lab-providers` endpoint, Reports workspace provider-directory panel, normalized legacy/modernized provider-directory probes, Workbench procedure lab provider directory plan actions, and side-by-side slice-140 parity evidence.
- The one-hundred-forty-first modernized vertical slice implements procedure lab provider lifecycle readiness with durable modernized provider protocol state, create/update/delete procedures API endpoints, Reports workspace add/deactivate/delete controls, normalized legacy/modernized provider lifecycle workflow actions, Workbench procedure lab provider lifecycle plan actions, cleanup deletion, and side-by-side slice-141 parity evidence.
- The one-hundred-forty-second modernized vertical slice implements procedure lab provider configuration readiness with durable modernized provider usage/direction/transport fields, Reports workspace configuration inputs and rendering, normalized legacy/modernized provider configuration workflow actions, Workbench procedure lab provider configuration plan actions, cleanup deletion, and side-by-side slice-142 parity evidence.
- The one-hundred-forty-fourth modernized vertical slice implements procedure lab provider address-book linkage readiness with modernized order-service address-book storage/API endpoints, `labDirectorId` provider name derivation, Reports workspace linked-organization rendering, normalized legacy/modernized workflow actions, Workbench procedure lab provider address-book plan actions, cleanup deletion, and side-by-side slice-144 parity evidence.
- The one-hundred-forty-fifth modernized vertical slice implements procedure order catalog readiness with 21 shared gold-data catalog rows, legacy `procedure_type` seeding, modernized `lab_order_catalog` storage, `/api/procedures/order-catalog`, Reports catalog rendering, Procedure order-form catalog picks, Workbench procedure order catalog plan actions, and side-by-side slice-145 parity evidence.
- The one-hundred-forty-sixth project slice implements Workbench progress completion estimates with curated per-area completion percentages, rationale text, typed `/api/progress` support, aggregate estimated-complete rendering, and per-area meter cards on the Progress page.
- The one-hundred-forty-seventh modernized vertical slice implements procedure order catalog lifecycle readiness with focused modernized catalog create/update/delete endpoints, Reports workspace catalog item controls, normalized legacy/modernized workflow actions, Workbench procedure order catalog lifecycle plan actions, cleanup deletion, and side-by-side slice-147 parity evidence.
- The one-hundred-forty-eighth modernized vertical slice implements procedure vendor compendium import readiness with a focused modernized import endpoint, Reports workspace compendium import controls, normalized legacy/modernized import workflow actions, temporary catalog subtree cleanup, Workbench vendor compendium import plan actions, and side-by-side slice-148 parity evidence.
- The one-hundred-forty-ninth modernized vertical slice implements procedure order queue readiness with temporary reportless order queue membership, reported queue transition after report attachment, modernized Reports order queue rendering, normalized legacy/modernized queue probes, Workbench procedure order queue plan actions, cleanup deletion, and side-by-side slice-149 parity evidence.
- The one-hundred-fiftieth project slice implements Workbench Architecture source inventory statistics with generated file/line/schema-signal snapshots for the legacy baseline, Workbench, and modernized target.
- The one-hundred-fifty-first modernized vertical slice implements procedure order transmit readiness with OpenEMR-compatible `date_transmitted` state, a modernized transmit endpoint and Reports queue action, normalized legacy/modernized transmitted-pending queue probes, Workbench procedure order transmit plan actions, cleanup deletion, and side-by-side slice-151 parity evidence.
- The one-hundred-fifty-second project slice implements Workbench weighted progress analytics with area scope weights, weighted overall completion, Git-backed committed progress history, and rough active-time forecasting.
- The one-hundred-fifty-third modernized vertical slice implements procedure report bulk sign-off readiness with a bulk report sign endpoint, Reports queue `Sign visible` action, normalized legacy/modernized two-report bulk review probes, Workbench bulk sign-off plan actions, cleanup deletion, and side-by-side slice-153 parity evidence.
- The one-hundred-fifty-fourth modernized vertical slice implements procedure report reopen review readiness with a modernized reopen endpoint, Procedures report-card `Reopen Review` action, normalized legacy/modernized signed-to-received queue probes, Workbench reopen review plan actions, cleanup deletion, and side-by-side slice-154 parity evidence.
- The one-hundred-fifty-fifth project slice implements Workbench comparison report links by enriching side-by-side comparison drill-ins with direct run JSON, Playwright JSON, JUnit XML, and HTML report links through the safe artifact endpoint.
- The one-hundred-fifty-sixth modernized vertical slice implements patient message reply readiness with an ASP.NET Core reply endpoint, React Messages reply controls, normalized legacy/modernized pnotes reply append workflow actions, Workbench message reply plan actions, smoke coverage, and side-by-side slice-156 parity evidence.
- The one-hundred-fifty-seventh modernized vertical slice implements patient message portal metadata readiness with shared gold-data `portal_relation`/`is_msg_encrypted` facts, modernized PostgreSQL/API/UI metadata rendering, Workbench message portal metadata plan actions, smoke coverage, and side-by-side slice-157 parity evidence.
- The one-hundred-fifty-eighth modernized vertical slice implements patient message update metadata readiness with modernized `messages.updated_by`/`updated_at`, ASP.NET Core update-stamping behavior, React Messages update metadata rendering, normalized legacy/modernized workflow probes, Workbench message update metadata plan actions, smoke coverage, and side-by-side slice-158 parity evidence.
- The one-hundred-fifty-ninth modernized vertical slice implements admin login readiness with a seeded modernized `auth_accounts` demo credential hash, an ASP.NET Core `/api/auth/login` endpoint, React Admin Login Readiness panel, legacy/modernized success-and-rejection parity coverage, Workbench admin login plan actions, smoke coverage, and side-by-side slice-159 parity evidence. This is a local demo-readiness slice, not the final ASP.NET Core Identity, session, MFA, or authorization-policy implementation.
- The one-hundred-sixtieth modernized vertical slice implements admin login audit readiness with a modernized `auth_audit_events` table, login-attempt audit writes, `/api/auth/login-audit`, React Admin Login Audit rendering, normalized legacy `log` row comparison for success/failure attempts, Workbench admin login audit plan actions, smoke coverage, and side-by-side slice-160 parity evidence. This covers login audit readiness only; broader clinical, billing, document, lab, authorization-policy, and export audit scope remains future work.
- The one-hundred-sixty-first modernized vertical slice implements admin session readiness with a modernized `auth_sessions` table, session issuance from `/api/auth/login`, `/api/auth/session`, `/api/auth/logout`, React Admin Session Readiness rendering, legacy OpenEMR `OpenEMR` cookie/session logout comparison, Workbench admin session plan actions, smoke coverage, and side-by-side slice-161 parity evidence. This covers local session lifecycle readiness only; enforcing sessions across protected APIs, ASP.NET Core Identity, MFA, authorization policy, password lifecycle, and production session hardening remain future work.
- The one-hundred-sixty-second modernized vertical slice implements admin audit protection readiness by requiring an active `X-OpenEMR-Session` session for `/api/auth/login-audit`, rendering the Admin Login Audit panel only after sign-in, adding Workbench admin audit protection plan actions, extending smoke coverage with unauthenticated `401` evidence, and comparing legacy `interface/logview/logview.php` no-session blocking plus authenticated access with modernized no-session/active-session/ended-session behavior. This covers one focused protected audit surface; broader protected-API enforcement, ASP.NET Core Identity, MFA, authorization policy, password lifecycle, and production session hardening remain future work.
- The one-hundred-sixty-third modernized vertical slice implements admin directory protection readiness by requiring an active `X-OpenEMR-Session` session for `/api/administration/*`, loading the Admin directory and admin mutation surfaces only after sign-in, adding Workbench admin directory protection plan actions, extending smoke coverage with unauthenticated `401` and authenticated directory-count evidence, keeping older admin/ACL UI parity suites authenticated, and comparing legacy `usergroup_admin.php` / `facilities.php` no-session blocking plus authenticated access with modernized no-session/active-session API/UI behavior. This covers the administration API group; broader non-admin protected APIs, ASP.NET Core Identity, MFA, authorization policy, password lifecycle, and production session hardening remain future work.
- The one-hundred-sixty-fourth modernized vertical slice implements operational reports protection readiness by requiring an active `X-OpenEMR-Session` session for `/api/reports/*`, gating operational reports and CSV export on the Reports page until sign-in, adding Workbench reports protection plan actions, extending smoke coverage with unauthenticated `401` and authenticated report/export evidence, keeping the existing reports and reports-export parity suites authenticated, and comparing legacy `patient_list.php` / `clinical_reports.php` no-session blocking plus authenticated access with modernized no-session/active-session API/UI behavior. This starts broader non-admin protected API enforcement; remaining clinical, scheduling, document, billing, procedure, and messaging protected APIs, ASP.NET Core Identity, MFA, authorization policy, password lifecycle, and production session hardening remain future work.
- The one-hundred-sixty-fifth modernized vertical slice implements patient chart protection readiness by requiring an active `X-OpenEMR-Session` session for `/api/patients/*`, gating Patient/Client search, chart loading, registration, demographics/contact edits, and insurance mutations until sign-in, adding Workbench patient protection plan actions, extending smoke coverage with unauthenticated patient-search `401` evidence, keeping older patient and insurance UI/API parity suites authenticated, and comparing legacy patient summary no-session blocking plus authenticated access with modernized no-session/active-session API/UI behavior. This protects the core patient chart surface; remaining clinical-list, scheduling, document, billing, procedure, messaging, and broader authorization policy depth remain future work.
- The one-hundred-sixty-sixth modernized vertical slice implements clinical-list protection readiness by requiring an active `X-OpenEMR-Session` session for `/api/clinical-lists/*`, gating the Lists workspace patient lookup and mutation controls until sign-in, adding Workbench clinical-list protection plan actions, extending smoke coverage and workflow actions with authenticated clinical-list calls, keeping older clinical-list, problem, medication, prescription, and immunization parity suites authenticated, and comparing legacy patient-summary list protection with modernized no-session/active-session API/UI behavior. This protects the clinical-list surface; remaining scheduling, encounter, document, billing, procedure, messaging, ASP.NET Core Identity, MFA, authorization policy, password lifecycle, and broader production session hardening remain future work.
- The one-hundred-sixty-seventh modernized vertical slice implements appointment protection readiness by requiring an active `X-OpenEMR-Session` session for `/api/appointments/*`, gating Calendar search/detail and appointment mutation controls until sign-in, adding Workbench appointment protection plan actions, extending smoke coverage with unauthenticated appointment-search `401` evidence, keeping older appointment read/mutation/recurrence/reminder parity suites authenticated, and comparing legacy scheduler-page protection with modernized no-session/active-session API/UI behavior.
- The one-hundred-sixty-eighth modernized vertical slice implements encounter protection readiness by requiring an active `X-OpenEMR-Session` session for `/api/encounters/*`, gating Encounters search/detail and mutation controls until sign-in, adding Workbench encounter protection plan actions, extending smoke coverage with unauthenticated encounter-search `401` evidence, keeping older encounter read/mutation/document/billing/procedure parity suites authenticated, and comparing legacy encounter-page protection with modernized no-session/active-session API/UI behavior. This protects the core encounter surface; remaining document, billing, procedure, messaging, ASP.NET Core Identity, MFA, authorization policy depth, password lifecycle, and broader production session hardening remain future work.
- The one-hundred-sixty-ninth modernized vertical slice implements patient document protection readiness by requiring an active `X-OpenEMR-Session` session for `/api/documents/*`, gating Documents search, preview/download, upload, metadata, review, archive/restore, replacement, external-link, and delete controls until sign-in, adding Workbench document protection plan actions, extending smoke coverage with unauthenticated document-list/content `401` evidence, keeping older document and encounter-attached binary document parity suites authenticated, and comparing legacy document-page protection with modernized no-session/active-session API/UI behavior. This protects the patient document surface; remaining billing, procedure, ASP.NET Core Identity, MFA, authorization policy depth, password lifecycle, and broader production session hardening remain future work.
- The one-hundred-seventieth modernized vertical slice implements patient message protection readiness by requiring an active `X-OpenEMR-Session` session for `/api/messages/*`, gating Messages search, create, close, content edit, reassignment, reply, archive, and delete controls until sign-in, adding Workbench message protection plan actions, extending smoke coverage with unauthenticated message-list `401` evidence, keeping older message read/mutation/portal/update-metadata and collections follow-up parity suites authenticated, and comparing legacy patient-notes protection with modernized no-session/active-session API/UI behavior. This protects the patient messaging surface; remaining billing, procedure, ASP.NET Core Identity, MFA, authorization policy depth, password lifecycle, and broader production session hardening remain future work.
- The one-hundred-seventy-first modernized vertical slice implements billing protection readiness by requiring an active `X-OpenEMR-Session` session for `/api/billing/*`, gating the Fees workspace fee-sheet lookup, statement, batch, collections, claim, payment, and billing-line mutation controls until sign-in, replacing unauthenticated statement PDF/package links with authenticated downloads, adding Workbench billing protection plan actions, extending smoke coverage with unauthenticated billing `401` evidence, keeping older billing, claims, payments, statements, collections, and encounter fee-sheet parity suites authenticated, and comparing legacy fee-sheet protection with modernized no-session/active-session API/UI behavior. This protects the billing/revenue-cycle API surface; ASP.NET Core Identity, MFA, authorization policy depth, password lifecycle, and broader production session hardening remain future work.
- The one-hundred-seventy-second modernized vertical slice implements procedure protection readiness by requiring an active `X-OpenEMR-Session` session for `/api/procedures/*`, gating the Procedures workspace result lookup, order/report/result/specimen, provider, and catalog controls until sign-in, adding Workbench procedure protection plan actions, extending smoke coverage with unauthenticated procedure `401` evidence, keeping older procedure, lab-provider, catalog, report queue, order queue, transmit, and encounter procedure parity suites authenticated, and comparing legacy procedure result protection with modernized no-session/active-session API/UI behavior. This protects the procedure/lab API surface; ASP.NET Core Identity, MFA, authorization policy depth, password lifecycle, role-specific lab authorization, and broader production session hardening remain future work.
- The one-hundred-seventy-third modernized vertical slice implements administration authorization-policy readiness by seeding a modernized front-desk demo account, enforcing the mirrored ACL Administration permission on `/api/administration/*`, returning 403 for authenticated sessions without `admin:acl write`, adding Workbench admin authorization-policy plan actions, extending smoke coverage with authenticated front-desk forbidden evidence, and comparing the modernized admin-allowed/front-desk-forbidden behavior with the legacy ACL matrix. This covers one focused ACL-backed administration policy gate; ASP.NET Core Identity, MFA, password lifecycle, user-facility restrictions, broader role/permission policy depth, and production hardening remain future work.
- The one-hundred-seventy-fourth modernized vertical slice implements operational reports authorization-policy readiness by enforcing mirrored Patient Report access on `/api/reports/*`, honoring the OpenEMR return-value hierarchy so admin `write` satisfies the report `view` requirement, returning 403 for authenticated front-desk sessions without `patients:pat_rep view`, keeping unauthenticated reports on the 401 session contract, adding Workbench reports authorization-policy plan actions, extending smoke coverage with front-desk forbidden evidence for report JSON and CSV export, and comparing the modernized admin-allowed/front-desk-forbidden behavior with the legacy ACL matrix. This covers a second focused ACL-backed policy gate; ASP.NET Core Identity, MFA, password lifecycle, user-facility restrictions, broader role/permission policy depth, and production hardening remain future work.
- The one-hundred-seventy-fifth modernized vertical slice implements clinical-list authorization-policy readiness by enforcing mirrored Medical/History access on `/api/clinical-lists/*`, honoring the OpenEMR return-value hierarchy so admin `write` satisfies the clinical-list `view` requirement, returning 403 for authenticated front-desk sessions without `patients:med view`, keeping unauthenticated clinical-list APIs on the 401 session contract, adding Workbench clinical-list authorization-policy plan actions, extending smoke coverage with front-desk forbidden evidence for clinical-list retrieval and allergy mutation, and comparing the modernized admin-allowed/front-desk-forbidden behavior with the legacy ACL matrix and clinical-list rendering. This covers a third focused ACL-backed policy gate; mutation-specific write policies, ASP.NET Core Identity, MFA, password lifecycle, user-facility restrictions, broader role/permission policy depth, and production hardening remain future work.
- The one-hundred-seventy-sixth modernized vertical slice implements appointment authorization-policy readiness by mapping the front-desk demo account into the modernized Front Office ACL membership seed, enforcing mirrored Appointment access on `/api/appointments/*`, honoring the OpenEMR return-value hierarchy so `write` satisfies appointment `view`, keeping unauthenticated appointment APIs on the 401 session contract, adding Workbench appointment authorization-policy plan actions, extending smoke coverage with front-desk appointment-search success evidence, and comparing the modernized Front Office appointment access behavior with the legacy ACL matrix and scheduler rendering. This covers the first positive non-admin ACL-backed policy gate; mutation-specific write policies, ASP.NET Core Identity, MFA, password lifecycle, user-facility restrictions, broader role/permission policy depth, and production hardening remain future work.
- The one-hundred-seventy-seventh modernized vertical slice implements encounter authorization-policy readiness by enforcing mirrored Authorize Any Encounter access on `/api/encounters/*`, honoring the OpenEMR return-value hierarchy so admin `write` satisfies encounter `view`, returning 403 for authenticated front-desk sessions without `encounters:auth_a view`, keeping unauthenticated encounter APIs on the 401 session contract, adding Workbench encounter authorization-policy plan actions, extending smoke coverage with front-desk encounter search and mutation forbidden evidence, and comparing the modernized admin-allowed/front-desk-forbidden behavior with the legacy ACL matrix and encounter rendering. This covers another focused ACL-backed clinical policy gate; mutation-specific write policies, ASP.NET Core Identity, MFA, password lifecycle, user-facility restrictions, broader role/permission policy depth, and production hardening remain future work.
- The one-hundred-seventy-eighth modernized vertical slice implements patient chart authorization-policy readiness by enforcing mirrored Demographics access on `/api/patients/*`, honoring the OpenEMR return-value hierarchy so admin and front-desk `write` grants satisfy the patient `view` requirement, keeping unauthenticated patient APIs on the 401 session contract, adding Workbench patient authorization-policy plan actions, extending smoke coverage with front-desk patient search/chart success evidence, keeping the Patient/Client signed-in identity visible after access verification, and comparing the modernized admin/front-desk patient access behavior with the legacy ACL matrix and patient-summary rendering. This covers another positive ACL-backed policy gate; mutation-specific write policies, ASP.NET Core Identity, MFA, password lifecycle, user-facility restrictions, broader role/permission policy depth, and production hardening remain future work.
- The one-hundred-seventy-ninth modernized vertical slice implements patient document authorization-policy readiness by enforcing mirrored Documents access on `/api/documents/*`, honoring the OpenEMR return-value hierarchy so admin `write` satisfies document `view`, returning 403 for authenticated front-desk sessions without `patients:docs view`, keeping unauthenticated document APIs on the 401 session contract, adding Workbench document authorization-policy plan actions, extending smoke coverage with front-desk document list/content/create forbidden evidence, keeping the Documents access panel visible for retry after a forbidden response, and comparing the modernized admin-allowed/front-desk-forbidden behavior with the legacy ACL matrix and document rendering. This covers another focused ACL-backed policy gate; mutation-specific write policies, ASP.NET Core Identity, MFA, password lifecycle, user-facility restrictions, broader role/permission policy depth, and production hardening remain future work.
- The one-hundred-eightieth modernized vertical slice implements patient message authorization-policy readiness by enforcing mirrored Patient Notes access on `/api/messages/*`, honoring the OpenEMR return-value hierarchy so admin `write` satisfies message `view`, returning 403 for authenticated front-desk sessions without `patients:notes view`, keeping unauthenticated message APIs on the 401 session contract, adding Workbench message authorization-policy plan actions, extending smoke coverage with front-desk message list/create forbidden evidence, keeping the Messages access panel visible for retry after a forbidden response, and comparing the modernized admin-allowed/front-desk-forbidden behavior with the legacy ACL matrix and patient-notes rendering. This covers another focused ACL-backed policy gate; mutation-specific write policies, ASP.NET Core Identity, MFA, password lifecycle, user-facility restrictions, broader role/permission policy depth, and production hardening remain future work.
- The one-hundred-eighty-first modernized vertical slice implements billing authorization-policy readiness by enforcing mirrored Billing access on `/api/billing/*`, honoring the OpenEMR return-value hierarchy so admin `write` satisfies billing `view`, returning 403 for authenticated front-desk sessions without `acct:bill view`, keeping unauthenticated billing APIs on the 401 session contract, adding Workbench billing authorization-policy plan actions, extending smoke coverage with front-desk billing retrieval and billing-line create forbidden evidence, keeping the Fees access panel visible for retry after a forbidden response, and comparing the modernized admin-allowed/front-desk-forbidden behavior with the legacy ACL matrix and fee-sheet rendering. This covers another focused ACL-backed policy gate; mutation-specific write policies, ASP.NET Core Identity, MFA, password lifecycle, user-facility restrictions, broader role/permission policy depth, procedure authorization, and production hardening remain future work.
- The one-hundred-eighty-second modernized vertical slice implements procedure authorization-policy readiness by enforcing mirrored Lab Results access on `/api/procedures/*`, honoring the OpenEMR return-value hierarchy so admin `write` and clinician `addonly` satisfy procedure `view`, returning 403 for authenticated front-desk sessions without `patients:lab view`, keeping unauthenticated procedure APIs on the 401 session contract, adding Workbench procedure authorization-policy plan actions, extending smoke coverage with front-desk procedure result, order-catalog, and order-create forbidden evidence, keeping the Procedures access panel visible for retry after a forbidden response, and comparing the modernized admin-allowed/front-desk-forbidden behavior with the legacy ACL matrix and procedure result rendering. This covers another focused ACL-backed policy gate; mutation-specific write/sign policies, ASP.NET Core Identity, MFA, password lifecycle, user-facility restrictions, broader role/permission policy depth, and production hardening remain future work.
- The one-hundred-eighty-third modernized vertical slice implements procedure mutation authorization-policy readiness by seeding a modernized clinician demo account in the Clinicians ACL group, keeping the procedure API group behind Lab Results view access, and adding endpoint-level mutation gates so Lab Results add-only can create procedure orders/reports while Lab Results write is required for status/delete updates and Sign Lab Results write is required for report sign-off. The shared parity plan proves the admin/clinician ACL matrix against both targets, verifies the modernized clinician can read and add lab records but receives 403 for complete/sign/delete operations, verifies admin can complete/sign/delete the temporary order tree, and exposes the plan through the Workbench for both legacy and modernized targets. This is the first mutation-specific lab policy slice; broader role/facility policy, production identity, MFA, password lifecycle, and audit expansion remain future work.
- The one-hundred-eighty-fourth modernized vertical slice implements patient mutation authorization-policy readiness by keeping the patient API group behind Demographics view access and adding endpoint-level mutation gates so Demographics add-only can register a patient while existing chart contact, demographics, insurance, and temporary patient deletion require Demographics write. The shared parity plan proves the admin/front-desk/clinician ACL matrix against both targets, verifies the modernized clinician can read and register a temporary patient but receives 403 for existing-chart edits and deletion, verifies admin can clean up the temporary patient, and exposes the plan through the Workbench for both legacy and modernized targets. This extends mutation-specific policy coverage to patient chart operations; broader role/facility policy, production identity, MFA, password lifecycle, and audit expansion remain future work.
- The one-hundred-eighty-fifth modernized vertical slice implements encounter mutation authorization-policy readiness by keeping the encounter API group behind Authorize Any Encounter view access and adding endpoint-level mutation gates so core encounter create, update, vitals, SOAP-note, signature, sign-off, and delete operations require Authorize Any Encounter write access. The shared parity plan temporarily grants the Clinicians group `encounters:auth_a view`, proves the modernized clinician can read encounter search/detail but receives 403 for create, update, sign, and delete operations, then revokes the temporary grant so the permanent seed matrix remains stable. This extends mutation-specific policy coverage to core encounter operations; encounter documents, amendment policy, role/facility policy, production identity, MFA, password lifecycle, and audit expansion remain future work.
- The one-hundred-eighty-sixth modernized vertical slice implements patient document mutation authorization-policy readiness by keeping the document API group behind Documents view access and adding endpoint-level mutation gates so Documents add-only can file new patient and encounter documents, Documents write is required for metadata, content, review, archive, restore, and move operations, and Documents Delete write is required for hard deletion. The shared parity plan proves the admin/clinician ACL matrix against both targets, verifies the modernized clinician can read existing document metadata/content and file a temporary document, verifies the clinician receives 403 for metadata, content, sign-off, archive, and hard-delete operations, and verifies admin can hard-delete the temporary document for cleanup. This extends mutation-specific policy coverage to patient and encounter document operations; scanner/OCR execution, full historical version rows, external storage, retention policy, production identity, MFA, password lifecycle, and audit expansion remain future work.
- The one-hundred-eighty-seventh modernized vertical slice implements patient message mutation authorization-policy readiness by keeping the message API group behind Patient Notes view access and adding endpoint-level mutation gates so Patient Notes add-only can create patient messages while Patient Notes write is required for status, content, assignment, reply, archive, and hard-delete operations. The shared parity plan proves the admin/clinician ACL matrix against both targets, verifies the modernized clinician can read seeded patient messages and create a temporary message, verifies the clinician receives 403 for close/status, content, assignment, reply, archive, and hard-delete operations, and verifies admin can hard-delete the temporary message for cleanup. This extends mutation-specific policy coverage to patient messaging; full portal threading, encrypted content, attachments, routing queues, notifications, production identity, MFA, password lifecycle, and audit expansion remain future work.
- The one-hundred-eighty-eighth modernized vertical slice implements billing mutation authorization-policy readiness by keeping the billing API group behind Billing view access and adding endpoint-level mutation gates so billing-line, claim-status, payment-posting, and collections follow-up mutations require Billing write access. The shared parity plan temporarily grants the Clinicians group `acct:bill view`, proves the modernized clinician can read fee-sheet and revenue-cycle facts but receives 403 for write-level billing mutations, then revokes the temporary grant so the permanent seed matrix remains stable. This extends mutation-specific policy coverage to revenue-cycle operations; claim generation depth, payer adjudication, ERA/EOB import, refunds/reversals, full audit history, production identity, MFA, password lifecycle, and audit expansion remain future work.
- The one-hundred-eighty-ninth modernized vertical slice implements appointment mutation authorization-policy readiness by keeping the appointment API group behind Appointment view access and adding endpoint-level mutation gates so appointment create, update, status, recurrence restore, occurrence reschedule, and deletion operations require Appointment write access. The shared parity plan temporarily downgrades the Clinicians group from `patients:appt write` to `patients:appt view`, proves the modernized clinician can still read appointment search/detail facts but receives 403 for write-level scheduling mutations, then restores the permanent write grant so the seed matrix remains stable. This extends mutation-specific policy coverage to scheduling operations; waitlists, stricter resource availability enforcement, reminder delivery audit, production identity, MFA, password lifecycle, and broader facility/role policy remain future work.
- The one-hundred-ninetieth modernized vertical slice implements encounter amendment history readiness by deriving an `amendmentHistory` read model from nonblank encounter signature amendment text, preserving newest-first e-sign ordering, filtering blank sign-off notes, rendering a dedicated modernized Encounter Amendment History panel, and proving the behavior against legacy `esign_signatures` rows with cleanup-backed parity. This extends focused encounter sign-off coverage from attestation/co-signature capture into amendment history visibility; formal amendment policy controls, revocation policy, legal attestation text, comprehensive audit export, templates, and multi-form encounter packages remain future work.
- The one-hundred-ninety-first modernized vertical slice implements patient duplicate detection readiness by deriving candidate duplicates from first name, last name, date of birth, phone, and email, exposing them through `/api/patients/duplicates` and patient chart summaries, rendering Duplicate Detection panels in the Patient/Client workspace and registration flow, and proving the behavior against legacy `patient_data` facts with cleanup-backed parity. This extends patient registration readiness into duplicate-checking decision support; patient merge, guarantor/subscriber capture, portal login/password lifecycle, and broader patient administration remain future work.
- The one-hundred-ninety-second modernized vertical slice implements patient registration validation readiness by mirroring OpenEMR `PatientValidator` insert rules for first name, last name length, sex, DOB format, and email syntax; returning structured validation details from the ASP.NET Core patient registration API; rendering those details in the Patient/Client registration form; proving invalid drafts do not create rows; and exposing the plan through the Workbench. This closes the focused registration-validation gap while leaving patient merge, guarantor/subscriber capture, portal login/password lifecycle, address catalogs, patient deactivation policies, and broader administration depth for future slices.
- The one-hundred-ninety-third modernized vertical slice implements patient deceased-status readiness by mapping legacy OpenEMR `patient_data.deceased_date` and `patient_data.deceased_reason` into the modernized `patients` schema, exposing those fields through chart summaries and a write-level `/api/patients/{patientId}/deceased-status` endpoint, rendering a dedicated Patient/Client Deceased Status panel, and proving mark/restore behavior with smoke and parity tests. This closes the focused deceased date/reason gap while leaving patient merge, guarantor/subscriber capture, portal login/password lifecycle, address catalogs, lifecycle audit history, and broader administration policy depth for future slices.
- The one-hundred-ninety-fourth modernized vertical slice implements patient guardian-contact readiness by adding deterministic `mothersname`, `guardiansname`, `guardianrelationship`, `guardianphone`, and `guardianemail` values to the shared gold dataset, mapping them into the modernized `patients` schema as mother and guardian contact fields, exposing them through chart summaries and a write-level `/api/patients/{patientId}/guardian-contact` endpoint, rendering a dedicated Patient/Client Guardian Contact panel, and proving restore-backed update behavior with smoke and parity tests. This closes the focused mother/guardian contact gap while leaving patient merge, guarantor/subscriber insurance-party capture, portal login/password lifecycle, address catalogs, lifecycle audit history, and broader administration policy depth for future slices.
- The one-hundred-ninety-fifth modernized vertical slice implements patient guardian demographic/address readiness by extending the shared gold dataset with deterministic `guardiansex`, `guardianaddress`, `guardiancity`, `guardianstate`, `guardianpostalcode`, `guardiancountry`, and `guardianworkphone` values, mapping them into the modernized `patients` schema, expanding the existing guardian-contact API and Patient/Client Guardian Contact panel, and proving restore-backed update behavior with smoke and parity tests. This closes the focused guardian detail gap while leaving patient merge, guarantor/subscriber insurance-party capture, portal login/password lifecycle, address catalogs, lifecycle audit history, and broader administration policy depth for future slices.
- The one-hundred-ninety-sixth modernized vertical slice implements patient social detail readiness by extending the shared gold dataset with deterministic `race`, `ethnicity`, `interpreter`, `family_size`, `monthly_income`, `homeless`, and `financial_review` values, mapping them into the modernized `patients` schema, expanding the existing patient demographics API and Patient/Client Demographics panel, and proving restore-backed update behavior with smoke and parity tests. This closes the focused social-detail demographic gap while leaving patient merge, guarantor/subscriber insurance-party capture, portal login/password lifecycle, address catalogs, lifecycle audit history, and broader administration policy depth for future slices.
- The one-hundred-ninety-seventh modernized vertical slice implements patient employer core readiness by extending the shared gold dataset with deterministic employer name, street, city, state, postal code, and country values, mapping them into legacy `employer_data` and modernized `patient_employers`, exposing them through chart summaries and a write-level `/api/patients/{patientId}/employer` endpoint, rendering a dedicated Patient/Client Employer panel, and proving restore-backed update behavior with smoke and parity tests. This closes the focused employer identity/address gap while leaving patient merge, guarantor/subscriber insurance-party capture, portal login/password lifecycle, address catalogs, lifecycle audit history, and broader administration policy depth for future slices.
- The one-hundred-ninety-eighth modernized vertical slice implements patient primary-provider assignment readiness by exposing patient `providerId` and `facilityId` identifiers in chart/list summaries, adding patient-module provider assignment options, mapping legacy `patient_data.providerID` to modernized `patients.provider_id`, exposing a write-level `/api/patients/{patientId}/provider-assignment` endpoint, rendering a dedicated Patient/Client Primary Provider panel with a provider menu, and proving restore-backed update behavior with smoke and parity tests. This closes the focused primary-provider assignment gap while leaving multi-member care teams, merge, guarantor/subscriber insurance-party capture, portal login/password lifecycle, address catalogs, lifecycle audit history, and broader administration policy depth for future slices.
- The one-hundred-ninety-ninth modernized vertical slice implements patient care-team membership readiness by adding modernized `patient_care_teams` and `patient_care_team_members` seed/schema support, mapping legacy OpenEMR `care_teams` and `care_team_member` lead-member behavior into chart summaries, exposing a write-level `/api/patients/{patientId}/care-team` endpoint, rendering an editable Patient/Client Care Team panel with provider, role, status, provider-since, facility, and note fields, and proving restore-backed update behavior with smoke and parity tests. This closes the focused lead-member care-team gap while leaving multi-member care-team management, related-person/contact team members, care-team audit history, patient merge, guarantor/subscriber insurance-party capture, portal login/password lifecycle, and broader administration policy depth for future slices.
- The two-hundredth modernized vertical slice implements patient care-team members readiness by extending the same `/api/patients/{patientId}/care-team` endpoint to accept a `members` collection while preserving the Slice 199 single-member request shape, updating the Patient/Client Care Team panel to render and edit multiple provider/facility-backed members, adding target-neutral multi-member workflow adapters, and proving restore-backed two-member behavior against legacy OpenEMR and the modernized target. This closes the focused multi-member care-team gap while leaving related-person/contact team members, care-team audit history, patient merge, guarantor/subscriber insurance-party capture, portal login/password lifecycle, and broader administration policy depth for future slices.
- The two-hundred-first modernized vertical slice implements patient contact-backed care-team readiness by seeding deterministic OpenEMR person/contact/contact_relation/contact_telecom rows and modernized `patient_related_contacts`, extending `patient_care_team_members` and `/api/patients/{patientId}/care-team` to accept `contactId` members alongside `userId` members, rendering provider/contact member types in the Patient/Client Care Team panel, and proving restore-backed mixed provider/contact behavior against legacy `care_team_member.contact_id` and the modernized target. This closes the focused related-person/contact care-team role gap while leaving patient merge, guarantor/subscriber insurance-party capture, portal login/password lifecycle, lifecycle audit history, and broader administration policy depth for future slices.
- The two-hundred-second modernized vertical slice implements patient history/lifestyle readiness by adding deterministic `history_data` rows for every canonical patient, mapping those rows into modernized `patient_histories`, exposing a read-only `history` object on patient chart summaries, rendering a Patient/Client History and Lifestyle panel, and proving database/API/UI parity with the `MOD-PAT-0010` anchor. This closes the focused patient history depth gap while leaving patient merge, guarantor/subscriber insurance-party capture, portal login/password lifecycle, lifecycle audit history, and broader administration policy depth for future slices.
- The two-hundred-third modernized vertical slice implements patient insurance subscriber readiness by extending deterministic insurance rows with subscriber identity, relationship, DOB, sex, address, phone, and employer details, mapping those fields into legacy `insurance_data` and modernized `insurance_records`, exposing them through patient chart summaries and the existing patient insurance mutation API, rendering subscriber detail in the Patient/Client insurance panel, and proving seeded secondary coverage plus temporary tertiary coverage create/update/delete parity with the `MOD-PAT-0005` anchor. This closes the focused subscriber insurance-party detail gap while leaving patient merge, broader guarantor workflows, portal login/password lifecycle, lifecycle audit history, and broader administration policy depth for future slices.
- The two-hundred-fourth modernized vertical slice implements patient portal account readiness by adding deterministic CMS login and onsite portal-account facts for the 200 portal-enabled gold patients, mapping legacy `patient_data.cmsportal_login` / `patient_access_onsite` into modernized `patients.cms_portal_login` / `patient_portal_accounts`, exposing a `portalAccount` read model from patient chart summaries, rendering a Patient/Client Portal Account panel, and proving read-only database/API/UI parity with the `MOD-PAT-0004` anchor. This closes focused portal account readiness while leaving patient merge, broader guarantor workflows, portal login/password lifecycle, address catalogs, lifecycle audit history, and broader administration policy depth for future slices.
- The two-hundred-fifth modernized vertical slice implements patient portal reset readiness by adding a write-level `/api/patients/{patientId}/portal-account/reset` endpoint that issues or clears one-time reset state for provisioned portal accounts, extending the Patient/Client Portal Account panel with an issue/clear reset action, comparing the modernized state with legacy `patient_access_onsite.portal_pwd_status` and `portal_onetime`, and proving restore-backed parity with the `MOD-PAT-0004` anchor. This closes the focused one-time reset lifecycle while leaving patient merge, broader guarantor workflows, full portal authentication/password rotation, address catalogs, lifecycle audit history, and broader administration policy depth for future slices.
- The two-hundred-sixth modernized vertical slice implements patient portal access readiness by adding a write-level `/api/patients/{patientId}/portal-account/access` endpoint that revokes or grants portal access for provisioned accounts, extending the Patient/Client Portal Account panel with a grant/revoke access action and normalized access labels, comparing the modernized state with legacy `patient_data.allow_patient_portal`, and proving restore-backed parity with the `MOD-PAT-0004` anchor while preserving CMS login and onsite account facts. This closes the focused portal access grant/revoke lifecycle while leaving patient merge, broader guarantor workflows, full portal authentication/password rotation, address catalogs, lifecycle audit history, and broader administration policy depth for future slices.
- The two-hundred-seventh modernized vertical slice implements patient portal authentication readiness by adding deterministic synthetic portal credentials to the 200 provisioned portal accounts, mapping a real OpenEMR-compatible bcrypt hash into legacy `patient_access_onsite.portal_pwd`, adding modernized `patient_portal_accounts` password hash/salt fields plus `patient_portal_sessions`, exposing public `/api/patient-portal/login` and `/api/patient-portal/session` endpoints, rendering a Patient/Client Portal Account sign-in readiness check, and proving valid login plus invalid-password, disabled-access, and pending-reset rejection behavior with the `MOD-PAT-0004` anchor. This closes focused local portal sign-in readiness while leaving password rotation, MFA, email reset delivery, full patient portal workflow depth, lifecycle audit history, and production identity hardening for future slices.
- The two-hundred-eighth modernized vertical slice implements patient portal session readiness by adding a public modernized session logout endpoint, ending `patient_portal_sessions` rows with `ended_at`, rendering a Patient/Client end-session control after portal readiness sign-in, and proving active session read, logout, and inactive reuse behavior against legacy portal logout. This closes focused local portal session lifecycle while leaving password rotation, MFA, email reset delivery, full patient portal workflow depth, lifecycle audit history, and production identity hardening for future slices.
- The two-hundred-ninth modernized vertical slice implements patient portal home readiness by adding a session-protected `/api/patient-portal/home` endpoint, rendering a first-class Portal module in the modernized SPA, and proving signed-in portal identity, secure-message summary counts, and upcoming appointment summary behavior against the legacy portal home. This closes the first patient-facing portal landing surface while leaving password rotation, MFA, email reset delivery, broader portal messaging depth, portal broader portal appointment workflow depth, portal report downloads, lifecycle audit history, and production identity hardening for future slices.
- The two-hundred-tenth modernized vertical slice implements patient portal secure-message inbox readiness by projecting the same seeded portal message facts into legacy `onsite_mail`, adding a session-protected modernized `/api/patient-portal/messages` endpoint, rendering secure-message inbox cards in the modernized Portal workspace, and proving the `MOD-PAT-0004` portal inbox against the legacy portal secure-messaging page. This closes read-only portal inbox parity while leaving message composition, replies/threading, attachments, notification delivery, encrypted-content hardening, broader portal appointment workflow depth, portal report downloads, lifecycle audit history, and production identity hardening for future slices.
- The two-hundred-eleventh modernized vertical slice implements patient portal secure-message compose readiness by introducing a modernized `portal_mailbox_messages` read/write model, moving portal inbox/home counts to mailbox semantics, adding session-protected `POST /api/patient-portal/messages`, rendering compose and Sent sections in the Portal workspace, and proving cleanup-backed sent-message behavior against legacy `onsite_mail`. This closes the first portal composition and sent-folder parity path while leaving replies/threading, attachments, notification delivery, encrypted-content hardening, broader portal appointment workflow depth, portal report downloads, lifecycle audit history, and production identity hardening for future slices.
- The two-hundred-twelfth modernized vertical slice implements patient portal secure-message reply readiness by exposing mailbox `mail_chain` / `reply_mail_chain` identifiers, adding session-protected `POST /api/patient-portal/messages/{messageId}/reply`, rendering inline reply controls on inbox cards, and proving cleanup-backed reply/sent-folder behavior against legacy `onsite_mail`.
- The two-hundred-thirteenth modernized vertical slice implements patient portal secure-message thread view readiness by adding session-protected `GET /api/patient-portal/messages/{messageId}/thread`, resolving patient-visible mailbox conversations from `reply_mail_chain` / `mail_chain`, rendering Portal `View thread` panels in chronological order, and proving the same thread facts against legacy `onsite_mail` after a cleanup-backed reply. This closes focused conversation rendering while leaving attachments, notification delivery, encrypted-content hardening, richer thread actions, broader portal appointment workflow depth, portal report downloads, lifecycle audit history, and production identity hardening for future slices.
- The two-hundred-fourteenth modernized vertical slice implements patient portal secure-message archive readiness by adding session-protected `DELETE /api/patient-portal/messages/{messageId}`, preserving OpenEMR-compatible `message_status = Delete` plus soft-delete active-folder hiding, rendering Portal `Archive message` controls for inbox and sent messages, and proving cleanup-backed archive behavior against legacy `onsite_mail`. This closes the focused archive/delete action while leaving attachments, notification delivery, encrypted-content hardening, broader portal appointment workflow depth, portal report downloads, lifecycle audit history, and production identity hardening for future slices.
- The two-hundred-fifteenth modernized vertical slice implements patient portal secure-message read-status readiness by adding session-protected `PUT /api/patient-portal/messages/{messageId}/read`, preserving OpenEMR-compatible `message_status = Read` plus active-folder retention, rendering Portal `Mark read` controls for New inbox and sent messages, and proving cleanup-backed read-status behavior against legacy `onsite_mail` with temporary inbound messages. This closes the focused mark-read action while leaving attachments, notification delivery, encrypted-content hardening, richer notification state, broader portal appointment workflow depth, portal report downloads, lifecycle audit history, and production identity hardening for future slices.
- The two-hundred-sixteenth modernized vertical slice implements patient portal secure-message batch-archive readiness by adding session-protected `POST /api/patient-portal/messages/archive`, accepting selected message ids through the same owner-scoped soft-delete semantics as OpenEMR's portal `massdelete` path, rendering Portal row checkboxes plus `Archive selected`, and proving cleanup-backed selected-message archive behavior against legacy `onsite_mail` and the legacy portal Actions menu. This closes the focused selected-message archive action while leaving attachments, notification delivery, encrypted-content hardening, broader portal appointment workflow depth, portal report downloads, lifecycle audit history, and production identity hardening for future slices.
- The two-hundred-seventeenth modernized vertical slice implements patient portal secure-message All-folder readiness by extending session-protected `/api/patient-portal/messages` with `allMessages` / `allMessageCount`, matching OpenEMR's active owner-scoped All mailbox semantics, rendering an `All` secure-message folder in the Portal workspace, and proving cleanup-backed inbound/sent inclusion plus archived-row exclusion against legacy `onsite_mail` and the legacy portal All tab. This closes the focused active All-folder browse behavior while leaving attachments, notification delivery, encrypted-content hardening, broader portal appointment workflow depth, portal report downloads, lifecycle audit history, and production identity hardening for future slices.
- The two-hundred-eighteenth modernized vertical slice implements patient portal document list/download readiness by adding session-protected `GET /api/patient-portal/documents` and `POST /api/patient-portal/documents/download`, deriving active patient-owned documents from the existing document tables, rendering categorized Portal document cards with selected-download controls, building a ZIP package named `patient_documents.zip`, and proving the same `MOD-PAT-0004` active document list/download behavior against legacy `portal/get_patient_documents.php` and the legacy download action. This closes the focused patient portal document download path while leaving portal report downloads, document delivery integrations, richer access-policy depth, lifecycle audit history, and production identity hardening for future slices.
- The two-hundred-nineteenth modernized vertical slice implements patient portal appointment list readiness by adding session-protected `GET /api/patient-portal/appointments`, deriving the signed-in patient's 10 upcoming and 10 past appointment cards from the shared appointment table, rendering upcoming and past appointment sections in the modernized Portal workspace, and proving the same `MOD-PAT-0004` future/past appointment behavior against legacy portal home appointment cards. This closes the focused patient-visible appointment-list path while leaving broader portal appointment workflow depth, reschedule-request workflow depth, reminder delivery/audit, lifecycle audit history, and production identity hardening for future slices.
- The two-hundred-twentieth modernized vertical slice implements patient portal appointment request readiness by adding session-protected `POST /api/patient-portal/appointments/requests`, validating the signed-in patient session and requested date/time/duration, creating an OpenEMR-compatible pending `^` appointment plus provider reminder note, rendering a Portal `Schedule A New Appointment` form, and proving the same cleanup-backed request/reminder behavior against legacy portal appointment request storage. This closes the focused patient-initiated scheduling request path while leaving richer availability rules, provider confirmation workflows, reminder delivery/audit, lifecycle audit history, and production identity hardening for future slices.
- The two-hundred-twenty-first modernized vertical slice implements patient portal appointment request-options readiness by adding session-protected `GET /api/patient-portal/appointments/request-options`, deriving request visit categories, provider choices, facility choices, duration defaults, and patient/provider-specific default selections from target data, rendering named Portal request-form dropdowns instead of raw provider/facility ID inputs, and proving the same option/default behavior against legacy `portal/add_edit_event_user.php` option data. This closes the focused request-form options gap while leaving richer availability rules, provider confirmation workflows, reminder delivery/audit, lifecycle audit history, and production identity hardening for future slices.
- The two-hundred-twenty-second modernized vertical slice implements patient portal clinical-summary readiness by adding session-protected `GET /api/patient-portal/clinical-summary`, deriving signed-in patient problems, allergies, medication-list entries, and active prescriptions from the modernized clinical tables, rendering those sections in the Portal workspace, and proving the same patient-visible facts against legacy `portal/get_problems.php`, `portal/get_allergies.php`, `portal/get_medications.php`, and `portal/get_prescriptions.php`. This closes the focused portal clinical-list visibility gap while leaving refill requests, portal report downloads, richer medication reconciliation, lifecycle audit history, and production identity hardening for future slices.
- The two-hundred-twenty-third modernized vertical slice implements patient portal lab-results readiness by adding session-protected `GET /api/patient-portal/lab-results`, deriving signed-in patient procedure orders, reports, and final result rows from the modernized lab tables, rendering those results in the Portal workspace, and proving the same patient-visible facts against legacy `portal/get_lab_results.php`. This closes the focused patient-facing lab-results visibility gap while leaving downloadable report packages, result amendment/version history, external lab reconciliation, richer notification state, lifecycle audit history, and production identity hardening for future slices.
- The two-hundred-twenty-fourth modernized vertical slice implements patient portal medical-report readiness by adding session-protected `GET /api/patient-portal/medical-report`, deriving OpenEMR-style customized medical-history report sections, issue choices, encounter/form choices, procedure-order choices, and preview summary facts from the signed-in portal session, rendering those facts in the modernized Portal workspace, and proving the same report-builder readiness against legacy `portal/report/portal_patient_report.php`. This closes the focused customized medical-history report-builder gap while leaving final HTML/PDF report generation, downloadable report packages, richer report templates, lifecycle audit history, and production identity hardening for future slices.
- The two-hundred-twenty-fifth modernized vertical slice implements patient portal generated medical-report readiness by adding session-protected `POST /api/patient-portal/medical-report/generate`, generating the default customized medical-history report payload from the signed-in portal session, rendering generated patient data, billing rollup, selected procedure-order content, printable availability, and explicit PDF-pending status in the modernized Portal workspace, proving the generated report facts through normalized workflow/API results, and checking the legacy `portal/report/portal_custom_report.php` visible report shell. This closes the focused HTML generated-report gap while leaving binary PDF export, richer template fidelity, report package delivery, lifecycle audit history, and production identity hardening for future slices.
- The two-hundred-twenty-sixth modernized vertical slice implements patient portal generated medical-report PDF readiness by adding session-protected `POST /api/patient-portal/medical-report/pdf`, reusing the generated report contract to build a deterministic downloadable PDF package, enabling the modernized Portal `Download report PDF` action, normalizing legacy OpenEMR's `portal/report/portal_custom_report.php` PDF POST behavior, and proving PDF metadata/content readiness with a dedicated side-by-side plan. This closes the focused binary PDF export gap while leaving richer report-template fidelity, report package delivery, lifecycle audit history, email/delivery integrations, and production identity hardening for future slices.
- The two-hundred-twenty-seventh modernized vertical slice implements patient portal generated medical-report issue-selection readiness by extending generated-report requests with selected `issueIds`, rendering all report-builder issue choices as checkboxes in the modernized Portal, adding selected issue rows and included issue IDs to generated report/PDF payloads, normalizing legacy OpenEMR's `portal/report/portal_custom_report.php` issue-checkbox POST behavior, and proving selected medical-problem, allergy, and medication content with a dedicated side-by-side plan. This closes the focused selected-issue generated-report gap while leaving richer template fidelity, report package delivery, lifecycle audit history, email/delivery integrations, and production identity hardening for future slices.
- The two-hundred-twenty-eighth modernized vertical slice implements patient portal generated medical-report encounter-form selection readiness by extending generated-report requests with selected legacy-compatible `encounterFormIds`, rendering all report-builder encounter forms as checkboxes in the modernized Portal, adding selected Encounter Forms rows and included form IDs to generated report/PDF payloads, adding legacy gold-seed `New Patient Encounter` wrapper rows so OpenEMR can group existing Vitals/SOAP rows in the portal report builder, normalizing legacy OpenEMR's `portal/report/portal_custom_report.php` `formdir_formid` checkbox POST behavior, and proving selected Vitals/SOAP form content with a dedicated side-by-side plan. This closes the focused selected-encounter-form generated-report gap while leaving richer template fidelity, report package delivery, lifecycle audit history, email/delivery integrations, and production identity hardening for future slices.
- The two-hundred-twenty-ninth modernized vertical slice implements patient portal generated medical-report printable template readiness by deriving the same facility block, printable patient name, `PATIENT:` header line, generated-on label, and signature-line availability that legacy OpenEMR emits for printable customized medical-history reports, exposing those facts as generated-report `templateMetadata`, rendering them in the modernized Portal generated-report panel, adding them to the deterministic PDF payload, and proving them against legacy `portal/report/portal_custom_report.php?printable=1` with a dedicated side-by-side plan. The legacy seed now overlays the installed default OpenEMR facility row with the gold primary facility identity so printable reports use the intended test clinic rather than the stock placeholder. This closes the focused printable generated-report header gap while leaving richer multi-page report template fidelity, report package delivery, lifecycle audit history, email/delivery integrations, and production identity hardening for future slices.
- The two-hundred-thirtieth modernized vertical slice implements patient portal generated medical-report package readiness by adding session-protected `POST /api/patient-portal/medical-report/package`, exposing generated-report package metadata with deterministic ZIP filename and entry names, packaging the generated PDF with `manifest.json` and `summary.txt`, rendering the package action and metadata in the modernized Portal, normalizing legacy source printable/PDF artifacts, and proving the package delivery contract with a dedicated side-by-side plan. This closes the focused report package delivery gap while leaving richer multi-page template fidelity, lifecycle audit history, email/delivery integrations, and production identity hardening for future slices.
- The two-hundred-thirty-first modernized vertical slice implements patient portal generated medical-report lifecycle audit readiness by adding modernized PostgreSQL `patient_portal_report_audit_events`, recording generated-report, PDF-download, and ZIP-package-download events from the session-protected report endpoints, exposing session-protected `GET /api/patient-portal/medical-report/audit`, rendering a Report Audit timeline in the modernized Portal generated-report panel, normalizing legacy generated-report source actions as audit evidence, and proving the audit contract with a dedicated side-by-side plan. This closes the focused generated-report lifecycle audit gap while leaving richer multi-page report template fidelity, email/delivery integrations, broader portal audit policy, and production identity hardening for future slices.
- The two-hundred-thirty-second modernized vertical slice implements patient portal secure-message lifecycle audit readiness by adding modernized PostgreSQL `patient_portal_message_audit_events`, recording compose, reply, read, single-message archive, and selected-message archive events from session-protected portal message endpoints, exposing session-protected `GET /api/patient-portal/messages/audit`, rendering a Message Audit timeline in the modernized Portal secure-message area, normalizing legacy secure-message source actions as audit evidence, and proving the audit contract with a dedicated side-by-side plan. This closes the focused secure-message lifecycle audit gap while leaving encrypted-body hardening, attachments, routing queues, notification delivery, broader audit reporting policy, and production identity hardening for future slices.
- The two-hundred-thirty-third modernized vertical slice implements patient portal secure-message encrypted-body readiness by protecting encrypted mailbox body text at the modernized API boundary, returning the fixed placeholder `Encrypted secure message body is protected.` for encrypted portal rows, rendering encrypted-message status in the Portal secure-message area, normalizing legacy `onsite_mail.is_msg_encrypted` evidence through the same placeholder, and proving cleanup-backed encrypted inbox behavior with a dedicated side-by-side plan. This closes the focused encrypted-body exposure gap while leaving full encryption key management/decryption policy, attachments, routing queues, notification delivery, broader audit reporting policy, and production identity hardening for future slices.
- The two-hundred-thirty-fourth modernized vertical slice implements patient portal secure-message forward-to-practice readiness by adding session-protected `POST /api/patient-portal/messages/{messageId}/forward`, creating the matching practice-side patient message row, marking the original portal inbox message `Sent`, rendering a Portal `Forward to practice` control for inbound secure messages, and proving cleanup-backed forwarding with a dedicated side-by-side plan. This closes the focused forward-to-practice path while leaving full encryption key management/decryption policy, attachments, richer routing queues, priority/escalation, notification delivery, broader audit reporting policy, and production identity hardening for future slices.
- The two-hundred-thirty-fifth modernized vertical slice implements patient portal secure-message Deleted-folder readiness by extending session-protected `GET /api/patient-portal/messages` with `deletedMessageCount` and `deletedMessages`, projecting owner-scoped archived mailbox rows into a read-only Portal Deleted section, keeping archived rows hidden from Inbox, Sent, and All, normalizing legacy `getdeleted` / Archive-tab behavior, and proving cleanup-backed deleted-folder rendering with a dedicated side-by-side plan. This closes the focused archived mailbox visibility gap while leaving restore/permanent-purge policy, full encryption key management/decryption policy, attachments, richer routing queues, priority/escalation, notification delivery, broader audit reporting policy, and production identity hardening for future slices.
- The two-hundred-thirty-sixth modernized vertical slice implements patient portal generated medical-report procedure-order selection readiness by proving selected `procedures[]` report-builder behavior against legacy OpenEMR, adding a dedicated cleanup-backed parity suite that creates temporary procedure orders for `MOD-PAT-0004`, selecting those procedure-order IDs in generated customized medical-history reports, rendering the selected procedure-order count and content in the modernized Portal generated-report panel, and exposing managed Slice 236 plan actions through the Workbench. This closes the focused selected procedure-order generated-report gap while leaving richer multi-page report template fidelity, email/delivery integrations, broader portal audit policy, and production identity hardening for future slices.
- The two-hundred-thirty-seventh modernized vertical slice implements patient portal generated medical-report procedure-order artifact readiness by extending selected procedure-order coverage into downloadable artifacts. The parity suite creates cleanup-backed temporary procedure orders for `MOD-PAT-0004`, selects those IDs for generated medical-report PDF and ZIP package delivery, inspects the modernized PDF, package manifest, `summary.txt`, and packaged PDF entry for selected procedure-order evidence, verifies the modernized Portal download controls remain available for the selected report, compares legacy printable/PDF source artifact behavior for the same selected order, and exposes managed Slice 237 plan actions through the Workbench. This closes the focused selected-order delivery-artifact gap while leaving richer multi-page report template fidelity, email/delivery integrations, broader portal audit policy, and production identity hardening for future slices.
- The two-hundred-thirty-eighth modernized vertical slice implements patient portal secure-message recipient-directory readiness by adding session-protected `GET /api/patient-portal/messages/recipients`, normalizing OpenEMR's portal `authrecips` behavior for active `portal_user` users plus admin fallback routing, validating compose requests against that recipient directory, rendering the modernized Portal `To` field as a route selector instead of arbitrary free text, and proving the same recipient option on legacy and modernized portal compose surfaces. This closes the focused recipient-routing selector gap while leaving full encryption key management/decryption policy, attachments, richer routing queues, priority/escalation, notification delivery, broader audit reporting policy, and production identity hardening for future slices.
- The two-hundred-thirty-ninth modernized vertical slice implements patient portal secure-message subject preset readiness by adding session-protected `GET /api/patient-portal/messages/compose-options`, exposing OpenEMR-compatible compose subject values (`General`, `Insurance`, `Prior Auth`, `Bill/Collect`, `Referral`, and `Pharmacy`) alongside the existing recipient directory, rendering the modernized Portal subject as an editable datalist-backed input, and proving the same preset options plus free-text subject behavior on legacy and modernized portal compose surfaces. This closes the focused compose-subject fidelity gap while leaving full encryption key management/decryption policy, attachments, richer routing queues, priority/escalation, notification delivery, broader audit reporting policy, and production identity hardening for future slices.
- The two-hundred-fortieth modernized vertical slice implements patient portal secure-message HTML body rendering readiness by rendering secure-message bodies through DOMPurify with the same HTML profile and `a`/`img` stripping policy used by legacy OpenEMR, preserving the raw HTML body at the workflow/API boundary, and proving allowed formatting plus blocked link/image rendering on both portal targets with a cleanup-backed temporary inbox message. This closes the focused body-rendering fidelity gap while leaving full encryption key management/decryption policy, attachments, richer routing queues, priority/escalation, notification delivery, broader audit reporting policy, and production identity hardening for future slices.
- The two-hundred-forty-first modernized vertical slice implements patient portal secure-message pagination readiness by matching legacy OpenEMR's 20-message page size for the modernized Portal Inbox, Sent, All, and Deleted secure-message folders, adding accessible previous/next pager controls, keeping page indexes bounded as message counts change, and proving cleanup-backed second-page inbox behavior with deterministic temporary mailbox rows on both portal targets. This closes the focused folder-pagination fidelity gap while leaving full encryption key management/decryption policy, attachments, richer routing queues, priority/escalation, notification delivery, broader audit reporting policy, and production identity hardening for future slices.
- The two-hundred-forty-second modernized vertical slice implements patient portal secure-message mark-all-read readiness by mirroring legacy OpenEMR's visible Actions menu behavior: the toolbar changes current secure-message rows from `New` to `Read` in the browser, but because the legacy `readAll()` function does not call `handle_note.php`, the mailbox rows remain `New` after refresh. The modernized Portal adds the same browser-visible `Mark all as read` affordance with local read-state overrides, clears those overrides when mailbox data refreshes, and proves cleanup-backed temporary inbox messages keep their persisted `New` status on both targets. This closes the focused toolbar-fidelity gap while leaving durable bulk-read policy, full encryption key management/decryption policy, attachments, richer routing queues, priority/escalation, notification delivery, broader audit reporting policy, and production identity hardening for future slices.

- The two-hundred-forty-third modernized vertical slice implements patient portal prescription modified-date readiness by adding `prescriptions.modified_date` to the generated Postgres seed/schema, preserving modified-date writes for modernized prescription mutations, projecting `ModifiedDate` through the patient-portal clinical-summary API, rendering the value in Portal prescription cards, and proving `MOD-PAT-0004`'s active Omeprazole, Sumatriptan, and Sertraline modified dates against legacy OpenEMR's portal `Last Modified` prescription table. This closes the focused active-prescription timestamp fidelity gap while leaving medication reconciliation, pharmacy routing, refill/e-prescribing workflows, controlled-substance policy, and broader prescription audit history for future slices.

- The two-hundred-forty-fourth modernized vertical slice implements patient portal prescription start-date readiness by adding `prescriptions.date_added` to the generated Postgres seed/schema, writing deterministic date-added timestamps for modernized prescription creation, projecting portal prescription `StartDate` from `date_added` instead of `start_date`, rendering the timestamp in Portal prescription cards, and proving `MOD-PAT-0004`'s active prescription start-date timestamps against legacy OpenEMR's portal `Start Date` column. This closes the focused portal prescription date-added fidelity gap while leaving medication reconciliation, pharmacy routing, refill/e-prescribing workflows, controlled-substance policy, and broader prescription audit history for future slices.

- The two-hundred-forty-fifth modernized vertical slice implements patient portal prescription end-date filtering readiness by adding a cleanup-backed parity suite that creates a temporary prescription for `MOD-PAT-0004`, deactivates it with an `end_date`, proves both legacy OpenEMR and the modernized Portal exclude it from the active prescription list, verifies the permanent active prescriptions still expose null end dates, and aligns the modernized Portal prescription card label with legacy OpenEMR's `End Date` column. This closes the focused active-prescription filter and end-date projection gap while leaving medication reconciliation, pharmacy routing, refill/e-prescribing workflows, controlled-substance policy, inactive-prescription history views, and broader prescription audit history for future slices.

- The two-hundred-forty-sixth modernized vertical slice implements patient portal medication date-column readiness by adding deterministic medication `modifiedDate` values to the gold dataset, seeding legacy `lists.modifydate` and modernized `medications.modified_date`, projecting all portal medication-list rows without an active-only filter, rendering modernized Portal medication cards with legacy-aligned `Last Modified` and `End Date` labels, and proving a cleanup-backed ended medication-list row still appears in the signed-in patient's portal medication list on both targets. This closes the focused portal medication date-column and ended-row fidelity gap while leaving structured medication reconciliation, pharmacy routing, dose/frequency normalization, medication audit history, and richer inactive-medication views for future slices.

- The two-hundred-forty-seventh modernized vertical slice implements patient portal problem date-column readiness by projecting all portal problem-list rows without an active-only filter, rendering modernized Portal problem cards with legacy-aligned `Reported Date`, `Start Date`, and `End Date` labels, and proving a cleanup-backed ended problem-list row still appears in the signed-in patient's portal problem list on both targets. This closes the focused portal problem date-column and ended-row fidelity gap while leaving problem-list audit history, diagnosis coding depth, inactive-problem management views, and richer clinical reconciliation workflows for future slices.
- The two-hundred-forty-eighth modernized vertical slice implements patient portal allergy date-column readiness by projecting all portal allergy rows without an active-only filter, rendering modernized Portal allergy cards with legacy-aligned `Reported Date`, `Start Date`, `End Date`, and `Referrer` labels, and proving a cleanup-backed ended allergy row still appears in the signed-in patient's portal allergy list on both targets. This closes the focused portal allergy date-column, referrer-label, and ended-row fidelity gap while leaving nonblank allergy referrer seed migration, allergy audit history, vocabulary depth, and richer clinical reconciliation workflows for future slices.
- The two-hundred-forty-ninth modernized vertical slice implements patient portal home immunization readiness by adding a portal-home immunization projection separate from the clinician clinical-list projection, rendering a modernized `Patient Immunization` health-snapshot card, and proving cleanup-backed entered-in-error immunization rows still appear in the signed-in patient's portal home just as legacy OpenEMR's `portal/home.php` renders them. This closes the focused portal health-snapshot immunization gap while leaving vaccine-registry exchange, VIS document workflows, immunization forecasting, and richer reconciliation/audit views for future slices.
- The two-hundred-fiftieth modernized vertical slice implements patient portal profile readiness by adding a session-protected `GET /api/patient-portal/profile` endpoint, rendering a modernized `Profile From Medical Records` card, and proving `MOD-PAT-0004`'s demographics plus primary and secondary insurance facts against legacy OpenEMR's `portal/get_profile.php` profile fragment. This closes the focused read-only portal profile gap while leaving patient-submitted profile edit/pending-review workflows, richer layout-row metadata, and insurance edit workflows for future slices.
- The two-hundred-fifty-first modernized vertical slice implements patient portal profile change request readiness by adding a session-protected `POST /api/patient-portal/profile/changes` endpoint, a generated PostgreSQL `patient_portal_profile_change_requests` pending-review table, a modernized Portal profile edit form that renders the legacy-aligned `Edit Profile` / `Edit Pending Changes.` state, and a cleanup-backed parity suite that proves submitted profile edits become waiting review requests without mutating medical-record demographics. This closes the first patient-submitted portal profile edit gap while leaving staff review/accept/reject workflows, richer layout-row metadata, and insurance edit workflows for future slices.
- The two-hundred-fifty-second modernized vertical slice implements patient portal profile review queue readiness by expanding the administration directory API with OpenEMR-style waiting portal audit counts and staff-visible profile review requests, rendering those requests in the modernized Admin workspace, and adding a cleanup-backed parity plan that submits a patient portal profile edit and verifies both legacy `onsite_portal_activity` and modernized administration output expose the same waiting review facts. This closes the read-only staff queue gap while leaving accept/reject review mutations, richer layout-row metadata, and insurance edit workflows for future slices.
- The two-hundred-fifty-third modernized vertical slice implements patient portal profile review accept readiness by adding a protected administration accept endpoint, rendering a modernized Admin `Commit to Chart` action, committing requested portal profile demographics into the chart, closing the waiting review request with OpenEMR-style `completed` / `accept` metadata, and proving the same acceptance outcome against legacy `onsite_portal_activity` with a cleanup-backed parity plan. This closes the positive staff review mutation while leaving legacy revert-edit handling, richer layout-row metadata, and insurance edit workflows for future slices.
- The two-hundred-fifty-fourth modernized vertical slice implements patient portal profile review revert readiness by matching OpenEMR's staff-side `Revert Edits` behavior: pending edited values are replaced with chart-original values before the review is closed, the audit still uses OpenEMR-style `completed` / `accept` metadata, and chart demographics remain unchanged. This closes the legacy negative staff review path while leaving richer layout-row metadata and insurance edit workflows for future slices.
- The two-hundred-fifty-fifth modernized vertical slice implements patient portal secure-message notification readiness by adding a generated PostgreSQL `patient_reminders` projection, merging active recent reminders into portal secure-message Inbox and All-style results as read-only `Notification` rows, excluding them from Sent and Deleted, documenting that the observed legacy v8.1.0 Secure Messaging UI does not render those reminder rows, and rendering the modernized Portal notification rows without thread, reply, read-mark, archive, or forward actions. This closes the focused legacy `getPortalPatientNotifications` projection gap while leaving outbound notification delivery, attachment handling, and richer messaging policy for future slices.
- The two-hundred-fifty-sixth implementation slice improves Workbench comparison evidence by enriching comparison sides with screenshot/image artifact metadata, rendering compact thumbnails on Test Runs comparison cards, rendering larger visual evidence lists in drill-ins, and preserving all image access through the safe artifact endpoint. This closes the first screenshot-preview evidence gap; Slice 257 adds normalized Playwright probe detail views, while accepted-difference tracking, reliability trends, historical trend charts, and long-term evidence-retention policy remain for future Workbench slices.
- The two-hundred-fifty-seventh implementation slice improves Workbench comparison evidence by enriching comparison sides with normalized Playwright probe details from run-level JSON reports, rendering probe counts on comparison-side summaries, and showing probe titles, statuses, files, durations, tags, attachment counts, and errors in expanded drill-ins. This closes the first normalized probe detail gap while leaving database-probe payload normalization, accepted-difference tracking, reliability trends, historical trend charts, and long-term evidence-retention policy for future Workbench slices.
- The two-hundred-fifty-eighth implementation slice improves Workbench comparison governance by adding a curated accepted-difference registry, applying active acceptance rules to side-by-side comparison artifacts, rendering accepted/unreviewed counts on comparison cards, and showing accepted rule IDs plus reasons in drill-ins. This closes the first accepted-difference tracking gap while leaving an in-browser registry editor, reliability trend summaries, historical trend charts, and long-term evidence-retention policy for future Workbench slices.
- The two-hundred-fifty-ninth implementation slice improves Workbench evidence analytics by adding a lightweight `/api/parity-reliability` route over recent run/comparison artifacts and rendering rolling pass-rate, match-rate, duration, pass/fail strip, and selection-level summaries on the Test Runs page. This closes the first reliability trend summary gap while leaving deeper historical reliability charts, saved report definitions, and long-term evidence-retention policy for future Workbench slices.
- The two-hundred-sixtieth implementation slice improves Workbench comparison evidence by extending normalized probe details with safe text-like attachment previews, keeping binary trace artifacts as metadata/links, and optimizing comparison artifact enrichment so the latest comparison cards are sliced before deep report enrichment. This closes the first probe-payload rendering gap while leaving broader database query/result attachment generation for future parity-test slices.
- The two-hundred-sixty-first implementation slice makes the database gold-seed contract suite produce the first normalized database payload attachments. It writes path-backed JSON evidence for count, temporal coverage, anchor-patient, and related-record probes, and aligns both target count adapters with the shared `portalMailboxMessages` contract so the Workbench can preview those database probe payloads from comparison drill-ins.
- The two-hundred-sixty-second implementation slice extends normalized database payload attachments into the Slice 1 patient search/chart summary workflow suite. It records the `MOD-PAT-0001` demographics, activity counts, and UI steering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 1 comparison.
- The two-hundred-sixty-third implementation slice extends normalized database payload attachments into the Slice 2 scheduling workflow suite. It records the `MOD-PAT-0003` future appointment anchor and scheduling UI steering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 2 comparison.
- The two-hundred-sixty-fourth implementation slice extends normalized database payload attachments into the Slice 3 encounter clinical detail workflow suite. It records the `MOD-PAT-0001` anchor patient, latest encounter, SOAP/vitals facts, and encounter UI steering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 3 comparison.
- The two-hundred-sixty-fifth implementation slice extends normalized database payload attachments into the Slice 4 clinical lists workflow suite. It records the `MOD-PAT-0001` anchor patient, problem, allergy, medication-list, prescription, and clinical-list UI steering precondition facts as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 4 comparison.
- The two-hundred-sixty-sixth implementation slice extends normalized database payload attachments into the Slice 5 messaging workflow suite. It records the `MOD-PAT-0004` portal-enabled anchor patient, seeded care-team and portal-message facts, and messaging UI steering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 5 comparison.
- The two-hundred-sixty-seventh implementation slice extends normalized database payload attachments into the Slice 6 procedure results workflow suite. It records the `MOD-PAT-0009` anchor patient, completed CBC order, completed report, final Hemoglobin result, and procedure-results UI steering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 6 comparison.
- The two-hundred-sixty-eighth implementation slice extends normalized database payload attachments into the Slice 7 fee-sheet billing workflow suite. It records the `MOD-PAT-0001` anchor patient, latest encounter, seeded CPT fee-sheet charge lines, and billing UI steering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 7 comparison.
- The two-hundred-sixty-ninth implementation slice extends normalized database payload attachments into the Slice 8 administration directory workflow suite. It records seeded user counts, provider/calendar counts, selected provider and billing users, seeded facilities, and administration UI steering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 8 comparison.
- The two-hundred-seventieth implementation slice extends normalized database payload attachments into the Slice 9 operational reports workflow suite. It records gold-data counts, selected provider activity, selected facility activity, selected clinical-condition summaries, and reports UI steering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 9 comparison.
- The two-hundred-seventy-first implementation slice extends normalized database payload attachments into the Slice 10 patient contact mutation workflow suite. It records the `MOD-PAT-0001` anchor patient, original contact state, proposed update, post-update state, and restored contact state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 10 comparison.
- The two-hundred-seventy-second implementation slice extends normalized database payload attachments into the Slice 11 appointment mutation workflow suite. It records the `MOD-PAT-0003` anchor patient, proposed future appointment, created appointment row, cancelled appointment row, and deleted cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 11 comparison.
- The two-hundred-seventy-third implementation slice extends normalized database payload attachments into the Slice 12 encounter mutation workflow suite. It records the `MOD-PAT-0002` anchor patient, proposed encounter/vitals/SOAP payloads, created encounter row, clinical-detail rows and count increments, updated encounter row, and deleted cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 12 comparison.
- The two-hundred-seventy-fourth implementation slice extends normalized database payload attachments into the Slice 13 clinical-list allergy mutation workflow suite. It records the `MOD-PAT-0006` anchor patient, proposed allergy payload, created allergy row and count increment, deactivated allergy row, and deleted cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 13 comparison.
- The two-hundred-seventy-fifth implementation slice extends normalized database payload attachments into the Slice 14 patient-message mutation workflow suite. It records the `MOD-PAT-0004` anchor patient, proposed message payload, created message row and count increment, closed message row, soft-deleted message row, and hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 14 comparison.
- The two-hundred-seventy-sixth implementation slice extends normalized database payload attachments into the Slice 15 prescription mutation workflow suite. It records the `MOD-PAT-0008` anchor patient, proposed prescription payload, created prescription row and count increment, deactivated prescription row, and hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 15 comparison.
- The two-hundred-seventy-seventh implementation slice extends normalized database payload attachments into the Slice 16 billing mutation workflow suite. It records the `MOD-PAT-0001` anchor patient, latest encounter, proposed CPT billing-line payload, created billing row and count increment, billed/inactive row state, and hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 16 comparison.
- The two-hundred-seventy-eighth implementation slice extends normalized database payload attachments into the Slice 17 procedure mutation workflow suite. It records the `MOD-PAT-0009` anchor patient, proposed encounter/order/report/result payloads, created encounter and order count increments, completed order with final report/result rows, patient procedure summary projection, and hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 17 comparison.
- The two-hundred-seventy-ninth implementation slice extends normalized database payload attachments into the Slice 18 administration facility mutation workflow suite. It records the proposed active facility payload, temporary facility count baseline/increment, created facility row, deactivated facility row, and hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 18 comparison.
- The two-hundred-eightieth implementation slice extends normalized database payload attachments into the Slice 19 administration user mutation workflow suite. It records the proposed active user payload, temporary user count baseline/increment, created user row, deactivated user row, and hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 19 comparison.
- The two-hundred-eighty-first implementation slice extends normalized database payload attachments into the Slice 20 administration access-control read-model suite. It records ACL group, permission, group-permission assignment, user-membership counts and anchors plus UI-steering access-control matrix facts as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 20 comparison.
- The two-hundred-eighty-second implementation slice extends normalized database payload attachments into the Slice 21 administration access-permission mutation suite. It records the focused Front Office demographics ACL assignment precondition, revoked state, restored state, and final cleanup restoration as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 21 comparison.
- The two-hundred-eighty-third implementation slice extends normalized database payload attachments into the Slice 22 administration user group membership mutation suite. It records the proposed temporary user, created user before membership, granted Front Office membership, revoked membership, and final cleanup/deleted-user state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 22 comparison.
- The two-hundred-eighty-fourth implementation slice extends normalized database payload attachments into the Slice 23 pending scheduled procedure-order suite. It records the `MOD-PAT-0701` anchor patient, future scheduled CBC order, zero-report order projection, and UI-steering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 23 comparison.
- The two-hundred-eighty-fifth implementation slice extends normalized database payload attachments into the Slice 24 operational reports CSV export suite. It records the normalized 79-row export set, selected CSV anchor rows, and UI/API export precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 24 comparison.
- The two-hundred-eighty-sixth implementation slice extends normalized database payload attachments into the Slice 25 patient documents suite. It records the `MOD-PAT-0001` anchor patient, filed document metadata, categories, storage mode, text previews, and UI-steering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 25 comparison.
- The two-hundred-eighty-seventh implementation slice extends normalized database payload attachments into the Slice 26 patient document mutation suite. It records the `MOD-PAT-0001` anchor patient, proposed database-backed text document payload, created document row and count increment, archived row, and hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 26 comparison.
- The two-hundred-eighty-eighth implementation slice extends normalized database payload attachments into the Slice 27 patient document content suite. It records the `MOD-PAT-0001` anchor patient, selected intake-packet metadata, full stored text content, UI-steering precondition, and modernized content/download API response facts as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 27 comparison.
- The two-hundred-eighty-ninth implementation slice extends normalized database payload attachments into the Slice 28 patient insurance coverage suite. It records the `MOD-PAT-0005` anchor patient, normalized primary and secondary insurance coverage facts, subscriber relationship facts, and insurance UI-steering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 28 comparison.
- The two-hundred-ninetieth implementation slice extends normalized database payload attachments into the Slice 29 patient immunization history suite. It records the `MOD-PAT-0007` pediatric anchor patient, normalized vaccine-history row set, 2026 influenza and Hep A vaccine anchors, lot/manufacturer facts, and immunization UI-steering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 29 comparison.
- The two-hundred-ninety-first implementation slice extends normalized database payload attachments into the Slice 30 patient immunization mutation suite. It records the `MOD-PAT-0007` anchor patient, proposed temporary influenza immunization payload, created row and count increment, entered-in-error row state, and final hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 30 comparison.
- The two-hundred-ninety-second implementation slice extends normalized database payload attachments into the Slice 31 patient problem-list mutation suite. It records the `MOD-PAT-0006` anchor patient, proposed temporary problem payload, created row and count increment, deactivated row state, and final hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 31 comparison.
- The two-hundred-ninety-third implementation slice extends normalized database payload attachments into the Slice 32 patient medication-list mutation suite. It records the `MOD-PAT-0006` anchor patient, proposed temporary medication payload, created row and count increment, deactivated row state, and final hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 32 comparison.
- The two-hundred-ninety-fourth implementation slice extends normalized database payload attachments into the Slice 33 binary patient-document mutation suite. It records the `MOD-PAT-0001` anchor patient, proposed temporary PDF binary document payload, created row and document-count increment, archived row state, and final hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 33 comparison.
- The two-hundred-ninety-fifth implementation slice extends normalized database payload attachments into the Slice 34 patient insurance mutation suite. It records the `MOD-PAT-0005` anchor patient, baseline primary/secondary coverage, proposed temporary tertiary coverage payload, created row and coverage-count increment, updated payer/plan/policy/group row state, and final hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 34 comparison.
- The two-hundred-ninety-sixth implementation slice extends normalized database payload attachments into the Slice 35 encounter metadata mutation suite. It records the `MOD-PAT-0002` anchor patient, proposed temporary encounter metadata payload, created encounter row and count increment, updated reason/billing note/sensitivity/referral/external-ID/POS row state, and final hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 35 comparison.
- The two-hundred-ninety-seventh implementation slice extends normalized database payload attachments into the Slice 36 patient demographics mutation suite. It records the `MOD-PAT-0010` anchor patient, original demographics row, proposed identity/DOB/address/marital-status/occupation update, updated row state, and restored cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 36 comparison.
- The two-hundred-ninety-eighth implementation slice extends normalized database payload attachments into the Slice 37 patient registration lifecycle suite. It records the proposed temporary `TMP-PAT-REG-*` registration payload, baseline patient count, created demographics/contact rows and count increment, and final hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 37 comparison.
- The two-hundred-ninety-ninth implementation slice extends normalized database payload attachments into the Slice 38 patient document sign-off suite. It records the `MOD-PAT-0001` anchor patient, proposed reviewed text document payload, created pending document row and count increment, approved sign-off row, archived row, and final hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 38 comparison.
- The three-hundredth implementation slice extends normalized database payload attachments into the Slice 39 patient document external-link suite. It records the `MOD-PAT-0001` anchor patient, proposed URL-backed document payload, created external-link row and document-count increment, archived row, and final hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 39 comparison.
- The three-hundred-first implementation slice extends normalized database payload attachments into the Slice 40 patient document denial suite. It records the `MOD-PAT-0001` anchor patient, proposed reviewed text document payload, created pending document row and document-count increment, denied review row, archived row, and final hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 40 comparison.
- The three-hundred-second implementation slice extends normalized database payload attachments into the Slice 41 patient document metadata suite. It records the `MOD-PAT-0001` anchor patient, proposed original text document payload, created document row and count increment, refiled category/name/date/encounter/notes row, archived row, and final hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 41 comparison.
- The three-hundred-third implementation slice extends normalized database payload attachments into the Slice 42 patient document archive/restore suite. It records the `MOD-PAT-0001` anchor patient, proposed restorable text document payload, created document row and count increment, archived row with hidden-content projection, restored row and active-count return, and final hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 42 comparison.
- The three-hundred-fourth implementation slice extends normalized database payload attachments into the Slice 43 patient document content replacement suite. It records the `MOD-PAT-0001` anchor patient, proposed original text document and replacement payload, created document row and original stored content, replaced row and content projection, archived row, and final hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 43 comparison.
- The three-hundred-fifth implementation slice extends normalized database payload attachments into the Slice 44 billing diagnosis coding suite. It records the `MOD-PAT-0001` anchor patient, latest encounter, proposed ICD10 diagnosis billing payload, created row and encounter fee-sheet projection, inactive row, and final hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 44 comparison.
- The three-hundred-sixth implementation slice extends normalized database payload attachments into the Slice 45 billing correction suite. It records the `MOD-PAT-0001` anchor patient, latest encounter, proposed original CPT billing payload, created row, corrected fee/units/justification row and encounter fee-sheet projection, inactive row, and final hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 45 comparison.
- The three-hundred-seventh implementation slice extends normalized database payload attachments into the Slice 46 billing modifier suite. It records the `MOD-PAT-0001` anchor patient, latest encounter, proposed original CPT billing payload, created row with blank modifier, modified `25` row and encounter fee-sheet projection, inactive row, and final hard-delete cleanup state as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 46 comparison.
- The three-hundred-eighth implementation slice extends normalized database payload attachments into the Slice 47 claim status suite. It records the `MOD-PAT-0005` anchor patient, encounter `1000052`, seeded queued/generated/cleared Northstar HMO claim rows, and Fees rendering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 47 comparison.
- The three-hundred-ninth implementation slice extends normalized database payload attachments into the Slice 48 payment posting suite. It records the `MOD-PAT-0005` anchor patient, encounter `1000052`, seeded `EOB-NSTAR-1000052` insurance payment and contractual adjustment rows, and Fees rendering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 48 comparison.
- The three-hundred-tenth implementation slice extends normalized database payload attachments into the Slice 49 account balance suite. It records the `MOD-PAT-0005` anchor patient, encounter `1000052`, patient-level charge/payment/adjustment/balance totals, encounter-level rollups, and Fees rendering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 49 comparison.
- The three-hundred-eleventh implementation slice extends normalized database payload attachments into the Slice 50 account aging suite. It records the `MOD-PAT-0005` anchor patient, as-of date `2026-06-18`, deterministic Current/31-60/Over 90 encounter rows, bucket totals, total balance, and Fees rendering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 50 comparison.
- The three-hundred-twelfth implementation slice extends normalized database payload attachments into the Slice 51 account ledger suite. It records the `MOD-PAT-0005` anchor patient, chronological charge/payment/adjustment rows, entry-type counts, first/last ledger entries, charge/payment/adjustment totals, final running balance, reference examples, and Fees rendering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 51 comparison.
- The three-hundred-thirteenth implementation slice extends normalized database payload attachments into the Slice 52 account statement suite. It records the `MOD-PAT-0005` anchor patient, statement-ready recipient/address/contact facts, period/due-date/status facts, open encounter and ledger counts, current/past/balance due amounts, source balance/aging/ledger context, and Fees rendering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 52 comparison.
- The three-hundred-fourteenth implementation slice extends normalized database payload attachments into the Slice 53 document preview suite. It records the `MOD-PAT-0001` anchor patient, deterministic text document preview rows, document keys/categories/storage metadata, preview kind/status, thumbnail labels/text, inline/download flags, and Documents rendering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 53 comparison.
- The three-hundred-fifteenth implementation slice extends normalized database payload attachments into the Slice 54 document revision suite. It records the `MOD-PAT-0001` anchor patient, current-version document rows, revision timestamps, version labels/status/counts, prior-version flags, revision hashes, content detail revision facts, and Documents rendering precondition as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 54 comparison.
- The three-hundred-sixteenth implementation slice extends normalized database payload attachments into the Slice 55 document replacement revision suite. It records the `MOD-PAT-0001` anchor patient, proposed temporary document and replacement payload, created current-version facts, replaced revision timestamp/hash movement, archived state, and hard-delete cleanup as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 55 comparison.
- The three-hundred-seventeenth implementation slice extends normalized database payload attachments into the Slice 56 payment posting mutation suite. It records the `MOD-PAT-0005` billing anchor, encounter `1000052`, proposed temporary insurance payment posting, payment/session/activity counts, payment and adjustment balance movement, ledger entries, void rollback, active-row hiding, and hard-delete cleanup as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 56 comparison.
- The three-hundred-eighteenth implementation slice extends normalized database payload attachments into the Slice 57 claim status mutation suite. It records the `MOD-PAT-0005` billing anchor, encounter `1000052`, proposed queued claim, queued/generated/cleared claim transitions, process file/target/x12 fields, claim-count increments, and hard-delete cleanup as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 57 comparison.
- The three-hundred-nineteenth implementation slice extends normalized database payload attachments into the Slice 58 patient payment capture suite. It records the `MOD-PAT-0005` billing anchor, encounter `1000052`, proposed patient payment posting, payment/session/activity counts, balance and ledger movement, void rollback, and hard-delete cleanup as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 58 comparison.
- The three-hundred-twentieth implementation slice extends normalized database payload attachments into the Slice 59 patient statement generation suite. It records the `MOD-PAT-0005` billing anchor, statement summary, ledger source rows, deterministic statement number, generated text, line totals, and ending balance as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 59 comparison.
- The three-hundred-twenty-first implementation slice extends normalized database payload attachments into the Slice 60 patient statement PDF export suite. It records the `MOD-PAT-0005` billing anchor, statement summary, ledger source rows, deterministic PDF filename/content type/header, text anchors, line totals, and ending balance as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 60 comparison.
- The three-hundred-twenty-second implementation slice extends normalized database payload attachments into the Slice 61 statement batch candidate suite. It records the ranked full-population statement batch candidates, all-candidate totals, selected top-five candidates, statement identifiers, statuses, balances, aging fields, open encounter counts, ledger counts, delivery methods, and UI-steering anchors as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 61 comparison.
- The three-hundred-twenty-third implementation slice extends normalized database payload attachments into the Slice 62 statement batch package export suite. It records ranked package source candidates, deterministic package ID and ZIP filename, manifest fields, summary CSV anchors, package PDF filenames, first-PDF header/text anchors, and UI export affordance facts as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 62 comparison.
- The three-hundred-twenty-fourth implementation slice extends normalized database payload attachments into the Slice 63 collections work queue suite. It records ranked past-due accounts, queue and high-priority counts, balance/past-due/over-90 totals, aging fields, open encounter counts, ledger counts, collection tiers, recommended actions, contact methods, and UI/API anchors as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 63 comparison.
- The three-hundred-twenty-fifth implementation slice extends normalized database payload attachments into the Slice 64 collections follow-up task suite. It records the selected collections queue account, proposed pnotes-compatible task payload, created row and message-count increment, closed row, modernized UI-created task row, soft-delete/archive state, and final hard-delete cleanup counts as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 64 comparison.
- The three-hundred-twenty-sixth implementation slice extends normalized database payload attachments into the Slice 65 patient-message assignment suite. It records the `MOD-PAT-0004` anchor patient, proposed temporary pnotes-compatible message payload, created admin-assigned row and message-count increment, billing-reassigned row and count stability, soft-delete/archive state, and final hard-delete cleanup counts as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 65 comparison.
- The three-hundred-twenty-seventh implementation slice extends normalized database payload attachments into the Slice 66 patient-message content suite. It records the `MOD-PAT-0004` anchor patient, proposed temporary pnotes-compatible message payload, planned title/body edit, created row and message-count increment, edited title/body row and count stability, soft-delete/archive state, and final hard-delete cleanup counts as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 66 comparison.
- The three-hundred-twenty-eighth implementation slice extends normalized database payload attachments into the Slice 67 encounter document attachment suite. It records the `MOD-PAT-0001` anchor patient, encounter `1000013`, seeded attached document rows, category/preview/download expectations, legacy document-category rendering facts, modernized encounter-detail API rows, and Encounters workspace UI anchors as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 67 comparison.
- The three-hundred-twenty-ninth implementation slice extends normalized database payload attachments into the Slice 68 encounter billing linkage suite. It records the `MOD-PAT-0001` anchor patient, encounter `1000013`, linked CPT fee-sheet billing rows, total-fee and justification expectations, legacy Fee Sheet rendering facts, modernized encounter-detail API rows, and Encounters workspace billing-linkage UI anchors as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 68 comparison.
- The three-hundred-thirtieth implementation slice extends normalized database payload attachments into the Slice 69 encounter claim linkage suite. It records the `MOD-PAT-0001` anchor patient, encounter `1000013`, cleared HCFA `CLAIM-1000013-1` claim row, Acme Health payer/status facts, legacy normalized claim reachability, modernized encounter-detail API rows, and Encounters workspace claim-linkage UI anchors as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 69 comparison.
- The three-hundred-thirty-first implementation slice extends normalized database payload attachments into the Slice 70 encounter procedure order linkage suite. It records the `MOD-PAT-0001` anchor patient, encounter `1000011`, Hemoglobin A1c order `5000001`, reviewed report `6000001`, final A1c result anchors, legacy Procedure Results rendering facts, modernized encounter-detail API rows, and Encounters workspace procedure-order UI anchors as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 70 comparison.
- The three-hundred-thirty-second implementation slice extends normalized database payload attachments into the Slice 71 encounter diagnosis coding suite. It records the `MOD-PAT-0001` anchor patient, billing encounter `1000013`, procedure encounter `1000011`, `E78.5` billing/fee-sheet diagnosis facts, `E11.9` procedure-order diagnosis facts, legacy encounter/Fee Sheet/Procedure Results rendering facts, modernized encounter-detail API rows, and Encounters workspace diagnosis-coding UI anchors as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 71 comparison.
- The three-hundred-thirty-third implementation slice extends normalized database payload attachments into the Slice 72 encounter billing linkage mutation suite. It records the `MOD-PAT-0001` anchor patient, encounter `1000013`, temporary `99499` CPT billing row, baseline/create/inactive/cleanup count movement, legacy Fee Sheet rendering facts, modernized encounter-detail API rows, and Encounters workspace billing/diagnosis linkage UI anchors as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 72 comparison.
- The three-hundred-thirty-fourth implementation slice extends normalized database payload attachments into the Slice 73 encounter diagnosis coding mutation suite. It records the `MOD-PAT-0001` anchor patient, encounter `1000013`, temporary `R73.03` ICD10 diagnosis row, baseline/create/inactive/cleanup count movement, legacy Fee Sheet rendering facts, modernized encounter-detail API rows, and Encounters workspace diagnosis-coding UI anchors as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 73 comparison.
- The three-hundred-thirty-fifth implementation slice extends normalized database payload attachments into the Slice 74 encounter fee-sheet entry suite. It records the MOD-PAT-0001 anchor patient, encounter 1000013, temporary 99499 CPT row, temporary R73.03 ICD10 diagnosis row, baseline/create/inactive/cleanup count movement, legacy Fee Sheet rendering facts, modernized encounter-detail API rows, and Encounters workspace fee-sheet/billing/diagnosis UI anchors as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 74 comparison.
- The three-hundred-thirty-sixth implementation slice extends normalized database payload attachments into the Slice 75 encounter procedure-order entry suite. It records the MOD-PAT-0001 anchor patient, encounter 1000013, temporary 80053 pending laboratory order, baseline/create/cleanup count movement, legacy Procedure Orders and Reports rendering facts, modernized encounter-detail API procedure-order rows, and Encounters workspace procedure-order entry/linkage UI anchors as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 75 comparison.
- The three-hundred-thirty-seventh implementation slice extends normalized database payload attachments into the Slice 76 encounter procedure-result entry suite. It records the MOD-PAT-0001 anchor patient, encounter 1000013, temporary 80053 laboratory order, reviewed final report, 2345-7 Glucose result, baseline/create/cleanup count movement, legacy Procedure Results rendering facts, modernized encounter-detail API report/result rows, and Encounters workspace procedure result-entry/linkage UI anchors as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 76 comparison.
- The three-hundred-thirty-eighth implementation slice extends normalized database payload attachments into the Slice 77 encounter sign-off suite. It records the MOD-PAT-0002 anchor patient, temporary encounter, admin signature row, signature hash facts, signature deletion state, final encounter cleanup, legacy patient summary rendering facts, and modernized Encounters sign-off UI anchors as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 77 comparison.
- The three-hundred-thirty-ninth implementation slice extends normalized database payload attachments into the Slice 78 encounter document upload suite. It records the MOD-PAT-0001 anchor patient, encounter 1000013, baseline encounter document list, temporary text attachment, normalized document projection, legacy Documents category rendering facts, modernized encounter-detail API document rows, Encounters attached-document UI anchors, and final cleanup as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 78 comparison.
- The three-hundred-fortieth implementation slice extends normalized database payload attachments into the Slice 79 encounter binary document upload suite. It records the MOD-PAT-0001 anchor patient, encounter 1000013, baseline encounter document list, temporary PDF attachment, normalized binary document projection, PDF base64/size facts, modernized download response, legacy Documents category rendering facts, Encounters attached-document UI anchors, and final cleanup as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 79 comparison.
- The three-hundred-forty-first implementation slice extends normalized database payload attachments into the Slice 80 encounter document sign-off suite. It records the MOD-PAT-0001 anchor patient, encounter 1000013, baseline encounter document list, temporary reviewed text attachment, created pending row, approved sign-off/review facts, legacy Documents category rendering facts, modernized encounter-detail API review rows, Encounters attached-document sign-off UI anchors, and final cleanup as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 80 comparison.
- The three-hundred-forty-second implementation slice extends normalized database payload attachments into the Slice 81 encounter document denial suite. It records the MOD-PAT-0001 anchor patient, encounter 1000013, baseline encounter document list, temporary reviewed text attachment, created pending row, denied review facts, legacy Documents category rendering facts, modernized encounter-detail API review rows, Encounters attached-document denial UI anchors, and final cleanup as path-backed JSON evidence on both legacy and modernized runs while preserving a matched side-by-side Slice 81 comparison.
