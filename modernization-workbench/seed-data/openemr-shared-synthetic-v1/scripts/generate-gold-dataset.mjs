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

function dateOnly(value) {
  return String(value).slice(0, 10);
}

function coverageFor(items, dateSelector) {
  const dates = items.map(dateSelector).filter(Boolean).map(dateOnly).sort();
  const currentYear = baseDate.slice(0, 4);
  const currentYearStart = `${currentYear}-01-01`;
  const currentYearEnd = `${currentYear}-12-31`;
  const currentYearDates = dates.filter((date) => date >= currentYearStart && date <= currentYearEnd);
  const futureCurrentYearDates = currentYearDates.filter((date) => date > baseDate);

  return {
    total: dates.length,
    currentYear: currentYearDates.length,
    futureCurrentYear: futureCurrentYearDates.length,
    minDate: dates.length ? dates[0] : null,
    maxDate: dates.length ? dates[dates.length - 1] : null
  };
}

function timePlusMinutes(dateTimeText, minutesToAdd) {
  const date = new Date(`${dateTimeText.replace(" ", "T")}Z`);
  date.setUTCMinutes(date.getUTCMinutes() + minutesToAdd);
  return date.toISOString().slice(11, 19);
}

function serializeAppointmentRecurrence(appointment) {
  const recurrenceType = appointment.recurrenceType ?? 0;
  const recurrenceExdates = recurrenceType > 0 ? (appointment.recurrenceExdates ?? []).join(",") : "";
  const fields = {
    event_repeat_freq: recurrenceType > 0 ? String(appointment.repeatFrequency ?? 1) : "",
    event_repeat_freq_type: recurrenceType > 0 ? String(appointment.repeatUnit ?? 1) : "",
    event_repeat_on_num: "1",
    event_repeat_on_day: "0",
    event_repeat_on_freq: "0",
    exdate: recurrenceExdates
  };
  const serialized = Object.entries(fields)
    .map(([key, value]) => `s:${key.length}:"${key}";s:${value.length}:"${value}";`)
    .join("");
  return `a:${Object.keys(fields).length}:{${serialized}}`;
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
const guardianFirstNames = ["Morgan", "Jamie", "Casey", "Riley", "Jordan", "Taylor", "Robin", "Avery"];
const guardianRelationships = ["parent", "spouse", "sibling", "child", "care_giver"];
const employerNames = ["Harbor Health Logistics", "Pacific Learning Group", "Civic Analytics", "Sunrise Market", "Coastal Transit", "Mesa Engineering", "Community Foodworks", "Northstar Finance"];
const insurers = ["Acme Health", "Blue Valley Health", "CommunityCare", "Evergreen PPO", "Northstar HMO", "Harbor Mutual"];
const insuranceCompanies = insurers.map((name, index) => ({ id: 9001 + index, name }));
const plans = ["Standard Silver", "Family Choice", "Premier PPO", "Community HMO", "Medicare Advantage", "High Deductible"];
const subscriberFirstNames = ["Avery", "Jordan", "Taylor", "Casey", "Jamie", "Riley", "Robin", "Quinn"];
const subscriberEmployerNames = ["Civic Analytics", "Northstar Finance", "Mesa Engineering", "Pacific Learning Group", "Harbor Health Logistics", "Coastal Transit"];
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
const immunizationCatalog = {
  influenza: { immunizationId: 30, cvxCode: "141", vaccine: "Influenza, seasonal, injectable", manufacturer: "Sanofi Pasteur", note: "Seasonal influenza vaccine" },
  pneumococcal: { immunizationId: 19, cvxCode: "133", vaccine: "Pneumococcal conjugate PCV 13", manufacturer: "Merck", note: "Pneumococcal conjugate vaccine" },
  td: { immunizationId: 32, cvxCode: "113", vaccine: "Td (adult), 5 Lf tetanus toxoid, preservative free, adsorbed", manufacturer: "MassBiologics", note: "Tetanus and diphtheria booster" },
  dtap: { immunizationId: 1, cvxCode: "20", vaccine: "DTaP", manufacturer: "GlaxoSmithKline", note: "Pediatric DTaP series" },
  ipv: { immunizationId: 11, cvxCode: "10", vaccine: "IPV", manufacturer: "Sanofi Pasteur", note: "Pediatric IPV series" },
  hib: { immunizationId: 15, cvxCode: "48", vaccine: "Hib (PRP-T)", manufacturer: "Merck", note: "Pediatric Hib series" },
  pcv: { immunizationId: 19, cvxCode: "133", vaccine: "Pneumococcal conjugate PCV 13", manufacturer: "Pfizer", note: "Pediatric pneumococcal conjugate series" },
  mmr: { immunizationId: 23, cvxCode: "03", vaccine: "MMR 1", manufacturer: "Merck", note: "Pediatric MMR series" },
  varicella: { immunizationId: 25, cvxCode: "21", vaccine: "varicella", manufacturer: "Merck", note: "Pediatric varicella series" },
  hepatitisA: { immunizationId: 33, cvxCode: "83", vaccine: "Hep A, ped/adol, 2 dose", manufacturer: "GlaxoSmithKline", note: "Pediatric hepatitis A series" },
  hepatitisB: { immunizationId: 27, cvxCode: "08", vaccine: "Hepatitis B 1", manufacturer: "Merck", note: "Pediatric hepatitis B series" }
};
const pediatricImmunizationSchedule = [
  ["hepatitisB", -720],
  ["dtap", -640],
  ["ipv", -570],
  ["hib", -500],
  ["pcv", -430],
  ["mmr", -320],
  ["varicella", -210],
  ["hepatitisA", -90]
];
const labPanels = [
  ["83036", "Hemoglobin A1c", [["4548-4", "Hemoglobin A1c", "%", "5.7", "4.0-5.6"], ["2345-7", "Glucose", "mg/dL", "102", "70-99"], ["2093-3", "Cholesterol", "mg/dL", "188", "<200"], ["2085-9", "HDL Cholesterol", "mg/dL", "52", ">40"]]],
  ["80053", "Comprehensive metabolic panel", [["2951-2", "Sodium", "mmol/L", "140", "135-145"], ["2823-3", "Potassium", "mmol/L", "4.2", "3.5-5.1"], ["2160-0", "Creatinine", "mg/dL", "0.9", "0.6-1.3"], ["3094-0", "Urea nitrogen", "mg/dL", "14", "7-20"]]],
  ["85025", "Complete blood count", [["789-8", "Erythrocytes", "10*6/uL", "4.6", "4.1-5.9"], ["718-7", "Hemoglobin", "g/dL", "13.8", "12.0-17.5"], ["777-3", "Platelets", "10*3/uL", "245", "150-400"], ["6690-2", "Leukocytes", "10*3/uL", "6.8", "4.0-11.0"]]]
];
const labProviders = [
  { id: 501, name: "Northstar Diagnostics", npi: "1720123401", active: true },
  { id: 502, name: "Harbor Reference Laboratory", npi: "1720123402", active: true },
  { id: 503, name: "Canyon Pathology Partners", npi: "1720123403", active: true },
  { id: 504, name: "Pacific Women's Health Laboratory", npi: "1720123404", active: true },
  { id: 505, name: "Metro Clinical Labs", npi: "1720123405", active: true }
];
const procedureOrderCatalogRoot = {
  id: 9000,
  parentId: 0,
  labId: 0,
  name: "Gold Lab Order Catalog",
  code: "",
  itemType: "grp",
  procedureTypeName: "",
  description: "Shared synthetic procedure order catalog root",
  specimen: "",
  standardCode: "",
  seq: 10,
  active: true
};
const procedureOrderCatalogProviderGroups = labProviders.map((provider, index) => ({
  id: 9010 + index * 10,
  parentId: procedureOrderCatalogRoot.id,
  labId: provider.id,
  name: provider.name,
  code: "",
  itemType: "grp",
  procedureTypeName: "",
  description: `Order catalog for ${provider.name}`,
  specimen: "",
  standardCode: "",
  seq: (index + 1) * 10,
  active: provider.active
}));
const procedureOrderCatalogOrders = procedureOrderCatalogProviderGroups.flatMap((group, providerIndex) =>
  labPanels.map(([code, name], panelIndex) => ({
    id: group.id + panelIndex + 1,
    parentId: group.id,
    labId: labProviders[providerIndex].id,
    name,
    code,
    itemType: "ord",
    procedureTypeName: "laboratory",
    description: `${name} orderable through ${labProviders[providerIndex].name}`,
    specimen: "blood",
    standardCode: `CPT4:${code}`,
    seq: (panelIndex + 1) * 10,
    active: true
  }))
);
const procedureOrderCatalog = [
  procedureOrderCatalogRoot,
  ...procedureOrderCatalogProviderGroups,
  ...procedureOrderCatalogOrders
];
const documentCategories = [
  { id: 3, name: "Medical Record", templateName: "Primary care intake packet", mimetype: "text/plain", pages: 4, documentationOf: "patient-record" },
  { id: 2, name: "Lab Report", templateName: "External lab summary", mimetype: "text/plain", pages: 3, documentationOf: "laboratory-result" },
  { id: 4, name: "Patient Information", templateName: "Registration packet", mimetype: "text/plain", pages: 2, documentationOf: "patient-information" },
  { id: 5, name: "Patient ID card", templateName: "Identity verification card", mimetype: "text/plain", pages: 1, documentationOf: "identity-document" },
  { id: 6, name: "Advance Directive", templateName: "Advance directive acknowledgement", mimetype: "text/plain", pages: 2, documentationOf: "advance-directive" },
  { id: 13, name: "CCDA", templateName: "Continuity of care document", mimetype: "application/xml", pages: 5, documentationOf: "ccda" },
  { id: 29, name: "Reviewed", templateName: "Reviewed outside record", mimetype: "text/plain", pages: 3, documentationOf: "reviewed-record" },
  { id: 31, name: "Invoices", templateName: "Patient statement archive", mimetype: "text/plain", pages: 2, documentationOf: "billing-document" }
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
  const patientLastName = cohort === "demographic-edge-case" && i % 5 === 0 ? `${lname}-${pick(["Smith", "Garcia", "Lee"])}` : lname;
  const guardianFirstName = guardianFirstNames[i % guardianFirstNames.length];
  const guardianName = `${guardianFirstName} ${patientLastName}`;
  const guardianRelationship = cohort === "pediatric" ? "parent" : guardianRelationships[i % guardianRelationships.length];
  const guardianSex = i % 3 === 0 ? "UNK" : i % 2 === 0 ? "Female" : "Male";
  const guardianAddress = `${200 + i} Guardian Lane`;
  const guardianCity = city;
  const guardianState = state;
  const guardianPostalCode = postalCode;
  const guardianCountry = "USA";
  const guardianWorkPhone = `(619) 555-${pad(4000 + (i % 6000), 4)}`;
  const race = i % 6 === 0 ? "Asian" : i % 6 === 1 ? "White" : i % 6 === 2 ? "Black or African American" : "";
  const ethnicity = i % 5 === 0 ? "Hispanic or Latino" : "Not Hispanic or Latino";
  const interpreter = i % 9 === 0 ? "Spanish interpreter preferred" : "";
  const familySize = 1 + (i % 5);
  const monthlyIncome = 2200 + ((i % 70) * 100);
  const homeless = i % 37 === 0 ? "YES" : "NO";
  const financialReviewDate = "2026-01-01";
  const employerName = employerNames[i % employerNames.length];
  const employerStreet = `${500 + i} Commerce Parkway`;
  patients.push({
    canonicalId,
    pid,
    pubpid: canonicalId,
    fname,
    lname: patientLastName,
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
    motherName: `${guardianFirstNames[(i + 3) % guardianFirstNames.length]} ${patientLastName}`,
    guardianName,
    guardianRelationship,
    guardianPhone: `(619) 555-${pad(3000 + (i % 7000), 4)}`,
    guardianEmail: `${guardianFirstName.toLowerCase()}.${patientLastName.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@example.test`,
    guardianSex,
    guardianAddress,
    guardianCity,
    guardianState,
    guardianPostalCode,
    guardianCountry,
    guardianWorkPhone,
    status: i % 4 === 0 ? "single" : i % 4 === 1 ? "married" : i % 4 === 2 ? "partnered" : "widowed",
    occupation: pick(occupations),
    race,
    ethnicity,
    interpreter,
    familySize,
    monthlyIncome,
    homeless,
    financialReviewDate,
    employerName,
    employerStreet,
    employerCity: city,
    employerState: state,
    employerPostalCode: postalCode,
    employerCountry: "USA",
    providerId: provider.id,
    facilityId: facility.id,
    portalEnabled: i <= 200,
    registrationDate: addDays(baseDate, -900 + (i % 600))
  });
}

const insuranceRecords = [];
function buildInsuranceSubscriber(patient, index, type) {
  if (type === "primary") {
    return {
      relationship: "self",
      subscriberFirstName: patient.fname,
      subscriberMiddleName: "",
      subscriberLastName: patient.lname,
      subscriberDateOfBirth: patient.dob,
      subscriberSex: patient.sex,
      subscriberStreet: patient.street,
      subscriberStreetLine2: "",
      subscriberCity: patient.city,
      subscriberState: patient.state,
      subscriberPostalCode: patient.postalCode,
      subscriberCountry: "US",
      subscriberPhone: patient.phone,
      subscriberEmployer: patient.employerName,
      subscriberEmployerStreet: patient.employerStreet,
      subscriberEmployerStreetLine2: "",
      subscriberEmployerCity: patient.employerCity,
      subscriberEmployerState: patient.employerState,
      subscriberEmployerPostalCode: patient.employerPostalCode,
      subscriberEmployerCountry: patient.employerCountry
    };
  }

  const [city, state, postalCode] = cities[(index + 3) % cities.length];
  const birthYear = 1972 + (index % 22);
  return {
    relationship: "spouse",
    subscriberFirstName: subscriberFirstNames[index % subscriberFirstNames.length],
    subscriberMiddleName: "",
    subscriberLastName: patient.lname,
    subscriberDateOfBirth: `${birthYear}-${pad((index % 12) + 1, 2)}-${pad((index % 27) + 1, 2)}`,
    subscriberSex: patient.sex === "Male" ? "Female" : "Male",
    subscriberStreet: `${2200 + index} Mesa Partner Ave`,
    subscriberStreetLine2: "",
    subscriberCity: city,
    subscriberState: state,
    subscriberPostalCode: postalCode,
    subscriberCountry: "US",
    subscriberPhone: `619-555-${pad(7000 + index, 4)}`,
    subscriberEmployer: subscriberEmployerNames[index % subscriberEmployerNames.length],
    subscriberEmployerStreet: `${4100 + index} Benefits Way`,
    subscriberEmployerStreetLine2: "",
    subscriberEmployerCity: city,
    subscriberEmployerState: state,
    subscriberEmployerPostalCode: postalCode,
    subscriberEmployerCountry: "US"
  };
}

patients.forEach((patient, index) => {
  const primarySubscriber = buildInsuranceSubscriber(patient, index, "primary");
  const primary = {
    id: `INS-${patient.canonicalId}-P`,
    patientId: patient.canonicalId,
    pid: patient.pid,
    type: "primary",
    provider: insurers[index % insurers.length],
    planName: plans[index % plans.length],
    policyNumber: `POL${patient.pid}`,
    groupNumber: `GRP${100 + (index % 30)}`,
    relationship: primarySubscriber.relationship,
    ...primarySubscriber
  };
  insuranceRecords.push(primary);
  if (index < 400) {
    const secondarySubscriber = buildInsuranceSubscriber(patient, index, "secondary");
    insuranceRecords.push({
      ...primary,
      id: `INS-${patient.canonicalId}-S`,
      type: "secondary",
      provider: insurers[(index + 2) % insurers.length],
      planName: plans[(index + 3) % plans.length],
      policyNumber: `SEC${patient.pid}`,
      groupNumber: `GRP${200 + (index % 25)}`,
      relationship: secondarySubscriber.relationship,
      ...secondarySubscriber
    });
  }
});

const patientHistories = patients.map((patient, index) => {
  const sequence = index + 1;
  const isMale = patient.sex === "Male";
  const chronic = patient.cohort === "chronic-care" || sequence % 4 === 0;
  const ldlValue = 90 + (sequence % 30);
  const hemoglobinValue = (12 + (sequence % 25) / 10).toFixed(1);
  const psaValue = isMale ? (1 + (sequence % 15) / 10).toFixed(1) : "";

  return {
    id: `HIST-${patient.canonicalId}`,
    patientId: patient.canonicalId,
    pid: patient.pid,
    coffee: `${1 + (sequence % 3)} cups/day`,
    tobacco: sequence % 5 === 0 ? "Former smoker - quit 2019" : sequence % 11 === 0 ? "Current light tobacco use" : "Never smoker",
    alcohol: sequence % 4 === 0 ? "1-2 drinks/week" : "No alcohol use",
    sleepPatterns: sequence % 3 === 0 ? "Sleeps 6 hours with intermittent insomnia" : "Sleeps 7-8 hours nightly",
    exercisePatterns: sequence % 2 === 0 ? "Walks 30 minutes 5 days/week" : "Light activity 2 days/week",
    seatbeltUse: "Always",
    counseling: sequence % 6 === 0 ? "Nutrition counseling reviewed" : "",
    hazardousActivities: sequence % 7 === 0 ? "Occasional ladder work with safety precautions" : "No hazardous activities reported",
    recreationalDrugs: "Denies recreational drug use",
    lastPhysicalExam: "2026-01-15",
    lastMammogram: !isMale ? "2026-02-12" : "",
    lastProstateExam: isMale ? "2026-02-09" : "",
    lastColonoscopy: sequence % 2 === 0 ? "2025-11-20" : "2024-10-18",
    lastEcg: sequence % 3 === 0 ? "2026-03-03" : "",
    lastRetinal: chronic ? "2026-01-30" : "",
    lastFluvax: "2025-10-01",
    lastPneuvax: chronic ? "2024-09-15" : "",
    lastLdl: `2026-01-11 LDL ${ldlValue}`,
    lastHemoglobin: `2026-01-11 Hgb ${hemoglobinValue}`,
    lastPsa: isMale ? `2026-02-11 PSA ${psaValue}` : "",
    lastExamResults: "Preventive screening reviewed in gold dataset",
    historyMother: "Mother: hypertension",
    historyFather: "Father: type 2 diabetes",
    historySiblings: sequence % 4 === 0 ? "Sibling: asthma" : "Siblings: no major chronic illness",
    historyOffspring: patient.cohort === "pediatric" ? "No children" : "Children: preventive counseling reviewed",
    historySpouse: patient.status === "married" ? "Spouse: wellness visit current" : "",
    relativesCancer: sequence % 8 === 0 ? "maternal aunt" : "",
    relativesTuberculosis: "",
    relativesDiabetes: "father",
    relativesHighBloodPressure: "mother",
    relativesHeartProblems: sequence % 6 === 0 ? "grandparent" : "",
    relativesStroke: sequence % 9 === 0 ? "grandparent" : "",
    relativesEpilepsy: "",
    relativesMentalIllness: sequence % 10 === 0 ? "sibling anxiety" : "",
    relativesSuicide: "",
    appendectomy: sequence % 5 === 0 ? "2016-04-20 00:00:00" : null,
    tonsillectomy: sequence % 7 === 0 ? "2012-05-11 00:00:00" : null,
    cholecystectomy: sequence % 13 === 0 ? "2019-08-14 00:00:00" : null,
    heartSurgery: chronic && sequence % 17 === 0 ? "2021-02-22 00:00:00" : null,
    hysterectomy: !isMale && sequence % 19 === 0 ? "2018-10-05 00:00:00" : null,
    herniaRepair: sequence % 11 === 0 ? "2015-07-09 00:00:00" : null,
    hipReplacement: patient.cohort === "senior" && sequence % 12 === 0 ? "2020-03-16 00:00:00" : null,
    kneeReplacement: patient.cohort === "senior" && sequence % 10 === 0 ? "2022-06-21 00:00:00" : null,
    recordedDate: `${patient.registrationDate} 10:00:00`,
    additionalHistory: `Gold history for ${patient.pubpid}: ${patient.purpose}`,
    exams: "Annual physical, medication reconciliation, and preventive screening reviewed.",
    createdBy: 1
  };
});

const appointments = [];
patients.forEach((patient, index) => {
  const count = index < 800 ? 3 : 2;
  for (let sequence = 1; sequence <= count; sequence += 1) {
    const dateOffset = sequence === 1 ? -120 + (index % 90) : sequence === 2 ? -15 + (index % 30) : 7 + ((index * 11) % 190);
    const date = index === 0 && sequence === 3 ? baseDate : addDays(baseDate, dateOffset);
    const hour = 8 + ((index + sequence) % 8);
    const isRecurringAnchor = sequence === 3 && index % 10 === 2;
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
      room: `Room ${1 + (index % 8)}`,
      comments: `Gold dataset appointment ${patient.canonicalId}-${sequence}: ${sequence === 1 ? "initial intake preparation" : sequence === 3 ? "preventive care checklist" : "follow-up scheduling note"}`,
      recurrenceType: isRecurringAnchor ? 1 : 0,
      repeatFrequency: isRecurringAnchor ? 2 : null,
      repeatUnit: isRecurringAnchor ? 1 : null,
      recurrenceEndDate: isRecurringAnchor ? addDays(date, 84) : null,
      ...(isRecurringAnchor && patient.canonicalId === "MOD-PAT-0013" ? { recurrenceExdates: [addDays(date, 42)] } : {})
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
    const startDate = addDays(baseDate, -168 + ((index * 13 + sequence * 29) % 365));
    medicationLists.push({ id: `MED-${patient.canonicalId}-${sequence}`, patientId: patient.canonicalId, pid: patient.pid, type: "medication", title: `${drug} ${dosage}`, diagnosis: `ICD10:${diagnosis}`, date: startDate, comments: "Active synthetic medication list entry." });
    prescriptions.push({ id: `RX-${patient.canonicalId}-${sequence}`, patientId: patient.canonicalId, pid: patient.pid, providerId: patient.providerId, encounter: patient.pid * 10 + 1, startDate, drug, dosage, route, diagnosis: `ICD10:${diagnosis}` });
  }
});

const immunizations = [];
function addImmunization(patient, index, sequence, catalogItem, dateOffset, route = "intramuscular", site = "left_deltoid") {
  const administeredDate = addDays(baseDate, dateOffset);
  const provider = staff.find((candidate) => candidate.id === patient.providerId) ?? staff[0];
  immunizations.push({
    id: 8500000 + immunizations.length + 1,
    key: `IMM-${patient.canonicalId}-${pad(sequence, 2)}`,
    patientId: patient.canonicalId,
    pid: patient.pid,
    encounter: patient.pid * 10 + 1,
    immunizationId: catalogItem.immunizationId,
    cvxCode: catalogItem.cvxCode,
    vaccine: catalogItem.vaccine,
    administeredDate: at(administeredDate, 9 + (index % 6), sequence % 2 ? 15 : 45),
    manufacturer: catalogItem.manufacturer,
    lotNumber: `LOT-${patient.pid}-${pad(sequence, 2)}`,
    administeredById: patient.providerId,
    administeredBy: `${provider.fname} ${provider.lname}`,
    educationDate: administeredDate,
    visDate: addDays(administeredDate, -3),
    amountAdministered: 0.5,
    amountAdministeredUnit: "mL",
    expirationDate: addDays(administeredDate, 365),
    route,
    administrationSite: site,
    completionStatus: "completed",
    informationSource: "new_immunization_record",
    note: `${catalogItem.note} for ${patient.cohort}.`
  });
}

patients.forEach((patient, index) => {
  let sequence = 1;
  addImmunization(patient, index, sequence, immunizationCatalog.influenza, -160 + (index % 120));

  if (patient.cohort === "chronic-care" || index % 5 === 0) {
    sequence += 1;
    addImmunization(patient, index, sequence, immunizationCatalog.pneumococcal, -360 + ((index * 7) % 220), "intramuscular", "right_deltoid");
  }

  if (patient.cohort === "chronic-care" || index % 4 === 0) {
    sequence += 1;
    addImmunization(patient, index, sequence, immunizationCatalog.td, -520 + ((index * 5) % 300));
  }

  if (patient.cohort.includes("pediatric")) {
    for (const [catalogKey, dateOffset] of pediatricImmunizationSchedule) {
      sequence += 1;
      addImmunization(patient, index, sequence, immunizationCatalog[catalogKey], dateOffset + (index % 21), "intramuscular", index % 2 === 0 ? "left_thigh" : "right_thigh");
    }
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
      status: sequence === 1 ? "New" : "Done",
      assignedTo: "admin",
      portalRelation: sequence === 1 ? null : `portal:${patient.canonicalId}`,
      isEncrypted: false
    });
  }
});

