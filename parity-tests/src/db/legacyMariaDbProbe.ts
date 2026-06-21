import type { RuntimeTarget } from "../config/targets.js";
import { runCommand } from "../core/command.js";

export type GoldCountMap = Record<string, number>;

export type TemporalCoverageRow = {
  name: string;
  total: number;
  currentYear: number;
  futureCurrentYear: number;
  minDate: string | null;
  maxDate: string | null;
};

export type PatientRecord = {
  pid: number;
  pubpid: string;
  fname: string;
  lname: string;
  dob: string;
  sex: string;
  providerId: number;
  allowPatientPortal: string;
};

export type AppointmentSummary = {
  id: number | string;
  patientId: number;
  title: string;
  eventDate: string;
  startTime: string;
  status: string;
};

export type EncounterSummary = {
  id: number;
  encounter: number;
  patientId: number;
  date: string;
  reason: string;
};

export type EncounterClinicalDetail = {
  encounter: number;
  patientId: number;
  date: string;
  reason: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  bloodPressure: string;
  pulse: string;
};

export type ClinicalProblemSummary = {
  title: string;
  diagnosis: string;
  date: string;
  comments: string;
};

export type ClinicalAllergySummary = {
  title: string;
  reaction: string;
  severity: string;
  date: string;
  comments: string;
};

export type ClinicalMedicationSummary = {
  title: string;
  diagnosis: string;
  date: string;
  comments: string;
};

export type ClinicalPrescriptionSummary = {
  drug: string;
  dosage: string;
  route: string;
  diagnosis: string;
  startDate: string;
};

export type PatientImmunizationSummary = {
  id: number | string;
  vaccine: string;
  cvxCode: string;
  administeredDate: string;
  manufacturer: string;
  lotNumber: string;
  route: string;
  administrationSite: string;
  note: string;
  completionStatus: string;
};

export type PatientImmunizationsSummary = {
  patientId: number;
  immunizations: PatientImmunizationSummary[];
};

export type ClinicalListsSummary = {
  patientId: number;
  problems: ClinicalProblemSummary[];
  allergies: ClinicalAllergySummary[];
  medications: ClinicalMedicationSummary[];
  prescriptions: ClinicalPrescriptionSummary[];
};

export type PatientMessageSummary = {
  title: string;
  body: string;
  status: string;
  date: string;
};

export type PatientMessagesSummary = {
  patientId: number;
  portalEnabled: boolean;
  messages: PatientMessageSummary[];
};

export type PatientInsuranceSummary = {
  type: string;
  provider: string;
  planName: string;
  policyNumber: string;
  groupNumber: string;
  relationship: string;
};

export type PatientInsuranceCoverageSummary = {
  patientId: number;
  insurance: PatientInsuranceSummary[];
};

export type PatientDocumentSummary = {
  id: number;
  documentKey: string;
  categoryId: number;
  categoryName: string;
  name: string;
  docDate: string;
  uploadedAt: string;
  revisionAt: string;
  currentVersion: number;
  versionLabel: string;
  versionStatus: string;
  versionHistoryCount: number;
  hasPriorVersions: boolean;
  revisionHash: string;
  mimetype: string;
  fileName: string;
  sizeBytes: number;
  pages: number;
  encounter: number | null;
  storageMethod: string;
  url: string;
  hash: string;
  notes: string;
  contentPreview: string;
  previewKind: string;
  previewStatus: string;
  thumbnailLabel: string;
  thumbnailText: string;
  thumbnailDataUri: string | null;
  canPreviewInline: boolean;
  canDownload: boolean;
  isScannedAttachment: boolean;
  scanStatus: string;
  captureSource: string;
  scanPageCount: number;
  ocrStatus: string;
};

export type PatientDocumentsSummary = {
  patientId: number;
  documents: PatientDocumentSummary[];
};

export type PatientDocumentContentSummary = PatientDocumentSummary & {
  content: string;
  contentBase64: string;
  isBinary: boolean;
};

export type PatientDocumentPreviewFields = {
  previewKind: string;
  previewStatus: string;
  thumbnailLabel: string;
  thumbnailText: string;
  thumbnailDataUri: string | null;
  canPreviewInline: boolean;
  canDownload: boolean;
};

export type PatientDocumentScanFields = {
  isScannedAttachment: boolean;
  scanStatus: string;
  captureSource: string;
  scanPageCount: number;
  ocrStatus: string;
};

export type PatientDocumentRevisionFields = {
  revisionAt: string;
  currentVersion: number;
  versionLabel: string;
  versionStatus: string;
  versionHistoryCount: number;
  hasPriorVersions: boolean;
  revisionHash: string;
};

export function buildPatientDocumentRevisionFields(input: {
  revisionAt?: string | null;
  uploadedAt?: string | null;
  hash?: string | null;
  currentVersion?: number | null;
  versionHistoryCount?: number | null;
}): PatientDocumentRevisionFields {
  const currentVersion = input.currentVersion && input.currentVersion > 0 ? input.currentVersion : 1;
  const versionHistoryCount = input.versionHistoryCount && input.versionHistoryCount > 0
    ? input.versionHistoryCount
    : currentVersion;

  return {
    revisionAt: normalizeText(input.revisionAt) || normalizeText(input.uploadedAt),
    currentVersion,
    versionLabel: `Version ${currentVersion}`,
    versionStatus: "Current version",
    versionHistoryCount,
    hasPriorVersions: versionHistoryCount > 1,
    revisionHash: normalizeText(input.hash)
  };
}

export function buildPatientDocumentPreviewFields(input: {
  mimetype?: string | null;
  storageMethod?: string | null;
  fileName?: string | null;
  url?: string | null;
  pages?: number | null;
  contentPreview?: string | null;
  contentBase64?: string | null;
}): PatientDocumentPreviewFields {
  const mimetype = normalizeText(input.mimetype).toLowerCase();
  const storageMethod = normalizeText(input.storageMethod).toLowerCase();
  const fileName = normalizeText(input.fileName);
  const url = normalizeText(input.url);
  const previewText = buildPreviewText(input.contentPreview);

  if (storageMethod === "web_url" && url.length > 0) {
    return {
      previewKind: "external-link",
      previewStatus: "External link",
      thumbnailLabel: "LINK",
      thumbnailText: trimThumbnailText(url),
      thumbnailDataUri: null,
      canPreviewInline: false,
      canDownload: true
    };
  }

  if (mimetype.startsWith("text/")) {
    return {
      previewKind: "text",
      previewStatus: "Inline text preview",
      thumbnailLabel: "TXT",
      thumbnailText: previewText || "Text document",
      thumbnailDataUri: null,
      canPreviewInline: true,
      canDownload: true
    };
  }

  if (mimetype === "application/pdf") {
    return {
      previewKind: "pdf",
      previewStatus: "Inline PDF preview",
      thumbnailLabel: "PDF",
      thumbnailText: input.pages && input.pages > 0 ? `${input.pages} page PDF document` : "PDF document",
      thumbnailDataUri: null,
      canPreviewInline: true,
      canDownload: true
    };
  }

  if (mimetype.startsWith("image/")) {
    return {
      previewKind: "image",
      previewStatus: "Inline image preview",
      thumbnailLabel: "IMG",
      thumbnailText: fileName ? trimThumbnailText(fileName) : "Image document",
      thumbnailDataUri: buildThumbnailDataUri(mimetype, input.contentBase64),
      canPreviewInline: true,
      canDownload: true
    };
  }

  return {
    previewKind: "binary",
    previewStatus: "Download preview",
    thumbnailLabel: buildThumbnailLabel(fileName, mimetype),
    thumbnailText: fileName ? trimThumbnailText(fileName) : "Stored document",
    thumbnailDataUri: null,
    canPreviewInline: false,
    canDownload: true
  };
}

export function buildPatientDocumentScanFields(input: {
  name?: string | null;
  mimetype?: string | null;
  storageMethod?: string | null;
  fileName?: string | null;
  notes?: string | null;
  contentPreview?: string | null;
  pages?: number | null;
}): PatientDocumentScanFields {
  const evidence = [
    normalizeText(input.name),
    normalizeText(input.mimetype),
    normalizeText(input.storageMethod),
    normalizeText(input.fileName),
    normalizeText(input.notes),
    normalizeText(input.contentPreview)
  ].join(" ").toLowerCase();
  const isScannedAttachment = evidence.includes("scan") || evidence.includes("scanner");
  const scanPageCount = Math.max(input.pages ?? 0, isScannedAttachment ? 1 : 0);

  return {
    isScannedAttachment,
    scanStatus: isScannedAttachment ? "Scanned attachment" : "Not scanned",
    captureSource: isScannedAttachment ? extractCaptureSource(input.notes) ?? "Document scanner" : "Not captured by scanner",
    scanPageCount,
    ocrStatus: isScannedAttachment ? extractOcrStatus(input.notes, input.contentPreview) : "Not applicable"
  };
}

function buildThumbnailDataUri(mimetype: string, contentBase64?: string | null): string | null {
  const normalizedContent = normalizeText(contentBase64);
  if (!mimetype.startsWith("image/") || normalizedContent.length === 0) {
    return null;
  }

  return `data:${mimetype};base64,${normalizedContent}`;
}

function buildPreviewText(contentPreview?: string | null): string {
  const normalized = normalizeText(contentPreview);
  if (normalized.length === 0) {
    return "";
  }

  const firstLine = normalized.replace(/\r/g, "\n").split("\n").map((line) => line.trim()).find(Boolean);
  return trimThumbnailText(firstLine || normalized);
}

function buildThumbnailLabel(fileName: string, mimetype: string): string {
  const extension = fileName.includes(".") ? fileName.split(".").pop() ?? "" : "";
  if (extension.length > 0 && extension.length <= 4) {
    return extension.toUpperCase();
  }

  if (mimetype.includes("json")) {
    return "JSON";
  }

  return "FILE";
}

function trimThumbnailText(value: string): string {
  const normalized = normalizeText(value);
  return normalized.length <= 90 ? normalized : `${normalized.slice(0, 87)}...`;
}

function extractCaptureSource(notes?: string | null): string | null {
  const normalized = normalizeText(notes);
  const marker = "scan source:";
  const markerIndex = normalized.toLowerCase().indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const sourceStart = markerIndex + marker.length;
  const sourceEnd = normalized.indexOf(";", sourceStart);
  const source = sourceEnd < 0 ? normalized.slice(sourceStart) : normalized.slice(sourceStart, sourceEnd);
  return normalizeText(source) || null;
}

function extractOcrStatus(notes?: string | null, contentPreview?: string | null): string {
  const evidence = `${normalizeText(notes)} ${normalizeText(contentPreview)}`.toLowerCase();
  if (evidence.includes("ocr complete")) {
    return "OCR complete";
  }

  if (evidence.includes("ocr failed")) {
    return "OCR failed";
  }

  return evidence.includes("ocr pending") ? "OCR pending" : "OCR not started";
}

function normalizeText(value?: string | null): string {
  return value?.trim() ?? "";
}

export type BillingLineSummary = {
  id: string;
  encounter: number;
  codeType: string;
  code: string;
  modifier: string;
  codeText: string;
  fee: string;
  justify: string;
};

export type ClaimStatusSummary = {
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
  submittedClaim: string;
};

export type PaymentPostingSummary = {
  patientId: number;
  encounter: number;
  sequenceNo: number;
  codeType: string;
  code: string;
  modifier: string;
  payerType: number;
  sessionId: number;
  payerName: string;
  reference: string;
  paymentType: string;
  paymentMethod: string;
  checkDate: string;
  depositDate: string;
  postDate: string;
  postTime: string;
  payAmount: string;
  adjustmentAmount: string;
  memo: string;
  accountCode: string;
  reasonCode: string;
  payerClaimNumber: string;
};

export type AccountBalanceSummary = {
  patientId: number;
  encounter: number;
  lineCount: number;
  paymentCount: number;
  chargeAmount: string;
  paymentAmount: string;
  adjustmentAmount: string;
  balanceAmount: string;
};

export type AccountAgingSummary = {
  patientId: number;
  encounter: number;
  lastBillingDate: string;
  ageDays: number;
  lineCount: number;
  paymentCount: number;
  balanceAmount: string;
  agingBucket: string;
};

export type AccountLedgerEntry = {
  patientId: number;
  entryDate: string;
  encounter: number;
  entryType: string;
  description: string;
  code: string;
  reference: string;
  amount: string;
  runningBalanceAmount: string;
};

export type PatientStatementSummary = {
  patientId: number;
  recipientName: string;
  mailingAddressLine1: string;
  mailingAddressLine2: string;
  email: string;
  phone: string;
  statementStatus: string;
  statementPeriodStart: string;
  statementPeriodEnd: string;
  statementDate: string;
  dueDate: string;
  openEncounterCount: number;
  ledgerEntryCount: number;
  oldestOpenAgeDays: number;
  oldestOpenDate: string;
  chargeAmount: string;
  paymentAmount: string;
  adjustmentAmount: string;
  currentDueAmount: string;
  pastDueAmount: string;
  balanceDueAmount: string;
};

export type StatementBatchCandidate = {
  patientId: number;
  pubpid: string;
  patientDisplayName: string;
  statementNumber: string;
  statementStatus: string;
  statementDate: string;
  dueDate: string;
  balanceDueAmount: string;
  pastDueAmount: string;
  currentDueAmount: string;
  openEncounterCount: number;
  ledgerEntryCount: number;
  oldestOpenAgeDays: number;
  oldestOpenDate: string;
  deliveryMethod: string;
};

export type StatementBatchSummary = {
  asOfDate: string;
  candidateCount: number;
  totalBalanceAmount: string;
  totalPastDueAmount: string;
  totalCurrentDueAmount: string;
  candidates: StatementBatchCandidate[];
};

export type CollectionsWorkQueueItem = {
  patientId: number;
  pubpid: string;
  patientDisplayName: string;
  statementNumber: string;
  statementDate: string;
  dueDate: string;
  balanceDueAmount: string;
  pastDueAmount: string;
  over90Amount: string;
  currentDueAmount: string;
  openEncounterCount: number;
  ledgerEntryCount: number;
  oldestOpenAgeDays: number;
  oldestOpenDate: string;
  collectionTier: string;
  recommendedAction: string;
  contactMethod: string;
  email: string;
  phone: string;
};

export type CollectionsWorkQueueSummary = {
  asOfDate: string;
  accountCount: number;
  highPriorityCount: number;
  totalBalanceAmount: string;
  totalPastDueAmount: string;
  totalOver90Amount: string;
  items: CollectionsWorkQueueItem[];
};

export type AdministrationUserSummary = {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: string;
  authorized: boolean;
  active: boolean;
  calendar: boolean;
  facilityId: number;
  facilityName: string;
  email: string;
  npi: string;
};

