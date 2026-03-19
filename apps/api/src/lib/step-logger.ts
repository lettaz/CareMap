import { supabase } from "../config/supabase.js";

export interface StepHandle {
  id: string;
  finish: (output: Record<string, unknown>) => Promise<void>;
  fail: (errorMessage: string) => Promise<void>;
}

export async function logStep(opts: {
  projectId: string;
  nodeId?: string;
  sourceFileId?: string;
  stepType: string;
  inputSummary?: Record<string, unknown>;
}): Promise<StepHandle> {
  const startedAt = Date.now();

  const { data, error } = await supabase
    .from("pipeline_step_logs")
    .insert({
      project_id: opts.projectId,
      node_id: opts.nodeId ?? null,
      source_file_id: opts.sourceFileId ?? null,
      step_type: opts.stepType,
      status: "running",
      input_summary: opts.inputSummary ?? null,
    })
    .select("id")
    .single();

  const stepId = error ? "unknown" : (data.id as string);

  return {
    id: stepId,
    finish: async (output: Record<string, unknown>) => {
      const durationMs = Date.now() - startedAt;
      await supabase
        .from("pipeline_step_logs")
        .update({ status: "completed", output_summary: output, duration_ms: durationMs })
        .eq("id", stepId);
    },
    fail: async (errorMessage: string) => {
      const durationMs = Date.now() - startedAt;
      await supabase
        .from("pipeline_step_logs")
        .update({ status: "error", error_message: errorMessage, duration_ms: durationMs })
        .eq("id", stepId);
    },
  };
}
