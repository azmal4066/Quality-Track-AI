import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const isConfigured = Boolean(url && key);
// Only the public anon key lives in the frontend. Never put the service-role key here.
export const supabase = createClient(url ?? "http://localhost", key ?? "missing");
