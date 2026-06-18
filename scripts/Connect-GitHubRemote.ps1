param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https://github\.com/.+/.+\.git$|^git@github\.com:.+/.+\.git$')]
    [string] $RemoteUrl,

    [string] $RemoteName = "origin",

    [string] $Branch = "main",

    [switch] $ValidateOnly,

    [switch] $SkipPush
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]] $Arguments
    )

    $output = & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }

    return $output
}

$repoRoot = Invoke-Git -Arguments @("rev-parse", "--show-toplevel")
Set-Location $repoRoot

$branchName = Invoke-Git -Arguments @("branch", "--show-current")
if ($branchName -ne $Branch) {
    throw "Expected branch '$Branch' but current branch is '$branchName'."
}

$trackedStatus = Invoke-Git -Arguments @("status", "--short", "--untracked-files=all")
if ($trackedStatus) {
    throw "Working tree has uncommitted tracked changes. Commit or discard them before connecting GitHub."
}

$ignoredStatus = Invoke-Git -Arguments @("status", "--short", "--ignored")
$unexpectedUntracked = $ignoredStatus | Where-Object { $_ -notmatch '^!! legacy-openemr/(\.env|artifacts/|source/)' }
if ($unexpectedUntracked) {
    throw "Unexpected untracked or ignored paths detected:`n$($unexpectedUntracked -join [Environment]::NewLine)"
}

$existingRemote = & git remote get-url $RemoteName 2>$null
if ($LASTEXITCODE -eq 0) {
    if ($existingRemote -ne $RemoteUrl) {
        throw "Remote '$RemoteName' already points to '$existingRemote', not '$RemoteUrl'."
    }
} elseif ($ValidateOnly) {
    # Validation-only mode intentionally leaves remotes untouched.
} else {
    Invoke-Git -Arguments @("remote", "add", $RemoteName, $RemoteUrl) | Out-Null
}

if (-not $SkipPush -and -not $ValidateOnly) {
    Invoke-Git -Arguments @("push", "-u", $RemoteName, $Branch) | Out-Null
}

[pscustomobject]@{
    repositoryRoot = $repoRoot
    remoteName = $RemoteName
    remoteUrl = $RemoteUrl
    branch = $Branch
    validateOnly = [bool]$ValidateOnly
    pushed = -not $SkipPush -and -not $ValidateOnly
} | ConvertTo-Json -Depth 3
