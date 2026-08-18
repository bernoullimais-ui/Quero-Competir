import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: allSubs, error } = await supabase
    .from("athlete_subscriptions")
    .select("category_id")
    .eq("tournament_id", "fbbdeb69-042c-467c-9007-61f24adf07f5")
    .or(`document.eq."02879605520",athlete_name.eq."Anna magnavita "`);

  console.log("Error:", error);
  console.log("allSubs:", allSubs);
}

run();
