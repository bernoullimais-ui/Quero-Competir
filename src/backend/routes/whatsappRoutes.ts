import { Router } from "express";
import { requireAuth } from "../middleware/auth.ts";
import { getSupabaseAdmin } from "../lib/supabase.ts";
import {
  sendWhatsAppMessage,
  sendCartRecoveryMessage,
  formatPhoneBR,
} from "../services/utalkService.ts";

const router = Router();

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

  // Busca torneio e org para credenciais
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, organization_id")
    .eq("id", tournamentId)
    .maybeSingle();

  if (!tournament) {
    return res.status(404).json({ error: "Torneio não encontrado" });
  }

  if (filter === "custom_phone") {
    if (!customPhone) {
      return res.status(400).json({ error: "Número de telefone não informado." });
    }
    const personalizedMessage = message
      .replace(/\{nome_atleta\}/g, recipientName || "Atleta")
      .replace(/\{torneio\}/g, tournament.name || "");

    const result = await sendWhatsAppMessage({
      phone: customPhone,
      message: personalizedMessage,
      media: mediaUrl,
      mediaName,
      orgId: tournament.organization_id,
      tournamentId,
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
    .eq("tournament_id", tournamentId);

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

  let sent = 0;
  let errors = 0;

  for (const sub of targets) {
    const phone = sub.parent_phone || sub.additional_data?.phone;
    const personalizedMessage = message
      .replace(/\{nome_atleta\}/g, sub.athlete_name || "Atleta")
      .replace(/\{torneio\}/g, tournament.name || "");

    const result = await sendWhatsAppMessage({
      phone,
      message: personalizedMessage,
      media: mediaUrl,
      mediaName,
      orgId: tournament.organization_id,
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

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, organization_id")
    .eq("id", tournamentId)
    .maybeSingle();

  if (!tournament) return res.status(404).json({ error: "Torneio não encontrado" });

  // Busca template personalizado da org
  const { data: org } = await supabase
    .from("organizations")
    .select("whatsapp_tpl_pre_registration")
    .eq("id", tournament.organization_id)
    .maybeSingle();

  let query = supabase
    .from("athlete_subscriptions")
    .select("id, athlete_name, parent_phone, additional_data, payment_status, category_id")
    .eq("tournament_id", tournamentId)
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
      orgId: tournament.organization_id,
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
// com 2h~2h30 de vida sem pagamento e sem lembrete enviado.
router.post("/cron-cart-recovery", async (req, res) => {
  const cronSecret = req.headers["x-cron-secret"] || req.headers.authorization;
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = getSupabaseAdmin();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const twoHalfHoursAgo = new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString();

  const { data: subs } = await supabase
    .from("athlete_subscriptions")
    .select("id, athlete_name, parent_phone, additional_data, tournament_id, category_id")
    .neq("payment_status", "paid")
    .eq("whatsapp_cart_recovery_sent", false)
    .gte("created_at", twoHalfHoursAgo)
    .lte("created_at", twoHoursAgo);

  if (!subs || subs.length === 0) {
    return res.json({ success: true, processed: 0 });
  }

  // Agrupa por torneio para buscar dados do torneio e org em lote
  const tournamentIds = [...new Set(subs.map((s: any) => s.tournament_id))];
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, organization_id")
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
      orgId: tournament.organization_id,
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
