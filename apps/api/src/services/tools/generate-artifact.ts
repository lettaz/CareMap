import { tool } from "ai";
import { z } from "zod";
import { getModel } from "../../config/ai.js";
import { generateText } from "ai";

export const generateArtifactTool = tool({
  description:
    "Generate a Recharts-compatible chart from query results. " +
    "You MUST pass the queryResults array from a prior run_query / run_script call. " +
    "If you don't have results yet, run the query first, then call this tool with the returned rows.",
  inputSchema: z.object({
    queryResults: z.array(z.record(z.unknown())).default([]),
    userQuestion: z.string(),
    columns: z.array(z.string()).optional(),
  }),
  execute: async ({ queryResults, userQuestion, columns }) => {
    if (queryResults.length === 0) {
      return {
        type: "error",
        success: false,
        error: "queryResults is empty. Run a query first (run_query or run_script), then pass the result rows to generate_artifact.",
        retryable: true,
        suggestion: "Call run_query to get data, then call generate_artifact with the returned rows as queryResults.",
      };
    }

    const { text } = await generateText({
      model: getModel(),
      messages: [
        {
          role: "system",
          content: `You are a data visualization assistant. Given query results and a user question, generate a chart specification.

Return valid JSON:
{
  "chartType": "bar" | "line" | "pie" | "scatter" | "area",
  "title": "Chart title",
  "xKey": "column name for x-axis",
  "yKey": "column name for y-axis",
  "data": [{ ... }],
  "description": "One sentence explaining the chart"
}

Use the actual data provided. Keep the data array to max 50 items. Pick the most appropriate chart type for the data.`,
        },
        {
          role: "user",
          content: `Question: ${userQuestion}\nColumns: ${JSON.stringify(columns ?? Object.keys(queryResults[0] ?? {}))}\nData (first 20 rows):\n${JSON.stringify(queryResults.slice(0, 20), null, 2)}`,
        },
      ],
      temperature: 0.2,
    });

    const jsonStr = text.replace(/```json\n?|\n?```/g, "").trim();
    const artifact = JSON.parse(jsonStr) as {
      chartType: string;
      title: string;
      xKey: string;
      yKey: string;
      data: unknown[];
      description: string;
    };

    return {
      type: "artifact",
      artifactType: "chart",
      status: "complete",
      data: artifact,
    };
  },
});
