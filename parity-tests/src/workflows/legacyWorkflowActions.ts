import { buildPatientDocumentScanFields, escapeSql, type LegacyMariaDbProbe } from "../db/legacyMariaDbProbe.js";

type ProcedureCompendiumCsvRow = {
  orderCode: string;
  orderName: string;
  resultCode?: string;
  resultName?: string;
};

function parseProcedureCompendiumCsv(csvText: string, vendorFormat: "pathgroup" | "ympg-dpmg"): ProcedureCompendiumCsvRow[] {
  const parsedRows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const current = csvText[index];
    if (inQuotes) {
      if (current === '"') {
        if (csvText[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += current;
      }
      continue;
    }

    if (current === '"') {
      inQuotes = true;
      continue;
    }
    if (current === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (current === "\r" || current === "\n") {
      row.push(field);
      if (row.some((value) => value.trim())) {
        parsedRows.push(row);
      }
      row = [];
      field = "";
      if (current === "\r" && csvText[index + 1] === "\n") {
        index += 1;
      }
      continue;
    }

    field += current;
  }

  row.push(field);
  if (row.some((value) => value.trim())) {
    parsedRows.push(row);
  }

  const seen = new Set<string>();
  const rows: ProcedureCompendiumCsvRow[] = [];
  for (const columns of parsedRows) {
    const orderCode = columns[0]?.trim();
    const orderName = columns[1]?.trim();
    if (!orderCode || orderCode.toLowerCase() === "order code" || !orderName) {
      continue;
    }
    if (vendorFormat === "pathgroup" && columns.length < 4) {
      continue;
    }

    const resultCode = vendorFormat === "pathgroup" ? columns[2]?.trim() : undefined;
    const resultName = vendorFormat === "pathgroup" ? columns[3]?.trim() : undefined;
    const key = `${orderCode}|${resultCode ?? ""}`.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    rows.push({ orderCode, orderName, resultCode, resultName });
  }

  return rows;
}

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
  race: string;
  ethnicity: string;
  interpreter: string;
  familySize: string;
  monthlyIncome: string;
  homeless: string;
  financialReviewDate: string;
};

export type PatientDeceasedStatus = {
  pid: number;
  pubpid: string;
  deceasedDate: string;
  deceasedReason: string;
};

export type PatientPortalAccountResetState = {
  pid: number;
  pubpid: string;
  passwordStatus: number | null;
  passwordStatusLabel: string;
  oneTimeLinkPending: boolean;
  resetStatusLabel: string;
};

export type PatientPortalAccountAccessState = {
  pid: number;
  pubpid: string;
  portalEnabled: boolean;
  accessStatusLabel: string;
  cmsPortalLogin: string;
  hasAccount: boolean;
};

export type PatientPortalLoginResult = {
  authenticated: boolean;
  username: string;
  portalUsername: string;
  canonicalId: string;
  pid: number | null;
  pubpid: string;
  displayName: string;
  failureReason: string | null;
  sessionId?: string | null;
};

export type PatientPortalSessionResult = {
  authenticated: boolean;
  sessionId: string | null;
  username: string;
  portalUsername: string;
  canonicalId: string;
  pid: number | null;
  pubpid: string;
  displayName: string;
  createdAt: string | null;
  lastSeenAt: string | null;
  expiresAt: string | null;
  endedAt: string | null;
  failureReason: string | null;
  sessionSource: string;
};

export type PatientPortalHomeMessageSummary = {
  totalMessages: number;
  newMessages: number;
  doneMessages: number;
  latestMessageTitle: string | null;
  latestMessageDate: string | null;
};

export type PatientPortalHomeAppointmentSummary = {
  id: string;
  date: string;
  startTime: string;
  title: string;
  status: string | null;
  categoryId: number | null;
  categoryName: string | null;
  providerName: string | null;
  facilityName: string | null;
  comments: string | null;
};

export type PatientPortalHomeSummary = {
  authenticated: boolean;
  username: string;
  portalUsername: string;
  canonicalId: string;
  pid: number | null;
  pubpid: string;
  displayName: string;
  datasetVersion: string;
  asOfDate: string;
  messages: PatientPortalHomeMessageSummary;
  upcomingAppointmentCount: number;
  upcomingAppointments: PatientPortalHomeAppointmentSummary[];
  failureReason: string | null;
  sessionSource: string;
};

export type PatientPortalMessageItem = {
  id: string;
  date: string;
  title: string;
  body: string;
  status: string;
  assignedTo: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  portalRelation: string | null;
  isEncrypted: boolean;
};

export type PatientPortalMessagesResult = {
  authenticated: boolean;
  username: string;
  portalUsername: string;
  canonicalId: string;
  pid: number | null;
  pubpid: string;
  displayName: string;
  datasetVersion: string;
  asOfDate: string;
  messageCount: number;
  messages: PatientPortalMessageItem[];
  sentMessageCount: number;
  sentMessages: PatientPortalMessageItem[];
  failureReason: string | null;
  sessionSource: string;
};

export type PatientPortalComposeMessageInput = {
  recipientId: string;
  title: string;
  body: string;
};

export type PatientPortalComposeMessageResult = {
  authenticated: boolean;
  created: boolean;
  username: string;
  portalUsername: string;
  canonicalId: string;
  pid: number | null;
  pubpid: string;
  displayName: string;
  recipientId: string;
  recipientName: string;
  sentMessage: PatientPortalMessageItem | null;
  recipientMessage: PatientPortalMessageItem | null;
  messageCount: number;
  sentMessageCount: number;
  failureReason: string | null;
  sessionSource: string;
};

export type PatientGuardianContact = {
  pid: number;
  pubpid: string;
  motherName: string;
  guardianName: string;
  guardianRelationship: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianSex: string;
  guardianAddress: string;
  guardianCity: string;
  guardianState: string;
  guardianPostalCode: string;
  guardianCountry: string;
  guardianWorkPhone: string;
};

export type PatientEmployer = {
  pid: number;
  pubpid: string;
  employerName: string;
  employerStreet: string;
  employerCity: string;
  employerState: string;
  employerPostalCode: string;
  employerCountry: string;
};

export type PatientProviderAssignment = {
  pid: number;
  pubpid: string;
  providerId: number | null;
  providerName: string;
};

export type PatientCareTeamAssignment = {
  pid: number;
  pubpid: string;
  teamName: string;
  teamStatus: string;
  teamStatusDisplay: string;
  userId: number | null;
  memberName: string;
  role: string;
  roleDisplay: string;
  facilityId: number | null;
  facilityName: string;
  providerSince: string;
  memberStatus: string;
  memberStatusDisplay: string;
  note: string;
};

export type PatientCareTeamMemberAssignment = {
  userId: number | null;
  contactId?: number | null;
  memberType?: "provider" | "contact";
  memberName: string;
  role: string;
  roleDisplay: string;
  facilityId: number | null;
  facilityName: string;
  providerSince: string;
  memberStatus: string;
  memberStatusDisplay: string;
  note: string;
};

export type PatientCareTeamMembersAssignment = {
  pid: number;
  pubpid: string;
  teamName: string;
  teamStatus: string;
  teamStatusDisplay: string;
  members: PatientCareTeamMemberAssignment[];
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
  repeatOnNum: number | null;
  repeatOnDay: number | null;
  repeatOnFrequency: number | null;
  recurrenceDays: number[];
  recurrenceEndDate: string | null;
  recurrenceExdates: string[];
};

export type AppointmentSeriesOccurrence = {
  id: number | string;
  seriesRootId: number | string;
  patientId: number;
  providerId: number | null;
  title: string;
  date: string;
  startTime: string;
  status: string | null;
  facilityId: number | null;
  billingLocationId: number | null;
  room: string | null;
  categoryId: number | null;
  categoryName: string | null;
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
  portalRelation: string;
  isEncrypted: boolean;
  updatedBy: string;
  updatedAt: string;
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
  subscriberFirstName: string;
  subscriberMiddleName: string;
  subscriberLastName: string;
  subscriberDateOfBirth: string;
  subscriberSex: string;
  subscriberStreet: string;
  subscriberStreetLine2: string;
  subscriberCity: string;
  subscriberState: string;
  subscriberPostalCode: string;
  subscriberCountry: string;
  subscriberPhone: string;
  subscriberEmployer: string;
  subscriberEmployerStreet: string;
  subscriberEmployerStreetLine2: string;
  subscriberEmployerCity: string;
  subscriberEmployerState: string;
  subscriberEmployerPostalCode: string;
  subscriberEmployerCountry: string;
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
  dateOrdered: string;
  orderStatus: string;
  orderPriority: string;
  procedureCode: string;
  procedureName: string;
  procedureType: string;
  diagnosis: string;
  instructions: string;
  dateTransmitted: string;
};

export type NewProcedureOrderCatalogItem = {
  parentId?: number;
  labId?: number;
  name: string;
  code?: string;
  itemType?: string;
  procedureTypeName?: string;
  description?: string;
  specimen?: string;
  standardCode?: string;
  sequence?: number;
  active?: boolean;
};

export type ProcedureOrderCatalogItemRecord = {
  id: number;
  parentId: number;
  labId: number;
  name: string;
  code: string;
  itemType: string;
  procedureTypeName: string;
  description: string;
  specimen: string;
  standardCode: string;
  sequence: number;
  active: boolean;
  childCount: number;
};

export type ProcedureVendorCompendiumImportInput = {
  vendorFormat: "pathgroup" | "ympg-dpmg";
  parentId: number;
  labId: number;
  csvText: string;
};

export type ProcedureVendorCompendiumImportItem = {
  id: number;
  parentId: number;
  code: string;
  name: string;
  itemType: string;
  created: boolean;
  reactivated: boolean;
};

export type ProcedureVendorCompendiumImportResult = {
  vendorFormat: string;
  parentId: number;
  labId: number;
  importedOrderCount: number;
  createdOrderCount: number;
  updatedOrderCount: number;
  reactivatedOrderCount: number;
  deactivatedOrderCount: number;
  importedResultCount: number;
  createdResultCount: number;
  updatedResultCount: number;
  reactivatedResultCount: number;
  importedItems: ProcedureVendorCompendiumImportItem[];
};

export type ProcedureReportRecord = {
  id: number;
  orderId: number;
  dateCollected: string;
  dateReport: string;
  specimenNumber: string;
  reportStatus: string;
  reviewStatus: string;
  reviewedBy: string;
  reviewedAt: string;
  reportNotes: string;
};

export type ProcedureSpecimenRecord = {
  id: number;
  orderId: number;
  specimenIdentifier: string;
  accessionIdentifier: string;
  specimenTypeCode: string;
  specimenType: string;
  collectionMethodCode: string;
  collectionMethod: string;
  specimenLocationCode: string;
  specimenLocation: string;
  collectedDate: string;
  volumeValue: string;
  volumeUnit: string;
  conditionCode: string;
  specimenCondition: string;
  comments: string;
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
  repeatOnNum?: number;
  repeatOnDay?: number;
  repeatOnFrequency?: number;
  recurrenceDays?: number[];
  recurrenceEndDate?: string;
  recurrenceExdates?: string[];
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
  repeatOnNum?: number;
  repeatOnDay?: number;
  repeatOnFrequency?: number;
  recurrenceDays?: number[];
  recurrenceEndDate?: string;
  recurrenceExdates?: string[];
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
  subscriberFirstName?: string;
  subscriberMiddleName?: string;
  subscriberLastName?: string;
  subscriberDateOfBirth?: string;
  subscriberSex?: string;
  subscriberStreet?: string;
  subscriberStreetLine2?: string;
  subscriberCity?: string;
  subscriberState?: string;
  subscriberPostalCode?: string;
  subscriberCountry?: string;
  subscriberPhone?: string;
  subscriberEmployer?: string;
  subscriberEmployerStreet?: string;
  subscriberEmployerStreetLine2?: string;
  subscriberEmployerCity?: string;
  subscriberEmployerState?: string;
  subscriberEmployerPostalCode?: string;
  subscriberEmployerCountry?: string;
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

export type PatientDocumentBinaryContentReplacement = {
  fileName: string;
  mimetype: string;
  contentBase64: string;
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
  labId?: number;
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

export type NewProcedureLabProvider = {
  name: string;
  labDirectorId?: number;
  npi?: string;
  protocol?: string;
  usage?: string;
  direction?: string;
  sendApplicationId?: string;
  sendFacilityId?: string;
  receiveApplicationId?: string;
  receiveFacilityId?: string;
  remoteHost?: string;
  login?: string;
  password?: string;
  ordersPath?: string;
  resultsPath?: string;
  notes?: string;
  active?: boolean;
};

export type NewProcedureLabProviderAddressBookOrganization = {
  organization: string;
  type?: string;
  active?: boolean;
  npi?: string;
};

export type ProcedureLabProviderRecord = {
  id: number;
  name: string;
  labDirectorId: number;
  labDirectorName: string;
  labDirectorType: string;
  npi: string;
  protocol: string;
  usage: string;
  direction: string;
  sendApplicationId: string;
  sendFacilityId: string;
  receiveApplicationId: string;
  receiveFacilityId: string;
  remoteHost: string;
  login: string;
  password: string;
  ordersPath: string;
  resultsPath: string;
  notes: string;
  active: boolean;
};

export type ProcedureOrderUpdate = {
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

export type ProcedureReportUpdate = {
  dateCollected: string;
  dateReport: string;
  specimenNumber: string;
  reportStatus: string;
  reviewStatus: string;
  notes: string;
};

export type ProcedureReportSignOff = {
  reviewedBy: string;
  reviewedAt: string;
};

export type NewProcedureSpecimen = {
  orderId: number;
  specimenIdentifier: string;
  accessionIdentifier: string;
  specimenTypeCode: string;
  specimenType: string;
  collectionMethodCode: string;
  collectionMethod: string;
  specimenLocationCode: string;
  specimenLocation: string;
  collectedDate: string;
  volumeValue: string;
  volumeUnit: string;
  conditionCode: string;
  specimenCondition: string;
  comments: string;
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
  COALESCE(occupation, '') AS occupation,
  COALESCE(race, '') AS race,
  COALESCE(ethnicity, '') AS ethnicity,
  COALESCE(interpreter, '') AS interpreter,
  COALESCE(CAST(family_size AS CHAR), '') AS familySize,
  COALESCE(CAST(monthly_income AS CHAR), '') AS monthlyIncome,
  COALESCE(homeless, '') AS homeless,
  COALESCE(DATE(financial_review), '') AS financialReviewDate
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
  occupation = ${sqlString(demographics.occupation)},
  race = ${sqlString(demographics.race)},
  ethnicity = ${sqlString(demographics.ethnicity)},
  interpreter = ${sqlString(demographics.interpreter)},
  family_size = ${nullableSqlString(demographics.familySize)},
  monthly_income = ${nullableSqlString(demographics.monthlyIncome)},
  homeless = ${sqlString(demographics.homeless)},
  financial_review = ${nullableSqlString(demographics.financialReviewDate)}
WHERE pid = ${integer(demographics.pid)};
`);
  }

  async getPatientDeceasedStatus(pid: number): Promise<PatientDeceasedStatus | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT pid, pubpid,
  COALESCE(DATE(deceased_date), '') AS deceasedDate,
  COALESCE(deceased_reason, '') AS deceasedReason
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
      deceasedDate: row.deceasedDate,
      deceasedReason: row.deceasedReason
    };
  }

  async updatePatientDeceasedStatus(status: PatientDeceasedStatus): Promise<void> {
    await this.db.execute(`
UPDATE patient_data
SET deceased_date = ${nullableSqlString(status.deceasedDate)},
  deceased_reason = ${sqlString(status.deceasedReason)}
WHERE pid = ${integer(status.pid)};
`);
  }

  async getPatientPortalAccountResetState(pid: number): Promise<PatientPortalAccountResetState | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT pd.pid, pd.pubpid,
  COALESCE(CAST(pao.portal_pwd_status AS CHAR), '') AS passwordStatus,
  CASE WHEN COALESCE(pao.portal_onetime, '') <> '' THEN '1' ELSE '0' END AS oneTimeLinkPending,
  COALESCE(pao.portal_username, '') AS portalUsername
FROM patient_data pd
LEFT JOIN patient_access_onsite pao ON pao.pid = pd.pid
WHERE pd.pid = ${integer(pid)}
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
    await this.db.execute(`
UPDATE patient_access_onsite
SET portal_pwd_status = ${nullableInteger(state.passwordStatus)},
  portal_onetime = ${sqlString(state.oneTimeLinkPending ? `reset-${state.pubpid.toLowerCase()}` : "")}
WHERE pid = ${integer(state.pid)};
`);
  }

  async getPatientPortalAccountAccessState(pid: number): Promise<PatientPortalAccountAccessState | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT pd.pid, pd.pubpid,
  pd.allow_patient_portal AS portalEnabled,
  COALESCE(pd.cmsportal_login, '') AS cmsPortalLogin,
  COALESCE(pao.portal_username, '') AS portalUsername
FROM patient_data pd
LEFT JOIN patient_access_onsite pao ON pao.pid = pd.pid
WHERE pd.pid = ${integer(pid)}
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
    await this.db.execute(`
UPDATE patient_data
SET allow_patient_portal = ${sqlString(state.portalEnabled ? "YES" : "")}
WHERE pid = ${integer(state.pid)};
`);
  }

  async verifyPatientPortalLogin(username: string, password: string): Promise<PatientPortalLoginResult> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT pd.pid, pd.pubpid, pd.fname AS firstName, pd.lname AS lastName,
  pd.allow_patient_portal AS allowPatientPortal,
  COALESCE(pao.portal_username, '') AS portalUsername,
  COALESCE(pao.portal_login_username, '') AS portalLoginUsername,
  COALESCE(CAST(pao.portal_pwd_status AS CHAR), '') AS passwordStatus,
  COALESCE(pao.portal_onetime, '') AS portalOneTime,
  COALESCE(pao.portal_pwd, '') AS portalPasswordHash
FROM patient_access_onsite pao
INNER JOIN patient_data pd ON pd.pid = pao.pid
WHERE BINARY pao.portal_login_username = ${sqlString(username)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row || !row.portalUsername || !row.portalLoginUsername || !row.portalPasswordHash) {
      return buildPortalLoginResult(username, "Invalid username or password.");
    }

    if (row.portalOneTime.trim() !== "") {
      return buildPortalLoginResult(username, "One-time reset pending.", row);
    }

    const passwordStatus = row.passwordStatus === "" ? null : Number(row.passwordStatus);
    if (passwordStatus !== 1) {
      return buildPortalLoginResult(username, "Patient portal account is pending password setup.", row);
    }

    if (row.allowPatientPortal !== "YES") {
      return buildPortalLoginResult(username, "Patient portal access is disabled.", row);
    }

    if (!isSeededPortalPasswordHash(row.portalPasswordHash) || password !== seededPortalDemoPassword) {
      return buildPortalLoginResult(username, "Invalid username or password.", row);
    }

    return buildPortalLoginResult(username, null, row, true);
  }

  async getPatientPortalSession(sessionId: string): Promise<PatientPortalSessionResult> {
    return buildLegacyPortalSessionResult(sessionId);
  }

  async endPatientPortalSession(sessionId: string): Promise<PatientPortalSessionResult> {
    return buildLegacyPortalSessionResult(sessionId);
  }

  async getPatientPortalHomeSummary(username: string, password: string): Promise<PatientPortalHomeSummary> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || login.pid === null) {
      return buildEmptyPortalHomeSummary(username, login.failureReason ?? "Patient portal sign-in was rejected.");
    }

    const messageRows = await this.db.queryRows<Record<string, string>>(`
SELECT
  COUNT(*) AS totalMessages,
  SUM(CASE WHEN message_status = 'New' THEN 1 ELSE 0 END) AS newMessages,
  SUM(CASE WHEN message_status = 'Done' THEN 1 ELSE 0 END) AS doneMessages
FROM pnotes
WHERE pid = ${integer(login.pid)}
  AND activity = 1;
`);
    const latestMessageRows = await this.db.queryRows<Record<string, string>>(`
SELECT title AS latestMessageTitle, DATE_FORMAT(date, '%Y-%m-%d') AS latestMessageDate
FROM pnotes
WHERE pid = ${integer(login.pid)}
  AND activity = 1
ORDER BY date DESC, id DESC
LIMIT 1;
`);
    const appointmentRows = await this.db.queryRows<Record<string, string>>(`
SELECT
  e.pc_eid AS id,
  DATE_FORMAT(e.pc_eventDate, '%Y-%m-%d') AS appointmentDate,
  TIME_FORMAT(e.pc_startTime, '%H:%i') AS startTime,
  COALESCE(e.pc_title, 'Appointment') AS title,
  COALESCE(e.pc_apptstatus, '') AS status,
  COALESCE(CAST(e.pc_catid AS CHAR), '') AS categoryId,
  TRIM(CONCAT(COALESCE(u.fname, ''), ' ', COALESCE(u.lname, ''))) AS providerName,
  COALESCE(f.name, '') AS facilityName,
  COALESCE(e.pc_hometext, '') AS comments
FROM openemr_postcalendar_events e
LEFT JOIN users u ON u.id = e.pc_aid
LEFT JOIN facility f ON f.id = e.pc_facility
WHERE e.pc_pid = ${integer(login.pid)}
  AND e.pc_eventDate >= CURDATE()
ORDER BY e.pc_eventDate, e.pc_startTime, e.pc_eid
LIMIT 10;
`);
    const appointmentCountRows = await this.db.queryRows<Record<string, string>>(`
SELECT COUNT(*) AS appointmentCount
FROM openemr_postcalendar_events
WHERE pc_pid = ${integer(login.pid)}
  AND pc_eventDate >= CURDATE();
`);

    const messageRow = messageRows[0] ?? {};
    const latestMessage = latestMessageRows[0] ?? {};

    return {
      authenticated: true,
      username: login.username,
      portalUsername: login.portalUsername,
      canonicalId: login.canonicalId,
      pid: login.pid,
      pubpid: login.pubpid,
      displayName: login.displayName,
      datasetVersion: "openemr-shared-synthetic-v1",
      asOfDate: new Date().toISOString().slice(0, 10),
      messages: {
        totalMessages: Number(messageRow.totalMessages ?? 0),
        newMessages: Number(messageRow.newMessages ?? 0),
        doneMessages: Number(messageRow.doneMessages ?? 0),
        latestMessageTitle: latestMessage.latestMessageTitle || null,
        latestMessageDate: latestMessage.latestMessageDate || null
      },
      upcomingAppointmentCount: Number(appointmentCountRows[0]?.appointmentCount ?? appointmentRows.length),
      upcomingAppointments: appointmentRows.map((row) => ({
        id: row.id,
        date: normalizeDateText(row.appointmentDate),
        startTime: row.startTime,
        title: row.title,
        status: row.status || null,
        categoryId: row.categoryId ? Number(row.categoryId) : null,
        categoryName: appointmentCategoryLabel(row.categoryId ? Number(row.categoryId) : null),
        providerName: row.providerName || null,
        facilityName: row.facilityName || null,
        comments: row.comments || null
      })),
      failureReason: null,
      sessionSource: "legacy-openemr-portal"
    };
  }

  async getPatientPortalMessages(username: string, password: string): Promise<PatientPortalMessagesResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || login.pid === null) {
      return buildEmptyPortalMessagesResult(username, login.failureReason ?? "Patient portal sign-in was rejected.");
    }

    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT
  CAST(id AS CHAR) AS id,
  DATE_FORMAT(date, '%Y-%m-%d') AS messageDate,
  COALESCE(title, '') AS title,
  COALESCE(body, '') AS body,
  COALESCE(message_status, '') AS status,
  COALESCE(assigned_to, '') AS assignedTo,
  COALESCE(sender_id, '') AS senderId,
  COALESCE(sender_name, '') AS senderName,
  COALESCE(recipient_id, '') AS recipientId,
  COALESCE(recipient_name, '') AS recipientName,
  COALESCE(CAST(is_msg_encrypted AS CHAR), '0') AS isEncrypted
FROM onsite_mail
WHERE deleted != 1
  AND owner = ${sqlString(login.portalUsername)}
  AND recipient_id = ${sqlString(login.portalUsername)}
ORDER BY date DESC, id DESC;
`);
    const sentRows = await this.db.queryRows<Record<string, string>>(`
SELECT
  CAST(id AS CHAR) AS id,
  DATE_FORMAT(date, '%Y-%m-%d') AS messageDate,
  COALESCE(title, '') AS title,
  COALESCE(body, '') AS body,
  COALESCE(message_status, '') AS status,
  COALESCE(assigned_to, '') AS assignedTo,
  COALESCE(sender_id, '') AS senderId,
  COALESCE(sender_name, '') AS senderName,
  COALESCE(recipient_id, '') AS recipientId,
  COALESCE(recipient_name, '') AS recipientName,
  COALESCE(CAST(is_msg_encrypted AS CHAR), '0') AS isEncrypted
FROM onsite_mail
WHERE deleted != 1
  AND owner = ${sqlString(login.portalUsername)}
  AND sender_id = ${sqlString(login.portalUsername)}
ORDER BY date DESC, id DESC;
`);
    const mapRow = (row: Record<string, string>): PatientPortalMessageItem => ({
      id: row.id,
      date: normalizeDateText(row.messageDate),
      title: row.title,
      body: row.body,
      status: row.status,
      assignedTo: row.assignedTo,
      senderId: row.senderId,
      senderName: row.senderName,
      recipientId: row.recipientId,
      recipientName: row.recipientName,
      portalRelation: null,
      isEncrypted: row.isEncrypted === "1"
    });

    return {
      authenticated: true,
      username: login.username,
      portalUsername: login.portalUsername,
      canonicalId: login.canonicalId,
      pid: login.pid,
      pubpid: login.pubpid,
      displayName: login.displayName,
      datasetVersion: "openemr-shared-synthetic-v1",
      asOfDate: new Date().toISOString().slice(0, 10),
      messageCount: rows.length,
      messages: rows.map(mapRow),
      sentMessageCount: sentRows.length,
      sentMessages: sentRows.map(mapRow),
      failureReason: null,
      sessionSource: "legacy-openemr-portal"
    };
  }

  async composePatientPortalMessage(
    username: string,
    password: string,
    input: PatientPortalComposeMessageInput
  ): Promise<PatientPortalComposeMessageResult> {
    const login = await this.verifyPatientPortalLogin(username, password);
    if (!login.authenticated || login.pid === null) {
      return buildEmptyPortalComposeMessageResult(username, input.recipientId, login.failureReason ?? "Patient portal sign-in was rejected.");
    }

    const title = input.title.trim();
    const body = input.body.trim();
    const recipientId = input.recipientId.trim() || "admin";
    if (!title || !body) {
      return buildEmptyPortalComposeMessageResult(username, recipientId, "Secure message title and body are required.");
    }

    await this.cleanupPatientPortalComposedMessage(login.portalUsername, title);
    const recipientName = await this.getPortalMessageRecipientName(recipientId);
    const idRows = await this.db.queryRows<{ nextId: string }>(`
SELECT GREATEST(COALESCE(MAX(id), 9391000) + 1, 9391001) AS nextId
FROM onsite_mail;
`);
    const sentId = Number(idRows[0]?.nextId ?? 9391001);
    const recipientCopyId = sentId + 1;
    const messageDate = new Date().toISOString().slice(0, 10);
    const sentMessage: PatientPortalMessageItem = {
      id: String(sentId),
      date: messageDate,
      title,
      body,
      status: "New",
      assignedTo: recipientId,
      senderId: login.portalUsername,
      senderName: login.displayName,
      recipientId,
      recipientName,
      portalRelation: null,
      isEncrypted: false
    };
    const recipientMessage: PatientPortalMessageItem = {
      ...sentMessage,
      id: String(recipientCopyId)
    };

    await this.db.execute(`
INSERT INTO onsite_mail
  (id, date, body, owner, user, groupname, activity, authorized, title, assigned_to, message_status, mail_chain, sender_id, sender_name, recipient_id, recipient_name, reply_mail_chain, is_msg_encrypted)
VALUES
  (${integer(sentId)}, ${sqlString(messageDate)}, ${sqlString(body)}, ${sqlString(login.portalUsername)}, ${sqlString(login.portalUsername)}, 'Default', 1, 1, ${sqlString(title)}, ${sqlString(recipientId)}, 'New', ${integer(sentId)}, ${sqlString(login.portalUsername)}, ${sqlString(login.displayName)}, ${sqlString(recipientId)}, ${sqlString(recipientName)}, ${integer(sentId)}, 0),
  (${integer(recipientCopyId)}, ${sqlString(messageDate)}, ${sqlString(body)}, ${sqlString(recipientId)}, ${sqlString(login.portalUsername)}, 'Default', 1, 1, ${sqlString(title)}, ${sqlString(recipientId)}, 'New', ${integer(recipientCopyId)}, ${sqlString(login.portalUsername)}, ${sqlString(login.displayName)}, ${sqlString(recipientId)}, ${sqlString(recipientName)}, ${integer(sentId)}, 0);
`);

    const refreshed = await this.getPatientPortalMessages(username, password);
    return {
      authenticated: true,
      created: true,
      username: login.username,
      portalUsername: login.portalUsername,
      canonicalId: login.canonicalId,
      pid: login.pid,
      pubpid: login.pubpid,
      displayName: login.displayName,
      recipientId,
      recipientName,
      sentMessage,
      recipientMessage,
      messageCount: refreshed.messageCount,
      sentMessageCount: refreshed.sentMessageCount,
      failureReason: null,
      sessionSource: "legacy-openemr-portal"
    };
  }

  async cleanupPatientPortalComposedMessage(portalUsername: string, title: string): Promise<void> {
    await this.db.execute(`
DELETE FROM onsite_mail
WHERE title = ${sqlString(title)}
  AND (owner = ${sqlString(portalUsername)}
    OR sender_id = ${sqlString(portalUsername)}
    OR recipient_id = ${sqlString(portalUsername)});
`);
  }

  private async getPortalMessageRecipientName(recipientId: string): Promise<string> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT COALESCE(NULLIF(TRIM(CONCAT(fname, ' ', lname)), ''), username) AS displayName
FROM users
WHERE username = ${sqlString(recipientId)}
LIMIT 1;
`);
    return rows[0]?.displayName || recipientId;
  }

  async getPatientGuardianContact(pid: number): Promise<PatientGuardianContact | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT pid, pubpid,
  COALESCE(mothersname, '') AS motherName,
  COALESCE(guardiansname, '') AS guardianName,
  COALESCE(guardianrelationship, '') AS guardianRelationship,
  COALESCE(guardianphone, '') AS guardianPhone,
  COALESCE(guardianemail, '') AS guardianEmail,
  COALESCE(guardiansex, '') AS guardianSex,
  COALESCE(guardianaddress, '') AS guardianAddress,
  COALESCE(guardiancity, '') AS guardianCity,
  COALESCE(guardianstate, '') AS guardianState,
  COALESCE(guardianpostalcode, '') AS guardianPostalCode,
  COALESCE(guardiancountry, '') AS guardianCountry,
  COALESCE(guardianworkphone, '') AS guardianWorkPhone
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
    await this.db.execute(`
UPDATE patient_data
SET mothersname = ${sqlString(contact.motherName)},
  guardiansname = ${sqlString(contact.guardianName)},
  guardianrelationship = ${sqlString(contact.guardianRelationship)},
  guardianphone = ${sqlString(contact.guardianPhone)},
  guardianemail = ${sqlString(contact.guardianEmail)},
  guardiansex = ${sqlString(contact.guardianSex)},
  guardianaddress = ${sqlString(contact.guardianAddress)},
  guardiancity = ${sqlString(contact.guardianCity)},
  guardianstate = ${sqlString(contact.guardianState)},
  guardianpostalcode = ${sqlString(contact.guardianPostalCode)},
  guardiancountry = ${sqlString(contact.guardianCountry)},
  guardianworkphone = ${sqlString(contact.guardianWorkPhone)}
WHERE pid = ${integer(contact.pid)};
`);
  }

  async getPatientEmployer(pid: number): Promise<PatientEmployer | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT p.pid, p.pubpid,
  COALESCE(e.name, '') AS employerName,
  COALESCE(e.street, '') AS employerStreet,
  COALESCE(e.city, '') AS employerCity,
  COALESCE(e.state, '') AS employerState,
  COALESCE(e.postal_code, '') AS employerPostalCode,
  COALESCE(e.country, '') AS employerCountry
FROM patient_data p
LEFT JOIN employer_data e ON e.pid = p.pid
WHERE p.pid = ${integer(pid)}
ORDER BY e.date DESC, e.id DESC
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
    await this.db.execute(`
UPDATE employer_data
SET name = ${sqlString(employer.employerName)},
  street = ${sqlString(employer.employerStreet)},
  city = ${sqlString(employer.employerCity)},
  state = ${sqlString(employer.employerState)},
  postal_code = ${sqlString(employer.employerPostalCode)},
  country = ${sqlString(employer.employerCountry)}
WHERE pid = ${integer(employer.pid)};
`);
  }

  async getPatientProviderAssignment(pid: number): Promise<PatientProviderAssignment | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT p.pid, p.pubpid,
  COALESCE(CAST(p.providerID AS CHAR), '') AS providerId,
  COALESCE(CONCAT(u.fname, ' ', u.lname), '') AS providerName
FROM patient_data p
LEFT JOIN users u ON u.id = p.providerID
WHERE p.pid = ${integer(pid)}
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
    const providerValue = assignment.providerId === null ? "NULL" : integer(assignment.providerId);
    await this.db.execute(`
UPDATE patient_data
SET providerID = ${providerValue}
WHERE pid = ${integer(assignment.pid)};
`);
  }

  async getPatientCareTeamAssignment(pid: number): Promise<PatientCareTeamAssignment | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT p.pid, p.pubpid,
  COALESCE(ct.team_name, '') AS teamName,
  COALESCE(ct.status, '') AS teamStatus,
  COALESCE(CAST(ctm.user_id AS CHAR), '') AS userId,
  COALESCE(CAST(ctm.contact_id AS CHAR), '') AS contactId,
  COALESCE(CONCAT(u.fname, ' ', u.lname), NULLIF(TRIM(CONCAT(COALESCE(per.first_name, ''), ' ', COALESCE(per.last_name, ''))), ''), '') AS memberName,
  COALESCE(ctm.role, '') AS role,
  COALESCE(CAST(ctm.facility_id AS CHAR), '') AS facilityId,
  COALESCE(f.name, '') AS facilityName,
  COALESCE(DATE_FORMAT(ctm.provider_since, '%Y-%m-%d'), '') AS providerSince,
  COALESCE(ctm.status, '') AS memberStatus,
  COALESCE(ctm.note, '') AS note
FROM patient_data p
LEFT JOIN care_teams ct ON ct.id = (
  SELECT latest_ct.id
  FROM care_teams latest_ct
  WHERE latest_ct.pid = p.pid
  ORDER BY latest_ct.id DESC
  LIMIT 1
)
LEFT JOIN care_team_member ctm ON ctm.care_team_id = ct.id
LEFT JOIN users u ON u.id = ctm.user_id
LEFT JOIN contact c ON c.id = ctm.contact_id
LEFT JOIN person per ON c.foreign_table_name = 'person' AND per.id = c.foreign_id
LEFT JOIN facility f ON f.id = ctm.facility_id
WHERE p.pid = ${integer(pid)}
ORDER BY ct.id DESC, ctm.id DESC
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
    await this.db.execute(`
DELETE ctm FROM care_team_member ctm
INNER JOIN care_teams ct ON ct.id = ctm.care_team_id
WHERE ct.pid = ${integer(assignment.pid)};

DELETE FROM care_teams
WHERE pid = ${integer(assignment.pid)};
`);

    if (assignment.userId === null) {
      return;
    }

    const facilityId = assignment.facilityId === null ? "NULL" : integer(assignment.facilityId);
    await this.db.execute(`
INSERT INTO care_teams
  (uuid, pid, status, team_name, note, date_created, date_updated, created_by, updated_by)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${integer(assignment.pid)}, ${sqlString(assignment.teamStatus || "active")},
   ${sqlString(assignment.teamName || "Care Team")}, ${nullableSqlString(assignment.note)},
   NOW(), NOW(), 1, 1);

SET @care_team_id := LAST_INSERT_ID();

INSERT INTO care_team_member
  (care_team_id, user_id, contact_id, role, facility_id, provider_since, status,
   date_created, date_updated, created_by, updated_by, note)
VALUES
  (@care_team_id, ${integer(assignment.userId)}, NULL, ${sqlString(assignment.role)},
   ${facilityId}, ${nullableSqlString(assignment.providerSince)}, ${sqlString(assignment.memberStatus || "active")},
   NOW(), NOW(), 1, 1, ${nullableSqlString(assignment.note)});
`);
  }

  async getPatientCareTeamMembersAssignment(pid: number): Promise<PatientCareTeamMembersAssignment | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT p.pid, p.pubpid,
  COALESCE(ct.team_name, '') AS teamName,
  COALESCE(ct.status, '') AS teamStatus,
  COALESCE(CAST(ctm.user_id AS CHAR), '') AS userId,
  COALESCE(CAST(ctm.contact_id AS CHAR), '') AS contactId,
  COALESCE(CONCAT(u.fname, ' ', u.lname), NULLIF(TRIM(CONCAT(COALESCE(per.first_name, ''), ' ', COALESCE(per.last_name, ''))), ''), '') AS memberName,
  COALESCE(ctm.role, '') AS role,
  COALESCE(CAST(ctm.facility_id AS CHAR), '') AS facilityId,
  COALESCE(f.name, '') AS facilityName,
  COALESCE(DATE_FORMAT(ctm.provider_since, '%Y-%m-%d'), '') AS providerSince,
  COALESCE(ctm.status, '') AS memberStatus,
  COALESCE(ctm.note, '') AS note
FROM patient_data p
LEFT JOIN care_teams ct ON ct.pid = p.pid
LEFT JOIN care_team_member ctm ON ctm.care_team_id = ct.id
LEFT JOIN users u ON u.id = ctm.user_id
LEFT JOIN contact c ON c.id = ctm.contact_id
LEFT JOIN person per ON c.foreign_table_name = 'person' AND per.id = c.foreign_id
LEFT JOIN facility f ON f.id = ctm.facility_id
WHERE p.pid = ${integer(pid)}
ORDER BY ct.id DESC, ctm.id ASC;
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
    await this.db.execute(`
DELETE ctm FROM care_team_member ctm
INNER JOIN care_teams ct ON ct.id = ctm.care_team_id
WHERE ct.pid = ${integer(assignment.pid)};

DELETE FROM care_teams
WHERE pid = ${integer(assignment.pid)};
`);

    if (assignment.members.length === 0) {
      return;
    }

    const memberValues = assignment.members.map((member) => {
      const facilityId = member.facilityId === null ? "NULL" : integer(member.facilityId);
      const userId = member.userId === null ? "NULL" : integer(member.userId);
      const contactId = member.contactId == null ? "NULL" : integer(member.contactId);
      return `(@care_team_id, ${userId}, ${contactId}, ${sqlString(member.role)},
   ${facilityId}, ${nullableSqlString(member.providerSince)}, ${sqlString(member.memberStatus || "active")},
   NOW(), NOW(), 1, 1, ${nullableSqlString(member.note)})`;
    }).join(",\n");

    await this.db.execute(`
INSERT INTO care_teams
  (uuid, pid, status, team_name, note, date_created, date_updated, created_by, updated_by)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${integer(assignment.pid)}, ${sqlString(assignment.teamStatus || "active")},
   ${sqlString(assignment.teamName || "Care Team")}, NULL,
   NOW(), NOW(), 1, 1);

SET @care_team_id := LAST_INSERT_ID();

INSERT INTO care_team_member
  (care_team_id, user_id, contact_id, role, facility_id, provider_since, status,
   date_created, date_updated, created_by, updated_by, note)
VALUES
  ${memberValues};
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
   subscriber_fname, subscriber_mname, subscriber_lname, subscriber_DOB, subscriber_sex,
   subscriber_street, subscriber_street_line_2, subscriber_city, subscriber_state, subscriber_postal_code,
   subscriber_country, subscriber_phone, subscriber_employer, subscriber_employer_street,
   subscriber_employer_street_line_2, subscriber_employer_city, subscriber_employer_state,
   subscriber_employer_postal_code, subscriber_employer_country, date, pid, accept_assignment, policy_type)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${sqlString(input.type)}, ${integer(providerId)},
   ${sqlString(input.planName)}, ${sqlString(input.policyNumber)}, ${sqlString(input.groupNumber)},
   ${sqlString(input.relationship)}, ${sqlStringOrEmpty(input.subscriberFirstName)},
   ${sqlStringOrEmpty(input.subscriberMiddleName)}, ${sqlStringOrEmpty(input.subscriberLastName)},
   ${nullableSqlString(input.subscriberDateOfBirth)}, ${sqlStringOrEmpty(input.subscriberSex)},
   ${sqlStringOrEmpty(input.subscriberStreet)}, ${sqlStringOrEmpty(input.subscriberStreetLine2)},
   ${sqlStringOrEmpty(input.subscriberCity)}, ${sqlStringOrEmpty(input.subscriberState)},
   ${sqlStringOrEmpty(input.subscriberPostalCode)}, ${sqlStringOrEmpty(input.subscriberCountry)},
   ${sqlStringOrEmpty(input.subscriberPhone)}, ${sqlStringOrEmpty(input.subscriberEmployer)},
   ${sqlStringOrEmpty(input.subscriberEmployerStreet)}, ${sqlStringOrEmpty(input.subscriberEmployerStreetLine2)},
   ${sqlStringOrEmpty(input.subscriberEmployerCity)}, ${sqlStringOrEmpty(input.subscriberEmployerState)},
   ${sqlStringOrEmpty(input.subscriberEmployerPostalCode)}, ${sqlStringOrEmpty(input.subscriberEmployerCountry)},
   '2026-06-18', ${integer(input.patientId)}, 'TRUE', 'group');
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
  COALESCE(insd.subscriber_relationship, '') AS relationship,
  COALESCE(insd.subscriber_fname, '') AS subscriberFirstName,
  COALESCE(insd.subscriber_mname, '') AS subscriberMiddleName,
  COALESCE(insd.subscriber_lname, '') AS subscriberLastName,
  COALESCE(DATE_FORMAT(insd.subscriber_DOB, '%Y-%m-%d'), '') AS subscriberDateOfBirth,
  COALESCE(insd.subscriber_sex, '') AS subscriberSex,
  COALESCE(insd.subscriber_street, '') AS subscriberStreet,
  COALESCE(insd.subscriber_street_line_2, '') AS subscriberStreetLine2,
  COALESCE(insd.subscriber_city, '') AS subscriberCity,
  COALESCE(insd.subscriber_state, '') AS subscriberState,
  COALESCE(insd.subscriber_postal_code, '') AS subscriberPostalCode,
  COALESCE(insd.subscriber_country, '') AS subscriberCountry,
  COALESCE(insd.subscriber_phone, '') AS subscriberPhone,
  COALESCE(insd.subscriber_employer, '') AS subscriberEmployer,
  COALESCE(insd.subscriber_employer_street, '') AS subscriberEmployerStreet,
  COALESCE(insd.subscriber_employer_street_line_2, '') AS subscriberEmployerStreetLine2,
  COALESCE(insd.subscriber_employer_city, '') AS subscriberEmployerCity,
  COALESCE(insd.subscriber_employer_state, '') AS subscriberEmployerState,
  COALESCE(insd.subscriber_employer_postal_code, '') AS subscriberEmployerPostalCode,
  COALESCE(insd.subscriber_employer_country, '') AS subscriberEmployerCountry
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
    const legacyId = legacyInteger(id);
    const providerId = await this.getInsuranceCompanyId(input.provider);
    await this.db.execute(`
UPDATE insurance_data
SET type = ${sqlString(input.type)},
  provider = ${integer(providerId)},
  plan_name = ${sqlString(input.planName)},
  policy_number = ${sqlString(input.policyNumber)},
  group_number = ${sqlString(input.groupNumber)},
  subscriber_relationship = ${sqlString(input.relationship)},
  subscriber_fname = ${sqlStringOrEmpty(input.subscriberFirstName)},
  subscriber_mname = ${sqlStringOrEmpty(input.subscriberMiddleName)},
  subscriber_lname = ${sqlStringOrEmpty(input.subscriberLastName)},
  subscriber_DOB = ${nullableSqlString(input.subscriberDateOfBirth)},
  subscriber_sex = ${sqlStringOrEmpty(input.subscriberSex)},
  subscriber_street = ${sqlStringOrEmpty(input.subscriberStreet)},
  subscriber_street_line_2 = ${sqlStringOrEmpty(input.subscriberStreetLine2)},
  subscriber_city = ${sqlStringOrEmpty(input.subscriberCity)},
  subscriber_state = ${sqlStringOrEmpty(input.subscriberState)},
  subscriber_postal_code = ${sqlStringOrEmpty(input.subscriberPostalCode)},
  subscriber_country = ${sqlStringOrEmpty(input.subscriberCountry)},
  subscriber_phone = ${sqlStringOrEmpty(input.subscriberPhone)},
  subscriber_employer = ${sqlStringOrEmpty(input.subscriberEmployer)},
  subscriber_employer_street = ${sqlStringOrEmpty(input.subscriberEmployerStreet)},
  subscriber_employer_street_line_2 = ${sqlStringOrEmpty(input.subscriberEmployerStreetLine2)},
  subscriber_employer_city = ${sqlStringOrEmpty(input.subscriberEmployerCity)},
  subscriber_employer_state = ${sqlStringOrEmpty(input.subscriberEmployerState)},
  subscriber_employer_postal_code = ${sqlStringOrEmpty(input.subscriberEmployerPostalCode)},
  subscriber_employer_country = ${sqlStringOrEmpty(input.subscriberEmployerCountry)}
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

  async getAppointmentsForPatient(patientId: number | string, fromDate: string): Promise<AppointmentRecord[]> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT e.pc_eid AS id, e.pc_pid AS patientId, e.pc_aid AS providerId, e.pc_title AS title,
  DATE(e.pc_eventDate) AS eventDate, e.pc_startTime AS startTime, e.pc_endTime AS endTime,
  e.pc_apptstatus AS status, e.pc_facility AS facilityId, e.pc_billing_location AS billingLocationId,
  e.pc_room AS room, e.pc_catid AS categoryId, COALESCE(c.pc_catname, '') AS categoryName,
  COALESCE(e.pc_hometext, '') AS homeText, e.pc_recurrtype AS recurrenceType,
  COALESCE(e.pc_recurrspec, '') AS recurrenceSpec, DATE(e.pc_endDate) AS recurrenceEndDate
FROM openemr_postcalendar_events e
LEFT JOIN openemr_postcalendar_categories c ON c.pc_catid = e.pc_catid
WHERE e.pc_pid = ${integer(Number(patientId))}
  AND DATE(e.pc_eventDate) >= ${sqlString(fromDate)}
ORDER BY e.pc_eventDate, e.pc_startTime, e.pc_eid;
`);
    return rows.map((row) => ({
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
    }));
  }

  async getAppointmentSeriesOccurrences(patientId: number | string, fromDate: string): Promise<AppointmentSeriesOccurrence[]> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT e.pc_eid AS id, e.pc_pid AS patientId, e.pc_aid AS providerId,
  e.pc_title AS title, DATE(e.pc_eventDate) AS anchorDate, e.pc_startTime AS startTime,
  e.pc_apptstatus AS status, e.pc_facility AS facilityId, e.pc_billing_location AS billingLocationId,
  e.pc_room AS room, e.pc_catid AS categoryId, COALESCE(c.pc_catname, '') AS categoryName,
  e.pc_hometext AS comments,
  e.pc_recurrtype AS recurrenceType, COALESCE(e.pc_recurrspec, '') AS recurrenceSpec,
  DATE(e.pc_endDate) AS recurrenceEndDate
