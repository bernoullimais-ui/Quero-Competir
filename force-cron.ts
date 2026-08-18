import { createClient } from '@supabase/supabase-js';
import { sendCartRecoveryMessage } from './src/backend/services/utalkService';

const supabaseUrl = 'https://fjpfmjilsyyhamikvyof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqcGZtamlsc3l5aGFtaWt2eW9mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk1MTI4NSwiZXhwIjoyMDk0NTI3Mjg1fQ.uZ-UowoMI28h0HP7DsTGl5ZuxO4vBBBl_MwU7_7Ez70';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Starting manual sweep...");
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: subs, error } = await supabase
    .from("athlete_subscriptions")
    .select("id, athlete_name, parent_phone, additional_data, tournament_id, category_id, payment_status")
    .neq("payment_status", "paid")
    .eq("whatsapp_cart_recovery_sent", false)
    .gte("created_at", twentyFourHoursAgo)
    .lte("created_at", twoHoursAgo);

  if (error) {
     console.error("DB Error:", error);
     return;
  }

  if (!subs || subs.length === 0) {
    console.log("No subs found to process.");
    return;
  }

  console.log("Found", subs.length, "subs");

  const tournamentIds = [...new Set(subs.map((s: any) => s.tournament_id))];
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, owner_id")
    .in("id", tournamentIds);

  const tMap = {};
  for (const t of tournaments || []) tMap[t.id] = t;

  let processed = 0;
  for (const sub of subs) {
    const phone = sub.parent_phone || sub.additional_data?.phone;
    if (!phone) continue;

    const tournament = tMap[sub.tournament_id];
    if (!tournament) continue;

    console.log("Sending to", sub.athlete_name, "Phone:", phone);

    await sendCartRecoveryMessage({
      phone,
      athleteName: sub.athlete_name,
      tournamentName: tournament.name,
      tournamentId: sub.tournament_id,
      orgId: tournament.owner_id,
      categoryNames: [],
      totalFee: 0,
      sentBy: "cron-manual",
    });

    await supabase
      .from("athlete_subscriptions")
      .update({
        whatsapp_cart_recovery_sent: true,
        whatsapp_cart_recovery_sent_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    processed++;
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log("Finished. Processed:", processed);
}

run();