const billing = [];
encounters.forEach((encounter, index) => {
  const officeVisitModifier = encounter.categoryId === 10 ? "" : (index % 6 === 1 ? "25" : "");
  billing.push({ id: `BILL-${encounter.encounter}-E`, pid: encounter.pid, providerId: encounter.providerId, encounter: encounter.encounter, date: encounter.datetime, codeType: "CPT4", code: encounter.categoryId === 10 ? "99204" : "99214", modifier: officeVisitModifier, codeText: encounter.categoryId === 10 ? "New patient office visit" : "Established patient office visit", fee: encounter.categoryId === 10 ? 245.0 : 168.0, justify: encounter.diagnosisCode });
  if (index < 900) {
    billing.push({ id: `BILL-${encounter.encounter}-A`, pid: encounter.pid, providerId: encounter.providerId, encounter: encounter.encounter, date: encounter.datetime, codeType: "CPT4", code: "36415", modifier: "", codeText: "Routine venipuncture", fee: 18.0, justify: encounter.diagnosisCode });
  }
});

const claimStatuses = [
  { status: 1, billProcess: 1, label: "Queued for billing", target: "HCFA", processFile: "" },
  { status: 2, billProcess: 0, label: "Generated to file", target: "X12", processFile: "837P" },
  { status: 3, billProcess: 0, label: "Marked as cleared", target: "HCFA", processFile: "" },
  { status: 4, billProcess: 0, label: "Closed", target: "HCFA", processFile: "" },
  { status: 5, billProcess: 0, label: "Canceled", target: "HCFA", processFile: "" },
  { status: 6, billProcess: 0, label: "Forwarded", target: "X12", processFile: "" },
  { status: 7, billProcess: 0, label: "Denied", target: "X12", processFile: "99214_25_CO_45" }
];

