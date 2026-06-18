param(
    [ValidateSet("stable", "full")]
    [string] $Mode = "stable",
    [switch] $InstallDependencies,
    [string] $OutputPath = "artifacts/latest-native-test.json",
    [string] $LogPath = "artifacts/latest-native-test.log",
    [string] $SourcePath = "source",
    [string] $ImageTag = ""
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

function Read-EnvFile {
    param(
        [Parameter(Mandatory = $true)]
        [string] $PathValue
    )

    $values = @{}
    if (-not (Test-Path -LiteralPath $PathValue)) {
        return $values
    }

    foreach ($line in Get-Content -LiteralPath $PathValue) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) {
            continue
        }

        $separator = $trimmed.IndexOf("=")
        $name = $trimmed.Substring(0, $separator)
        $value = $trimmed.Substring($separator + 1)
        $values[$name] = $value
    }

    return $values
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

function Parse-PhpUnitStats {
    param(
        [string] $Text
    )

    $stats = [ordered]@{
        tests = 0
        assertions = 0
        errors = 0
        failures = 0
        phpunitWarnings = 0
        warnings = 0
        notices = 0
        skipped = 0
        incomplete = 0
    }

    $summaryMatch = [regex]::Match($Text, "Tests:\s*(?<tests>[\d,]+),(?<rest>[^\r\n]+)\.")
    if (-not $summaryMatch.Success) {
        return [pscustomobject]$stats
    }

    $stats.tests = [int]($summaryMatch.Groups["tests"].Value -replace ",", "")
    foreach ($part in $summaryMatch.Groups["rest"].Value.Split(",")) {
        $item = $part.Trim()
        $match = [regex]::Match($item, "^(?<label>[A-Za-z ]+):\s*(?<value>[\d,]+)$")
        if (-not $match.Success) {
            continue
        }

        $value = [int]($match.Groups["value"].Value -replace ",", "")
        switch ($match.Groups["label"].Value.Trim()) {
            "Assertions" { $stats.assertions = $value }
            "Errors" { $stats.errors = $value }
            "Failures" { $stats.failures = $value }
            "PHPUnit Warnings" { $stats.phpunitWarnings = $value }
            "Warnings" { $stats.warnings = $value }
            "Notices" { $stats.notices = $value }
            "Skipped" { $stats.skipped = $value }
            "Incomplete" { $stats.incomplete = $value }
        }
    }

    return [pscustomobject]$stats
}

$LegacyRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$ResolvedSourcePath = Resolve-LegacyPath -PathValue $SourcePath
$ResolvedOutputPath = Resolve-LegacyPath -PathValue $OutputPath
$ResolvedLogPath = Resolve-LegacyPath -PathValue $LogPath
$startedAt = Get-Date
$checks = New-Object System.Collections.Generic.List[object]

New-Item -ItemType Directory -Path (Split-Path -Parent $ResolvedOutputPath) -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path -Parent $ResolvedLogPath) -Force | Out-Null

$envValues = Read-EnvFile -PathValue (Join-Path $LegacyRoot ".env")
$effectiveImageTag = if ($ImageTag) {
    $ImageTag
} elseif ($envValues.ContainsKey("OPENEMR_IMAGE_TAG")) {
    $envValues["OPENEMR_IMAGE_TAG"]
} else {
    "8.1.0-2026-06-18"
}
$image = "openemr/openemr:$effectiveImageTag"

$sourceExists = Test-Path -LiteralPath $ResolvedSourcePath -PathType Container
$checks.Add((New-Check -Name "source checkout" -Passed $sourceExists -Detail $ResolvedSourcePath))

$composerJsonPath = Join-Path $ResolvedSourcePath "composer.json"
$phpUnitConfigPath = Join-Path $ResolvedSourcePath "phpunit-isolated.xml"
$vendorPhpUnitPath = Join-Path $ResolvedSourcePath "vendor/bin/phpunit"
if ($IsWindows -or $env:OS -eq "Windows_NT") {
    $vendorPhpUnitPath = Join-Path $ResolvedSourcePath "vendor\bin\phpunit"
}

