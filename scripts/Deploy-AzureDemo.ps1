param(
    [Parameter(Mandatory = $true)]
    [string]$ProfilePath,

    [string]$ResultPath = "",

    [switch]$SmokeOnly
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$DemoInfraRoot = Join-Path $RepoRoot "infra\azure\demo"
$ArtifactsRoot = Join-Path $RepoRoot "modernization-workbench\artifacts\azure-demo-deployment"
if ([string]::IsNullOrWhiteSpace($ResultPath)) {
    $ResultPath = Join-Path $ArtifactsRoot "latest-result.json"
}

$Logs = New-Object System.Collections.ArrayList
$Checks = New-Object System.Collections.ArrayList
$Applications = New-Object System.Collections.ArrayList
$RequiredAzureProviders = @(
    "Microsoft.App",
    "Microsoft.ContainerRegistry",
    "Microsoft.OperationalInsights"
)
$ProviderRegistrationPollAttempts = 40
$ProviderRegistrationPollSeconds = 15
$SmokePollAttempts = 60
$SmokePollSeconds = 10
$PlaceholderContainerAppImage = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
$AzureCliCommand = $null

function Add-Check {
    param(
        [string]$Name,
        [bool]$Passed,
        [string]$Detail
    )

    [void]$Checks.Add([ordered]@{
        name = $Name
        passed = $Passed
        detail = $Detail
    })
}

function Invoke-Logged {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [switch]$AllowFailure,
        [string]$RedactedOutput = ""
    )

    $startedAt = Get-Date
    $display = "$FilePath $($Arguments -join ' ')"
    Write-Host $display
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
    $finishedAt = Get-Date
    $text = ($output | Out-String).Trim()
    $logText = if ([string]::IsNullOrEmpty($RedactedOutput)) { $text } else { $RedactedOutput }

    $logEntry = [ordered]@{
        command = $display
        exitCode = $exitCode
        startedAt = $startedAt.ToUniversalTime().ToString("o")
        finishedAt = $finishedAt.ToUniversalTime().ToString("o")
        durationMs = [int]($finishedAt - $startedAt).TotalMilliseconds
        output = $logText
    }
    [void]$Logs.Add($logEntry)

    if ($exitCode -ne 0 -and -not $AllowFailure) {
        $throwText = if ([string]::IsNullOrEmpty($RedactedOutput)) { $text } else { $logText }
        throw "Command failed with exit code $exitCode`: $display`n$throwText"
    }

    return [pscustomobject]@{
        command = $display
        exitCode = $exitCode
        startedAt = $logEntry.startedAt
        finishedAt = $logEntry.finishedAt
        durationMs = $logEntry.durationMs
        output = $logText
        rawOutput = $text
    }
}

function Invoke-LoggedText {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$RedactedOutput = ""
    )

    $entry = Invoke-Logged $FilePath $Arguments -RedactedOutput $RedactedOutput
    return [string]$entry.rawOutput
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

        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            & $filePath @baseArguments --version *> $null
            $exitCode = $LASTEXITCODE
        }
        catch {
            $exitCode = 1
        }
        finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }

        if ($exitCode -eq 0) {
            $script:AzureCliCommand = [pscustomobject]@{
                filePath = $filePath
                arguments = $baseArguments
                display = ($candidate -join " ")
            }
            return $script:AzureCliCommand
        }
    }

    throw "Azure CLI was not found. Tried: $($attempted -join ', ')"
}

function Invoke-AzLogged {
    param(
        [string[]]$Arguments,
        [switch]$AllowFailure,
        [string]$RedactedOutput = ""
    )

    $az = Resolve-AzureCliCommand
    $allArguments = @($az.arguments) + $Arguments
    if ($AllowFailure) {
        return Invoke-Logged $az.filePath $allArguments -AllowFailure -RedactedOutput $RedactedOutput
    }

    return Invoke-Logged $az.filePath $allArguments -RedactedOutput $RedactedOutput
}

function Invoke-AzLoggedText {
    param(
        [string[]]$Arguments,
        [string]$RedactedOutput = ""
    )

    $az = Resolve-AzureCliCommand
    $allArguments = @($az.arguments) + $Arguments
    return Invoke-LoggedText $az.filePath $allArguments -RedactedOutput $RedactedOutput
}

function Escape-YamlSingleQuoted {
    param([string]$Value)

    return "'" + ($Value -replace "'", "''") + "'"
}

