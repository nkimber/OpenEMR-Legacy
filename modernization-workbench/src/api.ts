import { buildArchitectureModel } from "./architectureModel";
import type {
  AppSnapshot,
  ArchitectureModel,
  ArchitectureSystemSummary,
  CustomParityRunRequest,
  LifecycleEvent,
  NativeJestRunResult,
  NativeRunResult,
  ParityManifest,
  ParityComparisonReport,
  ParityReliabilityReport,
  ParityRunResult,
  ProgressResponse,
  ProjectChangelog,
  SeedDataset,
  SeedResult,
  SmokeResult,
  SourceInventory
} from "./types";

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.error ?? `Request failed: ${response.status}`);
  }
  return data as T;
}

export const api = {
  async getApps() {
    return requestJson<{ apps: AppSnapshot[] }>("/api/apps");
  },
  async getAppDetails(appId: string) {
    return requestJson<AppSnapshot>(`/api/apps/${appId}`);
  },
  async runAction(appId: string, action: "start" | "stop" | "restart") {
    return requestJson<{ snapshot: AppSnapshot; event: LifecycleEvent }>(`/api/apps/${appId}/actions/${action}`, {
      method: "POST"
    });
  },
  async startAllApps() {
    return requestJson<{ apps: AppSnapshot[] }>("/api/apps/actions/start-all", {
      method: "POST"
    });
  },
  async runTest(appId: string, testId: string) {
    return requestJson<{ snapshot: AppSnapshot; event: LifecycleEvent; latestTest: SmokeResult | ParityRunResult | NativeRunResult | NativeJestRunResult | null }>(`/api/apps/${appId}/tests/${testId}/run`, {
      method: "POST"
    });
  },
  async runCustomParity(appId: string, request: CustomParityRunRequest) {
    return requestJson<{ snapshot: AppSnapshot; event: LifecycleEvent; latestTest: ParityRunResult | null }>(`/api/apps/${appId}/parity-runs/run`, {
      method: "POST",
      body: JSON.stringify(request)
    });
  },
  async runSeed(appId: string, seedId: string) {
    return requestJson<{ snapshot: AppSnapshot; event: LifecycleEvent; latestSeed: SeedResult | null }>(`/api/apps/${appId}/seeds/${seedId}/run`, {
      method: "POST"
    });
  },
  async getLogs(appId: string) {
    return requestJson<{ result: { stdout: string; stderr: string; exitCode: number | null } }>(`/api/apps/${appId}/logs`);
  },
  async getEvents() {
    return requestJson<{ events: LifecycleEvent[] }>("/api/events");
  },
  async getArchitecture() {
    const data = await requestJson<{ systems: ArchitectureSystemSummary[]; sourceInventory: SourceInventory }>("/api/architecture");
    return buildArchitectureModel(data.systems, data.sourceInventory);
  },
  async getProgress() {
    return requestJson<ProgressResponse>("/api/progress");
  },
  async getSeedDatasets() {
    return requestJson<{ datasets: SeedDataset[] }>("/api/seed-datasets");
  },
  async getParityManifest() {
    return requestJson<ParityManifest>("/api/parity-manifest");
  },
  async getParityComparisons() {
    return requestJson<{ comparisons: ParityComparisonReport[] }>("/api/parity-comparisons");
  },
  async getParityReliability() {
    return requestJson<ParityReliabilityReport>("/api/parity-reliability");
  },
  async getChangelog(options?: { offset?: number; limit?: number; order?: "asc" | "desc" }) {
    const query = new URLSearchParams();
    if (options?.offset !== undefined) {
      query.set("offset", String(options.offset));
    }
    if (options?.limit !== undefined) {
      query.set("limit", String(options.limit));
    }
    if (options?.order) {
      query.set("order", options.order);
    }
    const queryString = query.toString();
    const suffix = queryString ? `?${queryString}` : "";
    return requestJson<ProjectChangelog>(`/api/changelog${suffix}`);
  }
};
