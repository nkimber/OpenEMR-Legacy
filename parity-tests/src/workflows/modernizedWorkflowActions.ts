import type { ModernizedPostgresProbe } from "../db/modernizedPostgresProbe.js";
import { buildPatientDocumentScanFields } from "../db/legacyMariaDbProbe.js";
import type { RuntimeTarget } from "../config/targets.js";
import { protectedPatientPortalMessageBody } from "./legacyWorkflowActions.js";
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
  PatientDeceasedStatus,
  PatientDemographics,
  PatientEmployer,
  PatientGuardianContact,
  PatientCareTeamAssignment,
  PatientCareTeamMembersAssignment,
  PatientProviderAssignment,
  PatientDocumentBinaryContentReplacement,
  PatientDocumentContentReplacement,
  PatientDocumentMetadataUpdate,
  PatientDocumentRecord,
  PatientPortalAccountAccessState,
  PatientPortalArchiveMessagesResult,
  PatientPortalAppointmentRequestInput,
  PatientPortalAppointmentRequestOptionsResult,
  PatientPortalAppointmentRequestResult,
  PatientPortalAppointmentsResult,
  PatientPortalClinicalSummaryResult,
  PatientPortalMedicalReportGenerationInput,
  PatientPortalGeneratedMedicalReportResult,
  PatientPortalGeneratedMedicalReportPackageMetadata,
  PatientPortalGeneratedMedicalReportTemplateMetadata,
  PatientPortalLabResultsResult,
  PatientPortalMedicalReportResult,
  PatientPortalComposeMessageInput,
  PatientPortalComposeMessageResult,
  PatientPortalProfileChangeInput,
  PatientPortalForwardMessageInput,
  PatientPortalForwardMessageResult,
  PatientPortalDeleteMessageResult,
  PatientPortalDocumentsDownloadResult,
  PatientPortalDocumentsResult,
  PatientPortalHomeSummary,
  PatientPortalProfileResult,
  PatientPortalInboxMessageInput,
  PatientPortalLoginResult,
  PatientPortalMessageItem,
  PatientPortalMessageComposeOptionsResult,
  PatientPortalMessageRecipientsResult,
  PatientPortalMessageThreadResult,
  PatientPortalMessagesResult,
  PatientPortalReadMessageResult,
  PatientPortalReplyMessageInput,
  PatientPortalReplyMessageResult,
  PatientPortalSessionResult,
  PatientPortalAccountResetState,
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
  private adminSessionId: string | null = null;

  constructor(
    private readonly db: ModernizedPostgresProbe,
    private readonly target: RuntimeTarget
  ) {}

  private async getAdminSessionHeaders(): Promise<Record<string, string>> {
    if (!this.adminSessionId) {
      const response = await fetch(`${this.target.apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: this.target.credentials.username,
          password: this.target.credentials.password
        })
      });

      if (!response.ok) {
        throw new Error(`Modernized admin session login failed with ${response.status}: ${await response.text()}`);
      }

      const login = (await response.json()) as { authenticated: boolean; sessionId?: string | null; failureReason?: string | null };
      if (!login.authenticated || !login.sessionId) {
        throw new Error(`Modernized admin session login was rejected: ${login.failureReason ?? "no session issued"}`);
      }

      this.adminSessionId = login.sessionId;
    }

    const sessionId = this.adminSessionId;
    if (!sessionId) {
      throw new Error("Modernized admin session was not issued.");
    }

    return { "X-OpenEMR-Session": sessionId };
  }

  private async getAdminJsonHeaders(): Promise<Record<string, string>> {
    return {
      "content-type": "application/json",
      ...(await this.getAdminSessionHeaders())
    };
  }

  async createUser(input: NewUser): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/administration/users`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error(`Modernized user update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteUser(id: number): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/administration/users/${id}`, {
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized user delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createFacility(input: NewFacility): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/administration/facilities`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error(`Modernized facility update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteFacility(id: number): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/administration/facilities/${id}`, {
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
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
      headers: await this.getAdminJsonHeaders(),
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
        method: "DELETE",
        headers: await this.getAdminSessionHeaders()
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
      headers: await this.getAdminJsonHeaders(),
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
        method: "DELETE",
        headers: await this.getAdminSessionHeaders()
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
      headers: await this.getAdminJsonHeaders(),
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
  COALESCE(occupation, '') AS occupation,
  COALESCE(race, '') AS race,
  COALESCE(ethnicity, '') AS ethnicity,
  COALESCE(interpreter, '') AS interpreter,
  COALESCE(family_size::text, '') AS "familySize",
  COALESCE(monthly_income::text, '') AS "monthlyIncome",
  COALESCE(homeless, '') AS homeless,
  COALESCE(financial_review_date::text, '') AS "financialReviewDate"
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
      occupation: row.occupation,
      race: row.race,
      ethnicity: row.ethnicity,
      interpreter: row.interpreter,
      familySize: row.familySize,
      monthlyIncome: row.monthlyIncome,
      homeless: row.homeless,
      financialReviewDate: row.financialReviewDate
    };
  }

  async updatePatientDemographics(demographics: PatientDemographics): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patients/${encodeURIComponent(demographics.pubpid)}/demographics`, {
      method: "PUT",
      headers: await this.getAdminJsonHeaders(),
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
        occupation: demographics.occupation,
        race: demographics.race,
        ethnicity: demographics.ethnicity,
        interpreter: demographics.interpreter,
        familySize: demographics.familySize,
        monthlyIncome: demographics.monthlyIncome,
        homeless: demographics.homeless,
        financialReviewDate: demographics.financialReviewDate
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient demographics update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async getPatientDeceasedStatus(pid: number): Promise<PatientDeceasedStatus | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT legacy_pid AS pid, pubpid,
  COALESCE(deceased_date::text, '') AS "deceasedDate",
  COALESCE(deceased_reason, '') AS "deceasedReason"
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
      deceasedDate: row.deceasedDate,
      deceasedReason: row.deceasedReason
    };
  }

  async updatePatientDeceasedStatus(status: PatientDeceasedStatus): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patients/${encodeURIComponent(status.pubpid)}/deceased-status`, {
      method: "PUT",
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({
        deceasedDate: status.deceasedDate || null,
        deceasedReason: status.deceasedReason || null
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient deceased status update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async getPatientPortalAccountResetState(pid: number): Promise<PatientPortalAccountResetState | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT p.legacy_pid AS pid, p.pubpid,
  COALESCE(ppa.password_status::text, '') AS "passwordStatus",
  CASE WHEN COALESCE(ppa.one_time_token, '') <> '' THEN '1' ELSE '0' END AS "oneTimeLinkPending",
  COALESCE(ppa.portal_username, '') AS "portalUsername"
FROM patients p
LEFT JOIN patient_portal_accounts ppa ON ppa.patient_id = p.canonical_id
WHERE p.legacy_pid = ${integer(pid)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    const passwordStatus = row.passwordStatus === "" ? null : Number(row.passwordStatus);
    const oneTimeLinkPending = row.oneTimeLinkPending === "1";
    return {
      pid: Number(row.pid),
      pubpid: row.pubpid,
      passwordStatus,
      passwordStatusLabel: portalWorkflowPasswordStatusLabel(passwordStatus),
      oneTimeLinkPending,
      resetStatusLabel: portalWorkflowResetStatusLabel(oneTimeLinkPending, row.portalUsername)
    };
  }

  async updatePatientPortalAccountResetState(state: PatientPortalAccountResetState): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patients/${encodeURIComponent(state.pubpid)}/portal-account/reset`, {
      method: "PUT",
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({
        oneTimeLinkPending: state.oneTimeLinkPending
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient portal account reset update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async getPatientPortalAccountAccessState(pid: number): Promise<PatientPortalAccountAccessState | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT p.legacy_pid AS pid, p.pubpid,
  CASE WHEN p.portal_enabled THEN 'YES' ELSE 'NO' END AS "portalEnabled",
  COALESCE(p.cms_portal_login, '') AS "cmsPortalLogin",
  COALESCE(ppa.portal_username, '') AS "portalUsername"
FROM patients p
LEFT JOIN patient_portal_accounts ppa ON ppa.patient_id = p.canonical_id
WHERE p.legacy_pid = ${integer(pid)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    const portalEnabled = row.portalEnabled === "YES";
    return {
      pid: Number(row.pid),
      pubpid: row.pubpid,
      portalEnabled,
      accessStatusLabel: portalWorkflowAccessStatusLabel(portalEnabled, row.portalUsername),
      cmsPortalLogin: row.cmsPortalLogin,
      hasAccount: row.portalUsername !== ""
    };
  }

  async updatePatientPortalAccountAccessState(state: PatientPortalAccountAccessState): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patients/${encodeURIComponent(state.pubpid)}/portal-account/access`, {
      method: "PUT",
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({
        portalEnabled: state.portalEnabled
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient portal account access update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async verifyPatientPortalLogin(username: string, password: string): Promise<PatientPortalLoginResult> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient portal login failed with ${response.status}: ${await response.text()}`);
    }

    const result = (await response.json()) as {
      authenticated: boolean;
      username: string;
      portalUsername: string;
      canonicalId: string;
      legacyPid?: number | null;
      pubpid: string;
      displayName: string;
      failureReason?: string | null;
      sessionId?: string | null;
    };

    return {
      authenticated: result.authenticated,
      username: result.username,
      portalUsername: result.portalUsername,
      canonicalId: result.canonicalId,
      pid: result.legacyPid ?? null,
      pubpid: result.pubpid,
      displayName: result.displayName,
      failureReason: result.failureReason ?? null,
      sessionId: result.sessionId ?? null
    };
  }

  async getPatientPortalSession(sessionId: string): Promise<PatientPortalSessionResult> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/session`, {
      headers: { "X-OpenEMR-Patient-Portal-Session": sessionId }
    });

    if (!response.ok) {
      throw new Error(`Modernized patient portal session check failed with ${response.status}: ${await response.text()}`);
    }

    return mapPatientPortalSessionResult(await response.json());
  }

  async endPatientPortalSession(sessionId: string): Promise<PatientPortalSessionResult> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/session`, {
      method: "DELETE",
      headers: { "X-OpenEMR-Patient-Portal-Session": sessionId }
    });

    if (!response.ok) {
      throw new Error(`Modernized patient portal session logout failed with ${response.status}: ${await response.text()}`);
    }

    return mapPatientPortalSessionResult(await response.json());
  }

  async getPatientPortalHomeSummary(username: string, password: string): Promise<PatientPortalHomeSummary> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return {
        authenticated: false,
        username,
        portalUsername: "",
        canonicalId: "",
        pid: null,
        pubpid: "",
        displayName: "",
        datasetVersion: "unknown",
        asOfDate: new Date().toISOString().slice(0, 10),
        messages: {
          totalMessages: 0,
          newMessages: 0,
          doneMessages: 0,
          latestMessageTitle: null,
          latestMessageDate: null
        },
        upcomingAppointmentCount: 0,
        upcomingAppointments: [],
        immunizationCount: 0,
        immunizations: [],
        failureReason: login.failureReason ?? "Patient portal sign-in was rejected.",
        sessionSource: "modernized-openemr-portal"
      };
    }

    try {
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/home`, {
        headers: { "X-OpenEMR-Patient-Portal-Session": login.sessionId }
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal home failed with ${response.status}: ${await response.text()}`);
      }

      return mapPatientPortalHomeSummary(await response.json());
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async getPatientPortalProfile(username: string, password: string): Promise<PatientPortalProfileResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return buildEmptyModernizedPortalProfileResult(username, login.failureReason ?? "Patient portal sign-in was rejected.");
    }

    try {
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/profile`, {
        headers: { "X-OpenEMR-Patient-Portal-Session": login.sessionId }
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal profile failed with ${response.status}: ${await response.text()}`);
      }

      return mapPatientPortalProfileResult(await response.json());
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async submitPatientPortalProfileChange(
    username: string,
    password: string,
    input: PatientPortalProfileChangeInput
  ): Promise<PatientPortalProfileResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return buildEmptyModernizedPortalProfileResult(username, login.failureReason ?? "Patient portal sign-in was rejected.");
    }

    try {
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/profile/changes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-OpenEMR-Patient-Portal-Session": login.sessionId
        },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal profile change failed with ${response.status}: ${await response.text()}`);
      }

      return mapPatientPortalProfileResult(await response.json());
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async cleanupPatientPortalProfileChange(username: string, password: string): Promise<void> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || login.pid === null) {
      return;
    }

    await this.db.execute(`
