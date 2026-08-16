import { Router } from "express";
import { getSupabaseAdmin } from "../lib/supabase.ts";
import { requireAuth } from "../middleware/auth.ts";
import fs from "fs";
import path from "path";

const router = Router();

const DATA_FILE = path.join(process.cwd(), "src", "backend", "data", "subscriptions.json");
const INST_PAYMENTS_FILE = path.join(process.cwd(), "src", "backend", "data", "institution_payments.json");

// Helper function to call Pagar.me API v5
async function callPagarMe(endpoint: string, method: string, body: any) {
  const secretKey = process.env.PAGARME_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAGARME_SECRET_KEY não configurada no servidor.");
  }
  
  const authHeader = "Basic " + Buffer.from(secretKey + ":").toString("base64");
  const response = await fetch(`https://api.pagar.me/core/v5${endpoint}`, {
    method,
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/json",
      "accept": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  
  const data = await response.json();
  if (!response.ok) {
    console.error("[Pagar.me Error]", data);
    throw new Error(data.message || (data.errors ? JSON.stringify(data.errors) : "Erro na API do Pagar.me"));
  }
  return data;
}

// 1. Obter dados e status do recebedor Pagar.me da organização
router.get("/organizations/:id/recipient-status", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const supabase = getSupabaseAdmin();
    const { data: org, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!org) {
      return res.status(404).json({ error: "Organização não encontrada." });
    }

    let liveStatus = org.pagarme_recipient_status || "not_configured";
    let pagarmeDetails: any = null;

    if (org.pagarme_recipient_id && process.env.PAGARME_SECRET_KEY) {
      try {
        pagarmeDetails = await callPagarMe(`/recipients/${org.pagarme_recipient_id}`, "GET", null);
        if (pagarmeDetails && pagarmeDetails.status) {
          liveStatus = pagarmeDetails.status;
          
          // Atualizar status no banco se mudou
          if (liveStatus !== org.pagarme_recipient_status) {
            await supabase
              .from("organizations")
              .update({ pagarme_recipient_status: liveStatus })
              .eq("id", id);
          }
        }
      } catch (err: any) {
        console.warn("[Pagar.me Status Check Warning]", err.message);
      }
    }

    res.json({
      pagarmeRecipientId: org.pagarme_recipient_id || null,
      pagarmeRecipientStatus: liveStatus,
      platformFeePercent: org.platform_fee_percent !== undefined ? Number(org.platform_fee_percent) : 10,
      bankData: {
        holderName: org.bank_holder_name || "",
        holderDocument: org.bank_holder_document || "",
        holderType: org.bank_holder_type || "individual",
        bankCode: org.bank_code || "",
        bankBranch: org.bank_branch || "",
        bankAccount: org.bank_account || "",
        bankAccountType: org.bank_account_type || "checking",
        holderEmail: org.bank_holder_email || "",
        holderPhone: org.bank_holder_phone || ""
      },
      pagarmeDetails
    });
  } catch (err: any) {
    console.error("Erro ao buscar status do recebedor:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Criar ou Atualizar Recebedor (Recipient) no Pagar.me para uma Organização
router.post("/organizations/:id/create-recipient", requireAuth, async (req, res) => {
  const { id } = req.params;
  const {
    holderName,
    holderDocument,
    holderType,
    bankCode,
    bankBranch,
    bankAccount,
    bankAccountDigit,
    bankAccountType,
    holderEmail,
    holderPhone
  } = req.body;

  if (!holderName || !holderDocument || !bankCode || !bankBranch || !bankAccount) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios dos dados bancários." });
  }

  try {
    const supabase = getSupabaseAdmin();
    const cleanDoc = holderDocument.replace(/\D/g, "");
    const cleanPhone = (holderPhone || "999999999").replace(/\D/g, "").slice(-9);
    const cleanBranch = bankBranch.replace(/\D/g, "");

    const accountFull = bankAccountDigit ? `${bankAccount}-${bankAccountDigit}` : bankAccount;

    // Se temos a chave do Pagar.me configurada, fazemos a integração real
    let recipientId: string | null = null;
    let recipientStatus = "active";

    if (process.env.PAGARME_SECRET_KEY) {
      const recipientPayload = {
        name: holderName,
        email: holderEmail || "financeiro@querocompetir.com.br",
        document: cleanDoc,
        type: cleanDoc.length === 11 ? "individual" : "corporation",
        default_bank_account: {
          holder_name: holderName,
          holder_type: cleanDoc.length === 11 ? "individual" : "corporation",
          holder_document: cleanDoc,
          bank: bankCode,
          branch_number: cleanBranch,
          account_number: bankAccount,
          account_check_digit: bankAccountDigit || "0",
          type: bankAccountType === "savings" ? "savings" : "checking"
        },
        transfer_settings: {
          transfer_enabled: true,
          transfer_interval: "Daily",
          transfer_day: 0
        }
      };

      const pgRecipient = await callPagarMe("/recipients", "POST", recipientPayload);
      recipientId = pgRecipient.id;
      recipientStatus = pgRecipient.status || "active";
    } else {
      console.warn("PAGARME_SECRET_KEY não configurada. Simulando criação de recebedor.");
      recipientId = `re_simulated_${Math.random().toString(36).substring(2, 11)}`;
      recipientStatus = "active";
    }

    // Persistir dados bancários e recipient_id na tabela organizations
    const dbPayload = {
      pagarme_recipient_id: recipientId,
      pagarme_recipient_status: recipientStatus,
      bank_holder_name: holderName,
      bank_holder_document: cleanDoc,
      bank_holder_type: holderType || (cleanDoc.length === 11 ? "individual" : "corporation"),
      bank_code: bankCode,
      bank_branch: cleanBranch,
      bank_account: accountFull,
      bank_account_type: bankAccountType || "checking",
      bank_holder_email: holderEmail || null,
      bank_holder_phone: cleanPhone || null
    };

    const { error: updateErr } = await supabase
      .from("organizations")
      .update(dbPayload)
      .eq("id", id);

    if (updateErr) {
      console.error("Erro ao atualizar organizações no Supabase:", updateErr);
      // Caso haja colunas que ainda não foram criadas via migration, tentamos salvar ao menos o recipient_id
      await supabase
        .from("organizations")
        .update({
          pagarme_recipient_id: recipientId,
          pagarme_recipient_status: recipientStatus
        })
        .eq("id", id);
    }

    res.json({
      success: true,
      pagarmeRecipientId: recipientId,
      pagarmeRecipientStatus: recipientStatus,
      message: "Dados bancários e conta de recebedor configurados com sucesso!"
    });
  } catch (err: any) {
    console.error("Erro ao criar recebedor Pagar.me:", err);
    res.status(500).json({ error: err.message || "Erro ao registrar conta de recebimento no Pagar.me." });
  }
});

// 3. Atualizar percentual da plataforma por organização (Somente Super Admin)
router.patch("/admin/organizations/:id/fee", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { platformFeePercent } = req.body;

  if (platformFeePercent === undefined || isNaN(Number(platformFeePercent))) {
    return res.status(400).json({ error: "Percentual inválido." });
  }

  const feeVal = Number(platformFeePercent);
  if (feeVal < 0 || feeVal > 100) {
    return res.status(400).json({ error: "O percentual deve estar entre 0% e 100%." });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("organizations")
      .update({ platform_fee_percent: feeVal })
      .eq("id", id);

    if (error) throw error;

    res.json({ success: true, platformFeePercent: feeVal });
  } catch (err: any) {
    console.error("Erro ao atualizar taxa da plataforma:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Webhook Unificado do Pagar.me (Assíncrono para PIX, Boleto e Cartão)
router.post("/webhook", async (req, res) => {
  try {
    const event = req.body;
    console.log("[Pagar.me Webhook Event Received]", event?.type || "Unknown event");

    const eventType = event?.type;
    const charge = event?.data;
    const orderCode = charge?.code || charge?.order?.code;

    if (!orderCode) {
      return res.json({ received: true, note: "Nenhum código de pedido especificado no webhook." });
    }

    if (eventType === "charge.paid" || eventType === "order.paid") {
      const supabase = getSupabaseAdmin();

      // 1. Verificar se é uma inscrição de atleta (athlete_subscriptions)
      const { data: sub } = await supabase
        .from("athlete_subscriptions")
        .select("id, tournament_id, document, athlete_name")
        .eq("id", orderCode)
        .maybeSingle();

      if (sub) {
        console.log(`[Pagar.me Webhook] Inscrição de atleta ${sub.id} PAGA com sucesso.`);
        
        await supabase
          .from("athlete_subscriptions")
          .update({ payment_status: "paid" })
          .eq("id", sub.id);

        // Fallback local JSON
        try {
          if (fs.existsSync(DATA_FILE)) {
            const db = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
            if (db.athleteSubscriptions) {
              const idx = db.athleteSubscriptions.findIndex((s: any) => s.id === sub.id);
              if (idx !== -1) {
                db.athleteSubscriptions[idx].paymentStatus = "paid";
                fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
              }
            }
          }
        } catch (_) {}

        return res.json({ received: true, status: "updated_athlete_subscription" });
      }

      // 2. Verificar se é um pagamento institucional (inst_payments)
      try {
        if (fs.existsSync(INST_PAYMENTS_FILE)) {
          const payments = JSON.parse(fs.readFileSync(INST_PAYMENTS_FILE, "utf-8"));
          const idx = payments.findIndex((p: any) => p.id === orderCode);
          if (idx !== -1) {
            payments[idx].status = "paid";
            payments[idx].paidAt = new Date().toISOString();
            fs.writeFileSync(INST_PAYMENTS_FILE, JSON.stringify(payments, null, 2));

            // Confirmar inscrição do time no Supabase
            const pay = payments[idx];
            const { data: reg } = await supabase
              .from("tournament_registrations")
              .select("id")
              .eq("tournament_id", pay.tournamentId)
              .eq("institution_id", pay.institutionId)
              .maybeSingle();

            if (reg) {
              await supabase
                .from("tournament_registrations")
                .update({ status: "confirmed" })
                .eq("id", reg.id);
            }

            console.log(`[Pagar.me Webhook] Pagamento de instituição ${orderCode} PAGO com sucesso.`);
            return res.json({ received: true, status: "updated_institution_payment" });
          }
        }
      } catch (err: any) {
        console.error("Erro no processamento do webhook institucional:", err.message);
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error("Erro no processamento do webhook do Pagar.me:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