export type AdministrationFacilitySummary = {
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

export type AdministrationDirectorySummary = {
  users: AdministrationUserSummary[];
  facilities: AdministrationFacilitySummary[];
};

export type AdministrationAccessGroupSummary = {
  id: number;
  value: string;
  name: string;
  parentId: number | null;
  permissionCount: number;
};

export type AdministrationAccessPermissionSummary = {
  sectionValue: string;
  value: string;
  name: string;
};

export type AdministrationAccessGroupPermissionSummary = {
  groupValue: string;
  sectionValue: string;
  permissionValue: string;
  permissionName: string;
  returnValue: string;
};

export type AdministrationAccessUserMembershipSummary = {
  userValue: string;
  userName: string;
  groupValue: string;
  groupName: string;
  staffId: number | null;
};

export type AdministrationAccessControlSummary = {
  groups: AdministrationAccessGroupSummary[];
  permissions: AdministrationAccessPermissionSummary[];
  groupPermissions: AdministrationAccessGroupPermissionSummary[];
  userMemberships: AdministrationAccessUserMembershipSummary[];
};

export type OperationalReportCounts = {
  patients: number;
  portalPatients: number;
  appointments: number;
  futureAppointments: number;
  currentYearAppointments: number;
  encounters: number;
  currentYearEncounters: number;
  billingLines: number;
  billingTotal: number;
  labReports: number;
  patientDocuments: number;
  messages: number;
  newMessages: number;
  doneMessages: number;
  facilities: number;
  providers: number;
};

export type ProviderActivityReportSummary = {
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  encounters: number;
  billingLines: number;
  billingTotal: number;
};

export type FacilityActivityReportSummary = {
  code: string;
  name: string;
  appointments: number;
  encounters: number;
  billingLines: number;
  billingTotal: number;
};

export type ClinicalConditionReportSummary = {
  title: string;
  diagnosis: string;
  patients: number;
};

export type OperationalReportsSummary = {
  counts: OperationalReportCounts;
  providerActivity: ProviderActivityReportSummary[];
  facilityActivity: FacilityActivityReportSummary[];
  clinicalConditions: ClinicalConditionReportSummary[];
};

export type OperationalReportExportRow = {
  section: string;
  name: string;
  metric: string;
  value: string;
};

export type ProcedureOrderSummary = {
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
};

export type ProcedureResultSummary = {
  id: number;
  reportId: number;
  code: string;
  text: string;
  units: string;
  result: string;
  range: string;
  abnormal: string;
  resultDate: string;
  resultStatus: string;
};

export type ProcedureReportSummary = {
  id: number;
  orderId: number;
  dateCollected: string;
  reportDate: string;
  specimenNumber: string;
  status: string;
  reviewStatus: string;
  reviewedBy: string;
  reviewedAt: string;
  reportNotes: string;
  results: ProcedureResultSummary[];
};

export type ProcedureReportReviewQueueItem = {
  reportId: number;
  orderId: number;
  patientId: number;
  pubpid: string;
  patientDisplayName: string;
  orderDate: string;
  providerId: number;
  labId: number;
  labName: string;
  procedureCode: string;
  procedureName: string;
  reportDate: string;
  reportStatus: string;
  reviewStatus: string;
  reviewedBy: string;
  reviewedAt: string;
  specimenNumber: string;
  notes: string;
};

export type ProcedureReportReviewQueueSummary = {
  statusFilter: string;
  patientFilter: string;
  providerFilter: string;
  labFilter: string;
  fromDate: string;
  toDate: string;
  totalReports: number;
  reviewedReports: number;
  unreviewedReports: number;
  reports: ProcedureReportReviewQueueItem[];
};

export type ProcedureOrderQueueItem = {
  orderId: number;
  patientId: number;
  pubpid: string;
  patientDisplayName: string;
  encounterId: number;
  orderDate: string;
  providerId: number;
  labId: number;
  labName: string;
  procedureCode: string;
  procedureName: string;
  procedureType: string;
  orderPriority: string;
  orderStatus: string;
  dateTransmitted: string;
  reportCount: number;
  resultCount: number;
  specimenCount: number;
  canTransmit: boolean;
  queueState: string;
  instructions: string;
};

export type ProcedureOrderQueueSummary = {
  statusFilter: string;
  patientFilter: string;
  providerFilter: string;
  labFilter: string;
  fromDate: string;
  toDate: string;
  totalOrders: number;
  readyToSendOrders: number;
  transmittedPendingOrders: number;
  reportedOrders: number;
  scheduledOrders: number;
  completedOrders: number;
  orders: ProcedureOrderQueueItem[];
};

export type ProcedureLabProviderDirectoryItem = {
  id: number;
  name: string;
  npi: string;
  protocol: string;
  active: boolean;
  orderCount: number;
  reportCount: number;
  futureOrderCount: number;
};

export type ProcedureLabProviderDirectorySummary = {
  includeInactive: boolean;
  totalProviders: number;
  activeProviders: number;
  inactiveProviders: number;
  providers: ProcedureLabProviderDirectoryItem[];
};

export type ProcedureOrderCatalogItem = {
  id: number;
  parentId: number | null;
  labId: number | null;
  labName: string | null;
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

export type ProcedureOrderCatalogSummary = {
  totalItems: number;
  groupCount: number;
  orderCount: number;
  labProviderCount: number;
  items: ProcedureOrderCatalogItem[];
};

export type ProcedureReportReviewQueueFilters = {
  patientId?: string;
  providerId?: string | number;
  labId?: string | number;
  fromDate?: string;
  toDate?: string;
};

export type ProcedureSpecimenSummary = {
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

export type ProcedureOrderWithResults = ProcedureOrderSummary & {
  specimens: ProcedureSpecimenSummary[];
  reports: ProcedureReportSummary[];
};

export type ProcedureResultsSummary = {
  patientId: number;
  orders: ProcedureOrderWithResults[];
};

export class LegacyMariaDbProbe {
  constructor(private readonly target: RuntimeTarget) {}

  async execute(sql: string): Promise<void> {
    await this.runSql(sql);
  }

  async queryRows<T extends Record<string, string>>(sql: string): Promise<T[]> {
    return parseTabRows<T>(await this.runSql(sql));
  }

  private async runSql(sql: string): Promise<string> {
    const dbUser = this.target.env.MYSQL_USER || this.target.database.defaultUser;
    const dbPassword = this.target.env.MYSQL_PASSWORD || "";
    const dbName = this.target.env.MYSQL_DATABASE || this.target.database.defaultDatabase;
    const command = [
      "docker",
      "compose",
      "exec",
      "-T",
      this.target.database.composeService ?? "mysql",
      "mariadb",
      "-B",
      "-u",
      dbUser,
      `-p${dbPassword}`,
      dbName,
      "-e",
      sql
    ];
    const result = await runCommand(command, { cwd: this.target.workingDirectoryAbs, timeoutMs: 120_000 });
    if (result.exitCode !== 0) {
      throw new Error(`MariaDB query failed.\n${result.stderr || result.stdout}`);
    }
    return result.stdout;
  }

  async getGoldCounts(): Promise<GoldCountMap> {
    const rows = await this.queryRows<{ name: string; value: string }>(`
SELECT 'patients' AS name, COUNT(*) AS value FROM patient_data
UNION ALL SELECT 'providersAndStaff', COUNT(*) FROM users WHERE username LIKE 'gold-%'
UNION ALL SELECT 'facilities', COUNT(*) FROM facility WHERE id IN (10, 11, 12)
UNION ALL SELECT 'insuranceRecords', COUNT(*) FROM insurance_data
UNION ALL SELECT 'appointments', COUNT(*) FROM openemr_postcalendar_events
UNION ALL SELECT 'encounters', COUNT(*) FROM form_encounter
UNION ALL SELECT 'vitals', COUNT(*) FROM form_vitals
UNION ALL SELECT 'clinicalNotes', COUNT(*) FROM form_soap
UNION ALL SELECT 'problems', COUNT(*) FROM lists WHERE type = 'medical_problem' AND activity = 1
UNION ALL SELECT 'allergies', COUNT(*) FROM lists WHERE type = 'allergy' AND activity = 1
UNION ALL SELECT 'medicationListEntries', COUNT(*) FROM lists WHERE type = 'medication' AND activity = 1
UNION ALL SELECT 'medicationsAndPrescriptions', COUNT(*) FROM prescriptions
UNION ALL SELECT 'immunizations', COUNT(*) FROM immunizations WHERE COALESCE(added_erroneously, 0) = 0
UNION ALL SELECT 'labOrders', COUNT(*) FROM procedure_order
UNION ALL SELECT 'labReports', COUNT(*) FROM procedure_report
UNION ALL SELECT 'labResults', COUNT(*) FROM procedure_result
UNION ALL SELECT 'messages', COUNT(*) FROM pnotes
UNION ALL SELECT 'patientDocuments', COUNT(*) FROM documents WHERE id BETWEEN 8000001 AND 8001200 AND deleted = 0
UNION ALL SELECT 'billingLineItems', COUNT(*) FROM billing
UNION ALL SELECT 'claims', COUNT(*) FROM claims
UNION ALL SELECT 'paymentSessions', COUNT(*) FROM ar_session
UNION ALL SELECT 'paymentActivities', COUNT(*) FROM ar_activity WHERE deleted IS NULL
UNION ALL SELECT 'portalPatients', COUNT(*) FROM patient_data WHERE allow_patient_portal = 'YES';
`);
    return Object.fromEntries(rows.map((row) => [row.name, Number(row.value)]));
  }

  async getTemporalCoverage(asOfDate: string, currentYear: string): Promise<Record<string, TemporalCoverageRow>> {
    const yearStart = `${currentYear}-01-01`;
    const nextYear = `${Number(currentYear) + 1}-01-01`;
    const rows = await this.queryRows<Record<string, string>>(`
SELECT 'appointments' AS name, COUNT(*) AS total,
  COALESCE(SUM(CASE WHEN DATE(pc_eventDate) >= '${yearStart}' AND DATE(pc_eventDate) < '${nextYear}' THEN 1 ELSE 0 END), 0) AS currentYear,
  COALESCE(SUM(CASE WHEN DATE(pc_eventDate) > '${asOfDate}' AND DATE(pc_eventDate) < '${nextYear}' THEN 1 ELSE 0 END), 0) AS futureCurrentYear,
  DATE(MIN(pc_eventDate)) AS minDate, DATE(MAX(pc_eventDate)) AS maxDate
FROM openemr_postcalendar_events
UNION ALL SELECT 'encounters', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date) >= '${yearStart}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date) > '${asOfDate}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date)), DATE(MAX(date))
FROM form_encounter
UNION ALL SELECT 'medicationListEntries', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date) >= '${yearStart}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date) > '${asOfDate}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date)), DATE(MAX(date))
FROM lists WHERE type = 'medication'
UNION ALL SELECT 'prescriptions', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(start_date) >= '${yearStart}' AND DATE(start_date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(start_date) > '${asOfDate}' AND DATE(start_date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  DATE(MIN(start_date)), DATE(MAX(start_date))
FROM prescriptions
UNION ALL SELECT 'immunizations', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(administered_date) >= '${yearStart}' AND DATE(administered_date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(administered_date) > '${asOfDate}' AND DATE(administered_date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  DATE(MIN(administered_date)), DATE(MAX(administered_date))
FROM immunizations WHERE COALESCE(added_erroneously, 0) = 0
UNION ALL SELECT 'procedureOrders', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date_ordered) >= '${yearStart}' AND DATE(date_ordered) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date_ordered) > '${asOfDate}' AND DATE(date_ordered) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date_ordered)), DATE(MAX(date_ordered))
FROM procedure_order
UNION ALL SELECT 'procedureReports', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date_report) >= '${yearStart}' AND DATE(date_report) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date_report) > '${asOfDate}' AND DATE(date_report) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date_report)), DATE(MAX(date_report))
FROM procedure_report
UNION ALL SELECT 'procedureResults', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date) >= '${yearStart}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date) > '${asOfDate}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date)), DATE(MAX(date))
FROM procedure_result
UNION ALL SELECT 'messages', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date) >= '${yearStart}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date) > '${asOfDate}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date)), DATE(MAX(date))
FROM pnotes
UNION ALL SELECT 'billingLineItems', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date) >= '${yearStart}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date) > '${asOfDate}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date)), DATE(MAX(date))
FROM billing
UNION ALL SELECT 'paymentPostings', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(post_date) >= '${yearStart}' AND DATE(post_date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(post_date) > '${asOfDate}' AND DATE(post_date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  DATE(MIN(post_date)), DATE(MAX(post_date))
FROM ar_activity WHERE deleted IS NULL
UNION ALL SELECT 'patientDocuments', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(docdate) >= '${yearStart}' AND DATE(docdate) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(docdate) > '${asOfDate}' AND DATE(docdate) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  DATE(MIN(docdate)), DATE(MAX(docdate))
FROM documents WHERE id BETWEEN 8000001 AND 8001200 AND deleted = 0;
`);
    return Object.fromEntries(
      rows.map((row) => [
        row.name,
        {
          name: row.name,
          total: Number(row.total),
          currentYear: Number(row.currentYear),
          futureCurrentYear: Number(row.futureCurrentYear),
          minDate: nullIfDbNull(row.minDate),
          maxDate: nullIfDbNull(row.maxDate)
        }
      ])
    );
  }

  async findPatientByCanonicalId(canonicalId: string): Promise<PatientRecord | null> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT pid, pubpid, fname, lname, DATE(DOB) AS dob, sex, providerID AS providerId, allow_patient_portal AS allowPatientPortal
FROM patient_data
WHERE pubpid = '${escapeSql(canonicalId)}'
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      pid: Number(row.pid),
      pubpid: row.pubpid,
      fname: row.fname,
      lname: row.lname,
      dob: row.dob,
      sex: row.sex,
      providerId: Number(row.providerId),
      allowPatientPortal: row.allowPatientPortal
    };
  }

  async getPatientWorkflowCounts(pid: number) {
    const rows = await this.queryRows<{ name: string; value: string }>(`
SELECT 'appointments' AS name, COUNT(*) AS value FROM openemr_postcalendar_events WHERE pc_pid = ${pid}
UNION ALL SELECT 'encounters', COUNT(*) FROM form_encounter WHERE pid = ${pid}
UNION ALL SELECT 'encounterSignatures', COUNT(*) FROM esign_signatures es INNER JOIN form_encounter fe ON fe.id = es.tid AND es.table = 'form_encounter' WHERE fe.pid = ${pid}
UNION ALL SELECT 'vitals', COUNT(*) FROM form_vitals WHERE pid = ${pid}
UNION ALL SELECT 'clinicalNotes', COUNT(*) FROM form_soap WHERE pid = ${pid}
UNION ALL SELECT 'problems', COUNT(*) FROM lists WHERE pid = ${pid} AND type = 'medical_problem' AND activity = 1
UNION ALL SELECT 'allergies', COUNT(*) FROM lists WHERE pid = ${pid} AND type = 'allergy' AND activity = 1
UNION ALL SELECT 'medications', COUNT(*) FROM lists WHERE pid = ${pid} AND type = 'medication' AND activity = 1
UNION ALL SELECT 'prescriptions', COUNT(*) FROM prescriptions WHERE patient_id = ${pid}
UNION ALL SELECT 'immunizations', COUNT(*) FROM immunizations WHERE patient_id = ${pid} AND COALESCE(added_erroneously, 0) = 0
UNION ALL SELECT 'messages', COUNT(*) FROM pnotes WHERE pid = ${pid}
UNION ALL SELECT 'documents', COUNT(*) FROM documents WHERE foreign_id = ${pid} AND deleted = 0
UNION ALL SELECT 'procedureOrders', COUNT(*) FROM procedure_order WHERE patient_id = ${pid}
UNION ALL SELECT 'billingLineItems', COUNT(*) FROM billing WHERE pid = ${pid}
UNION ALL SELECT 'claims', COUNT(*) FROM claims WHERE patient_id = ${pid}
UNION ALL SELECT 'paymentSessions', COUNT(*) FROM ar_session WHERE patient_id = ${pid}
UNION ALL SELECT 'paymentActivities', COUNT(*) FROM ar_activity WHERE pid = ${pid} AND deleted IS NULL;
`);
    return Object.fromEntries(rows.map((row) => [row.name, Number(row.value)]));
  }

  async getFutureAppointmentForPatient(pid: number, afterDate: string): Promise<AppointmentSummary | null> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT pc_eid AS id, pc_pid AS patientId, pc_title AS title, DATE(pc_eventDate) AS eventDate,
  pc_startTime AS startTime, pc_apptstatus AS status
FROM openemr_postcalendar_events
WHERE pc_pid = ${pid} AND pc_eventDate > '${escapeSql(afterDate)}'
ORDER BY pc_eventDate, pc_startTime
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
      eventDate: row.eventDate,
      startTime: row.startTime,
      status: row.status
    };
  }

  async getLatestEncounterForPatient(pid: number): Promise<EncounterSummary | null> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT id, encounter, pid AS patientId, DATE(date) AS date, reason
