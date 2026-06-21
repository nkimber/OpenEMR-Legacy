import { buildPatientDocumentScanFields, escapeSql, type LegacyMariaDbProbe } from "../db/legacyMariaDbProbe.js";

export type PatientContact = {
  pid: number;
  pubpid: string;
  phoneHome: string;
  phoneCell: string;
  email: string;
  hipaaAllowSms: string;
  hipaaAllowEmail: string;
};

export type PatientDemographics = {
  pid: number;
  pubpid: string;
  firstName: string;
  lastName: string;
  preferredName: string;
  sex: string;
  dateOfBirth: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  maritalStatus: string;
  occupation: string;
};

export type NewPatientRegistration = {
  pubpid: string;
  firstName: string;
  lastName: string;
  preferredName: string;
  sex: string;
  dateOfBirth: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  maritalStatus: string;
  occupation: string;
  phoneHome: string;
  phoneCell: string;
  email: string;
  hipaaAllowSms: string;
  hipaaAllowEmail: string;
};

export type AppointmentRecord = {
  id: number | string;
  patientId: number;
  providerId: number;
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  status: string;
  facilityId: number;
  billingLocationId: number;
  room: string;
  categoryId: number;
  categoryName: string;
  homeText: string;
  recurrenceType: number;
  repeatFrequency: number | null;
  repeatUnit: number | null;
  recurrenceEndDate: string | null;
  recurrenceExdates: string[];
};

export type AppointmentSeriesOccurrence = {
  id: number | string;
  seriesRootId: number | string;
  patientId: number;
  title: string;
  date: string;
  startTime: string;
  recurrenceType: number;
  repeatFrequency: number | null;
  repeatUnit: number | null;
  recurrenceEndDate: string | null;
  recurrenceExdates: string[];
  recurrenceExceptionCount: number;
  occurrenceNumber: number;
  isVirtualOccurrence: boolean;
};

export type ClinicalListRecord = {
  id: number | string;
  patientId: number;
  type: string;
  title: string;
  activity: number;
  comments: string;
  reaction: string;
  severity: string;
  listOptionId: string;
};

export type ProblemRecord = {
  id: number | string;
  patientId: number;
  type: string;
  title: string;
  activity: number;
  comments: string;
  diagnosis: string;
  date: string;
};

export type MedicationRecord = {
  id: number | string;
  patientId: number;
  type: string;
  title: string;
  activity: number;
  comments: string;
  diagnosis: string;
  date: string;
};

export type PatientMessageRecord = {
  id: number | string;
  patientId: number;
  title: string;
  body: string;
  status: string;
  assignedTo: string;
  deleted: number;
};

export type PatientDocumentRecord = {
  id: number | string;
  patientId: number;
  documentKey: string;
  categoryId: number;
  categoryName: string;
  name: string;
  docDate: string;
  encounter: number;
  mimetype: string;
  fileName: string;
  url: string;
  sizeBytes: number;
  storageMethod: string;
  deleted: number;
  reviewStatus: string;
  reviewedBy: string;
  reviewedAt: string;
  notes: string;
  contentBase64: string;
  contentPreview: string;
  thumbnailDataUri: string | null;
  isScannedAttachment: boolean;
  scanStatus: string;
  captureSource: string;
  scanPageCount: number;
  ocrStatus: string;
};

export type PatientInsuranceRecord = {
  id: number | string;
  patientId: number;
  type: string;
  provider: string;
  planName: string;
  policyNumber: string;
  groupNumber: string;
  relationship: string;
};

export type PrescriptionRecord = {
  id: number | string;
  patientId: number;
  providerId: number;
  startDate: string;
  endDate: string | null;
  drug: string;
  dosage: string;
  quantity: string;
  refills: number;
  active: number;
  note: string;
};

export type ImmunizationRecord = {
  id: number | string;
  patientId: number;
  immunizationId: number;
  cvxCode: string;
  vaccine: string;
  administeredDate: string;
  manufacturer: string;
  lotNumber: string;
  administeredBy: string;
  route: string;
  administrationSite: string;
  completionStatus: string;
  informationSource: string;
  note: string;
  addedErroneously: number;
  encounter: number | null;
};

export type EncounterRecord = {
  id: number;
  encounter: number;
  patientId: number;
  providerId: number;
  date: string;
  reason: string;
  facilityId: number;
  billingFacilityId: number;
  sensitivity: string;
  referralSource: string;
  externalId: string;
  posCode: number | null;
  billingNote: string;
};

export type EncounterSignatureRecord = {
  id: number;
  encounterId: number;
  tableName: string;
  signerUsername: string;
  signedAt: string;
  isLock: boolean;
  amendment: string;
  hash: string;
  signatureHash: string;
};

export type VitalsRecord = {
  id: number;
  patientId: number;
  bps: string;
  bpd: string;
  weight: number;
  height: number;
  pulse: number;
  oxygenSaturation: number;
  note: string;
};

