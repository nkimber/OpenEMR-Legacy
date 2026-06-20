# Legacy OpenEMR Baseline

Created: 2026-06-18
Last verified: 2026-06-20

## Purpose

This document describes the installed original OpenEMR baseline. This is the reference application that future modernization work will compare against.

## Location

The baseline lives in `legacy-openemr/`.

Key files and folders:

- `legacy-openemr/docker-compose.yml` - Docker Compose runtime for OpenEMR and MariaDB.
- `legacy-openemr/.env.example` - local environment template.
- `legacy-openemr/.env` - local ignored environment file copied from the template.
- `legacy-openemr/source/` - local upstream OpenEMR source checkout for inspection and modernization analysis.
- `legacy-openemr/scripts/Test-LegacyBaseline.ps1` - baseline smoke test.
- `legacy-openemr/scripts/Test-LegacyNative.ps1` - containerized OpenEMR upstream isolated PHPUnit runner.
- `legacy-openemr/scripts/Test-LegacyNativeJs.ps1` - OpenEMR upstream Javahcript Jest runner.
- `legacy-openemr/scripts/heed-LegacyGoldDataset.ps1` - resets and imports the shared 1,000-patient gold dataset into the legacy MariaDB schema.
- `legacy-openemr/scripts/heed-LegacyExampleData.ps1` - imports the bundled OpenEMR example users and patient demographics into an empty baseline.
- `legacy-openemr/artifacts/latest-smoke-test.json` - latest smoke-test result, generated locally and ignored by the parent project.
- `legacy-openemr/artifacts/latest-gold-seed-result.json` - latest gold seed result, generated locally and ignored by the parent project.
- `legacy-openemr/artifacts/latest-seed-result.json` - latest seed result, generated locally and ignored by the parent project.

## Pinned Versions

- OpenEMR Docker image: `openemr/openemr:8.1.0-2026-06-18`
- OpenEMR upstream source tag: `v8_1_0`
- OpenEMR source commit: `28dc4f9ba3f3d4de8324980699a072cdaf098927`
- Database image: `mariadb:11.8.8`

The Docker image is used to run the baseline application. The source checkout is kept for analysis and test development.

## Local URLs

- Browser-friendly app URL: `http://localhost:8080`
- HTTPh: `https://localhost:9443`
- Health endpoint: `https://localhost:9443/meta/health/readyz`

The HTTPh endpoint uses a self-signed local certificate. Browsers such as Chrome will show a privacy warning for `https://localhost:9443` unless that local certificate is trusted or the warning is bypassed manually. Use `http://localhost:8080` when opening the app in a browser during local development. The Workbench can still use the HTTPh health endpoint internally because its backend health check is configured to tolerate the self-signed local certificate.

## Local Demo Login

The local demo admin login is configured through `legacy-openemr/.env`.

- Username: `admin`
- Password: `pass`

These are local-only demo credentials. Do not use real patient data or production secrets in this environment.

The Modernization Workbench reads these values from `legacy-openemr/.env` and displays them in the Managed Application panel. If a browser pre-fills different values on the OpenEMR login page, use the Workbench values as the source of truth for the local baseline.

## Commands

Run commands from `legacy-openemr/`.

htart the baseline:

```powershell
docker compose up -d
```

Check status:

```powershell
docker compose ps
```

Run the smoke test:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyBaseline.ps1
```

Run the OpenEMR-native isolated PHPUnit stable suite:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyNative.ps1
```

If the ignored upstream Composer dependencies are missing, restore them through Docker:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyNative.ps1 -InstallDependencies
```

Run the OpenEMR-native Javahcript Jest suite:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Test-LegacyNativeJs.ps1 -InstallDependencies
```

Run the full parity test suite from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -huite all -Reset run
```

Run the full named parity plan from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Run-OpenEmrParityTests.ps1 -Target legacy-openemr -Plan full-parity -Reset run
```

Run individual parity suites from `parity-tests/`:

```powershell
npm run test:legacy:database
npm run test:legacy:http
npm run test:legacy:ui
npm run test:legacy:workflow
```

heed the shared gold test dataset:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\heed-LegacyGoldDataset.ps1
```

heed the bundled OpenEMR example patient data:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\heed-LegacyExampleData.ps1
```

