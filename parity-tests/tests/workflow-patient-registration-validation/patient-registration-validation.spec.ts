import { promises as fs } from "node:fs";
import path from "node:path";
import { test, expect } from "../../src/fixtures/parityTest.js";
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
  }) => {
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

    const rows = await targetDb.queryRows<{ count: string }>(
      `SELECT COUNT(*) AS count FROM patients WHERE pubpid = '${invalidPubpid}';`
    );
    expect(Number(rows[0]?.count ?? 0)).toBe(0);
  });
});
