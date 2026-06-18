import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const datasetId = "openemr-shared-synthetic-v1";
const datasetVersion = "v1";
const baseDate = "2026-06-18";
const patientCount = 1000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const datasetRoot = path.resolve(__dirname, "..");
const generatedRoot = path.join(datasetRoot, "generated");
const canonicalPath = path.join(generatedRoot, "canonical", "gold-dataset.json");
const summaryPath = path.join(generatedRoot, "summary.json");
const legacySqlPath = path.join(generatedRoot, "legacy-mariadb", "seed-gold.sql");

function mulberry32(seed) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(0x4f454d52);

function pick(items) {
  return items[Math.floor(random() * items.length)];
}

function pad(value, width) {
  return String(value).padStart(width, "0");
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function at(dateText, hour, minute = 0) {
  return `${dateText} ${pad(hour, 2)}:${pad(minute, 2)}:00`;
}

function timePlusMinutes(dateTimeText, minutesToAdd) {
  const date = new Date(`${dateTimeText.replace(" ", "T")}Z`);
  date.setUTCMinutes(date.getUTCMinutes() + minutesToAdd);
  return date.toISOString().slice(11, 19);
}

function uuidHex(key) {
  return crypto.createHash("md5").update(`${datasetId}:${datasetVersion}:${key}`).digest("hex");
}

function sqlUuid(key) {
  return `UNHEX('${uuidHex(key)}')`;
}

function sql(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  if (typeof value === "object" && value.raw) {
    return value.raw;
  }
  return `'${String(value).replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
}

function raw(value) {
  return { raw: value };
}

function insert(table, columns, rows, chunkSize = 300) {
  if (rows.length === 0) {
    return "";
  }
  const statements = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    statements.push(
      `INSERT INTO ${table} (${columns.map((column) => `\`${column}\``).join(", ")}) VALUES\n` +
        chunk.map((row) => `(${columns.map((column) => sql(row[column])).join(", ")})`).join(",\n") +
        ";"
    );
  }
  return statements.join("\n\n");
}

const firstNamesFemale = [
  "Avery", "Marisol", "Nora", "Elena", "Priya", "Camila", "Hazel", "Iris", "Sofia", "Lena",
  "Amara", "Maya", "Clara", "Grace", "Riley", "Zara", "Naomi", "Leah", "Eva", "Tessa"
];
const firstNamesMale = [
  "Theo", "Elias", "Jonah", "Mateo", "Caleb", "Owen", "Miles", "Noah", "Felix", "Isaac",
  "Arjun", "Leo", "Simon", "Wyatt", "Adrian", "Luca", "Nolan", "Rafael", "Hugo", "Ezra"
];
const lastNames = [
  "Stone", "Vega", "Bennett", "Kim", "Morgan", "Patel", "Rivera", "Carter", "Nguyen", "Brooks",
  "Garcia", "Hughes", "Reed", "Shah", "Collins", "Foster", "Diaz", "Miller", "Wright", "Okafor",
  "Sullivan", "Lopez", "Chen", "Roberts", "Young", "Bell", "Murphy", "Price", "Ward", "Cole"
];
const cities = [
  ["San Diego", "CA", "92101"],
  ["La Mesa", "CA", "91942"],
  ["Chula Vista", "CA", "91910"],
  ["El Cajon", "CA", "92020"],
  ["National City", "CA", "91950"],
  ["Carlsbad", "CA", "92008"],
  ["Oceanside", "CA", "92054"],
  ["Poway", "CA", "92064"]
];
const occupations = ["Teacher", "Accountant", "Software Analyst", "Retail Manager", "Nurse", "Driver", "Student", "Retired", "Engineer", "Food Service Manager"];
const insurers = ["Acme Health", "Blue Valley Health", "CommunityCare", "Evergreen PPO", "Northstar HMO", "Harbor Mutual"];
const plans = ["Standard Silver", "Family Choice", "Premier PPO", "Community HMO", "Medicare Advantage", "High Deductible"];
const problemCatalog = [
  ["I10", "Essential hypertension"],
  ["E11.9", "Type 2 diabetes mellitus without complications"],
  ["J45.909", "Asthma, uncomplicated"],
  ["E78.5", "Hyperlipidemia, unspecified"],
  ["M54.50", "Low back pain, unspecified"],
  ["F41.9", "Anxiety disorder, unspecified"],
  ["K21.9", "Gastro-esophageal reflux disease"],
  ["G43.909", "Migraine, unspecified"]
];
const allergyCatalog = [
  ["Penicillin", "rash", "moderate"],
  ["Sulfa antibiotics", "hives", "moderate"],
  ["Peanuts", "swelling", "high"],
  ["Latex", "skin irritation", "low"],
  ["Codeine", "nausea", "low"],
  ["Shellfish", "shortness of breath", "high"]
];
const medicationCatalog = [
  ["Lisinopril", "10 mg", "Oral", "I10"],
  ["Metformin", "500 mg", "Oral", "E11.9"],
  ["Atorvastatin", "20 mg", "Oral", "E78.5"],
  ["Albuterol inhaler", "90 mcg", "Inhalation", "J45.909"],
  ["Omeprazole", "20 mg", "Oral", "K21.9"],
  ["Sumatriptan", "50 mg", "Oral", "G43.909"],
  ["Sertraline", "50 mg", "Oral", "F41.9"],
  ["Ibuprofen", "400 mg", "Oral", "M54.50"]
];
const labPanels = [
  ["83036", "Hemoglobin A1c", [["4548-4", "Hemoglobin A1c", "%", "5.7", "4.0-5.6"], ["2345-7", "Glucose", "mg/dL", "102", "70-99"], ["2093-3", "Cholesterol", "mg/dL", "188", "<200"], ["2085-9", "HDL Cholesterol", "mg/dL", "52", ">40"]]],
  ["80053", "Comprehensive metabolic panel", [["2951-2", "Sodium", "mmol/L", "140", "135-145"], ["2823-3", "Potassium", "mmol/L", "4.2", "3.5-5.1"], ["2160-0", "Creatinine", "mg/dL", "0.9", "0.6-1.3"], ["3094-0", "Urea nitrogen", "mg/dL", "14", "7-20"]]],
  ["85025", "Complete blood count", [["789-8", "Erythrocytes", "10*6/uL", "4.6", "4.1-5.9"], ["718-7", "Hemoglobin", "g/dL", "13.8", "12.0-17.5"], ["777-3", "Platelets", "10*3/uL", "245", "150-400"], ["6690-2", "Leukocytes", "10*3/uL", "6.8", "4.0-11.0"]]]
];

const curatedPatients = [
  ["Avery", "Stone", "patient-search", "Stable search and demographics navigation"],
  ["Marisol", "Vega", "chronic-care", "Diabetes and hypertension recurring care"],
  ["Theo", "Bennett", "scheduling", "Future, cancelled, and no-show appointments"],
  ["Nora", "Kim", "portal-messaging", "Portal-enabled patient with messages"],
  ["Elias", "Morgan", "billing", "Insurance and billing workflow"],
  ["Priya", "Patel", "allergies", "Multiple allergy checks"],
  ["Mateo", "Rivera", "pediatrics", "Pediatric preventive visit"],
  ["Hazel", "Carter", "medications", "Active medication reconciliation"],
  ["Jonah", "Nguyen", "labs", "Completed lab results review"],
  ["Camila", "Brooks", "encounters", "Multiple encounter history"]
];

const facilities = [
  { id: 10, code: "MAIN", name: "Modernization Family Medicine", phone: "(619) 555-0100", street: "100 Harbor Way", city: "San Diego", state: "CA", postalCode: "92101", color: "#246b73" },
  { id: 11, code: "NORTH", name: "North County Clinic", phone: "(760) 555-0110", street: "220 Coast Road", city: "Oceanside", state: "CA", postalCode: "92054", color: "#168963" },
  { id: 12, code: "EAST", name: "East County Care Center", phone: "(619) 555-0120", street: "330 Valley Parkway", city: "El Cajon", state: "CA", postalCode: "92020", color: "#7a5c12" }
];

const staff = Array.from({ length: 20 }, (_, index) => {
  const id = 101 + index;
  const provider = index < 12;
  const nurse = index >= 12 && index < 16;
  const billing = index >= 18;
  const username = provider
    ? `gold-provider-${pad(index + 1, 2)}`
    : nurse
      ? `gold-nurse-${pad(index - 11, 2)}`
      : billing
        ? `gold-billing-${pad(index - 17, 2)}`
        : `gold-frontdesk-${pad(index - 15, 2)}`;
  return {
    id,
    username,
    fname: provider ? pick(["Morgan", "Alex", "Jordan", "Taylor", "Casey", "Robin"]) : pick(["Jamie", "Rene", "Parker", "Drew"]),
    lname: provider ? pick(["Adams", "Singh", "Lopez", "Chen", "Walker", "Morris"]) : pick(["Hayes", "Grant", "Ellis", "Fleming"]),
    role: provider ? "provider" : nurse ? "nurse" : billing ? "billing" : "frontdesk",
    calendar: provider ? 1 : 0,
    facilityId: facilities[index % facilities.length].id
  };
});

function cohortForIndex(index) {
  if (index <= 50) return "golden-persona";
  if (index <= 450) return "routine-primary-care";
  if (index <= 700) return "chronic-care";
  if (index <= 800) return "pediatric";
  if (index <= 900) return "scheduling-heavy";
  if (index <= 975) return "billing-insurance";
  return "demographic-edge-case";
}

function birthDateFor(index, cohort) {
  const age = cohort === "pediatric" ? 3 + (index % 15) : cohort === "chronic-care" ? 45 + (index % 35) : 20 + (index % 60);
  const year = 2026 - age;
  const month = 1 + (index % 12);
  const day = 1 + (index % 27);
  return `${year}-${pad(month, 2)}-${pad(day, 2)}`;
}

const patients = [];
for (let i = 1; i <= patientCount; i += 1) {
  const canonicalId = `MOD-PAT-${pad(i, 4)}`;
  const curated = curatedPatients[i - 1];
  const sex = i % 2 === 0 ? "Male" : "Female";
  const fname = curated ? curated[0] : (sex === "Female" ? pick(firstNamesFemale) : pick(firstNamesMale));
  const lname = curated ? curated[1] : pick(lastNames);
  const cohort = curated ? curated[2] : cohortForIndex(i);
  const [city, state, postalCode] = cities[i % cities.length];
  const provider = staff[i % 12];
  const facility = facilities[i % facilities.length];
  const pid = 100000 + i;
  patients.push({
    canonicalId,
    pid,
    pubpid: canonicalId,
    fname,
    lname: cohort === "demographic-edge-case" && i % 5 === 0 ? `${lname}-${pick(["Smith", "Garcia", "Lee"])}` : lname,
    preferredName: i % 8 === 0 ? fname.slice(0, 3) : "",
    sex,
    dob: birthDateFor(i, cohort),
    cohort,
    purpose: curated ? curated[3] : "Synthetic population record",
    street: `${100 + i} Test Patient Avenue`,
    city,
    state,
    postalCode,
    email: `${canonicalId.toLowerCase()}@example.test`,
    phone: `(619) 555-${pad(1000 + (i % 9000), 4)}`,
    status: i % 4 === 0 ? "single" : i % 4 === 1 ? "married" : i % 4 === 2 ? "partnered" : "widowed",
    occupation: pick(occupations),
    providerId: provider.id,
    facilityId: facility.id,
    portalEnabled: i <= 200,
    registrationDate: addDays(baseDate, -900 + (i % 600))
  });
}

const insuranceRecords = [];
patients.forEach((patient, index) => {
  const primary = {
    id: `INS-${patient.canonicalId}-P`,
    patientId: patient.canonicalId,
    pid: patient.pid,
    type: "primary",
    provider: insurers[index % insurers.length],
    planName: plans[index % plans.length],
    policyNumber: `POL${patient.pid}`,
    groupNumber: `GRP${100 + (index % 30)}`,
    relationship: "self"
  };
  insuranceRecords.push(primary);
  if (index < 400) {
    insuranceRecords.push({
      ...primary,
      id: `INS-${patient.canonicalId}-S`,
      type: "secondary",
      provider: insurers[(index + 2) % insurers.length],
      planName: plans[(index + 3) % plans.length],
      policyNumber: `SEC${patient.pid}`,
      groupNumber: `GRP${200 + (index % 25)}`
    });
  }
});

const appointments = [];
patients.forEach((patient, index) => {
  const count = index < 800 ? 3 : 2;
  for (let sequence = 1; sequence <= count; sequence += 1) {
    const dateOffset = sequence === 1 ? -120 + (index % 90) : sequence === 2 ? -15 + (index % 30) : 7 + (index % 60);
    const date = index === 0 && sequence === 3 ? baseDate : addDays(baseDate, dateOffset);
    const hour = 8 + ((index + sequence) % 8);
    appointments.push({
      id: `APPT-${patient.canonicalId}-${sequence}`,
      patientId: patient.canonicalId,
      pid: patient.pid,
      providerId: patient.providerId,
      facilityId: patient.facilityId,
      date,
      start: at(date, hour, (sequence % 2) * 30),
      duration: sequence === 1 ? 1800 : 900,
      categoryId: sequence === 1 ? 10 : sequence === 3 ? 13 : 9,
      title: sequence === 1 ? "New Patient" : sequence === 3 ? "Preventive Care" : "Established Patient",
      status: sequence === 3 ? "-" : index % 17 === 0 ? "x" : index % 13 === 0 ? "?" : "@",
      room: `Room ${1 + (index % 8)}`
    });
  }
});

const encounters = [];
patients.forEach((patient, index) => {
  const count = index < 200 ? 3 : index < 900 ? 2 : 1;
  for (let sequence = 1; sequence <= count; sequence += 1) {
    const encounter = patient.pid * 10 + sequence;
    const date = sequence === 1 ? addDays(baseDate, -365 + (index % 180)) : sequence === 2 ? addDays(baseDate, -60 + (index % 45)) : addDays(baseDate, -10 + (index % 12));
    const problem = problemCatalog[(index + sequence) % problemCatalog.length];
    encounters.push({
      id: 1000000 + encounters.length + 1,
      encounter,
      patientId: patient.canonicalId,
      pid: patient.pid,
      providerId: patient.providerId,
      facilityId: patient.facilityId,
      date,
      datetime: at(date, 9 + ((index + sequence) % 7), sequence % 2 ? 15 : 45),
      reason: sequence === 1 ? "Comprehensive new patient evaluation" : `Follow-up for ${problem[1]}`,
      diagnosisCode: problem[0],
      diagnosisText: problem[1],
      categoryId: sequence === 1 ? 10 : 9
    });
  }
});

const vitals = [];
const clinicalNotes = [];
encounters.forEach((encounter, index) => {
  const patient = patients.find((candidate) => candidate.pid === encounter.pid);
  const height = patient.cohort === "pediatric" ? 38 + (index % 28) : 61 + (index % 14);
  const weight = patient.cohort === "pediatric" ? 32 + (index % 70) : 118 + (index % 125);
  const bmi = (weight / (height * height)) * 703;
  vitals.push({
    id: 2000000 + index + 1,
    patientId: patient.canonicalId,
    pid: encounter.pid,
    encounter: encounter.encounter,
    date: encounter.datetime,
    bps: 108 + (index % 35),
    bpd: 66 + (index % 22),
    weight,
    height,
    temperature: 97.6 + ((index % 10) / 10),
    pulse: 62 + (index % 32),
    respiration: 12 + (index % 8),
    bmi: Number(bmi.toFixed(1)),
    oxygenSaturation: 95 + (index % 5)
  });
  clinicalNotes.push({
    id: 3000000 + index + 1,
    patientId: patient.canonicalId,
    pid: encounter.pid,
    encounter: encounter.encounter,
    date: encounter.datetime,
    subjective: `${patient.fname} reports ${encounter.reason.toLowerCase()} and no acute distress.`,
    objective: `Vital signs reviewed. Blood pressure ${vitals[index].bps}/${vitals[index].bpd}.`,
    assessment: `${encounter.diagnosisText} monitored during visit.`,
    plan: "Continue care plan, review medications, and follow up as scheduled."
  });
});

const problems = [];
patients.forEach((patient, index) => {
  const count = index < 500 ? 2 : 1;
  for (let sequence = 1; sequence <= count; sequence += 1) {
    const [code, title] = problemCatalog[(index + sequence) % problemCatalog.length];
    problems.push({ id: `PROB-${patient.canonicalId}-${sequence}`, patientId: patient.canonicalId, pid: patient.pid, type: "medical_problem", title, diagnosis: `ICD10:${code}`, date: addDays(baseDate, -800 + ((index + sequence) % 500)), comments: `Synthetic active problem for ${patient.cohort}.` });
  }
});

const allergies = [];
patients.slice(0, 900).forEach((patient, index) => {
  const [title, reaction, severity] = allergyCatalog[index % allergyCatalog.length];
  allergies.push({ id: `ALG-${patient.canonicalId}-1`, patientId: patient.canonicalId, pid: patient.pid, type: "allergy", title, reaction, severity, date: addDays(baseDate, -700 + (index % 300)), comments: `Synthetic allergy: ${reaction}.` });
});

const medicationLists = [];
const prescriptions = [];
patients.forEach((patient, index) => {
  const count = index < 200 ? 3 : 2;
  for (let sequence = 1; sequence <= count; sequence += 1) {
    const [drug, dosage, route, diagnosis] = medicationCatalog[(index + sequence) % medicationCatalog.length];
    const startDate = addDays(baseDate, -400 + ((index + sequence) % 220));
    medicationLists.push({ id: `MED-${patient.canonicalId}-${sequence}`, patientId: patient.canonicalId, pid: patient.pid, type: "medication", title: `${drug} ${dosage}`, diagnosis: `ICD10:${diagnosis}`, date: startDate, comments: "Active synthetic medication list entry." });
    prescriptions.push({ id: `RX-${patient.canonicalId}-${sequence}`, patientId: patient.canonicalId, pid: patient.pid, providerId: patient.providerId, encounter: patient.pid * 10 + 1, startDate, drug, dosage, route, diagnosis: `ICD10:${diagnosis}` });
  }
});

const messages = [];
patients.forEach((patient, index) => {
  const count = index < 200 ? 2 : index < 1000 ? 1 : 0;
  for (let sequence = 1; sequence <= count; sequence += 1) {
    messages.push({
      id: `MSG-${patient.canonicalId}-${sequence}`,
      patientId: patient.canonicalId,
      pid: patient.pid,
      date: at(addDays(baseDate, -45 + ((index + sequence) % 40)), 10 + (sequence % 5)),
      title: sequence === 1 ? "Care team follow-up" : "Portal message",
      body: sequence === 1 ? `Follow-up message for ${patient.fname} ${patient.lname}.` : "Patient portal question about medications.",
      status: sequence === 1 ? "New" : "Done"
    });
  }
});

const billing = [];
encounters.forEach((encounter, index) => {
  billing.push({ id: `BILL-${encounter.encounter}-E`, pid: encounter.pid, providerId: encounter.providerId, encounter: encounter.encounter, date: encounter.datetime, codeType: "CPT4", code: encounter.categoryId === 10 ? "99204" : "99214", codeText: encounter.categoryId === 10 ? "New patient office visit" : "Established patient office visit", fee: encounter.categoryId === 10 ? 245.0 : 168.0, justify: encounter.diagnosisCode });
  if (index < 900) {
    billing.push({ id: `BILL-${encounter.encounter}-A`, pid: encounter.pid, providerId: encounter.providerId, encounter: encounter.encounter, date: encounter.datetime, codeType: "CPT4", code: "36415", codeText: "Routine venipuncture", fee: 18.0, justify: encounter.diagnosisCode });
  }
});

const labOrders = [];
const labReports = [];
const labResults = [];
patients.slice(0, 700).forEach((patient, index) => {
  const encounter = encounters.find((candidate) => candidate.pid === patient.pid);
  const panel = labPanels[index % labPanels.length];
  const orderId = 5000000 + index + 1;
  const reportId = 6000000 + index + 1;
  const orderedDate = addDays(baseDate, -120 + (index % 90));
  labOrders.push({ id: orderId, patientId: patient.canonicalId, pid: patient.pid, encounter: encounter.encounter, providerId: patient.providerId, date: at(orderedDate, 11), code: panel[0], name: panel[1], diagnosis: encounter.diagnosisCode });
  labReports.push({ id: reportId, orderId, date: at(addDays(orderedDate, 2), 14), status: "complete" });
  const resultCount = index < 300 ? 4 : 3;
  panel[2].slice(0, resultCount).forEach((result, resultIndex) => {
    labResults.push({ id: 7000000 + labResults.length + 1, reportId, code: result[0], text: result[1], units: result[2], result: result[3], range: result[4], abnormal: resultIndex === 0 && patient.cohort === "chronic-care" ? "high" : "no", date: at(addDays(orderedDate, 2), 14) });
  });
});

function listRows(items) {
  return items.map((item) => ({
    uuid: raw(sqlUuid(item.id)),
    date: `${item.date} 00:00:00`,
    type: item.type,
    title: item.title,
    begdate: `${item.date} 00:00:00`,
    diagnosis: item.diagnosis ?? "",
    activity: 1,
    comments: item.comments ?? "",
    pid: item.pid,
    user: "admin",
    groupname: "Default",
    reaction: item.reaction ?? "",
    severity_al: item.severity ?? "",
    list_option_id: item.type === "allergy" ? "allergy" : ""
  }));
}

const formsRows = [];
vitals.forEach((vital, index) => {
  const note = clinicalNotes[index];
  formsRows.push({ id: 4000000 + formsRows.length + 1, date: vital.date, encounter: vital.encounter, form_name: "Vitals", form_id: vital.id, pid: vital.pid, user: "admin", groupname: "Default", authorized: 1, deleted: 0, formdir: "vitals", provider_id: encounters[index].providerId });
  formsRows.push({ id: 4000000 + formsRows.length + 1, date: note.date, encounter: note.encounter, form_name: "SOAP", form_id: note.id, pid: note.pid, user: "admin", groupname: "Default", authorized: 1, deleted: 0, formdir: "soap", provider_id: encounters[index].providerId });
});

const dataset = {
  datasetId,
  version: datasetVersion,
  generatedAt: new Date().toISOString(),
  baseDate,
  patients,
  staff,
  facilities,
  insuranceRecords,
  appointments,
  encounters,
  vitals,
  clinicalNotes,
  problems,
  allergies,
  medicationLists,
  prescriptions,
  messages,
  billing,
  labOrders,
  labReports,
  labResults,
  testAnchors: patients.slice(0, 25).map((patient) => ({ canonicalId: patient.canonicalId, name: `${patient.fname} ${patient.lname}`, cohort: patient.cohort, purpose: patient.purpose }))
};

const summary = {
  datasetId,
  version: datasetVersion,
  baseDate,
  targetSystems: ["legacy-openemr", "modernized-openemr"],
  counts: {
    patients: patients.length,
    providersAndStaff: staff.length,
    facilities: facilities.length,
    insuranceRecords: insuranceRecords.length,
    appointments: appointments.length,
    encounters: encounters.length,
    vitals: vitals.length,
    clinicalNotes: clinicalNotes.length,
    problems: problems.length,
    allergies: allergies.length,
    medicationsAndPrescriptions: prescriptions.length,
    medicationListEntries: medicationLists.length,
    labOrders: labOrders.length,
    labReports: labReports.length,
    labResults: labResults.length,
    messages: messages.length,
    billingLineItems: billing.length,
    portalPatients: patients.filter((patient) => patient.portalEnabled).length
  },
  cohorts: patients.reduce((counts, patient) => ({ ...counts, [patient.cohort]: (counts[patient.cohort] ?? 0) + 1 }), {}),
  testAnchors: dataset.testAnchors
};

function buildLegacySql() {
  const statements = [
    "-- OpenEMR shared synthetic gold dataset v1",
    "-- Generated by modernization-workbench/seed-data/openemr-shared-synthetic-v1/scripts/generate-gold-dataset.mjs",
    "SET FOREIGN_KEY_CHECKS=0;",
    "DELETE FROM billing;",
    "DELETE FROM procedure_result;",
    "DELETE FROM procedure_report;",
    "DELETE FROM procedure_order_code;",
    "DELETE FROM procedure_order;",
    "DELETE FROM prescriptions;",
    "DELETE FROM pnotes;",
    "DELETE FROM forms;",
    "DELETE FROM form_soap;",
    "DELETE FROM form_vitals;",
    "DELETE FROM form_encounter;",
    "DELETE FROM openemr_postcalendar_events;",
    "DELETE FROM lists;",
    "DELETE FROM insurance_data;",
    "DELETE FROM patient_data;",
    "DELETE FROM users WHERE id BETWEEN 101 AND 120 OR username LIKE 'gold-%' OR username IN ('davis', 'hamming');",
    "DELETE FROM facility WHERE id IN (10, 11, 12);",
    "SET FOREIGN_KEY_CHECKS=1;"
  ];

  statements.push(insert("facility", ["id", "uuid", "name", "phone", "street", "city", "state", "postal_code", "country_code", "service_location", "billing_location", "accepts_assignment", "pos_code", "facility_npi", "color", "primary_business_entity", "facility_code"], facilities.map((facility) => ({
    id: facility.id,
    uuid: raw(sqlUuid(`facility-${facility.id}`)),
    name: facility.name,
    phone: facility.phone,
    street: facility.street,
    city: facility.city,
    state: facility.state,
    postal_code: facility.postalCode,
    country_code: "US",
    service_location: 1,
    billing_location: 1,
    accepts_assignment: 1,
    pos_code: 11,
    facility_npi: `199999${facility.id}`,
    color: facility.color,
    primary_business_entity: facility.id === 10 ? 1 : 0,
    facility_code: facility.code
  }))));

  statements.push(insert("users", ["id", "uuid", "username", "password", "authorized", "fname", "lname", "facility", "facility_id", "see_auth", "active", "npi", "title", "specialty", "email", "calendar", "taxonomy", "abook_type", "main_menu_role", "patient_menu_role", "billing_facility_id"], staff.map((user) => ({
    id: user.id,
    uuid: raw(sqlUuid(`user-${user.id}`)),
    username: user.username,
    password: "9d4e1e23bd5b727046a9e3b4b7db57bd8d6ee684",
    authorized: user.role === "provider" ? 1 : 0,
    fname: user.fname,
    lname: user.lname,
    facility: facilities.find((facility) => facility.id === user.facilityId).name,
    facility_id: user.facilityId,
    see_auth: 1,
    active: 1,
    npi: `18888${user.id}`,
    title: user.role === "provider" ? "Dr." : "",
    specialty: user.role === "provider" ? "Family Medicine" : user.role,
    email: `${user.username}@example.test`,
    calendar: user.calendar,
    taxonomy: "207Q00000X",
    abook_type: user.role,
    main_menu_role: "standard",
    patient_menu_role: "standard",
    billing_facility_id: user.facilityId
  }))));

  statements.push(insert("patient_data", ["uuid", "title", "language", "financial", "fname", "lname", "mname", "DOB", "street", "postal_code", "city", "state", "country_code", "ss", "occupation", "phone_home", "phone_biz", "phone_contact", "phone_cell", "status", "contact_relationship", "date", "sex", "referrer", "providerID", "email", "ethnoracial", "race", "ethnicity", "interpreter", "family_size", "monthly_income", "homeless", "financial_review", "pubpid", "pid", "hipaa_mail", "hipaa_voice", "hipaa_notice", "hipaa_message", "hipaa_allowsms", "hipaa_allowemail", "allow_patient_portal", "cmsportal_login", "created_by", "updated_by", "preferred_name"], patients.map((patient, index) => ({
    uuid: raw(sqlUuid(patient.canonicalId)),
    title: patient.sex === "Female" ? "Ms." : "Mr.",
    language: index % 9 === 0 ? "spanish" : "english",
    financial: "",
    fname: patient.fname,
    lname: patient.lname,
    mname: "",
    DOB: patient.dob,
    street: patient.street,
    postal_code: patient.postalCode,
    city: patient.city,
    state: patient.state,
    country_code: "US",
    ss: `${pad(100 + (index % 800), 3)}-${pad(10 + (index % 80), 2)}-${pad(1000 + index, 4)}`,
    occupation: patient.occupation,
    phone_home: patient.phone,
    phone_biz: "",
    phone_contact: patient.phone,
    phone_cell: patient.phone,
    status: patient.status,
    contact_relationship: index % 5 === 0 ? "Spouse" : "",
    date: `${patient.registrationDate} 09:00:00`,
    sex: patient.sex,
    referrer: "",
    providerID: patient.providerId,
    email: patient.email,
    ethnoracial: "",
    race: index % 6 === 0 ? "Asian" : index % 6 === 1 ? "White" : index % 6 === 2 ? "Black or African American" : "",
    ethnicity: index % 5 === 0 ? "Hispanic or Latino" : "Not Hispanic or Latino",
    interpreter: index % 9 === 0 ? "Spanish interpreter preferred" : "",
    family_size: 1 + (index % 5),
    monthly_income: 2200 + ((index % 70) * 100),
    homeless: "NO",
    financial_review: "2026-01-01 00:00:00",
    pubpid: patient.pubpid,
    pid: patient.pid,
    hipaa_mail: "YES",
    hipaa_voice: "YES",
    hipaa_notice: "YES",
    hipaa_message: "YES",
    hipaa_allowsms: "YES",
    hipaa_allowemail: "YES",
    allow_patient_portal: patient.portalEnabled ? "YES" : "",
    cmsportal_login: patient.portalEnabled ? patient.email : "",
    created_by: 1,
    updated_by: 1,
    preferred_name: patient.preferredName
  })), 150));

  statements.push(insert("insurance_data", ["uuid", "type", "provider", "plan_name", "policy_number", "group_number", "subscriber_lname", "subscriber_fname", "subscriber_relationship", "subscriber_DOB", "subscriber_street", "subscriber_postal_code", "subscriber_city", "subscriber_state", "subscriber_country", "subscriber_phone", "copay", "date", "pid", "subscriber_sex", "accept_assignment", "policy_type"], insuranceRecords.map((record) => {
    const patient = patients.find((candidate) => candidate.pid === record.pid);
    return {
      uuid: raw(sqlUuid(record.id)),
      type: record.type,
      provider: record.provider,
      plan_name: record.planName,
      policy_number: record.policyNumber,
      group_number: record.groupNumber,
      subscriber_lname: patient.lname,
      subscriber_fname: patient.fname,
      subscriber_relationship: record.relationship,
      subscriber_DOB: patient.dob,
      subscriber_street: patient.street,
      subscriber_postal_code: patient.postalCode,
      subscriber_city: patient.city,
      subscriber_state: patient.state,
      subscriber_country: "US",
      subscriber_phone: patient.phone,
      copay: record.type === "primary" ? "25" : "10",
      date: "2026-01-01",
      pid: record.pid,
      subscriber_sex: patient.sex,
      accept_assignment: "TRUE",
      policy_type: record.type === "primary" ? "individual" : "secondary"
    };
  }), 200));

  statements.push(insert("openemr_postcalendar_events", ["uuid", "pc_catid", "pc_multiple", "pc_aid", "pc_pid", "pc_title", "pc_time", "pc_hometext", "pc_eventDate", "pc_endDate", "pc_duration", "pc_startTime", "pc_endTime", "pc_eventstatus", "pc_sharing", "pc_apptstatus", "pc_facility", "pc_billing_location", "pc_room"], appointments.map((appointment) => ({
    uuid: raw(sqlUuid(appointment.id)),
    pc_catid: appointment.categoryId,
    pc_multiple: 0,
    pc_aid: String(appointment.providerId),
    pc_pid: String(appointment.pid),
    pc_title: appointment.title,
    pc_time: appointment.start,
    pc_hometext: `Gold dataset appointment ${appointment.id}`,
    pc_eventDate: appointment.date,
    pc_endDate: appointment.date,
    pc_duration: appointment.duration,
    pc_startTime: appointment.start.slice(11),
    pc_endTime: timePlusMinutes(appointment.start, appointment.duration / 60),
    pc_eventstatus: 1,
    pc_sharing: 1,
    pc_apptstatus: appointment.status,
    pc_facility: appointment.facilityId,
    pc_billing_location: appointment.facilityId,
    pc_room: appointment.room
  })), 200));

  statements.push(insert("form_encounter", ["id", "uuid", "date", "reason", "facility", "facility_id", "pid", "encounter", "pc_catid", "provider_id", "billing_facility", "class_code"], encounters.map((encounter) => ({
    id: encounter.id,
    uuid: raw(sqlUuid(`encounter-${encounter.encounter}`)),
    date: encounter.datetime,
    reason: encounter.reason,
    facility: facilities.find((facility) => facility.id === encounter.facilityId).name,
    facility_id: encounter.facilityId,
    pid: encounter.pid,
    encounter: encounter.encounter,
    pc_catid: encounter.categoryId,
    provider_id: encounter.providerId,
    billing_facility: encounter.facilityId,
    class_code: "AMB"
  })), 200));

  statements.push(insert("form_vitals", ["id", "uuid", "date", "pid", "user", "groupname", "authorized", "activity", "bps", "bpd", "weight", "height", "temperature", "pulse", "respiration", "note", "BMI", "oxygen_saturation"], vitals.map((vital) => ({
    id: vital.id,
    uuid: raw(sqlUuid(`vitals-${vital.id}`)),
    date: vital.date,
    pid: vital.pid,
    user: "admin",
    groupname: "Default",
    authorized: 1,
    activity: 1,
    bps: String(vital.bps),
    bpd: String(vital.bpd),
    weight: vital.weight,
    height: vital.height,
    temperature: vital.temperature,
    pulse: vital.pulse,
    respiration: vital.respiration,
    note: "Gold dataset vitals",
    BMI: vital.bmi,
    oxygen_saturation: vital.oxygenSaturation
  })), 200));

  statements.push(insert("form_soap", ["id", "date", "pid", "user", "groupname", "authorized", "activity", "subjective", "objective", "assessment", "plan"], clinicalNotes.map((note) => ({
    id: note.id,
    date: note.date,
    pid: note.pid,
    user: "admin",
    groupname: "Default",
    authorized: 1,
    activity: 1,
    subjective: note.subjective,
    objective: note.objective,
    assessment: note.assessment,
    plan: note.plan
  })), 200));

  statements.push(insert("forms", ["id", "date", "encounter", "form_name", "form_id", "pid", "user", "groupname", "authorized", "deleted", "formdir", "provider_id"], formsRows, 300));
  statements.push(insert("lists", ["uuid", "date", "type", "title", "begdate", "diagnosis", "activity", "comments", "pid", "user", "groupname", "reaction", "severity_al", "list_option_id"], listRows([...problems, ...allergies, ...medicationLists]), 200));

  statements.push(insert("prescriptions", ["uuid", "patient_id", "filled_by_id", "date_added", "date_modified", "provider_id", "encounter", "start_date", "drug", "rxnorm_drugcode", "dosage", "quantity", "route", "refills", "medication", "note", "active", "datetime", "user", "site", "txDate", "usage_category_title", "request_intent_title", "diagnosis", "created_by", "updated_by"], prescriptions.map((prescription) => ({
    uuid: raw(sqlUuid(prescription.id)),
    patient_id: prescription.pid,
    filled_by_id: prescription.providerId,
    date_added: `${prescription.startDate} 10:00:00`,
    date_modified: `${prescription.startDate} 10:00:00`,
    provider_id: prescription.providerId,
    encounter: prescription.encounter,
    start_date: prescription.startDate,
    drug: prescription.drug,
    rxnorm_drugcode: "",
    dosage: prescription.dosage,
    quantity: "30",
    route: prescription.route,
    refills: 2,
    medication: 1,
    note: "Gold dataset prescription",
    active: 1,
    datetime: `${prescription.startDate} 10:00:00`,
    user: "admin",
    site: "default",
    txDate: prescription.startDate,
    usage_category_title: "Community",
    request_intent_title: "Order",
    diagnosis: prescription.diagnosis,
    created_by: 1,
    updated_by: 1
  })), 200));

  statements.push(insert("pnotes", ["date", "body", "pid", "user", "groupname", "activity", "authorized", "title", "assigned_to", "message_status"], messages.map((message) => ({
    date: message.date,
    body: message.body,
    pid: message.pid,
    user: "admin",
    groupname: "Default",
    activity: 1,
    authorized: 1,
    title: message.title,
    assigned_to: "admin",
    message_status: message.status
  })), 200));

  statements.push(insert("billing", ["date", "code_type", "code", "pid", "provider_id", "user", "groupname", "authorized", "encounter", "code_text", "billed", "activity", "units", "fee", "justify"], billing.map((line) => ({
    date: line.date,
    code_type: line.codeType,
    code: line.code,
    pid: line.pid,
    provider_id: line.providerId,
    user: 1,
    groupname: "Default",
    authorized: 1,
    encounter: line.encounter,
    code_text: line.codeText,
    billed: 0,
    activity: 1,
    units: 1,
    fee: line.fee,
    justify: line.justify
  })), 200));

  statements.push(insert("procedure_order", ["procedure_order_id", "uuid", "provider_id", "patient_id", "encounter_id", "date_collected", "date_ordered", "order_priority", "order_status", "patient_instructions", "activity", "control_id", "specimen_type", "clinical_hx", "order_diagnosis", "procedure_order_type", "order_intent", "location_id"], labOrders.map((order) => ({
    procedure_order_id: order.id,
    uuid: raw(sqlUuid(`lab-order-${order.id}`)),
    provider_id: order.providerId,
    patient_id: order.pid,
    encounter_id: order.encounter,
    date_collected: order.date,
    date_ordered: order.date,
    order_priority: "routine",
    order_status: "complete",
    patient_instructions: "Gold dataset lab order",
    activity: 1,
    control_id: `CTRL-${order.id}`,
    specimen_type: "blood",
    clinical_hx: order.name,
    order_diagnosis: order.diagnosis,
    procedure_order_type: "laboratory_test",
    order_intent: "order",
    location_id: 10
  })), 200));

  statements.push(insert("procedure_order_code", ["procedure_order_id", "procedure_order_seq", "procedure_code", "procedure_name", "procedure_source", "diagnoses", "procedure_order_title", "procedure_type"], labOrders.map((order) => ({
    procedure_order_id: order.id,
    procedure_order_seq: 1,
    procedure_code: order.code,
    procedure_name: order.name,
    procedure_source: "1",
    diagnoses: `ICD10:${order.diagnosis}`,
    procedure_order_title: order.name,
    procedure_type: "laboratory"
  })), 200));

  statements.push(insert("procedure_report", ["procedure_report_id", "uuid", "procedure_order_id", "procedure_order_seq", "date_collected", "date_report", "source", "specimen_num", "report_status", "review_status", "report_notes"], labReports.map((report) => ({
    procedure_report_id: report.id,
    uuid: raw(sqlUuid(`lab-report-${report.id}`)),
    procedure_order_id: report.orderId,
    procedure_order_seq: 1,
    date_collected: report.date,
    date_report: report.date,
    source: 1,
    specimen_num: `SP-${report.id}`,
    report_status: report.status,
    review_status: "reviewed",
    report_notes: "Gold dataset result"
  })), 200));

  statements.push(insert("procedure_result", ["procedure_result_id", "uuid", "procedure_report_id", "result_data_type", "result_code", "result_text", "date", "facility", "units", "result", "range", "abnormal", "comments", "result_status"], labResults.map((result) => ({
    procedure_result_id: result.id,
    uuid: raw(sqlUuid(`lab-result-${result.id}`)),
    procedure_report_id: result.reportId,
    result_data_type: "N",
    result_code: result.code,
    result_text: result.text,
    date: result.date,
    facility: "Modernization Family Medicine",
    units: result.units,
    result: result.result,
    range: result.range,
    abnormal: result.abnormal,
    comments: "Synthetic lab result",
    result_status: "final"
  })), 200));

  return statements.filter(Boolean).join("\n\n") + "\n";
}

await fs.mkdir(path.dirname(canonicalPath), { recursive: true });
await fs.mkdir(path.dirname(summaryPath), { recursive: true });
await fs.mkdir(path.dirname(legacySqlPath), { recursive: true });

await fs.writeFile(canonicalPath, JSON.stringify(dataset, null, 2), "utf8");
await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");
await fs.writeFile(legacySqlPath, buildLegacySql(), "utf8");

console.log(JSON.stringify({ canonicalPath, summaryPath, legacySqlPath, counts: summary.counts }, null, 2));