FROM form_encounter
WHERE pid = ${pid}
ORDER BY date DESC, id DESC
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
      date: row.date,
      reason: row.reason
    };
  }

  async getEncounterClinicalDetail(pid: number, encounter: number): Promise<EncounterClinicalDetail | null> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT fe.encounter, fe.pid AS patientId, DATE(fe.date) AS date, fe.reason,
  COALESCE(fs.subjective, '') AS subjective,
  COALESCE(fs.objective, '') AS objective,
  COALESCE(fs.assessment, '') AS assessment,
  COALESCE(fs.plan, '') AS plan,
  CONCAT(COALESCE(fv.bps, ''), '/', COALESCE(fv.bpd, '')) AS bloodPressure,
  COALESCE(CAST(fv.pulse AS CHAR), '') AS pulse
FROM form_encounter fe
LEFT JOIN forms fv_link ON fv_link.pid = fe.pid
  AND fv_link.encounter = fe.encounter
  AND fv_link.formdir = 'vitals'
  AND fv_link.deleted = 0
LEFT JOIN form_vitals fv ON fv.id = fv_link.form_id
LEFT JOIN forms fs_link ON fs_link.pid = fe.pid
  AND fs_link.encounter = fe.encounter
  AND fs_link.formdir = 'soap'
  AND fs_link.deleted = 0
LEFT JOIN form_soap fs ON fs.id = fs_link.form_id
WHERE fe.pid = ${pid} AND fe.encounter = ${encounter}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      encounter: Number(row.encounter),
      patientId: Number(row.patientId),
      date: row.date,
      reason: row.reason,
      subjective: row.subjective,
      objective: row.objective,
      assessment: row.assessment,
      plan: row.plan,
      bloodPressure: row.bloodPressure,
      pulse: row.pulse
    };
  }

  async getClinicalListsForPatient(pid: number): Promise<ClinicalListsSummary> {
    const problems = await this.queryRows<Record<string, string>>(`
SELECT title, COALESCE(diagnosis, '') AS diagnosis, DATE(date) AS date, COALESCE(comments, '') AS comments
FROM lists
WHERE pid = ${pid} AND type = 'medical_problem' AND activity = 1
ORDER BY date DESC, id;
`);
    const allergies = await this.queryRows<Record<string, string>>(`
SELECT title, COALESCE(reaction, '') AS reaction, COALESCE(severity_al, '') AS severity,
  DATE(date) AS date, COALESCE(comments, '') AS comments
FROM lists
WHERE pid = ${pid} AND type = 'allergy' AND activity = 1
ORDER BY date DESC, id;
`);
    const medications = await this.queryRows<Record<string, string>>(`
SELECT title, COALESCE(diagnosis, '') AS diagnosis, DATE(date) AS date, COALESCE(comments, '') AS comments
FROM lists
WHERE pid = ${pid} AND type = 'medication' AND activity = 1
ORDER BY date DESC, id;
`);
    const prescriptions = await this.queryRows<Record<string, string>>(`
SELECT drug, COALESCE(dosage, '') AS dosage, COALESCE(route, '') AS route,
  COALESCE(diagnosis, '') AS diagnosis, DATE(start_date) AS startDate
FROM prescriptions
WHERE patient_id = ${pid}
ORDER BY start_date DESC, id;
`);

    return {
      patientId: pid,
      problems: problems.map((row) => ({
        title: row.title,
        diagnosis: row.diagnosis,
        date: row.date,
        comments: row.comments
      })),
      allergies: allergies.map((row) => ({
        title: row.title,
        reaction: row.reaction,
        severity: row.severity,
        date: row.date,
        comments: row.comments
      })),
      medications: medications.map((row) => ({
        title: row.title,
        diagnosis: row.diagnosis,
        date: row.date,
        comments: row.comments
      })),
      prescriptions: prescriptions.map((row) => ({
        drug: row.drug,
        dosage: row.dosage,
        route: row.route,
        diagnosis: row.diagnosis,
        startDate: row.startDate
      }))
    };
  }

  async getPatientImmunizationsForPatient(pid: number): Promise<PatientImmunizationsSummary> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT i.id,
  COALESCE(NULLIF(c.code_text_short, ''), NULLIF(lo.title, ''), NULLIF(i.note, ''), COALESCE(i.cvx_code, '')) AS vaccine,
  COALESCE(i.cvx_code, '') AS cvxCode,
  DATE(i.administered_date) AS administeredDate,
  COALESCE(i.manufacturer, '') AS manufacturer,
  COALESCE(i.lot_number, '') AS lotNumber,
  COALESCE(i.route, '') AS route,
  COALESCE(i.administration_site, '') AS administrationSite,
  COALESCE(i.note, '') AS note,
  COALESCE(i.completion_status, '') AS completionStatus
FROM immunizations i
LEFT JOIN code_types ct ON ct.ct_key = 'CVX'
LEFT JOIN codes c ON c.code_type = ct.ct_id AND i.cvx_code = c.code
LEFT JOIN list_options lo ON lo.list_id = 'immunizations' AND lo.option_id = CAST(i.immunization_id AS CHAR)
WHERE i.patient_id = ${pid}
  AND COALESCE(i.added_erroneously, 0) = 0
ORDER BY i.administered_date DESC, i.id;
`);

    return {
      patientId: pid,
      immunizations: rows.map((row) => ({
        id: Number(row.id),
        vaccine: row.vaccine,
        cvxCode: row.cvxCode,
        administeredDate: row.administeredDate,
        manufacturer: row.manufacturer,
        lotNumber: row.lotNumber,
        route: row.route,
        administrationSite: row.administrationSite,
        note: row.note,
        completionStatus: row.completionStatus
      }))
    };
  }

  async getPatientMessagesForPatient(pid: number): Promise<PatientMessagesSummary> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT pn.title, pn.body, COALESCE(pn.message_status, '') AS status, DATE(pn.date) AS date,
  pd.allow_patient_portal AS portalEnabled
FROM pnotes pn
INNER JOIN patient_data pd ON pd.pid = pn.pid
WHERE pn.pid = ${pid} AND COALESCE(pn.deleted, 0) = 0
ORDER BY pn.date DESC, pn.id DESC;
`);

    return {
      patientId: pid,
      portalEnabled: rows.some((row) => row.portalEnabled === "YES"),
      messages: rows.map((row) => ({
        title: row.title,
        body: row.body,
        status: row.status,
        date: row.date
      }))
    };
  }

  async getPatientInsuranceForPatient(pid: number): Promise<PatientInsuranceCoverageSummary> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT COALESCE(insd.type, '') AS type,
  COALESCE(ic.name, insd.provider, '') AS provider,
  COALESCE(plan_name, '') AS planName,
  COALESCE(policy_number, '') AS policyNumber,
  COALESCE(group_number, '') AS groupNumber,
  COALESCE(subscriber_relationship, '') AS relationship
FROM insurance_data insd
LEFT JOIN insurance_companies ic ON ic.id = insd.provider
WHERE insd.pid = ${pid}
ORDER BY FIELD(insd.type, 'primary', 'secondary'), insd.type, insd.id;
`);

    return {
      patientId: pid,
      insurance: rows.map((row) => ({
        type: row.type,
        provider: row.provider,
        planName: row.planName,
        policyNumber: row.policyNumber,
        groupNumber: row.groupNumber,
        relationship: row.relationship
      }))
    };
  }

  async getPatientDocumentsForPatient(pid: number, includeGenerated = false): Promise<PatientDocumentsSummary> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT d.id,
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
  d.date AS uploadedAt,
  d.revision AS revisionAt,
  COALESCE(d.mimetype, '') AS mimetype,
  COALESCE(d.name, '') AS fileName,
  COALESCE(d.size, 0) AS sizeBytes,
  COALESCE(d.pages, 0) AS pages,
  COALESCE(d.encounter_id, 0) AS encounter,
  CASE COALESCE(d.storagemethod, 0) WHEN 0 THEN 'database' ELSE CAST(d.storagemethod AS CHAR) END AS storageMethod,
  COALESCE(d.url, '') AS url,
  COALESCE(d.hash, '') AS hash,
  COALESCE(d.documentationOf, '') AS notes,
  TO_BASE64(COALESCE(d.document_data, '')) AS contentBase64,
  LEFT(COALESCE(CONVERT(d.document_data USING utf8mb4), ''), 260) AS contentPreview
FROM documents d
LEFT JOIN categories_to_documents ctd ON ctd.document_id = d.id
LEFT JOIN categories c ON c.id = ctd.category_id
WHERE d.foreign_id = ${pid} AND d.deleted = 0${includeGenerated ? "" : " AND d.id BETWEEN 8000001 AND 8001200"}
ORDER BY d.docdate DESC, d.id DESC;
`);

    return {
      patientId: pid,
      documents: rows.map((row) => {
        const document = {
          id: Number(row.id),
          documentKey: row.documentKey,
          categoryId: Number(row.categoryId),
          categoryName: row.categoryName,
          name: row.name,
          docDate: row.docDate,
          uploadedAt: row.uploadedAt,
          revisionAt: row.revisionAt,
          mimetype: row.mimetype,
          fileName: row.fileName,
          sizeBytes: Number(row.sizeBytes),
          pages: Number(row.pages),
          encounter: Number(row.encounter) > 0 ? Number(row.encounter) : null,
          storageMethod: row.storageMethod,
          url: row.url,
          hash: row.hash,
          notes: row.notes,
          contentBase64: row.contentBase64.replace(/\\n/g, "").replace(/\s/g, ""),
          contentPreview: row.contentPreview
        };

        return {
          ...document,
          ...buildPatientDocumentRevisionFields(document),
          ...buildPatientDocumentPreviewFields(document),
          ...buildPatientDocumentScanFields(document)
        };
      })
    };
  }

  async getPatientDocumentsForEncounter(pid: number, encounter: number): Promise<PatientDocumentsSummary> {
    const documents = await this.getPatientDocumentsForPatient(pid, true);
    return {
      patientId: pid,
      documents: documents.documents.filter((document) => document.encounter === encounter)
    };
  }

  async getPatientDocumentContent(documentId: number): Promise<PatientDocumentContentSummary | null> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT d.id,
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
  d.date AS uploadedAt,
  d.revision AS revisionAt,
  COALESCE(d.mimetype, '') AS mimetype,
  COALESCE(d.name, '') AS fileName,
  COALESCE(d.size, 0) AS sizeBytes,
  COALESCE(d.pages, 0) AS pages,
  COALESCE(d.encounter_id, 0) AS encounter,
  CASE COALESCE(d.storagemethod, 0) WHEN 0 THEN 'database' ELSE CAST(d.storagemethod AS CHAR) END AS storageMethod,
  COALESCE(d.url, '') AS url,
  COALESCE(d.hash, '') AS hash,
  COALESCE(d.documentationOf, '') AS notes,
  LEFT(COALESCE(CONVERT(d.document_data USING utf8mb4), ''), 260) AS contentPreview,
  TO_BASE64(COALESCE(d.document_data, '')) AS contentBase64,
  COALESCE(CONVERT(d.document_data USING utf8mb4), '') AS content
FROM documents d
LEFT JOIN categories_to_documents ctd ON ctd.document_id = d.id
LEFT JOIN categories c ON c.id = ctd.category_id
WHERE d.id = ${documentId} AND d.deleted = 0
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    const document = {
      id: Number(row.id),
      documentKey: row.documentKey,
      categoryId: Number(row.categoryId),
      categoryName: row.categoryName,
      name: row.name,
      docDate: row.docDate,
      uploadedAt: row.uploadedAt,
      revisionAt: row.revisionAt,
      mimetype: row.mimetype,
      fileName: row.fileName,
      sizeBytes: Number(row.sizeBytes),
      pages: Number(row.pages),
      encounter: Number(row.encounter) > 0 ? Number(row.encounter) : null,
      storageMethod: row.storageMethod,
      url: row.url,
      hash: row.hash,
      notes: row.notes,
      contentPreview: row.contentPreview,
      content: row.content.replaceAll("\\n", "\n"),
      contentBase64: row.contentBase64.replace(/\\n/g, "").replace(/\s/g, ""),
      isBinary: row.mimetype !== "text/plain"
    };

    return {
      ...document,
      ...buildPatientDocumentRevisionFields(document),
      ...buildPatientDocumentPreviewFields(document),
      ...buildPatientDocumentScanFields(document)
    };
  }

  async getBillingLinesForEncounter(pid: number, encounter: number): Promise<BillingLineSummary[]> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT id, encounter, code_type AS codeType, code, code_text AS codeText,
  COALESCE(modifier, '') AS modifier, COALESCE(CAST(fee AS CHAR), '') AS fee, COALESCE(justify, '') AS justify