FROM openemr_postcalendar_events e
LEFT JOIN openemr_postcalendar_categories c ON c.pc_catid = e.pc_catid
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
        providerId: Number(row.providerId),
        title: row.title,
        anchorDate: row.anchorDate,
        startTime: row.startTime,
        status: row.status,
        facilityId: Number(row.facilityId),
        billingLocationId: Number(row.billingLocationId),
        room: row.room,
        categoryId: Number(row.categoryId),
        categoryName: row.categoryName || appointmentCategoryName(Number(row.categoryId)),
        comments: row.comments,
        recurrenceType: recurrence.recurrenceType,
        repeatFrequency: recurrence.repeatFrequency,
        repeatUnit: recurrence.repeatUnit,
        repeatOnNum: recurrence.repeatOnNum,
        repeatOnDay: recurrence.repeatOnDay,
        repeatOnFrequency: recurrence.repeatOnFrequency,
        recurrenceDays: recurrence.recurrenceDays,
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

  async addAppointmentRecurrenceException(id: number | string, occurrenceDate: string): Promise<void> {
    const appointment = await this.getAppointment(id);
    if (!appointment) {
      throw new Error(`Expected appointment ${id} to exist before adding a recurrence exception.`);
    }

    const nextExdates = Array.from(new Set([...(appointment.recurrenceExdates ?? []), occurrenceDate])).sort();
    await this.setAppointmentRecurrenceExdates(id, nextExdates);
  }

  async restoreAppointmentRecurrenceException(id: number | string, occurrenceDate: string): Promise<void> {
    const appointment = await this.getAppointment(id);
    if (!appointment) {
      throw new Error(`Expected appointment ${id} to exist before restoring a recurrence exception.`);
    }

    const nextExdates = appointment.recurrenceExdates.filter((date) => date !== occurrenceDate);
    await this.setAppointmentRecurrenceExdates(id, nextExdates);
  }

  async setAppointmentRecurrenceExdates(id: number | string, recurrenceExdates: string[]): Promise<void> {
    const legacyId = legacyInteger(id);
    const appointment = await this.getAppointment(legacyId);
    if (!appointment || appointment.recurrenceType <= 0) {
      throw new Error(`Expected recurring appointment ${id} to exist before setting recurrence exceptions.`);
    }

    const recurrenceSpec = serializeAppointmentRecurrence(
      appointment.recurrenceType,
      appointment.repeatFrequency,
      appointment.repeatUnit,
      appointment.repeatOnNum,
      appointment.repeatOnDay,
      appointment.repeatOnFrequency,
      recurrenceExdates,
      appointment.recurrenceDays);
    await this.db.execute(`
UPDATE openemr_postcalendar_events
SET pc_recurrspec = ${sqlString(recurrenceSpec)}
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
  COALESCE(portal_relation, '') AS portalRelation,
  COALESCE(is_msg_encrypted, 0) AS isEncrypted,
  COALESCE(CAST(update_by AS CHAR), '') AS updatedBy,
  COALESCE(DATE_FORMAT(update_date, '%Y-%m-%d %H:%i:%s'), '') AS updatedAt,
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
      portalRelation: row.portalRelation,
      isEncrypted: row.isEncrypted === "1",
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
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

  async replyPatientMessage(id: number | string, body: string, assignedTo: string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE pnotes
SET body = CONCAT(COALESCE(body, ''), '\n', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i'), ' (admin to ', ${sqlString(assignedTo)}, ') ', ${sqlString(body)}),
  assigned_to = ${sqlString(assignedTo)},
  update_by = 1,
  update_date = NOW()
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

  async replacePatientDocumentBinaryContent(
    id: number | string,
    input: PatientDocumentBinaryContentReplacement
  ): Promise<void> {
    const legacyId = legacyInteger(id);
    const contentBytes = Buffer.from(input.contentBase64, "base64");
    if (contentBytes.length === 0) {
      throw new Error("Replacement binary document content cannot be empty.");
    }

    const contentHex = contentBytes.toString("hex");
    const pages = input.mimetype === "application/pdf" ? 1 : 0;

    await this.db.execute(`
UPDATE documents
SET type = 'blob',
    size = ${integer(contentBytes.length)},
    date = NOW(),
    mimetype = ${sqlString(input.mimetype)},
    pages = ${integer(pages)},
    revision = NOW(),
    hash = SHA1(UNHEX(${sqlString(contentHex)})),
    storagemethod = 0,
    url = CASE
      WHEN COALESCE(url, '') LIKE 'gold://documents/%' THEN CONCAT(SUBSTRING_INDEX(url, '/', 4), '/', ${sqlString(input.fileName)})
      ELSE url
    END,
    document_data = UNHEX(${sqlString(contentHex)})
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

  async replaceEncounterDocumentBinaryContent(
    _encounter: number,
    id: number | string,
    input: PatientDocumentBinaryContentReplacement
  ): Promise<void> {
    await this.replacePatientDocumentBinaryContent(id, input);
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
   ${integer(input.billingFacilityId)}, 'AMB', ${nullableSqlString(input.sensitivity)}, ${sqlStringOrEmpty(input.referralSource)},
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
    referral_source = ${sqlStringOrEmpty(metadata.referralSource)},
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
  (uuid, provider_id, patient_id, encounter_id, lab_id, date_ordered, order_priority, order_status,
   patient_instructions, activity, control_id, specimen_type, clinical_hx, order_diagnosis,
   procedure_order_type, order_intent, location_id)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${integer(input.providerId)}, ${integer(input.patientId)}, ${integer(input.encounterId)},
   ${integer(input.labId ?? 0)}, ${sqlString(input.dateOrdered)}, ${sqlString(input.priority)}, ${sqlString(input.status)},
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

  async createProcedureLabProvider(input: NewProcedureLabProvider): Promise<number> {
    const providerName = input.labDirectorId
      ? await this.getProcedureLabProviderAddressBookOrganizationName(input.labDirectorId)
      : input.name;

    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO procedure_providers
  (uuid, name, lab_director, npi, send_app_id, send_fac_id, recv_app_id, recv_fac_id, DorP, direction, protocol,
   remote_host, login, password, orders_path, results_path, notes, active)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${sqlString(providerName)}, ${integer(input.labDirectorId ?? 0)}, ${sqlString(input.npi ?? "")},
   ${sqlString(input.sendApplicationId ?? "")}, ${sqlString(input.sendFacilityId ?? "")},
   ${sqlString(input.receiveApplicationId ?? "")}, ${sqlString(input.receiveFacilityId ?? "")},
   ${sqlString(input.usage ?? "D")}, ${sqlString(input.direction ?? "B")}, ${sqlString(input.protocol ?? "DL")},
   ${sqlString(input.remoteHost ?? "")}, ${sqlString(input.login ?? "")}, ${sqlString(input.password ?? "")},
   ${sqlString(input.ordersPath ?? "")}, ${sqlString(input.resultsPath ?? "")}, ${sqlString(input.notes ?? "")},
   ${input.active === false ? 0 : 1});
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async updateProcedureLabProvider(id: number, input: NewProcedureLabProvider): Promise<void> {
    const providerName = input.labDirectorId
      ? await this.getProcedureLabProviderAddressBookOrganizationName(input.labDirectorId)
      : input.name;

    await this.db.execute(`
UPDATE procedure_providers
SET name = ${sqlString(providerName)},
  lab_director = ${integer(input.labDirectorId ?? 0)},
  npi = ${sqlString(input.npi ?? "")},
  send_app_id = ${sqlString(input.sendApplicationId ?? "")},
  send_fac_id = ${sqlString(input.sendFacilityId ?? "")},
  recv_app_id = ${sqlString(input.receiveApplicationId ?? "")},
  recv_fac_id = ${sqlString(input.receiveFacilityId ?? "")},
  DorP = ${sqlString(input.usage ?? "D")},
  direction = ${sqlString(input.direction ?? "B")},
  protocol = ${sqlString(input.protocol ?? "DL")},
  remote_host = ${sqlString(input.remoteHost ?? "")},
  login = ${sqlString(input.login ?? "")},
  password = ${sqlString(input.password ?? "")},
  orders_path = ${sqlString(input.ordersPath ?? "")},
  results_path = ${sqlString(input.resultsPath ?? "")},
  notes = ${sqlString(input.notes ?? "")},
  active = ${input.active === false ? 0 : 1}
WHERE ppid = ${integer(id)};
`);
  }

  async deleteProcedureLabProvider(id: number): Promise<void> {
    await this.db.execute(`
DELETE FROM procedure_providers
WHERE ppid = ${integer(id)};
`);
  }

  async getProcedureLabProvider(id: number): Promise<ProcedureLabProviderRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT pp.ppid AS id,
  pp.name,
  COALESCE(pp.lab_director, 0) AS "labDirectorId",
  COALESCE(u.organization, '') AS "labDirectorName",
  COALESCE(u.abook_type, '') AS "labDirectorType",
  COALESCE(pp.npi, '') AS npi,
  COALESCE(pp.protocol, '') AS protocol,
  COALESCE(pp.DorP, '') AS "usage",
  COALESCE(pp.direction, '') AS direction,
  COALESCE(pp.send_app_id, '') AS "sendApplicationId",
  COALESCE(pp.send_fac_id, '') AS "sendFacilityId",
  COALESCE(pp.recv_app_id, '') AS "receiveApplicationId",
  COALESCE(pp.recv_fac_id, '') AS "receiveFacilityId",
  COALESCE(pp.remote_host, '') AS "remoteHost",
  COALESCE(pp.login, '') AS login,
  COALESCE(pp.password, '') AS password,
  COALESCE(pp.orders_path, '') AS "ordersPath",
  COALESCE(pp.results_path, '') AS "resultsPath",
  COALESCE(pp.notes, '') AS notes,
  pp.active
FROM procedure_providers pp
LEFT JOIN users u ON u.id = pp.lab_director
WHERE pp.ppid = ${integer(id)}
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
    const username = `parity-${input.organization.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28)}-${Date.now()}`;
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO users
  (uuid, username, password, authorized, fname, lname, facility, facility_id, see_auth,
   active, npi, title, specialty, email, calendar, taxonomy, abook_type, organization,
   main_menu_role, patient_menu_role, billing_facility_id)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${sqlString(username)}, '9d4e1e23bd5b727046a9e3b4b7db57bd8d6ee684',
   0, '', '', (SELECT name FROM facility WHERE id = 10 LIMIT 1), 10, 1,
   ${input.active === false ? 0 : 1}, ${sqlString(input.npi ?? "")}, '',
   ${sqlString(input.type ?? "ord_lab")}, ${sqlString(`${username}@example.test`)}, 0, '207Q00000X',
   ${sqlString(input.type ?? "ord_lab")}, ${sqlString(input.organization)}, 'standard', 'standard', 10);
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async deleteProcedureLabProviderAddressBookOrganization(id: number): Promise<void> {
    await this.db.execute(`
DELETE FROM users
WHERE id = ${integer(id)};
`);
  }

  async createProcedureOrderCatalogItem(input: NewProcedureOrderCatalogItem): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO procedure_type
  (parent, name, lab_id, procedure_code, procedure_type, procedure_type_name,
   body_site, specimen, route_admin, laterality, description, units, \`range\`,
   standard_code, related_code, seq, activity, notes)
VALUES
  (${integer(input.parentId ?? 0)}, ${sqlString(input.name)}, ${integer(input.labId ?? 0)},
   ${sqlString(input.code ?? "")}, ${sqlString(input.itemType ?? "ord")},
   ${sqlString(input.procedureTypeName ?? "laboratory")}, '', ${sqlString(input.specimen ?? "")},
   '', '', ${sqlString(input.description ?? "")}, '', '', ${sqlString(input.standardCode ?? "")},
   '', ${integer(input.sequence ?? 0)}, ${input.active === false ? 0 : 1}, '');
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async updateProcedureOrderCatalogItem(id: number, input: NewProcedureOrderCatalogItem): Promise<void> {
    await this.db.execute(`
UPDATE procedure_type
SET parent = ${integer(input.parentId ?? 0)},
    name = ${sqlString(input.name)},
    lab_id = ${integer(input.labId ?? 0)},
    procedure_code = ${sqlString(input.code ?? "")},
    procedure_type = ${sqlString(input.itemType ?? "ord")},
    procedure_type_name = ${sqlString(input.procedureTypeName ?? "laboratory")},
    specimen = ${sqlString(input.specimen ?? "")},
    description = ${sqlString(input.description ?? "")},
    standard_code = ${sqlString(input.standardCode ?? "")},
    seq = ${integer(input.sequence ?? 0)},
    activity = ${input.active === false ? 0 : 1}
WHERE procedure_type_id = ${integer(id)};
`);
  }

  async deleteProcedureOrderCatalogItem(id: number): Promise<void> {
    await this.db.execute(`
DELETE pt
FROM procedure_type pt
LEFT JOIN procedure_type child ON child.parent = pt.procedure_type_id
WHERE pt.procedure_type_id = ${integer(id)}
  AND child.procedure_type_id IS NULL;
`);
  }

  async getProcedureOrderCatalogItem(id: number): Promise<ProcedureOrderCatalogItemRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT pt.procedure_type_id AS id,
  pt.parent AS parentId,
  pt.lab_id AS labId,
  pt.name,
  pt.procedure_code AS code,
  pt.procedure_type AS itemType,
  COALESCE(pt.procedure_type_name, '') AS procedureTypeName,
  pt.description,
  pt.specimen,
  pt.standard_code AS standardCode,
  pt.seq AS sequence,
  pt.activity AS active,
  (SELECT COUNT(*) FROM procedure_type child WHERE child.parent = pt.procedure_type_id) AS childCount
FROM procedure_type pt
WHERE pt.procedure_type_id = ${integer(id)}
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
SELECT procedure_type_id AS id
FROM procedure_type
WHERE parent = ${integer(parentId)}
  AND procedure_code = ${sqlString(code)}
  AND procedure_type = ${sqlString(itemType)}
ORDER BY procedure_type_id DESC
LIMIT 1;
`);
    const id = rows[0]?.id;
    return id ? this.getProcedureOrderCatalogItem(Number(id)) : null;
  }

  async importProcedureVendorCompendium(
    input: ProcedureVendorCompendiumImportInput
  ): Promise<ProcedureVendorCompendiumImportResult> {
    const rows = parseProcedureCompendiumCsv(input.csvText, input.vendorFormat);
    const activeRows = await this.db.queryRows<{ count: string }>(`
SELECT COUNT(*) AS count
FROM procedure_type
WHERE parent = ${integer(input.parentId)}
  AND procedure_type = 'ord'
  AND activity = 1;
`);
    const deactivatedOrderCount = Number(activeRows[0]?.count ?? 0);

    await this.db.execute(`
UPDATE procedure_type
SET activity = 0
WHERE parent = ${integer(input.parentId)}
  AND procedure_type = 'ord';
`);

    let createdOrderCount = 0;
    let updatedOrderCount = 0;
    let reactivatedOrderCount = 0;
    let createdResultCount = 0;
    let updatedResultCount = 0;
    let reactivatedResultCount = 0;
    let importedResultCount = 0;
    const importedItems: ProcedureVendorCompendiumImportItem[] = [];
    const resultParentsCleared = new Set<number>();

    for (const row of rows) {
      const existingOrder = await this.getProcedureOrderCatalogItemByCode(input.parentId, row.orderCode, "ord");
      let orderId: number;
      let orderCreated = false;
      let orderReactivated = false;
      if (existingOrder) {
        orderId = existingOrder.id;
        orderReactivated = !existingOrder.active;
        updatedOrderCount += 1;
        if (orderReactivated) {
          reactivatedOrderCount += 1;
        }
        await this.db.execute(`
UPDATE procedure_type
SET parent = ${integer(input.parentId)},
    name = ${sqlString(row.orderName)},
    lab_id = ${integer(input.labId)},
    procedure_code = ${sqlString(row.orderCode)},
    procedure_type = 'ord',
    activity = 1
WHERE procedure_type_id = ${integer(orderId)};
`);
      } else {
        orderId = await this.createProcedureOrderCatalogItem({
          parentId: input.parentId,
          labId: input.labId,
          name: row.orderName,
          code: row.orderCode,
          itemType: "ord",
          procedureTypeName: "laboratory",
          sequence: 0,
          active: true
        });
        orderCreated = true;
        createdOrderCount += 1;
      }

      importedItems.push({
        id: orderId,
        parentId: input.parentId,
        code: row.orderCode,
        name: row.orderName,
        itemType: "ord",
        created: orderCreated,
        reactivated: orderReactivated
      });

      if (!resultParentsCleared.has(orderId)) {
        resultParentsCleared.add(orderId);
        await this.db.execute(`
UPDATE procedure_type
SET activity = 0
WHERE parent = ${integer(orderId)}
  AND procedure_type = 'res';
`);
      }

      if (input.vendorFormat !== "pathgroup" || !row.resultCode || !row.resultName) {
        continue;
      }

      importedResultCount += 1;
      const existingResult = await this.getProcedureOrderCatalogItemByCode(orderId, row.resultCode, "res");
      let resultId: number;
      let resultCreated = false;
      let resultReactivated = false;
      if (existingResult) {
        resultId = existingResult.id;
        resultReactivated = !existingResult.active;
        updatedResultCount += 1;
        if (resultReactivated) {
          reactivatedResultCount += 1;
        }
        await this.db.execute(`
UPDATE procedure_type
SET parent = ${integer(orderId)},
    name = ${sqlString(row.resultName)},
    lab_id = ${integer(input.labId)},
    procedure_code = ${sqlString(row.resultCode)},
    procedure_type = 'res',
    activity = 1
WHERE procedure_type_id = ${integer(resultId)};
`);
      } else {
        resultId = await this.createProcedureOrderCatalogItem({
          parentId: orderId,
          labId: input.labId,
          name: row.resultName,
          code: row.resultCode,
          itemType: "res",
          procedureTypeName: "",
          sequence: 0,
          active: true
        });
        resultCreated = true;
        createdResultCount += 1;
      }

      importedItems.push({
        id: resultId,
        parentId: orderId,
        code: row.resultCode,
        name: row.resultName,
        itemType: "res",
        created: resultCreated,
        reactivated: resultReactivated
      });
    }

    return {
      vendorFormat: input.vendorFormat,
      parentId: input.parentId,
      labId: input.labId,
      importedOrderCount: rows.length,
      createdOrderCount,
      updatedOrderCount,
      reactivatedOrderCount,
      deactivatedOrderCount,
      importedResultCount,
      createdResultCount,
      updatedResultCount,
      reactivatedResultCount,
      importedItems
    };
  }

  async deleteProcedureOrderCatalogSubtree(id: number): Promise<void> {
    await this.db.execute(`
DELETE FROM procedure_type
WHERE parent IN (
  SELECT procedure_type_id FROM (
    SELECT procedure_type_id
    FROM procedure_type
    WHERE parent = ${integer(id)}
  ) AS imported_orders
);
DELETE FROM procedure_type
WHERE parent = ${integer(id)};
DELETE FROM procedure_type
WHERE procedure_type_id = ${integer(id)};
`);
  }

  private async getProcedureLabProviderAddressBookOrganizationName(id: number): Promise<string> {
    const rows = await this.db.queryRows<{ organization: string }>(`
SELECT organization
FROM users
WHERE id = ${integer(id)}
  AND abook_type LIKE 'ord_%'
LIMIT 1;
`);
    const organization = rows[0]?.organization;
    if (!organization) {
      throw new Error(`Legacy procedure lab provider address book organization ${id} was not found.`);
    }

    return organization;
  }

  async getProcedureOrder(id: number): Promise<ProcedureOrderRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT po.procedure_order_id AS id, po.patient_id AS patientId, po.encounter_id AS encounterId,
  DATE(po.date_ordered) AS dateOrdered,
  po.order_status AS orderStatus, po.order_priority AS orderPriority,
  po.order_diagnosis AS diagnosis, po.patient_instructions AS instructions,
  COALESCE(DATE_FORMAT(po.date_transmitted, '%Y-%m-%d %H:%i'), '') AS dateTransmitted,
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
    await this.db.execute(`
UPDATE procedure_order
SET date_ordered = ${sqlString(input.dateOrdered)},
    order_priority = ${sqlString(input.priority)},
    order_status = ${sqlString(input.status)},
    patient_instructions = ${sqlString(input.instructions)},
    order_diagnosis = ${sqlString(input.diagnosis)}
WHERE procedure_order_id = ${integer(id)};

UPDATE procedure_order_code
SET procedure_code = ${sqlString(input.procedureCode)},
    procedure_name = ${sqlString(input.procedureName)},
    diagnoses = ${sqlString(input.diagnosis)},
    procedure_order_title = ${sqlString(input.procedureName)},
    procedure_type = ${sqlString(input.procedureType)}
WHERE procedure_order_id = ${integer(id)}
  AND procedure_order_seq = 1;
`);
  }

  async updateProcedureOrderStatus(id: number, status: string): Promise<void> {
    await this.db.execute(`
UPDATE procedure_order
SET order_status = ${sqlString(status)}
WHERE procedure_order_id = ${integer(id)};
`);
  }

  async transmitProcedureOrder(id: number, transmittedAt: string): Promise<void> {
    await this.db.execute(`
UPDATE procedure_order po
SET date_transmitted = ${sqlString(transmittedAt)}
WHERE po.procedure_order_id = ${integer(id)}
  AND po.date_transmitted IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM procedure_report pr
    WHERE pr.procedure_order_id = po.procedure_order_id
  );
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
SELECT pr.procedure_report_id AS id, pr.procedure_order_id AS orderId, pr.report_status AS reportStatus,
  DATE(pr.date_collected) AS dateCollected, DATE(pr.date_report) AS dateReport, COALESCE(pr.specimen_num, '') AS specimenNumber,
  pr.review_status AS reviewStatus,
  CASE WHEN pr.review_status = 'reviewed' THEN COALESCE(u.username, '') ELSE '' END AS reviewedBy,
  CASE WHEN pr.review_status = 'reviewed' THEN DATE_FORMAT(pr.date_report, '%Y-%m-%d %H:%i') ELSE '' END AS reviewedAt,
  COALESCE(pr.report_notes, '') AS reportNotes
FROM procedure_report pr
LEFT JOIN users u ON u.id = pr.source
WHERE pr.procedure_report_id = ${integer(id)}
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
    await this.db.execute(`
UPDATE procedure_report
SET date_collected = ${sqlString(input.dateCollected)},
    date_report = ${sqlString(input.dateReport)},
    specimen_num = ${sqlString(input.specimenNumber)},
    report_status = ${sqlString(input.reportStatus)},
    review_status = ${sqlString(input.reviewStatus)},
    report_notes = ${sqlString(input.notes)}
WHERE procedure_report_id = ${integer(id)};
`);
  }

  async signProcedureReport(id: number, input: ProcedureReportSignOff): Promise<void> {
    await this.db.execute(`
UPDATE procedure_report pr
INNER JOIN users u ON u.username = ${sqlString(input.reviewedBy)}
SET pr.review_status = 'reviewed',
    pr.source = u.id,
    pr.date_report = ${sqlString(input.reviewedAt)}
WHERE pr.procedure_report_id = ${integer(id)};
`);
  }

  async reopenProcedureReportReview(id: number): Promise<void> {
    await this.db.execute(`
UPDATE procedure_report
SET review_status = 'received'
WHERE procedure_report_id = ${integer(id)};
`);
  }

  async bulkSignProcedureReports(ids: number[], input: ProcedureReportSignOff): Promise<void> {
    const reportIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
    if (reportIds.length === 0) {
      return;
    }

    await this.db.execute(`
UPDATE procedure_report pr
INNER JOIN users u ON u.username = ${sqlString(input.reviewedBy)}
SET pr.review_status = 'reviewed',
    pr.source = u.id,
    pr.date_report = ${sqlString(input.reviewedAt)}
WHERE pr.procedure_report_id IN (${reportIds.map((id) => integer(id)).join(", ")})
  AND COALESCE(pr.review_status, '') <> 'reviewed';
`);
  }

  async createProcedureSpecimen(input: NewProcedureSpecimen): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO procedure_specimen
  (uuid, procedure_order_id, procedure_order_seq, specimen_identifier, accession_identifier,
   specimen_type_code, specimen_type, collection_method_code, collection_method,
   specimen_location_code, specimen_location, collected_date, volume_value, volume_unit,
   condition_code, specimen_condition, comments, deleted)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${integer(input.orderId)}, 1, ${sqlString(input.specimenIdentifier)},
   ${sqlString(input.accessionIdentifier)}, ${sqlString(input.specimenTypeCode)}, ${sqlString(input.specimenType)},
   ${sqlString(input.collectionMethodCode)}, ${sqlString(input.collectionMethod)},
   ${sqlString(input.specimenLocationCode)}, ${sqlString(input.specimenLocation)}, ${sqlString(input.collectedDate)},
   ${sqlString(input.volumeValue)}, ${sqlString(input.volumeUnit)}, ${sqlString(input.conditionCode)},
   ${sqlString(input.specimenCondition)}, ${sqlString(input.comments)}, 0);
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async getProcedureSpecimen(id: number): Promise<ProcedureSpecimenRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT procedure_specimen_id AS id, procedure_order_id AS orderId,
  COALESCE(specimen_identifier, '') AS specimenIdentifier,
  COALESCE(accession_identifier, '') AS accessionIdentifier,
  COALESCE(specimen_type_code, '') AS specimenTypeCode,
  COALESCE(specimen_type, '') AS specimenType,
  COALESCE(collection_method_code, '') AS collectionMethodCode,
  COALESCE(collection_method, '') AS collectionMethod,
  COALESCE(specimen_location_code, '') AS specimenLocationCode,
  COALESCE(specimen_location, '') AS specimenLocation,
  DATE(collected_date) AS collectedDate,
  COALESCE(volume_value, '') AS volumeValue,
  COALESCE(volume_unit, '') AS volumeUnit,
  COALESCE(condition_code, '') AS conditionCode,
  COALESCE(specimen_condition, '') AS specimenCondition,
  COALESCE(comments, '') AS comments
FROM procedure_specimen
WHERE procedure_specimen_id = ${integer(id)}
  AND COALESCE(deleted, 0) = 0
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

  async updateProcedureResult(id: number, input: NewProcedureResult): Promise<void> {
    await this.db.execute(`
UPDATE procedure_result
SET result_code = ${sqlString(input.resultCode)},
    result_text = ${sqlString(input.resultText)},
    date = ${sqlString(input.dateTime)},
    facility = ${sqlString(input.facility)},
    units = ${sqlString(input.units)},
    result = ${sqlString(input.result)},
    \`range\` = ${sqlString(input.range)},
    abnormal = ${sqlString(input.abnormal)},
    comments = ${sqlString(input.comments)},
    result_status = ${sqlString(input.status)}
WHERE procedure_result_id = ${integer(id)};
`);
  }

  async deleteProcedureOrderCascade(id: number): Promise<void> {
    await this.db.execute(`
DELETE pr
FROM procedure_result pr
INNER JOIN procedure_report rpt ON rpt.procedure_report_id = pr.procedure_report_id
WHERE rpt.procedure_order_id = ${integer(id)};
DELETE FROM procedure_report
WHERE procedure_order_id = ${integer(id)};
DELETE FROM procedure_specimen
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

function sqlStringOrEmpty(value: string | null | undefined) {
  return value === null || value === undefined || value.trim() === "" ? sqlString("") : sqlString(value);
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
  const isRepeatOn = type === 2;
  const repeatFrequency = type > 0 && type !== 3 && !isRepeatOn ? input.repeatFrequency ?? 1 : null;
  const repeatUnit = type === 3 ? 6 : type > 0 && !isRepeatOn ? input.repeatUnit ?? 1 : null;
  const repeatOnNum = isRepeatOn ? normalizeRepeatOnNum(input.repeatOnNum) : null;
  const repeatOnDay = isRepeatOn ? normalizeRepeatOnDay(input.repeatOnDay) : null;
  const repeatOnFrequency = isRepeatOn ? Math.max(1, input.repeatOnFrequency ?? 1) : null;
  const endDate = type > 0 ? input.recurrenceEndDate ?? input.eventDate : input.eventDate;
  const spec = serializeAppointmentRecurrence(
    type,
    repeatFrequency,
    repeatUnit,
    repeatOnNum,
    repeatOnDay,
    repeatOnFrequency,
    input.recurrenceExdates,
    input.recurrenceDays);
  return { type, repeatFrequency, repeatUnit, repeatOnNum, repeatOnDay, repeatOnFrequency, endDate, spec };
}

function parseAppointmentRecurrence(typeValue: string, spec: string, endDate: string | null) {
  const recurrenceType = Number(typeValue || 0);
  if (recurrenceType <= 0) {
    return {
      recurrenceType: 0,
      repeatFrequency: null,
      repeatUnit: null,
      repeatOnNum: null,
      repeatOnDay: null,
      repeatOnFrequency: null,
      recurrenceDays: [],
      recurrenceEndDate: null,
      recurrenceExdates: []
    };
  }

  if (recurrenceType === 3) {
    return {
      recurrenceType,
      repeatFrequency: null,
      repeatUnit: 6,
      repeatOnNum: null,
      repeatOnDay: null,
      repeatOnFrequency: null,
      recurrenceDays: numberListFromSerializedField(spec, "event_repeat_freq"),
      recurrenceEndDate: endDate,
      recurrenceExdates: dateListFromSerializedField(spec, "exdate")
    };
  }

  if (recurrenceType === 2) {
    return {
      recurrenceType,
      repeatFrequency: null,
      repeatUnit: null,
      repeatOnNum: numberFromSerializedField(spec, "event_repeat_on_num"),
      repeatOnDay: numberFromSerializedField(spec, "event_repeat_on_day"),
      repeatOnFrequency: numberFromSerializedField(spec, "event_repeat_on_freq"),
      recurrenceDays: [],
      recurrenceEndDate: endDate,
      recurrenceExdates: dateListFromSerializedField(spec, "exdate")
    };
  }

  return {
    recurrenceType,
    repeatFrequency: numberFromSerializedField(spec, "event_repeat_freq"),
    repeatUnit: numberFromSerializedField(spec, "event_repeat_freq_type"),
    repeatOnNum: null,
    repeatOnDay: null,
    repeatOnFrequency: null,
    recurrenceDays: [],
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

function numberListFromSerializedField(spec: string, fieldName: string) {
  const rawValue = stringFromSerializedField(spec, fieldName);
  if (!rawValue) {
    return [];
  }

  return Array.from(
    new Set(
      rawValue
        .split(/[,\s;]+/)
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7)
    )
  ).sort((left, right) => left - right);
}

function normalizeRecurrenceDays(recurrenceDays: number[] | undefined = undefined) {
  return Array.from(
    new Set(
      (recurrenceDays ?? [])
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7)
    )
  ).sort((left, right) => left - right);
}

function normalizeRepeatOnNum(value: number | null | undefined) {
  return Number.isInteger(value) && value! >= 1 && value! <= 5 ? value! : 1;
}

function normalizeRepeatOnDay(value: number | null | undefined) {
  return Number.isInteger(value) && value! >= 0 && value! <= 6 ? value! : 0;
}

function stringFromSerializedField(spec: string, fieldName: string) {
  const pattern = new RegExp(`s:${fieldName.length}:"${fieldName}";s:\\d+:"([^"]*)"`);
  const match = pattern.exec(spec);
  return match?.[1] ?? "";
}

