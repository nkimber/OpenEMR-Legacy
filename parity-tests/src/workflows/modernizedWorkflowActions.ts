import type { ModernizedPostgresProbe } from "../db/modernizedPostgresProbe.js";
import type { RuntimeTarget } from "../config/targets.js";
import type {
  AccessGroupMembership,
  AccessGroupMembershipMutation,
  AccessPermissionAssignment,
  AccessPermissionMutation,
  AppointmentRecord,
  BillingLineCorrection,
  BillingLineRecord,
  ClaimStatusRecord,
  ClaimStatusUpdate,
  ClinicalListRecord,
  EncounterMetadataInput,
  EncounterRecord,
  FacilityRecord,
  ImmunizationRecord,
  NewBillingLine,
  NewClaimStatus,
  NewClinicalListEntry,
  NewFacility,
  NewImmunization,
  NewMedication,
  NewPaymentPosting,
  NewPatientBinaryDocument,
  NewPatientDocument,
  NewPatientExternalLinkDocument,
  NewPatientInsurance,
  NewPatientRegistration,
  NewProblem,
  NewUser,
  NewPatientMessage,
  NewAppointment,
  NewEncounter,
  NewProcedureOrder,
  NewProcedureReport,
  NewProcedureResult,
  NewPrescription,
  NewSoapNote,
  NewVitals,
  PatientContact,
  PatientDemographics,
  PatientDocumentContentReplacement,
  PatientDocumentMetadataUpdate,
  PatientDocumentRecord,
  PatientInsuranceRecord,
  PatientMessageRecord,
  PaymentPostingRecord,
  MedicationRecord,
  ProblemRecord,
  ProcedureOrderRecord,
  ProcedureReportRecord,
  ProcedureResultRecord,
  PrescriptionRecord,
  SoapNoteRecord,
  UserRecord,
  VitalsRecord
} from "./legacyWorkflowActions.js";

export class ModernizedWorkflowActions {
  constructor(
    private readonly db: ModernizedPostgresProbe,
    private readonly target: RuntimeTarget
  ) {}

  async createUser(input: NewUser): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/administration/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error(`Modernized user create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async getUser(id: number): Promise<UserRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT s.id, s.username, s.first_name AS "firstName", s.last_name AS "lastName",
  s.role, CASE WHEN s.role = 'provider' THEN '1' ELSE '0' END AS authorized,
  CASE WHEN s.active THEN '1' ELSE '0' END AS active,
  CASE WHEN s.calendar THEN '1' ELSE '0' END AS calendar,
  COALESCE(s.facility_id::text, '0') AS "facilityId",
  COALESCE(f.name, '') AS "facilityName",
  COALESCE(s.email, '') AS email,
  COALESCE(s.npi, '') AS npi
FROM staff s
LEFT JOIN facilities f ON f.id = s.facility_id
WHERE s.id = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    return row ? {
      id: Number(row.id),
      username: row.username,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role,
      authorized: row.authorized === "1",
      active: row.active === "1",
      calendar: row.calendar === "1",
      facilityId: Number(row.facilityId),
      facilityName: row.facilityName,
      email: row.email,
      npi: row.npi
    } : null;
  }

  async updateUser(id: number, input: NewUser): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/administration/users/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error(`Modernized user update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteUser(id: number): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/administration/users/${id}`, {
      method: "DELETE"
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized user delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createFacility(input: NewFacility): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/administration/facilities`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error(`Modernized facility create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async getFacility(id: number): Promise<FacilityRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, code, name, COALESCE(phone, '') AS phone,
  COALESCE(street, '') AS street, COALESCE(city, '') AS city, COALESCE(state, '') AS state,
  COALESCE(postal_code, '') AS "postalCode", COALESCE(color, '') AS color,
  CASE WHEN inactive THEN '0' ELSE '1' END AS active
FROM facilities
WHERE id = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    return row ? {
      id: Number(row.id),
      code: row.code,
      name: row.name,
      active: row.active === "1",
      phone: row.phone,
      street: row.street,
      city: row.city,
      state: row.state,
      postalCode: row.postalCode,
      color: row.color
    } : null;
  }

  async updateFacility(id: number, input: NewFacility): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/administration/facilities/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error(`Modernized facility update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteFacility(id: number): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/administration/facilities/${id}`, {
      method: "DELETE"
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized facility delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async getAccessPermissionAssignment(input: AccessPermissionMutation): Promise<AccessPermissionAssignment | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT group_value AS "groupValue", section_value AS "sectionValue", permission_value AS "permissionValue",
  permission_name AS "permissionName", return_value AS "returnValue"
FROM access_group_permissions
WHERE group_value = ${sqlString(input.groupValue)}
  AND section_value = ${sqlString(input.sectionValue)}
  AND permission_value = ${sqlString(input.permissionValue)}
LIMIT 1;
`);
    const row = rows[0];
    return row ? {
      groupValue: row.groupValue,
      sectionValue: row.sectionValue,
      permissionValue: row.permissionValue,
      permissionName: row.permissionName,
      returnValue: row.returnValue
    } : null;
  }

