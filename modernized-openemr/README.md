# Modernized OpenEMR

This folder contains the from-scratch modernized OpenEMR target.

Current stack:

- React and TypeScript frontend.
- ASP.NET Core 10 API.
- PostgreSQL database.
- Docker Compose local runtime.
- Shared gold dataset mapped from `modernization-workbench/seed-data/openemr-shared-synthetic-v1`.

## Current Slice

The first implemented slice is read-only patient search and chart summary.

It seeds the canonical gold dataset into PostgreSQL, exposes patient search and chart-summary APIs, and renders a familiar OpenEMR-style patient workspace in the React app.

## Local Commands

Start PostgreSQL:

```powershell
docker compose up -d postgres
```

Seed the modernized database:

```powershell
.\scripts\Seed-ModernizedGoldDataset.ps1
```

Run the API locally:

```powershell
dotnet run --project .\backend\src\OpenEmr.Modernized.Api\OpenEmr.Modernized.Api.csproj
```

Run the frontend locally:

```powershell
cd .\frontend
npm run dev -- --host 127.0.0.1 --port 3000
```

Or start the full Docker Compose runtime:

```powershell
docker compose up -d
```

Run the smoke checks after the API is running:

```powershell
.\scripts\Test-ModernizedBaseline.ps1
```
