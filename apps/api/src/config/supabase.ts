import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

/**
 * Supabase client using the service role key (bypasses RLS).
 * For production, generate strict DB types with `supabase gen types`.
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
