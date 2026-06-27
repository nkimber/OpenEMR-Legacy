import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";

const encounterAnchorPatientId = "MOD-PAT-0002";
const encounterDate = "2026-06-18";
const encounterReason = `SOAP Template Encounter ${workflowSuffix()}`;
const selectedTemplateId = "soap-diabetes-follow-up-v1";

type SoapTemplateOption = {
  templateId: string;
  name: string;
  category: string;
  description: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  isDefault: boolean;
};

test.describe("encounter SOAP template parity @slice604 @workflow-encounter-soap-template @encounters @mutation", () => {
  test("applies a server-owned SOAP template to a temporary encounter note", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterAnchorPatientId);
    expect(patient).not.toBeNull();
    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const template = expectedSoapTemplates().find((item) => item.templateId === selectedTemplateId)!;
    let encounterId: number | null = null;
    let soapId: number | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-604-encounter-soap-template-precondition",
      description:
        "Captures the Slice 604 encounter SOAP-template source facts: anchor patient, starting counts, selected template payload, and temporary encounter plan.",
      expected: {
        patient: { pubpid: encounterAnchorPatientId },
        selectedTemplateId,
        templateFields: ["subjective", "objective", "assessment", "plan"]
      },
      actual: {
        patient,
        beforeCounts,
        selectedTemplate: template
      },
      context: {
        canonicalId: encounterAnchorPatientId,
        suite: "workflow-encounter-soap-template",
        workflow: "encounter-soap-template-precondition"
      }
    });

    try {
      encounterId = await workflow.createEncounter({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        dateTime: `${encounterDate} 10:00:00`,
        reason: encounterReason,
        facilityId: 10,
        facilityName: "OpenEMR Modernization Clinic",
        billingFacilityId: 10,
        billingNote: "Created by the SOAP template parity suite."
      });
      const encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      if (target.type === "legacy-openemr") {
        soapId = await workflow.createSoapNote({
          patientId: patient!.pid,
          encounter: encounter!.encounter,
          dateTime: `${encounterDate} 10:10:00`,
          subjective: template.subjective,
          objective: template.objective,
          assessment: template.assessment,
          plan: template.plan
        });
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const catalogResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/soap-note-templates`, { headers });
        expect(catalogResponse.ok()).toBeTruthy();
        const catalog = await catalogResponse.json() as { templates: SoapTemplateOption[] };
        expect(catalog.templates).toEqual(expectedSoapTemplates());

        await openAuthenticatedModernizedEncounters(page, target, patient!.pubpid, encounterDate);
        const encounterButton = page.getByRole("button", { name: new RegExp(escapeRegex(encounterReason), "i") }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();
        await expect(page.getByRole("heading", { name: encounterReason })).toBeVisible();

        await page.getByLabel("SOAP note template", { exact: true }).selectOption(selectedTemplateId);
        await page.getByRole("button", { name: "Apply template" }).click();
        await expect(page.getByLabel("SOAP subjective")).toHaveValue(template.subjective);
        await expect(page.getByLabel("SOAP assessment")).toHaveValue(template.assessment);
        await page.getByLabel("Record SOAP note").getByRole("button", { name: "Record" }).click();
      }

      const savedSoap = await findLatestSoapNote(target.type, targetDb as QueryableDb, encounter!.encounter);
      expect(savedSoap).toMatchObject({
        patientId: String(patient!.pid),
        subjective: template.subjective,
        objective: template.objective,
        assessment: template.assessment,
        plan: template.plan
      });
      soapId = Number(savedSoap!.id);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-604-encounter-soap-template-result",
        description:
          "Captures the temporary SOAP note created from the selected Slice 604 template and the count movement before cleanup.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters + 1,
            clinicalNotes: beforeCounts.clinicalNotes + 1
          },
          soap: {
            templateId: selectedTemplateId,
            assessment: template.assessment
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          encounterId,
          soapId,
          savedSoap
        },
        context: {
          canonicalId: encounterAnchorPatientId,
          suite: "workflow-encounter-soap-template",
          workflow: "encounter-soap-template-result"
        }
      });

      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterCreateCounts.clinicalNotes).toBe(beforeCounts.clinicalNotes + 1);
    } finally {
      if (soapId !== null) {
        await workflow.deleteSoapNote(soapId);
      }
      if (encounterId !== null) {
        await workflow.deleteEncounter(encounterId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-604-encounter-soap-template-cleanup",
      description: "Captures the Slice 604 cleanup state after deleting the temporary SOAP note and encounter.",
      expected: {
        counts: beforeCounts
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        encounterId,
        soapId
      },
      context: {
        canonicalId: encounterAnchorPatientId,
        suite: "workflow-encounter-soap-template",
        workflow: "encounter-soap-template-cleanup"
      }
    });

    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.clinicalNotes).toBe(beforeCounts.clinicalNotes);
  });
});

type QueryableDb = {
  queryRows<T extends Record<string, string>>(sql: string): Promise<T[]>;
};

type SoapNoteRow = {
  id: string;
  patientId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

async function findLatestSoapNote(targetType: string, db: QueryableDb, encounter: number): Promise<SoapNoteRow | null> {
  if (targetType === "legacy-openemr") {
    const rows = await db.queryRows<SoapNoteRow>(`
SELECT id, pid AS patientId, subjective, objective, assessment, plan
FROM form_soap
WHERE id IN (
  SELECT form_id
  FROM forms
  WHERE encounter = ${integer(encounter)}
    AND form_name = 'SOAP'
)
ORDER BY id DESC
LIMIT 1;
`);
    return rows[0] ?? null;
  }

  const rows = await db.queryRows<SoapNoteRow>(`
SELECT id::text AS id, pid::text AS "patientId", COALESCE(subjective, '') AS subjective, COALESCE(objective, '') AS objective,
  COALESCE(assessment, '') AS assessment, COALESCE(plan, '') AS plan
FROM clinical_notes
WHERE encounter = ${integer(encounter)}
ORDER BY id DESC
LIMIT 1;
`);
  return rows[0] ?? null;
}

function expectedSoapTemplates(): SoapTemplateOption[] {
  return [
    {
      templateId: "soap-follow-up-stable-v1",
      name: "Stable follow-up SOAP",
      category: "Follow-up",
      description: "General established-patient follow-up template for stable symptoms and continued monitoring.",
      subjective: "Patient reports symptoms are stable and denies new acute concerns.",
      objective: "Vitals and interval history reviewed. No acute distress noted.",
      assessment: "Stable chronic condition with no red-flag changes today.",
      plan: "Continue current care plan, reinforce return precautions, and schedule routine follow-up.",
      isDefault: true
    },
    {
      templateId: selectedTemplateId,
      name: "Diabetes follow-up SOAP",
      category: "Chronic disease",
      description: "Focused diabetes follow-up template with medication adherence, foot-care, and lab-review prompts.",
      subjective: "Patient reports home glucose readings and medication adherence were reviewed.",
      objective: "Vitals reviewed. Foot-care status, recent labs, and medication list reconciled.",
      assessment: "Diabetes mellitus follow-up with control and complication risk reviewed.",
      plan: "Continue diabetes care plan, reinforce diet and foot-care education, and update labs as indicated.",
      isDefault: false
    },
    {
      templateId: "soap-acute-respiratory-v1",
      name: "Acute respiratory SOAP",
      category: "Acute visit",
      description: "Acute cough/upper-respiratory template with symptom duration, exam, assessment, and precautions.",
      subjective: "Patient reports acute respiratory symptoms; duration, fever, exposure, and medication history reviewed.",
      objective: "Respiratory status, oxygen saturation, lung exam, and hydration status reviewed.",
      assessment: "Acute respiratory symptoms assessed with severity and complication risk reviewed.",
      plan: "Provide supportive-care instructions, medication plan as appropriate, and clear return precautions.",
      isDefault: false
    },
    {
      templateId: "soap-preventive-annual-v1",
      name: "Preventive annual SOAP",
      category: "Preventive care",
      description: "Preventive visit template for screening, immunization, risk review, and health-maintenance planning.",
      subjective: "Patient presents for preventive care; interval history, screening needs, and health goals reviewed.",
      objective: "Vitals, preventive screening status, immunization history, and risk factors reviewed.",
      assessment: "Preventive health maintenance visit with screening and risk-reduction needs identified.",
      plan: "Update preventive screenings, immunizations, counseling, and follow-up plan as indicated.",
      isDefault: false
    }
  ];
}

function workflowSuffix() {
  return Date.now().toString(36).toUpperCase();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function integer(value: number) {
  if (!Number.isInteger(value)) {
    throw new Error(`Expected integer value, got ${value}`);
  }
  return String(value);
}