FROM billing
WHERE pid = ${pid} AND encounter = ${encounter} AND activity = 1
ORDER BY id;
`);
    return rows.map((row) => ({
      id: row.id,
      encounter: Number(row.encounter),
      codeType: row.codeType,
      code: row.code,
      modifier: row.modifier,
      codeText: row.codeText,
      fee: row.fee,
      justify: row.justify
    }));
  }

  async getClaimsForPatient(pid: number): Promise<ClaimStatusSummary[]> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT c.patient_id AS patientId, c.encounter_id AS encounter, c.version, c.payer_id AS payerId,
  COALESCE(ic.name, '') AS payerName, c.payer_type AS payerType, c.status, c.bill_process AS billProcess,
  COALESCE(DATE_FORMAT(c.bill_time, '%Y-%m-%d %H:%i:%s'), '') AS billTime,
  COALESCE(DATE_FORMAT(c.process_time, '%Y-%m-%d %H:%i:%s'), '') AS processTime,
  COALESCE(c.process_file, '') AS processFile, COALESCE(c.target, '') AS target,
  COALESCE(c.submitted_claim, '') AS submittedClaim
FROM claims c
LEFT JOIN insurance_companies ic ON ic.id = c.payer_id
WHERE c.patient_id = ${pid}
ORDER BY c.encounter_id, c.version;
`);
    return rows.map((row) => ({
      patientId: Number(row.patientId),
      encounter: Number(row.encounter),
      version: Number(row.version),
      payerId: Number(row.payerId),
      payerName: row.payerName,
      payerType: Number(row.payerType),
      status: Number(row.status),
      statusLabel: claimStatusLabel(Number(row.status), Number(row.billProcess)),
      billProcess: Number(row.billProcess),
      billTime: row.billTime,
      processTime: row.processTime,
      processFile: row.processFile,
      target: row.target,
      submittedClaim: row.submittedClaim
    }));
  }

  async getClaimsForEncounter(pid: number, encounter: number): Promise<ClaimStatusSummary[]> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT c.patient_id AS patientId, c.encounter_id AS encounter, c.version, c.payer_id AS payerId,
  COALESCE(ic.name, '') AS payerName, c.payer_type AS payerType, c.status, c.bill_process AS billProcess,
  COALESCE(DATE_FORMAT(c.bill_time, '%Y-%m-%d %H:%i:%s'), '') AS billTime,
  COALESCE(DATE_FORMAT(c.process_time, '%Y-%m-%d %H:%i:%s'), '') AS processTime,
  COALESCE(c.process_file, '') AS processFile, COALESCE(c.target, '') AS target,
  COALESCE(c.submitted_claim, '') AS submittedClaim
