import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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
  test("requires an active session before patient documents are visible", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(documentProtectionPatientId);
    expect(patient).not.toBeNull();

    const documents = await targetDb.getPatientDocumentsForPatient(patient!.pid);
    const intakePacket = documents.documents.find((document) => document.name === documentProtectionAnchorName);
    expect(intakePacket).toBeTruthy();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-169-document-protection-precondition",
      description:
        "Captures the Slice 169 document protection precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: documentProtectionPatientId,
        anchorDocumentName: documentProtectionAnchorName,
        legacyDocumentListPath: "/controller.php?document&list",
        modernizedDocumentListPath: "/api/documents/{canonicalId}",
        modernizedDocumentContentPath: "/api/documents/{documentId}/content",
        modernizedDocumentCreatePath: "/api/documents",
        requiresAuthenticatedSession: true,
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true,
        patient: {
          canonicalId: patient!.pubpid,
          legacyPid: patient!.pid,
          displayName: `${patient!.lname}, ${patient!.fname}`
        },
        document: {
          id: intakePacket!.id,
          name: intakePacket!.name,
          categoryName: intakePacket!.categoryName
        }
      },
      context: {
        suite: "workflow-document-protection",
        workflow: "document-protection-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await page.goto(`${target.publicUrl}/controller.php?document&list&patient_id=${patient!.pid}`);
      await expect(page.locator("body")).not.toContainText(documentProtectionAnchorName);
      const unauthenticatedDocumentText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-169-document-protection-unauthenticated",
        description:
          "Captures legacy OpenEMR document-list protection markers before an admin session is established.",
        expected: {
          containsAnchorDocument: false
        },
        actual: summarizeRenderedText(unauthenticatedDocumentText, [documentProtectionAnchorName]),
        context: {
          suite: "workflow-document-protection",
          workflow: "document-protection-unauthenticated"
        }
      });

      await loginToLegacyOpenEmr(page, target);
      await openPatientDocumentsDirect(page, target, patient!.pid);
      await expandPatientDocumentCategories(page, ["Medical Record"]);
      await expectRenderedText(page, documentProtectionAnchorName);
      await expectRenderedText(page, "Medical Record");
      const authenticatedDocumentText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-169-document-protection-authenticated",
        description:
          "Captures legacy OpenEMR document-list visibility markers after an admin session is established.",
        expected: {
          containsAnchorDocument: true,
          containsMedicalRecordCategory: true,
          passwordMaterialRedacted: true
        },
        actual: {
          rendered: summarizeRenderedText(authenticatedDocumentText, [documentProtectionAnchorName, "Medical Record"]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-document-protection",
          workflow: "document-protection-authenticated"
        }
      });
      return;
    }

    const unauthenticatedSearch = await page.request.get(
      `${target.apiBaseUrl}/api/documents/${encodeURIComponent(patient!.pubpid)}`
    );
    expect(unauthenticatedSearch.status()).toBe(401);
    const unauthenticatedSearchBody = await expectUnauthenticatedResponse(unauthenticatedSearch);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-169-document-protection-unauthenticated-search",
      description:
        "Captures modernized patient-document list API protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        authenticated: false,
        sessionSource: "modernized-openemr"
      },
      actual: {
        statusCode: unauthenticatedSearch.status(),
        body: unauthenticatedSearchBody
      },
      context: {
        suite: "workflow-document-protection",
        workflow: "document-protection-unauthenticated-search"
      }
    });

    const unauthenticatedContent = await page.request.get(
      `${target.apiBaseUrl}/api/documents/${encodeURIComponent(String(intakePacket!.id))}/content`
    );
    expect(unauthenticatedContent.status()).toBe(401);
    const unauthenticatedContentBody = await expectUnauthenticatedResponse(unauthenticatedContent);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-169-document-protection-unauthenticated-content",
      description:
        "Captures modernized patient-document content API protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        authenticated: false,
        sessionSource: "modernized-openemr",
        contentRejected: true
      },
      actual: {
        statusCode: unauthenticatedContent.status(),
        body: unauthenticatedContentBody
      },
      context: {
        suite: "workflow-document-protection",
        workflow: "document-protection-unauthenticated-content"
      }
    });

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
    const unauthenticatedCreateBody = await expectUnauthenticatedResponse(unauthenticatedCreate);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-169-document-protection-unauthenticated-create",
      description:
        "Captures modernized patient-document create protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        createRejected: true,
        name: "Blocked Protection Patient Document"
      },
      actual: {
        statusCode: unauthenticatedCreate.status(),
        body: unauthenticatedCreateBody
      },
      context: {
        suite: "workflow-document-protection",
        workflow: "document-protection-unauthenticated-create"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-169-document-protection-authenticated-search",
      description:
        "Captures modernized patient-document list API visibility facts after an admin session is established, with session headers redacted.",
      expected: {
        statusCode: 200,
        documentId: intakePacket!.id,
        documentName: documentProtectionAnchorName,
        categoryName: "Medical Record",
        sessionIdentifierRedacted: true
      },
      actual: {
        authenticatedSearch: {
          statusCode: authenticatedSearch.status(),
          documentCount: authenticatedPayload.documents.length,
          includesAnchorDocument: authenticatedPayload.documents.some(
            (document) =>
              document.id === intakePacket!.id &&
              document.name === documentProtectionAnchorName &&
              document.categoryName === "Medical Record"
          ),
          sampleDocuments: authenticatedPayload.documents.slice(0, 5)
        },
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-document-protection",
        workflow: "document-protection-authenticated-search"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-169-document-protection-rendered",
      description:
        "Captures modernized Documents-page protection rendering facts before and after login.",
      expected: {
        rendersSignedOutPrompt: "Sign in to load patient documents",
        hidesAnchorDocumentBeforeLogin: true,
        disablesPatientSearchBeforeLogin: true,
        disablesArchivedToggleBeforeLogin: true,
        disablesSaveBeforeLogin: true,
        rendersAnchorDocument: documentProtectionAnchorName,
        rendersMedicalRecordCategory: "Medical Record"
      },
      actual: {
        surfaceFacts: {
          modernizedDocumentsPage: {
            renderedSignedOutPrompt: "Sign in to load patient documents",
            didNotRenderAnchorDocumentBeforeLogin: true,
            disabledPatientSearchBeforeLogin: true,
            disabledArchivedToggleBeforeLogin: true,
            disabledSaveBeforeLogin: true,
            renderedAnchorDocument: documentProtectionAnchorName,
            renderedMedicalRecordCategory: "Medical Record",
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-document-protection",
        workflow: "document-protection-rendered"
      }
    });
  });
});

async function expectUnauthenticatedResponse(response: { json: () => Promise<unknown> }) {
  const payload = await response.json() as { authenticated?: boolean; sessionSource?: string };
  expect(payload).toMatchObject({
    authenticated: false,
    sessionSource: "modernized-openemr"
  });
  return payload;
}

function summarizeRenderedText(text: string | null, markers: string[]) {
  const body = text ?? "";
  return {
    bodyLength: body.length,
    bodyPreview: body.slice(0, 240),
    markers: Object.fromEntries(markers.map((marker) => [marker, body.includes(marker)]))
  };
}