  async grantAccessPermission(input: AccessPermissionMutation): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/administration/access-control/group-permissions`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error(`Modernized access permission grant failed with ${response.status}: ${await response.text()}`);
    }
  }

  async revokeAccessPermission(input: Pick<AccessPermissionMutation, "groupValue" | "sectionValue" | "permissionValue">): Promise<void> {
    const response = await fetch(
      `${this.target.apiBaseUrl}/api/administration/access-control/group-permissions/${encodeURIComponent(input.groupValue)}/${encodeURIComponent(input.sectionValue)}/${encodeURIComponent(input.permissionValue)}`,
      {
        method: "DELETE"
      }
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized access permission revoke failed with ${response.status}: ${await response.text()}`);
    }
  }

  async getAccessGroupMembership(input: AccessGroupMembershipMutation): Promise<AccessGroupMembership | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT user_value AS "userValue", user_name AS "userName", group_value AS "groupValue", group_name AS "groupName"
FROM access_user_memberships
WHERE user_value = ${sqlString(input.userValue)}
  AND group_value = ${sqlString(input.groupValue)}
LIMIT 1;
`);
    const row = rows[0];
    return row ? {
      userValue: row.userValue,
      userName: row.userName,
      groupValue: row.groupValue,
      groupName: row.groupName
    } : null;
  }

  async grantAccessGroupMembership(input: AccessGroupMembershipMutation): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/administration/access-control/user-memberships`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error(`Modernized access group membership grant failed with ${response.status}: ${await response.text()}`);
    }
  }

  async revokeAccessGroupMembership(input: AccessGroupMembershipMutation): Promise<void> {
    const response = await fetch(
      `${this.target.apiBaseUrl}/api/administration/access-control/user-memberships/${encodeURIComponent(input.userValue)}/${encodeURIComponent(input.groupValue)}`,
      {
        method: "DELETE"
      }
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized access group membership revoke failed with ${response.status}: ${await response.text()}`);
    }
  }

  async getPatientContact(pid: number): Promise<PatientContact | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT legacy_pid AS pid, pubpid, phone_home AS "phoneHome", phone_cell AS "phoneCell", email,
  hipaa_allow_sms AS "hipaaAllowSms", hipaa_allow_email AS "hipaaAllowEmail"
FROM patients
WHERE legacy_pid = ${integer(pid)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      pid: Number(row.pid),
      pubpid: row.pubpid,
      phoneHome: row.phoneHome,
      phoneCell: row.phoneCell,
      email: row.email,
      hipaaAllowSms: row.hipaaAllowSms,
      hipaaAllowEmail: row.hipaaAllowEmail
    };
  }

  async updatePatientContact(contact: PatientContact): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patients/${encodeURIComponent(contact.pubpid)}/contact`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phoneHome: contact.phoneHome,
        phoneCell: contact.phoneCell,
        email: contact.email,
        hipaaAllowSms: contact.hipaaAllowSms,
        hipaaAllowEmail: contact.hipaaAllowEmail
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient contact update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async getPatientDemographics(pid: number): Promise<PatientDemographics | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT legacy_pid AS pid, pubpid,
  first_name AS "firstName",
  last_name AS "lastName",
  COALESCE(preferred_name, '') AS "preferredName",
  COALESCE(sex, '') AS sex,
  date_of_birth AS "dateOfBirth",
  COALESCE(street, '') AS street,
  COALESCE(city, '') AS city,
  COALESCE(state, '') AS state,
  COALESCE(postal_code, '') AS "postalCode",
  COALESCE(marital_status, '') AS "maritalStatus",
  COALESCE(occupation, '') AS occupation
FROM patients
WHERE legacy_pid = ${integer(pid)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      pid: Number(row.pid),
      pubpid: row.pubpid,
      firstName: row.firstName,
      lastName: row.lastName,
      preferredName: row.preferredName,
      sex: row.sex,
      dateOfBirth: row.dateOfBirth,
      street: row.street,
      city: row.city,
      state: row.state,
      postalCode: row.postalCode,
      maritalStatus: row.maritalStatus,
      occupation: row.occupation
    };
  }

  async updatePatientDemographics(demographics: PatientDemographics): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patients/${encodeURIComponent(demographics.pubpid)}/demographics`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: demographics.firstName,
        lastName: demographics.lastName,
        preferredName: demographics.preferredName,
        sex: demographics.sex,
        dateOfBirth: demographics.dateOfBirth,
        street: demographics.street,
        city: demographics.city,
        state: demographics.state,
        postalCode: demographics.postalCode,
        maritalStatus: demographics.maritalStatus,
        occupation: demographics.occupation
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient demographics update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createPatient(input: NewPatientRegistration): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patients`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error(`Modernized patient registration failed with ${response.status}: ${await response.text()}`);
    }

    const patient = (await response.json()) as { legacyPid: number };
    return patient.legacyPid;
  }

  async deleteTemporaryPatient(pid: number): Promise<void> {
    const rows = await this.db.queryRows<{ pubpid: string }>(`
SELECT pubpid
FROM patients
WHERE legacy_pid = ${integer(pid)}
  AND pubpid LIKE 'TMP-PAT-REG-%'
LIMIT 1;
`);
    const pubpid = rows[0]?.pubpid;
    if (!pubpid) {
      return;
    }

    const response = await fetch(`${this.target.apiBaseUrl}/api/patients/${encodeURIComponent(pubpid)}`, {
      method: "DELETE"
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized temporary patient delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createPatientInsurance(input: NewPatientInsurance): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patients/${encodeURIComponent(String(input.patientId))}/insurance`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: input.type,
        provider: input.provider,
        planName: input.planName,
        policyNumber: input.policyNumber,
        groupNumber: input.groupNumber,
        relationship: input.relationship
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient insurance create failed with ${response.status}: ${await response.text()}`);
    }

    const chart = (await response.json()) as { insurance: Array<{ id: string; policyNumber: string }> };
    const created = chart.insurance.find((item) => item.policyNumber === input.policyNumber);
    if (!created) {
      throw new Error(`Modernized patient insurance create response did not include policy ${input.policyNumber}.`);
    }
    return created.id;
  }

  async getPatientInsurance(id: number | string): Promise<PatientInsuranceRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", COALESCE(type, '') AS type,
  COALESCE(provider, '') AS provider,
  COALESCE(plan_name, '') AS "planName",
  COALESCE(policy_number, '') AS "policyNumber",
  COALESCE(group_number, '') AS "groupNumber",
  COALESCE(relationship, '') AS relationship