function Normalize-AppName {
    param([string]$Value)

    $normalized = $Value.ToLowerInvariant() -replace "[^a-z0-9-]", "-"
    $normalized = $normalized.Trim("-")
    if ($normalized.Length -gt 40) {
        $normalized = $normalized.Substring(0, 40).Trim("-")
    }
    if ([string]::IsNullOrWhiteSpace($normalized)) {
        throw "App name prefix must contain at least one letter or number."
    }
    return $normalized
}

function Get-ContainerAppEnvironmentResourceId {
    param([object]$Profile)

    return "/subscriptions/$($Profile.subscriptionId)/resourceGroups/$($Profile.resourceGroup)/providers/Microsoft.App/managedEnvironments/$($Profile.containerAppEnvironment)"
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
        [string]$ErrorMessage = "",
        [string]$ImageTag = ""
    )

    New-Item -ItemType Directory -Force (Split-Path -Parent $ResultPath) | Out-Null
    $result = [ordered]@{
        action = if ($SmokeOnly) { "smoke" } else { "deploy" }
        status = $Status
        finishedAt = (Get-Date).ToUniversalTime().ToString("o")
        imageTag = $ImageTag
        profilePath = $ProfilePath
        profile = if ($null -ne $Profile) { Redact-Profile $Profile } else { $null }
        applications = @($Applications)
        checks = @($Checks)
        logs = @($Logs)
        error = $ErrorMessage
    }
    $result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ResultPath -Encoding UTF8
    $result | ConvertTo-Json -Depth 12
}

function Get-AcrPassword {
    param([string]$AcrName)

    return (Invoke-AzLoggedText @("acr", "credential", "show", "--name", $AcrName, "--query", "passwords[0].value", "-o", "tsv") -RedactedOutput "<redacted>").Trim()
}

function Test-AzResourceExists {
    param([string[]]$Arguments)

    $entry = Invoke-AzLogged $Arguments -AllowFailure
    return $entry.exitCode -eq 0
}

function Get-AzureProviderRegistrationState {
    param([string]$Namespace)

    $entry = Invoke-AzLogged @("provider", "show", "-n", $Namespace, "--query", "registrationState", "-o", "tsv") -AllowFailure
    $state = ([string]$entry.output).Trim()
    return [pscustomobject]@{
        exitCode = $entry.exitCode
        state = $state
    }
}

function Ensure-AzureProviderRegistered {
    param([string]$Namespace)

    $providerState = Get-AzureProviderRegistrationState $Namespace
    if ($providerState.exitCode -eq 0 -and $providerState.state -eq "Registered") {
        Add-Check "Provider $Namespace" $true "$Namespace is registered."
        return
    }

    if ($providerState.state -ne "Registering") {
        Invoke-AzLogged @("provider", "register", "-n", $Namespace, "--wait", "-o", "none") | Out-Null
    }

    for ($attempt = 1; $attempt -le $ProviderRegistrationPollAttempts; $attempt++) {
        $registeredState = Get-AzureProviderRegistrationState $Namespace
        if ($registeredState.exitCode -eq 0 -and $registeredState.state -eq "Registered") {
            Add-Check "Provider $Namespace" $true "$Namespace is registered after $attempt registration poll(s)."
            return
        }

        if ($attempt -lt $ProviderRegistrationPollAttempts) {
            Start-Sleep -Seconds $ProviderRegistrationPollSeconds
        }
    }

    $timeoutMinutes = [math]::Round(($ProviderRegistrationPollAttempts * $ProviderRegistrationPollSeconds) / 60, 1)
    Add-Check "Provider $Namespace" $false "$Namespace is still registering after about $timeoutMinutes minute(s). Azure may still be finishing the subscription registration."
    throw "$Namespace registration is still in progress. Wait a few minutes and click Deploy latest again."
}

function Apply-ContainerApp {
    param(
        [string]$Name,
        [string]$YamlPath,
        [object]$Profile,
        [string[]]$ExpectedImages
    )

    $exists = Test-AzResourceExists @("containerapp", "show", "--name", $Name, "--resource-group", $Profile.resourceGroup, "-o", "none")
    if ($exists) {
        Invoke-AzLogged @("containerapp", "update", "--name", $Name, "--resource-group", $Profile.resourceGroup, "--yaml", $YamlPath) | Out-Null
    }
    else {
        Invoke-AzLogged @("containerapp", "create", "--name", $Name, "--resource-group", $Profile.resourceGroup, "--environment", $Profile.containerAppEnvironment, "--image", $PlaceholderContainerAppImage, "--ingress", "external", "--target-port", "80", "--revisions-mode", "single", "--min-replicas", "1", "--max-replicas", "1", "-o", "none") | Out-Null
        Invoke-AzLogged @("containerapp", "update", "--name", $Name, "--resource-group", $Profile.resourceGroup, "--yaml", $YamlPath) | Out-Null
    }

    Assert-ContainerAppImages -Name $Name -Profile $Profile -ExpectedImages $ExpectedImages
}

