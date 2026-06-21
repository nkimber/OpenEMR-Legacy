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
- `legacy-openemr/scripts/Test-LegacyNativeJs.ps1` - OpenEMR upstream JavaScript Jest runner.
- `legacy-openemr/scripts/Seed-LegacyGoldDataset.ps1` - resets and imports the shared 1,000-patient gold dataset into the legacy MariaDB schema.
- `legacy-openemr/scripts/Seed-LegacyExampleData.ps1` - imports the bundled OpenEMR example users and patient demographics into an empty baseline.
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

Run the OpenEMR-native JavaScript Jest suite:

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

Seed the shared gold test dataset:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Seed-LegacyGoldDataset.ps1
```

Seed the bundled OpenEMR example patient data:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Seed-LegacyExampleData.ps1
```

The gold seed action is exposed through the Modernization Workbench. `Seed-LegacyGoldDataset.ps1` is the current legacy MariaDB adapter for the shared Workbench-owned seed-data contract under `modernization-workbench/seed-data/`.

Stop containers while keeping data:

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
- Native OpenEMR JavaScript Jest suite passed with 12 suites and 105 tests covering CCDA service utilities and jsPDF compatibility.
- Database contract suite passed.
- HTTP functional suite passed.
- Playwright UI suite passed, including login, patient chart, encounter SOAP/vitals, scheduler appointment details, fee sheet billing codes, and procedure-result rendering.
- Workflow mutation suite passed with per-test gold-data resets, including demographics, appointments, clinical lists, messages, prescriptions, encounters with vitals/SOAP details, billing, and lab procedure workflows.
- Shared patient contact mutation plan now runs against the legacy target as the legacy half of Slice 10 side-by-side parity.
- Shared appointment mutation plan now runs against the legacy target as the legacy half of Slice 11 side-by-side parity.
- Shared encounter mutation plan now runs against the legacy target as the legacy half of Slice 12 side-by-side parity.
- Shared clinical-list allergy mutation plan now runs against the legacy target as the legacy half of Slice 13 side-by-side parity.
- Shared patient-message mutation plan now runs against the legacy target as the legacy half of Slice 14 side-by-side parity.
- Shared prescription mutation plan now runs against the legacy target as the legacy half of Slice 15 side-by-side parity.
- Shared billing mutation plan now runs against the legacy target as the legacy half of Slice 16 side-by-side parity.
- Shared procedure mutation plan now runs against the legacy target as the legacy half of Slice 17 side-by-side parity.
- Shared admin facility mutation plan now runs against the legacy target as the legacy half of Slice 18 side-by-side parity.
- Shared admin user mutation plan now runs against the legacy target as the legacy half of Slice 19 side-by-side parity.
- Shared access-control plan now runs against the legacy target as the legacy half of Slice 20 side-by-side parity, covering default ACL groups, permission objects, group-permission assignments, and the Access Control administration surface.
- Shared access-permission mutation plan now runs against the legacy target as the legacy half of Slice 21 side-by-side parity, covering focused Front Office `patients:demo` revoke/restore behavior in the legacy phpGACL tables.
- Shared user group membership mutation plan now runs against the legacy target as the legacy half of Slice 22 side-by-side parity, covering temporary-user Front Office membership grant/revoke behavior in the legacy phpGACL tables.
- Shared pending procedure orders plan now runs against the legacy target as the legacy half of Slice 23 side-by-side parity, covering future scheduled procedure orders that intentionally have no linked report rows.
- Shared reports export plan now runs against the legacy target as the legacy half of Slice 24 side-by-side parity, covering normalized operational report export rows and the legacy Patient List `Export to CSV` affordance.
- Shared patient documents plan now runs against the legacy target as the legacy half of Slice 25 side-by-side parity, covering seeded patient documents through OpenEMR's document list controller.
- Shared patient document mutation plan now runs against the legacy target as the legacy half of Slice 26 side-by-side parity, covering temporary database-backed text document create/render/archive/delete behavior through OpenEMR's document tables and document list controller.
- Shared patient document content plan now runs against the legacy target as the legacy half of Slice 27 side-by-side parity, covering full seeded document payload comparison for the `MOD-PAT-0001` primary-care intake packet.
- Shared encounter documents plan now runs against the legacy target as the legacy half of Slice 67 side-by-side parity, covering the two active documents linked to `MOD-PAT-0001` encounter `1000013` and their document-category rendering in OpenEMR.
- Shared encounter billing plan now runs against the legacy target as the legacy half of Slice 68 side-by-side parity, covering the two active CPT4 fee-sheet rows linked to MOD-PAT-0001 encounter 1000013 and their fee-sheet rendering in OpenEMR.
- Shared encounter claims plan now runs against the legacy target as the legacy half of Slice 69 side-by-side parity, covering claim row CLAIM-1000013-1 linked to MOD-PAT-0001 encounter 1000013 and its normalized claim-status facts.
- Shared encounter procedures plan now runs against the legacy target as the legacy half of Slice 70 side-by-side parity, covering procedure order 5000001, report 6000001, and four final result rows linked to MOD-PAT-0001 encounter 1000011 and their procedure-result rendering in OpenEMR.
- Shared encounter diagnoses plan now runs against the legacy target as the legacy half of Slice 71 side-by-side parity, covering MOD-PAT-0001 encounter 1000013 diagnosis E78.5 through encounter/fee-sheet evidence and encounter 1000011 diagnosis E11.9 through procedure-order evidence. The legacy fee-sheet page visibly renders the E78.5 justification as `E78.` while the normalized database value remains `E78.5`.
- Shared encounter billing linkage mutation plan now runs against the legacy target as the legacy half of Slice 72 side-by-side parity, creating a temporary `CPT4 99499` fee-sheet row on MOD-PAT-0001 encounter 1000013, verifying legacy Fee Sheet rendering, deactivating the row through OpenEMR-compatible billing status fields, and hard-deleting it during cleanup so the seeded billing baseline remains stable.
- Shared encounter diagnosis coding mutation plan now runs against the legacy target as the legacy half of Slice 73 side-by-side parity, creating a temporary `ICD10 R73.03` fee-sheet diagnosis row on MOD-PAT-0001 encounter 1000013, verifying legacy Fee Sheet rendering, deactivating the row through OpenEMR-compatible billing status fields, and hard-deleting it during cleanup so the seeded billing baseline remains stable.
- Shared encounter fee-sheet entry plan now runs against the legacy target as the legacy half of Slice 74 side-by-side parity, creating temporary `CPT4 99499` and `ICD10 R73.03` fee-sheet rows on MOD-PAT-0001 encounter 1000013, verifying legacy Fee Sheet rendering, deactivating both rows through OpenEMR-compatible billing status fields, and hard-deleting them during cleanup so the seeded billing baseline remains stable.
- Shared encounter procedure-order entry plan now runs against the legacy target as the legacy half of Slice 75 side-by-side parity, creating a temporary pending `80053` laboratory order on MOD-PAT-0001 encounter 1000013, verifying legacy Procedure Orders and Reports rendering, and hard-deleting it during cleanup so the seeded procedure-order baseline remains stable.
- Shared encounter procedure-result entry plan now runs against the legacy target as the legacy half of Slice 76 side-by-side parity, creating a temporary pending `80053` laboratory order plus reviewed final report/result on MOD-PAT-0001 encounter 1000013, verifying legacy Procedure Results rendering, and hard-deleting it during cleanup so the seeded procedure-order/report/result baseline remains stable.
- Shared encounter sign-off plan now runs against the legacy target as the legacy half of Slice 77 side-by-side parity, creating a temporary encounter for `MOD-PAT-0002`, writing a temporary `esign_signatures` row tied to `form_encounter`, verifying normalized attestation facts, deleting the signature, and hard-deleting the encounter during cleanup so the seeded encounter and signature baseline remains stable.
- Shared encounter co-signature plan now runs against the legacy target as the legacy half of Slice 121 side-by-side parity, creating a temporary encounter for `MOD-PAT-0002`, writing temporary `admin` and locked `gold-provider-02` rows in `esign_signatures`, verifying signature order, hashes, notes, and cleanup.
- Shared encounter document revision plan now runs against the legacy target as the legacy half of Slice 122 side-by-side parity, verifying seeded `DOC-MOD-PAT-0001-1` and `DOC-MOD-PAT-0001-2` current-version fields, revision timestamps, hash parity, and content-readiness on MOD-PAT-0001 encounter `1000013`.
- Shared encounter document replacement revision plan now runs against the legacy target as the legacy half of Slice 123 side-by-side parity, creating a temporary text `documents` row on MOD-PAT-0001 encounter `1000013`, replacing `documents.document_data`, `documents.revision`, and `documents.hash`, verifying current revision facts, and hard-deleting it during cleanup.
- Shared encounter document upload plan now runs against the legacy target as the legacy half of Slice 78 side-by-side parity, creating a temporary text `documents` row linked through `documents.encounter_id` and `categories_to_documents`, verifying normalized attachment facts plus legacy document-category rendering, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- Shared encounter binary document upload plan now runs against the legacy target as the legacy half of Slice 79 side-by-side parity, creating a temporary PDF/binary `documents` row linked through `documents.encounter_id` and `categories_to_documents`, verifying normalized MIME/download facts plus legacy document-category rendering, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- Shared encounter scanned attachment plan now runs against the legacy target as the legacy half of Slice 126 side-by-side parity, creating a temporary scanned PDF-style `documents` row linked through `documents.encounter_id` and `categories_to_documents`, deriving scan status/capture source/OCR facts from document notes and metadata, verifying legacy document-category rendering, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- Shared encounter binary document content replacement plan now runs against the legacy target as the legacy half of Slice 127 side-by-side parity, creating a temporary PDF-style `documents` row on encounter `1000013`, replacing `document_data`, `mimetype`, `size`, `hash`, `revision`, and URL filename reference in place, verifying byte-for-byte normalized content/download facts and legacy document-category rendering, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- Shared patient binary document content replacement plan now runs against the legacy target as the legacy half of Slice 128 side-by-side parity, creating a temporary PDF-style `documents` row for `MOD-PAT-0001` and encounter `1000013`, replacing `document_data`, `mimetype`, `size`, `hash`, `revision`, and URL filename reference in place, verifying byte-for-byte normalized content/download facts and legacy document-category rendering, and hard-deleting it during cleanup so the seeded patient document baseline remains stable.
- Shared procedure result correction plan now runs against the legacy target as the legacy half of Slice 129 side-by-side parity, creating a temporary `form_encounter`, `procedure_order`, `procedure_order_code`, `procedure_report`, and `procedure_result` for `MOD-PAT-0009`, updating the existing `procedure_result` fields in place, verifying legacy Procedure Results rendering plus normalized corrected result facts, and deleting the temporary order tree and encounter during cleanup so seeded lab counts remain stable.
- Shared procedure specimen plan now runs against the legacy target as the legacy half of Slice 130 side-by-side parity, creating a temporary `procedure_report` with `date_collected` and `specimen_num`, verifying normalized report metadata plus legacy Procedure Results specimen rendering, and deleting the temporary order tree and encounter during cleanup so seeded lab counts remain stable.
- Shared procedure specimen detail plan now runs against the legacy target as the legacy half of Slice 131 side-by-side parity, creating a temporary `procedure_specimen` row with specimen identifier, accession identifier, specimen type/code, collection method/code, specimen location/code, collected date/time, volume value/unit, condition/code, and comments, verifying normalized specimen detail facts plus cleanup deletion.
- Shared procedure order correction plan now runs against the legacy target as the legacy half of Slice 132 side-by-side parity, creating a temporary `form_encounter`, `procedure_order`, and `procedure_order_code` for `MOD-PAT-0009`, correcting order date/code/name/type/diagnosis/priority/status/instructions in place, verifying legacy Procedure Results rendering after report/result creation plus normalized corrected order facts, and deleting the temporary order tree and encounter during cleanup so seeded lab counts remain stable.
- Shared procedure report correction plan now runs against the legacy target as the legacy half of Slice 133 side-by-side parity, creating a temporary `form_encounter`, `procedure_order`, `procedure_report`, and `procedure_result` for `MOD-PAT-0009`, correcting `date_collected`, `date_report`, `specimen_num`, `report_status`, `review_status`, and `report_notes` in place, verifying legacy Procedure Results rendering plus normalized corrected report facts, and deleting the temporary order tree and encounter during cleanup so seeded lab counts remain stable.
- Shared procedure report sign-off plan now runs against the legacy target as the legacy half of Slice 134 side-by-side parity, creating a temporary `form_encounter`, `procedure_order`, `procedure_report`, and `procedure_result` for `MOD-PAT-0009`, updating `procedure_report.review_status`, `source`, and `date_report` to represent a normalized `admin` sign-off, verifying legacy Procedure Results rendering plus signed reviewer/timestamp facts, and deleting the temporary order tree and encounter during cleanup so seeded lab counts remain stable.
- Shared procedure report review queue plan now runs against the legacy target as the legacy half of Slice 135 side-by-side parity, creating a temporary `form_encounter`, `procedure_order`, and received `procedure_report` for `MOD-PAT-0009`, verifying OpenEMR `list_reports.php` received/unreviewed and reviewed filters, signing the report as `admin`, and deleting the temporary order tree and encounter during cleanup so seeded lab counts remain stable.
- Shared procedure report review queue filters plan now runs against the legacy target as the legacy half of Slice 136 side-by-side parity, creating a temporary `form_encounter`, `procedure_order`, and received `procedure_report` for `MOD-PAT-0009`, verifying OpenEMR `list_reports.php` patient and order-date filters for matching and outside-date cases, signing the report as `admin`, verifying the filtered reviewed queue, and deleting the temporary order tree and encounter during cleanup so seeded lab counts remain stable.
- Shared procedure report review queue provider filters plan now runs against the legacy target as the legacy half of Slice 137 side-by-side parity, creating a temporary `form_encounter`, `procedure_order`, and received `procedure_report` for `MOD-PAT-0009`, verifying OpenEMR `list_reports.php` `form_provider` / `procedure_order.provider_id` filtering for matching and outside-provider cases, signing the report as `admin`, verifying the provider-filtered reviewed queue, and deleting the temporary order tree and encounter during cleanup so seeded lab counts remain stable.
- Shared procedure report review queue lab filters plan now runs against the legacy target as the legacy half of Slice 138 side-by-side parity, creating temporary `procedure_providers` lab rows plus a temporary `form_encounter`, `procedure_order`, and received `procedure_report` for `MOD-PAT-0009`, verifying OpenEMR `list_reports.php` `form_lab_search` / `procedure_order.lab_id` filtering for matching and outside-lab cases, signing the report as `admin`, verifying the lab-filtered reviewed queue, and deleting the temporary order tree, encounter, and lab rows during cleanup so seeded lab counts remain stable.
- Shared procedure lab provider catalog plan now runs against the legacy target as the legacy half of Slice 139 side-by-side parity, using permanent gold-data `procedure_providers` rows `501` through `505` and seeded `procedure_order.lab_id` assignments to verify the reviewed queue for `MOD-PAT-0009`, order `5000009`, report `6000009`, and lab `504` (`Pacific Women's Health Laboratory`) through OpenEMR `list_reports.php` `form_lab_search` behavior.
- Shared procedure lab provider directory plan now runs against the legacy target as the legacy half of Slice 140 side-by-side parity, using the native OpenEMR `interface/orders/procedure_provider_list.php` page to verify the permanent provider names, NPI values, active-provider default filter, and balanced order/report/future-order counts through normalized database probes.
- Shared procedure lab provider lifecycle plan now runs against the legacy target as the legacy half of Slice 141 side-by-side parity, using temporary `procedure_providers` rows to verify create, active-list rendering, deactivate, include-inactive rendering, delete, and cleanup behavior through the native `procedure_provider_list.php` page and normalized workflow probes.
- Shared procedure lab provider configuration plan now runs against the legacy target as the legacy half of Slice 142 side-by-side parity, using temporary `procedure_providers` rows to verify protocol, `DorP` usage, direction, sender/receiver IDs, remote host, login/password, order/result paths, notes, browser rendering, delete, and cleanup behavior through the native `procedure_provider_list.php` page and normalized workflow probes.
- Shared procedure lab provider address-book plan now runs against the legacy target as the legacy half of Slice 144 side-by-side parity, using temporary `users` address-book rows with `abook_type LIKE 'ord_%'` and temporary `procedure_providers.lab_director` links to verify OpenEMR's organization-derived provider name behavior, update-to-second-organization behavior, native `Procedure Providers` rendering, and cleanup.
- Shared encounter document sign-off plan now runs against the legacy target as the legacy half of Slice 80 side-by-side parity, creating a temporary text `documents` row linked to MOD-PAT-0001 encounter 1000013, verifying pending state, signing it as `admin`, checking approved review metadata, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- Shared encounter document denial plan now runs against the legacy target as the legacy half of Slice 81 side-by-side parity, creating a temporary text `documents` row linked to MOD-PAT-0001 encounter 1000013, verifying pending state, setting denied review metadata through `audit_master_approval_status = 3`, checking normalized denied review facts, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- Shared encounter document metadata plan now runs against the legacy target as the legacy half of Slice 82 side-by-side parity, creating a temporary text `documents` row linked to MOD-PAT-0001 encounter 1000013, updating name, category, date, and notes while preserving the encounter link, checking normalized metadata facts plus legacy document-category rendering, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- Shared encounter document move plan now runs against the legacy target as the legacy half of Slice 83 side-by-side parity, creating a temporary text documents row linked to MOD-PAT-0001 encounter 1000013, moving it to same-patient encounter 1000011, checking normalized source/target attachment facts plus legacy document-category rendering, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- Shared encounter document content replacement plan now runs against the legacy target as the legacy half of Slice 84 side-by-side parity, creating a temporary text `documents` row linked to MOD-PAT-0001 encounter 1000013, replacing the stored payload in place, checking normalized content/revision facts plus legacy document-category rendering, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- Shared encounter document archive/restore plan now runs against the legacy target as the legacy half of Slice 85 side-by-side parity, creating a temporary text `documents` row linked to MOD-PAT-0001 encounter 1000013, archiving it through `documents.deleted`, checking active-detail hiding and archived-detail visibility, restoring it, checking normalized restored attachment facts plus legacy document-category rendering, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- Shared encounter document lifecycle timeline plan now runs against the legacy target as the legacy half of Slice 86 side-by-side parity, creating a temporary text `documents` row linked to MOD-PAT-0001 encounter 1000013, deriving filed/current-version/review/active/archive lifecycle state from existing legacy document fields, checking normalized lifecycle transitions, restoring it, checking legacy document-category rendering, and hard-deleting it during cleanup so the seeded document and encounter-attachment baseline remains stable.
- Shared binary patient-document mutation plan now runs against the legacy target as the legacy half of Slice 33 side-by-side parity, creating a temporary PDF-style document for `MOD-PAT-0001`, verifying document-list rendering, soft-deleting it, and hard-deleting it during cleanup.
- Shared patient image document preview plan now runs against the legacy target as the legacy half of Slice 88 side-by-side parity, creating a temporary `image/svg+xml` document for `MOD-PAT-0001`, verifying normalized image preview metadata and legacy document-list rendering, archiving it, and hard-deleting it during cleanup so the seeded 1,200-document baseline remains stable.
- Shared patient image document thumbnail plan now runs against the legacy target as the legacy half of Slice 89 side-by-side parity, creating a temporary `image/svg+xml` document for `MOD-PAT-0001`, verifying normalized stored-byte thumbnail data URI facts and legacy document-list rendering, archiving it, and hard-deleting it during cleanup so the seeded 1,200-document baseline remains stable.
- Shared patient PDF document inline-preview plan now runs against the legacy target as the legacy half of Slice 90 side-by-side parity, creating a temporary `application/pdf` document for `MOD-PAT-0001`, verifying normalized inline PDF preview metadata, byte-preserving content/download facts, and legacy document-list rendering, archiving it, and hard-deleting it during cleanup so the seeded 1,200-document baseline remains stable.
- Shared patient document lifecycle timeline plan now runs against the legacy target as the legacy half of Slice 91 side-by-side parity, creating a temporary text document for `MOD-PAT-0001`, deriving filed/current-version/review/active/archive lifecycle state from existing legacy document fields, signing, archiving, restoring, checking legacy document-list rendering, and hard-deleting it during cleanup so the seeded 1,200-document baseline remains stable.
- Shared patient scanned attachment plan now runs against the legacy target as the legacy half of Slice 92 side-by-side parity, creating a temporary scanned PDF document for `MOD-PAT-0001`, deriving scan status, capture source, scanned page count, and OCR status from existing legacy document notes/metadata, checking legacy document-list rendering, archiving it, and hard-deleting it during cleanup so the seeded 1,200-document baseline remains stable. Shared appointment reschedule plan now runs against the legacy target as the legacy half of Slice 93 side-by-side parity, creating a temporary future appointment for `MOD-PAT-0003`, updating its date/time/duration/status/room, checking legacy appointment edit rendering, and hard-deleting it during cleanup so seeded appointment counts remain stable. Shared appointment arrival plan now runs against the legacy target as the legacy half of Slice 94 side-by-side parity, creating a temporary future appointment for `MOD-PAT-0003`, marking it arrived with status `@`, checking legacy appointment edit rendering, and hard-deleting it during cleanup so seeded appointment counts remain stable. Shared appointment check-out plan now runs against the legacy target as the legacy half of Slice 95 side-by-side parity, creating a temporary future appointment for `MOD-PAT-0003`, marking it arrived with status `@`, checking it out with status `>`, checking legacy appointment edit rendering, and hard-deleting it during cleanup so seeded appointment counts remain stable. Shared appointment no-show plan now runs against the legacy target as the legacy half of Slice 96 side-by-side parity, creating a temporary future appointment for `MOD-PAT-0003`, marking it no-show with status `?`, checking legacy appointment edit rendering, and hard-deleting it during cleanup so seeded appointment counts remain stable. Shared appointment category plan now runs against the legacy target as the legacy half of Slice 97 side-by-side parity, creating a temporary future appointment for `MOD-PAT-0003` with category `13`, verifying the legacy `form_category` control, updating the appointment to category `10`, and hard-deleting it during cleanup so seeded appointment counts remain stable. Shared appointment pending-status plan now runs against the legacy target as the legacy half of Slice 98 side-by-side parity, creating a temporary future appointment for `MOD-PAT-0003`, updating it to status `~`, verifying the legacy `form_apptstatus` control, and hard-deleting it during cleanup so seeded appointment counts remain stable. Shared appointment provider reassignment plan now runs against the legacy target as the legacy half of Slice 99 side-by-side parity, creating a temporary future appointment for `MOD-PAT-0003`, updating `form_provider` from provider `101` to provider `102`, verifying the legacy provider control, and hard-deleting it during cleanup so seeded appointment counts remain stable. Shared appointment facility reassignment plan now runs against the legacy target as the legacy half of Slice 100 side-by-side parity, creating a temporary future appointment for `MOD-PAT-0003`, updating the legacy `facility` select from `10` to `11`, verifying the facility control, and hard-deleting it during cleanup so seeded appointment counts remain stable. Shared appointment billing-location reassignment plan now runs against the legacy target as the legacy half of Slice 101 side-by-side parity, creating a temporary future appointment for `MOD-PAT-0003`, keeping the legacy `facility` select at `10`, updating `billing_facility` from `10` to `11`, verifying both controls, and hard-deleting it during cleanup so seeded appointment counts remain stable. Shared appointment comments plan now runs against the legacy target as the legacy half of Slice 102 side-by-side parity, creating a temporary future appointment for `MOD-PAT-0003`, verifying `pc_hometext` and legacy `form_comments` rendering, updating the comment, and hard-deleting it during cleanup so seeded appointment counts remain stable. Shared appointment recurrence metadata plan now runs against the legacy target as the legacy half of Slice 103 side-by-side parity, creating a temporary future appointment for `MOD-PAT-0003`, verifying regular repeat metadata in `pc_recurrtype`, `pc_recurrspec`, `pc_endDate`, and legacy repeat controls, updating the cadence and recurrence end date, and hard-deleting it during cleanup so seeded appointment counts remain stable. Shared appointment recurring-series plan now runs against the legacy target as the legacy half of Slice 104 side-by-side parity, expanding the seeded `MOD-PAT-0003` preventive-care recurrence anchor from `pc_recurrspec` / `pc_endDate` into dated occurrences from `2026-08-14` through `2026-10-09` without changing seeded rows.
- Shared appointment recurrence-exceptions plan now runs against the legacy target as the legacy half of Slice 105 side-by-side parity, expanding seeded `MOD-PAT-0013` recurrence metadata from `pc_recurrspec` / `pc_endDate`, honoring the `exdate` skip on `2026-12-16`, and verifying the dated occurrences `2026-12-02`, `2026-12-30`, `2027-01-13`, and `2027-01-27` without changing seeded rows.
- Shared appointment occurrence-cancel plan now runs against the legacy target as the legacy half of Slice 106 side-by-side parity, appending `2026-12-30` to the seeded `MOD-PAT-0013` `pc_recurrspec` `exdate` list, verifying the generated occurrence disappears while occurrence numbers remain `3`, `6`, and `7`, and restoring the original single `2026-12-16` exception during cleanup.
- Shared appointment occurrence-restore plan now runs against the legacy target as the legacy half of Slice 107 side-by-side parity, temporarily appending `2026-12-30` to the seeded `MOD-PAT-0013` `pc_recurrspec` `exdate` list, removing it to restore the generated occurrence, verifying occurrence dates and numbers return to `2026-12-02`, `2026-12-30`, `2027-01-13`, `2027-01-27` and `3`, `5`, `6`, `7`, and restoring the original single `2026-12-16` exception during cleanup.
- Shared appointment occurrence-reschedule plan now runs against the legacy target as the legacy half of Slice 108 side-by-side parity, appending `2026-12-30` to the seeded `MOD-PAT-0013` `pc_recurrspec` `exdate` list, creating a standalone `2027-01-06 14:00` preventive-care appointment, verifying the generated series keeps occurrence numbers `3`, `6`, and `7`, and deleting the standalone row plus restoring the original single `2026-12-16` exception during cleanup.
- Shared appointment recurrence exception-edit plan now runs against the legacy target as the legacy half of Slice 109 side-by-side parity, editing the seeded `MOD-PAT-0013` `pc_recurrspec` `exdate` list to include `2026-12-30`, verifying the generated `2026-12-30` occurrence disappears while later occurrence numbers remain `6` and `7`, and restoring the original single `2026-12-16` exception during cleanup.
- Shared appointment series root update plan now runs against the legacy target as the legacy half of Slice 110 side-by-side parity, editing the seeded `MOD-PAT-0013` recurring root title/time to `Preventive Care Root Update` at `16:15`, verifying generated occurrences inherit those root values while occurrence numbers remain `1`, `2`, `3`, `5`, `6`, and `7`, and restoring the original `Preventive Care` root at `15:30` plus the single `2026-12-16` exception during cleanup.
- Shared appointment series root metadata plan now runs against the legacy target as the legacy half of Slice 111 side-by-side parity, editing the seeded `MOD-PAT-0013` recurring root provider/facility/category/status/room/comment metadata, verifying generated occurrences inherit those root values while occurrence numbers remain `1`, `2`, `3`, `5`, `6`, and `7`, and restoring the original provider `102`, facility `11`, billing location `11`, category `13`, status `-`, room `Room 5`, comments, and single `2026-12-16` exception during cleanup.
- Shared appointment monthly recurrence plan now runs against the legacy target as the legacy half of Slice 112 side-by-side parity, creating a temporary monthly recurring appointment for `MOD-PAT-0003`, updating it to every two months, verifying the legacy repeat controls and generated occurrence expansion, and hard-deleting it during cleanup so seeded appointment counts remain stable.
- Shared appointment recurrence unit matrix plan now runs against the legacy target as the legacy half of Slice 113 side-by-side parity, creating temporary daily, workday, and yearly recurring appointments for `MOD-PAT-0003`, verifying legacy repeat controls and generated occurrence expansion, and hard-deleting them during cleanup so seeded appointment counts remain stable.
- Shared appointment days-of-week recurrence plan now runs against the legacy target as the legacy half of Slice 114 side-by-side parity, creating a temporary Monday/Wednesday/Friday recurring appointment for `MOD-PAT-0003`, verifying OpenEMR `REPEAT_DAYS` weekday serialization and checkbox controls, verifying generated occurrence expansion, and hard-deleting it during cleanup so seeded appointment counts remain stable.
- Shared appointment monthly repeat-on recurrence plan now runs against the legacy target as the legacy half of Slice 115 side-by-side parity, creating temporary second-Tuesday and last-Friday monthly recurring appointments for `MOD-PAT-0003`, verifying OpenEMR `REPEAT_ON` serialization through `event_repeat_on_num`, `event_repeat_on_day`, `event_repeat_on_freq`, and repeat form types `5` and `6`, verifying generated occurrence expansion, and hard-deleting them during cleanup so seeded appointment counts remain stable.
- Shared appointment series recurrence update plan now runs against the legacy target as the legacy half of Slice 116 side-by-side parity, temporarily editing seeded recurring root `APPT-MOD-PAT-0013-3` from every two weeks through `2027-01-27` to every three weeks through `2027-02-10`, verifying legacy repeat controls, generated occurrence expansion, skipped-date preservation, and restoring the seeded recurrence during cleanup.
- Shared appointment provider overlap plan now runs against the legacy target as the legacy half of Slice 117 side-by-side parity, creating two temporary same-provider appointments for `MOD-PAT-0003` and `MOD-PAT-0004` at `2026-12-04 09:00`, verifying legacy OpenEMR allows the overlap and renders both distinct appointments, and hard-deleting both rows during cleanup.
- Shared appointment patient overlap plan now runs against the legacy target as the legacy half of Slice 118 side-by-side parity, creating two temporary same-patient appointments for `MOD-PAT-0003` at `2026-12-05 09:00` with providers `101` and `102`, verifying legacy OpenEMR allows the overlap and renders both distinct appointments, and hard-deleting both rows during cleanup.
- Shared appointment room overlap plan now runs against the legacy target as the legacy half of Slice 119 side-by-side parity, creating two temporary same-room appointments for `MOD-PAT-0003` and `MOD-PAT-0004` at `2026-12-06 09:00` in `Parity Room Overlap`, verifying legacy OpenEMR allows the overlap and renders both distinct appointments, and hard-deleting both rows during cleanup.
- Shared appointment reminders plan now runs against the legacy target as the legacy half of Slice 120 side-by-side parity, deriving due-now reminder readiness from `MOD-PAT-0191` appointment `APPT-MOD-PAT-0191-3` on `2026-06-25`, seeded SMS/email consent and contact values, the legacy numeric `pc_eid` plus canonical note key `MOD-PAT-0191-3`, and browser-visible baseline appointment rendering.
- Shared insurance coverage plan now runs against the legacy target as the legacy half of Slice 28 side-by-side parity, covering primary and secondary seeded coverage comparison for `MOD-PAT-0005`.
- Shared immunizations plan now runs against the legacy target as the legacy half of Slice 29 side-by-side parity, covering seeded pediatric vaccine-history comparison for `MOD-PAT-0007` through OpenEMR's native Immunizations page.
- Shared immunization mutation plan now runs against the legacy target as the legacy half of Slice 30 side-by-side parity, creating a temporary influenza immunization for `MOD-PAT-0007`, verifying OpenEMR Immunizations page rendering, marking it entered in error, and hard-deleting it during cleanup.
- Shared problem-list mutation plan now runs against the legacy target as the legacy half of Slice 31 side-by-side parity, creating a temporary medical problem for `MOD-PAT-0006`, verifying patient-summary rendering, deactivating it, and hard-deleting it during cleanup.
- Shared medication-list mutation plan now runs against the legacy target as the legacy half of Slice 32 side-by-side parity, creating a temporary medication list entry for `MOD-PAT-0006`, verifying patient-summary rendering, deactivating it, and hard-deleting it during cleanup.
- Shared insurance mutation plan now runs against the legacy target as the legacy half of Slice 34 side-by-side parity, creating a temporary tertiary coverage row for `MOD-PAT-0005`, verifying insurance rendering, updating payer/plan/policy/group values, and hard-deleting it during cleanup.
- Shared encounter metadata mutation plan now runs against the legacy target as the legacy half of Slice 35 side-by-side parity, creating a temporary encounter for `MOD-PAT-0002`, verifying sensitivity/referral/external-ID/POS metadata, updating metadata values, and hard-deleting it during cleanup.
- Shared patient demographics mutation plan now runs against the legacy target as the legacy half of Slice 36 side-by-side parity, updating `MOD-PAT-0010` identity, DOB, address, marital-status, and occupation fields, verifying normalized row state plus the demographics fields rendered by OpenEMR's summary/edit surfaces, and restoring the seeded demographics during cleanup.
- Shared patient registration plan now runs against the legacy target as the legacy half of Slice 37 side-by-side parity, creating a temporary `TMP-PAT-REG-*` `patient_data` row, verifying normalized demographics/contact row state plus browser-visible chart rendering, and hard-deleting the temporary patient during cleanup so the seeded 1,000-patient baseline remains stable.
- Shared document sign-off plan now runs against the legacy target as the legacy half of Slice 38 side-by-side parity, creating a temporary database-backed `documents` row, verifying pending approval state, setting `audit_master_approval_status = 2` to represent approved sign-off, verifying browser-visible document rendering, then archiving and hard-deleting the temporary document during cleanup so the seeded 1,200-document baseline remains stable.
- Shared document external-link plan now runs against the legacy target as the legacy half of Slice 39 side-by-side parity, creating a temporary `documents` row with `type = web_url`, verifying normalized URL/storage metadata and browser-visible document rendering, then archiving and hard-deleting the temporary document during cleanup so the seeded 1,200-document baseline remains stable.
- Shared document denial plan now runs against the legacy target as the legacy half of Slice 40 side-by-side parity, creating a temporary database-backed `documents` row, setting `audit_master_approval_status = 3` to represent denied review, verifying normalized denied review metadata and browser-visible document rendering, then archiving and hard-deleting the temporary document during cleanup so the seeded 1,200-document baseline remains stable.
- Shared document metadata plan now runs against the legacy target as the legacy half of Slice 41 side-by-side parity, creating a temporary database-backed `documents` row, updating `documents.name`, `documents.docdate`, `documents.encounter_id`, `documents.documentationOf`, and `categories_to_documents.category_id`, verifying normalized refiled metadata and browser-visible document rendering, then archiving and hard-deleting the temporary document during cleanup so the seeded 1,200-document baseline remains stable.
- Shared document archive restore plan now runs against the legacy target as the legacy half of Slice 42 side-by-side parity, creating a temporary database-backed `documents` row, setting `documents.deleted = 1`, verifying active-document hiding and inaccessible content, restoring `documents.deleted = 0`, verifying browser-visible document rendering, and hard-deleting the temporary document during cleanup so the seeded 1,200-document baseline remains stable.
- Shared document content replacement plan now runs against the legacy target as the legacy half of Slice 43 side-by-side parity, creating a temporary database-backed `documents` row, replacing `documents.document_data`, `documents.size`, `documents.hash`, and `documents.revision`, verifying active document counts and browser-visible document rendering, then archiving and hard-deleting the temporary document during cleanup so the seeded 1,200-document baseline remains stable.
- Shared document replacement revision plan now runs against the legacy target as the legacy half of Slice 55 side-by-side parity, creating a temporary database-backed `documents` row, capturing the current `documents.revision` and `documents.hash`, replacing the payload, verifying `documents.revision` advances and the hash changes in place, then archiving and hard-deleting the temporary document during cleanup so the seeded 1,200-document baseline remains stable.
- Shared payment posting mutation plan now runs against the legacy target as the legacy half of Slice 56 side-by-side parity, creating a temporary OpenEMR `ar_session` and `ar_activity` row for `MOD-PAT-0005`, verifying active payment, account balance, and ledger effects, voiding the posting through `ar_activity.deleted`, and hard-deleting the temporary AR rows during cleanup so the seeded 420 payment sessions and 617 payment activities remain stable.
- Shared claim status mutation plan now runs against the legacy target as the legacy half of Slice 57 side-by-side parity, creating a temporary OpenEMR `claims` row for `MOD-PAT-0005`, verifying queued, generated, and cleared states, and hard-deleting the temporary claim row during cleanup so the seeded 700 claim status rows remain stable.
- Shared patient payment capture plan now runs against the legacy target as the legacy half of Slice 58 side-by-side parity, creating a temporary OpenEMR `ar_session` and `ar_activity` row for `MOD-PAT-0005` with `payer_id = 0` and `payer_type = 0`, verifying active patient payment, account balance, and ledger effects, voiding the posting through `ar_activity.deleted`, and hard-deleting the temporary AR rows during cleanup so the seeded 420 payment sessions and 617 payment activities remain stable.
- Shared statement generation plan now runs against the legacy target as the legacy half of Slice 59 side-by-side parity, deriving a printable patient statement document from `MOD-PAT-0005` demographics, statement readiness facts, and chronological ledger entries with statement number `STMT-MOD-PAT-0005-20260625`, 10 line items, payment instructions, and `$364.75` balance due.
- Shared statement PDF export plan now runs against the legacy target as the legacy half of Slice 60 side-by-side parity, deriving the same statement number, payment instructions, totals, `Northstar HMO insurance payment`, and `EOB-NSTAR-1000052` facts that the modernized target exports as `STMT-MOD-PAT-0005-20260625.pdf`.
- Shared statement batch candidate plan now runs against the legacy target as the legacy half of Slice 61 side-by-side parity, ranking positive-balance patient accounts by past-due amount, balance, oldest open age, and legacy PID so the modernized Fees work queue can be checked against the same full-population ledger contract.
- Shared statement batch package plan now runs against the legacy target as the legacy half of Slice 62 side-by-side parity, deriving the expected package manifest, summary CSV, and included statement PDF filenames from the same ranked statement candidates.
- Shared collections work queue plan now runs against the legacy target as the legacy half of Slice 63 side-by-side parity, deriving the expected past-due account queue, over-90 exposure, priority tier, recommended action, and contact method from OpenEMR billing and AR activity rows.
- Shared collections follow-up task plan now runs against the legacy target as the legacy half of Slice 64 side-by-side parity, creating pnotes-compatible billing follow-up tasks from the collections queue, verifying browser-visible pnotes rendering, closing, archiving, and hard-deleting the temporary rows during cleanup.
- Shared patient-message assignment plan now runs against the legacy target as the legacy half of Slice 65 side-by-side parity, reassigning temporary pnotes-compatible messages from `admin` to `billing`, verifying browser-visible pnotes rendering, and cleaning up without changing the seeded message count.
- Shared patient-message content plan now runs against the legacy target as the legacy half of Slice 66 side-by-side parity, editing temporary pnotes-compatible message titles and bodies, verifying browser-visible pnotes rendering, and cleaning up without changing the seeded message count.
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
- Payment postings: 617 total seeded OpenEMR AR activity rows, including 422 posted in 2026 and a `MOD-PAT-0005` anchor with `EOB-NSTAR-1000052`, payment `$126.00`, adjustment `$42.00`, and reason `CO-45`.
- Account balances: `MOD-PAT-0005` has repeatable charge/payment/adjustment rollups with patient totals of `$635.00` charges, `$206.00` paid, `$64.25` adjusted, and `$364.75` remaining balance. Encounter `1000052` anchors the slice with `$186.00` charges, `$126.00` paid, `$42.00` adjusted, and `$18.00` remaining balance.

