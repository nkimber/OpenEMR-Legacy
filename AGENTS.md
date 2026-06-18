# Agent Guide

This repository is a working space for an OpenEMR modernization project. Future Codex sessions should treat the `documents` folder as the project memory and planning source before making architectural or implementation decisions.

## Documents Folder

Core project documents live in `documents/`.

Start with `documents/INDEX.md`. It is the routing map for the document set and should explain which documents to read for each kind of task. As new documents are added, update the index in the same change so the document library remains navigable.

Current entry points:

- `documents/INDEX.md` - document catalog and reading guide.
- `documents/PROJECT_CONTEXT.md` - initial project context, goals, modernization strategy, and validation approach.
- `documents/DOCUMENTATION_GOVERNANCE.md` - rules for keeping documents synchronized with project decisions and code changes.
- `documents/MODERNIZATION_WORKBENCH.md` - purpose, scope, and planned capabilities for the oversight and orchestration website.
- `documents/LEGACY_OPENEMR_BASELINE.md` - installed legacy OpenEMR baseline, pinned versions, commands, and verification state.

## Project Direction

The project will use OpenEMR as the legacy reference application. The intended workflow is to install and run a reproducible baseline OpenEMR environment, seed it with known test data, write tests that describe expected behavior, build a Modernization Workbench to oversee and orchestrate the effort, and then build a modernized implementation that can be tested side by side against the same scenarios.

The modernization target is a modern SPA-style UI, a public backend API, a service/business tier, and PostgreSQL as the database. The new system should preserve the observable behavior of the chosen OpenEMR workflows while allowing the internals to be redesigned.

## Working Rules For Agents

- Read `documents/INDEX.md` first when a task involves project direction, architecture, test strategy, modernization scope, or documentation.
- Treat documentation as part of the implementation. When code, configuration, architecture, test strategy, setup steps, or project decisions change, update the relevant documents in the same work item.
- Keep project documents concise, explicit, and cross-linked.
- Prefer small vertical slices over broad rewrites.
- Preserve the legacy OpenEMR baseline as a reference system.
- Treat tests as executable specifications for behavior parity.
- Record durable decisions in the document set instead of leaving them only in chat history.
- When adding a new document, include its purpose, when to read it, and how it relates to existing documents in `documents/INDEX.md`.
- Avoid storing secrets, real patient data, credentials, or PHI in this repository.
