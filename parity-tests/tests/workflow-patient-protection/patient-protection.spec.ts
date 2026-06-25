import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";

test.describe("patient chart protection parity @slice165 @patient-protection", () => {
  test("requires an active session before patient search and chart data are visible", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId("MOD-PAT-0001");
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-165-patient-protection-precondition",
      description:
        "Captures the Slice 165 patient chart protection precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: "MOD-PAT-0001",
        legacyPatientSummaryPath: "/interface/patient_file/summary/demographics.php",
        modernizedPatientSearchPath: "/api/patients",
        modernizedPatientChartPath: "/api/patients/{canonicalId}",
        requiresAuthenticatedSession: true,
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true,
        patient: patient
          ? {
              canonicalId: patient.pubpid,
              legacyPid: patient.pid,
              displayName: `${patient.lname}, ${patient.fname}`
            }
          : null
      },
      context: {
        suite: "workflow-patient-protection",
        workflow: "patient-protection-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await page.goto(`${target.publicUrl}/interface/patient_file/summary/demographics.php?set_pid=${patient!.pid}`);
      await expect(page.locator("body")).not.toContainText(patient!.pubpid);
      await expect(page.locator("body")).not.toContainText(patient!.fname);
      await expect(page.locator("body")).not.toContainText(patient!.lname);
      const unauthenticatedSummaryText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-165-patient-protection-unauthenticated",
        description:
          "Captures legacy OpenEMR patient summary protection markers before an admin session is established.",
        expected: {
          containsCanonicalId: false,
          containsFirstName: false,
          containsLastName: false
        },
        actual: summarizeRenderedText(unauthenticatedSummaryText, [patient!.pubpid, patient!.fname, patient!.lname]),
        context: {
          suite: "workflow-patient-protection",
          workflow: "patient-protection-unauthenticated"
        }
      });

      await loginToLegacyOpenEmr(page, target);
      await openPatientSummaryDirect(page, target, patient!.pid);
      await expectRenderedText(page, patient!.fname);
      await expectRenderedText(page, patient!.lname);
      await expectRenderedText(page, String(patient!.pid));
      const authenticatedSummaryText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-165-patient-protection-authenticated",
        description:
          "Captures legacy OpenEMR patient summary visibility markers after an admin session is established.",
        expected: {
          containsFirstName: true,
          containsLastName: true,
          containsLegacyPid: true,
          passwordMaterialRedacted: true
        },
        actual: {
          rendered: summarizeRenderedText(authenticatedSummaryText, [patient!.fname, patient!.lname, String(patient!.pid)]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-patient-protection",
          workflow: "patient-protection-authenticated"
        }
      });
      return;
    }

    const unauthenticatedSearch = await page.request.get(
      `${target.apiBaseUrl}/api/patients?search=${encodeURIComponent(patient!.pubpid)}&limit=25`
    );
    expect(unauthenticatedSearch.status()).toBe(401);
    const unauthenticatedSearchBody = await unauthenticatedSearch.json();
    expect(unauthenticatedSearchBody).toMatchObject({
      authenticated: false,
      sessionSource: "modernized-openemr"
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-165-patient-protection-unauthenticated-search",
      description:
        "Captures modernized patient search API protection facts before an admin session is established.",
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
        suite: "workflow-patient-protection",
        workflow: "patient-protection-unauthenticated-search"
      }
    });

    const unauthenticatedChart = await page.request.get(
      `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`
    );
    expect(unauthenticatedChart.status()).toBe(401);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-165-patient-protection-unauthenticated-chart",
      description:
        "Captures modernized patient chart API protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        chartRejected: true
      },
      actual: {
        statusCode: unauthenticatedChart.status(),
        bodyPreview: (await unauthenticatedChart.text()).slice(0, 240)
      },
      context: {
        suite: "workflow-patient-protection",
        workflow: "patient-protection-unauthenticated-chart"
      }
    });

    const loginResponse = await page.request.post(`${target.apiBaseUrl}/api/auth/login`, {
      data: target.credentials
    });
    expect(loginResponse.ok()).toBeTruthy();
    const login = await loginResponse.json();
    expect(login.authenticated).toBe(true);
    expect(login.sessionId).toBeTruthy();

    const authenticatedSearch = await page.request.get(
      `${target.apiBaseUrl}/api/patients?search=${encodeURIComponent(patient!.pubpid)}&limit=25`,
      { headers: { "X-OpenEMR-Session": login.sessionId } }
    );
    expect(authenticatedSearch.ok()).toBeTruthy();
    const search = await authenticatedSearch.json();
    expect(search.patients).toHaveLength(1);
    expect(search.patients[0]).toMatchObject({
      canonicalId: patient!.pubpid,
      legacyPid: patient!.pid,
      displayName: "Stone, Avery"
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-165-patient-protection-authenticated-search",
      description:
        "Captures modernized patient search API visibility facts after an admin session is established, with the session identifier redacted.",
      expected: {
        loginAuthenticated: true,
        statusCode: 200,
        patientCount: 1,
        canonicalId: patient!.pubpid,
        legacyPid: patient!.pid,
        displayName: "Stone, Avery",
        sessionIdentifierRedacted: true
      },
      actual: {
        login: {
          authenticated: Boolean(login.authenticated),
          username: login.username,
          sessionIssued: Boolean(login.sessionId),
          sessionIdRedacted: true
        },
        authenticatedSearch: {
          statusCode: authenticatedSearch.status(),
          patientCount: search.patients.length,
          firstPatient: search.patients[0]
        }
      },
      context: {
        suite: "workflow-patient-protection",
        workflow: "patient-protection-authenticated-search"
      }
    });

    const authenticatedChart = await page.request.get(
      `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
      { headers: { "X-OpenEMR-Session": login.sessionId } }
    );
    expect(authenticatedChart.ok()).toBeTruthy();
    const chart = await authenticatedChart.json();
    expect(chart).toMatchObject({
      canonicalId: patient!.pubpid,
      legacyPid: patient!.pid,
      displayName: "Stone, Avery",
      purpose: "Stable search and demographics navigation"
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-165-patient-protection-authenticated-chart",
      description:
        "Captures modernized patient chart API visibility facts after an admin session is established.",
      expected: {
        statusCode: 200,
        canonicalId: patient!.pubpid,
        legacyPid: patient!.pid,
        displayName: "Stone, Avery",
        purpose: "Stable search and demographics navigation"
      },
      actual: {
        statusCode: authenticatedChart.status(),
        chart
      },
      context: {
        suite: "workflow-patient-protection",
        workflow: "patient-protection-authenticated-chart"
      }
    });

    await page.goto(target.publicUrl);
    await expect(page.getByRole("heading", { name: "Patient/Client" })).toBeVisible();
    await expect(page.locator("body")).toContainText("Sign in to search patient charts");
    await expect(page.locator("body")).toContainText("Sign in to load patient charts");
    await expect(page.locator("body")).not.toContainText("Stone, Avery");

    const accessPanel = page.locator('form[aria-label="Patient access"]');
    await accessPanel.getByLabel("Username").fill(target.credentials.username);
    await accessPanel.getByLabel("Password").fill(target.credentials.password);
    await accessPanel.getByRole("button", { name: "Verify Patient Access" }).click();

    await page.getByLabel("Search patients").fill(patient!.pubpid);
    await expect(page.getByRole("button", { name: /Stone, Avery/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Stone, Avery" })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(`PID ${patient!.pid}`);
    await expect(page.locator("body")).toContainText("Stable search and demographics navigation");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-165-patient-protection-rendered",
      description:
        "Captures modernized Patient/Client-page protection rendering facts before and after login.",
      expected: {
        rendersSignedOutSearchPrompt: "Sign in to search patient charts",
        rendersSignedOutChartPrompt: "Sign in to load patient charts",
        hidesPatientBeforeLogin: true,
        rendersDisplayName: "Stone, Avery",
        rendersCanonicalId: patient!.pubpid,
        rendersLegacyPid: `PID ${patient!.pid}`,
        rendersPurpose: "Stable search and demographics navigation"
      },
      actual: {
        surfaceFacts: {
          modernizedPatientClientPage: {
            renderedSignedOutSearchPrompt: "Sign in to search patient charts",
            renderedSignedOutChartPrompt: "Sign in to load patient charts",
            didNotRenderPatientBeforeLogin: true,
            renderedDisplayName: "Stone, Avery",
            renderedCanonicalId: patient!.pubpid,
            renderedLegacyPid: `PID ${patient!.pid}`,
            renderedPurpose: "Stable search and demographics navigation",
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-patient-protection",
        workflow: "patient-protection-rendered"
      }
    });
  });
});

function summarizeRenderedText(text: string | null, markers: string[]) {
  const body = text ?? "";
  return {
    bodyLength: body.length,
    bodyPreview: body.slice(0, 240),
    markers: Object.fromEntries(markers.map((marker) => [marker, body.includes(marker)]))
  };
}
