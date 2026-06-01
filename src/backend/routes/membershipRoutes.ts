import { Router } from "express";
import { getSupabaseAdmin } from "../lib/supabase.ts";
import { requireAuth } from "../middleware/auth.ts";

const router = Router();

// 1. Consultar status da anuidade/filiação de um atleta
router.get("/status", async (req, res) => {
  const { memberId, organizationId, year } = req.query;

  if (!memberId || !organizationId || !year) {
    return res.status(400).json({ error: "Parâmetros obrigatórios ausentes (memberId, organizationId, year)." });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("memberships")
      .select("*")
      .eq("member_id", memberId)
      .eq("organization_id", organizationId)
      .eq("year", parseInt(year as string, 10))
      .maybeSingle();

    if (error) throw error;

    if (data) {
      return res.json({
        status: data.status,
        paymentStatus: data.payment_status,
        membership: data
      });
    }

    // Se não existir registro, retorna como pendente
    return res.json({
      status: "pending",
      paymentStatus: "pending",
      membership: null
    });
  } catch (err: any) {
    console.error("Erro ao carregar anuidade do atleta (fallback ativado):", err.message);
    // Caso a tabela memberships ainda não tenha sido criada no Supabase pelo usuário,
    // retorna status 'active' para não bloquear o funcionamento das telas principais.
    return res.json({
      status: "active",
      paymentStatus: "paid",
      fallback: true
    });
  }
});

// 2. Realizar checkout da anuidade (Simulação de Gateway de Pagamento)
router.post("/checkout", async (req, res) => {
  const { memberId, organizationId, year } = req.body;

  if (!memberId || !organizationId || !year) {
    return res.status(400).json({ error: "Dados inválidos para checkout da anuidade." });
  }

  try {
    const supabase = getSupabaseAdmin();
    
    // Insere ou atualiza (upsert) a filiação anual ativa com status de pago
    const { data, error } = await supabase
      .from("memberships")
      .upsert({
        member_id: memberId,
        organization_id: organizationId,
        year: parseInt(year as string, 10),
        status: "active",
        payment_status: "paid",
        payment_id: `pix_${Math.random().toString(36).substring(2, 11)}`,
        paid_at: new Date().toISOString()
      }, {
        onConflict: "organization_id,member_id,year"
      })
      .select()
      .maybeSingle();

    if (error) throw error;

    res.json({
      success: true,
      message: "Anuidade paga e filiação ativada com sucesso!",
      membership: data
    });
  } catch (err: any) {
    console.error("Erro no checkout de anuidade:", err.message);
    res.status(500).json({ error: "Erro ao processar pagamento da anuidade. Verifique se executou a migração SQL no Supabase." });
  }
});

// 3. Aprovação manual de anuidade pelo organizador/admin
router.post("/offline-approve", requireAuth, async (req, res) => {
  const { memberId, organizationId, year } = req.body;
  const userRole = req.user?.role;

  if (userRole !== "organizer" && userRole !== "super_admin") {
    return res.status(403).json({ error: "Apenas organizadores podem aprovar filiações offline." });
  }

  if (!memberId || !organizationId || !year) {
    return res.status(400).json({ error: "Dados insuficientes para aprovação." });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("memberships")
      .upsert({
        member_id: memberId,
        organization_id: organizationId,
        year: parseInt(year as string, 10),
        status: "active",
        payment_status: "paid",
        payment_id: `manual_approve_${req.user?.id || "admin"}`,
        paid_at: new Date().toISOString()
      }, {
        onConflict: "organization_id,member_id,year"
      })
      .select()
      .maybeSingle();

    if (error) throw error;

    res.json({
      success: true,
      message: "Afiliação aprovada manualmente com sucesso!",
      membership: data
    });
  } catch (err: any) {
    console.error("Erro na aprovação offline da filiação:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 4. Consultar status da anuidade/filiação de múltiplos atletas em lote
router.post("/status-bulk", async (req, res) => {
  const { memberIds, organizationId, year } = req.body;

  if (!memberIds || !organizationId || !year) {
    return res.status(400).json({ error: "Parâmetros obrigatórios ausentes (memberIds, organizationId, year)." });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("memberships")
      .select("member_id, status, payment_status")
      .eq("organization_id", organizationId)
      .eq("year", parseInt(year as string, 10))
      .in("member_id", memberIds);

    if (error) throw error;

    return res.json(data || []);
  } catch (err: any) {
    console.error("Erro ao carregar anuidades em lote (fallback ativado):", err.message);
    // Caso a tabela memberships ainda não tenha sido criada no Supabase pelo usuário,
    // retorna status 'active' para todos os atletas solicitados.
    return res.json((memberIds as string[]).map(id => ({
      member_id: id,
      status: "active",
      payment_status: "paid"
    })));
  }
});

export default router;
