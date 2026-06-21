import {
  Activity,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Database,
  ExternalLink,
  FileText,
  GitBranch,
  History,
  KeyRound,
  Layers,
  Play,
  Power,
  RefreshCw,
  RotateCw,
  Server,
  Settings,
  Sprout,
  Square,
  Terminal,
  TestTube2,
  XCircle
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { api } from "./api";
import type {
  AppSnapshot,
  ArchitectureModel,
  ArchitectureSystem,
  ArchitectureTechnology,
  CustomParityRunRequest,
  FunctionalityProgressArea,
  LifecycleEvent,
  NativeJestRunResult,
  NativeRunResult,
  ParityComparisonReport,
  ParityManifest,
  ParityResetMode,
  ParityRunResult,
  ProgressSlice,
  ProjectChangelog,
  RuntimeState,
  SeedDataset,
  SmokeResult
} from "./types";

type BusyState = {
  appId: string;
  label: string;
} | null;

const pageIds = ["dashboard", "applications", "timeline", "progress", "architecture", "tests", "seed-data"] as const;
type PageId = (typeof pageIds)[number];

type NavItem = {
  id: PageId;
  label: string;
  icon: ComponentType<{ size?: number }>;
  children?: NavItem[];
};

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: Activity },
  { id: "applications", label: "Applications", icon: Server },
  { id: "timeline", label: "Project Timeline", icon: History },
  { id: "progress", label: "Progress", icon: ClipboardList },
  { id: "architecture", label: "Architecture", icon: Layers },
  { id: "tests", label: "Test Runs", icon: TestTube2 },
  { id: "seed-data", label: "Seed Data", icon: Database }
];

const pageTitles: Record<PageId, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Operational status for the OpenEMR modernization environment."
  },
  applications: {
    title: "Applications",
    subtitle: "Managed local applications, lifecycle actions, logs, and database profile."
  },
  timeline: {
    title: "Project Timeline",
    subtitle: "The maintained build history for the modernization effort."
  },
  progress: {
    title: "Progress",
    subtitle: "Modernization slices and current delivery state."
  },
  architecture: {
    title: "Architecture",
    subtitle: "Technical comparison between the baseline, Workbench, and modernized target."
  },
  tests: {
    title: "Test Runs",
    subtitle: "Executable checks and latest evidence from the baseline."
  },
  "seed-data": {
    title: "Seed Data",
    subtitle: "Shared synthetic data contract, seed actions, and verified counts."
  }
};

