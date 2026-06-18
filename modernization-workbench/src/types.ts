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

export type ArchitectureSystem = {
  id: string;
  name: string;
  status: string;
  stack: string[];
  database: string;
  businessLogic: string;
  tests: string[];
};

export type ProgressSlice = {
  id: string;
  name: string;
  status: string;
  detail: string;
};
