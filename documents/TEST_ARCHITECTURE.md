# Test Architecture

Created: 2026-06-18

## Purpose

This document defines how the project writes, runs, stores, and compares tests for the legacy OpenEMR baseline and the modernized OpenEMR target.

The goal is not only to test legacy OpenEMR. The goal is to build executable parity specifications that describe observable behavior and domain state so the same tests can run against the modernized implementation as each slice is delivered.

## Current Implementation

The parity test harness lives in `parity-tests/`.

Technology stack:

- TypeScript.
- Playwright Test.
- Node.js command orchestration.
- Legacy MariaDB probes through Docker Compose and the MariaDB CLI.
- Legacy workflow mutation actions through an adapter layer.
- Manifest-defined suites and run plans.
- A run-summary comparator for side-by-side parity evidence.
- JSON, JUnit, HTML, screenshots, videos, and Playwright traces as test evidence.

The Workbench Test Runs page now reads recent side-by-side comparison artifacts, surfaces comparison-side screenshot/image artifacts as thumbnails when they exist, renders normalized Playwright probe details from comparison-side JSON reports, previews safe text-like probe attachments when artifacts provide them, separates curated accepted differences from unreviewed differences, and shows rolling reliability summaries from stored run/comparison artifacts, while still linking run JSON, Playwright JSON, JUnit XML, HTML reports, and the comparison JSON through the safe artifact endpoint. The database gold-seed contract suite writes path-backed JSON probe attachments for count, temporal coverage, anchor-patient, and related-record checks. Slice 1 through Slice 142 plus Slices 144, 145, 147, 148, 149, 151, 153, 154, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, and 242 workflow suites now write path-backed workflow database attachments, including patient chart, scheduling, encounter, encounter metadata mutation, patient demographics mutation, patient registration mutation, patient document sign-off mutation, patient document external-link mutation, patient document denial mutation, patient document metadata mutation, patient document archive/restore mutation, patient document content replacement mutation, billing diagnosis mutation, billing correction mutation, billing modifier mutation, claim status read, payment posting read, account balance read, account aging read, account ledger read, account statement read, statement batch candidate read, statement batch package export read, document preview read, document revision read, document replacement revision mutation, payment posting mutation, clinical-list, messaging, procedure, procedure result correction, procedure specimen, procedure specimen detail, procedure order correction, procedure report correction, procedure report sign-off, procedure report review queue, procedure report review filters, procedure report review provider filters, procedure report review lab filters, procedure lab provider catalog, procedure lab provider directory, procedure lab provider lifecycle, procedure lab provider configuration, procedure lab provider address-book, procedure order catalog, procedure order catalog lifecycle, procedure vendor compendium import, procedure order queue, procedure order transmit, procedure report bulk sign-off, procedure report reopen review, billing, administration, reports, document read, document mutation, document content, binary document mutation, patient binary document content replacement, patient image document preview, patient image document thumbnail, patient PDF inline-preview, patient document lifecycle timeline, patient scanned attachment, appointment reschedule, appointment arrival, appointment check-out, appointment no-show, appointment category, appointment pending-status, appointment provider reassignment, appointment facility reassignment, appointment billing-location reassignment, appointment comments, appointment recurrence metadata, appointment recurring-series, appointment recurrence-exceptions, appointment occurrence-cancel, appointment occurrence-restore, appointment occurrence-reschedule, appointment recurrence exception-list edit, appointment series root update, appointment series root metadata, appointment monthly recurrence, appointment recurrence unit matrix, appointment days-of-week recurrence, appointment monthly repeat-on recurrence, appointment series recurrence update, appointment provider overlap, appointment patient overlap, appointment room overlap, appointment reminders, insurance coverage, insurance mutation, immunization history, immunization mutation, problem-list mutation, medication-list mutation payloads, collections follow-up task lifecycle payloads, message assignment payloads, message content payloads, patient-message reply payloads, patient-message portal metadata payloads, patient-message update metadata payloads, admin login payloads, admin login audit payloads, admin session payloads, admin audit protection payloads, admin directory protection payloads, operational reports protection payloads, patient chart protection payloads, clinical-list protection payloads, appointment protection payloads, encounter protection payloads, document protection payloads, message protection payloads, billing protection payloads, procedure protection payloads, administration authorization-policy payloads, operational reports authorization-policy payloads, patient chart authorization-policy payloads, clinical-list authorization-policy payloads, appointment authorization-policy payloads, encounter authorization-policy payloads, patient document authorization-policy payloads, patient message authorization-policy payloads, billing authorization-policy payloads, procedure authorization-policy payloads, procedure mutation authorization-policy payloads, patient mutation authorization-policy payloads, encounter mutation authorization-policy payloads, document mutation authorization-policy payloads, message mutation authorization-policy payloads, billing mutation authorization-policy payloads, appointment mutation authorization-policy payloads, encounter amendment history payloads, patient duplicate detection payloads, patient registration validation payloads, patient deceased-status payloads, patient guardian-contact payloads, patient guardian demographic/address payloads, patient social-detail payloads, patient employer core payloads, patient provider assignment payloads, patient care-team payloads, patient multi-member care-team payloads, patient contact-backed care-team payloads, patient history/lifestyle payloads, patient insurance subscriber payloads, patient portal account payloads, patient portal reset payloads, patient portal access payloads, patient portal authentication payloads, patient portal session payloads, patient portal home payloads, patient portal secure-message inbox payloads, patient portal secure-message compose payloads, patient portal secure-message reply payloads, patient portal secure-message thread payloads, patient portal secure-message archive payloads, patient portal secure-message read-status payloads, patient portal secure-message batch archive payloads, patient portal secure-message All-folder payloads, patient portal document list/download payloads, patient portal appointment list payloads, patient portal appointment request payloads, patient portal appointment request-options payloads, patient portal clinical-summary payloads, patient portal lab-results payloads, patient portal medical-report payloads, patient portal generated medical-report payloads, patient portal generated medical-report PDF payloads, patient portal generated medical-report issue-selection payloads, patient portal secure-message Deleted-folder payloads, patient portal generated medical-report procedure-order selection payloads, patient portal generated medical-report procedure-order artifact payloads, patient portal secure-message recipient-directory payloads, patient portal secure-message subject-preset payloads, patient portal secure-message HTML-body rendering payloads, patient portal secure-message pagination payloads, patient portal secure-message mark-all-read payloads, encounter document attachment payloads, encounter billing linkage payloads, encounter claim linkage payloads, encounter procedure order linkage payloads, encounter diagnosis coding payloads, encounter billing linkage mutation payloads, encounter diagnosis coding mutation payloads, encounter fee-sheet entry payloads, encounter procedure-order entry payloads, encounter procedure-result entry payloads, encounter sign-off payloads, encounter co-signature payloads, encounter document revision payloads, encounter document replacement revision payloads, encounter scanned attachment payloads, encounter binary document content replacement payloads, encounter document upload payloads, encounter binary document upload payloads, encounter document sign-off payloads, encounter document denial payloads, encounter document metadata payloads, encounter document move payloads, encounter document content replacement payloads, encounter document archive/restore payloads, encounter document lifecycle timeline payloads, and encounter external-link document payloads, so Workbench probe previews can show actual expected/actual database payloads.

The legacy baseline is the first implemented target:

- Target id: `legacy-openemr`
- Browser URL: `http://localhost:8080`
- Health URL: `https://localhost:9443/meta/health/readyz`
- Seed dataset: `openemr-shared-synthetic-v1`
- Reset command: `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1`

The modernized target is represented in `parity-tests/config/targets.json` as `modernized-openemr` with status `implemented`. It currently supports the slice-1 patient search/chart summary plan, the slice-2 read-only scheduling plan, the slice-3 read-only encounters plan, the slice-4 read-only clinical-lists plan, the slice-5 read-only messaging plan, the slice-6 read-only completed procedures plan, the slice-7 read-only fee-sheet billing plan, the slice-8 read-only administration directory plan, the slice-9 read-only operational reports plan, the slice-10 patient contact mutation plan, the slice-11 appointment mutation plan, the slice-93 appointment reschedule plan, the slice-94 appointment arrival plan, the slice-12 encounter mutation plan, the slice-13 clinical-list allergy mutation plan, the slice-14 patient-message mutation plan, the slice-15 prescription mutation plan, the slice-16 billing mutation plan, the slice-17 procedure mutation plan, the slice-129 procedure result correction plan, the slice-130 procedure specimen readiness plan, the slice-131 procedure specimen detail plan, the slice-132 procedure order correction plan, the slice-133 procedure report correction plan, the slice-18 admin facility mutation plan, the slice-19 admin user mutation plan, the slice-20 access-control read model plan, the slice-21 access-permission mutation plan, the slice-22 user group membership mutation plan, the slice-23 pending/scheduled procedure orders plan, the slice-24 reports export plan, the slice-25 patient documents plan, the slice-26 patient document mutation plan, the slice-27 patient document content plan, the slice-28 patient insurance coverage plan, the slice-29 patient immunization history plan, the slice-30 patient immunization mutation plan, the slice-31 patient problem-list mutation plan, the slice-32 patient medication-list mutation plan, the slice-33 binary patient-document mutation plan, the slice-34 patient insurance mutation plan, the slice-35 encounter metadata mutation plan, the slice-36 patient demographics mutation plan, the slice-37 patient registration plan, the slice-38 patient document sign-off plan, the slice-39 patient document external-link plan, the slice-40 patient document denial plan, the slice-41 patient document metadata plan, the slice-42 patient document archive restore plan, the slice-43 patient document content replacement plan, the slice-44 billing diagnosis plan, the slice-45 billing correction plan, the slice-46 billing modifier plan, the slice-47 claim status plan, the slice-48 payment posting plan, the slice-49 account balance plan, the slice-50 account aging plan, the slice-51 account ledger plan, the slice-52 account statement plan, the slice-53 document preview plan, the slice-54 document revision plan, the slice-55 document replacement revision plan, the slice-56 payment posting mutation plan, the slice-57 claim status mutation plan, the slice-58 patient payment capture plan, the slice-59 statement generation plan, the slice-60 statement PDF export plan, the slice-61 statement batch candidate plan, the slice-62 statement batch package export plan, the slice-63 collections work queue plan, the slice-64 collections follow-up task plan, the slice-65 patient-message assignment plan, the slice-66 patient-message content plan, the slice-67 encounter document attachment plan, the slice-68 encounter billing linkage plan, the slice-69 encounter claim linkage plan, the slice-70 encounter procedure order linkage plan, the slice-71 encounter diagnosis coding plan, the slice-72 encounter billing linkage mutation plan, the slice-73 encounter diagnosis coding mutation plan, the slice-74 encounter fee-sheet entry plan, the slice-75 encounter procedure-order entry plan, the slice-76 encounter procedure-result entry plan, the slice-77 encounter sign-off plan, the slice-78 encounter document upload plan, the slice-79 encounter binary document upload plan, the slice-126 encounter scanned attachment readiness plan, the slice-127 encounter binary document content replacement plan, the slice-128 patient binary document content replacement plan, the slice-80 encounter document sign-off plan, the slice-81 encounter document denial plan, the slice-82 encounter document metadata plan, the slice-83 encounter document move plan, the slice-84 encounter document content replacement plan, the slice-85 encounter document archive/restore plan, the slice-86 encounter document lifecycle timeline plan, the slice-87 encounter external-link document plan, the slice-88 patient image document preview plan, the slice-89 patient image document thumbnail plan, the slice-90 patient PDF document inline-preview plan, the slice-91 patient document lifecycle timeline plan, the slice-92 patient scanned attachment plan, the slice-93 appointment reschedule plan, the slice-94 appointment arrival plan, the slice-95 appointment check-out plan, the slice-96 appointment no-show plan, the slice-97 appointment category plan, the slice-98 appointment pending-status plan, the slice-99 appointment provider reassignment plan, the slice-100 appointment facility reassignment plan, the slice-101 appointment billing-location reassignment plan, the slice-102 appointment comments plan, the slice-103 appointment recurrence metadata plan, the slice-104 appointment recurring-series plan, the slice-105 appointment recurrence-exceptions plan, the slice-106 appointment occurrence-cancel plan, the slice-107 appointment occurrence-restore plan, the slice-108 appointment occurrence-reschedule plan, the slice-109 appointment recurrence exception-list edit plan, the slice-110 appointment series root update plan, the slice-111 appointment series root metadata plan, the slice-112 appointment monthly recurrence plan, the slice-113 appointment recurrence unit matrix plan, the slice-114 appointment days-of-week recurrence plan, the slice-115 appointment monthly repeat-on recurrence plan, the slice-116 appointment series recurrence update plan, the slice-117 appointment provider overlap plan, the slice-118 appointment patient overlap plan, the slice-119 appointment room overlap plan, the slice-120 appointment reminders readiness plan, the slice-121 encounter co-signature readiness plan, the slice-122 encounter document revision readiness plan, and the slice-123 encounter document replacement revision readiness plan.

Slice 521 patient portal secure-message search pagination readiness remains available through the `workflow-patient-portal-message-search-pagination` suite and `slice-521-patient-portal-message-search-pagination-readiness` plan. The suite creates cleanup-backed newer nonmatching Inbox rows plus 21 matching Inbox rows for `MOD-PAT-0004`, proves search-before-pagination projections with a first filtered page and an older second-page match, records the installed legacy no-active-search-input baseline, verifies the modernized Portal resets the Inbox pager to the first filtered page when search changes, and captures cleanup state. Slice 520 patient portal secure-message search mark-all-read readiness remains available through the `workflow-patient-portal-message-search-mark-all-read` suite and `slice-520-patient-portal-message-search-mark-all-read-readiness` plan. The suite creates cleanup-backed matching and hidden unread Inbox secure-message rows for `MOD-PAT-0004`, proves the search query hides one unread row from the shared projection, records the installed legacy no-active-search-filter baseline, verifies the modernized Portal marks only the filtered matching row read while the hidden row remains New after search is cleared, and captures cleanup state. Slice 519 patient portal secure-message search-selection readiness remains available through the `workflow-patient-portal-message-search-selection` suite and `slice-519-patient-portal-message-search-selection-readiness` plan. The suite creates cleanup-backed matching and selected-then-hidden Inbox secure-message rows for `MOD-PAT-0004`, proves the search query hides the selected row from the shared projection, records the installed legacy no-active-search-filter baseline, verifies the modernized Portal clears hidden selections and disables Archive selected when search changes, and captures cleanup state. Slice 518 patient portal secure-message search-normalization readiness remains available through the `workflow-patient-portal-message-search-normalization` suite and `slice-518-patient-portal-message-search-normalization-readiness` plan. The suite creates cleanup-backed matching and decoy Inbox secure-message rows for `MOD-PAT-0004`, proves padded mixed-case search text is trimmed and matched case-insensitively against the shared projection, records the installed legacy no-active-search-input/live-summary baseline, verifies the modernized Portal search-count summary is exposed as a polite live status, and captures cleanup state. Slice 517 patient portal secure-message clear-search readiness remains available through the `workflow-patient-portal-message-search-clear` suite and `slice-517-patient-portal-message-search-clear-readiness` plan. The suite creates cleanup-backed Inbox secure-message rows for `MOD-PAT-0004`, proves a normalized query narrows the shared projection to the matching row and clearing search restores both rows, records the installed legacy no-active-search-input/clear-search-control baseline, verifies the modernized Portal Clear search button clears the query, disables itself, resets paging, restores the Inbox rows, and captures cleanup state. Slice 516 patient portal secure-message search-count readiness remains available through the `workflow-patient-portal-message-search-counts` suite and `slice-516-patient-portal-message-search-counts-readiness` plan. The suite creates cleanup-backed Inbox, Sent, and archived Deleted secure-message rows for `MOD-PAT-0004`, proves filtered and total count projections for Inbox, Sent, All, and Deleted searches, records the installed legacy no-active-search-input/search-count baseline, verifies the modernized Portal search-count summary reports those counts, and captures cleanup state. Slice 515 patient portal secure-message empty-search readiness remains available through the `workflow-patient-portal-message-empty-search` suite and `slice-515-patient-portal-message-empty-search-readiness` plan. The suite creates cleanup-backed Inbox, Sent, and archived Deleted secure-message rows for `MOD-PAT-0004`, proves a no-hit query returns zero shared matches across Inbox, Sent, All, and Deleted projections, records the installed legacy no-active-search-input baseline, verifies the modernized Portal shows deterministic folder-specific empty states and clears back to restored rows, and captures cleanup state. Slice 514 patient portal secure-message folder search readiness remains available through the `workflow-patient-portal-message-folder-search` suite and `slice-514-patient-portal-message-folder-search-readiness` plan. The suite creates cleanup-backed sent and archived secure-message rows for `MOD-PAT-0004`, proves Sent, All, and Deleted folder search projections, records the installed legacy Sent/Archive no-input rendered baseline, verifies the modernized Portal search field filters Sent, All, and Deleted regions, and captures cleanup state. Slice 513 patient portal secure-message search readiness remains available through the `workflow-patient-portal-message-search` suite and `slice-513-patient-portal-message-search-readiness` plan. The suite creates cleanup-backed matching and decoy inbox messages for `MOD-PAT-0004`, proves the normalized substring query keeps the matching row and removes the decoy before pagination, captures cleanup state, records that the installed legacy portal template does not expose an active rendered search input, and verifies the modernized Portal search field filters the Inbox surface and clears back to the full folder. Slice 512 patient portal secure-message unsupported attachment policy readiness remains available through the `workflow-patient-portal-message-attachment-policy` suite and `slice-512-patient-portal-message-attachment-policy-readiness` plan. The suite attempts a non-empty attachment submission for `MOD-PAT-0004`, verifies both target adapters reject the request without creating sent, inbox, or All-folder mailbox rows, captures cleanup state, and proves active secure-message upload controls are absent on both portal surfaces. Slice 510 patient portal secure-message attachment metadata readiness remains available through the `workflow-patient-portal-message-attachments` suite and `slice-510-patient-portal-message-attachments-readiness` plan, with Slice 511 path-backed probe payload attachments. The suite creates a cleanup-backed composed portal secure message, verifies both legacy and modernized target adapters expose explicit `attachmentCount: 0` and empty `attachments` arrays for current mailbox rows, attaches composed-message creation and mailbox projection evidence, verifies cleanup, documents the legacy sent-message surface, checks the modernized Portal renders `Attachments 0` on sent-message cards, and attaches UI-test cleanup evidence. Slice 255 patient portal secure-message notification readiness remains available through the `workflow-patient-portal-message-notifications` suite and `slice-255-patient-portal-message-notifications-readiness` plan, with Slice 509 path-backed probe payload attachments for anchor-patient notification preconditions, cleanup-backed notification creation, Inbox/All notification projections, cleanup state, legacy portal UI-absence evidence, and modernized read-only notification-row rendering. Slice 254 patient portal profile review revert readiness remains available through the `workflow-patient-portal-profile-review-revert` suite and `slice-254-patient-portal-profile-review-revert-readiness` plan, with Slice 508 path-backed probe payload attachments for anchor-patient preconditions, original chart demographics, queued review request state, legacy staff revert action facts, modernized Admin Revert Edits rendering, post-revert queue state, unchanged chart demographics, and restoration cleanup. Slice 253 patient portal profile review accept readiness remains available through the `workflow-patient-portal-profile-review-accept` suite and `slice-253-patient-portal-profile-review-accept-readiness` plan, with Slice 507 path-backed probe payload attachments for anchor-patient preconditions, original chart demographics, queued review request state, legacy staff accept action facts, modernized Admin Commit to Chart rendering, post-accept queue state, accepted chart demographics, and restoration cleanup. Slice 252 patient portal profile review queue readiness remains available through the `workflow-patient-portal-profile-review-queue` suite and `slice-252-patient-portal-profile-review-queue-readiness` plan, with Slice 506 path-backed probe payload attachments for anchor-patient preconditions, clean staff review queue state, waiting review request projections, cleanup state, legacy normalized review-queue workflow facts, and modernized Admin review-queue rendering. Slice 251 patient portal profile change request readiness remains available through the `workflow-patient-portal-profile-change-request` suite and `slice-251-patient-portal-profile-change-request-readiness` plan, with Slice 505 path-backed probe payload attachments for anchor-patient preconditions, clean profile state, submitted waiting-review profile edit facts, refreshed pending-change projection, cleanup state, legacy Edit Pending Changes rendering, and modernized Portal pending-review rendering. Slice 250 patient portal profile readiness remains available through the `workflow-patient-portal-profile` suite and `slice-250-patient-portal-profile-readiness` plan, with Slice 504 path-backed probe payload attachments for anchor-patient preconditions, authenticated medical-record demographics, primary and secondary insurance projections, legacy Profile From Medical Records rendering, and modernized Portal profile-region rendering. Slice 249 patient portal home immunization readiness remains available through the `workflow-patient-portal-home-immunizations` suite and `slice-249-patient-portal-home-immunizations-readiness` plan, with Slice 503 path-backed probe payload attachments for anchor-patient preconditions, temporary entered-in-error immunization lifecycle facts, portal home immunization health-snapshot projections, cleanup state, legacy Health Snapshot rendering, and modernized Portal immunization-region rendering.

