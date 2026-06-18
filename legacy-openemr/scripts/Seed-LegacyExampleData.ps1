param(
    [string] $OutputPath = "artifacts/latest-seed-result.json"
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
        if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
            return
        } else {
            $index = $line.IndexOf("=")
            $key = $line.Substring(0, $index)
            $value = $line.Substring($index + 1)
            $values[$key] = $value
        }
    }
    return $values
}

function Invoke-OpenEmrSql {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Sql,
        [switch] $Raw
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

    if ($Raw) {
        return ($output -join [Environment]::NewLine)
    }
    return $output
}

function Invoke-OpenEmrSqlFile {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    $sql = Get-Content -Path $Path -Raw
    Invoke-OpenEmrSql -Sql $sql | Out-Null
}

function Get-SqlScalar {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Sql
    )

    $output = Invoke-OpenEmrSql -Sql $Sql
    return ($output | Select-Object -First 1).Trim()
}

function Get-TableCounts {
    $countSql = @"
SELECT 'patient_data', COUNT(*) FROM patient_data
UNION ALL SELECT 'form_encounter', COUNT(*) FROM form_encounter
UNION ALL SELECT 'openemr_postcalendar_events', COUNT(*) FROM openemr_postcalendar_events
UNION ALL SELECT 'lists', COUNT(*) FROM lists
UNION ALL SELECT 'pnotes', COUNT(*) FROM pnotes
UNION ALL SELECT 'users', COUNT(*) FROM users;
"@

    $rows = Invoke-OpenEmrSql -Sql $countSql
    return @($rows | ForEach-Object {
        $parts = $_ -split "`t"
        [pscustomobject]@{
            tableName = $parts[0]
            rowCount = [int] $parts[1]
        }
    })
}

$startedAt = Get-Date
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$baselineDirectory = Resolve-Path (Join-Path $scriptDirectory "..")
$envPath = Join-Path $baselineDirectory ".env"
$patientUsersSqlPath = Join-Path $baselineDirectory "source/sql/example_patient_users.sql"
$patientDataSqlPath = Join-Path $baselineDirectory "source/sql/example_patient_data.sql"

if (-not (Test-Path $envPath)) {
    throw "Missing .env at $envPath. Copy .env.example to .env before seeding."
}
if (-not (Test-Path $patientUsersSqlPath) -or -not (Test-Path $patientDataSqlPath)) {
    throw "Missing OpenEMR example SQL files under legacy-openemr/source/sql. Ensure the local source checkout is present."
}

$envValues = Read-EnvFile -Path $envPath
$script:dbUser = if ($envValues.ContainsKey("MYSQL_USER") -and $envValues["MYSQL_USER"]) { $envValues["MYSQL_USER"] } else { "openemr" }
$script:dbPassword = $envValues["MYSQL_PASSWORD"]
$script:dbName = if ($envValues.ContainsKey("MYSQL_DATABASE") -and $envValues["MYSQL_DATABASE"]) { $envValues["MYSQL_DATABASE"] } else { "openemr" }

if (-not $script:dbPassword) {
    throw "MYSQL_PASSWORD is not set in $envPath."
}

$existingPatients = [int] (Get-SqlScalar -Sql "SELECT COUNT(*) FROM patient_data;")
if ($existingPatients -gt 0) {
    throw "Refusing to seed because patient_data already contains $existingPatients row(s). Reset the baseline data first if you need a clean seed."
}

$sampleUserCount = [int] (Get-SqlScalar -Sql "SELECT COUNT(*) FROM users WHERE username IN ('davis', 'hamming');")
if ($sampleUserCount -eq 0) {
    Invoke-OpenEmrSqlFile -Path $patientUsersSqlPath
} elseif ($sampleUserCount -ne 2) {
    throw "Expected either 0 or 2 bundled sample provider users, but found $sampleUserCount."
}

Invoke-OpenEmrSqlFile -Path $patientDataSqlPath

$providerFixSql = @"
SET @davis_id = (SELECT id FROM users WHERE username = 'davis' ORDER BY id LIMIT 1);
SET @hamming_id = (SELECT id FROM users WHERE username = 'hamming' ORDER BY id LIMIT 1);
UPDATE patient_data
SET providerID = CASE providerID
    WHEN 4 THEN @davis_id
    WHEN 5 THEN @hamming_id
    ELSE providerID
END
WHERE providerID IN (4, 5);
"@
Invoke-OpenEmrSql -Sql $providerFixSql | Out-Null

$finishedAt = Get-Date
$counts = Get-TableCounts
$seededPatients = ($counts | Where-Object { $_.tableName -eq "patient_data" }).rowCount

$result = [pscustomobject]@{
    name = "legacy-openemr-example-seed"
    passed = $seededPatients -eq 14
    source = "OpenEMR bundled example patient SQL"
    startedAt = $startedAt.ToString("o")
    finishedAt = $finishedAt.ToString("o")
    durationSeconds = [Math]::Round(($finishedAt - $startedAt).TotalSeconds, 3)
    expectedPatients = 14
    tableCounts = $counts
}

$resolvedOutput = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    $OutputPath
} else {
    Join-Path $baselineDirectory $OutputPath
}
$outputDirectory = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$result | ConvertTo-Json -Depth 5 | Set-Content -Path $resolvedOutput -Encoding UTF8
$result | ConvertTo-Json -Depth 5

if (-not $result.passed) {
    exit 1
}
