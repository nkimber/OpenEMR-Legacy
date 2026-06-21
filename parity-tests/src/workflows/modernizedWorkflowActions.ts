import type { ModernizedPostgresProbe } from "../db/modernizedPostgresProbe.js";
import { buildPatientDocumentScanFields } from "../db/legacyMariaDbProbe.js";
import type { RuntimeTarget } from "../config/targets.js";
import type {
  AccessGroupMembership,
  AccessGroupMembershipMutation,
  AccessPermissionAssignment,
  AccessPermissionMutation,
  AppointmentRecord,
  AppointmentSeriesOccurrence,
  AppointmentUpdate,
  BillingLineCorrection,
  BillingLineRecord,
  ClaimStatusRecord,
  ClaimStatusUpdate,
  ClinicalListRecord,
  EncounterMetadataInput,
  EncounterRecord,
  EncounterSignatureRecord,
  FacilityRecord,
  ImmunizationRecord,
  NewBillingLine,
  NewClaimStatus,
  NewClinicalListEntry,
  NewCollectionsFollowUpTask,
  NewEncounterBinaryDocument,
  NewEncounterDocument,
  NewEncounterExternalLinkDocument,
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
  NewProcedureLabProvider,
  NewProcedureLabProviderAddressBookOrganization,
  NewProcedureOrderCatalogItem,
  NewUser,
  NewPatientMessage,
  NewAppointment,
  NewEncounter,
  NewEncounterSignature,
  NewProcedureOrder,
  NewProcedureReport,
  NewProcedureResult,
  NewProcedureSpecimen,
  NewPrescription,
  NewSoapNote,
  NewVitals,
  PatientContact,
  PatientDemographics,
  PatientDocumentBinaryContentReplacement,
  PatientDocumentContentReplacement,
  PatientDocumentMetadataUpdate,
  PatientDocumentRecord,
  PatientInsuranceRecord,
  PatientMessageRecord,
  PaymentPostingRecord,
  MedicationRecord,
  ProcedureOrderCatalogItemRecord,
  ProcedureVendorCompendiumImportInput,
  ProcedureVendorCompendiumImportResult,
  ProblemRecord,
  ProcedureOrderRecord,
  ProcedureOrderUpdate,
  ProcedureLabProviderRecord,
  ProcedureReportRecord,
  ProcedureReportSignOff,
  ProcedureReportUpdate,
  ProcedureResultRecord,
  ProcedureSpecimenRecord,
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
        billingLocationId: input.billingLocationId,
        categoryId: input.categoryId ?? null,
        room: input.room,
        comments: input.homeText,
        recurrenceType: input.recurrenceType ?? 0,
        repeatFrequency: input.repeatFrequency ?? null,
        repeatUnit: input.repeatUnit ?? null,
        repeatOnNum: input.repeatOnNum ?? null,
        repeatOnDay: input.repeatOnDay ?? null,
        repeatOnFrequency: input.repeatOnFrequency ?? null,
        recurrenceDays: input.recurrenceDays ?? null,
        recurrenceEndDate: input.recurrenceEndDate ?? null
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
  status, facility_id AS "facilityId", billing_location_id AS "billingLocationId", COALESCE(room, '') AS room,
  COALESCE(category_id, 0) AS "categoryId", COALESCE(comments, '') AS "homeText",
  COALESCE(recurrence_type, 0) AS "recurrenceType",
  repeat_frequency AS "repeatFrequency",
  repeat_unit AS "repeatUnit",
  repeat_on_num AS "repeatOnNum",
  repeat_on_day AS "repeatOnDay",
  repeat_on_frequency AS "repeatOnFrequency",
  COALESCE(recurrence_days, '') AS "recurrenceDays",
  recurrence_end_date AS "recurrenceEndDate",
  COALESCE(recurrence_exdates, '') AS "recurrenceExdates"
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
      room: row.room,
      categoryId: Number(row.categoryId),
      categoryName: appointmentCategoryName(Number(row.categoryId)),
      homeText: row.homeText,
      recurrenceType: Number(row.recurrenceType),
      repeatFrequency: nullableNumber(row.repeatFrequency),
      repeatUnit: nullableNumber(row.repeatUnit),
      repeatOnNum: nullableNumber(row.repeatOnNum),
      repeatOnDay: nullableNumber(row.repeatOnDay),
      repeatOnFrequency: nullableNumber(row.repeatOnFrequency),
      recurrenceDays: splitNumberList(row.recurrenceDays),
      recurrenceEndDate: row.recurrenceEndDate,
      recurrenceExdates: splitDateList(row.recurrenceExdates)
    };
  }

  async getAppointmentsForPatient(patientId: number | string, fromDate: string): Promise<AppointmentRecord[]> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", provider_id AS "providerId", title,
  appointment_date AS "eventDate", start_time AS "startTime",
  (start_time + make_interval(mins => duration_minutes))::time AS "endTime",
  status, facility_id AS "facilityId", billing_location_id AS "billingLocationId", COALESCE(room, '') AS room,
  COALESCE(category_id, 0) AS "categoryId", COALESCE(comments, '') AS "homeText",
  COALESCE(recurrence_type, 0) AS "recurrenceType",
  repeat_frequency AS "repeatFrequency",
  repeat_unit AS "repeatUnit",
  repeat_on_num AS "repeatOnNum",
  repeat_on_day AS "repeatOnDay",
  repeat_on_frequency AS "repeatOnFrequency",
  COALESCE(recurrence_days, '') AS "recurrenceDays",
  recurrence_end_date AS "recurrenceEndDate",
  COALESCE(recurrence_exdates, '') AS "recurrenceExdates"
