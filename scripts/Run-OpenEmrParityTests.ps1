param(
    [ValidateSet("legacy-openemr", "modernized-openemr")]
    [string] $Target = "legacy-openemr",

    [ValidateSet("all", "database", "http", "ui", "workflow")]
    [string] $Suite = "all",

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
        "--target", $Target,
        "--suite", $Suite,
        "--reset", $Reset
    )

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
