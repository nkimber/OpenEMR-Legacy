import cors from "cors";
import express from "express";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

type CommandName = string;

type CommandResult = {
  command: string[];
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};

type ManagedTest = {
  id: string;
  name: string;
  description: string;
  layer: string;
  commandName: CommandName;
  resultPath: string;
};

type ManagedSeed = {
  id: string;
  datasetId: string;
  name: string;
  description: string;
  commandName: CommandName;
  resultPath: string;
};

type ManagedApp = {
  id: string;
  name: string;
  stage: string;
  description: string;
  kind: string;
  workingDirectory: string;
  publicUrl: string;
  healthUrl: string;
  documentationPath: string;
  sourcePath: string;
  expectedSourceTag: string;
  commands: Record<string, string[]>;
  services: string[];
  seeds: ManagedSeed[];
  tests: ManagedTest[];
};

type ContainerStatus = {
  name: string;
  service: string;
  image: string;
  state: string;
  health: string;
  status: string;
  ports: string;
};

type DemoLogin = {
  available: boolean;
  username?: string;
  password?: string;
  source: string;
  error?: string;
};

type LifecycleEvent = {
  id: string;
  appId: string;
  type: string;
  status: "succeeded" | "failed";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  summary: string;
  stdoutPreview: string;
  stderrPreview: string;
};

type AppConfig = {
  apps: ManagedApp[];
};

type SeedDataManifest = {
  datasets: unknown[];
};

type ChangelogEntry = {
  id: string;
  title: string;
  date: string;
  commit: string;
  summary: string;
  keyOutcomes: string[];
  primaryFiles: string[];
  metrics: { label: string; value: string }[];
};