FROM claims c
LEFT JOIN insurance_companies ic ON ic.id = c.payer_id
WHERE c.patient_id = ${pid} AND c.encounter_id = ${encounter}
ORDER BY c.version;
`);
    return rows.map((row) => ({
      patientId: Number(row.patientId),
      encounter: Number(row.encounter),
      version: Number(row.version),
      payerId: Number(row.payerId),
      payerName: row.payerName,
      payerType: Number(row.payerType),
      status: Number(row.status),
      statusLabel: claimStatusLabel(Number(row.status), Number(row.billProcess)),
      billProcess: Number(row.billProcess),
      billTime: row.billTime,
      processTime: row.processTime,
      processFile: row.processFile,
      target: row.target,
      submittedClaim: row.submittedClaim
    }));
  }

  async getPaymentPostingsForPatient(pid: number): Promise<PaymentPostingSummary[]> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT aa.pid AS patientId, aa.encounter, aa.sequence_no AS sequenceNo,
  COALESCE(aa.code_type, '') AS codeType, COALESCE(aa.code, '') AS code,
  COALESCE(aa.modifier, '') AS modifier, aa.payer_type AS payerType, aa.session_id AS sessionId,
  COALESCE(ic.name, '') AS payerName, COALESCE(s.reference, '') AS reference,
  COALESCE(s.payment_type, '') AS paymentType, COALESCE(s.payment_method, '') AS paymentMethod,
  COALESCE(DATE_FORMAT(s.check_date, '%Y-%m-%d'), '') AS checkDate,
  COALESCE(DATE_FORMAT(s.deposit_date, '%Y-%m-%d'), '') AS depositDate,
  COALESCE(DATE_FORMAT(aa.post_date, '%Y-%m-%d'), '') AS postDate,
  COALESCE(DATE_FORMAT(aa.post_time, '%Y-%m-%d %H:%i:%s'), '') AS postTime,
  COALESCE(CAST(aa.pay_amount AS CHAR), '') AS payAmount,
  COALESCE(CAST(aa.adj_amount AS CHAR), '') AS adjustmentAmount,
  COALESCE(aa.memo, '') AS memo, COALESCE(aa.account_code, '') AS accountCode,
  COALESCE(aa.reason_code, '') AS reasonCode, COALESCE(aa.payer_claim_number, '') AS payerClaimNumber
FROM ar_activity aa
INNER JOIN ar_session s ON s.session_id = aa.session_id
LEFT JOIN insurance_companies ic ON ic.id = s.payer_id
WHERE aa.pid = ${pid} AND aa.deleted IS NULL
ORDER BY aa.encounter, aa.sequence_no;
`);
    return rows.map((row) => ({
      patientId: Number(row.patientId),
      encounter: Number(row.encounter),
      sequenceNo: Number(row.sequenceNo),
      codeType: row.codeType,
      code: row.code,
      modifier: row.modifier,
      payerType: Number(row.payerType),
      sessionId: Number(row.sessionId),
      payerName: row.payerName,
      reference: row.reference,
      paymentType: row.paymentType,
      paymentMethod: row.paymentMethod,
      checkDate: row.checkDate,
      depositDate: row.depositDate,
      postDate: row.postDate,
      postTime: row.postTime,
      payAmount: row.payAmount,
      adjustmentAmount: row.adjustmentAmount,
      memo: row.memo,
      accountCode: row.accountCode,
      reasonCode: row.reasonCode,
      payerClaimNumber: row.payerClaimNumber
    }));
  }

  async getAccountBalancesForPatient(pid: number): Promise<AccountBalanceSummary[]> {
    const rows = await this.queryRows<Record<string, string>>(`
WITH charges AS (
  SELECT pid, encounter, COUNT(*) AS \`lineCount\`, COALESCE(SUM(fee), 0) AS \`chargeAmount\`
  FROM billing
  WHERE pid = ${pid} AND activity = 1
  GROUP BY pid, encounter
),
payments AS (
  SELECT pid, encounter, COUNT(*) AS \`paymentCount\`,
    COALESCE(SUM(pay_amount), 0) AS \`paymentAmount\`,
    COALESCE(SUM(adj_amount), 0) AS \`adjustmentAmount\`
  FROM ar_activity
  WHERE pid = ${pid} AND deleted IS NULL
  GROUP BY pid, encounter
)
SELECT c.pid AS \`patientId\`, c.encounter, c.\`lineCount\`, COALESCE(p.\`paymentCount\`, 0) AS \`paymentCount\`,
  COALESCE(CAST(c.\`chargeAmount\` AS CHAR), '0') AS \`chargeAmount\`,
  COALESCE(CAST(p.\`paymentAmount\` AS CHAR), '0') AS \`paymentAmount\`,
  COALESCE(CAST(p.\`adjustmentAmount\` AS CHAR), '0') AS \`adjustmentAmount\`,
  COALESCE(CAST(c.\`chargeAmount\` - COALESCE(p.\`paymentAmount\`, 0) - COALESCE(p.\`adjustmentAmount\`, 0) AS CHAR), '0') AS \`balanceAmount\`
FROM charges c
LEFT JOIN payments p ON p.pid = c.pid AND p.encounter = c.encounter
UNION ALL
SELECT p.pid AS \`patientId\`, p.encounter, 0 AS \`lineCount\`, p.\`paymentCount\`,
  '0' AS \`chargeAmount\`,
  COALESCE(CAST(p.\`paymentAmount\` AS CHAR), '0') AS \`paymentAmount\`,
  COALESCE(CAST(p.\`adjustmentAmount\` AS CHAR), '0') AS \`adjustmentAmount\`,
  COALESCE(CAST(0 - p.\`paymentAmount\` - p.\`adjustmentAmount\` AS CHAR), '0') AS \`balanceAmount\`
FROM payments p
LEFT JOIN charges c ON c.pid = p.pid AND c.encounter = p.encounter
WHERE c.encounter IS NULL
ORDER BY encounter;
`);
    return rows.map((row) => ({
      patientId: Number(row.patientId),
      encounter: Number(row.encounter),
      lineCount: Number(row.lineCount),
      paymentCount: Number(row.paymentCount),
      chargeAmount: row.chargeAmount,
      paymentAmount: row.paymentAmount,
      adjustmentAmount: row.adjustmentAmount,
      balanceAmount: row.balanceAmount
    }));
  }

  async getAccountAgingForPatient(pid: number, asOfDate = "2026-06-18"): Promise<AccountAgingSummary[]> {
    const safeAsOfDate = escapeSql(asOfDate);
    const rows = await this.queryRows<Record<string, string>>(`
WITH charges AS (
  SELECT pid, encounter, COUNT(*) AS \`lineCount\`, COALESCE(SUM(fee), 0) AS \`chargeAmount\`,
    MAX(DATE(\`date\`)) AS \`lastBillingDate\`
  FROM billing
  WHERE pid = ${pid} AND activity = 1
  GROUP BY pid, encounter
),
payments AS (
  SELECT pid, encounter, COUNT(*) AS \`paymentCount\`,
    COALESCE(SUM(pay_amount), 0) AS \`paymentAmount\`,
    COALESCE(SUM(adj_amount), 0) AS \`adjustmentAmount\`
  FROM ar_activity
  WHERE pid = ${pid} AND deleted IS NULL
  GROUP BY pid, encounter
),
aged AS (
  SELECT c.pid AS \`patientId\`, c.encounter, c.\`lineCount\`, COALESCE(p.\`paymentCount\`, 0) AS \`paymentCount\`,
    DATE_FORMAT(c.\`lastBillingDate\`, '%Y-%m-%d') AS \`lastBillingDate\`,
    GREATEST(DATEDIFF('${safeAsOfDate}', c.\`lastBillingDate\`), 0) AS \`ageDays\`,
    c.\`chargeAmount\` - COALESCE(p.\`paymentAmount\`, 0) - COALESCE(p.\`adjustmentAmount\`, 0) AS \`balanceAmount\`
  FROM charges c
  LEFT JOIN payments p ON p.pid = c.pid AND p.encounter = c.encounter
  UNION ALL
  SELECT p.pid AS \`patientId\`, p.encounter, 0 AS \`lineCount\`, p.\`paymentCount\`,
    '${safeAsOfDate}' AS \`lastBillingDate\`, 0 AS \`ageDays\`,
    0 - p.\`paymentAmount\` - p.\`adjustmentAmount\` AS \`balanceAmount\`
  FROM payments p
  LEFT JOIN charges c ON c.pid = p.pid AND c.encounter = p.encounter
  WHERE c.encounter IS NULL
)
SELECT \`patientId\`, encounter, \`lastBillingDate\`, \`ageDays\`, \`lineCount\`, \`paymentCount\`,
  COALESCE(CAST(\`balanceAmount\` AS CHAR), '0') AS \`balanceAmount\`,
  CASE
    WHEN \`ageDays\` <= 30 THEN 'Current'
    WHEN \`ageDays\` <= 60 THEN '31-60'
    WHEN \`ageDays\` <= 90 THEN '61-90'
    ELSE 'Over 90'
  END AS \`agingBucket\`
FROM aged
ORDER BY encounter;
`);
    return rows.map((row) => ({
      patientId: Number(row.patientId),
      encounter: Number(row.encounter),
      lastBillingDate: row.lastBillingDate,
      ageDays: Number(row.ageDays),
      lineCount: Number(row.lineCount),
      paymentCount: Number(row.paymentCount),
      balanceAmount: row.balanceAmount,
      agingBucket: row.agingBucket
    }));
  }

  async getAccountLedgerForPatient(pid: number): Promise<AccountLedgerEntry[]> {
    const rows = await this.queryRows<Record<string, string>>(`
WITH entries AS (
  SELECT b.pid AS \`patientId\`, DATE(b.date) AS \`entryDate\`, b.encounter,
    'Charge' AS \`entryType\`, COALESCE(b.code_text, '') AS description,
    COALESCE(b.code, '') AS code, CAST(b.id AS CHAR) AS reference,
    b.fee AS amount, 0 AS priority
  FROM billing b
  WHERE b.pid = ${pid} AND b.activity = 1 AND COALESCE(b.fee, 0) <> 0
  UNION ALL
  SELECT aa.pid AS \`patientId\`, DATE(aa.post_date) AS \`entryDate\`, aa.encounter,
    'Payment' AS \`entryType\`, COALESCE(aa.memo, '') AS description,
    COALESCE(aa.code, '') AS code, COALESCE(CAST(s.reference AS CHAR), CAST(aa.session_id AS CHAR)) AS reference,
    -aa.pay_amount AS amount, 1 AS priority
  FROM ar_activity aa
  INNER JOIN ar_session s ON s.session_id = aa.session_id
  WHERE aa.pid = ${pid} AND aa.deleted IS NULL AND aa.pay_amount <> 0
  UNION ALL
  SELECT aa.pid AS \`patientId\`, DATE(aa.post_date) AS \`entryDate\`, aa.encounter,
    'Adjustment' AS \`entryType\`, COALESCE(aa.memo, '') AS description,
    COALESCE(aa.code, '') AS code, COALESCE(CAST(s.reference AS CHAR), CAST(aa.session_id AS CHAR)) AS reference,
    -aa.adj_amount AS amount, 2 AS priority
  FROM ar_activity aa
  INNER JOIN ar_session s ON s.session_id = aa.session_id
  WHERE aa.pid = ${pid} AND aa.deleted IS NULL AND aa.adj_amount <> 0
)
SELECT \`patientId\`, \`entryDate\`, encounter, \`entryType\`, description, code, reference,
  COALESCE(CAST(amount AS CHAR), '0') AS amount
FROM entries
ORDER BY \`entryDate\`, encounter, priority, code, description, reference;
`);
    return buildAccountLedgerEntries(rows);
  }

  async getPatientStatementForPatient(pid: number): Promise<PatientStatementSummary | null> {
    const patientRows = await this.queryRows<Record<string, string>>(`
SELECT pid AS patientId, fname AS firstName, lname AS lastName,
  COALESCE(street, '') AS street, COALESCE(city, '') AS city, COALESCE(state, '') AS state,
  COALESCE(postal_code, '') AS postalCode, COALESCE(email, '') AS email,
  COALESCE(NULLIF(phone_home, ''), NULLIF(phone_contact, ''), NULLIF(phone_cell, ''), '') AS phone
FROM patient_data
WHERE pid = ${pid}
LIMIT 1;
`);
    const patient = patientRows[0];
    if (!patient) {
      return null;
    }

    return buildPatientStatementSummary({
      patient,
      balances: await this.getAccountBalancesForPatient(pid),
      aging: await this.getAccountAgingForPatient(pid),
      ledger: await this.getAccountLedgerForPatient(pid)
    });
  }

  async getStatementBatchCandidates(limit = 5, asOfDate = "2026-06-18"): Promise<StatementBatchSummary> {
    const boundedLimit = Math.max(1, Math.min(100, limit));
    const safeAsOfDate = escapeSql(asOfDate);
    const rows = await this.queryRows<Record<string, string>>(`
WITH charges AS (
  SELECT pid, encounter, COUNT(*) AS \`lineCount\`, COALESCE(SUM(COALESCE(fee, 0)), 0) AS \`chargeAmount\`,
    MAX(DATE(\`date\`)) AS \`lastBillingDate\`
  FROM billing
  WHERE activity = 1
  GROUP BY pid, encounter
),
payments AS (
  SELECT pid, encounter, COUNT(*) AS \`paymentCount\`, COALESCE(SUM(pay_amount), 0) AS \`paymentAmount\`,
    COALESCE(SUM(adj_amount), 0) AS \`adjustmentAmount\`
  FROM ar_activity
  WHERE deleted IS NULL
  GROUP BY pid, encounter
),
aged AS (
  SELECT c.pid, c.encounter, c.\`lineCount\`, COALESCE(p.\`paymentCount\`, 0) AS \`paymentCount\`,
    c.\`lastBillingDate\`,
    GREATEST(DATEDIFF('${safeAsOfDate}', c.\`lastBillingDate\`), 0) AS \`ageDays\`,
    c.\`chargeAmount\` - COALESCE(p.\`paymentAmount\`, 0) - COALESCE(p.\`adjustmentAmount\`, 0) AS \`balanceAmount\`
  FROM charges c
  LEFT JOIN payments p ON p.pid = c.pid AND p.encounter = c.encounter
  UNION ALL
  SELECT p.pid, p.encounter, 0 AS \`lineCount\`, p.\`paymentCount\`,
    '${safeAsOfDate}' AS \`lastBillingDate\`, 0 AS \`ageDays\`,
    0 - p.\`paymentAmount\` - p.\`adjustmentAmount\` AS \`balanceAmount\`
  FROM payments p
  LEFT JOIN charges c ON c.pid = p.pid AND c.encounter = p.encounter
  WHERE c.encounter IS NULL
),
rollup AS (
  SELECT pid,
    COUNT(CASE WHEN \`balanceAmount\` > 0 THEN 1 END) AS \`openEncounterCount\`,
    COALESCE(MAX(CASE WHEN \`balanceAmount\` > 0 THEN \`ageDays\` END), 0) AS \`oldestOpenAgeDays\`,
    COALESCE(MIN(CASE WHEN \`balanceAmount\` > 0 THEN \`lastBillingDate\` END), '${safeAsOfDate}') AS \`oldestOpenDate\`,
    SUM(CASE WHEN \`ageDays\` <= 30 THEN \`balanceAmount\` ELSE 0 END) AS \`currentDueAmount\`,
    SUM(CASE WHEN \`ageDays\` > 30 THEN \`balanceAmount\` ELSE 0 END) AS \`pastDueAmount\`,
    SUM(\`balanceAmount\`) AS \`balanceDueAmount\`
  FROM aged
  GROUP BY pid
  HAVING SUM(\`balanceAmount\`) > 0
)
SELECT r.pid AS patientId, pd.pubpid, pd.fname AS firstName, pd.lname AS lastName,
  COALESCE(pd.email, '') AS email,
  COALESCE(CAST(r.\`openEncounterCount\` AS CHAR), '0') AS \`openEncounterCount\`,
  COALESCE(CAST(r.\`oldestOpenAgeDays\` AS CHAR), '0') AS \`oldestOpenAgeDays\`,
  DATE_FORMAT(r.\`oldestOpenDate\`, '%Y-%m-%d') AS \`oldestOpenDate\`,
  COALESCE(CAST(r.\`currentDueAmount\` AS CHAR), '0') AS \`currentDueAmount\`,
  COALESCE(CAST(r.\`pastDueAmount\` AS CHAR), '0') AS \`pastDueAmount\`,
  COALESCE(CAST(r.\`balanceDueAmount\` AS CHAR), '0') AS \`balanceDueAmount\`
FROM rollup r
INNER JOIN patient_data pd ON pd.pid = r.pid
ORDER BY r.\`pastDueAmount\` DESC, r.\`balanceDueAmount\` DESC, r.\`oldestOpenAgeDays\` DESC, r.pid;
`);
    const topRows = rows.slice(0, boundedLimit);
    const candidates: StatementBatchCandidate[] = [];
    for (const row of topRows) {
      const statement = await this.getPatientStatementForPatient(Number(row.patientId));
      if (!statement || Number(statement.balanceDueAmount) <= 0) {
        continue;
      }

      candidates.push({
        patientId: Number(row.patientId),
        pubpid: row.pubpid,
        patientDisplayName: `${row.lastName}, ${row.firstName}`,
        statementNumber: `STMT-${row.pubpid}-${statement.statementDate.replaceAll("-", "")}`,
        statementStatus: statement.statementStatus,
        statementDate: statement.statementDate,
        dueDate: statement.dueDate,
        balanceDueAmount: statement.balanceDueAmount,
        pastDueAmount: statement.pastDueAmount,
        currentDueAmount: statement.currentDueAmount,
        openEncounterCount: statement.openEncounterCount,
        ledgerEntryCount: statement.ledgerEntryCount,
        oldestOpenAgeDays: statement.oldestOpenAgeDays,
        oldestOpenDate: statement.oldestOpenDate,
        deliveryMethod: row.email.trim() ? "Email-ready" : "Print"
      });
    }

    return {
      asOfDate,
      candidateCount: rows.length,
      totalBalanceAmount: formatAmount(rows.reduce((sum, row) => sum + Number(row.balanceDueAmount), 0)),
      totalPastDueAmount: formatAmount(rows.reduce((sum, row) => sum + Number(row.pastDueAmount), 0)),
      totalCurrentDueAmount: formatAmount(rows.reduce((sum, row) => sum + Number(row.currentDueAmount), 0)),
      candidates
    };
  }

  async getCollectionsWorkQueue(limit = 5, asOfDate = "2026-06-18"): Promise<CollectionsWorkQueueSummary> {
    const boundedLimit = Math.max(1, Math.min(100, limit));
    const safeAsOfDate = escapeSql(asOfDate);
    const rows = await this.queryRows<Record<string, string>>(`
WITH charges AS (
  SELECT pid, encounter, COUNT(*) AS \`lineCount\`, COALESCE(SUM(COALESCE(fee, 0)), 0) AS \`chargeAmount\`,
    MAX(DATE(\`date\`)) AS \`lastBillingDate\`
  FROM billing
  WHERE activity = 1
  GROUP BY pid, encounter
),
payments AS (
  SELECT pid, encounter, COUNT(*) AS \`paymentCount\`, COALESCE(SUM(pay_amount), 0) AS \`paymentAmount\`,
    COALESCE(SUM(adj_amount), 0) AS \`adjustmentAmount\`
  FROM ar_activity
  WHERE deleted IS NULL
  GROUP BY pid, encounter
),
aged AS (
  SELECT c.pid, c.encounter, c.\`lineCount\`, COALESCE(p.\`paymentCount\`, 0) AS \`paymentCount\`,
    c.\`lastBillingDate\`,
    GREATEST(DATEDIFF('${safeAsOfDate}', c.\`lastBillingDate\`), 0) AS \`ageDays\`,
    c.\`chargeAmount\` - COALESCE(p.\`paymentAmount\`, 0) - COALESCE(p.\`adjustmentAmount\`, 0) AS \`balanceAmount\`
  FROM charges c
  LEFT JOIN payments p ON p.pid = c.pid AND p.encounter = c.encounter
  UNION ALL
  SELECT p.pid, p.encounter, 0 AS \`lineCount\`, p.\`paymentCount\`,
    '${safeAsOfDate}' AS \`lastBillingDate\`, 0 AS \`ageDays\`,
    0 - p.\`paymentAmount\` - p.\`adjustmentAmount\` AS \`balanceAmount\`
  FROM payments p
  LEFT JOIN charges c ON c.pid = p.pid AND c.encounter = p.encounter
  WHERE c.encounter IS NULL
),
rollup AS (
  SELECT pid,
    COUNT(CASE WHEN \`balanceAmount\` > 0 THEN 1 END) AS \`openEncounterCount\`,
    COALESCE(MAX(CASE WHEN \`balanceAmount\` > 0 THEN \`ageDays\` END), 0) AS \`oldestOpenAgeDays\`,
    COALESCE(MIN(CASE WHEN \`balanceAmount\` > 0 THEN \`lastBillingDate\` END), '${safeAsOfDate}') AS \`oldestOpenDate\`,
    SUM(CASE WHEN \`ageDays\` <= 30 THEN \`balanceAmount\` ELSE 0 END) AS \`currentDueAmount\`,
    SUM(CASE WHEN \`ageDays\` > 30 THEN \`balanceAmount\` ELSE 0 END) AS \`pastDueAmount\`,
    SUM(CASE WHEN \`ageDays\` > 90 THEN \`balanceAmount\` ELSE 0 END) AS \`over90Amount\`,
    SUM(\`balanceAmount\`) AS \`balanceDueAmount\`
  FROM aged
  GROUP BY pid
  HAVING SUM(\`balanceAmount\`) > 0
)
SELECT r.pid AS patientId, pd.pubpid, pd.fname AS firstName, pd.lname AS lastName,
  COALESCE(pd.email, '') AS email,
  COALESCE(NULLIF(pd.phone_home, ''), NULLIF(pd.phone_contact, ''), NULLIF(pd.phone_cell, ''), '') AS phone,
  COALESCE(CAST(r.\`openEncounterCount\` AS CHAR), '0') AS \`openEncounterCount\`,
  COALESCE(CAST(r.\`oldestOpenAgeDays\` AS CHAR), '0') AS \`oldestOpenAgeDays\`,
  DATE_FORMAT(r.\`oldestOpenDate\`, '%Y-%m-%d') AS \`oldestOpenDate\`,
  COALESCE(CAST(r.\`currentDueAmount\` AS CHAR), '0') AS \`currentDueAmount\`,
  COALESCE(CAST(r.\`pastDueAmount\` AS CHAR), '0') AS \`pastDueAmount\`,
  COALESCE(CAST(r.\`over90Amount\` AS CHAR), '0') AS \`over90Amount\`,
  COALESCE(CAST(r.\`balanceDueAmount\` AS CHAR), '0') AS \`balanceDueAmount\`
FROM rollup r
INNER JOIN patient_data pd ON pd.pid = r.pid
WHERE r.\`pastDueAmount\` > 0
ORDER BY r.\`over90Amount\` DESC, r.\`pastDueAmount\` DESC, r.\`balanceDueAmount\` DESC, r.\`oldestOpenAgeDays\` DESC, r.pid;
`);
    const topRows = rows.slice(0, boundedLimit);
    const items: CollectionsWorkQueueItem[] = [];
    for (const row of topRows) {
      const statement = await this.getPatientStatementForPatient(Number(row.patientId));
      if (!statement || Number(statement.pastDueAmount) <= 0) {
        continue;
      }

      const over90Amount = formatAmount(Number(row.over90Amount));
      items.push({
        patientId: Number(row.patientId),
        pubpid: row.pubpid,
        patientDisplayName: `${row.lastName}, ${row.firstName}`,
        statementNumber: `STMT-${row.pubpid}-${statement.statementDate.replaceAll("-", "")}`,
        statementDate: statement.statementDate,
        dueDate: statement.dueDate,
        balanceDueAmount: statement.balanceDueAmount,
        pastDueAmount: statement.pastDueAmount,
        over90Amount,
        currentDueAmount: statement.currentDueAmount,
        openEncounterCount: statement.openEncounterCount,
        ledgerEntryCount: statement.ledgerEntryCount,
        oldestOpenAgeDays: statement.oldestOpenAgeDays,
        oldestOpenDate: statement.oldestOpenDate,
        collectionTier: collectionTier(statement.oldestOpenAgeDays, Number(over90Amount)),
        recommendedAction: collectionRecommendedAction(statement.oldestOpenAgeDays, Number(over90Amount)),
        contactMethod: collectionContactMethod(row.email, row.phone),
        email: row.email,
        phone: row.phone
      });
    }

    return {
      asOfDate,
      accountCount: rows.length,
      highPriorityCount: rows.filter((row) => collectionTier(Number(row.oldestOpenAgeDays), Number(row.over90Amount)) === "High").length,
      totalBalanceAmount: formatAmount(rows.reduce((sum, row) => sum + Number(row.balanceDueAmount), 0)),
      totalPastDueAmount: formatAmount(rows.reduce((sum, row) => sum + Number(row.pastDueAmount), 0)),
      totalOver90Amount: formatAmount(rows.reduce((sum, row) => sum + Number(row.over90Amount), 0)),
      items
    };
  }

  async getAdministrationDirectory(): Promise<AdministrationDirectorySummary> {
    const users = await this.queryRows<Record<string, string>>(`
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
WHERE u.username LIKE 'gold-%'
ORDER BY u.id;
`);

    const facilities = await this.queryRows<Record<string, string>>(`
SELECT id, COALESCE(facility_code, '') AS code, name, COALESCE(phone, '') AS phone,
  COALESCE(street, '') AS street, COALESCE(city, '') AS city, COALESCE(state, '') AS state,
  COALESCE(postal_code, '') AS postalCode, COALESCE(color, '') AS color,
  CASE WHEN COALESCE(inactive, 0) = 0 THEN '1' ELSE '0' END AS active
FROM facility
WHERE id IN (10, 11, 12)
ORDER BY id;
`);

    return {
      users: users.map((row) => ({
        id: Number(row.id),
        username: row.username,
        firstName: row.firstName,
        lastName: row.lastName,
        displayName: `${row.lastName}, ${row.firstName}`,
        role: row.role,
        authorized: row.authorized === "1",
        active: row.active === "1",
        calendar: row.calendar === "1",
        facilityId: Number(row.facilityId),
        facilityName: row.facilityName,
        email: row.email,
        npi: row.npi
      })),
      facilities: facilities.map((row) => ({
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
      }))
    };
  }

  async getAdministrationAccessControl(): Promise<AdministrationAccessControlSummary> {
    const groups = await this.queryRows<Record<string, string>>(`
SELECT ag.id, ag.value, ag.name, ag.parent_id AS parentId, COUNT(am.value) AS permissionCount
FROM gacl_aro_groups ag
LEFT JOIN gacl_aro_groups_map gm ON gm.group_id = ag.id
LEFT JOIN gacl_acl acl ON acl.id = gm.acl_id AND acl.enabled = 1 AND acl.allow = 1
LEFT JOIN gacl_aco_map am ON am.acl_id = acl.id
GROUP BY ag.id, ag.value, ag.name, ag.parent_id
ORDER BY ag.id;
`);

    const permissions = await this.queryRows<Record<string, string>>(`
SELECT section_value AS sectionValue, value, name
FROM gacl_aco
WHERE hidden = 0
ORDER BY section_value, value;
`);

    const groupPermissions = await this.queryRows<Record<string, string>>(`
SELECT ag.value AS groupValue, am.section_value AS sectionValue, am.value AS permissionValue,
  aco.name AS permissionName, acl.return_value AS returnValue
FROM gacl_aro_groups ag
INNER JOIN gacl_aro_groups_map gm ON gm.group_id = ag.id
INNER JOIN gacl_acl acl ON acl.id = gm.acl_id
INNER JOIN gacl_aco_map am ON am.acl_id = acl.id
INNER JOIN gacl_aco aco ON aco.section_value = am.section_value AND aco.value = am.value
WHERE ag.id <> 10 AND acl.enabled = 1 AND acl.allow = 1 AND aco.hidden = 0
ORDER BY ag.id, am.section_value, am.value, acl.return_value;
`);

    const userMemberships = await this.queryRows<Record<string, string>>(`
SELECT aro.value AS userValue, aro.name AS userName, ag.value AS groupValue, ag.name AS groupName,
  COALESCE(CAST(u.id AS CHAR), '') AS staffId
FROM gacl_aro aro
INNER JOIN gacl_groups_aro_map gm ON gm.aro_id = aro.id
INNER JOIN gacl_aro_groups ag ON ag.id = gm.group_id
LEFT JOIN users u ON u.username = aro.value
WHERE aro.section_value = 'users'
ORDER BY ag.id, aro.value;
`);

    return {
      groups: groups.map((row) => ({
        id: Number(row.id),
        value: row.value,
        name: row.name,
        parentId: row.parentId === "0" ? null : Number(row.parentId),
        permissionCount: Number(row.permissionCount)
      })),
      permissions: permissions.map((row) => ({
        sectionValue: row.sectionValue,
        value: row.value,
        name: row.name
      })),
      groupPermissions: groupPermissions.map((row) => ({
        groupValue: row.groupValue,
        sectionValue: row.sectionValue,
        permissionValue: row.permissionValue,
        permissionName: row.permissionName,
        returnValue: row.returnValue
      })),
      userMemberships: userMemberships.map((row): AdministrationAccessUserMembershipSummary => ({
        userValue: row.userValue,
        userName: row.userName,
        groupValue: row.groupValue,
        groupName: row.groupName,
        staffId: row.staffId ? Number(row.staffId) : null
      }))
    };
  }

  async getOperationalReports(): Promise<OperationalReportsSummary> {
    const asOfDate = "2026-06-18";
    const yearStart = "2026-01-01";
    const nextYear = "2027-01-01";
    const countRows = await this.queryRows<{ name: string; value: string }>(`
SELECT 'patients' AS name, COUNT(*) AS value FROM patient_data
UNION ALL SELECT 'portalPatients', COUNT(*) FROM patient_data WHERE allow_patient_portal = 'YES'
UNION ALL SELECT 'appointments', COUNT(*) FROM openemr_postcalendar_events WHERE pc_pid <> 0
UNION ALL SELECT 'futureAppointments', COUNT(*) FROM openemr_postcalendar_events WHERE pc_pid <> 0 AND DATE(pc_eventDate) > '${asOfDate}'
UNION ALL SELECT 'currentYearAppointments', COUNT(*) FROM openemr_postcalendar_events WHERE pc_pid <> 0 AND DATE(pc_eventDate) >= '${yearStart}' AND DATE(pc_eventDate) < '${nextYear}'
UNION ALL SELECT 'encounters', COUNT(*) FROM form_encounter
UNION ALL SELECT 'currentYearEncounters', COUNT(*) FROM form_encounter WHERE DATE(date) >= '${yearStart}' AND DATE(date) < '${nextYear}'
UNION ALL SELECT 'billingLines', COUNT(*) FROM billing
UNION ALL SELECT 'billingTotal', COALESCE(SUM(fee), 0) FROM billing
UNION ALL SELECT 'labReports', COUNT(*) FROM procedure_report
UNION ALL SELECT 'patientDocuments', COUNT(*) FROM documents WHERE id BETWEEN 8000001 AND 8001200 AND deleted = 0
UNION ALL SELECT 'messages', COUNT(*) FROM pnotes
UNION ALL SELECT 'newMessages', COUNT(*) FROM pnotes WHERE message_status = 'New'
UNION ALL SELECT 'doneMessages', COUNT(*) FROM pnotes WHERE message_status = 'Done'
UNION ALL SELECT 'facilities', COUNT(*) FROM facility WHERE id IN (10, 11, 12)
UNION ALL SELECT 'providers', COUNT(*) FROM users WHERE username LIKE 'gold-provider-%';
`);
    const countMap = Object.fromEntries(countRows.map((row) => [row.name, Number(row.value)]));

    const providerRows = await this.queryRows<Record<string, string>>(`
SELECT u.username, u.fname AS firstName, u.lname AS lastName,
  COALESCE(pe.encounters, 0) AS encounters,
  COALESCE(pb.billing_lines, 0) AS billingLines,
  COALESCE(pb.billing_total, 0) AS billingTotal
FROM users u
LEFT JOIN (
  SELECT provider_id, COUNT(*) AS encounters
  FROM form_encounter
  GROUP BY provider_id
) pe ON pe.provider_id = u.id
LEFT JOIN (
  SELECT provider_id, COUNT(*) AS billing_lines, COALESCE(SUM(fee), 0) AS billing_total
  FROM billing
  GROUP BY provider_id
) pb ON pb.provider_id = u.id
WHERE u.username LIKE 'gold-provider-%'
ORDER BY encounters DESC, billingTotal DESC, u.id
LIMIT 8;
`);

    const facilityRows = await this.queryRows<Record<string, string>>(`
SELECT f.facility_code AS code, f.name,
  COALESCE(fa.appointments, 0) AS appointments,
  COALESCE(fe.encounters, 0) AS encounters,
  COALESCE(fb.billing_lines, 0) AS billingLines,
  COALESCE(fb.billing_total, 0) AS billingTotal
FROM facility f
LEFT JOIN (
  SELECT pc_facility, COUNT(*) AS appointments
  FROM openemr_postcalendar_events
  WHERE pc_pid <> 0
  GROUP BY pc_facility
) fa ON fa.pc_facility = f.id
LEFT JOIN (
  SELECT facility_id, COUNT(*) AS encounters
  FROM form_encounter
  GROUP BY facility_id
) fe ON fe.facility_id = f.id
LEFT JOIN (
  SELECT fe.facility_id, COUNT(b.id) AS billing_lines, COALESCE(SUM(b.fee), 0) AS billing_total
  FROM billing b
  INNER JOIN form_encounter fe ON fe.encounter = b.encounter
  GROUP BY fe.facility_id
) fb ON fb.facility_id = f.id
WHERE f.id IN (10, 11, 12)
ORDER BY f.id;
`);

    const conditionRows = await this.queryRows<Record<string, string>>(`
SELECT title, COALESCE(diagnosis, '') AS diagnosis, COUNT(*) AS patients
FROM lists
WHERE type = 'medical_problem' AND activity = 1
GROUP BY title, diagnosis
ORDER BY patients DESC, title
LIMIT 8;
`);

    return {
      counts: {
        patients: countMap.patients,
        portalPatients: countMap.portalPatients,
        appointments: countMap.appointments,
        futureAppointments: countMap.futureAppointments,
        currentYearAppointments: countMap.currentYearAppointments,
        encounters: countMap.encounters,
        currentYearEncounters: countMap.currentYearEncounters,
        billingLines: countMap.billingLines,
        billingTotal: countMap.billingTotal,
        labReports: countMap.labReports,
        patientDocuments: countMap.patientDocuments,
        messages: countMap.messages,
        newMessages: countMap.newMessages,
        doneMessages: countMap.doneMessages,
        facilities: countMap.facilities,
        providers: countMap.providers
      },
      providerActivity: providerRows.map((row) => ({
        username: row.username,
        firstName: row.firstName,
        lastName: row.lastName,
        displayName: `${row.lastName}, ${row.firstName}`,
        encounters: Number(row.encounters),
        billingLines: Number(row.billingLines),
        billingTotal: Number(row.billingTotal)
      })),
      facilityActivity: facilityRows.map((row) => ({
        code: row.code,
        name: row.name,
        appointments: Number(row.appointments),
        encounters: Number(row.encounters),
        billingLines: Number(row.billingLines),
        billingTotal: Number(row.billingTotal)
      })),
      clinicalConditions: conditionRows.map((row) => ({
        title: row.title,
        diagnosis: row.diagnosis,
        patients: Number(row.patients)
      }))
    };
  }

  async getOperationalReportExportRows(): Promise<OperationalReportExportRow[]> {
    return buildOperationalReportExportRows(await this.getOperationalReports());
  }

  async getLatestProcedureOrderForPatient(pid: number): Promise<ProcedureOrderSummary | null> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT po.procedure_order_id AS id, po.patient_id AS patientId, po.encounter_id AS encounterId,
  DATE(po.date_ordered) AS dateOrdered, po.order_status AS orderStatus,
  COALESCE(po.order_priority, '') AS orderPriority,
  poc.procedure_code AS procedureCode, poc.procedure_name AS procedureName,
  COALESCE(poc.procedure_type, '') AS procedureType,
  COALESCE(NULLIF(po.order_diagnosis, ''), COALESCE(poc.diagnoses, '')) AS diagnosis,
  COALESCE(po.patient_instructions, '') AS instructions