function Assert-ContainerAppImages {
    param(
        [string]$Name,
        [object]$Profile,
        [string[]]$ExpectedImages
    )

    $actualText = Invoke-AzLoggedText @("containerapp", "show", "--name", $Name, "--resource-group", $Profile.resourceGroup, "--query", "properties.template.containers[].image", "-o", "tsv")
    $actualImages = @($actualText -split "\r?\n" | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $missingImages = @($ExpectedImages | Where-Object { $actualImages -notcontains $_ })
    if ($missingImages.Count -gt 0) {
        $actualDisplay = if ($actualImages.Count -gt 0) { $actualImages -join ", " } else { "<none>" }
        $missingDisplay = $missingImages -join ", "
        Add-Check "$Name image update" $false "Azure active template is missing expected image(s): $missingDisplay. Actual images: $actualDisplay."
        throw "Container App $Name did not apply the final demo images. Expected $missingDisplay. Actual images: $actualDisplay."
    }

    Add-Check "$Name image update" $true "Azure active template contains expected image(s): $($ExpectedImages -join ', ')."
}

function Get-ContainerAppUrl {
    param(
        [string]$Name,
        [object]$Profile,
        [switch]$AllowMissing
    )

    $arguments = @("containerapp", "show", "--name", $Name, "--resource-group", $Profile.resourceGroup, "--query", "properties.configuration.ingress.fqdn", "-o", "tsv")
    if ($AllowMissing) {
        $entry = Invoke-AzLogged $arguments -AllowFailure
        if ($entry.exitCode -ne 0) {
            return ""
        }
        $fqdn = ([string]$entry.rawOutput).Trim()
    }
    else {
        $fqdn = (Invoke-AzLoggedText $arguments).Trim()
    }

    if ([string]::IsNullOrWhiteSpace($fqdn)) {
        return ""
    }
    return "https://$fqdn"
}

function Invoke-SmokeCheck {
    param(
        [string]$Name,
        [string]$Url,
        [string]$MustContain = "",
        [string]$MustNotContain = "Azure Container Apps"
    )

    if ([string]::IsNullOrWhiteSpace($Url)) {
        Add-Check "$Name public URL" $false "No public URL was available."
        return
    }

    $lastError = ""
    for ($attempt = 1; $attempt -le $SmokePollAttempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 30
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                $content = [string]$response.Content
                if (-not [string]::IsNullOrWhiteSpace($MustContain) -and $content -notlike "*$MustContain*") {
                    $lastError = "$Url returned HTTP $($response.StatusCode), but the response did not contain '$MustContain'."
                }
                elseif (-not [string]::IsNullOrWhiteSpace($MustNotContain) -and $content -like "*$MustNotContain*") {
                    $lastError = "$Url returned HTTP $($response.StatusCode), but it still contains '$MustNotContain'."
                }
                else {
                Add-Check "$Name smoke" $true "$Url returned HTTP $($response.StatusCode) on attempt $attempt."
                return
                }
            }
            elseif ([string]::IsNullOrWhiteSpace($lastError)) {
                $lastError = "$Url returned HTTP $($response.StatusCode)."
            }
        }
        catch {
            $lastError = "$Url failed: $($_.Exception.Message)"
        }

        Start-Sleep -Seconds $SmokePollSeconds
    }

    Add-Check "$Name smoke" $false $lastError
}

function Invoke-JsonPostSmokeCheck {
    param(
        [string]$Name,
        [string]$Url,
        [object]$Body,
        [string]$SuccessProperty,
        [object]$SuccessValue
    )

    if ([string]::IsNullOrWhiteSpace($Url)) {
        Add-Check "$Name public URL" $false "No public URL was available."
        return
    }

    $payload = $Body | ConvertTo-Json -Depth 8 -Compress
    $lastError = ""
    for ($attempt = 1; $attempt -le $SmokePollAttempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Method Post -Uri $Url -ContentType "application/json" -Body $payload -UseBasicParsing -TimeoutSec 30
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
                $json = $response.Content | ConvertFrom-Json
                $actualValue = $json.$SuccessProperty
                if ($actualValue -eq $SuccessValue) {
                    Add-Check "$Name smoke" $true "$Url returned HTTP $($response.StatusCode) with $SuccessProperty=$SuccessValue on attempt $attempt."
                    return
                }

                $lastError = "$Url returned HTTP $($response.StatusCode), but $SuccessProperty was '$actualValue'."
            }
            else {
                $lastError = "$Url returned HTTP $($response.StatusCode)."
            }
        }
        catch {
            $lastError = "$Url failed: $($_.Exception.Message)"
        }

        Start-Sleep -Seconds $SmokePollSeconds
    }

    Add-Check "$Name smoke" $false $lastError
}

