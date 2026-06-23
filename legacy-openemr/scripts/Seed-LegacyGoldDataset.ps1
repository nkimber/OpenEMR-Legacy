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
UNION ALL SELECT 'patientHistories', COUNT(*) FROM history_data WHERE pid BETWEEN 100001 AND 101000
UNION ALL SELECT 'appointments', COUNT(*) FROM openemr_postcalendar_events
UNION ALL SELECT 'encounters', COUNT(*) FROM form_encounter
UNION ALL SELECT 'vitals', COUNT(*) FROM form_vitals
UNION ALL SELECT 'clinicalNotes', COUNT(*) FROM form_soap
UNION ALL SELECT 'problems', COUNT(*) FROM lists WHERE type = 'medical_problem'
UNION ALL SELECT 'allergies', COUNT(*) FROM lists WHERE type = 'allergy'
UNION ALL SELECT 'medicationListEntries', COUNT(*) FROM lists WHERE type = 'medication'
UNION ALL SELECT 'medicationsAndPrescriptions', COUNT(*) FROM prescriptions
UNION ALL SELECT 'immunizations', COUNT(*) FROM immunizations WHERE COALESCE(added_erroneously, 0) = 0
UNION ALL SELECT 'labOrders', COUNT(*) FROM procedure_order
UNION ALL SELECT 'labReports', COUNT(*) FROM procedure_report
UNION ALL SELECT 'labResults', COUNT(*) FROM procedure_result
UNION ALL SELECT 'messages', COUNT(*) FROM pnotes
UNION ALL SELECT 'portalMailboxMessages', COUNT(*) FROM onsite_mail WHERE id BETWEEN 9300001 AND 9300500 AND deleted != 1
UNION ALL SELECT 'patientDocuments', COUNT(*) FROM documents WHERE id BETWEEN 8000001 AND 8001200 AND deleted = 0
UNION ALL SELECT 'billingLineItems', COUNT(*) FROM billing
UNION ALL SELECT 'claims', COUNT(*) FROM claims
UNION ALL SELECT 'paymentSessions', COUNT(*) FROM ar_session
UNION ALL SELECT 'paymentActivities', COUNT(*) FROM ar_activity WHERE deleted IS NULL
UNION ALL SELECT 'labProviders', COUNT(*) FROM procedure_providers WHERE ppid BETWEEN 501 AND 505
UNION ALL SELECT 'procedureOrderCatalogItems', COUNT(*) FROM procedure_type WHERE procedure_type_id BETWEEN 9000 AND 9999
UNION ALL SELECT 'portalPatients', COUNT(*) FROM patient_data WHERE allow_patient_portal = 'YES'
UNION ALL SELECT 'portalAccounts', COUNT(*) FROM patient_access_onsite pao INNER JOIN patient_data pd ON pd.pid = pao.pid WHERE pd.allow_patient_portal = 'YES';
"@

    $map = [ordered]@{}
    Invoke-OpenEmrSql -Sql $countSql | ForEach-Object {
        $parts = $_ -split "`t"
        $map[$parts[0]] = [int] $parts[1]
    }
    return $map
}

function Convert-DbNull {
    param(
        [AllowNull()]
        [string] $Value
    )

    if ($null -eq $Value -or $Value -eq "NULL" -or $Value -eq "\N") {
        return $null
    }

    return $Value
}

