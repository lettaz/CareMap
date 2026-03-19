import type { PinnedWidget } from "../types";

export const MOCK_PINNED_WIDGETS: PinnedWidget[] = [
  {
    id: "widget-001",
    title: "Average Fall Risk Score by Ward",
    queryText: "What is the average fall risk score by ward?",
    sqlQuery:
      "SELECT ca.ward, ROUND(AVG(ca.score), 2) AS avg_fall_risk, COUNT(*) AS assessment_count FROM care_assessments ca WHERE ca.assessment_type = 'fall_risk' GROUP BY ca.ward ORDER BY avg_fall_risk DESC;",
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
      color: "#6366f1",
    },
    pinnedAt: "2026-03-14T14:01:30Z",
  },
  {
    id: "widget-002",
    title: "Data Completeness Trend (7 Days)",
    queryText: "Show me data completeness over the last 7 days.",
    sqlQuery:
      "SELECT DATE(assessed_at) AS day, ROUND(COUNT(CASE WHEN score IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1) AS completeness_pct FROM care_assessments WHERE assessed_at >= CURRENT_DATE - INTERVAL '7 days' GROUP BY DATE(assessed_at) ORDER BY day;",
    chartSpec: {
      type: "line",
      title: "Data Completeness Trend (7 Days)",
      data: [
        { day: "2026-03-10", completeness: 91.2 },
        { day: "2026-03-11", completeness: 88.5 },
        { day: "2026-03-12", completeness: 93.1 },
        { day: "2026-03-13", completeness: 86.7 },
        { day: "2026-03-14", completeness: 89.4 },
        { day: "2026-03-15", completeness: 92.8 },
        { day: "2026-03-16", completeness: 94.3 },
      ],
      xKey: "day",
      yKey: "completeness",
      color: "#10b981",
    },
    pinnedAt: "2026-03-15T10:15:00Z",
  },
];