FROM insurance_records
WHERE id = ${sqlString(String(id))}
LIMIT 1;
`);
    const row = rows[0];
    return row ? {
      id: row.id,
      patientId: Number(row.patientId),
      type: row.type,
      provider: row.provider,
      planName: row.planName,
      policyNumber: row.policyNumber,
      groupNumber: row.groupNumber,
      relationship: row.relationship
    } : null;
  }

  async updatePatientInsurance(id: number | string, input: NewPatientInsurance): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patients/insurance/${encodeURIComponent(String(id))}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: input.type,
        provider: input.provider,
        planName: input.planName,
        policyNumber: input.policyNumber,
        groupNumber: input.groupNumber,
        relationship: input.relationship
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient insurance update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deletePatientInsurance(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patients/insurance/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized patient insurance delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createAppointment(input: NewAppointment): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/appointments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        providerId: input.providerId,
        title: input.title,
        date: input.eventDate,
        startTime: input.startTime.slice(0, 5),
        durationMinutes: Math.round(input.durationSeconds / 60),
        facilityId: input.facilityId,
        categoryId: 9,
        room: input.room
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized appointment create failed with ${response.status}: ${await response.text()}`);
    }

    const appointment = (await response.json()) as { id: string };
    return appointment.id;
  }

  async getAppointment(id: number | string): Promise<AppointmentRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", provider_id AS "providerId", title,
  appointment_date AS "eventDate", start_time AS "startTime",
  (start_time + make_interval(mins => duration_minutes))::time AS "endTime",
  status, facility_id AS "facilityId", facility_id AS "billingLocationId", COALESCE(room, '') AS room
FROM appointments
WHERE id = ${sqlString(String(id))}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      patientId: Number(row.patientId),
      providerId: Number(row.providerId),
      title: row.title,
      eventDate: row.eventDate,
      startTime: normalizeTime(row.startTime),
      endTime: normalizeTime(row.endTime),
      status: row.status,
      facilityId: Number(row.facilityId),
      billingLocationId: Number(row.billingLocationId),
      room: row.room
    };
  }

  async updateAppointmentStatus(id: number | string, status: string, title: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/appointments/${encodeURIComponent(String(id))}/status`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, title })
    });

    if (!response.ok) {
      throw new Error(`Modernized appointment status update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteAppointment(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/appointments/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized appointment delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createClinicalListEntry(input: NewClinicalListEntry): Promise<string> {
    if (input.type !== "allergy") {
      throw new Error(`Modernized clinical list mutation only supports allergy entries in this slice, received ${input.type}.`);
    }

    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/allergies`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        title: input.title,
        dateTime: input.dateTime,
        comments: input.comments,
        reaction: input.reaction,
        severity: input.severity,
        listOptionId: input.listOptionId
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized clinical allergy create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: string };
    return mutation.id;
  }

  async getClinicalListEntry(id: number | string): Promise<ClinicalListRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", type, title, activity, COALESCE(comments, '') AS comments,
  COALESCE(reaction, '') AS reaction, COALESCE(severity, '') AS severity,
  COALESCE(list_option_id, '') AS "listOptionId"
FROM allergies
WHERE id = ${sqlString(String(id))}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      patientId: Number(row.patientId),
      type: row.type,
      title: row.title,
      activity: Number(row.activity),
      comments: row.comments,
      reaction: row.reaction,
      severity: row.severity,
      listOptionId: row.listOptionId
    };
  }

  async deactivateClinicalListEntry(id: number | string, comments: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/allergies/${encodeURIComponent(String(id))}/deactivate`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ comments })
    });

    if (!response.ok) {
      throw new Error(`Modernized clinical allergy deactivate failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteClinicalListEntry(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/allergies/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized clinical allergy delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createProblem(input: NewProblem): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/problems`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        title: input.title,
        dateTime: input.dateTime,
        diagnosis: input.diagnosis,
        comments: input.comments
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized clinical problem create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: string };
    return mutation.id;
  }

  async getProblem(id: number | string): Promise<ProblemRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", type, title, activity, COALESCE(comments, '') AS comments,
  COALESCE(diagnosis, '') AS diagnosis, problem_date AS date
