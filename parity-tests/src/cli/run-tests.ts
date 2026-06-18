import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadTarget, loadTargets, resetTarget } from "../config/targets.js";
import { parityRoot, toRepoRelative } from "../config/paths.js";
import { preview, runCommand } from "../core/command.js";
import { readPlaywrightJsonReport, writeJson, type ParityRunSummary } from "../core/results.js";

type ResetMode = "none" | "run" | "suite" | "test";

type TestSuite = {
  id: string;
  name: string;
  description: string;
  layer: string;
  path: string;
  tags: string[];
  defaultResetMode: ResetMode;
  targets: string[];
};

type TestPlan = {
  id: string;
  name: string;
  description: string;
  suites: string[];
  resetMode: ResetMode;
  tags: string[];
  targets: string[];
};

type TestManifest = {
  id: string;
  version: string;
  description: string;
  defaultTarget: string;
  defaultResetMode: ResetMode;
  resetModes: Array<{ id: ResetMode; description: string }>;
  plans: TestPlan[];
  suites: TestSuite[];
};

type RunOptions = {
  target: string;
  suite: string | null;
  plan: string | null;
  reset: ResetMode | null;
  headed: boolean;
  workers: string;
  grep: string | null;
  list: boolean;
  suiteExplicit: boolean;
};

type RunSelection = {
  kind: "suite" | "plan";
  id: string;
  name: string;
  description: string;
  suites: TestSuite[];
  resetMode: ResetMode;
};

const options = parseArgs(process.argv.slice(2));
const manifest = JSON.parse(await fs.readFile(path.join(parityRoot, "test-manifest.json"), "utf8")) as TestManifest;

if (options.list) {
  await printInventoryAndExit(manifest, options.target);
}

const target = await loadTarget(options.target);
const selection = resolveSelection(manifest, target.id, options);
const runId = `${new Date().toISOString().replaceAll(":", "").replaceAll(".", "-")}-${target.id}-${selection.kind}-${selection.id}`;
const runDirectory = path.join(parityRoot, "artifacts", "runs", runId);
const startedAt = new Date();

await fs.mkdir(runDirectory, { recursive: true });

let exitCode = 0;
let stdout = "";
let stderr = "";
let expected = 0;
let skipped = 0;
let unexpected = 0;
let flaky = 0;
let testDuration = 0;

if (selection.suites.length === 0) {
  throw new Error(`No suites selected for target ${target.id} and ${selection.kind} '${selection.id}'.`);
}

if (selection.resetMode === "run") {
  const resetResult = await resetTarget(target, `run ${runId}`);
  stdout += resetResult.stdout;
  stderr += resetResult.stderr;
}

if (selection.resetMode === "suite" && selection.suites.length > 1) {
  for (const suite of selection.suites) {
    const resetResult = await resetTarget(target, `suite ${suite.id}`);
    stdout += resetResult.stdout;
    stderr += resetResult.stderr;
    const suiteDirectory = path.join(runDirectory, suite.id);
    const result = await runPlaywright([suite.path], suiteDirectory, selection.resetMode);
    accumulate(result);
  }
} else {
  const result = await runPlaywright(selection.suites.map((suite) => suite.path), runDirectory, selection.resetMode);
  accumulate(result);
}

const finishedAt = new Date();
const reportPath = path.join(runDirectory, "playwright-report.json");
const stats = {
  expected,
  skipped,
  unexpected,
  flaky,
  duration: testDuration || finishedAt.getTime() - startedAt.getTime()
};
const summary: ParityRunSummary = {
  runId,
  target: target.id,
  suite: selection.kind === "suite" ? selection.id : selection.suites.map((suite) => suite.id).join(","),
  selectionKind: selection.kind,
  selectionId: selection.id,
  selectedSuites: selection.suites.map((suite) => suite.id),
  plan: selection.kind === "plan" ? { id: selection.id, name: selection.name } : undefined,
  resetMode: selection.resetMode,
  headed: options.headed,
  passed: exitCode === 0 && stats.unexpected === 0,
  exitCode,
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  durationMs: finishedAt.getTime() - startedAt.getTime(),
  stats,
  artifactDirectory: toRepoRelative(runDirectory),
  reports: {
    runJson: toRepoRelative(path.join(runDirectory, "run.json")),
    playwrightJson: toRepoRelative(reportPath),
    junit: toRepoRelative(path.join(runDirectory, "junit.xml")),
    html: toRepoRelative(path.join(runDirectory, "html-report", "index.html"))
  },
  stdoutPreview: preview(stdout),
  stderrPreview: preview(stderr)
};

