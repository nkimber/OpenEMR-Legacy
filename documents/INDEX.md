# Project Documents Index

This folder contains the core planning and decision documents for the OpenEMR modernization project. Use this index first when deciding which project documents to read.

## Start Here

### `PROJECT_CONTEXT.md`

Read this when you need the overall project intent, modernization goals, baseline strategy, validation approach, or high-level constraints.

It explains why we are using OpenEMR, what the legacy and modernized systems are expected to do, and how tests will be used to compare behavior.

### `DOCUMENTATION_GOVERNANCE.md`

Read this before making project changes that affect code, configuration, architecture, testing, operations, setup, migration strategy, or durable decisions.

It explains how project documents must stay synchronized with the actual state of the repository.

### `PROJECT_CHANGELOG.md`

Read this when you need the chronological record of concrete implementation steps, enhancements, verification milestones, and release-note-style project progress.

It explains what has changed so far, why each step mattered, where the related files live, and which commit captured the work when available.

### `MODERNIZATION_WORKBENCH.md`

Read this when working on the third application: the oversight, orchestration, comparison, and progress-tracking website for the modernization effort.

It explains how the workbench relates to the legacy OpenEMR baseline and the modernized target solution.

### `LEGACY_OPENEMR_BASELINE.md`

Read this when working on the installed original OpenEMR baseline, Docker Compose runtime, source checkout, smoke test, or environment verification.

It explains where the legacy application lives, which versions are pinned, how to start it, and what has been verified.

### `TEST_DATA_STRATEGY.md`

Read this when deciding how to seed the legacy baseline, designing synthetic patients and workflow fixtures, or writing tests that depend on the gold dataset.

It explains which upstream OpenEMR demo-data options exist, why the project uses its own deterministic gold dataset, the verified record counts, and how tests should reference canonical patient IDs.

### `TEST_ARCHITECTURE.md`

Read this when working on the parity test harness, database/API/UI test layers, reset strategy, test-run artifacts, Workbench test orchestration, or future side-by-side modernized target testing.

It explains how `parity-tests/` is structured and how tests should remain reusable across the legacy and modernized targets.

### `GITHUB_CONNECTION.md`

Read this when connecting the parent modernization workspace to GitHub or verifying remote repository state.

It explains what should be tracked, what should remain local-only, and which commands complete the remote connection.

## Document Categories

The document set is expected to grow in these areas:

- **Context and goals** - project background, success criteria, guiding assumptions.
- **Architecture** - legacy OpenEMR baseline, modern target architecture, API boundaries, database migration approach.
- **Workbench** - modernization oversight, application lifecycle control, test orchestration, technical comparison, progress tracking, and evidence reports.
- **Testing and validation** - unit, functional, API, and Playwright UI tests; seed data; side-by-side comparison strategy.
- **Migration planning** - workflow-by-workflow modernization plans, data mapping, business-rule extraction.
- **Operations** - Docker setup, local development, reproducible environments, CI notes.
- **Decisions** - architecture decision records and tradeoffs.
- **Project history** - chronological implementation steps, verification milestones, and release-note-style progress tracking.

## Maintenance Rules

- Add every new project document to this index.
- Give each entry a clear "read this when" purpose.
- Prefer one document per durable concern rather than one large catch-all document.
- Link related documents when a topic crosses boundaries.
- Update relevant documents in the same change as code, configuration, tests, setup, or architectural decisions.
- If a decision is made during project execution, record it in the appropriate durable document.
- Update `PROJECT_CHANGELOG.md` when implementation steps, enhancements, verification milestones, or release-note-worthy project behavior changes.
- Keep historical decisions rather than silently rewriting them; add dated updates when direction changes.

## Current Documents

| Document | Purpose | Read This When |
| --- | --- | --- |
| `DOCUMENTATION_GOVERNANCE.md` | Defines the rule that project documents must stay synchronized with project state, code, tests, setup, and decisions. | Before making changes that affect implementation, architecture, setup, test strategy, or durable project direction. |
| `GITHUB_CONNECTION.md` | Tracks local Git and GitHub remote connection state, including what should be pushed and what should remain ignored. | Connecting the project to GitHub, checking remotes, pushing the initial branch, or troubleshooting repository tracking. |
| `LEGACY_OPENEMR_BASELINE.md` | Documents the installed legacy OpenEMR baseline, pinned source/image versions, Docker runtime, local URLs, smoke test, and verified status. | Starting, stopping, testing, resetting, inspecting, or changing the original OpenEMR baseline. |
| `MODERNIZATION_WORKBENCH.md` | Defines the implemented third website that oversees the legacy baseline, modernized target, application lifecycle control, test orchestration, comparison results, and technical architecture differences. | Running, planning, or extending the workbench, app start/stop controls, test-run dashboard, parity reporting, workflow progress tracking, or architecture comparison views. |
| `PROJECT_CHANGELOG.md` | Tracks the chronological implementation steps, enhancements, verification milestones, and release-note-style progress for the project. | Understanding what has already been built, adding a new improvement entry, preparing summaries, or checking the sequence of project evolution. |
| `PROJECT_CONTEXT.md` | Establishes the initial modernization vision, baseline/target-system model, and validation strategy. | Starting project work, explaining the goal, planning architecture, designing tests, or choosing the first modernization slice. |
| `TEST_ARCHITECTURE.md` | Defines the TypeScript/Playwright parity test harness, test layers, reset modes, artifact model, Workbench orchestration, and future modernized target strategy. | Writing or running parity tests, adding test suites, changing reset behavior, integrating tests with the Workbench, or preparing side-by-side comparison. |
| `TEST_DATA_STRATEGY.md` | Defines the gold seed-data strategy, upstream sample/demo-data findings, verified counts, and rules for deterministic synthetic test data. | Seeding the baseline, creating test fixtures, validating expected data counts, or planning workflow parity tests. |