function serializeAppointmentRecurrence(
  type: number,
  repeatFrequency: number | null,
  repeatUnit: number | null,
  repeatOnNum: number | null,
  repeatOnDay: number | null,
  repeatOnFrequency: number | null,
  recurrenceExdates: string[] | undefined = undefined,
  recurrenceDays: number[] | undefined = undefined
) {
  const normalizedExdates = type > 0
    ? Array.from(new Set(recurrenceExdates ?? []))
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
      .sort()
      .join(",")
    : "";
  const normalizedDays = type === 3 ? normalizeRecurrenceDays(recurrenceDays).join(",") : "";
  const fields: Record<string, string> = {
    event_repeat_freq: type === 3 ? normalizedDays : type > 0 && type !== 2 ? String(repeatFrequency ?? 1) : "0",
    event_repeat_freq_type: type === 3 ? "6" : type > 0 && type !== 2 ? String(repeatUnit ?? 1) : "0",
    event_repeat_on_num: type === 2 ? String(normalizeRepeatOnNum(repeatOnNum)) : "1",
    event_repeat_on_day: type === 2 ? String(normalizeRepeatOnDay(repeatOnDay)) : "0",
    event_repeat_on_freq: type === 2 ? String(Math.max(1, repeatOnFrequency ?? 1)) : "0",
    exdate: normalizedExdates
  };
  if (type === 2) {
    fields.rt2_pf_flag = "1";
  }
  const serialized = Object.entries(fields)
    .map(([key, value]) => `s:${key.length}:"${key}";s:${value.length}:"${value}";`)
    .join("");
  return `a:${Object.keys(fields).length}:{${serialized}}`;
}

