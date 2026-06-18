param(
    [switch] $InstallDependencies,
    [string] $OutputPath = "artifacts/latest-native-jest-test.json",
    [string] $ReportPath = "artifacts/latest-native-jest-report.json",
    [string] $LogPath = "artifacts/latest-native-jest-test.log",
    [string] $SourcePath = "source"
)

$ErrorActionPreference = "Stop"

function Resolve-LegacyPath {
    param(
        [Parameter(Mandatory = $true)]
        [string] $PathValue
    )

    if ([System.IO.Path]::IsPathRooted($PathValue)) {
        return [System.IO.Path]::GetFullPath($PathValue)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $LegacyRoot $PathValue))
}

function New-Check {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Name,
        [Parameter(Mandatory = $true)]
        [bool] $Passed,
        [Parameter(Mandatory = $true)]
        [string] $Detail
    )

    [pscustomobject]@{
        name = $Name
        passed = $Passed
        detail = $Detail
    }
}

function Get-Preview {
    param(
        [string] $Text,
        [int] $MaxLength = 8000
    )

    if (-not $Text) {
        return ""
    }

    if ($Text.Length -le $MaxLength) {
        return $Text
    }

    return $Text.Substring(0, $MaxLength) + [Environment]::NewLine + "... truncated ..."
}

function Invoke-CapturedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Executable,
        [Parameter(Mandatory = $true)]
        [string[]] $Arguments,
        [Parameter(Mandatory = $true)]
        [string] $WorkingDirectory
    )

    $stdoutPath = Join-Path $env:TEMP ("openemr-jest-stdout-{0}.log" -f ([Guid]::NewGuid().ToString("N")))
    $stderrPath = Join-Path $env:TEMP ("openemr-jest-stderr-{0}.log" -f ([Guid]::NewGuid().ToString("N")))

    $quotedArguments = ($Arguments | ForEach-Object {
        $argument = $_
        if ($argument -match '[\s"]') {
            '"' + ($argument -replace '"', '\"') + '"'
        } else {
            $argument
        }
    }) -join " "

    try {
        $process = Start-Process -FilePath $Executable `
            -ArgumentList $quotedArguments `
            -WorkingDirectory $WorkingDirectory `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath `
            -NoNewWindow `
            -Wait `
            -PassThru

        $stdout = if (Test-Path -LiteralPath $stdoutPath) { Get-Content -LiteralPath $stdoutPath -Raw -Encoding UTF8 } else { "" }
        $stderr = if (Test-Path -LiteralPath $stderrPath) { Get-Content -LiteralPath $stderrPath -Raw -Encoding UTF8 } else { "" }
    } finally {
        Remove-Item -LiteralPath $stdoutPath -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $stderrPath -ErrorAction SilentlyContinue
    }

    return [pscustomobject]@{
        exitCode = $process.ExitCode
        output = (($stdout, $stderr) | Where-Object { $_ }) -join [Environment]::NewLine
        command = @($Executable) + $Arguments
    }
}

$LegacyRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$ResolvedSourcePath = Resolve-LegacyPath -PathValue $SourcePath
$ResolvedOutputPath = Resolve-LegacyPath -PathValue $OutputPath
$ResolvedReportPath = Resolve-LegacyPath -PathValue $ReportPath
$ResolvedLogPath = Resolve-LegacyPath -PathValue $LogPath
$startedAt = Get-Date
$checks = New-Object System.Collections.Generic.List[object]

New-Item -ItemType Directory -Path (Split-Path -Parent $ResolvedOutputPath) -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path -Parent $ResolvedReportPath) -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path -Parent $ResolvedLogPath) -Force | Out-Null

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$npmCommand = Get-Command npm -ErrorAction SilentlyContinue
if ($IsWindows -or $env:OS -eq "Windows_NT") {
    $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
}

$checks.Add((New-Check -Name "source checkout" -Passed (Test-Path -LiteralPath $ResolvedSourcePath -PathType Container) -Detail $ResolvedSourcePath))
$checks.Add((New-Check -Name "package manifest" -Passed (Test-Path -LiteralPath (Join-Path $ResolvedSourcePath "package.json")) -Detail (Join-Path $ResolvedSourcePath "package.json")))
$checks.Add((New-Check -Name "package lock" -Passed (Test-Path -LiteralPath (Join-Path $ResolvedSourcePath "package-lock.json")) -Detail (Join-Path $ResolvedSourcePath "package-lock.json")))
$checks.Add((New-Check -Name "node command" -Passed ($null -ne $nodeCommand) -Detail ($(if ($nodeCommand) { $nodeCommand.Source } else { "node was not found on PATH" }))))
$checks.Add((New-Check -Name "npm command" -Passed ($null -ne $npmCommand) -Detail ($(if ($npmCommand) { $npmCommand.Source } else { "npm was not found on PATH" }))))

$jestPath = if ($IsWindows -or $env:OS -eq "Windows_NT") {
    Join-Path $ResolvedSourcePath "node_modules\.bin\jest.cmd"
} else {
    Join-Path $ResolvedSourcePath "node_modules/.bin/jest"
}
$jestPresent = Test-Path -LiteralPath $jestPath
$checks.Add((New-Check -Name "Jest dependency" -Passed ($jestPresent -or $InstallDependencies) -Detail ($(if ($jestPresent) { $jestPath } elseif ($InstallDependencies) { "node_modules missing; npm ci will run with --ignore-scripts" } else { "node_modules missing. Re-run with -InstallDependencies." }))))

