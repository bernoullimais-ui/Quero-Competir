import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getSupabaseAdmin } from "../lib/supabase";
import {
  sendWhatsAppMessage,
  sendCartRecoveryMessage,
  formatPhoneBR,
} from "../services/utalkService";

const router = Router();

function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
// ── POST /api/whatsapp/send-test ─────────────────────────────────────────────
// Teste manual de envio (acesso admin)
router.post("/send-test", requireAuth, async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: "phone e message são obrigatórios" });
  }
  const result = await sendWhatsAppMessage({
    phone,
    message,
    messageType: "test",
    sentBy: "admin_test",
  });
  if (!result.success) {
    return res.status(500).json({ error: result.error });
  }
  res.json({ success: true });
});

// ── POST /api/whatsapp/broadcast ─────────────────────────────────────────────
// Disparo em massa para inscritos de um torneio
router.post("/broadcast", requireAuth, async (req, res) => {
  const {
    tournamentId,
    filter,          // 'all' | 'confirmed' | 'pending' | 'by_category' | 'by_institution' | 'specific_athlete' | 'custom_phone'
    categoryId,
    institutionId,
    subId,
    customPhone,
    recipientName,
    message,
    mediaUrl,
    mediaName,
  } = req.body;

  if (!tournamentId || !message) {
    return res.status(400).json({ error: "tournamentId e message são obrigatórios" });
  }

  const supabase = getSupabaseAdmin();

  let finalTournamentId = tournamentId;
  if (!isValidUUID(tournamentId)) {
    const { data: slugData } = await supabase
      .from('tournaments')
      .select('id')
      .eq('slug', tournamentId)
      .maybeSingle();
    if (slugData) finalTournamentId = slugData.id;
  }

  // Busca torneio e org para credenciais
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, owner_id")
    .eq("id", finalTournamentId)
    .maybeSingle();

  if (!tournament) {
    return res.status(404).json({ error: "Torneio não encontrado" });
  }

  if (filter === "custom_phone") {
    if (!customPhone) {
      return res.status(400).json({ error: "Número de telefone não informado." });
    }
    const link = `https://querocompetir.com.br/torneios/${finalTournamentId}`;
    const personalizedMessage = message
      .replace(/\{nome_atleta\}/g, recipientName || "Atleta")
      .replace(/\{torneio\}/g, tournament.name || "")
      .replace(/\{provas\}/g, "")
      .replace(/\{valor\}/g, "")
      .replace(/\{link\}/g, link);

    const result = await sendWhatsAppMessage({
      phone: customPhone,
      message: personalizedMessage,
      media: mediaUrl,
      mediaName,
      orgId: tournament.owner_id,
      tournamentId: finalTournamentId,
      messageType: "broadcast",
      athleteName: recipientName || "Contato Avulso",
      sentBy: "organizer",
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    return res.json({ success: true, sent: 1, errors: 0, total: 1 });
  }

  // Monta query de inscrições
  let query = supabase
    .from("athlete_subscriptions")
    .select("id, athlete_name, parent_phone, additional_data, payment_status, category_id, institution_id")
    .eq("tournament_id", finalTournamentId);

  if (filter === "confirmed") {
    query = query.eq("payment_status", "paid");
  } else if (filter === "pending") {
    query = query.neq("payment_status", "paid");
  } else if (filter === "by_category" && categoryId) {
    query = query.eq("category_id", categoryId);
  } else if (filter === "by_institution" && institutionId) {
    query = query.eq("institution_id", institutionId);
  } else if (filter === "specific_athlete" && subId) {
    query = query.eq("id", subId);
  }

  const { data: subscriptions, error } = await query;
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return res.json({ success: true, sent: 0, errors: 0, total: 0 });
  }

  // Deduplica por telefone para não enviar duplicado
  const seenPhones = new Set<string>();
  const targets = subscriptions.filter((s: any) => {
    const phone = s.parent_phone || s.additional_data?.phone;
    if (!phone) return false;
    const fmt = formatPhoneBR(phone);
    if (seenPhones.has(fmt)) return false;
    seenPhones.add(fmt);
    return true;
  });

  // Busca nomes das categorias
  const allCategoryIds = new Set<string>();
  for (const sub of targets) {
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

  let sent = 0;
  let errors = 0;

  for (const sub of targets) {
    const phone = sub.parent_phone || sub.additional_data?.phone;
    
    const provasIds = Array.isArray(sub.category_id) ? sub.category_id : (sub.category_id ? [sub.category_id] : []);
    const provas = provasIds.map((id: string) => categoryNamesMap[id] || id).join(", ");
    
    const fee = sub.additional_data?.athleteFee || sub.additional_data?.totalFee || 0;
    const valor = fee > 0 ? `R$ ${Number(fee).toFixed(2)}` : "Gratuita";
    const link = `https://querocompetir.com.br/torneios/${finalTournamentId}`;

    const personalizedMessage = message
      .replace(/\{nome_atleta\}/g, sub.athlete_name || "Atleta")
      .replace(/\{torneio\}/g, tournament.name || "")
      .replace(/\{provas\}/g, provas)
      .replace(/\{valor\}/g, valor)
      .replace(/\{link\}/g, link);

    const result = await sendWhatsAppMessage({
      phone,
      message: personalizedMessage,
      media: mediaUrl,
      mediaName,
      orgId: tournament.owner_id,
      tournamentId,
      messageType: "broadcast",
      athleteName: sub.athlete_name,
      sentBy: "organizer",
    });

    if (result.success) sent++;
    else errors++;

    // Throttle gentil para não sobrecarregar a API
    await new Promise(r => setTimeout(r, 300));
  }

  res.json({ success: true, sent, errors, total: targets.length });
});

// ── POST /api/whatsapp/cart-recovery/:tournamentId ───────────────────────────
// Disparo manual de lembrete para uma inscrição específica
router.post("/cart-recovery/:tournamentId", requireAuth, async (req, res) => {
  const { tournamentId } = req.params;
  const { subId } = req.body; // se subId → envio individual; senão → todos os pendentes

  const supabase = getSupabaseAdmin();

  let finalTournamentId = tournamentId;
  if (!isValidUUID(tournamentId)) {
    const { data: slugData } = await supabase
      .from('tournaments')
      .select('id')
      .eq('slug', tournamentId)
      .maybeSingle();
    if (slugData) finalTournamentId = slugData.id;
  }

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, owner_id")
    .eq("id", finalTournamentId)
    .maybeSingle();

  if (!tournament) return res.status(404).json({ error: "Torneio não encontrado" });

  // Busca template personalizado da org
  const { data: org } = await supabase
    .from("organizations")
    .select("whatsapp_tpl_pre_registration")
    .eq("id", tournament.owner_id)
    .maybeSingle();

  let query = supabase
    .from("athlete_subscriptions")
    .select("id, athlete_name, parent_phone, additional_data, payment_status, category_id")
    .eq("tournament_id", finalTournamentId)
    .neq("payment_status", "paid");

  if (subId) query = query.eq("id", subId);

  const { data: subs } = await query;
  if (!subs || subs.length === 0) return res.json({ success: true, sent: 0 });

  let sent = 0;
  for (const sub of subs) {
    const phone = sub.parent_phone || sub.additional_data?.phone;
    if (!phone) continue;

    await sendCartRecoveryMessage({
      phone,
      athleteName: sub.athlete_name,
      tournamentName: tournament.name,
      tournamentId,
      orgId: tournament.owner_id,
      categoryNames: [sub.category_id], // simplificado; enriched em produção
      totalFee: 0,
      orgTemplate: org?.whatsapp_tpl_pre_registration,
      sentBy: "organizer_manual",
    });

    // Marca que lembrete foi enviado
    await supabase
      .from("athlete_subscriptions")
      .update({
        whatsapp_cart_recovery_sent: true,
        whatsapp_cart_recovery_sent_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    sent++;
    await new Promise(r => setTimeout(r, 300));
  }

  res.json({ success: true, sent });
});

// ── GET /api/whatsapp/logs/:tournamentId ─────────────────────────────────────
// Histórico de mensagens enviadas para um torneio
router.get("/logs/:tournamentId", requireAuth, async (req, res) => {
  const { tournamentId } = req.params;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("whatsapp_logs")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ── POST /api/whatsapp/cron-cart-recovery ────────────────────────────────────
// Chamado pelo Vercel Cron a cada hora. Envia lembrete para pré-inscrições
// com mais de 2h de vida sem pagamento e sem lembrete enviado (limite 24h para não reviver inscrições muito antigas).
router.post("/cron-cart-recovery", async (req, res) => {
  const cronSecret = req.headers["x-cron-secret"] || req.headers.authorization;
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = getSupabaseAdmin();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: subs } = await supabase
    .from("athlete_subscriptions")
    .select("id, athlete_name, parent_phone, additional_data, tournament_id, category_id, payment_status")
    .neq("payment_status", "paid")
    .eq("whatsapp_cart_recovery_sent", false)
    .gte("created_at", twentyFourHoursAgo)
    .lte("created_at", twoHoursAgo);

  if (!subs || subs.length === 0) {
    return res.json({ success: true, processed: 0 });
  }

  // Agrupa por torneio para buscar dados do torneio e org em lote
  const tournamentIds = [...new Set(subs.map((s: any) => s.tournament_id))];
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, owner_id")
    .in("id", tournamentIds);

  const tMap: Record<string, any> = {};
  for (const t of tournaments || []) tMap[t.id] = t;

  let processed = 0;
  for (const sub of subs) {
    const phone = sub.parent_phone || sub.additional_data?.phone;
    if (!phone) continue;

    const tournament = tMap[sub.tournament_id];
    if (!tournament) continue;

    await sendCartRecoveryMessage({
      phone,
      athleteName: sub.athlete_name,
      tournamentName: tournament.name,
      tournamentId: sub.tournament_id,
      orgId: tournament.owner_id,
      categoryNames: [],
      totalFee: 0,
      sentBy: "cron",
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

  res.json({ success: true, processed });
});

export default router;
