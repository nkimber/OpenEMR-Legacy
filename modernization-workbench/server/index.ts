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
  expectedSourceTag?: string;
  commands: Record<string, string[]>;
  services?: string[];
  seeds?: ManagedSeed[];
  tests?: ManagedTest[];
};

type AppSnapshotOptions = {
  includeDetails: boolean;
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

type RuntimeSummary = {
  state: "healthy" | "unhealthy" | "stopped" | "partial" | "error";
  label: string;
  detail: string;
};

type RuntimeGuidance = {
  severity: "info" | "warning" | "error";
  title: string;
  message: string;
  detail?: string;
  primaryAction?: "start" | "restart";
  canStartFromWorkbench: boolean;
  dockerDesktopLikelyUnavailable: boolean;
};

type DemoLogin = {
  available: boolean;
  username?: string;
  password?: string;
  entries?: {
    label: string;
    username: string;
    password: string;
  }[];
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

type FunctionalityProgressItem = {
  label: string;
  detail: string;
  evidence: string[];
};

type FunctionalityProgressArea = {
  id: string;
  name: string;
  status: string;
  summary: string;
  completionEstimatePercent: number;
  estimatedScopeWeight?: number;
  scopeWeightRationale?: string;
  estimateRationale: string;
  completed: FunctionalityProgressItem[];
  outstanding: string[];
  deferred: string[];
};

type FunctionalityProgressConfig = {
  version: string;
  lastUpdated: string;
  areas: FunctionalityProgressArea[];
};

type FunctionalityProgressSummary = {
  areaCount: number;
  simpleAveragePercent: number;
  weightedAveragePercent: number;
  estimatedRemainingPercent: number;
  totalScopeWeight: number;
  weightedCompletedPoints: number;
  weightedRemainingPoints: number;
};

type FunctionalityProgressHistoryPoint = FunctionalityProgressSummary & {
  commit: string;
  fullCommit: string;
  snapshotCompletedAt: string;
  committedAt: string;
  subject: string;
  historyKind: "progress-snapshot" | "timeline-anchor" | "historical-estimate";
  progressEstimateAvailable: boolean;
  note?: string;
  estimateBasis?: string;
  estimateRationale?: string;
  commitMessageBody?: string;
  narrativeSource?: "project-changelog" | "commit-message" | "timeline-anchor" | "historical-estimate";
  narrativeEntryId?: string;
  narrativeTitle?: string;
  narrativeSummary?: string;
  narrativeOutcomes?: string[];
};

type FunctionalityProgressBackfillPoint = {
  fullCommit?: string;
  commit?: string;
  committedAt: string;
  subject: string;
  completionEstimatePercent: number;
  estimateBasis?: string;
  summary?: string;
  estimateRationale: string;
};

type FunctionalityProgressBackfillConfig = {
  version: string;
  lastUpdated: string;
  methodology: string;
  totalScopeWeight?: number;
  points: FunctionalityProgressBackfillPoint[];
};

type FunctionalityProgressForecast = {
  basis: string;
  confidence: "low" | "medium";
  completedSliceCount: number;
  firstSliceCompletedAt?: string;
  latestSliceCompletedAt?: string;
  averageCalendarMsPerSlice?: number;
  averageActiveMsPerSlice?: number;
  recentAverageActiveMsPerSlice?: number;
  estimatedRemainingSliceEquivalents?: number;
  estimatedRemainingActiveMs?: number;
  estimatedCompletionDate?: string;
  explanation: string;
};

type ChangelogEntry = {
  id: string;
  title: string;
  date: string;
  commit: string;
  startedAt?: string;
  finishedAt?: string;
  timelineDate?: string;
  timelineDateSource?: "finishedAt" | "completedAt" | "startedAt" | "sectionDate";
  durationMs?: number;
  completedAt?: string;
  completedCommit?: string;
  completedCommitSource?: "documented" | "git-inferred";
  completedCommitSubject?: string;
  elapsedSincePreviousMs?: number;
  summary: string;
  keyOutcomes: string[];
  primaryFiles: string[];
  metrics: { label: string; value: string }[];
  codeChangeStats?: CodeChangeStats;
};

type CodeChangeStats = {
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
  netLines: number;
  totalChurn: number;
  binaryFiles: number;
  source: "documented" | "git" | "git-inferred";
  commits: string[];
  note?: string;
};

type GitCommitInfo = {
  fullHash: string;
  shortHash: string;
  authoredAt: string;
  subject: string;
  changedFiles: string[];
  codeChangeStats: CodeChangeStats;
};

type ResolvedEntryCommit = {
  commit: GitCommitInfo;
  source: "documented" | "git-inferred";
};

type ChangelogOrder = "asc" | "desc";

type ProjectChangelog = {
  sourcePath: string;
  updatedAt: string;
  totalEntries: number;
  offset: number;
  limit: number;
  returnedEntries: number;
  hasMore: boolean;
  nextOffset?: number;
  order: ChangelogOrder;
  entries: ChangelogEntry[];
};

type ProjectChangelogSummary = {
  sourcePath: string;
  updatedAt: string;
  totalEntries: number;
  latestEntry?: Pick<ChangelogEntry, "id" | "title" | "date" | "startedAt" | "finishedAt" | "timelineDate" | "timelineDateSource" | "commit">;
};

type ParsedChangelogCache = {
  mtimeMs: number;
  updatedAt: string;
  entries: ChangelogEntry[];
};

type ChangelogCache = {
  mtimeMs: number;
  updatedAt: string;
  commitScanLimit: number;
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

type ParityComparisonSide = {
  target: string;
  runId: string;
  path: string;
  exists: boolean;
  passed: boolean;
  selectedSuites: string[];
  stats: {
    expected: number;
    skipped: number;
    unexpected: number;
    flaky: number;
    duration: number;
  };
  reports: {
    runJson: string;
    playwrightJson: string;
    junit: string;
    html: string;
  };
  visualArtifacts: VisualArtifact[];
  probeDetails: ProbeDetail[];
};

type ParityComparisonReport = {
  comparisonId: string;
  status: string;
  passed: boolean;
  selectionKind: "suite" | "plan" | string;
  selectionId: string;
  left: ParityComparisonSide;
  right: ParityComparisonSide;
  differences: unknown[];
  differenceCount: number;
  acceptance: DifferenceAcceptanceSummary;
  reports: {
    comparisonJson: string;
  };
  artifactDirectory: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};

type ParityRunTrendPoint = {
  runId: string;
  target: string;
  selectionKind: string;
  selectionId: string;
  selectedSuites: string[];
  passed: boolean;
  expected: number;
  skipped: number;
  unexpected: number;
  flaky: number;
  durationMs: number;
  finishedAt: string;
  artifactPath: string;
};

type ParityComparisonTrendPoint = {
  comparisonId: string;
  selectionKind: string;
  selectionId: string;
  status: string;
  passed: boolean;
  differenceCount: number;
  acceptedDifferenceCount: number;
  unacceptedDifferenceCount: number;
  totalCheckCount: number;
  targetDurationMs: number;
  finishedAt: string;
  artifactPath: string;
};

type ParityReliabilitySelectionSummary = {
  selectionKind: string;
  selectionId: string;
  totalComparisons: number;
  matchedComparisons: number;
  differentComparisons: number;
  passRatePercent: number;
  averageDifferenceCount: number;
  unacceptedDifferenceCount: number;
  latestStatus: string;
  latestFinishedAt: string;
};

type ParityReliabilitySummary = {
  runCount: number;
  runPassRatePercent: number;
  failedRunCount: number;
  averageRunDurationMs: number;
  comparisonCount: number;
  comparisonPassRatePercent: number;
  differentComparisonCount: number;
  averageComparisonDifferenceCount: number;
  unacceptedDifferenceCount: number;
  averageComparisonTargetDurationMs: number;
};

type ParityReliabilityReport = {
  generatedAt: string;
  windowSize: number;
  summary: ParityReliabilitySummary;
  runTrend: ParityRunTrendPoint[];
  comparisonTrend: ParityComparisonTrendPoint[];
  selectionSummaries: ParityReliabilitySelectionSummary[];
};

type VisualArtifact = {
  path: string;
  name: string;
  kind: "test-screenshot" | "html-report-image" | "image";
  sizeBytes: number;
  modifiedAt: string;
};

type ProbeDetail = {
  title: string;
  file: string;
  line: number;
  column: number;
  status: string;
  expectedStatus: string;
  project: string;
  durationMs: number;
  retry: number;
  tags: string[];
  errorMessages: string[];
  attachmentCount: number;
  attachments: ProbeAttachmentDetail[];
};

type ProbeAttachmentDetail = {
  name: string;
  contentType: string;
  path: string;
  sizeBytes: number;
  preview: string;
  previewTruncated: boolean;
};

type AcceptedDifferenceEntry = {
  id: string;
  status: "accepted" | "retired";
  selectionKind?: string;
  selectionId?: string;
  path?: string;
  messageIncludes?: string;
  reason: string;
  acceptedBy: string;
  acceptedAt: string;
  expiresAt?: string;
};

type AcceptedDifferencesConfig = {
  version: string;
  lastUpdated: string;
  entries: AcceptedDifferenceEntry[];
};

type DifferenceAcceptance = {
  differenceIndex: number;
  accepted: boolean;
  acceptedDifferenceIds: string[];
  reasons: string[];
};

type DifferenceAcceptanceSummary = {
  acceptedCount: number;
  unacceptedCount: number;
  acceptedDifferenceIds: string[];
  differenceAcceptances: DifferenceAcceptance[];
};

type SourceInventoryConfig = {
  version: string;
  lastUpdated: string;
  method: string;
};

type SourceInventoryTotals = {
  files: number;
  totalLines: number;
  nonBlankLines: number;
  blankLines: number;
};

type SourceInventoryComponent = SourceInventoryTotals & {
  id: string;
  label: string;
  layer: string;
  description: string;
  roots: string[];
  extensions?: string[];
  fileNames?: string[];
  samplePaths: string[];
  warnings: string[];
};

type SourceInventoryMetric = {
  id: string;
  label: string;
  detail: string;
  value: number;
  files: number;
  warnings: string[];
};

type SourceInventorySystem = {
  systemId: string;
  summary: string;
  totals: SourceInventoryTotals;
  components: SourceInventoryComponent[];
  metrics: SourceInventoryMetric[];
  warnings: string[];
};

type SourceInventory = {
  version: string;
  lastUpdated: string;
  generatedAt: string;
  durationMs?: number;
  method: string;
  systems: SourceInventorySystem[];
  warnings: string[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workbenchRoot = path.resolve(__dirname, "..");
const repoRoot = process.env.WORKBENCH_REPO_ROOT
  ? path.resolve(process.env.WORKBENCH_REPO_ROOT)
  : path.resolve(workbenchRoot, "..");
const configPath = path.join(workbenchRoot, "config", "apps.json");
const functionalityProgressPath = path.join(workbenchRoot, "config", "functionality-progress.json");
const acceptedDifferencesPath = path.join(workbenchRoot, "config", "accepted-differences.json");
const functionalityProgressBackfillPath = path.join(workbenchRoot, "config", "functionality-progress-backfill.json");
const sourceInventoryPath = path.join(workbenchRoot, "config", "source-inventory.json");
const sourceInventorySnapshotPath = path.join(workbenchRoot, "config", "source-inventory.snapshot.json");
const seedDataManifestPath = path.join(workbenchRoot, "seed-data", "manifest.json");
const changelogPath = path.join(repoRoot, "documents", "PROJECT_CHANGELOG.md");
const parityManifestPath = path.join(repoRoot, "parity-tests", "test-manifest.json");
const parityComparisonsRoot = path.join(repoRoot, "parity-tests", "artifacts", "comparisons");
const parityRunsRoot = path.join(repoRoot, "parity-tests", "artifacts", "runs");
const artifactsRoot = path.join(workbenchRoot, "artifacts");
const eventsPath = path.join(artifactsRoot, "events.json");
const apiPort = Number(process.env.WORKBENCH_API_PORT ?? "5174");
const apiHost = process.env.WORKBENCH_API_HOST ?? "127.0.0.1";
const changelogGitEnrichmentCommitLimit = 150;
let parsedChangelogCache: ParsedChangelogCache | null = null;
let changelogCache: ChangelogCache | null = null;
let changelogCacheBuild: { mtimeMs: number; promise: Promise<ChangelogCache> } | null = null;
const sourceInventoryCacheMs = 10 * 1000;
const progressHistoryCacheMs = 30 * 1000;
let sourceInventoryCache: { expiresAt: number; inventory: SourceInventory } | null = null;
let progressHistoryCache: { expiresAt: number; history: FunctionalityProgressHistoryPoint[] } | null = null;
const readableArtifactRoots = [
  path.join(repoRoot, "parity-tests", "artifacts"),
  path.join(repoRoot, "legacy-openemr", "artifacts"),
  path.join(repoRoot, "modernized-openemr", "artifacts"),
  artifactsRoot
].map((item) => path.resolve(item));

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

function isPathInside(candidatePath: string, allowedRoot: string) {
  const normalizedCandidate = path.resolve(candidatePath).toLowerCase();
  const normalizedRoot = path.resolve(allowedRoot).toLowerCase();
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(normalizedRoot + path.sep);
}

function resolveReadableArtifactPath(projectPath: string) {
  const cleanedPath = projectPath.replaceAll("\\", "/").trim().replace(/^\/+/, "");
  if (!cleanedPath || cleanedPath.includes("\0")) {
    const error = new Error("Artifact path is required.") as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  const candidates = [path.resolve(repoRoot, cleanedPath), path.resolve(workbenchRoot, cleanedPath)];
  const resolved = candidates.find((candidate) => readableArtifactRoots.some((root) => isPathInside(candidate, root)));
  if (!resolved) {
    const error = new Error("Artifact path is outside the readable artifact roots.") as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
  return resolved;
}

async function readConfig(): Promise<AppConfig> {
  const text = await fs.readFile(configPath, "utf8");
  return JSON.parse(text) as AppConfig;
}

async function readFunctionalityProgress(): Promise<FunctionalityProgressConfig> {
  const text = await fs.readFile(functionalityProgressPath, "utf8");
  return JSON.parse(text) as FunctionalityProgressConfig;
}

async function readAcceptedDifferences(): Promise<AcceptedDifferencesConfig> {
  const text = await fs.readFile(acceptedDifferencesPath, "utf8");
  const config = JSON.parse(text) as AcceptedDifferencesConfig;
  return {
    version: typeof config.version === "string" ? config.version : "unknown",
    lastUpdated: typeof config.lastUpdated === "string" ? config.lastUpdated : "",
    entries: Array.isArray(config.entries) ? config.entries : []
  };
}

async function readSourceInventoryConfig(): Promise<SourceInventoryConfig> {
  const text = await fs.readFile(sourceInventoryPath, "utf8");
  return JSON.parse(text) as SourceInventoryConfig;
}

async function readSeedDataManifest(): Promise<SeedDataManifest> {
  const text = await fs.readFile(seedDataManifestPath, "utf8");
  return JSON.parse(text) as SeedDataManifest;
}

async function readParityManifest(): Promise<ParityManifest> {
  const text = await fs.readFile(parityManifestPath, "utf8");
  return JSON.parse(text) as ParityManifest;
}

async function readSourceInventory(): Promise<SourceInventory> {
  const now = Date.now();
  if (sourceInventoryCache && sourceInventoryCache.expiresAt > now) {
    return sourceInventoryCache.inventory;
  }

  let inventory: SourceInventory;
  try {
    inventory = JSON.parse(await fs.readFile(sourceInventorySnapshotPath, "utf8")) as SourceInventory;
  } catch (error) {
    const config = await readSourceInventoryConfig();
    inventory = {
      version: config.version,
      lastUpdated: config.lastUpdated,
      generatedAt: "",
      method: config.method,
      systems: [],
      warnings: [
        `Source inventory snapshot is unavailable. Run npm run generate:source-inventory in modernization-workbench/. ${error instanceof Error ? error.message : String(error)}`
      ]
    };
  }
  sourceInventoryCache = { expiresAt: now + sourceInventoryCacheMs, inventory };
  return inventory;
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

function extractTimestampDate(value?: string) {
  return value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
}

function parseChangelogDate(text: string) {
  const value = cleanMarkdownText(text);
  return value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
}

function calculateDurationMs(startedAt?: string, finishedAt?: string) {
  if (!startedAt || !finishedAt) {
    return undefined;
  }

  const startedTime = new Date(startedAt).getTime();
  const finishedTime = new Date(finishedAt).getTime();
  return Number.isNaN(startedTime) || Number.isNaN(finishedTime) ? undefined : Math.max(0, finishedTime - startedTime);
}

function parseIntegerMetric(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  const match = normalized.match(/^([+-]?\d+)/);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function parseDocumentedCodeChangeStats(items: string[]): CodeChangeStats | undefined {
  if (!items.length) {
    return undefined;
  }

  const values = new Map<string, number>();
  for (const item of items) {
    const [rawLabel, ...valueParts] = item.split(":");
    const value = parseIntegerMetric(valueParts.join(":"));
    if (!rawLabel || value === undefined) {
      continue;
    }

    values.set(rawLabel.trim().toLowerCase(), value);
  }

  const filesChanged = values.get("files changed");
  const linesAdded = values.get("lines added");
  const linesDeleted = values.get("lines deleted");
  const netLines = values.get("net lines") ?? (linesAdded !== undefined && linesDeleted !== undefined ? linesAdded - linesDeleted : undefined);
  const totalChurn = values.get("total churn") ?? (linesAdded !== undefined && linesDeleted !== undefined ? linesAdded + linesDeleted : undefined);
  const binaryFiles = values.get("binary files") ?? 0;

  if (filesChanged === undefined || linesAdded === undefined || linesDeleted === undefined || netLines === undefined || totalChurn === undefined) {
    return undefined;
  }

  return {
    filesChanged,
    linesAdded,
    linesDeleted,
    netLines,
    totalChurn,
    binaryFiles,
    source: "documented",
    commits: [],
    note: "Read from this changelog entry."
  };
}

function parseChangelogEntry(date: string, id: string, title: string, lines: string[]): ChangelogEntry {
  const sections = new Map<string, string[]>();
  const summaryLines: string[] = [];
  let currentSection = "";
  let commit = "";
  let entryDate = date;
  let startedAt: string | undefined;
  let finishedAt: string | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const dateMatch = line.match(/^Date:\s+(.+)$/i);
    if (dateMatch) {
      entryDate = parseChangelogDate(dateMatch[1]) ?? entryDate;
      continue;
    }

    const commitMatch = line.match(/^(Commits?|Changeset):\s+(.+)$/i);
    if (commitMatch) {
      commit = cleanMarkdownText(commitMatch[2]);
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

    if (/^Duration:\s+/.test(line)) {
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
  const codeChangeStats = parseDocumentedCodeChangeStats(sections.get("Code changes") ?? []);

  return {
    id,
    title: cleanMarkdownText(title),
    date: entryDate || extractTimestampDate(finishedAt) || extractTimestampDate(startedAt) || "",
    commit,
    startedAt,
    finishedAt,
    durationMs: calculateDurationMs(startedAt, finishedAt),
    summary: summaryLines.join(" "),
    keyOutcomes: sections.get("Key outcomes") ?? [],
    primaryFiles,
    metrics,
    codeChangeStats
  };
}

function parseProjectChangelog(text: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let currentDate = "";
  let currentEntry: { id: string; title: string; date: string; lines: string[] } | null = null;
  let isInCodeFence = false;

  const flushEntry = () => {
    if (currentEntry) {
      entries.push(parseChangelogEntry(currentEntry.date, currentEntry.id, currentEntry.title, currentEntry.lines));
      currentEntry = null;
    }
  };

  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith("```")) {
      isInCodeFence = !isInCodeFence;
      continue;
    }

    if (isInCodeFence) {
      continue;
    }

    const dateMatch = line.match(/^##\s+(\d{4}-\d{2}-\d{2})\s*$/);
    if (dateMatch) {
      flushEntry();
      currentDate = dateMatch[1];
      continue;
    }

    const entryMatch = line.match(/^(#{2,3})\s+(\d+)\.\s+(.+)$/);
    if (entryMatch) {
      flushEntry();
      currentEntry = {
        id: entryMatch[2],
        title: entryMatch[3],
        date: entryMatch[1] === "###" ? currentDate : "",
        lines: []
      };
      continue;
    }

    if (line.startsWith("## ")) {
      flushEntry();
      currentDate = "";
      continue;
    }

    if (currentEntry) {
      currentEntry.lines.push(line);
    }
  }

  flushEntry();
  return entries;
}

function roundProgressValue(value: number) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : 0;
}

function getAreaScopeWeight(area: FunctionalityProgressArea) {
  const configuredWeight = Number(area.estimatedScopeWeight);
  return Number.isFinite(configuredWeight) && configuredWeight > 0 ? configuredWeight : 1;
}

function getAreaCompletionPercent(area: FunctionalityProgressArea) {
  const configuredPercent = Number(area.completionEstimatePercent);
  return Number.isFinite(configuredPercent) ? Math.max(0, Math.min(100, configuredPercent)) : 0;
}

function calculateFunctionalityProgressSummary(areas: FunctionalityProgressArea[]): FunctionalityProgressSummary {
  const areaCount = areas.length;
  const totalScopeWeight = areas.reduce((total, area) => total + getAreaScopeWeight(area), 0);
  const weightedCompletedPoints = areas.reduce(
    (total, area) => total + (getAreaCompletionPercent(area) / 100) * getAreaScopeWeight(area),
    0
  );
  const simpleAveragePercent = areaCount ? areas.reduce((total, area) => total + getAreaCompletionPercent(area), 0) / areaCount : 0;
  const weightedAveragePercent = totalScopeWeight ? (weightedCompletedPoints / totalScopeWeight) * 100 : 0;
  const weightedRemainingPoints = Math.max(0, totalScopeWeight - weightedCompletedPoints);

  return {
    areaCount,
    simpleAveragePercent: roundProgressValue(simpleAveragePercent),
    weightedAveragePercent: roundProgressValue(weightedAveragePercent),
    estimatedRemainingPercent: roundProgressValue(100 - weightedAveragePercent),
    totalScopeWeight: roundProgressValue(totalScopeWeight),
    weightedCompletedPoints: roundProgressValue(weightedCompletedPoints),
    weightedRemainingPoints: roundProgressValue(weightedRemainingPoints)
  };
}

function parseFunctionalityProgressSnapshot(text: string) {
  try {
    const parsed = JSON.parse(text) as Partial<FunctionalityProgressConfig>;
    return Array.isArray(parsed.areas) ? parsed.areas : [];
  } catch {
    return [];
  }
}

async function runGitText(args: string[], timeoutMs = 10000): Promise<string | undefined> {
  return await new Promise((resolve) => {
    const git = spawn("git", args, {
      cwd: repoRoot,
      shell: false,
      windowsHide: true
    });
    let stdout = "";
    const timer = setTimeout(() => {
      git.kill();
      resolve(undefined);
    }, timeoutMs);

    git.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    git.on("error", () => {
      clearTimeout(timer);
      resolve(undefined);
    });
    git.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve(exitCode === 0 ? stdout : undefined);
    });
  });
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    })
  );

  return results;
}

function createTimelineAnchorSummary(referenceSummary?: FunctionalityProgressSummary): FunctionalityProgressSummary {
  const totalScopeWeight = referenceSummary?.totalScopeWeight ?? 0;

  return {
    areaCount: referenceSummary?.areaCount ?? 0,
    simpleAveragePercent: 0,
    weightedAveragePercent: 0,
    estimatedRemainingPercent: 100,
    totalScopeWeight,
    weightedCompletedPoints: 0,
    weightedRemainingPoints: totalScopeWeight
  };
}

function createHistoricalEstimateSummary(completionEstimatePercent: number, totalScopeWeight = 100): FunctionalityProgressSummary {
  const weightedAveragePercent = Math.max(0, Math.min(100, Number.isFinite(completionEstimatePercent) ? completionEstimatePercent : 0));
  const normalizedScopeWeight = Number.isFinite(totalScopeWeight) && totalScopeWeight > 0 ? totalScopeWeight : 100;
  const weightedCompletedPoints = (weightedAveragePercent / 100) * normalizedScopeWeight;

  return {
    areaCount: 0,
    simpleAveragePercent: roundProgressValue(weightedAveragePercent),
    weightedAveragePercent: roundProgressValue(weightedAveragePercent),
    estimatedRemainingPercent: roundProgressValue(100 - weightedAveragePercent),
    totalScopeWeight: roundProgressValue(normalizedScopeWeight),
    weightedCompletedPoints: roundProgressValue(weightedCompletedPoints),
    weightedRemainingPoints: roundProgressValue(Math.max(0, normalizedScopeWeight - weightedCompletedPoints))
  };
}

function commitHashMatches(fullCommit: string, shortCommit: string, hash: string) {
  const normalizedHash = hash.toLowerCase();
  const normalizedFullCommit = fullCommit.toLowerCase();
  const normalizedShortCommit = shortCommit.toLowerCase();
  return normalizedFullCommit.startsWith(normalizedHash) || normalizedHash.startsWith(normalizedFullCommit) || normalizedShortCommit === normalizedHash;
}

function findChangelogEntryForCommit(fullCommit: string, shortCommit: string, entries: ChangelogEntry[]) {
  return entries.find((entry) => extractCommitHashes(entry.commit).some((hash) => commitHashMatches(fullCommit, shortCommit, hash)));
}

function extractCommitMessageBody(messageText: string | undefined, subject: string) {
  if (!messageText) {
    return undefined;
  }

  const lines = messageText.trim().split(/\r?\n/);
  if (lines[0]?.trim() === subject.trim()) {
    lines.shift();
  }

  const body = lines.join("\n").trim();
  return body ? body : undefined;
}

async function readCommitMessageBody(fullCommit: string, subject: string) {
  return extractCommitMessageBody(await runGitText(["show", "-s", "--format=%B", fullCommit], 10000), subject);
}

function buildHistoryNarrative(
  fullCommit: string,
  shortCommit: string,
  subject: string,
  entries: ChangelogEntry[],
  commitMessageBody?: string,
  fallbackNote?: string
) {
  const entry = findChangelogEntryForCommit(fullCommit, shortCommit, entries);
  if (entry) {
    return {
      commitMessageBody,
      narrativeSource: "project-changelog" as const,
      narrativeEntryId: entry.id,
      narrativeTitle: entry.title,
      narrativeSummary: entry.summary || commitMessageBody || subject,
      narrativeOutcomes: entry.keyOutcomes
    };
  }

  return {
    commitMessageBody,
    narrativeSource: commitMessageBody ? ("commit-message" as const) : fallbackNote ? ("timeline-anchor" as const) : undefined,
    narrativeTitle: subject,
    narrativeSummary: commitMessageBody || fallbackNote,
    narrativeOutcomes: []
  };
}

async function readFunctionalityProgressBackfill(changelogEntries: ChangelogEntry[] = []): Promise<FunctionalityProgressHistoryPoint[]> {
  let configText: string;
  try {
    configText = await fs.readFile(functionalityProgressBackfillPath, "utf8");
  } catch {
    return [];
  }

  let parsed: Partial<FunctionalityProgressBackfillConfig>;
  try {
    parsed = JSON.parse(configText) as Partial<FunctionalityProgressBackfillConfig>;
  } catch {
    return [];
  }

  if (!Array.isArray(parsed.points)) {
    return [];
  }

  const totalScopeWeight = Number.isFinite(Number(parsed.totalScopeWeight)) ? Number(parsed.totalScopeWeight) : undefined;
  const historyPoints = parsed.points
    .map((point): FunctionalityProgressHistoryPoint | undefined => {
      const fullCommit = (point.fullCommit ?? point.commit ?? "").trim();
      const commit = (point.commit && point.commit.length < fullCommit.length ? point.commit : fullCommit.slice(0, 8)).trim();
      const committedAt = point.committedAt?.trim();
      const subject = point.subject?.trim();
      const completionEstimatePercent = Number(point.completionEstimatePercent);
      if (!fullCommit || !commit || !committedAt || !subject || !Number.isFinite(completionEstimatePercent)) {
        return undefined;
      }

      const changelogEntry = findChangelogEntryForCommit(fullCommit, commit, changelogEntries);
      const narrative = changelogEntry
        ? {
            narrativeSource: "project-changelog" as const,
            narrativeEntryId: changelogEntry.id,
            narrativeTitle: changelogEntry.title,
            narrativeSummary: changelogEntry.summary || point.summary || point.estimateRationale,
            narrativeOutcomes: changelogEntry.keyOutcomes
          }
        : {
            narrativeSource: "historical-estimate" as const,
            narrativeTitle: subject,
            narrativeSummary: point.summary || point.estimateRationale,
            narrativeOutcomes: point.estimateRationale ? [point.estimateRationale] : []
          };

      return {
        commit,
        fullCommit,
        snapshotCompletedAt: committedAt,
        committedAt,
        subject,
        historyKind: "historical-estimate",
        progressEstimateAvailable: true,
        note: point.summary || point.estimateRationale,
        estimateBasis: point.estimateBasis,
        estimateRationale: point.estimateRationale,
        ...narrative,
        ...createHistoricalEstimateSummary(completionEstimatePercent, totalScopeWeight)
      } satisfies FunctionalityProgressHistoryPoint;
    })
    .filter((point): point is FunctionalityProgressHistoryPoint => Boolean(point));

  return historyPoints.sort((left, right) => Date.parse(left.snapshotCompletedAt) - Date.parse(right.snapshotCompletedAt));
}

async function readModernizedApplicationStartAnchor(referenceSummary?: FunctionalityProgressSummary, changelogEntries: ChangelogEntry[] = []): Promise<FunctionalityProgressHistoryPoint | undefined> {
  const commitLog = await runGitText(["log", "--first-parent", "--reverse", "--format=%H%x1f%h%x1f%cI%x1f%s", "--", "modernized-openemr"], 10000);
  const firstLine = commitLog?.split(/\r?\n/).find(Boolean);
  if (!firstLine) {
    return undefined;
  }

  const [fullCommit, commit, committedAt, subject] = firstLine.split("\x1f");
  if (!fullCommit || !commit || !committedAt || !subject) {
    return undefined;
  }

  const note = "First committed modernized application check-in; progress estimates were not captured yet.";
  const commitMessageBody = await readCommitMessageBody(fullCommit, subject);

  return {
    commit,
    fullCommit,
    snapshotCompletedAt: committedAt,
    committedAt,
    subject,
    historyKind: "timeline-anchor",
    progressEstimateAvailable: false,
    note,
    ...buildHistoryNarrative(fullCommit, commit, subject, changelogEntries, commitMessageBody, note),
    ...createTimelineAnchorSummary(referenceSummary)
  };
}

async function readProgressHistory(changelogEntries: ChangelogEntry[] = []): Promise<FunctionalityProgressHistoryPoint[]> {
  const now = Date.now();
  if (progressHistoryCache && progressHistoryCache.expiresAt > now) {
    return progressHistoryCache.history;
  }

  const progressPath = "modernization-workbench/config/functionality-progress.json";
  const addCommit = (await runGitText(["log", "--diff-filter=A", "--format=%H", "--", progressPath]))?.trim().split(/\r?\n/)[0];
  if (!addCommit) {
    progressHistoryCache = { expiresAt: now + progressHistoryCacheMs, history: [] };
    return [];
  }

  const commitLog = await runGitText(
    ["log", "--first-parent", "--reverse", "--format=%H%x1f%h%x1f%cI%x1f%s", `${addCommit}^..HEAD`, "--", progressPath],
    15000
  );
  if (!commitLog) {
    progressHistoryCache = { expiresAt: now + progressHistoryCacheMs, history: [] };
    return [];
  }

  const snapshotRows = commitLog.split(/\r?\n/).filter(Boolean);
  const historyPoints = await mapWithConcurrency<string, FunctionalityProgressHistoryPoint | undefined>(snapshotRows, 8, async (line) => {
    const [fullCommit, commit, snapshotCompletedAt, subject] = line.split("\x1f");
    if (!fullCommit || !commit || !snapshotCompletedAt || !subject) {
      return undefined;
    }

    const snapshotText = await runGitText(["show", `${fullCommit}:${progressPath}`], 10000);
    if (!snapshotText) {
      return undefined;
    }

    const commitMessageBody = findChangelogEntryForCommit(fullCommit, commit, changelogEntries) ? undefined : await readCommitMessageBody(fullCommit, subject);
    const areas = parseFunctionalityProgressSnapshot(snapshotText);
    if (!areas.length) {
      return undefined;
    }

    return {
      commit,
      fullCommit,
      snapshotCompletedAt,
      committedAt: snapshotCompletedAt,
      subject,
      historyKind: "progress-snapshot",
      progressEstimateAvailable: true,
      ...buildHistoryNarrative(fullCommit, commit, subject, changelogEntries, commitMessageBody),
      ...calculateFunctionalityProgressSummary(areas)
    } satisfies FunctionalityProgressHistoryPoint;
  });
  const measuredHistory = historyPoints.filter((point): point is FunctionalityProgressHistoryPoint => Boolean(point));
  const historicalEstimates = await readFunctionalityProgressBackfill(changelogEntries);
  const mergedHistoryByCommit = new Map<string, FunctionalityProgressHistoryPoint>();
  for (const point of historicalEstimates) {
    mergedHistoryByCommit.set(point.fullCommit, point);
  }

  for (const point of measuredHistory) {
    const existing = mergedHistoryByCommit.get(point.fullCommit);
    if (!existing || point.weightedAveragePercent > 0 || existing.historyKind !== "historical-estimate") {
      mergedHistoryByCommit.set(point.fullCommit, point);
    }
  }

  const history = [...mergedHistoryByCommit.values()].sort((left, right) => {
    const leftTime = Date.parse(left.snapshotCompletedAt);
    const rightTime = Date.parse(right.snapshotCompletedAt);
    return leftTime - rightTime || left.fullCommit.localeCompare(right.fullCommit);
  });

  if (!historicalEstimates.length) {
    const startAnchor = await readModernizedApplicationStartAnchor(history[0], changelogEntries);
    const anchorTime = startAnchor ? Date.parse(startAnchor.snapshotCompletedAt) : Number.NaN;
    const firstHistoryTime = history[0] ? Date.parse(history[0].snapshotCompletedAt) : Number.NaN;
    if (startAnchor && !history.some((point) => point.fullCommit === startAnchor.fullCommit) && (!Number.isFinite(firstHistoryTime) || anchorTime < firstHistoryTime)) {
      history.unshift(startAnchor);
    }
  }

  progressHistoryCache = { expiresAt: now + progressHistoryCacheMs, history };
  return history;
}

function extractSliceNumbers(entry: ChangelogEntry) {
  const text = [entry.title, entry.summary, ...entry.keyOutcomes].join(" ");
  return [...text.matchAll(/\bSlice\s+(\d+)\b/gi)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter((value) => Number.isFinite(value));
}

async function readChangelogEntriesForForecast() {
  return parseProjectChangelog(await fs.readFile(changelogPath, "utf8"));
}

async function buildFunctionalityProgressForecast(summary: FunctionalityProgressSummary, entries?: ChangelogEntry[]): Promise<FunctionalityProgressForecast> {
  entries ??= await readChangelogEntriesForForecast();
  const slicesByNumber = new Map<number, { completedAt: string; durationMs?: number }>();

  for (const entry of entries) {
    const sliceNumbers = extractSliceNumbers(entry);
    if (!sliceNumbers.length || !entry.finishedAt) {
      continue;
    }

    for (const sliceNumber of sliceNumbers) {
      const existing = slicesByNumber.get(sliceNumber);
      if (!existing || new Date(entry.finishedAt).getTime() > new Date(existing.completedAt).getTime()) {
        slicesByNumber.set(sliceNumber, { completedAt: entry.finishedAt, durationMs: entry.durationMs });
      }
    }
  }

  const completedSlices = [...slicesByNumber.entries()]
    .map(([sliceNumber, value]) => ({ sliceNumber, ...value }))
    .sort((left, right) => new Date(left.completedAt).getTime() - new Date(right.completedAt).getTime());
  const completedSliceCount = completedSlices.length;
  const firstSliceCompletedAt = completedSlices[0]?.completedAt;
  const latestSliceCompletedAt = completedSlices[completedSlices.length - 1]?.completedAt;
  const firstTime = firstSliceCompletedAt ? new Date(firstSliceCompletedAt).getTime() : Number.NaN;
  const latestTime = latestSliceCompletedAt ? new Date(latestSliceCompletedAt).getTime() : Number.NaN;
  const averageCalendarMsPerSlice =
    completedSliceCount > 1 && !Number.isNaN(firstTime) && !Number.isNaN(latestTime)
      ? Math.max(0, latestTime - firstTime) / (completedSliceCount - 1)
      : undefined;
  const durations = completedSlices
    .map((slice) => slice.durationMs)
    .filter((duration): duration is number => duration !== undefined && Number.isFinite(duration) && duration > 0);
  const recentDurations = durations.slice(-25);
  const averageActiveMsPerSlice = durations.length ? durations.reduce((total, duration) => total + duration, 0) / durations.length : undefined;
  const recentAverageActiveMsPerSlice = recentDurations.length
    ? recentDurations.reduce((total, duration) => total + duration, 0) / recentDurations.length
    : averageActiveMsPerSlice;
  const estimatedRemainingSliceEquivalents =
    summary.weightedAveragePercent > 0 ? completedSliceCount * (summary.estimatedRemainingPercent / summary.weightedAveragePercent) : undefined;
  const estimatedRemainingActiveMs =
    estimatedRemainingSliceEquivalents !== undefined && recentAverageActiveMsPerSlice !== undefined
      ? estimatedRemainingSliceEquivalents * recentAverageActiveMsPerSlice
      : undefined;
  const estimatedCompletionDate =
    estimatedRemainingActiveMs !== undefined ? new Date(Date.now() + estimatedRemainingActiveMs).toISOString() : undefined;

  return {
    basis: "Weighted remaining scope converted into slice-equivalent work using completed slice count, then multiplied by recent explicit slice durations from the changelog.",
    confidence: "low",
    completedSliceCount,
    firstSliceCompletedAt,
    latestSliceCompletedAt,
    averageCalendarMsPerSlice: averageCalendarMsPerSlice ? Math.round(averageCalendarMsPerSlice) : undefined,
    averageActiveMsPerSlice: averageActiveMsPerSlice ? Math.round(averageActiveMsPerSlice) : undefined,
    recentAverageActiveMsPerSlice: recentAverageActiveMsPerSlice ? Math.round(recentAverageActiveMsPerSlice) : undefined,
    estimatedRemainingSliceEquivalents:
      estimatedRemainingSliceEquivalents !== undefined ? roundProgressValue(estimatedRemainingSliceEquivalents) : undefined,
    estimatedRemainingActiveMs: estimatedRemainingActiveMs !== undefined ? Math.round(estimatedRemainingActiveMs) : undefined,
    estimatedCompletionDate,
    explanation:
      "This is a planning signal, not a delivery promise. It can move down when slices land and up when newly discovered scope increases the remaining weighted work."
  };
}

async function readGitCommitInfo(maxCount?: number): Promise<GitCommitInfo[]> {
  return await new Promise((resolve) => {
    const args = [
      "log",
      "--all",
      ...(maxCount ? [`--max-count=${maxCount}`] : []),
      "--numstat",
      "--format=%x1e%H%x1f%h%x1f%aI%x1f%s"
    ];
    const git = spawn("git", args, {
      cwd: repoRoot,
      shell: false,
      windowsHide: true
    });
    let stdout = "";
    const timer = setTimeout(() => {
      git.kill();
      resolve([]);
    }, 20000);

    git.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    git.on("error", () => {
      clearTimeout(timer);
      resolve([]);
    });
    git.on("close", (exitCode) => {
      clearTimeout(timer);
      if (exitCode !== 0) {
        resolve([]);
        return;
      }

      resolve(
        stdout
          .split("\x1e")
          .map((block) => block.trim())
          .filter(Boolean)
          .flatMap((block) => {
            const [header, ...numstatLines] = block.split(/\r?\n/);
            const [fullHash, shortHash, authoredAt, subject] = header.split("\x1f");
            if (!fullHash || !shortHash || !authoredAt || !subject) {
              return [];
            }

            const filePaths = new Set<string>();
            let linesAdded = 0;
            let linesDeleted = 0;
            let binaryFiles = 0;

            for (const line of numstatLines) {
              const [added, deleted, filePath] = line.split("\t");
              if (!filePath) {
                continue;
              }

              filePaths.add(filePath);
              if (added === "-" || deleted === "-") {
                binaryFiles += 1;
                continue;
              }

              linesAdded += Number.parseInt(added, 10) || 0;
              linesDeleted += Number.parseInt(deleted, 10) || 0;
            }

            return [
              {
                fullHash,
                shortHash,
                authoredAt,
                subject,
                changedFiles: [...filePaths],
                codeChangeStats: {
                  filesChanged: filePaths.size,
                  linesAdded,
                  linesDeleted,
                  netLines: linesAdded - linesDeleted,
                  totalChurn: linesAdded + linesDeleted,
                  binaryFiles,
                  source: "git" as const,
                  commits: [shortHash]
                }
              }
            ];
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

function aggregateCodeChangeStats(resolvedCommits: GitCommitInfo[], source: CodeChangeStats["source"], note: string): CodeChangeStats | undefined {
  if (!resolvedCommits.length) {
    return undefined;
  }

  const changedFiles = new Set(resolvedCommits.flatMap((commit) => commit.changedFiles));
  return {
    filesChanged: changedFiles.size,
    linesAdded: resolvedCommits.reduce((total, commit) => total + commit.codeChangeStats.linesAdded, 0),
    linesDeleted: resolvedCommits.reduce((total, commit) => total + commit.codeChangeStats.linesDeleted, 0),
    netLines: resolvedCommits.reduce((total, commit) => total + commit.codeChangeStats.netLines, 0),
    totalChurn: resolvedCommits.reduce((total, commit) => total + commit.codeChangeStats.totalChurn, 0),
    binaryFiles: resolvedCommits.reduce((total, commit) => total + commit.codeChangeStats.binaryFiles, 0),
    source,
    commits: resolvedCommits.map((commit) => commit.shortHash),
    note
  };
}

const changelogTitleStopWords = new Set([
  "a",
  "add",
  "added",
  "and",
  "for",
  "implement",
  "implemented",
  "modernization",
  "modernized",
  "openemr",
  "parity",
  "readiness",
  "record",
  "slice",
  "the",
  "this",
  "with"
]);

function tokenizeChangelogText(value: string) {
  return cleanMarkdownText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !/^\d+$/.test(token) && !changelogTitleStopWords.has(token));
}

function scoreCommitSubjectForEntry(entry: ChangelogEntry, commit: GitCommitInfo) {
  const titleTokens = new Set(tokenizeChangelogText(entry.title));
  const subjectTokens = new Set(tokenizeChangelogText(commit.subject));
  if (!titleTokens.size || !subjectTokens.size) {
    return 0;
  }

  const overlap = [...titleTokens].filter((token) => subjectTokens.has(token)).length;
  return overlap >= 2 ? overlap / Math.max(titleTokens.size, subjectTokens.size) : 0;
}

function inferCommitForEntry(entry: ChangelogEntry, commits: GitCommitInfo[]) {
  const commitLabel = entry.commit.trim().toLowerCase();
  if (!["this commit", "current slice commit"].includes(commitLabel)) {
    return undefined;
  }

  const candidates = commits
    .map((commit) => ({ commit, score: scoreCommitSubjectForEntry(entry, commit) }))
    .filter((candidate) => candidate.score >= 0.45)
    .sort((left, right) => right.score - left.score);

  if (!candidates.length) {
    return undefined;
  }

  const [best, second] = candidates;
  return !second || best.score - second.score >= 0.1 ? best.commit : undefined;
}

function resolveEntryCommit(entry: ChangelogEntry, commits: GitCommitInfo[]): ResolvedEntryCommit | undefined {
  const explicitCommits = extractCommitHashes(entry.commit)
    .map((hash) => resolveCommitInfo(hash, commits))
    .filter((commit): commit is GitCommitInfo => Boolean(commit));
  if (explicitCommits.length) {
    return {
      commit: explicitCommits[explicitCommits.length - 1],
      source: "documented"
    };
  }

  const inferredCommit = inferCommitForEntry(entry, commits);
  return inferredCommit
    ? {
        commit: inferredCommit,
        source: "git-inferred"
      }
    : undefined;
}

function resolveEntryCodeChangeStats(entry: ChangelogEntry, commits: GitCommitInfo[], resolvedCommit?: ResolvedEntryCommit) {
  if (entry.codeChangeStats) {
    return resolvedCommit && !entry.codeChangeStats.commits.length
      ? {
          ...entry.codeChangeStats,
          commits: [resolvedCommit.commit.shortHash]
        }
      : entry.codeChangeStats;
  }

  const explicitCommits = extractCommitHashes(entry.commit)
    .map((hash) => resolveCommitInfo(hash, commits))
    .filter((commit): commit is GitCommitInfo => Boolean(commit));
  const explicitStats = aggregateCodeChangeStats(explicitCommits, "git", "Computed from explicit changelog commit hash metadata.");
  if (explicitStats) {
    return explicitStats;
  }

  const inferredCommit = resolvedCommit?.source === "git-inferred" ? resolvedCommit.commit : inferCommitForEntry(entry, commits);
  return inferredCommit
    ? aggregateCodeChangeStats([inferredCommit], "git-inferred", `Inferred from Git commit subject "${inferredCommit.subject}".`)
    : undefined;
}

function resolveTimelineDate(entry: ChangelogEntry, completedAt?: string) {
  const finishedDate = extractTimestampDate(entry.finishedAt);
  if (finishedDate) {
    return { timelineDate: finishedDate, timelineDateSource: "finishedAt" as const };
  }

  const completedDate = extractTimestampDate(completedAt);
  if (completedDate) {
    return { timelineDate: completedDate, timelineDateSource: "completedAt" as const };
  }

  const startedDate = extractTimestampDate(entry.startedAt);
  if (startedDate) {
    return { timelineDate: startedDate, timelineDateSource: "startedAt" as const };
  }

  return { timelineDate: entry.date, timelineDateSource: "sectionDate" as const };
}

function getChangelogEntrySortTime(entry: ChangelogEntry) {
  for (const value of [entry.finishedAt, entry.completedAt, entry.startedAt]) {
    if (!value) {
      continue;
    }
    const time = new Date(value).getTime();
    if (!Number.isNaN(time)) {
      return time;
    }
  }

  const fallbackDate = entry.timelineDate ?? entry.date;
  const fallbackTime = new Date(`${fallbackDate}T12:00:00`).getTime();
  return Number.isNaN(fallbackTime) ? 0 : fallbackTime;
}

function compareChangelogEntries(left: ChangelogEntry, right: ChangelogEntry) {
  const timeDifference = getChangelogEntrySortTime(left) - getChangelogEntrySortTime(right);
  if (timeDifference !== 0) {
    return timeDifference;
  }

  return Number.parseInt(left.id, 10) - Number.parseInt(right.id, 10);
}

function enrichChangelogEntries(entries: ChangelogEntry[], commits: GitCommitInfo[]) {
  const enrichedEntries = entries.map((entry) => {
    const resolvedCommit = resolveEntryCommit(entry, commits);
    const completionCommit = resolvedCommit?.commit;
    const completedAt = entry.finishedAt ?? completionCommit?.authoredAt;
    const timelineDate = resolveTimelineDate(entry, completedAt);

    return {
      ...entry,
      completedAt,
      ...timelineDate,
      completedCommit: completionCommit?.shortHash,
      completedCommitSource: resolvedCommit?.source,
      completedCommitSubject: completionCommit?.subject,
      durationMs: entry.durationMs ?? calculateDurationMs(entry.startedAt, entry.finishedAt),
      codeChangeStats: resolveEntryCodeChangeStats(entry, commits, resolvedCommit)
    };
  });

  let previousCompletedAt: string | undefined;

  return enrichedEntries.sort(compareChangelogEntries).map((entry) => {
    const previousTime = previousCompletedAt ? new Date(previousCompletedAt).getTime() : Number.NaN;
    const completedTime = entry.completedAt ? new Date(entry.completedAt).getTime() : Number.NaN;
    const elapsedSincePreviousMs =
      entry.completedAt && previousCompletedAt && !Number.isNaN(previousTime) && !Number.isNaN(completedTime)
        ? Math.max(0, completedTime - previousTime)
        : undefined;

    if (entry.completedAt) {
      previousCompletedAt = entry.completedAt;
    }

    return {
      ...entry,
      elapsedSincePreviousMs
    };
  });
}

function getChangelogSourcePath() {
  return path.relative(repoRoot, changelogPath).replaceAll("\\", "/");
}

async function readParsedChangelogEntries() {
  const stats = await fs.stat(changelogPath);
  if (parsedChangelogCache?.mtimeMs === stats.mtimeMs) {
    return parsedChangelogCache;
  }

  const text = await fs.readFile(changelogPath, "utf8");
  parsedChangelogCache = {
    mtimeMs: stats.mtimeMs,
    updatedAt: stats.mtime.toISOString(),
    entries: parseProjectChangelog(text)
  };
  if (changelogCache?.mtimeMs !== stats.mtimeMs) {
    changelogCache = null;
  }
  return parsedChangelogCache;
}

async function readCachedChangelogEntries() {
  const parsed = await readParsedChangelogEntries();
  if (changelogCache?.mtimeMs === parsed.mtimeMs) {
    return changelogCache;
  }

  if (changelogCacheBuild?.mtimeMs === parsed.mtimeMs) {
    return await changelogCacheBuild.promise;
  }

  const buildPromise = (async () => {
    const commits = await readGitCommitInfo(changelogGitEnrichmentCommitLimit);
    const cache = {
      mtimeMs: parsed.mtimeMs,
      updatedAt: parsed.updatedAt,
      commitScanLimit: changelogGitEnrichmentCommitLimit,
      entries: enrichChangelogEntries(parsed.entries, commits)
    };
    changelogCache = cache;
    return cache;
  })();
  changelogCacheBuild = { mtimeMs: parsed.mtimeMs, promise: buildPromise };

  try {
    return await buildPromise;
  } finally {
    if (changelogCacheBuild?.promise === buildPromise) {
      changelogCacheBuild = null;
    }
  }
}

function normalizeChangelogOffset(value: unknown) {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeChangelogLimit(value: unknown, fallback: number) {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return Math.min(Math.max(limit, 1), 500);
}

function normalizeChangelogOrder(value: unknown): ChangelogOrder {
  return value === "desc" ? "desc" : "asc";
}

async function readProjectChangelog({ offset = 0, limit, order = "asc" }: { offset?: number; limit?: number; order?: ChangelogOrder } = {}): Promise<ProjectChangelog> {
  const cached = await readCachedChangelogEntries();
  const orderedEntries = order === "desc" ? [...cached.entries].reverse() : cached.entries;
  const normalizedOffset = Math.min(Math.max(offset, 0), orderedEntries.length);
  const normalizedLimit = limit === undefined ? orderedEntries.length : Math.min(Math.max(limit, 1), 500);
  const entries = orderedEntries.slice(normalizedOffset, normalizedOffset + normalizedLimit);
  const nextOffset = normalizedOffset + entries.length;
  const hasMore = nextOffset < orderedEntries.length;

  return {
    sourcePath: getChangelogSourcePath(),
    updatedAt: cached.updatedAt,
    totalEntries: cached.entries.length,
    offset: normalizedOffset,
    limit: normalizedLimit,
    returnedEntries: entries.length,
    hasMore,
    nextOffset: hasMore ? nextOffset : undefined,
    order,
    entries
  };
}

async function readProjectChangelogSummary(): Promise<ProjectChangelogSummary> {
  const parsed = await readParsedChangelogEntries();
  const entries = enrichChangelogEntries(parsed.entries, []);
  const latestEntry = entries[entries.length - 1];
  return {
    sourcePath: getChangelogSourcePath(),
    updatedAt: parsed.updatedAt,
    totalEntries: entries.length,
    latestEntry: latestEntry
      ? {
          id: latestEntry.id,
          title: latestEntry.title,
          date: latestEntry.date,
          startedAt: latestEntry.startedAt,
          finishedAt: latestEntry.finishedAt,
          timelineDate: latestEntry.timelineDate,
          timelineDateSource: latestEntry.timelineDateSource,
          commit: latestEntry.commit
        }
      : undefined
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

function summarizeRuntime(containers: ContainerStatus[], result: CommandResult): RuntimeSummary {
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

function commandOutput(result: CommandResult) {
  return [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
}

function isDockerDesktopLikelyUnavailable(result: CommandResult) {
  if (result.exitCode === 0) {
    return false;
  }

  const output = commandOutput(result).toLowerCase();
  return [
    "cannot connect to the docker daemon",
    "docker daemon is not running",
    "error during connect",
    "dockerdesktoplinuxengine",
    "dockerdesktopvm",
    "docker desktop",
    "open //./pipe/docker",
    "open \\\\.\\pipe\\docker",
    "the system cannot find the file specified"
  ].some((marker) => output.includes(marker));
}

function buildRuntimeGuidance(
  managedApp: ManagedApp,
  runtime: RuntimeSummary,
  health: { ok: boolean; statusCode: number | null; durationMs: number; error?: string },
  containers: ContainerStatus[],
  statusResult: CommandResult
): RuntimeGuidance | null {
  if (managedApp.kind !== "docker-compose") {
    return null;
  }

  const dockerDesktopLikelyUnavailable = isDockerDesktopLikelyUnavailable(statusResult);
  if (dockerDesktopLikelyUnavailable) {
    return {
      severity: "error",
      title: "Docker Desktop is not reachable",
      message: `${managedApp.name} is configured to run through Docker Compose, but Docker is not responding. Start Docker Desktop, wait until the engine is running, then use Start all apps or the app Start button.`,
      detail: preview(commandOutput(statusResult) || runtime.detail, 420),
      primaryAction: "start",
      canStartFromWorkbench: true,
      dockerDesktopLikelyUnavailable
    };
  }

  if (runtime.state === "stopped") {
    return {
      severity: "warning",
      title: `${managedApp.name} is stopped`,
      message: "Docker Compose reports no running containers for this app. Use Start to run the configured compose stack.",
      detail: runtime.detail,
      primaryAction: "start",
      canStartFromWorkbench: true,
      dockerDesktopLikelyUnavailable
    };
  }

  if (runtime.state === "partial") {
    return {
      severity: "warning",
      title: `${managedApp.name} is partially running`,
      message: "Some compose services are not running. Use Start to recreate missing containers or Restart if the stack is wedged.",
      detail: runtime.detail,
      primaryAction: "start",
      canStartFromWorkbench: true,
      dockerDesktopLikelyUnavailable
    };
  }

  if (runtime.state === "unhealthy" || runtime.state === "error") {
    return {
      severity: "error",
      title: `${managedApp.name} runtime needs attention`,
      message: "Docker Compose is reachable, but the app is not in a healthy runtime state. Restart the app and then check logs if it remains unhealthy.",
      detail: runtime.detail,
      primaryAction: "restart",
      canStartFromWorkbench: true,
      dockerDesktopLikelyUnavailable
    };
  }

  if (containers.length > 0 && !health.ok) {
    return {
      severity: "warning",
      title: `${managedApp.name} is running but not reachable yet`,
      message: `Compose containers are running, but the health endpoint has not responded successfully at ${managedApp.healthUrl}. Wait briefly, refresh, or restart the app if it stays unavailable.`,
      detail: health.error ?? `HTTP ${health.statusCode ?? "unavailable"} in ${health.durationMs} ms`,
      primaryAction: "restart",
      canStartFromWorkbench: true,
      dockerDesktopLikelyUnavailable
    };
  }

  return null;
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

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function average(values: number[]) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  return finiteValues.length ? finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length : 0;
}

function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeRunReportLinks(value: unknown) {
  const reports = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    runJson: typeof reports.runJson === "string" ? reports.runJson : "",
    playwrightJson: typeof reports.playwrightJson === "string" ? reports.playwrightJson : "",
    junit: typeof reports.junit === "string" ? reports.junit : "",
    html: typeof reports.html === "string" ? reports.html : ""
  };
}

function isVisualArtifactFile(filePath: string) {
  return [".png", ".jpg", ".jpeg", ".webp"].includes(path.extname(filePath).toLowerCase());
}

function classifyVisualArtifact(filePath: string): VisualArtifact["kind"] {
  const normalized = filePath.replaceAll("\\", "/").toLowerCase();
  if (normalized.includes("/test-results/")) {
    return "test-screenshot";
  }
  if (normalized.includes("/html-report/data/")) {
    return "html-report-image";
  }
  return "image";
}

function toReadableArtifactProjectPath(filePath: string) {
  if (!filePath || filePath.includes("\0")) {
    return "";
  }

  const normalizedInput = filePath.replaceAll("\\", "/");
  const absolutePath = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(repoRoot, normalizedInput);
  if (!readableArtifactRoots.some((root) => isPathInside(absolutePath, root))) {
    return "";
  }

  return path.relative(repoRoot, absolutePath).replaceAll("\\", "/");
}

function isTextAttachment(contentType: string, filePath: string) {
  const normalizedType = contentType.toLowerCase();
  const extension = path.extname(filePath).toLowerCase();
  return normalizedType.startsWith("text/")
    || normalizedType.includes("json")
    || normalizedType.includes("xml")
    || [".txt", ".md", ".json", ".xml", ".csv", ".log"].includes(extension);
}

async function readAttachmentPreview(projectPath: string, contentType: string, maxBytes = 4096) {
  if (!projectPath || !isTextAttachment(contentType, projectPath)) {
    return { sizeBytes: 0, preview: "", previewTruncated: false };
  }

  try {
    const resolvedPath = resolveReadableArtifactPath(projectPath);
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      return { sizeBytes: 0, preview: "", previewTruncated: false };
    }
    const handle = await fs.open(resolvedPath, "r");
    try {
      const byteCount = Math.min(stats.size, maxBytes);
      const buffer = Buffer.alloc(byteCount);
      await handle.read(buffer, 0, byteCount, 0);
      return {
        sizeBytes: stats.size,
        preview: buffer.toString("utf8").replace(/\u0000/g, "").trim(),
        previewTruncated: stats.size > maxBytes
      };
    } finally {
      await handle.close();
    }
  } catch {
    return { sizeBytes: 0, preview: "", previewTruncated: false };
  }
}

async function normalizeProbeAttachments(results: unknown[], limit = 4): Promise<ProbeAttachmentDetail[]> {
  const rawAttachments = results
    .flatMap((resultValue) => getArray(getRecord(resultValue).attachments))
    .map((attachmentValue) => getRecord(attachmentValue))
    .map((attachment) => ({
      name: typeof attachment.name === "string" ? attachment.name : "attachment",
      contentType: typeof attachment.contentType === "string" ? attachment.contentType : "",
      path: typeof attachment.path === "string" ? toReadableArtifactProjectPath(attachment.path) : ""
    }))
    .filter((attachment) => attachment.path)
    .slice(0, limit);

  return Promise.all(rawAttachments.map(async (attachment) => {
    const preview = await readAttachmentPreview(attachment.path, attachment.contentType);
    return { ...attachment, ...preview };
  }));
}

async function collectVisualArtifacts(runArtifactDirectory: string, limit = 8): Promise<VisualArtifact[]> {
  const visualArtifacts: VisualArtifact[] = [];
  const pendingDirectories = [runArtifactDirectory];

  while (pendingDirectories.length && visualArtifacts.length < limit) {
    const currentDirectory = pendingDirectories.shift();
    if (!currentDirectory) {
      continue;
    }

    let entries: import("node:fs").Dirent[] = [];
    try {
      entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    } catch {
      continue;
    }

    await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(currentDirectory, entry.name);
      if (visualArtifacts.length >= limit) {
        return;
      }
      if (entry.isDirectory()) {
        pendingDirectories.push(entryPath);
        return;
      }
      if (!entry.isFile() || !isVisualArtifactFile(entryPath)) {
        return;
      }

      try {
        const stats = await fs.stat(entryPath);
        visualArtifacts.push({
          path: path.relative(repoRoot, entryPath).replaceAll("\\", "/"),
          name: entry.name,
          kind: classifyVisualArtifact(entryPath),
          sizeBytes: stats.size,
          modifiedAt: stats.mtime.toISOString()
        });
      } catch {
        // Ignore artifacts that disappear while the Workbench is refreshing.
      }
    }));
  }

  const kindRank: Record<VisualArtifact["kind"], number> = {
    "test-screenshot": 0,
    "html-report-image": 1,
    image: 2
  };

  return visualArtifacts
    .sort((left, right) => kindRank[left.kind] - kindRank[right.kind] || new Date(right.modifiedAt).getTime() - new Date(left.modifiedAt).getTime() || left.name.localeCompare(right.name))
    .slice(0, limit);
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readErrorMessages(value: unknown) {
  return getArray(value)
    .map((item) => getRecord(item))
    .map((item) => {
      if (typeof item.message === "string") {
        return item.message;
      }
      if (typeof item.stack === "string") {
        return item.stack.split(/\r?\n/)[0] ?? item.stack;
      }
      return "";
    })
    .filter((item) => item.length > 0)
    .slice(0, 3);
}

async function collectProbeDetailsFromPlaywrightReport(report: unknown, limit = 20): Promise<ProbeDetail[]> {
  const probes: ProbeDetail[] = [];

  async function visitSuite(value: unknown, inheritedFile = "") {
    const suite = getRecord(value);
    const suiteFile = typeof suite.file === "string" ? suite.file : inheritedFile;

    for (const specValue of getArray(suite.specs)) {
      if (probes.length >= limit) {
        break;
      }
      const spec = getRecord(specValue);
      const tests = getArray(spec.tests);
      const firstTest = getRecord(tests[0]);
      const results: unknown[] = tests.flatMap((testValue) => getArray(getRecord(testValue).results));
      const firstResult = getRecord(results[0]);
      const durationMs = results.reduce<number>((total, resultValue) => total + toNumber(getRecord(resultValue).duration), 0);
      const errorMessages = results.flatMap((resultValue) => readErrorMessages(getRecord(resultValue).errors)).slice(0, 3);
      const attachmentCount = results.reduce<number>((total, resultValue) => total + getArray(getRecord(resultValue).attachments).length, 0);
      const attachments = await normalizeProbeAttachments(results);

      probes.push({
        title: typeof spec.title === "string" ? spec.title : "Untitled probe",
        file: typeof spec.file === "string" ? spec.file : suiteFile,
        line: toNumber(spec.line),
        column: toNumber(spec.column),
        status: typeof firstTest.status === "string"
          ? firstTest.status
          : typeof firstResult.status === "string" ? firstResult.status : Boolean(spec.ok) ? "expected" : "unknown",
        expectedStatus: typeof firstTest.expectedStatus === "string" ? firstTest.expectedStatus : "",
        project: typeof firstTest.projectName === "string"
          ? firstTest.projectName
          : typeof firstTest.projectId === "string" ? firstTest.projectId : "",
        durationMs,
        retry: toNumber(firstResult.retry),
        tags: toStringArray(spec.tags),
        errorMessages,
        attachmentCount,
        attachments
      });
    }

    for (const childSuite of getArray(suite.suites)) {
      if (probes.length >= limit) {
        break;
      }
      await visitSuite(childSuite, suiteFile);
    }
  }

  for (const suite of getArray(getRecord(report).suites)) {
    await visitSuite(suite);
    if (probes.length >= limit) {
      break;
    }
  }

  return probes.slice(0, limit);
}

function normalizeDifferenceText(value: unknown) {
  if (typeof value === "string") {
    return { path: "", message: value, serialized: value };
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const pathValue = typeof record.path === "string" ? record.path : "";
    const messageValue = typeof record.message === "string" ? record.message : "";
    return {
      path: pathValue,
      message: messageValue,
      serialized: JSON.stringify(value)
    };
  }

  return { path: "", message: "", serialized: JSON.stringify(value) };
}

function isAcceptedDifferenceActive(entry: AcceptedDifferenceEntry, now = new Date()) {
  if (entry.status !== "accepted") {
    return false;
  }
  if (!entry.expiresAt) {
    return true;
  }
  const expiresAt = new Date(entry.expiresAt);
  return Number.isNaN(expiresAt.getTime()) || expiresAt >= now;
}

function acceptedDifferenceMatches(
  entry: AcceptedDifferenceEntry,
  comparison: { selectionKind: string; selectionId: string },
  difference: unknown
) {
  if (!isAcceptedDifferenceActive(entry)) {
    return false;
  }
  if (entry.selectionKind && entry.selectionKind !== comparison.selectionKind) {
    return false;
  }
  if (entry.selectionId && entry.selectionId !== comparison.selectionId) {
    return false;
  }

  const normalized = normalizeDifferenceText(difference);
  if (entry.path && normalized.path !== entry.path) {
    return false;
  }
  if (entry.messageIncludes) {
    const haystack = `${normalized.message}\n${normalized.serialized}`.toLowerCase();
    if (!haystack.includes(entry.messageIncludes.toLowerCase())) {
      return false;
    }
  }

  return Boolean(entry.path || entry.messageIncludes || entry.selectionId || entry.selectionKind);
}

function buildDifferenceAcceptanceSummary(
  differences: unknown[],
  comparison: { selectionKind: string; selectionId: string },
  acceptedDifferences: AcceptedDifferenceEntry[]
): DifferenceAcceptanceSummary {
  const differenceAcceptances = differences.map((difference, differenceIndex) => {
    const matches = acceptedDifferences.filter((entry) => acceptedDifferenceMatches(entry, comparison, difference));
    return {
      differenceIndex,
      accepted: matches.length > 0,
      acceptedDifferenceIds: matches.map((entry) => entry.id),
      reasons: matches.map((entry) => entry.reason)
    };
  });
  const acceptedDifferenceIds = Array.from(new Set(differenceAcceptances.flatMap((acceptance) => acceptance.acceptedDifferenceIds)));

  return {
    acceptedCount: differenceAcceptances.filter((acceptance) => acceptance.accepted).length,
    unacceptedCount: differenceAcceptances.filter((acceptance) => !acceptance.accepted).length,
    acceptedDifferenceIds,
    differenceAcceptances
  };
}

async function collectProbeDetails(playwrightReportPath: string): Promise<ProbeDetail[]> {
  if (!playwrightReportPath) {
    return [];
  }

  try {
    const resolvedPath = resolveReadableArtifactPath(playwrightReportPath);
    const report = await readJsonIfExists(resolvedPath);
    return collectProbeDetailsFromPlaywrightReport(report);
  } catch {
    return [];
  }
}

async function getExistingArtifactPath(projectPath: string) {
  if (!projectPath) {
    return "";
  }

  try {
    const resolvedPath = resolveReadableArtifactPath(projectPath);
    const stats = await fs.stat(resolvedPath);
    return stats.isFile() ? projectPath : "";
  } catch {
    return "";
  }
}

async function normalizeExistingRunReportLinks(value: unknown) {
  const reports = normalizeRunReportLinks(value);
  const [runJson, playwrightJson, junit, html] = await Promise.all([
    getExistingArtifactPath(reports.runJson),
    getExistingArtifactPath(reports.playwrightJson),
    getExistingArtifactPath(reports.junit),
    getExistingArtifactPath(reports.html)
  ]);

  return { runJson, playwrightJson, junit, html };
}

function normalizeComparisonSide(value: unknown): ParityComparisonSide | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const side = value as Record<string, unknown>;
  const stats = side.stats && typeof side.stats === "object" ? (side.stats as Record<string, unknown>) : {};
  const reports = side.reports && typeof side.reports === "object" ? side.reports : {};
  return {
    target: typeof side.target === "string" ? side.target : "unknown",
    runId: typeof side.runId === "string" ? side.runId : "unknown",
    path: typeof side.path === "string" ? side.path : "",
    exists: Boolean(side.exists),
    passed: Boolean(side.passed),
    selectedSuites: toStringArray(side.selectedSuites),
    stats: {
      expected: toNumber(stats.expected),
      skipped: toNumber(stats.skipped),
      unexpected: toNumber(stats.unexpected),
      flaky: toNumber(stats.flaky),
      duration: toNumber(stats.duration)
    },
    reports: normalizeRunReportLinks(reports),
    visualArtifacts: [],
    probeDetails: []
  };
}

async function enrichComparisonSide(side: ParityComparisonSide) {
  if (!side.exists || !side.path) {
    return side;
  }

  try {
    const runSummaryPath = resolveReadableArtifactPath(side.path);
    const runSummary = await readJsonIfExists(runSummaryPath);
    const runSummaryObject = runSummary && typeof runSummary === "object" ? (runSummary as Record<string, unknown>) : {};
    const reports = runSummaryObject.reports && typeof runSummaryObject.reports === "object"
      ? await normalizeExistingRunReportLinks(runSummaryObject.reports)
      : side.reports;
    const runArtifactDirectory = path.dirname(runSummaryPath);
    const [visualArtifacts, probeDetails] = await Promise.all([
      collectVisualArtifacts(runArtifactDirectory),
      collectProbeDetails(reports.playwrightJson)
    ]);
    return { ...side, reports, visualArtifacts, probeDetails };
  } catch {
    return side;
  }
}

async function normalizeParityComparison(value: unknown, artifactDirectory: string, acceptedDifferences: AcceptedDifferenceEntry[]): Promise<ParityComparisonReport | null> {
  if (!value || typeof value !== "object") {
    return null;
  }

  const comparison = value as Record<string, unknown>;
  const left = normalizeComparisonSide(comparison.left);
  const right = normalizeComparisonSide(comparison.right);
  if (!left || !right || typeof comparison.comparisonId !== "string") {
    return null;
  }

  const reports = comparison.reports && typeof comparison.reports === "object" ? (comparison.reports as Record<string, unknown>) : {};
  const differences = Array.isArray(comparison.differences) ? comparison.differences : [];
  const startedAt = typeof comparison.startedAt === "string" ? comparison.startedAt : "";
  const finishedAt = typeof comparison.finishedAt === "string" ? comparison.finishedAt : "";
  const startedTime = new Date(startedAt).getTime();
  const finishedTime = new Date(finishedAt).getTime();
  const selectionKind = typeof comparison.selectionKind === "string" ? comparison.selectionKind : "unknown";
  const selectionId = typeof comparison.selectionId === "string" ? comparison.selectionId : "unknown";
  const [enrichedLeft, enrichedRight] = await Promise.all([enrichComparisonSide(left), enrichComparisonSide(right)]);
  const acceptance = buildDifferenceAcceptanceSummary(differences, { selectionKind, selectionId }, acceptedDifferences);

  return {
    comparisonId: comparison.comparisonId,
    status: typeof comparison.status === "string" ? comparison.status : "unknown",
    passed: Boolean(comparison.passed),
    selectionKind,
    selectionId,
    left: enrichedLeft,
    right: enrichedRight,
    differences,
    differenceCount: differences.length,
    acceptance,
    reports: {
      comparisonJson: typeof reports.comparisonJson === "string" ? reports.comparisonJson : ""
    },
    artifactDirectory,
    startedAt,
    finishedAt,
    durationMs: Number.isNaN(startedTime) || Number.isNaN(finishedTime) ? 0 : Math.max(0, finishedTime - startedTime)
  };
}

async function readParityComparisons(limit = 20) {
  try {
    const [entries, acceptedDifferencesConfig] = await Promise.all([
      fs.readdir(parityComparisonsRoot, { withFileTypes: true }),
      readAcceptedDifferences().catch(() => ({ version: "missing", lastUpdated: "", entries: [] }))
    ]);
    const acceptedDifferences = acceptedDifferencesConfig.entries;
    const comparisonDirectories = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const artifactDirectory = path.join(parityComparisonsRoot, entry.name);
          const comparisonPath = path.join(artifactDirectory, "comparison.json");
          const stats = await fs.stat(comparisonPath).catch(() => null);
          return stats ? { entry, modifiedAt: stats.mtimeMs } : null;
        })
    );
    const candidates = await Promise.all(
      comparisonDirectories
        .filter((candidate): candidate is { entry: import("node:fs").Dirent; modifiedAt: number } => candidate !== null)
        .sort((left, right) => right.modifiedAt - left.modifiedAt)
        .slice(0, limit)
        .map(async ({ entry, modifiedAt }) => {
          const artifactDirectory = path.join(parityComparisonsRoot, entry.name);
          const comparisonPath = path.join(artifactDirectory, "comparison.json");
          const json = await readJsonIfExists(comparisonPath);
          const relativeArtifactDirectory = path.relative(repoRoot, artifactDirectory).replaceAll("\\", "/");
          const comparison = await normalizeParityComparison(json, relativeArtifactDirectory, acceptedDifferences);
          return comparison ? { comparison, modifiedAt } : null;
        })
    );

    return candidates
      .filter((candidate): candidate is { comparison: ParityComparisonReport; modifiedAt: number } => candidate !== null)
      .sort((left, right) => {
        const rightTime = new Date(right.comparison.finishedAt || right.comparison.startedAt).getTime();
        const leftTime = new Date(left.comparison.finishedAt || left.comparison.startedAt).getTime();
        return (Number.isNaN(rightTime) ? right.modifiedAt : rightTime) - (Number.isNaN(leftTime) ? left.modifiedAt : leftTime);
      })
      .slice(0, limit)
      .map((candidate) => candidate.comparison);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function normalizeRunTrendPoint(value: unknown, fallbackModifiedAt: number): ParityRunTrendPoint | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const run = value as Record<string, unknown>;
  const stats = run.stats && typeof run.stats === "object" ? (run.stats as Record<string, unknown>) : {};
  const reports = normalizeRunReportLinks(run.reports);
  const runId = typeof run.runId === "string" ? run.runId : "";
  const finishedAt = typeof run.finishedAt === "string" ? run.finishedAt : new Date(fallbackModifiedAt).toISOString();
  if (!runId || !finishedAt) {
    return null;
  }

  return {
    runId,
    target: typeof run.target === "string" ? run.target : "unknown",
    selectionKind: typeof run.selectionKind === "string" ? run.selectionKind : "unknown",
    selectionId: typeof run.selectionId === "string" ? run.selectionId : typeof run.suite === "string" ? run.suite : "unknown",
    selectedSuites: toStringArray(run.selectedSuites),
    passed: Boolean(run.passed),
    expected: toNumber(stats.expected),
    skipped: toNumber(stats.skipped),
    unexpected: toNumber(stats.unexpected),
    flaky: toNumber(stats.flaky),
    durationMs: toNumber(run.durationMs, toNumber(stats.duration)),
    finishedAt,
    artifactPath: reports.runJson || (typeof run.artifactDirectory === "string" ? `${run.artifactDirectory}/run.json` : "")
  };
}

function normalizeComparisonTrendPoint(value: unknown, artifactDirectory: string, acceptedDifferences: AcceptedDifferenceEntry[]): ParityComparisonTrendPoint | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const comparison = value as Record<string, unknown>;
  const left = normalizeComparisonSide(comparison.left);
  const right = normalizeComparisonSide(comparison.right);
  if (!left || !right || typeof comparison.comparisonId !== "string") {
    return null;
  }

  const reports = comparison.reports && typeof comparison.reports === "object" ? (comparison.reports as Record<string, unknown>) : {};
  const differences = Array.isArray(comparison.differences) ? comparison.differences : [];
  const startedAt = typeof comparison.startedAt === "string" ? comparison.startedAt : "";
  const finishedAt = typeof comparison.finishedAt === "string" ? comparison.finishedAt : startedAt;
  const selectionKind = typeof comparison.selectionKind === "string" ? comparison.selectionKind : "unknown";
  const selectionId = typeof comparison.selectionId === "string" ? comparison.selectionId : "unknown";
  const acceptance = buildDifferenceAcceptanceSummary(differences, { selectionKind, selectionId }, acceptedDifferences);

  return {
    comparisonId: comparison.comparisonId,
    selectionKind,
    selectionId,
    status: typeof comparison.status === "string" ? comparison.status : "unknown",
    passed: Boolean(comparison.passed),
    differenceCount: differences.length,
    acceptedDifferenceCount: acceptance.acceptedCount,
    unacceptedDifferenceCount: acceptance.unacceptedCount,
    totalCheckCount: left.stats.expected + right.stats.expected,
    targetDurationMs: left.stats.duration + right.stats.duration,
    finishedAt,
    artifactPath: typeof reports.comparisonJson === "string" ? reports.comparisonJson : `${artifactDirectory}/comparison.json`
  };
}

function buildSelectionSummaries(comparisonTrend: ParityComparisonTrendPoint[]) {
  const groups = new Map<string, ParityComparisonTrendPoint[]>();
  for (const point of comparisonTrend) {
    const key = `${point.selectionKind}:${point.selectionId}`;
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }

  return Array.from(groups.values())
    .map((points) => {
      const sortedPoints = [...points].sort((left, right) => Date.parse(right.finishedAt) - Date.parse(left.finishedAt));
      const latest = sortedPoints[0];
      const matchedComparisons = points.filter((point) => point.passed).length;
      return {
        selectionKind: latest.selectionKind,
        selectionId: latest.selectionId,
        totalComparisons: points.length,
        matchedComparisons,
        differentComparisons: points.length - matchedComparisons,
        passRatePercent: percentage(matchedComparisons, points.length),
        averageDifferenceCount: average(points.map((point) => point.differenceCount)),
        unacceptedDifferenceCount: points.reduce((sum, point) => sum + point.unacceptedDifferenceCount, 0),
        latestStatus: latest.status,
        latestFinishedAt: latest.finishedAt
      };
    })
    .sort((left, right) => {
      if (left.passRatePercent !== right.passRatePercent) {
        return left.passRatePercent - right.passRatePercent;
      }
      if (left.unacceptedDifferenceCount !== right.unacceptedDifferenceCount) {
        return right.unacceptedDifferenceCount - left.unacceptedDifferenceCount;
      }
      return Date.parse(right.latestFinishedAt) - Date.parse(left.latestFinishedAt);
    })
    .slice(0, 12);
}

async function readParityComparisonTrend(limit = 120) {
  try {
    const [entries, acceptedDifferencesConfig] = await Promise.all([
      fs.readdir(parityComparisonsRoot, { withFileTypes: true }),
      readAcceptedDifferences().catch(() => ({ version: "missing", lastUpdated: "", entries: [] }))
    ]);
    const acceptedDifferences = acceptedDifferencesConfig.entries;
    const candidates = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const artifactDirectory = path.join(parityComparisonsRoot, entry.name);
          const comparisonPath = path.join(artifactDirectory, "comparison.json");
          const [json, stats] = await Promise.all([
            readJsonIfExists(comparisonPath),
            fs.stat(comparisonPath).catch(() => null)
          ]);
          const relativeArtifactDirectory = path.relative(repoRoot, artifactDirectory).replaceAll("\\", "/");
          const point = normalizeComparisonTrendPoint(json, relativeArtifactDirectory, acceptedDifferences);
          return point ? { point, modifiedAt: stats?.mtimeMs ?? 0 } : null;
        })
    );

    return candidates
      .filter((candidate): candidate is { point: ParityComparisonTrendPoint; modifiedAt: number } => candidate !== null)
      .sort((left, right) => {
        const rightTime = Date.parse(right.point.finishedAt);
        const leftTime = Date.parse(left.point.finishedAt);
        return (Number.isNaN(rightTime) ? right.modifiedAt : rightTime) - (Number.isNaN(leftTime) ? left.modifiedAt : leftTime);
      })
      .slice(0, limit)
      .map((candidate) => candidate.point);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readParityRunTrend(limit = 120) {
  try {
    const entries = await fs.readdir(parityRunsRoot, { withFileTypes: true });
    const candidates = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const runPath = path.join(parityRunsRoot, entry.name, "run.json");
          const [json, stats] = await Promise.all([
            readJsonIfExists(runPath),
            fs.stat(runPath).catch(() => null)
          ]);
          const point = normalizeRunTrendPoint(json, stats?.mtimeMs ?? 0);
          return point ? { point, modifiedAt: stats?.mtimeMs ?? 0 } : null;
        })
    );

    return candidates
      .filter((candidate): candidate is { point: ParityRunTrendPoint; modifiedAt: number } => candidate !== null)
      .sort((left, right) => {
        const rightTime = Date.parse(right.point.finishedAt);
        const leftTime = Date.parse(left.point.finishedAt);
        return (Number.isNaN(rightTime) ? right.modifiedAt : rightTime) - (Number.isNaN(leftTime) ? left.modifiedAt : leftTime);
      })
      .slice(0, limit)
      .map((candidate) => candidate.point);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readParityReliability(windowSize = 120): Promise<ParityReliabilityReport> {
  const [runTrend, comparisonTrend] = await Promise.all([
    readParityRunTrend(windowSize),
    readParityComparisonTrend(windowSize)
  ]);
  const passedRuns = runTrend.filter((point) => point.passed).length;
  const passedComparisons = comparisonTrend.filter((point) => point.passed).length;

  return {
    generatedAt: new Date().toISOString(),
    windowSize,
    summary: {
      runCount: runTrend.length,
      runPassRatePercent: percentage(passedRuns, runTrend.length),
      failedRunCount: runTrend.length - passedRuns,
      averageRunDurationMs: average(runTrend.map((point) => point.durationMs)),
      comparisonCount: comparisonTrend.length,
      comparisonPassRatePercent: percentage(passedComparisons, comparisonTrend.length),
      differentComparisonCount: comparisonTrend.length - passedComparisons,
      averageComparisonDifferenceCount: average(comparisonTrend.map((point) => point.differenceCount)),
      unacceptedDifferenceCount: comparisonTrend.reduce((sum, point) => sum + point.unacceptedDifferenceCount, 0),
      averageComparisonTargetDurationMs: average(comparisonTrend.map((point) => point.targetDurationMs))
    },
    runTrend,
    comparisonTrend,
    selectionSummaries: buildSelectionSummaries(comparisonTrend)
  };
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
    if (managedApp.id === "modern-ui-claude") {
      return {
        available: false,
        rows: [],
        error: "Modern UI Claude is a frontend-only client; use the modernized OpenEMR app for the backend database profile."
      };
    }

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
  if (managedApp.id === "modern-ui-claude") {
    return {
      available: true,
      source: "modern-ui-claude demo sign-in screens",
      entries: [
        { label: "Staff", username: "admin", password: "pass" },
        { label: "Portal", username: "mod-pat-0004@example.test", password: "PortalPass207!" }
      ]
    };
  }

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

function getDeferredDataProfile(managedApp: ManagedApp) {
  if (managedApp.id === "modern-ui-claude") {
    return {
      available: false,
      rows: [],
      error: "Modern UI Claude is a frontend-only client; use the modernized OpenEMR app for the backend database profile."
    };
  }

  return {
    available: false,
    rows: [],
    error: "Data profile loads with application details."
  };
}

async function getAppSnapshot(managedApp: ManagedApp, options: AppSnapshotOptions = { includeDetails: true }) {
  const statusResult = await runCommand(managedApp, "status", 30000);
  const containers = parseComposeStatus(statusResult.stdout);
  const runtime = summarizeRuntime(containers, statusResult);
  const health = await checkHttp(managedApp.healthUrl);
  const runtimeGuidance = buildRuntimeGuidance(managedApp, runtime, health, containers, statusResult);
  const source = await getSourceInfo(managedApp).catch((error) => ({
    tag: "unknown",
    commit: "unknown",
    matchesExpectedTag: false,
    error: error instanceof Error ? error.message : String(error)
  }));
  const managedTests = managedApp.tests ?? [];
  const managedSeeds = managedApp.seeds ?? [];
  const demoLogin = await getDemoLogin(managedApp);
  const [latestTests, latestSeed, dataProfile] = options.includeDetails
    ? await Promise.all([
      Promise.all(
        managedTests.map(async (test) => [test.id, await readJsonIfExists(resolveProjectPath(test.resultPath))] as const)
      ).then((entries) => Object.fromEntries(entries)),
      managedSeeds[0] ? readJsonIfExists(resolveProjectPath(managedSeeds[0].resultPath)) : Promise.resolve(null),
      getDataProfile(managedApp)
    ])
    : [{}, null, getDeferredDataProfile(managedApp)];
  const latestTest = managedTests[0]
    ? latestTests[managedTests[0].id] ?? null
    : null;

  return {
    detailLevel: options.includeDetails ? "detail" : "summary",
    id: managedApp.id,
    name: managedApp.name,
    stage: managedApp.stage,
    description: managedApp.description,
    kind: managedApp.kind,
    publicUrl: managedApp.publicUrl,
    healthUrl: managedApp.healthUrl,
    documentationPath: managedApp.documentationPath,
    services: managedApp.services ?? [],
    runtime,
    runtimeGuidance,
    health,
    source,
    containers,
    seeds: options.includeDetails ? managedSeeds : [],
    tests: options.includeDetails ? managedTests : [],
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

app.get("/api/apps", async (request, response, next) => {
  try {
    const config = await readConfig();
    const includeDetails = request.query.details === "true";
    response.json({ apps: await Promise.all(config.apps.map((managedApp) => getAppSnapshot(managedApp, { includeDetails }))) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/apps/:appId", async (request, response, next) => {
  try {
    response.json(await getAppSnapshot(await getManagedApp(request.params.appId), { includeDetails: true }));
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

app.post("/api/apps/actions/start-all", async (_request, response, next) => {
  try {
    const config = await readConfig();
    const runnableApps = config.apps.filter((managedApp) => managedApp.kind === "docker-compose" && managedApp.commands.start);
    const results = [];

    for (const managedApp of runnableApps) {
      const result = await runCommand(managedApp, "start", 180000);
      const event = eventFromCommand(managedApp.id, "start", result);
      await saveEvent(event);
      results.push({
        appId: managedApp.id,
        name: managedApp.name,
        status: event.status,
        result,
        event
      });
    }

    response.json({
      results,
      apps: await Promise.all(config.apps.map((managedApp) => getAppSnapshot(managedApp, { includeDetails: false })))
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/apps/:appId/seeds/:seedId/run", async (request, response, next) => {
  try {
    const managedApp = await getManagedApp(request.params.appId);
    const seed = (managedApp.seeds ?? []).find((candidate) => candidate.id === request.params.seedId);
    if (!seed) {
      response.status(404).json({ error: `Unknown seed: ${request.params.seedId}` });
      return;
    }
    const result = await runCommand(managedApp, seed.commandName, 300000);
    const event = eventFromCommand(managedApp.id, `seed:${seed.id}`, result);
    await saveEvent(event);
    const latestSeed = await readJsonIfExists(resolveProjectPath(seed.resultPath));
    response.status(result.exitCode === 0 ? 200 : 500).json({ result, event, latestSeed, snapshot: await getAppSnapshot(managedApp, { includeDetails: false }) });
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
    response.status(result.exitCode === 0 ? 200 : 500).json({ result, event, snapshot: await getAppSnapshot(managedApp, { includeDetails: false }) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/apps/:appId/tests/:testId/run", async (request, response, next) => {
  try {
    const managedApp = await getManagedApp(request.params.appId);
    const test = (managedApp.tests ?? []).find((candidate) => candidate.id === request.params.testId);
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
    response.status(result.exitCode === 0 ? 200 : 500).json({ result, event, latestTest, snapshot: await getAppSnapshot(managedApp, { includeDetails: false }) });
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

app.get("/api/parity-comparisons", async (_request, response, next) => {
  try {
    response.json({ comparisons: await readParityComparisons() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/parity-reliability", async (_request, response, next) => {
  try {
    response.json(await readParityReliability());
  } catch (error) {
    next(error);
  }
});

app.get("/api/artifacts/file", async (request, response, next) => {
  try {
    const artifactPath = typeof request.query.path === "string" ? request.query.path : "";
    const resolvedPath = resolveReadableArtifactPath(artifactPath);
    const stats = await fs.stat(resolvedPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        const notFound = new Error("Artifact file was not found.") as Error & { statusCode?: number };
        notFound.statusCode = 404;
        throw notFound;
      }
      throw error;
    });
    if (!stats.isFile()) {
      const error = new Error("Artifact path does not point to a file.") as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }
    if (path.extname(resolvedPath).toLowerCase() === ".json") {
      response.type("application/json");
    }
    response.sendFile(resolvedPath);
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
    response.status(result.exitCode === 0 ? 200 : 500).json({ result, event, latestTest, snapshot: await getAppSnapshot(managedApp, { includeDetails: false }) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/changelog/summary", async (_request, response, next) => {
  try {
    response.json(await readProjectChangelogSummary());
  } catch (error) {
    next(error);
  }
});

app.get("/api/changelog", async (request, response, next) => {
  try {
    const offset = normalizeChangelogOffset(request.query.offset);
    const limit = normalizeChangelogLimit(request.query.limit, 100);
    const order = normalizeChangelogOrder(request.query.order ?? "desc");
    response.json(await readProjectChangelog({ offset, limit, order }));
  } catch (error) {
    next(error);
  }
});

app.get("/api/architecture", async (_request, response) => {
  let sourceInventory: SourceInventory;
  try {
    sourceInventory = await readSourceInventory();
  } catch (error) {
    sourceInventory = {
      version: "unavailable",
      lastUpdated: "",
      generatedAt: new Date().toISOString(),
      method: "Source inventory unavailable.",
      systems: [],
      warnings: [error instanceof Error ? error.message : String(error)]
    };
  }

  response.json({
    sourceInventory,
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
          "Slice 156 message reply parity plan implemented for pnotes-compatible reply append and modernized Messages reply comparison",
          "Slice 67 encounter documents parity plan implemented for encounter-attached document comparison",
          "Slice 68 encounter billing parity plan implemented for encounter fee-sheet linkage comparison",
          "Slice 69 encounter claims parity plan implemented for encounter claim-status linkage comparison",
          "Slice 70 encounter procedure orders parity plan implemented for encounter procedure-order/result linkage comparison",
          "Slice 71 encounter diagnosis coding parity plan implemented for encounter diagnosis, fee-sheet justification, and procedure-order diagnosis comparison",
          "Slice 72 encounter billing linkage mutation parity plan implemented for temporary fee-sheet CPT create, encounter-linked render, deactivate, and delete comparison",
          "Slice 73 encounter diagnosis coding mutation parity plan implemented for temporary ICD10 fee-sheet diagnosis create, encounter-linked diagnosis render, deactivate, and delete comparison",
          "Slice 74 encounter fee-sheet entry parity plan implemented for temporary CPT and ICD10 create, encounter-workspace render, deactivate, and delete comparison",
          "Slice 75 encounter procedure-order entry parity plan implemented for temporary pending lab order create, encounter-workspace render, and delete comparison",
          "Slice 76 encounter procedure-result entry parity plan implemented for temporary lab order, reviewed final result, encounter-workspace render, and delete comparison",
          "Slice 77 encounter sign-off parity plan implemented for temporary encounter attestation create, render, delete, and cleanup comparison",
          "Slice 78 encounter document upload parity plan implemented for temporary encounter-scoped text document create, render, delete, and cleanup comparison",
          "Slice 79 encounter binary document upload parity plan implemented for temporary encounter-scoped PDF document create, render, download, delete, and cleanup comparison",
          "Slice 80 encounter document sign-off parity plan implemented for temporary encounter-scoped document create, approve, render, delete, and cleanup comparison",
          "Slice 81 encounter document denial parity plan implemented for temporary encounter-scoped document create, deny, render, delete, and cleanup comparison",
          "Slice 82 encounter document metadata parity plan implemented for temporary encounter-scoped document create, refile, render, delete, and cleanup comparison",
          "Slice 83 encounter document move parity plan implemented for temporary encounter-scoped document create, same-patient encounter move, render, delete, and cleanup comparison",
          "Slice 84 encounter document content replacement parity plan implemented for temporary encounter-scoped content replacement comparison",
          "Slice 85 encounter document archive parity plan implemented for temporary encounter-scoped archive/restore comparison",
          "Slice 86 encounter document lifecycle parity plan implemented for encounter-scoped document lifecycle timeline comparison",
          "Slice 87 encounter external-link document parity plan implemented for encounter-scoped external-link attachment comparison",
          "Slice 88 patient image preview parity plan implemented for image document preview comparison",
          "Slice 89 patient image thumbnail parity plan implemented for stored-byte thumbnail comparison",
          "Slice 90 patient PDF inline-preview parity plan implemented for PDF preview/download comparison",
          "Slice 91 patient document lifecycle parity plan implemented for document lifecycle timeline comparison",
          "Slice 92 patient scanned attachment parity plan implemented for scanned PDF readiness comparison",
          "Slice 93 appointment reschedule parity plan implemented for future appointment reschedule comparison",
          "Slice 94 appointment arrival parity plan implemented for arrived status comparison",
          "Slice 95 appointment check-out parity plan implemented for checked-out status comparison",
          "Slice 96 appointment no-show parity plan implemented for no-show status comparison",
          "Slice 97 appointment category parity plan implemented for scheduling category comparison",
          "Slice 98 appointment pending-status parity plan implemented for pending status comparison",
          "Slice 99 appointment provider reassignment parity plan implemented for scheduling provider reassignment comparison",
          "Slice 100 appointment facility reassignment parity plan implemented for scheduling facility reassignment comparison",
          "Slice 101 appointment billing-location reassignment parity plan implemented for scheduling billing-location comparison",
          "Slice 102 appointment comments parity plan implemented for scheduling comments comparison",
          "Slice 103 appointment recurrence metadata parity plan implemented for scheduling recurrence metadata comparison",
          "Slice 104 appointment recurring-series parity plan implemented for scheduling series expansion comparison",
          "Slice 105 appointment recurrence-exceptions parity plan implemented for scheduling exception-date comparison",
          "Slice 106 appointment occurrence-cancel parity plan implemented for generated occurrence cancellation comparison",
          "Slice 107 appointment occurrence-restore parity plan implemented for generated occurrence restoration comparison",
          "Slice 108 appointment occurrence-reschedule parity plan implemented for generated occurrence reschedule comparison",
          "Slice 109 appointment recurrence exception-list edit parity plan implemented for skipped-date edit comparison",
          "Slice 110 appointment series root update parity plan implemented for recurring root update propagation comparison",
          "Slice 111 appointment series root metadata parity plan implemented for recurring root metadata propagation comparison",
          "Slice 112 appointment monthly recurrence parity plan implemented for monthly recurrence comparison",
          "Slice 113 appointment recurrence unit matrix parity plan implemented for daily, workday, and yearly recurrence comparison",
          "Slice 114 appointment days-of-week recurrence parity plan implemented for weekday recurrence comparison",
          "Slice 115 appointment monthly repeat-on recurrence parity plan implemented for nth/last weekday monthly recurrence comparison",
          "Slice 116 appointment series recurrence update parity plan implemented for recurring cadence/end-date update comparison",
          "Slice 117 appointment provider-overlap parity plan implemented for same-provider overlap comparison",
          "Slice 118 appointment patient-overlap parity plan implemented for same-patient overlap comparison",
          "Slice 119 appointment room-overlap parity plan implemented for same-room overlap comparison",
          "Slice 120 appointment reminder parity plan implemented for seeded reminder readiness comparison",
          "Slice 121 encounter co-signature parity plan implemented for dual-signature readiness comparison",
          "Slice 122 encounter document revision parity plan implemented for encounter-attached current revision comparison",
          "Slice 123 encounter document replacement revision parity plan implemented for encounter-attached replacement revision comparison"
        ]
      },
      {
        id: "modernization-workbench",
        name: "Modernization Workbench",
        status: "Slice 155 comparison report links implemented",
        stack: ["React 19.2.7", "TypeScript 5.9.3", "Vite 7.3.5", "Express 5.2.1", "Node.js 24.13.1"],
        database: "File-based local artifacts for this version",
        businessLogic: "Local-only orchestration API with allowlisted commands",
        tests: ["API smoke and UI build verification", "Comparison drill-in UI verified for desktop and mobile Test Runs page", "Artifact file links verified through the safe artifact endpoint", "Comparison report links verified for run JSON, Playwright JSON, JUnit XML, and HTML reports"]
      },
      {
        id: "modernized-openemr",
        name: "Modernized OpenEMR",
        status: "Slice 156 patient message reply readiness implemented",
        stack: ["React 19.2.7 SPA", "TypeScript 6.0.3", "Vite 8.0.16", "ASP.NET Core 10.0.9 API", "PostgreSQL 17.10", "Docker Compose 5.0.2"],
        database: "PostgreSQL",
        businessLogic: "Server-side API owns patient search/chart summary including patient registration and patient demographics update behavior, insurance coverage read and insurance coverage lifecycle behavior, patient contact update behavior, appointment list/detail and appointment lifecycle behavior, encounter list/detail, encounter sign-off behavior, encounter document upload behavior, encounter binary document upload behavior, encounter document sign-off behavior, encounter document denial behavior, encounter document metadata refiling behavior, encounter document move behavior, encounter-attached document read behavior, encounter fee-sheet linkage read, mutation visibility, and encounter-workspace fee-sheet entry behavior, encounter claim-status linkage read behavior, encounter procedure-order/result linkage read behavior, encounter-workspace procedure order and result entry behavior, encounter diagnosis-coding linkage read and mutation visibility behavior, encounter/vitals/SOAP lifecycle behavior, encounter metadata lifecycle behavior, allergy, problem-list, and medication-list clinical-list lifecycle behavior, immunization history read and immunization entered-in-error lifecycle behavior, patient-message lifecycle, content edit, assignment, and basic reply behavior, patient-document read, text content retrieval, preview readiness, revision readiness, replacement revision behavior, binary content upload, MIME-aware download, lifecycle behavior, document sign-off behavior, document denial behavior, document metadata refiling behavior, document archive restore behavior, document content replacement behavior, and external-link document behavior, prescription lifecycle behavior, billing line, diagnosis coding, charge correction, modifier, payment posting, patient payment capture, and claim status lifecycle behavior, account balance, account aging, account ledger, account statement readiness, patient statement generation and PDF export read behavior, statement batch candidate read behavior, statement batch package export behavior, collections work queue read behavior, and pnotes-compatible collections follow-up task behavior, procedure order/report/result lifecycle behavior, clinical order queue behavior, scheduled/reportless procedure-order read behavior, facility administration lifecycle behavior, user administration lifecycle behavior, focused access-control permission assignment behavior, read-only clinical-list behavior, read-only patient-message behavior, read-only fee-sheet billing behavior, read-only administration directory behavior, and operational reporting plus CSV export behavior for implemented slices",
        tests: ["Modernized smoke test implemented for health, anchor patient search, chart summary, patient demographics mutation, patient registration lifecycle, insurance coverage, insurance mutation, immunizations, appointment detail, encounter detail, encounter document attachments, encounter document upload lifecycle, encounter binary document upload lifecycle, encounter document metadata lifecycle, encounter document move lifecycle, encounter document sign-off lifecycle, encounter document denial lifecycle, encounter billing linkage, encounter billing linkage mutation visibility, encounter claim linkage, encounter procedure order linkage, encounter procedure order entry lifecycle, encounter procedure result entry lifecycle, encounter sign-off lifecycle, encounter diagnosis coding linkage, encounter diagnosis coding mutation visibility, encounter metadata mutation, appointment mutation, appointment provider reassignment, appointment facility reassignment, appointment billing-location reassignment, appointment comments update, appointment recurrence metadata update, appointment recurring-series expansion, appointment recurrence-exception expansion, encounter mutation, clinical-list allergy mutation, problem-list mutation, medication-list mutation, patient-message mutation, patient-message content update, patient-message reply update, patient-message assignment update, patient-document content retrieval, patient-document preview readiness, patient-document revision readiness, patient-document replacement revision lifecycle, patient-document mutation, patient-document sign-off, patient-document denial, patient-document metadata refiling, patient-document archive restore, patient-document content replacement, binary patient-document mutation, external-link patient-document mutation, prescription mutation, immunization mutation, billing line mutation, billing diagnosis mutation, billing correction mutation, billing modifier mutation, claim status mutation, payment posting mutation, patient payment capture, collections follow-up task lifecycle, procedure mutation, scheduled procedure orders, facility mutation, user mutation, access control, access permission mutation, user group membership mutation, clinical lists, patient messages, patient documents, procedure results, fee sheet billing, claim status summary, payment posting summary, account balance summary, account aging summary, account ledger summary, account statement readiness, patient statement generation, patient statement PDF export, statement batch candidates, statement batch package export, collections work queue, administration directory, operational reports, and operational reports CSV export", "Slice 1 readiness parity plan implemented for side-by-side legacy comparison", "Slice 2 scheduling readiness plan implemented for future appointment comparison", "Slice 3 encounters readiness plan implemented for SOAP and vitals comparison", "Slice 4 clinical lists readiness plan implemented for problems, allergies, medications, and prescriptions comparison", "Slice 5 messaging readiness plan implemented for portal-enabled patient message comparison", "Slice 6 procedures readiness plan implemented for completed lab result comparison", "Slice 7 billing readiness plan implemented for fee sheet comparison", "Slice 8 admin readiness plan implemented for users and facilities comparison", "Slice 9 reports readiness plan implemented for operational reporting comparison", "Slice 10 contact mutation readiness plan implemented for patient contact update comparison", "Slice 11 appointment mutation readiness plan implemented for future appointment lifecycle comparison", "Slice 12 encounter mutation readiness plan implemented for encounter, vitals, and SOAP lifecycle comparison", "Slice 13 clinical-list mutation readiness plan implemented for allergy lifecycle comparison", "Slice 14 message mutation readiness plan implemented for patient-message lifecycle comparison", "Slice 15 prescription mutation readiness plan implemented for prescription lifecycle comparison", "Slice 16 billing mutation readiness plan implemented for fee-sheet CPT lifecycle comparison", "Slice 17 procedure mutation readiness plan implemented for lab procedure lifecycle comparison", "Slice 18 admin facility mutation readiness plan implemented for facility lifecycle comparison", "Slice 19 admin user mutation readiness plan implemented for user lifecycle comparison", "Slice 20 access-control readiness plan implemented for default ACL group and permission comparison", "Slice 21 access-permission mutation plan implemented for ACL assignment revoke/restore comparison", "Slice 22 user group membership mutation plan implemented for ACL user-to-group assignment comparison", "Slice 23 pending procedure orders plan implemented for scheduled, reportless lab-order comparison", "Slice 24 reports export plan implemented for normalized operational CSV export comparison", "Slice 25 documents readiness plan implemented for patient document metadata and document-list comparison", "Slice 26 document mutation plan implemented for patient document create/render/archive/delete comparison", "Slice 27 document content plan implemented for full stored payload, API retrieval, viewer, and download comparison", "Slice 28 insurance readiness plan implemented for primary and secondary patient coverage comparison", "Slice 29 immunizations readiness plan implemented for pediatric vaccine-history comparison", "Slice 30 immunization mutation plan implemented for create/render/entered-in-error/delete comparison", "Slice 31 problem-list mutation plan implemented for create/render/deactivate/delete comparison", "Slice 32 medication-list mutation plan implemented for create/render/deactivate/delete comparison", "Slice 33 binary patient-document mutation plan implemented for create/render/download/archive/delete comparison", "Slice 34 insurance mutation plan implemented for create/render/update/delete comparison", "Slice 35 encounter metadata mutation plan implemented for create/render/update/delete comparison", "Slice 36 patient demographics mutation plan implemented for update/render/restore comparison", "Slice 37 patient registration plan implemented for create/render/delete comparison", "Slice 38 document sign-off plan implemented for approve/render/archive/delete comparison", "Slice 39 document external-link plan implemented for web-url create/render/archive/delete comparison", "Slice 40 document denial plan implemented for deny/render/archive/delete comparison", "Slice 41 document metadata plan implemented for refile/render/archive/delete comparison", "Slice 42 document archive restore plan implemented for archive/restore/render/delete comparison", "Slice 43 document content replacement plan implemented for replace/render/archive/delete comparison", "Slice 44 billing diagnosis plan implemented for ICD10 create/render/deactivate/delete comparison", "Slice 45 billing correction plan implemented for CPT charge correction/render/deactivate/delete comparison", "Slice 46 billing modifier plan implemented for CPT modifier create/render/deactivate/delete comparison", "Slice 47 claim status plan implemented for read-only revenue-cycle status comparison", "Slice 48 payment posting plan implemented for read-only OpenEMR AR payment comparison", "Slice 49 account balance plan implemented for read-only charge/payment/adjustment/balance comparison", "Slice 50 account aging plan implemented for read-only AR bucket comparison", "Slice 51 account ledger plan implemented for read-only chronological running-balance comparison", "Slice 52 account statement plan implemented for read-only statement readiness comparison", "Slice 53 document preview plan implemented for read-only preview readiness comparison", "Slice 54 document revision plan implemented for read-only current revision readiness comparison", "Slice 55 document replacement revision plan implemented for content replacement current-revision comparison", "Slice 56 payment posting mutation plan implemented for AR payment create/render/void/delete and balance/ledger comparison", "Slice 57 claim status mutation plan implemented for claim create/generate/clear/delete and Fees rendering comparison", "Slice 58 patient payment capture plan implemented for patient payment create/render/void/delete and balance/ledger comparison", "Slice 59 statement generation plan implemented for printable statement number, instructions, generated text, line items, and Fees rendering comparison", "Slice 60 statement PDF export plan implemented for deterministic PDF content and Fees download comparison", "Slice 61 statement batch plan implemented for statement candidate queue API and Fees rendering comparison", "Slice 62 statement batch package plan implemented for package manifest, summary CSV, PDFs, and Fees download comparison", "Slice 63 collections work queue plan implemented for past-due account priority, recommended action, and Fees rendering comparison", "Slice 64 collections follow-up plan implemented for pnotes-compatible create/render/close/archive/delete and Fees action comparison", "Slice 65 message assignment plan implemented for pnotes/message assignment update and modernized Messages reassignment comparison", "Slice 66 message content plan implemented for pnotes/message title and body edit comparison", "Slice 156 message reply plan implemented for pnotes-compatible reply append and modernized Messages reply comparison", "Slice 67 encounter documents plan implemented for encounter-attached document comparison", "Slice 68 encounter billing plan implemented for encounter fee-sheet linkage comparison", "Slice 69 encounter claims plan implemented for encounter claim-status linkage comparison", "Slice 70 encounter procedure orders plan implemented for encounter procedure-order/result linkage comparison", "Slice 71 encounter diagnosis coding plan implemented for encounter diagnosis, fee-sheet justification, and procedure-order diagnosis comparison", "Slice 72 encounter billing linkage mutation plan implemented for temporary CPT fee-sheet create/render/deactivate/delete comparison", "Slice 73 encounter diagnosis coding mutation plan implemented for temporary ICD10 fee-sheet diagnosis coding create/render/deactivate/delete comparison", "Slice 74 encounter fee-sheet entry plan implemented for temporary CPT and ICD10 create/render/deactivate/delete comparison from the Encounter workspace", "Slice 75 encounter procedure-order entry plan implemented for temporary pending lab order create/render/delete comparison from the Encounter workspace", "Slice 76 encounter procedure-result entry plan implemented for temporary lab order reviewed final result create/render/delete comparison from the Encounter workspace", "Slice 77 encounter sign-off plan implemented for temporary encounter attestation create/render/delete comparison from the Encounter workspace", "Slice 78 encounter document upload plan implemented for temporary encounter-scoped text document create/render/delete comparison from the Encounter workspace", "Slice 79 encounter binary document upload plan implemented for temporary encounter-scoped PDF document create/render/download/delete comparison from the Encounter workspace", "Slice 80 encounter document sign-off plan implemented for temporary encounter-scoped document create/approve/render/delete comparison from the Encounter workspace", "Slice 81 encounter document denial plan implemented for temporary encounter-scoped document create/deny/render/delete comparison from the Encounter workspace", "Slice 82 encounter document metadata plan implemented for temporary encounter-scoped document create/refile/render/delete comparison from the Encounter workspace", "Slice 83 encounter document move plan implemented for temporary encounter-scoped document create/move/render/delete comparison from the Encounter workspace", "Slice 100 appointment facility reassignment plan implemented for scheduling facility reassignment comparison", "Slice 101 appointment billing-location reassignment plan implemented for scheduling billing-location comparison", "Slice 102 appointment comments plan implemented for scheduling comments comparison", "Slice 103 appointment recurrence metadata plan implemented for scheduling recurrence metadata comparison", "Slice 104 appointment recurring-series plan implemented for scheduling series expansion comparison", "Slice 105 appointment recurrence-exceptions plan implemented for scheduling exception-date comparison"]
      }
    ]
  });
});

app.get("/api/progress", async (_request, response) => {
  const functionalityProgress = await readFunctionalityProgress();
  const functionalitySummary = calculateFunctionalityProgressSummary(functionalityProgress.areas);
  const changelogEntries = await readChangelogEntriesForForecast();
  const [functionalityHistory, functionalityForecast] = await Promise.all([
    readProgressHistory(changelogEntries),
    buildFunctionalityProgressForecast(functionalitySummary, changelogEntries)
  ]);

  response.json({
    slices: [
      { id: "legacy-baseline", name: "Legacy OpenEMR baseline", status: "verified", detail: "Installed, running, smoke tested, and connected to GitHub." },
      { id: "workbench-v1", name: "Modernization Workbench v1", status: "verified", detail: "Lifecycle control, health checks, smoke tests, logs, architecture overview, comparison artifact cards, Slice 124 comparison drill-ins, Slice 125 artifact links, Slice 143 functionality progress ledger, Slice 146 completion estimates, Slice 152 weighted progress analytics, and Slice 155 comparison report links." },
      { id: "seed-data", name: "Synthetic seed data", status: "verified", detail: "Workbench owns the shared gold dataset; the 1,000-patient legacy seed now includes 2,648 immunization rows, 700 claim status rows, seeded AR payment postings, and 21 procedure order catalog rows with count/temporal-coverage verification." },
      { id: "playwright-ui", name: "Playwright legacy UI suite", status: "verified", detail: "Implemented through the parity-tests UI suite for login, chart, encounter, scheduler appointment, fee sheet billing, procedure-result rendering, report-screen rendering, and administration directory rendering." },
      { id: "native-phpunit", name: "Legacy native PHPUnit suite", status: "verified", detail: "Implemented through a containerized stable OpenEMR phpunit-isolated lane with upstream twig and large groups excluded for Windows bind-mount stability." },
      { id: "native-jest", name: "Legacy native Jest suite", status: "verified", detail: "Implemented through OpenEMR's upstream JavaScript Jest suite for CCDA utility and jsPDF compatibility coverage." },
      { id: "workflow-mutations", name: "Legacy workflow mutation suite", status: "verified", detail: "Implemented for demographics, patient registration, insurance coverage, scheduling, encounters with vitals/SOAP details, encounter sign-off attestations, encounter-scoped document uploads, encounter-scoped binary document uploads, encounter-scoped document sign-offs, denials, metadata refiling, and same-patient encounter moves, encounter-linked billing visibility, encounter-linked diagnosis coding visibility, encounter fee-sheet entry visibility, encounter procedure-order entry and result entry visibility, clinical lists, problem lists, medication lists, patient messages, patient-message content edits, patient-message assignment, patient-message reply append, text/binary/sign-off/denial/metadata/archive/content-replacement/external-link patient documents, prescriptions, immunizations, billing, billing diagnosis coding, billing charge correction, billing modifier, payment posting, claim status, patient payment capture, collections follow-up tasks, and lab procedure lifecycle coverage with pre/post database probes." },
      { id: "test-management", name: "Parity test management", status: "verified", detail: "Named run plans are implemented through Slice 156 patient message reply parity, with custom target/suite/plan/reset selection, side-by-side comparison artifact rendering, Slice 124 expandable comparison drill-ins, Slice 125 safe links to run/comparison artifacts, and Slice 155 direct links to run JSON, Playwright JSON, JUnit XML, and HTML reports from comparison drill-ins." },
      { id: "modernized-target", name: "Modernized OpenEMR target", status: "in-progress", detail: "Slice 156 proves patient message reply readiness with pnotes-compatible reply body appending, modernized Messages UI controls, cleanup, and matched side-by-side comparison evidence. The target now covers forty-one read-only slices plus one hundred eight mutation-capable slices." }
    ],
    functionalityVersion: functionalityProgress.version,
    functionalityLastUpdated: functionalityProgress.lastUpdated,
    functionalityAreas: functionalityProgress.areas,
    functionalitySummary,
    functionalityHistory,
    functionalityForecast
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
