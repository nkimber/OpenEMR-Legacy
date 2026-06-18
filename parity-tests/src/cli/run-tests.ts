import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadTarget, resetTarget } from "../config/targets.js";
import { parityRoot, toRepoRelative } from "../config/paths.js";
import { preview, runCommand } from "../core/command.js";
import { readPlaywrightJsonReport, writeJson, type ParityRunSummary } from "../core/results.js";

type ResetMode = "none" | "run" | "suite" | "test";

type TestManifest = {
  defaultResetMode: ResetMode;
  suites: Array<{
    id: string;
    path: string;
    defaultResetMode: ResetMode;
    targets: string[];
  }>;
};

type RunOptions = {
  target: string;
  suite: string;
  reset: ResetMode | null;
  headed: boolean;
  workers: string;
  grep: string | null;
};

const options = parseArgs(process.argv.slice(2));
const manifest = JSON.parse(await fs.readFile(path.join(parityRoot, "test-manifest.json"), "utf8")) as TestManifest;
const target = await loadTarget(options.target);
const selectedSuites = selectSuites(manifest, target.id, options.suite);
const runId = `${new Date().toISOString().replaceAll(":", "").replaceAll(".", "-")}-${target.id}-${options.suite}`;
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

if (selectedSuites.length === 0) {
  throw new Error(`No suites selected for target ${target.id} and suite '${options.suite}'.`);
}

if (options.reset === "run") {
  const resetResult = await resetTarget(target, `run ${runId}`);
  stdout += resetResult.stdout;
  stderr += resetResult.stderr;
}

if (options.reset === "suite" && selectedSuites.length > 1) {
  for (const suite of selectedSuites) {
    const resetResult = await resetTarget(target, `suite ${suite.id}`);
    stdout += resetResult.stdout;
    stderr += resetResult.stderr;
    const suiteDirectory = path.join(runDirectory, suite.id);
    const result = await runPlaywright([suite.path], suiteDirectory, options.reset);
    accumulate(result);
  }
} else {
  const resetMode = options.reset ?? selectedSuites[0]?.defaultResetMode ?? manifest.defaultResetMode;
  const result = await runPlaywright(selectedSuites.map((suite) => suite.path), runDirectory, resetMode);
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
  suite: options.suite,
  resetMode: options.reset ?? "suite-default",
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
await writeJson(path.join(parityRoot, "artifacts", `latest-${target.id}-${options.suite}.json`), summary);

console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.passed ? 0 : exitCode || 1;

function parseArgs(args: string[]): RunOptions {
  const parsed: RunOptions = {
    target: "legacy-openemr",
    suite: "all",
    reset: "run",
    headed: false,
    workers: "1",
    grep: null
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--target") {
      parsed.target = requireValue(args, ++index, arg);
    } else if (arg === "--suite") {
      parsed.suite = requireValue(args, ++index, arg);
    } else if (arg === "--reset") {
      parsed.reset = requireValue(args, ++index, arg) as ResetMode;
    } else if (arg === "--headed") {
      parsed.headed = true;
    } else if (arg === "--workers") {
      parsed.workers = requireValue(args, ++index, arg);
    } else if (arg === "--grep") {
      parsed.grep = requireValue(args, ++index, arg);
    } else if (arg === "--help" || arg === "-h") {
      printHelpAndExit();
    } else if (arg === "--") {
      continue;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!["none", "run", "suite", "test"].includes(parsed.reset ?? "")) {
    throw new Error(`Invalid reset mode: ${parsed.reset}`);
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

function selectSuites(manifest: TestManifest, targetId: string, suiteId: string) {
  const selected = suiteId === "all" ? manifest.suites : manifest.suites.filter((suite) => suite.id === suiteId);
  return selected.filter((suite) => suite.targets.includes(targetId));
}

function printHelpAndExit() {
  console.log(`OpenEMR parity test runner

Usage:
  npm run test:legacy -- --suite all --reset run
  npm run test:legacy -- --suite database --reset none

Options:
  --target <id>       Target id. Default: legacy-openemr
  --suite <id|all>   Suite id (database, http, ui, workflow) or all. Default: all
  --reset <mode>     none, run, suite, or test. Default: run
  --headed           Run browser tests headed
  --workers <n>      Playwright worker count. Default: 1
  --grep <pattern>   Pass a Playwright grep pattern for tag/name selection
`);
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