const claims = encounters.slice(0, 700).map((encounter, index) => {
  const patient = patients.find((candidate) => candidate.pid === encounter.pid);
  const primaryInsurance = insuranceRecords.find((record) => record.pid === encounter.pid && record.type === "primary");
  const insuranceCompany = insuranceCompanies.find((company) => company.name === primaryInsurance?.provider) ?? insuranceCompanies[0];
  const anchorSequence = encounter.pid === 100005 ? Math.max(0, (encounter.encounter % 10) - 1) : null;
  const status = claimStatuses[anchorSequence ?? (index % claimStatuses.length)];
  const billTime = at(addDays(encounter.date, 2 + (index % 5)), 10 + (index % 5), (index % 2) * 30);
  const processTime = status.processFile && status.status !== 7 ? at(addDays(encounter.date, 3 + (index % 5)), 13 + (index % 4), 15) : null;
  const processFile = status.processFile === "837P" ? `CLAIM-${encounter.encounter}-837P.txt` : status.processFile;
  return {
    id: `CLAIM-${encounter.encounter}-1`,
    patientId: patient.canonicalId,
    pid: encounter.pid,
    encounter: encounter.encounter,
    version: 1,
    payerId: insuranceCompany.id,
    payerName: insuranceCompany.name,
    payerType: 1,
    status: status.status,
    statusLabel: status.label,
    billProcess: status.billProcess,
    billTime,
    processTime,
    processFile,
    target: status.target,
    x12PartnerId: status.target === "X12" ? 1 : 0,
    submittedClaim: index % 4 === 0 ? `Synthetic reviewed claim ${encounter.encounter}` : ""
  };
});