export type SoapNoteRecord = {
  id: number;
  patientId: number;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

export type BillingLineRecord = {
  id: number | string;
  patientId: number;
  encounter: number;
  codeType: string;
  code: string;
  modifier: string;
  codeText: string;
  fee: string;
  justify: string;
  units: number;
  activity: number;
  billed: number;
};

export type ClaimStatusRecord = {
  id: number | string;
  patientId: number;
  encounter: number;
  version: number;
  payerId: number;
  payerName: string;
  payerType: number;
  status: number;
  statusLabel: string;
  billProcess: number;
  billTime: string;
  processTime: string;
  processFile: string;
  target: string;
  x12PartnerId: number;
  submittedClaim: string;
};

export type PaymentPostingRecord = {
  id: number | string;
  patientId: number;
  encounter: number;
  sequenceNo: number;
  sessionId: number;
  payerId: number;
  payerName: string;
  payerType: number;
  reference: string;
  paymentType: string;
  paymentMethod: string;
  checkDate: string;
  depositDate: string;
  postDate: string;
  postTime: string;
  codeType: string;
  code: string;
  modifier: string;
  memo: string;
  payAmount: string;
  adjustmentAmount: string;
  accountCode: string;
  reasonCode: string;
  payerClaimNumber: string;
  deleted: string;
};

export type ProcedureOrderRecord = {
  id: number;
  patientId: number;
  encounterId: number;
  orderStatus: string;
  orderPriority: string;
  procedureCode: string;
  procedureName: string;
  procedureType: string;
};

export type ProcedureReportRecord = {
  id: number;
  orderId: number;
  reportStatus: string;
  reviewStatus: string;
  reportNotes: string;
};

export type ProcedureResultRecord = {
  id: number;
  reportId: number;
  resultCode: string;
  resultText: string;
  result: string;
  abnormal: string;
  status: string;
};

export type FacilityRecord = {
  id: number;
  code: string;
  name: string;
  active: boolean;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  color: string;
};

export type UserRecord = {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  authorized: boolean;
  active: boolean;
  calendar: boolean;
  facilityId: number;
  facilityName: string;
  email: string;
  npi: string;
};

export type AccessPermissionAssignment = {
  groupValue: string;
  sectionValue: string;
  permissionValue: string;
  permissionName: string;
  returnValue: string;
};

export type AccessPermissionMutation = {
  groupValue: string;
  sectionValue: string;
  permissionValue: string;
  returnValue: string;
};

export type AccessGroupMembership = {
  userValue: string;
  userName: string;
  groupValue: string;
  groupName: string;
};

export type AccessGroupMembershipMutation = {
  userValue: string;
  groupValue: string;
};

export type NewAppointment = {
  patientId: number;
  providerId: number;
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  homeText: string;
  facilityId: number;
  billingLocationId: number;
  room: string;
  categoryId?: number;
  recurrenceType?: number;
  repeatFrequency?: number;
  repeatUnit?: number;
  recurrenceEndDate?: string;
};

export type AppointmentUpdate = {
  providerId: number;
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  homeText?: string;
  facilityId: number;
  billingLocationId: number;
  room: string;
  status: string;
  categoryId?: number;
  recurrenceType?: number;
  repeatFrequency?: number;
  repeatUnit?: number;
  recurrenceEndDate?: string;
};

export type NewClinicalListEntry = {
  patientId: number;
  type: "allergy" | "medical_problem" | "medication";
  title: string;
  dateTime: string;
  comments: string;
  reaction: string;
  severity: string;
  listOptionId: string;
};

export type NewProblem = {
  patientId: number;
  title: string;
  dateTime: string;
  diagnosis: string;
  comments: string;
};

export type NewMedication = {
  patientId: number;
  title: string;
  dateTime: string;
  diagnosis: string;
  comments: string;
};

export type NewPatientMessage = {
  patientId: number;
  title: string;
  body: string;
  assignedTo: string;
};

export type NewCollectionsFollowUpTask = {
  patientId: number;
  pubpid: string;
  patientDisplayName: string;
  statementNumber: string;
  action: string;
  collectionTier: string;
  pastDueAmount: string;
  over90Amount: string;
  balanceDueAmount: string;
  oldestOpenDate: string;
  oldestOpenAgeDays: number;
  dueDate: string;
  assignedTo: string;
  note: string;
};

export type NewPatientDocument = {
  patientId: number;
  categoryId: number;
  categoryName: string;
  name: string;
  docDate: string;
  encounter: number;
  content: string;
  notes: string;
};

export type NewEncounterDocument = {
  patientId: number;
  encounter: number;
  categoryId: number;
  categoryName: string;
  name: string;
  docDate: string;
  content: string;
  notes: string;
};

export type NewPatientInsurance = {
  patientId: number;
  type: string;
  provider: string;
  planName: string;
  policyNumber: string;
  groupNumber: string;
  relationship: string;
};

export type NewPatientBinaryDocument = {
  patientId: number;
  categoryId: number;
  categoryName: string;
  name: string;
  docDate: string;
  encounter: number;
  fileName: string;
  mimetype: string;
  contentBase64: string;
  notes: string;
};

export type NewEncounterBinaryDocument = NewPatientBinaryDocument;

export type NewPatientExternalLinkDocument = {
  patientId: number;
  categoryId: number;
  categoryName: string;
  name: string;
  docDate: string;
  encounter: number;
  url: string;
  notes: string;
};

export type NewEncounterExternalLinkDocument = NewPatientExternalLinkDocument;

export type PatientDocumentMetadataUpdate = {
  categoryId: number;
  categoryName: string;
  name: string;
  docDate: string;
  encounter: number | null;
  notes: string;
};

export type PatientDocumentContentReplacement = {
  fileName: string;
  content: string;
};

export type NewPrescription = {
  patientId: number;
  providerId: number;
  startDate: string;
  drug: string;
  rxNormCode: string;
  dosage: string;
  quantity: string;
  refills: number;
  note: string;
  diagnosis: string;
};

export type NewImmunization = {
  patientId: number;
  providerId: number;
  encounter?: number | null;
  administeredAt: string;
  immunizationId: number;
  cvxCode: string;
  vaccine: string;
  manufacturer: string;
  lotNumber: string;
  administeredBy: string;
  educationDate: string;
  visDate: string;
  amountAdministered: number;
  amountAdministeredUnit: string;
  expirationDate: string;
  route: string;
  administrationSite: string;
  completionStatus: string;
  informationSource: string;
  note: string;
};

export type NewEncounter = {
  patientId: number;
  providerId: number;
  dateTime: string;
  reason: string;
  facilityId: number;
  facilityName: string;
  billingFacilityId: number;
  sensitivity?: string | null;
  referralSource?: string | null;
  externalId?: string | null;
  posCode?: number | null;
  billingNote: string;
};

export type NewEncounterSignature = {
  signerUsername: string;
  signedAt: string;
  isLock: boolean;
  amendment: string;
};

export type EncounterMetadataInput = {
  sensitivity?: string | null;
  referralSource?: string | null;
  externalId?: string | null;
  posCode?: number | null;
};

export type NewVitals = {
  patientId: number;
  encounter: number;
  dateTime: string;
  bps: string;
  bpd: string;
  weight: number;
  height: number;
  pulse: number;
  oxygenSaturation: number;
  note: string;
};

export type NewSoapNote = {
  patientId: number;
  encounter: number;
  dateTime: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

export type NewBillingLine = {
  patientId: number;
  providerId: number;
  encounter: number;
  dateTime: string;
  codeType: string;
  code: string;
  modifier?: string;
  codeText: string;
  fee: string;
  units: number;
  justify: string;
};

export type BillingLineCorrection = {
  codeText: string;
  modifier?: string;
  fee: string;
  units: number;
  justify: string;
};

export type NewClaimStatus = {
  patientId: number;
  encounter: number;
  payerId: number;
  payerName: string;
  payerType: number;
  status: number;
  billProcess: number;
  billTime: string;
  processTime?: string;
  processFile: string;
  target: string;
  x12PartnerId: number;
  submittedClaim: string;
};

export type ClaimStatusUpdate = {
  status: number;
  billProcess: number;
  processTime?: string;
  processFile: string;
  target: string;
  x12PartnerId: number;
  submittedClaim: string;
};

export type NewPaymentPosting = {
  patientId: number;
  encounter: number;
  payerId: number;
  payerName: string;
  payerType: number;
  reference: string;
  postDate: string;
  paymentType: string;
  paymentMethod: string;
  codeType: string;
  code: string;
  modifier?: string;
  memo: string;
  payAmount: string;
  adjustmentAmount: string;
  accountCode: string;
  reasonCode: string;
  payerClaimNumber: string;
};

export type NewProcedureOrder = {
  patientId: number;
  providerId: number;
  encounterId: number;
  dateOrdered: string;
  priority: string;
  status: string;
  procedureCode: string;
  procedureName: string;
  procedureType: string;
  diagnosis: string;
  instructions: string;
};

export type NewProcedureReport = {
  orderId: number;
  dateCollected: string;
  dateReport: string;
  specimenNumber: string;
  reportStatus: string;
  reviewStatus: string;
  notes: string;
};

export type NewProcedureResult = {
  reportId: number;
  resultCode: string;
  resultText: string;
  dateTime: string;
  facility: string;
  units: string;
  result: string;
  range: string;
  abnormal: string;
  comments: string;
  status: string;
};

export type NewFacility = {
  code: string;
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  color: string;
  active: boolean;
};

export type NewUser = {
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  calendar: boolean;
  facilityId: number;
  email: string;
  npi: string;
  active: boolean;
};

export class LegacyWorkflowActions {
  constructor(private readonly db: LegacyMariaDbProbe) {}

  async createUser(input: NewUser): Promise<number> {
    await this.db.execute(`
INSERT INTO users
  (uuid, username, password, authorized, fname, lname, facility, facility_id, see_auth,
   active, npi, title, specialty, email, calendar, taxonomy, abook_type,
   main_menu_role, patient_menu_role, billing_facility_id)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${sqlString(input.username)}, '9d4e1e23bd5b727046a9e3b4b7db57bd8d6ee684',
   ${input.role === "provider" ? 1 : 0}, ${sqlString(input.firstName)}, ${sqlString(input.lastName)},
   (SELECT name FROM facility WHERE id = ${integer(input.facilityId)} LIMIT 1), ${integer(input.facilityId)}, 1,
   ${input.active ? 1 : 0}, ${sqlString(input.npi)}, ${input.role === "provider" ? "'Dr.'" : "''"},
   ${sqlString(input.role)}, ${sqlString(input.email)}, ${input.calendar ? 1 : 0}, '207Q00000X',
   ${sqlString(input.role)}, 'standard', 'standard', ${integer(input.facilityId)});
`);

    const rows = await this.db.queryRows<{ id: string }>(`
SELECT id
FROM users
WHERE username = ${sqlString(input.username)}
ORDER BY id DESC
LIMIT 1;
`);
    return Number(rows[0].id);
  }

  async getUser(id: number): Promise<UserRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT u.id, u.username, u.fname AS firstName, u.lname AS lastName,
  COALESCE(NULLIF(u.abook_type, ''), NULLIF(u.main_menu_role, ''), '') AS role,
  COALESCE(u.authorized, 0) AS authorized,
  COALESCE(u.active, 0) AS active,
  COALESCE(u.calendar, 0) AS calendar,
  COALESCE(u.facility_id, 0) AS facilityId,
  COALESCE(f.name, u.facility, '') AS facilityName,
  COALESCE(u.email, '') AS email,
  COALESCE(u.npi, '') AS npi
FROM users u
LEFT JOIN facility f ON f.id = u.facility_id
WHERE u.id = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    return row ? mapUser(row) : null;
  }

  async updateUser(id: number, input: NewUser): Promise<void> {
    await this.db.execute(`
UPDATE users
SET username = ${sqlString(input.username)},
    fname = ${sqlString(input.firstName)},
    lname = ${sqlString(input.lastName)},
    abook_type = ${sqlString(input.role)},
    specialty = ${sqlString(input.role)},
    authorized = ${input.role === "provider" ? 1 : 0},
    active = ${input.active ? 1 : 0},
    calendar = ${input.calendar ? 1 : 0},
    facility_id = ${integer(input.facilityId)},
    facility = (SELECT name FROM facility WHERE id = ${integer(input.facilityId)} LIMIT 1),
    billing_facility_id = ${integer(input.facilityId)},
    email = ${sqlString(input.email)},
    npi = ${sqlString(input.npi)}
WHERE id = ${integer(id)};
`);
  }

  async deleteUser(id: number): Promise<void> {
    const users = await this.db.queryRows<{ username: string }>(`
SELECT username
FROM users
WHERE id = ${integer(id)}
LIMIT 1;
`);
    const username = users[0]?.username;
    if (username) {
      await this.deleteAccessControlUser(username);
    }

    await this.db.execute(`
DELETE FROM users
WHERE id = ${integer(id)};
`);
  }

  async createFacility(input: NewFacility): Promise<number> {
    await this.db.execute(`
INSERT INTO facility
  (uuid, name, phone, street, city, state, postal_code, country_code, service_location,
   billing_location, accepts_assignment, pos_code, facility_npi, color, primary_business_entity,
   facility_code, inactive, tax_id_type, oid, organization_type)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${sqlString(input.name)}, ${sqlString(input.phone)},
   ${sqlString(input.street)}, ${sqlString(input.city)}, ${sqlString(input.state)}, ${sqlString(input.postalCode)},
   'US', 1, 1, 1, 11, '1999900000', ${sqlString(input.color)}, 0, ${sqlString(input.code)},
   ${input.active ? 0 : 1}, '', '', 'prov');
`);

    const rows = await this.db.queryRows<{ id: string }>(`
SELECT id
FROM facility
WHERE facility_code = ${sqlString(input.code)}
  AND name = ${sqlString(input.name)}
ORDER BY id DESC
LIMIT 1;
`);
    return Number(rows[0].id);
  }

  async getFacility(id: number): Promise<FacilityRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, COALESCE(facility_code, '') AS code, name, COALESCE(phone, '') AS phone,
  COALESCE(street, '') AS street, COALESCE(city, '') AS city, COALESCE(state, '') AS state,
  COALESCE(postal_code, '') AS postalCode, COALESCE(color, '') AS color,
  CASE WHEN COALESCE(inactive, 0) = 0 THEN '1' ELSE '0' END AS active
FROM facility
WHERE id = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    return row ? mapFacility(row) : null;
  }

  async updateFacility(id: number, input: NewFacility): Promise<void> {
    await this.db.execute(`
UPDATE facility
SET facility_code = ${sqlString(input.code)},
    name = ${sqlString(input.name)},
    phone = ${sqlString(input.phone)},
    street = ${sqlString(input.street)},
    city = ${sqlString(input.city)},
    state = ${sqlString(input.state)},
    postal_code = ${sqlString(input.postalCode)},
    color = ${sqlString(input.color)},
    inactive = ${input.active ? 0 : 1}
WHERE id = ${integer(id)};
`);
  }

  async deleteFacility(id: number): Promise<void> {
    await this.db.execute(`
DELETE FROM facility
WHERE id = ${integer(id)};
`);
  }

  async getAccessPermissionAssignment(input: AccessPermissionMutation): Promise<AccessPermissionAssignment | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT ag.value AS groupValue, am.section_value AS sectionValue, am.value AS permissionValue,
  aco.name AS permissionName, acl.return_value AS returnValue
FROM gacl_aro_groups ag
INNER JOIN gacl_aro_groups_map gm ON gm.group_id = ag.id
INNER JOIN gacl_acl acl ON acl.id = gm.acl_id
INNER JOIN gacl_aco_map am ON am.acl_id = acl.id
INNER JOIN gacl_aco aco ON aco.section_value = am.section_value AND aco.value = am.value
WHERE ag.value = ${sqlString(input.groupValue)}
  AND am.section_value = ${sqlString(input.sectionValue)}
  AND am.value = ${sqlString(input.permissionValue)}
  AND acl.enabled = 1
  AND acl.allow = 1
  AND aco.hidden = 0
ORDER BY acl.id
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
    await this.revokeAccessPermission(input);

    const groupRows = await this.db.queryRows<{ id: string }>(`
SELECT id
FROM gacl_aro_groups
WHERE value = ${sqlString(input.groupValue)}
LIMIT 1;
`);
    const groupId = Number(groupRows[0]?.id);
    if (!Number.isInteger(groupId)) {
      throw new Error(`Legacy ACL group not found: ${input.groupValue}`);
    }

    const permissionRows = await this.db.queryRows<{ name: string }>(`
SELECT name
FROM gacl_aco
WHERE section_value = ${sqlString(input.sectionValue)}
  AND value = ${sqlString(input.permissionValue)}
  AND hidden = 0
LIMIT 1;
`);
    if (!permissionRows[0]) {
      throw new Error(`Legacy ACL permission not found: ${input.sectionValue}:${input.permissionValue}`);
    }

    const existingAclRows = await this.db.queryRows<{ id: string }>(`
SELECT acl.id
FROM gacl_acl acl
INNER JOIN gacl_aro_groups_map gm ON gm.acl_id = acl.id
WHERE gm.group_id = ${integer(groupId)}
  AND acl.enabled = 1
  AND acl.allow = 1
  AND acl.return_value = ${sqlString(input.returnValue)}
ORDER BY acl.id
LIMIT 1;
`);

    let aclId = Number(existingAclRows[0]?.id);
    if (!Number.isInteger(aclId)) {
      const nextRows = await this.db.queryRows<{ id: string }>(`
SELECT COALESCE(MAX(id), 0) + 1 AS id
FROM gacl_acl;
`);
      aclId = Number(nextRows[0]?.id);
      await this.db.execute(`
INSERT INTO gacl_acl (id, section_value, allow, enabled, return_value, note, updated_date)
VALUES (${integer(aclId)}, 'system', 1, 1, ${sqlString(input.returnValue)}, 'Parity access permission mutation', UNIX_TIMESTAMP());
INSERT INTO gacl_aro_groups_map (acl_id, group_id)
VALUES (${integer(aclId)}, ${integer(groupId)});
`);
    }

    await this.db.execute(`
INSERT IGNORE INTO gacl_aco_map (acl_id, section_value, value)
VALUES (${integer(aclId)}, ${sqlString(input.sectionValue)}, ${sqlString(input.permissionValue)});
`);
  }

  async revokeAccessPermission(input: Pick<AccessPermissionMutation, "groupValue" | "sectionValue" | "permissionValue">): Promise<void> {
    await this.db.execute(`
DELETE am
FROM gacl_aco_map am
INNER JOIN gacl_acl acl ON acl.id = am.acl_id
INNER JOIN gacl_aro_groups_map gm ON gm.acl_id = acl.id
INNER JOIN gacl_aro_groups ag ON ag.id = gm.group_id
WHERE ag.value = ${sqlString(input.groupValue)}
  AND am.section_value = ${sqlString(input.sectionValue)}
  AND am.value = ${sqlString(input.permissionValue)}
  AND acl.enabled = 1
  AND acl.allow = 1;
`);
  }

  async getAccessGroupMembership(input: AccessGroupMembershipMutation): Promise<AccessGroupMembership | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT aro.value AS userValue, aro.name AS userName, ag.value AS groupValue, ag.name AS groupName