function expandAppointmentSeriesOccurrences(
  appointment: {
    id: number | string;
    patientId: number;
    providerId: number | null;
    title: string;
    anchorDate: string;
    startTime: string;
    status: string | null;
    facilityId: number | null;
    billingLocationId: number | null;
    room: string | null;
    categoryId: number | null;
    categoryName: string | null;
    comments: string | null;
    recurrenceType: number;
    repeatFrequency: number | null;
    repeatUnit: number | null;
    repeatOnNum: number | null;
    repeatOnDay: number | null;
    repeatOnFrequency: number | null;
    recurrenceDays: number[];
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
  if (appointment.recurrenceType === 2) {
    const repeatOnNum = appointment.repeatOnNum ?? 0;
    const repeatOnDay = appointment.repeatOnDay ?? -1;
    const repeatOnFrequency = Math.max(1, appointment.repeatOnFrequency ?? 1);
    if (repeatOnNum < 1 || repeatOnNum > 5 || repeatOnDay < 0 || repeatOnDay > 6) {
      return [];
    }

    const anchor = parseDateOnly(appointment.anchorDate);
    let occurrenceNumber = 0;
    for (let monthOffset = 0; occurrenceNumber < 366; monthOffset += repeatOnFrequency) {
      const occurrenceMonth = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + monthOffset, 1));
      if (occurrenceMonth > end) {
        return occurrences;
      }

      const occurrenceDateValue = repeatOnOccurrenceDate(occurrenceMonth.getUTCFullYear(), occurrenceMonth.getUTCMonth(), repeatOnNum, repeatOnDay);
      if (!occurrenceDateValue || occurrenceDateValue < anchor) {
        continue;
      }

      occurrenceNumber++;
      if (occurrenceDateValue > end) {
        return occurrences;
      }

      const currentDate = formatDateOnly(occurrenceDateValue);
      if (occurrenceDateValue >= from && !exdates.has(currentDate)) {
        occurrences.push({
          id: occurrenceNumber === 1 ? appointment.id : `${appointment.id}::occurs::${currentDate}`,
          seriesRootId: appointment.id,
          patientId: appointment.patientId,
          providerId: appointment.providerId,
          title: appointment.title,
          date: currentDate,
          startTime: appointment.startTime,
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
          recurrenceDays: appointment.recurrenceDays,
          recurrenceEndDate: appointment.recurrenceEndDate,
          recurrenceExdates: appointment.recurrenceExdates ?? [],
          recurrenceExceptionCount: appointment.recurrenceExdates?.length ?? 0,
          occurrenceNumber,
          isVirtualOccurrence: currentDate !== appointment.anchorDate
        });
      }
    }

    return occurrences;
  }

  if (appointment.recurrenceType === 3) {
    const selectedDays = new Set(normalizeRecurrenceDays(appointment.recurrenceDays));
    if (selectedDays.size === 0) {
      return [];
    }

    let occurrenceNumber = 0;
    while (current <= end && occurrenceNumber < 366) {
      const currentDate = formatDateOnly(current);
      if (selectedDays.has(openEmrWeekday(current))) {
        occurrenceNumber++;
        if (current >= from && !exdates.has(currentDate)) {
          occurrences.push({
            id: occurrenceNumber === 1 ? appointment.id : `${appointment.id}::occurs::${currentDate}`,
            seriesRootId: appointment.id,
            patientId: appointment.patientId,
            providerId: appointment.providerId,
            title: appointment.title,
            date: currentDate,
            startTime: appointment.startTime,
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
            recurrenceDays: appointment.recurrenceDays,
            recurrenceEndDate: appointment.recurrenceEndDate,
            recurrenceExdates: appointment.recurrenceExdates ?? [],
            recurrenceExceptionCount: appointment.recurrenceExdates?.length ?? 0,
            occurrenceNumber,
            isVirtualOccurrence: currentDate !== appointment.anchorDate
          });
        }
      }

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return occurrences;
  }

  for (let occurrenceNumber = 1; current <= end && occurrenceNumber <= 366; occurrenceNumber++) {
    const currentDate = formatDateOnly(current);
    if (current >= from && !exdates.has(currentDate)) {
      occurrences.push({
        id: occurrenceNumber === 1 ? appointment.id : `${appointment.id}::occurs::${formatDateOnly(current)}`,
        seriesRootId: appointment.id,
        patientId: appointment.patientId,
        providerId: appointment.providerId,
        title: appointment.title,
        date: currentDate,
        startTime: appointment.startTime,
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
        recurrenceDays: appointment.recurrenceDays,
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

function repeatOnOccurrenceDate(year: number, monthIndex: number, repeatOnNum: number, repeatOnDay: number) {
  if (repeatOnNum < 1 || repeatOnNum > 5 || repeatOnDay < 0 || repeatOnDay > 6) {
    return null;
  }

  if (repeatOnNum === 5) {
    const lastDate = new Date(Date.UTC(year, monthIndex + 1, 0));
    while (lastDate.getUTCDay() !== repeatOnDay) {
      lastDate.setUTCDate(lastDate.getUTCDate() - 1);
    }
    return lastDate;
  }

  const firstDate = new Date(Date.UTC(year, monthIndex, 1));
  while (firstDate.getUTCDay() !== repeatOnDay) {
    firstDate.setUTCDate(firstDate.getUTCDate() + 1);
  }
  firstDate.setUTCDate(firstDate.getUTCDate() + (repeatOnNum - 1) * 7);
  return firstDate.getUTCMonth() === monthIndex ? firstDate : null;
}

function openEmrWeekday(value: Date) {
  return value.getUTCDay() + 1;
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

const seededPortalDemoPassword = "PortalPass207!";

function isSeededPortalPasswordHash(hash: string) {
  return hash.startsWith("$2y$") || hash.startsWith("$2a$") || hash.startsWith("$2b$");
}

function buildPortalLoginResult(
  username: string,
  failureReason: string | null,
  row?: Record<string, string>,
  authenticated = false
): PatientPortalLoginResult {
  const pid = row?.pid ? Number(row.pid) : null;
  return {
    authenticated,
    username,
    portalUsername: row?.portalUsername ?? "",
    canonicalId: row?.pubpid ?? "",
    pid,
    pubpid: row?.pubpid ?? "",
    displayName: row ? `${row.lastName}, ${row.firstName}` : "",
    failureReason
  };
}

function buildLegacyPortalSessionResult(sessionId: string): PatientPortalSessionResult {
  return {
    authenticated: false,
    sessionId,
    username: "",
    portalUsername: "",
    canonicalId: "",
    pid: null,
    pubpid: "",
    displayName: "",
    createdAt: null,
    lastSeenAt: null,
    expiresAt: null,
    endedAt: null,
    failureReason: "Legacy patient portal sessions are browser-cookie based.",
    sessionSource: "legacy-openemr-portal"
  };
}

function buildEmptyPortalHomeSummary(username: string, failureReason: string): PatientPortalHomeSummary {
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
    failureReason,
    sessionSource: "legacy-openemr-portal"
  };
}

function buildEmptyPortalMessagesResult(username: string, failureReason: string): PatientPortalMessagesResult {
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
    failureReason,
    sessionSource: "legacy-openemr-portal"
  };
}

function buildEmptyPortalComposeMessageResult(
  username: string,
  recipientId: string,
  failureReason: string
): PatientPortalComposeMessageResult {
  return {
    authenticated: false,
    created: false,
    username,
    portalUsername: "",
    canonicalId: "",
    pid: null,
    pubpid: "",
    displayName: "",
    recipientId,
    recipientName: "",
    sentMessage: null,
    recipientMessage: null,
    messageCount: 0,
    sentMessageCount: 0,
    failureReason,
    sessionSource: "legacy-openemr-portal"
  };
}

function appointmentCategoryLabel(categoryId: number | null): string | null {
  switch (categoryId) {
    case 9:
      return "Established Patient";
    case 10:
      return "New Patient";
    case 13:
      return "Preventive Care Services";
    case null:
      return null;
    default:
      return `Category ${categoryId}`;
  }
}

function normalizeDateText(value: string): string {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
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