Slice 248 patient portal allergy date-column readiness remains available through the `workflow-patient-portal-allergy-date-columns` suite and `slice-248-patient-portal-allergy-date-columns-readiness` plan, with Slice 502 path-backed probe payload attachments for anchor-patient preconditions, temporary ended-allergy lifecycle, active and ended allergy date/referrer/reaction/severity projections, cleanup state, legacy Reported Date/Start Date/End Date/Referrer table rendering, and modernized Portal allergy-card rendering. Slice 247 patient portal problem date-column readiness remains available through the `workflow-patient-portal-problem-date-columns` suite and `slice-247-patient-portal-problem-date-columns-readiness` plan, with Slice 501 path-backed probe payload attachments for anchor-patient preconditions, temporary ended-problem lifecycle, active and ended problem date-column projections, cleanup state, legacy Reported Date/Start Date/End Date table rendering, and modernized Portal problem-card rendering. Slice 246 patient portal medication date-column readiness remains available through the `workflow-patient-portal-medication-date-columns` suite and `slice-246-patient-portal-medication-date-columns-readiness` plan, with Slice 500 path-backed probe payload attachments for anchor-patient preconditions, temporary ended-medication lifecycle, active and ended medication date-column projections, cleanup state, legacy Start Date/Last Modified/End Date table rendering, and modernized Portal medication-card rendering. Slice 245 patient portal prescription end-date filtering readiness remains available through the `workflow-patient-portal-prescription-end-date` suite and `slice-245-patient-portal-prescription-end-date-readiness` plan, with Slice 499 path-backed probe payload attachments for anchor-patient preconditions, temporary ended-prescription lifecycle, active-prescription filtering, cleanup state, legacy End Date table rendering, and modernized Portal prescription-card rendering. Slice 244 patient portal prescription start-date readiness remains available through the `workflow-patient-portal-prescription-start-date` suite and `slice-244-patient-portal-prescription-start-date-readiness` plan, with Slice 498 path-backed probe payload attachments for anchor-patient preconditions, active-prescription date-added/start-date projections, legacy Start Date table rendering, and modernized Portal prescription-card rendering. Slice 243 patient portal prescription modified-date readiness remains available through the `workflow-patient-portal-prescription-modified-date` suite and `slice-243-patient-portal-prescription-modified-date-readiness` plan, with Slice 497 path-backed probe payload attachments for anchor-patient preconditions, active-prescription modified-date projections, legacy Last Modified table rendering, and modernized Portal prescription-card rendering. Slice 242 patient portal secure-message mark-all-read readiness remains available through the `workflow-patient-portal-message-mark-all-read` suite and `slice-242-patient-portal-message-mark-all-read-readiness` plan, with Slice 496 path-backed probe payload attachments for anchor-patient preconditions, browser-only visible status transitions, persisted unread mailbox state, cleanup state, and target-specific toolbar rendering. Slice 241 patient portal secure-message pagination readiness remains available through the `workflow-patient-portal-message-pagination` suite and `slice-241-patient-portal-message-pagination-readiness` plan, with Slice 495 path-backed probe payload attachments for anchor-patient preconditions, first-page/second-page mailbox ordering, cleanup state, and target-specific pager rendering. Slice 240 patient portal secure-message HTML-body rendering readiness remains available through the `workflow-patient-portal-message-html` suite and `slice-240-patient-portal-message-html-body-readiness` plan, with Slice 494 path-backed probe payload attachments for anchor-patient preconditions, raw HTML body preservation, cleanup state, and target-specific sanitized body rendering. Slice 239 patient portal secure-message subject-preset readiness remains available through the `workflow-patient-portal-message-subjects` suite and `slice-239-patient-portal-message-subject-presets-readiness` plan, with Slice 493 path-backed probe payload attachments for anchor-patient preconditions, normalized compose-options subject/recipient evidence, and target-specific subject input/datalist rendering. Slice 238 patient portal secure-message recipient-directory readiness remains available through the `workflow-patient-portal-message-recipients` suite and `slice-238-patient-portal-message-recipient-directory-readiness` plan, with Slice 492 path-backed probe payload attachments for anchor-patient preconditions, normalized recipient-directory routing, and target-specific compose selector evidence. Slice 237 patient portal generated medical-report procedure-order artifact readiness remains available through the `workflow-patient-portal-report-procedure-artifacts` suite and `slice-237-patient-portal-generated-medical-report-procedure-artifacts-readiness` plan, with Slice 491 path-backed probe payload attachments for anchor-patient/encounter preconditions, selected procedure-order delivery metadata, cleanup projections, and target-specific delivery-artifact evidence. Slice 236 patient portal generated medical-report procedure-order selection readiness remains available through the `workflow-patient-portal-report-procedures` suite and `slice-236-patient-portal-generated-medical-report-procedure-selection-readiness` plan, with Slice 490 path-backed probe payload attachments for anchor-patient/encounter preconditions, report-builder/result/cleanup projections, and target-specific selected procedure-order generated-report evidence. Slice 235 patient portal secure-message Deleted-folder readiness remains available through the `workflow-patient-portal-deleted-messages` suite and `slice-235-patient-portal-deleted-messages-readiness` plan, with Slice 489 path-backed probe payload attachments for preconditions, mailbox baseline, Deleted-folder projection, cleanup, and target-specific deleted-folder UI evidence. Slice 234 patient portal secure-message forward-to-practice readiness remains available through the `workflow-patient-portal-message-forward` suite and `slice-234-patient-portal-message-forward-readiness` plan, with Slice 488 path-backed probe payload attachments for preconditions, forwarding projection, and target-specific forward-to-practice UI evidence. Slice 233 patient portal secure-message encrypted-body readiness remains available through the `workflow-patient-portal-message-encryption` suite and `slice-233-patient-portal-message-encryption-readiness` plan, with Slice 487 path-backed probe payload attachments for preconditions, protected encrypted-message projection, and target-specific encrypted-message UI evidence. Slice 232 patient portal secure-message lifecycle audit readiness remains available through the `workflow-patient-portal-message-audit` suite and `slice-232-patient-portal-message-audit-readiness` plan, with Slice 486 path-backed probe payload attachments for preconditions, normalized secure-message audit projection, and target-specific message-audit lifecycle evidence. Slice 231 patient portal generated medical-report lifecycle audit readiness remains available through the `workflow-patient-portal-report-audit` suite and `slice-231-patient-portal-generated-medical-report-audit-readiness` plan, with Slice 485 path-backed probe payload attachments for preconditions, generated-report audit projection, and target-specific lifecycle audit evidence. Slice 230 patient portal generated medical-report package readiness remains available through the `workflow-patient-portal-report-package` suite and `slice-230-patient-portal-generated-medical-report-package-readiness` plan, with Slice 484 path-backed probe payload attachments for preconditions, package metadata projection, and target-specific package delivery evidence. Slice 229 patient portal generated medical-report printable-template readiness remains available through the `workflow-patient-portal-report-template` suite and `slice-229-patient-portal-generated-medical-report-template-readiness` plan, with Slice 483 path-backed probe payload attachments for preconditions, printable template metadata projection, and target-specific printable-template generated-report evidence. Slice 228 patient portal generated medical-report encounter-form selection readiness remains available through the `workflow-patient-portal-report-forms` suite and `slice-228-patient-portal-generated-medical-report-form-selection-readiness` plan, with Slice 482 path-backed probe payload attachments for preconditions, selected encounter-form/report projection, and target-specific encounter-form generated-report evidence. Slice 227 patient portal generated medical-report issue-selection readiness remains available through the `workflow-patient-portal-report-issues` suite and `slice-227-patient-portal-generated-medical-report-issue-selection-readiness` plan, with Slice 481 path-backed probe payload attachments for preconditions, selected issue/report projection, and target-specific issue-selection generated-report evidence. Slice 226 patient portal generated medical-report PDF readiness remains available through the `workflow-patient-portal-medical-report-pdf` suite and `slice-226-patient-portal-generated-medical-report-pdf-readiness` plan, with Slice 480 path-backed probe payload attachments for preconditions, PDF readiness projection, and target-specific PDF export evidence. Slice 225 patient portal generated medical-report readiness remains available through the `workflow-patient-portal-generated-medical-report` suite and `slice-225-patient-portal-generated-medical-report-readiness` plan, with Slice 479 path-backed probe payload attachments for preconditions, generated-report projection, and target-specific generated-report UI surfaces. Slice 224 patient portal medical-report readiness remains available through the `workflow-patient-portal-medical-report` suite and `slice-224-patient-portal-medical-report-readiness` plan, with Slice 478 path-backed probe payload attachments for preconditions, report-builder projection, and target-specific medical-report UI surfaces. Slice 223 patient portal lab-results readiness remains available through the `workflow-patient-portal-lab-results` suite and `slice-223-patient-portal-lab-results-readiness` plan, with Slice 477 path-backed probe payload attachments for preconditions, lab order/report/result projection, and target-specific lab-results UI surfaces. Slice 222 patient portal clinical-summary readiness remains available through the `workflow-patient-portal-clinical-summary` suite and `slice-222-patient-portal-clinical-summary-readiness` plan, with Slice 476 path-backed probe payload attachments for preconditions, clinical-list/prescription projection, and target-specific clinical-summary UI surfaces. Slice 221 patient portal appointment request-options readiness remains available through the `workflow-patient-portal-appointment-options` suite and `slice-221-patient-portal-appointment-options-readiness` plan, with Slice 475 path-backed probe payload attachments for preconditions, category/provider/facility/default option projection, and target-specific request-form UI surfaces. Slice 220 patient portal appointment request readiness remains available through the `workflow-patient-portal-appointment-request` suite and `slice-220-patient-portal-appointment-request-readiness` plan, with Slice 474 path-backed probe payload attachments for preconditions, cleanup-backed appointment/reminder creation, cleanup state, and target-specific requested-appointment UI surfaces. Slice 219 patient portal appointment list readiness remains available through the `workflow-patient-portal-appointments` suite and `slice-219-patient-portal-appointments-readiness` plan, with Slice 473 path-backed probe payload attachments for preconditions, future/past appointment projection, and target-specific appointment UI surfaces. Slice 218 patient portal document list/download readiness remains available through the `workflow-patient-portal-documents` suite and `slice-218-patient-portal-documents-readiness` plan, with Slice 472 path-backed probe payload attachments for preconditions, active portal document/category projection, selected ZIP package metadata, and target-specific document download UI surfaces. Slice 217 patient portal secure-message All-folder readiness remains available through the `workflow-patient-portal-all-messages` suite and `slice-217-patient-portal-all-messages-readiness` plan, with Slice 471 path-backed probe payload attachments for preconditions, pre-All-folder mailbox state, cleanup-backed active/archived projection, cleanup state, and target-specific All-folder UI surfaces. Slice 216 patient portal secure-message batch archive readiness remains available through the `workflow-patient-portal-batch-archive` suite and `slice-216-patient-portal-batch-archive-readiness` plan, with Slice 470 path-backed probe payload attachments for preconditions, pre-batch mailbox state, cleanup-backed archive result, cleanup state, and target-specific selected-message archive UI surfaces. Slice 215 adds patient portal secure-message read-status readiness to the same modernized target contract with the `workflow-patient-portal-read` suite and `slice-215-patient-portal-read-readiness` plan, with Slice 469 path-backed probe payload attachments for preconditions, pre-read mailbox/home-summary state, cleanup-backed read result, cleanup state, and target-specific read-status UI surfaces. Slice 214 patient portal secure-message archive readiness remains available through the `workflow-patient-portal-delete` suite and `slice-214-patient-portal-delete-readiness` plan, with Slice 468 path-backed probe payload attachments for preconditions, pre-archive mailbox state, cleanup-backed archive result, cleanup state, and target-specific Sent/Archive UI surfaces. Slice 213 patient portal secure-message thread view readiness remains available through the `workflow-patient-portal-thread` suite and `slice-213-patient-portal-thread-readiness` plan, with Slice 467 path-backed probe payload attachments for thread preconditions, seeded original-message/thread anchor state, cleanup-backed thread result, cleanup state, and target-specific thread UI surfaces. Slice 212 patient portal secure-message reply readiness remains available through the `workflow-patient-portal-reply` suite and `slice-212-patient-portal-reply-readiness` plan, with Slice 466 path-backed probe payload attachments for reply preconditions, seeded original-message state, threaded sent-message creation, cleanup state, and target-specific reply/Sent-folder UI surfaces. Slice 211 patient portal secure-message compose readiness remains available through the `workflow-patient-portal-compose` suite and `slice-211-patient-portal-compose-readiness` plan, with Slice 465 path-backed probe payload attachments for compose preconditions, pre-compose mailbox state, sent-message creation, cleanup state, and target-specific Sent-folder UI surfaces. Slice 210 patient portal secure-message inbox readiness remains available through the `workflow-patient-portal-messages` suite and `slice-210-patient-portal-messages-readiness` plan, with Slice 464 path-backed probe payload attachments for anchor-patient preconditions, mailbox identity, seeded message details, and target-specific Secure Messages UI surfaces. Slice 209 patient portal home readiness remains available through the `workflow-patient-portal-home` suite and `slice-209-patient-portal-home-readiness` plan, with Slice 463 path-backed probe payload attachments for enabled account preconditions, authenticated home-summary identity, message counts, upcoming appointment facts, and target-specific home UI surfaces. Slice 208 patient portal session readiness remains available through the `workflow-patient-portal-session` suite and `slice-208-patient-portal-session-readiness` plan, with Slice 462 path-backed probe payload attachments for original account/reset/access preconditions, portal login, modernized active-session read, modernized session logout, inactive reuse rejection, target-specific UI surfaces, and legacy browser-cookie logout. Slice 207 patient portal authentication readiness remains available through the `workflow-patient-portal-authentication` suite and `slice-207-patient-portal-authentication-readiness` plan, with Slice 461 path-backed probe payload attachments for original account/reset/access preconditions, valid login, invalid password, disabled access, pending reset, target-specific UI surfaces, and cleanup. Slice 206 patient portal access readiness remains available through the `workflow-patient-portal-access` suite and `slice-206-patient-portal-access-readiness` plan. Slice 205 patient portal reset readiness remains available through the `workflow-patient-portal-reset` suite and `slice-205-patient-portal-reset-readiness` plan. Slice 204 patient portal account readiness remains available through the `patient-portal-account` suite and `slice-204-patient-portal-account-readiness` plan. Slice 203 patient insurance subscriber readiness remains available through the `workflow-insurance-subscriber` suite and `slice-203-insurance-subscriber-readiness` plan; its physical Playwright path is `tests/workflow-subscriber-insurance` to avoid path-prefix overlap with the Slice 34 `workflow-insurance` suite. Slice 202 patient history/lifestyle readiness remains available through the `patient-history` suite and `slice-202-patient-history-readiness` plan. Slice 201 patient contact-backed care-team readiness remains available through the `workflow-patient-care-team-contact` suite and `slice-201-patient-care-team-contact-readiness` plan; its physical Playwright path is `tests/workflow-patient-team-contact` to avoid path-prefix overlap with the Slice 199 suite. Slice 200 patient care-team members readiness remains available through the `workflow-patient-care-team-members` suite and `slice-200-patient-care-team-members-readiness` plan. Slice 199 patient care-team lead-member readiness remains available through the `workflow-patient-care-team` suite and `slice-199-patient-care-team-readiness` plan. Slice 198 patient provider assignment readiness remains available through the `workflow-patient-provider-assignment` suite and `slice-198-patient-provider-assignment-readiness` plan. Slice 197 patient employer core readiness remains available through the `workflow-patient-employer-core` suite and `slice-197-patient-employer-core-readiness` plan. Slice 196 patient social-detail readiness remains available through the `workflow-patient-social-details` suite and `slice-196-patient-social-details-readiness` plan. Slice 195 patient guardian demographic/address readiness remains available through the `workflow-patient-guardian-details` suite and `slice-195-patient-guardian-details-readiness` plan. Slice 194 patient guardian-contact readiness remains available through the `workflow-patient-guardian-contact` suite and `slice-194-patient-guardian-contact-readiness` plan. Slice 193 patient deceased-status readiness remains available through the `workflow-patient-deceased-status` suite and `slice-193-patient-deceased-status-readiness` plan. Slice 192 patient registration validation readiness remains available through the `workflow-patient-registration-validation` suite and `slice-192-patient-registration-validation-readiness` plan. Slice 191 patient duplicate detection readiness remains available through the `workflow-patient-duplicate-detection` suite and `slice-191-patient-duplicate-detection-readiness` plan. Slice 190 encounter amendment history readiness remains available through the `workflow-encounter-amendment-history` suite and `slice-190-encounter-amendment-history-readiness` plan. Slice 189 appointment mutation authorization-policy readiness remains available through the `workflow-appointment-mutation-authorization-policy` suite and `slice-189-appointment-mutation-authorization-policy-readiness` plan. Slice 188 billing mutation authorization-policy readiness remains available through the `workflow-billing-mutation-authorization-policy` suite and `slice-188-billing-mutation-authorization-policy-readiness` plan. Slice 187 patient message mutation authorization-policy readiness remains available through the `workflow-message-mutation-authorization-policy` suite and `slice-187-message-mutation-authorization-policy-readiness` plan. Slice 186 patient document mutation authorization-policy readiness remains available through the `workflow-document-mutation-authorization-policy` suite and `slice-186-document-mutation-authorization-policy-readiness` plan. Slice 185 encounter mutation authorization-policy readiness remains available through the `workflow-encounter-mutation-authorization-policy` suite and `slice-185-encounter-mutation-authorization-policy-readiness` plan. Slice 184 patient mutation authorization-policy readiness remains available through the `workflow-patient-mutation-authorization-policy` suite and `slice-184-patient-mutation-authorization-policy-readiness` plan. Slice 183 procedure mutation authorization-policy readiness remains available through the `workflow-procedure-mutation-authorization-policy` suite and `slice-183-procedure-mutation-authorization-policy-readiness` plan. Slice 176 appointment authorization-policy readiness remains available through the `workflow-appointment-authorization-policy` suite and `slice-176-appointment-authorization-policy-readiness` plan. Earlier protection, authorization-policy, mutation, and workflow plans remain available through the manifest and Workbench managed actions.

Slice 255 adds patient portal secure-message notification readiness with the `workflow-patient-portal-message-notifications` suite and `slice-255-patient-portal-message-notifications-readiness` plan, with Slice 509 path-backed probe payload attachments. The suite signs in as `MOD-PAT-0004`, creates a cleanup-backed active `patient_reminders` row, verifies it appears as a read-only `Notification` in Inbox and All-style workflow results, verifies it is absent from Sent and Deleted, documents that the observed legacy v8.1.0 Secure Messaging UI does not render those reminder rows, checks the modernized Portal row hides thread/reply/archive actions, attaches precondition/creation/projection/UI/cleanup JSON evidence, and removes the temporary reminder afterward. Slice 254 remains available for patient portal profile review revert readiness with the `workflow-patient-portal-profile-review-revert` suite and `slice-254-patient-portal-profile-review-revert-readiness` plan. The Slice 254 suite signs in as `MOD-PAT-0004`, creates a cleanup-backed profile edit request, chooses the staff-side `Revert Edits` path, verifies the request leaves the waiting queue with OpenEMR-style `closed` / `completed` / `accept` metadata, verifies chart demographics remain unchanged, checks the modernized Admin `Revert Edits` UI action, and restores the seeded demographics afterward. Earlier patient portal workflow plans remain available for profile review, generated reports, documents, appointments, clinical-summary, lab-results, prescription/medication/problem/allergy date columns, and secure-message readiness.

## Test Layers

### Database Contract

Database tests validate normalized domain facts in the seeded target.

Current legacy coverage:

