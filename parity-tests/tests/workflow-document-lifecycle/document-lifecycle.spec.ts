import type { Page } from "@playwright/test";
import { test, expect } from "../../src/fixtures/parityTest.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { PatientDocumentRecord } from "../../src/workflows/legacyWorkflowActions.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const documentLifecycleAnchorPatientId = "MOD-PAT-0001";

type PatientDocumentLifecycleEvent = {
  code: string;
  label: string;
  occurredAt?: string | null;
  actor?: string | null;
  detail: string;
};

type PatientDocumentApiItem = {
  id: number;
  name: string;
  deleted: number;
  reviewStatus: string;
  reviewedBy?: string | null;
  lifecycleEvents?: PatientDocumentLifecycleEvent[];
};

test.describe("patient document lifecycle timeline parity @slice91 @workflow-document-lifecycle @mutation @documents", () => {
  test("tracks, renders, archives, restores, and removes patient document lifecycle states", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(documentLifecycleAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const documentName = `Parity Patient Lifecycle Document ${workflowSuffix()}`;
    const body = `Created by the parity patient document lifecycle suite for ${documentName}.`;
    const notes = "Created by the parity patient document lifecycle suite.";
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createPatientDocument({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-20",
        encounter: 1000013,
        content: body,
        notes
      });

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-20",
        encounter: 1000013,
        deleted: 0,
        reviewStatus: "pending",
        notes
      });
      expect(created!.contentPreview).toContain(body);
      expectLifecycleCodes(created!, ["filed", "current-version", "review-pending", "active"]);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      if (target.type === "modernized-openemr") {
        await expectModernizedLifecycle(page, target, patient!.pubpid, Number(documentId), [
          "filed",
          "current-version",
          "review-pending",
          "active"
        ]);

        const createdCard = await openModernizedPatientDocumentCard(page, target, patient!.pubpid, documentName);
        await expect(createdCard).toContainText("Filed");
        await expect(createdCard).toContainText("Current version");
        await expect(createdCard).toContainText("Review pending");
        await expect(createdCard).toContainText("Active");
      }

      await workflow.signPatientDocument(documentId, "admin");

      const signed = await workflow.getPatientDocument(documentId);
      expect(signed).toMatchObject({
        deleted: 0,
        reviewStatus: "approved",
        reviewedBy: "admin"
      });
      expect(signed!.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expectLifecycleCodes(signed!, ["filed", "current-version", "review-approved", "active"]);

      if (target.type === "modernized-openemr") {
        const apiSigned = await expectModernizedLifecycle(page, target, patient!.pubpid, Number(documentId), [
          "filed",
          "current-version",
          "review-approved",
          "active"
        ]);
        expect(apiSigned.reviewedBy).toBe("admin");

        const signedCard = await openModernizedPatientDocumentCard(page, target, patient!.pubpid, documentName);
        await expect(signedCard).toContainText("Review approved");
        await expect(signedCard).toContainText("By admin");
        await expect(signedCard).toContainText("Active");

        await signedCard.getByRole("button", { name: "View" }).click();
        const viewer = page.getByLabel("Document viewer");
        await expect(viewer).toContainText("Review approved");
        await expect(viewer).toContainText("By admin");
      }

      await workflow.softDeletePatientDocument(documentId);

      const archived = await workflow.getPatientDocument(documentId);
      expect(archived).toMatchObject({
        deleted: 1,
        reviewStatus: "approved",
        reviewedBy: "admin"
      });
      expectLifecycleCodes(archived!, ["filed", "current-version", "review-approved", "archived"]);

      const afterArchiveCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterArchiveCounts.documents).toBe(beforeCounts.documents);

      if (target.type === "modernized-openemr") {
        await expectModernizedLifecycle(page, target, patient!.pubpid, Number(documentId), [
          "filed",
          "current-version",
          "review-approved",
          "archived"
        ]);

        const archivedCard = await openModernizedPatientDocumentCard(page, target, patient!.pubpid, documentName, true);
        await expect(archivedCard).toContainText("Review approved");
        await expect(archivedCard).toContainText("Archived");
      }

      await workflow.restorePatientDocument(documentId);

      const restored = await workflow.getPatientDocument(documentId);
      expect(restored).toMatchObject({
        deleted: 0,
        reviewStatus: "approved",
        reviewedBy: "admin"
      });
      expect(restored!.contentPreview).toContain(body);
      expectLifecycleCodes(restored!, ["filed", "current-version", "review-approved", "active"]);

      const afterRestoreCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterRestoreCounts.documents).toBe(beforeCounts.documents + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, documentName);
      } else {
        await expectModernizedLifecycle(page, target, patient!.pubpid, Number(documentId), [
          "filed",
          "current-version",
          "review-approved",
          "active"
        ]);

        const restoredCard = await openModernizedPatientDocumentCard(page, target, patient!.pubpid, documentName);
        await expect(restoredCard).toContainText("Review approved");
        await expect(restoredCard).toContainText("Active");
        await expect(restoredCard).toContainText(body);
      }
    } finally {
      if (documentId !== null) {
        await workflow.deletePatientDocument(documentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.documents).toBe(beforeCounts.documents);
    if (documentId !== null) {
      await expect(workflow.getPatientDocument(documentId)).resolves.toBeNull();
    }
  });
});

function expectLifecycleCodes(document: PatientDocumentRecord, expectedCodes: string[]) {
  expect(deriveLifecycleCodes(document)).toEqual(expectedCodes);
}

function deriveLifecycleCodes(document: PatientDocumentRecord) {
  const reviewCode = document.reviewStatus === "approved"
    ? "review-approved"
    : document.reviewStatus === "denied"
      ? "review-denied"
      : "review-pending";

  return [
    "filed",
    "current-version",
    reviewCode,
    document.deleted === 0 ? "active" : "archived"
  ];
}

async function expectModernizedLifecycle(
  page: Page,
  target: RuntimeTarget,
  patientPublicId: string,
  documentId: number,
  expectedCodes: string[]
) {
  const response = await page.request.get(
    `${target.apiBaseUrl}/api/documents/${encodeURIComponent(patientPublicId)}?includeArchived=true`
  );
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { documents: PatientDocumentApiItem[] };
  const document = payload.documents.find((item) => item.id === documentId);
  expect(document).toBeTruthy();
  expect(document!.lifecycleEvents).toBeTruthy();
  expect(document!.lifecycleEvents!.map((event) => event.code)).toEqual(expectedCodes);
  expect(document!.lifecycleEvents!.map((event) => event.label)).toEqual([
    "Filed",
    "Current version",
    expectedCodes[2] === "review-approved"
      ? "Review approved"
      : expectedCodes[2] === "review-denied"
        ? "Review denied"
        : "Review pending",
    expectedCodes[3] === "archived" ? "Archived" : "Active"
  ]);
  return document!;
}

async function openModernizedPatientDocumentCard(
  page: Page,
  target: RuntimeTarget,
  patientPublicId: string,
  documentName: string,
  includeArchived = false
) {
  await page.goto(target.publicUrl);
  await page.getByRole("button", { name: "Documents" }).click();
  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
  await page.getByLabel("Documents patient ID").fill(patientPublicId);

  if (includeArchived) {
    await page.getByLabel("Show archived documents").check();
  }

  const documentCard = page.locator(".document-card").filter({ hasText: documentName }).first();
  await expect(documentCard).toBeVisible();
  return documentCard;
}

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