FROM problems
WHERE id = ${sqlString(String(id))}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      patientId: Number(row.patientId),
      type: row.type,
      title: row.title,
      activity: Number(row.activity),
      comments: row.comments,
      diagnosis: row.diagnosis,
      date: row.date
    };
  }

  async deactivateProblem(id: number | string, comments: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/problems/${encodeURIComponent(String(id))}/deactivate`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ comments })
    });

    if (!response.ok) {
      throw new Error(`Modernized clinical problem deactivate failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteProblem(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/problems/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized clinical problem delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createMedication(input: NewMedication): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/medications`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        title: input.title,
        dateTime: input.dateTime,
        diagnosis: input.diagnosis,
        comments: input.comments
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized clinical medication create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: string };
    return mutation.id;
  }

  async getMedication(id: number | string): Promise<MedicationRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", type, title, activity, COALESCE(comments, '') AS comments,
  COALESCE(diagnosis, '') AS diagnosis, medication_date AS date
FROM medications
WHERE id = ${sqlString(String(id))}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      patientId: Number(row.patientId),
      type: row.type,
      title: row.title,
      activity: Number(row.activity),
      comments: row.comments,
      diagnosis: row.diagnosis,
      date: row.date
    };
  }

  async deactivateMedication(id: number | string, comments: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/medications/${encodeURIComponent(String(id))}/deactivate`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ comments })
    });

    if (!response.ok) {
      throw new Error(`Modernized clinical medication deactivate failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteMedication(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/medications/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized clinical medication delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createPatientMessage(input: NewPatientMessage): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        title: input.title,
        body: input.body,
        assignedTo: input.assignedTo
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient message create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: string };
    return mutation.id;
  }

  async getPatientMessage(id: number | string): Promise<PatientMessageRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", COALESCE(title, '') AS title, COALESCE(body, '') AS body,
  COALESCE(status, '') AS status, COALESCE(assigned_to, '') AS "assignedTo",
  deleted
FROM messages
WHERE id = ${sqlString(String(id))}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      patientId: Number(row.patientId),
      title: row.title,
      body: row.body,
      status: row.status,
      assignedTo: row.assignedTo,
      deleted: Number(row.deleted)
    };
  }

  async updatePatientMessageStatus(id: number | string, status: string, body: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/messages/${encodeURIComponent(String(id))}/status`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, body })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient message update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async softDeletePatientMessage(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/messages/${encodeURIComponent(String(id))}/soft-delete`, {
      method: "PUT"
    });

    if (!response.ok) {
      throw new Error(`Modernized patient message soft delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deletePatientMessage(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/messages/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized patient message delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createPatientDocument(input: NewPatientDocument): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/documents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        categoryId: input.categoryId,
        name: input.name,
        docDate: input.docDate,
        encounter: input.encounter,
        content: input.content,
        notes: input.notes
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient document create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async createPatientBinaryDocument(input: NewPatientBinaryDocument): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/documents/binary`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        categoryId: input.categoryId,
        name: input.name,
        docDate: input.docDate,
        encounter: input.encounter,
        fileName: input.fileName,
        mimetype: input.mimetype,
        contentBase64: input.contentBase64,
        notes: input.notes
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized binary patient document create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async createPatientExternalLinkDocument(input: NewPatientExternalLinkDocument): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/documents/external-link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        categoryId: input.categoryId,
        name: input.name,
        docDate: input.docDate,
        encounter: input.encounter,
        url: input.url,
        notes: input.notes
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized external-link patient document create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async getPatientDocument(id: number | string): Promise<PatientDocumentRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", document_key AS "documentKey", category_id AS "categoryId",
  category_name AS "categoryName", name, doc_date AS "docDate", COALESCE(mimetype, '') AS mimetype,
  COALESCE(url, '') AS url,
  COALESCE(encounter::text, '0') AS encounter,
  COALESCE(file_name, name) AS "fileName", COALESCE(size_bytes::text, '0') AS "sizeBytes",
  COALESCE(storage_method, '') AS "storageMethod", deleted,
  COALESCE(review_status, 'pending') AS "reviewStatus",
  COALESCE(reviewed_by, '') AS "reviewedBy",
  COALESCE(to_char(reviewed_at, 'YYYY-MM-DD HH24:MI:SS'), '') AS "reviewedAt",
  COALESCE(notes, '') AS notes,
  CASE
    WHEN content_bytes IS NOT NULL THEN encode(content_bytes, 'hex')
    ELSE encode(convert_to(coalesce(content, ''), 'UTF8'), 'hex')
  END AS "contentHex",
  left(regexp_replace(coalesce(content, ''), E'[\\r\\n]+', ' ', 'g'), 260) AS "contentPreview"
FROM patient_documents
WHERE id = ${integer(Number(id))}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      patientId: Number(row.patientId),
      documentKey: row.documentKey,
      categoryId: Number(row.categoryId),
      categoryName: row.categoryName,
      name: row.name,
      docDate: row.docDate,
      encounter: Number(row.encounter),
      mimetype: row.mimetype,
      fileName: row.fileName,
      url: row.url,
      sizeBytes: Number(row.sizeBytes),
      storageMethod: row.storageMethod,
      deleted: Number(row.deleted),
      reviewStatus: row.reviewStatus,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      notes: row.notes,
      contentBase64: Buffer.from(row.contentHex, "hex").toString("base64"),
      contentPreview: row.contentPreview
    };
  }

  async updatePatientDocumentMetadata(id: number | string, input: PatientDocumentMetadataUpdate): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/documents/${encodeURIComponent(String(id))}/metadata`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        categoryId: input.categoryId,
        name: input.name,
        docDate: input.docDate,
        encounter: input.encounter,
        notes: input.notes
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient document metadata update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async replacePatientDocumentContent(id: number | string, input: PatientDocumentContentReplacement): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/documents/${encodeURIComponent(String(id))}/content`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fileName: input.fileName,
        content: input.content
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient document content replacement failed with ${response.status}: ${await response.text()}`);
    }
  }

  async signPatientDocument(id: number | string, reviewedBy = "admin"): Promise<void> {
    await this.reviewPatientDocument(id, "approved", reviewedBy, "sign-off");
  }

  async denyPatientDocument(id: number | string, reviewedBy = "admin"): Promise<void> {
    await this.reviewPatientDocument(id, "denied", reviewedBy, "denial");
  }

  private async reviewPatientDocument(
    id: number | string,
    reviewStatus: "approved" | "denied",
    reviewedBy: string,
    actionName: string
  ): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/documents/${encodeURIComponent(String(id))}/sign`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reviewStatus, reviewedBy })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient document ${actionName} failed with ${response.status}: ${await response.text()}`);
    }
  }

  async softDeletePatientDocument(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/documents/${encodeURIComponent(String(id))}/soft-delete`, {
      method: "PUT"
    });

    if (!response.ok) {
      throw new Error(`Modernized patient document soft delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async restorePatientDocument(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/documents/${encodeURIComponent(String(id))}/restore`, {
      method: "PUT"
    });

    if (!response.ok) {
      throw new Error(`Modernized patient document restore failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deletePatientDocument(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/documents/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized patient document delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createPrescription(input: NewPrescription): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/prescriptions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        providerId: input.providerId,
        startDate: input.startDate,
        drug: input.drug,
        rxNormCode: input.rxNormCode,
        dosage: input.dosage,
        quantity: input.quantity,
        route: "oral",
        refills: input.refills,
        note: input.note,
        diagnosis: input.diagnosis
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized prescription create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: string };
    return mutation.id;
  }

  async getPrescription(id: number | string): Promise<PrescriptionRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", provider_id AS "providerId", start_date AS "startDate",
  COALESCE(end_date::text, '') AS "endDate", drug, COALESCE(dosage, '') AS dosage,
  COALESCE(quantity, '') AS quantity, refills, active, COALESCE(note, '') AS note
FROM prescriptions
WHERE id = ${sqlString(String(id))}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      patientId: Number(row.patientId),
      providerId: Number(row.providerId),
      startDate: row.startDate,
      endDate: row.endDate || null,
      drug: row.drug,
      dosage: row.dosage,
      quantity: row.quantity,
      refills: Number(row.refills),
      active: Number(row.active),
      note: row.note
    };
  }

  async deactivatePrescription(id: number | string, endDate: string, note: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/prescriptions/${encodeURIComponent(String(id))}/deactivate`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endDate, note })
    });

    if (!response.ok) {
      throw new Error(`Modernized prescription deactivate failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deletePrescription(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/prescriptions/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized prescription delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createImmunization(input: NewImmunization): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/immunizations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        encounter: input.encounter ?? null,
        immunizationId: input.immunizationId,
        cvxCode: input.cvxCode,
        vaccine: input.vaccine,
        administeredAt: input.administeredAt,
        manufacturer: input.manufacturer,
        lotNumber: input.lotNumber,
        administeredById: input.providerId,
        administeredBy: input.administeredBy,
        educationDate: input.educationDate,
        visDate: input.visDate,
        amountAdministered: input.amountAdministered,
        amountAdministeredUnit: input.amountAdministeredUnit,
        expirationDate: input.expirationDate,
        route: input.route,
        administrationSite: input.administrationSite,
        completionStatus: input.completionStatus,
        informationSource: input.informationSource,
        note: input.note
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized immunization create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: string };
    return Number(mutation.id);
  }

  async getImmunization(id: number | string): Promise<ImmunizationRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id,
  pid AS "patientId",
  COALESCE(immunization_id, 0) AS "immunizationId",
  COALESCE(cvx_code, '') AS "cvxCode",
  vaccine,
  administered_at::date AS "administeredDate",
  COALESCE(manufacturer, '') AS manufacturer,
  COALESCE(lot_number, '') AS "lotNumber",
  COALESCE(administered_by, '') AS "administeredBy",
  COALESCE(route, '') AS route,
  COALESCE(administration_site, '') AS "administrationSite",
  COALESCE(completion_status, '') AS "completionStatus",
  COALESCE(information_source, '') AS "informationSource",
  COALESCE(note, '') AS note,
  added_erroneously AS "addedErroneously",
  COALESCE(encounter::text, '') AS encounter