function Get-TemporalCoverageMap {
    param(
        [Parameter(Mandatory = $true)]
        [string] $AsOfDate,

        [Parameter(Mandatory = $true)]
        [string] $CurrentYear
    )

    $yearStart = "$CurrentYear-01-01"
    $nextYear = ([int] $CurrentYear) + 1
    $yearEndExclusive = "$nextYear-01-01"

    $temporalSql = @"
SELECT 'appointments', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(pc_eventDate) >= '$yearStart' AND DATE(pc_eventDate) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(pc_eventDate) > '$AsOfDate' AND DATE(pc_eventDate) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  DATE(MIN(pc_eventDate)), DATE(MAX(pc_eventDate))
FROM openemr_postcalendar_events
UNION ALL SELECT 'encounters', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date) >= '$yearStart' AND DATE(date) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date) > '$AsOfDate' AND DATE(date) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date)), DATE(MAX(date))
FROM form_encounter
UNION ALL SELECT 'medicationListEntries', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date) >= '$yearStart' AND DATE(date) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date) > '$AsOfDate' AND DATE(date) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date)), DATE(MAX(date))
FROM lists WHERE type = 'medication'
UNION ALL SELECT 'prescriptions', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(start_date) >= '$yearStart' AND DATE(start_date) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(start_date) > '$AsOfDate' AND DATE(start_date) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  DATE(MIN(start_date)), DATE(MAX(start_date))
FROM prescriptions
UNION ALL SELECT 'immunizations', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(administered_date) >= '$yearStart' AND DATE(administered_date) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(administered_date) > '$AsOfDate' AND DATE(administered_date) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  DATE(MIN(administered_date)), DATE(MAX(administered_date))
FROM immunizations WHERE COALESCE(added_erroneously, 0) = 0
UNION ALL SELECT 'procedureOrders', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date_ordered) >= '$yearStart' AND DATE(date_ordered) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date_ordered) > '$AsOfDate' AND DATE(date_ordered) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date_ordered)), DATE(MAX(date_ordered))
FROM procedure_order
UNION ALL SELECT 'procedureReports', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date_report) >= '$yearStart' AND DATE(date_report) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date_report) > '$AsOfDate' AND DATE(date_report) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date_report)), DATE(MAX(date_report))
FROM procedure_report
UNION ALL SELECT 'procedureResults', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date) >= '$yearStart' AND DATE(date) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date) > '$AsOfDate' AND DATE(date) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date)), DATE(MAX(date))
FROM procedure_result
UNION ALL SELECT 'messages', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date) >= '$yearStart' AND DATE(date) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date) > '$AsOfDate' AND DATE(date) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date)), DATE(MAX(date))
FROM pnotes
UNION ALL SELECT 'billingLineItems', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date) >= '$yearStart' AND DATE(date) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date) > '$AsOfDate' AND DATE(date) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date)), DATE(MAX(date))
FROM billing
UNION ALL SELECT 'paymentPostings', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(post_date) >= '$yearStart' AND DATE(post_date) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(post_date) > '$AsOfDate' AND DATE(post_date) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  DATE(MIN(post_date)), DATE(MAX(post_date))
FROM ar_activity WHERE deleted IS NULL
UNION ALL SELECT 'patientDocuments', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(docdate) >= '$yearStart' AND DATE(docdate) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(docdate) > '$AsOfDate' AND DATE(docdate) < '$yearEndExclusive' THEN 1 ELSE 0 END), 0),
  DATE(MIN(docdate)), DATE(MAX(docdate))
FROM documents WHERE id BETWEEN 8000001 AND 8001200 AND deleted = 0;
"@

    $map = [ordered]@{}
    Invoke-OpenEmrSql -Sql $temporalSql | ForEach-Object {
        $parts = $_ -split "`t"
        $map[$parts[0]] = [pscustomobject]@{
            total = [int] $parts[1]
            currentYear = [int] $parts[2]
            futureCurrentYear = [int] $parts[3]
            minDate = Convert-DbNull -Value $parts[4]
            maxDate = Convert-DbNull -Value $parts[5]
        }
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
$actualTemporalCoverage = Get-TemporalCoverageMap -AsOfDate $summary.temporalCoverage.asOfDate -CurrentYear $summary.temporalCoverage.currentYear

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

$temporalFields = @("total", "currentYear", "futureCurrentYear", "minDate", "maxDate")
$summary.temporalCoverage.PSObject.Properties |
    Where-Object { $_.Name -notin @("asOfDate", "currentYear") } |
    ForEach-Object {
        $key = $_.Name
        $expectedCoverage = $_.Value
        $actualCoverage = if ($actualTemporalCoverage.Contains($key)) { $actualTemporalCoverage[$key] } else { $null }

        foreach ($field in $temporalFields) {
            $expected = $expectedCoverage.$field
            $actual = if ($null -ne $actualCoverage) { $actualCoverage.$field } else { $null }
            $passedField = if ($field -in @("total", "currentYear", "futureCurrentYear")) {
                [int] $actual -eq [int] $expected
            } else {
                [string] $actual -eq [string] $expected
            }

            $checks += [pscustomobject]@{
                name = "temporal.$key.$field"
                expected = $expected
                actual = $actual
                passed = $passedField
            }
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
    temporalCoverage = @($actualTemporalCoverage.GetEnumerator() | ForEach-Object {
        [pscustomobject]@{
            name = $_.Key
            total = $_.Value.total
            currentYear = $_.Value.currentYear
            futureCurrentYear = $_.Value.futureCurrentYear
            minDate = $_.Value.minDate
            maxDate = $_.Value.maxDate
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