const billingLineByEncounter = new Map();
for (const line of billing) {
  if (line.codeType === "CPT4" && !billingLineByEncounter.has(line.encounter)) {
    billingLineByEncounter.set(line.encounter, line);
  }
}

const billingUser = staff.find((user) => user.username === "gold-billing-01") ?? staff[staff.length - 1];
const paymentEligibleClaims = claims.filter((claim) => claim.status !== 1 && claim.status !== 5).slice(0, 420);
const paymentSessions = [];
const paymentActivities = [];

paymentEligibleClaims.forEach((claim, index) => {
  const anchorPayment = claim.pid === 100005 && claim.encounter === 1000052;
  const claimLine = billingLineByEncounter.get(claim.encounter);
  const sessionId = 1200001 + index;
  const basePostDate = dateOnly(claim.processTime ?? claim.billTime ?? baseDate);
  const postDate = anchorPayment ? "2026-04-30" : addDays(basePostDate, 7 + (index % 9));
  const postTime = at(postDate, 9 + (index % 7), (index % 2) * 30);
  const paymentAmount = anchorPayment
    ? 126.0
    : claim.status === 7
      ? 0
      : Number((80 + (index % 9) * 7.25).toFixed(2));
  const adjustmentAmount = anchorPayment
    ? 42.0
    : claim.status === 7
      ? Number((35 + (index % 5) * 3.5).toFixed(2))
      : index % 3 === 0
        ? Number((18 + (index % 4) * 4.25).toFixed(2))
        : 0;
  const reference = anchorPayment ? "EOB-NSTAR-1000052" : `EOB-${claim.payerId}-${claim.encounter}`;
  const payerClaimNumber = anchorPayment ? "NSTAR-CLM-1000052" : `PCLM-${claim.encounter}`;

  paymentSessions.push({
    id: sessionId,
    patientId: claim.patientId,
    pid: claim.pid,
    payerId: claim.payerId,
    payerName: claim.payerName,
    userId: billingUser.id,
    userName: billingUser.username,
    closed: 1,
    reference,
    checkDate: postDate,
    depositDate: addDays(postDate, 1),
    payTotal: paymentAmount,
    createdTime: postTime,
    modifiedTime: postTime,
    globalAmount: 0,
    paymentType: "insurance_payment",
    description: anchorPayment ? "Northstar HMO EOB payment for generated claim" : `${claim.payerName} synthetic EOB posting`,
    adjustmentCode: adjustmentAmount > 0 ? "contractual_adjustment" : "",
    postToDate: postDate,
    paymentMethod: "check_payment"
  });

  paymentActivities.push({
    id: `PAYACT-${claim.encounter}-1`,
    sessionId,
    patientId: claim.patientId,
    pid: claim.pid,
    encounter: claim.encounter,
    sequenceNo: 1,
    codeType: claimLine?.codeType ?? "CPT4",
    code: claimLine?.code ?? "99214",
    modifier: claimLine?.modifier ?? "",
    payerType: claim.payerType,
    postTime,
    postUserId: billingUser.id,
    postUserName: billingUser.username,
    memo: anchorPayment ? "Northstar HMO insurance payment" : `${claim.payerName} insurance payment`,
    payAmount: paymentAmount,
    adjustmentAmount: 0,
    modifiedTime: postTime,
    followUp: "",
    followUpNote: "",
    accountCode: "INS",
    reasonCode: "",
    deleted: null,
    postDate,
    payerClaimNumber
  });

  if (adjustmentAmount > 0) {
    paymentActivities.push({
      id: `PAYACT-${claim.encounter}-2`,
      sessionId,
      patientId: claim.patientId,
      pid: claim.pid,
      encounter: claim.encounter,
      sequenceNo: 2,
      codeType: claimLine?.codeType ?? "CPT4",
      code: claimLine?.code ?? "99214",
      modifier: claimLine?.modifier ?? "",
      payerType: claim.payerType,
      postTime,
      postUserId: billingUser.id,
      postUserName: billingUser.username,
      memo: anchorPayment ? "Contractual adjustment" : claim.status === 7 ? "Denied claim adjustment" : "Contractual adjustment",
      payAmount: 0,
      adjustmentAmount,
      modifiedTime: postTime,
      followUp: claim.status === 7 ? "y" : "",
      followUpNote: claim.status === 7 ? "Review denied claim" : "",
      accountCode: claim.status === 7 ? "DENIAL" : "CO45",
      reasonCode: "CO-45",
      deleted: null,
      postDate,
      payerClaimNumber
    });
  }
});