FROM immunizations
WHERE id = ${integer(Number(id))}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      patientId: Number(row.patientId),
      immunizationId: Number(row.immunizationId),
      cvxCode: row.cvxCode,
      vaccine: row.vaccine,
      administeredDate: row.administeredDate,
      manufacturer: row.manufacturer,
      lotNumber: row.lotNumber,
      administeredBy: row.administeredBy,
      route: row.route,
      administrationSite: row.administrationSite,
      completionStatus: row.completionStatus,
      informationSource: row.informationSource,
      note: row.note,
      addedErroneously: Number(row.addedErroneously),
      encounter: row.encounter ? Number(row.encounter) : null
    };
  }

  async markImmunizationEnteredInError(id: number | string, note: string): Promise<void> {
    const response = await fetch(
      `${this.target.apiBaseUrl}/api/clinical-lists/immunizations/${encodeURIComponent(String(id))}/entered-in-error`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note })
      }
    );

    if (!response.ok) {
      throw new Error(`Modernized immunization entered-in-error update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteImmunization(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/immunizations/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized immunization delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createBillingLine(input: NewBillingLine): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/billing/lines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        providerId: input.providerId,
        encounter: input.encounter,
        billingDate: input.dateTime.slice(0, 10),
        codeType: input.codeType,
        code: input.code,
        modifier: input.modifier ?? "",
        codeText: input.codeText,
        fee: Number(input.fee),
        units: input.units,
        justify: input.justify
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized billing line create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: string };
    return mutation.id;
  }

  async getBillingLine(id: number | string): Promise<BillingLineRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", encounter, code_type AS "codeType", code, code_text AS "codeText",
  COALESCE(modifier, '') AS modifier, COALESCE(fee::text, '') AS fee, COALESCE(justify, '') AS justify, units, activity, billed
FROM billing
WHERE id = ${sqlString(String(id))}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      patientId: Number(row.patientId),
      encounter: Number(row.encounter),
      codeType: row.codeType,
      code: row.code,
      modifier: row.modifier,
      codeText: row.codeText,
      fee: Number(row.fee).toFixed(2),
      justify: row.justify,
      units: Number(row.units),
      activity: Number(row.activity),
      billed: Number(row.billed)
    };
  }

  async updateBillingLine(id: number | string, input: BillingLineCorrection): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/billing/lines/${encodeURIComponent(String(id))}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        codeText: input.codeText,
        modifier: input.modifier ?? "",
        fee: Number(input.fee),
        units: input.units,
        justify: input.justify
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized billing line update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async updateBillingLineStatus(id: number | string, billed: number, activity: number): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/billing/lines/${encodeURIComponent(String(id))}/status`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ billed, activity })
    });

    if (!response.ok) {
      throw new Error(`Modernized billing line status update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteBillingLine(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/billing/lines/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized billing line delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createClaimStatus(input: NewClaimStatus): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/billing/claims`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        encounter: input.encounter,
        payerId: input.payerId,
        payerName: input.payerName,
        payerType: input.payerType,
        status: input.status,
        billProcess: input.billProcess,
        billTime: input.billTime,
        processTime: input.processTime ?? null,
        processFile: input.processFile,
        target: input.target,
        x12PartnerId: input.x12PartnerId,
        submittedClaim: input.submittedClaim
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized claim status create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: string };
    return mutation.id;
  }

  async getClaimStatus(id: number | string): Promise<ClaimStatusRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", encounter, version, payer_id AS "payerId",
  COALESCE(payer_name, '') AS "payerName", payer_type AS "payerType", status,
  bill_process AS "billProcess", COALESCE(to_char(bill_time, 'YYYY-MM-DD HH24:MI:SS'), '') AS "billTime",
  COALESCE(to_char(process_time, 'YYYY-MM-DD HH24:MI:SS'), '') AS "processTime",
  COALESCE(process_file, '') AS "processFile", COALESCE(target, '') AS target,
  x12_partner_id AS "x12PartnerId", COALESCE(submitted_claim, '') AS "submittedClaim"
