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
        "admin",
        "reports",
        "reports-export",
        "admin-access-control",
        "workflow-contact",
        "workflow-demographics",
        "workflow-registration",
        "workflow-appointments",
        "workflow-encounters",
        "workflow-encounter-metadata",
        "workflow-clinical-lists",
        "workflow-problems",
        "workflow-medications",
        "workflow-messages",
        "workflow-documents",
        "workflow-document-binary",
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
