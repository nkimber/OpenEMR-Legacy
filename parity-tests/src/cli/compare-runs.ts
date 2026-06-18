import { promises as fs } from "node:fs";
import path from "node:path";
import { parityRoot, resolveFromRepoRoot, toRepoRelative } from "../config/paths.js";
import { writeJson, type ParityRunSummary } from "../core/results.js";

type CompareOptions = {
  left: string | null;
  right: string | null;
  leftTarget: string;
  rightTarget: string;
  suite: string | null;
  plan: string | null;
};

type Difference = {
  field: string;
  left: unknown;
  right: unknown;
  severity: "blocking" | "informational";
};

type ComparisonSummary = {
  comparisonId: string;
  status: "matched" | "differences" | "missing-run";
  passed: boolean;
  selectionKind: "suite" | "plan";
  selectionId: string;
  left: ComparedRun;
  right: ComparedRun;
  differences: Difference[];
  reports: {
    comparisonJson: string;
  };
  startedAt: string;
  finishedAt: string;
};

type ComparedRun = {
  target: string;
  runId: string | null;
  path: string;
  exists: boolean;
  passed: boolean | null;
  selectedSuites: string[];
  stats: ParityRunSummary["stats"] | null;
};

const startedAt = new Date();
const options = parseArgs(process.argv.slice(2));
const selectionKind: "suite" | "plan" = options.plan ? "plan" : "suite";
const selectionId = options.plan ?? options.suite ?? "all";
const leftPath = resolveRunPath(options.left, options.leftTarget, selectionKind, selectionId);
const rightPath = resolveRunPath(options.right, options.rightTarget, selectionKind, selectionId);
const left = await readComparedRun(leftPath, options.leftTarget);
const right = await readComparedRun(rightPath, options.rightTarget);
const differences = compareRuns(left, right);
const comparisonId = `${new Date().toISOString().replaceAll(":", "").replaceAll(".", "-")}-${options.leftTarget}-vs-${options.rightTarget}-${selectionKind}-${selectionId}`;
const comparisonDirectory = path.join(parityRoot, "artifacts", "comparisons", comparisonId);
const comparisonPath = path.join(comparisonDirectory, "comparison.json");
const finishedAt = new Date();
const status: ComparisonSummary["status"] = !left.exists || !right.exists ? "missing-run" : differences.length ? "differences" : "matched";
const summary: ComparisonSummary = {
  comparisonId,
  status,
  passed: status === "matched",
  selectionKind,
  selectionId,
  left,
  right,
  differences,
  reports: {
    comparisonJson: toRepoRelative(comparisonPath)
  },
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString()
};

await writeJson(comparisonPath, summary);
await writeJson(path.join(parityRoot, "artifacts", `latest-comparison-${options.leftTarget}-${options.rightTarget}-${selectionKind}-${selectionId}.json`), summary);

console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.passed ? 0 : 1;

function parseArgs(args: string[]): CompareOptions {
  const parsed: CompareOptions = {
    left: null,
    right: null,
    leftTarget: "legacy-openemr",
    rightTarget: "modernized-openemr",
    suite: "all",
    plan: null
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--left") {
      parsed.left = requireValue(args, ++index, arg);
    } else if (arg === "--right") {
      parsed.right = requireValue(args, ++index, arg);
    } else if (arg === "--left-target") {
      parsed.leftTarget = requireValue(args, ++index, arg);
    } else if (arg === "--right-target") {
      parsed.rightTarget = requireValue(args, ++index, arg);
    } else if (arg === "--suite") {
      parsed.suite = requireValue(args, ++index, arg);
      parsed.plan = null;
    } else if (arg === "--plan") {
      parsed.plan = requireValue(args, ++index, arg);
      parsed.suite = null;
    } else if (arg === "--help" || arg === "-h") {
      printHelpAndExit();
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
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

function resolveRunPath(inputPath: string | null, targetId: string, selectionKind: "suite" | "plan", selectionId: string) {
  if (inputPath) {
    return inputPath.startsWith("parity-tests/") || inputPath.startsWith("parity-tests\\")
      ? resolveFromRepoRoot(inputPath)
      : path.resolve(parityRoot, inputPath);
  }
  const suffix = selectionKind === "plan" ? `plan-${selectionId}` : selectionId;
  return path.join(parityRoot, "artifacts", `latest-${targetId}-${suffix}.json`);
}

async function readComparedRun(filePath: string, targetId: string): Promise<ComparedRun> {
  try {
    const run = JSON.parse(await fs.readFile(filePath, "utf8")) as ParityRunSummary;
    return {
      target: run.target,
      runId: run.runId,
      path: toRepoRelative(filePath),
      exists: true,
      passed: run.passed,
      selectedSuites: run.selectedSuites ?? suiteListFromLegacySummary(run.suite),
      stats: run.stats
    };
  } catch {
    return {
      target: targetId,
      runId: null,
      path: toRepoRelative(filePath),
      exists: false,
      passed: null,
      selectedSuites: [],
      stats: null
    };
  }
}

function compareRuns(left: ComparedRun, right: ComparedRun): Difference[] {
  const differences: Difference[] = [];

  if (!left.exists || !right.exists) {
    differences.push({
      field: "exists",
      left: left.exists,
      right: right.exists,
      severity: "blocking"
    });
    return differences;
  }

  addDifference(differences, "passed", left.passed, right.passed, "blocking");
  addDifference(differences, "selectedSuites", left.selectedSuites, right.selectedSuites, "blocking");
  addDifference(differences, "stats.expected", left.stats?.expected, right.stats?.expected, "blocking");
  addDifference(differences, "stats.unexpected", left.stats?.unexpected, right.stats?.unexpected, "blocking");
  addDifference(differences, "stats.skipped", left.stats?.skipped, right.stats?.skipped, "informational");
  addDifference(differences, "stats.flaky", left.stats?.flaky, right.stats?.flaky, "blocking");

  return differences;
}

function addDifference(differences: Difference[], field: string, left: unknown, right: unknown, severity: Difference["severity"]) {
  if (JSON.stringify(left) === JSON.stringify(right)) {
    return;
  }
  differences.push({ field, left, right, severity });
}

function suiteListFromLegacySummary(suite: string) {
  if (!suite) {
    return [];
  }
  if (suite.includes(",")) {
    return suite.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [suite];
}

function printHelpAndExit() {
  console.log(`OpenEMR parity comparison runner

Usage:
  npm run compare -- --left artifacts/latest-legacy-openemr-all.json --right artifacts/latest-modernized-openemr-all.json
  npm run compare -- --left-target legacy-openemr --right-target modernized-openemr --plan full-parity

Options:
  --left <path>          Left run summary path. Defaults to latest file derived from target and selection.
  --right <path>         Right run summary path. Defaults to latest file derived from target and selection.
  --left-target <id>     Left target id. Default: legacy-openemr
  --right-target <id>    Right target id. Default: modernized-openemr
  --suite <id|all>       Suite selection. Default: all
  --plan <id>            Plan selection.
`);
  process.exit(0);
}