FROM claims
WHERE id = ${sqlString(String(id))}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      patientId: Number(row.patientId),
      encounter: Number(row.encounter),
      version: Number(row.version),
      payerId: Number(row.payerId),
      payerName: row.payerName,
      payerType: Number(row.payerType),
      status: Number(row.status),
      statusLabel: workflowClaimStatusLabel(Number(row.status), Number(row.billProcess)),
      billProcess: Number(row.billProcess),
      billTime: row.billTime,
      processTime: row.processTime,
      processFile: row.processFile,
      target: row.target,
      x12PartnerId: Number(row.x12PartnerId),
      submittedClaim: row.submittedClaim
    };
  }

  async updateClaimStatus(id: number | string, input: ClaimStatusUpdate): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/billing/claims/${encodeURIComponent(String(id))}/status`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: input.status,
        billProcess: input.billProcess,
        processTime: input.processTime ?? null,
        processFile: input.processFile,
        target: input.target,
        x12PartnerId: input.x12PartnerId,
        submittedClaim: input.submittedClaim
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized claim status update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteClaimStatus(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/billing/claims/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized claim status delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createPaymentPosting(input: NewPaymentPosting): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/billing/payments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        encounter: input.encounter,
        payerId: input.payerId,
        payerName: input.payerName,
        payerType: input.payerType,
        reference: input.reference,
        postDate: input.postDate,
        checkDate: input.postDate,
        depositDate: input.postDate,
        paymentType: input.paymentType,
        paymentMethod: input.paymentMethod,
        codeType: input.codeType,
        code: input.code,
        modifier: input.modifier ?? "",
        memo: input.memo,
        payAmount: Number(input.payAmount),
        adjustmentAmount: Number(input.adjustmentAmount),
        accountCode: input.accountCode,
        reasonCode: input.reasonCode,
        payerClaimNumber: input.payerClaimNumber
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized payment posting create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: string };
    return mutation.id;
  }

  async getPaymentPosting(id: number | string): Promise<PaymentPostingRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT pa.id, pa.pid AS "patientId", pa.encounter, pa.sequence_no AS "sequenceNo",
  pa.session_id AS "sessionId", ps.payer_id AS "payerId", COALESCE(ps.payer_name, '') AS "payerName",
  pa.payer_type AS "payerType", COALESCE(ps.reference, '') AS reference,
  COALESCE(ps.payment_type, '') AS "paymentType", COALESCE(ps.payment_method, '') AS "paymentMethod",
  COALESCE(ps.check_date::text, '') AS "checkDate",
  COALESCE(ps.deposit_date::text, '') AS "depositDate",
  COALESCE(pa.post_date::text, '') AS "postDate",
  COALESCE(to_char(pa.post_time, 'YYYY-MM-DD HH24:MI:SS'), '') AS "postTime",
  COALESCE(pa.code_type, '') AS "codeType", COALESCE(pa.code, '') AS code,
  COALESCE(pa.modifier, '') AS modifier, COALESCE(pa.memo, '') AS memo,
  COALESCE(pa.pay_amount::text, '0') AS "payAmount",
  COALESCE(pa.adj_amount::text, '0') AS "adjustmentAmount",
  COALESCE(pa.account_code, '') AS "accountCode", COALESCE(pa.reason_code, '') AS "reasonCode",
  COALESCE(pa.payer_claim_number, '') AS "payerClaimNumber",
  COALESCE(to_char(pa.deleted, 'YYYY-MM-DD HH24:MI:SS'), '') AS deleted
FROM payment_activities pa
INNER JOIN payment_sessions ps ON ps.id = pa.session_id
WHERE pa.id = ${sqlString(String(id))}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      patientId: Number(row.patientId),
      encounter: Number(row.encounter),
      sequenceNo: Number(row.sequenceNo),
      sessionId: Number(row.sessionId),
      payerId: Number(row.payerId),
      payerName: row.payerName,
      payerType: Number(row.payerType),
      reference: row.reference,
      paymentType: row.paymentType,
      paymentMethod: row.paymentMethod,
      checkDate: row.checkDate,
      depositDate: row.depositDate,
      postDate: row.postDate,
      postTime: row.postTime,
      codeType: row.codeType,
      code: row.code,
      modifier: row.modifier,
      memo: row.memo,
      payAmount: Number(row.payAmount).toFixed(2),
      adjustmentAmount: Number(row.adjustmentAmount).toFixed(2),
      accountCode: row.accountCode,
      reasonCode: row.reasonCode,
      payerClaimNumber: row.payerClaimNumber,
      deleted: row.deleted
    };
  }

  async voidPaymentPosting(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/billing/payments/${encodeURIComponent(String(id))}/void`, {
      method: "PUT"
    });

    if (!response.ok) {
      throw new Error(`Modernized payment posting void failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deletePaymentPosting(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/billing/payments/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized payment posting delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createProcedureOrder(input: NewProcedureOrder): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        providerId: input.providerId,
        encounterId: input.encounterId,
        dateOrdered: input.dateOrdered,
        priority: input.priority,
        status: input.status,
        procedureCode: input.procedureCode,
        procedureName: input.procedureName,
        procedureType: input.procedureType,
        diagnosis: input.diagnosis,
        instructions: input.instructions
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure order create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async getProcedureOrder(id: number): Promise<ProcedureOrderRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", encounter AS "encounterId",
  COALESCE(order_status, '') AS "orderStatus", COALESCE(order_priority, '') AS "orderPriority",
  COALESCE(code, '') AS "procedureCode", COALESCE(name, '') AS "procedureName",
  COALESCE(procedure_type, '') AS "procedureType"
FROM lab_orders
WHERE id = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      patientId: Number(row.patientId),
      encounterId: Number(row.encounterId),
      orderStatus: row.orderStatus,
      orderPriority: row.orderPriority,
      procedureCode: row.procedureCode,
      procedureName: row.procedureName,
      procedureType: row.procedureType
    };
  }

  async updateProcedureOrderStatus(id: number, status: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/orders/${encodeURIComponent(String(id))}/status`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure order status update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createProcedureReport(input: NewProcedureReport): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: input.orderId,
        dateCollected: input.dateCollected,
        dateReport: input.dateReport,
        specimenNumber: input.specimenNumber,
        reportStatus: input.reportStatus,
        reviewStatus: input.reviewStatus,
        notes: input.notes
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure report create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async getProcedureReport(id: number): Promise<ProcedureReportRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, order_id AS "orderId", COALESCE(status, '') AS "reportStatus",
  COALESCE(review_status, '') AS "reviewStatus", COALESCE(notes, '') AS "reportNotes"
FROM lab_reports
WHERE id = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      orderId: Number(row.orderId),
      reportStatus: row.reportStatus,
      reviewStatus: row.reviewStatus,
      reportNotes: row.reportNotes
    };
  }

  async createProcedureResult(input: NewProcedureResult): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/results`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reportId: input.reportId,
        resultCode: input.resultCode,
        resultText: input.resultText,
        dateTime: input.dateTime,
        facility: input.facility,
        units: input.units,
        result: input.result,
        range: input.range,
        abnormal: input.abnormal,
        comments: input.comments,
        status: input.status
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure result create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async getProcedureResult(id: number): Promise<ProcedureResultRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, report_id AS "reportId", COALESCE(code, '') AS "resultCode",
  COALESCE(text, '') AS "resultText", COALESCE(result, '') AS result,
  COALESCE(abnormal, '') AS abnormal, COALESCE(result_status, '') AS status
FROM lab_results
WHERE id = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      reportId: Number(row.reportId),
      resultCode: row.resultCode,
      resultText: row.resultText,
      result: row.result,
      abnormal: row.abnormal,
      status: row.status
    };
  }

  async deleteProcedureOrderCascade(id: number): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/orders/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized procedure order delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createEncounter(input: NewEncounter): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        providerId: input.providerId,
        dateTime: input.dateTime,
        reason: input.reason,
        facilityId: input.facilityId,
        billingFacilityId: input.billingFacilityId,
        sensitivity: input.sensitivity ?? null,
        referralSource: input.referralSource ?? null,
        externalId: input.externalId ?? null,
        posCode: input.posCode ?? null,
        billingNote: input.billingNote
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized encounter create failed with ${response.status}: ${await response.text()}`);
    }

    const encounter = (await response.json()) as { id: number; encounter: number };
    return encounter.encounter;
  }

  async getEncounter(id: number): Promise<EncounterRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, encounter, pid AS "patientId", provider_id AS "providerId", encounter_date AS date,
  reason, facility_id AS "facilityId", COALESCE(billing_facility_id, facility_id) AS "billingFacilityId",
  COALESCE(sensitivity, '') AS sensitivity, COALESCE(referral_source, '') AS "referralSource",
  COALESCE(external_id, '') AS "externalId", pos_code AS "posCode",
  COALESCE(billing_note, '') AS "billingNote"
