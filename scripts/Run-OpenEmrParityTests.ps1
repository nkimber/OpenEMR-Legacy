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
        "procedures",
        "procedure-pending-orders",
        "billing",
        "admin",
        "reports",
        "reports-export",
        "admin-access-control",
        "workflow-contact",
        "workflow-appointments",
        "workflow-encounters",
        "workflow-clinical-lists",
        "workflow-messages",
        "workflow-documents",
        "workflow-prescriptions",
        "workflow-billing",
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
