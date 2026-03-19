import type { SemanticEntity, SemanticJoin } from "../types";

export const MOCK_ENTITIES: SemanticEntity[] = [
  {
    id: "entity-001",
    entityName: "patients",
    description:
      "Core patient registry containing demographics and identifiers for all admitted individuals.",
    sqlTableName: "patients",
    fields: [
      {
        name: "patient_id",
        sqlExpression: "patients.id",
        dataType: "string",
        description: "Unique patient identifier (P-XXXXX format)",
      },
      {
        name: "date_of_birth",
        sqlExpression: "patients.date_of_birth",
        dataType: "date",
        description: "Patient date of birth",
      },
      {
        name: "gender",
        sqlExpression: "patients.gender",
        dataType: "string",
        description: "Patient gender (M/F/D)",
      },
      {
        name: "insurance_type",
        sqlExpression: "patients.insurance_type",
        dataType: "string",
        description: "Insurance classification (KVG/VVG/UV/IV)",
      },
    ],
  },
  {
    id: "entity-002",
    entityName: "encounters",
    description:
      "Hospital encounters representing individual admissions, transfers, and discharges.",
    sqlTableName: "encounters",
    fields: [
      {
        name: "encounter_id",
        sqlExpression: "encounters.id",
        dataType: "string",
        description: "Unique encounter identifier",
      },
      {
        name: "patient_id",
        sqlExpression: "encounters.patient_id",
        dataType: "string",
        description: "Reference to the patient",
      },
      {
        name: "ward",
        sqlExpression: "encounters.ward",
        dataType: "string",
        description: "Current ward assignment (A1, A2, B1, B2, C1)",
      },
      {
        name: "admitted_at",
        sqlExpression: "encounters.admitted_at",
        dataType: "timestamp",
        description: "Admission date and time",
      },
      {
        name: "discharged_at",
        sqlExpression: "encounters.discharged_at",
        dataType: "timestamp",
        description: "Discharge date and time (null if still admitted)",
      },
      {
        name: "length_of_stay",
        sqlExpression:
          "EXTRACT(DAY FROM COALESCE(encounters.discharged_at, NOW()) - encounters.admitted_at)",
        dataType: "number",
        description: "Calculated length of stay in days",
      },
    ],
  },
  {
    id: "entity-003",
    entityName: "care_assessments",
    description:
      "Clinical assessment scores including fall risk, mobility, nutrition, pain, and pressure ulcer evaluations.",
    sqlTableName: "care_assessments",
    fields: [
      {
        name: "assessment_id",
        sqlExpression: "care_assessments.id",
        dataType: "string",
        description: "Unique assessment identifier",
      },
      {
        name: "patient_id",
        sqlExpression: "care_assessments.patient_id",
        dataType: "string",
        description: "Reference to the patient",
      },
      {
        name: "ward",
        sqlExpression: "care_assessments.ward",
        dataType: "string",
        description: "Ward where assessment was performed",
      },
      {
        name: "assessment_type",
        sqlExpression: "care_assessments.assessment_type",
        dataType: "string",
        description:
          "Type of assessment (fall_risk, mobility, nutrition, pain, pressure_ulcer)",
      },
      {
        name: "score",
        sqlExpression: "care_assessments.score",
        dataType: "number",
        description: "Numeric assessment score",
      },
      {
        name: "assessed_at",
        sqlExpression: "care_assessments.assessed_at",
        dataType: "timestamp",
        description: "Date and time the assessment was recorded",
      },
    ],
  },
  {
    id: "entity-004",
    entityName: "lab_results",
    description:
      "Laboratory test results including blood panels, inflammatory markers, and renal function tests.",
    sqlTableName: "lab_results",
    fields: [
      {
        name: "lab_result_id",
        sqlExpression: "lab_results.id",
        dataType: "string",
        description: "Unique lab result identifier",
      },
      {
        name: "patient_id",
        sqlExpression: "lab_results.patient_id",
        dataType: "string",
        description: "Reference to the patient",
      },
      {
        name: "test_name",
        sqlExpression: "lab_results.test_name",
        dataType: "string",
        description:
          "Name of the lab test (Hämoglobin, Kreatinin, CRP, Leukozyten, Albumin)",
      },
      {
        name: "value",
        sqlExpression: "lab_results.value",
        dataType: "number",
        description: "Numeric test result",
      },
      {
        name: "unit",
        sqlExpression: "lab_results.unit",
        dataType: "string",
        description: "Unit of measurement",
      },
      {
        name: "reference_range",
        sqlExpression: "lab_results.reference_range",
        dataType: "string",
        description: "Normal reference range for the test",
      },
      {
        name: "measured_at",
        sqlExpression: "lab_results.measured_at",
        dataType: "timestamp",
        description: "Date and time the sample was measured",
      },
    ],
  },
];

export const MOCK_JOINS: SemanticJoin[] = [
  {
    fromEntity: "patients",
    toEntity: "encounters",
    joinSql: "patients.id = encounters.patient_id",
  },
  {
    fromEntity: "encounters",
    toEntity: "care_assessments",
    joinSql:
      "encounters.patient_id = care_assessments.patient_id AND care_assessments.assessed_at BETWEEN encounters.admitted_at AND COALESCE(encounters.discharged_at, NOW())",
  },
  {
    fromEntity: "encounters",
    toEntity: "lab_results",
    joinSql:
      "encounters.patient_id = lab_results.patient_id AND lab_results.measured_at BETWEEN encounters.admitted_at AND COALESCE(encounters.discharged_at, NOW())",
  },
];
