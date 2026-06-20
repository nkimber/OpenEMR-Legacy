export type RuntimeState = "healthy" | "unhealthy" | "stopped" | "partial" | "error";

export type ContainerStatus = {
  name: string;
  service: string;
  image: string;
  state: string;
  health: string;
  status: string;
  ports: string;
};

export type DataProfileRow = {
  tableName: string;
  rowCount: number;
};

export type ManagedTest = {
  id: string;
  name: string;
  description: string;
  layer: string;
  commandName: string;
  resultPath: string;
};

export type ManagedSeed = {
  id: string;
  datasetId: string;
  name: string;
  description: string;
  commandName: string;
  resultPath: string;
};

export type SmokeCheck = {
  name: string;
  passed: boolean;
  detail: string;
};

export type SmokeResult = {
  name: string;
  passed: boolean;
  baseUrl: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  checks: SmokeCheck[];
};

export type ParityRunResult = {
  runId: string;
  target: string;
  suite: string;
  selectionKind?: "suite" | "plan";
  selectionId?: string;
  selectedSuites?: string[];
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

export type ParityComparisonSide = {
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
};

export type ParityComparisonReport = {
  comparisonId: string;
  status: string;
  passed: boolean;
  selectionKind: "suite" | "plan" | string;
  selectionId: string;
  left: ParityComparisonSide;
  right: ParityComparisonSide;
  differences: unknown[];
  differenceCount: number;
  reports: {
    comparisonJson: string;
  };
  artifactDirectory: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};

export type NativeRunResult = {
  name: string;
  passed: boolean;
  mode: "stable" | "full";
  sourcePath: string;
  image: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  exitCode: number;
  excludedGroups: string[];
  stats: {
    tests: number;
    assertions: number;
    errors: number;
    failures: number;
    phpunitWarnings: number;
    warnings: number;
    notices: number;
    skipped: number;
    incomplete: number;
  };
  checks: SmokeCheck[];
  command: string[];
  logPath: string;
  stdoutPreview: string;
  notes: string[];
};

export type NativeJestRunResult = {
  name: string;
  runner: "jest";
  passed: boolean;
  sourcePath: string;
  nodeVersion: string;
  npmVersion: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  exitCode: number;
  stats: {
    testSuites: {
      total: number;
      passed: number;
      failed: number;
      runtimeErrors: number;
      pending: number;
    };
    tests: {
      total: number;
      passed: number;
      failed: number;
      pending: number;
      todo: number;
    };
    snapshots: {
      total: number;
      matched: number;
      unmatched: number;
    };
  };
  checks: SmokeCheck[];
  command: string[];
  reportPath: string;
  logPath: string;
  stdoutPreview: string;
  notes: string[];
};

export type SeedRecordTarget = {
  name: string;
  target: number;
  currentLegacy: number;
};

export type SeedTargetSystem = {
  id: string;
  database: string;
  status: string;
};

export type SeedPhase = {
  id: string;
  name: string;
  status: string;
  patientTarget: number;
};

export type SeedDataset = {
  id: string;
  name: string;
  version: string;
  status: string;
  description: string;
  canonicalPath: string;
  currentSeedLevel: string;
  targetPatientCount: number;
  sourcePlan: string[];
  targetSystems: SeedTargetSystem[];
  recordTargets: SeedRecordTarget[];
  phases: SeedPhase[];
};

export type SeedResult = {
  name: string;
  passed: boolean;
  source: string;
  mode?: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  expectedPatients: number;
  tableCounts: DataProfileRow[];
};

export type AppSnapshot = {
  id: string;
  name: string;
  stage: string;
  description: string;
  kind: string;
  publicUrl: string;
  healthUrl: string;
  documentationPath: string;
  runtime: {
    state: RuntimeState;
    label: string;
    detail: string;
  };
  health: {
    ok: boolean;
    statusCode: number | null;
    durationMs: number;
    error?: string;
  };
  source: {
    tag: string;
    commit: string;
    matchesExpectedTag: boolean;
    error?: string;
  };
  containers: ContainerStatus[];
  seeds: ManagedSeed[];
  tests: ManagedTest[];
  latestSeed: SeedResult | null;
  latestTest: SmokeResult | null;
  latestTests: Record<string, SmokeResult | ParityRunResult | NativeRunResult | NativeJestRunResult | null>;
  demoLogin: {
    available: boolean;
    username?: string;
    password?: string;
    source: string;
    error?: string;
  };
  dataProfile: {
    available: boolean;
    rows: DataProfileRow[];
    error?: string;
  };
  refreshedAt: string;
};

export type LifecycleEvent = {
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

export type ArchitectureTechnology = {
  id: string;
  name: string;
  version: string;
  detail: string;
  logoUrl?: string;
  logoText: string;
  color: string;
};

export type ArchitectureLayerCell = {
  systemId: string;
  detail: string;
  technologies: ArchitectureTechnology[];
};

export type ArchitectureLayer = {
  id: string;
  label: string;
  summary: string;
  cells: ArchitectureLayerCell[];
};

export type ArchitectureDiagramNode = {
  id: string;
  title: string;
  subtitle: string;
  technologies: ArchitectureTechnology[];
};

export type ArchitectureDiagramEdge = {
  from: string;
  to: string;
  label: string;
};

export type ArchitectureDiagram = {
  title: string;
  subtitle: string;
  nodes: ArchitectureDiagramNode[];
  edges: ArchitectureDiagramEdge[];
};

export type ArchitectureNarrative = {
  title: string;
  body: string;
};

export type ArchitectureDecision = {
  title: string;
  detail: string;
};

export type ArchitectureSystemSummary = {
  id: string;
  name: string;
  status: string;
  stack: string[];
  database: string;
  businessLogic: string;
  tests: string[];
};

export type ArchitectureSystem = ArchitectureSystemSummary & {
  purpose: string;
  architecturePattern: string;
  runtime: string;
  dataOwnership: string;
  technologies: ArchitectureTechnology[];
  diagram: ArchitectureDiagram;
  narratives: ArchitectureNarrative[];
  responsibilities: string[];
  evidence: string[];
};

export type ArchitectureModel = {
  systems: ArchitectureSystem[];
  layers: ArchitectureLayer[];
  topology: ArchitectureDiagram;
  decisions: ArchitectureDecision[];
};

export type ProgressSlice = {
  id: string;
  name: string;
  status: string;
  detail: string;
};

export type ChangelogEntry = {
  id: string;
  title: string;
  date: string;
  commit: string;
  startedAt?: string;
  finishedAt?: string;
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
  codeChangeStats?: {
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
};

export type ProjectChangelog = {
  sourcePath: string;
  updatedAt: string;
  totalEntries: number;
  entries: ChangelogEntry[];
};

export type ParityResetMode = "none" | "run" | "suite" | "test";

export type ParitySuite = {
  id: string;
  name: string;
  description: string;
  layer: string;
  path: string;
  tags: string[];
  targets: string[];
  defaultResetMode: ParityResetMode;
};

export type ParityPlan = {
  id: string;
  name: string;
  description: string;
  suites: string[];
  resetMode: ParityResetMode;
  tags: string[];
  targets: string[];
};

export type ParityManifest = {
  id: string;
  version: string;
  description: string;
  defaultTarget: string;
  defaultResetMode: ParityResetMode;
  resetModes: Array<{ id: ParityResetMode; description: string }>;
  plans: ParityPlan[];
  suites: ParitySuite[];
};

export type CustomParityRunRequest = {
  selectionKind: "suite" | "plan";
  suite?: string;
  plan?: string;
  reset: ParityResetMode;
  headed: boolean;
  grep?: string;
};
