import { test, expect } from "../../src/fixtures/parityTest.js";
import { loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";

const contactAnchorPatientId = "MOD-PAT-0001";

test.describe("patient contact mutation parity @slice10 @workflow-contact @mutation", () => {
  test("updates, renders, and restores patient contact data", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(contactAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientContact(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient contact record.");
    }

    const suffix = workflowSuffix();
    const updated = {
      ...original,
      phoneHome: "(619) 555-9101",
      phoneCell: "(619) 555-9102",
      email: `parity-contact-${suffix}@example.test`,
      hipaaAllowSms: "YES",
      hipaaAllowEmail: "YES"
    };

    try {
      await workflow.updatePatientContact(updated);

      const actual = await workflow.getPatientContact(patient!.pid);
      expect(actual).toEqual(updated);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);

        await expect(page.locator("body")).toContainText(updated.email);
        await expect(page.locator("body")).toContainText(updated.phoneHome);
        await expect(page.locator("body")).toContainText(updated.phoneCell);
      } else {
        await page.goto(target.publicUrl);
        await expect(page.getByRole("heading", { name: "Patient/Client" })).toBeVisible();
        await page.getByLabel("Search patients").fill(patient!.pubpid);

        await expect(page.getByRole("heading", { name: "Stone, Avery" })).toBeVisible();
        await expect(page.locator("body")).toContainText(updated.email);
        await expect(page.locator("body")).toContainText(updated.phoneHome);
        await expect(page.locator("body")).toContainText(updated.phoneCell);
        await expect(page.locator("body")).toContainText("SMS permission");
        await expect(page.locator("body")).toContainText("Email permission");
      }
    } finally {
      await workflow.updatePatientContact(original);
    }

    const restored = await workflow.getPatientContact(patient!.pid);
    expect(restored).toEqual(original);
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