FROM gacl_aro aro
INNER JOIN gacl_groups_aro_map gm ON gm.aro_id = aro.id
INNER JOIN gacl_aro_groups ag ON ag.id = gm.group_id
WHERE aro.section_value = 'users'
  AND aro.value = ${sqlString(input.userValue)}
  AND ag.value = ${sqlString(input.groupValue)}
ORDER BY ag.id
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
    const groupRows = await this.db.queryRows<Record<string, string>>(`
SELECT id, name
FROM gacl_aro_groups
WHERE value = ${sqlString(input.groupValue)}
LIMIT 1;
`);
    const group = groupRows[0];
    if (!group) {
      throw new Error(`Legacy ACL group not found: ${input.groupValue}`);
    }

    const userRows = await this.db.queryRows<Record<string, string>>(`
SELECT username, fname AS firstName, lname AS lastName
FROM users
WHERE username = ${sqlString(input.userValue)}
LIMIT 1;
`);
    const user = userRows[0];
    if (!user) {
      throw new Error(`Legacy ACL user not found: ${input.userValue}`);
    }

    let aroRows = await this.db.queryRows<{ id: string }>(`
SELECT id
FROM gacl_aro
WHERE section_value = 'users'
  AND value = ${sqlString(input.userValue)}
LIMIT 1;
`);
    let aroId = Number(aroRows[0]?.id);
    if (!Number.isInteger(aroId)) {
      const nextRows = await this.db.queryRows<{ id: string }>(`
SELECT COALESCE(MAX(id), 0) + 1 AS id
FROM gacl_aro;
`);
      aroId = Number(nextRows[0]?.id);
      const userName = `${user.lastName}, ${user.firstName}`;
      await this.db.execute(`
INSERT INTO gacl_aro (id, section_value, value, order_value, name, hidden)
VALUES (${integer(aroId)}, 'users', ${sqlString(input.userValue)}, 10, ${sqlString(userName)}, 0);
`);
    }
    if (!Number.isInteger(aroId)) {
      throw new Error(`Legacy ACL ARO could not be created for: ${input.userValue}`);
    }

    await this.db.execute(`
INSERT IGNORE INTO gacl_groups_aro_map (group_id, aro_id)
VALUES (${integer(Number(group.id))}, ${integer(aroId)});
`);
  }

  async revokeAccessGroupMembership(input: AccessGroupMembershipMutation): Promise<void> {
    await this.db.execute(`
DELETE gm
FROM gacl_groups_aro_map gm
INNER JOIN gacl_aro aro ON aro.id = gm.aro_id
INNER JOIN gacl_aro_groups ag ON ag.id = gm.group_id
WHERE aro.section_value = 'users'
  AND aro.value = ${sqlString(input.userValue)}
  AND ag.value = ${sqlString(input.groupValue)};
`);
    await this.deleteOrphanAccessControlUser(input.userValue);
  }

  async getPatientContact(pid: number): Promise<PatientContact | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT pid, pubpid, phone_home AS phoneHome, phone_cell AS phoneCell, email,
  hipaa_allowsms AS hipaaAllowSms, hipaa_allowemail AS hipaaAllowEmail
FROM patient_data
WHERE pid = ${integer(pid)}
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
    await this.db.execute(`
UPDATE patient_data
SET phone_home = ${sqlString(contact.phoneHome)},
  phone_cell = ${sqlString(contact.phoneCell)},
  email = ${sqlString(contact.email)},
  hipaa_allowsms = ${sqlString(contact.hipaaAllowSms)},
  hipaa_allowemail = ${sqlString(contact.hipaaAllowEmail)}
WHERE pid = ${integer(contact.pid)};
`);
  }

  async getPatientDemographics(pid: number): Promise<PatientDemographics | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT pid, pubpid,
  COALESCE(fname, '') AS firstName,
  COALESCE(lname, '') AS lastName,
  COALESCE(preferred_name, '') AS preferredName,
  COALESCE(sex, '') AS sex,
  COALESCE(DATE(DOB), '') AS dateOfBirth,
  COALESCE(street, '') AS street,
  COALESCE(city, '') AS city,
  COALESCE(state, '') AS state,
  COALESCE(postal_code, '') AS postalCode,
  COALESCE(status, '') AS maritalStatus,
  COALESCE(occupation, '') AS occupation
FROM patient_data
WHERE pid = ${integer(pid)}
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
    await this.db.execute(`
UPDATE patient_data
SET fname = ${sqlString(demographics.firstName)},
  lname = ${sqlString(demographics.lastName)},
  preferred_name = ${sqlString(demographics.preferredName)},
  sex = ${sqlString(demographics.sex)},
  DOB = ${sqlString(demographics.dateOfBirth)},
  street = ${sqlString(demographics.street)},
  city = ${sqlString(demographics.city)},
  state = ${sqlString(demographics.state)},
  postal_code = ${sqlString(demographics.postalCode)},
  status = ${sqlString(demographics.maritalStatus)},
  occupation = ${sqlString(demographics.occupation)}
WHERE pid = ${integer(demographics.pid)};
`);
  }

  async createPatient(input: NewPatientRegistration): Promise<number> {
    const rows = await this.db.queryRows<{ pid: string }>(`
SET @next_pid := (SELECT COALESCE(MAX(pid), 100000) + 1 FROM patient_data);
INSERT INTO patient_data
  (uuid, pid, pubpid, fname, lname, mname, preferred_name, DOB, sex,
   street, city, state, postal_code, status, occupation, phone_home, phone_cell, email,
   providerID, allow_patient_portal, hipaa_allowsms, hipaa_allowemail,
   allow_imm_reg_use, allow_imm_info_share, allow_health_info_ex, date, regdate)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), @next_pid, ${sqlString(input.pubpid)},
   ${sqlString(input.firstName)}, ${sqlString(input.lastName)}, '', ${sqlString(input.preferredName)},
   ${sqlString(input.dateOfBirth)}, ${sqlString(input.sex)}, ${sqlString(input.street)},
   ${sqlString(input.city)}, ${sqlString(input.state)}, ${sqlString(input.postalCode)},
   ${sqlString(input.maritalStatus)}, ${sqlString(input.occupation)}, ${sqlString(input.phoneHome)},
   ${sqlString(input.phoneCell)}, ${sqlString(input.email)}, 1, 'NO',
   ${sqlString(input.hipaaAllowSms)}, ${sqlString(input.hipaaAllowEmail)}, 'YES', 'YES', 'YES',
   '2026-06-18 09:00:00', '2026-06-18 09:00:00');
SELECT @next_pid AS pid;
`);
    return Number(rows[0]?.pid);
  }

  async deleteTemporaryPatient(pid: number): Promise<void> {
    await this.db.execute(`
DELETE FROM patient_data
WHERE pid = ${integer(pid)}
  AND pubpid LIKE 'TMP-PAT-REG-%';
`);
  }

  async createPatientInsurance(input: NewPatientInsurance): Promise<number> {
    const providerId = await this.getInsuranceCompanyId(input.provider);
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO insurance_data
  (uuid, type, provider, plan_name, policy_number, group_number, subscriber_relationship,
   date, pid, accept_assignment, policy_type)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${sqlString(input.type)}, ${integer(providerId)},
   ${sqlString(input.planName)}, ${sqlString(input.policyNumber)}, ${sqlString(input.groupNumber)},
   ${sqlString(input.relationship)}, '2026-06-18', ${integer(input.patientId)}, 'TRUE', 'group');
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async getPatientInsurance(id: number | string): Promise<PatientInsuranceRecord | null> {
    const legacyId = legacyInteger(id);
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT insd.id, insd.pid AS patientId, COALESCE(insd.type, '') AS type,
  COALESCE(ic.name, insd.provider, '') AS provider,
  COALESCE(insd.plan_name, '') AS planName,
  COALESCE(insd.policy_number, '') AS policyNumber,
  COALESCE(insd.group_number, '') AS groupNumber,
  COALESCE(insd.subscriber_relationship, '') AS relationship
FROM insurance_data insd
LEFT JOIN insurance_companies ic ON ic.id = insd.provider
WHERE insd.id = ${integer(legacyId)}
LIMIT 1;
`);
    const row = rows[0];
    return row ? {
      id: Number(row.id),
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
    const legacyId = legacyInteger(id);
    const providerId = await this.getInsuranceCompanyId(input.provider);
    await this.db.execute(`
UPDATE insurance_data
SET type = ${sqlString(input.type)},
  provider = ${integer(providerId)},
  plan_name = ${sqlString(input.planName)},
  policy_number = ${sqlString(input.policyNumber)},
  group_number = ${sqlString(input.groupNumber)},
  subscriber_relationship = ${sqlString(input.relationship)}
WHERE id = ${integer(legacyId)};
`);
  }

  async deletePatientInsurance(id: number | string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
DELETE FROM insurance_data
WHERE id = ${integer(legacyId)};
`);
  }

  async createAppointment(input: NewAppointment): Promise<number> {
    const recurrence = buildAppointmentRecurrence(input);
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO openemr_postcalendar_events
  (uuid, pc_catid, pc_multiple, pc_aid, pc_pid, pc_title, pc_time, pc_hometext,
   pc_eventDate, pc_endDate, pc_duration, pc_startTime, pc_endTime, pc_eventstatus,
   pc_sharing, pc_apptstatus, pc_facility, pc_billing_location, pc_room, pc_recurrtype, pc_recurrspec)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${integer(input.categoryId ?? 9)}, 0, ${sqlString(String(input.providerId))}, ${sqlString(String(input.patientId))},
   ${sqlString(input.title)}, NOW(), ${sqlString(input.homeText)}, ${sqlString(input.eventDate)}, ${sqlString(recurrence.endDate)},
   ${integer(input.durationSeconds)}, ${sqlString(input.startTime)}, ${sqlString(input.endTime)}, 1, 1, '-',
   ${integer(input.facilityId)}, ${integer(input.billingLocationId)}, ${sqlString(input.room)}, ${integer(recurrence.type)}, ${sqlString(recurrence.spec)});
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async getAppointment(id: number | string): Promise<AppointmentRecord | null> {
    const legacyId = legacyInteger(id);
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT e.pc_eid AS id, e.pc_pid AS patientId, e.pc_aid AS providerId, e.pc_title AS title,
  DATE(e.pc_eventDate) AS eventDate, e.pc_startTime AS startTime, e.pc_endTime AS endTime,
  e.pc_apptstatus AS status, e.pc_facility AS facilityId, e.pc_billing_location AS billingLocationId,
  e.pc_room AS room, e.pc_catid AS categoryId, COALESCE(c.pc_catname, '') AS categoryName,
  COALESCE(e.pc_hometext, '') AS homeText, e.pc_recurrtype AS recurrenceType,
  COALESCE(e.pc_recurrspec, '') AS recurrenceSpec, DATE(e.pc_endDate) AS recurrenceEndDate
FROM openemr_postcalendar_events e
LEFT JOIN openemr_postcalendar_categories c ON c.pc_catid = e.pc_catid
WHERE e.pc_eid = ${integer(legacyId)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      id: Number(row.id),
      patientId: Number(row.patientId),
      providerId: Number(row.providerId),
      title: row.title,
      eventDate: row.eventDate,
      startTime: row.startTime,
      endTime: row.endTime,
      status: row.status,
      facilityId: Number(row.facilityId),
      billingLocationId: Number(row.billingLocationId),
      room: row.room,
      categoryId: Number(row.categoryId),
      categoryName: row.categoryName || appointmentCategoryName(Number(row.categoryId)),
      homeText: row.homeText,
      ...parseAppointmentRecurrence(row.recurrenceType, row.recurrenceSpec, row.recurrenceEndDate)
    };
  }

  async getAppointmentSeriesOccurrences(patientId: number | string, fromDate: string): Promise<AppointmentSeriesOccurrence[]> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT e.pc_eid AS id, e.pc_pid AS patientId, e.pc_title AS title,
  DATE(e.pc_eventDate) AS anchorDate, e.pc_startTime AS startTime,
  e.pc_recurrtype AS recurrenceType, COALESCE(e.pc_recurrspec, '') AS recurrenceSpec,
  DATE(e.pc_endDate) AS recurrenceEndDate