await writeJson(path.join(runDirectory, "run.json"), summary);
await writeJson(path.join(parityRoot, "artifacts", latestSummaryFileName(target.id, selection)), summary);

console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.passed ? 0 : exitCode || 1;

function parseArgs(args: string[]): RunOptions {
  const parsed: RunOptions = {
    target: "legacy-openemr",
    suite: null,
    plan: null,
    reset: null,
    headed: false,
    workers: "1",
    grep: null,
    list: false,
    suiteExplicit: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--target") {
      parsed.target = requireValue(args, ++index, arg);
    } else if (arg === "--suite") {
      parsed.suite = requireValue(args, ++index, arg);
      parsed.suiteExplicit = true;
    } else if (arg === "--plan") {
      parsed.plan = requireValue(args, ++index, arg);
    } else if (arg === "--reset") {
      parsed.reset = requireValue(args, ++index, arg) as ResetMode;
    } else if (arg === "--headed") {
      parsed.headed = true;
    } else if (arg === "--workers") {
      parsed.workers = requireValue(args, ++index, arg);
    } else if (arg === "--grep") {
      parsed.grep = requireValue(args, ++index, arg);
    } else if (arg === "--list") {
      parsed.list = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelpAndExit();
    } else if (arg === "--") {
      continue;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (parsed.reset !== null && !["none", "run", "suite", "test"].includes(parsed.reset)) {
    throw new Error(`Invalid reset mode: ${parsed.reset}`);
  }
  if (parsed.plan && parsed.suiteExplicit) {
    throw new Error("Use either --plan or --suite, not both.");
  }
  return parsed;
}

function requireValue(args: string[], index: number, option: string) {
  const value = args[index];
  if (!value) {
    throw new Error(`Missing value for ${option}.`);
  }
  return value;
}

function resolveSelection(manifest: TestManifest, targetId: string, options: RunOptions): RunSelection {
  if (options.plan) {
    const plan = manifest.plans.find((candidate) => candidate.id === options.plan);
    if (!plan) {
      throw new Error(`Unknown test plan: ${options.plan}`);
    }
    if (!plan.targets.includes(targetId)) {
      throw new Error(`Test plan ${plan.id} does not support target ${targetId}.`);
    }
    return {
      kind: "plan",
      id: plan.id,
      name: plan.name,
      description: plan.description,
      suites: resolveSuiteIds(manifest, targetId, plan.suites),
      resetMode: options.reset ?? plan.resetMode
    };
  }

  const suiteId = options.suite ?? "all";
  const suites = suiteId === "all" ? manifest.suites : manifest.suites.filter((suite) => suite.id === suiteId);
  const selected = suites.filter((suite) => suite.targets.includes(targetId));
  const defaultReset = suiteId === "all" ? manifest.defaultResetMode : selected[0]?.defaultResetMode ?? manifest.defaultResetMode;
  return {
    kind: "suite",
    id: suiteId,
    name: suiteId === "all" ? "All Suites" : selected[0]?.name ?? suiteId,
    description: suiteId === "all" ? "All suites supported by the selected target." : selected[0]?.description ?? "",
    suites: selected,
    resetMode: options.reset ?? defaultReset
  };
}

function resolveSuiteIds(manifest: TestManifest, targetId: string, suiteIds: string[]) {
  return suiteIds.map((suiteId) => {
    const suite = manifest.suites.find((candidate) => candidate.id === suiteId);
    if (!suite) {
      throw new Error(`Unknown suite '${suiteId}' referenced by test plan.`);
    }
    if (!suite.targets.includes(targetId)) {
      throw new Error(`Suite ${suite.id} does not support target ${targetId}.`);
    }
    return suite;
  });
}

function latestSummaryFileName(targetId: string, selection: RunSelection) {
  const suffix = selection.kind === "plan" ? `plan-${selection.id}` : selection.id;
  return `latest-${targetId}-${suffix}.json`;
}

function printHelpAndExit() {
  console.log(`OpenEMR parity test runner

Usage:
  npm run test:legacy -- --suite all --reset run
  npm run test:legacy -- --suite database --reset none
  npm run test:legacy -- --plan full-parity
  npm run test:legacy -- --list

Options:
  --target <id>       Target id. Default: legacy-openemr
  --suite <id|all>   Suite id (database, http, ui, workflow) or all. Default: all
  --plan <id>        Run a named plan from test-manifest.json
  --reset <mode>     none, run, suite, or test. Defaults to the suite or plan setting
  --headed           Run browser tests headed
  --workers <n>      Playwright worker count. Default: 1
  --grep <pattern>   Pass a Playwright grep pattern for tag/name selection
  --list             Print manifest suites, plans, reset modes, and targets as JSON
`);
  process.exit(0);
}

async function printInventoryAndExit(manifest: TestManifest, selectedTargetId: string) {
  const targets = await loadTargets();
  const inventory = {
    id: manifest.id,
    version: manifest.version,
    description: manifest.description,
    defaultTarget: manifest.defaultTarget,
    selectedTarget: selectedTargetId,
    resetModes: manifest.resetModes,
    plans: manifest.plans,
    suites: manifest.suites,
    targets: targets.targets.map((target) => ({
      id: target.id,
      name: target.name,
      status: target.status,
      type: target.type,
      publicUrl: target.publicUrl,
      seedDatasetId: target.seedDatasetId
    }))
  };
  console.log(JSON.stringify(inventory, null, 2));
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Top-level module body does the work. This block documents intentional CLI execution.
}

async function runPlaywright(paths: string[], artifactDirectory: string, resetMode: ResetMode) {
  const command = [
    process.platform === "win32" ? "npx.cmd" : "npx",
    "playwright",
    "test",
    ...paths,
    "--config",
    "playwright.config.ts"
  ];
  if (options.grep) {
    command.push("--grep", options.grep);
  }
  const result = await runCommand(command, {
    cwd: parityRoot,
    timeoutMs: 600_000,
    env: {
      PARITY_TARGET: target.id,
      PARITY_PUBLIC_URL: target.publicUrl,
      PARITY_REPO_ROOT: target.repoRoot,
      PARITY_RESET_MODE: resetMode,
      PARITY_RUN_ID: runId,
      PARITY_RUN_ARTIFACT_DIR: artifactDirectory,
      PARITY_HEADED: options.headed ? "1" : "0",
      PARITY_WORKERS: options.workers
    }
  });
  const report = await readPlaywrightJsonReport(path.join(artifactDirectory, "playwright-report.json"));
  return { result, report };
}

function accumulate(run: Awaited<ReturnType<typeof runPlaywright>>) {
  stdout += run.result.stdout;
  stderr += run.result.stderr;
  if (run.result.exitCode !== 0) {
    exitCode = run.result.exitCode ?? 1;
  }
  expected += run.report.stats?.expected ?? 0;
  skipped += run.report.stats?.skipped ?? 0;
  unexpected += run.report.stats?.unexpected ?? (run.result.exitCode === 0 ? 0 : 1);
  flaky += run.report.stats?.flaky ?? 0;
  testDuration += run.report.stats?.duration ?? run.result.durationMs;
}
