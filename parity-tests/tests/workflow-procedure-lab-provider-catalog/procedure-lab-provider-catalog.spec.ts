import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureReportReviewQueueDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedReports } from "../../src/ui/modernizedOpenEmr.js";

const anchorPatientId = "MOD-PAT-0009";
const anchorOrderId = 5000009;
const anchorReportId = 6000009;
const anchorLabId = 504;
const outsideLabId = 501;
const anchorOrderDate = "2026-02-26";
const anchorReportDateDisplay = "2026-02-28 14:00";
const anchorProcedureCode = "85025";
const anchorProcedureName = "Complete blood count";
const anchorLabName = "Pacific Women's Health Laboratory";
const anchorSpecimenNumber = "SP-6000009";

test.describe("procedure lab provider catalog parity @slice139 @workflow-procedure-lab-provider-catalog @read-only", () => {
  test("renders seeded processing lab ownership for reviewed procedure reports", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(anchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing seeded procedure lab provider catalog patient ${anchorPatientId}`);
    }

    const expectedReviewedFilter = {
      patientId: anchorPatientId,
      labId: anchorLabId,
      fromDate: anchorOrderDate,
      toDate: anchorOrderDate
    };
    const expectedOutsideLabFilter = {
      patientId: anchorPatientId,
      labId: outsideLabId,
      fromDate: anchorOrderDate,
      toDate: anchorOrderDate
    };
    let anchorReport:
      | Awaited<ReturnType<typeof targetDb.getProcedureReportReviewQueue>>["reports"][number]
      | undefined;
    let surfaceFacts: Record<string, unknown> = {};

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-139-procedure-lab-provider-catalog-precondition",
      description:
        "Seeded patient and expected permanent reviewed procedure report lab-provider ownership anchors before catalog checks.",
      expected: {
        patientCanonicalId: anchorPatientId,
        anchorOrderId,
        anchorReportId,
        anchorLabId,
        outsideLabId,
        anchorLabName,
        anchorProcedureCode,
        anchorProcedureName,
        anchorOrderDate,
        anchorReportDateDisplay,
        anchorSpecimenNumber,
        reviewedFilter: expectedReviewedFilter,
        outsideLabFilter: expectedOutsideLabFilter
      },
      actual: {
        patient
      }
    });

    const reviewedQueue = await targetDb.getProcedureReportReviewQueue("reviewed", {
      patientId: anchorPatientId,
      labId: anchorLabId,
      fromDate: anchorOrderDate,
      toDate: anchorOrderDate
    });

    expect(reviewedQueue.labFilter).toBe(String(anchorLabId));
    expect(reviewedQueue.reviewedReports).toBeGreaterThanOrEqual(1);
    anchorReport = reviewedQueue.reports.find((report) => report.reportId === anchorReportId);
    expect(anchorReport).toMatchObject({
      reportId: anchorReportId,
      orderId: anchorOrderId,
      patientId: patient.pid,
      pubpid: anchorPatientId,
      labId: anchorLabId,
      labName: anchorLabName,
      procedureCode: anchorProcedureCode,
      procedureName: anchorProcedureName,
      orderDate: anchorOrderDate,
      reportDate: anchorReportDateDisplay,
      reportStatus: "complete",
      reviewStatus: "reviewed",
      reviewedBy: "admin",
      reviewedAt: anchorReportDateDisplay,
      specimenNumber: anchorSpecimenNumber,
      notes: "Gold dataset result"
    });

    const outsideLabQueue = await targetDb.getProcedureReportReviewQueue("reviewed", {
      patientId: anchorPatientId,
      labId: outsideLabId,
      fromDate: anchorOrderDate,
      toDate: anchorOrderDate
    });
    expect(outsideLabQueue.reports.some((report) => report.reportId === anchorReportId)).toBe(false);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-139-procedure-lab-provider-catalog-matched",
      description:
        "Permanent reviewed procedure report appears under the expected processing lab and is excluded by the outside-lab filter.",
      expected: {
        reviewedFilter: {
          ...expectedReviewedFilter,
          labFilter: String(anchorLabId),
          containsAnchorReport: true,
          reviewedReportsAtLeast: 1
        },
        outsideLabFilter: {
          ...expectedOutsideLabFilter,
          containsAnchorReport: false
        },
        anchorReport: {
          reportId: anchorReportId,
          orderId: anchorOrderId,
          patientId: patient.pid,
          pubpid: anchorPatientId,
          labId: anchorLabId,
          labName: anchorLabName,
          procedureCode: anchorProcedureCode,
          procedureName: anchorProcedureName,
          orderDate: anchorOrderDate,
          reportDate: anchorReportDateDisplay,
          reportStatus: "complete",
          reviewStatus: "reviewed",
          reviewedBy: "admin",
          reviewedAt: anchorReportDateDisplay,
          specimenNumber: anchorSpecimenNumber
        }
      },
      actual: {
        patient,
        reviewedQueue,
        anchorReport,
        outsideLabQueue
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openProcedureReportReviewQueueDirect(
        page,
        target,
        patient!.pid,
        anchorOrderDate,
        anchorOrderDate,
        "2",
        undefined,
        anchorLabId
      );
      await expectRenderedText(page, anchorLabName);
      await expectRenderedText(page, anchorOrderDate);
      await expectRenderedText(page, "Reviewed");
      surfaceFacts = {
        legacyReviewedQueue: {
          patientPid: patient.pid,
          fromDate: anchorOrderDate,
          toDate: anchorOrderDate,
          reviewStatusFilter: "2",
          labId: anchorLabId,
          renderedLabName: anchorLabName,
          renderedOrderDate: anchorOrderDate,
          renderedReviewStatus: "Reviewed"
        }
      };
    } else {
      await openAuthenticatedModernizedReports(page, target);
      const reviewQueue = page.locator('[aria-label="Procedure report review queue"]');
      await page.getByRole("button", { name: "Reviewed", exact: true }).click();
      await reviewQueue.getByLabel("Patient").fill(anchorPatientId);
      await reviewQueue.getByLabel("Lab").fill(String(anchorLabId));
      await reviewQueue.getByLabel("From").fill(anchorOrderDate);
      await reviewQueue.getByLabel("To").fill(anchorOrderDate);
      await expect(reviewQueue).toContainText(anchorProcedureName);
      await expect(reviewQueue).toContainText(anchorLabName);
      await expect(reviewQueue).toContainText(`#${anchorLabId}`);

      await reviewQueue.getByLabel("Lab").fill(String(outsideLabId));
      await expect(reviewQueue).not.toContainText(anchorProcedureName);
      surfaceFacts = {
        modernizedReviewedQueue: {
          patientInput: anchorPatientId,
          fromDate: anchorOrderDate,
          toDate: anchorOrderDate,
          labId: anchorLabId,
          outsideLabId,
          renderedProcedureName: anchorProcedureName,
          renderedLabName: anchorLabName,
          renderedLabToken: `#${anchorLabId}`,
          outsideLabExcludedProcedureName: true
        }
      };
    }
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-139-procedure-lab-provider-catalog-rendered",
      description:
        "Browser/API surface evidence for permanent lab-provider catalog ownership on the reviewed procedure report row.",
      expected: {
        matchingLabRendersProcedure: true,
        matchingLabRendersLabName: anchorLabName,
        matchingLabRendersOrderDate: anchorOrderDate,
        outsideLabExcludesProcedure: true
      },
      actual: {
        patient,
        anchorReport,
        reviewedQueue,
        outsideLabQueue,
        surfaceFacts
      }
    });
  });
});
