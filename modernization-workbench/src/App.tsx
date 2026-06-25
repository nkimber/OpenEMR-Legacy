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
import type { ComponentType, CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { api } from "./api";
import type {
  AppSnapshot,
  ArchitectureModel,
  ArchitectureSystem,
  ArchitectureTechnology,
  ChangelogEntry,
  CustomParityRunRequest,
  FunctionalityProgressArea,
  FunctionalityProgressForecast,
  FunctionalityProgressHistoryPoint,
  FunctionalityProgressSummary,
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
  SmokeResult,
  SourceInventorySystem
} from "./types";

type BusyState = {
  appId: string;
  label: string;
} | null;

const allAppsBusyId = "all-apps";

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

function formatHistoryAxisTick(value: number, includeDate: boolean) {
  return new Intl.DateTimeFormat(undefined, includeDate ? {
    month: "short",
    day: "numeric",
    hour: "numeric"
  } : {
    hour: "2-digit",
    minute: "2-digit"
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

function formatTimelineDateSource(source?: ChangelogEntry["timelineDateSource"]) {
  switch (source) {
    case "finishedAt":
      return "Finished";
    case "completedAt":
      return "Completed";
    case "startedAt":
      return "Started";
    case "sectionDate":
    default:
      return "Section";
  }
}

function getTimelineDateTitle(entry: ChangelogEntry) {
  const timelineDate = entry.timelineDate ?? entry.date;
  const source = formatTimelineDateSource(entry.timelineDateSource);
  const sectionDate = formatDateOnly(entry.date);

  return timelineDate !== entry.date
    ? `${source} date. Changelog section date: ${sectionDate}.`
    : `${source} date.`;
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

function normalizePercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatProgressPercent(value?: number) {
  if (value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function formatProgressDelta(value?: number) {
  if (value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  const rounded = Math.round(value * 10) / 10;
  const formatted = `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
  return rounded > 0 ? `+${formatted}` : formatted;
}

function isTimelineAnchorPoint(point: FunctionalityProgressHistoryPoint) {
  return point.historyKind === "timeline-anchor" || point.progressEstimateAvailable === false;
}

function isHistoricalEstimatePoint(point: FunctionalityProgressHistoryPoint) {
  return point.historyKind === "historical-estimate";
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...` : value;
}

function getProgressHistoryNarrative(point: FunctionalityProgressHistoryPoint) {
  return point.narrativeSummary || point.commitMessageBody || point.note || "";
}

function getProgressHistoryNarrativeSource(point: FunctionalityProgressHistoryPoint) {
  switch (point.narrativeSource) {
    case "project-changelog":
      return point.narrativeEntryId ? `Project changelog entry ${point.narrativeEntryId}` : "Project changelog";
    case "commit-message":
      return "Git commit message";
    case "timeline-anchor":
      return "Timeline anchor";
    case "historical-estimate":
      return "Historical estimate";
    default:
      return "Git commit subject";
  }
}

function formatEstimateBasis(value?: string) {
  if (!value) {
    return "Backfill";
  }

  return value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatScopePoints(value?: number) {
  if (value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
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

function RuntimeReadinessBanner({
  apps,
  busy,
  onAction,
  onStartAll
}: {
  apps: AppSnapshot[];
  busy: BusyState;
  onAction: (appId: string, action: "start" | "restart") => void;
  onStartAll: () => void;
}) {
  if (apps.length === 0) {
    return null;
  }

  const guidedApps = apps.filter((app) => app.runtimeGuidance);
  const hasDockerDesktopIssue = guidedApps.some((app) => app.runtimeGuidance?.dockerDesktopLikelyUnavailable);
  const hasError = guidedApps.some((app) => app.runtimeGuidance?.severity === "error");
  const hasIssues = guidedApps.length > 0;
  const allReady = apps.every((app) => app.runtime.state === "healthy" && app.health.ok);
  const severity = hasError ? "error" : hasIssues ? "warning" : "ready";
  const BannerIcon = severity === "ready" ? CheckCircle2 : CircleAlert;
  const title = hasDockerDesktopIssue
    ? "Docker Desktop is not reachable"
    : hasIssues
      ? "Local app runtime needs attention"
      : "Docker apps are running";
  const message = hasDockerDesktopIssue
    ? "Start Docker Desktop from Windows, wait until the engine is running, then start the configured compose stacks from here."
    : hasIssues
      ? "One or more local app stacks is stopped, unhealthy, or not reachable. Use Start all apps or the per-app action below."
      : allReady
        ? "All configured Docker apps are running and their health endpoints are reachable."
        : "The configured app stacks have no active runtime warnings.";
  const busyNow = Boolean(busy);

  return (
    <section className={`runtime-banner runtime-banner-${severity}`} aria-live="polite">
      <div className="runtime-banner-header">
        <div className="runtime-banner-title">
          <BannerIcon size={20} />
          <div>
            <strong>{title}</strong>
            <p>{message}</p>
          </div>
        </div>
        <button className="text-button runtime-action-button" type="button" onClick={onStartAll} disabled={busyNow}>
          <Power size={14} />
          Start all apps
        </button>
      </div>
      <div className="runtime-app-list">
        {apps.map((app) => {
          const guidance = app.runtimeGuidance;
          const primaryAction = guidance?.canStartFromWorkbench ? guidance.primaryAction : undefined;
          const detail = guidance?.detail?.replace(/\s+/g, " ").trim();
          const rowMessage = guidance?.message ?? `${app.runtime.detail} Health endpoint ${app.health.ok ? `responded in ${formatDuration(app.health.durationMs)}` : "is not reachable"}.`;

          return (
            <div className="runtime-app-readiness" key={app.id}>
              <StatusPill state={app.runtime.state} label={app.runtime.label} />
              <div>
                <strong>{app.name}</strong>
                <span>{rowMessage}</span>
                {detail ? <small>{truncateText(detail, 280)}</small> : null}
              </div>
              {primaryAction ? (
                <button className="text-button runtime-action-button" type="button" onClick={() => onAction(app.id, primaryAction)} disabled={busyNow}>
                  {primaryAction === "restart" ? <RotateCw size={14} /> : <Power size={14} />}
                  {primaryAction === "restart" ? "Restart" : "Start"}
                </button>
              ) : null}
            </div>
          );
        })}
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
  const busyForApp = busy?.appId === app.id || busy?.appId === allAppsBusyId;
  const hasDatabaseMetrics = app.dataProfile.available && app.dataProfile.rows.length > 0;
  const patientCount = app.dataProfile.rows.find((row) => row.tableName === "patient_data" || row.tableName === "patients")?.rowCount ?? 0;
  const encounterCount = app.dataProfile.rows.find((row) => row.tableName === "form_encounter" || row.tableName === "encounters")?.rowCount ?? 0;
  const appointmentCount = app.dataProfile.rows.find((row) => row.tableName === "openemr_postcalendar_events" || row.tableName === "appointments")?.rowCount ?? 0;
  const managedSeed = app.seeds.find((seed) => seed.id === "gold-test-dataset-v1") ?? app.seeds[0];
  const seedDataset = seedDatasets.find((dataset) => dataset.id === managedSeed?.datasetId);
  const patientTarget = seedDataset?.recordTargets.find((target) => target.name === "patients")?.target ?? seedDataset?.targetPatientCount;
  const latestSeedDetail = app.latestSeed
    ? `${app.latestSeed.mode ?? "seeded"} ${app.latestSeed.expectedPatients} gold patients`
    : seedDataset?.currentSeedLevel ?? "Synthetic seed data pending";
  const demoLoginEntries = app.demoLogin.entries?.length
    ? app.demoLogin.entries
    : app.demoLogin.username && app.demoLogin.password
      ? [{ label: "Default", username: app.demoLogin.username, password: app.demoLogin.password }]
      : [];

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

      {app.runtimeGuidance ? (
        <div className={`app-runtime-guidance app-runtime-guidance-${app.runtimeGuidance.severity}`}>
          <CircleAlert size={17} />
          <div>
            <strong>{app.runtimeGuidance.title}</strong>
            <span>{app.runtimeGuidance.message}</span>
          </div>
        </div>
      ) : null}

      <div className={`credential-strip${app.demoLogin.available ? "" : " warning"}`}>
        <div className="credential-heading">
          <KeyRound size={17} />
          <strong>Local demo login</strong>
          <span>{app.demoLogin.source}</span>
        </div>
        {app.demoLogin.available ? (
          <div className="credential-values">
            {demoLoginEntries.map((entry) => (
              <span key={`${app.id}-${entry.label}`}>
                {entry.label} <code>{entry.username}</code> / <code>{entry.password}</code>
              </span>
            ))}
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
        {hasDatabaseMetrics ? (
          <>
            <Metric label="Patients" value={patientCount} detail={latestSeedDetail} />
            <Metric label="Encounters" value={encounterCount} detail={`${appointmentCount} appointments`} />
          </>
        ) : (
          <>
            <Metric label="Compose services" value={app.services.length || app.containers.length} detail={app.runtime.detail} />
            <Metric label="Managed actions" value={`${app.tests.length} tests`} detail={`${app.seeds.length} seed actions`} />
          </>
        )}
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
        ) : app.services.length ? (
          app.services.map((service) => (
            <div className="table-row" key={`${app.id}-${service}`}>
              <span>{service}</span>
              <span>stopped</span>
              <span>n/a</span>
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
  if (app.tests.length === 0) {
    return (
      <div className="subsection">
        <h3>
          <TestTube2 size={17} />
          Latest Smoke Test
        </h3>
        <EmptyState text="No smoke-test action is configured for this managed app." />
      </div>
    );
  }

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
  lastUpdated,
  summary,
  history,
  forecast
}: {
  areas: FunctionalityProgressArea[];
  version?: string;
  lastUpdated?: string;
  summary?: FunctionalityProgressSummary;
  history: FunctionalityProgressHistoryPoint[];
  forecast?: FunctionalityProgressForecast;
}) {
  const completedCount = areas.reduce((total, area) => total + area.completed.length, 0);
  const outstandingCount = areas.reduce((total, area) => total + area.outstanding.length, 0);
  const deferredCount = areas.reduce((total, area) => total + area.deferred.length, 0);
  const simpleAveragePercent = summary?.simpleAveragePercent ?? (
    areas.length ? areas.reduce((total, area) => total + area.completionEstimatePercent, 0) / areas.length : 0
  );
  const weightedCompletePercent = summary?.weightedAveragePercent ?? simpleAveragePercent;
  const estimatedRemainingPercent = summary?.estimatedRemainingPercent ?? 100 - weightedCompletePercent;

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
        <Metric label="Overall Estimated Complete" value={formatProgressPercent(weightedCompletePercent)} detail={`${formatProgressPercent(estimatedRemainingPercent)} estimated remaining`} />
        <Metric label="Simple Average" value={formatProgressPercent(simpleAveragePercent)} detail="Unweighted comparison signal" />
        <Metric label="Scope Weight" value={formatScopePoints(summary?.totalScopeWeight)} detail={`${formatScopePoints(summary?.weightedRemainingPoints)} weighted points remaining`} />
        <Metric label="Estimated Active Time Left" value={formatElapsedDuration(forecast?.estimatedRemainingActiveMs)} detail={`${formatScopePoints(forecast?.estimatedRemainingSliceEquivalents)} slice-equivalent units`} />
        <Metric label="Completed Pieces" value={completedCount} />
        <Metric label="Outstanding Pieces" value={outstandingCount} />
        <Metric label="Deferred Pieces" value={deferredCount} />
      </div>

      <ProgressForecastPanel forecast={forecast} />
      <FunctionalityProgressHistoryChart history={history} />

      {areas.length ? (
        <div className="functionality-grid">
          {areas.map((area) => {
            const estimatePercent = normalizePercent(area.completionEstimatePercent);
            const scopeWeight = area.estimatedScopeWeight;

            return (
              <div className="functionality-card" key={area.id}>
                <div className="functionality-card-header">
                  <div>
                    <strong>{area.name}</strong>
                    <p>{area.summary}</p>
                  </div>
                  <StatusPill state={area.status} label={area.status.replaceAll("-", " ")} />
                </div>

                <div className="functionality-estimate">
                  <div className="functionality-estimate-heading">
                    <span>Estimated Complete</span>
                    <div>
                      {scopeWeight ? <span className="scope-weight-chip">Weight {scopeWeight}</span> : null}
                      <strong>{estimatePercent}%</strong>
                    </div>
                  </div>
                  <div
                    className="estimate-bar"
                    role="meter"
                    aria-label={`${area.name} estimated complete`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={estimatePercent}
                  >
                    <span style={{ width: `${estimatePercent}%` }} />
                  </div>
                  <p>{area.estimateRationale}</p>
                  {area.scopeWeightRationale ? <p className="scope-weight-rationale">{area.scopeWeightRationale}</p> : null}
                </div>

                <FunctionalityCompletedList items={area.completed} />
                <FunctionalityTextList title="Outstanding" items={area.outstanding} tone="outstanding" />
                <FunctionalityTextList title="Deferred / Watch List" items={area.deferred} tone="deferred" />
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState text="Functionality progress is not configured." />
      )}
    </section>
  );
}

function ProgressForecastPanel({ forecast }: { forecast?: FunctionalityProgressForecast }) {
  if (!forecast) {
    return null;
  }

  return (
    <div className="progress-forecast-panel">
      <div className="progress-forecast-metrics">
        <Metric label="Completed Slices" value={forecast.completedSliceCount} />
        <Metric label="Recent Slice Time" value={formatElapsedDuration(forecast.recentAverageActiveMsPerSlice)} detail="Average active duration" />
        <Metric label="Main Loop Cadence" value={formatElapsedDuration(forecast.averageCalendarMsPerSlice)} detail="Average finish-to-finish span" />
        <Metric label="Projected Finish" value={forecast.estimatedCompletionDate ? formatDate(forecast.estimatedCompletionDate) : "-"} detail={`${forecast.confidence} confidence`} />
      </div>
      <p>{forecast.explanation}</p>
    </div>
  );
}

function FunctionalityProgressHistoryChart({ history }: { history: FunctionalityProgressHistoryPoint[] }) {
  type ChartPoint = {
    point: FunctionalityProgressHistoryPoint;
    index: number;
    timestamp: number;
  };
  type ChartPointDetail = {
    snapshotNumber: number;
    measuredSnapshotNumber?: number;
    point: FunctionalityProgressHistoryPoint;
    timestamp: number;
    previous?: ChartPoint;
    next?: ChartPoint;
    deltaPercent?: number;
    elapsedMs?: number;
  };

  const [viewRange, setViewRange] = useState<{ start: number; end: number } | null>(null);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragCurrentX, setDragCurrentX] = useState<number | null>(null);
  const [hoveredCommit, setHoveredCommit] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const points = history
    .filter((point) => Number.isFinite(point.weightedAveragePercent))
    .map((point, index) => ({
      point,
      index,
      timestamp: new Date(point.snapshotCompletedAt ?? point.committedAt).getTime()
    }))
    .filter((point) => Number.isFinite(point.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp || left.index - right.index);
  if (points.length < 2) {
    return <EmptyState text="Progress history will appear after more committed progress snapshots are available." />;
  }

  const width = 720;
  const height = 220;
  const paddingLeft = 42;
  const paddingRight = 22;
  const paddingTop = 24;
  const paddingBottom = 36;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const fullFirst = points[0];
  const fullLatest = points[points.length - 1];
  const viewStart = viewRange?.start ?? fullFirst.timestamp;
  const viewEnd = viewRange?.end ?? fullLatest.timestamp;
  const visiblePoints = points.filter((point) => point.timestamp >= viewStart && point.timestamp <= viewEnd);
  const chartPoints = visiblePoints.length >= 2 ? visiblePoints : points;
  const first = chartPoints[0];
  const latest = chartPoints[chartPoints.length - 1];
  const firstTime = first.timestamp;
  const latestTime = latest.timestamp;
  const timeSpan = Math.max(1, latestTime - firstTime);
  const spansMultipleDays = new Date(firstTime).toDateString() !== new Date(latestTime).toDateString();
  const timeTicks = [0, 1, 2, 3].map((index) => firstTime + (timeSpan * index) / 3);
  const isZoomed = Boolean(viewRange);
  const timestampToX = (timestamp: number) => paddingLeft + ((timestamp - firstTime) / timeSpan) * chartWidth;
  const xToTimestamp = (x: number) => firstTime + ((x - paddingLeft) / chartWidth) * timeSpan;
  const clampChartX = (x: number) => Math.max(paddingLeft, Math.min(width - paddingRight, x));
  const coordinates = chartPoints.map(({ point, timestamp }) => {
    const x = timestampToX(timestamp);
    const y = paddingTop + (1 - Math.max(0, Math.min(100, point.weightedAveragePercent)) / 100) * chartHeight;
    return { point, x, y };
  });
  const firstMeasuredCoordinateIndex = coordinates.findIndex((coordinate) => coordinate.point.historyKind === "progress-snapshot");
  const preLedgerLinePoints =
    firstMeasuredCoordinateIndex > 0
      ? coordinates
          .slice(0, firstMeasuredCoordinateIndex + 1)
          .map((coordinate) => `${coordinate.x.toFixed(1)},${coordinate.y.toFixed(1)}`)
          .join(" ")
      : firstMeasuredCoordinateIndex === -1
        ? coordinates.map((coordinate) => `${coordinate.x.toFixed(1)},${coordinate.y.toFixed(1)}`).join(" ")
      : "";
  const measuredLinePoints =
    firstMeasuredCoordinateIndex >= 0
      ? coordinates
          .slice(firstMeasuredCoordinateIndex)
          .map((coordinate) => `${coordinate.x.toFixed(1)},${coordinate.y.toFixed(1)}`)
          .join(" ")
      : "";
  const selection =
    dragStartX !== null && dragCurrentX !== null
      ? {
          x: Math.min(dragStartX, dragCurrentX),
          width: Math.abs(dragCurrentX - dragStartX)
        }
      : null;
  const getPointDetail = (point: FunctionalityProgressHistoryPoint): ChartPointDetail => {
    const pointIndex = points.findIndex((item) => item.point.fullCommit === point.fullCommit);
    const current = points[pointIndex] as ChartPoint;
    const previous = pointIndex > 0 ? points[pointIndex - 1] : undefined;
    const next = pointIndex >= 0 && pointIndex < points.length - 1 ? points[pointIndex + 1] : undefined;
    const deltaPercent = previous ? point.weightedAveragePercent - previous.point.weightedAveragePercent : undefined;
    const elapsedMs = previous ? current.timestamp - previous.timestamp : undefined;
    return {
      snapshotNumber: pointIndex + 1,
      measuredSnapshotNumber: point.historyKind === "progress-snapshot" ? points.slice(0, pointIndex + 1).filter((item) => item.point.historyKind === "progress-snapshot").length : undefined,
      point,
      timestamp: current.timestamp,
      previous,
      next,
      deltaPercent,
      elapsedMs
    };
  };
  const hoveredCoordinate = hoveredCommit ? coordinates.find((coordinate) => coordinate.point.fullCommit === hoveredCommit) : undefined;
  const hoveredDetail = hoveredCoordinate ? getPointDetail(hoveredCoordinate.point) : undefined;
  const selectedPoint = selectedCommit ? points.find((item) => item.point.fullCommit === selectedCommit)?.point : undefined;
  const selectedDetail = selectedPoint ? getPointDetail(selectedPoint) : undefined;
  const zoomDelta = latest.point.weightedAveragePercent - first.point.weightedAveragePercent;
  const timelineAnchorCount = points.filter((point) => isTimelineAnchorPoint(point.point)).length;
  const historicalEstimateCount = points.filter((point) => isHistoricalEstimatePoint(point.point)).length;
  const measuredSnapshotCount = points.filter((point) => point.point.historyKind === "progress-snapshot").length;
  const visiblePointLabel = chartPoints.length === 1 ? "point" : "points";
  const fullPointLabel = points.length === 1 ? "point" : "points";
  const getDeltaContext = (detail: ChartPointDetail) => {
    if (!detail.previous) {
      return "first timeline point";
    }

    return isTimelineAnchorPoint(detail.previous.point) ? "since modernization start" : "since prior snapshot";
  };
  const selectedIsTimelineAnchor = selectedDetail ? isTimelineAnchorPoint(selectedDetail.point) : false;
  const selectedIsHistoricalEstimate = selectedDetail ? isHistoricalEstimatePoint(selectedDetail.point) : false;
  const selectedNarrative = selectedDetail ? getProgressHistoryNarrative(selectedDetail.point) : "";
  const selectedNarrativeOutcomes = selectedDetail?.point.narrativeOutcomes?.filter(Boolean) ?? [];

  const getSvgX = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * width;
    return clampChartX(relativeX);
  };
  const beginBrushZoom = (event: ReactPointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).classList?.contains("progress-history-point")) {
      return;
    }

    const x = getSvgX(event);
    setDragStartX(x);
    setDragCurrentX(x);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const updateBrushZoom = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragStartX === null) {
      return;
    }

    setDragCurrentX(getSvgX(event));
  };
  const completeBrushZoom = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragStartX === null || dragCurrentX === null) {
      return;
    }

    const startX = Math.min(dragStartX, dragCurrentX);
    const endX = Math.max(dragStartX, dragCurrentX);
    if (endX - startX >= 10) {
      const start = xToTimestamp(startX);
      const end = xToTimestamp(endX);
      const rangePoints = points.filter((point) => point.timestamp >= start && point.timestamp <= end);
      if (rangePoints.length >= 2) {
        setViewRange({ start, end });
        setSelectedCommit(null);
      }
    }

    setDragStartX(null);
    setDragCurrentX(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const cancelBrushZoom = () => {
    setDragStartX(null);
    setDragCurrentX(null);
  };

  return (
    <div className="progress-history-panel">
      <div className="progress-history-header">
        <div>
          <h3>
            <GitBranch size={17} />
            Weighted Completion History
          </h3>
          <p>
            {isZoomed ? `${chartPoints.length} of ${points.length}` : points.length} committed timeline {isZoomed ? visiblePointLabel : fullPointLabel} from {first.point.commit} through {latest.point.commit}; {measuredSnapshotCount} measured progress snapshots and {historicalEstimateCount} historical estimates.
          </p>
        </div>
        <div className="progress-history-latest">
          <span>{formatProgressPercent(latest.point.weightedAveragePercent)}</span>
          <strong>{latest.point.commit}</strong>
        </div>
      </div>
      <div className="progress-history-toolbar">
        {isZoomed ? (
          <button className="text-button" type="button" onClick={() => setViewRange(null)}>
            Reset zoom
          </button>
        ) : null}
        {selectedCommit ? (
          <button className="text-button" type="button" onClick={() => setSelectedCommit(null)}>
            Clear selection
          </button>
        ) : null}
        <span>
          {formatDate(first.point.snapshotCompletedAt ?? first.point.committedAt)} - {formatDate(latest.point.snapshotCompletedAt ?? latest.point.committedAt)}
        </span>
      </div>
      <div className="progress-history-chart-wrap">
        <svg
          className="progress-history-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Weighted modernization completion over committed progress snapshots"
          onPointerDown={beginBrushZoom}
          onPointerMove={updateBrushZoom}
          onPointerUp={completeBrushZoom}
          onPointerCancel={cancelBrushZoom}
          onPointerLeave={() => setHoveredCommit(null)}
        >
          {timeTicks.map((tick, index) => {
            const x = timestampToX(tick);
            return (
              <Fragment key={tick}>
                <line x1={x} x2={x} y1={paddingTop} y2={height - paddingBottom} className="chart-grid-line chart-grid-line-vertical" />
                <text
                  x={x}
                  y={height - 10}
                  className="chart-axis-label chart-axis-label-x"
                  textAnchor={index === 0 ? "start" : index === timeTicks.length - 1 ? "end" : "middle"}
                >
                  {formatHistoryAxisTick(tick, spansMultipleDays)}
                </text>
              </Fragment>
            );
          })}
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = paddingTop + (1 - tick / 100) * chartHeight;
            return (
              <Fragment key={tick}>
                <line x1={paddingLeft} x2={width - paddingRight} y1={y} y2={y} className="chart-grid-line" />
                <text x={paddingLeft - 10} y={y + 4} className="chart-axis-label" textAnchor="end">
                  {tick}%
                </text>
              </Fragment>
            );
          })}
          <rect x={paddingLeft} y={paddingTop} width={chartWidth} height={chartHeight} className="progress-history-plot-area" />
          {preLedgerLinePoints ? <polyline className="progress-history-line progress-history-line-pre-ledger" points={preLedgerLinePoints} /> : null}
          {measuredLinePoints ? <polyline className="progress-history-line" points={measuredLinePoints} /> : null}
          {selection ? <rect className="progress-history-brush" x={selection.x} y={paddingTop} width={selection.width} height={chartHeight} /> : null}
          {coordinates.map(({ point, x, y }) => {
            const isTimelineAnchor = isTimelineAnchorPoint(point);
            const isHistoricalEstimate = isHistoricalEstimatePoint(point);
            return (
              <circle
                className={`progress-history-point${isTimelineAnchor ? " timeline-anchor" : ""}${isHistoricalEstimate ? " historical-estimate" : ""}${selectedCommit === point.fullCommit ? " selected" : ""}`}
                key={point.fullCommit}
                cx={x}
                cy={y}
                r={selectedCommit === point.fullCommit ? 6 : isTimelineAnchor ? 5.5 : isHistoricalEstimate ? 4.8 : 4.5}
                role="button"
                tabIndex={0}
                aria-label={`Inspect ${isTimelineAnchor ? "timeline anchor " : isHistoricalEstimate ? "historical estimate " : ""}${point.commit}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedCommit(point.fullCommit);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedCommit(point.fullCommit);
                  }
                }}
                onPointerEnter={() => setHoveredCommit(point.fullCommit)}
                onPointerLeave={() => setHoveredCommit(null)}
                onFocus={() => setHoveredCommit(point.fullCommit)}
                onBlur={() => setHoveredCommit(null)}
              >
                <title>
                  {isTimelineAnchor
                    ? `${point.commit} timeline anchor at ${formatDate(point.snapshotCompletedAt ?? point.committedAt)} - ${point.subject}. Progress estimate not captured yet.`
                    : isHistoricalEstimate
                      ? `${point.commit} historical estimate ${formatProgressPercent(point.weightedAveragePercent)} at ${formatDate(point.snapshotCompletedAt ?? point.committedAt)} - ${point.subject}`
                    : `${point.commit} ${formatProgressPercent(point.weightedAveragePercent)} at ${formatDate(point.snapshotCompletedAt ?? point.committedAt)} - ${point.subject}`}
                </title>
              </circle>
            );
          })}
        </svg>
        {hoveredDetail && hoveredCoordinate ? (
          <div
            className="progress-history-tooltip"
            style={{
              left: `${(hoveredCoordinate.x / width) * 100}%`,
              top: `${(hoveredCoordinate.y / height) * 100}%`
            }}
          >
            <strong>{hoveredDetail.point.commit}</strong>
            <span className="progress-history-tooltip-title">{hoveredDetail.point.narrativeTitle ?? hoveredDetail.point.subject}</span>
            {isTimelineAnchorPoint(hoveredDetail.point) ? (
              <>
                <span>Timeline anchor</span>
                <span>No progress estimate captured yet</span>
              </>
            ) : isHistoricalEstimatePoint(hoveredDetail.point) ? (
              <>
                <span>Historical estimate</span>
                <span>{formatProgressPercent(hoveredDetail.point.weightedAveragePercent)} complete</span>
                <span>{formatProgressDelta(hoveredDetail.deltaPercent)} {getDeltaContext(hoveredDetail)}</span>
              </>
            ) : (
              <>
                <span>{formatProgressPercent(hoveredDetail.point.weightedAveragePercent)} complete</span>
                <span>{formatProgressDelta(hoveredDetail.deltaPercent)} {getDeltaContext(hoveredDetail)}</span>
              </>
            )}
            <span>{hoveredDetail.previous ? `${formatElapsedDuration(hoveredDetail.elapsedMs)} since prior point` : "First modernized-app check-in"}</span>
            <span>{formatDate(hoveredDetail.point.snapshotCompletedAt ?? hoveredDetail.point.committedAt)}</span>
            {getProgressHistoryNarrative(hoveredDetail.point) ? (
              <span className="progress-history-tooltip-summary">{truncateText(getProgressHistoryNarrative(hoveredDetail.point), 190)}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      {isZoomed ? (
        <div className="progress-history-zoom-summary">
          <span>{formatProgressDelta(zoomDelta)} in view</span>
          <span>{formatElapsedDuration(latestTime - firstTime)} span</span>
          <span>{chartPoints.length} {visiblePointLabel}</span>
        </div>
      ) : null}
      <div className="progress-history-caption">
        <span>{formatDate(first.point.snapshotCompletedAt ?? first.point.committedAt)}</span>
        <span>{formatElapsedDuration(latestTime - firstTime)} span</span>
        <span>{formatDate(latest.point.snapshotCompletedAt ?? latest.point.committedAt)}</span>
      </div>
      {selectedDetail ? (
        <div className="progress-history-inspector">
          <div>
            <div className="section-kicker">{selectedIsTimelineAnchor ? "Timeline anchor" : selectedIsHistoricalEstimate ? "Historical estimate" : "Selected snapshot"}</div>
            <h4>{selectedDetail.point.subject}</h4>
            {selectedIsTimelineAnchor ? (
              <p>
                First committed modernized application check-in at {formatDate(selectedDetail.point.snapshotCompletedAt ?? selectedDetail.point.committedAt)}. Progress estimates were not captured yet, so the chart plots this as a 0% timeline anchor.
              </p>
            ) : selectedIsHistoricalEstimate ? (
              <p>
                Historical completion estimate for a pre-ledger check-in completed at {formatDate(selectedDetail.point.snapshotCompletedAt ?? selectedDetail.point.committedAt)}. This value is stored in the historical backfill file and calibrated to the first explicit progress-ledger estimate.
              </p>
            ) : (
              <p>
                Snapshot {selectedDetail.measuredSnapshotNumber} of {measuredSnapshotCount} completed at {formatDate(selectedDetail.point.snapshotCompletedAt ?? selectedDetail.point.committedAt)}.
              </p>
            )}
          </div>
          <div className="progress-history-narrative">
            <div className="section-kicker">What changed</div>
            <strong>{selectedDetail.point.narrativeTitle ?? selectedDetail.point.subject}</strong>
            <p>{selectedNarrative || "No additional narrative was found beyond the Git commit subject."}</p>
            <span>{getProgressHistoryNarrativeSource(selectedDetail.point)}</span>
            {selectedDetail.point.commitMessageBody && selectedDetail.point.commitMessageBody !== selectedNarrative ? (
              <div className="progress-history-commit-notes">
                <strong>Commit notes</strong>
                <p>{selectedDetail.point.commitMessageBody}</p>
              </div>
            ) : null}
            {selectedIsHistoricalEstimate && selectedDetail.point.estimateRationale ? (
              <div className="progress-history-commit-notes">
                <strong>Estimate rationale</strong>
                <p>{selectedDetail.point.estimateRationale}</p>
              </div>
            ) : null}
            {selectedNarrativeOutcomes.length ? (
              <ul>
                {selectedNarrativeOutcomes.slice(0, 5).map((outcome) => (
                  <li key={outcome}>{outcome}</li>
                ))}
              </ul>
            ) : null}
            {selectedNarrativeOutcomes.length > 5 ? <span>{selectedNarrativeOutcomes.length - 5} more outcomes in the changelog.</span> : null}
          </div>
          <div className="progress-history-inspector-grid">
            <Metric label="Commit" value={selectedDetail.point.commit} detail={selectedDetail.point.fullCommit.slice(0, 12)} />
            {selectedIsTimelineAnchor ? (
              <>
                <Metric label="Timeline Role" value="Modernized app start" detail="First commit touching modernized-openemr" />
                <Metric label="Progress Estimate" value="Not captured" detail="Plotted at 0% as an anchor" />
                <Metric
                  label="Next Measured Point"
                  value={selectedDetail.next?.point.commit ?? "-"}
                  detail={selectedDetail.next ? `${formatElapsedDuration(selectedDetail.next.timestamp - selectedDetail.timestamp)} later` : "No later progress snapshot"}
                />
              </>
            ) : selectedIsHistoricalEstimate ? (
              <>
                <Metric label="Weighted Complete" value={formatProgressPercent(selectedDetail.point.weightedAveragePercent)} detail={`${formatScopePoints(selectedDetail.point.weightedCompletedPoints)} estimated points`} />
                <Metric label="Change" value={formatProgressDelta(selectedDetail.deltaPercent)} detail={getDeltaContext(selectedDetail)} />
                <Metric label="Elapsed Since Prior" value={formatElapsedDuration(selectedDetail.elapsedMs)} detail={selectedDetail.previous?.point.commit ?? "First timeline point"} />
                <Metric label="Estimate Source" value={formatEstimateBasis(selectedDetail.point.estimateBasis)} detail="functionality-progress-backfill.json" />
                <Metric label="Remaining" value={formatProgressPercent(selectedDetail.point.estimatedRemainingPercent)} detail={`${formatScopePoints(selectedDetail.point.weightedRemainingPoints)} estimated points`} />
              </>
            ) : (
              <>
                <Metric label="Weighted Complete" value={formatProgressPercent(selectedDetail.point.weightedAveragePercent)} detail={`${formatScopePoints(selectedDetail.point.weightedCompletedPoints)} weighted points`} />
                <Metric label="Change" value={formatProgressDelta(selectedDetail.deltaPercent)} detail={getDeltaContext(selectedDetail)} />
                <Metric label="Elapsed Since Prior" value={formatElapsedDuration(selectedDetail.elapsedMs)} detail={selectedDetail.previous?.point.commit ?? "First snapshot"} />
                <Metric label="Remaining" value={formatProgressPercent(selectedDetail.point.estimatedRemainingPercent)} detail={`${formatScopePoints(selectedDetail.point.weightedRemainingPoints)} weighted points`} />
                <Metric label="Simple Average" value={formatProgressPercent(selectedDetail.point.simpleAveragePercent)} detail="Unweighted signal" />
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
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
  functionalityLastUpdated,
  functionalitySummary,
  functionalityHistory,
  functionalityForecast
}: {
  slices: ProgressSlice[];
  functionalityAreas: FunctionalityProgressArea[];
  functionalityVersion?: string;
  functionalityLastUpdated?: string;
  functionalitySummary?: FunctionalityProgressSummary;
  functionalityHistory: FunctionalityProgressHistoryPoint[];
  functionalityForecast?: FunctionalityProgressForecast;
}) {
  return (
    <div className="page-stack">
      <ProgressPanel slices={slices} />
      <FunctionalityProgressPanel
        areas={functionalityAreas}
        version={functionalityVersion}
        lastUpdated={functionalityLastUpdated}
        summary={functionalitySummary}
        history={functionalityHistory}
        forecast={functionalityForecast}
      />
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

function findSourceInventory(architecture: ArchitectureModel, systemId: string) {
  return architecture.sourceInventory.systems.find((system) => system.systemId === systemId);
}

function SourceInventoryOverview({ architecture }: { architecture: ArchitectureModel }) {
  const inventory = architecture.sourceInventory;
  const inventorySystems = architecture.systems
    .map((system) => ({ system, inventory: findSourceInventory(architecture, system.id) }))
    .filter((item): item is { system: ArchitectureSystem; inventory: SourceInventorySystem } => Boolean(item.inventory));
  const totalLines = inventorySystems.reduce((total, item) => total + item.inventory.totals.totalLines, 0);
  const totalFiles = inventorySystems.reduce((total, item) => total + item.inventory.totals.files, 0);

  return (
    <section className="panel architecture-panel">
      <div className="panel-header">
        <div>
          <div className="section-kicker">Source inventory</div>
          <h2>
            <Database size={20} />
            Architecture Size
          </h2>
          <p>{inventory.method}</p>
        </div>
        <div className="panel-status">
          <span className="quiet-chip">v{inventory.version}</span>
          {inventory.generatedAt ? <span className="quiet-chip">Generated {formatDate(inventory.generatedAt)}</span> : null}
        </div>
      </div>

      {inventorySystems.length ? (
        <>
          <div className="source-inventory-metrics">
            <Metric label="Tracked Systems" value={inventorySystems.length} />
            <Metric label="Tracked Files" value={formatCount(totalFiles)} />
            <Metric label="Physical Lines" value={formatCount(totalLines)} detail="Includes comments and blank lines" />
            <Metric label="Non-Blank Lines" value={formatCount(inventorySystems.reduce((total, item) => total + item.inventory.totals.nonBlankLines, 0))} />
          </div>

          <div className="source-inventory-system-grid">
            {inventorySystems.map(({ system, inventory: systemInventory }) => (
              <div className="source-inventory-system" key={system.id}>
                <div className="source-inventory-system-header">
                  <div>
                    <strong>{system.name}</strong>
                    <p>{systemInventory.summary}</p>
                  </div>
                  <span>{formatCount(systemInventory.totals.totalLines)} lines</span>
                </div>
                <div className="source-inventory-stat-row">
                  <span>{formatCount(systemInventory.totals.files)} files</span>
                  <span>{formatCount(systemInventory.totals.nonBlankLines)} non-blank</span>
                  <span>{systemInventory.components.length} components</span>
                </div>
                <div className="source-inventory-mini-list">
                  {systemInventory.components.slice(0, 4).map((component) => (
                    <div key={component.id}>
                      <span>{component.label}</span>
                      <strong>{formatCount(component.totalLines)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState text="Source inventory is not available." />
      )}

      {inventory.warnings.length ? <SourceInventoryWarnings warnings={inventory.warnings} /> : null}
    </section>
  );
}

function SourceInventoryWarnings({ warnings }: { warnings: string[] }) {
  return (
    <div className="source-inventory-warnings">
      {warnings.slice(0, 3).map((warning) => (
        <span key={warning}>{warning}</span>
      ))}
    </div>
  );
}

function SourceInventoryDetail({ inventory }: { inventory?: SourceInventorySystem }) {
  if (!inventory) {
    return (
      <section className="panel architecture-panel">
        <EmptyState text="Source inventory is not configured for this system." />
      </section>
    );
  }

  return (
    <section className="panel architecture-panel">
      <div className="panel-header">
        <div>
          <div className="section-kicker">Source inventory</div>
          <h2>
            <Database size={20} />
            Code And Schema Scale
          </h2>
          <p>{inventory.summary}</p>
        </div>
      </div>

      <div className="source-inventory-metrics">
        <Metric label="Tracked Files" value={formatCount(inventory.totals.files)} />
        <Metric label="Physical Lines" value={formatCount(inventory.totals.totalLines)} detail="Includes comments and blank lines" />
        <Metric label="Non-Blank Lines" value={formatCount(inventory.totals.nonBlankLines)} />
        <Metric label="Blank Lines" value={formatCount(inventory.totals.blankLines)} />
      </div>

      <div className="source-component-grid">
        {inventory.components.map((component) => (
          <div className="source-component-card" key={component.id}>
            <div className="source-component-heading">
              <div>
                <span>{component.layer}</span>
                <strong>{component.label}</strong>
              </div>
              <strong>{formatCount(component.totalLines)}</strong>
            </div>
            <p>{component.description}</p>
            <div className="source-inventory-stat-row">
              <span>{formatCount(component.files)} files</span>
              <span>{formatCount(component.nonBlankLines)} non-blank</span>
              <span>{formatCount(component.blankLines)} blank</span>
            </div>
            {component.samplePaths.length ? (
              <div className="source-path-list">
                {component.samplePaths.map((samplePath) => (
                  <code key={samplePath}>{samplePath}</code>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {inventory.metrics.length ? (
        <div className="source-schema-metrics">
          <h3>Data Store Signals</h3>
          <div className="source-schema-grid">
            {inventory.metrics.map((metric) => (
              <div className="source-schema-metric" key={metric.id}>
                <span>{metric.label}</span>
                <strong>{formatCount(metric.value)}</strong>
                <p>{metric.detail}</p>
                <small>{formatCount(metric.files)} scanned files</small>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {inventory.warnings.length ? <SourceInventoryWarnings warnings={inventory.warnings} /> : null}
    </section>
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

      <SourceInventoryOverview architecture={architecture} />

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

function ArchitectureSystemDetail({ system, sourceInventory }: { system: ArchitectureSystem; sourceInventory?: SourceInventorySystem }) {
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

      <SourceInventoryDetail inventory={sourceInventory} />

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
      <div role="tabpanel">
        {activeTab === "overview" ? (
          <ArchitectureOverview architecture={architecture} />
        ) : activeSystem ? (
          <ArchitectureSystemDetail system={activeSystem} sourceInventory={findSourceInventory(architecture, activeSystem.id)} />
        ) : (
          <ArchitectureOverview architecture={architecture} />
        )}
      </div>
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
              const timelineDate = entry.timelineDate ?? entry.date;
              const timelineDateLabel = `${formatTimelineDateSource(entry.timelineDateSource)} ${formatDateOnly(timelineDate)}`;

              return (
                <article className="changelog-entry" key={`${entry.date}-${entry.id}`}>
                  <div className="changelog-marker">
                    <span>{entry.id}</span>
                  </div>
                  <div className="changelog-content">
                    <div className="changelog-entry-header">
                      <div>
                        <time className="changelog-date" dateTime={timelineDate} title={getTimelineDateTitle(entry)}>
                          {timelineDateLabel}
                        </time>
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
  const parityAppIds = new Set([
    ...(parityManifest?.suites.flatMap((suite) => suite.targets) ?? []),
    ...(parityManifest?.plans.flatMap((plan) => plan.targets) ?? [])
  ]);
  const visibleApps = apps.filter((app) => app.tests.length > 0 || parityAppIds.has(app.id));

  return (
    <div className="page-stack">
      <ParityComparisonPanel comparisons={parityComparisons} />
      {visibleApps.length ? (
        visibleApps.map((app) => {
          const busyForApp = busy?.appId === app.id;
          const supportsCustomParity = parityAppIds.has(app.id);
          return (
            <Fragment key={app.id}>
              {supportsCustomParity ? (
                <CustomParityRunPanel app={app} busy={busy} parityManifest={parityManifest} onRunCustomParity={(request) => onRunCustomParity(app.id, request)} />
              ) : null}
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
          <EmptyState text={apps.length ? "No managed test actions are configured." : "Managed application data is loading."} />
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

                <div className="comparison-side-grid">
                  <ComparisonVisualEvidence side={comparison.left} />
                  <ComparisonVisualEvidence side={comparison.right} />
                </div>

                <div className="evidence-metrics">
                  <span>{comparison.differenceCount} differences</span>
                  {comparison.differenceCount ? (
                    <>
                      <span>{comparison.acceptance.acceptedCount} accepted</span>
                      <span>{comparison.acceptance.unacceptedCount} unreviewed</span>
                    </>
                  ) : null}
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
                    {comparison.differences.slice(0, 3).map((difference, index) => {
                      const acceptance = getDifferenceAcceptance(comparison, index);
                      return (
                        <li key={`${comparison.comparisonId}-difference-${index}`}>
                          <span>{formatComparisonDifference(difference)}</span>
                          {acceptance?.accepted ? <span className="accepted-difference-chip">Accepted</span> : <span className="unaccepted-difference-chip">Unreviewed</span>}
                        </li>
                      );
                    })}
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
            {comparison.differences.map((difference, index) => {
              const acceptance = getDifferenceAcceptance(comparison, index);
              return (
                <li key={`${comparison.comparisonId}-detail-difference-${index}`}>
                  <div className="comparison-difference-row">
                    <span>{formatComparisonDifference(difference)}</span>
                    {acceptance?.accepted ? <span className="accepted-difference-chip">Accepted</span> : <span className="unaccepted-difference-chip">Unreviewed</span>}
                  </div>
                  {acceptance?.reasons.length ? <small>{acceptance.reasons.join("; ")}</small> : null}
                  {acceptance?.acceptedDifferenceIds.length ? <code>{acceptance.acceptedDifferenceIds.join(", ")}</code> : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="comparison-match-note">Legacy and modernized artifacts match for this selection.</div>
        )}
      </div>
      <div className="comparison-detail-block">
        <span>Acceptance</span>
        {comparison.differenceCount ? (
          <div className={comparison.acceptance.unacceptedCount ? "comparison-acceptance-warning" : "comparison-acceptance-ok"}>
            {comparison.acceptance.acceptedCount} accepted / {comparison.acceptance.unacceptedCount} unreviewed
            {comparison.acceptance.acceptedDifferenceIds.length ? <code>{comparison.acceptance.acceptedDifferenceIds.join(", ")}</code> : null}
          </div>
        ) : (
          <div className="comparison-match-note">No accepted differences needed.</div>
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
      <ComparisonReportLinks side={side} />
      <ComparisonVisualEvidence side={side} detailed />
      <ComparisonProbeDetails side={side} />
    </div>
  );
}

function ComparisonProbeDetails({ side }: { side: ParityComparisonReport["left"] }) {
  const probeDetails = side.probeDetails ?? [];

  if (!probeDetails.length) {
    return <small>No normalized probe details recorded for this run.</small>;
  }

  return (
    <div className="comparison-probes" aria-label={`${side.target} normalized probe details`}>
      <div className="comparison-probes-header">
        <span>Normalized probes</span>
        <strong>{probeDetails.length}</strong>
      </div>
      <ol>
        {probeDetails.map((probe, index) => (
          <li key={`${side.runId}-${probe.file}-${probe.line}-${probe.title}-${index}`}>
            <div className="comparison-probe-title">
              <strong>{probe.title}</strong>
              <StatusPill state={probe.status === "expected" ? "healthy" : probe.status} label={formatProbeStatus(probe.status)} />
            </div>
            <div className="comparison-probe-meta">
              <span>{probe.project || "project"}</span>
              <span>{formatDuration(probe.durationMs)}</span>
              <span>{probe.attachmentCount} attachments</span>
            </div>
            <code>{probe.file}{probe.line ? `:${probe.line}` : ""}</code>
            {probe.tags.length ? <small>{probe.tags.map((tag) => `@${tag}`).join(" ")}</small> : null}
            {probe.errorMessages.length ? (
              <ul>
                {probe.errorMessages.map((message, errorIndex) => (
                  <li key={`${side.runId}-${probe.title}-error-${errorIndex}`}>{message}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ComparisonVisualEvidence({ side, detailed = false }: { side: ParityComparisonReport["left"]; detailed?: boolean }) {
  const visualArtifacts = side.visualArtifacts ?? [];

  if (!visualArtifacts.length) {
    return detailed ? <small>No screenshot artifacts recorded for this run.</small> : <div className="comparison-visual-empty">No screenshots</div>;
  }

  return (
    <div className={detailed ? "comparison-visuals detailed" : "comparison-visuals"} aria-label={`${side.target} screenshot artifacts`}>
      <div className="comparison-visuals-header">
        <span>{detailed ? "Screenshot artifacts" : side.target}</span>
        <strong>{visualArtifacts.length}</strong>
      </div>
      <div className="comparison-thumbnail-grid">
        {visualArtifacts.slice(0, detailed ? 8 : 3).map((artifact) => (
          <a
            href={`/api/artifacts/file?path=${encodeURIComponent(artifact.path)}`}
            key={`${side.runId}-${artifact.path}`}
            target="_blank"
            rel="noreferrer"
            title={`Open ${side.target} ${artifact.name}`}
            aria-label={`Open ${side.target} ${artifact.name}`}
          >
            <img src={`/api/artifacts/file?path=${encodeURIComponent(artifact.path)}`} alt={`${side.target} ${artifact.kind}`} loading="lazy" />
            {detailed ? (
              <span>
                <strong>{formatVisualArtifactKind(artifact.kind)}</strong>
                <small>{formatBytes(artifact.sizeBytes)}</small>
              </span>
            ) : null}
          </a>
        ))}
      </div>
    </div>
  );
}

function ComparisonReportLinks({ side }: { side: ParityComparisonReport["left"] }) {
  const reports = side.reports ?? { runJson: "", playwrightJson: "", junit: "", html: "" };
  const links = [
    { label: "Run JSON", path: reports.runJson || side.path },
    { label: "Playwright JSON", path: reports.playwrightJson },
    { label: "JUnit XML", path: reports.junit },
    { label: "HTML Report", path: reports.html }
  ].filter((item) => Boolean(item.path));

  if (!links.length) {
    return null;
  }

  return (
    <div className="comparison-report-links" aria-label={`${side.target} evidence links`}>
      {links.map((link) => (
        <a
          href={`/api/artifacts/file?path=${encodeURIComponent(link.path)}`}
          key={`${side.runId}-${link.label}`}
          target="_blank"
          rel="noreferrer"
          title={`Open ${side.target} ${link.label}`}
          aria-label={`Open ${side.target} ${link.label}`}
        >
          <ExternalLink size={13} />
          <span>{link.label}</span>
        </a>
      ))}
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
      <span>{side.probeDetails?.length ?? 0} probes</span>
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

function getDifferenceAcceptance(comparison: ParityComparisonReport, index: number) {
  return comparison.acceptance?.differenceAcceptances.find((acceptance) => acceptance.differenceIndex === index) ?? null;
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  if (value < 1024) {
    return `${Math.round(value)} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatVisualArtifactKind(kind: string) {
  if (kind === "test-screenshot") {
    return "Test screenshot";
  }
  if (kind === "html-report-image") {
    return "HTML report image";
  }
  return "Image artifact";
}

function formatProbeStatus(status: string) {
  if (status === "expected") {
    return "passed";
  }
  return status || "unknown";
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
  apps,
  legacyApp,
  modernizedApp,
  busy,
  onAction,
  onStartAll,
  onRunTest,
  onRunSeed,
  onLoadLogs,
  seedDatasets,
  logs,
  progress,
  events,
  changelog
}: {
  apps: AppSnapshot[];
  legacyApp?: AppSnapshot;
  modernizedApp?: AppSnapshot;
  busy: BusyState;
  onAction: (appId: string, action: "start" | "stop" | "restart") => void;
  onStartAll: () => void;
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
      <RuntimeReadinessBanner
        apps={apps}
        busy={busy}
        onAction={onAction}
        onStartAll={onStartAll}
      />
      {legacyApp ? (
        <LegacyAppPanel app={legacyApp} busy={busy} onAction={(action) => onAction(legacyApp.id, action)} onRunTest={onRunTest} onRunSeed={onRunSeed} onLoadLogs={onLoadLogs} seedDatasets={seedDatasets} logs={logs} />
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
  onStartAll,
  onRunTest,
  onRunSeed,
  onLoadLogs,
  seedDatasets,
  logs,
  progress,
  functionalityAreas,
  functionalityVersion,
  functionalityLastUpdated,
  functionalitySummary,
  functionalityHistory,
  functionalityForecast,
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
  onStartAll: () => void;
  onRunTest: (appId: string, testId: string) => void;
  onRunSeed: (appId: string, seedId: string) => void;
  onLoadLogs: (appId: string) => void;
  seedDatasets: SeedDataset[];
  logs: Record<string, string>;
  progress: ProgressSlice[];
  functionalityAreas: FunctionalityProgressArea[];
  functionalityVersion?: string;
  functionalityLastUpdated?: string;
  functionalitySummary?: FunctionalityProgressSummary;
  functionalityHistory: FunctionalityProgressHistoryPoint[];
  functionalityForecast?: FunctionalityProgressForecast;
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
    return (
      <ProgressPage
        slices={progress}
        functionalityAreas={functionalityAreas}
        functionalityVersion={functionalityVersion}
        functionalityLastUpdated={functionalityLastUpdated}
        functionalitySummary={functionalitySummary}
        functionalityHistory={functionalityHistory}
        functionalityForecast={functionalityForecast}
      />
    );
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
        <RuntimeReadinessBanner apps={apps} busy={busy} onAction={onAction} onStartAll={onStartAll} />
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
      apps={apps}
      legacyApp={legacyApp}
      modernizedApp={modernizedApp}
      busy={busy}
      onAction={onAction}
      onStartAll={onStartAll}
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
  const [functionalitySummary, setFunctionalitySummary] = useState<FunctionalityProgressSummary | undefined>();
  const [functionalityHistory, setFunctionalityHistory] = useState<FunctionalityProgressHistoryPoint[]>([]);
  const [functionalityForecast, setFunctionalityForecast] = useState<FunctionalityProgressForecast | undefined>();
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
    setFunctionalitySummary(progressData.functionalitySummary);
    setFunctionalityHistory(progressData.functionalityHistory);
    setFunctionalityForecast(progressData.functionalityForecast);
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

  const handleStartAllApps = () => {
    void runWithBusy(allAppsBusyId, "starting all apps", async () => {
      const response = await api.startAllApps();
      setApps(response.apps);
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
          onStartAll={handleStartAllApps}
          onRunTest={handleRunTest}
          onRunSeed={handleRunSeed}
          onLoadLogs={handleLoadLogs}
          seedDatasets={seedDatasets}
          logs={logs}
          progress={progress}
          functionalityAreas={functionalityAreas}
          functionalityVersion={functionalityVersion}
          functionalityLastUpdated={functionalityLastUpdated}
          functionalitySummary={functionalitySummary}
          functionalityHistory={functionalityHistory}
          functionalityForecast={functionalityForecast}
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