function Write-LegacyYaml {
    param(
        [string]$Path,
        [string]$LoginServer,
        [string]$AcrName,
        [string]$AcrPassword,
        [string]$OpenEmrImage,
        [string]$MariaDbImage,
        [object]$Profile
    )

    $registryPassword = Escape-YamlSingleQuoted $AcrPassword
    $databasePassword = Escape-YamlSingleQuoted ([string]$Profile.databasePassword)
    $legacyAdminPassword = Escape-YamlSingleQuoted ([string]$Profile.legacyAdminPassword)
    $legacyAdminUser = Escape-YamlSingleQuoted ([string]$Profile.legacyAdminUser)
    $environmentId = Get-ContainerAppEnvironmentResourceId $Profile

@"
environmentId: "$environmentId"
configuration:
  activeRevisionsMode: Single
  secrets:
    - name: acr-password
      value: $registryPassword
    - name: database-password
      value: $databasePassword
    - name: legacy-admin-password
      value: $legacyAdminPassword
  registries:
    - server: $LoginServer
      username: $AcrName
      passwordSecretRef: acr-password
  ingress:
    external: true
    targetPort: 80
    transport: auto
template:
  containers:
    - name: openemr
      image: $OpenEmrImage
      command:
        - /bin/sh
      args:
        - -lc
        - until mysqladmin ping -h 127.0.0.1 -uroot -p"`$MYSQL_ROOT_PASS" --silent; do echo waiting for mariadb; sleep 2; done; /usr/local/bin/openemr-demo-bootstrap.sh & ./openemr.sh
      env:
        - name: MYSQL_HOST
          value: 127.0.0.1
        - name: MYSQL_ROOT_PASS
          secretRef: database-password
        - name: MYSQL_USER
          value: openemr
        - name: MYSQL_PASS
          secretRef: database-password
        - name: MYSQL_DATABASE
          value: openemr
        - name: OE_USER
          value: $legacyAdminUser
        - name: OE_PASS
          secretRef: legacy-admin-password
        - name: OPENEMR_SETTING_portal_onsite_two_enable
          value: "1"
      resources:
        cpu: 1.0
        memory: 2.0Gi
    - name: mariadb
      image: $MariaDbImage
      args:
        - --character-set-server=utf8mb4
      env:
        - name: MYSQL_ROOT_PASSWORD
          secretRef: database-password
        - name: MYSQL_DATABASE
          value: openemr
        - name: MYSQL_USER
          value: openemr
        - name: MYSQL_PASSWORD
          secretRef: database-password
      resources:
        cpu: 0.5
        memory: 1.0Gi
  scale:
    minReplicas: 1
    maxReplicas: 1
"@ | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Write-ModernizedYaml {
    param(
        [string]$Path,
        [string]$LoginServer,
        [string]$AcrName,
        [string]$AcrPassword,
        [string]$WebImage,
        [string]$ApiImage,
        [object]$Profile
    )

    $registryPassword = Escape-YamlSingleQuoted $AcrPassword
    $databasePassword = Escape-YamlSingleQuoted ([string]$Profile.databasePassword)
    $resetOnDeploy = if ([bool]$Profile.resetOnDeploy) { "true" } else { "false" }
    $environmentId = Get-ContainerAppEnvironmentResourceId $Profile

@"
environmentId: "$environmentId"
configuration:
  activeRevisionsMode: Single
  secrets:
    - name: acr-password
      value: $registryPassword
    - name: postgres-password
      value: $databasePassword
  registries:
    - server: $LoginServer
      username: $AcrName
      passwordSecretRef: acr-password
  ingress:
    external: true
    targetPort: 8080
    transport: auto
template:
  containers:
    - name: web
      image: $WebImage
      resources:
        cpu: 0.5
        memory: 1.0Gi
    - name: api
      image: $ApiImage
      env:
        - name: ASPNETCORE_URLS
          value: http://+:8081
        - name: POSTGRES_HOST
          value: 127.0.0.1
        - name: POSTGRES_DB
          value: openemr_modernized
        - name: POSTGRES_USER
          value: openemr
        - name: POSTGRES_PASSWORD
          secretRef: postgres-password
        - name: DEMO_SEED_ON_STARTUP
          value: "true"
        - name: DEMO_RESET_ON_STARTUP
          value: "$resetOnDeploy"
      resources:
        cpu: 1.0
        memory: 2.0Gi
    - name: postgres
      image: postgres:17-alpine
      env:
        - name: POSTGRES_DB
          value: openemr_modernized
        - name: POSTGRES_USER
          value: openemr
        - name: POSTGRES_PASSWORD
          secretRef: postgres-password
      resources:
        cpu: 0.5
        memory: 1.0Gi
  scale:
    minReplicas: 1
    maxReplicas: 1
"@ | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Write-DemoPortalYaml {
    param(
        [string]$Path,
        [string]$LoginServer,
        [string]$AcrName,
        [string]$AcrPassword,
        [string]$PortalImage,
        [object]$Profile
    )

    $registryPassword = Escape-YamlSingleQuoted $AcrPassword
    $environmentId = Get-ContainerAppEnvironmentResourceId $Profile

@"
environmentId: "$environmentId"
configuration:
  activeRevisionsMode: Single
  secrets:
    - name: acr-password
      value: $registryPassword
  registries:
    - server: $LoginServer
      username: $AcrName
      passwordSecretRef: acr-password
  ingress:
    external: true
    targetPort: 80
    transport: auto
template:
  containers:
    - name: portal
      image: $PortalImage
      resources:
        cpu: 0.25
        memory: 0.5Gi
  scale:
    minReplicas: 1
    maxReplicas: 1
"@ | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Join-DemoPortalUrl {
    param(
        [string]$BaseUrl,
        [string]$Path
    )

    if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
        return ""
    }

    if ([string]::IsNullOrWhiteSpace($Path) -or $Path -eq "/") {
        return $BaseUrl.TrimEnd("/")
    }

    if ($Path -match "^https?://") {
        return $Path
    }

    return "$($BaseUrl.TrimEnd("/"))/$($Path.TrimStart("/"))"
}