FROM appointments
WHERE pid = ${integer(Number(patientId))}
  AND appointment_date >= ${sqlString(fromDate)}
ORDER BY appointment_date, start_time, id;
`);
    return rows.map((row) => ({
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
      room: row.room,
      categoryId: Number(row.categoryId),
      categoryName: appointmentCategoryName(Number(row.categoryId)),
      homeText: row.homeText,
      recurrenceType: Number(row.recurrenceType),
      repeatFrequency: nullableNumber(row.repeatFrequency),
      repeatUnit: nullableNumber(row.repeatUnit),
      repeatOnNum: nullableNumber(row.repeatOnNum),
      repeatOnDay: nullableNumber(row.repeatOnDay),
      repeatOnFrequency: nullableNumber(row.repeatOnFrequency),
      recurrenceDays: splitNumberList(row.recurrenceDays),
      recurrenceEndDate: row.recurrenceEndDate,
      recurrenceExdates: splitDateList(row.recurrenceExdates)
    }));
  }

  async getAppointmentSeriesOccurrences(patientId: number | string, fromDate: string): Promise<AppointmentSeriesOccurrence[]> {
    const params = new URLSearchParams({
      patientId: String(patientId),
      from: fromDate,
      limit: "100"
    });
    const response = await fetch(`${this.target.apiBaseUrl}/api/appointments?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Modernized appointment series search failed with ${response.status}: ${await response.text()}`);
    }

    const payload = (await response.json()) as {
      appointments: Array<{
        id: string;
        seriesRootId: string;
        patientId: string;
        legacyPid: number;
        title: string;
        date: string;
        startTime: string;
        status: string | null;
        room: string | null;
        categoryId: number | null;
        categoryName: string | null;
        providerId: number | null;
        facilityId: number | null;
        billingLocationId: number | null;
        comments: string | null;
        recurrenceType: number;
        repeatFrequency: number | null;
        repeatUnit: number | null;
        repeatOnNum: number | null;
        repeatOnDay: number | null;
        repeatOnFrequency: number | null;
        recurrenceDays: number[];
        recurrenceEndDate: string | null;
        recurrenceExdates: string[];
        recurrenceExceptionCount: number;
        occurrenceNumber: number | null;
        isVirtualOccurrence: boolean;
        isRecurringSeries: boolean;
      }>;
    };

    return payload.appointments
      .filter((appointment) => appointment.isRecurringSeries)
      .map((appointment) => ({
        id: appointment.id,
        seriesRootId: appointment.seriesRootId,
        patientId: appointment.legacyPid,
        providerId: appointment.providerId,
        title: appointment.title,
        date: appointment.date,
        startTime: normalizeTime(appointment.startTime),
        status: appointment.status,
        facilityId: appointment.facilityId,
        billingLocationId: appointment.billingLocationId,
        room: appointment.room,
        categoryId: appointment.categoryId,
        categoryName: appointment.categoryName,
        comments: appointment.comments,
        recurrenceType: appointment.recurrenceType,
        repeatFrequency: appointment.repeatFrequency,
        repeatUnit: appointment.repeatUnit,
        repeatOnNum: appointment.repeatOnNum,
        repeatOnDay: appointment.repeatOnDay,
        repeatOnFrequency: appointment.repeatOnFrequency,
        recurrenceDays: appointment.recurrenceDays ?? [],
        recurrenceEndDate: appointment.recurrenceEndDate,
        recurrenceExdates: appointment.recurrenceExdates ?? [],
        recurrenceExceptionCount: appointment.recurrenceExceptionCount ?? 0,
        occurrenceNumber: appointment.occurrenceNumber ?? 1,
        isVirtualOccurrence: appointment.isVirtualOccurrence
      }));
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

  async updateAppointment(id: number | string, input: AppointmentUpdate): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/appointments/${encodeURIComponent(String(id))}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId: input.providerId,
        title: input.title,
        date: input.eventDate,
        startTime: input.startTime.slice(0, 5),
        durationMinutes: Math.round(input.durationSeconds / 60),
        facilityId: input.facilityId,
        billingLocationId: input.billingLocationId,
        categoryId: input.categoryId ?? null,
        room: input.room,
        status: input.status,
        comments: input.homeText ?? null,
        recurrenceType: input.recurrenceType ?? 0,
        repeatFrequency: input.repeatFrequency ?? null,
        repeatUnit: input.repeatUnit ?? null,
        repeatOnNum: input.repeatOnNum ?? null,
        repeatOnDay: input.repeatOnDay ?? null,
        repeatOnFrequency: input.repeatOnFrequency ?? null,
        recurrenceDays: input.recurrenceDays ?? null,
        recurrenceEndDate: input.recurrenceEndDate ?? null,
        recurrenceExdates: input.recurrenceExdates ?? null
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized appointment update failed with ${response.status}: ${await response.text()}`);
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

  async addAppointmentRecurrenceException(id: number | string, occurrenceDate: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/appointments/${encodeURIComponent(`${String(id)}::occurs::${occurrenceDate}`)}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized appointment occurrence delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async restoreAppointmentRecurrenceException(id: number | string, occurrenceDate: string): Promise<void> {
    const response = await fetch(
      `${this.target.apiBaseUrl}/api/appointments/${encodeURIComponent(String(id))}/recurrence-exceptions/${encodeURIComponent(occurrenceDate)}/restore`,
      {
        method: "POST"
      });

    if (!response.ok) {
      throw new Error(`Modernized appointment occurrence restore failed with ${response.status}: ${await response.text()}`);
    }
  }

  async setAppointmentRecurrenceExdates(id: number | string, recurrenceExdates: string[]): Promise<void> {
    await this.db.queryRows<{ id: string }>(`
UPDATE appointments
SET recurrence_exdates = ${recurrenceExdates.length === 0 ? "NULL" : sqlString(Array.from(new Set(recurrenceExdates)).sort().join(","))}
WHERE id = ${sqlString(String(id))}
RETURNING id;
`);
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

  async createCollectionsFollowUpTask(input: NewCollectionsFollowUpTask): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/billing/collections/follow-ups`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        assignedTo: input.assignedTo,
        action: input.action,
        note: input.note
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized collections follow-up create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: string };
    return mutation.id;
  }

  async getPatientMessage(id: number | string): Promise<PatientMessageRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", COALESCE(title, '') AS title,
  encode(convert_to(COALESCE(body, ''), 'UTF8'), 'hex') AS "bodyHex",
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
      body: Buffer.from(row.bodyHex, "hex").toString("utf8"),
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

  async updatePatientMessageContent(id: number | string, title: string, body: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/messages/${encodeURIComponent(String(id))}/content`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, body })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient message content update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async updatePatientMessageAssignment(id: number | string, assignedTo: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/messages/${encodeURIComponent(String(id))}/assignment`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assignedTo })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient message assignment update failed with ${response.status}: ${await response.text()}`);
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

  async createEncounterDocument(input: NewEncounterDocument): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(input.encounter))}/documents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        categoryId: input.categoryId,
        name: input.name,
        docDate: input.docDate,
        content: input.content,
        notes: input.notes
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized encounter document attach failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async createEncounterBinaryDocument(input: NewEncounterBinaryDocument): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(input.encounter))}/documents/binary`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        categoryId: input.categoryId,
        name: input.name,
        docDate: input.docDate,
        fileName: input.fileName,
        mimetype: input.mimetype,
        contentBase64: input.contentBase64,
        notes: input.notes
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized binary encounter document attach failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async createEncounterExternalLinkDocument(input: NewEncounterExternalLinkDocument): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(input.encounter))}/documents/external-link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        categoryId: input.categoryId,
        name: input.name,
        docDate: input.docDate,
        url: input.url,
        notes: input.notes
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized external-link encounter document attach failed with ${response.status}: ${await response.text()}`);
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

    const contentBase64 = Buffer.from(row.contentHex, "hex").toString("base64");

    const document = {
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
      contentBase64,
      contentPreview: row.contentPreview,
      thumbnailDataUri: buildDocumentThumbnailDataUri(row.mimetype, contentBase64)
    };

    return {
      ...document,
      ...buildPatientDocumentScanFields(document)
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

  async updateEncounterDocumentMetadata(
    encounter: number,
    id: number | string,
    input: PatientDocumentMetadataUpdate
  ): Promise<void> {
    const response = await fetch(
      `${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(encounter))}/documents/${encodeURIComponent(String(id))}/metadata`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          categoryId: input.categoryId,
          name: input.name,
          docDate: input.docDate,
          encounter: input.encounter,
          notes: input.notes
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Modernized encounter document metadata update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async moveEncounterDocument(sourceEncounter: number, id: number | string, targetEncounter: number): Promise<void> {
    const response = await fetch(
      `${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(sourceEncounter))}/documents/${encodeURIComponent(String(id))}/move`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetEncounter })
      }
    );

    if (!response.ok) {
      throw new Error(`Modernized encounter document move failed with ${response.status}: ${await response.text()}`);
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

  async replaceEncounterDocumentContent(
    encounter: number,
    id: number | string,
    input: PatientDocumentContentReplacement
  ): Promise<void> {
    const response = await fetch(
      `${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(encounter))}/documents/${encodeURIComponent(String(id))}/content`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: input.fileName,
          content: input.content
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Modernized encounter document content replacement failed with ${response.status}: ${await response.text()}`);
    }
  }

  async replacePatientDocumentBinaryContent(id: number | string, input: PatientDocumentBinaryContentReplacement): Promise<void> {
    const response = await fetch(
      `${this.target.apiBaseUrl}/api/documents/${encodeURIComponent(String(id))}/content/binary`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: input.fileName,
          mimetype: input.mimetype,
          contentBase64: input.contentBase64
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Modernized patient binary document content replacement failed with ${response.status}: ${await response.text()}`);
    }
  }

  async replaceEncounterDocumentBinaryContent(
    encounter: number,
    id: number | string,
    input: PatientDocumentBinaryContentReplacement
  ): Promise<void> {
    const response = await fetch(
      `${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(encounter))}/documents/${encodeURIComponent(String(id))}/content/binary`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: input.fileName,
          mimetype: input.mimetype,
          contentBase64: input.contentBase64
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Modernized encounter binary document content replacement failed with ${response.status}: ${await response.text()}`);
    }
  }

  async softDeleteEncounterDocument(encounter: number, id: number | string): Promise<void> {
    const response = await fetch(
      `${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(encounter))}/documents/${encodeURIComponent(String(id))}/soft-delete`,
      {
        method: "PUT"
      }
    );

    if (!response.ok) {
      throw new Error(`Modernized encounter document archive failed with ${response.status}: ${await response.text()}`);
    }
  }

  async restoreEncounterDocument(encounter: number, id: number | string): Promise<void> {
    const response = await fetch(
      `${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(encounter))}/documents/${encodeURIComponent(String(id))}/restore`,
      {
        method: "PUT"
      }
    );

    if (!response.ok) {
      throw new Error(`Modernized encounter document restore failed with ${response.status}: ${await response.text()}`);
    }
  }

  async signPatientDocument(id: number | string, reviewedBy = "admin"): Promise<void> {
    await this.reviewPatientDocument(id, "approved", reviewedBy, "sign-off");
  }

  async signEncounterDocument(encounter: number, id: number | string, reviewedBy = "admin"): Promise<void> {
    const response = await fetch(
      `${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(encounter))}/documents/${encodeURIComponent(String(id))}/sign`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewStatus: "approved", reviewedBy })
      }
    );

    if (!response.ok) {
      throw new Error(`Modernized encounter document sign-off failed with ${response.status}: ${await response.text()}`);
    }
  }

  async denyEncounterDocument(encounter: number, id: number | string, reviewedBy = "admin"): Promise<void> {
    const response = await fetch(
      `${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(encounter))}/documents/${encodeURIComponent(String(id))}/sign`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewStatus: "denied", reviewedBy })
      }
    );

    if (!response.ok) {
      throw new Error(`Modernized encounter document denial failed with ${response.status}: ${await response.text()}`);
    }
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
        labId: input.labId,
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

  async createProcedureLabProvider(input: NewProcedureLabProvider): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/lab-providers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        labDirectorId: input.labDirectorId ?? null,
        npi: input.npi ?? "",
        protocol: input.protocol ?? "DL",
        usage: input.usage ?? "D",
        direction: input.direction ?? "B",
        sendApplicationId: input.sendApplicationId ?? "",
        sendFacilityId: input.sendFacilityId ?? "",
        receiveApplicationId: input.receiveApplicationId ?? "",
        receiveFacilityId: input.receiveFacilityId ?? "",
        remoteHost: input.remoteHost ?? "",
        login: input.login ?? "",
        password: input.password ?? "",
        ordersPath: input.ordersPath ?? "",
        resultsPath: input.resultsPath ?? "",
        notes: input.notes ?? "",
        active: input.active ?? true
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure lab provider create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async updateProcedureLabProvider(id: number, input: NewProcedureLabProvider): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/lab-providers/${encodeURIComponent(String(id))}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        labDirectorId: input.labDirectorId ?? null,
        npi: input.npi ?? "",
        protocol: input.protocol ?? "DL",
        usage: input.usage ?? "D",
        direction: input.direction ?? "B",
        sendApplicationId: input.sendApplicationId ?? "",
        sendFacilityId: input.sendFacilityId ?? "",
        receiveApplicationId: input.receiveApplicationId ?? "",
        receiveFacilityId: input.receiveFacilityId ?? "",
        remoteHost: input.remoteHost ?? "",
        login: input.login ?? "",
        password: input.password ?? "",
        ordersPath: input.ordersPath ?? "",
        resultsPath: input.resultsPath ?? "",
        notes: input.notes ?? "",
        active: input.active ?? true
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure lab provider update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteProcedureLabProvider(id: number): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/lab-providers/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized procedure lab provider delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async getProcedureLabProvider(id: number): Promise<ProcedureLabProviderRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT lp.id,
  lp.name,
  COALESCE(lab_director_id, 0) AS "labDirectorId",
  COALESCE(abo.organization, '') AS "labDirectorName",
  COALESCE(abo.type, '') AS "labDirectorType",
  COALESCE(lp.npi, '') AS npi,
  COALESCE(NULLIF(TRIM(lp.protocol), ''), 'DL') AS protocol,
  COALESCE(NULLIF(TRIM(lp.usage), ''), 'D') AS "usage",
  COALESCE(NULLIF(TRIM(lp.direction), ''), 'B') AS direction,
  COALESCE(lp.send_app_id, '') AS "sendApplicationId",
  COALESCE(lp.send_fac_id, '') AS "sendFacilityId",
  COALESCE(lp.recv_app_id, '') AS "receiveApplicationId",
  COALESCE(lp.recv_fac_id, '') AS "receiveFacilityId",
  COALESCE(lp.remote_host, '') AS "remoteHost",
  COALESCE(lp.login, '') AS login,
  COALESCE(lp.password, '') AS password,
  COALESCE(lp.orders_path, '') AS "ordersPath",
  COALESCE(lp.results_path, '') AS "resultsPath",
  COALESCE(lp.notes, '') AS notes,
  CASE WHEN lp.active THEN '1' ELSE '0' END AS active
FROM lab_providers lp
LEFT JOIN lab_provider_address_book abo ON abo.id = lp.lab_director_id
WHERE lp.id = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      name: row.name,
      labDirectorId: Number(row.labDirectorId),
      labDirectorName: row.labDirectorName,
      labDirectorType: row.labDirectorType,
      npi: row.npi,
      protocol: row.protocol,
      usage: row.usage,
      direction: row.direction,
      sendApplicationId: row.sendApplicationId,
      sendFacilityId: row.sendFacilityId,
      receiveApplicationId: row.receiveApplicationId,
      receiveFacilityId: row.receiveFacilityId,
      remoteHost: row.remoteHost,
      login: row.login,
      password: row.password,
      ordersPath: row.ordersPath,
      resultsPath: row.resultsPath,
      notes: row.notes,
      active: row.active === "1"
    };
  }

  async createProcedureLabProviderAddressBookOrganization(
    input: NewProcedureLabProviderAddressBookOrganization
  ): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/lab-provider-address-book`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organization: input.organization,
        type: input.type ?? "ord_lab",
        active: input.active ?? true
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure lab provider address book create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async deleteProcedureLabProviderAddressBookOrganization(id: number): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/lab-provider-address-book/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized procedure lab provider address book delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createProcedureOrderCatalogItem(input: NewProcedureOrderCatalogItem): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/order-catalog`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        parentId: input.parentId ?? null,
        labId: input.labId ?? null,
        name: input.name,
        code: input.code ?? "",
        itemType: input.itemType ?? "ord",
        procedureTypeName: input.procedureTypeName ?? "laboratory",
        description: input.description ?? "",
        specimen: input.specimen ?? "",
        standardCode: input.standardCode ?? "",
        sequence: input.sequence ?? 0,
        active: input.active ?? true
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure order catalog create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async updateProcedureOrderCatalogItem(id: number, input: NewProcedureOrderCatalogItem): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/order-catalog/${encodeURIComponent(String(id))}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        parentId: input.parentId ?? null,
        labId: input.labId ?? null,
        name: input.name,
        code: input.code ?? "",
        itemType: input.itemType ?? "ord",
        procedureTypeName: input.procedureTypeName ?? "laboratory",
        description: input.description ?? "",
        specimen: input.specimen ?? "",
        standardCode: input.standardCode ?? "",
        sequence: input.sequence ?? 0,
        active: input.active ?? true
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure order catalog update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteProcedureOrderCatalogItem(id: number): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/order-catalog/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized procedure order catalog delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async getProcedureOrderCatalogItem(id: number): Promise<ProcedureOrderCatalogItemRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT loc.id,
  COALESCE(loc.parent_id, 0) AS "parentId",
  COALESCE(loc.lab_id, 0) AS "labId",
  loc.name,
  COALESCE(loc.code, '') AS code,
  loc.item_type AS "itemType",
  COALESCE(loc.procedure_type_name, '') AS "procedureTypeName",
  COALESCE(loc.description, '') AS description,
  COALESCE(loc.specimen, '') AS specimen,
  COALESCE(loc.standard_code, '') AS "standardCode",
  loc.seq AS sequence,
  CASE WHEN loc.active THEN '1' ELSE '0' END AS active,
  (SELECT COUNT(*) FROM lab_order_catalog child WHERE child.parent_id = loc.id) AS "childCount"
FROM lab_order_catalog loc
WHERE loc.id = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      parentId: Number(row.parentId),
      labId: Number(row.labId),
      name: row.name,
      code: row.code,
      itemType: row.itemType,
      procedureTypeName: row.procedureTypeName,
      description: row.description,
      specimen: row.specimen,
      standardCode: row.standardCode,
      sequence: Number(row.sequence),
      active: row.active === "1",
      childCount: Number(row.childCount)
    };
  }

  async getProcedureOrderCatalogItemByCode(
    parentId: number,
    code: string,
    itemType = "ord"
  ): Promise<ProcedureOrderCatalogItemRecord | null> {
    const rows = await this.db.queryRows<{ id: string }>(`