FROM openemr_postcalendar_events e
WHERE e.pc_pid = ${integer(Number(patientId))}
  AND e.pc_recurrtype > 0
  AND e.pc_endDate >= ${sqlString(fromDate)}
ORDER BY e.pc_eventDate, e.pc_startTime, e.pc_eid;
`);
    return rows.flatMap((row) => {
      const recurrence = parseAppointmentRecurrence(row.recurrenceType, row.recurrenceSpec, row.recurrenceEndDate);
      return expandAppointmentSeriesOccurrences({
        id: Number(row.id),
        patientId: Number(row.patientId),
        title: row.title,
        anchorDate: row.anchorDate,
        startTime: row.startTime,
        recurrenceType: recurrence.recurrenceType,
        repeatFrequency: recurrence.repeatFrequency,
        repeatUnit: recurrence.repeatUnit,
        recurrenceEndDate: recurrence.recurrenceEndDate,
        recurrenceExdates: recurrence.recurrenceExdates
      }, fromDate);
    });
  }

  async updateAppointmentStatus(id: number | string, status: string, title: string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE openemr_postcalendar_events
SET pc_apptstatus = ${sqlString(status)}, pc_title = ${sqlString(title)}
WHERE pc_eid = ${integer(legacyId)};
`);
  }

  async updateAppointment(id: number | string, input: AppointmentUpdate): Promise<void> {
    const legacyId = legacyInteger(id);
    const recurrence = buildAppointmentRecurrence(input);
    await this.db.execute(`
UPDATE openemr_postcalendar_events
SET pc_aid = ${sqlString(String(input.providerId))},
  pc_title = ${sqlString(input.title)},
  pc_hometext = ${sqlString(input.homeText ?? "")},
  pc_eventDate = ${sqlString(input.eventDate)},
  pc_endDate = ${sqlString(recurrence.endDate)},
  pc_duration = ${integer(input.durationSeconds)},
  pc_startTime = ${sqlString(input.startTime)},
  pc_endTime = ${sqlString(input.endTime)},
  pc_apptstatus = ${sqlString(input.status)},
  pc_facility = ${integer(input.facilityId)},
  pc_billing_location = ${integer(input.billingLocationId)},
  pc_room = ${sqlString(input.room)},
  pc_catid = ${input.categoryId === undefined ? "pc_catid" : integer(input.categoryId)},
  pc_recurrtype = ${integer(recurrence.type)},
  pc_recurrspec = ${sqlString(recurrence.spec)}
WHERE pc_eid = ${integer(legacyId)};
`);
  }

  async deleteAppointment(id: number | string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
DELETE FROM openemr_postcalendar_events
WHERE pc_eid = ${integer(legacyId)};
`);
  }

  async createClinicalListEntry(input: NewClinicalListEntry): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO lists
  (uuid, date, type, title, begdate, diagnosis, activity, comments, pid, user, groupname,
   reaction, severity_al, list_option_id)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${sqlString(input.dateTime)}, ${sqlString(input.type)}, ${sqlString(input.title)},
   ${sqlString(input.dateTime)}, '', 1, ${sqlString(input.comments)}, ${integer(input.patientId)}, 'admin', 'Default',
   ${sqlString(input.reaction)}, ${sqlString(input.severity)}, ${sqlString(input.listOptionId)});
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async getClinicalListEntry(id: number | string): Promise<ClinicalListRecord | null> {
    const legacyId = legacyInteger(id);
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS patientId, type, title, activity, comments, reaction, severity_al AS severity,
  list_option_id AS listOptionId
FROM lists
WHERE id = ${integer(legacyId)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      id: Number(row.id),
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
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE lists
SET activity = 0, enddate = '2026-06-18 00:00:00', comments = ${sqlString(comments)}
WHERE id = ${integer(legacyId)};
`);
  }

  async deleteClinicalListEntry(id: number | string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
DELETE FROM lists
WHERE id = ${integer(legacyId)};
`);
  }

  async createProblem(input: NewProblem): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO lists
  (uuid, date, type, title, begdate, diagnosis, activity, comments, pid, user, groupname,
   reaction, severity_al, list_option_id)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${sqlString(input.dateTime)}, 'medical_problem', ${sqlString(input.title)},
   ${sqlString(input.dateTime)}, ${sqlString(input.diagnosis)}, 1, ${sqlString(input.comments)},
   ${integer(input.patientId)}, 'admin', 'Default', '', '', '');
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async getProblem(id: number | string): Promise<ProblemRecord | null> {
    const legacyId = legacyInteger(id);
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS patientId, type, title, activity, COALESCE(comments, '') AS comments,
  COALESCE(diagnosis, '') AS diagnosis, DATE(date) AS date
FROM lists
WHERE id = ${integer(legacyId)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
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
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE lists
SET activity = 0, enddate = '2026-06-18 00:00:00', comments = ${sqlString(comments)}
WHERE id = ${integer(legacyId)} AND type = 'medical_problem';
`);
  }

  async deleteProblem(id: number | string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
DELETE FROM lists
WHERE id = ${integer(legacyId)} AND type = 'medical_problem';
`);
  }

  async createMedication(input: NewMedication): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO lists
  (uuid, date, type, title, begdate, diagnosis, activity, comments, pid, user, groupname,
   reaction, severity_al, list_option_id)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${sqlString(input.dateTime)}, 'medication', ${sqlString(input.title)},
   ${sqlString(input.dateTime)}, ${sqlString(input.diagnosis)}, 1, ${sqlString(input.comments)},
   ${integer(input.patientId)}, 'admin', 'Default', '', '', '');
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async getMedication(id: number | string): Promise<MedicationRecord | null> {
    const legacyId = legacyInteger(id);
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS patientId, type, title, activity, COALESCE(comments, '') AS comments,
  COALESCE(diagnosis, '') AS diagnosis, DATE(date) AS date
FROM lists
WHERE id = ${integer(legacyId)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
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
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE lists
SET activity = 0, enddate = '2026-06-18 00:00:00', comments = ${sqlString(comments)}
WHERE id = ${integer(legacyId)} AND type = 'medication';
`);
  }

  async deleteMedication(id: number | string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
DELETE FROM lists
WHERE id = ${integer(legacyId)} AND type = 'medication';
`);
  }

  async createPatientMessage(input: NewPatientMessage): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO pnotes
  (date, body, pid, user, groupname, activity, authorized, title, assigned_to, message_status)
VALUES
  (NOW(), ${sqlString(input.body)}, ${integer(input.patientId)}, 'admin', 'Default', 1, 1,
   ${sqlString(input.title)}, ${sqlString(input.assignedTo)}, 'New');
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async createCollectionsFollowUpTask(input: NewCollectionsFollowUpTask): Promise<number> {
    return this.createPatientMessage({
      patientId: input.patientId,
      title: `Collections follow-up: ${input.statementNumber}`,
      body: buildCollectionsFollowUpBody(input),
      assignedTo: input.assignedTo
    });
  }

  async getPatientMessage(id: number | string): Promise<PatientMessageRecord | null> {
    const legacyId = legacyInteger(id);
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS patientId, title, body, message_status AS status, assigned_to AS assignedTo,
  COALESCE(deleted, 0) AS deleted
FROM pnotes
WHERE id = ${integer(legacyId)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      id: Number(row.id),
      patientId: Number(row.patientId),
      title: row.title,
      body: row.body,
      status: row.status,
      assignedTo: row.assignedTo,
      deleted: Number(row.deleted)
    };
  }

  async updatePatientMessageStatus(id: number | string, status: string, body: string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE pnotes
SET message_status = ${sqlString(status)}, body = ${sqlString(body)}, update_by = 1, update_date = NOW()
WHERE id = ${integer(legacyId)};
`);
  }

  async updatePatientMessageContent(id: number | string, title: string, body: string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE pnotes
SET title = ${sqlString(title)}, body = ${sqlString(body)}, update_by = 1, update_date = NOW()
WHERE id = ${integer(legacyId)};
`);
  }

  async updatePatientMessageAssignment(id: number | string, assignedTo: string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE pnotes
SET assigned_to = ${sqlString(assignedTo)}, update_by = 1, update_date = NOW()
WHERE id = ${integer(legacyId)};
`);
  }

  async softDeletePatientMessage(id: number | string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE pnotes
SET deleted = 1, activity = 0, update_by = 1, update_date = NOW()
WHERE id = ${integer(legacyId)};
`);
  }

  async deletePatientMessage(id: number | string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
DELETE FROM pnotes
WHERE id = ${integer(legacyId)};
`);
  }

  async createPatientDocument(input: NewPatientDocument): Promise<number> {
    const nextRows = await this.db.queryRows<{ id: string }>(`
SELECT GREATEST(COALESCE(MAX(id), 8999999) + 1, 9000000) AS id
FROM documents;
`);
    const id = Number(nextRows[0]?.id);
    const documentKey = `DOC-PARITY-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const content = `Gold synthetic document ${documentKey}\n${input.content}`;

    await this.db.execute(`
INSERT INTO documents
  (id, uuid, type, size, date, url, mimetype, pages, owner, revision, foreign_id, docdate, hash,
   list_id, name, storagemethod, path_depth, imported, encounter_id, encounter_check,
   audit_master_approval_status, documentationOf, encrypted, document_data, deleted)
VALUES
  (${integer(id)}, UNHEX(REPLACE(UUID(), '-', '')), 'blob', CHAR_LENGTH(${sqlString(content)}), NOW(),
   ${sqlString(`gold://documents/${documentKey}`)}, 'text/plain', 1, 1, NOW(), ${integer(input.patientId)},
   ${sqlString(input.docDate)}, SHA1(${sqlString(content)}), 0, ${sqlString(input.name)}, 0, 0, 0,
   ${integer(input.encounter)}, 1, 1, ${sqlString(input.notes)}, 0, ${sqlString(content)}, 0);

INSERT INTO categories_to_documents (category_id, document_id)
VALUES (${integer(input.categoryId)}, ${integer(id)});
`);

    return id;
  }

  async createEncounterDocument(input: NewEncounterDocument): Promise<number> {
    return this.createPatientDocument(input);
  }

  async createEncounterBinaryDocument(input: NewEncounterBinaryDocument): Promise<number> {
    return this.createPatientBinaryDocument(input);
  }

  async createEncounterExternalLinkDocument(input: NewEncounterExternalLinkDocument): Promise<number> {
    return this.createPatientExternalLinkDocument(input);
  }

  async createPatientBinaryDocument(input: NewPatientBinaryDocument): Promise<number> {
    const nextRows = await this.db.queryRows<{ id: string }>(`
SELECT GREATEST(COALESCE(MAX(id), 8999999) + 1, 9000000) AS id
FROM documents;
`);
    const id = Number(nextRows[0]?.id);
    const documentKey = `DOC-BINARY-PARITY-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const contentBytes = Buffer.from(input.contentBase64, "base64");
    const contentHex = contentBytes.toString("hex");
    const pages = input.mimetype === "application/pdf" ? 1 : 0;

    await this.db.execute(`
INSERT INTO documents
  (id, uuid, type, size, date, url, mimetype, pages, owner, revision, foreign_id, docdate, hash,
   list_id, name, storagemethod, path_depth, imported, encounter_id, encounter_check,
   audit_master_approval_status, documentationOf, encrypted, document_data, deleted)
VALUES
  (${integer(id)}, UNHEX(REPLACE(UUID(), '-', '')), 'blob', ${integer(contentBytes.length)}, NOW(),
   ${sqlString(`gold://documents/${documentKey}/${input.fileName}`)}, ${sqlString(input.mimetype)}, ${integer(pages)}, 1, NOW(),
   ${integer(input.patientId)}, ${sqlString(input.docDate)}, SHA1(UNHEX(${sqlString(contentHex)})), 0, ${sqlString(input.name)},
   0, 0, 0, ${integer(input.encounter)}, 1, 1, ${sqlString(input.notes)}, 0, UNHEX(${sqlString(contentHex)}), 0);

INSERT INTO categories_to_documents (category_id, document_id)
VALUES (${integer(input.categoryId)}, ${integer(id)});
`);

    return id;
  }

  async createPatientExternalLinkDocument(input: NewPatientExternalLinkDocument): Promise<number> {
    const nextRows = await this.db.queryRows<{ id: string }>(`
SELECT GREATEST(COALESCE(MAX(id), 8999999) + 1, 9000000) AS id
FROM documents;
`);
    const id = Number(nextRows[0]?.id);
    const documentKey = `DOC-WEBLINK-PARITY-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const content = `External document link: ${input.url}`;

    await this.db.execute(`
INSERT INTO documents
  (id, uuid, type, size, date, url, mimetype, pages, owner, revision, foreign_id, docdate, hash,
   list_id, name, storagemethod, path_depth, imported, encounter_id, encounter_check,
   audit_master_approval_status, documentationOf, encrypted, document_data, deleted)
VALUES
  (${integer(id)}, UNHEX(REPLACE(UUID(), '-', '')), 'web_url', CHAR_LENGTH(${sqlString(content)}), NOW(),
   ${sqlString(input.url)}, 'text/uri-list', 0, 1, NOW(), ${integer(input.patientId)},
   ${sqlString(input.docDate)}, SHA1(${sqlString(content)}), 0, ${sqlString(input.name)}, 0, 0, 0,
   ${integer(input.encounter)}, 1, 1, ${sqlString(input.notes)}, 0, ${sqlString(content)}, 0);

INSERT INTO categories_to_documents (category_id, document_id)
VALUES (${integer(input.categoryId)}, ${integer(id)});
`);

    return id;
  }

  async getPatientDocument(id: number | string): Promise<PatientDocumentRecord | null> {
    const legacyId = legacyInteger(id);
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT d.id,
  d.foreign_id AS patientId,
  CASE
    WHEN SUBSTRING_INDEX(COALESCE(CONVERT(d.document_data USING utf8mb4), ''), '\n', 1) LIKE 'Gold synthetic document %'
      THEN SUBSTRING_INDEX(SUBSTRING_INDEX(COALESCE(CONVERT(d.document_data USING utf8mb4), ''), '\n', 1), ' ', -1)
    WHEN d.url LIKE 'gold://documents/%' THEN SUBSTRING_INDEX(SUBSTRING_INDEX(d.url, 'gold://documents/', -1), '/', 1)
    ELSE SUBSTRING_INDEX(SUBSTRING_INDEX(COALESCE(CONVERT(d.document_data USING utf8mb4), ''), '\n', 1), ' ', -1)
  END AS documentKey,
  COALESCE(c.id, 0) AS categoryId,
  COALESCE(c.name, '') AS categoryName,
  d.name,
  DATE(d.docdate) AS docDate,
  COALESCE(d.encounter_id, 0) AS encounter,
  COALESCE(d.mimetype, '') AS mimetype,
  COALESCE(d.url, '') AS url,
  COALESCE(d.name, '') AS fileName,
  COALESCE(d.size, 0) AS sizeBytes,
  CASE
    WHEN d.type = 'web_url' THEN 'web_url'
    WHEN d.type = 'file_url' THEN 'file_url'
    WHEN COALESCE(d.storagemethod, 0) = 0 THEN 'database'
    ELSE CAST(d.storagemethod AS CHAR)
  END AS storageMethod,
  COALESCE(d.deleted, 0) AS deleted,
  CASE COALESCE(d.audit_master_approval_status, 1)
    WHEN 1 THEN 'pending'
    WHEN 2 THEN 'approved'
    WHEN 3 THEN 'denied'
    ELSE CONCAT('status-', COALESCE(d.audit_master_approval_status, 1))
  END AS reviewStatus,
  CASE WHEN COALESCE(d.audit_master_approval_status, 1) IN (2, 3) THEN 'admin' ELSE '' END AS reviewedBy,
  CASE WHEN COALESCE(d.audit_master_approval_status, 1) IN (2, 3) THEN DATE_FORMAT(d.revision, '%Y-%m-%d %H:%i:%s') ELSE '' END AS reviewedAt,
  COALESCE(d.documentationOf, '') AS notes,
  TO_BASE64(COALESCE(d.document_data, '')) AS contentBase64,
  LEFT(COALESCE(CONVERT(d.document_data USING utf8mb4), ''), 260) AS contentPreview
FROM documents d
LEFT JOIN categories_to_documents ctd ON ctd.document_id = d.id
LEFT JOIN categories c ON c.id = ctd.category_id
WHERE d.id = ${integer(legacyId)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    const contentBase64 = row.contentBase64.replace(/\\n/g, "").replace(/\s/g, "");

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
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE documents
SET name = ${sqlString(input.name)},
    docdate = ${sqlString(input.docDate)},
    encounter_id = ${nullableInteger(input.encounter)},
    documentationOf = ${sqlString(input.notes)},
    revision = NOW()
WHERE id = ${integer(legacyId)};

DELETE FROM categories_to_documents
WHERE document_id = ${integer(legacyId)};

INSERT INTO categories_to_documents (category_id, document_id)
VALUES (${integer(input.categoryId)}, ${integer(legacyId)});
`);
  }

  async updateEncounterDocumentMetadata(
    _encounter: number,
    id: number | string,
    input: PatientDocumentMetadataUpdate
  ): Promise<void> {
    await this.updatePatientDocumentMetadata(id, input);
  }

  async moveEncounterDocument(sourceEncounter: number, id: number | string, targetEncounter: number): Promise<void> {
    const document = await this.getPatientDocument(id);
    if (!document) {
      throw new Error(`Legacy encounter document ${id} was not found.`);
    }

    if (document.encounter !== sourceEncounter) {
      throw new Error(`Legacy encounter document ${id} is linked to encounter ${document.encounter}, not ${sourceEncounter}.`);
    }

    await this.updateEncounterDocumentMetadata(sourceEncounter, id, {
      categoryId: document.categoryId,
      categoryName: document.categoryName,
      name: document.name,
      docDate: document.docDate,
      encounter: targetEncounter,
      notes: document.notes
    });
  }

  async replacePatientDocumentContent(id: number | string, input: PatientDocumentContentReplacement): Promise<void> {
    const legacyId = legacyInteger(id);
    const content = `Gold synthetic document ${input.fileName}\n${input.content}`;
    await this.db.execute(`
UPDATE documents
SET type = 'blob',
    size = CHAR_LENGTH(${sqlString(content)}),
    date = NOW(),
    mimetype = 'text/plain',
    pages = 1,
    revision = NOW(),
    hash = SHA1(${sqlString(content)}),
    storagemethod = 0,
    document_data = ${sqlString(content)}
WHERE id = ${integer(legacyId)} AND COALESCE(deleted, 0) = 0;
`);
  }

  async replaceEncounterDocumentContent(
    _encounter: number,
    id: number | string,
    input: PatientDocumentContentReplacement
  ): Promise<void> {
    await this.replacePatientDocumentContent(id, input);
  }

  async softDeleteEncounterDocument(_encounter: number, id: number | string): Promise<void> {
    await this.softDeletePatientDocument(id);
  }

  async restoreEncounterDocument(_encounter: number, id: number | string): Promise<void> {
    await this.restorePatientDocument(id);
  }

  async signPatientDocument(id: number | string, _reviewedBy = "admin"): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE documents
SET audit_master_approval_status = 2,
    owner = 1,
    revision = NOW()
WHERE id = ${integer(legacyId)};
`);
  }

  async signEncounterDocument(_encounter: number, id: number | string, reviewedBy = "admin"): Promise<void> {
    await this.signPatientDocument(id, reviewedBy);
  }

  async denyEncounterDocument(_encounter: number, id: number | string, reviewedBy = "admin"): Promise<void> {
    await this.denyPatientDocument(id, reviewedBy);
  }

  async denyPatientDocument(id: number | string, _reviewedBy = "admin"): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE documents
