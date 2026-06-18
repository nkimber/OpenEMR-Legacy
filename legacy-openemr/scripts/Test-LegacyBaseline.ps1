param(
    [string] $BaseUrl = "https://localhost:9443",
    [string] $Username = "admin",
    [string] $Password = "pass",
    [string] $OutputPath = "artifacts/latest-smoke-test.json"
)

$ErrorActionPreference = "Stop"

function Invoke-CurlText {
    param(
        [Parameter(Mandatory = $true)]
        [string[]] $Arguments
    )

    $output = & curl.exe @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "curl failed with exit code $LASTEXITCODE for arguments: $($Arguments -join ' ')"
    }

    return ($output -join [Environment]::NewLine)
}

$startedAt = Get-Date
$checks = New-Object System.Collections.Generic.List[object]
$cookiePath = Join-Path $env:TEMP ("openemr-smoke-{0}.txt" -f ([Guid]::NewGuid().ToString("N")))

try {
    $healthUrl = "$BaseUrl/meta/health/readyz"
    $healthStatus = Invoke-CurlText -Arguments @("-k", "-s", "-o", "NUL", "-w", "%{http_code}", $healthUrl)
    $checks.Add([pscustomobject]@{
        name = "health endpoint"
        passed = $healthStatus -eq "200"
        detail = "HTTP $healthStatus from $healthUrl"
    })

    $loginUrl = "$BaseUrl/interface/login/login.php?site=default"
    $loginPage = Invoke-CurlText -Arguments @("-k", "-s", "-L", $loginUrl)
    $loginPageOk = $loginPage -match "OpenEMR Login" -and $loginPage -match "name=`"authUser`"" -and $loginPage -match "name=`"clearPass`""
    $checks.Add([pscustomobject]@{
        name = "login page"
        passed = $loginPageOk
        detail = "Login form detected at $loginUrl"
    })

    $loginPostUrl = "$BaseUrl/interface/main/main_screen.php?auth=login&site=default"
    $loginResponse = Invoke-CurlText -Arguments @(
        "-k",
        "-s",
        "-L",
        "-c", $cookiePath,
        "-b", $cookiePath,
        "-d", "new_login_session_management=1&authUser=$Username&clearPass=$Password&languageChoice=1",
        $loginPostUrl
    )
    $loginOk = $loginResponse -match "<title>OpenEMR</title>" -and $loginResponse -match "patient-data-template"
    $checks.Add([pscustomobject]@{
        name = "admin login"
        passed = $loginOk
        detail = "Main OpenEMR shell detected after login"
    })

    $passed = -not ($checks | Where-Object { -not $_.passed })
    $finishedAt = Get-Date

    $result = [pscustomobject]@{
        name = "legacy-openemr-smoke"
        passed = $passed
        baseUrl = $BaseUrl
        startedAt = $startedAt.ToString("o")
        finishedAt = $finishedAt.ToString("o")
        durationSeconds = [Math]::Round(($finishedAt - $startedAt).TotalSeconds, 3)
        checks = $checks
    }

    $resolvedOutput = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
        $OutputPath
    } else {
        Join-Path (Get-Location) $OutputPath
    }
    $outputDirectory = Split-Path -Parent $resolvedOutput
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    $result | ConvertTo-Json -Depth 5 | Set-Content -Path $resolvedOutput -Encoding UTF8

    $result | ConvertTo-Json -Depth 5

    if (-not $passed) {
        exit 1
    }
} finally {
    Remove-Item -LiteralPath $cookiePath -ErrorAction SilentlyContinue
}
