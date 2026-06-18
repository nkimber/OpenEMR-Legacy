import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const artifactRoot = process.env.PARITY_RUN_ARTIFACT_DIR
  ? path.resolve(process.env.PARITY_RUN_ARTIFACT_DIR)
  : path.resolve("artifacts", "runs", "local");

const headed = process.env.PARITY_HEADED === "1";

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  workers: Number(process.env.PARITY_WORKERS ?? "1"),
  outputDir: path.join(artifactRoot, "test-results"),
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(artifactRoot, "playwright-report.json") }],
    ["junit", { outputFile: path.join(artifactRoot, "junit.xml") }],
    ["html", { outputFolder: path.join(artifactRoot, "html-report"), open: "never" }]
  ],
  use: {
    baseURL: process.env.PARITY_PUBLIC_URL,
    ignoreHTTPSErrors: true,
    headless: !headed,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