`Seed-LegacyGoldDataset.ps1` now validates the generated temporal coverage contract after applying the seed, so count and date-coverage regressions are both caught by the same legacy seed action.

## Current Gaps

- The modernized PostgreSQL seed adapter now exists for patient, insurance coverage, immunization history, scheduling, encounter, encounter metadata, encounter billing linkage, encounter billing linkage mutation visibility, encounter fee-sheet entry behavior, encounter procedure-order entry behavior, encounter procedure-result entry behavior, encounter sign-off behavior, encounter co-signature behavior, encounter document revision behavior, encounter document replacement revision behavior, encounter document upload behavior, encounter binary document upload behavior, encounter document sign-off behavior, encounter document denial behavior, encounter document metadata refiling behavior, encounter document move behavior, encounter document content replacement behavior, encounter document archive/restore behavior, encounter document lifecycle timeline behavior, encounter claim linkage, encounter procedure order linkage, encounter diagnosis coding linkage, encounter diagnosis coding mutation visibility, clinical-list, messaging, procedure-result, pending procedure-order, fee-sheet billing, claim status, payment posting, account balance, account aging, account ledger, account statement readiness, patient statement generation, administration directory, access-control, operational reporting, patient documents, patient document content retrieval, patient document preview readiness, patient image document preview behavior, patient image document thumbnail behavior, patient PDF document inline-preview behavior, patient document lifecycle timeline behavior, patient document scanned attachment readiness, patient document revision readiness, contact mutation, patient demographics mutation, patient registration lifecycle behavior, patient insurance mutation, appointment mutation, appointment reschedule behavior, appointment arrival behavior, appointment check-out behavior, appointment no-show behavior, appointment category behavior, appointment pending-status behavior, appointment provider reassignment behavior, appointment facility reassignment behavior, appointment billing-location reassignment behavior, appointment comments behavior, appointment recurrence metadata behavior, appointment recurring-series behavior, appointment series root update behavior, appointment series root metadata behavior, appointment monthly recurrence behavior, appointment recurrence unit matrix behavior, appointment days-of-week recurrence behavior, appointment monthly repeat-on recurrence behavior, appointment series recurrence update behavior, appointment provider overlap behavior, appointment patient overlap behavior, appointment room overlap behavior, appointment reminder readiness behavior, encounter mutation, clinical-list allergy mutation, problem-list mutation, medication-list mutation, patient-message mutation, text patient-document mutation, binary patient-document mutation, patient-document sign-off mutation, patient-document denial mutation, patient-document metadata mutation, patient-document archive restore mutation, patient-document content replacement mutation, patient-document replacement revision mutation, external-link patient-document mutation, prescription mutation, immunization mutation, billing mutation, billing diagnosis mutation, billing correction mutation, billing modifier mutation, payment posting mutation, claim status mutation, patient payment capture behavior, procedure mutation, procedure result correction, procedure specimen readiness, procedure specimen detail readiness, procedure order correction, admin facility mutation, admin user mutation, access-permission mutation, user group membership mutation, and supporting gold-data tables; additional mutation-oriented seed and workflow behavior will expand slice by slice.
- Modernized parity adapters now exist for normalized PostgreSQL probes and Playwright checks covering patient search/chart summary, read-only insurance coverage facts, read-only immunization history facts, read-only scheduling, read-only encounter SOAP/vitals detail, read-only encounter billing linkage facts, encounter billing linkage mutation behavior, encounter fee-sheet entry behavior, encounter procedure-order entry behavior, encounter procedure-result entry behavior, encounter sign-off behavior, encounter co-signature behavior, encounter document revision behavior, encounter document replacement revision behavior, encounter document upload behavior, encounter binary document upload behavior, encounter document sign-off behavior, encounter document denial behavior, encounter document metadata behavior, encounter document move behavior, encounter document content replacement behavior, encounter document archive/restore behavior, encounter document lifecycle timeline behavior, read-only encounter claim linkage facts, read-only encounter procedure order linkage facts, read-only encounter diagnosis coding facts, encounter diagnosis coding mutation behavior, encounter metadata mutation behavior, read-only clinical-list facts, read-only patient-message facts, read-only completed procedure results, read-only pending/scheduled procedure orders, read-only fee-sheet billing facts, read-only claim status facts, read-only payment posting facts, read-only account balance facts, read-only account aging facts, read-only account ledger facts, read-only account statement readiness facts, read-only patient statement generation facts, read-only administration directory facts, read-only access-control facts, read-only operational report facts, read-only patient document facts, read-only patient document content facts, read-only patient document preview facts, patient image document preview behavior, patient image document thumbnail behavior, patient PDF document inline-preview behavior, patient document lifecycle timeline behavior, patient scanned attachment behavior, read-only patient document revision facts, patient contact mutation behavior, patient demographics mutation behavior, patient registration behavior, patient insurance mutation behavior, appointment mutation behavior, appointment reschedule behavior, appointment arrival behavior, appointment check-out behavior, appointment no-show behavior, appointment category behavior, appointment pending-status behavior, appointment provider reassignment behavior, appointment facility reassignment behavior, appointment billing-location reassignment behavior, appointment comments behavior, appointment recurrence metadata behavior, appointment recurring-series behavior, appointment monthly recurrence behavior, appointment recurrence unit matrix behavior, appointment days-of-week recurrence behavior, appointment monthly repeat-on recurrence behavior, appointment series recurrence update behavior, appointment provider overlap behavior, appointment patient overlap behavior, appointment room overlap behavior, appointment reminder readiness behavior, encounter mutation behavior, clinical-list allergy mutation behavior, problem-list mutation behavior, medication-list mutation behavior, patient-message mutation behavior, text patient-document mutation behavior, binary patient-document mutation behavior, patient-document sign-off behavior, patient-document denial behavior, patient-document metadata behavior, patient-document archive restore behavior, patient-document content replacement behavior, patient-document replacement revision behavior, external-link patient-document behavior, prescription mutation behavior, immunization mutation behavior, billing mutation behavior, billing diagnosis mutation behavior, billing correction mutation behavior, billing modifier mutation behavior, payment posting mutation behavior, claim status mutation behavior, patient payment capture behavior, procedure mutation behavior, procedure result correction behavior, procedure specimen readiness behavior, procedure specimen detail behavior, procedure order correction behavior, admin facility mutation behavior, admin user mutation behavior, access-permission mutation behavior, and user group membership mutation behavior; broader mutation workflow adapters remain future work.
- Slice 131 extends both adapter families with procedure specimen detail readiness for temporary `procedure_specimen` / `lab_specimens` rows, including specimen identifiers, accession identifiers, collection facts, volume, condition, comments, UI rendering, and cleanup verification.
- Slice 132 extends both adapter families with procedure order correction readiness for temporary `procedure_order` / `lab_orders` rows, including corrected date, code, name, type, diagnosis, priority, status, instructions, UI rendering, post-correction result visibility, and cleanup verification.
- Slice 133 extends both adapter families with procedure report correction readiness for temporary `procedure_report` / `lab_reports` rows, including corrected collected date, report date, specimen number, report status, review status, notes, UI rendering, linked result preservation, and cleanup verification.
- Slice 134 extends both adapter families with procedure report sign-off readiness for temporary `procedure_report` / `lab_reports` rows, including normalized signed reviewer, signed timestamp, reviewed status, UI rendering, linked result preservation, and cleanup verification.
- Slice 135 extends both adapter families with procedure report review queue readiness for temporary `procedure_report` / `lab_reports` rows, including unreviewed/reviewed queue membership, queue counts, report metadata, reviewer transition, UI rendering, and cleanup verification.
- Slice 136 extends both adapter families with procedure report review queue patient/date filter readiness for temporary `procedure_report` / `lab_reports` rows, including matching patient/order-date inclusion, outside-date exclusion, reviewed queue transition, UI rendering, and cleanup verification.
- Slice 137 extends both adapter families with procedure report review queue provider filter readiness for temporary `procedure_report` / `lab_reports` rows, including matching provider inclusion, outside-provider exclusion, reviewed queue transition, UI rendering, and cleanup verification.
- Slice 138 extends both adapter families with procedure report review queue lab filter readiness for temporary `procedure_report` / `lab_reports` rows, including matching lab inclusion, outside-lab exclusion, reviewed queue transition, UI rendering, temporary lab-provider cleanup, and procedure cleanup verification.
- Slice 139 extends both seed families with permanent procedure lab-provider catalog readiness for seeded `procedure_order.lab_id` / `lab_orders.lab_id` rows, including reviewed queue inclusion for the `MOD-PAT-0009` anchor, outside-lab exclusion, and browser-visible queue rendering.
- Slice 140 extends both seed families with procedure lab-provider directory readiness over the same permanent five-provider catalog, including active filtering, NPI display, OpenEMR's default `DL` protocol value, and balanced order/report/future-order counts.
- Slice 141 extends both seed families with temporary procedure lab-provider lifecycle readiness, including provider creation, deactivation, include-inactive rendering, deletion, cleanup, and modernized protocol persistence aligned with legacy `procedure_providers.protocol`.
- Slice 142 extends both seed families with temporary procedure lab-provider configuration readiness, including usage/direction, sender/receiver IDs, remote host, login/password, order/result paths, notes, cleanup, and modernized persistence aligned with legacy `procedure_providers` transport fields.
- Slice 144 extends both seed families with temporary procedure lab-provider address-book linkage readiness, including legacy `users.abook_type LIKE 'ord_%'`, `procedure_providers.lab_director`, modernized `lab_provider_address_book`, nullable `lab_providers.lab_director_id`, organization-derived provider names, rendering, and cleanup.
- The OpenEMR-native PHPUnit stable lane is runnable and verified, but the full upstream isolated suite remains environment-sensitive on the Windows bind-mounted checkout.
- OpenEMR-native Panther browser tests have not been wired into the Workbench yet.
- The parent project is connected to GitHub at `https://github.com/nkimber/OpenEMR-Legacy.git`.
- The first Modernization Workbench version has been implemented and can manage this baseline locally.