DELETE FROM patient_portal_profile_change_requests
WHERE pid = ${integer(login.pid)}
  AND activity = 'profile'
  AND require_audit = 1
  AND status = 'waiting'
  AND pending_action = 'review';
`);
  }

  async getPatientPortalAppointments(username: string, password: string): Promise<PatientPortalAppointmentsResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return {
        authenticated: false,
        username,
        portalUsername: "",
        canonicalId: "",
        pid: null,
        pubpid: "",
        displayName: "",
        datasetVersion: "unknown",
        asOfDate: new Date().toISOString().slice(0, 10),
        upcomingAppointmentCount: 0,
        upcomingAppointments: [],
        pastAppointmentCount: 0,
        pastAppointments: [],
        failureReason: login.failureReason ?? "Patient portal sign-in was rejected.",
        sessionSource: "modernized-openemr-portal"
      };
    }

    try {
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/appointments`, {
        headers: { "X-OpenEMR-Patient-Portal-Session": login.sessionId }
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal appointments failed with ${response.status}: ${await response.text()}`);
      }

      return mapPatientPortalAppointmentsResult(await response.json());
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async getPatientPortalClinicalSummary(username: string, password: string): Promise<PatientPortalClinicalSummaryResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return {
        authenticated: false,
        username,
        portalUsername: "",
        canonicalId: "",
        pid: null,
        pubpid: "",
        displayName: "",
        datasetVersion: "unknown",
        asOfDate: new Date().toISOString().slice(0, 10),
        problemCount: 0,
        problems: [],
        allergyCount: 0,
        allergies: [],
        medicationCount: 0,
        medications: [],
        prescriptionCount: 0,
        prescriptions: [],
        failureReason: login.failureReason ?? "Patient portal sign-in was rejected.",
        sessionSource: "modernized-openemr-portal"
      };
    }

    try {
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/clinical-summary`, {
        headers: { "X-OpenEMR-Patient-Portal-Session": login.sessionId }
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal clinical summary failed with ${response.status}: ${await response.text()}`);
      }

      return mapPatientPortalClinicalSummaryResult(await response.json());
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async getPatientPortalLabResults(username: string, password: string): Promise<PatientPortalLabResultsResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return {
        authenticated: false,
        username,
        portalUsername: "",
        canonicalId: "",
        pid: null,
        pubpid: "",
        displayName: "",
        datasetVersion: "unknown",
        asOfDate: new Date().toISOString().slice(0, 10),
        orderCount: 0,
        reportCount: 0,
        resultCount: 0,
        orders: [],
        failureReason: login.failureReason ?? "Patient portal sign-in was rejected.",
        sessionSource: "modernized-openemr-portal"
      };
    }

    try {
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/lab-results`, {
        headers: { "X-OpenEMR-Patient-Portal-Session": login.sessionId }
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal lab results failed with ${response.status}: ${await response.text()}`);
      }

      return mapPatientPortalLabResultsResult(await response.json());
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async getPatientPortalMedicalReport(username: string, password: string): Promise<PatientPortalMedicalReportResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return {
        authenticated: false,
        username,
        portalUsername: "",
        canonicalId: "",
        pid: null,
        pubpid: "",
        displayName: "",
        datasetVersion: "unknown",
        asOfDate: new Date().toISOString().slice(0, 10),
        sectionCount: 0,
        selectedSectionCount: 0,
        sections: [],
        issueCount: 0,
        issues: [],
        encounterCount: 0,
        encounters: [],
        procedureOrderCount: 0,
        procedureOrders: [],
        reportPreview: {
          title: "",
          includedSectionIds: [],
          includedProcedureOrderIds: [],
          includedEncounterFormIds: [],
          templateMetadata: buildEmptyPatientPortalGeneratedMedicalReportTemplateMetadata(),
          packageMetadata: buildEmptyPatientPortalGeneratedMedicalReportPackageMetadata(),
          summaryLineCount: 0,
          summaryLines: []
        },
        failureReason: login.failureReason ?? "Patient portal sign-in was rejected.",
        sessionSource: "modernized-openemr-portal"
      };
    }

    try {
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/medical-report`, {
        headers: { "X-OpenEMR-Patient-Portal-Session": login.sessionId }
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal medical report failed with ${response.status}: ${await response.text()}`);
      }

      return mapPatientPortalMedicalReportResult(await response.json());
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async generatePatientPortalMedicalReport(
    username: string,
    password: string,
    input: PatientPortalMedicalReportGenerationInput = {}
  ): Promise<PatientPortalGeneratedMedicalReportResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return buildEmptyGeneratedPortalMedicalReportResult(
        username,
        login.failureReason ?? "Patient portal sign-in was rejected.",
        "modernized-openemr-portal"
      );
    }

    try {
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/medical-report/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-OpenEMR-Patient-Portal-Session": login.sessionId
        },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal medical report generation failed with ${response.status}: ${await response.text()}`);
      }

      return mapPatientPortalGeneratedMedicalReportResult(await response.json());
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async getPatientPortalAppointmentRequestOptions(
    username: string,
    password: string
  ): Promise<PatientPortalAppointmentRequestOptionsResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return {
        authenticated: false,
        username,
        portalUsername: "",
        canonicalId: "",
        pid: null,
        pubpid: "",
        displayName: "",
        datasetVersion: "unknown",
        asOfDate: new Date().toISOString().slice(0, 10),
        categories: [],
        providers: [],
        facilities: [],
        defaults: {
          categoryId: null,
          providerId: null,
          facilityId: null,
          durationMinutes: 0,
          date: "",
          startTime: ""
        },
        failureReason: login.failureReason ?? "Patient portal sign-in was rejected.",
        sessionSource: "modernized-openemr-portal"
      };
    }

    try {
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/appointments/request-options`, {
        headers: { "X-OpenEMR-Patient-Portal-Session": login.sessionId }
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal appointment request options failed with ${response.status}: ${await response.text()}`);
      }

      return mapPatientPortalAppointmentRequestOptionsResult(await response.json());
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async requestPatientPortalAppointment(
    username: string,
    password: string,
    input: PatientPortalAppointmentRequestInput
  ): Promise<PatientPortalAppointmentRequestResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return {
        authenticated: false,
        created: false,
        username,
        portalUsername: "",
        canonicalId: "",
        pid: null,
        pubpid: "",
        displayName: "",
        appointment: null,
        reminder: null,
        failureReason: login.failureReason ?? "Patient portal sign-in was rejected.",
        sessionSource: "modernized-openemr-portal"
      };
    }

    try {
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/appointments/requests`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-OpenEMR-Patient-Portal-Session": login.sessionId
        },
        body: JSON.stringify({
          providerId: input.providerId,
          facilityId: input.facilityId,
          categoryId: input.categoryId,
          date: input.date,
          startTime: input.startTime,
          durationMinutes: input.durationMinutes,
          reason: input.reason
        })
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal appointment request failed with ${response.status}: ${await response.text()}`);
      }

      return mapPatientPortalAppointmentRequestResult(await response.json());
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async getPatientPortalMessages(username: string, password: string): Promise<PatientPortalMessagesResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return {
        authenticated: false,
        username,
        portalUsername: "",
        canonicalId: "",
        pid: null,
        pubpid: "",
        displayName: "",
        datasetVersion: "unknown",
        asOfDate: new Date().toISOString().slice(0, 10),
        messageCount: 0,
        messages: [],
        sentMessageCount: 0,
        sentMessages: [],
        allMessageCount: 0,
        allMessages: [],
        deletedMessageCount: 0,
        deletedMessages: [],
        failureReason: login.failureReason ?? "Patient portal sign-in was rejected.",
        sessionSource: "modernized-openemr-portal"
      };
    }

    try {
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/messages`, {
        headers: { "X-OpenEMR-Patient-Portal-Session": login.sessionId }
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal messages failed with ${response.status}: ${await response.text()}`);
      }

      return mapPatientPortalMessagesResult(await response.json());
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async getPatientPortalMessageRecipients(username: string, password: string): Promise<PatientPortalMessageRecipientsResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return {
        authenticated: false,
        username,
        portalUsername: "",
        canonicalId: "",
        pid: null,
        pubpid: "",
        displayName: "",
        datasetVersion: "unknown",
        asOfDate: new Date().toISOString().slice(0, 10),
        recipientCount: 0,
        recipients: [],
        failureReason: login.failureReason ?? "Patient portal sign-in was rejected.",
        sessionSource: "modernized-openemr-portal"
      };
    }

    try {
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/messages/recipients`, {
        headers: { "X-OpenEMR-Patient-Portal-Session": login.sessionId }
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal message recipients failed with ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      return {
        authenticated: Boolean(result.authenticated),
        username: result.username ?? username,
        portalUsername: result.portalUsername ?? "",
        canonicalId: result.canonicalId ?? "",
        pid: result.legacyPid ?? null,
        pubpid: result.pubpid ?? "",
        displayName: result.displayName ?? "",
        datasetVersion: result.datasetVersion ?? "unknown",
        asOfDate: result.asOfDate ?? new Date().toISOString().slice(0, 10),
        recipientCount: result.recipientCount ?? 0,
        recipients: (result.recipients ?? []).map((recipient: any) => ({
          id: recipient.id ?? "",
          displayName: recipient.displayName ?? recipient.id ?? "",
          type: recipient.type ?? "user",
          active: Boolean(recipient.active),
          fallback: Boolean(recipient.fallback)
        })),
        failureReason: result.failureReason ?? null,
        sessionSource: result.sessionSource ?? "modernized-openemr-portal"
      };
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async getPatientPortalMessageComposeOptions(username: string, password: string): Promise<PatientPortalMessageComposeOptionsResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return {
        authenticated: false,
        username,
        portalUsername: "",
        canonicalId: "",
        pid: null,
        pubpid: "",
        displayName: "",
        datasetVersion: "unknown",
        asOfDate: new Date().toISOString().slice(0, 10),
        defaultSubject: "General",
        subjectCount: 0,
        subjectOptions: [],
        recipientCount: 0,
        recipients: [],
        failureReason: login.failureReason ?? "Patient portal sign-in was rejected.",
        sessionSource: "modernized-openemr-portal"
      };
    }

    try {
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/messages/compose-options`, {
        headers: { "X-OpenEMR-Patient-Portal-Session": login.sessionId }
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal message compose options failed with ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      return {
        authenticated: Boolean(result.authenticated),
        username: result.username ?? username,
        portalUsername: result.portalUsername ?? "",
        canonicalId: result.canonicalId ?? "",
        pid: result.legacyPid ?? null,
        pubpid: result.pubpid ?? "",
        displayName: result.displayName ?? "",
        datasetVersion: result.datasetVersion ?? "unknown",
        asOfDate: result.asOfDate ?? new Date().toISOString().slice(0, 10),
        defaultSubject: result.defaultSubject ?? "General",
        subjectCount: result.subjectCount ?? 0,
        subjectOptions: (result.subjectOptions ?? []).map((subject: any) => ({
          value: subject.value ?? "",
          label: subject.label ?? subject.value ?? "",
          default: Boolean(subject.default)
        })),
        recipientCount: result.recipientCount ?? 0,
        recipients: (result.recipients ?? []).map((recipient: any) => ({
          id: recipient.id ?? "",
          displayName: recipient.displayName ?? recipient.id ?? "",
          type: recipient.type ?? "user",
          active: Boolean(recipient.active),
          fallback: Boolean(recipient.fallback)
        })),
        failureReason: result.failureReason ?? null,
        sessionSource: result.sessionSource ?? "modernized-openemr-portal"
      };
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async getPatientPortalDocuments(username: string, password: string): Promise<PatientPortalDocumentsResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return {
        authenticated: false,
        username,
        portalUsername: "",
        canonicalId: "",
        pid: null,
        pubpid: "",
        displayName: "",
        datasetVersion: "unknown",
        asOfDate: new Date().toISOString().slice(0, 10),
        documentCount: 0,
        categories: [],
        documents: [],
        failureReason: login.failureReason ?? "Patient portal sign-in was rejected.",
        sessionSource: "modernized-openemr-portal"
      };
    }

    try {
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/documents`, {
        headers: { "X-OpenEMR-Patient-Portal-Session": login.sessionId }
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal documents failed with ${response.status}: ${await response.text()}`);
      }

      return mapPatientPortalDocumentsResult(await response.json());
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async downloadPatientPortalDocuments(
    username: string,
    password: string,
    documentIds: number[]
  ): Promise<PatientPortalDocumentsDownloadResult> {
    const requestedDocumentIds = Array.from(
      new Set(documentIds.filter((documentId) => Number.isInteger(documentId) && documentId > 0))
    );
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return {
        authenticated: false,
        downloadable: false,
        username,
        portalUsername: "",
        canonicalId: "",
        pid: null,
        pubpid: "",
        displayName: "",
        documentIds: requestedDocumentIds,
        documentCount: 0,
        fileName: "patient_documents.zip",
        contentType: "application/zip",
        contentLength: 0,
        failureReason: login.failureReason ?? "Patient portal sign-in was rejected.",
        sessionSource: "modernized-openemr-portal"
      };
    }

    try {
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/documents/download`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-OpenEMR-Patient-Portal-Session": login.sessionId
        },
        body: JSON.stringify({ documentIds: requestedDocumentIds })
      });

      if (!response.ok) {
        return {
          authenticated: true,
          downloadable: false,
          username: login.username,
          portalUsername: login.portalUsername,
          canonicalId: login.canonicalId,
          pid: login.pid,
          pubpid: login.pubpid,
          displayName: login.displayName,
          documentIds: requestedDocumentIds,
          documentCount: 0,
          fileName: "patient_documents.zip",
          contentType: "application/zip",
          contentLength: 0,
          failureReason: await response.text(),
          sessionSource: "modernized-openemr-portal"
        };
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      return {
        authenticated: true,
        downloadable: true,
        username: login.username,
        portalUsername: login.portalUsername,
        canonicalId: login.canonicalId,
        pid: login.pid,
        pubpid: login.pubpid,
        displayName: login.displayName,
        documentIds: requestedDocumentIds,
        documentCount: requestedDocumentIds.length,
        fileName: response.headers.get("content-disposition")?.includes("patient_documents.zip")
          ? "patient_documents.zip"
          : "patient_documents.zip",
        contentType: response.headers.get("content-type") ?? "application/zip",
        contentLength: buffer.length,
        failureReason: null,
        sessionSource: "modernized-openemr-portal"
      };
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async getPatientPortalMessageThread(
    username: string,
    password: string,
    messageId: string
  ): Promise<PatientPortalMessageThreadResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return {
        authenticated: false,
        username,
        portalUsername: "",
        canonicalId: "",
        pid: null,
        pubpid: "",
        displayName: "",
        datasetVersion: "unknown",
        asOfDate: new Date().toISOString().slice(0, 10),
        messageId,
        threadId: 0,
        anchorMessage: null,
        threadMessageCount: 0,
        threadMessages: [],
        failureReason: login.failureReason ?? "Patient portal sign-in was rejected.",
        sessionSource: "modernized-openemr-portal"
      };
    }

    try {
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/messages/${messageId}/thread`, {
        headers: { "X-OpenEMR-Patient-Portal-Session": login.sessionId }
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal message thread failed with ${response.status}: ${await response.text()}`);
      }

      return mapPatientPortalMessageThreadResult(await response.json());
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async composePatientPortalMessage(
    username: string,
    password: string,
    input: PatientPortalComposeMessageInput
  ): Promise<PatientPortalComposeMessageResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return {
        authenticated: false,
        created: false,
        username,
        portalUsername: "",
        canonicalId: "",
        pid: null,
        pubpid: "",
        displayName: "",
        recipientId: input.recipientId,
        recipientName: "",
        sentMessage: null,
        recipientMessage: null,
        messageCount: 0,
        sentMessageCount: 0,
        failureReason: login.failureReason ?? "Patient portal sign-in was rejected.",
        sessionSource: "modernized-openemr-portal"
      };
    }

    try {
      await this.cleanupPatientPortalComposedMessage(login.portalUsername, input.title);
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-OpenEMR-Patient-Portal-Session": login.sessionId
        },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal message compose failed with ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      return {
        authenticated: Boolean(result.authenticated),
        created: Boolean(result.created),
        username: result.username ?? username,
        portalUsername: result.portalUsername ?? "",
        canonicalId: result.canonicalId ?? "",
        pid: result.legacyPid ?? null,
        pubpid: result.pubpid ?? "",
        displayName: result.displayName ?? "",
        recipientId: result.recipientId ?? input.recipientId,
        recipientName: result.recipientName ?? "",
        sentMessage: result.sentMessage ? mapPatientPortalMessageItem(result.sentMessage, result.portalUsername) : null,
        recipientMessage: result.recipientMessage ? mapPatientPortalMessageItem(result.recipientMessage, result.portalUsername) : null,
        messageCount: result.messageCount ?? 0,
        sentMessageCount: result.sentMessageCount ?? 0,
        failureReason: result.failureReason ?? null,
        sessionSource: result.sessionSource ?? "modernized-openemr-portal"
      };
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async cleanupPatientPortalComposedMessage(portalUsername: string, title: string): Promise<void> {
    await this.db.execute(`
DELETE FROM patient_portal_message_audit_events
WHERE message_title = ${sqlString(title)}
  AND portal_username = ${sqlString(portalUsername)};

DELETE FROM portal_mailbox_messages
WHERE title = ${sqlString(title)}
  AND (owner = ${sqlString(portalUsername)}
    OR sender_id = ${sqlString(portalUsername)}
    OR recipient_id = ${sqlString(portalUsername)});
`);
  }

  async createPatientPortalInboxMessage(
    username: string,
    password: string,
    input: PatientPortalInboxMessageInput
  ): Promise<PatientPortalMessageItem> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId || login.pid === null) {
      throw new Error(`Patient portal sign-in was rejected: ${login.failureReason ?? "no portal session"}`);
    }

    const title = input.title.trim();
    const body = input.body.trim();
    const senderId = input.senderId?.trim() || "admin";
    const senderRows = await this.db.queryRows<{ displayName: string }>(`
SELECT COALESCE(
  (SELECT TRIM(first_name || ' ' || last_name) FROM staff WHERE username = ${sqlString(senderId)} LIMIT 1),
  (SELECT display_name FROM auth_accounts WHERE username = ${sqlString(senderId)} LIMIT 1),
  ${sqlString(senderId)}
) AS "displayName";
`);
    const senderName = input.senderName?.trim() || senderRows[0]?.displayName || senderId;
    if (!title || !body) {
      throw new Error("Secure message title and body are required.");
    }

    const isEncrypted = Boolean(input.isEncrypted);

    await this.cleanupPatientPortalComposedMessage(login.portalUsername, title);
    const idRows = await this.db.queryRows<{ nextId: string }>(`
SELECT GREATEST(COALESCE(MAX(id), 9393000) + 1, 9393001) AS "nextId"
FROM portal_mailbox_messages;
`);
    const messageId = Number(idRows[0]?.nextId ?? 9393001);
    const messageDate = input.messageDate?.trim() || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(messageDate)) {
      throw new Error("Patient portal inbox message date must be formatted as YYYY-MM-DD.");
    }

    await this.db.execute(`
INSERT INTO portal_mailbox_messages (
  id, patient_id, pid, message_date, body, owner, user_value, group_name,
  activity, authorized, title, assigned_to, message_status, portal_relation, mail_chain,
  sender_id, sender_name, recipient_id, recipient_name, reply_mail_chain,
  is_encrypted, deleted
)
VALUES (
  ${integer(messageId)}, ${sqlString(login.canonicalId)}, ${integer(login.pid)}, ${sqlString(messageDate)}, ${sqlString(body)}, ${sqlString(login.portalUsername)}, ${sqlString(senderId)}, 'Default',
  1, 1, ${sqlString(title)}, ${sqlString(login.portalUsername)}, 'New', 'portal:inbox-setup', ${integer(messageId)},
  ${sqlString(senderId)}, ${sqlString(senderName)}, ${sqlString(login.portalUsername)}, ${sqlString(login.displayName)}, ${integer(messageId)},
  ${isEncrypted ? "TRUE" : "FALSE"}, 0
);
`);

    await this.endPatientPortalSession(login.sessionId);

    return {
      id: String(messageId),
      date: messageDate,
      title,
      body: isEncrypted ? protectedPatientPortalMessageBody : body,
      status: "New",
      assignedTo: login.portalUsername,
      senderId,
      senderName,
      recipientId: login.portalUsername,
      recipientName: login.displayName,
      mailChain: messageId,
      replyMailChain: messageId,
      portalRelation: "portal:inbox-setup",
      isEncrypted
    };
  }

  async readPatientPortalMessage(
    username: string,
    password: string,
    messageId: string
  ): Promise<PatientPortalReadMessageResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return {
        authenticated: false,
        markedRead: false,
        username,
        portalUsername: "",
        canonicalId: "",
        pid: null,
        pubpid: "",
        displayName: "",
        messageId,
        message: null,
        messageCount: 0,
        sentMessageCount: 0,
        failureReason: login.failureReason ?? "Patient portal sign-in was rejected.",
        sessionSource: "modernized-openemr-portal"
      };
    }

    try {
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/messages/${messageId}/read`, {
        method: "PUT",
        headers: { "X-OpenEMR-Patient-Portal-Session": login.sessionId }
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal message read-status update failed with ${response.status}: ${await response.text()}`);
      }

      return mapPatientPortalReadMessageResult(await response.json(), username, messageId);
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async deletePatientPortalMessage(
    username: string,
    password: string,
    messageId: string
  ): Promise<PatientPortalDeleteMessageResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return {
        authenticated: false,
        deleted: false,
        username,
        portalUsername: "",
        canonicalId: "",
        pid: null,
        pubpid: "",
        displayName: "",
        messageId,
        deletedMessage: null,
        deletedMessageCount: 0,
        messageCount: 0,
        sentMessageCount: 0,
        failureReason: login.failureReason ?? "Patient portal sign-in was rejected.",
        sessionSource: "modernized-openemr-portal"
      };
    }

    try {
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/messages/${messageId}`, {
        method: "DELETE",
        headers: { "X-OpenEMR-Patient-Portal-Session": login.sessionId }
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal message archive failed with ${response.status}: ${await response.text()}`);
      }

      return mapPatientPortalDeleteMessageResult(await response.json(), username, messageId);
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async archivePatientPortalMessages(
    username: string,
    password: string,
    messageIds: string[]
  ): Promise<PatientPortalArchiveMessagesResult> {
    const requestedMessageIds = Array.from(
      new Set(messageIds.map((messageId) => Number(messageId)).filter((messageId) => Number.isInteger(messageId) && messageId > 0))
    );
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return {
        authenticated: false,
        archived: false,
        username,
        portalUsername: "",
        canonicalId: "",
        pid: null,
        pubpid: "",
        displayName: "",
        messageIds: requestedMessageIds.map(String),
        archivedMessages: [],
        archivedMessageCount: 0,
        messageCount: 0,
        sentMessageCount: 0,
        failureReason: login.failureReason ?? "Patient portal sign-in was rejected.",
        sessionSource: "modernized-openemr-portal"
      };
    }

    try {
      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/messages/archive`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-OpenEMR-Patient-Portal-Session": login.sessionId
        },
        body: JSON.stringify({ messageIds: requestedMessageIds })
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal selected message archive failed with ${response.status}: ${await response.text()}`);
      }

      return mapPatientPortalArchiveMessagesResult(await response.json(), username, requestedMessageIds.map(String));
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async replyToPatientPortalMessage(
    username: string,
    password: string,
    messageId: string,
    input: PatientPortalReplyMessageInput
  ): Promise<PatientPortalReplyMessageResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return {
        authenticated: false,
        created: false,
        username,
        portalUsername: "",
        canonicalId: "",
        pid: null,
        pubpid: "",
        displayName: "",
        originalMessageId: messageId,
        originalMessage: null,
        sentMessage: null,
        recipientMessage: null,
        messageCount: 0,
        sentMessageCount: 0,
        failureReason: login.failureReason ?? "Patient portal sign-in was rejected.",
        sessionSource: "modernized-openemr-portal"
      };
    }

    try {
      const messages = await this.getPatientPortalMessages(username, password);
      const originalMessage = messages.messages.find((message) => message.id === messageId) ?? null;
      if (originalMessage) {
        await this.cleanupPatientPortalMessageReply(login.portalUsername, originalMessage.title, input.body);
      }

      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/messages/${messageId}/reply`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-OpenEMR-Patient-Portal-Session": login.sessionId
        },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal message reply failed with ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      return {
        authenticated: Boolean(result.authenticated),
        created: Boolean(result.created),
        username: result.username ?? username,
        portalUsername: result.portalUsername ?? "",
        canonicalId: result.canonicalId ?? "",
        pid: result.legacyPid ?? null,
        pubpid: result.pubpid ?? "",
        displayName: result.displayName ?? "",
        originalMessageId: result.originalMessageId ?? messageId,
        originalMessage: result.originalMessage ? mapPatientPortalMessageItem(result.originalMessage, result.portalUsername) : null,
        sentMessage: result.sentMessage ? mapPatientPortalMessageItem(result.sentMessage, result.portalUsername) : null,
        recipientMessage: result.recipientMessage ? mapPatientPortalMessageItem(result.recipientMessage, result.portalUsername) : null,
        messageCount: result.messageCount ?? 0,
        sentMessageCount: result.sentMessageCount ?? 0,
        failureReason: result.failureReason ?? null,
        sessionSource: result.sessionSource ?? "modernized-openemr-portal"
      };
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async forwardPatientPortalMessage(
    username: string,
    password: string,
    messageId: string,
    input: PatientPortalForwardMessageInput
  ): Promise<PatientPortalForwardMessageResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || !login.sessionId) {
      return {
        authenticated: false,
        forwarded: false,
        username,
        portalUsername: "",
        canonicalId: "",
        pid: null,
        pubpid: "",
        displayName: "",
        originalMessageId: messageId,
        originalMessage: null,
        forwardedPatientMessage: null,
        messageCount: 0,
        sentMessageCount: 0,
        failureReason: login.failureReason ?? "Patient portal sign-in was rejected.",
        sessionSource: "modernized-openemr-portal"
      };
    }

    try {
      const messages = await this.getPatientPortalMessages(username, password);
      const originalMessage = messages.messages.find((message) => message.id === messageId) ?? null;
      if (originalMessage && login.pid !== null) {
        await this.cleanupPatientPortalForwardedMessage(login.pid, originalMessage.title, input.body);
      }

      const response = await fetch(`${this.target.apiBaseUrl}/api/patient-portal/messages/${messageId}/forward`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-OpenEMR-Patient-Portal-Session": login.sessionId
        },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        throw new Error(`Modernized patient portal message forward failed with ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      const forwardedId = result.forwardedPatientMessage?.id;
      const forwardedPatientMessage = forwardedId ? await this.getPatientMessage(forwardedId) : null;
      return {
        authenticated: Boolean(result.authenticated),
        forwarded: Boolean(result.forwarded),
        username: result.username ?? username,
        portalUsername: result.portalUsername ?? "",
        canonicalId: result.canonicalId ?? "",
        pid: result.legacyPid ?? null,
        pubpid: result.pubpid ?? "",
        displayName: result.displayName ?? "",
        originalMessageId: result.originalMessageId ?? messageId,
        originalMessage: result.originalMessage ? mapPatientPortalMessageItem(result.originalMessage, result.portalUsername) : null,
        forwardedPatientMessage,
        messageCount: result.messageCount ?? 0,
        sentMessageCount: result.sentMessageCount ?? 0,
        failureReason: result.failureReason ?? null,
        sessionSource: result.sessionSource ?? "modernized-openemr-portal"
      };
    } finally {
      await this.endPatientPortalSession(login.sessionId);
    }
  }

  async cleanupPatientPortalMessageReply(portalUsername: string, title: string, body: string): Promise<void> {
    await this.db.execute(`
DELETE FROM portal_mailbox_messages
WHERE title = ${sqlString(title)}
  AND body = ${sqlString(body)}
  AND (owner = ${sqlString(portalUsername)}
    OR sender_id = ${sqlString(portalUsername)}
    OR recipient_id = ${sqlString(portalUsername)});
`);
  }

  async cleanupPatientPortalForwardedMessage(pid: number, title: string, body: string): Promise<void> {
    await this.db.execute(`
DELETE FROM messages
WHERE pid = ${integer(pid)}
  AND title = ${sqlString(title)}
  AND body = ${sqlString(body.trim())};
`);
  }

  async getPatientGuardianContact(pid: number): Promise<PatientGuardianContact | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT legacy_pid AS pid, pubpid,
  COALESCE(mother_name, '') AS "motherName",
  COALESCE(guardian_name, '') AS "guardianName",
  COALESCE(guardian_relationship, '') AS "guardianRelationship",
  COALESCE(guardian_phone, '') AS "guardianPhone",
  COALESCE(guardian_email, '') AS "guardianEmail",
  COALESCE(guardian_sex, '') AS "guardianSex",
  COALESCE(guardian_address, '') AS "guardianAddress",
  COALESCE(guardian_city, '') AS "guardianCity",
  COALESCE(guardian_state, '') AS "guardianState",
  COALESCE(guardian_postal_code, '') AS "guardianPostalCode",
  COALESCE(guardian_country, '') AS "guardianCountry",
  COALESCE(guardian_work_phone, '') AS "guardianWorkPhone"
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
      motherName: row.motherName,
      guardianName: row.guardianName,
      guardianRelationship: row.guardianRelationship,
      guardianPhone: row.guardianPhone,
      guardianEmail: row.guardianEmail,
      guardianSex: row.guardianSex,
      guardianAddress: row.guardianAddress,
      guardianCity: row.guardianCity,
      guardianState: row.guardianState,
      guardianPostalCode: row.guardianPostalCode,
      guardianCountry: row.guardianCountry,
      guardianWorkPhone: row.guardianWorkPhone
    };
  }

  async updatePatientGuardianContact(contact: PatientGuardianContact): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patients/${encodeURIComponent(contact.pubpid)}/guardian-contact`, {
      method: "PUT",
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({
        motherName: contact.motherName,
        guardianName: contact.guardianName,
        guardianRelationship: contact.guardianRelationship,
        guardianPhone: contact.guardianPhone,
        guardianEmail: contact.guardianEmail,
        guardianSex: contact.guardianSex,
        guardianAddress: contact.guardianAddress,
        guardianCity: contact.guardianCity,
        guardianState: contact.guardianState,
        guardianPostalCode: contact.guardianPostalCode,
        guardianCountry: contact.guardianCountry,
        guardianWorkPhone: contact.guardianWorkPhone
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient guardian contact update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async getPatientEmployer(pid: number): Promise<PatientEmployer | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT p.legacy_pid AS pid, p.pubpid,
  COALESCE(pe.name, '') AS "employerName",
  COALESCE(pe.street, '') AS "employerStreet",
  COALESCE(pe.city, '') AS "employerCity",
  COALESCE(pe.state, '') AS "employerState",
  COALESCE(pe.postal_code, '') AS "employerPostalCode",
  COALESCE(pe.country, '') AS "employerCountry"
FROM patients p
LEFT JOIN patient_employers pe ON pe.patient_id = p.canonical_id
WHERE p.legacy_pid = ${integer(pid)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      pid: Number(row.pid),
      pubpid: row.pubpid,
      employerName: row.employerName,
      employerStreet: row.employerStreet,
      employerCity: row.employerCity,
      employerState: row.employerState,
      employerPostalCode: row.employerPostalCode,
      employerCountry: row.employerCountry
    };
  }

  async updatePatientEmployer(employer: PatientEmployer): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patients/${encodeURIComponent(employer.pubpid)}/employer`, {
      method: "PUT",
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({
        employerName: employer.employerName,
        employerStreet: employer.employerStreet,
        employerCity: employer.employerCity,
        employerState: employer.employerState,
        employerPostalCode: employer.employerPostalCode,
        employerCountry: employer.employerCountry
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient employer update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async getPatientProviderAssignment(pid: number): Promise<PatientProviderAssignment | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT p.legacy_pid AS pid, p.pubpid,
  COALESCE(p.provider_id::text, '') AS "providerId",
  COALESCE(trim(concat(s.first_name, ' ', s.last_name)), '') AS "providerName"
FROM patients p
LEFT JOIN staff s ON s.id = p.provider_id
WHERE p.legacy_pid = ${integer(pid)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      pid: Number(row.pid),
      pubpid: row.pubpid,
      providerId: row.providerId === "" ? null : Number(row.providerId),
      providerName: row.providerName
    };
  }

  async updatePatientProviderAssignment(assignment: PatientProviderAssignment): Promise<void> {
    const response = await fetch(
      `${this.target.apiBaseUrl}/api/patients/${encodeURIComponent(assignment.pubpid)}/provider-assignment`,
      {
        method: "PUT",
        headers: await this.getAdminJsonHeaders(),
        body: JSON.stringify({
          providerId: assignment.providerId
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Modernized patient provider assignment update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async getPatientCareTeamAssignment(pid: number): Promise<PatientCareTeamAssignment | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT p.legacy_pid AS pid, p.pubpid,
  COALESCE(ct.team_name, '') AS "teamName",
  COALESCE(ct.team_status, '') AS "teamStatus",
  COALESCE(ctm.user_id::text, '') AS "userId",
  COALESCE(ctm.contact_id::text, '') AS "contactId",
  COALESCE(NULLIF(trim(concat(s.first_name, ' ', s.last_name)), ''), prc.display_name, '') AS "memberName",
  COALESCE(ctm.role, '') AS "role",
  COALESCE(ctm.facility_id::text, '') AS "facilityId",
  COALESCE(f.name, '') AS "facilityName",
  COALESCE(ctm.provider_since::text, '') AS "providerSince",
  COALESCE(ctm.status, '') AS "memberStatus",
  COALESCE(ctm.note, '') AS "note"
FROM patients p
LEFT JOIN patient_care_teams ct ON ct.patient_id = p.canonical_id
LEFT JOIN patient_care_team_members ctm ON ctm.patient_id = ct.patient_id
LEFT JOIN staff s ON s.id = ctm.user_id
LEFT JOIN patient_related_contacts prc ON prc.contact_id = ctm.contact_id
LEFT JOIN facilities f ON f.id = ctm.facility_id
WHERE p.legacy_pid = ${integer(pid)}
ORDER BY ctm.id DESC
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    const role = row.role;
    const memberStatus = row.memberStatus;
    const teamStatus = row.teamStatus;
    return {
      pid: Number(row.pid),
      pubpid: row.pubpid,
      teamName: row.teamName,
      teamStatus,
      teamStatusDisplay: careTeamStatusLabel(teamStatus),
      userId: row.userId === "" ? null : Number(row.userId),
      memberName: row.memberName,
      role,
      roleDisplay: careTeamRoleLabel(role),
      facilityId: row.facilityId === "" ? null : Number(row.facilityId),
      facilityName: row.facilityName,
      providerSince: row.providerSince,
      memberStatus,
      memberStatusDisplay: careTeamStatusLabel(memberStatus),
      note: row.note
    };
  }

  async updatePatientCareTeamAssignment(assignment: PatientCareTeamAssignment): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patients/${encodeURIComponent(assignment.pubpid)}/care-team`, {
      method: "PUT",
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({
        teamName: assignment.teamName,
        teamStatus: assignment.teamStatus,
        userId: assignment.userId,
        role: assignment.role,
        facilityId: assignment.facilityId,
        providerSince: assignment.providerSince,
        status: assignment.memberStatus,
        note: assignment.note
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient care team update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async getPatientCareTeamMembersAssignment(pid: number): Promise<PatientCareTeamMembersAssignment | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT p.legacy_pid AS pid, p.pubpid,
  COALESCE(ct.team_name, '') AS "teamName",
  COALESCE(ct.team_status, '') AS "teamStatus",
  COALESCE(ctm.user_id::text, '') AS "userId",
  COALESCE(ctm.contact_id::text, '') AS "contactId",
  COALESCE(NULLIF(trim(concat(s.first_name, ' ', s.last_name)), ''), prc.display_name, '') AS "memberName",
  COALESCE(ctm.role, '') AS "role",
  COALESCE(ctm.facility_id::text, '') AS "facilityId",
  COALESCE(f.name, '') AS "facilityName",
  COALESCE(ctm.provider_since::text, '') AS "providerSince",
  COALESCE(ctm.status, '') AS "memberStatus",
  COALESCE(ctm.note, '') AS "note"
FROM patients p
LEFT JOIN patient_care_teams ct ON ct.patient_id = p.canonical_id
LEFT JOIN patient_care_team_members ctm ON ctm.patient_id = ct.patient_id
LEFT JOIN staff s ON s.id = ctm.user_id
LEFT JOIN patient_related_contacts prc ON prc.contact_id = ctm.contact_id
LEFT JOIN facilities f ON f.id = ctm.facility_id
WHERE p.legacy_pid = ${integer(pid)}
ORDER BY ctm.id ASC;
`);
    const first = rows[0];
    if (!first) {
      return null;
    }

    const teamStatus = first.teamStatus;
    return {
      pid: Number(first.pid),
      pubpid: first.pubpid,
      teamName: first.teamName,
      teamStatus,
      teamStatusDisplay: careTeamStatusLabel(teamStatus),
      members: rows
        .filter((row) => row.userId !== "" || row.contactId !== "")
        .map((row) => {
          const role = row.role;
          const memberStatus = row.memberStatus;
          const contactId = row.contactId === "" ? null : Number(row.contactId);
          return {
            userId: row.userId === "" ? null : Number(row.userId),
            ...(contactId === null ? {} : { contactId, memberType: "contact" as const }),
            memberName: row.memberName,
            role,
            roleDisplay: careTeamRoleLabel(role),
            facilityId: row.facilityId === "" ? null : Number(row.facilityId),
            facilityName: row.facilityName,
            providerSince: row.providerSince,
            memberStatus,
            memberStatusDisplay: careTeamStatusLabel(memberStatus),
            note: row.note
          };
        })
    };
  }

  async updatePatientCareTeamMembersAssignment(assignment: PatientCareTeamMembersAssignment): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patients/${encodeURIComponent(assignment.pubpid)}/care-team`, {
      method: "PUT",
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({
        teamName: assignment.teamName,
        teamStatus: assignment.teamStatus,
        members: assignment.members.map((member) => ({
          userId: member.userId,
          contactId: member.contactId ?? null,
          role: member.role,
          facilityId: member.facilityId,
          providerSince: member.providerSince,
          status: member.memberStatus,
          note: member.note
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient care team members update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createPatient(input: NewPatientRegistration): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patients`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
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
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized temporary patient delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createPatientInsurance(input: NewPatientInsurance): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patients/${encodeURIComponent(String(input.patientId))}/insurance`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({
        type: input.type,
        provider: input.provider,
        planName: input.planName,
        policyNumber: input.policyNumber,
        groupNumber: input.groupNumber,
        relationship: input.relationship,
        subscriberFirstName: input.subscriberFirstName ?? "",
        subscriberMiddleName: input.subscriberMiddleName ?? "",
        subscriberLastName: input.subscriberLastName ?? "",
        subscriberDateOfBirth: input.subscriberDateOfBirth ?? "",
        subscriberSex: input.subscriberSex ?? "",
        subscriberStreet: input.subscriberStreet ?? "",
        subscriberStreetLine2: input.subscriberStreetLine2 ?? "",
        subscriberCity: input.subscriberCity ?? "",
        subscriberState: input.subscriberState ?? "",
        subscriberPostalCode: input.subscriberPostalCode ?? "",
        subscriberCountry: input.subscriberCountry ?? "",
        subscriberPhone: input.subscriberPhone ?? "",
        subscriberEmployer: input.subscriberEmployer ?? "",
        subscriberEmployerStreet: input.subscriberEmployerStreet ?? "",
        subscriberEmployerStreetLine2: input.subscriberEmployerStreetLine2 ?? "",
        subscriberEmployerCity: input.subscriberEmployerCity ?? "",
        subscriberEmployerState: input.subscriberEmployerState ?? "",
        subscriberEmployerPostalCode: input.subscriberEmployerPostalCode ?? "",
        subscriberEmployerCountry: input.subscriberEmployerCountry ?? ""
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
  COALESCE(relationship, '') AS relationship,
  COALESCE(subscriber_first_name, '') AS "subscriberFirstName",
  COALESCE(subscriber_middle_name, '') AS "subscriberMiddleName",
  COALESCE(subscriber_last_name, '') AS "subscriberLastName",
  COALESCE(to_char(subscriber_date_of_birth, 'YYYY-MM-DD'), '') AS "subscriberDateOfBirth",
  COALESCE(subscriber_sex, '') AS "subscriberSex",
  COALESCE(subscriber_street, '') AS "subscriberStreet",
  COALESCE(subscriber_street_line_2, '') AS "subscriberStreetLine2",
  COALESCE(subscriber_city, '') AS "subscriberCity",
  COALESCE(subscriber_state, '') AS "subscriberState",
  COALESCE(subscriber_postal_code, '') AS "subscriberPostalCode",
  COALESCE(subscriber_country, '') AS "subscriberCountry",
  COALESCE(subscriber_phone, '') AS "subscriberPhone",
  COALESCE(subscriber_employer, '') AS "subscriberEmployer",
  COALESCE(subscriber_employer_street, '') AS "subscriberEmployerStreet",
  COALESCE(subscriber_employer_street_line_2, '') AS "subscriberEmployerStreetLine2",
  COALESCE(subscriber_employer_city, '') AS "subscriberEmployerCity",
  COALESCE(subscriber_employer_state, '') AS "subscriberEmployerState",
  COALESCE(subscriber_employer_postal_code, '') AS "subscriberEmployerPostalCode",
  COALESCE(subscriber_employer_country, '') AS "subscriberEmployerCountry"
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
      relationship: row.relationship,
      subscriberFirstName: row.subscriberFirstName,
      subscriberMiddleName: row.subscriberMiddleName,
      subscriberLastName: row.subscriberLastName,
      subscriberDateOfBirth: row.subscriberDateOfBirth,
      subscriberSex: row.subscriberSex,
      subscriberStreet: row.subscriberStreet,
      subscriberStreetLine2: row.subscriberStreetLine2,
      subscriberCity: row.subscriberCity,
      subscriberState: row.subscriberState,
      subscriberPostalCode: row.subscriberPostalCode,
      subscriberCountry: row.subscriberCountry,
      subscriberPhone: row.subscriberPhone,
      subscriberEmployer: row.subscriberEmployer,
      subscriberEmployerStreet: row.subscriberEmployerStreet,
      subscriberEmployerStreetLine2: row.subscriberEmployerStreetLine2,
      subscriberEmployerCity: row.subscriberEmployerCity,
      subscriberEmployerState: row.subscriberEmployerState,
      subscriberEmployerPostalCode: row.subscriberEmployerPostalCode,
      subscriberEmployerCountry: row.subscriberEmployerCountry
    } : null;
  }

  async updatePatientInsurance(id: number | string, input: NewPatientInsurance): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patients/insurance/${encodeURIComponent(String(id))}`, {
      method: "PUT",
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({
        type: input.type,
        provider: input.provider,
        planName: input.planName,
        policyNumber: input.policyNumber,
        groupNumber: input.groupNumber,
        relationship: input.relationship,
        subscriberFirstName: input.subscriberFirstName ?? "",
        subscriberMiddleName: input.subscriberMiddleName ?? "",
        subscriberLastName: input.subscriberLastName ?? "",
        subscriberDateOfBirth: input.subscriberDateOfBirth ?? "",
        subscriberSex: input.subscriberSex ?? "",
        subscriberStreet: input.subscriberStreet ?? "",
        subscriberStreetLine2: input.subscriberStreetLine2 ?? "",
        subscriberCity: input.subscriberCity ?? "",
        subscriberState: input.subscriberState ?? "",
        subscriberPostalCode: input.subscriberPostalCode ?? "",
        subscriberCountry: input.subscriberCountry ?? "",
        subscriberPhone: input.subscriberPhone ?? "",
        subscriberEmployer: input.subscriberEmployer ?? "",
        subscriberEmployerStreet: input.subscriberEmployerStreet ?? "",
        subscriberEmployerStreetLine2: input.subscriberEmployerStreetLine2 ?? "",
        subscriberEmployerCity: input.subscriberEmployerCity ?? "",
        subscriberEmployerState: input.subscriberEmployerState ?? "",
        subscriberEmployerPostalCode: input.subscriberEmployerPostalCode ?? "",
        subscriberEmployerCountry: input.subscriberEmployerCountry ?? ""
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient insurance update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deletePatientInsurance(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patients/insurance/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized patient insurance delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createAppointment(input: NewAppointment): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/appointments`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
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
    const response = await fetch(`${this.target.apiBaseUrl}/api/appointments?${params.toString()}`, {
      headers: await this.getAdminSessionHeaders()
    });
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
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({ status, title })
    });

    if (!response.ok) {
      throw new Error(`Modernized appointment status update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async updateAppointment(id: number | string, input: AppointmentUpdate): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/appointments/${encodeURIComponent(String(id))}`, {
      method: "PUT",
      headers: await this.getAdminJsonHeaders(),
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
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok) {
      throw new Error(`Modernized appointment delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async addAppointmentRecurrenceException(id: number | string, occurrenceDate: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/appointments/${encodeURIComponent(`${String(id)}::occurs::${occurrenceDate}`)}`, {
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok) {
      throw new Error(`Modernized appointment occurrence delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async restoreAppointmentRecurrenceException(id: number | string, occurrenceDate: string): Promise<void> {
    const response = await fetch(
      `${this.target.apiBaseUrl}/api/appointments/${encodeURIComponent(String(id))}/recurrence-exceptions/${encodeURIComponent(occurrenceDate)}/restore`,
      {
        method: "POST",
        headers: await this.getAdminSessionHeaders()
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
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({ comments })
    });

    if (!response.ok) {
      throw new Error(`Modernized clinical allergy deactivate failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteClinicalListEntry(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/allergies/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok) {
      throw new Error(`Modernized clinical allergy delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createProblem(input: NewProblem): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/problems`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({ comments })
    });

    if (!response.ok) {
      throw new Error(`Modernized clinical problem deactivate failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteProblem(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/problems/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok) {
      throw new Error(`Modernized clinical problem delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createMedication(input: NewMedication): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/medications`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({ comments })
    });

    if (!response.ok) {
      throw new Error(`Modernized clinical medication deactivate failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteMedication(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/medications/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok) {
      throw new Error(`Modernized clinical medication delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createPatientMessage(input: NewPatientMessage): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/messages`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
  COALESCE(portal_relation, '') AS "portalRelation",
  CASE WHEN is_encrypted THEN '1' ELSE '0' END AS "isEncrypted",
  COALESCE(updated_by::text, '') AS "updatedBy",
  COALESCE(to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS'), '') AS "updatedAt",
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
      portalRelation: row.portalRelation,
      isEncrypted: row.isEncrypted === "1",
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
      deleted: Number(row.deleted)
    };
  }

  async updatePatientMessageStatus(id: number | string, status: string, body: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/messages/${encodeURIComponent(String(id))}/status`, {
      method: "PUT",
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({ status, body })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient message update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async updatePatientMessageContent(id: number | string, title: string, body: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/messages/${encodeURIComponent(String(id))}/content`, {
      method: "PUT",
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({ title, body })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient message content update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async updatePatientMessageAssignment(id: number | string, assignedTo: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/messages/${encodeURIComponent(String(id))}/assignment`, {
      method: "PUT",
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({ assignedTo })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient message assignment update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async replyPatientMessage(id: number | string, body: string, assignedTo: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/messages/${encodeURIComponent(String(id))}/reply`, {
      method: "PUT",
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({ body, assignedTo })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient message reply failed with ${response.status}: ${await response.text()}`);
    }
  }

  async softDeletePatientMessage(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/messages/${encodeURIComponent(String(id))}/soft-delete`, {
      method: "PUT",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok) {
      throw new Error(`Modernized patient message soft delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deletePatientMessage(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/messages/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok) {
      throw new Error(`Modernized patient message delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createPatientDocument(input: NewPatientDocument): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/documents`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
        headers: await this.getAdminJsonHeaders(),
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
        headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
        headers: await this.getAdminJsonHeaders(),
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
        headers: await this.getAdminJsonHeaders(),
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
        headers: await this.getAdminJsonHeaders(),
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
        method: "PUT",
        headers: await this.getAdminSessionHeaders()
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
        method: "PUT",
        headers: await this.getAdminSessionHeaders()
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
        headers: await this.getAdminJsonHeaders(),
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
        headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({ reviewStatus, reviewedBy })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient document ${actionName} failed with ${response.status}: ${await response.text()}`);
    }
  }

  async softDeletePatientDocument(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/documents/${encodeURIComponent(String(id))}/soft-delete`, {
      method: "PUT",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok) {
      throw new Error(`Modernized patient document soft delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async restorePatientDocument(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/documents/${encodeURIComponent(String(id))}/restore`, {
      method: "PUT",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok) {
      throw new Error(`Modernized patient document restore failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deletePatientDocument(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/documents/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized patient document delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createPrescription(input: NewPrescription): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/prescriptions`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({ endDate, note })
    });

    if (!response.ok) {
      throw new Error(`Modernized prescription deactivate failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deletePrescription(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/prescriptions/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok) {
      throw new Error(`Modernized prescription delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createImmunization(input: NewImmunization): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/immunizations`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
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
        headers: await this.getAdminJsonHeaders(),
        body: JSON.stringify({ note })
      }
    );

    if (!response.ok) {
      throw new Error(`Modernized immunization entered-in-error update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteImmunization(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/immunizations/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok) {
      throw new Error(`Modernized immunization delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createBillingLine(input: NewBillingLine): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/billing/lines`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({ billed, activity })
    });

    if (!response.ok) {
      throw new Error(`Modernized billing line status update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteBillingLine(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/billing/lines/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok) {
      throw new Error(`Modernized billing line delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createClaimStatus(input: NewClaimStatus): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/billing/claims`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized claim status delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createPaymentPosting(input: NewPaymentPosting): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/billing/payments`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
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
      method: "PUT",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok) {
      throw new Error(`Modernized payment posting void failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deletePaymentPosting(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/billing/payments/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized payment posting delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createProcedureOrder(input: NewProcedureOrder): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/orders`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
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
      headers: await this.getAdminJsonHeaders(),
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
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized procedure lab provider address book delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createProcedureOrderCatalogItem(input: NewProcedureOrderCatalogItem): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/order-catalog`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
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
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure order status update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async transmitProcedureOrder(id: number, transmittedAt: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/orders/${encodeURIComponent(String(id))}/transmit`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({ transmittedAt })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure order transmit failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createProcedureReport(input: NewProcedureReport): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/reports`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
      body: JSON.stringify({
        reviewedBy: input.reviewedBy,
        reviewedAt: input.reviewedAt
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure report sign-off failed with ${response.status}: ${await response.text()}`);
    }
  }

  async reopenProcedureReportReview(id: number): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/reports/${encodeURIComponent(String(id))}/reopen-review`, {
      method: "PUT",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure report review reopen failed with ${response.status}: ${await response.text()}`);
    }
  }

  async bulkSignProcedureReports(ids: number[], input: ProcedureReportSignOff): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/reports/bulk-sign`, {
      method: "PUT",
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized procedure order delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createEncounter(input: NewEncounter): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
      headers: await this.getAdminJsonHeaders(),
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
        method: "DELETE",
        headers: await this.getAdminSessionHeaders()
      }
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized encounter signature delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteEncounter(id: number): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok) {
      throw new Error(`Modernized encounter delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createVitals(input: NewVitals): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(input.encounter))}/vitals`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
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
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
    });

    if (!response.ok) {
      throw new Error(`Modernized encounter vitals delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createSoapNote(input: NewSoapNote): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(input.encounter))}/soap-notes`, {
      method: "POST",
      headers: await this.getAdminJsonHeaders(),
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
      method: "DELETE",
      headers: await this.getAdminSessionHeaders()
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

function buildEmptyModernizedPortalProfileResult(username: string, failureReason: string): PatientPortalProfileResult {
  return {
    authenticated: false,
    username,
    portalUsername: "",
    canonicalId: "",
    pid: null,
    pubpid: "",
    displayName: "",
    datasetVersion: "unknown",
    asOfDate: new Date().toISOString().slice(0, 10),
    hasPendingProfileChanges: false,
    demographics: {
      firstName: "",
      lastName: "",
      preferredName: null,
      dateOfBirth: null,
      sex: null,
      email: null,
      street: null,
      city: null,
      state: null,
      postalCode: null,
      phoneHome: null,
      phoneCell: null,
      phoneContact: null,
      contactRelationship: null,
      motherName: null,
      guardianName: null,
      guardianRelationship: null,
      guardianPhone: null,
      guardianEmail: null
    },
    insuranceCount: 0,
    insurance: [],
    pendingChange: null,
    failureReason,
    sessionSource: "modernized-openemr-portal"
  };
}

function mapPatientPortalSessionResult(result: any): PatientPortalSessionResult {
  return {
    authenticated: Boolean(result.authenticated),
    sessionId: result.sessionId ?? null,
    username: result.username ?? "",
    portalUsername: result.portalUsername ?? "",
    canonicalId: result.canonicalId ?? "",
    pid: result.legacyPid ?? null,
    pubpid: result.pubpid ?? "",
    displayName: result.displayName ?? "",
    createdAt: result.createdAt ?? null,
    lastSeenAt: result.lastSeenAt ?? null,
    expiresAt: result.expiresAt ?? null,
    endedAt: result.endedAt ?? null,
    failureReason: result.failureReason ?? null,
    sessionSource: result.sessionSource ?? ""
  };
}

function mapPatientPortalHomeSummary(result: any): PatientPortalHomeSummary {
  return {
    authenticated: Boolean(result.authenticated),
    username: result.username ?? "",
    portalUsername: result.portalUsername ?? "",
    canonicalId: result.canonicalId ?? "",
    pid: result.legacyPid ?? null,
    pubpid: result.pubpid ?? "",
    displayName: result.displayName ?? "",
    datasetVersion: result.datasetVersion ?? "",
    asOfDate: result.asOfDate ?? "",
    messages: {
      totalMessages: result.messages?.totalMessages ?? 0,
      newMessages: result.messages?.newMessages ?? 0,
      doneMessages: result.messages?.doneMessages ?? 0,
      latestMessageTitle: result.messages?.latestMessageTitle ?? null,
      latestMessageDate: result.messages?.latestMessageDate ?? null
    },
    upcomingAppointmentCount: result.upcomingAppointmentCount ?? 0,
    upcomingAppointments: (result.upcomingAppointments ?? []).map(mapPatientPortalAppointmentItem),
    immunizationCount: result.immunizationCount ?? 0,
    immunizations: (result.immunizations ?? []).map(mapPatientPortalHomeImmunizationItem),
    failureReason: result.failureReason ?? null,
    sessionSource: result.sessionSource ?? ""
  };
}

function mapPatientPortalProfileResult(result: any): PatientPortalProfileResult {
  return {
    authenticated: Boolean(result.authenticated),
    username: result.username ?? "",
    portalUsername: result.portalUsername ?? "",
    canonicalId: result.canonicalId ?? "",
    pid: result.legacyPid ?? null,
    pubpid: result.pubpid ?? "",
    displayName: result.displayName ?? "",
    datasetVersion: result.datasetVersion ?? "",
    asOfDate: result.asOfDate ?? "",
    hasPendingProfileChanges: Boolean(result.hasPendingProfileChanges),
    demographics: {
      firstName: result.demographics?.firstName ?? "",
      lastName: result.demographics?.lastName ?? "",
      preferredName: result.demographics?.preferredName ?? null,
      dateOfBirth: result.demographics?.dateOfBirth ?? null,
      sex: result.demographics?.sex ?? null,
      email: result.demographics?.email ?? null,
      street: result.demographics?.street ?? null,
      city: result.demographics?.city ?? null,
      state: result.demographics?.state ?? null,
      postalCode: result.demographics?.postalCode ?? null,
      phoneHome: result.demographics?.phoneHome ?? null,
      phoneCell: result.demographics?.phoneCell ?? null,
      phoneContact: result.demographics?.phoneContact ?? null,
      contactRelationship: result.demographics?.contactRelationship ?? null,
      motherName: result.demographics?.motherName ?? null,
      guardianName: result.demographics?.guardianName ?? null,
      guardianRelationship: result.demographics?.guardianRelationship ?? null,
      guardianPhone: result.demographics?.guardianPhone ?? null,
      guardianEmail: result.demographics?.guardianEmail ?? null
    },
    insuranceCount: result.insuranceCount ?? 0,
    insurance: (result.insurance ?? []).map((insurance: any) => ({
      type: insurance.type ?? "",
      provider: insurance.provider ?? null,
      planName: insurance.planName ?? null,
      policyNumber: insurance.policyNumber ?? null,
      groupNumber: insurance.groupNumber ?? null,
      subscriberFirstName: insurance.subscriberFirstName ?? null,
      subscriberLastName: insurance.subscriberLastName ?? null,
      subscriberName: insurance.subscriberName ?? null,
      subscriberRelationship: insurance.subscriberRelationship ?? null,
      subscriberDateOfBirth: insurance.subscriberDateOfBirth ?? null
    })),
    pendingChange: result.pendingChange
      ? {
          id: result.pendingChange.id ?? 0,
          status: result.pendingChange.status ?? "",
          pendingAction: result.pendingChange.pendingAction ?? "",
          narrative: result.pendingChange.narrative ?? "",
          requestedAt: result.pendingChange.requestedAt ?? "",
          updatedAt: result.pendingChange.updatedAt ?? null,
          demographics: {
            firstName: result.pendingChange.demographics?.firstName ?? "",
            lastName: result.pendingChange.demographics?.lastName ?? "",
            preferredName: result.pendingChange.demographics?.preferredName ?? null,
            dateOfBirth: result.pendingChange.demographics?.dateOfBirth ?? null,
            sex: result.pendingChange.demographics?.sex ?? null,
            email: result.pendingChange.demographics?.email ?? null,
            street: result.pendingChange.demographics?.street ?? null,
            city: result.pendingChange.demographics?.city ?? null,
            state: result.pendingChange.demographics?.state ?? null,
            postalCode: result.pendingChange.demographics?.postalCode ?? null,
            phoneHome: result.pendingChange.demographics?.phoneHome ?? null,
            phoneCell: result.pendingChange.demographics?.phoneCell ?? null,
            phoneContact: result.pendingChange.demographics?.phoneContact ?? null,
            contactRelationship: result.pendingChange.demographics?.contactRelationship ?? null,
            motherName: result.pendingChange.demographics?.motherName ?? null,
            guardianName: result.pendingChange.demographics?.guardianName ?? null,
            guardianRelationship: result.pendingChange.demographics?.guardianRelationship ?? null,
            guardianPhone: result.pendingChange.demographics?.guardianPhone ?? null,
            guardianEmail: result.pendingChange.demographics?.guardianEmail ?? null
          }
        }
      : null,
    failureReason: result.failureReason ?? null,
    sessionSource: result.sessionSource ?? ""
  };
}

function mapPatientPortalAppointmentsResult(result: any): PatientPortalAppointmentsResult {
  return {
    authenticated: Boolean(result.authenticated),
    username: result.username ?? "",
    portalUsername: result.portalUsername ?? "",
    canonicalId: result.canonicalId ?? "",
    pid: result.legacyPid ?? null,
    pubpid: result.pubpid ?? "",
    displayName: result.displayName ?? "",
    datasetVersion: result.datasetVersion ?? "",
    asOfDate: result.asOfDate ?? "",
    upcomingAppointmentCount: result.upcomingAppointmentCount ?? 0,
    upcomingAppointments: (result.upcomingAppointments ?? []).map(mapPatientPortalAppointmentItem),
    pastAppointmentCount: result.pastAppointmentCount ?? 0,
    pastAppointments: (result.pastAppointments ?? []).map(mapPatientPortalAppointmentItem),
    failureReason: result.failureReason ?? null,
    sessionSource: result.sessionSource ?? ""
  };
}

function mapPatientPortalClinicalSummaryResult(result: any): PatientPortalClinicalSummaryResult {
  return {
    authenticated: Boolean(result.authenticated),
    username: result.username ?? "",
    portalUsername: result.portalUsername ?? "",
    canonicalId: result.canonicalId ?? "",
    pid: result.legacyPid ?? null,
    pubpid: result.pubpid ?? "",
    displayName: result.displayName ?? "",
    datasetVersion: result.datasetVersion ?? "",
    asOfDate: result.asOfDate ?? "",
    problemCount: result.problemCount ?? 0,
    problems: (result.problems ?? []).map((problem: any) => ({
      id: problem.id ?? "",
      title: problem.title ?? "",
      reportedDate: problem.reportedDate ?? null,
      startDate: problem.startDate ?? null,
      endDate: problem.endDate ?? null
    })),
    allergyCount: result.allergyCount ?? 0,
    allergies: (result.allergies ?? []).map((allergy: any) => ({
      id: allergy.id ?? "",
      title: allergy.title ?? "",
      reportedDate: allergy.reportedDate ?? null,
      startDate: allergy.startDate ?? null,
      endDate: allergy.endDate ?? null,
      referredBy: allergy.referredBy ?? null,
      reaction: allergy.reaction ?? null,
      severity: allergy.severity ?? null
    })),
    medicationCount: result.medicationCount ?? 0,
    medications: (result.medications ?? []).map((medication: any) => ({
      id: medication.id ?? "",
      title: medication.title ?? "",
      startDate: medication.startDate ?? null,
      modifiedDate: medication.modifiedDate ?? null,
      endDate: medication.endDate ?? null
    })),
    prescriptionCount: result.prescriptionCount ?? 0,
    prescriptions: (result.prescriptions ?? []).map((prescription: any) => ({
      id: prescription.id ?? "",
      drug: prescription.drug ?? "",
      startDate: prescription.startDate ?? null,
      modifiedDate: prescription.modifiedDate ?? null,
      endDate: prescription.endDate ?? null,
      dosage: prescription.dosage ?? null,
      quantity: prescription.quantity ?? null,
      route: prescription.route ?? null,
      note: prescription.note ?? null
    })),
    failureReason: result.failureReason ?? null,
    sessionSource: result.sessionSource ?? ""
  };
}

function mapPatientPortalLabResultsResult(result: any): PatientPortalLabResultsResult {
  return {
    authenticated: Boolean(result.authenticated),
    username: result.username ?? "",
    portalUsername: result.portalUsername ?? "",
    canonicalId: result.canonicalId ?? "",
    pid: nullableNumber(result.legacyPid),
    pubpid: result.pubpid ?? "",
    displayName: result.displayName ?? "",
    datasetVersion: result.datasetVersion ?? "",
    asOfDate: result.asOfDate ?? "",
    orderCount: result.orderCount ?? 0,
    reportCount: result.reportCount ?? 0,
    resultCount: result.resultCount ?? 0,
    orders: (result.orders ?? []).map((order: any) => ({
      id: order.id ?? "",
      orderDate: order.orderDate ?? "",
      procedureCode: order.procedureCode ?? null,
      procedureName: order.procedureName ?? "",
      orderStatus: order.orderStatus ?? null,
      reportCount: order.reportCount ?? 0,
      resultCount: order.resultCount ?? 0,
      reports: (order.reports ?? []).map((report: any) => ({
        id: report.id ?? "",
        dateCollected: report.dateCollected ?? null,
        reportDate: report.reportDate ?? null,
        specimenNumber: report.specimenNumber ?? null,
        reportStatus: report.reportStatus ?? null,
        reviewStatus: report.reviewStatus ?? null,
        resultCount: report.resultCount ?? 0,
        results: (report.results ?? []).map((labResult: any) => ({
          id: labResult.id ?? "",
          resultCode: labResult.resultCode ?? null,
          resultName: labResult.resultName ?? "",
          abnormal: labResult.abnormal ?? null,
          value: labResult.value ?? null,
          range: labResult.range ?? null,
          units: labResult.units ?? null,
          resultStatus: labResult.resultStatus ?? null
        }))
      }))
    })),
    failureReason: result.failureReason ?? null,
    sessionSource: result.sessionSource ?? ""
  };
}

function mapPatientPortalMedicalReportResult(result: any): PatientPortalMedicalReportResult {
  return {
    authenticated: Boolean(result.authenticated),
    username: result.username ?? "",
    portalUsername: result.portalUsername ?? "",
    canonicalId: result.canonicalId ?? "",
    pid: nullableNumber(result.legacyPid),
    pubpid: result.pubpid ?? "",
    displayName: result.displayName ?? "",
    datasetVersion: result.datasetVersion ?? "",
    asOfDate: result.asOfDate ?? "",
    sectionCount: result.sectionCount ?? 0,
    selectedSectionCount: result.selectedSectionCount ?? 0,
    sections: (result.sections ?? []).map((section: any) => ({
      id: section.id ?? "",
      label: section.label ?? "",
      group: section.group ?? "",
      selected: Boolean(section.selected)
    })),
    issueCount: result.issueCount ?? 0,
    issues: (result.issues ?? []).map((issue: any) => ({
      id: issue.id ?? "",
      type: issue.type ?? "",
      typeLabel: issue.typeLabel ?? "",
      title: issue.title ?? "",
      beginDate: issue.beginDate ?? null,
      endDate: issue.endDate ?? null,
      status: issue.status ?? "",
      encounterIds: issue.encounterIds ?? []
    })),
    encounterCount: result.encounterCount ?? 0,
    encounters: (result.encounters ?? []).map((encounter: any) => ({
      encounter: encounter.encounter ?? 0,
      date: encounter.date ?? "",
      display: encounter.display ?? "",
      reason: encounter.reason ?? null,
      formCount: encounter.formCount ?? 0,
      forms: (encounter.forms ?? []).map((form: any) => ({
        id: form.id ?? "",
        formDirectory: form.formDirectory ?? "",
        display: form.display ?? "",
        encounter: form.encounter ?? 0
      }))
    })),
    procedureOrderCount: result.procedureOrderCount ?? 0,
    procedureOrders: (result.procedureOrders ?? []).map((order: any) => ({
      id: order.id ?? "",
      encounter: order.encounter ?? 0,
      orderDate: order.orderDate ?? "",
      encounterDate: order.encounterDate ?? null,
      procedureCode: order.procedureCode ?? null,
      procedureName: order.procedureName ?? "",
      diagnosis: order.diagnosis ?? null,
      orderStatus: order.orderStatus ?? null,
      reportCount: order.reportCount ?? 0,
      resultCount: order.resultCount ?? 0,
      resultNames: order.resultNames ?? []
    })),
    reportPreview: {
      title: result.reportPreview?.title ?? "",
      includedSectionIds: result.reportPreview?.includedSectionIds ?? [],
      includedProcedureOrderIds: result.reportPreview?.includedProcedureOrderIds ?? [],
      includedEncounterFormIds: result.reportPreview?.includedEncounterFormIds ?? [],
      templateMetadata: {
        facilityName: result.reportPreview?.templateMetadata?.facilityName ?? "",
        facilityStreet: result.reportPreview?.templateMetadata?.facilityStreet ?? "",
        facilityCityStatePostal: result.reportPreview?.templateMetadata?.facilityCityStatePostal ?? "",
        facilityPhone: result.reportPreview?.templateMetadata?.facilityPhone ?? "",
        printablePatientName: result.reportPreview?.templateMetadata?.printablePatientName ?? "",
        patientHeaderLine: result.reportPreview?.templateMetadata?.patientHeaderLine ?? "",
        generatedOnLabel: result.reportPreview?.templateMetadata?.generatedOnLabel ?? "",
        signatureLineAvailable: Boolean(result.reportPreview?.templateMetadata?.signatureLineAvailable)
      },
      packageMetadata: mapPatientPortalGeneratedMedicalReportPackageMetadata(result.reportPreview?.packageMetadata),
      summaryLineCount: result.reportPreview?.summaryLineCount ?? 0,
      summaryLines: result.reportPreview?.summaryLines ?? []
    },
    failureReason: result.failureReason ?? null,
    sessionSource: result.sessionSource ?? ""
  };
}

function buildEmptyPatientPortalGeneratedMedicalReportTemplateMetadata(): PatientPortalGeneratedMedicalReportTemplateMetadata {
  return {
    facilityName: "",
    facilityStreet: "",
    facilityCityStatePostal: "",
    facilityPhone: "",
    printablePatientName: "",
    patientHeaderLine: "",
    generatedOnLabel: "",
    signatureLineAvailable: false
  };
}

function buildEmptyPatientPortalGeneratedMedicalReportPackageMetadata(): PatientPortalGeneratedMedicalReportPackageMetadata {
  return {
    fileName: "",
    contentType: "",
    entryNames: [],
    manifestAvailable: false,
    pdfAvailable: false,
    summaryAvailable: false
  };
}

function mapPatientPortalGeneratedMedicalReportPackageMetadata(
  metadata: any
): PatientPortalGeneratedMedicalReportPackageMetadata {
  return {
    fileName: metadata?.fileName ?? "",
    contentType: metadata?.contentType ?? "",
    entryNames: metadata?.entryNames ?? [],
    manifestAvailable: Boolean(metadata?.manifestAvailable),
    pdfAvailable: Boolean(metadata?.pdfAvailable),
    summaryAvailable: Boolean(metadata?.summaryAvailable)
  };
}

function buildEmptyGeneratedPortalMedicalReportResult(
  username: string,
  failureReason: string,
  sessionSource: string
): PatientPortalGeneratedMedicalReportResult {
  return {
    authenticated: false,
    username,
    portalUsername: "",
    canonicalId: "",
    pid: null,
    pubpid: "",
    displayName: "",
    datasetVersion: "unknown",
    asOfDate: new Date().toISOString().slice(0, 10),
    title: "",
    generatedOn: new Date().toISOString().slice(0, 10),
    includedSectionIds: [],
    includedProcedureOrderIds: [],
    includedIssueIds: [],
    includedEncounterFormIds: [],
    templateMetadata: buildEmptyPatientPortalGeneratedMedicalReportTemplateMetadata(),
    printableVersionAvailable: false,
    pdfDownloadAvailable: false,
    packageDownloadAvailable: false,
    packageMetadata: buildEmptyPatientPortalGeneratedMedicalReportPackageMetadata(),
    reportSectionCount: 0,
    reportSections: [],
    summaryLineCount: 0,
    summaryLines: [],
    auditEventCount: 0,
    auditEvents: [],
    failureReason,
    sessionSource
  };
}

function mapPatientPortalGeneratedMedicalReportResult(result: any): PatientPortalGeneratedMedicalReportResult {
  return {
    authenticated: Boolean(result.authenticated),
    username: result.username ?? "",
    portalUsername: result.portalUsername ?? "",
    canonicalId: result.canonicalId ?? "",
    pid: nullableNumber(result.legacyPid),
    pubpid: result.pubpid ?? "",
    displayName: result.displayName ?? "",
    datasetVersion: result.datasetVersion ?? "",
    asOfDate: result.asOfDate ?? "",
    title: result.title ?? "",
    generatedOn: result.generatedOn ?? "",
    templateMetadata: {
      facilityName: result.templateMetadata?.facilityName ?? "",
      facilityStreet: result.templateMetadata?.facilityStreet ?? "",
      facilityCityStatePostal: result.templateMetadata?.facilityCityStatePostal ?? "",
      facilityPhone: result.templateMetadata?.facilityPhone ?? "",
      printablePatientName: result.templateMetadata?.printablePatientName ?? "",
      patientHeaderLine: result.templateMetadata?.patientHeaderLine ?? "",
      generatedOnLabel: result.templateMetadata?.generatedOnLabel ?? "",
      signatureLineAvailable: Boolean(result.templateMetadata?.signatureLineAvailable)
    },
    includedSectionIds: result.includedSectionIds ?? [],
    includedProcedureOrderIds: result.includedProcedureOrderIds ?? [],
    includedIssueIds: result.includedIssueIds ?? [],
    includedEncounterFormIds: result.includedEncounterFormIds ?? [],
    printableVersionAvailable: Boolean(result.printableVersionAvailable),
    pdfDownloadAvailable: Boolean(result.pdfDownloadAvailable),
    packageDownloadAvailable: Boolean(result.packageDownloadAvailable),
    packageMetadata: mapPatientPortalGeneratedMedicalReportPackageMetadata(result.packageMetadata),
    reportSectionCount: result.reportSectionCount ?? 0,
    reportSections: (result.reportSections ?? []).map((section: any) => ({
      id: section.id ?? "",
      title: section.title ?? "",
      lineCount: section.lineCount ?? 0,
      lines: section.lines ?? []
    })),
    summaryLineCount: result.summaryLineCount ?? 0,
    summaryLines: result.summaryLines ?? [],
    auditEventCount: result.auditEventCount ?? 0,
    auditEvents: (result.auditEvents ?? []).map((event: any) => ({
      id: event.id ?? 0,
      eventType: event.eventType ?? "",
      eventLabel: event.eventLabel ?? "",
      eventAt: event.eventAt ?? "",
      reportTitle: event.reportTitle ?? "",
      generatedOn: event.generatedOn ?? "",
      artifactName: event.artifactName ?? null,
      artifactContentType: event.artifactContentType ?? null,
      includedSectionIds: event.includedSectionIds ?? [],
      includedIssueIds: event.includedIssueIds ?? [],
      includedEncounterFormIds: event.includedEncounterFormIds ?? [],
      includedProcedureOrderIds: event.includedProcedureOrderIds ?? [],
      summary: event.summary ?? "",
      eventSource: event.eventSource ?? ""
    })),
    failureReason: result.failureReason ?? null,
    sessionSource: result.sessionSource ?? ""
  };
}

function mapPatientPortalAppointmentRequestOptionsResult(result: any): PatientPortalAppointmentRequestOptionsResult {
  return {
    authenticated: Boolean(result.authenticated),
    username: result.username ?? "",
    portalUsername: result.portalUsername ?? "",
    canonicalId: result.canonicalId ?? "",
    pid: result.legacyPid ?? null,
    pubpid: result.pubpid ?? "",
    displayName: result.displayName ?? "",
    datasetVersion: result.datasetVersion ?? "",
    asOfDate: result.asOfDate ?? "",
    categories: (result.categories ?? []).map((category: any) => ({
      id: category.id ?? 0,
      name: category.name ?? "",
      constantId: category.constantId ?? "",
      durationMinutes: category.durationMinutes ?? 0
    })),
    providers: (result.providers ?? []).map((provider: any) => ({
      id: provider.id ?? 0,
      username: provider.username ?? "",
      displayName: provider.displayName ?? "",
      facilityId: provider.facilityId ?? null,
      facilityName: provider.facilityName ?? null
    })),
    facilities: (result.facilities ?? []).map((facility: any) => ({
      id: facility.id ?? 0,
      name: facility.name ?? "",
      code: facility.code ?? null
    })),
    defaults: {
      categoryId: result.defaults?.categoryId ?? null,
      providerId: result.defaults?.providerId ?? null,
      facilityId: result.defaults?.facilityId ?? null,
      durationMinutes: result.defaults?.durationMinutes ?? 0,
      date: result.defaults?.date ?? "",
      startTime: result.defaults?.startTime ?? ""
    },
    failureReason: result.failureReason ?? null,
    sessionSource: result.sessionSource ?? ""
  };
}

function mapPatientPortalAppointmentRequestResult(result: any): PatientPortalAppointmentRequestResult {
  return {
    authenticated: Boolean(result.authenticated),
    created: Boolean(result.created),
    username: result.username ?? "",
    portalUsername: result.portalUsername ?? "",
    canonicalId: result.canonicalId ?? "",
    pid: result.legacyPid ?? null,
    pubpid: result.pubpid ?? "",
    displayName: result.displayName ?? "",
    appointment: result.appointment ? mapPatientPortalAppointmentItem(result.appointment) : null,
    reminder: result.reminder
      ? {
          id: result.reminder.id ?? "",
          title: result.reminder.title ?? "",
          body: result.reminder.body ?? "",
          assignedTo: result.reminder.assignedTo ?? "",
          status: result.reminder.status ?? ""
        }
      : null,
    failureReason: result.failureReason ?? null,
    sessionSource: result.sessionSource ?? ""
  };
}

function mapPatientPortalAppointmentItem(appointment: any) {
  return {
    id: appointment.id ?? "",
    date: appointment.date ?? "",
    startTime: appointment.startTime ?? "",
    title: appointment.title ?? "",
    status: appointment.status ?? null,
    categoryId: appointment.categoryId ?? null,
    categoryName: appointment.categoryName ?? null,
    providerName: appointment.providerName ?? null,
    facilityName: appointment.facilityName ?? null,
    comments: appointment.comments ?? null
  };
}

function mapPatientPortalHomeImmunizationItem(immunization: any) {
  return {
    id: Number(immunization.id ?? 0),
    administeredDate: immunization.administeredDate ?? null,
    administeredFormatted: immunization.administeredFormatted ?? null,
    immunizationId: immunization.immunizationId ?? null,
    cvxCode: immunization.cvxCode ?? null,
    codeText: immunization.codeText ?? "",
    note: immunization.note ?? null,
    completionStatus: immunization.completionStatus ?? null,
    addedErroneously: Number(immunization.addedErroneously ?? 0)
  };
}

function mapPatientPortalMessagesResult(result: any): PatientPortalMessagesResult {
  return {
    authenticated: Boolean(result.authenticated),
    username: result.username ?? "",
    portalUsername: result.portalUsername ?? "",
    canonicalId: result.canonicalId ?? "",
    pid: result.legacyPid ?? null,
    pubpid: result.pubpid ?? "",
    displayName: result.displayName ?? "",
    datasetVersion: result.datasetVersion ?? "",
    asOfDate: result.asOfDate ?? "",
    messageCount: result.messageCount ?? 0,
    messages: (result.messages ?? []).map((message: any) => mapPatientPortalMessageItem(message, result.portalUsername)),
    sentMessageCount: result.sentMessageCount ?? 0,
    sentMessages: (result.sentMessages ?? []).map((message: any) => mapPatientPortalMessageItem(message, result.portalUsername)),
    allMessageCount: result.allMessageCount ?? 0,
    allMessages: (result.allMessages ?? []).map((message: any) => mapPatientPortalMessageItem(message, result.portalUsername)),
    deletedMessageCount: result.deletedMessageCount ?? 0,
    deletedMessages: (result.deletedMessages ?? []).map((message: any) => mapPatientPortalMessageItem(message, result.portalUsername)),
    failureReason: result.failureReason ?? null,
    sessionSource: result.sessionSource ?? ""
  };
}

function mapPatientPortalDocumentsResult(result: any): PatientPortalDocumentsResult {
  const mapDocument = (document: any) => ({
    id: Number(document.id ?? 0),
    documentKey: document.documentKey ?? "",
    categoryId: Number(document.categoryId ?? 0),
    categoryName: document.categoryName ?? "",
    displayPath: document.displayPath ?? document.categoryName ?? "",
    name: document.name ?? "",
    docDate: document.docDate ?? "",
    uploadedAt: document.uploadedAt ?? "",
    mimetype: document.mimetype ?? null,
    fileName: document.fileName ?? document.name ?? "",
    sizeBytes: document.sizeBytes ?? null,
    storageMethod: document.storageMethod ?? null,
    canDownload: Boolean(document.canDownload)
  });

  return {
    authenticated: Boolean(result.authenticated),
    username: result.username ?? "",
    portalUsername: result.portalUsername ?? "",
    canonicalId: result.canonicalId ?? "",
    pid: result.legacyPid ?? null,
    pubpid: result.pubpid ?? "",
    displayName: result.displayName ?? "",
    datasetVersion: result.datasetVersion ?? "",
    asOfDate: result.asOfDate ?? "",
    documentCount: result.documentCount ?? 0,
    categories: (result.categories ?? []).map((category: any) => ({
      categoryId: Number(category.categoryId ?? 0),
      categoryName: category.categoryName ?? "",
      displayPath: category.displayPath ?? category.categoryName ?? "",
      documentCount: category.documentCount ?? 0,
      documents: (category.documents ?? []).map(mapDocument)
    })),
    documents: (result.documents ?? []).map(mapDocument),
    failureReason: result.failureReason ?? null,
    sessionSource: result.sessionSource ?? ""
  };
}

function mapPatientPortalMessageThreadResult(result: any): PatientPortalMessageThreadResult {
  return {
    authenticated: Boolean(result.authenticated),
    username: result.username ?? "",
    portalUsername: result.portalUsername ?? "",
    canonicalId: result.canonicalId ?? "",
    pid: result.legacyPid ?? null,
    pubpid: result.pubpid ?? "",
    displayName: result.displayName ?? "",
    datasetVersion: result.datasetVersion ?? "",
    asOfDate: result.asOfDate ?? "",
    messageId: result.messageId ?? "",
    threadId: Number(result.threadId ?? 0),
    anchorMessage: result.anchorMessage ? mapPatientPortalMessageItem(result.anchorMessage, result.portalUsername) : null,
    threadMessageCount: result.threadMessageCount ?? 0,
    threadMessages: (result.threadMessages ?? []).map((message: any) => mapPatientPortalMessageItem(message, result.portalUsername)),
    failureReason: result.failureReason ?? null,
    sessionSource: result.sessionSource ?? ""
  };
}

function mapPatientPortalDeleteMessageResult(
  result: any,
  username: string,
  messageId: string
): PatientPortalDeleteMessageResult {
  return {
    authenticated: Boolean(result.authenticated),
    deleted: Boolean(result.deleted),
    username: result.username ?? username,
    portalUsername: result.portalUsername ?? "",
    canonicalId: result.canonicalId ?? "",
    pid: result.legacyPid ?? null,
    pubpid: result.pubpid ?? "",
    displayName: result.displayName ?? "",
    messageId: result.messageId ?? messageId,
    deletedMessage: result.deletedMessage ? mapPatientPortalMessageItem(result.deletedMessage, result.portalUsername) : null,
    deletedMessageCount: result.deletedMessageCount ?? 0,
    messageCount: result.messageCount ?? 0,
    sentMessageCount: result.sentMessageCount ?? 0,
    failureReason: result.failureReason ?? null,
    sessionSource: result.sessionSource ?? "modernized-openemr-portal"
  };
}

function mapPatientPortalArchiveMessagesResult(
  result: any,
  username: string,
  messageIds: string[]
): PatientPortalArchiveMessagesResult {
  return {
    authenticated: Boolean(result.authenticated),
    archived: Boolean(result.archived),
    username: result.username ?? username,
    portalUsername: result.portalUsername ?? "",
    canonicalId: result.canonicalId ?? "",
    pid: result.legacyPid ?? null,
    pubpid: result.pubpid ?? "",
    displayName: result.displayName ?? "",
    messageIds: result.messageIds ?? messageIds,
    archivedMessages: (result.archivedMessages ?? []).map((message: any) => mapPatientPortalMessageItem(message, result.portalUsername)),
    archivedMessageCount: result.archivedMessageCount ?? 0,
    messageCount: result.messageCount ?? 0,
    sentMessageCount: result.sentMessageCount ?? 0,
    failureReason: result.failureReason ?? null,
    sessionSource: result.sessionSource ?? "modernized-openemr-portal"
  };
}

function mapPatientPortalReadMessageResult(
  result: any,
  username: string,
  messageId: string
): PatientPortalReadMessageResult {
  return {
    authenticated: Boolean(result.authenticated),
    markedRead: Boolean(result.markedRead),
    username: result.username ?? username,
    portalUsername: result.portalUsername ?? "",
    canonicalId: result.canonicalId ?? "",
    pid: result.legacyPid ?? null,
    pubpid: result.pubpid ?? "",
    displayName: result.displayName ?? "",
    messageId: result.messageId ?? messageId,
    message: result.message ? mapPatientPortalMessageItem(result.message, result.portalUsername) : null,
    messageCount: result.messageCount ?? 0,
    sentMessageCount: result.sentMessageCount ?? 0,
    failureReason: result.failureReason ?? null,
    sessionSource: result.sessionSource ?? "modernized-openemr-portal"
  };
}

function mapPatientPortalMessageItem(message: any, portalUsername: string): PatientPortalMessageItem {
  return {
    id: message.id ?? "",
    date: message.date ?? "",
    title: message.title ?? "",
    body: message.body ?? "",
    status: message.status ?? "",
    assignedTo: message.assignedTo ?? "",
    senderId: message.senderId ?? message.assignedTo ?? "",
    senderName: message.senderName ?? "",
    recipientId: message.recipientId ?? portalUsername ?? "",
    recipientName: message.recipientName ?? "",
    mailChain: Number(message.mailChain ?? 0),
    replyMailChain: Number(message.replyMailChain ?? 0),
    portalRelation: message.portalRelation ?? null,
    isEncrypted: Boolean(message.isEncrypted)
  };
}

function careTeamRoleLabel(value: string) {
  switch (value) {
    case "primary_care_provider":
      return "Primary Care Provider";
    case "physician":
      return "Physician";
    case "nurse":
      return "Nurse";
    case "case_manager":
      return "Case Manager";
    case "caregiver":
      return "Caregiver";
    case "social_worker":
      return "Social Worker";
    case "specialist":
      return "Specialist";
    case "other":
      return "Other";
    default:
      return value;
  }
}

function careTeamStatusLabel(value: string) {
  switch (value) {
    case "proposed":
      return "Proposed";
    case "active":
      return "Active";
    case "suspended":
      return "Suspended";
    case "inactive":
      return "Inactive";
    case "entered-in-error":
      return "Entered In Error";
    default:
      return value;
  }
}

function portalWorkflowPasswordStatusLabel(status: number | null) {
  if (status === 0) {
    return "Temporary password issued";
  }
  if (status === 1) {
    return "Patient-managed password";
  }
  return status === null ? "No account provisioned" : `Status ${status}`;
}

function portalWorkflowResetStatusLabel(oneTimeLinkPending: boolean, portalUsername: string) {
  if (!portalUsername) {
    return "No account provisioned";
  }

  return oneTimeLinkPending ? "One-time reset pending" : "No reset pending";
}

function portalWorkflowAccessStatusLabel(portalEnabled: boolean, portalUsername: string) {
  if (portalEnabled) {
    return "Enabled";
  }

  return portalUsername ? "Access disabled" : "Pending";
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
