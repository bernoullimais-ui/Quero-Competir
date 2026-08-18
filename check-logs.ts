import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: logs, error: errLogs } = await supabase
    .from("whatsapp_logs")
    .select("*")
    .ilike("athlete_name", "%Anna%")
    .order("created_at", { ascending: false });

  console.log("Logs for Anna:", JSON.stringify(logs, null, 2));

  const { data: subs, error: errSubs } = await supabase
    .from("athlete_subscriptions")
    .select("id, athlete_name, parent_phone, document, payment_status, additional_data")
    .ilike("athlete_name", "%Anna%");

  console.log("Subs for Anna:", JSON.stringify(subs, null, 2));
}

run();
