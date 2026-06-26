import { promises as fs } from "node:fs";
import path from "node:path";
import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

type ValidationProblem = {
  title?: string;
  status?: number;
  errors?: Record<string, string[]>;
};

test.describe("patient registration validation readiness @slice192 @workflow-patient-registration-validation @patients", () => {
  test("mirrors OpenEMR patient validator rules and blocks invalid modernized registrations", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    if (target.type === "legacy-openemr") {
      const sourceRoot = path.resolve(target.parityRoot, target.sourcePath ?? "../legacy-openemr/source");
      const validator = await fs.readFile(path.join(sourceRoot, "src", "Validators", "PatientValidator.php"), "utf8");
      const newPatientForm = await fs.readFile(path.join(sourceRoot, "interface", "new", "new.php"), "utf8");

      expect(validator).toContain('$context->required("fname", "First Name")->lengthBetween(1, 255)');
      expect(validator).toContain('$context->required("lname", \'Last Name\')->lengthBetween(2, 255)');
      expect(validator).toContain('$context->required("sex", \'Gender\')->lengthBetween(4, 30)');
      expect(validator).toContain('$context->required("DOB", \'Date of Birth\')->datetime(\'Y-m-d\')');
      expect(validator).toContain("ValidationUtils::isValidEmail");
      expect(newPatientForm).toContain("Please select a birth date!");
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-192-patient-registration-validation-legacy-rules",
        description: "Captures the Slice 192 legacy PatientValidator and new-patient form rules that define the registration validation parity contract.",
        expected: {
          validatorRules: [
            "First Name is required and length 1-255.",
            "Last Name is required and length 2-255.",
            "Gender is required and length 4-30.",
            "Date of Birth is required in Y-m-d format.",
            "Email is checked with ValidationUtils::isValidEmail."
          ],
          formRules: ["The legacy new-patient form prompts for a missing birth date."]
        },
        actual: {
          patientValidatorPath: "src/Validators/PatientValidator.php",
          newPatientFormPath: "interface/new/new.php",
          matchedRules: {
            firstName: validator.includes('$context->required("fname", "First Name")->lengthBetween(1, 255)'),
            lastName: validator.includes('$context->required("lname", \'Last Name\')->lengthBetween(2, 255)'),
            sex: validator.includes('$context->required("sex", \'Gender\')->lengthBetween(4, 30)'),
            dateOfBirth: validator.includes('$context->required("DOB", \'Date of Birth\')->datetime(\'Y-m-d\')'),
            email: validator.includes("ValidationUtils::isValidEmail"),
            missingBirthDatePrompt: newPatientForm.includes("Please select a birth date!")
          }
        },
        context: {
          suite: "workflow-patient-registration-validation",
          workflow: "patient-registration-validation-legacy-rules"
        }
      });
      return;
    }

    const suffix = `${Date.now()}`.slice(-9);
    const invalidPubpid = `TMP-PAT-REG-VAL-${suffix}`;
    const headers = await getModernizedAdminSessionHeaders(page, target);

    const invalidRegistration = {
      pubpid: invalidPubpid,
      firstName: "Validation",
      lastName: "Q",
      preferredName: "Slice192",
      sex: "",
      dateOfBirth: "1991-04-15",
      street: "192 Validation Way",
      city: "Hartford",
      state: "CT",
      postalCode: "06103",
      maritalStatus: "single",
      occupation: "Registration Validation Fixture",
      phoneHome: "(860) 555-1920",
      phoneCell: "(860) 555-1921",
      email: "not-an-email",
      hipaaAllowSms: "YES",
      hipaaAllowEmail: "YES"
    };

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-192-patient-registration-validation-invalid-registration",
      description: "Captures the invalid Slice 192 registration draft submitted to the modernized patient API and UI.",
      expected: {
        blockedFields: ["lastName", "sex", "email"],
        noPatientRowCreated: true
      },
      actual: {
        invalidRegistration
      },
      context: {
        pubpid: invalidPubpid,
        suite: "workflow-patient-registration-validation",
        workflow: "patient-registration-validation-invalid-registration"
      }
    });

    const apiResponse = await page.request.post(`${target.apiBaseUrl}/api/patients`, {
      headers,
      data: invalidRegistration
    });
    expect(apiResponse.status()).toBe(400);
    const problem = (await apiResponse.json()) as ValidationProblem;
    expect(problem.title).toBe("Patient registration validation failed");
    expect(problem.errors?.lastName).toContain("Last name must be at least 2 characters.");
    expect(problem.errors?.sex).toContain("Sex is required.");
    expect(problem.errors?.email).toContain("Email must be a valid email address.");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-192-patient-registration-validation-modernized-api",
      description: "Captures the structured modernized API validation problem returned for an invalid Slice 192 patient registration.",
      expected: {
        status: 400,
        title: "Patient registration validation failed",
        errors: {
          lastName: ["Last name must be at least 2 characters."],
          sex: ["Sex is required."],
          email: ["Email must be a valid email address."]
        }
      },
      actual: {
        status: apiResponse.status(),
        problem
      },
      context: {
        pubpid: invalidPubpid,
        suite: "workflow-patient-registration-validation",
        workflow: "patient-registration-validation-modernized-api"
      }
    });

    await openAuthenticatedModernizedPatient(page, target);
    await page.getByRole("button", { name: "Register patient" }).click();
    await page.getByLabel("New patient public ID").fill(invalidRegistration.pubpid);
    await page.getByLabel("New patient first name").fill(invalidRegistration.firstName);
    await page.getByLabel("New patient last name").fill(invalidRegistration.lastName);
    await page.getByLabel("New patient date of birth").fill(invalidRegistration.dateOfBirth);
    await page.getByLabel("New patient email").fill(invalidRegistration.email);
    await page.getByLabel("New patient home phone").fill(invalidRegistration.phoneHome);
    await page.getByLabel("New patient cell phone").fill(invalidRegistration.phoneCell);
    await page.getByRole("button", { name: "Create chart" }).click();

    const validationPanel = page.getByLabel("Patient registration validation");
    await expect(validationPanel).toContainText("Last name must be at least 2 characters.");
    await expect(validationPanel).toContainText("Sex is required.");
    await expect(validationPanel).toContainText("Email must be a valid email address.");
    const validationPanelText = await validationPanel.innerText();

    const rows = await targetDb.queryRows<{ count: string }>(
      `SELECT COUNT(*) AS count FROM patients WHERE pubpid = '${invalidPubpid}';`
    );
    expect(Number(rows[0]?.count ?? 0)).toBe(0);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-192-patient-registration-validation-modernized-surface",
      description: "Captures the modernized Patient/Client validation panel and database no-row guard after submitting the invalid Slice 192 registration.",
      expected: {
        validationPanelMessages: [
          "Last name must be at least 2 characters.",
          "Sex is required.",
          "Email must be a valid email address."
        ],
        patientRowCount: 0
      },
      actual: {
        validationPanelText,
        invalidPubpid,
        patientRows: rows
      },
      context: {
        pubpid: invalidPubpid,
        suite: "workflow-patient-registration-validation",
        workflow: "patient-registration-validation-modernized-surface"
      }
    });
  });
});
