# GitHub Connection

Created: 2026-06-18

## Purpose

This document tracks the state of connecting the local OpenEMR modernization workspace to GitHub.

## Current State

The parent project is initialized as a local Git repository on branch `main`.

The GitHub remote is attached and `main` has been pushed.

- Repository: `nkimber/OpenEMR-Legacy`
- URL: `https://github.com/nkimber/OpenEMR-Legacy.git`
- Remote name: `origin`
- Default branch: `main`
- Visibility: public

The helper script `scripts/Connect-GitHubRemote.ps1` has been validated in `-ValidateOnly` mode against a placeholder GitHub URL. It passed local safety checks without adding a remote or pushing.

Git Credential Manager is configured as the local Git credential helper and the `nkimber` GitHub account is available for future pushes.

The local repository intentionally tracks the modernization workspace, orchestration files, scripts, and documents. It intentionally does not track:

- `legacy-openemr/.env`
- `legacy-openemr/source/`
- `legacy-openemr/artifacts/`

The ignored `legacy-openemr/source/` folder is a local checkout of the upstream OpenEMR source for inspection and analysis. It should not be vendored into this parent repository by accident.

## Remote Connection Command

The remote was connected with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Connect-GitHubRemote.ps1 -RemoteUrl https://github.com/nkimber/OpenEMR-Legacy.git
```

The repository also includes a helper script that performs safety checks before adding the remote and pushing:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Connect-GitHubRemote.ps1 -RemoteUrl https://github.com/<owner>/<repo>.git
```

The helper checks that the current branch is `main`, that tracked files are clean, and that the only ignored local paths are the expected OpenEMR runtime/source folders.

To run only the local validation checks without adding a remote or pushing:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Connect-GitHubRemote.ps1 -RemoteUrl https://github.com/<owner>/<repo>.git -ValidateOnly
```

## Verification

Connection verification:

- `git remote -v` shows the expected GitHub repository.
- `git status --short` is clean except expected ignored runtime files.
- `git ls-remote --heads origin main` returns the pushed branch.
- The GitHub repository shows the root `README.md`, `AGENTS.md`, `documents/`, and `legacy-openemr/` orchestration files.
