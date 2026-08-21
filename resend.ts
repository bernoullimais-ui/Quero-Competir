import { getSupabaseAdmin } from "./src/backend/lib/supabase";
import { sendCartRecoveryMessage } from "./src/backend/services/utalkService";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  const supabase = getSupabaseAdmin();
  const ids = [
    'f5e8f22f-b925-41e9-947c-966ee81b9fee',
    'c24784f3-bc1b-4ab3-963c-79481b6cede5',
    'e1c1f129-bb12-452e-a08b-9c1bd3fa5018',
    'fa265806-5e9a-46c9-b871-b8468512d348'
  ];

  for (const id of ids) {
    const { data: sub } = await supabase.from('athlete_subscriptions').select('*, tournaments(name, owner_id)').eq('id', id).single();
    if (!sub) continue;

    const provasIds = Array.isArray(sub.category_id) ? sub.category_id : (sub.category_id ? [sub.category_id] : []);
    
    // fetch categories
    const categoryNamesMap: Record<string, string> = {};
    if (provasIds.length > 0) {
      const { data: catData } = await supabase.from('tournament_categories').select('id, name').in('id', provasIds);
      if (catData) catData.forEach((c: any) => categoryNamesMap[c.id] = c.name);
    }
    
    const categoryNames = provasIds.map((cid: string) => categoryNamesMap[cid] || cid);
    const fee = sub.additional_data?.athleteFee || sub.additional_data?.totalFee || 0;
    const paymentLink = `https://querocompetir.com.br/public/payment/${sub.id}`;
    const pixCopyPaste = sub.additional_data?.pixCopyPaste || undefined;

    console.log(`Sending to ${sub.athlete_name} (${sub.parent_phone || sub.additional_data?.phone})...`);

    const result = await sendCartRecoveryMessage({
      phone: sub.parent_phone || sub.additional_data?.phone,
      athleteName: sub.athlete_name,
      tournamentName: sub.tournaments.name,
      tournamentId: sub.tournament_id,
      orgId: sub.tournaments.owner_id,
      categoryNames,
      totalFee: fee,
      paymentLink,
      pixCopyPaste,
      sentBy: "organizer_manual",
    });

    console.log(`Result:`, result);
  }
}

run().then(() => console.log("Done")).catch(console.error);