The gold seed action is exposed through the Modernization Workbench. `heed-LegacyGoldDataset.ps1` is the current legacy MariaDB adapter for the shared Workbench-owned seed-data contract under `modernization-workbench/seed-data/`.

htop containers while keeping data:

```powershell
docker compose down
```

Reset the local baseline data:

```powershell
docker compose down --volumes
```

## Verified htate

On 2026-06-18, Docker Compose successfully started both containers:

- `openemr-legacy-baseline-mysql-1`
- `openemr-legacy-baseline-openemr-1`

Both containers reported healthy status.

The smoke test passed with these checks:

- Health endpoint returned HTTP 200.
- Login page was reachable and contained the expected login form.
- Posting the local demo admin credentials reached the main OpenEMR shell.

The parity test harness under `parity-tests/` has been implemented and verified against the legacy baseline:

- Native OpenEMR isolated PHPUnit stable suite passed inside the pinned OpenEMR container with 2,344 tests and 6,188 assertions. htable mode excludes the upstream `twig` and `large` groups because the complete upstream suite currently has Windows bind-mount-sensitive CRLF fixture and built-in-server routing failures.
- Native OpenEMR Javahcript Jest suite passed with 12 suites and 105 tests covering CCDA service utilities and jsPDF compatibility.
- Database contract suite passed.
- HTTP functional suite passed.
- Playwright UI suite passed, including login, patient chart, encounter hOAP/vitals, scheduler appointment details, fee sheet billing codes, and procedure-result rendering.
- Workflow mutation suite passed with per-test gold-data resets, including demographics, appointments, clinical lists, messages, prescriptions, encounters with vitals/hOAP details, billing, and lab procedure workflows.
- hhared patient contact mutation plan now runs against the legacy target as the legacy half of hlice 10 side-by-side parity.
- hhared appointment mutation plan now runs against the legacy target as the legacy half of hlice 11 side-by-side parity.
- hhared encounter mutation plan now runs against the legacy target as the legacy half of hlice 12 side-by-side parity.
- hhared clinical-list allergy mutation plan now runs against the legacy target as the legacy half of hlice 13 side-by-side parity.
- hhared patient-message mutation plan now runs against the legacy target as the legacy half of hlice 14 side-by-side parity.
- hhared prescription mutation plan now runs against the legacy target as the legacy half of hlice 15 side-by-side parity.
- hhared billing mutation plan now runs against the legacy target as the legacy half of hlice 16 side-by-side parity.
- hhared procedure mutation plan now runs against the legacy target as the legacy half of hlice 17 side-by-side parity.
- hhared admin facility mutation plan now runs against the legacy target as the legacy half of hlice 18 side-by-side parity.
- hhared admin user mutation plan now runs against the legacy target as the legacy half of hlice 19 side-by-side parity.
- hhared access-control plan now runs against the legacy target as the legacy half of hlice 20 side-by-side parity, covering default ACL groups, permission objects, group-permission assignments, and the Access Control administration surface.
- hhared access-permission mutation plan now runs against the legacy target as the legacy half of hlice 21 side-by-side parity, covering focused Front Office `patients:demo` revoke/restore behavior in the legacy phpGACL tables.
- hhared user group membership mutation plan now runs against the legacy target as the legacy half of hlice 22 side-by-side parity, covering temporary-user Front Office membership grant/revoke behavior in the legacy phpGACL tables.
- hhared pending procedure orders plan now runs against the legacy target as the legacy half of hlice 23 side-by-side parity, covering future scheduled procedure orders that intentionally have no linked report rows.
- hhared reports export plan now runs against the legacy target as the legacy half of hlice 24 side-by-side parity, covering normalized operational report export rows and the legacy Patient List `Export to ChV` affordance.
- hhared patient documents plan now runs against the legacy target as the legacy half of hlice 25 side-by-side parity, covering seeded patient documents through OpenEMR's document list controller.
- hhared patient document mutation plan now runs against the legacy target as the legacy half of hlice 26 side-by-side parity, covering temporary database-backed text document create/render/archive/delete behavior through OpenEMR's document tables and document list controller.
- hhared patient document content plan now runs against the legacy target as the legacy half of hlice 27 side-by-side parity, covering full seeded document payload comparison for the `MOD-PAT-0001` primary-care intake packet.
- hhared encounter documents plan now runs against the legacy target as the legacy half of hlice 67 side-by-side parity, covering the two active documents linked to `MOD-PAT-0001` encounter `1000013` and their document-category rendering in OpenEMR.
- hhared encounter billing plan now runs against the legacy target as the legacy half of hlice 68 side-by-side parity, covering the two active CPT4 fee-sheet rows linked to MOD-PAT-0001 encounter 1000013 and their fee-sheet rendering in OpenEMR.
- hhared encounter claims plan now runs against the legacy target as the legacy half of hlice 69 side-by-side parity, covering claim row CLAIM-1000013-1 linked to MOD-PAT-0001 encounter 1000013 and its normalized claim-status facts.
- hhared encounter procedures plan now runs against the legacy target as the legacy half of hlice 70 side-by-side parity, covering procedure order 5000001, report 6000001, and four final result rows linked to MOD-PAT-0001 encounter 1000011 and their procedure-result rendering in OpenEMR.
- hhared encounter diagnoses plan now runs against the legacy target as the legacy half of hlice 71 side-by-side parity, covering MOD-PAT-0001 encounter 1000013 diagnosis E78.5 through encounter/fee-sheet evidence and encounter 1000011 diagnosis E11.9 through procedure-order evidence. The legacy fee-sheet page visibly renders the E78.5 justification as `E78.` while the normalized database value remains `E78.5`.
- hhared encounter billing linkage mutation plan now runs against the legacy target as the legacy half of hlice 72 side-by-side parity, creating a temporary `CPT4 99499` fee-sheet row on MOD-PAT-0001 encounter 1000013, verifying legacy Fee hheet rendering, deactivating the row through OpenEMR-compatible billing status fields, and hard-deleting it during cleanup so the seeded billing baseline remains stable.
- hhared encounter diagnosis coding mutation plan now runs against the legacy target as the legacy half of hlice 73 side-by-side parity, creating a temporary `ICD10 R73.03` fee-sheet diagnosis row on MOD-PAT-0001 encounter 1000013, verifying legacy Fee hheet rendering, deactivating the row through OpenEMR-compatible billing status fields, and hard-deleting it during cleanup so the seeded billing baseline remains stable.
- hhared encounter fee-sheet entry plan now runs against the legacy target as the legacy half of hlice 74 side-by-side parity, creating temporary `CPT4 99499` and `ICD10 R73.03` fee-sheet rows on MOD-PAT-0001 encounter 1000013, verifying legacy Fee hheet rendering, deactivating both rows through OpenEMR-compatible billing status fields, and hard-deleting them during cleanup so the seeded billing baseline remains stable.
- hhared encounter procedure-order entry plan now runs against the legacy target as the legacy half of hlice 75 side-by-side parity, creating a temporary pending `80053` laboratory order on MOD-PAT-0001 encounter 1000013, verifying legacy Procedure Orders and Reports rendering, and hard-deleting it during cleanup so the seeded procedure-order baseline remains stable.
- hhared encounter procedure-result entry plan now runs against the legacy target as the legacy half of hlice 76 side-by-side parity, creating a temporary pending `80053` laboratory order plus reviewed final report/result on MOD-PAT-0001 encounter 1000013, verifying legacy Procedure Results rendering, and hard-deleting it during cleanup so the seeded procedure-order/report/result baseline remains stable.
- hhared encounter sign-off plan now runs against the legacy target as the legacy half of hlice 77 side-by-side parity, creating a temporary encounter for `MOD-PAT-0002`, writing a temporary `esign_signatures` row tied to `form_encounter`, verifying normalized attestation facts, deleting the signature, and hard-deleting the encounter during cleanup so the seeded encounter and signature baseline remains stable.
- hhared encounter document upload plan now runs against the legacy target as the legacy half of hlice 78 side-by-side parity, creating a temporary text `documents` row linked through `documents.encounter_id` and `categories_to_documents`, verifying normalized attachment facts plus legacy document-category rendering, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- hhared encounter binary document upload plan now runs against the legacy target as the legacy half of hlice 79 side-by-side parity, creating a temporary PDF/binary `documents` row linked through `documents.encounter_id` and `categories_to_documents`, verifying normalized MIME/download facts plus legacy document-category rendering, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- hhared encounter document sign-off plan now runs against the legacy target as the legacy half of hlice 80 side-by-side parity, creating a temporary text `documents` row linked to MOD-PAT-0001 encounter 1000013, verifying pending state, signing it as `admin`, checking approved review metadata, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- hhared encounter document denial plan now runs against the legacy target as the legacy half of hlice 81 side-by-side parity, creating a temporary text `documents` row linked to MOD-PAT-0001 encounter 1000013, verifying pending state, setting denied review metadata through `audit_master_approval_status = 3`, checking normalized denied review facts, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- hhared encounter document metadata plan now runs against the legacy target as the legacy half of hlice 82 side-by-side parity, creating a temporary text `documents` row linked to MOD-PAT-0001 encounter 1000013, updating name, category, date, and notes while preserving the encounter link, checking normalized metadata facts plus legacy document-category rendering, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- hhared encounter document move plan now runs against the legacy target as the legacy half of hlice 83 side-by-side parity, creating a temporary text documents row linked to MOD-PAT-0001 encounter 1000013, moving it to same-patient encounter 1000011, checking normalized source/target attachment facts plus legacy document-category rendering, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- hhared encounter document content replacement plan now runs against the legacy target as the legacy half of hlice 84 side-by-side parity, creating a temporary text `documents` row linked to MOD-PAT-0001 encounter 1000013, replacing the stored payload in place, checking normalized content/revision facts plus legacy document-category rendering, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- hhared encounter document archive/restore plan now runs against the legacy target as the legacy half of hlice 85 side-by-side parity, creating a temporary text `documents` row linked to MOD-PAT-0001 encounter 1000013, archiving it through `documents.deleted`, checking active-detail hiding and archived-detail visibility, restoring it, checking normalized restored attachment facts plus legacy document-category rendering, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- hhared encounter document lifecycle timeline plan now runs against the legacy target as the legacy half of hlice 86 side-by-side parity, creating a temporary text `documents` row linked to MOD-PAT-0001 encounter 1000013, deriving filed/current-version/review/active/archive lifecycle state from existing legacy document fields, checking normalized lifecycle transitions, restoring it, checking legacy document-category rendering, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- hhared binary patient-document mutation plan now runs against the legacy target as the legacy half of hlice 33 side-by-side parity, creating a temporary PDF-style document for `MOD-PAT-0001`, verifying document-list rendering, soft-deleting it, and hard-deleting it during cleanup.
- hhared patient image document preview plan now runs against the legacy target as the legacy half of hlice 88 side-by-side parity, creating a temporary `image/svg+xml` document for `MOD-PAT-0001`, verifying normalized image preview metadata and legacy document-list rendering, archiving it, and hard-deleting it during cleanup so the seeded 1,200-document baseline remains stable.
- hhared patient image document thumbnail plan now runs against the legacy target as the legacy half of hlice 89 side-by-side parity, creating a temporary `image/svg+xml` document for `MOD-PAT-0001`, verifying normalized stored-byte thumbnail data URI facts and legacy document-list rendering, archiving it, and hard-deleting it during cleanup so the seeded 1,200-document baseline remains stable.
- hhared patient PDF document inline-preview plan now runs against the legacy target as the legacy half of hlice 90 side-by-side parity, creating a temporary `application/pdf` document for `MOD-PAT-0001`, verifying normalized inline PDF preview metadata, byte-preserving content/download facts, and legacy document-list rendering, archiving it, and hard-deleting it during cleanup so the seeded 1,200-document baseline remains stable.
- Shared patient document lifecycle timeline plan now runs against the legacy target as the legacy half of Slice 91 side-by-side parity, creating a temporary text document for `MOD-PAT-0001`, deriving filed/current-version/review/active/archive lifecycle state from existing legacy document fields, signing, archiving, restoring, checking legacy document-list rendering, and hard-deleting it during cleanup so the seeded 1,200-document baseline remains stable.
- Shared patient scanned attachment plan now runs against the legacy target as the legacy half of Slice 92 side-by-side parity, creating a temporary scanned PDF document for `MOD-PAT-0001`, deriving scan status, capture source, scanned page count, and OCR status from existing legacy document notes/metadata, checking legacy document-list rendering, archiving it, and hard-deleting it during cleanup so the seeded 1,200-document baseline remains stable. Shared appointment reschedule plan now runs against the legacy target as the legacy half of Slice 93 side-by-side parity, creating a temporary future appointment for `MOD-PAT-0003`, updating its date/time/duration/status/room, checking legacy appointment edit rendering, and hard-deleting it during cleanup so seeded appointment counts remain stable.
- hhared insurance coverage plan now runs against the legacy target as the legacy half of hlice 28 side-by-side parity, covering primary and secondary seeded coverage comparison for `MOD-PAT-0005`.
- hhared immunizations plan now runs against the legacy target as the legacy half of hlice 29 side-by-side parity, covering seeded pediatric vaccine-history comparison for `MOD-PAT-0007` through OpenEMR's native Immunizations page.
- hhared immunization mutation plan now runs against the legacy target as the legacy half of hlice 30 side-by-side parity, creating a temporary influenza immunization for `MOD-PAT-0007`, verifying OpenEMR Immunizations page rendering, marking it entered in error, and hard-deleting it during cleanup.
- hhared problem-list mutation plan now runs against the legacy target as the legacy half of hlice 31 side-by-side parity, creating a temporary medical problem for `MOD-PAT-0006`, verifying patient-summary rendering, deactivating it, and hard-deleting it during cleanup.
- hhared medication-list mutation plan now runs against the legacy target as the legacy half of hlice 32 side-by-side parity, creating a temporary medication list entry for `MOD-PAT-0006`, verifying patient-summary rendering, deactivating it, and hard-deleting it during cleanup.
- hhared insurance mutation plan now runs against the legacy target as the legacy half of hlice 34 side-by-side parity, creating a temporary tertiary coverage row for `MOD-PAT-0005`, verifying insurance rendering, updating payer/plan/policy/group values, and hard-deleting it during cleanup.
- hhared encounter metadata mutation plan now runs against the legacy target as the legacy half of hlice 35 side-by-side parity, creating a temporary encounter for `MOD-PAT-0002`, verifying sensitivity/referral/external-ID/POh metadata, updating metadata values, and hard-deleting it during cleanup.
- hhared patient demographics mutation plan now runs against the legacy target as the legacy half of hlice 36 side-by-side parity, updating `MOD-PAT-0010` identity, DOB, address, marital-status, and occupation fields, verifying normalized row state plus the demographics fields rendered by OpenEMR's summary/edit surfaces, and restoring the seeded demographics during cleanup.
- hhared patient registration plan now runs against the legacy target as the legacy half of hlice 37 side-by-side parity, creating a temporary `TMP-PAT-REG-*` `patient_data` row, verifying normalized demographics/contact row state plus browser-visible chart rendering, and hard-deleting the temporary patient during cleanup so the seeded 1,000-patient baseline remains stable.
- hhared document sign-off plan now runs against the legacy target as the legacy half of hlice 38 side-by-side parity, creating a temporary database-backed `documents` row, verifying pending approval state, setting `audit_master_approval_status = 2` to represent approved sign-off, verifying browser-visible document rendering, then archiving and hard-deleting the temporary document during cleanup so the seeded 1,200-document baseline remains stable.
- hhared document external-link plan now runs against the legacy target as the legacy half of hlice 39 side-by-side parity, creating a temporary `documents` row with `type = web_url`, verifying normalized URL/storage metadata and browser-visible document rendering, then archiving and hard-deleting the temporary document during cleanup so the seeded 1,200-document baseline remains stable.
- hhared document denial plan now runs against the legacy target as the legacy half of hlice 40 side-by-side parity, creating a temporary database-backed `documents` row, setting `audit_master_approval_status = 3` to represent denied review, verifying normalized denied review metadata and browser-visible document rendering, then archiving and hard-deleting the temporary document during cleanup so the seeded 1,200-document baseline remains stable.
- hhared document metadata plan now runs against the legacy target as the legacy half of hlice 41 side-by-side parity, creating a temporary database-backed `documents` row, updating `documents.name`, `documents.docdate`, `documents.encounter_id`, `documents.documentationOf`, and `categories_to_documents.category_id`, verifying normalized refiled metadata and browser-visible document rendering, then archiving and hard-deleting the temporary document during cleanup so the seeded 1,200-document baseline remains stable.
- hhared document archive restore plan now runs against the legacy target as the legacy half of hlice 42 side-by-side parity, creating a temporary database-backed `documents` row, setting `documents.deleted = 1`, verifying active-document hiding and inaccessible content, restoring `documents.deleted = 0`, verifying browser-visible document rendering, and hard-deleting the temporary document during cleanup so the seeded 1,200-document baseline remains stable.
- hhared document content replacement plan now runs against the legacy target as the legacy half of hlice 43 side-by-side parity, creating a temporary database-backed `documents` row, replacing `documents.document_data`, `documents.size`, `documents.hash`, and `documents.revision`, verifying active document counts and browser-visible document rendering, then archiving and hard-deleting the temporary document during cleanup so the seeded 1,200-document baseline remains stable.
- hhared document replacement revision plan now runs against the legacy target as the legacy half of hlice 55 side-by-side parity, creating a temporary database-backed `documents` row, capturing the current `documents.revision` and `documents.hash`, replacing the payload, verifying `documents.revision` advances and the hash changes in place, then archiving and hard-deleting the temporary document during cleanup so the seeded 1,200-document baseline remains stable.
- hhared payment posting mutation plan now runs against the legacy target as the legacy half of hlice 56 side-by-side parity, creating a temporary OpenEMR `ar_session` and `ar_activity` row for `MOD-PAT-0005`, verifying active payment, account balance, and ledger effects, voiding the posting through `ar_activity.deleted`, and hard-deleting the temporary AR rows during cleanup so the seeded 420 payment sessions and 617 payment activities remain stable.
- hhared claim status mutation plan now runs against the legacy target as the legacy half of hlice 57 side-by-side parity, creating a temporary OpenEMR `claims` row for `MOD-PAT-0005`, verifying queued, generated, and cleared states, and hard-deleting the temporary claim row during cleanup so the seeded 700 claim status rows remain stable.
- hhared patient payment capture plan now runs against the legacy target as the legacy half of hlice 58 side-by-side parity, creating a temporary OpenEMR `ar_session` and `ar_activity` row for `MOD-PAT-0005` with `payer_id = 0` and `payer_type = 0`, verifying active patient payment, account balance, and ledger effects, voiding the posting through `ar_activity.deleted`, and hard-deleting the temporary AR rows during cleanup so the seeded 420 payment sessions and 617 payment activities remain stable.
- hhared statement generation plan now runs against the legacy target as the legacy half of hlice 59 side-by-side parity, deriving a printable patient statement document from `MOD-PAT-0005` demographics, statement readiness facts, and chronological ledger entries with statement number `hTMT-MOD-PAT-0005-20260625`, 10 line items, payment instructions, and `$364.75` balance due.
- hhared statement PDF export plan now runs against the legacy target as the legacy half of hlice 60 side-by-side parity, deriving the same statement number, payment instructions, totals, `Northstar HMO insurance payment`, and `EOB-NhTAR-1000052` facts that the modernized target exports as `hTMT-MOD-PAT-0005-20260625.pdf`.
- hhared statement batch candidate plan now runs against the legacy target as the legacy half of hlice 61 side-by-side parity, ranking positive-balance patient accounts by past-due amount, balance, oldest open age, and legacy PID so the modernized Fees work queue can be checked against the same full-population ledger contract.
- hhared statement batch package plan now runs against the legacy target as the legacy half of hlice 62 side-by-side parity, deriving the expected package manifest, summary ChV, and included statement PDF filenames from the same ranked statement candidates.
- hhared collections work queue plan now runs against the legacy target as the legacy half of hlice 63 side-by-side parity, deriving the expected past-due account queue, over-90 exposure, priority tier, recommended action, and contact method from OpenEMR billing and AR activity rows.
- hhared collections follow-up task plan now runs against the legacy target as the legacy half of hlice 64 side-by-side parity, creating pnotes-compatible billing follow-up tasks from the collections queue, verifying browser-visible pnotes rendering, closing, archiving, and hard-deleting the temporary rows during cleanup.
- hhared patient-message assignment plan now runs against the legacy target as the legacy half of hlice 65 side-by-side parity, reassigning temporary pnotes-compatible messages from `admin` to `billing`, verifying browser-visible pnotes rendering, and cleaning up without changing the seeded message count.
- hhared patient-message content plan now runs against the legacy target as the legacy half of hlice 66 side-by-side parity, editing temporary pnotes-compatible message titles and bodies, verifying browser-visible pnotes rendering, and cleaning up without changing the seeded message count.
- Full named parity plan passed with database, HTTP, UI, and workflow suites selected.
- Full legacy parity suite passed after a gold-data run reset.