- Gold dataset row counts.
- Gold dataset temporal coverage.
- Stable named workflow anchor patients.
- Related workflow counts for appointments, encounters, problems, prescriptions, medications, immunizations, messages, procedure orders, procedure reports, procedure results, billing, claims, payment sessions, payment activities, and patient documents.

The legacy adapter is `parity-tests/src/db/legacyMariaDbProbe.ts`. It intentionally returns normalized facts instead of exposing test code to every legacy table detail.

The modernized adapter is `parity-tests/src/db/modernizedPostgresProbe.ts`. It follows the same normalized method shape for implemented slices so parity tests do not depend on target-specific table details.

### HTTP Functional Contract

HTTP tests validate server-visible behavior without steering a browser.

Current legacy coverage:

- Health endpoint readiness.
- Login page field contract.
- Admin login reaches the OpenEMR application shell.

### Playwright UI Contract

UI tests validate browser-visible workflows.

The legacy UI helper collects rendered text across OpenEMR frames and form field values from inputs, textareas, and selected options. This matters for legacy clinical forms such as procedure results, where visible result names and values are often stored inside editable fields rather than plain body text.

Current legacy coverage:

- Login with configured local demo credentials.
- Open a known gold patient chart and verify canonical patient details.
- Render a seeded encounter and verify SOAP and vitals detail content across OpenEMR's frame-based encounter UI.
- Render a future seeded appointment in the legacy scheduler edit screen and verify title, patient, date, time, and status form values.
- Render a seeded fee sheet and verify encounter billing codes and descriptions.
- Render completed procedure results for a gold lab patient.
- Render a future scheduled procedure order without report rows for a gold lab patient.
- Render seeded patient documents for a gold patient.
- Render seeded patient immunization history for a gold pediatric patient.

The focused UI suite is intentionally read-only. Mutation workflows live in the Workflow Mutation Contract suite, where they can combine database pre/post probes with browser-visible evidence when useful.

### Workflow Mutation Contract

Workflow tests validate CRUD-style domain behavior with explicit setup, mutation, assertion, and cleanup steps.

Current legacy coverage:

- Patient contact update, patient demographics update/restore, and temporary patient registration create/delete with pre/post database probes and browser verification in the patient chart.
- Future appointment create, cancel, and delete lifecycle with patient appointment count probes.
- Clinical allergy list create, deactivate, and delete lifecycle with patient allergy count probes.
- Patient message create, close, soft-delete, and hard-cleanup lifecycle with message count probes.
- Patient document create, render, soft-delete, and hard-cleanup lifecycle with document count probes.
- Prescription create, deactivate, and delete lifecycle with patient prescription count probes.
- Immunization create, render, entered-in-error, and delete lifecycle with patient immunization count probes.
- Encounter create, update, and delete lifecycle with vitals and SOAP detail form links.
- CPT billing line create, bill-status update, deactivate, and delete lifecycle.
- Lab procedure order create, complete, report, result, and cascade-delete lifecycle.
- Administration facility and user lifecycle mutation.
- Focused access-control permission assignment revoke/restore lifecycle.
- Focused access-control user group membership assignment/revoke lifecycle.

The legacy implementation is `parity-tests/src/workflows/legacyWorkflowActions.ts`. It uses controlled SQL mutations against the legacy MariaDB schema because OpenEMR's internal PHP entry points and OAuth-protected APIs are not yet wrapped as stable modernization parity adapters. The modernized implementation is `parity-tests/src/workflows/modernizedWorkflowActions.ts`, which mutates implemented workflows through the modernized ASP.NET Core API and reads post-state through normalized PostgreSQL probes. The tests are written as workflow intent so each new modernized mutation slice can implement equivalent actions behind the same behavioral contract. Slice 36 adds `workflow-demographics`, which updates and restores `MOD-PAT-0010` identity, DOB, address, marital-status, and occupation fields on both targets. Slice 37 adds `workflow-registration`, which creates, renders, and removes a temporary `TMP-PAT-REG-*` patient on both targets.

### Slice Readiness And Coverage Standard

Each development slice must have at least one canonical parity/readiness scenario. That scenario is the minimum gate proving that the workflow can run against the shared gold data, exercise the intended legacy and modernized behavior, collect comparable normalized facts, and leave the target clean afterward. A single `test(...)` block can be acceptable for this gate when it contains meaningful setup, database/API/UI assertions, path-backed evidence attachments where useful, cleanup, and restoration checks.

Slice readiness is not the same thing as exhaustive coverage. The readiness plan answers "does the representative workflow match across targets?" rather than "have all validation, permission, edge, failure, and alternate-state cases been proven?" Future slice work should make this distinction explicit in the slice notes, Workbench status text, and any implementation handoff.

Do not add extra Playwright tests only to increase the test count. Browser parity tests are comparatively expensive and should stay focused on target-to-target behavior that users or operators can observe. When a slice needs broader coverage, put the cheaper rule permutations at the lowest reliable layer first: unit/domain tests for pure business rules, service/API tests for request validation and authorization, database-probe tests for normalized persistence facts, and Playwright parity tests for cross-target workflow evidence.

Add targeted additional cases beyond the canonical readiness scenario when a slice includes any of these risk factors:

- Clinical, financial, security, identity, document, or audit-sensitive behavior.
- Mutations with branching state transitions, restoration requirements, cascading side effects, or cleanup risk.
- Authorization, role, session, access-control, or patient-portal isolation rules.
- Validation behavior, rejected input, missing required fields, duplicate detection, date/status rules, or cross-record consistency checks.
- Binary/file content, preview/download behavior, metadata replacement, signing/denial/archive lifecycle, or external-link handling.
- Recurrence, scheduling overlap, generated-occurrence, statement, billing, claim, lab-order, or report workflows where alternate states materially change the result.

For high-risk slices, keep the canonical readiness scenario named and runnable as the slice gate, then add focused supplemental tests or named plans for the specific risk area, such as validation, permissions, edge data, lifecycle cleanup, or alternate-state coverage. The Workbench should continue to surface readiness pass/fail clearly while richer coverage can be tracked through suite names, plan names, evidence attachments, and reliability summaries.

When adding or changing slice tests, also decide whether the work is capability, coverage, evidence, Workbench platform, seed-data, or hardening work. Capability work should usually update the parent Workbench rollup for its domain. Coverage and evidence work can remain granular, but should be grouped under the parent capability so the Workbench does not imply that each small test-support slice is a separate product milestone.

### Legacy-Native Internal Tests

OpenEMR upstream includes PHPUnit, Jest, and Panther-oriented tests in `legacy-openemr/source/tests/`. These tests are useful as implementation confidence for the legacy PHP and JavaScript application, but they are not the primary modernization parity contract because the modernized target will not run the same PHP internals.

Current local status:

- Host PHP is not installed.
- Host Composer is not installed.
- The pinned OpenEMR container includes PHP and Composer.
- Upstream Composer dependencies have been installed into the ignored local source checkout.
- `legacy-openemr/scripts/Test-LegacyNative.ps1` runs OpenEMR's `phpunit-isolated.xml` suite inside the pinned OpenEMR container.
- `legacy-openemr/scripts/Test-LegacyNativeJs.ps1` runs OpenEMR's upstream JavaScript Jest suite from the ignored local source checkout.
- The Node dependency restore for the Jest lane uses `npm ci --ignore-scripts` so it does not run OpenEMR's heavier asset postinstall.

The default native mode is `stable`. It excludes upstream PHPUnit groups `twig` and `large` because the complete upstream isolated suite currently has Windows bind-mount-sensitive failures:

- Twig render fixtures compare with CRLF line endings from the Windows checkout while rendered output uses LF.
- One built-in PHP server routing test in the `large` group can time out under the local bind mount.

The stable native lane is verified with 2,344 PHPUnit tests and 6,188 assertions. It is a useful legacy implementation-confidence layer, while the parity harness remains the modernization contract that will run against both legacy and modernized targets.

The native runner also supports `-Mode full` as a diagnostic path for the complete upstream isolated suite. Full mode is expected to remain environment-sensitive until the source checkout or test container is made fully Linux-native.

The native JavaScript lane is verified with 12 Jest suites and 105 tests. Current coverage includes CCDA service utilities and jsPDF compatibility used by the Fax/SMS TIFF-to-PDF workflow.

## Runner

The main runner is:

```powershell
cd parity-tests
npm run test:legacy
```

Suite-specific commands:

```powershell
npm run test:legacy:database
npm run test:legacy:http
npm run test:legacy:ui
npm run test:legacy:ui:headed
npm run test:legacy:workflow
npm run test:legacy:plan:readiness
npm run test:legacy:plan:mutation
npm run test:legacy:plan:full
npm run test:legacy:plan:clinical-lists
npm run test:modernized:plan:clinical-lists
npm run test:legacy:plan:messages
npm run test:modernized:plan:messages
npm run test:legacy:plan:procedures
npm run test:modernized:plan:procedures
npm run test:legacy:plan:procedure-pending-orders
npm run test:modernized:plan:procedure-pending-orders
npm run test:legacy:plan:billing
npm run test:modernized:plan:billing
npm run test:legacy:plan:claims
npm run test:modernized:plan:claims
npm run test:legacy:plan:payments
npm run test:modernized:plan:payments
npm run test:legacy:plan:account-balance
npm run test:modernized:plan:account-balance
npm run test:legacy:plan:account-aging
npm run test:modernized:plan:account-aging
npm run test:legacy:plan:account-ledger
npm run test:modernized:plan:account-ledger
npm run test:legacy:plan:account-statement
npm run test:modernized:plan:account-statement
npm run test:legacy:plan:statement-generation
npm run test:modernized:plan:statement-generation
npm run test:legacy:plan:statement-pdf
npm run test:modernized:plan:statement-pdf
npm run test:legacy:plan:admin
npm run test:modernized:plan:admin
npm run test:legacy:plan:reports
npm run test:modernized:plan:reports
npm run test:legacy:plan:reports-export
npm run test:modernized:plan:reports-export
npm run test:legacy:plan:documents
npm run test:modernized:plan:documents
npm run test:legacy:plan:immunizations
npm run test:modernized:plan:immunizations
npm run test:legacy:plan:immunization-mutation
npm run test:modernized:plan:immunization-mutation
npm run test:legacy:plan:document-mutation
npm run test:modernized:plan:document-mutation
npm run test:legacy:plan:document-denial
npm run test:modernized:plan:document-denial
npm run test:legacy:plan:document-metadata
npm run test:modernized:plan:document-metadata
npm run test:legacy:plan:document-scanned-attachment
npm run test:modernized:plan:document-scanned-attachment
npm run test:legacy:plan:contact-mutation
npm run test:modernized:plan:contact-mutation
npm run test:legacy:plan:appointment-mutation
npm run test:modernized:plan:appointment-mutation
npm run test:legacy:plan:appointment-days-of-week-recurrence
npm run test:modernized:plan:appointment-days-of-week-recurrence
npm run test:legacy:plan:encounter-mutation
npm run test:modernized:plan:encounter-mutation
npm run test:legacy:plan:clinical-list-mutation
npm run test:modernized:plan:clinical-list-mutation
npm run test:legacy:plan:message-mutation
npm run test:modernized:plan:message-mutation
npm run test:legacy:plan:message-assignment
npm run test:modernized:plan:message-assignment
npm run test:legacy:plan:prescription-mutation
npm run test:modernized:plan:prescription-mutation
npm run test:legacy:plan:billing-mutation
npm run test:modernized:plan:billing-mutation
npm run test:legacy:plan:access-permission-mutation
npm run test:modernized:plan:access-permission-mutation
npm run test:legacy:plan:user-group-membership-mutation
npm run test:modernized:plan:user-group-membership-mutation
npm run test:legacy:plan:patient-registration
npm run test:modernized:plan:patient-registration
npm run test:legacy:plan:encounter-documents
npm run test:modernized:plan:encounter-documents
npm run test:legacy:plan:encounter-billing-mutation
npm run test:modernized:plan:encounter-billing-mutation
npm run test:legacy:plan:encounter-diagnosis-mutation
npm run test:modernized:plan:encounter-diagnosis-mutation
npm run test:legacy:plan:encounter-fee-sheet-entry
npm run test:modernized:plan:encounter-fee-sheet-entry
npm run test:legacy:plan:encounter-document-upload
npm run test:modernized:plan:encounter-document-upload
```

Inventory command:

```powershell
npm run list
```