SET audit_master_approval_status = 3,
    owner = 1,
    revision = NOW()
WHERE id = ${integer(legacyId)};
`);
  }

  async softDeletePatientDocument(id: number | string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE documents
SET deleted = 1
WHERE id = ${integer(legacyId)};
`);
  }

  async restorePatientDocument(id: number | string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE documents
SET deleted = 0
WHERE id = ${integer(legacyId)};
`);
  }

  async deletePatientDocument(id: number | string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
DELETE FROM categories_to_documents
WHERE document_id = ${integer(legacyId)};

DELETE FROM documents
WHERE id = ${integer(legacyId)};
`);
  }

  async createPrescription(input: NewPrescription): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO prescriptions
  (uuid, patient_id, filled_by_id, date_added, date_modified, provider_id, encounter, start_date,
   drug, rxnorm_drugcode, dosage, quantity, route, refills, medication, note, active, datetime,
   user, site, txDate, usage_category_title, request_intent_title, diagnosis, created_by, updated_by)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${integer(input.patientId)}, 1, NOW(), NOW(), ${integer(input.providerId)}, 0,
   ${sqlString(input.startDate)}, ${sqlString(input.drug)}, ${sqlString(input.rxNormCode)}, ${sqlString(input.dosage)},
   ${sqlString(input.quantity)}, 'oral', ${integer(input.refills)}, 1, ${sqlString(input.note)}, 1, NOW(), 'admin',
   'default', ${sqlString(input.startDate)}, 'community', 'order', ${sqlString(input.diagnosis)}, 1, 1);
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async getPrescription(id: number | string): Promise<PrescriptionRecord | null> {
    const legacyId = legacyInteger(id);
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, patient_id AS patientId, provider_id AS providerId, DATE(start_date) AS startDate,
  DATE(end_date) AS endDate, drug, dosage, quantity, refills, active, note
FROM prescriptions
WHERE id = ${integer(legacyId)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      id: Number(row.id),
      patientId: Number(row.patientId),
      providerId: Number(row.providerId),
      startDate: row.startDate,
      endDate: dbNullToNull(row.endDate),
      drug: row.drug,
      dosage: row.dosage,
      quantity: row.quantity,
      refills: Number(row.refills),
      active: Number(row.active),
      note: row.note
    };
  }

  async deactivatePrescription(id: number | string, endDate: string, note: string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE prescriptions
SET active = 0, end_date = ${sqlString(endDate)}, note = ${sqlString(note)}, date_modified = NOW(), updated_by = 1
WHERE id = ${integer(legacyId)};
`);
  }

  async deletePrescription(id: number | string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
DELETE FROM prescriptions
WHERE id = ${integer(legacyId)};
`);
  }

  async createImmunization(input: NewImmunization): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO immunizations
  (uuid, patient_id, administered_date, immunization_id, cvx_code, manufacturer, lot_number,
   administered_by_id, administered_by, education_date, vis_date, note, create_date, update_date,
   created_by, updated_by, amount_administered, amount_administered_unit, expiration_date, route,
   administration_site, added_erroneously, completion_status, information_source, encounter_id)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${integer(input.patientId)}, ${sqlString(input.administeredAt)},
   ${integer(input.immunizationId)}, ${sqlString(input.cvxCode)}, ${sqlString(input.manufacturer)},
   ${sqlString(input.lotNumber)}, ${integer(input.providerId)}, ${sqlString(input.administeredBy)},
   ${sqlString(input.educationDate)}, ${sqlString(input.visDate)}, ${sqlString(input.note)},
   NOW(), NOW(), 1, 1, ${input.amountAdministered}, ${sqlString(input.amountAdministeredUnit)},
   ${sqlString(input.expirationDate)}, ${sqlString(input.route)}, ${sqlString(input.administrationSite)},
   0, ${sqlString(input.completionStatus)}, ${sqlString(input.informationSource)}, ${integer(input.encounter ?? 0)});
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async getImmunization(id: number | string): Promise<ImmunizationRecord | null> {
    const legacyId = legacyInteger(id);
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT i.id,
  i.patient_id AS patientId,
  COALESCE(i.immunization_id, 0) AS immunizationId,
  COALESCE(i.cvx_code, '') AS cvxCode,
  COALESCE(NULLIF(c.code_text_short, ''), NULLIF(lo.title, ''), NULLIF(i.note, ''), COALESCE(i.cvx_code, '')) AS vaccine,
  DATE(i.administered_date) AS administeredDate,
  COALESCE(i.manufacturer, '') AS manufacturer,
  COALESCE(i.lot_number, '') AS lotNumber,
  COALESCE(i.administered_by, '') AS administeredBy,
  COALESCE(i.route, '') AS route,
  COALESCE(i.administration_site, '') AS administrationSite,
  COALESCE(i.completion_status, '') AS completionStatus,
  COALESCE(i.information_source, '') AS informationSource,
  COALESCE(i.note, '') AS note,
  COALESCE(i.added_erroneously, 0) AS addedErroneously,
  COALESCE(i.encounter_id, 0) AS encounter
FROM immunizations i
LEFT JOIN code_types ct ON ct.ct_key = 'CVX'
LEFT JOIN codes c ON c.code_type = ct.ct_id AND i.cvx_code = c.code
LEFT JOIN list_options lo ON lo.list_id = 'immunizations' AND lo.option_id = CAST(i.immunization_id AS CHAR)
WHERE i.id = ${integer(legacyId)}
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
      encounter: Number(row.encounter) > 0 ? Number(row.encounter) : null
    };
  }

  async markImmunizationEnteredInError(id: number | string, note: string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE immunizations
SET added_erroneously = 1, note = ${sqlString(note)}, update_date = NOW(), updated_by = 1
WHERE id = ${integer(legacyId)};
`);
  }

  async deleteImmunization(id: number | string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
DELETE FROM immunizations
WHERE id = ${integer(legacyId)};
`);
  }

  async createEncounter(input: NewEncounter): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO form_encounter
  (uuid, date, reason, facility, facility_id, pid, encounter, pc_catid, provider_id, billing_facility, class_code,
   sensitivity, referral_source, external_id, pos_code, billing_note)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${sqlString(input.dateTime)}, ${sqlString(input.reason)}, ${sqlString(input.facilityName)},
   ${integer(input.facilityId)}, ${integer(input.patientId)}, 0, 9, ${integer(input.providerId)},
   ${integer(input.billingFacilityId)}, 'AMB', ${nullableSqlString(input.sensitivity)}, ${nullableSqlString(input.referralSource)},
   ${nullableSqlString(input.externalId)}, ${nullableInteger(input.posCode)}, ${sqlString(input.billingNote)});
