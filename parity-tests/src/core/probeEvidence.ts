import { promises as fs } from "node:fs";
import path from "node:path";
import type { TestInfo } from "@playwright/test";

export type DatabaseProbeEvidence = {
  target: string;
  probe: string;
  description: string;
  expected?: unknown;
  actual: unknown;
  context?: Record<string, unknown>;
};

export async function attachDatabaseProbeEvidence(testInfo: TestInfo, evidence: DatabaseProbeEvidence) {
  const attachmentName = `db-probe-${slugify(evidence.probe)}`;
  const attachmentPath = testInfo.outputPath(`${attachmentName}.json`);
  await fs.mkdir(path.dirname(attachmentPath), { recursive: true });
  await fs.writeFile(
    attachmentPath,
    JSON.stringify(
      {
        kind: "database-probe",
        generatedAt: new Date().toISOString(),
        ...evidence
      },
      null,
      2
    ),
    "utf8"
  );

  await testInfo.attach(attachmentName, {
    path: attachmentPath,
    contentType: "application/json"
  });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "evidence";
}