type ProjectChangelog = {
  sourcePath: string;
  updatedAt: string;
  totalEntries: number;
  entries: ChangelogEntry[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workbenchRoot = path.resolve(__dirname, "..");
const repoRoot = process.env.WORKBENCH_REPO_ROOT
  ? path.resolve(process.env.WORKBENCH_REPO_ROOT)
  : path.resolve(workbenchRoot, "..");
const configPath = path.join(workbenchRoot, "config", "apps.json");
const seedDataManifestPath = path.join(workbenchRoot, "seed-data", "manifest.json");
const changelogPath = path.join(repoRoot, "documents", "PROJECT_CHANGELOG.md");
const artifactsRoot = path.join(workbenchRoot, "artifacts");
const eventsPath = path.join(artifactsRoot, "events.json");
const apiPort = Number(process.env.WORKBENCH_API_PORT ?? "5174");
const apiHost = process.env.WORKBENCH_API_HOST ?? "127.0.0.1";

const app = express();
app.use(cors({ origin: [/^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/localhost:\d+$/] }));
app.use(express.json());

function resolveProjectPath(projectPath: string) {
  const resolved = path.resolve(workbenchRoot, projectPath);
  const allowedRoots = [repoRoot, workbenchRoot].map((item) => path.resolve(item).toLowerCase());
  const normalized = resolved.toLowerCase();
  if (!allowedRoots.some((root) => normalized === root || normalized.startsWith(root + path.sep))) {
    throw new Error(`Path escapes allowed project roots: ${projectPath}`);
  }
  return resolved;
}

async function readConfig(): Promise<AppConfig> {
  const text = await fs.readFile(configPath, "utf8");
  return JSON.parse(text) as AppConfig;
}

async function readSeedDataManifest(): Promise<SeedDataManifest> {
  const text = await fs.readFile(seedDataManifestPath, "utf8");
  return JSON.parse(text) as SeedDataManifest;
}

function cleanMarkdownText(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function parseChangelogEntry(date: string, id: string, title: string, lines: string[]): ChangelogEntry {
  const sections = new Map<string, string[]>();
  const summaryLines: string[] = [];
  let currentSection = "";
  let commit = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const commitMatch = line.match(/^Commits?:\s+(.+)$/);
    if (commitMatch) {
      commit = cleanMarkdownText(commitMatch[1]);
      continue;
    }

    if (!line.startsWith("- ") && line.endsWith(":")) {
      currentSection = cleanMarkdownText(line.slice(0, -1));
      sections.set(currentSection, []);
      continue;
    }

    if (line.startsWith("- ") && currentSection) {
      sections.get(currentSection)?.push(cleanMarkdownText(line.slice(2)));
      continue;
    }

    if (!currentSection) {
      summaryLines.push(cleanMarkdownText(line));
    }
  }

  const primaryFiles =
    sections.get("Primary files") ??
    sections.get("Primary file") ??
    sections.get("Primary documents") ??
    sections.get("Primary document") ??
    [];
  const metrics = (sections.get("Verified gold dataset counts") ?? []).flatMap((item) => {
    const [label, ...valueParts] = item.split(":");
    const value = valueParts.join(":").trim();
    return label && value ? [{ label: label.trim(), value }] : [];
  });

  return {
    id,
    title: cleanMarkdownText(title),
    date,
    commit,
    summary: summaryLines.join(" "),
    keyOutcomes: sections.get("Key outcomes") ?? [],
    primaryFiles,
    metrics
  };
}

function parseProjectChangelog(text: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let currentDate = "";
  let currentEntry: { id: string; title: string; date: string; lines: string[] } | null = null;

  const flushEntry = () => {
    if (currentEntry) {
      entries.push(parseChangelogEntry(currentEntry.date, currentEntry.id, currentEntry.title, currentEntry.lines));
      currentEntry = null;
    }
  };

  for (const line of text.split(/\r?\n/)) {
    const dateMatch = line.match(/^##\s+(\d{4}-\d{2}-\d{2})\s*$/);
    if (dateMatch) {
      flushEntry();
      currentDate = dateMatch[1];
      continue;
    }

    if (line.startsWith("## ")) {
      flushEntry();
      currentDate = "";
      continue;
    }

    const entryMatch = line.match(/^###\s+(\d+)\.\s+(.+)$/);
    if (entryMatch && currentDate) {
      flushEntry();
      currentEntry = {
        id: entryMatch[1],
        title: entryMatch[2],
        date: currentDate,
        lines: []
      };
      continue;
    }

    if (currentEntry) {
      currentEntry.lines.push(line);
    }
  }

  flushEntry();
  return entries;
}

async function readProjectChangelog(): Promise<ProjectChangelog> {
  const text = await fs.readFile(changelogPath, "utf8");
  const stats = await fs.stat(changelogPath);
  const entries = parseProjectChangelog(text);
  return {
    sourcePath: path.relative(repoRoot, changelogPath).replaceAll("\\", "/"),
    updatedAt: stats.mtime.toISOString(),
    totalEntries: entries.length,
    entries
  };
}

async function getManagedApp(appId: string) {
  const config = await readConfig();
  const managedApp = config.apps.find((candidate) => candidate.id === appId);
  if (!managedApp) {
    const error = new Error(`Unknown app: ${appId}`);
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }
  return managedApp;
}

function preview(text: string, maxLength = 2400) {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}\n... truncated ...`;
}

function safeCommand(command: string[]) {
  if (!Array.isArray(command) || command.length === 0) {
    throw new Error("Command definition is empty.");
  }
  return command;
}

async function runCommand(managedApp: ManagedApp, commandName: CommandName, timeoutMs = 120000): Promise<CommandResult> {
  const command = safeCommand(managedApp.commands[commandName]);
  const cwd = resolveProjectPath(managedApp.workingDirectory);
  const startedAt = new Date();

  return await new Promise<CommandResult>((resolve) => {
    const child = spawn(command[0], command.slice(1), {
      cwd,
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        NO_COLOR: "1"
      }
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      stderr += `\nCommand timed out after ${timeoutMs} ms.`;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      stderr += `${error.message}\n`;
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      const finishedAt = new Date();
      resolve({
        command,
        cwd,
        exitCode,
        stdout,
        stderr,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime()
      });
    });
  });
}

function parseComposeStatus(stdout: string): ContainerStatus[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        return [
          {
            name: String(parsed.Name ?? parsed.Names ?? ""),
            service: String(parsed.Service ?? ""),
            image: String(parsed.Image ?? ""),
            state: String(parsed.State ?? ""),
            health: String(parsed.Health ?? ""),
            status: String(parsed.Status ?? ""),
            ports: String(parsed.Ports ?? "")
          }
        ];
      } catch {
        return [];
      }
    });
}

function summarizeRuntime(containers: ContainerStatus[], result: CommandResult) {
  if (result.exitCode !== 0) {
    return {
      state: "error",
      label: "Status command failed",
      detail: preview(result.stderr || result.stdout, 600)
    };
  }
  if (containers.length === 0) {
    return {
      state: "stopped",
      label: "Stopped",
      detail: "No Docker Compose containers are currently running for this app."
    };
  }
  const unhealthy = containers.filter((container) => container.health && container.health !== "healthy");
  const stopped = containers.filter((container) => container.state !== "running");
  if (unhealthy.length > 0) {
    return {
      state: "unhealthy",
      label: "Unhealthy",
      detail: unhealthy.map((container) => `${container.service}: ${container.health}`).join(", ")
    };
  }
  if (stopped.length > 0) {
    return {
      state: "partial",
      label: "Partially running",
      detail: stopped.map((container) => `${container.service}: ${container.state}`).join(", ")
    };
  }
  return {
    state: "healthy",
    label: "Healthy",
    detail: `${containers.length} service(s) running.`
  };
}

async function checkHttp(url: string) {
  const startedAt = Date.now();
  return await new Promise<{ ok: boolean; statusCode: number | null; durationMs: number; error?: string }>((resolve) => {
    const request = https.get(
      url,
      {
        rejectUnauthorized: false,
        timeout: 8000
      },
      (response) => {
        response.resume();
        response.on("end", () => {
          const statusCode = response.statusCode ?? null;
          resolve({
            ok: statusCode !== null && statusCode >= 200 && statusCode < 400,
            statusCode,
            durationMs: Date.now() - startedAt
          });
        });
      }
    );
    request.on("timeout", () => {
      request.destroy(new Error("Request timed out."));
    });
    request.on("error", (error) => {
      resolve({ ok: false, statusCode: null, durationMs: Date.now() - startedAt, error: error.message });
    });
  });
}

async function readJsonIfExists(filePath: string) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text.replace(/^\uFEFF/, "")) as unknown;
  } catch {
    return null;
  }
}

async function readEnvFile(cwd: string) {
  const envPath = path.join(cwd, ".env");
  const text = await fs.readFile(envPath, "utf8");
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

async function getDataProfile(managedApp: ManagedApp) {
  const cwd = resolveProjectPath(managedApp.workingDirectory);
  try {
    const env = await readEnvFile(cwd);
    const query =
      "SELECT 'patient_data' AS table_name, COUNT(*) AS row_count FROM patient_data UNION ALL " +
      "SELECT 'form_encounter', COUNT(*) FROM form_encounter UNION ALL " +
      "SELECT 'openemr_postcalendar_events', COUNT(*) FROM openemr_postcalendar_events UNION ALL " +
      "SELECT 'form_vitals', COUNT(*) FROM form_vitals UNION ALL " +
      "SELECT 'form_soap', COUNT(*) FROM form_soap UNION ALL " +
      "SELECT 'users', COUNT(*) FROM users UNION ALL " +
      "SELECT 'insurance_data', COUNT(*) FROM insurance_data UNION ALL " +
      "SELECT 'lists', COUNT(*) FROM lists UNION ALL " +
      "SELECT 'pnotes', COUNT(*) FROM pnotes UNION ALL " +
      "SELECT 'prescriptions', COUNT(*) FROM prescriptions UNION ALL " +
      "SELECT 'billing', COUNT(*) FROM billing UNION ALL " +
      "SELECT 'procedure_order', COUNT(*) FROM procedure_order UNION ALL " +
      "SELECT 'procedure_result', COUNT(*) FROM procedure_result;";
    const result = await new Promise<CommandResult>((resolve) => {
      const startedAt = new Date();
      const command = [
        "docker",
        "compose",
        "exec",
        "-T",
        "mysql",
        "mariadb",
        "-u",
        env.MYSQL_USER ?? "openemr",
        `-p${env.MYSQL_PASSWORD ?? ""}`,
        env.MYSQL_DATABASE ?? "openemr",
        "-e",
        query
      ];
      const child = spawn(command[0], command.slice(1), { cwd, shell: false, windowsHide: true });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
      child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
      child.on("close", (exitCode) => {
        const finishedAt = new Date();
        resolve({
          command,
          cwd,
          exitCode,
          stdout,
          stderr,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs: finishedAt.getTime() - startedAt.getTime()
        });
      });
    });
    if (result.exitCode !== 0) {
      return { available: false, rows: [], error: preview(result.stderr || result.stdout, 600) };
    }
    const rows = result.stdout
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [tableName, rowCount] = line.split(/\s+/);
        return { tableName, rowCount: Number(rowCount) };
      });
    return { available: true, rows };
  } catch (error) {
    return { available: false, rows: [], error: error instanceof Error ? error.message : String(error) };
  }
}

async function getDemoLogin(managedApp: ManagedApp): Promise<DemoLogin> {
  const cwd = resolveProjectPath(managedApp.workingDirectory);
  const source = path.join(managedApp.workingDirectory, ".env").replaceAll("\\", "/");
  try {
    const env = await readEnvFile(cwd);
    const username = env.OPENEMR_ADMIN_USER || "admin";
    const password = env.OPENEMR_ADMIN_PASSWORD || "";
    if (!password) {
      return {
        available: false,
        source,
        error: "OPENEMR_ADMIN_PASSWORD is not set."
      };
    }
    return {
      available: true,
      username,
      password,
      source
    };
  } catch (error) {
    return {
      available: false,
      source,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function getSourceInfo(managedApp: ManagedApp) {
  const cwd = resolveProjectPath(managedApp.sourcePath);
  const tagResult = await new Promise<{ tag: string; commit: string }>((resolve) => {
    const tag = spawn("git", ["describe", "--tags", "--always"], { cwd, shell: false, windowsHide: true });
    let tagOut = "";
    tag.stdout.on("data", (chunk) => (tagOut += chunk.toString()));
    tag.on("close", () => {
      const commit = spawn("git", ["rev-parse", "HEAD"], { cwd, shell: false, windowsHide: true });
      let commitOut = "";
      commit.stdout.on("data", (chunk) => (commitOut += chunk.toString()));
      commit.on("close", () => resolve({ tag: tagOut.trim(), commit: commitOut.trim() }));
    });
  });
  return {
    ...tagResult,
    matchesExpectedTag: tagResult.tag === managedApp.expectedSourceTag
  };
}

async function getAppSnapshot(managedApp: ManagedApp) {
  const statusResult = await runCommand(managedApp, "status", 30000);
  const containers = parseComposeStatus(statusResult.stdout);
  const runtime = summarizeRuntime(containers, statusResult);
  const health = await checkHttp(managedApp.healthUrl);
  const source = await getSourceInfo(managedApp).catch((error) => ({
    tag: "unknown",
    commit: "unknown",
    matchesExpectedTag: false,
    error: error instanceof Error ? error.message : String(error)
  }));
  const latestTest = managedApp.tests[0]
    ? await readJsonIfExists(resolveProjectPath(managedApp.tests[0].resultPath))
    : null;
  const latestTests = Object.fromEntries(
    await Promise.all(
      managedApp.tests.map(async (test) => [test.id, await readJsonIfExists(resolveProjectPath(test.resultPath))])
    )
  );
  const managedSeeds = managedApp.seeds ?? [];
  const latestSeed = managedSeeds[0]
    ? await readJsonIfExists(resolveProjectPath(managedSeeds[0].resultPath))
    : null;
  const dataProfile = await getDataProfile(managedApp);
  const demoLogin = await getDemoLogin(managedApp);

  return {
    id: managedApp.id,
    name: managedApp.name,
    stage: managedApp.stage,
    description: managedApp.description,
    kind: managedApp.kind,
    publicUrl: managedApp.publicUrl,
    healthUrl: managedApp.healthUrl,
    documentationPath: managedApp.documentationPath,
    runtime,
    health,
    source,
    containers,
    seeds: managedSeeds,
    tests: managedApp.tests,
    latestSeed,
    latestTest,
    latestTests,
    demoLogin,
    dataProfile,
    refreshedAt: new Date().toISOString()
  };
}

async function loadEvents(): Promise<LifecycleEvent[]> {
  const existing = await readJsonIfExists(eventsPath);
  return Array.isArray(existing) ? (existing as LifecycleEvent[]) : [];
}

async function saveEvent(event: LifecycleEvent) {
  await fs.mkdir(artifactsRoot, { recursive: true });
  const events = await loadEvents();
  events.unshift(event);
  await fs.writeFile(eventsPath, JSON.stringify(events.slice(0, 100), null, 2), "utf8");
}

function eventFromCommand(appId: string, type: string, result: CommandResult): LifecycleEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    appId,
    type,
    status: result.exitCode === 0 ? "succeeded" : "failed",
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    durationMs: result.durationMs,
    summary: result.exitCode === 0 ? `${type} completed.` : `${type} failed with exit code ${result.exitCode}.`,
    stdoutPreview: preview(result.stdout),
    stderrPreview: preview(result.stderr)
  };
}

app.get("/api/system", async (_request, response) => {
  response.json({
    name: "Modernization Workbench",
    apiHost,
    apiPort,
    repoRoot,
    workbenchRoot,
    platform: os.platform(),
    nodeVersion: process.version,
    now: new Date().toISOString()
  });
});

app.get("/api/apps", async (_request, response, next) => {
  try {
    const config = await readConfig();
    response.json({ apps: await Promise.all(config.apps.map(getAppSnapshot)) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/apps/:appId", async (request, response, next) => {
  try {
    response.json(await getAppSnapshot(await getManagedApp(request.params.appId)));
  } catch (error) {
    next(error);
  }
});

app.get("/api/apps/:appId/logs", async (request, response, next) => {
  try {
    const managedApp = await getManagedApp(request.params.appId);
    const result = await runCommand(managedApp, "logs", 60000);
    response.json({ result });
  } catch (error) {
    next(error);
  }
});

app.post("/api/apps/:appId/seeds/:seedId/run", async (request, response, next) => {
  try {
    const managedApp = await getManagedApp(request.params.appId);
    const seed = managedApp.seeds.find((candidate) => candidate.id === request.params.seedId);
    if (!seed) {
      response.status(404).json({ error: `Unknown seed: ${request.params.seedId}` });
      return;
    }
    const result = await runCommand(managedApp, seed.commandName, 300000);
    const event = eventFromCommand(managedApp.id, `seed:${seed.id}`, result);
    await saveEvent(event);
    const latestSeed = await readJsonIfExists(resolveProjectPath(seed.resultPath));
    response.status(result.exitCode === 0 ? 200 : 500).json({ result, event, latestSeed, snapshot: await getAppSnapshot(managedApp) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/apps/:appId/actions/:action", async (request, response, next) => {
  try {
    const action = request.params.action as CommandName;
    if (!["start", "stop", "restart"].includes(action)) {
      response.status(400).json({ error: `Unsupported lifecycle action: ${action}` });
      return;
    }
    const managedApp = await getManagedApp(request.params.appId);
    const result = await runCommand(managedApp, action, action === "start" ? 180000 : 120000);
    const event = eventFromCommand(managedApp.id, action, result);
    await saveEvent(event);
    response.status(result.exitCode === 0 ? 200 : 500).json({ result, event, snapshot: await getAppSnapshot(managedApp) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/apps/:appId/tests/:testId/run", async (request, response, next) => {
  try {
    const managedApp = await getManagedApp(request.params.appId);
    const test = managedApp.tests.find((candidate) => candidate.id === request.params.testId);
    if (!test) {
      response.status(404).json({ error: `Unknown test: ${request.params.testId}` });
      return;
    }
    const result = await runCommand(managedApp, test.commandName, test.id === "parity-all" ? 600000 : 300000);
    const event = eventFromCommand(managedApp.id, `test:${test.id}`, result);
    await saveEvent(event);
    const latestTest = await readJsonIfExists(resolveProjectPath(test.resultPath));
    response.status(result.exitCode === 0 ? 200 : 500).json({ result, event, latestTest, snapshot: await getAppSnapshot(managedApp) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/events", async (_request, response, next) => {
  try {
    response.json({ events: await loadEvents() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/seed-datasets", async (_request, response, next) => {
  try {
    response.json(await readSeedDataManifest());
  } catch (error) {
    next(error);
  }
});

app.get("/api/changelog", async (_request, response, next) => {
  try {
    response.json(await readProjectChangelog());
  } catch (error) {
    next(error);
  }
});

app.get("/api/architecture", async (_request, response) => {
  response.json({
    systems: [
      {
        id: "legacy-openemr",
        name: "Legacy OpenEMR",
        status: "Implemented baseline",
        stack: ["OpenEMR 8.1.0", "PHP/Apache container", "MariaDB 11.8.8", "Docker Compose"],
        database: "MariaDB",
        businessLogic: "Existing OpenEMR PHP application and database access layer",
        tests: ["Smoke test implemented", "Gold seed-data validation implemented", "Parity database/http/ui suites implemented", "Playwright UI suite implemented"]
      },
      {
        id: "modernization-workbench",
        name: "Modernization Workbench",
        status: "First version",
        stack: ["React", "TypeScript", "Vite", "Express", "Node.js"],
        database: "File-based local artifacts for this version",
        businessLogic: "Local-only orchestration API with allowlisted commands",
        tests: ["API smoke and UI build verification"]
      },
      {
        id: "modernized-openemr",
        name: "Modernized OpenEMR",
        status: "Not started",
        stack: ["React SPA", "Modern API", "PostgreSQL"],
        database: "PostgreSQL",
        businessLogic: "Future server-side business tier",
        tests: ["Parity suite target profile planned"]
      }
    ]
  });
});

app.get("/api/progress", async (_request, response) => {
  response.json({
    slices: [
      { id: "legacy-baseline", name: "Legacy OpenEMR baseline", status: "verified", detail: "Installed, running, smoke tested, and connected to GitHub." },
      { id: "workbench-v1", name: "Modernization Workbench v1", status: "verified", detail: "Lifecycle control, health checks, smoke tests, logs, and architecture overview." },
      { id: "seed-data", name: "Synthetic seed data", status: "verified", detail: "Workbench owns the shared gold dataset; the 1,000-patient legacy seed is generated and count/temporal-coverage verified." },
      { id: "playwright-login", name: "Playwright baseline login test", status: "verified", detail: "Implemented through the parity-tests UI suite for legacy login and gold-patient chart navigation." },
      { id: "modernized-target", name: "Modernized OpenEMR target", status: "not-started", detail: "Future vertical-slice implementation." }
    ]
  });
});

app.use((error: Error & { statusCode?: number }, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  response.status(error.statusCode ?? 500).json({
    error: error.message,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack
  });
});

app.listen(apiPort, apiHost, () => {
  console.log(`Modernization Workbench API listening on http://${apiHost}:${apiPort}`);
});