SELECT LAST_INSERT_ID() AS id;
`);
    const encounterId = Number(rows[0]?.id);
    await this.db.execute(`
UPDATE form_encounter
SET encounter = ${integer(encounterId)}
WHERE id = ${integer(encounterId)};
`);
    return encounterId;
  }

  async getEncounter(id: number): Promise<EncounterRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, encounter, pid AS patientId, provider_id AS providerId, DATE(date) AS date,
  reason, facility_id AS facilityId, billing_facility AS billingFacilityId,
  COALESCE(sensitivity, '') AS sensitivity, COALESCE(referral_source, '') AS referralSource,
  COALESCE(external_id, '') AS externalId, pos_code AS posCode, COALESCE(billing_note, '') AS billingNote
FROM form_encounter
WHERE id = ${integer(id)}
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
      posCode: row.posCode ? Number(row.posCode) : null,
      billingNote: row.billingNote
    };
  }

  async updateEncounterReason(
    id: number,
    reason: string,
    billingNote: string,
    metadata?: EncounterMetadataInput
  ): Promise<void> {
    const metadataSet = metadata
      ? `,
    sensitivity = ${nullableSqlString(metadata.sensitivity)},
    referral_source = ${nullableSqlString(metadata.referralSource)},
    external_id = ${nullableSqlString(metadata.externalId)},
    pos_code = ${nullableInteger(metadata.posCode)}`
      : "";
    await this.db.execute(`
UPDATE form_encounter
SET reason = ${sqlString(reason)}, billing_note = ${sqlString(billingNote)}${metadataSet}
WHERE id = ${integer(id)};
`);
  }

  async signEncounter(id: number, input: NewEncounterSignature): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO esign_signatures
  (tid, \`table\`, uid, \`datetime\`, is_lock, amendment, hash, signature_hash)
SELECT fe.id,
  'form_encounter',
  u.id,
  ${sqlString(input.signedAt)},
  ${input.isLock ? 1 : 0},
  ${sqlString(input.amendment)},
  SHA2(CONCAT(fe.id, '|form_encounter|', u.username, '|', ${sqlString(input.signedAt)}, '|', ${input.isLock ? 1 : 0}, '|', ${sqlString(input.amendment)}), 256),
  SHA2(CONCAT(u.username, '|', fe.id, '|', ${sqlString(input.signedAt)}), 256)
FROM form_encounter fe
INNER JOIN users u ON u.username = ${sqlString(input.signerUsername)}
WHERE fe.id = ${integer(id)}
LIMIT 1;
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async getEncounterSignature(id: number): Promise<EncounterSignatureRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT es.id, es.tid AS encounterId, es.\`table\` AS tableName, u.username AS signerUsername,
  DATE_FORMAT(es.datetime, '%Y-%m-%d %H:%i') AS signedAt,
  es.is_lock AS isLock, COALESCE(es.amendment, '') AS amendment,
  es.hash, es.signature_hash AS signatureHash
FROM esign_signatures es
INNER JOIN users u ON u.id = es.uid
WHERE es.id = ${integer(id)} AND es.\`table\` = 'form_encounter'
LIMIT 1;
`);
    const row = rows[0];
    return row ? {
      id: Number(row.id),
      encounterId: Number(row.encounterId),
      tableName: row.tableName,
      signerUsername: row.signerUsername,
      signedAt: row.signedAt,
      isLock: Number(row.isLock) === 1,
      amendment: row.amendment,
      hash: row.hash,
      signatureHash: row.signatureHash
    } : null;
  }

  async deleteEncounterSignature(id: number): Promise<void> {
    await this.db.execute(`
DELETE FROM esign_signatures
WHERE id = ${integer(id)} AND \`table\` = 'form_encounter';
`);
  }

  async deleteEncounter(id: number): Promise<void> {
    await this.db.execute(`
DELETE FROM esign_signatures
WHERE tid = ${integer(id)} AND \`table\` = 'form_encounter';
DELETE FROM form_encounter
WHERE id = ${integer(id)};
`);
  }

  async createVitals(input: NewVitals): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO form_vitals
  (uuid, date, pid, user, groupname, authorized, activity, bps, bpd, weight, height, pulse, oxygen_saturation, note)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${sqlString(input.dateTime)}, ${integer(input.patientId)}, 'admin', 'Default',
   1, 1, ${sqlString(input.bps)}, ${sqlString(input.bpd)}, ${decimal(input.weight)}, ${decimal(input.height)},
   ${decimal(input.pulse)}, ${decimal(input.oxygenSaturation)}, ${sqlString(input.note)});
SELECT LAST_INSERT_ID() AS id;
`);
    const vitalsId = Number(rows[0]?.id);
    await this.createFormLink({
      dateTime: input.dateTime,
      encounter: input.encounter,
      formName: "Vitals",
      formId: vitalsId,
      patientId: input.patientId,
      formDir: "vitals"
    });
    return vitalsId;
  }

  async getVitals(id: number): Promise<VitalsRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS patientId, bps, bpd, weight, height, pulse, oxygen_saturation AS oxygenSaturation, note
FROM form_vitals
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
    await this.db.execute(`
DELETE FROM forms
WHERE form_name = 'Vitals' AND form_id = ${integer(id)};
DELETE FROM form_vitals
WHERE id = ${integer(id)};
`);
  }

  async createSoapNote(input: NewSoapNote): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO form_soap
  (date, pid, user, groupname, authorized, activity, subjective, objective, assessment, plan)
VALUES
  (${sqlString(input.dateTime)}, ${integer(input.patientId)}, 'admin', 'Default', 1, 1,
   ${sqlString(input.subjective)}, ${sqlString(input.objective)}, ${sqlString(input.assessment)}, ${sqlString(input.plan)});
SELECT LAST_INSERT_ID() AS id;
`);
    const soapId = Number(rows[0]?.id);
    await this.createFormLink({
      dateTime: input.dateTime,
      encounter: input.encounter,
      formName: "SOAP",
      formId: soapId,
      patientId: input.patientId,
      formDir: "soap"
    });
    return soapId;
  }

  async getSoapNote(id: number): Promise<SoapNoteRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS patientId, subjective, objective, assessment, plan
FROM form_soap
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
    await this.db.execute(`
DELETE FROM forms
WHERE form_name = 'SOAP' AND form_id = ${integer(id)};
DELETE FROM form_soap
WHERE id = ${integer(id)};
`);
  }

  async createBillingLine(input: NewBillingLine): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO billing
  (date, code_type, code, pid, provider_id, user, groupname, authorized, encounter,
   code_text, billed, activity, modifier, units, fee, justify)
VALUES
  (${sqlString(input.dateTime)}, ${sqlString(input.codeType)}, ${sqlString(input.code)}, ${integer(input.patientId)},
   ${integer(input.providerId)}, 1, 'Default', 1, ${integer(input.encounter)}, ${sqlString(input.codeText)},
   0, 1, ${sqlString(input.modifier ?? "")}, ${integer(input.units)}, ${decimal(Number(input.fee))}, ${sqlString(input.justify)});
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async getBillingLine(id: number | string): Promise<BillingLineRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS patientId, encounter, code_type AS codeType, code, code_text AS codeText,
  COALESCE(modifier, '') AS modifier, fee, COALESCE(justify, '') AS justify, units, activity, billed
