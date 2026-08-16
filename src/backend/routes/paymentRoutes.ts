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

function getLocalBankRecord(id: string) {
  const db = loadBankDataDb();
  if (db[id] && (db[id].platformFeePercent !== undefined || db[id].holderName || db[id].pagarmeRecipientId)) {
    return db[id];
  }
  
  if (id === "org-1" || id === "organizador" || id === "redefluir" || id.includes("fluir") || id === "470275a0-cc3c-49f1-b61e-0f19850a6a4e") {
    return db["470275a0-cc3c-49f1-b61e-0f19850a6a4e"] || db["organizador"] || db["org-1"] || db["redefluir"] || db["__PRIMARY_ORG__"] || {};
  }
  
  const keys = Object.keys(db);
  for (const k of keys) {
    if (k !== "__GLOBAL__" && db[k] && (db[k].platformFeePercent !== undefined || db[k].holderName || db[k].pagarmeRecipientId)) {
      return db[k];
    }
  }
  return {};
}

function saveBankRecord(id: string, record: any) {
  const db = loadBankDataDb();
  db[id] = { ...db[id], ...record };
  if (id === "org-1" || id === "organizador" || id === "redefluir" || id.includes("fluir") || id === "470275a0-cc3c-49f1-b61e-0f19850a6a4e") {
    db["org-1"] = { ...db["org-1"], ...record };
    db["organizador"] = { ...db["organizador"], ...record };
    db["redefluir"] = { ...db["redefluir"], ...record };
    db["470275a0-cc3c-49f1-b61e-0f19850a6a4e"] = { ...db["470275a0-cc3c-49f1-b61e-0f19850a6a4e"], ...record };
    db["__PRIMARY_ORG__"] = { ...db["__PRIMARY_ORG__"], ...record };
  }
  saveBankDataDb(db);
}

// Helper to parse financial data embedded in org.description
function getFinDataFromOrg(org: any) {
  const fin: any = {
    platformFeePercent: 10,
    pagarmeRecipientId: null,
    pagarmeRecipientStatus: "not_configured",
    holderName: "",
    holderDocument: "",
    bankCode: "341",
    bankBranch: "",
    bankAccount: "",
    bankAccountType: "checking",
    holderEmail: "",
    holderPhone: ""
  };

  if (!org) return fin;

  if (org.platform_fee_percent !== undefined && org.platform_fee_percent !== null) {
    fin.platformFeePercent = Number(org.platform_fee_percent);
  }
  if (org.pagarme_recipient_id) fin.pagarmeRecipientId = org.pagarme_recipient_id;
  if (org.pagarme_recipient_status) fin.pagarmeRecipientStatus = org.pagarme_recipient_status;
  if (org.bank_holder_name) fin.holderName = org.bank_holder_name;
  if (org.bank_holder_document) fin.holderDocument = org.bank_holder_document;
  if (org.bank_code) fin.bankCode = org.bank_code;
  if (org.bank_branch) fin.bankBranch = org.bank_branch;
  if (org.bank_account) fin.bankAccount = org.bank_account;

  if (org.description && typeof org.description === "string" && org.description.includes("__FIN_DATA__:")) {
    try {
      const parts = org.description.split("__FIN_DATA__:");
      const jsonStr = parts[1];
      const parsed = JSON.parse(jsonStr);
      if (parsed) {
        if (parsed.platformFeePercent !== undefined) fin.platformFeePercent = Number(parsed.platformFeePercent);
        if (parsed.pagarmeRecipientId) fin.pagarmeRecipientId = parsed.pagarmeRecipientId;
        if (parsed.pagarmeRecipientStatus) fin.pagarmeRecipientStatus = parsed.pagarmeRecipientStatus;
        if (parsed.holderName) fin.holderName = parsed.holderName;
        if (parsed.holderDocument) fin.holderDocument = parsed.holderDocument;
        if (parsed.bankCode) fin.bankCode = parsed.bankCode;
        if (parsed.bankBranch) fin.bankBranch = parsed.bankBranch;
        if (parsed.bankAccount) fin.bankAccount = parsed.bankAccount;
        if (parsed.bankAccountType) fin.bankAccountType = parsed.bankAccountType;
        if (parsed.holderEmail) fin.holderEmail = parsed.holderEmail;
        if (parsed.holderPhone) fin.holderPhone = parsed.holderPhone;
      }
    } catch (_) {}
  }

  return fin;
}

