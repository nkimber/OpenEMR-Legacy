import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const clinicalListMutationAnchorPatientId = "MOD-PAT-0006";

test.describe("clinical list mutation parity @slice13 @workflow-clinical-lists @mutation", () => {
  test("creates, renders, deactivates, and removes an allergy list entry", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(clinicalListMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Allergy ${workflowSuffix()}`;
    let listEntryId: number | string | null = null;

    try {
      listEntryId = await workflow.createClinicalListEntry({
        patientId: patient!.pid,
        type: "allergy",
        title,
        dateTime: "2026-06-18 09:00:00",
        comments: "Created by the parity clinical-list mutation suite.",
        reaction: "Rash",
        severity: "mild",
        listOptionId: "parity-allergy"
      });

      const created = await workflow.getClinicalListEntry(listEntryId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        type: "allergy",
        title,
        activity: 1,
        reaction: "Rash",
        severity: "mild",
        listOptionId: "parity-allergy"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.allergies).toBe(beforeCounts.allergies + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, title);
      } else {
        await openAuthenticatedModernizedClinicalLists(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText(title);
        await expect(page.locator("body")).toContainText("Rash / mild");
        await expect(page.getByRole("button", { name: "Deactivate" }).first()).toBeVisible();
      }

      const inactiveComment = "Deactivated by the parity clinical-list mutation suite.";
      await workflow.deactivateClinicalListEntry(listEntryId, inactiveComment);
      const inactive = await workflow.getClinicalListEntry(listEntryId);
      expect(inactive).toMatchObject({
        activity: 0,
        comments: inactiveComment
      });
    } finally {
      if (listEntryId !== null) {
        await workflow.deleteClinicalListEntry(listEntryId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.allergies).toBe(beforeCounts.allergies);
    if (listEntryId !== null) {
      await expect(workflow.getClinicalListEntry(listEntryId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