FROM billing
WHERE id = ${legacyInteger(id)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      id: Number(row.id),
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
    await this.db.execute(`
UPDATE billing
SET code_text = ${sqlString(input.codeText)},
    modifier = ${sqlString(input.modifier ?? "")},
    fee = ${decimal(Number(input.fee))},
    units = ${integer(input.units)},
    justify = ${sqlString(input.justify)}
WHERE id = ${legacyInteger(id)};
`);
  }

  async updateBillingLineStatus(id: number | string, billed: number, activity: number): Promise<void> {
    await this.db.execute(`
UPDATE billing
SET billed = ${integer(billed)}, activity = ${integer(activity)}
WHERE id = ${legacyInteger(id)};
`);
  }

  async deleteBillingLine(id: number | string): Promise<void> {
    await this.db.execute(`
DELETE FROM billing
WHERE id = ${legacyInteger(id)};
`);
  }

  async createClaimStatus(input: NewClaimStatus): Promise<string> {
    const rows = await this.db.queryRows<{ id: string }>(`
SET @version := (
  SELECT COALESCE(MAX(version), 0) + 1
  FROM claims
  WHERE patient_id = ${integer(input.patientId)} AND encounter_id = ${integer(input.encounter)}
);
INSERT INTO claims
  (patient_id, encounter_id, version, payer_id, status, payer_type, bill_process,
   bill_time, process_time, process_file, target, x12_partner_id, submitted_claim)
VALUES
  (${integer(input.patientId)}, ${integer(input.encounter)}, @version, ${integer(input.payerId)},
   ${integer(input.status)}, ${integer(input.payerType)}, ${integer(input.billProcess)},
   ${sqlString(input.billTime)}, ${nullableSqlString(input.processTime)}, ${sqlString(input.processFile)},
   ${sqlString(input.target)}, ${integer(input.x12PartnerId)}, ${sqlString(input.submittedClaim)});
SELECT CONCAT(${integer(input.patientId)}, ':', ${integer(input.encounter)}, ':', @version) AS id;
`);
    return rows[0]?.id ?? `${input.patientId}:${input.encounter}:0`;
  }

  async getClaimStatus(id: number | string): Promise<ClaimStatusRecord | null> {
    const key = claimStatusKey(id);
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT c.patient_id AS patientId, c.encounter_id AS encounter, c.version, c.payer_id AS payerId,
  COALESCE(ic.name, '') AS payerName, c.payer_type AS payerType, c.status, c.bill_process AS billProcess,
  COALESCE(DATE_FORMAT(c.bill_time, '%Y-%m-%d %H:%i:%s'), '') AS billTime,
  COALESCE(DATE_FORMAT(c.process_time, '%Y-%m-%d %H:%i:%s'), '') AS processTime,
  COALESCE(c.process_file, '') AS processFile, COALESCE(c.target, '') AS target,
  c.x12_partner_id AS x12PartnerId, COALESCE(c.submitted_claim, '') AS submittedClaim
FROM claims c
LEFT JOIN insurance_companies ic ON ic.id = c.payer_id
WHERE c.patient_id = ${integer(key.patientId)}
  AND c.encounter_id = ${integer(key.encounter)}
  AND c.version = ${integer(key.version)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: `${row.patientId}:${row.encounter}:${row.version}`,
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
    const key = claimStatusKey(id);
    await this.db.execute(`
UPDATE claims
SET status = ${integer(input.status)},
    bill_process = ${integer(input.billProcess)},
    process_time = ${nullableSqlString(input.processTime)},
    process_file = ${sqlString(input.processFile)},
    target = ${sqlString(input.target)},
    x12_partner_id = ${integer(input.x12PartnerId)},
    submitted_claim = ${sqlString(input.submittedClaim)}
WHERE patient_id = ${integer(key.patientId)}
  AND encounter_id = ${integer(key.encounter)}
  AND version = ${integer(key.version)};
`);
  }

  async deleteClaimStatus(id: number | string): Promise<void> {
    const key = claimStatusKey(id);
    await this.db.execute(`
DELETE FROM claims
WHERE patient_id = ${integer(key.patientId)}
  AND encounter_id = ${integer(key.encounter)}
  AND version = ${integer(key.version)};
`);
  }

  async createPaymentPosting(input: NewPaymentPosting): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
SET @session_id := (SELECT COALESCE(MAX(session_id), 1200000) + 1 FROM ar_session);
SET @sequence_no := (
  SELECT COALESCE(MAX(sequence_no), 0) + 1
  FROM ar_activity
  WHERE pid = ${integer(input.patientId)} AND encounter = ${integer(input.encounter)}
);
INSERT INTO ar_session
  (session_id, payer_id, user_id, closed, reference, check_date, deposit_date, pay_total,
   created_time, modified_time, global_amount, payment_type, description, adjustment_code,
   post_to_date, patient_id, payment_method)
VALUES
  (@session_id, ${integer(input.payerId)}, 119, 1, ${sqlString(input.reference)}, ${sqlString(input.postDate)},
   ${sqlString(input.postDate)}, ${decimal(Number(input.payAmount))}, ${sqlString(`${input.postDate} 10:45:00`)},
   ${sqlString(`${input.postDate} 10:45:00`)}, 0, ${sqlString(input.paymentType)}, ${sqlString(input.memo)},
   ${sqlString(Number(input.adjustmentAmount) > 0 ? "contractual_adjustment" : "")}, ${sqlString(input.postDate)},
   ${integer(input.patientId)}, ${sqlString(input.paymentMethod)});
INSERT INTO ar_activity
  (pid, encounter, sequence_no, code_type, code, modifier, payer_type, post_time, post_user,
   session_id, memo, pay_amount, adj_amount, modified_time, follow_up, follow_up_note,
   account_code, reason_code, deleted, post_date, payer_claim_number)
VALUES
  (${integer(input.patientId)}, ${integer(input.encounter)}, @sequence_no, ${sqlString(input.codeType)},
   ${sqlString(input.code)}, ${sqlString(input.modifier ?? "")}, ${integer(input.payerType)},
   ${sqlString(`${input.postDate} 10:45:00`)}, 119, @session_id, ${sqlString(input.memo)},
   ${decimal(Number(input.payAmount))}, ${decimal(Number(input.adjustmentAmount))},
   ${sqlString(`${input.postDate} 10:45:00`)}, '', '', ${sqlString(input.accountCode)},
   ${sqlString(input.reasonCode)}, NULL, ${sqlString(input.postDate)}, ${sqlString(input.payerClaimNumber)});
SELECT @session_id AS id;
`);
    return Number(rows[0]?.id);
  }

  async getPaymentPosting(id: number | string): Promise<PaymentPostingRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT s.session_id AS id, aa.pid AS patientId, aa.encounter, aa.sequence_no AS sequenceNo,
  s.session_id AS sessionId, s.payer_id AS payerId, COALESCE(ic.name, '') AS payerName,
  aa.payer_type AS payerType, COALESCE(s.reference, '') AS reference,
  COALESCE(s.payment_type, '') AS paymentType, COALESCE(s.payment_method, '') AS paymentMethod,
  COALESCE(DATE_FORMAT(s.check_date, '%Y-%m-%d'), '') AS checkDate,
  COALESCE(DATE_FORMAT(s.deposit_date, '%Y-%m-%d'), '') AS depositDate,
  COALESCE(DATE_FORMAT(aa.post_date, '%Y-%m-%d'), '') AS postDate,
  COALESCE(DATE_FORMAT(aa.post_time, '%Y-%m-%d %H:%i:%s'), '') AS postTime,
  COALESCE(aa.code_type, '') AS codeType, COALESCE(aa.code, '') AS code,
  COALESCE(aa.modifier, '') AS modifier, COALESCE(aa.memo, '') AS memo,
  COALESCE(CAST(aa.pay_amount AS CHAR), '0') AS payAmount,
  COALESCE(CAST(aa.adj_amount AS CHAR), '0') AS adjustmentAmount,
  COALESCE(aa.account_code, '') AS accountCode, COALESCE(aa.reason_code, '') AS reasonCode,
  COALESCE(aa.payer_claim_number, '') AS payerClaimNumber,
  COALESCE(DATE_FORMAT(aa.deleted, '%Y-%m-%d %H:%i:%s'), '') AS deleted
FROM ar_activity aa
INNER JOIN ar_session s ON s.session_id = aa.session_id
LEFT JOIN insurance_companies ic ON ic.id = s.payer_id
WHERE s.session_id = ${legacyInteger(id)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
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
    await this.db.execute(`
UPDATE ar_activity
SET deleted = NOW(), modified_time = NOW()
WHERE session_id = ${legacyInteger(id)};
`);
  }

  async deletePaymentPosting(id: number | string): Promise<void> {
    await this.db.execute(`
DELETE FROM ar_activity
WHERE session_id = ${legacyInteger(id)};
DELETE FROM ar_session
WHERE session_id = ${legacyInteger(id)};
`);
  }

  async createProcedureOrder(input: NewProcedureOrder): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO procedure_order
  (uuid, provider_id, patient_id, encounter_id, date_ordered, order_priority, order_status,
   patient_instructions, activity, control_id, specimen_type, clinical_hx, order_diagnosis,
   procedure_order_type, order_intent, location_id)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${integer(input.providerId)}, ${integer(input.patientId)}, ${integer(input.encounterId)},
   ${sqlString(input.dateOrdered)}, ${sqlString(input.priority)}, ${sqlString(input.status)},
   ${sqlString(input.instructions)}, 1, ${sqlString(`PARITY-${Date.now()}`)}, 'blood',
   'Parity workflow clinical history', ${sqlString(input.diagnosis)}, 'laboratory_test', 'order', ${integer(input.providerId)});
SELECT LAST_INSERT_ID() AS id;
`);
    const orderId = Number(rows[0]?.id);
    await this.db.execute(`
INSERT INTO procedure_order_code
  (procedure_order_id, procedure_order_seq, procedure_code, procedure_name, procedure_source, diagnoses, procedure_order_title, procedure_type)
VALUES
  (${integer(orderId)}, 1, ${sqlString(input.procedureCode)}, ${sqlString(input.procedureName)}, '1',
   ${sqlString(input.diagnosis)}, ${sqlString(input.procedureName)}, ${sqlString(input.procedureType)});
`);
    return orderId;
  }

  async getProcedureOrder(id: number): Promise<ProcedureOrderRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT po.procedure_order_id AS id, po.patient_id AS patientId, po.encounter_id AS encounterId,
  po.order_status AS orderStatus, po.order_priority AS orderPriority,
  poc.procedure_code AS procedureCode, poc.procedure_name AS procedureName, poc.procedure_type AS procedureType
FROM procedure_order po
LEFT JOIN procedure_order_code poc ON poc.procedure_order_id = po.procedure_order_id AND poc.procedure_order_seq = 1
WHERE po.procedure_order_id = ${integer(id)}
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
    await this.db.execute(`
UPDATE procedure_order
SET order_status = ${sqlString(status)}
WHERE procedure_order_id = ${integer(id)};
`);
  }

  async createProcedureReport(input: NewProcedureReport): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO procedure_report
  (uuid, procedure_order_id, procedure_order_seq, date_collected, date_report, source,
   specimen_num, report_status, review_status, report_notes)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${integer(input.orderId)}, 1, ${sqlString(input.dateCollected)},
   ${sqlString(input.dateReport)}, 1, ${sqlString(input.specimenNumber)}, ${sqlString(input.reportStatus)},
   ${sqlString(input.reviewStatus)}, ${sqlString(input.notes)});
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async getProcedureReport(id: number): Promise<ProcedureReportRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT procedure_report_id AS id, procedure_order_id AS orderId, report_status AS reportStatus,
  review_status AS reviewStatus, COALESCE(report_notes, '') AS reportNotes
