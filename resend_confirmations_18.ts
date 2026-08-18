import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { sendConfirmedMessage } from "./src/backend/services/utalkService";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  console.log("Starting resend script for confirmations from 10:30 AM 18/08/2026...");
  
  // 10:30 BRT = 13:30 UTC
  const startTime = "2026-08-18T13:30:00.000Z";

  // Fetch all subscriptions created after that time
  const { data: subs, error } = await supabase
    .from("athlete_subscriptions")
    .select("*")
    .gte("created_at", startTime)
    .eq("payment_status", "paid");

  if (error) {
    console.error("Error fetching subscriptions:", error);
    return;
  }

  console.log(`Found ${subs?.length} paid subscriptions since 10:30 AM.`);

  // To avoid duplicate sending for grouped categories, we group them by athlete & document just like the frontend
  const groupedSubs = Object.values((subs || []).reduce((acc: any, sub: any) => {
    const phone = sub.parent_phone || sub.additional_data?.phone;
    const key = `${sub.athlete_name}_${sub.document || phone}`;
    if (!acc[key]) {
      acc[key] = {
        ...sub,
        subId: sub.id,
        categoryIds: [sub.category_id]
      };
    } else {
      if (!acc[key].categoryIds.includes(sub.category_id)) {
        acc[key].categoryIds.push(sub.category_id);
      }
    }
    return acc;
  }, {} as Record<string, any>));

  for (const group of groupedSubs) {
    const phone = group.parent_phone || group.additional_data?.phone;
    const athleteName = group.athlete_name;
    const tournamentId = group.tournament_id;

    if (!phone) {
      console.log(`Skipping ${athleteName} - No phone found.`);
      continue;
    }

    // Check if we already sent a confirmed message today for this athlete
    const { data: logs } = await supabase
      .from("whatsapp_logs")
      .select("id")
      .eq("athlete_name", athleteName)
      .eq("message_type", "confirmed")
      .gte("created_at", startTime);

    if (logs && logs.length > 0) {
      console.log(`Skipping ${athleteName} - Confirmation already sent.`);
      continue;
    }

    console.log(`Sending confirmation to ${athleteName} (${phone})...`);

    try {
      const { data: tournament } = await supabase
        .from("tournaments")
        .select("id, name, owner_id")
        .eq("id", tournamentId)
        .maybeSingle();

      const PRIMARY_ORG_UUID = "470275a0-cc3c-49f1-b61e-0f19850a6a4e";
      let orgId = PRIMARY_ORG_UUID;
      
      if (tournament?.owner_id) {
        const { data: acc } = await supabase
          .from("portal_accounts")
          .select("reference_id")
          .eq("id", tournament.owner_id)
          .maybeSingle();
        if (acc && acc.reference_id) {
          orgId = acc.reference_id;
        }
      }
      
      const { data: org } = await supabase
        .from("organizations")
        .select("whatsapp_tpl_confirmed")
        .eq("id", orgId)
        .maybeSingle();

      // Get category names
      const { data: cats } = await supabase.from("tournament_categories").select("name").in("id", group.categoryIds);

      await sendConfirmedMessage({
        phone,
        athleteName: athleteName || "Atleta",
        tournamentName: tournament?.name || "Torneio",
        tournamentId,
        orgId: orgId,
        categoryNames: cats?.map((c: any) => c.name) || [],
        subId: group.subId, // use the first subId as protocol
        orgTemplate: (org as any)?.whatsapp_tpl_confirmed,
      });

      console.log(`✅ Success for ${athleteName}`);
    } catch (err: any) {
      console.error(`❌ Failed for ${athleteName}:`, err.message);
    }
  }

  console.log("Finished.");
}

run();
