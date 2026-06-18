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
  tests: ManagedTest[];
  latestTest: SmokeResult | null;
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
