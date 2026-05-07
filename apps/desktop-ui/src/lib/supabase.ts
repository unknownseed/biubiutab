import { createClient } from "@supabase/supabase-js";
import { requirePublicEnv } from "./env";

export function supabase() {
  return createClient(requirePublicEnv("VITE_SUPABASE_URL"), requirePublicEnv("VITE_SUPABASE_ANON_KEY"));
}

