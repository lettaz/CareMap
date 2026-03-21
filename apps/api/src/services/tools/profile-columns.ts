import { tool } from "ai";
import { z } from "zod";
import { parseCsv, parseExcel, profileColumns, saveProfiles } from "../profiler.js";
import { downloadFile } from "../storage.js";
import { supabase } from "../../config/supabase.js";

export const profileColumnsTool = tool({
  description:
    "Compute column-level statistics (native TypeScript) and semantic interpretation (LLM) for a source file. " +
    "By default profiles the original file. Set version='cleaned' to profile the cleaned version instead. " +
    "Returns enriched column profiles with types, labels, domains, and quality flags.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    sourceFileId: z.string().uuid(),
    version: z.enum(["original", "cleaned"]).default("original").describe(
      "Which version of the file to profile. Use 'cleaned' to profile a cleaned file.",
    ),
  }),
  execute: async ({ sourceFileId, version }) => {
    const { data: sf } = await supabase
      .from("source_files")
      .select("storage_path, cleaned_path, file_type")
      .eq("id", sourceFileId)
      .single();

    if (!sf) throw new Error(`Source file ${sourceFileId} not found`);

    const targetPath = version === "cleaned" && sf.cleaned_path
      ? sf.cleaned_path as string
      : sf.storage_path as string | null;

    if (!targetPath) {
      throw new Error(
        version === "cleaned"
          ? `Source file ${sourceFileId} has no cleaned version. Run cleaning first.`
          : `Source file ${sourceFileId} has no storage path`,
      );
    }

    await supabase.from("source_files").update({ status: "profiling" }).eq("id", sourceFileId);

    const buffer = await downloadFile(targetPath);
    const isCleaned = version === "cleaned";
    const isExcel = !isCleaned && (sf.file_type === "xlsx" || sf.file_type === "xls");
    const parsed = isExcel ? parseExcel(buffer) : parseCsv(buffer.toString("utf-8"));

    const profile = await profileColumns(parsed.columns, parsed.rows);
    await saveProfiles(sourceFileId, profile.columns);

    const newStatus = isCleaned ? "clean" : "profiled";
    await supabase
      .from("source_files")
      .update({
        raw_profile: { columns: profile.stats, summary: profile.summary } as unknown as Record<string, unknown>,
        status: newStatus,
        row_count: parsed.rows.length,
        column_count: parsed.columns.length,
      })
      .eq("id", sourceFileId);

    return {
      sourceFileId,
      version,
      columns: profile.columns,
      summary: profile.summary,
      statsCount: profile.stats.length,
    };
  },
});
