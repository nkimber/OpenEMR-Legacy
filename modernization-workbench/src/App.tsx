import {
  Activity,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
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
  Sprout,
  Square,
  Terminal,
  TestTube2,
  XCircle
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { AppSnapshot, ArchitectureSystem, LifecycleEvent, ProgressSlice, RuntimeState, SeedDataset } from "./types";

type BusyState = {
  appId: string;
  label: string;
} | null;

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

function formatDuration(ms?: number) {
  if (ms === undefined || Number.isNaN(ms)) {
    return "-";
  }
  if (ms < 1000) {
    return `${ms} ms`;
  }
  return `${(ms / 1000).toFixed(1)} s`;
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
  children: React.ReactNode;
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

function AppHeader({
  onRefresh,
  busy,
  refreshedAt
}: {
  onRefresh: () => void;
  busy: BusyState;
  refreshedAt?: string;
}) {
  return (
    <header className="app-header">
      <div>
        <div className="eyebrow">OpenEMR Modernization</div>
        <h1>Modernization Workbench</h1>
      </div>
      <div className="header-actions">
        {busy ? <span className="busy-chip">{busy.label}</span> : <span className="quiet-chip">Idle</span>}
        <span className="last-refresh">Updated {formatDate(refreshedAt)}</span>
        <IconButton title="Refresh dashboard" onClick={onRefresh} disabled={!!busy}>
          <RefreshCw size={18} />
        </IconButton>
      </div>
    </header>
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
  const patientCount = app.dataProfile.rows.find((row) => row.tableName === "patient_data")?.rowCount ?? 0;
  const encounterCount = app.dataProfile.rows.find((row) => row.tableName === "form_encounter")?.rowCount ?? 0;
  const appointmentCount = app.dataProfile.rows.find((row) => row.tableName === "openemr_postcalendar_events")?.rowCount ?? 0;
  const managedSeed = app.seeds[0];
  const seedDataset = seedDatasets.find((dataset) => dataset.id === managedSeed?.datasetId);
  const patientTarget = seedDataset?.recordTargets.find((target) => target.name === "patients")?.target ?? seedDataset?.targetPatientCount;
  const latestSeedDetail = app.latestSeed
    ? `${app.latestSeed.mode ?? "seeded"} ${app.latestSeed.expectedPatients} starter patients`
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

      <div className="control-strip" aria-label="Legacy OpenEMR controls">
        <IconButton title="Start Legacy OpenEMR" variant="primary" onClick={() => onAction("start")} disabled={busyForApp}>
          <Power size={18} />
        </IconButton>
        <IconButton title="Stop Legacy OpenEMR" variant="danger" onClick={() => onAction("stop")} disabled={busyForApp}>
          <Square size={18} />
        </IconButton>
        <IconButton title="Restart Legacy OpenEMR" onClick={() => onAction("restart")} disabled={busyForApp}>
          <RotateCw size={18} />
        </IconButton>
        <IconButton
          title="Run baseline smoke test"
          onClick={() => onRunTest(app.tests[0]?.id ?? "smoke")}
          disabled={busyForApp || app.tests.length === 0}
        >
          <Play size={18} />
        </IconButton>
        <IconButton
          title={managedSeed ? `Seed ${managedSeed.name}` : "Seed data unavailable"}
          onClick={() => onRunSeed(managedSeed?.id ?? "")}
          disabled={busyForApp || !managedSeed}
        >
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
      </div>

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

function ArchitecturePanel({ systems }: { systems: ArchitectureSystem[] }) {
  return (
    <section className="panel architecture-panel">
      <div className="panel-header compact">
        <h2>
          <Layers size={20} />
          Technical Architecture
        </h2>
      </div>
      <div className="architecture-grid">
        {systems.map((system) => (
          <div className="architecture-item" key={system.id}>
            <div className="architecture-title">
              <strong>{system.name}</strong>
              <span>{system.status}</span>
            </div>
            <dl>
              <dt>Stack</dt>
              <dd>{system.stack.join(", ")}</dd>
              <dt>Database</dt>
              <dd>{system.database}</dd>
              <dt>Business logic</dt>
              <dd>{system.businessLogic}</dd>
              <dt>Tests</dt>
              <dd>{system.tests.join(", ")}</dd>
            </dl>
          </div>
        ))}
      </div>
    </section>
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

export function App() {
  const [apps, setApps] = useState<AppSnapshot[]>([]);
  const [architecture, setArchitecture] = useState<ArchitectureSystem[]>([]);
  const [progress, setProgress] = useState<ProgressSlice[]>([]);
  const [seedDatasets, setSeedDatasets] = useState<SeedDataset[]>([]);
  const [events, setEvents] = useState<LifecycleEvent[]>([]);
  const [logs, setLogs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<BusyState>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshedAt = apps[0]?.refreshedAt;

  const loadDashboard = useCallback(async () => {
    setError(null);
    const [appData, architectureData, progressData, eventData, seedData] = await Promise.all([
      api.getApps(),
      api.getArchitecture(),
      api.getProgress(),
      api.getEvents(),
      api.getSeedDatasets()
    ]);
    setApps(appData.apps);
    setArchitecture(architectureData.systems);
    setProgress(progressData.slices);
    setEvents(eventData.events);
    setSeedDatasets(seedData.datasets);
  }, []);

  useEffect(() => {
    loadDashboard().catch((loadError) => setError(loadError instanceof Error ? loadError.message : String(loadError)));
    const timer = window.setInterval(() => {
      loadDashboard().catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  const legacyApp = useMemo(() => apps.find((app) => app.id === "legacy-openemr"), [apps]);

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

  const handleRunSeed = (appId: string, seedId: string) => {
    void runWithBusy(appId, `seeding ${seedId}`, async () => {
      const response = await api.runSeed(appId, seedId);
      setApps((current) => current.map((item) => (item.id === appId ? response.snapshot : item)));
    });
  };

  const handleLoadLogs = (appId: string) => {
    void runWithBusy(appId, `loading logs`, async () => {
      const response = await api.getLogs(appId);
      setLogs((current) => ({
        ...current,
        [appId]: [response.result.stdout, response.result.stderr].filter(Boolean).join("\n")
      }));
    });
  };

  return (
    <main className="workbench-shell">
      <AppHeader
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
            <span>Not started</span>
          </div>
        </div>
        <div className="overview-item">
          <FileText size={21} />
          <div>
            <strong>Seed data</strong>
            <span>{legacyApp?.dataProfile.rows.find((row) => row.tableName === "patient_data")?.rowCount ? "Present" : "Not ready"}</span>
          </div>
        </div>
      </section>

      {legacyApp ? (
        <LegacyAppPanel
          app={legacyApp}
          busy={busy}
          onAction={(action) => handleAction(legacyApp.id, action)}
          onRunTest={(testId) => handleRunTest(legacyApp.id, testId)}
          onRunSeed={(seedId) => handleRunSeed(legacyApp.id, seedId)}
          onLoadLogs={() => handleLoadLogs(legacyApp.id)}
          seedDatasets={seedDatasets}
          logs={logs[legacyApp.id] ?? ""}
        />
      ) : (
        <section className="panel">
          <EmptyState text="Loading managed applications." />
        </section>
      )}

      <div className="lower-grid">
        <ProgressPanel slices={progress} />
        <EventsPanel events={events} />
      </div>

      <ArchitecturePanel systems={architecture} />
    </main>
  );
}