$checks.Add((New-Check -Name "composer manifest" -Passed (Test-Path -LiteralPath $composerJsonPath) -Detail $composerJsonPath))
$checks.Add((New-Check -Name "isolated PHPUnit config" -Passed (Test-Path -LiteralPath $phpUnitConfigPath) -Detail $phpUnitConfigPath))
$phpUnitPresent = Test-Path -LiteralPath $vendorPhpUnitPath
$dependencyDetail = if ($phpUnitPresent) {
    $vendorPhpUnitPath
} elseif ($InstallDependencies) {
    "vendor/bin/phpunit missing; composer install will run inside $image"
} else {
    "vendor/bin/phpunit missing. Re-run with -InstallDependencies to restore upstream test dependencies."
}
$checks.Add((New-Check -Name "PHPUnit dependency" -Passed ($phpUnitPresent -or $InstallDependencies) -Detail $dependencyDetail))

$canRun = -not ($checks | Where-Object { -not $_.passed })
$excludedGroups = @()
if ($Mode -eq "stable") {
    $excludedGroups = @("twig", "large")
}

$stdout = ""
$exitCode = 1
$commandDisplay = @()

if ($canRun) {
    $phpUnitArgs = if ($Mode -eq "stable") {
        "--exclude-group twig --exclude-group large"
    } else {
        ""
    }
    $dependencyCommand = if ($InstallDependencies) {
        "composer install --no-interaction --prefer-dist --no-progress --no-ansi"
    } else {
        "echo vendor/bin/phpunit-missing-run-with-InstallDependencies; exit 91"
    }
    $shellCommand = "set -eu; cd /app; if [ ! -x vendor/bin/phpunit ]; then $dependencyCommand; fi; vendor/bin/phpunit -c phpunit-isolated.xml $phpUnitArgs --colors=never"

    $dockerArgs = @(
        "run",
        "--rm",
        "--entrypoint",
        "sh",
        "-e",
        "COMPOSER_PROCESS_TIMEOUT=1200",
        "-v",
        "${ResolvedSourcePath}:/app",
        $image,
        "-lc",
        $shellCommand
    )
    $commandDisplay = @("docker") + $dockerArgs

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $outputLines = & docker @dockerArgs 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    $stdout = ($outputLines | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    $stdout | Set-Content -Path $ResolvedLogPath -Encoding UTF8
    $checks.Add((New-Check -Name "PHPUnit command" -Passed ($exitCode -eq 0) -Detail "Exit code $exitCode"))
} else {
    $stdout = "Native PHPUnit run was not started because one or more preflight checks failed."
    $stdout | Set-Content -Path $ResolvedLogPath -Encoding UTF8
}

$finishedAt = Get-Date
$stats = Parse-PhpUnitStats -Text $stdout
$passed = $canRun -and $exitCode -eq 0

$notes = if ($Mode -eq "stable") {
    @(
        "Stable mode excludes upstream PHPUnit groups 'twig' and 'large'.",
        "The full suite currently has Windows bind-mount-sensitive failures: CRLF Twig fixture comparisons and one PHP built-in-server routing timeout."
    )
} else {
    @(
        "Full mode runs OpenEMR's complete phpunit-isolated.xml suite and may expose environment-sensitive upstream failures on Windows bind mounts."
    )
}

$result = [pscustomobject]@{
    name = "legacy-openemr-native-phpunit"
    passed = $passed
    mode = $Mode
    sourcePath = $ResolvedSourcePath
    image = $image
    startedAt = $startedAt.ToString("o")
    finishedAt = $finishedAt.ToString("o")
    durationSeconds = [Math]::Round(($finishedAt - $startedAt).TotalSeconds, 3)
    exitCode = $exitCode
    excludedGroups = $excludedGroups
    stats = $stats
    checks = $checks
    command = $commandDisplay
    logPath = $ResolvedLogPath
    stdoutPreview = Get-Preview -Text $stdout
    notes = $notes
}

$result | ConvertTo-Json -Depth 8 | Set-Content -Path $ResolvedOutputPath -Encoding UTF8
$result | ConvertTo-Json -Depth 8

if (-not $passed) {
    exit 1
}
