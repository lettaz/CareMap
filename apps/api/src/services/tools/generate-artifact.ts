import { tool } from "ai";
import { z } from "zod";
import { getModel } from "../../config/ai.js";
import { generateText } from "ai";

export const generateArtifactTool = tool({
  description: "Given query results, generate a Recharts-compatible chart specification (type, title, axes, data). Returns a structured artifact for the frontend to render inline.",
  inputSchema: z.object({
    queryResults: z.array(z.record(z.unknown())),
    userQuestion: z.string(),
    columns: z.array(z.string()).optional(),
  }),
  execute: async ({ queryResults, userQuestion, columns }) => {
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