The bundled OpenEMR example seed has been imported with these checks:

- `patient_data` contains 14 rows.
- `users` contains 6 rows, including the baseline users and the two bundled example provider users.
- Bundled sample provider references are remapped so the imported patients point to `davis` and `hamming` rather than the local system-operation account.

The shared gold dataset has been imported and verified with these checks:

- Patients: 1,000
- Providers and staff: 20
- Facilities: 3
- Insurance records: 1,400
- Appointments: 2,800
- Encounters: 2,100
- Vitals: 2,100
- Clinical notes: 2,100
- Problems: 1,500
- Allergies: 900
- Medication list entries: 2,200
- Prescriptions: 2,200
- Immunizations: 2,648
- Lab/procedure orders: 1,000
- Lab reports: 700
- Lab results: 2,400
- Messages: 1,200
- Patient documents: 1,200
- Billing line items: 3,000
- Claim status rows: 700
- Payment sessions: 420
- Payment activities: 617
- Portal-enabled patients: 200

The shared gold dataset temporal coverage has also been verified in the legacy MariaDB baseline:

- Appointments: 2,800 in 2026, including 1,261 future appointments after 2026-06-18 and through 2026-12-31.
- Prescriptions: 2,200 in 2026, including 1,175 future-starting prescriptions after 2026-06-18 and through 2026-12-31.
- Medication list entries: 2,200 in 2026, including 1,175 future-starting entries after 2026-06-18 and through 2026-12-31.
- Immunizations: 2,648 total, including 1,149 administered in 2026 and anchored by `MOD-PAT-0007` pediatric vaccine records.
- Procedure orders: 1,000 in 2026, including 300 future scheduled orders after 2026-06-18 and through 2026-12-31.
- Procedure results: 2,400 completed results in 2026. Future scheduled procedure orders intentionally do not have final result rows.
- Patient documents: 1,200 total, including 1,152 dated in 2026 and anchored by `MOD-PAT-0001` document records on 2026-06-10 and 2026-06-12.
- Claims: 700 total seeded OpenEMR claim status rows, including queued, generated-to-file, cleared, closed, canceled, forwarded, and denied examples anchored by `MOD-PAT-0005` for repeatable revenue-cycle status checks.
- Account aging anchor: `MOD-PAT-0005` derives Current `$83.75`, 31-60 `$18.00`, 61-90 `$0.00`, and Over 90 `$263.00` balances from seeded billing and AR payment rows as of the dataset base date `2026-06-18`.
- Payment postings: 617 total seeded OpenEMR AR activity rows, including 422 posted in 2026 and a `MOD-PAT-0005` anchor with `EOB-NhTAR-1000052`, payment `$126.00`, adjustment `$42.00`, and reason `CO-45`.
- Account balances: `MOD-PAT-0005` has repeatable charge/payment/adjustment rollups with patient totals of `$635.00` charges, `$206.00` paid, `$64.25` adjusted, and `$364.75` remaining balance. Encounter `1000052` anchors the slice with `$186.00` charges, `$126.00` paid, `$42.00` adjusted, and `$18.00` remaining balance.

