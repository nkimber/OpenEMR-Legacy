# Modernization Workbench

Created: 2026-06-18

## Purpose

The Modernization Workbench is the third application in this project. It is an oversight and orchestration website for managing the modernization of OpenEMR from the legacy baseline into the modernized target solution.

The workbench should make the modernization effort observable. A user should be able to open it and understand what exists, what is running, what has been tested, which workflows have been modernized, how the two systems compare, and what evidence supports the current state.

## Relationship To The Other Systems

The project has three major systems:

- **Legacy OpenEMR baseline** - the original OpenEMR application running locally in a reproducible Docker-based environment.
- **Modernization Workbench** - the oversight website that tracks status, progress, tests, comparisons, and technical differences.
- **Modernized OpenEMR target** - the new implementation built in vertical slices using a modern UI, API, business tier, and PostgreSQL.

The workbench should be built after the baseline can run at least a minimal meaningful test set. It can then become the primary visual control surface for the rest of the modernization effort.

The intended operator workflow is that a user runs one local script to start the Modernization Workbench, then uses the Workbench to inspect, start, stop, restart, and test the other project applications such as the legacy OpenEMR site.

## Core Responsibilities

The workbench should help answer:

- Is the legacy OpenEMR baseline running?
- Which OpenEMR version and seed-data version are being used?
- Which tests can be run against the baseline?
- What were the latest test results?
- Is the modernized target running?
- Which applications are stopped, starting, healthy, unhealthy, or stopped with errors?
- Can an operator start, stop, or restart a project application from one controlled interface?
- Which workflow slices have been discovered, implemented, and parity tested?
- How do the legacy and modernized systems compare for a given workflow?
- What are the technical architecture differences between the two systems?
- What evidence exists for the current modernization state?

## Initial Version

The first workbench version should be intentionally small and useful.

Initial capabilities:

- Show legacy OpenEMR environment status.
- Show configured baseline URL, database status, and seed-data status when available.
- Start, stop, and restart the legacy OpenEMR Docker Compose environment through controlled local commands.
- Trigger baseline smoke tests through `legacy-openemr/scripts/Test-LegacyBaseline.ps1`.
- Display latest baseline test results.
- Display recent lifecycle action results, including command status, duration, and logs.
- Display links or paths to logs, screenshots, and reports.
- Show placeholder sections for the modernized target and side-by-side comparison, marked as not started until those systems exist.
- Show a project progress view with the three major systems and their current stage.

The first version should not require the modernized target to exist.

## Application Lifecycle Control

The workbench should be able to control the running state of project applications, but only through explicit, allowlisted operations.

Expected lifecycle actions:

- Check status.
- Start.
- Stop.
- Restart.
- Run health check.
- Open application URL.
- View recent logs.

Initial target:

- Legacy OpenEMR baseline in `legacy-openemr/`, controlled through Docker Compose.

Future targets:

- Modernized OpenEMR API.
- Modernized OpenEMR UI.
- Databases and supporting services used by the modernized target.
- Test runners and comparison services.

Preferred implementation:

- A Workbench startup script starts the Workbench backend and frontend.
- The Workbench backend exposes local-only orchestration APIs.
- Each managed application has a manifest that defines its working directory, start command, stop command, status command, health endpoint, public URL, and log locations.
- The frontend calls the backend for lifecycle actions.
- The backend executes only predefined commands from manifests.

The Workbench should not provide a general-purpose shell. Lifecycle control is powerful enough that it must remain local, explicit, logged, and constrained to known project commands.

## Test Orchestration

The workbench may trigger tests, but tests should remain executable outside the workbench.

Preferred pattern:

- Test suites live in normal source-controlled test projects or scripts.
- The workbench calls a small orchestration API or command runner.
- Test output is written to structured result files.
- The workbench reads and displays those result files.
- The same commands can later run in CI.

The first available baseline test command is `legacy-openemr/scripts/Test-LegacyBaseline.ps1`, which writes `legacy-openemr/artifacts/latest-smoke-test.json`.

This keeps the workbench honest: it reports real automation evidence instead of inventing its own private test flow.

## Comparison Capabilities

Once the modernized target exists, the workbench should support side-by-side comparison.

Comparison views should include:

- Test pass/fail comparison by suite and workflow.
- Normalized API response differences.
- Normalized database or domain-state differences where appropriate.
- Playwright screenshots or traces for UI workflows.
- Timing and reliability trends.
- Known accepted differences.
- Blocking differences that prevent parity signoff.

The comparison should focus on observable behavior and domain outcomes rather than identical internal implementation details.

## Technical Architecture Comparison

The workbench should also make the technical modernization visible.

Architecture comparison views should show:

- Legacy technology stack and runtime components.
- Modernized technology stack and runtime components.
- Data stores used by each system.
- API boundaries and integration points.
- Where business logic lives in each system.
- Authentication and authorization model differences.
- Test coverage by layer for each system.
- Migration status by workflow, table, API, or domain area.

This information may initially come from curated project documents and static metadata. Over time, some of it may be generated from repository scans, build metadata, service health endpoints, or test manifests.

## Progress Model

Workflow progress should be tracked by modernization slice.

Suggested states:

- Not started.
- Legacy behavior discovery.
- Legacy tests written.
- Modern API designed.
- Modern database mapping designed.
- Modern implementation in progress.
- Modern tests written.
- Side-by-side parity testing.
- Parity verified.
- Deferred or blocked.

Each workflow should link to the relevant documents, tests, logs, and known decisions.

## Design Principle

The workbench is a control surface and evidence viewer. It should not hide the underlying modernization process.

Every action it performs should map to a repeatable command, script, API call, test suite, or documented workflow that can be inspected and run without the workbench.