FROM procedure_order po
LEFT JOIN procedure_order_code poc ON poc.procedure_order_id = po.procedure_order_id AND poc.procedure_order_seq = 1
WHERE po.patient_id = ${pid}
ORDER BY po.date_ordered DESC, po.procedure_order_id DESC
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
      diagnosis: normalizeDiagnosisCode(row.diagnosis),
      instructions: row.instructions
    };
  }

  async getFutureScheduledProcedureOrderForPatient(pid: number, afterDate: string): Promise<ProcedureOrderSummary | null> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT po.procedure_order_id AS id, po.patient_id AS patientId, po.encounter_id AS encounterId,
  DATE(po.date_ordered) AS dateOrdered, po.order_status AS orderStatus,
  COALESCE(po.order_priority, '') AS orderPriority,
  poc.procedure_code AS procedureCode, poc.procedure_name AS procedureName,
  COALESCE(poc.procedure_type, '') AS procedureType,
  COALESCE(NULLIF(po.order_diagnosis, ''), COALESCE(poc.diagnoses, '')) AS diagnosis,
  COALESCE(po.patient_instructions, '') AS instructions
FROM procedure_order po
LEFT JOIN procedure_order_code poc ON poc.procedure_order_id = po.procedure_order_id AND poc.procedure_order_seq = 1
LEFT JOIN procedure_report pr ON pr.procedure_order_id = po.procedure_order_id
WHERE po.patient_id = ${pid}
  AND DATE(po.date_ordered) > '${escapeSql(afterDate)}'
  AND po.order_status = 'scheduled'
  AND pr.procedure_report_id IS NULL
