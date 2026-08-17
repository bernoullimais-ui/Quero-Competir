import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseAdmin: SupabaseClient | null = null;

const DEFAULT_SUPABASE_URL = "https://fjpfmjilsyyhamikvyof.supabase.co";

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const supabaseServiceKey = 
      process.env.SUPABASE_SERVICE_ROLE_KEY || 
      process.env.SUPABASE_ANON_KEY || 
      process.env.VITE_SUPABASE_ANON_KEY || 
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqcGZtamlsc3l5aGFtaWt2eW9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzODU2NTUsImV4cCI6MjA1NTk2MTY1NX0.placeholder";

    const cleanUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");

    supabaseAdmin = createClient(cleanUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseAdmin;
}