const labOrders = [];
const labReports = [];
const labResults = [];
patients.slice(0, 700).forEach((patient, index) => {
  const encounter = encounters.find((candidate) => candidate.pid === patient.pid);
  const panel = labPanels[index % labPanels.length];
  const labProvider = labProviders[index % labProviders.length];
  const orderId = 5000000 + index + 1;
  const reportId = 6000000 + index + 1;
  const orderedDate = addDays(baseDate, -120 + (index % 90));
  labOrders.push({
    id: orderId,
    patientId: patient.canonicalId,
    pid: patient.pid,
    encounter: encounter.encounter,
    providerId: patient.providerId,
    labId: labProvider.id,
    labName: labProvider.name,
    date: at(orderedDate, 11),
    code: panel[0],
    name: panel[1],
    diagnosis: encounter.diagnosisCode,
    orderPriority: "routine",
    procedureType: "laboratory",
    instructions: "Gold dataset lab order",
    orderStatus: "complete"
  });
  labReports.push({
    id: reportId,
    orderId,
    date: at(addDays(orderedDate, 2), 14),
    status: "complete",
    reviewStatus: "reviewed",
    notes: "Gold dataset result"
  });
  const resultCount = index < 300 ? 4 : 3;
  panel[2].slice(0, resultCount).forEach((result, resultIndex) => {
    labResults.push({ id: 7000000 + labResults.length + 1, reportId, code: result[0], text: result[1], units: result[2], result: result[3], range: result[4], abnormal: resultIndex === 0 && patient.cohort === "chronic-care" ? "high" : "no", date: at(addDays(orderedDate, 2), 14), resultStatus: "final" });
  });
});

patients.slice(700, 1000).forEach((patient, futureIndex) => {
  const patientIndex = 700 + futureIndex;
  const encounter = encounters.find((candidate) => candidate.pid === patient.pid);
  const panel = labPanels[(patientIndex + 1) % labPanels.length];
  const labProvider = labProviders[(patientIndex + 1) % labProviders.length];
  const orderId = 5001000 + futureIndex + 1;
  const orderedDate = addDays(baseDate, 7 + ((futureIndex * 11) % 190));
  labOrders.push({
    id: orderId,
    patientId: patient.canonicalId,
    pid: patient.pid,
    encounter: encounter.encounter,
    providerId: patient.providerId,
    labId: labProvider.id,
    labName: labProvider.name,
    date: at(orderedDate, 11),
    code: panel[0],
    name: panel[1],
    diagnosis: encounter.diagnosisCode,
    orderPriority: "routine",
    procedureType: "laboratory",
    instructions: "Gold dataset future lab order",
    orderStatus: "scheduled"
  });
});

const encountersByPid = encounters.reduce((groups, encounter) => {
  const patientEncounters = groups.get(encounter.pid) ?? [];
  patientEncounters.push(encounter);
  groups.set(encounter.pid, patientEncounters);
  return groups;
}, new Map());

function encounterForDocument(patient, docDate) {
  const patientEncounters = encountersByPid.get(patient.pid) ?? [];
  const eligible = patientEncounters
    .filter((encounter) => encounter.date <= docDate)
    .sort((left, right) => right.date.localeCompare(left.date) || right.encounter - left.encounter);
  return eligible[0] ?? patientEncounters[0] ?? null;
}

const patientDocuments = [];
patients.slice(0, 900).forEach((patient, index) => {
  const count = index < 300 ? 2 : 1;
  for (let sequence = 1; sequence <= count; sequence += 1) {
    const anchorPrimary = index === 0 && sequence === 1;
    const anchorDirective = index === 0 && sequence === 2;
    const category = anchorPrimary
      ? documentCategories[0]
      : anchorDirective
        ? documentCategories[4]
        : documentCategories[(index + sequence) % documentCategories.length];
    const id = 8000000 + patientDocuments.length + 1;
    const docDate = anchorPrimary
      ? "2026-06-10"
      : anchorDirective
        ? "2026-06-12"
        : addDays(baseDate, -180 + ((index * 7 + sequence * 13) % 175));
    const uploadedAt = at(docDate, 13 + (sequence % 4), (index + sequence) % 2 ? 30 : 0);
    const encounter = encounterForDocument(patient, docDate);
    const documentKey = `DOC-${patient.canonicalId}-${sequence}`;
    const name = anchorPrimary || anchorDirective
      ? category.templateName
      : `${category.templateName} ${pad(sequence, 2)}`;
    const content = [
      `Gold synthetic document ${documentKey}`,
      `Patient: ${patient.fname} ${patient.lname} (${patient.canonicalId})`,
      `Category: ${category.name}`,
      `Document: ${name}`,
      `Document date: ${docDate}`,
      `Encounter: ${encounter?.encounter ?? "none"}`,
      `Purpose: ${patient.purpose}`
    ].join("\n");

    patientDocuments.push({
      id,
      documentKey,
      patientId: patient.canonicalId,
      pid: patient.pid,
      categoryId: category.id,
      categoryName: category.name,
      name,
      docDate,
      uploadedAt,
      mimetype: category.mimetype,
      sizeBytes: Buffer.byteLength(content, "utf8"),
      pages: category.pages + ((index + sequence) % 2),
      encounter: encounter?.encounter ?? null,
      storageMethod: "database",
      url: `gold://documents/${id}.txt`,
      hash: crypto.createHash("sha1").update(content).digest("hex"),
      documentationOf: category.documentationOf,
      notes: `Synthetic ${category.name.toLowerCase()} document for ${patient.cohort}.`,
      content
    });
  }
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
  patientHistories,
  appointments,
  encounters,
  vitals,
  clinicalNotes,
  problems,
  allergies,
  medicationLists,
  prescriptions,
  immunizations,
  messages,
  billing,
  claims,
  paymentSessions,
  paymentActivities,
  labProviders,
  procedureOrderCatalog,
  labOrders,
  labReports,
  labResults,
  patientDocuments,
  temporalCoverage: {
    asOfDate: baseDate,
    currentYear: baseDate.slice(0, 4),
    appointments: coverageFor(appointments, (appointment) => appointment.date),
    encounters: coverageFor(encounters, (encounter) => encounter.date),
    medicationListEntries: coverageFor(medicationLists, (medication) => medication.date),
    prescriptions: coverageFor(prescriptions, (prescription) => prescription.startDate),
    immunizations: coverageFor(immunizations, (immunization) => immunization.administeredDate),
    procedureOrders: coverageFor(labOrders, (order) => order.date),
    procedureReports: coverageFor(labReports, (report) => report.date),
    procedureResults: coverageFor(labResults, (result) => result.date),
    messages: coverageFor(messages, (message) => message.date),
    billingLineItems: coverageFor(billing, (line) => line.date),
    paymentPostings: coverageFor(paymentActivities, (activity) => activity.postDate),
    patientDocuments: coverageFor(patientDocuments, (document) => document.docDate)
  },
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
    patientHistories: patientHistories.length,
    appointments: appointments.length,
    encounters: encounters.length,
    vitals: vitals.length,
    clinicalNotes: clinicalNotes.length,
    problems: problems.length,
    allergies: allergies.length,
    medicationsAndPrescriptions: prescriptions.length,
    medicationListEntries: medicationLists.length,
    immunizations: immunizations.length,
    labOrders: labOrders.length,
    labReports: labReports.length,
    labResults: labResults.length,
    messages: messages.length,
    patientDocuments: patientDocuments.length,
    billingLineItems: billing.length,
    claims: claims.length,
    paymentSessions: paymentSessions.length,
    paymentActivities: paymentActivities.length,
    labProviders: labProviders.length,
    procedureOrderCatalogItems: procedureOrderCatalog.length,
    portalPatients: patients.filter((patient) => patient.portalEnabled).length
  },
  temporalCoverage: dataset.temporalCoverage,
  cohorts: patients.reduce((counts, patient) => ({ ...counts, [patient.cohort]: (counts[patient.cohort] ?? 0) + 1 }), {}),
  testAnchors: dataset.testAnchors
};