function Add-DemoPresetToUrl {
    param(
        [string]$Url,
        [string]$DemoPreset
    )

    if ([string]::IsNullOrWhiteSpace($Url) -or [string]::IsNullOrWhiteSpace($DemoPreset)) {
        return $Url
    }

    $fragment = ""
    $urlWithoutFragment = $Url
    $fragmentIndex = $Url.IndexOf("#")
    if ($fragmentIndex -ge 0) {
        $fragment = $Url.Substring($fragmentIndex)
        $urlWithoutFragment = $Url.Substring(0, $fragmentIndex)
    }

    $separator = if ($urlWithoutFragment.Contains("?")) { "&" } else { "?" }
    return "${urlWithoutFragment}${separator}demo=$([System.Uri]::EscapeDataString($DemoPreset))$fragment"
}

function Get-DemoPortalTargetUrls {
    param(
        [object]$Profile,
        [hashtable]$KnownUrls,
        [string]$Prefix
    )

    $urls = @{}
    foreach ($key in $KnownUrls.Keys) {
        $urls[$key] = $KnownUrls[$key]
    }

    if (-not $urls.ContainsKey("legacy-openemr")) {
        $legacyUrl = Get-ContainerAppUrl -Name "$Prefix-legacy" -Profile $Profile -AllowMissing
        if (-not [string]::IsNullOrWhiteSpace($legacyUrl)) {
            $urls["legacy-openemr"] = $legacyUrl
        }
    }

    if (-not $urls.ContainsKey("modernized-openemr")) {
        $modernizedUrl = Get-ContainerAppUrl -Name "$Prefix-modernized" -Profile $Profile -AllowMissing
        if (-not [string]::IsNullOrWhiteSpace($modernizedUrl)) {
            $urls["modernized-openemr"] = $modernizedUrl
        }
    }

    return $urls
}

