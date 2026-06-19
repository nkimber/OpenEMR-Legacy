import { buildArchitectureModel } from "./architectureModel";
import type {
  AppSnapshot,
  ArchitectureModel,
  ArchitectureSystemSummary,
  CustomParityRunRequest,
  LifecycleEvent,
  ParityManifest,
  ParityRunResult,
  ProgressSlice,
  ProjectChangelog,
  SeedDataset
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
  async runAction(appId: string, action: "start" | "stop" | "restart") {
    return requestJson<{ snapshot: AppSnapshot; event: LifecycleEvent }>(`/api/apps/${appId}/actions/${action}`, {
      method: "POST"
    });
  },
  async runTest(appId: string, testId: string) {
    return requestJson<{ snapshot: AppSnapshot; event: LifecycleEvent }>(`/api/apps/${appId}/tests/${testId}/run`, {
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
    return requestJson<{ snapshot: AppSnapshot; event: LifecycleEvent }>(`/api/apps/${appId}/seeds/${seedId}/run`, {
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
    const data = await requestJson<{ systems: ArchitectureSystemSummary[] }>("/api/architecture");
    return buildArchitectureModel(data.systems);
  },
  async getProgress() {
    return requestJson<{ slices: ProgressSlice[] }>("/api/progress");
  },
  async getSeedDatasets() {
    return requestJson<{ datasets: SeedDataset[] }>("/api/seed-datasets");
  },
  async getParityManifest() {
    return requestJson<ParityManifest>("/api/parity-manifest");
  },
  async getChangelog() {
    return requestJson<ProjectChangelog>("/api/changelog");
  }
};
