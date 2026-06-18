$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$workbenchRoot = Join-Path $repoRoot "modernization-workbench"

if (-not (Test-Path (Join-Path $workbenchRoot "node_modules"))) {
    Push-Location $workbenchRoot
    try {
        npm install
    } finally {
        Pop-Location
    }
}

Push-Location $workbenchRoot
try {
    $env:WORKBENCH_REPO_ROOT = $repoRoot
    npm run dev
} finally {
    Pop-Location
}