function Build-DemoPortalDataJson {
    param(
        [object]$Profile,
        [hashtable]$KnownUrls,
        [string]$Prefix
    )

    $registryPath = Join-Path $RepoRoot "modernization-workbench\config\demo-directory.json"
    if (-not (Test-Path -LiteralPath $registryPath)) {
        throw "Demo directory registry does not exist: $registryPath"
    }

    $registry = Get-Content -LiteralPath $registryPath -Raw | ConvertFrom-Json
    $targetUrls = Get-DemoPortalTargetUrls -Profile $Profile -KnownUrls $KnownUrls -Prefix $Prefix
    $applications = @()

    foreach ($application in @($registry.applications)) {
        $techStack = @()
        if ($null -ne $application.techStack) {
            foreach ($technology in @($application.techStack)) {
                $techStack += [ordered]@{
                    id = [string]$technology.id
                    label = [string]$technology.label
                    name = [string]$technology.name
                    logoText = [string]$technology.logoText
                    logoUrl = [string]$technology.logoUrl
                    color = [string]$technology.color
                }
            }
        }

        $entryPoints = @()
        foreach ($entry in @($application.entryPoints)) {
            $target = [string]$entry.target
            $baseUrl = if (-not [string]::IsNullOrWhiteSpace($target) -and $targetUrls.ContainsKey($target)) { [string]$targetUrls[$target] } else { "" }
            $staticUrl = [string]$entry.staticUrl
            $url = if (-not [string]::IsNullOrWhiteSpace($staticUrl)) { $staticUrl } else { Join-DemoPortalUrl -BaseUrl $baseUrl -Path ([string]$entry.path) }
            $demoPreset = [string]$entry.demoPreset
            $url = Add-DemoPresetToUrl -Url $url -DemoPreset $demoPreset
            $credentials = @()
            if ($null -ne $entry.credentials) {
                foreach ($credential in @($entry.credentials)) {
                    $credentials += [ordered]@{
                        label = [string]$credential.label
                        username = [string]$credential.username
                        password = [string]$credential.password
                    }
                }
            }

            $entryPoints += [ordered]@{
                id = [string]$entry.id
                label = [string]$entry.label
                role = [string]$entry.role
                target = $target
                url = $url
                demoPreset = $demoPreset
                note = [string]$entry.note
                credentials = @($credentials)
            }
        }

        $availableCount = @($entryPoints | Where-Object { -not [string]::IsNullOrWhiteSpace($_.url) }).Count
        $availableLinkWord = if ($availableCount -eq 1) { "link" } else { "links" }
        $applications += [ordered]@{
            id = [string]$application.id
            name = [string]$application.name
            versionLabel = [string]$application.versionLabel
            summary = [string]$application.summary
            tags = @($application.tags)
            techStack = @($techStack)
            statusLabel = if ($availableCount -gt 0) { "$availableCount $availableLinkWord ready" } else { "Waiting for deployment" }
            entryPoints = @($entryPoints)
        }
    }

    $data = [ordered]@{
        version = $registry.version
        title = [string]$registry.title
        subtitle = [string]$registry.subtitle
        notice = [string]$registry.notice
        generatedAt = (Get-Date).ToUniversalTime().ToString("o")
        applications = @($applications)
    }

    return ($data | ConvertTo-Json -Depth 12)
}