function buildLegacySql() {
  const statements = [
    "-- OpenEMR shared synthetic gold dataset v1",
    "-- Generated by modernization-workbench/seed-data/openemr-shared-synthetic-v1/scripts/generate-gold-dataset.mjs",
    "SET FOREIGN_KEY_CHECKS=0;",
    "DELETE FROM ar_activity;",
    "DELETE FROM ar_session;",
    "DELETE FROM claims;",
    "DELETE FROM billing;",
    "DELETE FROM procedure_result;",
    "DELETE FROM procedure_report;",
    "DELETE FROM procedure_order_code;",
    "DELETE FROM procedure_order;",
    "DELETE FROM procedure_type WHERE procedure_type_id BETWEEN 9000 AND 9999;",
    "DELETE FROM procedure_providers WHERE ppid BETWEEN 501 AND 505;",
    "DELETE FROM prescriptions;",
    "DELETE FROM immunization_observation WHERE imo_im_id BETWEEN 8500001 AND 8505000 OR imo_pid BETWEEN 100001 AND 101000;",
    "DELETE FROM immunizations WHERE id BETWEEN 8500001 AND 8505000 OR patient_id BETWEEN 100001 AND 101000;",
    "DELETE FROM pnotes;",
    "DELETE FROM categories_to_documents WHERE document_id BETWEEN 8000001 AND 8001200;",
    "DELETE FROM documents WHERE id BETWEEN 8000001 AND 8001200 OR url LIKE 'gold://documents/%';",
    "DELETE FROM forms;",
    "DELETE FROM form_soap;",
    "DELETE FROM form_vitals;",
    "DELETE FROM form_encounter;",
    "DELETE FROM openemr_postcalendar_events;",
    "DELETE FROM lists;",
    "DELETE FROM insurance_data;",
    "DELETE FROM history_data WHERE pid BETWEEN 100001 AND 101000;",
    "DELETE FROM employer_data;",
    "DELETE ctm FROM care_team_member ctm INNER JOIN care_teams ct ON ct.id = ctm.care_team_id WHERE ct.pid BETWEEN 100001 AND 101000;",
    "DELETE FROM care_teams WHERE pid BETWEEN 100001 AND 101000;",
    "DELETE FROM contact_telecom WHERE contact_id BETWEEN 3200001 AND 3201000;",
    "DELETE FROM contact_relation WHERE contact_id BETWEEN 3200001 AND 3201000;",
    "DELETE FROM contact_address WHERE contact_id BETWEEN 3200001 AND 3201000;",
    "DELETE FROM contact WHERE id BETWEEN 3200001 AND 3201000;",
    "DELETE FROM person_patient_link WHERE person_id BETWEEN 3100001 AND 3101000 OR patient_id BETWEEN 100001 AND 101000;",
    "DELETE FROM person WHERE id BETWEEN 3100001 AND 3101000;",
    "DELETE FROM insurance_companies WHERE id BETWEEN 9001 AND 9006;",
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

  statements.push(insert("insurance_companies", ["id", "uuid", "name", "inactive"], insuranceCompanies.map((company) => ({
    id: company.id,
    uuid: raw(sqlUuid(`insurance-company-${company.id}`)),
    name: company.name,
    inactive: 0
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

  statements.push(insert("patient_data", ["uuid", "title", "language", "financial", "fname", "lname", "mname", "DOB", "street", "postal_code", "city", "state", "country_code", "ss", "occupation", "phone_home", "phone_biz", "phone_contact", "phone_cell", "status", "contact_relationship", "date", "sex", "referrer", "providerID", "email", "ethnoracial", "race", "ethnicity", "interpreter", "family_size", "monthly_income", "homeless", "financial_review", "pubpid", "pid", "hipaa_mail", "hipaa_voice", "hipaa_notice", "hipaa_message", "hipaa_allowsms", "hipaa_allowemail", "allow_patient_portal", "cmsportal_login", "created_by", "updated_by", "preferred_name", "mothersname", "guardiansname", "guardianrelationship", "guardianphone", "guardianemail", "guardiansex", "guardianaddress", "guardiancity", "guardianstate", "guardianpostalcode", "guardiancountry", "guardianworkphone"], patients.map((patient, index) => ({
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
    race: patient.race,
    ethnicity: patient.ethnicity,
    interpreter: patient.interpreter,
    family_size: patient.familySize,
    monthly_income: patient.monthlyIncome,
    homeless: patient.homeless,
    financial_review: patient.financialReviewDate,
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
    preferred_name: patient.preferredName,
    mothersname: patient.motherName,
    guardiansname: patient.guardianName,
    guardianrelationship: patient.guardianRelationship,
    guardianphone: patient.guardianPhone,
    guardianemail: patient.guardianEmail,
    guardiansex: patient.guardianSex,
    guardianaddress: patient.guardianAddress,
    guardiancity: patient.guardianCity,
    guardianstate: patient.guardianState,
    guardianpostalcode: patient.guardianPostalCode,
    guardiancountry: patient.guardianCountry,
    guardianworkphone: patient.guardianWorkPhone
  })), 150));

  statements.push(insert("person", ["id", "uuid", "first_name", "middle_name", "last_name", "preferred_name", "gender", "active", "notes", "created_by", "updated_by"], patients.map((patient) => {
    const [firstName, ...lastParts] = patient.guardianName.split(" ");
    return {
      id: 3100000 + (patient.pid - 100000),
      uuid: raw(sqlUuid(`related-person-${patient.canonicalId}`)),
      first_name: firstName,
      middle_name: "",
      last_name: lastParts.join(" ") || patient.lname,
      preferred_name: "",
      gender: patient.guardianSex,
      active: 1,
      notes: `Synthetic ${patient.guardianRelationship} contact for ${patient.pubpid}`,
      created_by: 1,
      updated_by: 1
    };
  }), 150));

  statements.push(insert("contact", ["id", "foreign_table_name", "foreign_id"], patients.map((patient) => ({
    id: 3200000 + (patient.pid - 100000),
    foreign_table_name: "person",
    foreign_id: 3100000 + (patient.pid - 100000)
  })), 150));

  statements.push(insert("person_patient_link", ["person_id", "patient_id", "link_method", "notes", "active"], patients.map((patient) => ({
    person_id: 3100000 + (patient.pid - 100000),
    patient_id: patient.pid,
    link_method: "gold-dataset",
    notes: `Synthetic contact link for ${patient.pubpid}`,
    active: 1
  })), 150));

  statements.push(insert("contact_relation", ["contact_id", "target_table", "target_id", "active", "role", "relationship", "contact_priority", "is_primary_contact", "is_emergency_contact", "can_make_medical_decisions", "can_receive_medical_info", "start_date", "notes", "created_by", "updated_by"], patients.map((patient) => ({
    contact_id: 3200000 + (patient.pid - 100000),
    target_table: "patient_data",
    target_id: patient.pid,
    active: 1,
    role: "guardian",
    relationship: patient.guardianRelationship,
    contact_priority: 1,
    is_primary_contact: 1,
    is_emergency_contact: patient.cohort === "pediatric" ? 1 : 0,
    can_make_medical_decisions: patient.guardianRelationship === "parent" || patient.guardianRelationship === "spouse" ? 1 : 0,
    can_receive_medical_info: 1,
    start_date: `${patient.registrationDate} 09:00:00`,
    notes: `Synthetic ${patient.guardianRelationship} contact for ${patient.pubpid}`,
    created_by: 1,
    updated_by: 1
  })), 150));

  statements.push(insert("contact_telecom", ["contact_id", "rank", "system", "use", "value", "status", "is_primary", "created_by", "updated_by"], patients.flatMap((patient) => [
    {
      contact_id: 3200000 + (patient.pid - 100000),
      rank: 1,
      system: "phone",
      use: "mobile",
      value: patient.guardianPhone,
      status: "A",
      is_primary: "1",
      created_by: 1,
      updated_by: 1
    },
    {
      contact_id: 3200000 + (patient.pid - 100000),
      rank: 2,
      system: "email",
      use: "home",
      value: patient.guardianEmail,
      status: "A",
      is_primary: "0",
      created_by: 1,
      updated_by: 1
    }
  ]), 300));

  statements.push(insert("employer_data", ["uuid", "name", "street", "postal_code", "city", "state", "country", "date", "pid"], patients.map((patient) => ({
    uuid: raw(sqlUuid(`employer-${patient.canonicalId}`)),
    name: patient.employerName,
    street: patient.employerStreet,
    postal_code: patient.employerPostalCode,
    city: patient.employerCity,
    state: patient.employerState,
    country: patient.employerCountry,
    date: patient.registrationDate,
    pid: patient.pid
  })), 150));

  statements.push(insert("history_data", ["uuid", "coffee", "tobacco", "alcohol", "sleep_patterns", "exercise_patterns", "seatbelt_use", "counseling", "hazardous_activities", "recreational_drugs", "last_physical_exam", "last_mammogram", "last_prostate_exam", "last_sigmoidoscopy_colonoscopy", "last_ecg", "last_retinal", "last_fluvax", "last_pneuvax", "last_ldl", "last_hemoglobin", "last_psa", "last_exam_results", "history_mother", "history_father", "history_siblings", "history_offspring", "history_spouse", "relatives_cancer", "relatives_tuberculosis", "relatives_diabetes", "relatives_high_blood_pressure", "relatives_heart_problems", "relatives_stroke", "relatives_epilepsy", "relatives_mental_illness", "relatives_suicide", "appendectomy", "tonsillectomy", "cholecystestomy", "heart_surgery", "hysterectomy", "hernia_repair", "hip_replacement", "knee_replacement", "date", "pid", "additional_history", "exams", "created_by"], patientHistories.map((history) => ({
    uuid: raw(sqlUuid(history.id)),
    coffee: history.coffee,
    tobacco: history.tobacco,
    alcohol: history.alcohol,
    sleep_patterns: history.sleepPatterns,
    exercise_patterns: history.exercisePatterns,
    seatbelt_use: history.seatbeltUse,
    counseling: history.counseling,
    hazardous_activities: history.hazardousActivities,
    recreational_drugs: history.recreationalDrugs,
    last_physical_exam: history.lastPhysicalExam,
    last_mammogram: history.lastMammogram,
    last_prostate_exam: history.lastProstateExam,
    last_sigmoidoscopy_colonoscopy: history.lastColonoscopy,
    last_ecg: history.lastEcg,
    last_retinal: history.lastRetinal,
    last_fluvax: history.lastFluvax,
    last_pneuvax: history.lastPneuvax,
    last_ldl: history.lastLdl,
    last_hemoglobin: history.lastHemoglobin,
    last_psa: history.lastPsa,
    last_exam_results: history.lastExamResults,
    history_mother: history.historyMother,
    history_father: history.historyFather,
    history_siblings: history.historySiblings,
    history_offspring: history.historyOffspring,
    history_spouse: history.historySpouse,
    relatives_cancer: history.relativesCancer,
    relatives_tuberculosis: history.relativesTuberculosis,
    relatives_diabetes: history.relativesDiabetes,
    relatives_high_blood_pressure: history.relativesHighBloodPressure,
    relatives_heart_problems: history.relativesHeartProblems,
    relatives_stroke: history.relativesStroke,
    relatives_epilepsy: history.relativesEpilepsy,
    relatives_mental_illness: history.relativesMentalIllness,
    relatives_suicide: history.relativesSuicide,
    appendectomy: history.appendectomy,
    tonsillectomy: history.tonsillectomy,
    cholecystestomy: history.cholecystectomy,
    heart_surgery: history.heartSurgery,
    hysterectomy: history.hysterectomy,
    hernia_repair: history.herniaRepair,
    hip_replacement: history.hipReplacement,
    knee_replacement: history.kneeReplacement,
    date: history.recordedDate,
    pid: history.pid,
    additional_history: history.additionalHistory,
    exams: history.exams,
    created_by: history.createdBy
  })), 150));

  statements.push(insert("insurance_data", ["uuid", "type", "provider", "plan_name", "policy_number", "group_number", "subscriber_lname", "subscriber_mname", "subscriber_fname", "subscriber_relationship", "subscriber_DOB", "subscriber_street", "subscriber_street_line_2", "subscriber_postal_code", "subscriber_city", "subscriber_state", "subscriber_country", "subscriber_phone", "subscriber_employer", "subscriber_employer_street", "subscriber_employer_street_line_2", "subscriber_employer_postal_code", "subscriber_employer_city", "subscriber_employer_state", "subscriber_employer_country", "copay", "date", "pid", "subscriber_sex", "accept_assignment", "policy_type"], insuranceRecords.map((record) => {
    const company = insuranceCompanies.find((candidate) => candidate.name === record.provider);
    return {
      uuid: raw(sqlUuid(record.id)),
      type: record.type,
      provider: company?.id ?? "",
      plan_name: record.planName,
      policy_number: record.policyNumber,
      group_number: record.groupNumber,
      subscriber_lname: record.subscriberLastName,
      subscriber_mname: record.subscriberMiddleName,
      subscriber_fname: record.subscriberFirstName,
      subscriber_relationship: record.relationship,
      subscriber_DOB: record.subscriberDateOfBirth,
      subscriber_street: record.subscriberStreet,
      subscriber_street_line_2: record.subscriberStreetLine2,
      subscriber_postal_code: record.subscriberPostalCode,
      subscriber_city: record.subscriberCity,
      subscriber_state: record.subscriberState,
      subscriber_country: record.subscriberCountry,
      subscriber_phone: record.subscriberPhone,
      subscriber_employer: record.subscriberEmployer,
      subscriber_employer_street: record.subscriberEmployerStreet,
      subscriber_employer_street_line_2: record.subscriberEmployerStreetLine2,
      subscriber_employer_postal_code: record.subscriberEmployerPostalCode,
      subscriber_employer_city: record.subscriberEmployerCity,
      subscriber_employer_state: record.subscriberEmployerState,
      subscriber_employer_country: record.subscriberEmployerCountry,
      copay: record.type === "primary" ? "25" : "10",
      date: "2026-01-01",
      pid: record.pid,
      subscriber_sex: record.subscriberSex,
      accept_assignment: "TRUE",
      policy_type: record.type === "primary" ? "individual" : "secondary"
    };
  }), 200));

  statements.push(insert("openemr_postcalendar_events", ["uuid", "pc_catid", "pc_multiple", "pc_aid", "pc_pid", "pc_title", "pc_time", "pc_hometext", "pc_eventDate", "pc_endDate", "pc_duration", "pc_startTime", "pc_endTime", "pc_eventstatus", "pc_sharing", "pc_apptstatus", "pc_facility", "pc_billing_location", "pc_room", "pc_recurrtype", "pc_recurrspec"], appointments.map((appointment) => ({
    uuid: raw(sqlUuid(appointment.id)),
    pc_catid: appointment.categoryId,
    pc_multiple: 0,
    pc_aid: String(appointment.providerId),
    pc_pid: String(appointment.pid),
    pc_title: appointment.title,
    pc_time: appointment.start,
    pc_hometext: appointment.comments,
    pc_eventDate: appointment.date,
    pc_endDate: appointment.recurrenceEndDate ?? appointment.date,
    pc_duration: appointment.duration,
    pc_startTime: appointment.start.slice(11),
    pc_endTime: timePlusMinutes(appointment.start, appointment.duration / 60),
    pc_eventstatus: 1,
    pc_sharing: 1,
    pc_apptstatus: appointment.status,
    pc_facility: appointment.facilityId,
    pc_billing_location: appointment.facilityId,
    pc_room: appointment.room,
    pc_recurrtype: appointment.recurrenceType ?? 0,
    pc_recurrspec: serializeAppointmentRecurrence(appointment)
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

  statements.push(insert("immunizations", ["id", "uuid", "patient_id", "administered_date", "immunization_id", "cvx_code", "manufacturer", "lot_number", "administered_by_id", "administered_by", "education_date", "vis_date", "note", "create_date", "update_date", "created_by", "updated_by", "amount_administered", "amount_administered_unit", "expiration_date", "route", "administration_site", "added_erroneously", "completion_status", "information_source", "ordering_provider", "encounter_id"], immunizations.map((immunization) => ({
    id: immunization.id,
    uuid: raw(sqlUuid(immunization.key)),
    patient_id: immunization.pid,
    administered_date: immunization.administeredDate,
    immunization_id: immunization.immunizationId,
    cvx_code: immunization.cvxCode,
    manufacturer: immunization.manufacturer,
    lot_number: immunization.lotNumber,
    administered_by_id: immunization.administeredById,
    administered_by: immunization.administeredBy,
    education_date: dateOnly(immunization.educationDate),
    vis_date: dateOnly(immunization.visDate),
    note: immunization.note,
    create_date: immunization.administeredDate,
    update_date: immunization.administeredDate,
    created_by: 1,
    updated_by: 1,
    amount_administered: immunization.amountAdministered,
    amount_administered_unit: immunization.amountAdministeredUnit,
    expiration_date: immunization.expirationDate,
    route: immunization.route,
    administration_site: immunization.administrationSite,
    added_erroneously: 0,
    completion_status: immunization.completionStatus,
    information_source: immunization.informationSource,
    ordering_provider: immunization.administeredById,
    encounter_id: immunization.encounter
  })), 200));

  statements.push(insert("pnotes", ["date", "body", "pid", "user", "groupname", "activity", "authorized", "title", "assigned_to", "message_status", "portal_relation", "is_msg_encrypted"], messages.map((message) => ({
    date: message.date,
    body: message.body,
    pid: message.pid,
    user: "admin",
    groupname: "Default",
    activity: 1,
    authorized: 1,
    title: message.title,
    assigned_to: message.assignedTo,
    message_status: message.status,
    portal_relation: message.portalRelation,
    is_msg_encrypted: message.isEncrypted
  })), 200));

  statements.push(insert("documents", ["id", "uuid", "type", "size", "date", "url", "mimetype", "pages", "owner", "revision", "foreign_id", "docdate", "hash", "list_id", "name", "storagemethod", "path_depth", "imported", "encounter_id", "encounter_check", "audit_master_approval_status", "documentationOf", "encrypted", "document_data", "deleted"], patientDocuments.map((document) => ({
    id: document.id,
    uuid: raw(sqlUuid(document.documentKey)),
    type: "blob",
    size: document.sizeBytes,
    date: document.uploadedAt,
    url: document.url,
    mimetype: document.mimetype,
    pages: document.pages,
    owner: 1,
    revision: document.uploadedAt,
    foreign_id: document.pid,
    docdate: document.docDate,
    hash: document.hash,
    list_id: 0,
    name: document.name,
    storagemethod: 0,
    path_depth: 1,
    imported: 0,
    encounter_id: document.encounter ?? 0,
    encounter_check: 0,
    audit_master_approval_status: 1,
    documentationOf: document.documentationOf,
    encrypted: 0,
    document_data: document.content,
    deleted: 0
  })), 200));

  statements.push(insert("categories_to_documents", ["category_id", "document_id"], patientDocuments.map((document) => ({
    category_id: document.categoryId,
    document_id: document.id
  })), 300));

  statements.push(insert("billing", ["date", "code_type", "code", "modifier", "pid", "provider_id", "user", "groupname", "authorized", "encounter", "code_text", "billed", "activity", "units", "fee", "justify"], billing.map((line) => ({
    date: line.date,
    code_type: line.codeType,
    code: line.code,
    modifier: line.modifier ?? "",
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

  statements.push(insert("claims", ["patient_id", "encounter_id", "version", "payer_id", "status", "payer_type", "bill_process", "bill_time", "process_time", "process_file", "target", "x12_partner_id", "submitted_claim"], claims.map((claim) => ({
    patient_id: claim.pid,
    encounter_id: claim.encounter,
    version: claim.version,
    payer_id: claim.payerId,
    status: claim.status,
    payer_type: claim.payerType,
    bill_process: claim.billProcess,
    bill_time: claim.billTime,
    process_time: claim.processTime,
    process_file: claim.processFile,
    target: claim.target,
    x12_partner_id: claim.x12PartnerId,
    submitted_claim: claim.submittedClaim
  })), 200));

  statements.push(insert("ar_session", ["session_id", "payer_id", "user_id", "closed", "reference", "check_date", "deposit_date", "pay_total", "created_time", "modified_time", "global_amount", "payment_type", "description", "adjustment_code", "post_to_date", "patient_id", "payment_method"], paymentSessions.map((session) => ({
    session_id: session.id,
    payer_id: session.payerId,
    user_id: session.userId,
    closed: session.closed,
    reference: session.reference,
    check_date: session.checkDate,
    deposit_date: session.depositDate,
    pay_total: session.payTotal,
    created_time: session.createdTime,
    modified_time: session.modifiedTime,
    global_amount: session.globalAmount,
    payment_type: session.paymentType,
    description: session.description,
    adjustment_code: session.adjustmentCode,
    post_to_date: session.postToDate,
    patient_id: session.pid,
    payment_method: session.paymentMethod
  })), 200));

  statements.push(insert("ar_activity", ["pid", "encounter", "sequence_no", "code_type", "code", "modifier", "payer_type", "post_time", "post_user", "session_id", "memo", "pay_amount", "adj_amount", "modified_time", "follow_up", "follow_up_note", "account_code", "reason_code", "deleted", "post_date", "payer_claim_number"], paymentActivities.map((activity) => ({
    pid: activity.pid,
    encounter: activity.encounter,
    sequence_no: activity.sequenceNo,
    code_type: activity.codeType,
    code: activity.code,
    modifier: activity.modifier,
    payer_type: activity.payerType,
    post_time: activity.postTime,
    post_user: activity.postUserId,
    session_id: activity.sessionId,
    memo: activity.memo,
    pay_amount: activity.payAmount,
    adj_amount: activity.adjustmentAmount,
    modified_time: activity.modifiedTime,
    follow_up: activity.followUp,
    follow_up_note: activity.followUpNote,
    account_code: activity.accountCode,
    reason_code: activity.reasonCode,
    deleted: activity.deleted,
    post_date: activity.postDate,
    payer_claim_number: activity.payerClaimNumber
  })), 200));

  statements.push(insert("procedure_providers", ["ppid", "uuid", "name", "npi", "active"], labProviders.map((provider) => ({
    ppid: provider.id,
    uuid: raw(sqlUuid(`lab-provider-${provider.id}`)),
    name: provider.name,
    npi: provider.npi,
    active: provider.active ? 1 : 0
  })), 200));

  statements.push(insert("procedure_type", ["procedure_type_id", "parent", "name", "lab_id", "procedure_code", "procedure_type", "procedure_type_name", "body_site", "specimen", "route_admin", "laterality", "description", "units", "range", "standard_code", "related_code", "seq", "activity"], procedureOrderCatalog.map((item) => ({
    procedure_type_id: item.id,
    parent: item.parentId,
    name: item.name,
    lab_id: item.labId,
    procedure_code: item.code,
    procedure_type: item.itemType,
    procedure_type_name: item.procedureTypeName,
    body_site: "",
    specimen: item.specimen,
    route_admin: "",
    laterality: "",
    description: item.description,
    units: "",
    range: "",
    standard_code: item.standardCode,
    related_code: "",
    seq: item.seq,
    activity: item.active ? 1 : 0
  })), 200));

  statements.push(insert("procedure_order", ["procedure_order_id", "uuid", "provider_id", "patient_id", "encounter_id", "lab_id", "date_collected", "date_ordered", "order_priority", "order_status", "patient_instructions", "activity", "control_id", "specimen_type", "clinical_hx", "order_diagnosis", "procedure_order_type", "order_intent", "location_id"], labOrders.map((order) => ({
    procedure_order_id: order.id,
    uuid: raw(sqlUuid(`lab-order-${order.id}`)),
    provider_id: order.providerId,
    patient_id: order.pid,
    encounter_id: order.encounter,
    lab_id: order.labId,
    date_collected: order.date,
    date_ordered: order.date,
    order_priority: order.orderPriority,
    order_status: order.orderStatus,
    patient_instructions: order.instructions,
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
    procedure_type: order.procedureType
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
    review_status: report.reviewStatus,
    report_notes: report.notes
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
    result_status: result.resultStatus ?? "final"
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
