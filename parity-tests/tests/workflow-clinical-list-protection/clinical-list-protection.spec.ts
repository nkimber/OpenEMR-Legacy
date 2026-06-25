import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";

test.describe("clinical list protection parity @slice166 @clinical-list-protection", () => {
  test("requires an active session before clinical lists are visible", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId("MOD-PAT-0001");
    expect(patient).not.toBeNull();

    const lists = await targetDb.getClinicalListsForPatient(patient!.pid);
    const problem = lists.problems.find((item) => item.title.includes("diabetes")) ?? lists.problems[0];
    const allergy = lists.allergies.find((item) => item.title === "Penicillin") ?? lists.allergies[0];
    const medication = lists.medications.find((item) => item.title.startsWith("Metformin")) ?? lists.medications[0];
    const prescription = lists.prescriptions.find((item) => item.drug === "Metformin") ?? lists.prescriptions[0];

    expect(problem).toBeTruthy();
    expect(allergy).toBeTruthy();
    expect(medication).toBeTruthy();
    expect(prescription).toBeTruthy();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-166-clinical-list-protection-precondition",
      description:
        "Captures the Slice 166 clinical-list protection precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: "MOD-PAT-0001",
        legacyPatientSummaryPath: "/interface/patient_file/summary/demographics.php",
        modernizedClinicalListsPath: "/api/clinical-lists/{canonicalId}",
        modernizedAllergyMutationPath: "/api/clinical-lists/allergies",
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
        anchors: {
          problem: summarizeListAnchor(problem),
          allergy: summarizeListAnchor(allergy),
          medication: summarizeListAnchor(medication),
          prescription: {
            drug: prescription.drug
          }
        }
      },
      context: {
        suite: "workflow-clinical-list-protection",
        workflow: "clinical-list-protection-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await page.goto(`${target.publicUrl}/interface/patient_file/summary/demographics.php?set_pid=${patient!.pid}`);
      await expect(page.locator("body")).not.toContainText(problem.title);
      await expect(page.locator("body")).not.toContainText(allergy.title);
      await expect(page.locator("body")).not.toContainText(medication.title);
      await expect(page.locator("body")).not.toContainText(prescription.drug);
      const unauthenticatedSummaryText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-166-clinical-list-protection-unauthenticated",
        description:
          "Captures legacy OpenEMR clinical-list protection markers before an admin session is established.",
        expected: {
          containsProblem: false,
          containsAllergy: false,
          containsMedication: false,
          containsPrescription: false
        },
        actual: summarizeRenderedText(unauthenticatedSummaryText, [
          problem.title,
          allergy.title,
          medication.title,
          prescription.drug
        ]),
        context: {
          suite: "workflow-clinical-list-protection",
          workflow: "clinical-list-protection-unauthenticated"
        }
      });

      await loginToLegacyOpenEmr(page, target);
      await openPatientSummaryDirect(page, target, patient!.pid);
      await expectRenderedText(page, problem.title);
      await expectRenderedText(page, allergy.title);
      await expectRenderedText(page, medication.title);
      await expectRenderedText(page, prescription.drug);
      const authenticatedSummaryText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-166-clinical-list-protection-authenticated",
        description:
          "Captures legacy OpenEMR clinical-list visibility markers after an admin session is established.",
        expected: {
          containsProblem: true,
          containsAllergy: true,
          containsMedication: true,
          containsPrescription: true,
          passwordMaterialRedacted: true
        },
        actual: {
          rendered: summarizeRenderedText(authenticatedSummaryText, [
            problem.title,
            allergy.title,
            medication.title,
            prescription.drug
          ]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-clinical-list-protection",
          workflow: "clinical-list-protection-authenticated"
        }
      });
      return;
    }

    const unauthenticatedLists = await page.request.get(
      `${target.apiBaseUrl}/api/clinical-lists/${encodeURIComponent(patient!.pubpid)}`
    );
    expect(unauthenticatedLists.status()).toBe(401);
    const unauthenticatedListsBody = await unauthenticatedLists.json();
    expect(unauthenticatedListsBody).toMatchObject({
      authenticated: false,
      sessionSource: "modernized-openemr"
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-166-clinical-list-protection-unauthenticated",
      description:
        "Captures modernized clinical-list API protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        authenticated: false,
        sessionSource: "modernized-openemr"
      },
      actual: {
        statusCode: unauthenticatedLists.status(),
        body: unauthenticatedListsBody
      },
      context: {
        suite: "workflow-clinical-list-protection",
        workflow: "clinical-list-protection-unauthenticated"
      }
    });

    const unauthenticatedMutation = await page.request.post(`${target.apiBaseUrl}/api/clinical-lists/allergies`, {
      data: {
        patientId: patient!.pubpid,
        title: "Blocked Protection Allergy",
        dateTime: "2026-06-18 09:00:00",
        comments: "This request should be rejected before mutation.",
        reaction: "Rash",
        severity: "mild",
        listOptionId: "parity-allergy"
      }
    });
    expect(unauthenticatedMutation.status()).toBe(401);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-166-clinical-list-protection-unauthenticated-mutation",
      description:
        "Captures modernized clinical-list mutation protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        mutationRejected: true,
        title: "Blocked Protection Allergy"
      },
      actual: {
        statusCode: unauthenticatedMutation.status(),
        bodyPreview: (await unauthenticatedMutation.text()).slice(0, 240)
      },
      context: {
        suite: "workflow-clinical-list-protection",
        workflow: "clinical-list-protection-unauthenticated-mutation"
      }
    });

    const loginResponse = await page.request.post(`${target.apiBaseUrl}/api/auth/login`, {
      data: target.credentials
    });
    expect(loginResponse.ok()).toBeTruthy();
    const login = await loginResponse.json();
    expect(login.authenticated).toBe(true);
    expect(login.sessionId).toBeTruthy();

    const authenticatedLists = await page.request.get(
      `${target.apiBaseUrl}/api/clinical-lists/${encodeURIComponent(patient!.pubpid)}`,
      { headers: { "X-OpenEMR-Session": login.sessionId } }
    );
    expect(authenticatedLists.ok()).toBeTruthy();
    const authenticatedBody = await authenticatedLists.json();
    expect(authenticatedBody).toMatchObject({
      patientId: patient!.pubpid,
      legacyPid: patient!.pid,
      patientDisplayName: "Stone, Avery"
    });
    expect(authenticatedBody.problems.some((item: { title: string }) => item.title === problem.title)).toBe(true);
    expect(authenticatedBody.allergies.some((item: { title: string }) => item.title === allergy.title)).toBe(true);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-166-clinical-list-protection-authenticated",
      description:
        "Captures modernized clinical-list API visibility facts after an admin session is established, with the session identifier redacted.",
      expected: {
        loginAuthenticated: true,
        statusCode: 200,
        patientId: patient!.pubpid,
        legacyPid: patient!.pid,
        patientDisplayName: "Stone, Avery",
        includesProblem: problem.title,
        includesAllergy: allergy.title,
        sessionIdentifierRedacted: true
      },
      actual: {
        login: {
          authenticated: Boolean(login.authenticated),
          username: login.username,
          sessionIssued: Boolean(login.sessionId),
          sessionIdRedacted: true
        },
        authenticatedLists: {
          statusCode: authenticatedLists.status(),
          patientId: authenticatedBody.patientId,
          legacyPid: authenticatedBody.legacyPid,
          patientDisplayName: authenticatedBody.patientDisplayName,
          counts: {
            problems: authenticatedBody.problems.length,
            allergies: authenticatedBody.allergies.length,
            medications: authenticatedBody.medications.length,
            prescriptions: authenticatedBody.prescriptions.length
          },
          includesProblem: authenticatedBody.problems.some((item: { title: string }) => item.title === problem.title),
          includesAllergy: authenticatedBody.allergies.some((item: { title: string }) => item.title === allergy.title)
        }
      },
      context: {
        suite: "workflow-clinical-list-protection",
        workflow: "clinical-list-protection-authenticated"
      }
    });

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Lists" }).click();
    await expect(page.getByRole("heading", { name: "Lists", exact: true })).toBeVisible();
    await expect(page.locator("body")).toContainText("Sign in to load clinical lists");
    await expect(page.locator("body")).not.toContainText("Stone, Avery");
    await expect(page.locator("body")).not.toContainText(allergy.title);

    const accessPanel = page.locator('form[aria-label="Lists access"]');
    await accessPanel.getByLabel("Username").fill(target.credentials.username);
    await accessPanel.getByLabel("Password").fill(target.credentials.password);
    await accessPanel.getByRole("button", { name: "Verify Lists Access" }).click();
    await page.getByLabel("Clinical lists patient ID").fill(patient!.pubpid);

    await expect(page.getByRole("heading", { name: "Stone, Avery" })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(problem.title);
    await expect(page.locator("body")).toContainText(allergy.title);
    await expect(page.locator("body")).toContainText(medication.title);
    await expect(page.locator("body")).toContainText(prescription.drug);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-166-clinical-list-protection-rendered",
      description:
        "Captures modernized Lists-page protection rendering facts before and after login.",
      expected: {
        rendersSignedOutPrompt: "Sign in to load clinical lists",
        hidesPatientBeforeLogin: true,
        hidesAllergyBeforeLogin: true,
        rendersDisplayName: "Stone, Avery",
        rendersCanonicalId: patient!.pubpid,
        rendersProblem: problem.title,
        rendersAllergy: allergy.title,
        rendersMedication: medication.title,
        rendersPrescription: prescription.drug
      },
      actual: {
        surfaceFacts: {
          modernizedListsPage: {
            renderedSignedOutPrompt: "Sign in to load clinical lists",
            didNotRenderPatientBeforeLogin: true,
            didNotRenderAllergyBeforeLogin: true,
            renderedDisplayName: "Stone, Avery",
            renderedCanonicalId: patient!.pubpid,
            renderedProblem: problem.title,
            renderedAllergy: allergy.title,
            renderedMedication: medication.title,
            renderedPrescription: prescription.drug,
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-clinical-list-protection",
        workflow: "clinical-list-protection-rendered"
      }
    });
  });
});

function summarizeListAnchor(item: { id?: number | string; title: string }) {
  return {
    id: item.id,
    title: item.title
  };
}

function summarizeRenderedText(text: string | null, markers: string[]) {
  const body = text ?? "";
  return {
    bodyLength: body.length,
    bodyPreview: body.slice(0, 240),
    markers: Object.fromEntries(markers.map((marker) => [marker, body.includes(marker)]))
  };
}