try {
    if (-not (Test-Path -LiteralPath $ProfilePath)) {
        throw "Profile file does not exist: $ProfilePath"
    }

    $profile = Get-Content -LiteralPath $ProfilePath -Raw | ConvertFrom-Json
    New-Item -ItemType Directory -Force $ArtifactsRoot | Out-Null

    Push-Location $RepoRoot
    try {
        if (-not $SmokeOnly) {
            & (Join-Path $PSScriptRoot "Test-AzureDemoPrerequisites.ps1") -ProfilePath $ProfilePath -ResultPath (Join-Path $ArtifactsRoot "prerequisites-result.json")
            if ($LASTEXITCODE -ne 0) {
                throw "Azure demo prerequisite validation failed."
            }
        }

        Invoke-AzLogged @("account", "set", "--subscription", $profile.subscriptionId) | Out-Null

        if (-not $SmokeOnly) {
            foreach ($providerNamespace in $RequiredAzureProviders) {
                Ensure-AzureProviderRegistered $providerNamespace
            }

            Invoke-AzLogged @("group", "create", "--name", $profile.resourceGroup, "--location", $profile.location, "-o", "none") | Out-Null

            $environmentExists = Test-AzResourceExists @("containerapp", "env", "show", "--name", $profile.containerAppEnvironment, "--resource-group", $profile.resourceGroup, "-o", "none")
            if (-not $environmentExists) {
                Invoke-AzLogged @("containerapp", "env", "create", "--name", $profile.containerAppEnvironment, "--resource-group", $profile.resourceGroup, "--location", $profile.location, "-o", "none") | Out-Null
            }
        }

        $prefix = Normalize-AppName ([string]$profile.appNamePrefix)
        $imageTag = ""
        if (-not $SmokeOnly) {
            $gitShaEntry = Invoke-Logged "git" @("rev-parse", "--short", "HEAD") -AllowFailure
            if ($gitShaEntry.exitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($gitShaEntry.output)) {
                $imageTag = $gitShaEntry.output.Trim()
                $gitStatusEntry = Invoke-Logged "git" @("status", "--porcelain") -AllowFailure
                if ($gitStatusEntry.exitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($gitStatusEntry.rawOutput)) {
                    $imageTag = "$imageTag-dirty-$(Get-Date -Format "yyyyMMddHHmmss")"
                }
            }
            else {
                $imageTag = Get-Date -Format "yyyyMMddHHmmss"
            }
        }

        $targets = @($profile.targets)
        $applicationUrls = @{}
        $loginServer = ""
        $acrPassword = ""
        if ((($targets -contains "legacy-openemr") -or ($targets -contains "modernized-openemr") -or ($targets -contains "demo-portal")) -and -not $SmokeOnly) {
            $acrExists = Test-AzResourceExists @("acr", "show", "--name", $profile.containerRegistry, "--resource-group", $profile.resourceGroup, "-o", "none")
            if (-not $acrExists) {
                Invoke-AzLogged @("acr", "create", "--name", $profile.containerRegistry, "--resource-group", $profile.resourceGroup, "--sku", "Basic", "--admin-enabled", "true", "-o", "none") | Out-Null
            }
            else {
                Invoke-AzLogged @("acr", "update", "--name", $profile.containerRegistry, "--admin-enabled", "true", "-o", "none") | Out-Null
            }
            Invoke-AzLogged @("acr", "login", "--name", $profile.containerRegistry) | Out-Null

            $loginServer = (Invoke-AzLoggedText @("acr", "show", "--name", $profile.containerRegistry, "--query", "loginServer", "-o", "tsv")).Trim()
            $acrPassword = Get-AcrPassword $profile.containerRegistry
        }

        if ($targets -contains "legacy-openemr") {
            $legacyName = "$prefix-legacy"
            $legacyImageName = "$prefix-legacy-openemr"
            $legacyYaml = Join-Path $ArtifactsRoot "legacy-openemr.containerapp.yaml"
            $legacyOpenEmrImage = if ($SmokeOnly) { "" } else { "$loginServer/$legacyImageName`:$imageTag" }
            $legacyDatabaseImage = "mariadb:11.8.8"
            if (-not $SmokeOnly) {
                Invoke-Logged "docker" @("build", "-f", ".\infra\azure\demo\legacy-openemr-demo.Dockerfile", "-t", $legacyOpenEmrImage, ".") | Out-Null
                Invoke-Logged "docker" @("push", $legacyOpenEmrImage) | Out-Null

                Write-LegacyYaml -Path $legacyYaml -LoginServer $loginServer -AcrName $profile.containerRegistry -AcrPassword $acrPassword -OpenEmrImage $legacyOpenEmrImage -MariaDbImage $legacyDatabaseImage -Profile $profile
                Apply-ContainerApp -Name $legacyName -YamlPath $legacyYaml -Profile $profile -ExpectedImages @($legacyOpenEmrImage, $legacyDatabaseImage)
            }
            $legacyUrl = Get-ContainerAppUrl -Name $legacyName -Profile $profile
            if (-not [string]::IsNullOrWhiteSpace($legacyUrl)) {
                $applicationUrls["legacy-openemr"] = $legacyUrl
            }
            Invoke-SmokeCheck -Name "Legacy OpenEMR" -Url $legacyUrl -MustContain "OpenEMR"
            Invoke-SmokeCheck -Name "Legacy OpenEMR patient portal" -Url "$legacyUrl/portal/index.php?site=default&demo=patient" -MustContain "Patient Portal Login" -MustNotContain "session timeout has occurred"
            $legacyApplication = [ordered]@{
                target = "legacy-openemr"
                name = $legacyName
                url = $legacyUrl
                yamlPath = $legacyYaml
            }
            if (-not $SmokeOnly) {
                $legacyApplication["legacyImage"] = $legacyOpenEmrImage
            }
            [void]$Applications.Add($legacyApplication)
        }

        if ($targets -contains "modernized-openemr") {
            $modernizedName = "$prefix-modernized"
            $apiImageName = "$prefix-modernized-api"
            $webImageName = "$prefix-modernized-web"
            $apiImage = ""
            $webImage = ""
            $modernizedYaml = Join-Path $ArtifactsRoot "modernized-openemr.containerapp.yaml"

            if (-not $SmokeOnly) {
                $apiImage = "$loginServer/$apiImageName`:$imageTag"
                $webImage = "$loginServer/$webImageName`:$imageTag"
                Invoke-Logged "docker" @("build", "-f", ".\infra\azure\demo\modernized-api-demo.Dockerfile", "-t", $apiImage, ".") | Out-Null
                Invoke-Logged "docker" @("build", "-f", ".\infra\azure\demo\modernized-frontend-demo.Dockerfile", "-t", $webImage, ".") | Out-Null
                Invoke-Logged "docker" @("push", $apiImage) | Out-Null
                Invoke-Logged "docker" @("push", $webImage) | Out-Null

                Write-ModernizedYaml -Path $modernizedYaml -LoginServer $loginServer -AcrName $profile.containerRegistry -AcrPassword $acrPassword -WebImage $webImage -ApiImage $apiImage -Profile $profile
                Apply-ContainerApp -Name $modernizedName -YamlPath $modernizedYaml -Profile $profile -ExpectedImages @($webImage, $apiImage, "postgres:17-alpine")
            }
            $modernizedUrl = Get-ContainerAppUrl -Name $modernizedName -Profile $profile
            if (-not [string]::IsNullOrWhiteSpace($modernizedUrl)) {
                $applicationUrls["modernized-openemr"] = $modernizedUrl
            }
            Invoke-SmokeCheck -Name "Modernized OpenEMR" -Url "$modernizedUrl/health" -MustContain "modernized-openemr-api"
            Invoke-JsonPostSmokeCheck -Name "Modernized OpenEMR login" -Url "$modernizedUrl/api/auth/login" -Body ([ordered]@{ username = "admin"; password = "pass" }) -SuccessProperty "authenticated" -SuccessValue $true
            $application = [ordered]@{
                target = "modernized-openemr"
                name = $modernizedName
                url = $modernizedUrl
                healthUrl = "$modernizedUrl/health"
                yamlPath = $modernizedYaml
            }
            if (-not $SmokeOnly) {
                $application["apiImage"] = $apiImage
                $application["webImage"] = $webImage
            }
            [void]$Applications.Add($application)
        }

        if ($targets -contains "demo-portal") {
            $portalName = "$prefix-portal"
            $portalImageName = "$prefix-demo-portal"
            $portalImage = ""
            $portalYaml = Join-Path $ArtifactsRoot "demo-portal.containerapp.yaml"
            $portalDataPath = Join-Path $ArtifactsRoot "demo-portal-data.json"

            if (-not $SmokeOnly) {
                $portalImage = "$loginServer/$portalImageName`:$imageTag"
                $portalDataJson = Build-DemoPortalDataJson -Profile $profile -KnownUrls $applicationUrls -Prefix $prefix
                $portalDataJson | Set-Content -LiteralPath $portalDataPath -Encoding UTF8
                $portalDataB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($portalDataJson))
                $previousPortalDataB64 = $env:DEMO_PORTAL_DATA_B64
                try {
                    $env:DEMO_PORTAL_DATA_B64 = $portalDataB64
                    Invoke-Logged "docker" @("build", "-f", ".\infra\azure\demo\demo-portal.Dockerfile", "--build-arg", "DEMO_PORTAL_DATA_B64", "-t", $portalImage, ".") | Out-Null
                }
                finally {
                    $env:DEMO_PORTAL_DATA_B64 = $previousPortalDataB64
                }
                Invoke-Logged "docker" @("push", $portalImage) | Out-Null

                Write-DemoPortalYaml -Path $portalYaml -LoginServer $loginServer -AcrName $profile.containerRegistry -AcrPassword $acrPassword -PortalImage $portalImage -Profile $profile
                Apply-ContainerApp -Name $portalName -YamlPath $portalYaml -Profile $profile -ExpectedImages @($portalImage)
            }

            $portalUrl = Get-ContainerAppUrl -Name $portalName -Profile $profile
            Invoke-SmokeCheck -Name "Demo Portal" -Url $portalUrl -MustContain "OpenEMR Demo Portal"
            $application = [ordered]@{
                target = "demo-portal"
                name = $portalName
                url = $portalUrl
                healthUrl = "$portalUrl/health"
                yamlPath = $portalYaml
                directoryDataPath = $portalDataPath
            }
            if (-not $SmokeOnly) {
                $application["portalImage"] = $portalImage
            }
            [void]$Applications.Add($application)
        }

        $failedChecks = @($Checks | Where-Object { -not $_.passed })
        if ($failedChecks.Count -gt 0) {
            Write-Result -Status "failed" -Profile $profile -ErrorMessage "$($failedChecks.Count) smoke check(s) failed." -ImageTag $imageTag
            exit 1
        }

        Write-Result -Status "passed" -Profile $profile -ImageTag $imageTag
    }
    finally {
        Pop-Location
    }
}
catch {
    Write-Result -Status "failed" -Profile $profile -ErrorMessage $_.Exception.Message
    exit 1
}
