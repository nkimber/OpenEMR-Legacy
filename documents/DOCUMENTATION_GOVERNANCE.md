# Documentation Governance

Created: 2026-06-18

## Purpose

The project documents are part of the project deliverable, not a separate after-the-fact summary. They should describe the current state of the codebase, setup, architecture, test strategy, migration plan, and durable decisions.

As this project grows, the document set will become the main way future Codex sessions and human contributors understand what has already been decided and what should be read before changing a specific area.

## Core Rule

When a requested change affects the project state, update the relevant documents in the same work item.

This applies to:

- Code changes.
- Docker, environment, or setup changes.
- Test strategy or test harness changes.
- Seed data changes.
- Architecture or technology decisions.
- API contracts.
- Database schema, migration, or data-mapping decisions.
- Workflow-scope decisions.
- Operational instructions.
- Known limitations, risks, or deferred work.
- Project changelog entries for concrete implementation steps, enhancements, and verification milestones.

## What To Update

Use `documents/INDEX.md` as the routing map. Read the relevant document before changing it, then update it with the smallest accurate change.

Common update patterns:

- Update setup or operations documents when commands, ports, containers, environment variables, or startup steps change.
- Update architecture documents when system boundaries, technology choices, or service responsibilities change.
- Update testing documents when test layers, fixtures, seed data, Playwright coverage, or parity checks change.
- Update migration documents when a legacy workflow, table, API, or business rule is mapped into the modernized system.
- Update decision records when a durable decision is made or reversed.
- Update `documents/PROJECT_CHANGELOG.md` when a concrete implementation step, enhancement, verification milestone, or release-note-worthy behavior change is completed.
- Update `documents/INDEX.md` whenever a new document is added or the purpose of an existing document changes.

## Decision Handling

Decisions made during project execution should not live only in chat history.

For small decisions, update the relevant existing document. For larger or contentious decisions, create a decision document and add it to `documents/INDEX.md`.

A decision entry should usually include:

- Date.
- Decision.
- Context.
- Consequences.
- Status, such as proposed, accepted, superseded, or rejected.

## Synchronization Checklist

Before finishing a change, check:

- Did code, configuration, tests, scripts, or setup change?
- Did the change alter the expected workflow, architecture, or migration strategy?
- Did the change introduce a new command, dependency, port, service, data fixture, or test assumption?
- Was a decision made that future contributors need to know?
- Did the completed work deserve a new project changelog entry?
- Does `documents/INDEX.md` still route readers to the right place?

If the answer to any of these is yes, update the documents before closing the work.

## Staleness Rule

If an agent finds a document that conflicts with the current codebase or verified project behavior, the agent should either update the document as part of the work or clearly identify the mismatch if it cannot be resolved immediately.

The preferred outcome is synchronized code and documentation, not a separate note that the documentation may be stale.
