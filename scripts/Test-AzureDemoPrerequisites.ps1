param(
    [Parameter(Mandatory = $true)]
    [string]$ProfilePath,

    [string]$ResultPath = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if ([string]::IsNullOrWhiteSpace($ResultPath)) {
    $ResultPath = Join-Path $RepoRoot "modernization-workbench\artifacts\azure-demo-deployment\latest-result.json"
}

$Checks = New-Object System.Collections.ArrayList
$RequiredAzureProviders = @(
    "Microsoft.App",
    "Microsoft.ContainerRegistry",
    "Microsoft.OperationalInsights"
)
$AzureCliCommand = $null

function Add-Check {
    param(
        [string]$Name,
        [bool]$Passed,
        [object]$Detail
    )

    [void]$Checks.Add([ordered]@{
        name = $Name
        passed = $Passed
        detail = ([string]$Detail)
    })
}

function Test-Tool {
    param([string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -eq $command) {
        Add-Check "$Name available" $false "$Name was not found on PATH."
        return $false
    }

    Add-Check "$Name available" $true $command.Source
    return $true
}

function Invoke-Capture {
    param(
        [string]$FilePath,
        [string[]]$Arguments
    )

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & $FilePath @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    catch {
        $output = $_
        $exitCode = 1
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    [ordered]@{
        exitCode = $exitCode
        output = ($output | Out-String).Trim()
    }
}

function Resolve-AzureCliCommand {
    if ($null -ne $script:AzureCliCommand) {
        return $script:AzureCliCommand
    }

    $candidates = New-Object System.Collections.ArrayList
    if (-not [string]::IsNullOrWhiteSpace($env:AZURE_CLI_PATH)) {
        [void]$candidates.Add(@($env:AZURE_CLI_PATH))
    }
    if ($IsWindows -or $env:OS -eq "Windows_NT") {
        [void]$candidates.Add(@("C:\Program Files\Microsoft SDKs\Azure\CLI2\python.exe", "-IBm", "azure.cli"))
        [void]$candidates.Add(@("C:\Program Files (x86)\Microsoft SDKs\Azure\CLI2\python.exe", "-IBm", "azure.cli"))
    }
    [void]$candidates.Add(@("az"))

    $attempted = New-Object System.Collections.ArrayList
    foreach ($candidate in $candidates) {
        $filePath = [string]$candidate[0]
        $baseArguments = @($candidate | Select-Object -Skip 1)
        [void]$attempted.Add(($candidate -join " "))
        if ($filePath -ne "az" -and -not (Test-Path -LiteralPath $filePath)) {
            continue
        }

        $result = Invoke-Capture $filePath (@($baseArguments) + @("--version"))
        if ($result.exitCode -eq 0) {
            $script:AzureCliCommand = [pscustomobject]@{
                filePath = $filePath
                arguments = $baseArguments
                display = ($candidate -join " ")
            }
            return $script:AzureCliCommand
        }
    }

    return [pscustomobject]@{
        filePath = ""
        arguments = @()
        display = ""
        error = "Azure CLI was not found. Tried: $($attempted -join ', ')"
    }
}

function Invoke-AzureCliCapture {
    param([string[]]$Arguments)

    $az = Resolve-AzureCliCommand
    if ([string]::IsNullOrWhiteSpace($az.filePath)) {
        return [ordered]@{
            exitCode = 1
            output = $az.error
        }
    }

    return Invoke-Capture $az.filePath (@($az.arguments) + $Arguments)
}

function Redact-Profile {
    param([object]$Profile)

    [ordered]@{
        profileVersion = $Profile.profileVersion
        subscriptionId = $Profile.subscriptionId
        tenantId = $Profile.tenantId
        location = $Profile.location
        resourceGroup = $Profile.resourceGroup
        containerAppEnvironment = $Profile.containerAppEnvironment
        containerRegistry = $Profile.containerRegistry
        appNamePrefix = $Profile.appNamePrefix
        targets = @($Profile.targets)
        resetOnDeploy = [bool]$Profile.resetOnDeploy
        legacyAdminUser = $Profile.legacyAdminUser
        legacyAdminPassword = "<redacted>"
        databasePassword = "<redacted>"
    }
}

function Write-Result {
    param(
        [string]$Status,
        [object]$Profile,
        [string]$ErrorMessage = ""
    )

    $resultDirectory = Split-Path -Parent $ResultPath
    New-Item -ItemType Directory -Force $resultDirectory | Out-Null
    $resolvedProfilePath = Resolve-Path -LiteralPath $ProfilePath -ErrorAction SilentlyContinue

    $result = [ordered]@{
        action = "validate"
        status = $Status
        checkedAt = (Get-Date).ToUniversalTime().ToString("o")
        profilePath = if ($resolvedProfilePath) { $resolvedProfilePath.Path } else { $ProfilePath }
        profile = if ($null -ne $Profile) { Redact-Profile $Profile } else { $null }
        checks = @($Checks)
        error = $ErrorMessage
    }

    $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ResultPath -Encoding UTF8
    $result | ConvertTo-Json -Depth 8
}

try {
    if (-not (Test-Path -LiteralPath $ProfilePath)) {
        Add-Check "Profile file" $false "Profile file does not exist: $ProfilePath"
        Write-Result "failed" $null "Profile file does not exist."
        exit 1
    }

    $profile = Get-Content -LiteralPath $ProfilePath -Raw | ConvertFrom-Json
    Add-Check "Profile file" $true "Loaded $ProfilePath"

    $requiredFields = @(
        "subscriptionId",
        "location",
        "resourceGroup",
        "containerAppEnvironment",
        "containerRegistry",
        "appNamePrefix",
        "legacyAdminUser",
        "legacyAdminPassword",
        "databasePassword"
    )

    foreach ($field in $requiredFields) {
        $value = [string]$profile.$field
        Add-Check "Profile $field" (-not [string]::IsNullOrWhiteSpace($value)) $(if ([string]::IsNullOrWhiteSpace($value)) { "$field is required." } else { "$field is set." })
    }

    $targetCount = @($profile.targets).Count
    Add-Check "Deployment targets" ($targetCount -gt 0) "$targetCount target(s) selected."

    $acrName = [string]$profile.containerRegistry
    Add-Check "ACR name shape" ($acrName -match "^[a-zA-Z0-9]{5,50}$") "ACR names must be 5-50 alphanumeric characters."

    $prefix = [string]$profile.appNamePrefix
    Add-Check "App prefix shape" ($prefix -match "^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$") "Use lowercase letters, numbers, and hyphens; start and end with a letter or number."

    $azCommand = Resolve-AzureCliCommand
    $azAvailable = -not [string]::IsNullOrWhiteSpace($azCommand.filePath)
    Add-Check "Azure CLI available" $azAvailable $(if ($azAvailable) { $azCommand.display } else { $azCommand.error })
    $dockerAvailable = Test-Tool "docker"
    Test-Tool "git" | Out-Null

    if ($azAvailable) {
        $account = Invoke-AzureCliCapture @("account", "show", "--query", "id", "-o", "tsv")
        Add-Check "Azure CLI login" ($account.exitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($account.output)) $(if ($account.exitCode -eq 0) { "Signed in to subscription $($account.output)." } else { $account.output })

        if ($account.exitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($profile.subscriptionId)) {
            Add-Check "Selected subscription" ($account.output.Trim() -eq ([string]$profile.subscriptionId).Trim()) "Current Azure CLI subscription is $($account.output.Trim())."
        }

        $containerAppHelp = Invoke-AzureCliCapture @("containerapp", "--help")
        Add-Check "Container Apps CLI" ($containerAppHelp.exitCode -eq 0) $(if ($containerAppHelp.exitCode -eq 0) { "az containerapp is available." } else { $containerAppHelp.output })

        $acrHelp = Invoke-AzureCliCapture @("acr", "--help")
        Add-Check "Container Registry CLI" ($acrHelp.exitCode -eq 0) $(if ($acrHelp.exitCode -eq 0) { "az acr is available." } else { $acrHelp.output })

        foreach ($providerNamespace in $RequiredAzureProviders) {
            $providerState = Invoke-AzureCliCapture @("provider", "show", "-n", $providerNamespace, "--query", "registrationState", "-o", "tsv")
            $state = ([string]$providerState.output).Trim()
            $canReadProvider = $providerState.exitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($state)
            $detail = if ($canReadProvider) {
                "$providerNamespace registration state is $state. Deploy latest will register it if needed."
            }
            else {
                $providerState.output
            }
            Add-Check "Provider $providerNamespace" $canReadProvider $detail
        }
    }

    if ($dockerAvailable) {
        $dockerInfo = Invoke-Capture "docker" @("info")
        Add-Check "Docker engine" ($dockerInfo.exitCode -eq 0) $(if ($dockerInfo.exitCode -eq 0) { "Docker engine is reachable." } else { $dockerInfo.output })
    }

    $failed = @($Checks | Where-Object { -not $_.passed })
    if ($failed.Count -gt 0) {
        Write-Result "failed" $profile "$($failed.Count) prerequisite check(s) failed."
        exit 1
    }

    Write-Result "passed" $profile
}
catch {
    Add-Check "Validation exception" $false $_.Exception.Message
    Write-Result "failed" $profile $_.Exception.Message
    exit 1
}
