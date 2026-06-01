import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("CRITICAL: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados!");
      throw new Error("Missing Supabase credentials");
    }

    // Validação básica da chave
    if (supabaseServiceKey.length < 50) {
      console.warn("AVISO: A chave service_role parece curta demais. Verifique nos Segredos.");
    }

    // Sanitização rigorosa da URL
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