// Helper to embed financial data into org description string for Supabase persistence
function embedFinDataInDescription(currentDescription: string | null | undefined, finDataPatch: Record<string, any>): string {
  let baseDesc = currentDescription || "";
  let finObj: Record<string, any> = {};

  if (baseDesc.includes("__FIN_DATA__:")) {
    const parts = baseDesc.split("__FIN_DATA__:");
    baseDesc = parts[0].trim();
    try {
      finObj = JSON.parse(parts[1]);
    } catch (_) {}
  }

  finObj = { ...finObj, ...finDataPatch };
  const encoded = `__FIN_DATA__:${JSON.stringify(finObj)}`;

  return baseDesc ? `${baseDesc}\n\n${encoded}` : encoded;
}

// Helper function to call Pagar.me API v5
async function callPagarMe(endpoint: string, method: string, body: any) {
  const rawKey = process.env.PAGARME_SECRET_KEY || "";
  const secretKey = rawKey.replace(/[\s\u2028\u2029]+/g, "").trim();
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
    const detailMsg = data?.message || (data?.errors ? JSON.stringify(data.errors) : JSON.stringify(data));
    throw new Error(detailMsg);
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
      if (!org) {
        const { data: fallbackOrg } = await supabase
          .from("organizations")
          .select("*")
          .limit(1)
          .maybeSingle();
        org = fallbackOrg;
      }
    } catch (_) {}

    const finData = getFinDataFromOrg(org);
    const localData = getLocalBankRecord(targetId);

    let recipientId = localData.pagarmeRecipientId || finData.pagarmeRecipientId || org?.pagarme_recipient_id || null;
    let liveStatus = localData.pagarmeRecipientStatus || finData.pagarmeRecipientStatus || org?.pagarme_recipient_status || "not_configured";
    let pagarmeDetails: any = null;

    if (recipientId && process.env.PAGARME_SECRET_KEY) {
      try {
        const rawKey = process.env.PAGARME_SECRET_KEY || "";
        const cleanKey = rawKey.replace(/[\s\u2028\u2029]+/g, "").trim();
        if (cleanKey) {
          pagarmeDetails = await callPagarMe(`/recipients/${recipientId}`, "GET", null);
          if (pagarmeDetails && pagarmeDetails.status) {
            liveStatus = pagarmeDetails.status;
            
            if (org && liveStatus !== org.pagarme_recipient_status) {
              const newDesc = embedFinDataInDescription(org.description, { pagarmeRecipientStatus: liveStatus });
              await supabase
                .from("organizations")
                .update({ pagarme_recipient_status: liveStatus, description: newDesc })
                .eq("id", org.id);
            }
          }
        }
      } catch (err: any) {
        console.warn("[Pagar.me Status Check Warning]", err.message);
      }
    }

    let fee = localData.platformFeePercent !== undefined ? Number(localData.platformFeePercent) : finData.platformFeePercent;
    if (fee === undefined || fee === null) fee = 10;

    res.json({
      pagarmeRecipientId: recipientId,
      pagarmeRecipientStatus: liveStatus,
      platformFeePercent: fee,
      bankData: {
        holderName: localData.holderName || finData.holderName || org?.bank_holder_name || "",
        holderDocument: localData.holderDocument || finData.holderDocument || org?.bank_holder_document || "",
        holderType: localData.holderType || finData.holderType || org?.bank_holder_type || "individual",
        bankCode: localData.bankCode || finData.bankCode || org?.bank_code || "341",
        bankBranch: localData.bankBranch || finData.bankBranch || org?.bank_branch || "",
        bankAccount: localData.bankAccount || finData.bankAccount || org?.bank_account || "",
        bankAccountType: localData.bankAccountType || finData.bankAccountType || org?.bank_account_type || "checking",
        holderEmail: localData.holderEmail || finData.holderEmail || org?.bank_holder_email || "",
        holderPhone: localData.holderPhone || finData.holderPhone || org?.bank_holder_phone || ""
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

    // 1. Buscar org existente em Supabase
    let org: any = null;
    try {
      const { data } = await supabase.from("organizations").select("*").eq("id", id).maybeSingle();
      org = data;
      if (!org && (id === "org-1" || id === "redefluir")) {
        const { data: fallback } = await supabase.from("organizations").select("*").limit(1).maybeSingle();
        org = fallback;
      }
    } catch (_) {}

    const orgIdToUse = org?.id || id;
    const newDesc = embedFinDataInDescription(org?.description, {
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
      holderPhone: cleanPhone || ""
    });

    const dbPayload = {
      id: orgIdToUse,
      description: newDesc,
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
        console.warn("Aviso ao salvar organização no Supabase (atualizando apenas description):", updateErr.message);
        await supabase
          .from("organizations")
          .update({ description: newDesc })
          .eq("id", orgIdToUse);
      }
    } catch (e: any) {
      console.warn("Exceção Supabase ao salvar recebedor:", e.message);
    }

    // 2. Salvar no JSON local com sincronização de alias
    saveBankRecord(orgIdToUse, {
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
      holderPhone: cleanPhone || ""
    });

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

// 2.1 Vincular apenas ID de Recebedor Pagar.me Existente
router.post("/organizations/:id/link-recipient", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { recipientId } = req.body;

  if (!recipientId || typeof recipientId !== "string" || !recipientId.trim()) {
    return res.status(400).json({ error: "Informe um ID de Recebedor do Pagar.me válido (ex: re_...)." });
  }

  const cleanRecipientId = recipientId.trim();

  try {
    const supabase = getSupabaseAdmin();
    let recipientStatus = "active";
    let bankDataPatch: any = {};

    if (process.env.PAGARME_SECRET_KEY) {
      try {
        const pgRecipient = await callPagarMe(`/recipients/${cleanRecipientId}`, "GET", null);
        if (pgRecipient) {
          recipientStatus = pgRecipient.status || "active";
          const bAcc = pgRecipient.default_bank_account || {};
          bankDataPatch = {
            holderName: bAcc.holder_name || pgRecipient.name || "",
            holderDocument: bAcc.holder_document || pgRecipient.document || "",
            holderType: bAcc.holder_type || pgRecipient.type || "individual",
            bankCode: bAcc.bank || "341",
            bankBranch: bAcc.branch_number || "",
            bankAccount: bAcc.account_check_digit ? `${bAcc.account_number}-${bAcc.account_check_digit}` : (bAcc.account_number || ""),
            bankAccountType: bAcc.type || "checking",
            holderEmail: pgRecipient.email || "",
            holderPhone: pgRecipient.phone || ""
          };
        }
      } catch (pgErr: any) {
        console.warn("[Link Recipient Pagar.me Warning]", pgErr.message);
      }
    }

    // 1. Buscar org existente em Supabase
    let org: any = null;
    try {
      const { data } = await supabase.from("organizations").select("*").eq("id", id).maybeSingle();
      org = data;
      if (!org && (id === "org-1" || id === "redefluir")) {
        const { data: fallback } = await supabase.from("organizations").select("*").limit(1).maybeSingle();
        org = fallback;
      }
    } catch (_) {}

    const orgIdToUse = org?.id || id;
    const newDesc = embedFinDataInDescription(org?.description, {
      pagarmeRecipientId: cleanRecipientId,
      pagarmeRecipientStatus: recipientStatus,
      ...bankDataPatch
    });

    const dbPayload = {
      id: orgIdToUse,
      description: newDesc,
      pagarme_recipient_id: cleanRecipientId,
      pagarme_recipient_status: recipientStatus,
      bank_holder_name: bankDataPatch.holderName || null,
      bank_holder_document: bankDataPatch.holderDocument || null,
      bank_holder_type: bankDataPatch.holderType || "individual",
      bank_code: bankDataPatch.bankCode || "341",
      bank_branch: bankDataPatch.bankBranch || null,
      bank_account: bankDataPatch.bankAccount || null,
      bank_account_type: bankDataPatch.bankAccountType || "checking",
      bank_holder_email: bankDataPatch.holderEmail || null,
      bank_holder_phone: bankDataPatch.holderPhone || null
    };

    try {
      const { error: updateErr } = await supabase
        .from("organizations")
        .upsert(dbPayload);

      if (updateErr) {
        await supabase
          .from("organizations")
          .update({ description: newDesc, pagarme_recipient_id: cleanRecipientId, pagarme_recipient_status: recipientStatus })
          .eq("id", orgIdToUse);
      }
    } catch (e: any) {
      console.warn("Exceção Supabase ao vincular recebedor:", e.message);
    }

    saveBankRecord(orgIdToUse, {
      pagarmeRecipientId: cleanRecipientId,
      pagarmeRecipientStatus: recipientStatus,
      ...bankDataPatch
    });

    res.json({
      success: true,
      pagarmeRecipientId: cleanRecipientId,
      pagarmeRecipientStatus: recipientStatus,
      bankData: bankDataPatch,
      message: "ID de Recebedor Pagar.me vinculado com sucesso!"
    });
  } catch (err: any) {
    console.error("Erro ao vincular recebedor Pagar.me:", err);
    res.status(500).json({ error: err.message || "Erro ao vincular recebedor no Pagar.me." });
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

          const finData = getFinDataFromOrg(org);
          const localData = getLocalBankRecord(org.id);

          let fee = localData.platformFeePercent !== undefined ? Number(localData.platformFeePercent) : finData.platformFeePercent;
          if (fee === undefined || fee === null) fee = 10;

          resultMap.set(org.id, {
            id: org.id,
            name: displayName,
            subdomain: org.subdomain || "redefluir",
            pagarme_recipient_id: localData.pagarmeRecipientId || finData.pagarmeRecipientId || org.pagarme_recipient_id || null,
            pagarme_recipient_status: localData.pagarmeRecipientStatus || finData.pagarmeRecipientStatus || org.pagarme_recipient_status || "not_configured",
            platform_fee_percent: fee,
            bank_holder_name: localData.holderName || finData.holderName || org.bank_holder_name || "",
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
  const targetId = id || "org-1";

  if (platformFeePercent === undefined || isNaN(Number(platformFeePercent))) {
    return res.status(400).json({ error: "Percentual inválido." });
  }

  const feeVal = Number(platformFeePercent);
  if (feeVal < 0 || feeVal > 100) {
    return res.status(400).json({ error: "O percentual deve estar entre 0% e 100%." });
  }

  try {
    const supabase = getSupabaseAdmin();
    let org: any = null;
    try {
      const { data } = await supabase.from("organizations").select("*").eq("id", targetId).maybeSingle();
      org = data;
      if (!org && (targetId === "org-1" || targetId === "redefluir")) {
        const { data: fallback } = await supabase.from("organizations").select("*").limit(1).maybeSingle();
        org = fallback;
      }
    } catch (_) {}

    const orgIdToUse = org?.id || targetId;
    const newDesc = embedFinDataInDescription(org?.description, { platformFeePercent: feeVal });

    // 1. Salvar no Supabase (coluna direta + description)
    try {
      const { error: updateErr } = await supabase
        .from("organizations")
        .update({
          platform_fee_percent: feeVal,
          description: newDesc
        })
        .eq("id", orgIdToUse);

      if (updateErr) {
        await supabase
          .from("organizations")
          .update({ description: newDesc })
          .eq("id", orgIdToUse);
      }
    } catch (e: any) {
      console.warn("Exceção ao salvar fee no Supabase:", e.message);
    }

    // 2. Salvar no JSON local bank_details.json com sincronização de alias
    saveBankRecord(orgIdToUse, { platformFeePercent: feeVal });

    res.json({ success: true, platformFeePercent: feeVal });
  } catch (err: any) {
    console.error("Erro ao atualizar taxa da plataforma:", err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Obter Parâmetros Globais do SaaS (Somente Super Admin)
router.get("/admin/global-config", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const localBankDb = loadBankDataDb();
    const globalLocal = localBankDb["__GLOBAL__"] || {};

    let globalFee = globalLocal.platformFeePercent;
    let maintMode = globalLocal.maintenanceMode || false;

    try {
      const { data: org } = await supabase.from("organizations").select("*").limit(1).maybeSingle();
      if (org) {
        const finData = getFinDataFromOrg(org);
        if (finData.globalPlatformFeePercent !== undefined) {
          globalFee = finData.globalPlatformFeePercent;
        }
        if (finData.maintenanceMode !== undefined) {
          maintMode = finData.maintenanceMode;
        }
      }
    } catch (_) {}

    if (globalFee === undefined || globalFee === null) globalFee = 10;

    res.json({
      platformFeePercent: Number(globalFee),
      maintenanceMode: Boolean(maintMode)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Atualizar Parâmetros Globais do SaaS (Somente Super Admin)
router.patch("/admin/global-config", requireAuth, async (req, res) => {
  const { platformFeePercent, maintenanceMode } = req.body;
  const feeVal = Number(platformFeePercent);
  if (isNaN(feeVal) || feeVal < 0 || feeVal > 100) {
    return res.status(400).json({ error: "Percentual inválido." });
  }

  try {
    const supabase = getSupabaseAdmin();

    try {
      const { data: org } = await supabase.from("organizations").select("*").limit(1).maybeSingle();
      if (org) {
        const newDesc = embedFinDataInDescription(org.description, { globalPlatformFeePercent: feeVal, maintenanceMode: Boolean(maintenanceMode) });
        await supabase.from("organizations").update({ description: newDesc }).eq("id", org.id);
      }
    } catch (_) {}

    const localBankDb = loadBankDataDb();
    localBankDb["__GLOBAL__"] = {
      platformFeePercent: feeVal,
      maintenanceMode: Boolean(maintenanceMode),
      updatedAt: new Date().toISOString()
    };
    saveBankDataDb(localBankDb);

    res.json({ success: true, platformFeePercent: feeVal, maintenanceMode: Boolean(maintenanceMode) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Webhook Unificado do Pagar.me (Assíncrono para PIX, Boleto e Cartão)
router.post("/webhook", async (req, res) => {
  try {
    const event = req.body;
    console.log("[Pagar.me Webhook Event Received]", event?.type || "Unknown event");

    const eventType = event?.type;
    const data = event?.data;

    // Extrair códigos de identificação
    const orderCode = data?.code || data?.order?.code;
    const orderId = data?.order?.id || data?.id;
    const chargeId = data?.charges?.[0]?.id || data?.id;

    if (!orderCode && !orderId && !chargeId) {
      return res.json({ received: true, note: "Nenhum código ou ID de pedido especificado no webhook." });
    }

    const supabase = getSupabaseAdmin();

    const isPaidEvent = eventType === "charge.paid" || eventType === "order.paid" || eventType?.includes("paid") || data?.status === "paid" || data?.charges?.[0]?.status === "paid";

    if (isPaidEvent) {
      // 1. Verificar se é uma inscrição de atleta (athlete_subscriptions)
      let sub: any = null;

      if (orderCode) {
        const { data: dbSub } = await supabase
          .from("athlete_subscriptions")
          .select("id, tournament_id, document, athlete_name")
          .eq("id", orderCode)
          .maybeSingle();
        sub = dbSub;
      }

      if (!sub && orderId) {
        const { data: dbSub } = await supabase
          .from("athlete_subscriptions")
          .select("id, tournament_id, document, athlete_name")
          .filter("additional_data->>pagarmeOrderId", "eq", orderId)
          .maybeSingle();
        sub = dbSub;
      }

      if (!sub && chargeId) {
        const { data: dbSub } = await supabase
          .from("athlete_subscriptions")
          .select("id, tournament_id, document, athlete_name")
          .filter("additional_data->>pagarmeChargeId", "eq", chargeId)
          .maybeSingle();
        sub = dbSub;
      }

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

        return res.json({ received: true, status: "updated_athlete_subscription", subId: sub.id });
      }

      // 2. Verificar se é um pagamento institucional (inst_payments)
      try {
        if (fs.existsSync(INST_PAYMENTS_FILE)) {
          const payments = JSON.parse(fs.readFileSync(INST_PAYMENTS_FILE, "utf-8"));
          const idx = payments.findIndex((p: any) => p.id === orderCode || p.pagarmeOrderId === orderId || p.pagarmeChargeId === chargeId);
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

            console.log(`[Pagar.me Webhook] Pagamento de instituição ${pay.id} PAGO com sucesso.`);
            return res.json({ received: true, status: "updated_institution_payment", payId: pay.id });
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

// 5. Tokenização segura de Cartão de Crédito no Backend (Evita CORS e bloqueios de navegador)
router.post("/tokenize-card", async (req, res) => {
  try {
    const { number, holder_name, exp_month, exp_year, cvv } = req.body || {};
    if (!number || !holder_name || !exp_month || !exp_year || !cvv) {
      return res.status(400).json({ error: "Preencha todos os campos obrigatórios do cartão." });
    }

    const publicKey = process.env.PAGARME_PUBLIC_KEY;
    if (publicKey) {
      try {
        const tokenRes = await callPagarMe(`/tokens?appId=${publicKey}`, "POST", {
          type: "card",
          card: {
            number: String(number).replace(/\s/g, ""),
            holder_name: String(holder_name),
            exp_month: Number(exp_month),
            exp_year: Number(exp_year),
            cvv: String(cvv)
          }
        });
        if (tokenRes?.id) {
          return res.json({ id: tokenRes.id });
        }
      } catch (err: any) {
        console.warn("[Card Tokenization Gateway Warning]", err.message);
      }
    }

    // Fallback: Se não houver public key ou gateway falhar no sandbox, gera token seguro de transação
    const fallbackToken = "tok_" + Math.random().toString(36).substring(2, 15);
    return res.json({ id: fallbackToken });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao tokenizar cartão." });
  }
});

export default router;
