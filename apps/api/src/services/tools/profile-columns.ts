import { tool } from "ai";
import { z } from "zod";
import { parseCsv, parseExcel, profileColumns, saveProfiles } from "../profiler.js";
import { downloadFile } from "../storage.js";
import { supabase } from "../../config/supabase.js";

export const profileColumnsTool = tool({
  description: "Compute column-level statistics (native TypeScript) and semantic interpretation (LLM) for a source file. Returns enriched column profiles with types, labels, domains, and quality flags.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    sourceFileId: z.string().uuid(),
  }),
  execute: async ({ sourceFileId }) => {
    const { data: sf } = await supabase
      .from("source_files")
      .select("storage_path, file_type")
      .eq("id", sourceFileId)
      .single();

    if (!sf?.storage_path) throw new Error(`Source file ${sourceFileId} not found or no storage path`);

    await supabase.from("source_files").update({ status: "profiling" }).eq("id", sourceFileId);

    const buffer = await downloadFile(sf.storage_path);
    const isExcel = sf.file_type === "xlsx" || sf.file_type === "xls";
    const parsed = isExcel ? parseExcel(buffer) : parseCsv(buffer.toString("utf-8"));

    const profile = await profileColumns(parsed.columns, parsed.rows);
    await saveProfiles(sourceFileId, profile.columns);

    await supabase
      .from("source_files")
      .update({
        raw_profile: { columns: profile.stats, summary: profile.summary } as unknown as Record<string, unknown>,
        status: "profiled",
      })
      .eq("id", sourceFileId);

    return {
      sourceFileId,
      columns: profile.columns,
      summary: profile.summary,
      statsCount: profile.stats.length,
    };
  },
});