The root script used by the Workbench is:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Suite all -Reset run
```

The legacy-native PHPUnit runner is:

```powershell
cd legacy-openemr
powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyNative.ps1
```

If the ignored upstream Composer dependencies are missing, restore them through the same containerized runner:

```powershell
cd legacy-openemr
powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyNative.ps1 -InstallDependencies
```

The legacy-native Jest runner is:

```powershell
cd legacy-openemr
powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyNativeJs.ps1 -InstallDependencies
```

The runner accepts:

- `--target legacy-openemr|modernized-openemr`
- `--suite all|database|http|ui|workflow|workflow-contact|workflow-demographics|workflow-registration|workflow-appointments|workflow-appointment-reschedule|workflow-appointment-arrival|workflow-appointment-checkout|workflow-appointment-noshow|workflow-appointment-category|workflow-appointment-pending|workflow-appointment-provider|workflow-appointment-facility|workflow-appointment-billing-location|workflow-appointment-comments|workflow-appointment-recurrence|workflow-appointment-series|workflow-appointment-recurrence-exceptions|workflow-appointment-occurrence-cancel|workflow-appointment-occurrence-restore|workflow-appointment-occurrence-reschedule|workflow-appointment-recurrence-exception-edit|workflow-appointment-series-root-update|workflow-appointment-series-root-metadata|workflow-appointment-monthly-recurrence|workflow-appointment-recurrence-unit-matrix|workflow-appointment-days-of-week-recurrence|workflow-appointment-monthly-repeat-on-recurrence|workflow-appointment-series-recurrence-update|workflow-appointment-provider-overlap|workflow-appointment-patient-overlap|workflow-appointment-room-overlap|workflow-appointment-reminders|workflow-encounters|workflow-encounter-metadata|workflow-encounter-billing|workflow-encounter-diagnoses|workflow-encounter-fee-sheet|workflow-encounter-procedures|workflow-encounter-procedure-results|workflow-encounter-signoff|workflow-encounter-cosignature|workflow-encounter-documents|workflow-encounter-binary-documents|workflow-encounter-document-scanned-attachment|workflow-encounter-document-binary-content-replace|workflow-encounter-document-signoff|workflow-encounter-document-denial|workflow-encounter-document-metadata|workflow-encounter-document-move|workflow-encounter-document-content-replace|workflow-encounter-document-revision-replace|workflow-encounter-document-archive|workflow-encounter-document-lifecycle|workflow-encounter-document-external-link|workflow-clinical-lists|workflow-problems|workflow-medications|workflow-messages|workflow-message-assignment|workflow-message-content|workflow-message-reply|workflow-message-update-metadata|message-portal-metadata|workflow-documents|workflow-document-binary|workflow-document-binary-content-replace|workflow-document-image-preview|workflow-document-image-thumbnail|workflow-document-pdf-preview|workflow-document-lifecycle|workflow-document-scanned-attachment|workflow-document-signoff|workflow-document-external-link|workflow-document-denial|workflow-document-metadata|workflow-document-archive|workflow-document-content-replace|workflow-document-revision-replace|workflow-insurance|workflow-insurance-subscriber|patient-portal-account|workflow-prescriptions|workflow-immunizations|workflow-billing|workflow-billing-diagnosis|workflow-billing-correction|workflow-billing-modifier|workflow-payment-posting|workflow-claims|workflow-patient-payments|workflow-procedures|workflow-procedure-result-correction|workflow-procedure-specimen|workflow-procedure-specimen-detail|workflow-procedure-order-correction|workflow-procedure-report-correction|workflow-procedure-report-signoff|workflow-procedure-report-review-queue|workflow-procedure-report-review-queue-filters|workflow-procedure-report-review-queue-provider-filters|workflow-procedure-report-review-queue-lab-filters|workflow-procedure-report-bulk-signoff|workflow-procedure-report-reopen-review|workflow-procedure-lab-provider-catalog|workflow-procedure-lab-provider-directory|workflow-procedure-lab-provider-lifecycle|workflow-procedure-lab-provider-configuration|workflow-admin|workflow-admin-users|workflow-admin-access|workflow-admin-memberships|workflow-admin-login|workflow-admin-login-audit|workflow-admin-session|admin-access-control|slice1|scheduling|encounters|clinical-lists|messages|procedures|procedure-pending-orders|encounter-documents|encounter-document-revision|encounter-billing|encounter-claims|encounter-procedures|billing|claims|payments|account-balance|account-aging|account-ledger|account-statement|account-statement-generation|account-statement-pdf|account-statement-batch|account-statement-batch-package|account-collections-work-queue|account-collections-follow-up|admin|reports|reports-export|documents|document-content|document-preview|document-revision|insurance|immunizations`
- `--plan slice-1-readiness|slice-2-scheduling-readiness|slice-3-encounters-readiness|slice-4-clinical-lists-readiness|slice-5-messaging-readiness|slice-6-procedures-readiness|slice-7-billing-readiness|slice-8-admin-readiness|slice-9-reports-readiness|slice-10-contact-mutation-readiness|slice-11-appointment-mutation-readiness|slice-12-encounter-mutation-readiness|slice-13-clinical-list-mutation-readiness|slice-14-message-mutation-readiness|slice-15-prescription-mutation-readiness|slice-16-billing-mutation-readiness|slice-17-procedure-mutation-readiness|slice-129-procedure-result-correction-readiness|slice-130-procedure-specimen-readiness|slice-131-procedure-specimen-detail-readiness|slice-132-procedure-order-correction-readiness|slice-133-procedure-report-correction-readiness|slice-134-procedure-report-signoff-readiness|slice-135-procedure-report-review-queue-readiness|slice-136-procedure-report-review-queue-filters-readiness|slice-137-procedure-report-review-queue-provider-filters-readiness|slice-138-procedure-report-review-queue-lab-filters-readiness|slice-139-procedure-lab-provider-catalog-readiness|slice-140-procedure-lab-provider-directory-readiness|slice-141-procedure-lab-provider-lifecycle-readiness|slice-142-procedure-lab-provider-configuration-readiness|slice-144-procedure-lab-provider-address-book-readiness|slice-147-procedure-order-catalog-lifecycle-readiness|slice-148-procedure-vendor-compendium-import-readiness|slice-149-procedure-order-queue-readiness|slice-151-procedure-order-transmit-readiness|slice-153-procedure-report-bulk-signoff-readiness|slice-154-procedure-report-reopen-review-readiness|slice-18-admin-facility-mutation-readiness|slice-19-admin-user-mutation-readiness|slice-20-access-control-readiness|slice-21-access-permission-mutation-readiness|slice-22-user-group-membership-mutation-readiness|slice-23-procedure-pending-orders-readiness|slice-24-reports-export-readiness|slice-25-documents-readiness|slice-26-document-mutation-readiness|slice-27-document-content-readiness|slice-28-insurance-readiness|slice-29-immunizations-readiness|slice-30-immunization-mutation-readiness|slice-31-problem-mutation-readiness|slice-32-medication-list-mutation-readiness|slice-33-binary-document-mutation-readiness|slice-34-insurance-mutation-readiness|slice-203-insurance-subscriber-readiness|slice-204-patient-portal-account-readiness|slice-35-encounter-metadata-readiness|slice-36-patient-demographics-mutation-readiness|slice-37-patient-registration-readiness|slice-38-document-signoff-readiness|slice-39-document-external-link-readiness|slice-40-document-denial-readiness|slice-41-document-metadata-readiness|slice-42-document-archive-readiness|slice-43-document-content-replace-readiness|slice-44-billing-diagnosis-readiness|slice-45-billing-correction-readiness|slice-46-billing-modifier-readiness|slice-47-claim-status-readiness|slice-48-payment-posting-readiness|slice-49-account-balance-readiness|slice-50-account-aging-readiness|slice-51-account-ledger-readiness|slice-52-account-statement-readiness|slice-53-document-preview-readiness|slice-54-document-revision-readiness|slice-55-document-revision-replace-readiness|slice-56-payment-posting-mutation-readiness|slice-57-claim-status-mutation-readiness|slice-58-patient-payment-capture-readiness|slice-59-statement-generation-readiness|slice-60-statement-pdf-export-readiness|slice-61-statement-batch-readiness|slice-62-statement-batch-package-readiness|slice-63-collections-work-queue-readiness|slice-64-collections-follow-up-readiness|slice-65-message-assignment-readiness|slice-66-message-content-readiness|slice-156-message-reply-readiness|slice-157-message-portal-metadata-readiness|slice-158-message-update-metadata-readiness|slice-159-admin-login-readiness|slice-160-admin-login-audit-readiness|slice-161-admin-session-readiness|slice-67-encounter-documents-readiness|slice-68-encounter-billing-readiness|slice-69-encounter-claims-readiness|slice-70-encounter-procedures-readiness|slice-71-encounter-diagnoses-readiness|slice-72-encounter-billing-mutation-readiness|slice-73-encounter-diagnosis-mutation-readiness|slice-74-encounter-fee-sheet-entry-readiness|slice-75-encounter-procedure-order-entry-readiness|slice-76-encounter-procedure-result-entry-readiness|slice-77-encounter-signoff-readiness|slice-78-encounter-document-upload-readiness|slice-79-encounter-binary-document-upload-readiness|slice-126-encounter-document-scanned-attachment-readiness|slice-127-encounter-document-binary-content-replace-readiness|slice-128-document-binary-content-replace-readiness|slice-80-encounter-document-signoff-readiness|slice-81-encounter-document-denial-readiness|slice-82-encounter-document-metadata-readiness|slice-83-encounter-document-move-readiness|slice-84-encounter-document-content-replace-readiness|slice-85-encounter-document-archive-readiness|slice-86-encounter-document-lifecycle-readiness|slice-87-encounter-document-external-link-readiness|slice-88-document-image-preview-readiness|slice-89-document-image-thumbnail-readiness|slice-90-document-pdf-preview-readiness|slice-91-document-lifecycle-readiness|slice-92-document-scanned-attachment-readiness|slice-93-appointment-reschedule-readiness|slice-94-appointment-arrival-readiness|slice-95-appointment-checkout-readiness|slice-96-appointment-noshow-readiness|slice-97-appointment-category-readiness|slice-98-appointment-pending-readiness|slice-99-appointment-provider-readiness|slice-100-appointment-facility-readiness|slice-101-appointment-billing-location-readiness|slice-102-appointment-comments-readiness|slice-103-appointment-recurrence-readiness|slice-104-appointment-series-readiness|slice-105-appointment-recurrence-exceptions-readiness|slice-106-appointment-occurrence-cancel-readiness|slice-107-appointment-occurrence-restore-readiness|slice-108-appointment-occurrence-reschedule-readiness|slice-109-appointment-recurrence-exception-edit-readiness|slice-110-appointment-series-root-update-readiness|slice-111-appointment-series-root-metadata-readiness|slice-112-appointment-monthly-recurrence-readiness|slice-113-appointment-recurrence-unit-matrix-readiness|slice-114-appointment-days-of-week-recurrence-readiness|slice-115-appointment-monthly-repeat-on-recurrence-readiness|slice-116-appointment-series-recurrence-update-readiness|slice-117-appointment-provider-overlap-readiness|slice-118-appointment-patient-overlap-readiness|slice-119-appointment-room-overlap-readiness|slice-120-appointment-reminders-readiness|slice-121-encounter-cosignature-readiness|slice-122-encounter-document-revision-readiness|slice-123-encounter-document-revision-replace-readiness|legacy-readiness|mutation-isolated|full-parity`
- Slice 154 adds `workflow-procedure-report-reopen-review` to the suite allow-list and `slice-154-procedure-report-reopen-review-readiness` to the plan allow-list.
- Slice 153 adds `workflow-procedure-report-bulk-signoff` to the suite allow-list and `slice-153-procedure-report-bulk-signoff-readiness` to the plan allow-list.
- Slice 151 adds `workflow-procedure-order-transmit` to the suite allow-list and `slice-151-procedure-order-transmit-readiness` to the plan allow-list.
- Slice 149 adds `workflow-procedure-order-queue` to the suite allow-list and `slice-149-procedure-order-queue-readiness` to the plan allow-list.
- `--reset none|run|suite|test`
- `--headed`
- `--grep <pattern>`
- `--workers <n>`
- `--list`

Slice 215 extends these allow-lists with `workflow-patient-portal-read` and `slice-215-patient-portal-read-readiness`; Slice 214 remains available with `workflow-patient-portal-delete` and `slice-214-patient-portal-delete-readiness`; Slice 213 remains available with `workflow-patient-portal-thread` and `slice-213-patient-portal-thread-readiness`; Slice 212 remains available with `workflow-patient-portal-reply` and `slice-212-patient-portal-reply-readiness`, including Slice 466 path-backed probe payload attachments; Slice 211 remains available with `workflow-patient-portal-compose` and `slice-211-patient-portal-compose-readiness`, including Slice 465 path-backed probe payload attachments; Slice 210 remains available with `workflow-patient-portal-messages` and `slice-210-patient-portal-messages-readiness`, including Slice 464 path-backed probe payload attachments; Slice 209 remains available with `workflow-patient-portal-home` and `slice-209-patient-portal-home-readiness`; Slice 208 remains available with `workflow-patient-portal-session` and `slice-208-patient-portal-session-readiness`; Slice 207 remains available with `workflow-patient-portal-authentication` and `slice-207-patient-portal-authentication-readiness`; Slice 206 remains available with `workflow-patient-portal-access` and `slice-206-patient-portal-access-readiness`; Slice 205 remains available with `workflow-patient-portal-reset` and `slice-205-patient-portal-reset-readiness`; Slice 204 remains available with `patient-portal-account` and `slice-204-patient-portal-account-readiness`; Slice 203 remains available with `workflow-insurance-subscriber` and `slice-203-insurance-subscriber-readiness`; Slice 202 remains available with `patient-history` and `slice-202-patient-history-readiness`; Slice 201 remains available with `workflow-patient-care-team-contact` and `slice-201-patient-care-team-contact-readiness`; Slice 200 remains available with `workflow-patient-care-team-members` and `slice-200-patient-care-team-members-readiness`; Slice 199 remains available with `workflow-patient-care-team` and `slice-199-patient-care-team-readiness`; Slice 198 remains available with `workflow-patient-provider-assignment` and `slice-198-patient-provider-assignment-readiness`; Slice 197 remains available with `workflow-patient-employer-core` and `slice-197-patient-employer-core-readiness`; Slice 196 remains available with `workflow-patient-social-details` and `slice-196-patient-social-details-readiness`; Slice 195 remains available with `workflow-patient-guardian-details` and `slice-195-patient-guardian-details-readiness`; Slice 194 remains available with `workflow-patient-guardian-contact` and `slice-194-patient-guardian-contact-readiness`; Slice 193 remains available with `workflow-patient-deceased-status` and `slice-193-patient-deceased-status-readiness`; Slice 192 remains available with `workflow-patient-registration-validation` and `slice-192-patient-registration-validation-readiness`; Slice 191 remains available with `workflow-patient-duplicate-detection` and `slice-191-patient-duplicate-detection-readiness`; Slice 190 remains available with `workflow-encounter-amendment-history` and `slice-190-encounter-amendment-history-readiness`; Slice 189 remains available with `workflow-appointment-mutation-authorization-policy` and `slice-189-appointment-mutation-authorization-policy-readiness`; Slice 188 remains available with `workflow-billing-mutation-authorization-policy` and `slice-188-billing-mutation-authorization-policy-readiness`; Slice 187 remains available with `workflow-message-mutation-authorization-policy` and `slice-187-message-mutation-authorization-policy-readiness`; Slice 186 remains available with `workflow-document-mutation-authorization-policy` and `slice-186-document-mutation-authorization-policy-readiness`; Slice 185 remains available with `workflow-encounter-mutation-authorization-policy` and `slice-185-encounter-mutation-authorization-policy-readiness`; Slice 184 remains available with `workflow-patient-mutation-authorization-policy` and `slice-184-patient-mutation-authorization-policy-readiness`; Slice 183 remains available with `workflow-procedure-mutation-authorization-policy` and `slice-183-procedure-mutation-authorization-policy-readiness`; Slice 176 remains available with `workflow-appointment-authorization-policy` and `slice-176-appointment-authorization-policy-readiness`; earlier slices remain available through their existing suites and named plans.

Slice 237 extends these allow-lists with `workflow-patient-portal-report-procedure-artifacts` and `slice-237-patient-portal-generated-medical-report-procedure-artifacts-readiness`; Slice 236 remains available with `workflow-patient-portal-report-procedures` and `slice-236-patient-portal-generated-medical-report-procedure-selection-readiness`; Slice 235 remains available with `workflow-patient-portal-deleted-messages` and `slice-235-patient-portal-deleted-messages-readiness`; Slice 234 remains available with `workflow-patient-portal-message-forward` and `slice-234-patient-portal-message-forward-readiness`; Slice 233 remains available with `workflow-patient-portal-message-encryption` and `slice-233-patient-portal-message-encryption-readiness`; Slice 232 remains available with `workflow-patient-portal-message-audit` and `slice-232-patient-portal-message-audit-readiness`; Slice 231 remains available with `workflow-patient-portal-report-audit` and `slice-231-patient-portal-generated-medical-report-audit-readiness`; Slice 230 remains available with `workflow-patient-portal-report-package` and `slice-230-patient-portal-generated-medical-report-package-readiness`; Slice 229 remains available with `workflow-patient-portal-report-template` and `slice-229-patient-portal-generated-medical-report-template-readiness`; Slice 228 remains available with `workflow-patient-portal-report-forms` and `slice-228-patient-portal-generated-medical-report-form-selection-readiness`; Slice 227 remains available with `workflow-patient-portal-report-issues` and `slice-227-patient-portal-generated-medical-report-issue-selection-readiness`; Slice 226 remains available with `workflow-patient-portal-medical-report-pdf` and `slice-226-patient-portal-generated-medical-report-pdf-readiness`; Slice 225 remains available with `workflow-patient-portal-generated-medical-report` and `slice-225-patient-portal-generated-medical-report-readiness`; Slice 224 remains available with `workflow-patient-portal-medical-report` and `slice-224-patient-portal-medical-report-readiness`; Slice 223 remains available with `workflow-patient-portal-lab-results` and `slice-223-patient-portal-lab-results-readiness`; Slice 222 remains available with `workflow-patient-portal-clinical-summary` and `slice-222-patient-portal-clinical-summary-readiness`; Slice 221 remains available with `workflow-patient-portal-appointment-options` and `slice-221-patient-portal-appointment-options-readiness`; Slice 220 remains available with `workflow-patient-portal-appointment-request` and `slice-220-patient-portal-appointment-request-readiness`; Slice 219 remains available with `workflow-patient-portal-appointments` and `slice-219-patient-portal-appointments-readiness`; Slice 218 remains available with `workflow-patient-portal-documents` and `slice-218-patient-portal-documents-readiness`.

## Test Management

The test manifest now has two selection layers:

- Suites: layer-level groups such as database, HTTP, UI, workflow, patient-chart slice parity, scheduling slice parity, encounter slice parity, encounter metadata mutation parity, encounter billing linkage mutation parity, encounter diagnosis coding mutation parity, encounter fee-sheet entry parity, encounter procedure-order entry parity, encounter procedure-result parity, encounter sign-off parity, encounter co-signature parity, encounter document upload parity, encounter binary document upload parity, encounter document sign-off parity, encounter document denial parity, encounter document metadata parity, encounter document move parity, encounter document content replacement parity, encounter document replacement revision parity, encounter document archive restore parity, encounter document lifecycle timeline parity, encounter external-link document parity, clinical-list slice parity, messaging slice parity, patient-message assignment parity, patient-message content parity, patient-message update metadata parity, encounter document attachment parity, encounter document revision parity, encounter billing linkage parity, encounter claim linkage parity, encounter procedure order linkage parity, procedure-result slice parity, procedure specimen detail parity, procedure order correction parity, procedure report correction parity, pending procedure-order slice parity, fee-sheet billing slice parity, fee-sheet diagnosis coding parity, fee-sheet charge correction parity, claim status parity, claim status mutation parity, payment posting parity, payment posting mutation parity, patient payment capture parity, collections follow-up task parity, account balance parity, account aging parity, account ledger parity, account statement parity, patient statement generation parity, patient statement PDF export parity, statement batch candidate parity, statement batch package parity, collections work queue parity, insurance coverage parity, insurance mutation parity, immunization history parity, administration directory slice parity, operational reports slice parity, reports export slice parity, patient documents slice parity, patient document content parity, patient document preview parity, patient image document preview parity, patient image document thumbnail parity, patient PDF document preview parity, patient document lifecycle timeline parity, patient scanned attachment parity, appointment reschedule parity, appointment arrival parity, appointment check-out parity, appointment no-show parity, appointment category parity, appointment pending-status parity, appointment provider reassignment parity, appointment facility reassignment parity, appointment billing-location reassignment parity, appointment comments parity, appointment recurrence metadata parity, appointment recurring-series parity, appointment recurrence-exceptions parity, appointment occurrence-cancel parity, appointment occurrence-restore parity, appointment occurrence-reschedule parity, appointment recurrence exception-list edit parity, appointment series root update parity, appointment series root metadata parity, appointment monthly recurrence parity, appointment recurrence unit matrix parity, appointment days-of-week recurrence parity, appointment monthly repeat-on recurrence parity, appointment series recurrence update parity, appointment provider overlap parity, appointment patient overlap parity, appointment room overlap parity, appointment reminders parity, patient document revision parity, patient document replacement revision parity, patient document mutation parity, binary patient-document mutation parity, patient document sign-off parity, patient document external-link parity, patient document denial parity, patient document metadata parity, patient document archive restore parity, patient document content replacement parity, patient binary document content replacement parity, problem-list mutation parity, medication-list mutation parity, and immunization mutation parity.
- Plans: operator-facing run plans that select suites, reset behavior, target support, and intent.

Current plans:

- `slice-1-readiness` runs database and patient chart parity with a run-level reset for both legacy and modernized targets.
- `slice-2-scheduling-readiness` runs the scheduling parity suite with a run-level reset for both legacy and modernized targets.
- `slice-3-encounters-readiness` runs the encounter SOAP/vitals parity suite with a run-level reset for both legacy and modernized targets.
- `slice-4-clinical-lists-readiness` runs the clinical-lists parity suite with a run-level reset for both legacy and modernized targets.
- `slice-5-messaging-readiness` runs the messages parity suite with a run-level reset for both legacy and modernized targets.
- `slice-157-message-portal-metadata-readiness` runs the patient-message portal metadata suite with a run-level reset for both legacy and modernized targets.
- `slice-158-message-update-metadata-readiness` runs the patient-message update metadata suite with a per-test reset for both legacy and modernized targets.
- `slice-6-procedures-readiness` runs the procedures parity suite with a run-level reset for both legacy and modernized targets.
- `slice-7-billing-readiness` runs the billing parity suite with a run-level reset for both legacy and modernized targets.
- `slice-8-admin-readiness` runs the admin parity suite with a run-level reset for both legacy and modernized targets.
- `slice-159-admin-login-readiness` runs the admin login readiness parity suite with a run-level reset for both legacy and modernized targets.
- `slice-160-admin-login-audit-readiness` runs the admin login audit readiness parity suite with a run-level reset for both legacy and modernized targets.
- `slice-161-admin-session-readiness` runs the admin session readiness parity suite with a run-level reset for both legacy and modernized targets.
- `slice-162-admin-audit-protection-readiness` runs the admin audit protection readiness parity suite with a run-level reset for both legacy and modernized targets.
- `slice-163-admin-directory-protection-readiness` runs the admin directory protection readiness parity suite with a run-level reset for both legacy and modernized targets.
- `slice-164-reports-protection-readiness` runs the operational reports protection readiness parity suite with a run-level reset for both legacy and modernized targets.
- `slice-166-clinical-list-protection-readiness` runs the clinical-list protection readiness parity suite with a run-level reset for both legacy and modernized targets.
- `slice-165-patient-protection-readiness` runs the patient chart protection readiness parity suite with a run-level reset for both legacy and modernized targets.
- `slice-9-reports-readiness` runs the reports parity suite with a run-level reset for both legacy and modernized targets.
- `slice-10-contact-mutation-readiness` runs the patient contact mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-11-appointment-mutation-readiness` runs the appointment mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-12-encounter-mutation-readiness` runs the encounter mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-13-clinical-list-mutation-readiness` runs the clinical-list allergy mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-14-message-mutation-readiness` runs the patient-message mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-15-prescription-mutation-readiness` runs the prescription mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-16-billing-mutation-readiness` runs the billing line mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-17-procedure-mutation-readiness` runs the lab procedure mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-18-admin-facility-mutation-readiness` runs the administration facility mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-19-admin-user-mutation-readiness` runs the administration user mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-20-access-control-readiness` runs the administration access-control suite with a run-level reset for both legacy and modernized targets.
- `slice-21-access-permission-mutation-readiness` runs the administration access-permission mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-22-user-group-membership-mutation-readiness` runs the administration user group membership mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-23-procedure-pending-orders-readiness` runs the pending/scheduled procedure-order suite with a run-level reset for both legacy and modernized targets.
- `slice-24-reports-export-readiness` runs the reports export suite with a run-level reset for both legacy and modernized targets.
- `slice-25-documents-readiness` runs the patient documents suite with a run-level reset for both legacy and modernized targets.
- `slice-26-document-mutation-readiness` runs the patient document mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-27-document-content-readiness` runs the patient document content suite with a run-level reset for both legacy and modernized targets.
- `slice-28-insurance-readiness` runs the patient insurance coverage suite with a run-level reset for both legacy and modernized targets.
- `slice-29-immunizations-readiness` runs the patient immunizations suite with a run-level reset for both legacy and modernized targets.
- `slice-30-immunization-mutation-readiness` runs the patient immunization mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-31-problem-mutation-readiness` runs the patient problem-list mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-32-medication-list-mutation-readiness` runs the patient medication-list mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-33-binary-document-mutation-readiness` runs the binary patient document mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-34-insurance-mutation-readiness` runs the patient insurance mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-203-insurance-subscriber-readiness` runs the patient insurance subscriber suite with a per-test reset for both legacy and modernized targets.
- `slice-204-patient-portal-account-readiness` runs the patient portal account suite with a run-level reset for both legacy and modernized targets.
- `slice-205-patient-portal-reset-readiness` runs the patient portal reset suite with a per-test reset for both legacy and modernized targets.
- `slice-206-patient-portal-access-readiness` runs the patient portal access suite with a per-test reset for both legacy and modernized targets.
- `slice-207-patient-portal-authentication-readiness` runs the patient portal authentication suite with a per-test reset for both legacy and modernized targets.
- `slice-210-patient-portal-messages-readiness` runs the patient portal secure-message inbox suite with a per-test reset for both legacy and modernized targets.
- `slice-211-patient-portal-compose-readiness` runs the patient portal secure-message compose and sent-folder suite with a per-test reset for both legacy and modernized targets.
- `slice-212-patient-portal-reply-readiness` runs the patient portal secure-message reply suite with a per-test reset for both legacy and modernized targets.
- `slice-213-patient-portal-thread-readiness` runs the patient portal secure-message thread view suite with a per-test reset for both legacy and modernized targets.
- `slice-214-patient-portal-delete-readiness` runs the patient portal secure-message archive/delete suite with a per-test reset for both legacy and modernized targets.
- `slice-215-patient-portal-read-readiness` runs the patient portal secure-message read-status suite with a per-test reset for both legacy and modernized targets.
- `slice-216-patient-portal-batch-archive-readiness` runs the patient portal secure-message selected-message archive suite with a per-test reset for both legacy and modernized targets.
- `slice-217-patient-portal-all-messages-readiness` runs the patient portal secure-message All-folder suite with a per-test reset for both legacy and modernized targets.
- `slice-218-patient-portal-documents-readiness` runs the patient portal document list/download suite with a per-test reset for both legacy and modernized targets.
- `slice-219-patient-portal-appointments-readiness` runs the patient portal appointment list suite with a per-test reset for both legacy and modernized targets.
- slice-220-patient-portal-appointment-request-readiness runs the patient portal appointment request suite with a per-test reset for both legacy and modernized targets.
- slice-221-patient-portal-appointment-options-readiness runs the patient portal appointment request-options suite with a per-test reset for both legacy and modernized targets.
- slice-222-patient-portal-clinical-summary-readiness runs the patient portal clinical-summary suite with a per-test reset for both legacy and modernized targets.
- slice-223-patient-portal-lab-results-readiness runs the patient portal lab-results suite with a per-test reset for both legacy and modernized targets.
- slice-224-patient-portal-medical-report-readiness runs the patient portal medical-report suite with a per-test reset for both legacy and modernized targets.
- slice-225-patient-portal-generated-medical-report-readiness runs the patient portal generated medical-report suite with a per-test reset for both legacy and modernized targets.
- slice-226-patient-portal-generated-medical-report-pdf-readiness runs the patient portal generated medical-report PDF suite with a per-test reset for both legacy and modernized targets.
- slice-227-patient-portal-generated-medical-report-issue-selection-readiness runs the patient portal generated medical-report issue-selection suite with a per-test reset for both legacy and modernized targets.
- slice-230-patient-portal-generated-medical-report-package-readiness runs the patient portal generated medical-report package suite with a per-test reset for both legacy and modernized targets.
- slice-232-patient-portal-message-audit-readiness runs the patient portal secure-message lifecycle audit suite with a per-test reset for both legacy and modernized targets.
- slice-233-patient-portal-message-encryption-readiness runs the patient portal secure-message encrypted-body suite with a per-test reset for both legacy and modernized targets.
- slice-234-patient-portal-message-forward-readiness runs the patient portal secure-message forward-to-practice suite with a per-test reset for both legacy and modernized targets.
- slice-237-patient-portal-generated-medical-report-procedure-artifacts-readiness runs the patient portal generated medical-report procedure-order artifact suite with a per-test reset for both legacy and modernized targets.
- slice-236-patient-portal-generated-medical-report-procedure-selection-readiness runs the patient portal generated medical-report procedure-order selection suite with a per-test reset for both legacy and modernized targets.
- slice-235-patient-portal-deleted-messages-readiness runs the patient portal secure-message Deleted-folder suite with a per-test reset for both legacy and modernized targets.
- slice-231-patient-portal-generated-medical-report-audit-readiness runs the patient portal generated medical-report lifecycle audit suite with a per-test reset for both legacy and modernized targets.
- slice-229-patient-portal-generated-medical-report-template-readiness runs the patient portal generated medical-report printable template suite with a per-test reset for both legacy and modernized targets.
- slice-228-patient-portal-generated-medical-report-form-selection-readiness runs the patient portal generated medical-report encounter-form selection suite with a per-test reset for both legacy and modernized targets.
- slice-238-patient-portal-message-recipient-directory-readiness runs the patient portal secure-message recipient-directory suite with a per-test reset for both legacy and modernized targets.
- slice-239-patient-portal-message-subject-presets-readiness runs the patient portal secure-message subject-preset suite with a per-test reset for both legacy and modernized targets.
- slice-240-patient-portal-message-html-body-readiness runs the patient portal secure-message HTML body rendering suite with a per-test reset for both legacy and modernized targets.
- slice-241-patient-portal-message-pagination-readiness runs the patient portal secure-message pagination suite with a per-test reset for both legacy and modernized targets.
- slice-245-patient-portal-prescription-end-date-readiness runs the patient portal prescription end-date filtering suite with a per-test reset for both legacy and modernized targets.
- slice-246-patient-portal-medication-date-columns-readiness runs the patient portal medication date-column suite with a per-test reset for both legacy and modernized targets.
- slice-247-patient-portal-problem-date-columns-readiness runs the patient portal problem date-column suite with a per-test reset for both legacy and modernized targets.
- slice-252-patient-portal-profile-review-queue-readiness runs the patient portal profile review queue suite with a per-test reset for both legacy and modernized targets.
- slice-251-patient-portal-profile-change-request-readiness runs the patient portal profile change request suite with a per-test reset for both legacy and modernized targets.
- slice-250-patient-portal-profile-readiness runs the patient portal profile suite with a per-test reset for both legacy and modernized targets.
- slice-249-patient-portal-home-immunizations-readiness runs the patient portal home immunizations suite with a per-test reset for both legacy and modernized targets.
- slice-248-patient-portal-allergy-date-columns-readiness runs the patient portal allergy date-column suite with a per-test reset for both legacy and modernized targets.
- slice-244-patient-portal-prescription-start-date-readiness runs the patient portal prescription start-date suite with a per-test reset for both legacy and modernized targets.
- slice-243-patient-portal-prescription-modified-date-readiness runs the patient portal prescription modified-date suite with a per-test reset for both legacy and modernized targets.
- slice-242-patient-portal-message-mark-all-read-readiness runs the patient portal secure-message mark-all-read suite with a per-test reset for both legacy and modernized targets.
- `slice-209-patient-portal-home-readiness` runs the patient portal home suite with a per-test reset for both legacy and modernized targets.
- `slice-208-patient-portal-session-readiness` runs the patient portal session suite with a per-test reset for both legacy and modernized targets.
- `slice-35-encounter-metadata-readiness` runs the encounter metadata mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-36-patient-demographics-mutation-readiness` runs the patient demographics mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-37-patient-registration-readiness` runs the patient registration mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-38-document-signoff-readiness` runs the patient document sign-off mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-39-document-external-link-readiness` runs the patient document external-link mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-40-document-denial-readiness` runs the patient document denial mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-41-document-metadata-readiness` runs the patient document metadata mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-42-document-archive-readiness` runs the patient document archive restore mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-43-document-content-replace-readiness` runs the patient document content replacement mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-44-billing-diagnosis-readiness` runs the billing diagnosis coding mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-45-billing-correction-readiness` runs the billing charge correction mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-46-billing-modifier-readiness` runs the billing modifier mutation suite with a per-test reset for both legacy and modernized targets.
- `slice-47-claim-status-readiness` runs the claim status suite with a run-level reset for both legacy and modernized targets.
- `slice-48-payment-posting-readiness` runs the payment posting suite with a run-level reset for both legacy and modernized targets.
- `slice-49-account-balance-readiness` runs the account balance suite with a run-level reset for both legacy and modernized targets.
- `slice-50-account-aging-readiness` runs the account aging suite with a run-level reset for both legacy and modernized targets.
- `slice-51-account-ledger-readiness` runs the account ledger suite with a run-level reset for both legacy and modernized targets.
- `slice-52-account-statement-readiness` runs the account statement suite with a run-level reset for both legacy and modernized targets.
- `slice-53-document-preview-readiness` runs the document preview suite with a run-level reset for both legacy and modernized targets.
- `slice-54-document-revision-readiness` runs the document revision suite with a run-level reset for both legacy and modernized targets.
- `slice-55-document-revision-replace-readiness` runs the document replacement revision mutation suite with a run-level reset for both legacy and modernized targets.
- `slice-56-payment-posting-mutation-readiness` runs the payment posting mutation suite with a test-level reset for both legacy and modernized targets.
- `slice-57-claim-status-mutation-readiness` runs the claim status mutation suite with a test-level reset for both legacy and modernized targets.
- `slice-58-patient-payment-capture-readiness` runs the patient payment capture mutation suite with a test-level reset for both legacy and modernized targets.
- `slice-59-statement-generation-readiness` runs the account statement generation suite with a run-level reset for both legacy and modernized targets.
- `slice-60-statement-pdf-export-readiness` runs the account statement PDF export suite with a run-level reset for both legacy and modernized targets.
- `slice-61-statement-batch-readiness` runs the account statement batch suite with a run-level reset for both legacy and modernized targets.
- `slice-62-statement-batch-package-readiness` runs the account statement batch package suite with a run-level reset for both legacy and modernized targets.
- `slice-63-collections-work-queue-readiness` runs the account collections work queue suite with a run-level reset for both legacy and modernized targets.
- `slice-64-collections-follow-up-readiness` runs the account collections follow-up task suite with a test-level reset for both legacy and modernized targets.
- `slice-65-message-assignment-readiness` runs the patient-message assignment suite with a test-level reset for both legacy and modernized targets.
- `slice-66-message-content-readiness` runs the patient-message content edit suite with a test-level reset for both legacy and modernized targets.
- `slice-67-encounter-documents-readiness` runs the encounter document attachment suite with a run-level reset for both legacy and modernized targets.
- `slice-122-encounter-document-revision-readiness` runs the encounter document revision suite with a run-level reset for both legacy and modernized targets.
- `slice-123-encounter-document-revision-replace-readiness` runs the encounter document replacement revision suite with a test-level reset for both legacy and modernized targets.
- `slice-126-encounter-document-scanned-attachment-readiness` runs the encounter scanned attachment readiness suite with a test-level reset for both legacy and modernized targets.
- `slice-127-encounter-document-binary-content-replace-readiness` runs the encounter binary document content replacement suite with a test-level reset for both legacy and modernized targets.
- `slice-128-document-binary-content-replace-readiness` runs the patient binary document content replacement suite with a test-level reset for both legacy and modernized targets.
- `slice-68-encounter-billing-readiness` runs the encounter billing linkage suite with a run-level reset for both legacy and modernized targets.
- `slice-69-encounter-claims-readiness` runs the encounter claim linkage suite with a run-level reset for both legacy and modernized targets.
- `slice-70-encounter-procedures-readiness` runs the encounter procedure order linkage suite with a run-level reset for both legacy and modernized targets.
- `slice-71-encounter-diagnoses-readiness` runs the encounter diagnosis coding suite with a run-level reset for both legacy and modernized targets.
- `slice-72-encounter-billing-mutation-readiness` runs the encounter billing linkage mutation suite with a test-level reset for both legacy and modernized targets.
- `slice-73-encounter-diagnosis-mutation-readiness` runs the encounter diagnosis coding mutation suite with a test-level reset for both legacy and modernized targets.
- `slice-74-encounter-fee-sheet-entry-readiness` runs the encounter fee-sheet entry suite with a test-level reset for both legacy and modernized targets.
- `slice-75-encounter-procedure-order-entry-readiness` runs the encounter procedure-order entry suite with a test-level reset for both legacy and modernized targets.
- `slice-76-encounter-procedure-result-entry-readiness` runs the encounter procedure-result entry suite with a test-level reset for both legacy and modernized targets.
- `slice-129-procedure-result-correction-readiness` runs the procedure result correction suite with a test-level reset for both legacy and modernized targets.
- `slice-130-procedure-specimen-readiness` runs the procedure specimen metadata suite with a test-level reset for both legacy and modernized targets.
- `slice-131-procedure-specimen-detail-readiness` runs the order-level procedure specimen detail suite with a test-level reset for both legacy and modernized targets.
- `slice-132-procedure-order-correction-readiness` runs the procedure order correction suite with a test-level reset for both legacy and modernized targets.
- `slice-133-procedure-report-correction-readiness` runs the procedure report correction suite with a test-level reset for both legacy and modernized targets.
- `slice-134-procedure-report-signoff-readiness` runs the procedure report sign-off suite with a test-level reset for both legacy and modernized targets.
- `slice-135-procedure-report-review-queue-readiness` runs the procedure report review queue suite with a test-level reset for both legacy and modernized targets.
- `slice-136-procedure-report-review-queue-filters-readiness` runs the procedure report review queue filters suite with a test-level reset for both legacy and modernized targets.
- `slice-137-procedure-report-review-queue-provider-filters-readiness` runs the procedure report review queue provider filters suite with a test-level reset for both legacy and modernized targets.
- `slice-138-procedure-report-review-queue-lab-filters-readiness` runs the procedure report review queue lab filters suite with a test-level reset for both legacy and modernized targets.
- `slice-77-encounter-signoff-readiness` runs the encounter sign-off suite with a test-level reset for both legacy and modernized targets.
- `slice-121-encounter-cosignature-readiness` runs the encounter co-signature suite with a test-level reset for both legacy and modernized targets.
- `slice-78-encounter-document-upload-readiness` runs the encounter document upload suite with a test-level reset for both legacy and modernized targets.
- `slice-79-encounter-binary-document-upload-readiness` runs the encounter binary document upload suite with a test-level reset for both legacy and modernized targets.
- `slice-80-encounter-document-signoff-readiness` runs the encounter document sign-off suite with a test-level reset for both legacy and modernized targets.
- `slice-81-encounter-document-denial-readiness` runs the encounter document denial suite with a test-level reset for both legacy and modernized targets.
- `slice-82-encounter-document-metadata-readiness` runs the encounter document metadata suite with a test-level reset for both legacy and modernized targets.
- `slice-83-encounter-document-move-readiness` runs the encounter document move suite with a test-level reset for both legacy and modernized targets.
- `slice-84-encounter-document-content-replace-readiness` runs the encounter document content replacement suite with a test-level reset for both legacy and modernized targets.
- `slice-85-encounter-document-archive-readiness` runs the encounter document archive/restore suite with a test-level reset for both legacy and modernized targets.
- `slice-86-encounter-document-lifecycle-readiness` runs the encounter document lifecycle timeline suite with a test-level reset for both legacy and modernized targets.
- `slice-87-encounter-document-external-link-readiness` runs the encounter external-link document suite with a test-level reset for both legacy and modernized targets.
- `slice-88-document-image-preview-readiness` runs the patient image document preview suite with a test-level reset for both legacy and modernized targets.
- `slice-89-document-image-thumbnail-readiness` runs the patient image document thumbnail suite with a test-level reset for both legacy and modernized targets.
- `slice-90-document-pdf-preview-readiness` runs the patient PDF document inline-preview suite with a test-level reset for both legacy and modernized targets.
- `slice-91-document-lifecycle-readiness` runs the patient document lifecycle timeline suite with a test-level reset for both legacy and modernized targets.
- `slice-92-document-scanned-attachment-readiness` runs the patient scanned attachment suite with a test-level reset for both legacy and modernized targets.
- `slice-93-appointment-reschedule-readiness` runs the appointment reschedule suite with a test-level reset for both legacy and modernized targets.
- `slice-94-appointment-arrival-readiness` runs the appointment arrival suite with a test-level reset for both legacy and modernized targets.
- `slice-95-appointment-checkout-readiness` runs the appointment check-out suite with a test-level reset for both legacy and modernized targets.
- `slice-96-appointment-noshow-readiness` runs the appointment no-show suite with a test-level reset for both legacy and modernized targets.
- `slice-97-appointment-category-readiness` runs the appointment category suite with a test-level reset for both legacy and modernized targets.
- `slice-98-appointment-pending-readiness` runs the appointment pending-status suite with a test-level reset for both legacy and modernized targets.
- `slice-99-appointment-provider-readiness` runs the appointment provider reassignment suite with a test-level reset for both legacy and modernized targets.
- `slice-100-appointment-facility-readiness` runs the appointment facility reassignment suite with a test-level reset for both legacy and modernized targets.
- `slice-101-appointment-billing-location-readiness` runs the appointment billing-location reassignment suite with a test-level reset for both legacy and modernized targets.
- `slice-102-appointment-comments-readiness` runs the appointment comments suite with a test-level reset for both legacy and modernized targets.
- `slice-103-appointment-recurrence-readiness` runs the appointment recurrence metadata suite with a test-level reset for both legacy and modernized targets.
- `slice-104-appointment-series-readiness` runs the appointment recurring-series suite with a run-level reset for both legacy and modernized targets.
- `slice-105-appointment-recurrence-exceptions-readiness` runs the appointment recurrence-exceptions suite with a run-level reset for both legacy and modernized targets.
- `slice-106-appointment-occurrence-cancel-readiness` runs the appointment occurrence-cancel suite with a test-level reset for both legacy and modernized targets.
- `slice-107-appointment-occurrence-restore-readiness` runs the appointment occurrence-restore suite with a test-level reset for both legacy and modernized targets.
- `slice-108-appointment-occurrence-reschedule-readiness` runs the appointment occurrence-reschedule suite with a test-level reset for both legacy and modernized targets.
- `slice-109-appointment-recurrence-exception-edit-readiness` runs the appointment recurrence exception-edit suite with a test-level reset for both legacy and modernized targets.
- `slice-110-appointment-series-root-update-readiness` runs the appointment series root update suite with a test-level reset for both legacy and modernized targets.
- `slice-111-appointment-series-root-metadata-readiness` runs the appointment series root metadata suite with a test-level reset for both legacy and modernized targets.
- `slice-112-appointment-monthly-recurrence-readiness` runs the appointment monthly recurrence suite with a test-level reset for both legacy and modernized targets.
- `slice-113-appointment-recurrence-unit-matrix-readiness` runs the appointment recurrence unit matrix suite with a test-level reset for both legacy and modernized targets.
- `slice-114-appointment-days-of-week-recurrence-readiness` runs the appointment days-of-week recurrence suite with a test-level reset for both legacy and modernized targets.
- `slice-115-appointment-monthly-repeat-on-recurrence-readiness` runs the appointment monthly repeat-on recurrence suite with a test-level reset for both legacy and modernized targets.
- `slice-116-appointment-series-recurrence-update-readiness` runs the appointment series recurrence update suite with a test-level reset for both legacy and modernized targets.
- `slice-117-appointment-provider-overlap-readiness` runs the appointment provider overlap suite with a test-level reset for both legacy and modernized targets.
- `slice-118-appointment-patient-overlap-readiness` runs the appointment patient overlap suite with a test-level reset for both legacy and modernized targets.
- `slice-119-appointment-room-overlap-readiness` runs the appointment room overlap suite with a test-level reset for both legacy and modernized targets.
- `slice-120-appointment-reminders-readiness` runs the appointment reminders suite with a run-level reset for both legacy and modernized targets.
- `legacy-readiness` runs database, HTTP, and UI with a run-level reset for read-only baseline confidence.
- `mutation-isolated` runs legacy workflow mutations and shared patient contact, patient demographics, patient registration, appointment, appointment recurrence exception-list edit, appointment series root update, appointment series root metadata, appointment monthly recurrence, appointment recurrence unit matrix, appointment days-of-week recurrence, appointment monthly repeat-on recurrence, appointment series recurrence update, appointment provider overlap, appointment patient overlap, appointment room overlap, encounter, encounter metadata, encounter billing linkage mutation, encounter diagnosis coding mutation, encounter fee-sheet entry mutation, encounter procedure-order entry mutation, encounter procedure-result entry mutation, encounter sign-off mutation, encounter co-signature mutation, encounter document upload mutation, encounter binary document upload mutation, encounter document sign-off mutation, encounter document denial mutation, encounter document metadata mutation, encounter document move mutation, encounter document content replacement mutation, encounter document archive/restore mutation, encounter document lifecycle timeline mutation, encounter external-link document mutation, clinical-list allergy, problem-list, medication-list, message, message assignment, message content, document, binary document, document sign-off, document external-link, document denial, document metadata, document archive restore, document content replacement, document binary content replacement, document replacement revision, document scanned attachment, insurance, prescription, immunization, billing, billing diagnosis, billing correction, billing modifier, payment posting, claim status, patient payment capture, collections follow-up task, procedure, procedure-result correction, procedure specimen metadata, procedure specimen detail, procedure order correction, procedure report correction, procedure report sign-off, admin-facility, admin-user, access-permission, and user-group-membership mutation suites with per-test resets for strongest mutation isolation.
- `full-parity` runs database, HTTP, UI, workflow, appointment recurrence-exceptions, appointment occurrence-cancel mutation, appointment occurrence-restore mutation, appointment occurrence-reschedule mutation, appointment recurrence exception-list edit mutation, appointment series root update mutation, appointment series root metadata mutation, appointment monthly recurrence mutation, appointment recurrence unit matrix mutation, appointment days-of-week recurrence mutation, appointment monthly repeat-on recurrence mutation, appointment series recurrence update mutation, appointment provider overlap mutation, appointment patient overlap mutation, appointment room overlap mutation, appointment reminders coverage, patient contact mutation, patient demographics mutation, patient registration mutation, appointment mutation, appointment reschedule mutation, appointment arrival mutation, encounter mutation, encounter metadata mutation, encounter billing linkage mutation, encounter diagnosis coding mutation, encounter fee-sheet entry mutation, encounter procedure-order entry mutation, encounter procedure-result entry mutation, encounter sign-off mutation, encounter co-signature mutation, encounter document upload mutation, encounter binary document upload mutation, encounter document sign-off mutation, encounter document denial mutation, encounter document metadata mutation, encounter document move mutation, encounter document content replacement mutation, encounter document archive/restore mutation, encounter document lifecycle timeline mutation, encounter external-link document mutation, clinical-list mutation, problem-list mutation, medication-list mutation, message mutation, message assignment mutation, message content mutation, document mutation, binary document mutation, document sign-off mutation, document external-link mutation, document denial mutation, document metadata mutation, document archive restore mutation, document content replacement mutation, document binary content replacement mutation, document replacement revision mutation, document scanned attachment mutation, insurance mutation, prescription mutation, immunization mutation, billing mutation, billing diagnosis mutation, billing correction mutation, billing modifier mutation, payment posting mutation, claim status mutation, patient payment capture mutation, collections follow-up task mutation, procedure mutation, procedure result correction mutation, procedure specimen metadata mutation, procedure specimen detail mutation, procedure order correction mutation, procedure report correction mutation, procedure report sign-off mutation, admin facility mutation, admin user mutation, access-permission mutation, user-group-membership mutation, access-control read-model coverage, pending/scheduled procedure-order coverage, reports export coverage, patient documents coverage, patient document content coverage, patient document preview coverage, patient document revision coverage, patient document scanned attachment coverage, insurance coverage, immunization history coverage, claim status coverage, payment posting coverage, account balance coverage, account aging coverage, account ledger coverage, account statement coverage, patient statement generation coverage, patient statement PDF export coverage, statement batch candidate coverage, statement batch package coverage, collections work queue coverage, encounter document attachment coverage, encounter billing linkage coverage, encounter claim linkage coverage, encounter procedure-order linkage coverage, and encounter diagnosis coding coverage as the target-neutral contract intended for future side-by-side legacy and modernized runs.

