import { promises as fs } from "node:fs";
import path from "node:path";

export type PlaywrightJsonReport = {
  stats?: {
    expected?: number;
    skipped?: number;
    unexpected?: number;
    flaky?: number;
    duration?: number;
  };
  suites?: unknown[];
};

export type ParityRunSummary = {
  runId: string;
  target: string;
  suite: string;
  selectionKind: "suite" | "plan";
  selectionId: string;
  selectedSuites: string[];
  plan?: {
    id: string;
    name: string;
  };
  resetMode: string;
  headed: boolean;
  passed: boolean;
  exitCode: number | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  stats: {
    expected: number;
    skipped: number;
    unexpected: number;
    flaky: number;
    duration: number;
  };
  artifactDirectory: string;
  reports: {
    runJson: string;
    playwrightJson: string;
    junit: string;
    html: string;
  };
  stdoutPreview: string;
  stderrPreview: string;
};

export async function readPlaywrightJsonReport(reportPath: string): Promise<PlaywrightJsonReport> {
  try {
    return JSON.parse(await fs.readFile(reportPath, "utf8")) as PlaywrightJsonReport;
  } catch {
    return {};
  }
}

export async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}