SELECT id
FROM lab_order_catalog
WHERE parent_id = ${integer(parentId)}
  AND code = ${sqlString(code)}
  AND item_type = ${sqlString(itemType)}
ORDER BY id DESC
LIMIT 1;
`);
    const id = rows[0]?.id;
    return id ? this.getProcedureOrderCatalogItem(Number(id)) : null;
  }

  async importProcedureVendorCompendium(
    input: ProcedureVendorCompendiumImportInput
  ): Promise<ProcedureVendorCompendiumImportResult> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/order-catalog/import-compendium`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure compendium import failed with ${response.status}: ${await response.text()}`);
    }

    return (await response.json()) as ProcedureVendorCompendiumImportResult;
  }

  async deleteProcedureOrderCatalogSubtree(id: number): Promise<void> {
    await this.db.execute(`
DELETE FROM lab_order_catalog
WHERE parent_id IN (
  SELECT id
  FROM lab_order_catalog
  WHERE parent_id = ${integer(id)}
);
DELETE FROM lab_order_catalog
WHERE parent_id = ${integer(id)};
DELETE FROM lab_order_catalog
WHERE id = ${integer(id)};
`);
  }

  async getProcedureOrder(id: number): Promise<ProcedureOrderRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", encounter AS "encounterId", order_date::date AS "dateOrdered",
  COALESCE(order_status, '') AS "orderStatus", COALESCE(order_priority, '') AS "orderPriority",
  COALESCE(code, '') AS "procedureCode", COALESCE(name, '') AS "procedureName",
  COALESCE(procedure_type, '') AS "procedureType", COALESCE(diagnosis, '') AS diagnosis,
  COALESCE(instructions, '') AS instructions,
  COALESCE(TO_CHAR(date_transmitted, 'YYYY-MM-DD HH24:MI'), '') AS "dateTransmitted"
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
      dateOrdered: row.dateOrdered,
      orderStatus: row.orderStatus,
      orderPriority: row.orderPriority,
      procedureCode: row.procedureCode,
      procedureName: row.procedureName,
      procedureType: row.procedureType,
      diagnosis: row.diagnosis,
      instructions: row.instructions,
      dateTransmitted: row.dateTransmitted
    };
  }

  async updateProcedureOrder(id: number, input: ProcedureOrderUpdate): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/orders/${encodeURIComponent(String(id))}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
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
      throw new Error(`Modernized procedure order update failed with ${response.status}: ${await response.text()}`);
    }
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

  async transmitProcedureOrder(id: number, transmittedAt: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/orders/${encodeURIComponent(String(id))}/transmit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transmittedAt })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure order transmit failed with ${response.status}: ${await response.text()}`);
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
  date_collected::date AS "dateCollected", report_date::date AS "dateReport", COALESCE(specimen_number, '') AS "specimenNumber",
  COALESCE(review_status, '') AS "reviewStatus",
  COALESCE(reviewed_by, '') AS "reviewedBy",
  COALESCE(to_char(reviewed_at, 'YYYY-MM-DD HH24:MI'), '') AS "reviewedAt",
  COALESCE(notes, '') AS "reportNotes"
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
      dateCollected: row.dateCollected,
      dateReport: row.dateReport,
      specimenNumber: row.specimenNumber,
      reportStatus: row.reportStatus,
      reviewStatus: row.reviewStatus,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      reportNotes: row.reportNotes
    };
  }

  async updateProcedureReport(id: number, input: ProcedureReportUpdate): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/reports/${encodeURIComponent(String(id))}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dateCollected: input.dateCollected,
        dateReport: input.dateReport,
        specimenNumber: input.specimenNumber,
        reportStatus: input.reportStatus,
        reviewStatus: input.reviewStatus,
        notes: input.notes
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure report update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async signProcedureReport(id: number, input: ProcedureReportSignOff): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/reports/${encodeURIComponent(String(id))}/sign`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reviewedBy: input.reviewedBy,
        reviewedAt: input.reviewedAt
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure report sign-off failed with ${response.status}: ${await response.text()}`);
    }
  }

  async bulkSignProcedureReports(ids: number[], input: ProcedureReportSignOff): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/reports/bulk-sign`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reportIds: ids,
        reviewedBy: input.reviewedBy,
        reviewedAt: input.reviewedAt
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure report bulk sign-off failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createProcedureSpecimen(input: NewProcedureSpecimen): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/specimens`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: input.orderId,
        specimenIdentifier: input.specimenIdentifier,
        accessionIdentifier: input.accessionIdentifier,
        specimenTypeCode: input.specimenTypeCode,
        specimenType: input.specimenType,
        collectionMethodCode: input.collectionMethodCode,
        collectionMethod: input.collectionMethod,
        specimenLocationCode: input.specimenLocationCode,
        specimenLocation: input.specimenLocation,
        collectedDate: input.collectedDate,
        volumeValue: Number(input.volumeValue),
        volumeUnit: input.volumeUnit,
        conditionCode: input.conditionCode,
        specimenCondition: input.specimenCondition,
        comments: input.comments
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure specimen create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async getProcedureSpecimen(id: number): Promise<ProcedureSpecimenRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, order_id AS "orderId",
  COALESCE(specimen_identifier, '') AS "specimenIdentifier",
  COALESCE(accession_identifier, '') AS "accessionIdentifier",
  COALESCE(specimen_type_code, '') AS "specimenTypeCode",
  COALESCE(specimen_type, '') AS "specimenType",
  COALESCE(collection_method_code, '') AS "collectionMethodCode",
  COALESCE(collection_method, '') AS "collectionMethod",
  COALESCE(specimen_location_code, '') AS "specimenLocationCode",
  COALESCE(specimen_location, '') AS "specimenLocation",
  collected_date::date AS "collectedDate",
  COALESCE(volume_value::text, '') AS "volumeValue",
  COALESCE(volume_unit, '') AS "volumeUnit",
  COALESCE(condition_code, '') AS "conditionCode",
  COALESCE(specimen_condition, '') AS "specimenCondition",
  COALESCE(comments, '') AS comments