$canRun = -not ($checks | Where-Object { -not $_.passed })
$stdout = ""
$exitCode = 1
$commandDisplay = @()
$dependencyInstall = $null

if ($canRun) {
    if (-not $jestPresent -and $InstallDependencies) {
        $dependencyInstall = Invoke-CapturedCommand -Executable $npmCommand.Source -Arguments @("ci", "--ignore-scripts", "--no-audit", "--no-fund") -WorkingDirectory $ResolvedSourcePath
        $stdout += $dependencyInstall.output
        if ($dependencyInstall.exitCode -ne 0) {
            $exitCode = $dependencyInstall.exitCode
            $checks.Add((New-Check -Name "npm dependency install" -Passed $false -Detail "Exit code $($dependencyInstall.exitCode)"))
            $canRun = $false
        } else {
            $checks.Add((New-Check -Name "npm dependency install" -Passed $true -Detail "Dependencies installed with npm ci --ignore-scripts"))
        }
    }
}

if ($canRun) {
    $jestArgs = @("run", "test:js", "--", "--runInBand", "--no-color", "--json", "--outputFile", $ResolvedReportPath)
    Remove-Item -LiteralPath $ResolvedReportPath -ErrorAction SilentlyContinue
    $jestRun = Invoke-CapturedCommand -Executable $npmCommand.Source -Arguments $jestArgs -WorkingDirectory $ResolvedSourcePath
    $exitCode = $jestRun.exitCode
    $commandDisplay = $jestRun.command
    $stdout = (($stdout, $jestRun.output) | Where-Object { $_ }) -join ([Environment]::NewLine + [Environment]::NewLine)
    $checks.Add((New-Check -Name "Jest command" -Passed ($exitCode -eq 0) -Detail "Exit code $exitCode"))
} else {
    $stdout = "Native Jest run was not started because one or more preflight checks failed." + [Environment]::NewLine + $stdout
}

$stdout | Set-Content -Path $ResolvedLogPath -Encoding UTF8

$jestReport = $null
if (Test-Path -LiteralPath $ResolvedReportPath) {
    $jestReport = Get-Content -LiteralPath $ResolvedReportPath -Raw | ConvertFrom-Json
}

$finishedAt = Get-Date
$passed = $canRun -and $exitCode -eq 0 -and ($null -ne $jestReport) -and [bool]$jestReport.success
$nodeVersion = if ($nodeCommand) { (& $nodeCommand.Source -v) } else { "" }
$npmVersion = if ($npmCommand) { (& $npmCommand.Source -v) } else { "" }

$stats = [pscustomobject]@{
    testSuites = [pscustomobject]@{
        total = if ($jestReport) { [int]$jestReport.numTotalTestSuites } else { 0 }
        passed = if ($jestReport) { [int]$jestReport.numPassedTestSuites } else { 0 }
        failed = if ($jestReport) { [int]$jestReport.numFailedTestSuites } else { 0 }
        runtimeErrors = if ($jestReport) { [int]$jestReport.numRuntimeErrorTestSuites } else { 0 }
        pending = if ($jestReport) { [int]$jestReport.numPendingTestSuites } else { 0 }
    }
    tests = [pscustomobject]@{
        total = if ($jestReport) { [int]$jestReport.numTotalTests } else { 0 }
        passed = if ($jestReport) { [int]$jestReport.numPassedTests } else { 0 }
        failed = if ($jestReport) { [int]$jestReport.numFailedTests } else { 0 }
        pending = if ($jestReport) { [int]$jestReport.numPendingTests } else { 0 }
        todo = if ($jestReport) { [int]$jestReport.numTodoTests } else { 0 }
    }
    snapshots = [pscustomobject]@{
        total = if ($jestReport) { [int]$jestReport.snapshot.total } else { 0 }
        matched = if ($jestReport) { [int]$jestReport.snapshot.matched } else { 0 }
        unmatched = if ($jestReport) { [int]$jestReport.snapshot.unmatched } else { 0 }
    }
}

$result = [pscustomobject]@{
    name = "legacy-openemr-native-jest"
    runner = "jest"
    passed = $passed
    sourcePath = $ResolvedSourcePath
    nodeVersion = $nodeVersion
    npmVersion = $npmVersion
    startedAt = $startedAt.ToString("o")
    finishedAt = $finishedAt.ToString("o")
    durationSeconds = [Math]::Round(($finishedAt - $startedAt).TotalSeconds, 3)
    exitCode = $exitCode
    stats = $stats
    checks = $checks
    command = $commandDisplay
    reportPath = $ResolvedReportPath
    logPath = $ResolvedLogPath
    stdoutPreview = Get-Preview -Text $stdout
    notes = @(
        "Runs OpenEMR's upstream JavaScript Jest suite from the ignored local source checkout.",
        "Dependency restore uses npm ci --ignore-scripts so the test lane does not run OpenEMR's heavier asset postinstall."
    )
}

$result | ConvertTo-Json -Depth 8 | Set-Content -Path $ResolvedOutputPath -Encoding UTF8
$result | ConvertTo-Json -Depth 8

if (-not $passed) {
    exit 1
}