FROM encounters
WHERE encounter = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      encounter: Number(row.encounter),
      patientId: Number(row.patientId),
      providerId: Number(row.providerId),
      date: row.date,
      reason: row.reason,
      facilityId: Number(row.facilityId),
      billingFacilityId: Number(row.billingFacilityId),
      sensitivity: row.sensitivity,
      referralSource: row.referralSource,
      externalId: row.externalId,
      posCode: row.posCode && row.posCode !== "\\N" ? Number(row.posCode) : null,
      billingNote: row.billingNote
    };
  }

  async updateEncounterReason(
    id: number,
    reason: string,
    billingNote: string,
    metadata?: EncounterMetadataInput
  ): Promise<void> {
    const current = metadata ? null : await this.getEncounter(id);
    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(id))}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason,
        sensitivity: metadata?.sensitivity ?? current?.sensitivity ?? null,
        referralSource: metadata?.referralSource ?? current?.referralSource ?? null,
        externalId: metadata?.externalId ?? current?.externalId ?? null,
        posCode: metadata?.posCode ?? current?.posCode ?? null,
        billingNote
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized encounter update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteEncounter(id: number): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized encounter delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createVitals(input: NewVitals): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(input.encounter))}/vitals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dateTime: input.dateTime,
        systolic: Number(input.bps),
        diastolic: Number(input.bpd),
        weight: input.weight,
        height: input.height,
        pulse: input.pulse,
        oxygenSaturation: input.oxygenSaturation,
        note: input.note
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized encounter vitals create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async getVitals(id: number): Promise<VitalsRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", COALESCE(bps::text, '') AS bps, COALESCE(bpd::text, '') AS bpd,
  COALESCE(weight::text, '0') AS weight, COALESCE(height::text, '0') AS height,
  COALESCE(pulse::text, '0') AS pulse, COALESCE(oxygen_saturation::text, '0') AS "oxygenSaturation",
  COALESCE(note, '') AS note
