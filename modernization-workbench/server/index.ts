import cors from "cors";
import express from "express";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import http from "node:http";
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
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  completedAt?: string;
  completedCommit?: string;
  elapsedSincePreviousMs?: number;
  summary: string;
  keyOutcomes: string[];
  primaryFiles: string[];
  metrics: { label: string; value: string }[];
};

type GitCommitInfo = {
  fullHash: string;
  shortHash: string;
  authoredAt: string;
};

type ProjectChangelog = {
  sourcePath: string;
  updatedAt: string;
  totalEntries: number;
  entries: ChangelogEntry[];
};

type ParityResetMode = "none" | "run" | "suite" | "test";

type ParitySuite = {
  id: string;
  name: string;
  description: string;
  layer: string;
  path: string;
  tags: string[];
  targets: string[];
  defaultResetMode: ParityResetMode;
};

type ParityPlan = {
  id: string;
  name: string;
  description: string;
  suites: string[];
  resetMode: ParityResetMode;
  tags: string[];
  targets: string[];
};

type ParityManifest = {
  id: string;
  version: string;
  description: string;
  defaultTarget: string;
  defaultResetMode: ParityResetMode;
  resetModes: Array<{ id: ParityResetMode; description: string }>;
  plans: ParityPlan[];
  suites: ParitySuite[];
};

