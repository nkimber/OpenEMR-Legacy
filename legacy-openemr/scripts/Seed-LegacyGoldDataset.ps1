param(
    [string] $OutputPath = "artifacts/latest-gold-seed-result.json"
)

$ErrorActionPreference = "Stop"

function Read-EnvFile {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    $values = @{}
    Get-Content -Path $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $index = $line.IndexOf("=")
            $values[$line.Substring(0, $index)] = $line.Substring($index + 1)
        }
    }
    return $values
}

function Invoke-OpenEmrSql {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Sql
    )

    $arguments = @(
        "compose",
        "exec",
        "-T",
        "mysql",
        "mariadb",
        "-N",
        "-B",
        "-u",
        $script:dbUser,
        "-p$script:dbPassword",
        $script:dbName
    )

    $output = $Sql | & docker @arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "SQL command failed with exit code $LASTEXITCODE. Output: $($output -join [Environment]::NewLine)"
    }
    return $output
}

function Invoke-OpenEmrSqlFile {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    Get-Content -Path $Path -Raw | & docker compose exec -T mysql mariadb -u $script:dbUser "-p$script:dbPassword" $script:dbName 2>&1 | Tee-Object -Variable output | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "SQL file failed with exit code $LASTEXITCODE. Output: $($output -join [Environment]::NewLine)"
    }
}

function Get-CountMap {
    $countSql = @"
SELECT 'patients', COUNT(*) FROM patient_data
UNION ALL SELECT 'providersAndStaff', COUNT(*) FROM users WHERE username LIKE 'gold-%'
UNION ALL SELECT 'facilities', COUNT(*) FROM facility WHERE id IN (10, 11, 12)
UNION ALL SELECT 'insuranceRecords', COUNT(*) FROM insurance_data
UNION ALL SELECT 'appointments', COUNT(*) FROM openemr_postcalendar_events
UNION ALL SELECT 'encounters', COUNT(*) FROM form_encounter
UNION ALL SELECT 'vitals', COUNT(*) FROM form_vitals
UNION ALL SELECT 'clinicalNotes', COUNT(*) FROM form_soap
UNION ALL SELECT 'problems', COUNT(*) FROM lists WHERE type = 'medical_problem'
UNION ALL SELECT 'allergies', COUNT(*) FROM lists WHERE type = 'allergy'
UNION ALL SELECT 'medicationListEntries', COUNT(*) FROM lists WHERE type = 'medication'
UNION ALL SELECT 'medicationsAndPrescriptions', COUNT(*) FROM prescriptions
UNION ALL SELECT 'labOrders', COUNT(*) FROM procedure_order
UNION ALL SELECT 'labReports', COUNT(*) FROM procedure_report
UNION ALL SELECT 'labResults', COUNT(*) FROM procedure_result
UNION ALL SELECT 'messages', COUNT(*) FROM pnotes
UNION ALL SELECT 'billingLineItems', COUNT(*) FROM billing
UNION ALL SELECT 'portalPatients', COUNT(*) FROM patient_data WHERE allow_patient_portal = 'YES';
"@

    $map = [ordered]@{}
    Invoke-OpenEmrSql -Sql $countSql | ForEach-Object {
        $parts = $_ -split "`t"
        $map[$parts[0]] = [int] $parts[1]
    }
    return $map
}

$startedAt = Get-Date
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$baselineDirectory = Resolve-Path (Join-Path $scriptDirectory "..")
$repoRoot = Resolve-Path (Join-Path $baselineDirectory "..")
$envPath = Join-Path $baselineDirectory ".env"
$datasetRoot = Join-Path $repoRoot "modernization-workbench/seed-data/openemr-shared-synthetic-v1"
$summaryPath = Join-Path $datasetRoot "generated/summary.json"
$sqlPath = Join-Path $datasetRoot "generated/legacy-mariadb/seed-gold.sql"

if (-not (Test-Path $envPath)) {
    throw "Missing .env at $envPath. Copy .env.example to .env before seeding."
}
if (-not (Test-Path $summaryPath) -or -not (Test-Path $sqlPath)) {
    throw "Missing generated gold dataset files. Run 'npm run generate:seed-data' from modernization-workbench first."
}

$envValues = Read-EnvFile -Path $envPath
$script:dbUser = if ($envValues.ContainsKey("MYSQL_USER") -and $envValues["MYSQL_USER"]) { $envValues["MYSQL_USER"] } else { "openemr" }
$script:dbPassword = $envValues["MYSQL_PASSWORD"]
$script:dbName = if ($envValues.ContainsKey("MYSQL_DATABASE") -and $envValues["MYSQL_DATABASE"]) { $envValues["MYSQL_DATABASE"] } else { "openemr" }

if (-not $script:dbPassword) {
    throw "MYSQL_PASSWORD is not set in $envPath."
}

$summary = Get-Content -Path $summaryPath -Raw | ConvertFrom-Json
Invoke-OpenEmrSqlFile -Path $sqlPath
$actualCounts = Get-CountMap

$expectedCounts = [ordered]@{}
$summary.counts.PSObject.Properties | ForEach-Object {
    $expectedCounts[$_.Name] = [int] $_.Value
}

$checks = @()
foreach ($key in $expectedCounts.Keys) {
    $actual = if ($actualCounts.Contains($key)) { $actualCounts[$key] } else { $null }
    $checks += [pscustomobject]@{
        name = $key
        expected = $expectedCounts[$key]
        actual = $actual
        passed = $actual -eq $expectedCounts[$key]
    }
}

$finishedAt = Get-Date
$passed = -not ($checks | Where-Object { -not $_.passed })
$result = [pscustomobject]@{
    name = "legacy-openemr-gold-seed"
    passed = $passed
    source = "OpenEMR shared synthetic gold dataset"
    datasetId = $summary.datasetId
    version = $summary.version
    mode = "reset-and-seeded"
    startedAt = $startedAt.ToString("o")
    finishedAt = $finishedAt.ToString("o")
    durationSeconds = [Math]::Round(($finishedAt - $startedAt).TotalSeconds, 3)
    expectedPatients = $summary.counts.patients
    tableCounts = @($actualCounts.GetEnumerator() | ForEach-Object {
        [pscustomobject]@{
            tableName = $_.Key
            rowCount = $_.Value
        }
    })
    checks = $checks
}

$resolvedOutput = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    $OutputPath
} else {
    Join-Path $baselineDirectory $OutputPath
}
$outputDirectory = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$result | ConvertTo-Json -Depth 7 | Set-Content -Path $resolvedOutput -Encoding UTF8
$result | ConvertTo-Json -Depth 7

if (-not $passed) {
    exit 1
}
