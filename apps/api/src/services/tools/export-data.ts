import { tool } from "ai";
import { z } from "zod";
import * as XLSX from "xlsx";
import { uploadFile, getSignedUrl } from "../storage.js";
import { executeInSandbox } from "../sandbox.js";

type ExportFormat = "csv" | "json" | "xlsx" | "parquet";

const CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: "text/csv",
  json: "application/json",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  parquet: "application/octet-stream",
};

const EXTENSIONS: Record<ExportFormat, string> = {
  csv: ".csv",
  json: ".json",
  xlsx: ".xlsx",
  parquet: ".parquet",
};

function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvContent(columns: string[], rows: Record<string, unknown>[]): string {
  const lines: string[] = [columns.map(escapeCsvValue).join(",")];
  for (const row of rows) {
    lines.push(columns.map((col) => escapeCsvValue(row[col])).join(","));
  }
  return lines.join("\n");
}

function buildJsonBuffer(columns: string[], rows: Record<string, unknown>[]): Buffer {
  const ordered = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const col of columns) obj[col] = row[col] ?? null;
    return obj;
  });
  return Buffer.from(JSON.stringify(ordered, null, 2), "utf-8");
}

function buildXlsxBuffer(columns: string[], rows: Record<string, unknown>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows, { header: columns });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Uint8Array);
}

async function buildParquetBuffer(csvContent: string): Promise<Buffer> {
  const csvBase64 = Buffer.from(csvContent, "utf-8").toString("base64");

  const script = `
import pandas as pd, base64, io

csv_data = base64.b64decode("${csvBase64}").decode("utf-8")
df = pd.read_csv(io.StringIO(csv_data))
df.to_parquet("/tmp/output.parquet", engine="pyarrow", index=False)

with open("/tmp/output.parquet", "rb") as f:
    print(base64.b64encode(f.read()).decode("ascii"))
`;

  const result = await executeInSandbox(script, [], { timeoutMs: 60_000 });
  if (result.exitCode !== 0) {
    throw new Error(`Parquet conversion failed: ${result.stderr}`);
  }

  return Buffer.from(result.stdout.trim(), "base64");
}

function ensureExtension(filename: string, format: ExportFormat): string {
  const ext = EXTENSIONS[format];
  const base = filename.replace(/\.[^.]+$/, "");
  return base + ext;
}

export const exportDataTool = tool({
  description:
    "Export query results or any tabular data as a downloadable file. " +
    "Supports CSV, JSON, XLSX (Excel), and Parquet formats. " +
    "Uploads to Supabase Storage and returns a time-limited signed download URL (15 min). " +
    "Use this when the user asks to download, export, or save data.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    filename: z.string().describe("Desired filename, e.g. 'patients_export.csv'"),
    format: z.enum(["csv", "json", "xlsx", "parquet"]).default("csv")
      .describe("Output format: csv, json, xlsx (Excel), or parquet"),
    columns: z.array(z.string()).describe("Column headers in order"),
    rows: z.array(z.record(z.unknown())).describe("Array of row objects matching the columns"),
  }),
  execute: async ({ projectId, filename, format, columns, rows }) => {
    try {
      if (!rows.length) {
        return {
          success: false,
          error: "No data to export. The result set is empty.",
          suggestion: "Run a query first and pass the resulting rows to export_data.",
        };
      }

      const safeName = ensureExtension(
        filename.replace(/[^a-zA-Z0-9_\-.]/g, "_"),
        format,
      );

      let buffer: Buffer;
      const contentType = CONTENT_TYPES[format];

      switch (format) {
        case "json":
          buffer = buildJsonBuffer(columns, rows);
          break;
        case "xlsx":
          buffer = buildXlsxBuffer(columns, rows);
          break;
        case "parquet": {
          const csv = buildCsvContent(columns, rows);
          buffer = await buildParquetBuffer(csv);
          break;
        }
        case "csv":
        default: {
          buffer = Buffer.from(buildCsvContent(columns, rows), "utf-8");
          break;
        }
      }

      const storagePath = `exports/${projectId}/${Date.now()}_${safeName}`;
      await uploadFile(storagePath, buffer, contentType);
      const downloadUrl = await getSignedUrl(storagePath, 900);

      return {
        success: true,
        filename: safeName,
        format,
        rowCount: rows.length,
        columnCount: columns.length,
        sizeBytes: buffer.length,
        downloadUrl,
        expiresIn: "15 minutes",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: message,
        retryable: message.includes("Storage") || message.includes("sandbox"),
        suggestion: format === "parquet"
          ? "Parquet conversion requires the E2B sandbox. Try CSV or XLSX if sandbox is unavailable."
          : "File export failed. Try calling export_data again.",
      };
    }
  },
});