Every plan run records `selectionKind`, `selectionId`, `selectedSuites`, and plan metadata in `run.json`. This makes result files self-describing and lets the Workbench show whether evidence came from a suite or a named plan.

## Reset Strategy

Supported reset modes:

- `none` - run against the current target state.
- `run` - reset once before the selected run.
- `suite` - reset before each selected suite.
- `test` - reset before each individual test.

Default legacy parity runs should use `run`. This balances repeatability with speed. Mutation-heavy workflow tests can opt into `suite` or `test` where stronger isolation is worth the cost.

The Workbench workflow command uses `test` reset mode so each mutation test starts from a fresh gold seed. The suite also performs its own cleanup so it can run as part of the full `all` suite with a single run reset.

## Artifacts

Every parity run writes a durable run folder under:

```text
parity-tests/artifacts/runs/
```

Each run folder contains:

- `run.json`
- `playwright-report.json`
- `junit.xml`
- `html-report/`
- Playwright test artifacts such as traces, screenshots, and videos when applicable.

The runner also writes latest summary files by target and suite:

- `parity-tests/artifacts/latest-legacy-openemr-database.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-1-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-2-scheduling-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-3-encounters-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-4-clinical-lists-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-5-messaging-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-6-procedures-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-7-billing-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-8-admin-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-9-reports-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-10-contact-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-11-appointment-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-12-encounter-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-13-clinical-list-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-14-message-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-15-prescription-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-16-billing-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-17-procedure-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-18-admin-facility-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-19-admin-user-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-20-access-control-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-21-access-permission-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-22-user-group-membership-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-23-procedure-pending-orders-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-24-reports-export-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-25-documents-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-26-document-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-27-document-content-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-28-insurance-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-29-immunizations-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-30-immunization-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-31-problem-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-32-medication-list-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-33-binary-document-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-34-insurance-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-35-encounter-metadata-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-36-patient-demographics-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-37-patient-registration-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-38-document-signoff-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-39-document-external-link-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-40-document-denial-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-41-document-metadata-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-42-document-archive-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-43-document-content-replace-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-44-billing-diagnosis-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-45-billing-correction-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-46-billing-modifier-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-47-claim-status-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-48-payment-posting-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-49-account-balance-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-50-account-aging-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-51-account-ledger-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-52-account-statement-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-53-document-preview-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-54-document-revision-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-55-document-revision-replace-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-56-payment-posting-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-57-claim-status-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-58-patient-payment-capture-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-59-statement-generation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-60-statement-pdf-export-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-61-statement-batch-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-62-statement-batch-package-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-63-collections-work-queue-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-64-collections-follow-up-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-65-message-assignment-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-66-message-content-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-67-encounter-documents-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-68-encounter-billing-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-69-encounter-claims-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-70-encounter-procedures-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-71-encounter-diagnoses-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-72-encounter-billing-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-73-encounter-diagnosis-mutation-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-74-encounter-fee-sheet-entry-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-75-encounter-procedure-order-entry-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-76-encounter-procedure-result-entry-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-77-encounter-signoff-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-92-document-scanned-attachment-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-93-appointment-reschedule-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-94-appointment-arrival-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-95-appointment-checkout-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-96-appointment-noshow-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-97-appointment-category-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-98-appointment-pending-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-99-appointment-provider-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-100-appointment-facility-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-101-appointment-billing-location-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-102-appointment-comments-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-103-appointment-recurrence-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-104-appointment-series-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-105-appointment-recurrence-exceptions-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-106-appointment-occurrence-cancel-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-107-appointment-occurrence-restore-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-108-appointment-occurrence-reschedule-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-109-appointment-recurrence-exception-edit-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-110-appointment-series-root-update-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-111-appointment-series-root-metadata-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-112-appointment-monthly-recurrence-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-113-appointment-recurrence-unit-matrix-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-114-appointment-days-of-week-recurrence-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-115-appointment-monthly-repeat-on-recurrence-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-116-appointment-series-recurrence-update-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-117-appointment-provider-overlap-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-118-appointment-patient-overlap-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-119-appointment-room-overlap-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-120-appointment-reminders-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-121-encounter-cosignature-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-122-encounter-document-revision-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-123-encounter-document-revision-replace-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-126-encounter-document-scanned-attachment-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-127-encounter-document-binary-content-replace-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-128-document-binary-content-replace-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-129-procedure-result-correction-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-130-procedure-specimen-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-131-procedure-specimen-detail-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-132-procedure-order-correction-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-133-procedure-report-correction-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-134-procedure-report-signoff-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-135-procedure-report-review-queue-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-136-procedure-report-review-queue-filters-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-137-procedure-report-review-queue-provider-filters-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-slice-138-procedure-report-review-queue-lab-filters-readiness.json`
- `parity-tests/artifacts/latest-legacy-openemr-http.json`
- `parity-tests/artifacts/latest-legacy-openemr-ui.json`
- `parity-tests/artifacts/latest-legacy-openemr-workflow.json`
- `parity-tests/artifacts/latest-legacy-openemr-all.json`
- `parity-tests/artifacts/latest-legacy-openemr-plan-full-parity.json`
- `parity-tests/artifacts/latest-modernized-openemr-database.json`
- `parity-tests/artifacts/latest-modernized-openemr-http.json`
- `parity-tests/artifacts/latest-modernized-openemr-ui.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-1-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-2-scheduling-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-3-encounters-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-4-clinical-lists-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-5-messaging-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-6-procedures-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-7-billing-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-8-admin-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-9-reports-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-10-contact-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-11-appointment-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-12-encounter-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-13-clinical-list-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-14-message-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-15-prescription-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-16-billing-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-17-procedure-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-18-admin-facility-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-19-admin-user-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-20-access-control-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-21-access-permission-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-22-user-group-membership-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-23-procedure-pending-orders-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-24-reports-export-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-25-documents-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-26-document-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-27-document-content-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-28-insurance-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-29-immunizations-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-30-immunization-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-31-problem-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-32-medication-list-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-33-binary-document-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-34-insurance-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-35-encounter-metadata-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-36-patient-demographics-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-37-patient-registration-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-38-document-signoff-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-39-document-external-link-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-40-document-denial-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-41-document-metadata-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-42-document-archive-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-43-document-content-replace-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-44-billing-diagnosis-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-45-billing-correction-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-46-billing-modifier-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-47-claim-status-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-48-payment-posting-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-49-account-balance-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-50-account-aging-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-51-account-ledger-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-52-account-statement-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-53-document-preview-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-54-document-revision-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-55-document-revision-replace-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-56-payment-posting-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-57-claim-status-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-58-patient-payment-capture-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-59-statement-generation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-60-statement-pdf-export-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-61-statement-batch-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-62-statement-batch-package-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-63-collections-work-queue-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-64-collections-follow-up-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-65-message-assignment-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-66-message-content-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-67-encounter-documents-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-68-encounter-billing-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-69-encounter-claims-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-70-encounter-procedures-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-71-encounter-diagnoses-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-72-encounter-billing-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-73-encounter-diagnosis-mutation-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-74-encounter-fee-sheet-entry-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-75-encounter-procedure-order-entry-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-76-encounter-procedure-result-entry-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-77-encounter-signoff-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-92-document-scanned-attachment-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-93-appointment-reschedule-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-94-appointment-arrival-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-95-appointment-checkout-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-96-appointment-noshow-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-97-appointment-category-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-98-appointment-pending-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-99-appointment-provider-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-100-appointment-facility-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-101-appointment-billing-location-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-102-appointment-comments-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-103-appointment-recurrence-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-104-appointment-series-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-105-appointment-recurrence-exceptions-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-106-appointment-occurrence-cancel-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-107-appointment-occurrence-restore-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-108-appointment-occurrence-reschedule-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-109-appointment-recurrence-exception-edit-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-110-appointment-series-root-update-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-111-appointment-series-root-metadata-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-112-appointment-monthly-recurrence-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-113-appointment-recurrence-unit-matrix-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-114-appointment-days-of-week-recurrence-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-115-appointment-monthly-repeat-on-recurrence-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-116-appointment-series-recurrence-update-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-117-appointment-provider-overlap-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-118-appointment-patient-overlap-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-119-appointment-room-overlap-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-120-appointment-reminders-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-121-encounter-cosignature-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-122-encounter-document-revision-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-123-encounter-document-revision-replace-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-126-encounter-document-scanned-attachment-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-127-encounter-document-binary-content-replace-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-128-document-binary-content-replace-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-129-procedure-result-correction-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-130-procedure-specimen-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-131-procedure-specimen-detail-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-132-procedure-order-correction-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-133-procedure-report-correction-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-134-procedure-report-signoff-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-135-procedure-report-review-queue-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-136-procedure-report-review-queue-filters-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-137-procedure-report-review-queue-provider-filters-readiness.json`
- `parity-tests/artifacts/latest-modernized-openemr-plan-slice-138-procedure-report-review-queue-lab-filters-readiness.json`