ORDER BY po.date_ordered, po.procedure_order_id
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
      diagnosis: normalizeDiagnosisCode(row.diagnosis),
      instructions: row.instructions
    };
  }

  async getProcedureResultsForPatient(pid: number): Promise<ProcedureResultsSummary> {
    const orderRows = await this.queryRows<Record<string, string>>(`
SELECT po.procedure_order_id AS id, po.patient_id AS patientId, po.encounter_id AS encounterId,
  DATE(po.date_ordered) AS dateOrdered, po.order_status AS orderStatus,
  COALESCE(po.order_priority, '') AS orderPriority,
  poc.procedure_code AS procedureCode, poc.procedure_name AS procedureName,
  COALESCE(poc.procedure_type, '') AS procedureType,
  COALESCE(NULLIF(po.order_diagnosis, ''), COALESCE(poc.diagnoses, '')) AS diagnosis,
  COALESCE(po.patient_instructions, '') AS instructions
FROM procedure_order po
LEFT JOIN procedure_order_code poc ON poc.procedure_order_id = po.procedure_order_id AND poc.procedure_order_seq = 1
WHERE po.patient_id = ${pid}
ORDER BY po.date_ordered DESC, po.procedure_order_id DESC;
`);
    const orders: ProcedureOrderWithResults[] = orderRows.map((row) => ({
      id: Number(row.id),
      patientId: Number(row.patientId),
      encounterId: Number(row.encounterId),
      dateOrdered: row.dateOrdered,
      orderStatus: row.orderStatus,
      orderPriority: row.orderPriority,
      procedureCode: row.procedureCode,
      procedureName: row.procedureName,
      procedureType: row.procedureType,
      diagnosis: normalizeDiagnosisCode(row.diagnosis),
      instructions: row.instructions,
      specimens: [],
      reports: []
    }));

    if (orders.length === 0) {
      return { patientId: pid, orders };
    }

    const orderIdList = orders.map((order) => order.id).join(",");
    const specimenRows = await this.queryRows<Record<string, string>>(`
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
WHERE procedure_order_id IN (${orderIdList})
  AND COALESCE(deleted, 0) = 0
ORDER BY collected_date DESC, procedure_specimen_id DESC;
`);
    const specimens: ProcedureSpecimenSummary[] = specimenRows.map((row) => ({
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
    }));

    const reportRows = await this.queryRows<Record<string, string>>(`
SELECT pr.procedure_report_id AS id, pr.procedure_order_id AS orderId, DATE(pr.date_collected) AS dateCollected,
  DATE(pr.date_report) AS reportDate, COALESCE(pr.specimen_num, '') AS specimenNumber,
  COALESCE(pr.report_status, '') AS status, COALESCE(pr.review_status, '') AS reviewStatus,
  CASE WHEN pr.review_status = 'reviewed' THEN COALESCE(u.username, '') ELSE '' END AS reviewedBy,
  CASE WHEN pr.review_status = 'reviewed' THEN DATE_FORMAT(pr.date_report, '%Y-%m-%d %H:%i') ELSE '' END AS reviewedAt,
  COALESCE(pr.report_notes, '') AS reportNotes
FROM procedure_report pr
LEFT JOIN users u ON u.id = pr.source
WHERE pr.procedure_order_id IN (${orderIdList})
ORDER BY pr.date_report DESC, pr.procedure_report_id DESC;
`);
    const reports: ProcedureReportSummary[] = reportRows.map((row) => ({
      id: Number(row.id),
      orderId: Number(row.orderId),
      dateCollected: row.dateCollected,
      reportDate: row.reportDate,
      specimenNumber: row.specimenNumber,
      status: row.status,
      reviewStatus: row.reviewStatus,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      reportNotes: row.reportNotes,
      results: []
    }));

    if (reports.length > 0) {
      const reportIdList = reports.map((report) => report.id).join(",");
      const resultRows = await this.queryRows<Record<string, string>>(`
SELECT procedure_result_id AS id, procedure_report_id AS reportId, COALESCE(result_code, '') AS code,
  COALESCE(result_text, '') AS text, COALESCE(units, '') AS units, COALESCE(result, '') AS result,
  COALESCE(\`range\`, '') AS resultRange, COALESCE(abnormal, '') AS abnormal, DATE(date) AS resultDate,
  COALESCE(result_status, '') AS resultStatus
FROM procedure_result
WHERE procedure_report_id IN (${reportIdList})
ORDER BY procedure_result_id;
`);

      const resultsByReport = new Map<number, ProcedureResultSummary[]>();
      for (const row of resultRows) {
        const reportId = Number(row.reportId);
        const reportResults = resultsByReport.get(reportId) ?? [];
        reportResults.push({
          id: Number(row.id),
          reportId,
          code: row.code,
          text: row.text,
          units: row.units,
          result: row.result,
          range: row.resultRange,
          abnormal: row.abnormal,
          resultDate: row.resultDate,
          resultStatus: row.resultStatus
        });
        resultsByReport.set(reportId, reportResults);
      }

      for (const report of reports) {
        report.results = resultsByReport.get(report.id) ?? [];
      }
    }

    const specimensByOrder = new Map<number, ProcedureSpecimenSummary[]>();
    for (const specimen of specimens) {
      const orderSpecimens = specimensByOrder.get(specimen.orderId) ?? [];
      orderSpecimens.push(specimen);
      specimensByOrder.set(specimen.orderId, orderSpecimens);
    }

    const reportsByOrder = new Map<number, ProcedureReportSummary[]>();
    for (const report of reports) {
      const orderReports = reportsByOrder.get(report.orderId) ?? [];
      orderReports.push(report);
      reportsByOrder.set(report.orderId, orderReports);
    }

    for (const order of orders) {
      order.specimens = specimensByOrder.get(order.id) ?? [];
      order.reports = reportsByOrder.get(order.id) ?? [];
    }

    return { patientId: pid, orders };
  }

  async getProcedureResultsForEncounter(pid: number, encounter: number): Promise<ProcedureResultsSummary> {
    const procedures = await this.getProcedureResultsForPatient(pid);
    return {
      patientId: pid,
      orders: procedures.orders.filter((order) => order.encounterId === encounter)
    };
  }

  async getProcedureReportReviewQueue(
    status = "unreviewed",
    filters: ProcedureReportReviewQueueFilters = {}
  ): Promise<ProcedureReportReviewQueueSummary> {
    const statusFilter = normalizeProcedureReportReviewQueueStatus(status);
    const patientFilter = filters.patientId?.trim();
    const providerFilter = filters.providerId === undefined || filters.providerId === null ? "" : String(filters.providerId).trim();
    const labFilter = filters.labId === undefined || filters.labId === null ? "" : String(filters.labId).trim();
    const fromDate = filters.fromDate?.trim();
    const toDate = filters.toDate?.trim();
    const patientFilterSql = patientFilter && /^\d+$/u.test(patientFilter)
      ? `po.patient_id = ${patientFilter}`
      : "0 = 1";
    const whereFilters = [
      patientFilter
        ? `AND (${patientFilterSql} OR pd.pubpid = '${escapeSql(patientFilter)}')`
        : "",
      providerFilter && /^\d+$/u.test(providerFilter) ? `AND po.provider_id = ${providerFilter}` : "",
      labFilter && /^\d+$/u.test(labFilter) ? `AND po.lab_id = ${labFilter}` : "",
      fromDate ? `AND DATE(po.date_ordered) >= '${escapeSql(fromDate)}'` : "",
      toDate ? `AND DATE(po.date_ordered) <= '${escapeSql(toDate)}'` : ""
    ].filter(Boolean).join("\n  ");
    const counts = await this.queryRows<Record<string, string>>(`
SELECT COUNT(*) AS totalReports,
  COALESCE(SUM(CASE WHEN COALESCE(pr.review_status, '') = 'reviewed' THEN 1 ELSE 0 END), 0) AS reviewedReports,
  COALESCE(SUM(CASE WHEN COALESCE(pr.review_status, '') != 'reviewed' THEN 1 ELSE 0 END), 0) AS unreviewedReports
FROM procedure_report pr
INNER JOIN procedure_order po ON po.procedure_order_id = pr.procedure_order_id
LEFT JOIN patient_data pd ON pd.pid = po.patient_id
WHERE 1 = 1
  ${whereFilters};
`);
    const whereStatus = statusFilter === "reviewed"
      ? "AND COALESCE(pr.review_status, '') = 'reviewed'"
      : statusFilter === "unreviewed"
        ? "AND COALESCE(pr.review_status, '') != 'reviewed'"
        : "";
    const rows = await this.queryRows<Record<string, string>>(`
SELECT pr.procedure_report_id AS reportId, po.procedure_order_id AS orderId, po.patient_id AS patientId,
  pd.pubpid,
  TRIM(CONCAT(pd.lname, ', ', pd.fname)) AS patientDisplayName,
  DATE(po.date_ordered) AS orderDate,
  COALESCE(po.provider_id, 0) AS providerId,
  COALESCE(po.lab_id, 0) AS labId,
  COALESCE(pp.name, '') AS labName,
  COALESCE(pc.procedure_code, '') AS procedureCode,
  COALESCE(pc.procedure_name, '') AS procedureName,
  DATE_FORMAT(pr.date_report, '%Y-%m-%d %H:%i') AS reportDate,
  COALESCE(pr.report_status, '') AS reportStatus,
  COALESCE(pr.review_status, '') AS reviewStatus,
  CASE WHEN pr.review_status = 'reviewed' THEN COALESCE(u.username, '') ELSE '' END AS reviewedBy,
  CASE WHEN pr.review_status = 'reviewed' THEN DATE_FORMAT(pr.date_report, '%Y-%m-%d %H:%i') ELSE '' END AS reviewedAt,
  COALESCE(pr.specimen_num, '') AS specimenNumber,
  COALESCE(pr.report_notes, '') AS notes
FROM procedure_report pr
INNER JOIN procedure_order po ON po.procedure_order_id = pr.procedure_order_id
LEFT JOIN procedure_order_code pc ON pc.procedure_order_id = po.procedure_order_id
  AND pc.procedure_order_seq = pr.procedure_order_seq
LEFT JOIN patient_data pd ON pd.pid = po.patient_id
LEFT JOIN users u ON u.id = pr.source
LEFT JOIN procedure_providers pp ON pp.ppid = po.lab_id
WHERE 1 = 1
  ${whereFilters}
  ${whereStatus}
ORDER BY pr.date_report DESC, pr.procedure_report_id DESC, pd.lname, pd.fname, po.procedure_order_id
LIMIT 100;
`);

    const countRow = counts[0] ?? { totalReports: "0", reviewedReports: "0", unreviewedReports: "0" };
    return {
      statusFilter,
      patientFilter: patientFilter ?? "",
      providerFilter,
      labFilter,
      fromDate: fromDate ?? "",
      toDate: toDate ?? "",
      totalReports: Number(countRow.totalReports),
      reviewedReports: Number(countRow.reviewedReports),
      unreviewedReports: Number(countRow.unreviewedReports),
      reports: rows.map((row) => ({
        reportId: Number(row.reportId),
        orderId: Number(row.orderId),
        patientId: Number(row.patientId),
        pubpid: row.pubpid,
        patientDisplayName: row.patientDisplayName,
        orderDate: row.orderDate,
        providerId: Number(row.providerId),
        labId: Number(row.labId),
        labName: row.labName,
        procedureCode: row.procedureCode,
        procedureName: row.procedureName,
        reportDate: row.reportDate,
        reportStatus: row.reportStatus,
        reviewStatus: row.reviewStatus,
        reviewedBy: row.reviewedBy,
        reviewedAt: row.reviewedAt,
        specimenNumber: row.specimenNumber,
        notes: row.notes
      }))
    };
  }

  async getProcedureOrderQueue(
    status = "ready-to-send",
    filters: ProcedureReportReviewQueueFilters = {}
  ): Promise<ProcedureOrderQueueSummary> {
    const statusFilter = normalizeProcedureOrderQueueStatus(status);
    const patientFilter = filters.patientId?.trim();
    const providerFilter = filters.providerId === undefined || filters.providerId === null ? "" : String(filters.providerId).trim();
    const labFilter = filters.labId === undefined || filters.labId === null ? "" : String(filters.labId).trim();
    const fromDate = filters.fromDate?.trim();
    const toDate = filters.toDate?.trim();
    const patientFilterSql = patientFilter && /^\d+$/u.test(patientFilter)
      ? `po.patient_id = ${patientFilter}`
      : "0 = 1";
    const whereFilters = [
      patientFilter
        ? `AND (${patientFilterSql} OR pd.pubpid = '${escapeSql(patientFilter)}')`
        : "",
      providerFilter && /^\d+$/u.test(providerFilter) ? `AND po.provider_id = ${providerFilter}` : "",
      labFilter && /^\d+$/u.test(labFilter) ? `AND po.lab_id = ${labFilter}` : "",
      fromDate ? `AND DATE(po.date_ordered) >= '${escapeSql(fromDate)}'` : "",
      toDate ? `AND DATE(po.date_ordered) <= '${escapeSql(toDate)}'` : ""
    ].filter(Boolean).join("\n  ");
    const counts = await this.queryRows<Record<string, string>>(`
SELECT COUNT(*) AS totalOrders,
  COALESCE(SUM(CASE WHEN report_count = 0 AND date_transmitted IS NULL THEN 1 ELSE 0 END), 0) AS readyToSendOrders,
  COALESCE(SUM(CASE WHEN report_count = 0 AND date_transmitted IS NOT NULL THEN 1 ELSE 0 END), 0) AS transmittedPendingOrders,
  COALESCE(SUM(CASE WHEN report_count > 0 THEN 1 ELSE 0 END), 0) AS reportedOrders,
  COALESCE(SUM(CASE WHEN order_status = 'scheduled' THEN 1 ELSE 0 END), 0) AS scheduledOrders,
  COALESCE(SUM(CASE WHEN order_status = 'complete' THEN 1 ELSE 0 END), 0) AS completedOrders
FROM (
  SELECT po.procedure_order_id,
    po.date_transmitted,
    COALESCE(po.order_status, '') AS order_status,
    COUNT(DISTINCT pr.procedure_report_id) AS report_count
  FROM procedure_order po
  LEFT JOIN patient_data pd ON pd.pid = po.patient_id
  LEFT JOIN procedure_report pr ON pr.procedure_order_id = po.procedure_order_id
  WHERE 1 = 1
    ${whereFilters}
  GROUP BY po.procedure_order_id, po.date_transmitted, po.order_status
) q;
`);
    const whereStatus = statusFilter === "ready-to-send"
      ? "AND q.reportCount = 0 AND q.dateTransmitted = ''"
      : statusFilter === "transmitted-pending"
        ? "AND q.reportCount = 0 AND q.dateTransmitted != ''"
        : statusFilter === "reported"
          ? "AND q.reportCount > 0"
          : statusFilter === "scheduled"
            ? "AND q.orderStatus = 'scheduled'"
            : statusFilter === "completed"
              ? "AND q.orderStatus = 'complete'"
              : "";
    const rows = await this.queryRows<Record<string, string>>(`
SELECT *
FROM (
  SELECT po.procedure_order_id AS orderId,
    po.patient_id AS patientId,
    pd.pubpid,
    TRIM(CONCAT(pd.lname, ', ', pd.fname)) AS patientDisplayName,
    COALESCE(po.encounter_id, 0) AS encounterId,
    DATE(po.date_ordered) AS orderDate,
    COALESCE(po.provider_id, 0) AS providerId,
    COALESCE(po.lab_id, 0) AS labId,
    COALESCE(pp.name, '') AS labName,
    COALESCE(pc.procedure_code, '') AS procedureCode,
    COALESCE(pc.procedure_name, '') AS procedureName,
    COALESCE(pc.procedure_type, '') AS procedureType,
    COALESCE(po.order_priority, '') AS orderPriority,
    COALESCE(po.order_status, '') AS orderStatus,
    COALESCE(DATE_FORMAT(po.date_transmitted, '%Y-%m-%d %H:%i'), '') AS dateTransmitted,
    COUNT(DISTINCT pr.procedure_report_id) AS reportCount,
    COUNT(DISTINCT pres.procedure_result_id) AS resultCount,
    COUNT(DISTINCT ps.procedure_specimen_id) AS specimenCount,
    COALESCE(MAX(pc.do_not_send), 0) AS doNotSend,
    COALESCE(po.patient_instructions, '') AS instructions
  FROM procedure_order po
  LEFT JOIN patient_data pd ON pd.pid = po.patient_id
  LEFT JOIN procedure_order_code pc ON pc.procedure_order_id = po.procedure_order_id
    AND pc.procedure_order_seq = 1
  LEFT JOIN procedure_providers pp ON pp.ppid = po.lab_id
  LEFT JOIN procedure_report pr ON pr.procedure_order_id = po.procedure_order_id
  LEFT JOIN procedure_result pres ON pres.procedure_report_id = pr.procedure_report_id
  LEFT JOIN procedure_specimen ps ON ps.procedure_order_id = po.procedure_order_id AND COALESCE(ps.deleted, 0) = 0
  WHERE 1 = 1
    ${whereFilters}
  GROUP BY po.procedure_order_id, po.patient_id, pd.pubpid, pd.lname, pd.fname, po.encounter_id, po.date_ordered,
    po.provider_id, po.lab_id, pp.name, pc.procedure_code, pc.procedure_name, pc.procedure_type, po.order_priority,
    po.order_status, po.date_transmitted, po.patient_instructions
) q
WHERE 1 = 1
  ${whereStatus}
ORDER BY q.orderDate DESC, q.orderId DESC, q.patientDisplayName, q.patientId
LIMIT 100;
`);

    const countRow = counts[0] ?? {
      totalOrders: "0",
      readyToSendOrders: "0",
      transmittedPendingOrders: "0",
      reportedOrders: "0",
      scheduledOrders: "0",
      completedOrders: "0"
    };
    return {
      statusFilter,
      patientFilter: patientFilter ?? "",
      providerFilter,
      labFilter,
      fromDate: fromDate ?? "",
      toDate: toDate ?? "",
      totalOrders: Number(countRow.totalOrders),
      readyToSendOrders: Number(countRow.readyToSendOrders),
      transmittedPendingOrders: Number(countRow.transmittedPendingOrders),
      reportedOrders: Number(countRow.reportedOrders),
      scheduledOrders: Number(countRow.scheduledOrders),
      completedOrders: Number(countRow.completedOrders),
      orders: rows.map((row) => {
        const reportCount = Number(row.reportCount);
        const dateTransmitted = row.dateTransmitted;
        const queueState = reportCount > 0 ? "reported" : dateTransmitted ? "transmitted-pending" : "ready-to-send";
        return {
          orderId: Number(row.orderId),
          patientId: Number(row.patientId),
          pubpid: row.pubpid,
          patientDisplayName: row.patientDisplayName,
          encounterId: Number(row.encounterId),
          orderDate: row.orderDate,
          providerId: Number(row.providerId),
          labId: Number(row.labId),
          labName: row.labName,
          procedureCode: row.procedureCode,
          procedureName: row.procedureName,
          procedureType: row.procedureType,
          orderPriority: row.orderPriority,
          orderStatus: row.orderStatus,
          dateTransmitted,
          reportCount,
          resultCount: Number(row.resultCount),
          specimenCount: Number(row.specimenCount),
          canTransmit: reportCount === 0 && !dateTransmitted && row.doNotSend !== "1",
          queueState,
          instructions: row.instructions
        };
      })
    };
  }

  async getProcedureLabProviders(includeInactive = false): Promise<ProcedureLabProviderDirectorySummary> {
    const visibilityFilter = includeInactive ? "" : "AND pp.active = 1";
    const counts = await this.queryRows<Record<string, string>>(`
SELECT COUNT(*) AS totalProviders,
  COALESCE(SUM(CASE WHEN pp.active = 1 THEN 1 ELSE 0 END), 0) AS activeProviders,
  COALESCE(SUM(CASE WHEN pp.active <> 1 THEN 1 ELSE 0 END), 0) AS inactiveProviders
FROM procedure_providers pp
WHERE pp.ppid BETWEEN 501 AND 505;
`);
    const rows = await this.queryRows<Record<string, string>>(`
SELECT pp.ppid AS id,
  pp.name,
  COALESCE(pp.npi, '') AS npi,
  COALESCE(pp.protocol, '') AS protocol,
  pp.active,
  COUNT(DISTINCT po.procedure_order_id) AS orderCount,
  COUNT(DISTINCT pr.procedure_report_id) AS reportCount,
  COUNT(DISTINCT CASE WHEN DATE(po.date_ordered) > '2026-06-18' THEN po.procedure_order_id END) AS futureOrderCount
FROM procedure_providers pp
LEFT JOIN procedure_order po ON po.lab_id = pp.ppid
LEFT JOIN procedure_report pr ON pr.procedure_order_id = po.procedure_order_id
WHERE pp.ppid BETWEEN 501 AND 505
  ${visibilityFilter}
GROUP BY pp.ppid, pp.name, pp.npi, pp.protocol, pp.active
ORDER BY pp.name, pp.ppid;
`);

    const countRow = counts[0] ?? { totalProviders: "0", activeProviders: "0", inactiveProviders: "0" };
    return {
      includeInactive,
      totalProviders: Number(countRow.totalProviders),
      activeProviders: Number(countRow.activeProviders),
      inactiveProviders: Number(countRow.inactiveProviders),
      providers: rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        npi: row.npi,
        protocol: row.protocol,
        active: row.active === "1",
        orderCount: Number(row.orderCount),
        reportCount: Number(row.reportCount),
        futureOrderCount: Number(row.futureOrderCount)
      }))
    };
  }

  async getProcedureOrderCatalog(): Promise<ProcedureOrderCatalogSummary> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT pt.procedure_type_id AS id,
  CASE WHEN pt.parent = 0 THEN NULL ELSE pt.parent END AS parentId,
  CASE WHEN pt.lab_id = 0 THEN NULL ELSE pt.lab_id END AS labId,
  pp.name AS labName,
  pt.name,
  COALESCE(pt.procedure_code, '') AS code,
  COALESCE(pt.procedure_type, '') AS itemType,
  COALESCE(pt.procedure_type_name, '') AS procedureTypeName,
  COALESCE(pt.description, '') AS description,
  COALESCE(pt.specimen, '') AS specimen,
  COALESCE(pt.standard_code, '') AS standardCode,
  pt.seq AS sequence,
  pt.activity AS active,
  (
    SELECT COUNT(*)
    FROM procedure_type child
    WHERE child.parent = pt.procedure_type_id
  ) AS childCount
