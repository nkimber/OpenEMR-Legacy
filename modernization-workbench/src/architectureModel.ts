import type { ArchitectureModel, ArchitectureSystemSummary, ArchitectureTechnology } from "./types";

const devicon = (path: string) => `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${path}`;

function tech(id: string, name: string, version: string, detail: string, logoText: string, color: string, logoUrl?: string): ArchitectureTechnology {
  return { id, name, version, detail, logoText, color, logoUrl };
}

const t = {
  openemr: tech("openemr", "OpenEMR", "8.1.0-2026-06-18", "Pinned legacy reference application image.", "OE", "#2f8f7b"),
  php: tech("php", "PHP", "8.5.6", "Runtime reported by the running OpenEMR container.", "PHP", "#777bb4", devicon("php/php-original.svg")),
  apache: tech("apache", "Apache", "2.4.67", "HTTP server reported by the running OpenEMR container.", "A", "#d22128", devicon("apache/apache-original.svg")),
  mariadb: tech("mariadb", "MariaDB", "11.8.8", "Pinned legacy database image and running server version.", "DB", "#003545", devicon("mariadb/mariadb-original.svg")),
  bootstrap: tech("bootstrap", "Bootstrap", "4.6.2", "Legacy OpenEMR interface dependency.", "B", "#7952b3", devicon("bootstrap/bootstrap-original.svg")),
  angular: tech("angular", "AngularJS", "1.8.3", "Legacy OpenEMR interface dependency.", "A", "#dd0031", devicon("angularjs/angularjs-original.svg")),
  reactWorkbench: tech("react-workbench", "React", "19.2.7", "Workbench UI runtime from package lock.", "R", "#61dafb", devicon("react/react-original.svg")),
  reactModernized: tech("react-modernized", "React", "19.2.7", "Modernized OpenEMR UI runtime from package lock.", "R", "#61dafb", devicon("react/react-original.svg")),
  typescriptWorkbench: tech("typescript-workbench", "TypeScript", "5.9.3", "Workbench compile-time language version.", "TS", "#3178c6", devicon("typescript/typescript-original.svg")),
  typescriptModernized: tech("typescript-modernized", "TypeScript", "6.0.3", "Modernized frontend compile-time language version.", "TS", "#3178c6", devicon("typescript/typescript-original.svg")),
  viteWorkbench: tech("vite-workbench", "Vite", "7.3.5", "Workbench dev/build tool version from package lock.", "V", "#646cff", devicon("vitejs/vitejs-original.svg")),
  viteModernized: tech("vite-modernized", "Vite", "8.0.16", "Modernized frontend dev/build tool version from package lock.", "V", "#646cff", devicon("vitejs/vitejs-original.svg")),
  nodeWorkbench: tech("node-workbench", "Node.js", "24.13.1", "Local Workbench API/tooling runtime.", "N", "#5fa04e", devicon("nodejs/nodejs-original.svg")),
  nodeModernized: tech("node-modernized", "Node.js", "24.17.0", "Modernized frontend container runtime.", "N", "#5fa04e", devicon("nodejs/nodejs-original.svg")),
  express: tech("express", "Express", "5.2.1", "Workbench local-only orchestration API.", "EX", "#20232a", devicon("express/express-original.svg")),
  dotnet: tech("dotnet", ".NET", "10.0.9", "Modernized API runtime reported by the container.", ".NET", "#512bd4", devicon("dotnetcore/dotnetcore-original.svg")),
  aspnet: tech("aspnet", "ASP.NET Core", "10.0.9", "Modernized public backend API framework.", "API", "#512bd4", devicon("dotnetcore/dotnetcore-original.svg")),
  npgsql: tech("npgsql", "Npgsql", "10.0.3", "PostgreSQL data provider used by the modernized API.", "PG", "#336791"),
  postgres: tech("postgres", "PostgreSQL", "17.10", "Modernized target database server version.", "PG", "#336791", devicon("postgresql/postgresql-original.svg")),
  docker: tech("docker", "Docker Compose", "5.0.2", "Local application orchestration version.", "D", "#2496ed", devicon("docker/docker-original.svg")),
  json: tech("json", "JSON artifacts", "local files", "Workbench state, event, test, seed, and changelog artifacts.", "{}", "#8b5cf6"),
  seed: tech("seed", "Gold seed contract", "openemr-shared-synthetic-v1", "Shared deterministic synthetic dataset.", "SD", "#d97706"),
  playwright: tech("playwright", "Playwright", "1.61.0", "Browser parity and UI evidence runner.", "PW", "#45ba4b", devicon("playwright/playwright-original.svg")),
  jest: tech("jest", "Jest", "29.7.0", "Legacy OpenEMR JavaScript native test lane.", "J", "#99425b", devicon("jest/jest-plain.svg")),
  phpunit: tech("phpunit", "PHPUnit", "^11.0", "Legacy OpenEMR isolated native PHP test lane.", "PU", "#4f5b93")
};