Comparison artifacts are written under:

```text
parity-tests/artifacts/comparisons/
```

The comparison runner can compare two `run.json` or latest-summary files:

```powershell
npm run compare -- --left artifacts/latest-legacy-openemr-plan-full-parity.json --right artifacts/latest-modernized-openemr-plan-full-parity.json --plan full-parity
```

For the first modernized slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-1-readiness
```

For the second modernized scheduling slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-2-scheduling-readiness
```

For the third modernized encounters slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-3-encounters-readiness
```

For the fourth modernized clinical-lists slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-4-clinical-lists-readiness
```

For the fifth modernized messaging slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-5-messaging-readiness
```

For the sixth modernized procedures slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-6-procedures-readiness
```

For the seventh modernized fee-sheet billing slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-7-billing-readiness
```

For the eighth modernized administration directory slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-8-admin-readiness
```

For the ninth modernized operational reports slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-9-reports-readiness
```

For the tenth modernized patient contact mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-10-contact-mutation-readiness
```

For the eleventh modernized appointment mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-11-appointment-mutation-readiness
```

For the twelfth modernized encounter mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-12-encounter-mutation-readiness
```

For the thirteenth modernized clinical-list mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-13-clinical-list-mutation-readiness
```

For the fourteenth modernized patient-message mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-14-message-mutation-readiness
```

For the fifteenth modernized prescription mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-15-prescription-mutation-readiness
```

For the sixteenth modernized billing mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-16-billing-mutation-readiness
```

For the seventeenth modernized procedure mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-17-procedure-mutation-readiness
```

For the eighteenth modernized admin facility mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-18-admin-facility-mutation-readiness
```

For the nineteenth modernized admin user mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-19-admin-user-mutation-readiness
```

For the twentieth modernized access-control read-model slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-20-access-control-readiness
```

For the twenty-first modernized access-permission mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-21-access-permission-mutation-readiness
```

For the twenty-second modernized user group membership mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-22-user-group-membership-mutation-readiness
```

For the twenty-third modernized pending/scheduled procedure-order slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-23-procedure-pending-orders-readiness
```

For the twenty-fourth modernized reports export slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-24-reports-export-readiness
```

For the twenty-fifth modernized patient documents slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-25-documents-readiness
```

For the twenty-sixth modernized patient document mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-26-document-mutation-readiness
```

For the twenty-seventh modernized patient document content slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-27-document-content-readiness
```

For the twenty-eighth modernized patient insurance coverage slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-28-insurance-readiness
```

For the twenty-ninth modernized patient immunization history slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-29-immunizations-readiness
```

For the thirtieth modernized patient immunization mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-30-immunization-mutation-readiness
```

For the thirty-first modernized patient problem-list mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-31-problem-mutation-readiness
```

For the thirty-second modernized patient medication-list mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-32-medication-list-mutation-readiness
```

For the thirty-third modernized binary patient document mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-33-binary-document-mutation-readiness
```

For the thirty-fourth modernized patient insurance mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-34-insurance-mutation-readiness
```

For the thirty-fifth modernized encounter metadata mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-35-encounter-metadata-readiness
```

For the thirty-sixth modernized patient demographics mutation slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-36-patient-demographics-mutation-readiness
```

For the thirty-seventh modernized patient registration slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-37-patient-registration-readiness
```

For the thirty-eighth modernized patient document sign-off slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-38-document-signoff-readiness
```

For the thirty-ninth modernized patient document external-link slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-39-document-external-link-readiness
```

For the fortieth modernized patient document denial slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-40-document-denial-readiness
```

For the forty-first modernized patient document metadata slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-41-document-metadata-readiness
```

For the forty-second modernized patient document archive restore slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-42-document-archive-readiness
```

For the fifty-first modernized account ledger slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-51-account-ledger-readiness
```

For the fifty-second modernized account statement readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-52-account-statement-readiness
```

For the fifty-third modernized document preview readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-53-document-preview-readiness
```

For the fifty-fourth modernized document revision readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-54-document-revision-readiness
```

For the fifty-fifth modernized document replacement revision readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-55-document-revision-replace-readiness
```

For the fifty-sixth modernized payment posting mutation readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-56-payment-posting-mutation-readiness
```

For the fifty-seventh modernized claim status mutation readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-57-claim-status-mutation-readiness
```

For the fifty-eighth modernized patient payment capture readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-58-patient-payment-capture-readiness
```

For the fifty-ninth modernized patient statement generation readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-59-statement-generation-readiness
```

For the sixtieth modernized patient statement PDF export readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-60-statement-pdf-export-readiness
```

For the sixty-first modernized statement batch candidate readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-61-statement-batch-readiness
```

For the sixty-second modernized statement batch package export readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-62-statement-batch-package-readiness
```

For the sixty-third modernized collections work queue readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-63-collections-work-queue-readiness
```

For the sixty-fourth modernized collections follow-up task readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-64-collections-follow-up-readiness
```

For the sixty-fifth modernized patient-message assignment readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-65-message-assignment-readiness
```

For the sixty-sixth modernized patient-message content readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-66-message-content-readiness
```

For the one-hundred-fifty-sixth modernized patient-message reply readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-156-message-reply-readiness
```

For the sixty-seventh modernized encounter document attachment readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-67-encounter-documents-readiness
```

For the sixty-eighth modernized encounter billing linkage readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-68-encounter-billing-readiness
```

For the sixty-ninth modernized encounter claim linkage readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-69-encounter-claims-readiness
```

For the seventieth modernized encounter procedure order linkage readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-70-encounter-procedures-readiness
```

For the seventy-first modernized encounter diagnosis coding readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-71-encounter-diagnoses-readiness
```

For the seventy-second modernized encounter billing linkage mutation readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-72-encounter-billing-mutation-readiness
```

For the seventy-third modernized encounter diagnosis coding mutation readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-73-encounter-diagnosis-mutation-readiness
```

For the seventy-fourth modernized encounter fee-sheet entry readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-74-encounter-fee-sheet-entry-readiness
```

For the eightieth modernized encounter document sign-off readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-80-encounter-document-signoff-readiness
```

For the eighty-fifth modernized encounter document archive/restore readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-85-encounter-document-archive-readiness
```

For the eighty-seventh modernized encounter external-link document readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-87-encounter-document-external-link-readiness
```

For the ninety-second modernized patient scanned attachment readiness slice, compare the side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-92-document-scanned-attachment-readiness
```

For the ninety-third modernized appointment reschedule readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-93-appointment-reschedule-readiness
```

