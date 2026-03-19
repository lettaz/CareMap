import { tool } from "ai";
import { z } from "zod";
import { parseCsv, parseExcel } from "../profiler.js";
import { downloadFile } from "../storage.js";
import { supabase } from "../../config/supabase.js";

export const parseFileTool = tool({
  description: "Parse an uploaded CSV or Excel file. Returns column list, row count, and sample rows. Uploads raw file to Supabase Storage.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    sourceFileId: z.string().uuid(),
  }),
  execute: async ({ sourceFileId }) => {
    const { data: sf } = await supabase
      .from("source_files")
      .select("filename, file_type, storage_path")
      .eq("id", sourceFileId)
      .single();

    if (!sf) throw new Error(`Source file ${sourceFileId} not found`);

    if (!sf.storage_path) {
      throw new Error("File not yet uploaded to storage");
    }

    const buffer = await downloadFile(sf.storage_path);
    const isExcel = sf.file_type === "xlsx" || sf.file_type === "xls";
    const parsed = isExcel ? parseExcel(buffer) : parseCsv(buffer.toString("utf-8"));

    await supabase
      .from("source_files")
      .update({ row_count: parsed.rowCount, column_count: parsed.columns.length })
      .eq("id", sourceFileId);

    return {
      sourceFileId,
      columns: parsed.columns,
      rowCount: parsed.rowCount,
      sampleRows: parsed.rows.slice(0, 5),
    };
  },
});