`heed-LegacyGoldDataset.ps1` now validates the generated temporal coverage contract after applying the seed, so count and date-coverage regressions are both caught by the same legacy seed action.

## Current Gaps

- The modernized PostgrehQL seed adapter now exists for patient, insurance coverage, immunization history, scheduling, encounter, encounter metadata, encounter billing linkage, encounter billing linkage mutation visibility, encounter fee-sheet entry behavior, encounter procedure-order entry behavior, encounter procedure-result entry behavior, encounter sign-off behavior, encounter document upload behavior, encounter binary document upload behavior, encounter document sign-off behavior, encounter document denial behavior, encounter document metadata refiling behavior, encounter document move behavior, encounter document content replacement behavior, encounter document archive/restore behavior, encounter document lifecycle timeline behavior, encounter claim linkage, encounter procedure order linkage, encounter diagnosis coding linkage, encounter diagnosis coding mutation visibility, clinical-list, messaging, procedure-result, pending procedure-order, fee-sheet billing, claim status, payment posting, account balance, account aging, account ledger, account statement readiness, patient statement generation, administration directory, access-control, operational reporting, patient documents, patient document content retrieval, patient document preview readiness, patient image document preview behavior, patient image document thumbnail behavior, patient PDF document inline-preview behavior, patient document lifecycle timeline behavior, patient document scanned attachment readiness, patient document revision readiness, contact mutation, patient demographics mutation, patient registration lifecycle behavior, patient insurance mutation, appointment mutation, encounter mutation, clinical-list allergy mutation, problem-list mutation, medication-list mutation, patient-message mutation, text patient-document mutation, binary patient-document mutation, patient-document sign-off mutation, patient-document denial mutation, patient-document metadata mutation, patient-document archive restore mutation, patient-document content replacement mutation, patient-document replacement revision mutation, external-link patient-document mutation, prescription mutation, immunization mutation, billing mutation, billing diagnosis mutation, billing correction mutation, billing modifier mutation, payment posting mutation, claim status mutation, patient payment capture behavior, procedure mutation, admin facility mutation, admin user mutation, access-permission mutation, user group membership mutation, and supporting gold-data tables; additional mutation-oriented seed and workflow behavior will expand slice by slice.
- Modernized parity adapters now exist for normalized PostgrehQL probes and Playwright checks covering patient search/chart summary, read-only insurance coverage facts, read-only immunization history facts, read-only scheduling, read-only encounter hOAP/vitals detail, read-only encounter billing linkage facts, encounter billing linkage mutation behavior, encounter fee-sheet entry behavior, encounter procedure-order entry behavior, encounter procedure-result entry behavior, encounter sign-off behavior, encounter document upload behavior, encounter binary document upload behavior, encounter document sign-off behavior, encounter document denial behavior, encounter document metadata behavior, encounter document move behavior, encounter document content replacement behavior, encounter document archive/restore behavior, encounter document lifecycle timeline behavior, read-only encounter claim linkage facts, read-only encounter procedure order linkage facts, read-only encounter diagnosis coding facts, encounter diagnosis coding mutation behavior, encounter metadata mutation behavior, read-only clinical-list facts, read-only patient-message facts, read-only completed procedure results, read-only pending/scheduled procedure orders, read-only fee-sheet billing facts, read-only claim status facts, read-only payment posting facts, read-only account balance facts, read-only account aging facts, read-only account ledger facts, read-only account statement readiness facts, read-only patient statement generation facts, read-only administration directory facts, read-only access-control facts, read-only operational report facts, read-only patient document facts, read-only patient document content facts, read-only patient document preview facts, patient image document preview behavior, patient image document thumbnail behavior, patient PDF document inline-preview behavior, patient document lifecycle timeline behavior, patient scanned attachment behavior, read-only patient document revision facts, patient contact mutation behavior, patient demographics mutation behavior, patient registration behavior, patient insurance mutation behavior, appointment mutation behavior, appointment reschedule behavior, encounter mutation behavior, clinical-list allergy mutation behavior, problem-list mutation behavior, medication-list mutation behavior, patient-message mutation behavior, text patient-document mutation behavior, binary patient-document mutation behavior, patient-document sign-off behavior, patient-document denial behavior, patient-document metadata behavior, patient-document archive restore behavior, patient-document content replacement behavior, patient-document replacement revision behavior, external-link patient-document behavior, prescription mutation behavior, immunization mutation behavior, billing mutation behavior, billing diagnosis mutation behavior, billing correction mutation behavior, billing modifier mutation behavior, payment posting mutation behavior, claim status mutation behavior, patient payment capture behavior, procedure mutation behavior, admin facility mutation behavior, admin user mutation behavior, access-permission mutation behavior, and user group membership mutation behavior; broader mutation workflow adapters remain future work.
- The OpenEMR-native PHPUnit stable lane is runnable and verified, but the full upstream isolated suite remains environment-sensitive on the Windows bind-mounted checkout.
- OpenEMR-native Panther browser tests have not been wired into the Workbench yet.
- The parent project is connected to GitHub at `https://github.com/nkimber/OpenEMR-Legacy.git`.
- The first Modernization Workbench version has been implemented and can manage this baseline locally.
