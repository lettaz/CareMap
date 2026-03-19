import type { AgentMessage } from "../types";

export const MOCK_CONVERSATION: AgentMessage[] = [
  // ── User asks to profile and map ──
  {
    id: "msg-001",
    role: "user",
    content: "Profile {{src-care}} and map it to our canonical schema.",
    timestamp: "2026-03-14T09:30:00Z",
    entities: [
      { id: "src-care", type: "source", label: "care_assessments.csv", hash: "src" },
    ],
  },

  // ── Agent: tool steps + profiling result ──
  {
    id: "msg-002",
    role: "agent",
    content: "",
    timestamp: "2026-03-14T09:30:02Z",
    toolSteps: [
      {
        id: "ts-001",
        icon: "search",
        label: "Profiling",
        entities: [{ id: "src-care-ref", type: "source", label: "care_assessments.csv" }],
        status: "success",
        durationMs: 1240,
        detail: "Parsed 12 columns × 247 rows.\nDetected types: 5 integer, 3 string, 2 date, 1 code, 1 free-text.\nLanguage: German (de).\nNull rate: 4.2% overall, highest in Bemerkung (61%).",
      },
      {
        id: "ts-002",
        icon: "edit",
        label: "Mapping columns to canonical schema",
        entities: [{ id: "tgt-care", type: "table", label: "care_assessments" }],
        status: "success",
        durationMs: 820,
      },
      {
        id: "ts-003",
        icon: "check",
        label: "Quality checks completed — 2 alerts generated",
        status: "success",
        durationMs: 310,
      },
    ],
    artifacts: [
      {
        id: "art-overview-1",
        type: "overview",
        label: "Overview",
        content:
          "Profiling complete. I found **12 columns** across **247 rows**. Key findings:\n\n- **5 assessment scores** (Sturzrisiko_Skala, Mobilität, Ernährung, Schmerz, Dekubitus) mapped with 85–92% confidence\n- **PatientNr** matches patient registry format (P-XXXXX) at 95% confidence\n- **Station** contains 5 unique wards: A1, A2, B1, B2, C1\n- **Bemerkung** (Notes) has 61% null rate — flagged for review\n- **Entlassdatum** has mixed date formats (ISO 8601 vs DD.MM.YYYY)\n\n2 quality alerts generated.",
      },
      {
        id: "art-table-1",
        type: "table",
        label: "care_assessments",
        hash: "247",
        tableData: {
          columns: ["PatientNr", "Station", "Datum", "Sturzrisiko_Skala", "Mobilität", "Ernährung", "Schmerz"],
          rows: [
            ["P-10042", "A1", "2026-03-10", 3, 2, 2, 4],
            ["P-10089", "B2", "2026-03-10", 1, 3, 1, 2],
            ["P-10103", "A2", "2026-03-11", 0, 4, 3, 1],
            ["P-10042", "A1", "2026-03-12", 2, 2, 2, 6],
            ["P-10155", "C1", "2026-03-12", 4, 1, 0, 8],
            ["P-10089", "B2", "2026-03-13", 1, 3, 2, 3],
          ],
        },
      },
    ],
  },

  // ── User approves and asks follow-up ──
  {
    id: "msg-003",
    role: "user",
    content: "Yes, proceed. Also flag any rows with missing patient IDs.",
    timestamp: "2026-03-14T09:31:00Z",
  },

  // ── Agent: mapping proposal with approval ──
  {
    id: "msg-004",
    role: "agent",
    content: "",
    timestamp: "2026-03-14T09:31:15Z",
    toolSteps: [
      {
        id: "ts-004",
        icon: "edit",
        label: "Generated 12 field mappings from {{src-care-2}} → {{tgt-care-2}}",
        entities: [
          { id: "src-care-2", type: "source", label: "care_assessments.csv" },
          { id: "tgt-care-2", type: "table", label: "care_assessments" },
        ],
        status: "success",
        durationMs: 420,
      },
      {
        id: "ts-005",
        icon: "search",
        label: "Scanning for null PatientNr values",
        status: "success",
        durationMs: 80,
        detail: "Found 5 rows with null PatientNr: row indices [23, 67, 102, 189, 231].\nThese will be excluded from harmonised output until resolved.",
      },
    ],
    artifacts: [
      {
        id: "art-overview-2",
        type: "overview",
        label: "Overview",
        content:
          "Mapping proposal generated with **12 field mappings**:\n\n- **10 accepted** (high confidence ≥78%)\n- **1 pending** — Entlassdatum → encounters.discharged_at (72%, mixed date formats)\n- **1 rejected** — Bemerkung → care_assessments.notes (34%, semantic purpose unclear)\n\nI also found **5 rows with null PatientNr** values — these have been flagged as a critical quality alert. They'll be excluded from the harmonised output until resolved.\n\nThe pipeline is ready to run.",
      },
    ],
    approval: {
      status: "accepted",
      label: "Mapping proposal has been accepted",
    },
  },

  // ── User asks analytical question ──
  {
    id: "msg-005",
    role: "user",
    content: "What is the average fall risk score by ward?",
    timestamp: "2026-03-14T14:00:00Z",
  },

  // ── Agent: query + chart artifact ──
  {
    id: "msg-006",
    role: "agent",
    content: "",
    timestamp: "2026-03-14T14:00:12Z",
    toolSteps: [
      {
        id: "ts-006",
        icon: "search",
        label: "Checking {{tgt-ca}} schema and computing aggregation",
        entities: [{ id: "tgt-ca", type: "table", label: "care_assessments" }],
        status: "success",
        durationMs: 42,
        detail: "SELECT\n  ca.ward,\n  ROUND(AVG(ca.score), 2) AS avg_fall_risk,\n  COUNT(*) AS assessment_count\nFROM care_assessments ca\nWHERE ca.assessment_type = 'fall_risk'\nGROUP BY ca.ward\nORDER BY avg_fall_risk DESC;",
      },
      {
        id: "ts-007",
        icon: "chart",
        label: "Generated horizontal bar chart",
        status: "success",
        durationMs: 20,
      },
    ],
    artifacts: [
      {
        id: "art-overview-3",
        type: "overview",
        label: "Overview",
        content:
          "Here are the average fall risk scores by ward. **Ward B2** has the highest average (3.0), while **Ward C1** has the lowest (0.33).\n\n**What I did:**\n- Queried the harmonised care_assessments table filtering for fall_risk assessments\n- Aggregated by ward and computed the average score\n- Generated a horizontal bar chart for visual comparison",
      },
      {
        id: "art-table-2",
        type: "table",
        label: "fall_risk_by_ward",
        hash: "5",
        tableData: {
          columns: ["ward", "avg_fall_risk", "assessment_count"],
          rows: [
            ["B2", 3.0, 42],
            ["B1", 3.0, 38],
            ["A1", 2.67, 65],
            ["A2", 1.0, 51],
            ["C1", 0.33, 51],
          ],
        },
      },
      {
        id: "art-chart-1",
        type: "chart",
        label: "Fall Risk by Ward",
        hash: "4ef",
        chartSpec: {
          type: "bar",
          title: "Average Fall Risk Score by Ward",
          data: [
            { ward: "B2", avg_score: 3.0 },
            { ward: "B1", avg_score: 3.0 },
            { ward: "A1", avg_score: 2.67 },
            { ward: "A2", avg_score: 1.0 },
            { ward: "C1", avg_score: 0.33 },
          ],
          xKey: "ward",
          yKey: "avg_score",
          color: "#4F46E5",
        },
      },
    ],
  },
];
