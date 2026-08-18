import { config } from "dotenv";
config({ path: ".env" });
import { getSupabaseAdmin } from "./src/backend/lib/supabase";
import { sendPreRegistrationMessage, sendConfirmedMessage } from "./src/backend/services/utalkService";


async function run() {
  try {
    console.log("Iniciando reenvio de mensagens a partir das 10h30...");
    const supabase = getSupabaseAdmin();

    const { data: subs } = await supabase
      .from("athlete_subscriptions")
      .select("*, tournaments(id, name, owner_id)")
      .gte("created_at", "2026-08-18 13:30:00+00")
      .order("created_at", { ascending: true });

    if (!subs) {
      console.log("Nenhuma inscrição encontrada.");
      return;
    }

    // Agrupar por atleta/torneio
    const grouped = new Map<string, any[]>();
    for (const sub of subs) {
      const key = `${sub.athlete_name}_${sub.tournament_id}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(sub);
    }

    console.log(`Encontrados ${grouped.size} atletas para reenvio.`);

    for (const [key, groupSubs] of grouped.entries()) {
      const firstSub = groupSubs[0];
      const tournament = firstSub.tournaments;
      const phone = firstSub.parent_phone || firstSub.additional_data?.phone;
      
      if (!phone || !tournament) continue;

      let orgId = tournament.owner_id;
      const { data: acc } = await supabase
        .from("portal_accounts")
        .select("id, email, name, reference_id")
        .eq("id", tournament.owner_id)
        .maybeSingle();
      if (acc && acc.reference_id && acc.reference_id.length > 10) {
        orgId = acc.reference_id;
      }
      
      const { data: org } = await supabase
        .from("organizations")
        .select("whatsapp_tpl_pre_registration, whatsapp_tpl_confirmed")
        .eq("id", orgId)
        .maybeSingle();

      const catIds = groupSubs.map(s => s.category_id);
      const { data: cats } = await supabase.from("tournament_categories").select("name").in("id", catIds);
      const categoryNames = cats?.map(c => c.name) || [];

      // Calculate fee based on groupSubs
      const totalFee = groupSubs.reduce((acc, sub) => acc + (sub.additional_data?.athleteFee || 0), 0);
      const subId = firstSub.id;
      const pixLink = totalFee > 0 ? `https://querocompetir.com.br/public/register-athlete/${subId}` : undefined;

      console.log(`\n======================================================`);
      console.log(`Processando atleta: ${firstSub.athlete_name} | Tel: ${phone} | Torneio: ${tournament.name}`);
      console.log(`-> Enviando PRÉ-INSCRIÇÃO...`);
      
      try {
        await sendPreRegistrationMessage({
          phone,
          athleteName: firstSub.athlete_name,
          tournamentName: tournament.name,
          tournamentId: tournament.id,
          orgId,
          categoryNames,
          totalFee,
          paymentLink: pixLink,
          orgTemplate: org?.whatsapp_tpl_pre_registration,
        });
        console.log(`   OK! Pré-inscrição enviada.`);
      } catch (e) {
        console.error(`   ERRO ao enviar pré-inscrição:`, e);
      }

      // Se estiver pago, mandar a de confirmação também
      if (firstSub.payment_status === "paid") {
        console.log(`-> Inscrição está PAGA. Enviando CONFIRMAÇÃO...`);
        try {
          await sendConfirmedMessage({
            phone,
            athleteName: firstSub.athlete_name,
            tournamentName: tournament.name,
            tournamentId: tournament.id,
            orgId,
            categoryNames,
            subId,
            orgTemplate: org?.whatsapp_tpl_confirmed,
          });
          console.log(`   OK! Confirmação enviada.`);
        } catch (e) {
          console.error(`   ERRO ao enviar confirmação:`, e);
        }
      }
    }

    console.log("\nFim do reenvio!");
  } catch(e) {
    console.error("Critical error:", e);
  }
}

run();