FROM procedure_type pt
LEFT JOIN procedure_providers pp ON pp.ppid = pt.lab_id
WHERE pt.procedure_type_id BETWEEN 9000 AND 9999
ORDER BY
  CASE
    WHEN pt.parent = 0 THEN 0
    WHEN pt.procedure_type = 'grp' THEN 1
    ELSE 2
  END,
  pt.parent,
  pt.seq,
  pt.name,
  pt.procedure_type_id;
`);

    const items = rows.map((row) => ({
      id: Number(row.id),
      parentId: nullIfDbNull(row.parentId) === null ? null : Number(row.parentId),
      labId: nullIfDbNull(row.labId) === null ? null : Number(row.labId),
      labName: nullIfDbNull(row.labName),
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
    }));

    return {
      totalItems: items.length,
      groupCount: items.filter((item) => item.itemType === "grp").length,
      orderCount: items.filter((item) => item.itemType === "ord").length,
      labProviderCount: new Set(items.filter((item) => item.itemType === "ord" && item.labId !== null).map((item) => item.labId)).size,
      items
    };
  }
}

export function buildOperationalReportExportRows(reports: OperationalReportsSummary): OperationalReportExportRow[] {
  const rows: OperationalReportExportRow[] = [];
  const add = (section: string, name: string, metric: string, value: string | number) => {
    rows.push({ section, name, metric, value: String(value) });
  };
  const addMoney = (section: string, name: string, metric: string, value: number) => {
    rows.push({ section, name, metric, value: value.toFixed(2) });
  };

  add("Counts", "Patients", "Total", reports.counts.patients);
  add("Counts", "Portal Patients", "Total", reports.counts.portalPatients);
  add("Counts", "Appointments", "Total", reports.counts.appointments);
  add("Counts", "Future Appointments", "Total", reports.counts.futureAppointments);
  add("Counts", "Current Year Appointments", "Total", reports.counts.currentYearAppointments);
  add("Counts", "Encounters", "Total", reports.counts.encounters);
  add("Counts", "Current Year Encounters", "Total", reports.counts.currentYearEncounters);
  add("Counts", "Billing Lines", "Total", reports.counts.billingLines);
  addMoney("Counts", "Billing Total", "USD", reports.counts.billingTotal);
  add("Counts", "Lab Reports", "Total", reports.counts.labReports);
  add("Counts", "Patient Documents", "Total", reports.counts.patientDocuments);
  add("Counts", "Messages", "Total", reports.counts.messages);
  add("Counts", "New Messages", "Total", reports.counts.newMessages);
  add("Counts", "Done Messages", "Total", reports.counts.doneMessages);
  add("Counts", "Facilities", "Total", reports.counts.facilities);
  add("Counts", "Providers", "Total", reports.counts.providers);

  for (const provider of reports.providerActivity) {
    add("Provider Activity", provider.username, "Display Name", provider.displayName);
    add("Provider Activity", provider.username, "Encounters", provider.encounters);
    add("Provider Activity", provider.username, "Billing Lines", provider.billingLines);
    addMoney("Provider Activity", provider.username, "Billing Total", provider.billingTotal);
  }

  for (const facility of reports.facilityActivity) {
    add("Facility Activity", facility.code, "Name", facility.name);
    add("Facility Activity", facility.code, "Appointments", facility.appointments);
    add("Facility Activity", facility.code, "Encounters", facility.encounters);
    add("Facility Activity", facility.code, "Billing Lines", facility.billingLines);
    addMoney("Facility Activity", facility.code, "Billing Total", facility.billingTotal);
  }

  for (const condition of reports.clinicalConditions) {
    const name = condition.diagnosis.trim() || condition.title;
    add("Clinical Conditions", name, "Title", condition.title);
    add("Clinical Conditions", name, "Patients", condition.patients);
  }

  return rows;
}

export function buildAccountLedgerEntries(rows: Record<string, string>[]): AccountLedgerEntry[] {
  let runningBalance = 0;
  return rows.map((row) => {
    const amount = Number(row.amount);
    runningBalance += amount;
    return {
      patientId: Number(row.patientId),
      entryDate: row.entryDate,
      encounter: Number(row.encounter),
      entryType: row.entryType,
      description: row.description,
      code: row.code,
      reference: row.reference,
      amount: amount.toFixed(2),
      runningBalanceAmount: runningBalance.toFixed(2)
    };
  });
}

export function buildPatientStatementSummary({
  patient,
  balances,
  aging,
  ledger
}: {
  patient: Record<string, string>;
  balances: AccountBalanceSummary[];
  aging: AccountAgingSummary[];
  ledger: AccountLedgerEntry[];
}): PatientStatementSummary {
  const periodStart = ledger[0]?.entryDate ?? "2026-06-18";
  const periodEnd = ledger.at(-1)?.entryDate ?? "2026-06-18";
  const pastDueAmount = aging
    .filter((row) => row.agingBucket !== "Current")
    .reduce((sum, row) => sum + Number(row.balanceAmount), 0);
  const currentDueAmount = aging
    .filter((row) => row.agingBucket === "Current")
    .reduce((sum, row) => sum + Number(row.balanceAmount), 0);
  const balanceDueAmount = ledger.length > 0
    ? Number(ledger.at(-1)!.runningBalanceAmount)
    : balances.reduce((sum, row) => sum + Number(row.balanceAmount), 0);
  const oldestOpen = aging
    .filter((row) => Number(row.balanceAmount) > 0)
    .sort((left, right) => right.ageDays - left.ageDays)[0];

  return {
    patientId: Number(patient.patientId),
    recipientName: `${patient.firstName} ${patient.lastName}`,
    mailingAddressLine1: patient.street ?? "",
    mailingAddressLine2: buildAddressLine2(patient),
    email: patient.email ?? "",
    phone: patient.phone ?? "",
    statementStatus: balanceDueAmount <= 0 ? "No balance due" : pastDueAmount > 0 ? "Past due review" : "Ready for statement",
    statementPeriodStart: periodStart,
    statementPeriodEnd: periodEnd,
    statementDate: periodEnd,
    dueDate: addDaysIso(periodEnd, 30),
    openEncounterCount: balances.filter((row) => Number(row.balanceAmount) > 0).length,
    ledgerEntryCount: ledger.length,
    oldestOpenAgeDays: oldestOpen?.ageDays ?? 0,
    oldestOpenDate: oldestOpen?.lastBillingDate ?? periodStart,
    chargeAmount: formatAmount(ledger.filter((entry) => entry.entryType === "Charge").reduce((sum, entry) => sum + Number(entry.amount), 0)),
    paymentAmount: formatAmount(ledger.filter((entry) => entry.entryType === "Payment").reduce((sum, entry) => sum + Math.abs(Number(entry.amount)), 0)),
    adjustmentAmount: formatAmount(ledger.filter((entry) => entry.entryType === "Adjustment").reduce((sum, entry) => sum + Math.abs(Number(entry.amount)), 0)),
    currentDueAmount: formatAmount(currentDueAmount),
    pastDueAmount: formatAmount(pastDueAmount),
    balanceDueAmount: formatAmount(balanceDueAmount)
  };
}

function buildAddressLine2(patient: Record<string, string>) {
  const cityState = [patient.city, patient.state].filter(Boolean).join(", ");
  return [cityState, patient.postalCode].filter(Boolean).join(" ");
}

function addDaysIso(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatAmount(value: number) {
  return value.toFixed(2);
}

function collectionTier(oldestOpenAgeDays: number, over90Amount: number) {
  if (over90Amount > 0 || oldestOpenAgeDays >= 91) {
    return "High";
  }
  if (oldestOpenAgeDays >= 61) {
    return "Medium";
  }
  return "Early";
}

function collectionRecommendedAction(oldestOpenAgeDays: number, over90Amount: number) {
  if (over90Amount > 0 || oldestOpenAgeDays >= 181) {
    return "Final notice review";
  }
  if (oldestOpenAgeDays >= 91) {
    return "Phone outreach";
  }
  if (oldestOpenAgeDays >= 61) {
    return "Second reminder";
  }
  return "First reminder";
}

function collectionContactMethod(email: string, phone: string) {
  if (normalizeText(email)) {
    return "Email-ready";
  }
  return normalizeText(phone) ? "Phone" : "Print";
}

function normalizeDiagnosisCode(value: string | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }
  return normalized.replace(/^ICD(?:9|10):/i, "").trim();
}

function parseTabRows<T extends Record<string, string>>(stdout: string): T[] {
  const lines = stdout.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean);
  if (lines.length === 0) {
    return [];
  }
  const headers = lines[0].split("\t");
  return lines.slice(1).map((line) => {
    const values = line.split("\t");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])) as T;
  });
}

function nullIfDbNull(value: string | undefined) {
  if (!value || value === "NULL" || value === "\\N") {
    return null;
  }
  return value;
}

function claimStatusLabel(status: number, billProcess: number) {
  if (billProcess !== 0) {
    return "Queued for billing";
  }

  if (status === 1) return "Re-opened";
  if (status === 2 || status === 3) return "Marked as cleared";
  if (status === 4) return "Closed";
  if (status === 5) return "Canceled";
  if (status === 6) return "Forwarded";
  if (status === 7) return "Denied";
  return "Unsubmitted";
}

function normalizeProcedureReportReviewQueueStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "all" || normalized === "reviewed") {
    return normalized;
  }
  return "unreviewed";
}

function normalizeProcedureOrderQueueStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "all" || normalized === "reported" || normalized === "scheduled") {
    return normalized;
  }
  if (normalized === "complete" || normalized === "completed") {
    return "completed";
  }
  if (normalized === "transmitted" || normalized === "sent" || normalized === "sent-pending" || normalized === "transmitted-pending") {
    return "transmitted-pending";
  }
  return "ready-to-send";
}

export function escapeSql(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "''");
}
