param(
    [ValidateSet("legacy-openemr", "modernized-openemr")]
    [string] $Target = "legacy-openemr",

    [ValidateSet(
        "all",
        "database",
        "http",
        "ui",
        "workflow",
        "slice1",
        "scheduling",
        "encounters",
        "clinical-lists",
        "messages",
        "documents",
        "encounter-documents",
        "encounter-document-revision",
        "encounter-billing",
        "encounter-claims",
        "encounter-procedures",
        "encounter-diagnoses",
        "document-content",
        "document-preview",
        "document-revision",
        "insurance",
        "immunizations",
        "procedures",
        "procedure-pending-orders",
        "billing",
        "claims",
        "payments",
        "account-balance",
        "account-aging",
        "account-ledger",
        "account-statement",
        "account-statement-generation",
        "account-statement-pdf",
        "account-statement-batch",
        "account-statement-batch-package",
        "account-collections-work-queue",
        "account-collections-follow-up",
        "admin",
        "reports",
        "reports-export",
        "admin-access-control",
        "workflow-contact",
        "workflow-demographics",
        "workflow-registration",
        "workflow-appointments",
        "workflow-appointment-reschedule",
        "workflow-appointment-arrival",
        "workflow-appointment-checkout",
        "workflow-appointment-noshow",
        "workflow-appointment-category",
        "workflow-appointment-pending",
        "workflow-appointment-provider",
        "workflow-appointment-facility",
        "workflow-appointment-billing-location",
        "workflow-appointment-comments",
        "workflow-appointment-recurrence",
        "workflow-appointment-series",
        "workflow-appointment-recurrence-exceptions",
        "workflow-appointment-occurrence-cancel",
        "workflow-appointment-occurrence-restore",
        "workflow-appointment-occurrence-reschedule",
        "workflow-appointment-recurrence-exception-edit",
        "workflow-appointment-series-root-update",
        "workflow-appointment-series-root-metadata",
        "workflow-appointment-monthly-recurrence",
        "workflow-appointment-recurrence-unit-matrix",
        "workflow-appointment-days-of-week-recurrence",
        "workflow-appointment-monthly-repeat-on-recurrence",
        "workflow-appointment-series-recurrence-update",
        "workflow-appointment-provider-overlap",
        "workflow-appointment-patient-overlap",
        "workflow-appointment-room-overlap",
        "workflow-appointment-reminders",
        "workflow-encounters",
        "workflow-encounter-metadata",
        "workflow-encounter-billing",
        "workflow-encounter-diagnoses",
        "workflow-encounter-fee-sheet",
        "workflow-encounter-procedures",
        "workflow-encounter-procedure-results",
        "workflow-encounter-signoff",
        "workflow-encounter-cosignature",
        "workflow-encounter-documents",
        "workflow-encounter-binary-documents",
        "workflow-encounter-document-scanned-attachment",
        "workflow-encounter-document-signoff",
        "workflow-encounter-document-denial",
        "workflow-encounter-document-metadata",
        "workflow-encounter-document-move",
        "workflow-encounter-document-content-replace",
        "workflow-encounter-document-binary-content-replace",
        "workflow-encounter-document-revision-replace",
        "workflow-encounter-document-archive",
        "workflow-encounter-document-lifecycle",
        "workflow-encounter-document-external-link",
        "workflow-clinical-lists",
        "workflow-problems",
        "workflow-medications",
        "workflow-messages",
        "workflow-message-assignment",
        "workflow-message-content",
        "workflow-documents",
        "workflow-document-binary",
        "workflow-document-binary-content-replace",
        "workflow-document-image-preview",
        "workflow-document-image-thumbnail",
        "workflow-document-pdf-preview",
        "workflow-document-lifecycle",
        "workflow-document-scanned-attachment",
        "workflow-document-signoff",
        "workflow-document-external-link",
        "workflow-document-denial",
        "workflow-document-metadata",
        "workflow-document-archive",
        "workflow-document-content-replace",
        "workflow-document-revision-replace",
        "workflow-insurance",
        "workflow-prescriptions",
        "workflow-immunizations",
        "workflow-billing",
        "workflow-billing-diagnosis",
        "workflow-billing-correction",
        "workflow-billing-modifier",
        "workflow-payment-posting",
        "workflow-claims",
        "workflow-patient-payments",
        "workflow-procedures",
        "workflow-procedure-result-correction",
        "workflow-procedure-specimen",
        "workflow-procedure-specimen-detail",
        "workflow-procedure-order-correction",
        "workflow-procedure-report-correction",
        "workflow-procedure-report-signoff",
        "workflow-procedure-report-review-queue",
        "workflow-admin",
        "workflow-admin-users",
        "workflow-admin-access",
        "workflow-admin-memberships"
    )]
    [string] $Suite = "all",

    [string] $Plan = "",

    [ValidateSet("none", "run", "suite", "test")]
    [string] $Reset = "run",

    [switch] $Headed,

    [string] $Grep = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$parityRoot = Join-Path $repoRoot "parity-tests"

if (-not (Test-Path (Join-Path $parityRoot "package.json"))) {
    throw "Missing parity test project at $parityRoot."
}

Push-Location $parityRoot
try {
    $arguments = @(
        "tsx",
        "src/cli/run-tests.ts",
        "--target", $Target
    )

    if ($Plan) {
        $arguments += @("--plan", $Plan)
    } else {
        $arguments += @("--suite", $Suite)
    }

    if ($Reset) {
        $arguments += @("--reset", $Reset)
    }

    if ($Headed) {
        $arguments += "--headed"
    }

    if ($Grep) {
        $arguments += @("--grep", $Grep)
    }

    & npx @arguments
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
