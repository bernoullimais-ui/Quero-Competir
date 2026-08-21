import { getSupabaseAdmin } from "./src/backend/lib/supabase";
import { sendCartRecoveryMessage } from "./src/backend/services/utalkService";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  const supabase = getSupabaseAdmin();
  const ids = [
    'f5e8f22f-b925-41e9-947c-966ee81b9fee', // Carlos
    'c24784f3-bc1b-4ab3-963c-79481b6cede5', // Carlos
    'e1c1f129-bb12-452e-a08b-9c1bd3fa5018', // Artur
    'fa265806-5e9a-46c9-b871-b8468512d348'  // Artur
  ];

  const { data: subs } = await supabase.from('athlete_subscriptions')
    .select('*, tournaments(name, owner_id)')
    .in('id', ids);
    
  if (!subs) return;

  // Group by phone/name
  const groupedSubs = new Map<string, any[]>();
  for (const sub of subs) {
    const phone = sub.parent_phone || sub.additional_data?.phone;
    if (!phone) continue;
    const key = `${phone}_${sub.athlete_name}`;
    if (!groupedSubs.has(key)) groupedSubs.set(key, []);
    groupedSubs.get(key)!.push(sub);
  }

  // Fetch categories
  const allCategoryIds = new Set<string>();
  for (const sub of subs) {
    if (Array.isArray(sub.category_id)) sub.category_id.forEach((id: string) => allCategoryIds.add(id));
    else if (sub.category_id) allCategoryIds.add(sub.category_id);
  }
  
  const categoryNamesMap: Record<string, string> = {};
  if (allCategoryIds.size > 0) {
    const { data: catData } = await supabase
      .from('tournament_categories')
      .select('id, name')
      .in('id', Array.from(allCategoryIds));
    if (catData) {
      catData.forEach((c: any) => categoryNamesMap[c.id] = c.name);
    }
  }

  for (const group of groupedSubs.values()) {
    const sub = group[0];
    const phone = sub.parent_phone || sub.additional_data?.phone;

    let allProvasIds: string[] = [];
    for(const s of group) {
      const pIds = Array.isArray(s.category_id) ? s.category_id : (s.category_id ? [s.category_id] : []);
      allProvasIds.push(...pIds);
    }
    allProvasIds = [...new Set(allProvasIds)];

    const totalFee = sub.additional_data?.totalFee || sub.additional_data?.athleteFee || 0;
    const totalDiscount = sub.discount_amount || 0;
    const categoryNames = allProvasIds.map((id: string) => categoryNamesMap[id] || id);
    const finalFee = Math.max(0, totalFee - totalDiscount);
    const paymentLink = `https://querocompetir.com.br/public/register-athlete/${sub.id}`;
    const pixCopyPaste = sub.additional_data?.pixCopyPaste || undefined;

    console.log(`Sending to ${sub.athlete_name}... Provas: ${categoryNames.join(', ')}, Total: ${totalFee}, Final: ${finalFee}, Link: ${paymentLink}`);

    const result = await sendCartRecoveryMessage({
      phone,
      athleteName: sub.athlete_name,
      tournamentName: sub.tournaments.name,
      tournamentId: sub.tournament_id,
      orgId: sub.tournaments.owner_id,
      categoryNames,
      totalFee: totalFee,
      discountAmount: totalDiscount,
      finalFee: finalFee,
      paymentLink,
      pixCopyPaste,
      sentBy: "organizer_manual",
    });

    console.log(`Result:`, result);
  }
}

run().then(() => console.log("Done")).catch(console.error);