type CustomParityRunRequest = {
  selectionKind?: "suite" | "plan";
  suite?: string;
  plan?: string;
  reset?: ParityResetMode;
  headed?: boolean;
  grep?: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workbenchRoot = path.resolve(__dirname, "..");
const repoRoot = process.env.WORKBENCH_REPO_ROOT
  ? path.resolve(process.env.WORKBENCH_REPO_ROOT)
  : path.resolve(workbenchRoot, "..");
const configPath = path.join(workbenchRoot, "config", "apps.json");
const seedDataManifestPath = path.join(workbenchRoot, "seed-data", "manifest.json");
const changelogPath = path.join(repoRoot, "documents", "PROJECT_CHANGELOG.md");
const parityManifestPath = path.join(repoRoot, "parity-tests", "test-manifest.json");
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

async function readParityManifest(): Promise<ParityManifest> {
  const text = await fs.readFile(parityManifestPath, "utf8");
  return JSON.parse(text) as ParityManifest;
}

function cleanMarkdownText(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function parseChangelogTimestamp(text: string) {
  const value = cleanMarkdownText(text);
  return value && !Number.isNaN(new Date(value).getTime()) ? value : undefined;
}

function calculateDurationMs(startedAt?: string, finishedAt?: string) {
  if (!startedAt || !finishedAt) {
    return undefined;
  }

  const startedTime = new Date(startedAt).getTime();
  const finishedTime = new Date(finishedAt).getTime();
  return Number.isNaN(startedTime) || Number.isNaN(finishedTime) ? undefined : Math.max(0, finishedTime - startedTime);
}

function parseChangelogEntry(date: string, id: string, title: string, lines: string[]): ChangelogEntry {
  const sections = new Map<string, string[]>();
  const summaryLines: string[] = [];
  let currentSection = "";
  let commit = "";
  let startedAt: string | undefined;
  let finishedAt: string | undefined;

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

    const startedMatch = line.match(/^Started:\s+(.+)$/i);
    if (startedMatch) {
      startedAt = parseChangelogTimestamp(startedMatch[1]);
      continue;
    }

    const finishedMatch = line.match(/^(Finished|Ended|Stopped):\s+(.+)$/i);
    if (finishedMatch) {
      finishedAt = parseChangelogTimestamp(finishedMatch[2]);
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
    startedAt,
    finishedAt,
    durationMs: calculateDurationMs(startedAt, finishedAt),
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

async function readGitCommitInfo(): Promise<GitCommitInfo[]> {
  return await new Promise((resolve) => {
    const git = spawn("git", ["log", "--all", "--format=%H%x09%h%x09%aI"], {
      cwd: repoRoot,
      shell: false,
      windowsHide: true
    });
    let stdout = "";

    git.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    git.on("error", () => resolve([]));
    git.on("close", (exitCode) => {
      if (exitCode !== 0) {
        resolve([]);
        return;
      }

      resolve(
        stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .flatMap((line) => {
            const [fullHash, shortHash, authoredAt] = line.split("\t");
            return fullHash && shortHash && authoredAt ? [{ fullHash, shortHash, authoredAt }] : [];
          })
      );
    });
  });
}

function extractCommitHashes(commit: string) {
  return Array.from(commit.matchAll(/\b[0-9a-f]{7,40}\b/gi), (match) => match[0]);
}

function resolveCommitInfo(hash: string, commits: GitCommitInfo[]) {
  const normalized = hash.toLowerCase();
  return commits.find(
    (commit) => commit.fullHash.toLowerCase().startsWith(normalized) || commit.shortHash.toLowerCase() === normalized
  );
}

function enrichChangelogTiming(entries: ChangelogEntry[], commits: GitCommitInfo[]) {
  let previousCompletedAt: string | undefined;

  return entries.map((entry) => {
    const commitHashes = extractCommitHashes(entry.commit);
    const completionHash = commitHashes[commitHashes.length - 1];
    const completionCommit = completionHash ? resolveCommitInfo(completionHash, commits) : undefined;
    const completedAt = entry.finishedAt ?? completionCommit?.authoredAt;
    const previousTime = previousCompletedAt ? new Date(previousCompletedAt).getTime() : Number.NaN;
    const completedTime = completedAt ? new Date(completedAt).getTime() : Number.NaN;
    const elapsedSincePreviousMs =
      completedAt && previousCompletedAt && !Number.isNaN(previousTime) && !Number.isNaN(completedTime)
        ? Math.max(0, completedTime - previousTime)
        : undefined;

    if (completedAt) {
      previousCompletedAt = completedAt;
    }

    return {
      ...entry,
      completedAt,
      completedCommit: completionCommit?.shortHash,
      durationMs: entry.durationMs ?? calculateDurationMs(entry.startedAt, entry.finishedAt),
      elapsedSincePreviousMs
    };
  });
}

async function readProjectChangelog(): Promise<ProjectChangelog> {
  const text = await fs.readFile(changelogPath, "utf8");
  const stats = await fs.stat(changelogPath);
  const entries = enrichChangelogTiming(parseProjectChangelog(text), await readGitCommitInfo());
  return {
    sourcePath: path.relative(repoRoot, changelogPath).replaceAll("\\", "/"),
    updatedAt: stats.mtime.toISOString(),
    totalEntries: entries.length,
    entries
  };
}

function assertSimpleId(value: string, label: string) {
  if (!/^[a-z0-9-]+$/i.test(value)) {
    throw new Error(`${label} contains unsupported characters.`);
  }
}

function resolveCustomParityRun(manifest: ParityManifest, targetId: string, request: CustomParityRunRequest) {
  const selectionKind = request.selectionKind ?? "suite";
  const reset = request.reset ?? manifest.defaultResetMode;
  if (!manifest.resetModes.some((candidate) => candidate.id === reset)) {
    throw new Error(`Unknown reset mode: ${reset}`);
  }

  const grep = request.grep?.trim() ?? "";
  if (grep.length > 120 || /[\r\n]/.test(grep)) {
    throw new Error("Grep filter must be a single line up to 120 characters.");
  }

  if (selectionKind === "plan") {
    const planId = request.plan ?? "";
    assertSimpleId(planId, "Plan id");
    const plan = manifest.plans.find((candidate) => candidate.id === planId);
    if (!plan) {
      throw new Error(`Unknown parity plan: ${planId}`);
    }
    if (!plan.targets.includes(targetId)) {
      throw new Error(`Parity plan ${plan.id} does not support target ${targetId}.`);
    }
    return {
      selectionKind,
      selectionId: plan.id,
      commandArgs: ["-Plan", plan.id],
      reset,
      headed: Boolean(request.headed),
      grep,
      latestPath: `../parity-tests/artifacts/latest-${targetId}-plan-${plan.id}.json`
    };
  }

  const suiteId = request.suite ?? "all";
  assertSimpleId(suiteId, "Suite id");
  if (suiteId !== "all") {
    const suite = manifest.suites.find((candidate) => candidate.id === suiteId);
    if (!suite) {
      throw new Error(`Unknown parity suite: ${suiteId}`);
    }
    if (!suite.targets.includes(targetId)) {
      throw new Error(`Parity suite ${suite.id} does not support target ${targetId}.`);
    }
  }

  return {
    selectionKind,
    selectionId: suiteId,
    commandArgs: ["-Suite", suiteId],
    reset,
    headed: Boolean(request.headed),
    grep,
    latestPath: `../parity-tests/artifacts/latest-${targetId}-${suiteId}.json`
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

async function runCommandDefinition(managedApp: ManagedApp, command: string[], timeoutMs = 120000): Promise<CommandResult> {
  command = safeCommand(command);
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

async function runCommand(managedApp: ManagedApp, commandName: CommandName, timeoutMs = 120000): Promise<CommandResult> {
  return await runCommandDefinition(managedApp, managedApp.commands[commandName], timeoutMs);
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
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      resolve({
        ok: false,
        statusCode: null,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error)
      });
      return;
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      resolve({
        ok: false,
        statusCode: null,
        durationMs: Date.now() - startedAt,
        error: `Unsupported protocol: ${parsedUrl.protocol}`
      });
      return;
    }

    const client = parsedUrl.protocol === "https:" ? https : http;
    const request = client.get(
      parsedUrl,
      parsedUrl.protocol === "https:" ? { rejectUnauthorized: false, timeout: 8000 } : { timeout: 8000 },
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
    if (managedApp.id === "modernized-openemr") {
      const query =
        "SELECT 'patients' AS table_name, COUNT(*) AS row_count FROM patients UNION ALL " +
        "SELECT 'encounters', COUNT(*) FROM encounters UNION ALL " +
        "SELECT 'appointments', COUNT(*) FROM appointments UNION ALL " +
        "SELECT 'staff', COUNT(*) FROM staff UNION ALL " +
        "SELECT 'facilities', COUNT(*) FROM facilities UNION ALL " +
        "SELECT 'prescriptions', COUNT(*) FROM prescriptions UNION ALL " +
        "SELECT 'billing', COUNT(*) FROM billing UNION ALL " +
        "SELECT 'claims', COUNT(*) FROM claims UNION ALL " +
        "SELECT 'payment_sessions', COUNT(*) FROM payment_sessions UNION ALL " +
        "SELECT 'payment_activities', COUNT(*) FROM payment_activities UNION ALL " +
        "SELECT 'immunizations', COUNT(*) FROM immunizations UNION ALL " +
        "SELECT 'lab_orders', COUNT(*) FROM lab_orders UNION ALL " +
        "SELECT 'lab_reports', COUNT(*) FROM lab_reports UNION ALL " +
        "SELECT 'lab_results', COUNT(*) FROM lab_results UNION ALL " +
        "SELECT 'messages', COUNT(*) FROM messages UNION ALL " +
        "SELECT 'problems', COUNT(*) FROM problems UNION ALL " +
        "SELECT 'allergies', COUNT(*) FROM allergies UNION ALL " +
        "SELECT 'medications', COUNT(*) FROM medications;";
      const result = await new Promise<CommandResult>((resolve) => {
        const startedAt = new Date();
        const command = [
          "docker",
          "compose",
          "exec",
          "-T",
          "postgres",
          "psql",
          "-U",
          "openemr",
          "-d",
          "openemr_modernized",
          "-c",
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
        .map((line) => line.trim())
        .filter((line) => /^[a-z_]+\s+\|\s+\d+$/.test(line))
        .map((line) => {
          const [tableName, rowCount] = line.split("|").map((part) => part.trim());
          return { tableName, rowCount: Number(rowCount) };
        });
      return { available: true, rows };
    }

    const env = await readEnvFile(cwd);
    const query =
      "SELECT 'patient_data' AS table_name, COUNT(*) AS row_count FROM patient_data UNION ALL " +
      "SELECT 'form_encounter', COUNT(*) FROM form_encounter UNION ALL " +
      "SELECT 'openemr_postcalendar_events', COUNT(*) FROM openemr_postcalendar_events UNION ALL " +
      "SELECT 'form_vitals', COUNT(*) FROM form_vitals UNION ALL " +
      "SELECT 'form_soap', COUNT(*) FROM form_soap UNION ALL " +
      "SELECT 'users', COUNT(*) FROM users UNION ALL " +
      "SELECT 'insurance_data', COUNT(*) FROM insurance_data UNION ALL " +
      "SELECT 'immunizations', COUNT(*) FROM immunizations UNION ALL " +
      "SELECT 'lists', COUNT(*) FROM lists UNION ALL " +
      "SELECT 'pnotes', COUNT(*) FROM pnotes UNION ALL " +
      "SELECT 'prescriptions', COUNT(*) FROM prescriptions UNION ALL " +
      "SELECT 'billing', COUNT(*) FROM billing UNION ALL " +
      "SELECT 'claims', COUNT(*) FROM claims UNION ALL " +
      "SELECT 'ar_session', COUNT(*) FROM ar_session UNION ALL " +
      "SELECT 'ar_activity', COUNT(*) FROM ar_activity UNION ALL " +
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
  if (managedApp.id === "modernized-openemr") {
    return {
      available: false,
      source: "modernized authentication slice",
      error: "Authentication is deferred to a future modernized security slice."
    };
  }

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
    matchesExpectedTag: !managedApp.expectedSourceTag || tagResult.tag === managedApp.expectedSourceTag
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
    const longRunningTestIds = new Set([
      "native-phpunit",
      "parity-all",
      "parity-workflow",
      "parity-plan-readiness",
      "parity-plan-mutation",
      "parity-plan-full"
    ]);
    const result = await runCommand(managedApp, test.commandName, longRunningTestIds.has(test.id) ? 900000 : 300000);
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

app.get("/api/parity-manifest", async (_request, response, next) => {
  try {
    response.json(await readParityManifest());
  } catch (error) {
    next(error);
  }
});

app.post("/api/apps/:appId/parity-runs/run", async (request, response, next) => {
  try {
    const managedApp = await getManagedApp(request.params.appId);
    const manifest = await readParityManifest();
    const selection = resolveCustomParityRun(manifest, managedApp.id, request.body as CustomParityRunRequest);
    const command = [
      "powershell",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      "..\\scripts\\Run-OpenEmrParityTests.ps1",
      "-Target",
      managedApp.id,
      ...selection.commandArgs,
      "-Reset",
      selection.reset
    ];
    if (selection.headed) {
      command.push("-Headed");
    }
    if (selection.grep) {
      command.push("-Grep", selection.grep);
    }

    const result = await runCommandDefinition(managedApp, command, 900000);
    const event = eventFromCommand(managedApp.id, `parity:${selection.selectionKind}:${selection.selectionId}`, result);
    await saveEvent(event);
    const latestTest = await readJsonIfExists(resolveProjectPath(selection.latestPath));
    response.status(result.exitCode === 0 ? 200 : 500).json({ result, event, latestTest, snapshot: await getAppSnapshot(managedApp) });
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
        stack: ["OpenEMR 8.1.0-2026-06-18", "PHP 8.5.6", "Apache 2.4.67", "MariaDB 11.8.8", "Docker Compose 5.0.2"],
        database: "MariaDB",
        businessLogic: "Existing OpenEMR PHP application and database access layer",
        tests: [
          "Smoke test implemented",
          "Native OpenEMR isolated PHPUnit stable suite implemented",
          "Native OpenEMR Jest JavaScript suite implemented",
          "Gold seed-data validation implemented",
          "Parity database/http/ui/workflow suites and named run plans implemented",
          "Playwright UI suite implemented for login, chart, encounter, scheduling, billing, lab-result, reports, and administration screens",
          "Mutation workflow suite implemented",
          "Slice 1 readiness parity plan implemented for patient search/chart summary comparison",
          "Slice 2 scheduling readiness parity plan implemented for future appointment comparison",
          "Slice 3 encounters readiness parity plan implemented for SOAP and vitals comparison",
          "Slice 4 clinical lists readiness parity plan implemented for problems, allergies, medications, and prescriptions comparison",
          "Slice 5 messaging readiness parity plan implemented for portal-enabled patient message comparison",
          "Slice 6 procedures readiness parity plan implemented for completed lab result comparison",
          "Slice 7 billing readiness parity plan implemented for fee sheet comparison",
          "Slice 8 admin readiness parity plan implemented for users and facilities comparison",
          "Slice 9 reports readiness parity plan implemented for operational reporting comparison",
          "Slice 10 contact mutation readiness parity plan implemented for patient contact update comparison",
          "Slice 11 appointment mutation readiness parity plan implemented for future appointment lifecycle comparison",
          "Slice 12 encounter mutation readiness parity plan implemented for encounter, vitals, and SOAP lifecycle comparison",
          "Slice 13 clinical-list mutation readiness parity plan implemented for allergy lifecycle comparison",
          "Slice 14 message mutation readiness parity plan implemented for patient-message lifecycle comparison",
          "Slice 15 prescription mutation readiness parity plan implemented for prescription lifecycle comparison",
          "Slice 16 billing mutation readiness parity plan implemented for fee-sheet CPT lifecycle comparison",
          "Slice 17 procedure mutation readiness parity plan implemented for lab procedure lifecycle comparison",
          "Slice 18 admin facility mutation readiness parity plan implemented for facility lifecycle comparison",
          "Slice 19 admin user mutation readiness parity plan implemented for user lifecycle comparison",
          "Slice 20 access-control readiness parity plan implemented for default ACL group and permission comparison",
          "Slice 21 access-permission mutation parity plan implemented for ACL assignment revoke/restore comparison",
          "Slice 22 user group membership mutation parity plan implemented for ACL user-to-group assignment comparison",
          "Slice 23 pending procedure orders parity plan implemented for scheduled, reportless lab-order comparison",
          "Slice 24 reports export parity plan implemented for normalized operational CSV export comparison",
          "Slice 25 documents readiness parity plan implemented for patient document metadata and document-list comparison",
          "Slice 26 document mutation parity plan implemented for patient document create/render/archive/delete comparison",
          "Slice 27 document content parity plan implemented for full stored payload and modernized viewer/download comparison",
          "Slice 28 insurance readiness parity plan implemented for primary and secondary coverage comparison",
          "Slice 29 immunizations readiness parity plan implemented for pediatric vaccine-history comparison",
          "Slice 30 immunization mutation parity plan implemented for create/render/entered-in-error/delete lifecycle comparison",
          "Slice 31 problem-list mutation parity plan implemented for create/render/deactivate/delete lifecycle comparison",
          "Slice 32 medication-list mutation parity plan implemented for create/render/deactivate/delete lifecycle comparison",
          "Slice 33 binary patient-document mutation parity plan implemented for create/render/download/archive/delete lifecycle comparison",
          "Slice 34 insurance mutation parity plan implemented for create/render/update/delete lifecycle comparison",
          "Slice 35 encounter metadata parity plan implemented for encounter sensitivity, referral source, external ID, and POS comparison",
          "Slice 36 patient demographics mutation parity plan implemented for identity, address, marital-status, and occupation comparison",
          "Slice 37 patient registration parity plan implemented for temporary patient create/render/delete comparison",
          "Slice 38 document sign-off parity plan implemented for patient document approval lifecycle comparison",
          "Slice 39 document external-link parity plan implemented for patient document web-url lifecycle comparison",
          "Slice 40 document denial parity plan implemented for patient document rejection lifecycle comparison",
          "Slice 41 document metadata parity plan implemented for patient document refile lifecycle comparison",
          "Slice 42 document archive restore parity plan implemented for patient document archive/restore lifecycle comparison",
          "Slice 43 document content replacement parity plan implemented for patient document payload replacement lifecycle comparison",
          "Slice 44 billing diagnosis parity plan implemented for fee-sheet ICD10 lifecycle comparison",
          "Slice 45 billing correction parity plan implemented for fee-sheet charge correction lifecycle comparison",
          "Slice 46 billing modifier parity plan implemented for fee-sheet modifier lifecycle comparison",
          "Slice 47 claim status parity plan implemented for revenue-cycle status comparison",
          "Slice 48 payment posting parity plan implemented for OpenEMR AR payment sessions and activity comparison",
          "Slice 49 account balance parity plan implemented for charge, payment, adjustment, and balance comparison",
          "Slice 50 account aging parity plan implemented for deterministic current, 31-60, 61-90, and over-90 AR bucket comparison",
          "Slice 51 account ledger parity plan implemented for chronological charge, payment, adjustment, and running-balance comparison",
          "Slice 52 account statement parity plan implemented for statement-ready recipient, due-date, current, past-due, and balance comparison",
          "Slice 53 document preview parity plan implemented for document preview kind, thumbnail label, inline-readiness, and preview rendering comparison",
          "Slice 54 document revision parity plan implemented for current revision timestamp, version label, history count, and revision rendering comparison",
          "Slice 55 document replacement revision parity plan implemented for content replacement revision timestamp and hash comparison",
          "Slice 56 payment posting mutation parity plan implemented for AR payment create, render, void, delete, and balance/ledger comparison",
          "Slice 57 claim status mutation parity plan implemented for claim create, generate, clear, render, and delete comparison",
          "Slice 58 patient payment capture parity plan implemented for patient payment create, render, void, delete, and balance/ledger comparison",
          "Slice 59 statement generation parity plan implemented for printable patient statement number, instructions, generated text, line items, and Fees rendering comparison",
          "Slice 60 statement PDF export parity plan implemented for deterministic PDF content and Fees download comparison",
          "Slice 61 statement batch candidate parity plan implemented for account-balance candidate queue comparison",
          "Slice 62 statement batch package parity plan implemented for manifest, summary CSV, PDF package, and Fees export comparison",
          "Slice 63 collections work queue parity plan implemented for past-due account priority, recommended action, and Fees queue comparison",
          "Slice 64 collections follow-up task parity plan implemented for pnotes-compatible task create, render, close, archive, delete, and Fees action comparison",
          "Slice 65 message assignment parity plan implemented for pnotes/message assignment update and modernized Messages reassignment comparison",
          "Slice 66 message content parity plan implemented for pnotes/message title and body edit comparison",
          "Slice 67 encounter documents parity plan implemented for encounter-attached document comparison",
          "Slice 68 encounter billing parity plan implemented for encounter fee-sheet linkage comparison"
        ]
      },
      {
        id: "modernization-workbench",
        name: "Modernization Workbench",
        status: "First version",
        stack: ["React 19.2.7", "TypeScript 5.9.3", "Vite 7.3.5", "Express 5.2.1", "Node.js 24.13.1"],
        database: "File-based local artifacts for this version",
        businessLogic: "Local-only orchestration API with allowlisted commands",
        tests: ["API smoke and UI build verification"]
      },
      {
        id: "modernized-openemr",
        name: "Modernized OpenEMR",
        status: "Slice 68 encounter billing linkage readiness implemented",
        stack: ["React 19.2.7 SPA", "TypeScript 6.0.3", "Vite 8.0.16", "ASP.NET Core 10.0.9 API", "PostgreSQL 17.10", "Docker Compose 5.0.2"],
        database: "PostgreSQL",
        businessLogic: "Server-side API owns patient search/chart summary including patient registration and patient demographics update behavior, insurance coverage read and insurance coverage lifecycle behavior, patient contact update behavior, appointment list/detail and appointment lifecycle behavior, encounter list/detail, encounter-attached document read behavior, encounter fee-sheet linkage read behavior, encounter/vitals/SOAP lifecycle behavior, encounter metadata lifecycle behavior, allergy, problem-list, and medication-list clinical-list lifecycle behavior, immunization history read and immunization entered-in-error lifecycle behavior, patient-message lifecycle, content edit, and assignment behavior, patient-document read, text content retrieval, preview readiness, revision readiness, replacement revision behavior, binary content upload, MIME-aware download, lifecycle behavior, document sign-off behavior, document denial behavior, document metadata refiling behavior, document archive restore behavior, document content replacement behavior, and external-link document behavior, prescription lifecycle behavior, billing line, diagnosis coding, charge correction, modifier, payment posting, patient payment capture, and claim status lifecycle behavior, account balance, account aging, account ledger, account statement readiness, patient statement generation and PDF export read behavior, statement batch candidate read behavior, statement batch package export behavior, collections work queue read behavior, and pnotes-compatible collections follow-up task behavior, procedure order/report/result lifecycle behavior, scheduled/reportless procedure-order read behavior, facility administration lifecycle behavior, user administration lifecycle behavior, focused access-control permission assignment behavior, read-only clinical-list behavior, read-only patient-message behavior, read-only fee-sheet billing behavior, read-only administration directory behavior, and operational reporting plus CSV export behavior for implemented slices",
        tests: ["Modernized smoke test implemented for health, anchor patient search, chart summary, patient demographics mutation, patient registration lifecycle, insurance coverage, insurance mutation, immunizations, appointment detail, encounter detail, encounter document attachments, encounter billing linkage, encounter metadata mutation, appointment mutation, encounter mutation, clinical-list allergy mutation, problem-list mutation, medication-list mutation, patient-message mutation, patient-message content update, patient-message assignment update, patient-document content retrieval, patient-document preview readiness, patient-document revision readiness, patient-document replacement revision lifecycle, patient-document mutation, patient-document sign-off, patient-document denial, patient-document metadata refiling, patient-document archive restore, patient-document content replacement, binary patient-document mutation, external-link patient-document mutation, prescription mutation, immunization mutation, billing line mutation, billing diagnosis mutation, billing correction mutation, billing modifier mutation, claim status mutation, payment posting mutation, patient payment capture, collections follow-up task lifecycle, procedure mutation, scheduled procedure orders, facility mutation, user mutation, access control, access permission mutation, user group membership mutation, clinical lists, patient messages, patient documents, procedure results, fee sheet billing, claim status summary, payment posting summary, account balance summary, account aging summary, account ledger summary, account statement readiness, patient statement generation, patient statement PDF export, statement batch candidates, statement batch package export, collections work queue, administration directory, operational reports, and operational reports CSV export", "Slice 1 readiness parity plan implemented for side-by-side legacy comparison", "Slice 2 scheduling readiness plan implemented for future appointment comparison", "Slice 3 encounters readiness plan implemented for SOAP and vitals comparison", "Slice 4 clinical lists readiness plan implemented for problems, allergies, medications, and prescriptions comparison", "Slice 5 messaging readiness plan implemented for portal-enabled patient message comparison", "Slice 6 procedures readiness plan implemented for completed lab result comparison", "Slice 7 billing readiness plan implemented for fee sheet comparison", "Slice 8 admin readiness plan implemented for users and facilities comparison", "Slice 9 reports readiness plan implemented for operational reporting comparison", "Slice 10 contact mutation readiness plan implemented for patient contact update comparison", "Slice 11 appointment mutation readiness plan implemented for future appointment lifecycle comparison", "Slice 12 encounter mutation readiness plan implemented for encounter, vitals, and SOAP lifecycle comparison", "Slice 13 clinical-list mutation readiness plan implemented for allergy lifecycle comparison", "Slice 14 message mutation readiness plan implemented for patient-message lifecycle comparison", "Slice 15 prescription mutation readiness plan implemented for prescription lifecycle comparison", "Slice 16 billing mutation readiness plan implemented for fee-sheet CPT lifecycle comparison", "Slice 17 procedure mutation readiness plan implemented for lab procedure lifecycle comparison", "Slice 18 admin facility mutation readiness plan implemented for facility lifecycle comparison", "Slice 19 admin user mutation readiness plan implemented for user lifecycle comparison", "Slice 20 access-control readiness plan implemented for default ACL group and permission comparison", "Slice 21 access-permission mutation plan implemented for ACL assignment revoke/restore comparison", "Slice 22 user group membership mutation plan implemented for ACL user-to-group assignment comparison", "Slice 23 pending procedure orders plan implemented for scheduled, reportless lab-order comparison", "Slice 24 reports export plan implemented for normalized operational CSV export comparison", "Slice 25 documents readiness plan implemented for patient document metadata and document-list comparison", "Slice 26 document mutation plan implemented for patient document create/render/archive/delete comparison", "Slice 27 document content plan implemented for full stored payload, API retrieval, viewer, and download comparison", "Slice 28 insurance readiness plan implemented for primary and secondary patient coverage comparison", "Slice 29 immunizations readiness plan implemented for pediatric vaccine-history comparison", "Slice 30 immunization mutation plan implemented for create/render/entered-in-error/delete comparison", "Slice 31 problem-list mutation plan implemented for create/render/deactivate/delete comparison", "Slice 32 medication-list mutation plan implemented for create/render/deactivate/delete comparison", "Slice 33 binary patient-document mutation plan implemented for create/render/download/archive/delete comparison", "Slice 34 insurance mutation plan implemented for create/render/update/delete comparison", "Slice 35 encounter metadata mutation plan implemented for create/render/update/delete comparison", "Slice 36 patient demographics mutation plan implemented for update/render/restore comparison", "Slice 37 patient registration plan implemented for create/render/delete comparison", "Slice 38 document sign-off plan implemented for approve/render/archive/delete comparison", "Slice 39 document external-link plan implemented for web-url create/render/archive/delete comparison", "Slice 40 document denial plan implemented for deny/render/archive/delete comparison", "Slice 41 document metadata plan implemented for refile/render/archive/delete comparison", "Slice 42 document archive restore plan implemented for archive/restore/render/delete comparison", "Slice 43 document content replacement plan implemented for replace/render/archive/delete comparison", "Slice 44 billing diagnosis plan implemented for ICD10 create/render/deactivate/delete comparison", "Slice 45 billing correction plan implemented for CPT charge correction/render/deactivate/delete comparison", "Slice 46 billing modifier plan implemented for CPT modifier create/render/deactivate/delete comparison", "Slice 47 claim status plan implemented for read-only revenue-cycle status comparison", "Slice 48 payment posting plan implemented for read-only OpenEMR AR payment comparison", "Slice 49 account balance plan implemented for read-only charge/payment/adjustment/balance comparison", "Slice 50 account aging plan implemented for read-only AR bucket comparison", "Slice 51 account ledger plan implemented for read-only chronological running-balance comparison", "Slice 52 account statement plan implemented for read-only statement readiness comparison", "Slice 53 document preview plan implemented for read-only preview readiness comparison", "Slice 54 document revision plan implemented for read-only current revision readiness comparison", "Slice 55 document replacement revision plan implemented for content replacement current-revision comparison", "Slice 56 payment posting mutation plan implemented for AR payment create/render/void/delete and balance/ledger comparison", "Slice 57 claim status mutation plan implemented for claim create/generate/clear/delete and Fees rendering comparison", "Slice 58 patient payment capture plan implemented for patient payment create/render/void/delete and balance/ledger comparison", "Slice 59 statement generation plan implemented for printable statement number, instructions, generated text, line items, and Fees rendering comparison", "Slice 60 statement PDF export plan implemented for deterministic PDF content and Fees download comparison", "Slice 61 statement batch plan implemented for statement candidate queue API and Fees rendering comparison", "Slice 62 statement batch package plan implemented for package manifest, summary CSV, PDFs, and Fees download comparison", "Slice 63 collections work queue plan implemented for past-due account priority, recommended action, and Fees rendering comparison", "Slice 64 collections follow-up plan implemented for pnotes-compatible create/render/close/archive/delete and Fees task action comparison", "Slice 65 message assignment plan implemented for pnotes/message assignment update and modernized Messages reassignment comparison", "Slice 66 message content plan implemented for pnotes/message title and body edit comparison", "Slice 67 encounter documents plan implemented for encounter-attached document comparison", "Slice 68 encounter billing plan implemented for encounter fee-sheet linkage comparison"]
      }
    ]
  });
});

app.get("/api/progress", async (_request, response) => {
  response.json({
    slices: [
      { id: "legacy-baseline", name: "Legacy OpenEMR baseline", status: "verified", detail: "Installed, running, smoke tested, and connected to GitHub." },
      { id: "workbench-v1", name: "Modernization Workbench v1", status: "verified", detail: "Lifecycle control, health checks, smoke tests, logs, and architecture overview." },
      { id: "seed-data", name: "Synthetic seed data", status: "verified", detail: "Workbench owns the shared gold dataset; the 1,000-patient legacy seed now includes 2,648 immunization rows, 700 claim status rows, and seeded AR payment postings with count/temporal-coverage verification." },
      { id: "playwright-ui", name: "Playwright legacy UI suite", status: "verified", detail: "Implemented through the parity-tests UI suite for login, chart, encounter, scheduler appointment, fee sheet billing, procedure-result rendering, report-screen rendering, and administration directory rendering." },
      { id: "native-phpunit", name: "Legacy native PHPUnit suite", status: "verified", detail: "Implemented through a containerized stable OpenEMR phpunit-isolated lane with upstream twig and large groups excluded for Windows bind-mount stability." },
      { id: "native-jest", name: "Legacy native Jest suite", status: "verified", detail: "Implemented through OpenEMR's upstream JavaScript Jest suite for CCDA utility and jsPDF compatibility coverage." },
      { id: "workflow-mutations", name: "Legacy workflow mutation suite", status: "verified", detail: "Implemented for demographics, patient registration, insurance coverage, scheduling, encounters with vitals/SOAP details, clinical lists, problem lists, medication lists, patient messages, patient-message content edits, patient-message assignment, text/binary/sign-off/denial/metadata/archive/content-replacement/external-link patient documents, prescriptions, immunizations, billing, billing diagnosis coding, billing charge correction, billing modifier, payment posting, claim status, patient payment capture, collections follow-up tasks, and lab procedure lifecycle coverage with pre/post database probes." },
      { id: "test-management", name: "Parity test management", status: "verified", detail: "Named run plans are implemented for legacy readiness, isolated workflow mutations, patient chart parity, patient demographics mutation parity, patient registration parity, scheduling parity, encounter SOAP/vitals parity, encounter metadata parity, clinical-list parity, messaging parity, insurance coverage parity, insurance mutation parity, immunization parity, patient-document parity, patient-document content parity, patient-document preview parity, patient-document revision parity, patient-document replacement revision parity, binary patient-document mutation parity, patient-document sign-off parity, patient-document denial parity, patient-document metadata parity, patient-document archive parity, patient-document content replacement parity, patient-document external-link parity, procedure-result parity, pending procedure-order parity, report-export parity, fee-sheet billing parity, claim status parity, claim status mutation parity, payment posting parity, payment posting mutation parity, patient payment capture parity, account balance parity, account aging parity, account ledger parity, account statement parity, patient statement generation parity, patient statement PDF export parity, statement batch candidate parity, statement batch package parity, collections work queue parity, collections follow-up task parity, patient-message assignment parity, patient-message content parity, encounter document attachment parity, encounter billing linkage parity, administration directory parity, operational reporting parity, patient contact mutation parity, appointment mutation parity, encounter mutation parity, clinical-list mutation parity, problem-list mutation parity, medication-list mutation parity, patient-message mutation parity, patient-document mutation parity, prescription mutation parity, immunization mutation parity, billing mutation parity, billing diagnosis mutation parity, billing correction mutation parity, billing modifier mutation parity, procedure mutation parity, admin facility mutation parity, admin user mutation parity, access-control parity, access-permission mutation parity, user group membership mutation parity, and the future full parity contract." },
      { id: "modernized-target", name: "Modernized OpenEMR target", status: "in-progress", detail: "Slice 68 proves encounter billing linkage readiness by surfacing active fee-sheet lines in the modernized Encounter detail API/UI with smoke coverage and side-by-side parity evidence." }
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