FROM vitals
WHERE id = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      patientId: Number(row.patientId),
      bps: row.bps,
      bpd: row.bpd,
      weight: Number(row.weight),
      height: Number(row.height),
      pulse: Number(row.pulse),
      oxygenSaturation: Number(row.oxygenSaturation),
      note: row.note
    };
  }

  async deleteVitals(id: number): Promise<void> {
    const vitals = await this.db.queryRows<Record<string, string>>(`
SELECT encounter
FROM vitals
WHERE id = ${integer(id)}
LIMIT 1;
`);
    const encounter = vitals[0]?.encounter;
    if (!encounter) {
      return;
    }

    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(encounter)}/vitals/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized encounter vitals delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createSoapNote(input: NewSoapNote): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(input.encounter))}/soap-notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dateTime: input.dateTime,
        subjective: input.subjective,
        objective: input.objective,
        assessment: input.assessment,
        plan: input.plan
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized encounter SOAP note create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async getSoapNote(id: number): Promise<SoapNoteRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", COALESCE(subjective, '') AS subjective, COALESCE(objective, '') AS objective,
  COALESCE(assessment, '') AS assessment, COALESCE(plan, '') AS plan
FROM clinical_notes
WHERE id = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      patientId: Number(row.patientId),
      subjective: row.subjective,
      objective: row.objective,
      assessment: row.assessment,
      plan: row.plan
    };
  }

  async deleteSoapNote(id: number): Promise<void> {
    const notes = await this.db.queryRows<Record<string, string>>(`
SELECT encounter
FROM clinical_notes
WHERE id = ${integer(id)}
LIMIT 1;
`);
    const encounter = notes[0]?.encounter;
    if (!encounter) {
      return;
    }

    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(encounter)}/soap-notes/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized encounter SOAP note delete failed with ${response.status}: ${await response.text()}`);
    }
  }
}

function integer(value: number) {
  if (!Number.isInteger(value)) {
    throw new Error(`Expected integer SQL value, received ${value}.`);
  }
  return value;
}

function sqlString(value: string) {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
}

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

function workflowClaimStatusLabel(status: number, billProcess: number) {
  if (billProcess !== 0) {
    return "Queued for billing";
  }

  return status === 1
    ? "Re-opened"
    : status === 2 || status === 3
      ? "Marked as cleared"
      : status === 4
        ? "Closed"
        : status === 5
          ? "Canceled"
          : status === 6
            ? "Forwarded"
            : status === 7
              ? "Denied"
              : "Unsubmitted";
}
