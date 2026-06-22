import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedDocuments
} from "../../src/ui/modernizedOpenEmr.js";

const documentProtectionPatientId = "MOD-PAT-0001";
const documentProtectionAnchorName = "Primary care intake packet";

test.describe("patient document protection parity @slice169 @document-protection", () => {
  test("requires an active session before patient documents are visible", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(documentProtectionPatientId);
    expect(patient).not.toBeNull();

    const documents = await targetDb.getPatientDocumentsForPatient(patient!.pid);
    const intakePacket = documents.documents.find((document) => document.name === documentProtectionAnchorName);
    expect(intakePacket).toBeTruthy();

    if (target.type === "legacy-openemr") {
      await page.goto(`${target.publicUrl}/controller.php?document&list&patient_id=${patient!.pid}`);
      await expect(page.locator("body")).not.toContainText(documentProtectionAnchorName);

      await loginToLegacyOpenEmr(page, target);
      await openPatientDocumentsDirect(page, target, patient!.pid);
      await expandPatientDocumentCategories(page, ["Medical Record"]);
      await expectRenderedText(page, documentProtectionAnchorName);
      await expectRenderedText(page, "Medical Record");
      return;
    }

    const unauthenticatedSearch = await page.request.get(
      `${target.apiBaseUrl}/api/documents/${encodeURIComponent(patient!.pubpid)}`
    );
    expect(unauthenticatedSearch.status()).toBe(401);
    await expectUnauthenticatedResponse(unauthenticatedSearch);

    const unauthenticatedContent = await page.request.get(
      `${target.apiBaseUrl}/api/documents/${encodeURIComponent(String(intakePacket!.id))}/content`
    );
    expect(unauthenticatedContent.status()).toBe(401);
    await expectUnauthenticatedResponse(unauthenticatedContent);

    const unauthenticatedCreate = await page.request.post(`${target.apiBaseUrl}/api/documents`, {
      data: {
        patientId: patient!.pubpid,
        categoryId: 3,
        name: "Blocked Protection Patient Document",
        docDate: "2026-06-18",
        encounter: 1000013,
        content: "This unauthenticated document create must be blocked.",
        notes: "Protection check"
      }
    });
    expect(unauthenticatedCreate.status()).toBe(401);
    await expectUnauthenticatedResponse(unauthenticatedCreate);

    const headers = await getModernizedAdminSessionHeaders(page, target);
    const authenticatedSearch = await page.request.get(
      `${target.apiBaseUrl}/api/documents/${encodeURIComponent(patient!.pubpid)}`,
      { headers }
    );
    expect(authenticatedSearch.ok()).toBeTruthy();
    const authenticatedPayload = await authenticatedSearch.json() as {
      documents: Array<{ id: number; name: string; categoryName: string }>;
    };
    expect(
      authenticatedPayload.documents.some(
        (document) =>
          document.id === intakePacket!.id &&
          document.name === documentProtectionAnchorName &&
          document.categoryName === "Medical Record"
      )
    ).toBe(true);

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Documents" }).click();
    await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
    await expect(page.getByRole("form", { name: "Documents access" })).toBeVisible();
    await expect(page.locator("body")).toContainText("Sign in to load patient documents");
    await expect(page.getByLabel("Documents patient ID")).toBeDisabled();
    await expect(page.getByLabel("Show archived documents")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save Document" })).toBeDisabled();
    await expect(page.locator("body")).not.toContainText(documentProtectionAnchorName);

    await openAuthenticatedModernizedDocuments(page, target, patient!.pubpid);
    await expect(page.locator(".document-list-body")).toContainText(documentProtectionAnchorName);
    await expect(page.locator(".document-list-body")).toContainText("Medical Record");
  });
});

async function expectUnauthenticatedResponse(response: { json: () => Promise<unknown> }) {
  const payload = await response.json() as { authenticated?: boolean; sessionSource?: string };
  expect(payload).toMatchObject({
    authenticated: false,
    sessionSource: "modernized-openemr"
  });
}
