import { supabase } from "../config/supabase.js";

export async function isYoloMode(projectId: string): Promise<boolean> {
  const { data } = await supabase
    .from("projects")
    .select("settings")
    .eq("id", projectId)
    .single();

  return (data?.settings as Record<string, unknown>)?.yoloMode === true;
}