function parseHashPage(): PageId {
  const rawPage = window.location.hash.replace(/^#\/?/, "").split("/")[0];
  return pageIds.includes(rawPage as PageId) ? (rawPage as PageId) : "dashboard";
}

function formatDate(value?: string) {
  if (!value) {
    return "Never";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function formatDateOnly(value?: string) {
  if (!value) {
    return "Undated";
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function formatClockTime(value?: string) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short"
  }).format(new Date(value));
}

function formatDuration(ms?: number) {
  if (ms === undefined || Number.isNaN(ms)) {
    return "-";
  }
  if (ms < 1000) {
    return `${ms} ms`;
  }
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatElapsedDuration(ms?: number) {
  if (ms === undefined || Number.isNaN(ms)) {
    return "-";
  }

  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (days) {
    parts.push(`${days}d`);
  }
  if (hours) {
    parts.push(`${hours}h`);
  }
  if (minutes && parts.length < 2) {
    parts.push(`${minutes}m`);
  }
  if (!parts.length || (!days && !hours && parts.length < 2)) {
    parts.push(`${seconds}s`);
  }

  return parts.slice(0, 2).join(" ");
}

function formatCount(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatSignedCount(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatCount(value)}`;
}

function StatusPill({ state, label }: { state: RuntimeState | string; label: string }) {
  return <span className={`status-pill status-${state}`}>{label}</span>;
}

function IconButton({
  title,
  children,
  onClick,
  disabled,
  variant = "default"
}: {
  title: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger";
}) {
  return (
    <button className={`icon-button ${variant}`} title={title} aria-label={title} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {detail ? <div className="metric-detail">{detail}</div> : null}
    </div>
  );
}

function Sidebar({ activePage, onNavigate }: { activePage: PageId; onNavigate: (page: PageId) => void }) {
  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const childIsActive = item.children?.some((child) => child.id === activePage) ?? false;
    const isActive = item.id === activePage || childIsActive;

    return (
      <div className="nav-group" key={item.id}>
        <button className={`nav-item${isActive ? " active" : ""}`} type="button" onClick={() => onNavigate(item.id)} aria-current={item.id === activePage ? "page" : undefined}>
          <Icon size={18} />
          <span>{item.label}</span>
        </button>
        {item.children?.length ? (
          <div className="nav-children">
            {item.children.map((child) => {
              const ChildIcon = child.icon;
              return (
                <button
                  className={`nav-item nav-child${child.id === activePage ? " active" : ""}`}
                  type="button"
                  key={child.id}
                  onClick={() => onNavigate(child.id)}
                  aria-current={child.id === activePage ? "page" : undefined}
                >
                  <ChildIcon size={15} />
                  <span>{child.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <aside className="workbench-sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">OM</div>
        <div>
          <strong>OpenEMR</strong>
          <span>Modernization</span>
        </div>
      </div>
      <nav className="sidebar-nav" aria-label="Workbench sections">
        {navItems.map(renderNavItem)}
      </nav>
      <div className="sidebar-footer">
        <Settings size={16} />
        <span>Local Workbench</span>
      </div>
    </aside>
  );
}

function AppHeader({
  onRefresh,
  busy,
  refreshedAt,
  title,
  subtitle
}: {
  onRefresh: () => void;
  busy: BusyState;
  refreshedAt?: string;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="app-header">
      <div>
        <div className="eyebrow">OpenEMR Modernization</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="header-actions">
        {busy ? <span className="busy-chip">{busy.label}</span> : <span className="quiet-chip">Idle</span>}
        <span className="last-refresh">Updated {formatDate(refreshedAt)}</span>
        <IconButton title="Refresh current page" onClick={onRefresh} disabled={!!busy}>
          <RefreshCw size={18} />
        </IconButton>
      </div>
    </header>
  );
}

function OverviewGrid({ legacyApp, modernizedApp, progress, changelog }: { legacyApp?: AppSnapshot; modernizedApp?: AppSnapshot; progress: ProgressSlice[]; changelog: ProjectChangelog | null }) {
  const patientCount = legacyApp?.dataProfile.rows.find((row) => row.tableName === "patient_data")?.rowCount ?? 0;
  const verifiedProgress = progress.filter((slice) => slice.status === "verified").length;

  return (
    <section className="overview-grid">
      <div className="overview-item">
        <Activity size={21} />
        <div>
          <strong>Legacy baseline</strong>
          <span>{legacyApp?.runtime.label ?? "Loading"}</span>
        </div>
      </div>
      <div className="overview-item">
        <GitBranch size={21} />
        <div>
          <strong>Modern target</strong>
          <span>{modernizedApp?.runtime.label ?? "Slice 55 document replacement revision readiness"}</span>
        </div>
      </div>
      <div className="overview-item">
        <Database size={21} />
        <div>
          <strong>Seed data</strong>
          <span>{patientCount ? `${patientCount} patients` : "Not ready"}</span>
        </div>
      </div>
      <div className="overview-item">
        <ClipboardList size={21} />
        <div>
          <strong>Verified slices</strong>
          <span>
            {verifiedProgress} of {progress.length || 0}
          </span>
        </div>
      </div>
      <div className="overview-item">
        <History size={21} />
        <div>
          <strong>Timeline steps</strong>
          <span>{changelog?.totalEntries ?? 0}</span>
        </div>
      </div>
      <div className="overview-item">
        <TestTube2 size={21} />
        <div>
          <strong>Latest smoke</strong>
          <span>{legacyApp?.latestTest?.passed ? "Passed" : "Pending"}</span>
        </div>
      </div>
    </section>
  );
}

function LegacyAppPanel({
  app,
  busy,
  onAction,
  onRunTest,
  onRunSeed,
  onLoadLogs,
  seedDatasets,
  logs
}: {
  app: AppSnapshot;
  busy: BusyState;
  onAction: (action: "start" | "stop" | "restart") => void;
  onRunTest: (testId: string) => void;
  onRunSeed: (seedId: string) => void;
  onLoadLogs: () => void;
  seedDatasets: SeedDataset[];
  logs: string;
}) {
  const busyForApp = busy?.appId === app.id;
  const patientCount = app.dataProfile.rows.find((row) => row.tableName === "patient_data" || row.tableName === "patients")?.rowCount ?? 0;
  const encounterCount = app.dataProfile.rows.find((row) => row.tableName === "form_encounter" || row.tableName === "encounters")?.rowCount ?? 0;
  const appointmentCount = app.dataProfile.rows.find((row) => row.tableName === "openemr_postcalendar_events" || row.tableName === "appointments")?.rowCount ?? 0;
  const managedSeed = app.seeds.find((seed) => seed.id === "gold-test-dataset-v1") ?? app.seeds[0];
  const seedDataset = seedDatasets.find((dataset) => dataset.id === managedSeed?.datasetId);
  const patientTarget = seedDataset?.recordTargets.find((target) => target.name === "patients")?.target ?? seedDataset?.targetPatientCount;
  const latestSeedDetail = app.latestSeed
    ? `${app.latestSeed.mode ?? "seeded"} ${app.latestSeed.expectedPatients} gold patients`
    : seedDataset?.currentSeedLevel ?? "Synthetic seed data pending";

  return (
    <section className="panel primary-panel">
      <div className="panel-header">
        <div>
          <div className="section-kicker">Managed application</div>
          <h2>{app.name}</h2>
          <p>{app.description}</p>
        </div>
        <div className="panel-status">
          <StatusPill state={app.runtime.state} label={app.runtime.label} />
          <a className="open-link" href={app.publicUrl} target="_blank" rel="noreferrer">
            Open <ExternalLink size={14} />
          </a>
        </div>
      </div>

      <div className="control-strip" aria-label={`${app.name} controls`}>
        <IconButton title={`Start ${app.name}`} variant="primary" onClick={() => onAction("start")} disabled={busyForApp}>
          <Power size={18} />
        </IconButton>
        <IconButton title={`Stop ${app.name}`} variant="danger" onClick={() => onAction("stop")} disabled={busyForApp}>
          <Square size={18} />
        </IconButton>
        <IconButton title={`Restart ${app.name}`} onClick={() => onAction("restart")} disabled={busyForApp}>
          <RotateCw size={18} />
        </IconButton>
        <IconButton title="Run baseline smoke test" onClick={() => onRunTest(app.tests[0]?.id ?? "smoke")} disabled={busyForApp || app.tests.length === 0}>
          <Play size={18} />
        </IconButton>
        <IconButton title={managedSeed ? `Seed ${managedSeed.name}` : "Seed data unavailable"} onClick={() => onRunSeed(managedSeed?.id ?? "")} disabled={busyForApp || !managedSeed}>
          <Sprout size={18} />
        </IconButton>
        <IconButton title="Load recent logs" onClick={onLoadLogs} disabled={busyForApp}>
          <Terminal size={18} />
        </IconButton>
      </div>

      <div className={`credential-strip${app.demoLogin.available ? "" : " warning"}`}>
        <div className="credential-heading">
          <KeyRound size={17} />
          <strong>Local demo login</strong>
          <span>{app.demoLogin.source}</span>
        </div>
        {app.demoLogin.available ? (
          <div className="credential-values">
            <span>
              Username <code>{app.demoLogin.username}</code>
            </span>
            <span>
              Password <code>{app.demoLogin.password}</code>
            </span>
          </div>
        ) : (
          <span className="credential-error">{app.demoLogin.error ?? "Credential unavailable."}</span>
        )}
      </div>

      {seedDataset ? (
        <div className="seed-contract-strip">
          <div>
            <div className="section-kicker">Shared seed dataset</div>
            <strong>{seedDataset.name}</strong>
            <p>{seedDataset.currentSeedLevel}</p>
          </div>
          <div className="seed-contract-metrics">
            <span>
              Version <code>{seedDataset.version}</code>
            </span>
            <span>
              Target patients <code>{patientTarget}</code>
            </span>
            <span>
              Systems <code>{seedDataset.targetSystems.length}</code>
            </span>
          </div>
        </div>
      ) : null}

      <div className="metric-grid">
        <Metric label="Health endpoint" value={app.health.ok ? "OK" : "Issue"} detail={`HTTP ${app.health.statusCode ?? "-"} in ${formatDuration(app.health.durationMs)}`} />
        <Metric label="Source tag" value={app.source.tag} detail={app.source.matchesExpectedTag ? "Pinned tag verified" : "Check source tag"} />
        <Metric label="Patients" value={patientCount} detail={latestSeedDetail} />
        <Metric label="Encounters" value={encounterCount} detail={`${appointmentCount} appointments`} />
      </div>

      <div className="two-column">
        <ServicesPanel app={app} />
        <LatestSmokePanel app={app} />
      </div>

      <DataProfilePanel app={app} />

      <div className="subsection">
        <h3>
          <Terminal size={17} />
          Recent Logs
        </h3>
        <pre className="log-view">{logs || "Use the log button to load recent Docker Compose logs."}</pre>
      </div>
    </section>
  );
}

function ServicesPanel({ app }: { app: AppSnapshot }) {
  return (
    <div className="subsection">
      <h3>
        <Server size={17} />
        Services
      </h3>
      <div className="service-table">
        <div className="table-row table-head">
          <span>Service</span>
          <span>State</span>
          <span>Health</span>
        </div>
        {app.containers.length ? (
          app.containers.map((container) => (
            <div className="table-row" key={container.name}>
              <span>{container.service}</span>
              <span>{container.state}</span>
              <span>{container.health || "n/a"}</span>
            </div>
          ))
        ) : (
          <EmptyState text="No containers reported by Docker Compose." />
        )}
      </div>
    </div>
  );
}

function LatestSmokePanel({ app }: { app: AppSnapshot }) {
  return (
    <div className="subsection">
      <h3>
        <TestTube2 size={17} />
        Latest Smoke Test
      </h3>
      {app.latestTest ? (
        <div className="test-result">
          <div className="test-result-header">
            {app.latestTest.passed ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
            <strong>{app.latestTest.passed ? "Passed" : "Failed"}</strong>
            <span>{formatDate(app.latestTest.finishedAt)}</span>
          </div>
          <ul>
            {app.latestTest.checks.map((check) => (
              <li key={check.name}>
                {check.passed ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}
                <span>{check.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState text="No smoke-test result has been recorded yet." />
      )}
    </div>
  );
}

function DataProfilePanel({ app }: { app: AppSnapshot }) {
  return (
    <div className="subsection">
      <h3>
        <Database size={17} />
        Data Profile
      </h3>
      {app.dataProfile.available ? (
        <div className="data-profile">
          {app.dataProfile.rows.map((row) => (
            <Metric key={row.tableName} label={row.tableName} value={row.rowCount} />
          ))}
        </div>
      ) : (
        <EmptyState text={app.dataProfile.error ?? "Data profile unavailable."} />
      )}
    </div>
  );
}

function ProgressPanel({ slices }: { slices: ProgressSlice[] }) {
  return (
    <section className="panel">
      <div className="panel-header compact">
        <h2>
          <ClipboardList size={20} />
          Modernization Progress
        </h2>
      </div>
      <div className="progress-list">
        {slices.map((slice) => (
          <div className="progress-item" key={slice.id}>
            <div>
              <strong>{slice.name}</strong>
              <p>{slice.detail}</p>
            </div>
            <StatusPill state={slice.status} label={slice.status.replaceAll("-", " ")} />
          </div>
        ))}
      </div>
    </section>
  );
}

function FunctionalityProgressPanel({
  areas,
  version,
  lastUpdated
}: {
  areas: FunctionalityProgressArea[];
  version?: string;
  lastUpdated?: string;
}) {
  const completedCount = areas.reduce((total, area) => total + area.completed.length, 0);
  const outstandingCount = areas.reduce((total, area) => total + area.outstanding.length, 0);
  const deferredCount = areas.reduce((total, area) => total + area.deferred.length, 0);

  return (
    <section className="panel functionality-progress-panel">
      <div className="panel-header">
        <div>
          <h2>
            <ClipboardList size={20} />
            Functionality Progress
          </h2>
          <p>Curated modernization scope by domain area, showing covered functionality and remaining work.</p>
        </div>
        <div className="panel-status">
          {version ? <span className="quiet-chip">v{version}</span> : null}
          {lastUpdated ? <span className="quiet-chip">Updated {lastUpdated}</span> : null}
        </div>
      </div>

      <div className="progress-summary-grid">
        <Metric label="Areas Tracked" value={areas.length} />
        <Metric label="Completed Pieces" value={completedCount} />
        <Metric label="Outstanding Pieces" value={outstandingCount} />
        <Metric label="Deferred Pieces" value={deferredCount} />
      </div>

      {areas.length ? (
        <div className="functionality-grid">
          {areas.map((area) => (
            <div className="functionality-card" key={area.id}>
              <div className="functionality-card-header">
                <div>
                  <strong>{area.name}</strong>
                  <p>{area.summary}</p>
                </div>
                <StatusPill state={area.status} label={area.status.replaceAll("-", " ")} />
              </div>

              <FunctionalityCompletedList items={area.completed} />
              <FunctionalityTextList title="Outstanding" items={area.outstanding} tone="outstanding" />
              <FunctionalityTextList title="Deferred / Watch List" items={area.deferred} tone="deferred" />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text="Functionality progress is not configured." />
      )}
    </section>
  );
}

function FunctionalityCompletedList({ items }: { items: FunctionalityProgressArea["completed"] }) {
  return (
    <div className="functionality-section">
      <h3>
        <CheckCircle2 size={16} />
        Complete
      </h3>
      <ul className="functionality-item-list">
        {items.map((item) => (
          <li className="functionality-item" key={item.label}>
            <strong>{item.label}</strong>
            <p>{item.detail}</p>
            {item.evidence.length ? (
              <div className="evidence-chip-list">
                {item.evidence.map((evidence) => (
                  <code key={evidence}>{evidence}</code>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FunctionalityTextList({ title, items, tone }: { title: string; items: string[]; tone: "outstanding" | "deferred" }) {
  return (
    <div className={`functionality-section functionality-section-${tone}`}>
      <h3>
        {tone === "outstanding" ? <CircleAlert size={16} /> : <FileText size={16} />}
        {title}
      </h3>
      <ul className="functionality-item-list">
        {items.map((item) => (
          <li className="functionality-item compact" key={item}>
            <p>{item}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProgressPage({
  slices,
  functionalityAreas,
  functionalityVersion,
  functionalityLastUpdated
}: {
  slices: ProgressSlice[];
  functionalityAreas: FunctionalityProgressArea[];
  functionalityVersion?: string;
  functionalityLastUpdated?: string;
}) {
  return (
    <div className="page-stack">
      <ProgressPanel slices={slices} />
      <FunctionalityProgressPanel areas={functionalityAreas} version={functionalityVersion} lastUpdated={functionalityLastUpdated} />
    </div>
  );
}

function TechChip({ tech }: { tech: ArchitectureTechnology }) {
  return (
    <span className="tech-chip" style={{ "--tech-color": tech.color } as CSSProperties} title={`${tech.name} ${tech.version}: ${tech.detail}`}>
      <span className="tech-logo">
        {tech.logoUrl ? (
          <img
            src={tech.logoUrl}
            alt={`${tech.name} logo`}
            onError={(event) => {
              event.currentTarget.style.display = "none";
              event.currentTarget.parentElement?.classList.add("fallback-visible");
            }}
          />
        ) : null}
        <span className="tech-logo-fallback">{tech.logoText}</span>
      </span>
      <span className="tech-chip-text">
        <strong>{tech.name}</strong>
        <span>{tech.version}</span>
      </span>
    </span>
  );
}

function TechChipList({ technologies }: { technologies: ArchitectureTechnology[] }) {
  return (
    <div className="tech-chip-list">
      {technologies.map((tech) => (
        <TechChip tech={tech} key={tech.id} />
      ))}
    </div>
  );
}

function ArchitectureDiagramView({ diagram }: { diagram: ArchitectureModel["topology"] }) {
  return (
    <div className="architecture-diagram">
      <div className="architecture-diagram-heading">
        <h3>{diagram.title}</h3>
        <p>{diagram.subtitle}</p>
      </div>
      <div className="diagram-node-grid">
        {diagram.nodes.map((node) => (
          <div className="diagram-node" key={node.id}>
            <div>
              <strong>{node.title}</strong>
              <p>{node.subtitle}</p>
            </div>
            <TechChipList technologies={node.technologies} />
          </div>
        ))}
      </div>
      <div className="diagram-edge-list">
        {diagram.edges.map((edge) => (
          <div className="diagram-edge" key={`${edge.from}-${edge.to}-${edge.label}`}>
            <strong>{edge.from}</strong>
            <span>{edge.label}</span>
            <strong>{edge.to}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArchitectureMatrix({ architecture }: { architecture: ArchitectureModel }) {
  return (
    <div className="architecture-matrix" style={{ "--architecture-system-count": architecture.systems.length } as CSSProperties}>
      <div className="architecture-matrix-heading architecture-layer-heading">Layer</div>
      {architecture.systems.map((system) => (
        <div className="architecture-matrix-heading" key={system.id}>
          <strong>{system.name}</strong>
          <span>{system.status}</span>
        </div>
      ))}
      {architecture.layers.map((layer) => (
        <Fragment key={layer.id}>
          <div className="architecture-layer-cell">
            <strong>{layer.label}</strong>
            <p>{layer.summary}</p>
          </div>
          {architecture.systems.map((system) => {
            const cell = layer.cells.find((candidate) => candidate.systemId === system.id);
            return (
              <div className="architecture-stack-cell" key={`${layer.id}-${system.id}`}>
                {cell ? (
                  <>
                    <TechChipList technologies={cell.technologies} />
                    <p>{cell.detail}</p>
                  </>
                ) : (
                  <EmptyState text="Architecture metadata unavailable." />
                )}
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

function ArchitectureOverview({ architecture }: { architecture: ArchitectureModel }) {
  return (
    <>
      <section className="panel architecture-panel">
        <div className="panel-header">
          <div>
            <div className="section-kicker">Technology comparison</div>
            <h2>
              <Layers size={20} />
              Stack Matrix
            </h2>
            <p>Versioned technology stacks for the legacy reference, the Workbench, and the modernized target.</p>
          </div>
        </div>
        <ArchitectureMatrix architecture={architecture} />
      </section>

      <section className="panel architecture-panel">
        <div className="panel-header">
          <div>
            <div className="section-kicker">System topology</div>
            <h2>
              <Server size={20} />
              Project Map
            </h2>
            <p>How orchestration, seed data, parity checks, and evidence artifacts connect the three project systems.</p>
          </div>
        </div>
        <ArchitectureDiagramView diagram={architecture.topology} />
      </section>

      <section className="panel architecture-panel">
        <div className="panel-header compact">
          <h2>
            <GitBranch size={20} />
            Architecture Decisions
          </h2>
        </div>
        <div className="decision-grid">
          {architecture.decisions.map((decision) => (
            <div className="decision-item" key={decision.title}>
              <strong>{decision.title}</strong>
              <p>{decision.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function ArchitectureSystemDetail({ system }: { system: ArchitectureSystem }) {
  return (
    <>
      <section className="panel architecture-panel">
        <div className="panel-header">
          <div>
            <div className="section-kicker">{system.status}</div>
            <h2>
              <Server size={20} />
              {system.name}
            </h2>
            <p>{system.purpose}</p>
          </div>
          <div className="panel-status">
            <StatusPill state={system.status.toLowerCase().includes("verified") || system.status.toLowerCase().includes("implemented") ? "verified" : "in-progress"} label={system.status} />
          </div>
        </div>
        <div className="architecture-detail-layout">
          <div className="technology-inventory">
            <div className="section-kicker">Technology inventory</div>
            <TechChipList technologies={system.technologies} />
          </div>
          <dl className="architecture-facts">
            <dt>Pattern</dt>
            <dd>{system.architecturePattern}</dd>
            <dt>Runtime</dt>
            <dd>{system.runtime}</dd>
            <dt>Data ownership</dt>
            <dd>{system.dataOwnership}</dd>
            <dt>Business logic</dt>
            <dd>{system.businessLogic}</dd>
          </dl>
        </div>
      </section>

      <section className="panel architecture-panel">
        <div className="panel-header compact">
          <h2>
            <Layers size={20} />
            System Diagram
          </h2>
        </div>
        <ArchitectureDiagramView diagram={system.diagram} />
      </section>

      <section className="panel architecture-panel">
        <div className="architecture-story-grid">
          {system.narratives.map((narrative) => (
            <div className="architecture-story" key={narrative.title}>
              <strong>{narrative.title}</strong>
              <p>{narrative.body}</p>
            </div>
          ))}
        </div>
        <div className="architecture-lists-grid">
          <div>
            <h3>Responsibilities</h3>
            <ul className="architecture-list">
              {system.responsibilities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Evidence</h3>
            <ul className="architecture-list">
              {system.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

function ArchitecturePanel({ architecture }: { architecture: ArchitectureModel | null }) {
  const [activeTab, setActiveTab] = useState("overview");

  if (!architecture) {
    return (
      <section className="panel architecture-panel">
        <EmptyState text="Architecture metadata is loading." />
      </section>
    );
  }

  const tabs = [{ id: "overview", label: "Overview" }, ...architecture.systems.map((system) => ({ id: system.id, label: system.name }))];
  const activeSystem = architecture.systems.find((system) => system.id === activeTab);

  return (
    <div className="page-stack architecture-page">
      <section className="panel architecture-hero">
        <div className="panel-header">
          <div>
            <div className="section-kicker">Architecture map</div>
            <h2>
              <Layers size={20} />
              Technical Architecture
            </h2>
            <p>Three systems, one shared modernization contract: preserve legacy behavior, expose the work, and grow the target through verified vertical slices.</p>
          </div>
        </div>
        <div className="architecture-tabs" role="tablist" aria-label="Architecture views">
          {tabs.map((tab) => (
            <button className={activeTab === tab.id ? "active" : ""} type="button" role="tab" aria-selected={activeTab === tab.id} key={tab.id} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
      </section>
      <div role="tabpanel">{activeTab === "overview" ? <ArchitectureOverview architecture={architecture} /> : activeSystem ? <ArchitectureSystemDetail system={activeSystem} /> : <ArchitectureOverview architecture={architecture} />}</div>
    </div>
  );
}

function EventsPanel({ events }: { events: LifecycleEvent[] }) {
  return (
    <section className="panel">
      <div className="panel-header compact">
        <h2>
          <History size={20} />
          Action History
        </h2>
      </div>
      {events.length ? (
        <div className="events-list">
          {events.slice(0, 8).map((event) => (
            <div className="event-item" key={event.id}>
              <div className="event-main">
                {event.status === "succeeded" ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}
                <div>
                  <strong>{event.summary}</strong>
                  <p>
                    {event.type} on {event.appId}
                  </p>
                </div>
              </div>
              <span>{formatDate(event.finishedAt)}</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text="No lifecycle or test actions have been run from the Workbench yet." />
      )}
    </section>
  );
}

function ChangelogPanel({ changelog }: { changelog: ProjectChangelog | null }) {
  const entries = changelog ? [...changelog.entries].reverse() : [];
  const latestEntry = entries[0];

  return (
    <section className="panel changelog-panel">
      <div className="panel-header">
        <div>
          <div className="section-kicker">Project history</div>
          <h2>
            <FileText size={20} />
            Project Build Timeline
          </h2>
          <p>The maintained record of modernization steps, verification milestones, and implementation evidence.</p>
        </div>
        {changelog ? <StatusPill state="verified" label={`${changelog.totalEntries} steps`} /> : <StatusPill state="partial" label="Loading" />}
      </div>

      {changelog ? (
        <>
          <div className="changelog-stats">
            <div>
              <span>Total steps</span>
              <strong>{changelog.totalEntries}</strong>
            </div>
            <div>
              <span>Latest step</span>
              <strong>{latestEntry ? `${latestEntry.id}. ${latestEntry.title}` : "None"}</strong>
            </div>
            <div>
              <span>Source</span>
              <strong>{changelog.sourcePath}</strong>
            </div>
          </div>

          <div className="changelog-timeline">
            {entries.map((entry) => {
              const hiddenOutcomeCount = Math.max(0, entry.keyOutcomes.length - 5);
              const hiddenFileCount = Math.max(0, entry.primaryFiles.length - 3);
              const visibleMetrics = entry.metrics.slice(0, 4);
              const timingMetrics: Array<{ label: string; value: string }> = [];
              if (entry.startedAt) {
                timingMetrics.push({ label: "Started", value: formatClockTime(entry.startedAt) });
              }
              if (entry.finishedAt) {
                timingMetrics.push({ label: "Finished", value: formatClockTime(entry.finishedAt) });
              } else if (entry.completedAt) {
                timingMetrics.push({ label: "Completed", value: formatClockTime(entry.completedAt) });
              }
              if (entry.durationMs !== undefined) {
                timingMetrics.push({ label: "Duration", value: formatElapsedDuration(entry.durationMs) });
              } else if (entry.elapsedSincePreviousMs !== undefined) {
                timingMetrics.push({ label: "Since prior step", value: formatElapsedDuration(entry.elapsedSincePreviousMs) });
              }
              const codeChangeMetrics = entry.codeChangeStats
                ? [
                    { label: "Files", value: formatCount(entry.codeChangeStats.filesChanged) },
                    { label: "Added", value: `+${formatCount(entry.codeChangeStats.linesAdded)}` },
                    { label: "Deleted", value: `-${formatCount(entry.codeChangeStats.linesDeleted)}` },
                    { label: "Net", value: formatSignedCount(entry.codeChangeStats.netLines) },
                    { label: "Churn", value: formatCount(entry.codeChangeStats.totalChurn) }
                  ]
                : [];
              const codeChangeSource =
                entry.codeChangeStats?.source === "documented"
                  ? "Documented"
                  : entry.codeChangeStats?.source === "git-inferred"
                    ? "Git inferred"
                    : entry.codeChangeStats?.source === "git"
                      ? "Git"
                      : "";
              const isPlaceholderCommit = ["this commit", "current slice commit"].includes(entry.commit.trim().toLowerCase());
              const commitLabel = entry.completedCommit ?? (isPlaceholderCommit ? "Unresolved changeset" : entry.commit);
              const commitTitle =
                entry.completedCommit && entry.completedCommit !== entry.commit
                  ? entry.completedCommitSource === "git-inferred"
                    ? `Resolved from "${entry.commit}" using Git commit subject "${entry.completedCommitSubject}".`
                    : `Resolved from changelog commit metadata. Git subject: "${entry.completedCommitSubject}".`
                  : isPlaceholderCommit
                    ? `The changelog says "${entry.commit}" and no safe Git commit match was found.`
                    : entry.completedCommitSubject;

              return (
                <article className="changelog-entry" key={`${entry.date}-${entry.id}`}>
                  <div className="changelog-marker">
                    <span>{entry.id}</span>
                  </div>
                  <div className="changelog-content">
                    <div className="changelog-entry-header">
                      <div>
                        <span className="changelog-date">{formatDateOnly(entry.date)}</span>
                        <h3>{entry.title}</h3>
                      </div>
                      {commitLabel ? (
                        <code className="commit-chip" title={commitTitle}>
                          {commitLabel}
                        </code>
                      ) : null}
                    </div>

                    {entry.summary ? <p>{entry.summary}</p> : null}

                    {timingMetrics.length ? (
                      <div className="changelog-timing">
                        {timingMetrics.map((metric) => (
                          <span key={`${entry.id}-${metric.label}`}>
                            {metric.label} <strong>{metric.value}</strong>
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {entry.codeChangeStats ? (
                      <div className="changelog-code-metrics" title={entry.codeChangeStats.note}>
                        {codeChangeMetrics.map((metric) => (
                          <span key={`${entry.id}-code-${metric.label}`}>
                            {metric.label} <strong>{metric.value}</strong>
                          </span>
                        ))}
                        {entry.codeChangeStats.binaryFiles ? (
                          <span>
                            Binary files <strong>{formatCount(entry.codeChangeStats.binaryFiles)}</strong>
                          </span>
                        ) : null}
                        <span>
                          Source <strong>{codeChangeSource}</strong>
                        </span>
                      </div>
                    ) : null}

                    {visibleMetrics.length ? (
                      <div className="changelog-metrics">
                        {visibleMetrics.map((metric) => (
                          <span key={`${entry.id}-${metric.label}`}>
                            {metric.label} <strong>{metric.value}</strong>
                          </span>
                        ))}
                        {entry.metrics.length > visibleMetrics.length ? <span>+{entry.metrics.length - visibleMetrics.length} more counts</span> : null}
                      </div>
                    ) : null}

                    {entry.keyOutcomes.length ? (
                      <ul className="changelog-outcomes">
                        {entry.keyOutcomes.slice(0, 5).map((outcome) => (
                          <li key={`${entry.id}-${outcome}`}>
                            <CheckCircle2 size={15} />
                            <span>{outcome}</span>
                          </li>
                        ))}
                        {hiddenOutcomeCount ? (
                          <li>
                            <CheckCircle2 size={15} />
                            <span>{hiddenOutcomeCount} more outcome{hiddenOutcomeCount === 1 ? "" : "s"} recorded</span>
                          </li>
                        ) : null}
                      </ul>
                    ) : null}

                    {entry.primaryFiles.length ? (
                      <div className="changelog-files">
                        {entry.primaryFiles.slice(0, 3).map((file) => (
                          <code key={`${entry.id}-${file}`}>{file}</code>
                        ))}
                        {hiddenFileCount ? <span>+{hiddenFileCount} more</span> : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState text="Project changelog is loading." />
      )}
    </section>
  );
}

function TestsPage({
  apps,
  busy,
  parityManifest,
  parityComparisons,
  onRunTest,
  onRunCustomParity
}: {
  apps: AppSnapshot[];
  busy: BusyState;
  parityManifest: ParityManifest | null;
  parityComparisons: ParityComparisonReport[];
  onRunTest: (appId: string, testId: string) => void;
  onRunCustomParity: (appId: string, request: CustomParityRunRequest) => void;
}) {
  return (
    <div className="page-stack">
      <ParityComparisonPanel comparisons={parityComparisons} />
      {apps.length ? (
        apps.map((app) => {
          const busyForApp = busy?.appId === app.id;
          return (
            <Fragment key={app.id}>
              <CustomParityRunPanel app={app} busy={busy} parityManifest={parityManifest} onRunCustomParity={(request) => onRunCustomParity(app.id, request)} />
              <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="section-kicker">Executable evidence</div>
                  <h2>
                    <TestTube2 size={20} />
                    {app.name}
                  </h2>
                  <p>{app.description}</p>
                </div>
              </div>
              <div className="test-run-grid">
                {app.tests.map((test) => {
                  const latest = app.latestTests[test.id] ?? null;
                  return (
                    <div className="test-run-card" key={test.id}>
                      <div className="test-card-main">
                        <div>
                          <div className="architecture-title">
                            <strong>{test.name}</strong>
                            <span className="layer-pill">{test.layer}</span>
                          </div>
                          <p>{test.description}</p>
                        </div>
                        <IconButton title={`Run ${test.name}`} onClick={() => onRunTest(app.id, test.id)} disabled={busyForApp}>
                          <Play size={18} />
                        </IconButton>
                      </div>
                      <TestRunEvidence result={latest} />
                    </div>
                  );
                })}
                <LatestSmokePanel app={app} />
              </div>
            </section>
            </Fragment>
          );
        })
      ) : (
        <section className="panel">
          <EmptyState text="Managed application data is loading." />
        </section>
      )}
    </div>
  );
}

function ParityComparisonPanel({ comparisons }: { comparisons: ParityComparisonReport[] }) {
  const visibleComparisons = comparisons.slice(0, 8);
  const [expandedComparisonId, setExpandedComparisonId] = useState<string | null>(visibleComparisons[0]?.comparisonId ?? null);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="section-kicker">Side-by-side evidence</div>
          <h2>
            <GitBranch size={20} />
            Comparison Results
          </h2>
          <p>Latest parity comparisons between legacy OpenEMR and the modernized target.</p>
        </div>
      </div>
      {visibleComparisons.length ? (
        <div className="comparison-grid">
          {visibleComparisons.map((comparison) => {
            const suites = Array.from(new Set([...comparison.left.selectedSuites, ...comparison.right.selectedSuites]));
            const expanded = expandedComparisonId === comparison.comparisonId;
            return (
              <article className="comparison-card" key={comparison.comparisonId}>
                <div className="comparison-card-header">
                  <div>
                    <div className="architecture-title">
                      <strong>{comparison.selectionId}</strong>
                      <StatusPill state={comparison.status} label={comparison.status} />
                    </div>
                    <p>{comparison.selectionKind} comparison finished {formatDate(comparison.finishedAt)}</p>
                  </div>
                  <div className="comparison-card-actions">
                    {comparison.passed ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                    <IconButton
                      title={`${expanded ? "Hide" : "Show"} ${comparison.selectionId} comparison details`}
                      onClick={() => setExpandedComparisonId(expanded ? null : comparison.comparisonId)}
                    >
                      {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </IconButton>
                  </div>
                </div>

                <div className="comparison-side-grid">
                  <ComparisonSideSummary side={comparison.left} />
                  <ComparisonSideSummary side={comparison.right} />
                </div>

                <div className="evidence-metrics">
                  <span>{comparison.differenceCount} differences</span>
                  <span>{comparison.left.stats.expected + comparison.right.stats.expected} checks</span>
                  <span>{formatDuration(comparison.durationMs)}</span>
                </div>

                {suites.length ? (
                  <div className="evidence-selection">
                    <span>Suites</span>
                    <code>{suites.join(", ")}</code>
                  </div>
                ) : null}

                {comparison.differenceCount ? (
                  <ul className="comparison-differences">
                    {comparison.differences.slice(0, 3).map((difference, index) => (
                      <li key={`${comparison.comparisonId}-difference-${index}`}>{formatComparisonDifference(difference)}</li>
                    ))}
                    {comparison.differenceCount > 3 ? <li>{comparison.differenceCount - 3} more differences recorded</li> : null}
                  </ul>
                ) : (
                  <div className="comparison-match-note">No differences recorded.</div>
                )}

                <code>{comparison.reports.comparisonJson || comparison.artifactDirectory}</code>

                {expanded ? <ComparisonDrillIn comparison={comparison} suites={suites} /> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState text="No side-by-side comparison artifacts have been recorded yet." />
      )}
    </section>
  );
}

function ComparisonDrillIn({ comparison, suites }: { comparison: ParityComparisonReport; suites: string[] }) {
  return (
    <div className="comparison-drill-in" aria-label={`${comparison.selectionId} comparison details`}>
      <div className="comparison-detail-grid">
        <ComparisonArtifactDetail label="Legacy artifact" side={comparison.left} />
        <ComparisonArtifactDetail label="Modernized artifact" side={comparison.right} />
      </div>
      <div className="comparison-detail-grid">
        <div className="comparison-detail-block">
          <span>Comparison artifact</span>
          <ArtifactPathValue
            path={comparison.reports.comparisonJson || comparison.artifactDirectory}
            linkable={Boolean(comparison.reports.comparisonJson)}
            label={`${comparison.selectionId} comparison JSON`}
          />
        </div>
        <div className="comparison-detail-block">
          <span>Artifact directory</span>
          <ArtifactPathValue path={comparison.artifactDirectory} linkable={false} label={`${comparison.selectionId} artifact directory`} />
        </div>
      </div>
      <div className="comparison-detail-block">
        <span>Selected suites</span>
        <code>{suites.length ? suites.join(", ") : "None recorded"}</code>
      </div>
      <div className="comparison-detail-block">
        <span>Differences</span>
        {comparison.differenceCount ? (
          <ol className="comparison-difference-list">
            {comparison.differences.map((difference, index) => (
              <li key={`${comparison.comparisonId}-detail-difference-${index}`}>{formatComparisonDifference(difference)}</li>
            ))}
          </ol>
        ) : (
          <div className="comparison-match-note">Legacy and modernized artifacts match for this selection.</div>
        )}
      </div>
    </div>
  );
}

function ComparisonArtifactDetail({ label, side }: { label: string; side: ParityComparisonReport["left"] }) {
  return (
    <div className="comparison-detail-block">
      <span>{label}</span>
      <strong>{side.target}</strong>
      <ArtifactPathValue path={side.path || "No artifact path recorded"} linkable={Boolean(side.path && side.exists)} label={`${side.target} run artifact`} />
      <small>
        {side.runId} / {side.exists ? "artifact present" : "artifact missing"}
      </small>
    </div>
  );
}

function ArtifactPathValue({ path, linkable, label }: { path: string; linkable: boolean; label: string }) {
  return (
    <div className="artifact-path-row">
      <code>{path}</code>
      {linkable ? (
        <a href={`/api/artifacts/file?path=${encodeURIComponent(path)}`} target="_blank" rel="noreferrer" title={`Open ${label}`} aria-label={`Open ${label}`}>
          <ExternalLink size={14} />
        </a>
      ) : null}
    </div>
  );
}

function ComparisonSideSummary({ side }: { side: ParityComparisonReport["left"] }) {
  return (
    <div className="comparison-side">
      <div className="comparison-side-title">
        <strong>{side.target}</strong>
        {side.passed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      </div>
      <span>{side.stats.expected} expected</span>
      <span>{side.stats.unexpected} unexpected</span>
      <span>{formatDuration(side.stats.duration)}</span>
      <code>{side.runId}</code>
    </div>
  );
}

function formatComparisonDifference(difference: unknown) {
  if (typeof difference === "string") {
    return difference;
  }
  if (difference && typeof difference === "object") {
    const record = difference as Record<string, unknown>;
    const path = typeof record.path === "string" ? record.path : undefined;
    const message = typeof record.message === "string" ? record.message : undefined;
    if (path && message) {
      return `${path}: ${message}`;
    }
    if (message) {
      return message;
    }
  }
  return JSON.stringify(difference);
}

function CustomParityRunPanel({
  app,
  busy,
  parityManifest,
  onRunCustomParity
}: {
  app?: AppSnapshot;
  busy: BusyState;
  parityManifest: ParityManifest | null;
  onRunCustomParity: (request: CustomParityRunRequest) => void;
}) {
  const [selectionKind, setSelectionKind] = useState<"suite" | "plan">("suite");
  const [suite, setSuite] = useState("all");
  const [plan, setPlan] = useState("slice-29-immunizations-readiness");
  const [reset, setReset] = useState<ParityResetMode>("run");
  const [headed, setHeaded] = useState(false);
  const [grep, setGrep] = useState("");
  const busyForApp = busy?.appId === app?.id;
  const supportedSuites = parityManifest?.suites.filter((candidate) => !app || candidate.targets.includes(app.id)) ?? [];
  const supportedPlans = parityManifest?.plans.filter((candidate) => !app || candidate.targets.includes(app.id)) ?? [];
  const selectedPlan = supportedPlans.find((candidate) => candidate.id === plan);
  const selectedSuite = supportedSuites.find((candidate) => candidate.id === suite);

  useEffect(() => {
    if (!parityManifest) {
      return;
    }
    setReset(selectionKind === "plan" ? selectedPlan?.resetMode ?? parityManifest.defaultResetMode : suite === "all" ? parityManifest.defaultResetMode : selectedSuite?.defaultResetMode ?? parityManifest.defaultResetMode);
  }, [parityManifest, selectedPlan?.resetMode, selectedSuite?.defaultResetMode, selectionKind, suite]);

  const runLabel = selectionKind === "plan" ? selectedPlan?.name ?? plan : suite === "all" ? "All Suites" : selectedSuite?.name ?? suite;
  const runDescription = selectionKind === "plan" ? selectedPlan?.description : suite === "all" ? "All suites supported by the selected target." : selectedSuite?.description;

  return (
    <section className="panel custom-run-panel">
      <div className="panel-header">
        <div>
          <div className="section-kicker">Run builder{app ? ` - ${app.name}` : ""}</div>
          <h2>
            <Play size={20} />
            Custom Parity Run
          </h2>
          <p>{runDescription ?? "Choose a suite or plan, then run it against the managed application with the selected reset mode."}</p>
        </div>
        <IconButton
          title={`Run ${runLabel}`}
          variant="primary"
          disabled={!app || !parityManifest || busyForApp}
          onClick={() =>
            onRunCustomParity({
              selectionKind,
              suite: selectionKind === "suite" ? suite : undefined,
              plan: selectionKind === "plan" ? plan : undefined,
              reset,
              headed,
              grep: grep.trim() || undefined
            })
          }
        >
          <Play size={18} />
        </IconButton>
      </div>
      {app && parityManifest ? (
        <div className="custom-run-form">
          <label>
            <span>Selection</span>
            <select value={selectionKind} onChange={(event) => setSelectionKind(event.target.value as "suite" | "plan")} disabled={busyForApp}>
              <option value="suite">Suite</option>
              <option value="plan">Plan</option>
            </select>
          </label>
          {selectionKind === "suite" ? (
            <label>
              <span>Suite</span>
              <select value={suite} onChange={(event) => setSuite(event.target.value)} disabled={busyForApp}>
                <option value="all">All Suites</option>
                {supportedSuites.map((candidate) => (
                  <option value={candidate.id} key={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              <span>Plan</span>
              <select value={plan} onChange={(event) => setPlan(event.target.value)} disabled={busyForApp}>
                {supportedPlans.map((candidate) => (
                  <option value={candidate.id} key={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span>Reset</span>
            <select value={reset} onChange={(event) => setReset(event.target.value as ParityResetMode)} disabled={busyForApp}>
              {parityManifest.resetModes.map((mode) => (
                <option value={mode.id} key={mode.id}>
                  {mode.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Filter</span>
            <input value={grep} maxLength={120} onChange={(event) => setGrep(event.target.value)} placeholder="optional grep" disabled={busyForApp} />
          </label>
          <label className="toggle-label">
            <input type="checkbox" checked={headed} onChange={(event) => setHeaded(event.target.checked)} disabled={busyForApp} />
            <span>Headed</span>
          </label>
          <div className="reset-mode-help">
            {parityManifest.resetModes.find((mode) => mode.id === reset)?.description}
          </div>
        </div>
      ) : (
        <EmptyState text="Parity manifest or managed application data is loading." />
      )}
    </section>
  );
}

function TestRunEvidence({ result }: { result: SmokeResult | ParityRunResult | NativeRunResult | NativeJestRunResult | null }) {
  if (!result) {
    return <div className="test-evidence empty">No run recorded.</div>;
  }

  if (isNativeJestRunResult(result)) {
    return (
      <div className="test-evidence">
        <div className="test-result-header">
          {result.passed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <strong>{result.passed ? "Passed" : "Failed"}</strong>
          <span>{formatDate(result.finishedAt)}</span>
        </div>
        <div className="evidence-selection">
          <span>Jest</span>
          <code>
            Node {result.nodeVersion} / npm {result.npmVersion}
          </code>
        </div>
        <div className="evidence-metrics">
          <span>{result.stats.testSuites.passed.toLocaleString()} suites passed</span>
          <span>{result.stats.tests.passed.toLocaleString()} tests passed</span>
          <span>{formatDuration(result.durationSeconds * 1000)}</span>
        </div>
        <div className="evidence-metrics">
          <span>{result.stats.testSuites.failed + result.stats.testSuites.runtimeErrors} suite failures</span>
          <span>{result.stats.tests.failed} test failures</span>
          <span>{result.stats.tests.pending + result.stats.tests.todo} pending/todo</span>
        </div>
        <code>{result.reportPath}</code>
      </div>
    );
  }

  if (isNativeRunResult(result)) {
    return (
      <div className="test-evidence">
        <div className="test-result-header">
          {result.passed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <strong>{result.passed ? "Passed" : "Failed"}</strong>
          <span>{formatDate(result.finishedAt)}</span>
        </div>
        <div className="evidence-selection">
          <span>{result.mode} mode</span>
          {result.excludedGroups.length ? <code>excluding {result.excludedGroups.join(", ")}</code> : null}
        </div>
        <div className="evidence-metrics">
          <span>{result.stats.tests.toLocaleString()} tests</span>
          <span>{result.stats.assertions.toLocaleString()} assertions</span>
          <span>{formatDuration(result.durationSeconds * 1000)}</span>
        </div>
        <div className="evidence-metrics">
          <span>{result.stats.failures + result.stats.errors} failed/error</span>
          <span>{result.stats.warnings} warnings</span>
          <span>{result.stats.skipped + result.stats.incomplete} skipped/incomplete</span>
        </div>
        <code>{result.logPath}</code>
      </div>
    );
  }

  if (isParityRunResult(result)) {
    return (
      <div className="test-evidence">
        <div className="test-result-header">
          {result.passed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <strong>{result.passed ? "Passed" : "Failed"}</strong>
          <span>{formatDate(result.finishedAt)}</span>
        </div>
        <div className="evidence-selection">
          <span>{result.plan?.name ?? result.selectionId ?? result.suite}</span>
          {result.selectedSuites?.length ? <code>{result.selectedSuites.join(", ")}</code> : null}
        </div>
        <div className="evidence-metrics">
          <span>{result.stats.expected} passed</span>
          <span>{result.stats.unexpected} failed</span>
          <span>{formatDuration(result.durationMs)}</span>
        </div>
        <code>{result.artifactDirectory}</code>
      </div>
    );
  }

  return (
    <div className="test-evidence">
      <div className="test-result-header">
        {result.passed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
        <strong>{result.passed ? "Passed" : "Failed"}</strong>
        <span>{formatDate(result.finishedAt)}</span>
      </div>
      <div className="evidence-metrics">
        <span>{result.checks.filter((check) => check.passed).length} passed</span>
        <span>{result.checks.filter((check) => !check.passed).length} failed</span>
        <span>{formatDuration(result.durationSeconds * 1000)}</span>
      </div>
    </div>
  );
}

function isParityRunResult(result: SmokeResult | ParityRunResult | NativeRunResult | NativeJestRunResult): result is ParityRunResult {
  return "stats" in result && "artifactDirectory" in result;
}

function isNativeRunResult(result: SmokeResult | ParityRunResult | NativeRunResult | NativeJestRunResult): result is NativeRunResult {
  return "mode" in result && "logPath" in result;
}

function isNativeJestRunResult(result: SmokeResult | ParityRunResult | NativeRunResult | NativeJestRunResult): result is NativeJestRunResult {
  return "runner" in result && result.runner === "jest";
}

function SeedDataPage({ app, busy, seedDatasets, onRunSeed }: { app?: AppSnapshot; busy: BusyState; seedDatasets: SeedDataset[]; onRunSeed: (seedId: string) => void }) {
  const busyForApp = busy?.appId === app?.id;

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="section-kicker">Shared contract</div>
            <h2>
              <Database size={20} />
              Seed Data
            </h2>
          </div>
        </div>
        {seedDatasets.length ? (
          <div className="seed-dataset-list">
            {seedDatasets.map((dataset) => (
              <div className="seed-dataset-card" key={dataset.id}>
                <div className="architecture-title">
                  <strong>{dataset.name}</strong>
                  <StatusPill state={dataset.status} label={dataset.status} />
                </div>
                <p>{dataset.currentSeedLevel}</p>
                <div className="seed-contract-metrics">
                  <span>
                    Version <code>{dataset.version}</code>
                  </span>
                  <span>
                    Target patients <code>{dataset.targetPatientCount}</code>
                  </span>
                  <span>
                    Systems <code>{dataset.targetSystems.length}</code>
                  </span>
                </div>
                <div className="seed-target-grid">
                  {dataset.recordTargets.map((target) => (
                    <Metric key={target.name} label={target.name} value={target.currentLegacy} detail={`Target ${target.target}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="Seed dataset manifest is loading." />
        )}
      </section>

      <section className="panel">
        <div className="panel-header compact">
          <h2>
            <Sprout size={20} />
            Seed Actions
          </h2>
        </div>
        {app?.seeds.length ? (
          <div className="action-card-list">
            {app.seeds.map((seed) => (
              <div className="action-card" key={seed.id}>
                <div>
                  <strong>{seed.name}</strong>
                  <p>{seed.description}</p>
                </div>
                <IconButton title={`Run ${seed.name}`} onClick={() => onRunSeed(seed.id)} disabled={busyForApp}>
                  <Sprout size={18} />
                </IconButton>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="No seed actions configured." />
        )}
      </section>
    </div>
  );
}

function DashboardPage({
  legacyApp,
  modernizedApp,
  busy,
  onAction,
  onRunTest,
  onRunSeed,
  onLoadLogs,
  seedDatasets,
  logs,
  progress,
  events,
  changelog
}: {
  legacyApp?: AppSnapshot;
  modernizedApp?: AppSnapshot;
  busy: BusyState;
  onAction: (action: "start" | "stop" | "restart") => void;
  onRunTest: (testId: string) => void;
  onRunSeed: (seedId: string) => void;
  onLoadLogs: () => void;
  seedDatasets: SeedDataset[];
  logs: string;
  progress: ProgressSlice[];
  events: LifecycleEvent[];
  changelog: ProjectChangelog | null;
}) {
  return (
    <>
      <OverviewGrid legacyApp={legacyApp} modernizedApp={modernizedApp} progress={progress} changelog={changelog} />
      {legacyApp ? (
        <LegacyAppPanel app={legacyApp} busy={busy} onAction={onAction} onRunTest={onRunTest} onRunSeed={onRunSeed} onLoadLogs={onLoadLogs} seedDatasets={seedDatasets} logs={logs} />
      ) : (
        <section className="panel">
          <EmptyState text="Loading managed applications." />
        </section>
      )}
      <div className="lower-grid">
        <ProgressPanel slices={progress} />
        <EventsPanel events={events} />
      </div>
    </>
  );
}

function PageBody({
  page,
  apps,
  legacyApp,
  modernizedApp,
  busy,
  onAction,
  onRunTest,
  onRunSeed,
  onLoadLogs,
  seedDatasets,
  logs,
  progress,
  functionalityAreas,
  functionalityVersion,
  functionalityLastUpdated,
  events,
  architecture,
  changelog,
  parityManifest,
  parityComparisons,
  onRunCustomParity
}: {
  page: PageId;
  apps: AppSnapshot[];
  legacyApp?: AppSnapshot;
  modernizedApp?: AppSnapshot;
  busy: BusyState;
  onAction: (appId: string, action: "start" | "stop" | "restart") => void;
  onRunTest: (appId: string, testId: string) => void;
  onRunSeed: (appId: string, seedId: string) => void;
  onLoadLogs: (appId: string) => void;
  seedDatasets: SeedDataset[];
  logs: Record<string, string>;
  progress: ProgressSlice[];
  functionalityAreas: FunctionalityProgressArea[];
  functionalityVersion?: string;
  functionalityLastUpdated?: string;
  events: LifecycleEvent[];
  architecture: ArchitectureModel | null;
  changelog: ProjectChangelog | null;
  parityManifest: ParityManifest | null;
  parityComparisons: ParityComparisonReport[];
  onRunCustomParity: (appId: string, request: CustomParityRunRequest) => void;
}) {
  if (page === "timeline") {
    return <ChangelogPanel changelog={changelog} />;
  }
  if (page === "progress") {
    return <ProgressPage slices={progress} functionalityAreas={functionalityAreas} functionalityVersion={functionalityVersion} functionalityLastUpdated={functionalityLastUpdated} />;
  }
  if (page === "architecture") {
    return <ArchitecturePanel architecture={architecture} />;
  }
  if (page === "tests") {
    return <TestsPage apps={apps} busy={busy} parityManifest={parityManifest} parityComparisons={parityComparisons} onRunTest={onRunTest} onRunCustomParity={onRunCustomParity} />;
  }
  if (page === "seed-data") {
    return <SeedDataPage app={legacyApp} busy={busy} seedDatasets={seedDatasets} onRunSeed={(seedId) => legacyApp && onRunSeed(legacyApp.id, seedId)} />;
  }
  if (page === "applications") {
    return apps.length ? (
      <div className="page-stack">
        {apps.map((app) => (
          <LegacyAppPanel
            key={app.id}
            app={app}
            busy={busy}
            onAction={(action) => onAction(app.id, action)}
            onRunTest={(testId) => onRunTest(app.id, testId)}
            onRunSeed={(seedId) => onRunSeed(app.id, seedId)}
            onLoadLogs={() => onLoadLogs(app.id)}
            seedDatasets={seedDatasets}
            logs={logs[app.id] ?? ""}
          />
        ))}
      </div>
    ) : (
      <section className="panel">
        <EmptyState text="Loading managed applications." />
      </section>
    );
  }
  return (
    <DashboardPage
      legacyApp={legacyApp}
      modernizedApp={modernizedApp}
      busy={busy}
      onAction={(action) => legacyApp && onAction(legacyApp.id, action)}
      onRunTest={(testId) => legacyApp && onRunTest(legacyApp.id, testId)}
      onRunSeed={(seedId) => legacyApp && onRunSeed(legacyApp.id, seedId)}
      onLoadLogs={() => legacyApp && onLoadLogs(legacyApp.id)}
      seedDatasets={seedDatasets}
      logs={legacyApp ? (logs[legacyApp.id] ?? "") : ""}
      progress={progress}
      events={events}
      changelog={changelog}
    />
  );
}

export function App() {
  const [apps, setApps] = useState<AppSnapshot[]>([]);
  const [architecture, setArchitecture] = useState<ArchitectureModel | null>(null);
  const [progress, setProgress] = useState<ProgressSlice[]>([]);
  const [functionalityAreas, setFunctionalityAreas] = useState<FunctionalityProgressArea[]>([]);
  const [functionalityVersion, setFunctionalityVersion] = useState<string | undefined>();
  const [functionalityLastUpdated, setFunctionalityLastUpdated] = useState<string | undefined>();
  const [seedDatasets, setSeedDatasets] = useState<SeedDataset[]>([]);
  const [parityManifest, setParityManifest] = useState<ParityManifest | null>(null);
  const [parityComparisons, setParityComparisons] = useState<ParityComparisonReport[]>([]);
  const [changelog, setChangelog] = useState<ProjectChangelog | null>(null);
  const [events, setEvents] = useState<LifecycleEvent[]>([]);
  const [logs, setLogs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<BusyState>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<PageId>(() => parseHashPage());

  const refreshedAt = apps[0]?.refreshedAt;
  const pageTitle = pageTitles[activePage];

  const loadDashboard = useCallback(async () => {
    setError(null);
    const [appData, architectureData, progressData, eventData, seedData, parityManifestData, parityComparisonData, changelogData] = await Promise.all([
      api.getApps(),
      api.getArchitecture(),
      api.getProgress(),
      api.getEvents(),
      api.getSeedDatasets(),
      api.getParityManifest(),
      api.getParityComparisons(),
      api.getChangelog()
    ]);
    setApps(appData.apps);
    setArchitecture(architectureData);
    setProgress(progressData.slices);
    setFunctionalityAreas(progressData.functionalityAreas);
    setFunctionalityVersion(progressData.functionalityVersion);
    setFunctionalityLastUpdated(progressData.functionalityLastUpdated);
    setEvents(eventData.events);
    setSeedDatasets(seedData.datasets);
    setParityManifest(parityManifestData);
    setParityComparisons(parityComparisonData.comparisons);
    setChangelog(changelogData);
  }, []);

  useEffect(() => {
    const onHashChange = () => setActivePage(parseHashPage());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    loadDashboard().catch((loadError) => setError(loadError instanceof Error ? loadError.message : String(loadError)));
    const timer = window.setInterval(() => {
      loadDashboard().catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  const legacyApp = useMemo(() => apps.find((app) => app.id === "legacy-openemr"), [apps]);
  const modernizedApp = useMemo(() => apps.find((app) => app.id === "modernized-openemr"), [apps]);

  function navigate(page: PageId) {
    if (page === activePage) {
      return;
    }
    window.location.hash = `/${page}`;
    setActivePage(page);
  }

  async function runWithBusy(appId: string, label: string, work: () => Promise<void>) {
    setBusy({ appId, label });
    setError(null);
    try {
      await work();
      await loadDashboard();
    } catch (workError) {
      setError(workError instanceof Error ? workError.message : String(workError));
      await loadDashboard().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  }

  const handleAction = (appId: string, action: "start" | "stop" | "restart") => {
    void runWithBusy(appId, `${action} ${appId}`, async () => {
      const response = await api.runAction(appId, action);
      setApps((current) => current.map((item) => (item.id === appId ? response.snapshot : item)));
    });
  };

  const handleRunTest = (appId: string, testId: string) => {
    void runWithBusy(appId, `running ${testId}`, async () => {
      const response = await api.runTest(appId, testId);
      setApps((current) => current.map((item) => (item.id === appId ? response.snapshot : item)));
    });
  };

  const handleRunCustomParity = (appId: string, request: CustomParityRunRequest) => {
    const label = request.selectionKind === "plan" ? `running ${request.plan}` : `running ${request.suite}`;
    void runWithBusy(appId, label, async () => {
      const response = await api.runCustomParity(appId, request);
      setApps((current) => current.map((item) => (item.id === appId ? response.snapshot : item)));
    });
  };

  const handleRunSeed = (appId: string, seedId: string) => {
    void runWithBusy(appId, `seeding ${seedId}`, async () => {
      const response = await api.runSeed(appId, seedId);
      setApps((current) => current.map((item) => (item.id === appId ? response.snapshot : item)));
    });
  };

  const handleLoadLogs = (appId: string) => {
    void runWithBusy(appId, "loading logs", async () => {
      const response = await api.getLogs(appId);
      setLogs((current) => ({
        ...current,
        [appId]: [response.result.stdout, response.result.stderr].filter(Boolean).join("\n")
      }));
    });
  };

  return (
    <div className="workbench-app-shell">
      <Sidebar activePage={activePage} onNavigate={navigate} />
      <main className="workbench-shell">
        <AppHeader
          title={pageTitle.title}
          subtitle={pageTitle.subtitle}
          onRefresh={() => loadDashboard().catch((loadError) => setError(loadError instanceof Error ? loadError.message : String(loadError)))}
          busy={busy}
          refreshedAt={refreshedAt}
        />

        {error ? (
          <div className="error-banner">
            <CircleAlert size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        <PageBody
          page={activePage}
          apps={apps}
          legacyApp={legacyApp}
          modernizedApp={modernizedApp}
          busy={busy}
          onAction={handleAction}
          onRunTest={handleRunTest}
          onRunSeed={handleRunSeed}
          onLoadLogs={handleLoadLogs}
          seedDatasets={seedDatasets}
          logs={logs}
          progress={progress}
          functionalityAreas={functionalityAreas}
          functionalityVersion={functionalityVersion}
          functionalityLastUpdated={functionalityLastUpdated}
          events={events}
          architecture={architecture}
          changelog={changelog}
          parityManifest={parityManifest}
          parityComparisons={parityComparisons}
          onRunCustomParity={handleRunCustomParity}
        />
      </main>
    </div>
  );
}
