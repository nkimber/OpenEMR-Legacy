import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";

const appointmentProtectionPatientId = "MOD-PAT-0003";
const appointmentProtectionFromDate = "2026-06-18";

test.describe("appointment schedule protection parity @slice167 @appointment-protection", () => {
  test("requires an active session before appointment schedules are visible", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentProtectionPatientId);
    expect(patient).not.toBeNull();

    const appointment = await targetDb.getFutureAppointmentForPatient(patient!.pid, appointmentProtectionFromDate);
    expect(appointment).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-167-appointment-protection-precondition",
      description:
        "Captures the Slice 167 appointment protection precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: appointmentProtectionPatientId,
        fromDate: appointmentProtectionFromDate,
        legacyAppointmentPath: "/interface/main/calendar/add_edit_event.php",
        modernizedAppointmentSearchPath: "/api/appointments",
        modernizedAppointmentDetailPath: "/api/appointments/{appointmentId}",
        modernizedAppointmentCreatePath: "/api/appointments",
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
        appointment: {
          id: appointment!.id,
          title: appointment!.title,
          eventDate: appointment!.eventDate
        }
      },
      context: {
        suite: "workflow-appointment-protection",
        workflow: "appointment-protection-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await page.goto(`${target.publicUrl}/interface/main/calendar/add_edit_event.php?eid=${appointment!.id}`);
      await expect(page.locator("body")).not.toContainText(appointment!.title);
      const unauthenticatedAppointmentText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-167-appointment-protection-unauthenticated",
        description:
          "Captures legacy OpenEMR appointment protection markers before an admin session is established.",
        expected: {
          containsAppointmentTitle: false
        },
        actual: summarizeRenderedText(unauthenticatedAppointmentText, [appointment!.title]),
        context: {
          suite: "workflow-appointment-protection",
          workflow: "appointment-protection-unauthenticated"
        }
      });

      await loginToLegacyOpenEmr(page, target);
      await openAppointmentDirect(page, target, appointment!.id);
      await expect(page.locator('input[name="form_title"]')).toHaveValue(appointment!.title);
      await expect(page.locator('input[name="form_patient"]')).toHaveValue(`${patient!.lname}, ${patient!.fname}`);
      await expect(page.locator('input[name="form_date"]')).toHaveValue(appointment!.eventDate);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-167-appointment-protection-authenticated",
        description:
          "Captures legacy OpenEMR appointment visibility markers after an admin session is established.",
        expected: {
          titleValue: appointment!.title,
          patientValue: `${patient!.lname}, ${patient!.fname}`,
          dateValue: appointment!.eventDate,
          passwordMaterialRedacted: true
        },
        actual: {
          titleValue: await page.locator('input[name="form_title"]').inputValue(),
          patientValue: await page.locator('input[name="form_patient"]').inputValue(),
          dateValue: await page.locator('input[name="form_date"]').inputValue(),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-appointment-protection",
          workflow: "appointment-protection-authenticated"
        }
      });
      return;
    }

    const unauthenticatedSearch = await page.request.get(
      `${target.apiBaseUrl}/api/appointments?patientId=${encodeURIComponent(patient!.pubpid)}&from=${appointmentProtectionFromDate}&limit=5`
    );
    expect(unauthenticatedSearch.status()).toBe(401);
    const unauthenticatedSearchBody = await unauthenticatedSearch.json();
    expect(unauthenticatedSearchBody).toMatchObject({
      authenticated: false,
      sessionSource: "modernized-openemr"
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-167-appointment-protection-unauthenticated-search",
      description:
        "Captures modernized appointment search API protection facts before an admin session is established.",
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
        suite: "workflow-appointment-protection",
        workflow: "appointment-protection-unauthenticated-search"
      }
    });

    const unauthenticatedCreate = await page.request.post(`${target.apiBaseUrl}/api/appointments`, {
      data: {
        patientId: patient!.pubpid,
        title: "Blocked Protection Appointment",
        date: "2026-11-17",
        startTime: "09:00",
        durationMinutes: 30,
        categoryId: 9,
        room: "Blocked"
      }
    });
    expect(unauthenticatedCreate.status()).toBe(401);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-167-appointment-protection-unauthenticated-create",
      description:
        "Captures modernized appointment create protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        createRejected: true,
        title: "Blocked Protection Appointment"
      },
      actual: {
        statusCode: unauthenticatedCreate.status(),
        bodyPreview: (await unauthenticatedCreate.text()).slice(0, 240)
      },
      context: {
        suite: "workflow-appointment-protection",
        workflow: "appointment-protection-unauthenticated-create"
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
      `${target.apiBaseUrl}/api/appointments?patientId=${encodeURIComponent(patient!.pubpid)}&from=${appointmentProtectionFromDate}&limit=5`,
      { headers: { "X-OpenEMR-Session": login.sessionId } }
    );
    expect(authenticatedSearch.ok()).toBeTruthy();
    const search = await authenticatedSearch.json();
    expect(search.appointments.some((item: { id: string; title: string }) => item.id === String(appointment!.id) && item.title === appointment!.title)).toBe(true);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-167-appointment-protection-authenticated-search",
      description:
        "Captures modernized appointment search API visibility facts after an admin session is established, with the session identifier redacted.",
      expected: {
        loginAuthenticated: true,
        statusCode: 200,
        includesAppointmentId: String(appointment!.id),
        includesAppointmentTitle: appointment!.title,
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
          appointmentCount: search.appointments.length,
          includesAppointment: search.appointments.some(
            (item: { id: string; title: string }) => item.id === String(appointment!.id) && item.title === appointment!.title
          ),
          sampleAppointments: search.appointments.slice(0, 5)
        }
      },
      context: {
        suite: "workflow-appointment-protection",
        workflow: "appointment-protection-authenticated-search"
      }
    });

    const authenticatedDetail = await page.request.get(
      `${target.apiBaseUrl}/api/appointments/${encodeURIComponent(String(appointment!.id))}`,
      { headers: { "X-OpenEMR-Session": login.sessionId } }
    );
    expect(authenticatedDetail.ok()).toBeTruthy();
    const detail = await authenticatedDetail.json();
    expect(detail).toMatchObject({
      id: String(appointment!.id),
      patientId: patient!.pubpid,
      legacyPid: patient!.pid,
      title: appointment!.title,
      date: appointment!.eventDate
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-167-appointment-protection-authenticated-detail",
      description:
        "Captures modernized appointment detail API visibility facts after an admin session is established.",
      expected: {
        statusCode: 200,
        id: String(appointment!.id),
        patientId: patient!.pubpid,
        legacyPid: patient!.pid,
        title: appointment!.title,
        date: appointment!.eventDate
      },
      actual: {
        statusCode: authenticatedDetail.status(),
        detail
      },
      context: {
        suite: "workflow-appointment-protection",
        workflow: "appointment-protection-authenticated-detail"
      }
    });

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Calendar" }).click();
    await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();
    await expect(page.locator("body")).toContainText("Sign in to load appointment schedules");
    await expect(page.locator(".appointment-list")).not.toContainText(appointment!.title);
    await expect(page.locator(".appointment-detail-panel")).not.toContainText(appointment!.title);
    await expect(page.getByLabel("Appointment patient ID")).toBeDisabled();
    await expect(page.locator('form[aria-label="Create appointment"]').getByRole("button", { name: "Create" })).toBeDisabled();

    await openAuthenticatedModernizedCalendar(page, target, patient!.pubpid, appointmentProtectionFromDate);
    const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(appointment!.title), "i") }).first();
    await expect(appointmentButton).toBeVisible();
    await appointmentButton.click();

    await expect(page.getByRole("heading", { name: appointment!.title })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(`PID ${patient!.pid}`);
    await expect(page.locator("body")).toContainText(appointment!.eventDate);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-167-appointment-protection-rendered",
      description:
        "Captures modernized Calendar-page protection rendering facts before and after login.",
      expected: {
        rendersSignedOutPrompt: "Sign in to load appointment schedules",
        hidesAppointmentBeforeLogin: true,
        disablesPatientSearchBeforeLogin: true,
        disablesCreateBeforeLogin: true,
        rendersAppointmentTitle: appointment!.title,
        rendersCanonicalId: patient!.pubpid,
        rendersLegacyPid: `PID ${patient!.pid}`,
        rendersAppointmentDate: appointment!.eventDate
      },
      actual: {
        surfaceFacts: {
          modernizedCalendarPage: {
            renderedSignedOutPrompt: "Sign in to load appointment schedules",
            didNotRenderAppointmentBeforeLogin: true,
            disabledPatientSearchBeforeLogin: true,
            disabledCreateBeforeLogin: true,
            renderedAppointmentTitle: appointment!.title,
            renderedCanonicalId: patient!.pubpid,
            renderedLegacyPid: `PID ${patient!.pid}`,
            renderedAppointmentDate: appointment!.eventDate,
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-appointment-protection",
        workflow: "appointment-protection-rendered"
      }
    });
  });
});

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