FROM lab_specimens
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
      specimenIdentifier: row.specimenIdentifier,
      accessionIdentifier: row.accessionIdentifier,
      specimenTypeCode: row.specimenTypeCode,
      specimenType: row.specimenType,
      collectionMethodCode: row.collectionMethodCode,
      collectionMethod: row.collectionMethod,
      specimenLocationCode: row.specimenLocationCode,
      specimenLocation: row.specimenLocation,
      collectedDate: row.collectedDate,
      volumeValue: row.volumeValue,
      volumeUnit: row.volumeUnit,
      conditionCode: row.conditionCode,
      specimenCondition: row.specimenCondition,
      comments: row.comments
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

  async updateProcedureResult(id: number, input: NewProcedureResult): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/results/${encodeURIComponent(String(id))}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resultCode: input.resultCode,
        resultText: input.resultText,
        dateTime: input.dateTime,
        units: input.units,
        result: input.result,
        range: input.range,
        abnormal: input.abnormal,
        status: input.status
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure result update failed with ${response.status}: ${await response.text()}`);
    }
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

  async signEncounter(id: number, input: NewEncounterSignature): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(id))}/sign`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error(`Modernized encounter sign-off failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async getEncounterSignature(id: number): Promise<EncounterSignatureRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, encounter AS "encounterId", table_name AS "tableName", signer_username AS "signerUsername",
  to_char(signed_at, 'YYYY-MM-DD HH24:MI') AS "signedAt",
  CASE WHEN is_lock THEN '1' ELSE '0' END AS "isLock",
  COALESCE(amendment, '') AS amendment,
  hash, signature_hash AS "signatureHash"
FROM encounter_signatures
WHERE id = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    return row ? {
      id: Number(row.id),
      encounterId: Number(row.encounterId),
      tableName: row.tableName,
      signerUsername: row.signerUsername,
      signedAt: row.signedAt,
      isLock: row.isLock === "1",
      amendment: row.amendment,
      hash: row.hash,
      signatureHash: row.signatureHash
    } : null;
  }

  async deleteEncounterSignature(id: number): Promise<void> {
    const signature = await this.getEncounterSignature(id);
    if (!signature) {
      return;
    }

    const response = await fetch(
      `${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(signature.encounterId))}/signatures/${encodeURIComponent(String(id))}`,
      {
        method: "DELETE"
      }
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized encounter signature delete failed with ${response.status}: ${await response.text()}`);
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

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitDateList(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(/[,\s;]+/)
    .map((entry) => entry.trim())
    .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry))
    .sort();
}

function splitNumberList(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(/[,\s;]+/)
        .map((entry) => Number(entry.trim()))
        .filter((entry) => Number.isInteger(entry) && entry >= 1 && entry <= 7)
    )
  ).sort((left, right) => left - right);
}

function buildDocumentThumbnailDataUri(mimetype: string, contentBase64: string): string | null {
  const normalizedMimetype = mimetype.trim().toLowerCase();
  const normalizedContent = contentBase64.trim();
  if (!normalizedMimetype.startsWith("image/") || normalizedContent.length === 0) {
    return null;
  }

  return `data:${normalizedMimetype};base64,${normalizedContent}`;
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

function appointmentCategoryName(categoryId: number) {
  return categoryId === 9
    ? "Established Patient"
    : categoryId === 10
      ? "New Patient"
      : categoryId === 13
        ? "Preventive Care Services"
        : `Category ${categoryId}`;
}