FROM procedure_report
WHERE procedure_report_id = ${integer(id)}
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
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO procedure_result
  (uuid, procedure_report_id, result_data_type, result_code, result_text, date, facility,
   units, result, \`range\`, abnormal, comments, result_status)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${integer(input.reportId)}, 'S', ${sqlString(input.resultCode)},
   ${sqlString(input.resultText)}, ${sqlString(input.dateTime)}, ${sqlString(input.facility)}, ${sqlString(input.units)},
   ${sqlString(input.result)}, ${sqlString(input.range)}, ${sqlString(input.abnormal)}, ${sqlString(input.comments)},
   ${sqlString(input.status)});
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async getProcedureResult(id: number): Promise<ProcedureResultRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT procedure_result_id AS id, procedure_report_id AS reportId, result_code AS resultCode,
  result_text AS resultText, result, abnormal, result_status AS status
FROM procedure_result
WHERE procedure_result_id = ${integer(id)}
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
    await this.db.execute(`
DELETE pr
FROM procedure_result pr
INNER JOIN procedure_report rpt ON rpt.procedure_report_id = pr.procedure_report_id
WHERE rpt.procedure_order_id = ${integer(id)};
DELETE FROM procedure_report
WHERE procedure_order_id = ${integer(id)};
DELETE FROM procedure_order_code
WHERE procedure_order_id = ${integer(id)};
DELETE FROM procedure_order
WHERE procedure_order_id = ${integer(id)};
`);
  }

  private async createFormLink(input: {
    dateTime: string;
    encounter: number;
    formName: string;
    formId: number;
    patientId: number;
    formDir: string;
  }): Promise<void> {
    await this.db.execute(`
INSERT INTO forms
  (date, encounter, form_name, form_id, pid, user, groupname, authorized, deleted, formdir, provider_id)
VALUES
  (${sqlString(input.dateTime)}, ${integer(input.encounter)}, ${sqlString(input.formName)}, ${integer(input.formId)},
   ${integer(input.patientId)}, 'admin', 'Default', 1, 0, ${sqlString(input.formDir)}, 1);
`);
  }

  private async deleteAccessControlUser(userValue: string): Promise<void> {
    await this.db.execute(`
DELETE gm
FROM gacl_groups_aro_map gm
INNER JOIN gacl_aro aro ON aro.id = gm.aro_id
WHERE aro.section_value = 'users'
  AND aro.value = ${sqlString(userValue)};
`);
    await this.deleteOrphanAccessControlUser(userValue);
  }

  private async deleteOrphanAccessControlUser(userValue: string): Promise<void> {
    if (userValue === "admin" || userValue === "oe-system") {
      return;
    }

    await this.db.execute(`
DELETE aro
FROM gacl_aro aro
LEFT JOIN gacl_groups_aro_map gm ON gm.aro_id = aro.id
WHERE aro.section_value = 'users'
  AND aro.value = ${sqlString(userValue)}
  AND gm.aro_id IS NULL;
`);
  }

  private async getInsuranceCompanyId(name: string): Promise<number> {
    const existingRows = await this.db.queryRows<{ id: string }>(`
SELECT id
FROM insurance_companies
WHERE name = ${sqlString(name)}
LIMIT 1;
`);
    const existingId = Number(existingRows[0]?.id);
    if (Number.isInteger(existingId)) {
      return existingId;
    }

    const nextRows = await this.db.queryRows<{ id: string }>(`
SELECT GREATEST(COALESCE(MAX(id), 9000) + 1, 990000) AS id
FROM insurance_companies;
`);
    const id = Number(nextRows[0]?.id);
    await this.db.execute(`
INSERT INTO insurance_companies (id, uuid, name, inactive)
VALUES (${integer(id)}, UNHEX(REPLACE(UUID(), '-', '')), ${sqlString(name)}, 0);
`);
    return id;
  }
}

function sqlString(value: string) {
  return `'${escapeSql(value)}'`;
}

function nullableSqlString(value: string | null | undefined) {
  return value === null || value === undefined || value.trim() === "" ? "NULL" : sqlString(value);
}

function integer(value: number) {
  if (!Number.isInteger(value)) {
    throw new Error(`Expected integer value, received ${value}.`);
  }
  return String(value);
}

function nullableInteger(value: number | null | undefined) {
  return value === null || value === undefined ? "NULL" : integer(value);
}

function claimStatusKey(value: number | string) {
  const parts = String(value).split(":").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
    throw new Error(`Expected claim status key patient:encounter:version, received ${value}.`);
  }

  return {
    patientId: parts[0],
    encounter: parts[1],
    version: parts[2]
  };
}

function legacyInteger(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Expected legacy numeric ID, received ${value}.`);
  }
  return parsed;
}

function decimal(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error(`Expected finite decimal value, received ${value}.`);
  }
  return String(value);
}

function dbNullToNull(value: string | undefined) {
  if (!value || value === "NULL" || value === "\\N") {
    return null;
  }
  return value;
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

function buildAppointmentRecurrence(input: NewAppointment | AppointmentUpdate) {
  const type = input.recurrenceType ?? 0;
  const repeatFrequency = type > 0 ? input.repeatFrequency ?? 1 : null;
  const repeatUnit = type > 0 ? input.repeatUnit ?? 1 : null;
  const endDate = type > 0 ? input.recurrenceEndDate ?? input.eventDate : input.eventDate;
  const spec = serializeAppointmentRecurrence(type, repeatFrequency, repeatUnit);
  return { type, repeatFrequency, repeatUnit, endDate, spec };
}

function parseAppointmentRecurrence(typeValue: string, spec: string, endDate: string | null) {
  const recurrenceType = Number(typeValue || 0);
  if (recurrenceType <= 0) {
    return {
      recurrenceType: 0,
      repeatFrequency: null,
      repeatUnit: null,
      recurrenceEndDate: null,
      recurrenceExdates: []
    };
  }

  return {
    recurrenceType,
    repeatFrequency: numberFromSerializedField(spec, "event_repeat_freq"),
    repeatUnit: numberFromSerializedField(spec, "event_repeat_freq_type"),
    recurrenceEndDate: endDate,
    recurrenceExdates: dateListFromSerializedField(spec, "exdate")
  };
}

function numberFromSerializedField(spec: string, fieldName: string) {
  const pattern = new RegExp(`s:${fieldName.length}:"${fieldName}";s:\\d+:"([^"]*)"`);
  const match = pattern.exec(spec);
  return match && match[1] !== "" ? Number(match[1]) : null;
}

function dateListFromSerializedField(spec: string, fieldName: string) {
  const rawValue = stringFromSerializedField(spec, fieldName);
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(/[,\s;]+/)
    .map((value) => value.trim())
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
    .sort();
}

function stringFromSerializedField(spec: string, fieldName: string) {
  const pattern = new RegExp(`s:${fieldName.length}:"${fieldName}";s:\\d+:"([^"]*)"`);
  const match = pattern.exec(spec);
  return match?.[1] ?? "";
}

function serializeAppointmentRecurrence(type: number, repeatFrequency: number | null, repeatUnit: number | null) {
  const fields = {
    event_repeat_freq: type > 0 ? String(repeatFrequency ?? 1) : "",
    event_repeat_freq_type: type > 0 ? String(repeatUnit ?? 1) : "",
    event_repeat_on_num: "1",
    event_repeat_on_day: "0",
    event_repeat_on_freq: "0",
    exdate: ""
  };
  const serialized = Object.entries(fields)
    .map(([key, value]) => `s:${key.length}:"${key}";s:${value.length}:"${value}";`)
    .join("");
  return `a:${Object.keys(fields).length}:{${serialized}}`;
}

function expandAppointmentSeriesOccurrences(
  appointment: {
    id: number | string;
    patientId: number;
    title: string;
    anchorDate: string;
    startTime: string;
    recurrenceType: number;
    repeatFrequency: number | null;
    repeatUnit: number | null;
    recurrenceEndDate: string | null;
    recurrenceExdates?: string[];
  },
  fromDate: string
): AppointmentSeriesOccurrence[] {
  if (appointment.recurrenceType <= 0 || !appointment.recurrenceEndDate) {
    return [];
  }

  const from = parseDateOnly(fromDate);
  const end = parseDateOnly(appointment.recurrenceEndDate);
  const exdates = new Set(appointment.recurrenceExdates ?? []);
  const repeatFrequency = Math.max(1, appointment.repeatFrequency ?? 1);
  const occurrences: AppointmentSeriesOccurrence[] = [];
  let current = parseDateOnly(appointment.anchorDate);
  for (let occurrenceNumber = 1; current <= end && occurrenceNumber <= 366; occurrenceNumber++) {
    const currentDate = formatDateOnly(current);
    if (current >= from && !exdates.has(currentDate)) {
      occurrences.push({
        id: occurrenceNumber === 1 ? appointment.id : `${appointment.id}::occurs::${formatDateOnly(current)}`,
        seriesRootId: appointment.id,
        patientId: appointment.patientId,
        title: appointment.title,
        date: currentDate,
        startTime: appointment.startTime,
        recurrenceType: appointment.recurrenceType,
        repeatFrequency: appointment.repeatFrequency,
        repeatUnit: appointment.repeatUnit,
        recurrenceEndDate: appointment.recurrenceEndDate,
        recurrenceExdates: appointment.recurrenceExdates ?? [],
        recurrenceExceptionCount: appointment.recurrenceExdates?.length ?? 0,
        occurrenceNumber,
        isVirtualOccurrence: occurrenceNumber > 1
      });
    }

    const next = getNextSeriesOccurrenceDate(current, repeatFrequency, appointment.repeatUnit);
    if (next <= current) {
      break;
    }
    current = next;
  }

  return occurrences;
}

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getNextSeriesOccurrenceDate(value: Date, repeatFrequency: number, repeatUnit: number | null) {
  const next = new Date(value.getTime());
  switch (repeatUnit) {
    case 0:
      next.setUTCDate(next.getUTCDate() + repeatFrequency);
      return next;
    case 2:
      next.setUTCMonth(next.getUTCMonth() + repeatFrequency);
      return next;
    case 3:
      next.setUTCFullYear(next.getUTCFullYear() + repeatFrequency);
      return next;
    case 4:
      return addWorkdays(value, repeatFrequency);
    default:
      next.setUTCDate(next.getUTCDate() + repeatFrequency * 7);
      return next;
  }
}

function addWorkdays(value: Date, workdays: number) {
  const next = new Date(value.getTime());
  let added = 0;
  while (added < workdays) {
    next.setUTCDate(next.getUTCDate() + 1);
    if (next.getUTCDay() !== 0 && next.getUTCDay() !== 6) {
      added++;
    }
  }
  return next;
}

function buildCollectionsFollowUpBody(input: NewCollectionsFollowUpTask) {
  const lines = [
    "Collections follow-up created from the work queue.",
    `Patient: ${input.patientDisplayName} (${input.pubpid})`,
    `Statement: ${input.statementNumber}`,
    `Action: ${input.action}`,
    `Priority: ${input.collectionTier}`,
    `Past due: ${formatWorkflowMoney(input.pastDueAmount)}`,
    `Over 90: ${formatWorkflowMoney(input.over90Amount)}`,
    `Balance: ${formatWorkflowMoney(input.balanceDueAmount)}`,
    `Oldest open: ${input.oldestOpenDate} (${input.oldestOpenAgeDays} days)`,
    `Due date: ${input.dueDate}`
  ];

  if (input.note.trim()) {
    lines.push(`Note: ${input.note.trim()}`);
  }

  return lines.join("\n");
}

function formatWorkflowMoney(value: string | number) {
  return `$${Number(value).toFixed(2)}`;
}

function buildDocumentThumbnailDataUri(mimetype: string, contentBase64: string): string | null {
  const normalizedMimetype = mimetype.trim().toLowerCase();
  const normalizedContent = contentBase64.trim();
  if (!normalizedMimetype.startsWith("image/") || normalizedContent.length === 0) {
    return null;
  }

  return `data:${normalizedMimetype};base64,${normalizedContent}`;
}

function mapUser(row: Record<string, string>): UserRecord {
  return {
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
  };
}

function mapFacility(row: Record<string, string>): FacilityRecord {
  return {
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
  };
}