For the ninety-fourth modernized appointment arrival readiness slice, compare the current side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-94-appointment-arrival-readiness
```

The comparator is now active evidence for implemented slices. It should continue to be the Workbench and CI input for side-by-side parity status as new slices join the modernized target.

Artifacts are local runtime evidence and are intentionally ignored by Git.

## Workbench Integration

The Modernization Workbench reads test definitions from `modernization-workbench/config/apps.json`.

The legacy app currently exposes these test actions:

- Baseline smoke test.
- Native PHPUnit isolated suite.
- Native Jest JavaScript suite.
- Gold database contract.
- HTTP functional contract.
- Playwright UI contract.
- Workflow mutation contract.
- Legacy readiness plan.
- Isolated mutation plan.
- Slice 1 readiness plan.
- Slice 2 scheduling plan.
- Slice 3 encounters plan.
- Slice 4 clinical-lists plan.
- Slice 5 messaging plan.
- Slice 6 procedures plan.
- Slice 7 billing plan.
- Slice 8 admin plan.
- Slice 9 reports plan.
- Slice 10 contact mutation plan.
- Slice 11 appointment mutation plan.
- Slice 12 encounter mutation plan.
- Slice 13 clinical-list mutation plan.
- Slice 14 message mutation plan.
- Slice 15 prescription mutation plan.
- Slice 16 billing mutation plan.
- Slice 17 procedure mutation plan.
- Slice 129 procedure result correction plan.
- Slice 130 procedure specimen metadata plan.
- Slice 131 procedure specimen detail plan.
- Slice 132 procedure order correction plan.
- Slice 133 procedure report correction plan.
- Slice 134 procedure report sign-off plan.
- Slice 135 procedure report review queue plan.
- Slice 136 procedure report review queue filters plan.
- Slice 137 procedure report review queue provider filters plan.
- Slice 138 procedure report review queue lab filters plan.
- Slice 145 procedure order catalog plan.
- Slice 147 procedure order catalog lifecycle plan.
- Slice 148 procedure vendor compendium import plan.
- Slice 149 procedure order queue plan.
- Slice 151 procedure order transmit plan.
- Slice 153 procedure report bulk sign-off plan.
- Slice 154 procedure report reopen review plan.
- Slice 144 procedure lab provider address-book plan.
- Slice 142 procedure lab provider configuration plan.
- Slice 141 procedure lab provider lifecycle plan.
- Slice 140 procedure lab provider directory plan.
- Slice 139 procedure lab provider catalog plan.
- Slice 18 admin facility mutation plan.
- Slice 19 admin user mutation plan.
- Slice 20 access-control plan.
- Slice 21 access-permission mutation plan.
- Slice 22 user group membership mutation plan.
- Slice 23 pending procedure orders plan.
- Slice 24 reports export plan.
- Slice 25 patient documents plan.
- Slice 26 document mutation plan.
- Slice 27 document content plan.
- Slice 28 insurance plan.
- Slice 29 immunizations plan.
- Slice 30 immunization mutation plan.
- Slice 31 problem mutation plan.
- Slice 32 medication-list mutation plan.
- Slice 33 binary patient-document mutation plan.
- Slice 34 insurance mutation plan.
- Slice 35 encounter metadata plan.
- Slice 36 patient demographics mutation plan.
- Slice 37 patient registration plan.
- Slice 38 document sign-off plan.
- Slice 39 document external-link plan.
- Slice 40 document denial plan.
- Slice 41 document metadata plan.
- Slice 42 document archive restore plan.
- Slice 43 document content replacement plan.
- Slice 44 billing diagnosis plan.
- Slice 45 billing correction plan.
- Slice 46 billing modifier plan.
- Slice 47 claim status plan.
- Slice 48 payment posting plan.
- Slice 49 account balance plan.
- Slice 50 account aging plan.
- Slice 51 account ledger plan.
- Slice 52 account statement plan.
- Slice 53 document preview plan.
- Slice 54 document revision plan.
- Slice 55 document replacement revision plan.
- Slice 56 payment posting mutation plan.
- Slice 57 claim status mutation plan.
- Slice 58 patient payment capture plan.
- Slice 59 statement generation plan.
- Slice 60 statement PDF export plan.
- Slice 61 statement batch plan.
- Slice 62 statement batch package plan.
- Slice 63 collections work queue plan.
- Slice 64 collections follow-up task plan.
- Slice 65 patient-message assignment plan.
- Slice 66 patient-message content plan.
- Slice 156 patient-message reply plan.
- Slice 157 patient-message portal metadata plan.
- Slice 159 admin login readiness plan.
- Slice 160 admin login audit readiness plan.
- Slice 161 admin session readiness plan.
- Slice 162 admin audit protection readiness plan.
- Slice 163 admin directory protection readiness plan.
- Slice 164 operational reports protection readiness plan.
- Slice 166 clinical-list protection readiness plan.
- Slice 165 patient chart protection readiness plan.
- Slice 158 patient-message update metadata plan.
- Slice 67 encounter documents plan.
- Slice 68 encounter billing plan.
- Slice 69 encounter claims plan.
- Slice 70 encounter procedures plan.
- Slice 71 encounter diagnoses plan.
- Slice 72 encounter billing linkage mutation plan.
- Slice 73 encounter diagnosis coding mutation plan.
- Slice 74 encounter fee-sheet entry plan.
- Slice 75 encounter procedure-order entry plan.
- Slice 76 encounter procedure-result entry plan.
- Slice 77 encounter sign-off plan.
- Slice 78 encounter document upload plan.
- Slice 79 encounter binary document upload plan.
- Slice 80 encounter document sign-off plan.
- Slice 81 encounter document denial plan.
- Slice 82 encounter document metadata plan.
- Slice 83 encounter document move plan.
- Slice 84 encounter document content replacement plan.
- Slice 85 encounter document archive/restore plan.
- Slice 86 encounter document lifecycle timeline plan.
- Slice 87 encounter external-link document plan.
- Slice 88 patient image document preview plan.
- Slice 89 patient image document thumbnail plan.
- Slice 90 patient PDF document inline-preview plan.
- Slice 91 patient document lifecycle timeline plan.
- Slice 92 patient scanned attachment plan.
- Slice 93 appointment reschedule plan.
- Slice 94 appointment arrival plan.
- Slice 95 appointment check-out plan.
- Slice 96 appointment no-show plan.
- Slice 97 appointment category plan.
- Slice 98 appointment pending-status plan.
- Slice 99 appointment provider reassignment plan.
- Slice 100 appointment facility reassignment plan.
- Slice 101 appointment billing-location reassignment plan.
- Full parity plan.
- Full legacy parity suite.

The modernized app currently exposes these test actions:

- Modernized smoke test for API health, anchor patient search, anchor chart summary, anchor patient portal account readiness, anchor patient portal reset lifecycle, anchor patient portal access lifecycle, patient demographics mutation, patient registration lifecycle, insurance coverage, insurance mutation, anchor immunization history, anchor appointment search/detail, anchor encounter search/detail, encounter document attachment readiness, encounter document revision readiness, encounter document upload lifecycle, encounter binary document upload lifecycle, encounter document metadata lifecycle, encounter document move lifecycle, encounter document content replacement lifecycle, encounter document archive restore lifecycle, encounter document lifecycle timeline, encounter external-link document lifecycle, encounter document sign-off lifecycle, encounter document denial lifecycle, encounter billing linkage readiness, encounter billing linkage mutation visibility, encounter claim linkage readiness, encounter procedure order linkage readiness, encounter diagnosis coding readiness, encounter diagnosis coding mutation visibility, encounter sign-off lifecycle, encounter co-signature lifecycle, encounter metadata mutation, clinical lists, patient messages, patient documents, patient document content retrieval, patient document preview readiness, patient image document preview lifecycle, patient image document thumbnail readiness, patient PDF inline preview readiness, patient document lifecycle timeline, patient scanned attachment readiness, patient document revision readiness, patient document replacement revision lifecycle, patient binary document content replacement lifecycle, procedure result correction lifecycle, procedure report specimen metadata, procedure specimen detail lifecycle, procedure order correction lifecycle, procedure report correction lifecycle, procedure report sign-off lifecycle, procedure report review queue lifecycle, procedure report review queue filter lifecycle, procedure report review queue provider filter lifecycle, procedure report review queue lab filter lifecycle, procedure lab provider lifecycle, procedure lab provider configuration, binary patient-document mutation, patient document sign-off, patient document denial, patient document metadata refiling, patient document archive restore, patient document content replacement, external-link patient-document mutation, procedure results, pending/scheduled procedure orders, fee-sheet billing, claim status summary, claim status mutation, payment posting summary, payment posting mutation, patient payment capture, account balance summary, account aging summary, account ledger summary, account statement readiness, patient statement generation, patient statement PDF export, statement batch candidates, statement batch package export, collections work queue, collections follow-up task lifecycle, administration directory, administration access control, operational reports, operational reports CSV export, appointment mutation, appointment reschedule mutation, appointment arrival mutation, appointment check-out mutation, encounter mutation, clinical-list allergy mutation, problem-list mutation, medication-list mutation, patient-message mutation, patient-message content update, patient-message reply update, patient-message assignment update, patient-document mutation, prescription mutation, immunization mutation, billing mutation, billing diagnosis mutation, billing correction mutation, billing modifier mutation, procedure mutation, procedure result correction mutation, procedure specimen metadata mutation, procedure specimen detail mutation, procedure order correction mutation, procedure report correction mutation, procedure lab provider configuration mutation, admin facility mutation, admin user mutation, access-permission mutation, and user group membership mutation.
- Slice 144 extends the shared mutation plans with procedure lab provider address-book linkage parity for temporary order-service organizations, derived provider names, linked organization/type rendering, and cleanup behavior. Slice 142 remains available for procedure lab provider configuration parity for protocol, usage/direction, sender/receiver IDs, remote host, credentials, paths, notes, rendering, and cleanup behavior. Slice 141 remains available for procedure lab provider lifecycle parity for temporary create/deactivate/include-inactive/delete behavior, Slice 140 remains available for read-only provider directory parity over the permanent five-provider catalog, Slice 139 remains available for permanent lab-provider catalog ownership coverage, Slice 138 remains available for lab-filter coverage, Slice 137 remains available for provider-filter coverage, Slice 136 remains available for patient/date-filter coverage, and Slice 135 remains available for unreviewed/reviewed queue transition coverage.
- Slice 1 readiness plan for side-by-side patient search/chart summary parity.
- Slice 2 scheduling plan for side-by-side future appointment detail parity.
- Slice 3 encounters plan for side-by-side SOAP and vitals detail parity.
- Slice 4 clinical-lists plan for side-by-side problem, allergy, medication-list, and prescription parity.
- Slice 5 messaging plan for side-by-side portal-enabled patient message parity.
- Slice 6 procedures plan for side-by-side completed lab result parity.
- Slice 7 billing plan for side-by-side fee-sheet billing parity.
- Slice 8 admin plan for side-by-side users and facilities parity.
- Slice 9 reports plan for side-by-side operational-reporting parity.
- Slice 10 contact mutation plan for side-by-side patient contact update parity.
- Slice 11 appointment mutation plan for side-by-side future appointment lifecycle parity.
- Slice 12 encounter mutation plan for side-by-side encounter, vitals, and SOAP lifecycle parity.
- Slice 13 clinical-list mutation plan for side-by-side allergy lifecycle parity.
- Slice 14 message mutation plan for side-by-side patient-message lifecycle parity.
- Slice 15 prescription mutation plan for side-by-side prescription lifecycle parity.
- Slice 16 billing mutation plan for side-by-side fee-sheet CPT lifecycle parity.
- Slice 17 procedure mutation plan for side-by-side lab order/report/result lifecycle parity.
- Slice 129 procedure result correction plan for side-by-side corrected lab result parity.
- Slice 130 procedure specimen metadata plan for side-by-side report collected-date and specimen-number parity.
- Slice 131 procedure specimen detail plan for side-by-side order-level specimen identifier, accession, collection, location, volume, and condition parity.
- Slice 132 procedure order correction plan for side-by-side order date, code, name, type, diagnosis, priority, status, instructions, and post-correction result parity.
- Slice 133 procedure report correction plan for side-by-side collected date, report date, specimen number, report status, review status, notes, and linked result parity.
- Slice 134 procedure report sign-off plan for side-by-side reviewed status, reviewer, signed timestamp, report metadata, linked result preservation, and cleanup parity.
- Slice 135 procedure report review queue plan for side-by-side unreviewed/reviewed queue membership, queue counts, report metadata, reviewer transition, and cleanup parity.
- Slice 136 procedure report review queue filters plan for side-by-side patient/date-filtered queue inclusion, outside-date exclusion, reviewed queue transition, and cleanup parity.
- Slice 137 procedure report review queue provider filters plan for side-by-side provider-filtered queue inclusion, outside-provider exclusion, reviewed queue transition, and cleanup parity.
- Slice 138 procedure report review queue lab filters plan for side-by-side lab-filtered queue inclusion, outside-lab exclusion, reviewed queue transition, and cleanup parity.
- Slice 145 procedure order catalog plan for side-by-side permanent catalog root, provider groups, orderable panel rows, legacy `procedure_type` rendering, and modernized catalog API/UI parity.
  - Slice 147 procedure order catalog lifecycle plan for side-by-side temporary catalog item create, update, active-state, browser rendering, delete, and cleanup parity.
  - Slice 148 procedure vendor compendium import plan for side-by-side PathGroup-style order/result CSV import, legacy-compatible deactivate/reactivate semantics, browser rendering, and cleanup parity.
  - Slice 149 procedure order queue plan for side-by-side ready-to-send/reportless lab order queue membership, reported queue transition, browser rendering, and cleanup parity.
  - Slice 151 procedure order transmit plan for side-by-side ready-to-send/reportless lab order transmit marking, sent-awaiting-results queue membership, transmitted timestamp rendering, browser rendering, and cleanup parity.
  - Slice 153 procedure report bulk sign-off plan for side-by-side two-report review queue bulk sign-off, reviewed queue membership, browser rendering, and cleanup parity.
  - Slice 154 procedure report reopen review plan for side-by-side signed-report reopen, received/unreviewed queue membership, browser rendering, and cleanup parity.
- Slice 144 procedure lab provider address-book plan for side-by-side order-service address-book organization linkage, derived provider name rendering, update-to-second-organization behavior, and cleanup parity.
- Slice 142 procedure lab provider configuration plan for side-by-side provider protocol, usage, direction, sender/receiver IDs, remote host, credentials, paths, notes, rendering, and cleanup parity.
- Slice 141 procedure lab provider lifecycle plan for side-by-side temporary provider create/deactivate/include-inactive/delete parity.
- Slice 140 procedure lab provider directory plan for side-by-side provider list, active filtering, NPI, and balanced order/report/future-order count parity.
- Slice 139 procedure lab provider catalog plan for side-by-side seeded lab ownership, outside-lab exclusion, and reviewed queue rendering parity.
- Slice 18 admin facility mutation plan for side-by-side facility lifecycle parity.
- Slice 19 admin user mutation plan for side-by-side user lifecycle parity.
- Slice 20 access-control plan for side-by-side default ACL group and permission parity.
- Slice 21 access-permission mutation plan for side-by-side ACL assignment parity.
- Slice 22 user group membership mutation plan for side-by-side ACL membership parity.
- Slice 23 pending procedure orders plan for side-by-side scheduled, reportless lab-order parity.
- Slice 24 reports export plan for side-by-side operational CSV export parity.
- Slice 25 patient documents plan for side-by-side seeded patient document parity.
- Slice 26 document mutation plan for side-by-side patient document lifecycle parity.
- Slice 27 document content plan for side-by-side full document content parity.
- Slice 28 insurance plan for side-by-side patient coverage parity.
- Slice 29 immunizations plan for side-by-side pediatric vaccine-history parity.
- Slice 30 immunization mutation plan for side-by-side vaccine create/render/entered-in-error/delete parity.
- Slice 31 problem mutation plan for side-by-side problem-list create/render/deactivate/delete parity.
- Slice 32 medication-list mutation plan for side-by-side medication-list create/render/deactivate/delete parity.
- Slice 33 binary patient-document mutation plan for side-by-side PDF-style document create/render/download/archive/delete parity.
- Slice 34 insurance mutation plan for side-by-side patient coverage create/render/update/delete parity.
- Slice 35 encounter metadata plan for side-by-side encounter sensitivity/referral/external-ID/POS create/render/update/delete parity.
- Slice 36 patient demographics mutation plan for side-by-side identity, DOB, address, marital-status, and occupation update/render/restore parity.
- Slice 37 patient registration plan for side-by-side temporary patient create/render/delete parity.
- Slice 38 document sign-off plan for side-by-side patient document approve/render/archive/delete parity.
- Slice 39 document external-link plan for side-by-side patient document web-url create/render/archive/delete parity.
- Slice 40 document denial plan for side-by-side patient document deny/render/archive/delete parity.
- Slice 41 document metadata plan for side-by-side patient document refile/render/archive/delete parity.
- Slice 42 document archive restore plan for side-by-side patient document archive/restore/render/delete parity.
- Slice 43 document content replacement plan for side-by-side patient document replace/render/archive/delete parity.
- Slice 44 billing diagnosis plan for side-by-side fee-sheet ICD10 create/render/deactivate/delete parity.
- Slice 45 billing correction plan for side-by-side fee-sheet CPT create/correct/render/deactivate/delete parity.
- Slice 46 billing modifier plan for side-by-side fee-sheet CPT create/modify/render/deactivate/delete parity.
- Slice 47 claim status plan for side-by-side read-only claim status parity.
- Slice 48 payment posting plan for side-by-side read-only AR payment posting parity.
- Slice 49 account balance plan for side-by-side read-only charge/payment/adjustment/balance parity.
- Slice 50 account aging plan for side-by-side read-only AR aging bucket parity.
- Slice 51 account ledger plan for side-by-side read-only chronological running-balance parity.
- Slice 52 account statement plan for side-by-side read-only statement readiness parity.
- Slice 53 document preview plan for side-by-side read-only document preview readiness parity.
- Slice 54 document revision plan for side-by-side read-only document revision readiness parity.
- Slice 55 document replacement revision plan for side-by-side document content replacement revision parity.
- Slice 56 payment posting mutation plan for side-by-side payment posting create/render/void/delete parity.
- Slice 57 claim status mutation plan for side-by-side claim create/generate/clear/delete parity.
- Slice 58 patient payment capture plan for side-by-side patient payment create/render/void/delete parity.
- Slice 59 statement generation plan for side-by-side printable patient statement generation parity.
- Slice 60 statement PDF export plan for side-by-side deterministic patient statement PDF export parity.
- Slice 61 statement batch plan for side-by-side ranked statement candidate parity.
- Slice 62 statement batch package plan for side-by-side deterministic package export parity.
- Slice 63 collections work queue plan for side-by-side past-due account queue parity.
- Slice 64 collections follow-up task plan for side-by-side pnotes-compatible task lifecycle parity.
- Slice 65 patient-message assignment plan for side-by-side pnotes/message reassignment parity.
- Slice 66 patient-message content plan for side-by-side pnotes/message title and body edit parity.
- Slice 156 patient-message reply plan for side-by-side pnotes/message reply append parity.
- Slice 157 patient-message portal metadata plan for side-by-side seeded pnotes portal relation and encryption metadata parity.
- Slice 159 admin login readiness plan for side-by-side successful admin credential and invalid-password rejection parity.
- Slice 160 admin login audit readiness plan for side-by-side successful and failed login audit row parity.
- Slice 161 admin session readiness plan for side-by-side login-created session and logout invalidation parity.
- Slice 162 admin audit protection readiness plan for side-by-side protected audit log access parity.
- Slice 163 admin directory protection readiness plan for side-by-side protected administration directory access parity.
- Slice 164 operational reports protection readiness plan for side-by-side protected operational report access parity.
- Slice 166 clinical-list protection readiness plan for side-by-side protected clinical-list access parity.
- Slice 165 patient chart protection readiness plan for side-by-side protected patient chart access parity.
- Slice 158 patient-message update metadata plan for side-by-side pnotes/message update_by and update_date parity.
- Slice 67 encounter documents plan for side-by-side encounter-attached document visibility parity.
- Slice 68 encounter billing plan for side-by-side encounter fee-sheet linkage parity.
- Slice 69 encounter claims plan for side-by-side encounter claim-status linkage parity.
- Slice 70 encounter procedures plan for side-by-side encounter procedure-order/result linkage parity.
- Slice 71 encounter diagnoses plan for side-by-side encounter diagnosis-coding parity.
- Slice 72 encounter billing linkage mutation plan for side-by-side temporary fee-sheet create/render/deactivate/delete parity.
- Slice 73 encounter diagnosis coding mutation plan for side-by-side temporary ICD10 fee-sheet diagnosis create/render/deactivate/delete parity.
- Slice 74 encounter fee-sheet entry plan for side-by-side temporary CPT/ICD encounter-workspace create/render/deactivate/delete parity.
- Slice 75 encounter procedure-order entry plan for side-by-side temporary pending lab-order encounter-workspace create/render/delete parity.
- Slice 76 encounter procedure-result entry plan for side-by-side temporary lab order/report/result encounter-workspace create/render/delete parity.
- Slice 77 encounter sign-off plan for side-by-side temporary encounter attestation create/render/delete parity.
- Slice 78 encounter document upload plan for side-by-side temporary encounter-scoped text document create/render/delete parity.
- Slice 79 encounter binary document upload plan for side-by-side temporary encounter-scoped PDF/binary document create/render/download/delete parity.
- Slice 80 encounter document sign-off plan for side-by-side temporary encounter-scoped document create/sign/render/delete parity.
- Slice 81 encounter document denial plan for side-by-side temporary encounter-scoped document create/deny/render/delete parity.
- Slice 82 encounter document metadata plan for side-by-side temporary encounter-scoped document create/refile/render/delete parity.
- Slice 83 encounter document move plan for side-by-side temporary encounter-scoped document create/move/render/delete parity.
- Slice 84 encounter document content replacement plan for side-by-side temporary encounter-scoped document create/replace/render/delete parity.
- Slice 85 encounter document archive/restore plan for side-by-side temporary encounter-scoped document create/archive/hide/restore/render/delete parity.
- Slice 86 encounter document lifecycle timeline plan for side-by-side temporary encounter-scoped document create/sign/archive/restore/render/delete lifecycle parity.
- Slice 87 encounter external-link document plan for side-by-side temporary encounter-scoped web URL document create/render/archive/delete lifecycle parity.
- Slice 88 patient image document preview plan for side-by-side temporary patient image document create/render/inline-preview/download/archive/delete lifecycle parity.
- Slice 89 patient image document thumbnail plan for side-by-side temporary patient image document create/render/thumbnail/archive/delete lifecycle parity.
- Slice 90 patient PDF document inline-preview plan for side-by-side temporary patient PDF document create/render/inline-preview/download/archive/delete lifecycle parity.
- Slice 91 patient document lifecycle timeline plan for side-by-side temporary patient document create/sign/archive/restore/render/delete lifecycle parity.
- Slice 92 patient scanned attachment plan for side-by-side temporary scanned PDF document create/render/scan-readiness/archive/delete parity.
- Slice 93 appointment reschedule plan for side-by-side temporary future appointment create/update/render/delete parity.
- Slice 94 appointment arrival plan for side-by-side temporary future appointment create/mark-arrived/render/delete parity.
- Slice 95 appointment check-out plan for side-by-side temporary future appointment create/mark-arrived/check-out/render/delete parity.
- Slice 96 appointment no-show plan for side-by-side temporary future appointment create/mark-no-show/render/delete parity.
- Slice 97 appointment category plan for side-by-side temporary future appointment create/render/category-update/delete parity.
- Slice 98 appointment pending-status plan for side-by-side temporary future appointment create/status-update/render/delete parity.
- Slice 99 appointment provider reassignment plan for side-by-side temporary future appointment create/provider-update/render/delete parity.
- Slice 100 appointment facility reassignment plan for side-by-side temporary future appointment create/facility-update/render/delete parity.
- Slice 101 appointment billing-location reassignment plan for side-by-side temporary future appointment create/billing-location-update/render/delete parity.
- Slice 102 appointment comments plan for side-by-side temporary future appointment create/comments-update/render/delete parity.
- Slice 103 appointment recurrence metadata plan for side-by-side temporary future appointment create/recurrence-update/render/delete parity.
- Slice 104 appointment recurring-series plan for side-by-side seeded recurrence expansion and modernized generated-occurrence rendering parity.
- Slice 105 appointment recurrence-exceptions plan for side-by-side seeded `exdate` skipping and modernized skipped-date rendering parity.
- Slice 106 appointment occurrence-cancel plan for side-by-side generated occurrence skip behavior, restored seeded exception cleanup, and modernized `Skip occurrence` rendering parity.
- Slice 107 appointment occurrence-restore plan for side-by-side skipped generated occurrence restoration, restored seeded exception cleanup, and modernized `Restore occurrence` rendering parity.
- Slice 108 appointment occurrence-reschedule plan for side-by-side generated occurrence movement into a standalone appointment, restored seeded exception cleanup, and modernized `Reschedule occurrence` rendering parity.
- Slice 109 appointment recurrence exception-edit plan for side-by-side skipped-date list editing, restored seeded exception cleanup, and modernized `Skipped dates` rendering parity.
- Slice 110 appointment series root update plan for side-by-side recurring root title/time propagation, restored seeded root cleanup, and modernized recurring-root edit rendering parity.
- Slice 111 appointment series root metadata plan for side-by-side recurring root provider/facility/category/status/room/comment propagation, restored seeded root cleanup, and modernized recurring-root metadata edit rendering parity.
- Slice 112 appointment monthly recurrence plan for side-by-side temporary monthly recurring appointment create/update/expand/render/delete parity.
- Slice 113 appointment recurrence unit matrix plan for side-by-side temporary daily, workday, and yearly recurring appointment create/expand/render/delete parity.
- Slice 114 appointment days-of-week recurrence plan for side-by-side temporary Monday/Wednesday/Friday recurring appointment create/expand/render/delete parity.
- Slice 115 appointment monthly repeat-on recurrence plan for side-by-side temporary second-Tuesday and last-Friday monthly recurring appointment create/expand/render/delete parity.
- Slice 116 appointment series recurrence update plan for side-by-side seeded recurring-root cadence/end-date edit/render/restore parity.
- Slice 117 appointment provider overlap plan for side-by-side temporary same-provider overlapping appointment create/render/delete parity.
- Slice 118 appointment patient overlap plan for side-by-side temporary same-patient overlapping appointment create/render/delete parity.
- Slice 119 appointment room overlap plan for side-by-side temporary same-room overlapping appointment create/render/delete parity.
- Slice 120 appointment reminders plan for side-by-side seeded future appointment reminder readiness parity.
- Slice 575 appointment availability validation plan for side-by-side provider/facility bookable-window and active provider/room conflict validation parity without creating a second appointment.
- Slice 576 appointment waitlist plan for side-by-side pending portal request projection, staff waitlist rendering, promotion to OpenEMR pending status, and cleanup of the temporary request plus provider reminder.
- Slice 577 appointment reminder dispatch plan for side-by-side due-reminder dispatch expectation, modernized local queue/audit persistence, Calendar dispatch rendering, and dispatch-history retrieval.
- Slice 578 medication duplicate detection plan for side-by-side active medication-list duplicate grouping by normalized title, modernized Lists rendering, and cleanup of temporary duplicate rows.
- Slice 579 prescription refill plan for side-by-side active prescription refill authorization, modified-date/note evidence, modernized Lists refill action rendering, and cleanup of the temporary prescription row.
- Slice 580 patient portal prescription refill request plan for side-by-side patient-originated active-prescription refill requests, secure-message mailbox evidence, modernized Portal `Request refill` rendering, and cleanup of temporary prescription and mailbox rows.
- Slice 581 prescription refill request approval plan for side-by-side staff queue projection of portal refill requests, approval-driven prescription refill increment, mailbox `Done` status evidence, modernized Lists `Refill Requests` rendering, and cleanup of temporary prescription and mailbox rows.
- Slice 582 prescription pharmacy routing plan for side-by-side selected-pharmacy routing, deterministic local eRx transmit evidence, modernized Lists `Route` rendering, and cleanup of the temporary prescription plus legacy-only pharmacy fixture.
- Slice 583 prescription controlled-substance plan for side-by-side controlled-prescription pharmacy-route blocking, no eRx transmit evidence stamping, modernized Lists EPCS-review warning rendering, and cleanup of the temporary prescription plus legacy-only pharmacy fixture.
- Slice 584 prescription audit-history plan for side-by-side prescription create/refill/route audit event projection, modernized Lists history rendering, and cleanup of the temporary prescription plus legacy-only pharmacy fixture.
- Slice 585 prescription structured-dose plan for side-by-side prescription dose amount/unit, frequency, and duration evidence, modernized Lists structured-dose rendering, and cleanup of the temporary prescription.
- Slice 586 medication vocabulary plan for side-by-side focused RxNorm-style medication catalog lookup, modernized Lists vocabulary result rendering, prescription-form selection behavior, and no patient-specific mutation.
- Slice 587 prescription diagnosis interaction plan for side-by-side active prescription diagnosis matching against active problem-list diagnoses, modernized Lists matched/unmatched rendering, and cleanup of the temporary problem plus prescriptions.
- Slice 588 medication reconciliation plan for side-by-side active medication-list and active prescription matching by normalized medication name, modernized Lists matched/medication-list-only/prescription-only rendering, and cleanup of the temporary medication-list and prescription rows.
- Slice 589 appointment conflict enforcement plan for side-by-side provider/room conflict source facts, modernized strict-create HTTP 409 conflict evidence, Calendar `Block conflicts` rendering, and cleanup of the temporary blocker appointment.
- Slice 590 document OCR queue plan for side-by-side scanned pending-OCR document source facts, modernized protected OCR queue API evidence, Documents OCR Queue rendering, and cleanup of the temporary scanned PDF document.
- Slice 591 document OCR completion plan for side-by-side scanned pending-OCR source facts, modernized OCR completion API/UI evidence, queue removal, and cleanup of the temporary scanned PDF document.
- Slice 592 document PDF thumbnail plan for side-by-side PDF document source facts, modernized generated SVG thumbnail API evidence, Documents card thumbnail rendering, and cleanup of the temporary PDF document.
- Slice 593 document routing queue plan for side-by-side pending-review document source facts, modernized protected routing queue API evidence, Documents Routing Queue rendering, and cleanup of the temporary routed PDF document.
- Slice 594 document retention policy plan for side-by-side active document source facts, modernized protected retention policy API evidence, Documents Retention Policy rendering, and cleanup of the temporary retained PDF document.
- Slice 595 document retention disposition plan for side-by-side eligible document source facts, controlled archive/disposition behavior, modernized protected retention disposition API/UI evidence, and cleanup of the temporary disposed PDF document.
- Slice 596 document scanner-capture plan for side-by-side scanner-created document source facts, modernized protected scanner-capture API evidence, Documents scanner intake/card/viewer/OCR Queue rendering, and cleanup of the temporary captured PDF document.
- Slice 597 document version-history plan for side-by-side patient document replacement source facts, modernized current-plus-prior version-history API/UI evidence, legacy overwrite-baseline evidence, and cleanup of the temporary text document.
- Slice 167 appointment protection plan for side-by-side scheduler access protection parity, unauthenticated modernized appointment API `401` evidence, authenticated appointment search/detail retrieval, and Calendar sign-in gating.
- Slice 168 encounter protection plan for side-by-side protected encounter access parity, unauthenticated modernized encounter API `401` evidence, authenticated encounter search/detail retrieval, and Encounters sign-in gating.
- Slice 169 document protection plan for side-by-side protected patient document access parity, unauthenticated modernized document list/content/create `401` evidence, authenticated document retrieval, and Documents sign-in gating.
- Slice 170 message protection plan for side-by-side protected patient message access parity, unauthenticated modernized message list/create `401` evidence, authenticated message retrieval, and Messages sign-in gating.
- Slice 121 encounter co-signature plan for side-by-side temporary two-signer locked encounter signature parity.
- Slice 122 encounter document revision plan for side-by-side seeded encounter-attachment current-version parity.
- Slice 123 encounter document replacement revision plan for side-by-side temporary encounter-attachment current-revision mutation parity.
- Slice 126 encounter scanned attachment plan for side-by-side temporary encounter-scoped scanned PDF readiness parity.

The Workbench runs only allowlisted commands. It displays latest evidence per test card and stores lifecycle/test action events in `modernization-workbench/artifacts/events.json`.

The Test Runs page also includes a custom parity run builder for each managed app. The Workbench API exposes `parity-tests/test-manifest.json`, and the UI lets an operator choose suite or plan, a specific suite or plan id, reset mode, headed mode, and an optional Playwright grep filter. The backend validates those choices against the manifest before it constructs the existing `scripts/Run-OpenEmrParityTests.ps1` command. This gives the project a real test manager for targeted runs while keeping command execution local and constrained.

The Workbench Test Runs page also renders recent side-by-side comparison artifacts. Its `/api/parity-comparisons` route reads bounded `comparison.json` summaries from `parity-tests/artifacts/comparisons/`, normalizes left/right run metadata, exposes difference counts and previews, and leaves command execution to the existing runner/compare scripts. Slice 124 adds expandable card drill-ins so operators can review legacy/modernized run artifact paths, comparison JSON paths, artifact directories, selected suites, full difference detail, and matched-state confirmation from the Workbench without manually opening the artifact directory. Slice 125 adds safe artifact links through `/api/artifacts/file`, restricted to `parity-tests/artifacts/`, `legacy-openemr/artifacts/`, `modernized-openemr/artifacts/`, and `modernization-workbench/artifacts/`, so run and comparison JSON evidence can be opened directly from drill-ins while non-artifact paths are rejected. Slice 155 enriches comparison sides from their run summary artifacts and exposes direct drill-in links to the run JSON, Playwright JSON, JUnit XML, and HTML report only when those files exist under the same safe artifact roots. Slice 259 adds `/api/parity-reliability`, a lighter summary endpoint that scans bounded run and comparison JSON artifacts without loading screenshots or Playwright probes, so Test Runs can show rolling pass rates, match rates, durations, pass/fail strips, and selection-level summaries. Slice 260 extends normalized probe details with safe text-like attachment previews and optimizes the comparison route so it sorts/slices comparison directories before deep enrichment. The workflow payload-attachment stream now includes Slice 207 patient portal authentication evidence, Slice 208 patient portal session evidence, Slice 209 patient portal home evidence, Slice 210 patient portal secure-message inbox evidence, Slice 211 patient portal secure-message compose evidence, Slice 212 patient portal secure-message reply evidence, Slice 213 patient portal secure-message thread evidence, Slice 214 patient portal secure-message archive evidence, Slice 215 patient portal secure-message read-status evidence, Slice 216 patient portal secure-message batch archive evidence, Slice 217 patient portal secure-message All-folder evidence, Slice 218 patient portal document list/download evidence, Slice 219 patient portal appointment list evidence, Slice 220 patient portal appointment request evidence, and Slice 221 patient portal appointment request-options evidence. Slice 261 adds path-backed JSON database probe payload attachments to the gold-seed database contract suite for both targets. Slice 262 extends path-backed database payload attachments into the Slice 1 patient search/chart summary workflow suite. Slice 263 extends path-backed database payload attachments into the Slice 2 scheduling workflow suite. Slice 264 extends path-backed database payload attachments into the Slice 3 encounter clinical detail workflow suite. Slice 265 extends path-backed database payload attachments into the Slice 4 clinical lists workflow suite. Slice 266 extends path-backed database payload attachments into the Slice 5 messaging workflow suite. Slice 267 extends path-backed database payload attachments into the Slice 6 procedure results workflow suite. Slice 268 extends path-backed database payload attachments into the Slice 7 fee-sheet billing workflow suite. Slice 269 extends path-backed database payload attachments into the Slice 8 administration directory workflow suite. Slice 270 extends path-backed database payload attachments into the Slice 9 operational reports workflow suite. Slice 271 extends path-backed database payload attachments into the Slice 10 patient contact mutation workflow suite. Slice 272 extends path-backed database payload attachments into the Slice 11 appointment mutation workflow suite. Slice 273 extends path-backed database payload attachments into the Slice 12 encounter mutation workflow suite. Slice 274 extends path-backed database payload attachments into the Slice 13 clinical-list allergy mutation workflow suite. Slice 275 extends path-backed database payload attachments into the Slice 14 patient-message mutation workflow suite. Slice 276 extends path-backed database payload attachments into the Slice 15 prescription mutation workflow suite. Slice 277 extends path-backed database payload attachments into the Slice 16 billing mutation workflow suite. Slice 278 extends path-backed database payload attachments into the Slice 17 procedure mutation workflow suite. Slice 279 extends path-backed database payload attachments into the Slice 18 administration facility mutation workflow suite. Slice 280 extends path-backed database payload attachments into the Slice 19 administration user mutation workflow suite. Slice 281 extends path-backed database payload attachments into the Slice 20 administration access-control read-model suite. Slice 282 extends path-backed database payload attachments into the Slice 21 administration access-permission mutation suite. Slice 283 extends path-backed database payload attachments into the Slice 22 administration user group membership mutation suite. Slice 284 extends path-backed database payload attachments into the Slice 23 pending scheduled procedure-order suite. Slice 285 extends path-backed database payload attachments into the Slice 24 operational reports CSV export suite. Slice 286 extends path-backed database payload attachments into the Slice 25 patient documents suite. Slice 287 extends path-backed database payload attachments into the Slice 26 patient document mutation suite. Slice 288 extends path-backed database payload attachments into the Slice 27 patient document content suite. Slice 289 extends path-backed database payload attachments into the Slice 28 patient insurance coverage suite. Slice 290 extends path-backed database payload attachments into the Slice 29 patient immunization history suite. Slice 291 extends path-backed database payload attachments into the Slice 30 patient immunization mutation suite. Slice 292 extends path-backed database payload attachments into the Slice 31 patient problem-list mutation suite. Slice 293 extends path-backed database payload attachments into the Slice 32 patient medication-list mutation suite. Slice 294 extends path-backed database payload attachments into the Slice 33 binary patient-document mutation suite. Slice 295 extends path-backed database payload attachments into the Slice 34 patient insurance mutation suite. Slice 296 extends path-backed database payload attachments into the Slice 35 encounter metadata mutation suite. Slice 297 extends path-backed database payload attachments into the Slice 36 patient demographics mutation suite. Slice 298 extends path-backed database payload attachments into the Slice 37 patient registration lifecycle suite. Slice 299 extends path-backed database payload attachments into the Slice 38 patient document sign-off suite. Slice 300 extends path-backed database payload attachments into the Slice 39 patient document external-link suite. Slice 301 extends path-backed database payload attachments into the Slice 40 patient document denial suite. Slice 302 extends path-backed database payload attachments into the Slice 41 patient document metadata suite. Slice 303 extends path-backed database payload attachments into the Slice 42 patient document archive/restore suite. Slice 304 extends path-backed database payload attachments into the Slice 43 patient document content replacement suite. Slice 305 extends path-backed database payload attachments into the Slice 44 billing diagnosis coding suite. Slice 306 extends path-backed database payload attachments into the Slice 45 billing correction suite. Slice 307 extends path-backed database payload attachments into the Slice 46 billing modifier suite. Slice 308 extends path-backed database payload attachments into the Slice 47 claim status suite. Slice 309 extends path-backed database payload attachments into the Slice 48 payment posting suite. Slice 310 extends path-backed database payload attachments into the Slice 49 account balance suite. Slice 311 extends path-backed database payload attachments into the Slice 50 account aging suite. Slice 312 extends path-backed database payload attachments into the Slice 51 account ledger suite. Slice 313 extends path-backed database payload attachments into the Slice 52 account statement suite. Slice 314 extends path-backed database payload attachments into the Slice 53 document preview suite. Slice 315 extends path-backed database payload attachments into the Slice 54 document revision suite. Slice 316 extends path-backed database payload attachments into the Slice 55 document replacement revision suite. Slice 317 extends path-backed database payload attachments into the Slice 56 payment posting mutation suite. Slice 318 extends path-backed database payload attachments into the Slice 57 claim status mutation suite. Slice 319 extends path-backed database payload attachments into the Slice 58 patient payment capture suite. Slice 320 extends path-backed database payload attachments into the Slice 59 patient statement generation suite. Slice 321 extends path-backed database payload attachments into the Slice 60 patient statement PDF export suite. Slice 322 extends path-backed database payload attachments into the Slice 61 statement batch candidate suite. Slice 323 extends path-backed database payload attachments into the Slice 62 statement batch package export suite.

## Modernized Target Parity Path

The modernized target now exists and includes implemented workflow slices through Slice 597. The smoke test proves that the target can run, consume the shared gold dataset, retrieve deterministic anchors across patient, portal, scheduling, encounter, revenue-cycle, procedure, document, administration, access-control, reporting, and clinical-list workflows, enforce the implemented session/ACL/mutation policies, and perform safe cleanup-backed mutation lifecycles. Slice 597 extends document operations with current-plus-prior patient document version-history readiness.

The slice readiness plans from `slice-1-readiness` through `slice-597-document-version-history-readiness` prove normalized database facts, browser-visible behavior, mutation/session/audit and cleanup expectations against both legacy and modernized targets where applicable. Slice 597 verifies document version-history readiness by creating a cleanup-backed text document, replacing it twice, proving the modernized content API/card/viewer expose Version 3 with two prior version rows, proving the legacy target remains a comparable overwrite-only Version 1 baseline, and deleting the temporary document. Slice 596 verifies document scanner-capture readiness by creating a cleanup-backed multi-page scanner PDF with `OCR pending` metadata, proving scanner source/page-count facts on both targets, proving the modernized Documents `Scanner Capture` form creates the document, proving the card/viewer/OCR Queue panels render the captured item, and deleting the temporary document. Slice 595 verifies controlled document retention disposition by creating a cleanup-backed older PDF document with explicit retention metadata, proving source facts on both targets, proving legacy archive behavior, proving the modernized retention-disposition API/UI action archives the eligible document and records disposition evidence, and deleting the temporary document. Slice 594 verifies document retention policy readiness by creating a cleanup-backed older PDF document with explicit retention metadata, proving source facts on both targets, proving the modernized document API calculates retain-until/disposition evidence from the deterministic dataset base date, proving the Documents Retention Policy panel renders the evidence, and deleting the temporary document. Slice 593 verifies document routing queue readiness by creating a cleanup-backed pending-review PDF document with explicit route metadata, proving source facts on both targets, proving the modernized document API projects it into the routing queue, proving the Documents Routing Queue panel renders the routed item, and deleting the temporary document. Slice 592 verifies document PDF thumbnail readiness by creating a cleanup-backed PDF document, proving source facts on both targets, proving the modernized document API emits a generated SVG thumbnail data URI, proving the Documents card renders that thumbnail, and deleting the temporary document. Slice 591 verifies document OCR completion readiness by creating a cleanup-backed scanned PDF with `OCR pending` metadata, proving source facts on both targets, proving the modernized Documents `Complete OCR` action changes the document to `OCR complete`, proving the completed item is removed from the OCR queue, and deleting the temporary document. Slice 590 verifies document OCR queue readiness by creating a cleanup-backed scanned PDF with `OCR pending` metadata, proving scanned pending-OCR source facts on both targets, proving the modernized protected OCR queue API projects the document as `Ready for OCR`, proving the Documents OCR Queue panel renders the pending item, and deleting the temporary document. Earlier workflow plans remain stable for the implemented patient, scheduling, encounter, document, revenue-cycle, lab/procedure, administration, ACL, reporting, and clinical-list slices.

For the one-hundred-fifty-fourth modernized procedure report reopen review readiness slice, compare the still-available side-by-side readiness plan with:

```powershell
npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan slice-154-procedure-report-reopen-review-readiness
```

Next parity steps:

1. Add additional modernized workflow actions behind the same mutation-test intent as CRUD slices are implemented.
2. Add modernized UI helpers behind the same browser workflow intent for each new mutation slice.
3. Add additional slice readiness plans or graduate slices into the full parity plan once both targets support them.
4. Extend normalized database query/result attachment generation from the database contract suite plus Slice 1 through Slice 142 plus Slices 144, 145, 147, 148, 149, 151, 153, 154, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, and 227 workflow suites into additional read-only workflow and mutation parity tests, then expand the Workbench with deeper historical reliability charts and long-term evidence-retention policy.

The test code should continue to assert observable behavior and normalized domain state, not identical implementation details.
