import type { AppSnapshot, ArchitectureSystem, LifecycleEvent, ProgressSlice, SeedDataset } from "./types";

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
    return requestJson<{ systems: ArchitectureSystem[] }>("/api/architecture");
  },
  async getProgress() {
    return requestJson<{ slices: ProgressSlice[] }>("/api/progress");
  },
  async getSeedDatasets() {
    return requestJson<{ datasets: SeedDataset[] }>("/api/seed-datasets");
  }
};