function summaryFor(summaries: ArchitectureSystemSummary[], id: string, fallback: ArchitectureSystemSummary) {
  return summaries.find((system) => system.id === id) ?? fallback;
}

export function buildArchitectureModel(summaries: ArchitectureSystemSummary[]): ArchitectureModel {
  const legacy = summaryFor(summaries, "legacy-openemr", {
    id: "legacy-openemr",
    name: "Legacy OpenEMR",
    status: "Implemented baseline",
    stack: [],
    database: "MariaDB",
    businessLogic: "Existing OpenEMR PHP application and database access layer",
    tests: []
  });
  const workbench = summaryFor(summaries, "modernization-workbench", {
    id: "modernization-workbench",
    name: "Modernization Workbench",
    status: "First version",
    stack: [],
    database: "File-based local artifacts for this version",
    businessLogic: "Local-only orchestration API with allowlisted commands",
    tests: []
  });
  const modernized = summaryFor(summaries, "modernized-openemr", {
    id: "modernized-openemr",
    name: "Modernized OpenEMR",
    status: "Slice 49 account balance implemented",
    stack: [],
    database: "PostgreSQL",
    businessLogic: "Server-side API owns implemented modernization slices",
    tests: []
  });

  return {
    systems: [
      {
        ...legacy,
        purpose: "Behavioral reference system for modernization parity.",
        architecturePattern: "Containerized legacy monolith with PHP server-rendered workflows, legacy JavaScript, and direct MariaDB coupling.",
        runtime: "OpenEMR image 8.1.0-2026-06-18, PHP 8.5.6, Apache 2.4.67, Docker Compose 5.0.2.",
        dataOwnership: "Owns the legacy MariaDB schema and remains the source of observable behavior.",
        technologies: [t.openemr, t.php, t.apache, t.mariadb, t.bootstrap, t.angular, t.docker, t.phpunit, t.jest, t.playwright],
        diagram: {
          title: "Legacy Runtime",
          subtitle: "A pinned OpenEMR container remains the reference point for all parity checks.",
          nodes: [
            { id: "legacy-browser", title: "Browser UI", subtitle: "OpenEMR screens, legacy interface assets, Bootstrap, AngularJS.", technologies: [t.openemr, t.bootstrap, t.angular] },
            { id: "legacy-app", title: "OpenEMR application", subtitle: "PHP workflows served through Apache.", technologies: [t.openemr, t.php, t.apache] },
            { id: "legacy-db", title: "Legacy data store", subtitle: "Original MariaDB schema seeded with synthetic gold data.", technologies: [t.mariadb, t.seed] },
            { id: "legacy-evidence", title: "Behavior evidence", subtitle: "Native tests, smoke checks, Playwright UI flows, and reusable parity plans.", technologies: [t.phpunit, t.jest, t.playwright] }
          ],
          edges: [
            { from: "Browser UI", to: "OpenEMR application", label: "renders and submits legacy workflows" },
            { from: "OpenEMR application", to: "Legacy data store", label: "reads and writes legacy schema" },
            { from: "Behavior evidence", to: "OpenEMR application", label: "describes expected observable behavior" }
          ]
        },
        narratives: [
          {
            title: "Reference, not destination",
            body: "The legacy baseline is intentionally preserved as the behavioral oracle. The modernization work is allowed to redesign internals, but the visible workflow outcomes are checked against this pinned environment."
          },
          {
            title: "Coupled by design",
            body: "OpenEMR combines UI, PHP workflow logic, database access, and schema behavior inside one mature application. The Architecture page makes that coupling visible because it explains why parity tests matter."
          }
        ],
        responsibilities: [
          "Provide the original workflow behavior for comparison.",
          "Accept the shared gold dataset through the legacy MariaDB adapter.",
          "Run smoke, native, UI, workflow, and side-by-side parity evidence."
        ],
        evidence: [
          "Smoke test verifies health, login reachability, and admin shell access.",
          "Native PHPUnit stable lane covers 2,344 tests and 6,188 assertions.",
          "Native Jest lane covers 12 suites and 105 JavaScript tests.",
          "Side-by-side parity plans exist through Slice 49 account balance readiness."
        ]
      },
      {
        ...workbench,
        purpose: "Local control surface, evidence viewer, and modernization map.",
        architecturePattern: "React SPA plus local Express API that runs only allowlisted project commands and reads structured artifacts.",
        runtime: "React 19.2.7, TypeScript 5.9.3, Vite 7.3.5, Node.js 24.13.1, Express 5.2.1.",
        dataOwnership: "Owns Workbench-local JSON artifacts, event history, seed manifest visibility, and parsed project changelog data.",
        technologies: [t.reactWorkbench, t.typescriptWorkbench, t.viteWorkbench, t.nodeWorkbench, t.express, t.json, t.seed, t.docker],
        diagram: {
          title: "Workbench Orchestration",
          subtitle: "The Workbench observes and controls the project without becoming the only way to run it.",
          nodes: [
            { id: "workbench-ui", title: "Workbench UI", subtitle: "React/Vite operator experience with status, tests, progress, seed data, and architecture views.", technologies: [t.reactWorkbench, t.typescriptWorkbench, t.viteWorkbench] },
            { id: "workbench-api", title: "Local API", subtitle: "Express endpoints expose allowlisted lifecycle, test, seed, log, and metadata operations.", technologies: [t.nodeWorkbench, t.express] },
            { id: "workbench-artifacts", title: "Evidence artifacts", subtitle: "JSON summaries, logs, screenshots, reports, seed results, and parsed changelog entries.", technologies: [t.json, t.seed] },
            { id: "workbench-targets", title: "Managed systems", subtitle: "Starts, stops, health-checks, seeds, and tests the legacy and modernized applications.", technologies: [t.docker, t.openemr, t.postgres] }
          ],
          edges: [
            { from: "Workbench UI", to: "Local API", label: "requests controlled actions and evidence" },
            { from: "Local API", to: "Managed systems", label: "runs allowlisted commands" },
            { from: "Managed systems", to: "Evidence artifacts", label: "write structured results" },
            { from: "Evidence artifacts", to: "Workbench UI", label: "render current project state" }
          ]
        },
        narratives: [
          {
            title: "Local-first control",
            body: "The Workbench is intentionally local and constrained. It can orchestrate important actions, but each action maps back to a real command, script, manifest entry, or artifact."
          },
          {
            title: "Project memory made visible",
            body: "The Workbench turns maintained project documents, changelog entries, seed contracts, lifecycle events, and test results into an operator-facing view of the modernization effort."
          }
        ],
        responsibilities: [
          "Show runtime status and lifecycle controls for managed applications.",
          "Run smoke, seed, native, parity, and custom parity commands.",
          "Display evidence from artifacts instead of inventing private state.",
          "Explain architectural differences and project decisions."
        ],
        evidence: [
          "Production build validates the React/Vite UI.",
          "The API exposes apps, architecture, progress, seed datasets, parity manifests, events, and changelog data.",
          "Command execution is constrained to manifests and local-only orchestration routes."
        ]
      },
      {
        ...modernized,
        purpose: "New implementation built slice by slice against the legacy behavior contract.",
        architecturePattern: "React SPA, public ASP.NET Core API, server-side business tier, PostgreSQL read/write model, and parity-first vertical slices.",
        runtime: "React 19.2.7, TypeScript 6.0.3, Vite 8.0.16, Node.js 24.17.0 frontend container, ASP.NET Core 10.0.9, PostgreSQL 17.10.",
        dataOwnership: "Owns the modernized PostgreSQL schema and maps shared synthetic data into target tables.",
        technologies: [t.reactModernized, t.typescriptModernized, t.viteModernized, t.nodeModernized, t.aspnet, t.dotnet, t.npgsql, t.postgres, t.docker, t.playwright],
        diagram: {
          title: "Modernized Target",
          subtitle: "A cleaner layered system preserves behavior while replacing the legacy internals.",
          nodes: [
            { id: "modern-ui", title: "Modern SPA", subtitle: "React modules for patient, calendar, encounters, lists, messages, fees, procedures, reports, documents, and admin workflows.", technologies: [t.reactModernized, t.typescriptModernized, t.viteModernized] },
            { id: "modern-api", title: "Public backend API", subtitle: "ASP.NET Core endpoints expose workflow-oriented contracts for implemented slices.", technologies: [t.aspnet, t.dotnet] },
            { id: "modern-services", title: "Service/business tier", subtitle: "Modernized behavior lives server-side instead of being hidden in UI scripts or database coupling.", technologies: [t.dotnet, t.npgsql] },
            { id: "modern-db", title: "Modern data store", subtitle: "PostgreSQL schema seeded from the shared synthetic contract.", technologies: [t.postgres, t.seed] },
            { id: "modern-evidence", title: "Parity evidence", subtitle: "Smoke and side-by-side parity plans verify each completed vertical slice.", technologies: [t.playwright, t.json] }
          ],
          edges: [
            { from: "Modern SPA", to: "Public backend API", label: "calls workflow APIs" },
            { from: "Public backend API", to: "Service/business tier", label: "coordinates behavior and validation" },
            { from: "Service/business tier", to: "Modern data store", label: "persists mapped domain state" },
            { from: "Parity evidence", to: "Modern SPA", label: "checks browser-visible outcomes" },
            { from: "Parity evidence", to: "Public backend API", label: "checks normalized API and workflow behavior" }
          ]
        },
        narratives: [
          {
            title: "Behavior parity with redesigned internals",
            body: "The target system does not copy the legacy implementation shape. It preserves observable outcomes through slices while moving logic into clearer API and service boundaries."
          },
          {
            title: "PostgreSQL as the future contract",
            body: "The modernized schema is allowed to diverge from the legacy MariaDB layout when that creates cleaner ownership, provided the shared seed data and parity tests continue to prove equivalent behavior."
          }
        ],
        responsibilities: [
          "Implement OpenEMR workflows as small verified vertical slices.",
          "Expose public API contracts for the SPA and automated tests.",
          "Map the shared gold dataset into PostgreSQL.",
          "Produce smoke and side-by-side parity evidence for completed slices."
        ],
        evidence: [
          "Modernized smoke test covers implemented read-only and mutation workflows.",
          "Side-by-side parity plans exist through Slice 49 account balance readiness.",
          "The Workbench can start, stop, seed, health-check, smoke-test, and run parity actions for the target."
        ]
      }
    ],
    layers: [
      {
        id: "ui",
        label: "UI technology",
        summary: "How each system presents workflow screens to a user.",
        cells: [
          { systemId: "legacy-openemr", detail: "Server-rendered OpenEMR screens with legacy interface dependencies.", technologies: [t.openemr, t.bootstrap, t.angular] },
          { systemId: "modernization-workbench", detail: "React operator UI for project status, orchestration, and evidence.", technologies: [t.reactWorkbench, t.typescriptWorkbench, t.viteWorkbench] },
          { systemId: "modernized-openemr", detail: "Modern React SPA for the replacement OpenEMR workflows.", technologies: [t.reactModernized, t.typescriptModernized, t.viteModernized] }
        ]
      },
      {
        id: "server",
        label: "Server-side technology",
        summary: "Where requests are handled and workflow behavior is coordinated.",
        cells: [
          { systemId: "legacy-openemr", detail: "Legacy PHP application served by Apache in the pinned OpenEMR image.", technologies: [t.php, t.apache, t.openemr] },
          { systemId: "modernization-workbench", detail: "Local Express API exposes only allowlisted orchestration and artifact routes.", technologies: [t.nodeWorkbench, t.express, t.typescriptWorkbench] },
          { systemId: "modernized-openemr", detail: "ASP.NET Core API owns server-side behavior for implemented slices.", technologies: [t.aspnet, t.dotnet, t.npgsql] }
        ]
      },
      {
        id: "data",
        label: "Data stores",
        summary: "Where durable state lives for each system.",
        cells: [
          { systemId: "legacy-openemr", detail: "Original OpenEMR MariaDB schema seeded with the synthetic gold dataset.", technologies: [t.mariadb, t.seed] },
          { systemId: "modernization-workbench", detail: "Local JSON artifacts, config files, manifest metadata, and parsed documents.", technologies: [t.json, t.seed] },
          { systemId: "modernized-openemr", detail: "PostgreSQL schema mapped from the shared synthetic seed contract.", technologies: [t.postgres, t.seed] }
        ]
      },
      {
        id: "runtime",
        label: "Runtime and orchestration",
        summary: "How each application is started and managed locally.",
        cells: [
          { systemId: "legacy-openemr", detail: "Docker Compose runs the OpenEMR and MariaDB containers.", technologies: [t.docker, t.openemr, t.mariadb] },
          { systemId: "modernization-workbench", detail: "Local Node/Vite development process plus controlled Docker Compose commands for managed systems.", technologies: [t.nodeWorkbench, t.viteWorkbench, t.docker] },
          { systemId: "modernized-openemr", detail: "Docker Compose runs the frontend, API, and PostgreSQL services.", technologies: [t.docker, t.nodeModernized, t.dotnet, t.postgres] }
        ]
      },
      {
        id: "evidence",
        label: "Tests and evidence",
        summary: "How each system proves its current behavior.",
        cells: [
          { systemId: "legacy-openemr", detail: "Native, smoke, UI, workflow, and parity tests define the reference behavior.", technologies: [t.phpunit, t.jest, t.playwright] },
          { systemId: "modernization-workbench", detail: "Build verification plus rendered artifacts from managed app runs.", technologies: [t.reactWorkbench, t.express, t.json] },
          { systemId: "modernized-openemr", detail: "Smoke tests and side-by-side parity plans prove each completed modernization slice.", technologies: [t.playwright, t.aspnet, t.postgres] }
        ]
      }
    ],
    topology: {
      title: "Modernization System Map",
      subtitle: "The Workbench coordinates the baseline and the target while shared seed data and parity tests keep the two systems comparable.",
      nodes: [
        { id: "workbench", title: "Modernization Workbench", subtitle: "Control surface and evidence viewer.", technologies: [t.reactWorkbench, t.express, t.nodeWorkbench] },
        { id: "legacy", title: "Legacy OpenEMR", subtitle: "Pinned behavior reference.", technologies: [t.openemr, t.php, t.mariadb] },
        { id: "modernized", title: "Modernized OpenEMR", subtitle: "Slice-built replacement system.", technologies: [t.reactModernized, t.aspnet, t.postgres] },
        { id: "seed", title: "Shared seed contract", subtitle: "Synthetic gold data applied to both systems.", technologies: [t.seed, t.json] },
        { id: "tests", title: "Parity evidence", subtitle: "Smoke, native, UI, workflow, and side-by-side plans.", technologies: [t.playwright, t.phpunit, t.jest] },
        { id: "artifacts", title: "Result artifacts", subtitle: "JSON summaries, logs, screenshots, and reports.", technologies: [t.json] }
      ],
      edges: [
        { from: "Modernization Workbench", to: "Legacy OpenEMR", label: "starts, stops, seeds, health-checks, and tests" },
        { from: "Modernization Workbench", to: "Modernized OpenEMR", label: "starts, stops, seeds, health-checks, and tests" },
        { from: "Shared seed contract", to: "Legacy OpenEMR", label: "loads MariaDB gold data" },
        { from: "Shared seed contract", to: "Modernized OpenEMR", label: "loads PostgreSQL gold data" },
        { from: "Parity evidence", to: "Legacy OpenEMR", label: "captures expected behavior" },
        { from: "Parity evidence", to: "Modernized OpenEMR", label: "checks preserved behavior" },
        { from: "Result artifacts", to: "Modernization Workbench", label: "feeds visible evidence" }
      ]
    },
    decisions: [
      {
        title: "Keep the baseline alive",
        detail: "The legacy OpenEMR environment stays runnable because it is the behavioral reference for parity, not a temporary scaffold."
      },
      {
        title: "Modernize by slices",
        detail: "The target grows through vertical workflow slices so each API, UI, data mapping, and parity path can be verified before the next slice expands the surface area."
      },
      {
        title: "Use PostgreSQL for the target",
        detail: "The modernized implementation can redesign persistence around PostgreSQL while parity tests protect observable workflow behavior."
      },
      {
        title: "Treat evidence as architecture",
        detail: "Smoke tests, native tests, seed validation, Playwright flows, and side-by-side parity plans are part of the system design because they define what modernization success means."
      }
    ]
  };
}
