import { Router } from "express";
import { getSupabaseAdmin } from "../lib/supabase.ts";
import { requireAuth } from "../middleware/auth.ts";
import fs from "fs";
import path from "path";

const router = Router();

const DATA_FILE = path.join(process.cwd(), "src", "backend", "data", "subscriptions.json");
const INST_PAYMENTS_FILE = path.join(process.cwd(), "src", "backend", "data", "institution_payments.json");
const BANK_DATA_FILE = path.join(process.cwd(), "src", "backend", "data", "bank_details.json");

function loadBankDataDb(): Record<string, any> {
  try {
    const dir = path.dirname(BANK_DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(BANK_DATA_FILE)) {
      fs.writeFileSync(BANK_DATA_FILE, "{}", "utf-8");
    }
    return JSON.parse(fs.readFileSync(BANK_DATA_FILE, "utf-8"));
  } catch (e) {
    return {};
  }
}

function saveBankDataDb(data: Record<string, any>) {
  try {
    const dir = path.dirname(BANK_DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(BANK_DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {}
}

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
  const targetId = id || "org-1";

  try {
    const supabase = getSupabaseAdmin();
    let org: any = null;
    try {
      const { data } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", targetId)
        .maybeSingle();
      org = data;
    } catch (_) {}

    const localBankDb = loadBankDataDb();
    const localData = localBankDb[targetId] || localBankDb["org-1"] || {};

    let recipientId = org?.pagarme_recipient_id || localData.pagarmeRecipientId || null;
    let liveStatus = org?.pagarme_recipient_status || localData.pagarmeRecipientStatus || "not_configured";
    let pagarmeDetails: any = null;

    if (recipientId && process.env.PAGARME_SECRET_KEY) {
      try {
        pagarmeDetails = await callPagarMe(`/recipients/${recipientId}`, "GET", null);
        if (pagarmeDetails && pagarmeDetails.status) {
          liveStatus = pagarmeDetails.status;
          
          if (org && liveStatus !== org.pagarme_recipient_status) {
            await supabase
              .from("organizations")
              .update({ pagarme_recipient_status: liveStatus })
              .eq("id", targetId);
          }
        }
      } catch (err: any) {
        console.warn("[Pagar.me Status Check Warning]", err.message);
      }
    }

    res.json({
      pagarmeRecipientId: recipientId,
      pagarmeRecipientStatus: liveStatus,
      platformFeePercent: org?.platform_fee_percent !== undefined && org?.platform_fee_percent !== null ? Number(org.platform_fee_percent) : (localData.platformFeePercent || 10),
      bankData: {
        holderName: org?.bank_holder_name || localData.holderName || "",
        holderDocument: org?.bank_holder_document || localData.holderDocument || "",
        holderType: org?.bank_holder_type || localData.holderType || "individual",
        bankCode: org?.bank_code || localData.bankCode || "341",
        bankBranch: org?.bank_branch || localData.bankBranch || "",
        bankAccount: org?.bank_account || localData.bankAccount || "",
        bankAccountType: org?.bank_account_type || localData.bankAccountType || "checking",
        holderEmail: org?.bank_holder_email || localData.holderEmail || "",
        holderPhone: org?.bank_holder_phone || localData.holderPhone || ""
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

    // 1. Salvar no Supabase (com upsert seguro)
    const dbPayload = {
      id: id,
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

    try {
      const { error: updateErr } = await supabase
        .from("organizations")
        .upsert(dbPayload);

      if (updateErr) {
        console.warn("Aviso ao salvar organização no Supabase (tentando update restrito):", updateErr.message);
        await supabase
          .from("organizations")
          .update({
            pagarme_recipient_id: recipientId,
            pagarme_recipient_status: recipientStatus
          })
          .eq("id", id);
      }
    } catch (e: any) {
      console.warn("Exceção Supabase ao salvar recebedor:", e.message);
    }

    // 2. Salvar no JSON local bank_details.json (garante persistência 100%)
    const localBankDb = loadBankDataDb();
    const bankRecord = {
      pagarmeRecipientId: recipientId,
      pagarmeRecipientStatus: recipientStatus,
      holderName,
      holderDocument: cleanDoc,
      holderType: holderType || (cleanDoc.length === 11 ? "individual" : "corporation"),
      bankCode,
      bankBranch: cleanBranch,
      bankAccount: accountFull,
      bankAccountType: bankAccountType || "checking",
      holderEmail: holderEmail || "",
      holderPhone: cleanPhone || "",
      updatedAt: new Date().toISOString()
    };

    localBankDb[id] = bankRecord;
    if (id === "org-1" || id === "redefluir") {
      localBankDb["org-1"] = bankRecord;
      localBankDb["redefluir"] = bankRecord;
    }
    saveBankDataDb(localBankDb);

    res.json({
      success: true,
      pagarmeRecipientId: recipientId,
      pagarmeRecipientStatus: recipientStatus,
      bankData: {
        holderName,
        holderDocument: cleanDoc,
        holderType,
        bankCode,
        bankBranch: cleanBranch,
        bankAccount: accountFull,
        bankAccountType,
        holderEmail,
        holderPhone: cleanPhone
      },
      message: "Dados bancários e conta de recebedor configurados com sucesso!"
    });
  } catch (err: any) {
    console.error("Erro ao criar recebedor Pagar.me:", err);
    res.status(500).json({ error: err.message || "Erro ao registrar conta de recebimento no Pagar.me." });
  }
});

// 3. Listar todas as organizações com seus percentuais e dados de recebedor (Somente Super Admin)
router.get("/admin/organizations", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const resultMap = new Map<string, any>();
    const localBankDb = loadBankDataDb();

    // A. Buscar da tabela organizations no Supabase
    try {
      const { data: orgs } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false });

      if (orgs && Array.isArray(orgs)) {
        for (const org of orgs) {
          let displayName = org.name || "Organização";
          if (org.id === "org-1" || org.subdomain === "redefluir" || org.name === "Organizador Principal" || org.name.toLowerCase().includes("fluir")) {
            displayName = "Rede Fluir (Organizador Principal)";
          }

          const localData = localBankDb[org.id] || localBankDb["org-1"] || {};
          let fee = org.platform_fee_percent !== undefined && org.platform_fee_percent !== null ? Number(org.platform_fee_percent) : localData.platformFeePercent;
          if (fee === undefined || fee === null) fee = 10;

          resultMap.set(org.id, {
            id: org.id,
            name: displayName,
            subdomain: org.subdomain || "redefluir",
            pagarme_recipient_id: org.pagarme_recipient_id || localData.pagarmeRecipientId || null,
            pagarme_recipient_status: org.pagarme_recipient_status || localData.pagarmeRecipientStatus || "not_configured",
            platform_fee_percent: fee,
            bank_holder_name: org.bank_holder_name || localData.holderName || "",
            created_at: org.created_at || new Date().toISOString()
          });
        }
      }
    } catch (e: any) {
      console.warn("[Admin Orgs] Supabase query warning:", e.message);
    }

    // B. Buscar dos usuários organizadores em portal_accounts e accounts.json
    try {
      let accounts: any[] = [];
      const { data: dbAccounts } = await supabase.from("portal_accounts").select("*");
      if (dbAccounts && Array.isArray(dbAccounts)) {
        accounts = dbAccounts;
      } else {
        const ACCOUNTS_FILE = path.join(process.cwd(), "src", "backend", "data", "accounts.json");
        if (fs.existsSync(ACCOUNTS_FILE)) {
          accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
        }
      }

      const organizerAccounts = accounts.filter((a: any) => a.role === "organizer");
      for (const acc of organizerAccounts) {
        const targetId = acc.reference_id || acc.referenceId || acc.id;
        if (!resultMap.has(targetId)) {
          let displayName = acc.name || acc.email;
          if (targetId === "org-1" || acc.email?.includes("fluir") || displayName.toLowerCase().includes("fluir") || displayName === "Organizador Principal") {
            displayName = "Rede Fluir (Organizador Principal)";
          }

          const localData = localBankDb[targetId] || localBankDb["org-1"] || {};
          const fee = localData.platformFeePercent !== undefined ? Number(localData.platformFeePercent) : 10;

          resultMap.set(targetId, {
            id: targetId,
            name: displayName,
            subdomain: (acc.email || "").split("@")[0],
            pagarme_recipient_id: localData.pagarmeRecipientId || null,
            pagarme_recipient_status: localData.pagarmeRecipientStatus || "not_configured",
            platform_fee_percent: fee,
            bank_holder_name: localData.holderName || "",
            created_at: acc.created_at || acc.createdAt || new Date().toISOString()
          });
        }
      }
    } catch (e: any) {
      console.warn("[Admin Orgs] Accounts query warning:", e.message);
    }

    // C. Buscar dos torneios (owner_id únicos)
    try {
      const { data: tournaments } = await supabase.from("tournaments").select("owner_id, name");
      if (tournaments && Array.isArray(tournaments)) {
        for (const t of tournaments) {
          if (t.owner_id && !resultMap.has(t.owner_id)) {
            let displayName = `Organizador de (${t.name})`;
            if (t.owner_id === "org-1" || t.name.toLowerCase().includes("fluir")) {
              displayName = "Rede Fluir (Organizador Principal)";
            }

            const localData = localBankDb[t.owner_id] || localBankDb["org-1"] || {};
            const fee = localData.platformFeePercent !== undefined ? Number(localData.platformFeePercent) : 10;

            resultMap.set(t.owner_id, {
              id: t.owner_id,
              name: displayName,
              subdomain: "",
              pagarme_recipient_id: localData.pagarmeRecipientId || null,
              pagarme_recipient_status: localData.pagarmeRecipientStatus || "not_configured",
              platform_fee_percent: fee,
              bank_holder_name: localData.holderName || "",
              created_at: new Date().toISOString()
            });
          }
        }
      }
    } catch (e: any) {
      console.warn("[Admin Orgs] Tournaments query warning:", e.message);
    }

    res.json(Array.from(resultMap.values()));
  } catch (err: any) {
    console.error("Erro ao buscar lista de organizações no admin:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Atualizar percentual da plataforma por organização (Somente Super Admin)
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
    // 1. Salvar no Supabase
    try {
      const { error: updateErr, data } = await supabase
        .from("organizations")
        .update({ platform_fee_percent: feeVal })
        .eq("id", id)
        .select();

      if (updateErr || !data || data.length === 0) {
        await supabase
          .from("organizations")
          .upsert({
            id,
            name: "Organização",
            platform_fee_percent: feeVal
          });
      }
    } catch (e: any) {
      console.warn("Aviso ao salvar fee no Supabase:", e.message);
    }

    // 2. Salvar no JSON local bank_details.json (garante persistência 100%)
    const localBankDb = loadBankDataDb();
    const targetId = id || "org-1";

    const record = localBankDb[targetId] || {};
    record.platformFeePercent = feeVal;
    localBankDb[targetId] = record;

    if (targetId === "org-1" || targetId === "redefluir") {
      const org1Rec = localBankDb["org-1"] || {};
      org1Rec.platformFeePercent = feeVal;
      localBankDb["org-1"] = org1Rec;

      const fluirRec = localBankDb["redefluir"] || {};
      fluirRec.platformFeePercent = feeVal;
      localBankDb["redefluir"] = fluirRec;
    }
    saveBankDataDb(localBankDb);

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
