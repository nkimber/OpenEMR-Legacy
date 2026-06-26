import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openEncounterDirect } from "../../src/ui/legacyOpenEmr.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedEncounters
} from "../../src/ui/modernizedOpenEmr.js";

const encounterProtectionPatientId = "MOD-PAT-0001";
const encounterProtectionFromDate = "2026-01-01";

test.describe("encounter protection parity @slice168 @encounter-protection", () => {
  test("requires an active session before encounter details are visible", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterProtectionPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    const clinical = await targetDb.getEncounterClinicalDetail(patient!.pid, encounter!.encounter);
    expect(clinical).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-168-encounter-protection-precondition",
      description:
        "Captures the Slice 168 encounter protection precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: encounterProtectionPatientId,
        fromDate: encounterProtectionFromDate,
        legacyEncounterPath: "/interface/patient_file/encounter/encounter_top.php",
        modernizedEncounterSearchPath: "/api/encounters",
        modernizedEncounterDetailPath: "/api/encounters/{encounterId}",
        modernizedEncounterCreatePath: "/api/encounters",
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
        encounter: {
          encounter: encounter!.encounter,
          date: encounter!.date,
          reason: clinical!.reason,
          topic: encounterTopic(clinical!.reason)
        }
      },
      context: {
        suite: "workflow-encounter-protection",
        workflow: "encounter-protection-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await page.goto(
        `${target.publicUrl}/interface/patient_file/encounter/encounter_top.php?set_pid=${patient!.pid}&set_encounter=${encounter!.encounter}`
      );
      await expect(page.locator("body")).not.toContainText(clinical!.reason);
      const unauthenticatedEncounterText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-168-encounter-protection-unauthenticated",
        description:
          "Captures legacy OpenEMR encounter protection markers before an admin session is established.",
        expected: {
          containsEncounterReason: false
        },
        actual: summarizeRenderedText(unauthenticatedEncounterText, [clinical!.reason]),
        context: {
          suite: "workflow-encounter-protection",
          workflow: "encounter-protection-unauthenticated"
        }
      });

      await loginToLegacyOpenEmr(page, target);
      await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
      await expectRenderedText(page, new RegExp(escapeRegex(encounterTopic(clinical!.reason)), "i"));
      await expectRenderedText(page, "SOAP");
      await expectRenderedText(page, "Vitals");
      const authenticatedEncounterText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-168-encounter-protection-authenticated",
        description:
          "Captures legacy OpenEMR encounter visibility markers after an admin session is established.",
        expected: {
          containsEncounterTopic: true,
          containsSoap: true,
          containsVitals: true,
          passwordMaterialRedacted: true
        },
        actual: {
          rendered: summarizeRenderedText(authenticatedEncounterText, [encounterTopic(clinical!.reason), "SOAP", "Vitals"]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-encounter-protection",
          workflow: "encounter-protection-authenticated"
        }
      });
      return;
    }

    const unauthenticatedSearch = await page.request.get(
      `${target.apiBaseUrl}/api/encounters?patientId=${encodeURIComponent(patient!.pubpid)}&from=${encounterProtectionFromDate}&limit=5`
    );
    expect(unauthenticatedSearch.status()).toBe(401);
    const unauthenticatedSearchBody = await unauthenticatedSearch.json();
    expect(unauthenticatedSearchBody).toMatchObject({
      authenticated: false,
      sessionSource: "modernized-openemr"
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-168-encounter-protection-unauthenticated-search",
      description:
        "Captures modernized encounter search API protection facts before an admin session is established.",
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
        suite: "workflow-encounter-protection",
        workflow: "encounter-protection-unauthenticated-search"
      }
    });

    const unauthenticatedCreate = await page.request.post(`${target.apiBaseUrl}/api/encounters`, {
      data: {
        patientId: patient!.pubpid,
        dateTime: "2026-06-18 10:00:00",
        reason: "Blocked Protection Encounter",
        facilityId: null,
        billingFacilityId: null
      }
    });
    expect(unauthenticatedCreate.status()).toBe(401);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-168-encounter-protection-unauthenticated-create",
      description:
        "Captures modernized encounter create protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        createRejected: true,
        reason: "Blocked Protection Encounter"
      },
      actual: {
        statusCode: unauthenticatedCreate.status(),
        bodyPreview: (await unauthenticatedCreate.text()).slice(0, 240)
      },
      context: {
        suite: "workflow-encounter-protection",
        workflow: "encounter-protection-unauthenticated-create"
      }
    });

    const headers = await getModernizedAdminSessionHeaders(page, target);
    const authenticatedSearch = await page.request.get(
      `${target.apiBaseUrl}/api/encounters?patientId=${encodeURIComponent(patient!.pubpid)}&from=${encounterProtectionFromDate}&limit=5`,
      { headers }
    );
    expect(authenticatedSearch.ok()).toBeTruthy();
    const search = await authenticatedSearch.json();
    expect(
      search.encounters.some(
        (item: { encounter: number; patientId: string; reason?: string | null }) =>
          item.encounter === encounter!.encounter &&
          item.patientId === patient!.pubpid &&
          item.reason === clinical!.reason
        )
    ).toBe(true);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-168-encounter-protection-authenticated-search",
      description:
        "Captures modernized encounter search API visibility facts after an admin session is established, with the session identifier redacted.",
      expected: {
        statusCode: 200,
        includesEncounter: encounter!.encounter,
        patientId: patient!.pubpid,
        reason: clinical!.reason,
        sessionIdentifierRedacted: true
      },
      actual: {
        authenticatedSearch: {
          statusCode: authenticatedSearch.status(),
          encounterCount: search.encounters.length,
          includesEncounter: search.encounters.some(
            (item: { encounter: number; patientId: string; reason?: string | null }) =>
              item.encounter === encounter!.encounter &&
              item.patientId === patient!.pubpid &&
              item.reason === clinical!.reason
          ),
          sampleEncounters: search.encounters.slice(0, 5)
        },
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-encounter-protection",
        workflow: "encounter-protection-authenticated-search"
      }
    });

    const authenticatedDetail = await page.request.get(
      `${target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(encounter!.encounter))}`,
      { headers }
    );
    expect(authenticatedDetail.ok()).toBeTruthy();
    const detail = await authenticatedDetail.json();
    expect(detail).toMatchObject({
      encounter: encounter!.encounter,
      patientId: patient!.pubpid,
      legacyPid: patient!.pid,
      reason: clinical!.reason
    });
    expect(detail.vitals).toBeTruthy();
    expect(detail.soapNote).toBeTruthy();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-168-encounter-protection-authenticated-detail",
      description:
        "Captures modernized encounter detail API visibility facts after an admin session is established.",
      expected: {
        statusCode: 200,
        encounter: encounter!.encounter,
        patientId: patient!.pubpid,
        legacyPid: patient!.pid,
        reason: clinical!.reason,
        hasVitals: true,
        hasSoapNote: true
      },
      actual: {
        statusCode: authenticatedDetail.status(),
        detail: {
          encounter: detail.encounter,
          patientId: detail.patientId,
          legacyPid: detail.legacyPid,
          reason: detail.reason,
          hasVitals: Boolean(detail.vitals),
          hasSoapNote: Boolean(detail.soapNote)
        }
      },
      context: {
        suite: "workflow-encounter-protection",
        workflow: "encounter-protection-authenticated-detail"
      }
    });

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Encounters" }).click();
    await expect(page.getByRole("heading", { name: "Encounters", exact: true })).toBeVisible();
    await expect(page.locator("body")).toContainText("Sign in to load encounters");
    await expect(page.locator(".appointment-list")).not.toContainText(clinical!.reason);
    await expect(page.locator(".appointment-detail-panel")).not.toContainText(clinical!.reason);
    await expect(page.getByLabel("Encounter patient ID")).toBeDisabled();
    await expect(page.getByLabel("Encounter from date")).toBeDisabled();
    await expect(page.locator('form[aria-label="Create encounter"]').getByRole("button", { name: "Create" })).toBeDisabled();

    await openAuthenticatedModernizedEncounters(page, target, patient!.pubpid, encounterProtectionFromDate);
    const encounterButton = page.getByRole("button", { name: new RegExp(escapeRegex(encounterTopic(clinical!.reason)), "i") }).first();
    await expect(encounterButton).toBeVisible();
    await encounterButton.click();

    await expect(page.getByRole("heading", { name: clinical!.reason })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(`PID ${patient!.pid}`);
    await expect(page.locator("body")).toContainText("SOAP Note");
    await expect(page.locator("body")).toContainText("Vitals");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-168-encounter-protection-rendered",
      description:
        "Captures modernized Encounters-page protection rendering facts before and after login.",
      expected: {
        rendersSignedOutPrompt: "Sign in to load encounters",
        hidesEncounterBeforeLogin: true,
        disablesPatientSearchBeforeLogin: true,
        disablesFromDateBeforeLogin: true,
        disablesCreateBeforeLogin: true,
        rendersEncounterReason: clinical!.reason,
        rendersCanonicalId: patient!.pubpid,
        rendersLegacyPid: `PID ${patient!.pid}`,
        rendersSoapNote: "SOAP Note",
        rendersVitals: "Vitals"
      },
      actual: {
        surfaceFacts: {
          modernizedEncountersPage: {
            renderedSignedOutPrompt: "Sign in to load encounters",
            didNotRenderEncounterBeforeLogin: true,
            disabledPatientSearchBeforeLogin: true,
            disabledFromDateBeforeLogin: true,
            disabledCreateBeforeLogin: true,
            renderedEncounterReason: clinical!.reason,
            renderedCanonicalId: patient!.pubpid,
            renderedLegacyPid: `PID ${patient!.pid}`,
            renderedSoapNote: "SOAP Note",
            renderedVitals: "Vitals",
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-encounter-protection",
        workflow: "encounter-protection-rendered"
      }
    });
  });
});

function encounterTopic(reason: string) {
  return reason.replace(/^Follow-up for\s+/i, "").replace(/^Comprehensive\s+/i, "");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function summarizeRenderedText(text: string | null, markers: string[]) {
  const body = text ?? "";
  return {
    bodyLength: body.length,
    bodyPreview: body.slice(0, 240),
    markers: Object.fromEntries(markers.map((marker) => [marker, body.includes(marker)]))
  };
}
