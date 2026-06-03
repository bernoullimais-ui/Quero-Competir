// src/backend/app.ts
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// src/backend/routes/institutionRoutes.ts
import { Router } from "express";

// src/backend/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
var supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("CRITICAL: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY n\xE3o configurados!");
      throw new Error("Missing Supabase credentials");
    }
    if (supabaseServiceKey.length < 50) {
      console.warn("AVISO: A chave service_role parece curta demais. Verifique nos Segredos.");
    }
    const cleanUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
    supabaseAdmin = createClient(cleanUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseAdmin;
}

// src/backend/routes/institutionRoutes.ts
import fs from "fs";
import path from "path";

// src/backend/middleware/auth.ts
import jwt from "jsonwebtoken";
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return secret;
}
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de autentica\xE7\xE3o n\xE3o fornecido." });
  }
  const token = authHeader.substring(7);
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Sess\xE3o expirada. Fa\xE7a login novamente." });
    }
    return res.status(401).json({ error: "Token inv\xE1lido ou corrompido." });
  }
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "N\xE3o autenticado." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Permiss\xE3o insuficiente para esta opera\xE7\xE3o." });
    }
    next();
  };
}
function generateToken(user) {
  const secret = getJwtSecret();
  return jwt.sign(user, secret, { expiresIn: "7d" });
}
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  const token = authHeader.substring(7);
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
  } catch (err) {
  }
  next();
}

// src/backend/routes/institutionRoutes.ts
var router = Router();
var ORG_INST_FILE = path.join(process.cwd(), "src", "backend", "data", "organizer_institutions.json");
var INVITATIONS_FILE = path.join(process.cwd(), "src", "backend", "data", "institution_invitations.json");
var ACCOUNTS_FILE = path.join(process.cwd(), "src", "backend", "data", "accounts.json");
function ensureFilesAndSeed() {
  const dir = path.dirname(ORG_INST_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(ORG_INST_FILE)) {
    const seed = {
      "acc_ttzf2b4if": [
        "905c7902-56f0-44e1-ab79-54029c7b0611"
        // Bernoulli+
      ],
      "org-1": [
        "35a45ad5-602d-4332-8a86-21268ed399ba",
        // Sport for Kids
        "69fd6aae-a179-4277-ac4c-516db38086c1",
        // FLUIR
        "52965e85-4fc0-48b7-8ef9-60c0bcbe50dc",
        // Pequeno Liceu
        "266cd154-0730-47d7-b96b-7577f98e4937",
        // Bunny
        "d7e59a23-96c3-4963-9d7f-0376897fea31",
        // Segunda Gaveta
        "8a90c3bb-0ccc-48ed-8d95-4ce719d9f5b1",
        // Escola Pan Americana
        "48efa856-f0c8-447f-a08d-91c7501cc905",
        // AKA
        "81f171a9-1894-41d2-a71a-1bb00e86f72a"
        // Dom Pedrinho
      ]
    };
    fs.writeFileSync(ORG_INST_FILE, JSON.stringify(seed, null, 2), "utf-8");
  }
  if (!fs.existsSync(INVITATIONS_FILE)) {
    fs.writeFileSync(INVITATIONS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}
ensureFilesAndSeed();
function loadOrgInstitutions() {
  ensureFilesAndSeed();
  try {
    return JSON.parse(fs.readFileSync(ORG_INST_FILE, "utf-8"));
  } catch (e) {
    return {};
  }
}
function saveOrgInstitutions(data) {
  ensureFilesAndSeed();
  try {
    fs.writeFileSync(ORG_INST_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
  }
}
function loadInvitations() {
  ensureFilesAndSeed();
  try {
    return JSON.parse(fs.readFileSync(INVITATIONS_FILE, "utf-8"));
  } catch (e) {
    return [];
  }
}
function saveInvitations(data) {
  ensureFilesAndSeed();
  try {
    fs.writeFileSync(INVITATIONS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
  }
}
function getUserRoleAndReferenceId(userId) {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) return { role: null, name: null, referenceId: null };
    const accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
    const user = accounts.find((a) => a.id === userId);
    if (user) {
      return {
        role: user.role || null,
        name: user.name || null,
        referenceId: user.referenceId || null
      };
    }
  } catch (e) {
    console.error(e);
  }
  return { role: null, name: null, referenceId: null };
}
router.post("/", requireAuth, async (req, res) => {
  const { name, document_number, email, responsible_name, responsible_phone, logo_url } = req.body;
  const organizerId = req.user.id;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("institutions").insert([
      {
        name,
        tax_id: document_number,
        email,
        responsible_name,
        responsible_phone,
        logo_url
      }
    ]).select().maybeSingle();
    if (error) {
      if (error.message.includes("tax_id")) {
        const { data: d2, error: e2 } = await supabase.from("institutions").insert([{ name, document_number, email, responsible_name, responsible_phone, logo_url }]).select().maybeSingle();
        if (!e2) {
          if (organizerId && d2 && d2.id) {
            const b = loadOrgInstitutions();
            if (!b[organizerId]) b[organizerId] = [];
            if (!b[organizerId].includes(d2.id)) b[organizerId].push(d2.id);
            saveOrgInstitutions(b);
          }
          return res.status(201).json(d2);
        }
        const { data: d3, error: e3 } = await supabase.from("institutions").insert([{ name, cnpj: document_number, email, responsible_name, responsible_phone, logo_url }]).select().maybeSingle();
        if (!e3) {
          if (organizerId && d3 && d3.id) {
            const b = loadOrgInstitutions();
            if (!b[organizerId]) b[organizerId] = [];
            if (!b[organizerId].includes(d3.id)) b[organizerId].push(d3.id);
            saveOrgInstitutions(b);
          }
          return res.status(201).json(d3);
        }
      }
      throw error;
    }
    if (organizerId && data && data.id) {
      const b = loadOrgInstitutions();
      if (!b[organizerId]) b[organizerId] = [];
      if (!b[organizerId].includes(data.id)) b[organizerId].push(data.id);
      saveOrgInstitutions(b);
    }
    res.status(201).json(data);
  } catch (error) {
    console.error("Erro Final Supabase:", error);
    res.status(500).json({
      error: error.message,
      hint: "Verifique se a coluna de documento no banco \xE9 'tax_id', 'document_number' ou 'cnpj'"
    });
  }
});
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const organizerId = req.user.id;
    if (organizerId) {
      const { role } = getUserRoleAndReferenceId(organizerId);
      if (role !== "super_admin" && role !== "institution") {
        const mapping = loadOrgInstitutions();
        const allowed = mapping[organizerId] || [];
        if (!allowed.includes(req.params.id)) {
          return res.status(403).json({ error: "Voc\xEA n\xE3o tem permiss\xE3o para acessar esta institui\xE7\xE3o." });
        }
      }
    }
    const { data, error } = await supabase.from("institutions").select("*").eq("id", req.params.id).single();
    if (error) {
      if (error.code === "PGRST116") return res.status(404).json({ error: "Institui\xE7\xE3o n\xE3o encontrada" });
      throw error;
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.put("/:id", requireAuth, async (req, res) => {
  const { name, document_number, email, responsible_name, responsible_phone, logo_url } = req.body;
  const organizerId = req.user.id;
  try {
    if (organizerId) {
      const { role } = getUserRoleAndReferenceId(organizerId);
      if (role !== "super_admin" && role !== "institution") {
        const mapping = loadOrgInstitutions();
        const allowed = mapping[organizerId] || [];
        if (!allowed.includes(req.params.id)) {
          return res.status(403).json({ error: "Voc\xEA n\xE3o tem permiss\xE3o para editar esta institui\xE7\xE3o." });
        }
      }
    }
    const supabase = getSupabaseAdmin();
    let updatePayload = { name, email, responsible_name, responsible_phone, logo_url };
    const { data, error } = await supabase.from("institutions").update({ ...updatePayload, tax_id: document_number }).eq("id", req.params.id).select().maybeSingle();
    if (error) {
      if (error.message.includes("tax_id")) {
        const { data: d2, error: e2 } = await supabase.from("institutions").update({ ...updatePayload, document_number }).eq("id", req.params.id).select().maybeSingle();
        if (!e2) return res.json(d2);
        const { data: d3, error: e3 } = await supabase.from("institutions").update({ ...updatePayload, cnpj: document_number }).eq("id", req.params.id).select().maybeSingle();
        if (!e3) return res.json(d3);
      }
      throw error;
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get("/", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const organizerId = req.user.id;
    const allPlatform = req.query.all_platform === "true";
    let isSuperAdmin = false;
    let allowedInstIds = [];
    if (organizerId) {
      const { role } = getUserRoleAndReferenceId(organizerId);
      isSuperAdmin = role === "super_admin";
      const mapping = loadOrgInstitutions();
      allowedInstIds = mapping[organizerId] || [];
    }
    let rawData = [];
    let fetchError = null;
    let { data, error } = await supabase.from("institutions").select("id, name, tax_id, logo_url, created_at").order("name");
    if (!error) {
      rawData = data?.map((i) => ({ ...i, document_number: i.tax_id })) || [];
    } else {
      let { data: d2, error: e2 } = await supabase.from("institutions").select("id, name, document_number, logo_url, created_at").order("name");
      if (!e2) {
        rawData = d2 || [];
      } else {
        let { data: d3, error: e3 } = await supabase.from("institutions").select("id, name, cnpj, logo_url, created_at").order("name");
        if (!e3) {
          rawData = d3?.map((i) => ({ ...i, document_number: i.cnpj })) || [];
        } else {
          fetchError = error || e2 || e3;
        }
      }
    }
    if (fetchError) throw fetchError;
    if (organizerId && !isSuperAdmin) {
      if (allPlatform) {
        const result = rawData.filter((inst) => allowedInstIds.includes(inst.id)).map((inst) => ({
          ...inst,
          is_managed: true
        }));
        return res.json(result);
      } else {
        const result = rawData.filter((inst) => allowedInstIds.includes(inst.id));
        return res.json(result);
      }
    }
    return res.json(rawData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get("/:id/athletes", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    let { data, error } = await supabase.from("members").select("*").eq("institution_id", req.params.id).order("full_name");
    if (!error && data && data.length > 0) {
      return res.json(data.map((m) => ({ ...m, name: m.full_name || m.name })));
    }
    const { data: d2, error: e2 } = await supabase.from("athletes").select("*").eq("institution_id", req.params.id).order("name");
    if (e2) {
      if (e2.message.includes("relation") || e2.message.includes("cache")) return res.json(data || []);
      throw e2;
    }
    res.json(d2 || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
function loadAccounts() {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) return [];
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
  } catch {
    return [];
  }
}
function saveAccounts(accounts) {
  try {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving accounts:", err);
  }
}
router.post("/invite/generate", requireAuth, async (req, res) => {
  const { institutionName, email, tournamentId } = req.body;
  const organizerId = req.user.id;
  if (!tournamentId) {
    return res.status(400).json({ error: "\xC9 obrigat\xF3rio selecionar um torneio para o qual efetuar o convite de ades\xE3o." });
  }
  try {
    const { role, referenceId, name: accName } = getUserRoleAndReferenceId(organizerId);
    if (role !== "organizer" && role !== "super_admin") {
      return res.status(403).json({ error: "Somente organizadores podem gerar convites." });
    }
    const supabase = getSupabaseAdmin();
    let orgName = accName;
    if (referenceId) {
      try {
        const { data: dbOrg } = await supabase.from("organizations").select("name").eq("id", referenceId).maybeSingle();
        if (dbOrg?.name) {
          orgName = dbOrg.name;
        }
      } catch (e) {
        console.error("Error fetching dynamic organization name for generated invitation:", e);
      }
    }
    let tournamentName = "";
    let tournamentLogoUrl = "";
    try {
      const { data: dbTournament } = await supabase.from("tournaments").select("name, logo_url").eq("id", tournamentId).maybeSingle();
      if (dbTournament) {
        if (dbTournament.name) tournamentName = dbTournament.name;
        if (dbTournament.logo_url) tournamentLogoUrl = dbTournament.logo_url;
      }
    } catch (e) {
      console.error("Error fetching tournament name and logo for generated invitation:", e);
    }
    const invitations = loadInvitations();
    const id = "inv_" + Math.random().toString(36).substring(2, 11);
    const newInvitation = {
      id,
      organizerId,
      organizerName: orgName || "Organizador",
      tournamentId,
      tournamentName: tournamentName || "Torneio",
      tournamentLogoUrl: tournamentLogoUrl || null,
      institutionName: institutionName || "",
      institutionId: null,
      // para ser preenchido após aceitação
      email: email || "",
      status: "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    invitations.push(newInvitation);
    saveInvitations(invitations);
    res.status(201).json({
      success: true,
      invitation: newInvitation
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/invite/public/:id", async (req, res) => {
  const invitationId = req.params.id;
  try {
    const invitations = loadInvitations();
    const inv = invitations.find((i) => i.id === invitationId);
    if (!inv) {
      return res.status(404).json({ error: "Convite n\xE3o encontrado." });
    }
    res.json({
      id: inv.id,
      organizerId: inv.organizerId,
      organizerName: inv.organizerName,
      tournamentId: inv.tournamentId,
      tournamentName: inv.tournamentName,
      tournamentLogoUrl: inv.tournamentLogoUrl,
      institutionName: inv.institutionName,
      status: inv.status,
      createdAt: inv.createdAt
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post("/invite/public/:id/accept-existing", async (req, res) => {
  const invitationId = req.params.id;
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha s\xE3o obrigat\xF3rios." });
  }
  try {
    const invitations = loadInvitations();
    const inv = invitations.find((i) => i.id === invitationId);
    if (!inv) {
      return res.status(404).json({ error: "Convite n\xE3o encontrado." });
    }
    const accounts = loadAccounts();
    const user = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
    if (!user || user.passwordHash !== password) {
      return res.status(401).json({ error: "Credenciais inv\xE1lidas." });
    }
    if (user.role !== "institution") {
      return res.status(403).json({ error: "Apenas contas de institui\xE7\xF5es podem aceitar convites." });
    }
    const referenceId = user.referenceId;
    if (!referenceId) {
      return res.status(400).json({ error: "Esta conta est\xE1 mal configurada (id de institui\xE7\xE3o n\xE3o localizado)." });
    }
    inv.status = "accepted";
    inv.institutionId = referenceId;
    inv.institutionName = user.name;
    saveInvitations(invitations);
    const mapping = loadOrgInstitutions();
    const targetOrgId = inv.organizerId;
    if (!mapping[targetOrgId]) {
      mapping[targetOrgId] = [];
    }
    if (!mapping[targetOrgId].includes(referenceId)) {
      mapping[targetOrgId].push(referenceId);
      saveOrgInstitutions(mapping);
    }
    if (inv.tournamentId) {
      try {
        const supabase = getSupabaseAdmin();
        const { data: existingReg } = await supabase.from("tournament_registrations").select("id").eq("tournament_id", inv.tournamentId).eq("institution_id", referenceId).maybeSingle();
        if (!existingReg) {
          const { error: regErr } = await supabase.from("tournament_registrations").insert([{
            tournament_id: inv.tournamentId,
            institution_id: referenceId
          }]);
          if (regErr) {
            console.error("Erro ao registrar no torneio no accept-existing:", regErr);
          }
        }
      } catch (e) {
        console.error("Falha ao registrar no torneio no accept-existing:", e);
      }
    }
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name || "",
      referenceId: user.referenceId || void 0
    });
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      referenceId: user.referenceId,
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post("/invite/public/:id/accept-new", async (req, res) => {
  const invitationId = req.params.id;
  const { name, document_number, email, password, responsible_name, responsible_phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Nome, e-mail e senha correspondentes s\xE3o obrigat\xF3rios." });
  }
  try {
    const invitations = loadInvitations();
    const inv = invitations.find((i) => i.id === invitationId);
    if (!inv) {
      return res.status(404).json({ error: "Convite n\xE3o encontrado." });
    }
    const accounts = loadAccounts();
    const emailExists = accounts.some((a) => a.email.toLowerCase() === email.toLowerCase());
    if (emailExists) {
      return res.status(400).json({ error: "Este endere\xE7o de e-mail j\xE1 est\xE1 cadastrado no Quero Competir." });
    }
    const supabase = getSupabaseAdmin();
    if (document_number) {
      const cleanDoc = document_number.replace(/\D/g, "");
      let existingInst = null;
      const cols = ["tax_id", "cnpj", "document_number"];
      for (const col of cols) {
        try {
          const { data: d1 } = await supabase.from("institutions").select("id, name").eq(col, document_number).maybeSingle();
          if (d1) {
            existingInst = d1;
            break;
          }
          if (cleanDoc && cleanDoc !== document_number) {
            const { data: d2 } = await supabase.from("institutions").select("id, name").eq(col, cleanDoc).maybeSingle();
            if (d2) {
              existingInst = d2;
              break;
            }
          }
        } catch (e) {
        }
      }
      if (existingInst) {
        return res.status(400).json({
          error: `O CNPJ/Documento "${document_number}" j\xE1 est\xE1 cadastrado para a institui\xE7\xE3o "${existingInst.name}". Por favor, utilize a aba "J\xE1 tenho Cadastro" ou informe outro documento.`
        });
      }
    }
    let createdInst = null;
    const { data: instData, error: instErr } = await supabase.from("institutions").insert([
      {
        name,
        tax_id: document_number,
        email,
        responsible_name,
        responsible_phone
      }
    ]).select().maybeSingle();
    if (instErr) {
      if (instErr.message.includes("tax_id")) {
        const { data: d2, error: e2 } = await supabase.from("institutions").insert([{ name, document_number, email, responsible_name, responsible_phone }]).select().maybeSingle();
        if (!e2) {
          createdInst = d2;
        } else {
          const { data: d3, error: e3 } = await supabase.from("institutions").insert([{ name, cnpj: document_number, email, responsible_name, responsible_phone }]).select().maybeSingle();
          if (!e3) createdInst = d3;
        }
      }
      if (!createdInst) throw instErr;
    } else {
      createdInst = instData;
    }
    if (!createdInst || !createdInst.id) {
      return res.status(500).json({ error: "N\xE3o foi poss\xEDvel criar a institui\xE7\xE3o no banco de dados." });
    }
    const referenceId = createdInst.id;
    const newAccount = {
      id: `acc_${Math.random().toString(36).substring(2, 11)}`,
      email: email.toLowerCase(),
      passwordHash: password,
      role: "institution",
      name,
      referenceId,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    accounts.push(newAccount);
    saveAccounts(accounts);
    inv.status = "accepted";
    inv.institutionId = referenceId;
    inv.institutionName = name;
    saveInvitations(invitations);
    const mapping = loadOrgInstitutions();
    const targetOrgId = inv.organizerId;
    if (!mapping[targetOrgId]) {
      mapping[targetOrgId] = [];
    }
    if (!mapping[targetOrgId].includes(referenceId)) {
      mapping[targetOrgId].push(referenceId);
      saveOrgInstitutions(mapping);
    }
    if (inv.tournamentId) {
      try {
        const { data: existingReg } = await supabase.from("tournament_registrations").select("id").eq("tournament_id", inv.tournamentId).eq("institution_id", referenceId).maybeSingle();
        if (!existingReg) {
          const { error: regErr } = await supabase.from("tournament_registrations").insert([{
            tournament_id: inv.tournamentId,
            institution_id: referenceId
          }]);
          if (regErr) {
            console.error("Erro ao registrar no torneio no accept-new:", regErr);
          }
        }
      } catch (e) {
        console.error("Falha ao registrar no torneio no accept-new:", e);
      }
    }
    const token = generateToken({
      id: newAccount.id,
      email: newAccount.email,
      role: newAccount.role,
      name: newAccount.name,
      referenceId: newAccount.referenceId
    });
    res.status(201).json({
      id: newAccount.id,
      email: newAccount.email,
      role: newAccount.role,
      name: newAccount.name,
      referenceId: newAccount.referenceId,
      token
    });
  } catch (err) {
    console.error("Error creating registration from invitation accept-new:", err);
    if (err.message && (err.message.includes("unique constraint") || err.message.includes("duplicate key"))) {
      return res.status(400).json({
        error: "Esta institui\xE7\xE3o (CNPJ/Documento) ou endere\xE7o de e-mail j\xE1 est\xE1 cadastrada na plataforma. Por favor, tente a aba 'J\xE1 tenho Cadastro'."
      });
    }
    res.status(500).json({ error: err.message });
  }
});
router.post("/invite", requireAuth, async (req, res) => {
  const { institutionId } = req.body;
  const organizerId = req.user.id;
  try {
    const { role, referenceId, name: accName } = getUserRoleAndReferenceId(organizerId);
    if (role !== "organizer" && role !== "super_admin") {
      return res.status(403).json({ error: "Somente organizadores podem convidar institui\xE7\xF5es." });
    }
    const supabase = getSupabaseAdmin();
    let orgName = accName;
    if (referenceId) {
      try {
        const { data: dbOrg } = await supabase.from("organizations").select("name").eq("id", referenceId).maybeSingle();
        if (dbOrg?.name) {
          orgName = dbOrg.name;
        }
      } catch (e) {
        console.error("Error fetching dynamic organization name for invitation:", e);
      }
    }
    const { data: inst, error } = await supabase.from("institutions").select("name").eq("id", institutionId).maybeSingle();
    if (error || !inst) {
      return res.status(404).json({ error: "Institui\xE7\xE3o n\xE3o encontrada na plataforma." });
    }
    const invitations = loadInvitations();
    const duplicate = invitations.find(
      (inv) => inv.organizerId === organizerId && inv.institutionId === institutionId && inv.status === "pending"
    );
    if (duplicate) {
      return res.status(440).json({ error: "Voc\xEA j\xE1 possui um convite pendente para esta institui\xE7\xE3o." });
    }
    const mapping = loadOrgInstitutions();
    const alreadyLinked = mapping[organizerId]?.includes(institutionId);
    if (alreadyLinked) {
      return res.status(400).json({ error: "Esta institui\xE7\xE3o j\xE1 faz parte da sua organiza\xE7\xE3o." });
    }
    const newInvitation = {
      id: Math.random().toString(36).substring(2, 11),
      organizerId,
      organizerName: orgName || "Organizador",
      institutionId,
      institutionName: inst.name,
      status: "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    invitations.push(newInvitation);
    saveInvitations(invitations);
    res.status(201).json(newInvitation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/invitations/incoming", requireAuth, async (req, res) => {
  const organizerId = req.user.id;
  try {
    const { role, referenceId } = getUserRoleAndReferenceId(organizerId);
    if (role !== "institution" || !referenceId) {
      return res.json([]);
    }
    const invitations = loadInvitations();
    const result = invitations.filter((inv) => inv.institutionId === referenceId);
    if (result.length > 0) {
      try {
        const accounts = fs.existsSync(ACCOUNTS_FILE) ? JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8")) : [];
        const orgIds = result.map((inv) => {
          const user = accounts.find((a) => a.id === inv.organizerId);
          return user?.referenceId;
        }).filter(Boolean);
        if (orgIds.length > 0) {
          const supabase = getSupabaseAdmin();
          const { data: orgs } = await supabase.from("organizations").select("id, name").in("id", orgIds);
          if (orgs && orgs.length > 0) {
            const orgMap = new Map(orgs.map((o) => [o.id, o.name]));
            result.forEach((inv) => {
              const user = accounts.find((a) => a.id === inv.organizerId);
              if (user?.referenceId && orgMap.has(user.referenceId)) {
                inv.organizerName = orgMap.get(user.referenceId);
              }
            });
          }
        }
      } catch (e) {
        console.error("Error fetching dynamic organization name for invitations:", e);
      }
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post("/invitations/:id/accept", requireAuth, async (req, res) => {
  const organizerId = req.user.id;
  const invitationId = req.params.id;
  try {
    const { role, referenceId } = getUserRoleAndReferenceId(organizerId);
    if (role !== "institution" || !referenceId) {
      return res.status(403).json({ error: "Apenas contas de institui\xE7\xF5es podem aceitar convites." });
    }
    const invitations = loadInvitations();
    const inv = invitations.find((i) => i.id === invitationId && i.institutionId === referenceId);
    if (!inv) {
      return res.status(444).json({ error: "Convite n\xE3o encontrado." });
    }
    if (inv.status !== "pending") {
      return res.status(400).json({ error: `Este convite j\xE1 est\xE1 marcado como ${inv.status}.` });
    }
    inv.status = "accepted";
    saveInvitations(invitations);
    const mapping = loadOrgInstitutions();
    const targetOrgId = inv.organizerId;
    if (!mapping[targetOrgId]) {
      mapping[targetOrgId] = [];
    }
    if (!mapping[targetOrgId].includes(referenceId)) {
      mapping[targetOrgId].push(referenceId);
      saveOrgInstitutions(mapping);
    }
    res.json({ success: true, message: "Convite aceito com sucesso! Dados compartilhados." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post("/invitations/:id/reject", requireAuth, async (req, res) => {
  const organizerId = req.user.id;
  const invitationId = req.params.id;
  try {
    const { role, referenceId } = getUserRoleAndReferenceId(organizerId);
    if (role !== "institution" || !referenceId) {
      return res.status(403).json({ error: "Apenas contas de institui\xE7\xF5es podem recusar convites." });
    }
    const invitations = loadInvitations();
    const inv = invitations.find((i) => i.id === invitationId && i.institutionId === referenceId);
    if (!inv) {
      return res.status(444).json({ error: "Convite n\xE3o encontrado." });
    }
    inv.status = "rejected";
    saveInvitations(invitations);
    res.json({ success: true, message: "Convite recusado." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var INST_PAYMENTS_FILE = path.join(process.cwd(), "src", "backend", "data", "institution_payments.json");
function ensurePaymentsFile() {
  const dir = path.dirname(INST_PAYMENTS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(INST_PAYMENTS_FILE)) {
    fs.writeFileSync(INST_PAYMENTS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}
function loadPayments() {
  ensurePaymentsFile();
  try {
    return JSON.parse(fs.readFileSync(INST_PAYMENTS_FILE, "utf-8"));
  } catch (e) {
    return [];
  }
}
function savePayments(data) {
  ensurePaymentsFile();
  try {
    fs.writeFileSync(INST_PAYMENTS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
  }
}
router.post("/payments/generate", requireAuth, async (req, res) => {
  const { tournamentId, institutionId, amount, deadline, allowedMethods } = req.body;
  const organizerId = req.user.id;
  if (!tournamentId || !institutionId || !amount || !deadline) {
    return res.status(400).json({ error: "Campos obrigat\xF3rios ausentes: tournamentId, institutionId, amount, deadline." });
  }
  try {
    const { role } = getUserRoleAndReferenceId(organizerId);
    if (role !== "organizer" && role !== "super_admin") {
      return res.status(403).json({ error: "Somente organizadores podem gerar links de pagamento." });
    }
    const supabase = getSupabaseAdmin();
    let tournamentName = "";
    try {
      const { data: dbT } = await supabase.from("tournaments").select("name").eq("id", tournamentId).maybeSingle();
      if (dbT) tournamentName = dbT.name;
    } catch (e) {
      console.error("Erro ao buscar nome do torneio para pagamento:", e);
    }
    let institutionName = "";
    try {
      const { data: dbI } = await supabase.from("institutions").select("name").eq("id", institutionId).maybeSingle();
      if (dbI) institutionName = dbI.name;
    } catch (e) {
      console.error("Erro ao buscar nome da institui\xE7\xE3o para pagamento:", e);
    }
    const payments = loadPayments();
    const filteredPayments = payments.filter((p) => !(p.tournamentId === tournamentId && p.institutionId === institutionId && p.status === "pending"));
    const id = "pay_" + Math.random().toString(36).substring(2, 11);
    const newPayment = {
      id,
      tournamentId,
      tournamentName: tournamentName || "Torneio",
      institutionId,
      institutionName: institutionName || "Institui\xE7\xE3o",
      amount: Number(amount),
      deadline,
      allowedMethods: allowedMethods || ["pix", "boleto", "card"],
      status: "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    filteredPayments.push(newPayment);
    savePayments(filteredPayments);
    res.status(201).json({
      success: true,
      payment: newPayment
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/payments/tournament/:tournamentId", requireAuth, async (req, res) => {
  const { tournamentId } = req.params;
  try {
    const payments = loadPayments();
    const filtered = payments.filter((p) => p.tournamentId === tournamentId);
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/payments/public/:paymentId", async (req, res) => {
  const { paymentId } = req.params;
  try {
    const payments = loadPayments();
    const pay = payments.find((p) => p.id === paymentId);
    if (!pay) {
      return res.status(404).json({ error: "Link de pagamento n\xE3o encontrado." });
    }
    const supabase = getSupabaseAdmin();
    let teamsList = [];
    try {
      const { data: dbTeams, error: dbTeamsError } = await supabase.from("team_registrations").select(`
          id,
          category:tournament_category_id(name, gender, age_group)
        `).eq("tournament_id", pay.tournamentId).eq("institution_id", pay.institutionId);
      if (!dbTeamsError && dbTeams) {
        teamsList = dbTeams.map((t) => {
          if (!t.category) return "Equipe";
          const cat = t.category;
          return `${cat.name} (${cat.gender || ""} - ${cat.age_group || ""})`;
        });
      }
    } catch (e) {
      console.error("Erro ao buscar equipes para o pagamento:", e);
    }
    res.json({
      ...pay,
      teams: teamsList,
      pagarmePublicKey: process.env.PAGARME_PUBLIC_KEY || ""
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
async function callPagarMe(endpoint, method, body) {
  const secretKey = process.env.PAGARME_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAGARME_SECRET_KEY n\xE3o configurada no arquivo de ambiente.");
  }
  const authHeader = "Basic " + Buffer.from(secretKey + ":").toString("base64");
  const response = await fetch(`https://api.pagar.me/core/v5${endpoint}`, {
    method,
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/json",
      "accept": "application/json"
    },
    body: body ? JSON.stringify(body) : void 0
  });
  const data = await response.json();
  if (!response.ok) {
    console.error("Pagar.me API Error details:", data);
    throw new Error(data.message || "Erro retornado pela API do Pagar.me");
  }
  return data;
}
router.post("/payments/public/:paymentId/pay", async (req, res) => {
  const { paymentId } = req.params;
  const { method, cardToken, simulateSuccess } = req.body;
  if (!method) {
    return res.status(400).json({ error: "M\xE9todo de pagamento n\xE3o especificado." });
  }
  try {
    const payments = loadPayments();
    const payIndex = payments.findIndex((p) => p.id === paymentId);
    if (payIndex === -1) {
      return res.status(404).json({ error: "Link de pagamento n\xE3o encontrado." });
    }
    const pay = payments[payIndex];
    if (pay.status === "paid") {
      return res.status(400).json({ error: "Este pagamento j\xE1 foi realizado." });
    }
    const now = /* @__PURE__ */ new Date();
    const limitDate = /* @__PURE__ */ new Date(pay.deadline + "T23:59:59");
    if (now > limitDate) {
      return res.status(400).json({ error: "Este link de pagamento expirou." });
    }
    const hasSecretKey = !!process.env.PAGARME_SECRET_KEY;
    if (simulateSuccess) {
      payments[payIndex].status = "paid";
      payments[payIndex].paidAt = (/* @__PURE__ */ new Date()).toISOString();
      savePayments(payments);
      const supabase2 = getSupabaseAdmin();
      const { data: reg } = await supabase2.from("tournament_registrations").select("id").eq("tournament_id", pay.tournamentId).eq("institution_id", pay.institutionId).maybeSingle();
      if (reg) {
        await supabase2.from("tournament_registrations").update({ status: "confirmed" }).eq("id", reg.id);
      }
      return res.json({ success: true, method, paid: true });
    }
    if (!hasSecretKey) {
      console.warn("PAGARME_SECRET_KEY n\xE3o detectada. Executando pagamento em modo SIMULADO.");
      if (method === "pix") {
        return res.json({
          success: true,
          method: "pix",
          qrCode: `00020126360014br.gov.bcb.pix0114+55719914149135204000053039865407${pay.amount.toFixed(2)}5802BR5914QUEROCOMPETIR6009SALVADOR62070503***6304FC7D`,
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=mock-pix-payload-value`
        });
      }
      if (method === "boleto") {
        return res.json({
          success: true,
          method: "boleto",
          barcode: "34191.79001 01043.513184 91020.150008 7 974000000",
          pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf-test.pdf"
        });
      }
      payments[payIndex].status = "paid";
      payments[payIndex].paidAt = (/* @__PURE__ */ new Date()).toISOString();
      savePayments(payments);
      const supabase2 = getSupabaseAdmin();
      const { data: reg } = await supabase2.from("tournament_registrations").select("id").eq("tournament_id", pay.tournamentId).eq("institution_id", pay.institutionId).maybeSingle();
      if (reg) {
        await supabase2.from("tournament_registrations").update({ status: "confirmed" }).eq("id", reg.id);
      }
      return res.json({ success: true, method: "card", paid: true });
    }
    const supabase = getSupabaseAdmin();
    const { data: instData } = await supabase.from("institutions").select("email, cnpj, contact_phone").eq("id", pay.institutionId).maybeSingle();
    const cleanDoc = (instData?.cnpj || "00000000000191").replace(/\D/g, "");
    const customer = {
      name: pay.institutionName || "Institui\xE7\xE3o",
      email: instData?.email || "financeiro@querocompetir.com.br",
      document: cleanDoc.length === 11 || cleanDoc.length === 14 ? cleanDoc : "00000000000191",
      type: cleanDoc.length === 11 ? "individual" : "corporation",
      phones: {
        mobile_phone: {
          country_code: "55",
          area_code: "71",
          number: (instData?.contact_phone || "999999999").replace(/\D/g, "").slice(-9)
        }
      }
    };
    if (method === "pix") {
      const orderPayload = {
        code: pay.id,
        items: [
          {
            amount: Math.round(pay.amount * 100),
            description: `Taxa de Ades\xE3o - ${pay.tournamentName}`,
            quantity: 1
          }
        ],
        customer,
        payments: [
          {
            payment_method: "pix",
            pix: {
              expires_in: 86400
            }
          }
        ]
      };
      const pgOrder = await callPagarMe("/orders", "POST", orderPayload);
      const charge = pgOrder.charges?.[0];
      const transaction = charge?.last_transaction;
      payments[payIndex].pagarmeOrderId = pgOrder.id;
      payments[payIndex].pagarmeChargeId = charge?.id;
      savePayments(payments);
      return res.json({
        success: true,
        method: "pix",
        qrCode: transaction?.qr_code || "",
        qrCodeUrl: transaction?.qr_code_url || ""
      });
    }
    if (method === "boleto") {
      const orderPayload = {
        code: pay.id,
        items: [
          {
            amount: Math.round(pay.amount * 100),
            description: `Taxa de Ades\xE3o - ${pay.tournamentName}`,
            quantity: 1
          }
        ],
        customer,
        payments: [
          {
            payment_method: "boleto",
            boleto: {
              bank: "341",
              // Itaú
              instructions: "Pagar at\xE9 o vencimento. N\xE3o receber ap\xF3s vencimento.",
              due_at: (/* @__PURE__ */ new Date(pay.deadline + "T23:59:59")).toISOString()
            }
          }
        ]
      };
      const pgOrder = await callPagarMe("/orders", "POST", orderPayload);
      const charge = pgOrder.charges?.[0];
      const transaction = charge?.last_transaction;
      payments[payIndex].pagarmeOrderId = pgOrder.id;
      payments[payIndex].pagarmeChargeId = charge?.id;
      savePayments(payments);
      return res.json({
        success: true,
        method: "boleto",
        barcode: transaction?.line_digit || "",
        pdfUrl: transaction?.pdf || ""
      });
    }
    if (method === "card") {
      if (!cardToken) {
        return res.status(400).json({ error: "Token do cart\xE3o n\xE3o fornecido." });
      }
      const orderPayload = {
        code: pay.id,
        items: [
          {
            amount: Math.round(pay.amount * 100),
            description: `Taxa de Ades\xE3o - ${pay.tournamentName}`,
            quantity: 1
          }
        ],
        customer,
        payments: [
          {
            payment_method: "credit_card",
            credit_card: {
              card_token: cardToken,
              operation_type: "auth_and_capture",
              installments: 1,
              statement_descriptor: "QUEROCOMPETIR"
            }
          }
        ]
      };
      const pgOrder = await callPagarMe("/orders", "POST", orderPayload);
      const charge = pgOrder.charges?.[0];
      if (charge?.status === "paid") {
        payments[payIndex].status = "paid";
        payments[payIndex].paidAt = (/* @__PURE__ */ new Date()).toISOString();
        payments[payIndex].pagarmeOrderId = pgOrder.id;
        payments[payIndex].pagarmeChargeId = charge.id;
        savePayments(payments);
        const { data: reg } = await supabase.from("tournament_registrations").select("id").eq("tournament_id", pay.tournamentId).eq("institution_id", pay.institutionId).maybeSingle();
        if (reg) {
          await supabase.from("tournament_registrations").update({ status: "confirmed" }).eq("id", reg.id);
        }
        return res.json({ success: true, method: "card", paid: true });
      } else {
        return res.status(400).json({ error: `Pagamento via cart\xE3o n\xE3o aprovado. Status: ${charge?.status || "desconhecido"}` });
      }
    }
    res.status(400).json({ error: "M\xE9todo de pagamento inv\xE1lido." });
  } catch (err) {
    console.error("Erro na transa\xE7\xE3o Pagar.me:", err);
    res.status(500).json({ error: err.message || "Erro desconhecido ao processar pagamento." });
  }
});
router.post("/payments/webhook", async (req, res) => {
  const event = req.body;
  console.log("Pagar.me Webhook recebido:", event?.type);
  try {
    if (event?.type === "charge.paid" || event?.type === "order.paid") {
      const orderCode = event.data?.code || event.data?.order?.code;
      if (orderCode) {
        const payments = loadPayments();
        const payIndex = payments.findIndex((p) => p.id === orderCode);
        if (payIndex !== -1) {
          if (payments[payIndex].status !== "paid") {
            payments[payIndex].status = "paid";
            payments[payIndex].paidAt = (/* @__PURE__ */ new Date()).toISOString();
            savePayments(payments);
            const pay = payments[payIndex];
            const supabase = getSupabaseAdmin();
            const { data: reg } = await supabase.from("tournament_registrations").select("id").eq("tournament_id", pay.tournamentId).eq("institution_id", pay.institutionId).maybeSingle();
            if (reg) {
              const { error: updateErr } = await supabase.from("tournament_registrations").update({ status: "confirmed" }).eq("id", reg.id);
              if (updateErr) {
                console.error("Erro ao atualizar Supabase via Webhook Pagar.me:", updateErr);
              } else {
                console.log(`Pagamento do link ${orderCode} liquidado e atualizado via Webhook.`);
              }
            }
          }
        } else {
          const supabase = getSupabaseAdmin();
          const { data: subData } = await supabase.from("athlete_subscriptions").select("*").eq("id", orderCode).maybeSingle();
          if (subData && subData.payment_status !== "paid") {
            await supabase.from("athlete_subscriptions").update({ payment_status: "paid" }).eq("id", orderCode);
            const { data: tData } = await supabase.from("tournaments").select("owner_id, start_date").eq("id", subData.tournament_id).maybeSingle();
            const { data: tSettings } = await supabase.from("tournament_subscription_settings").select("require_membership").eq("tournament_id", subData.tournament_id).maybeSingle();
            if (tSettings?.require_membership && tData) {
              const { data: existingMember } = await supabase.from("members").select("id").eq("document_number", subData.document).maybeSingle();
              let athleteId = existingMember?.id;
              if (!athleteId) {
                const { data: newMember } = await supabase.from("members").insert([{
                  institution_id: subData.institution_id,
                  full_name: subData.athlete_name,
                  document_number: subData.document,
                  birth_date: subData.birth_date,
                  status: "pending"
                }]).select("id").single();
                if (newMember) athleteId = newMember.id;
              }
              if (athleteId) {
                const year = new Date(tData.start_date).getFullYear();
                await supabase.from("memberships").upsert({
                  member_id: athleteId,
                  organization_id: tData.owner_id,
                  year,
                  status: "active",
                  payment_status: "paid",
                  payment_id: `pagarme_webhook_athlete_${orderCode}`,
                  paid_at: (/* @__PURE__ */ new Date()).toISOString()
                }, {
                  onConflict: "organization_id,member_id,year"
                });
              }
            }
            console.log(`Pagamento da inscri\xE7\xE3o do atleta ${subData.athlete_name} (${orderCode}) liquidado via Webhook.`);
          }
        }
      }
    }
  } catch (err) {
    console.error("Erro no processamento do Webhook:", err);
  }
  res.json({ received: true });
});
var institutionRoutes_default = router;

// src/backend/routes/tournamentRoutes.ts
import { Router as Router2 } from "express";
import fs2 from "fs";
import path2 from "path";
import bcrypt from "bcryptjs";
var router2 = Router2();
var ACCOUNTS_FILE2 = path2.join(process.cwd(), "src", "backend", "data", "accounts.json");
var ORG_STAFF_FILE = path2.join(process.cwd(), "src", "backend", "data", "organizer_staff.json");
var ORG_VENUES_FILE = path2.join(process.cwd(), "src", "backend", "data", "organizer_venues.json");
function getUserRoleAndReferenceId2(userId) {
  try {
    if (!fs2.existsSync(ACCOUNTS_FILE2)) return { role: null, name: null, referenceId: null };
    const accounts = JSON.parse(fs2.readFileSync(ACCOUNTS_FILE2, "utf-8"));
    const user = accounts.find((a) => a.id === userId);
    if (user) {
      return {
        role: user.role || null,
        name: user.name || null,
        referenceId: user.referenceId || null
      };
    }
  } catch (e) {
    console.error(e);
  }
  return { role: null, name: null, referenceId: null };
}
async function ensureStaffAndVenuesMappings() {
  const supabase = getSupabaseAdmin();
  if (!fs2.existsSync(ORG_STAFF_FILE)) {
    try {
      const { data: staffData } = await supabase.from("staff").select("id");
      const staffIds = staffData?.map((s) => s.id) || [];
      const initialStaff = {
        "org-1": staffIds
      };
      fs2.writeFileSync(ORG_STAFF_FILE, JSON.stringify(initialStaff, null, 2), "utf-8");
    } catch (e) {
      console.error("Error seeding organizer_staff.json:", e);
    }
  }
  if (!fs2.existsSync(ORG_VENUES_FILE)) {
    try {
      const { data: venuesData } = await supabase.from("venues").select("id");
      const venueIds = venuesData?.map((v) => v.id) || [];
      const initialVenues = {
        "org-1": venueIds
      };
      fs2.writeFileSync(ORG_VENUES_FILE, JSON.stringify(initialVenues, null, 2), "utf-8");
    } catch (e) {
      console.error("Error seeding organizer_venues.json:", e);
    }
  }
}
function loadOrgStaff() {
  try {
    if (!fs2.existsSync(ORG_STAFF_FILE)) return {};
    return JSON.parse(fs2.readFileSync(ORG_STAFF_FILE, "utf-8"));
  } catch {
    return {};
  }
}
function saveOrgStaff(data) {
  try {
    fs2.writeFileSync(ORG_STAFF_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving organizer_staff.json:", e);
  }
}
function loadOrgVenues() {
  try {
    if (!fs2.existsSync(ORG_VENUES_FILE)) return {};
    return JSON.parse(fs2.readFileSync(ORG_VENUES_FILE, "utf-8"));
  } catch {
    return {};
  }
}
function saveOrgVenues(data) {
  try {
    fs2.writeFileSync(ORG_VENUES_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving organizer_venues.json:", e);
  }
}
async function getOrganizerReferenceIdAndSync(organizerId) {
  try {
    if (!fs2.existsSync(ACCOUNTS_FILE2)) return null;
    const accounts = JSON.parse(fs2.readFileSync(ACCOUNTS_FILE2, "utf-8"));
    const user = accounts.find((a) => a.id === organizerId);
    if (!user) return null;
    if (user.referenceId) {
      return user.referenceId;
    }
    const supabase = getSupabaseAdmin();
    const payload = {
      name: `Organiza\xE7\xE3o de ${user.name}`,
      logo_url: "",
      primary_color: "#4F46E5",
      secondary_color: "#0F172A",
      font_family: "inter",
      subdomain: user.name.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 15) || "portal"
    };
    const { data, error } = await supabase.from("organizations").insert([payload]).select().maybeSingle();
    if (error) {
      console.error("Error creating default organization for new organizer:", error);
      return null;
    }
    if (!data) return null;
    const orgId = data.id;
    user.referenceId = orgId;
    fs2.writeFileSync(ACCOUNTS_FILE2, JSON.stringify(accounts, null, 2));
    try {
      const { data: hasTable } = await supabase.from("portal_accounts").select("id").limit(1);
      if (hasTable) {
        const mapped = {
          id: user.id,
          email: user.email,
          password_hash: user.passwordHash,
          role: user.role,
          name: user.name,
          reference_id: orgId,
          created_at: user.createdAt || (/* @__PURE__ */ new Date()).toISOString()
        };
        await supabase.from("portal_accounts").upsert(mapped);
      }
    } catch (e) {
    }
    return orgId;
  } catch (err) {
    console.error("Error resolving/syncing organizer organization:", err);
    return null;
  }
}
router2.get("/organization", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const organizerId = req.user.id;
    let orgId = null;
    if (organizerId) {
      orgId = await getOrganizerReferenceIdAndSync(organizerId);
    }
    let query = supabase.from("organizations").select("*");
    if (orgId) {
      query = query.eq("id", orgId);
    } else {
      const queryId = req.query.id;
      if (queryId) {
        query = query.eq("id", queryId);
      } else {
        query = query.limit(1);
      }
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
      if (error.message.includes('relation "organizations" does not exist')) {
        return res.json(null);
      }
      throw error;
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.put("/organization", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id, updated_at, created_at, ...payload } = req.body;
    const organizerId = req.user.id;
    let orgId = null;
    if (organizerId) {
      orgId = await getOrganizerReferenceIdAndSync(organizerId);
    }
    if (!orgId) {
      const { data: existing } = await supabase.from("organizations").select("id").limit(1).maybeSingle();
      orgId = existing?.id || null;
    }
    let result;
    if (orgId) {
      const { data, error } = await supabase.from("organizations").update(payload).eq("id", orgId).select().maybeSingle();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase.from("organizations").insert([payload]).select().maybeSingle();
      if (error) throw error;
      result = data;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.get("/match/:matchId", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("matches").select(`
        *,
        tournament:tournament_id(name),
        category:tournament_category_id(name, gender, age_group),
        team1:team1_id(id, institution:institutions(id, name, logo_url)),
        team2:team2_id(id, institution:institutions(id, name, logo_url)),
        winner:winner_id(id, institution:institutions(id, name, logo_url)),
        referee1:referee1_id(name),
        referee2:referee2_id(name),
        table_official:table_official_id(name),
        venue:venue_id(*)
      `).eq("id", req.params.matchId).single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.get("/matches/:matchId/next", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: currentMatch, error: currError } = await supabase.from("matches").select("tournament_id, venue_id, scheduled_time").eq("id", req.params.matchId).single();
    if (currError) throw currError;
    if (!currentMatch.venue_id || !currentMatch.scheduled_time) {
      return res.json(null);
    }
    const currentDate = new Date(currentMatch.scheduled_time);
    const startOfDay = new Date(currentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(currentDate);
    endOfDay.setHours(23, 59, 59, 999);
    const { data: nextMatch, error: nextError } = await supabase.from("matches").select("id, scheduled_time, status").eq("tournament_id", currentMatch.tournament_id).eq("venue_id", currentMatch.venue_id).gte("scheduled_time", currentMatch.scheduled_time).neq("id", req.params.matchId).order("scheduled_time", { ascending: true }).limit(1).maybeSingle();
    if (nextError) throw nextError;
    res.json(nextMatch || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.get("/:tournamentId/venues/:venueId/live", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const today = /* @__PURE__ */ new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    let { data: liveMatch, error } = await supabase.from("matches").select(`
        *,
        tournament:tournament_id(name, logo_url),
        category:tournament_category_id(name, gender, age_group),
        team1:team1_id(id, institution:institutions(id, name, logo_url)),
        team2:team2_id(id, institution:institutions(id, name, logo_url)),
        venue:venue_id(name)
      `).eq("tournament_id", req.params.tournamentId).eq("venue_id", req.params.venueId).eq("status", "in_progress").gte("scheduled_time", startOfDay.toISOString()).lte("scheduled_time", endOfDay.toISOString()).order("scheduled_time", { ascending: true }).limit(1).maybeSingle();
    if (!liveMatch) {
      const { data: nextMatch } = await supabase.from("matches").select(`
          *,
          tournament:tournament_id(name, logo_url),
          category:tournament_category_id(name, gender, age_group),
          team1:team1_id(id, institution:institutions(id, name, logo_url)),
          team2:team2_id(id, institution:institutions(id, name, logo_url)),
          venue:venue_id(name)
        `).eq("tournament_id", req.params.tournamentId).eq("venue_id", req.params.venueId).eq("status", "scheduled").gte("scheduled_time", startOfDay.toISOString()).lte("scheduled_time", endOfDay.toISOString()).order("scheduled_time", { ascending: true }).limit(1).maybeSingle();
      liveMatch = nextMatch;
    }
    if (!liveMatch) {
      const { data: lastFinished } = await supabase.from("matches").select(`
          *,
          tournament:tournament_id(name, logo_url),
          category:tournament_category_id(name, gender, age_group),
          team1:team1_id(id, institution:institutions(id, name, logo_url)),
          team2:team2_id(id, institution:institutions(id, name, logo_url)),
          venue:venue_id(name)
        `).eq("tournament_id", req.params.tournamentId).eq("venue_id", req.params.venueId).eq("status", "finished").gte("scheduled_time", startOfDay.toISOString()).lte("scheduled_time", endOfDay.toISOString()).order("scheduled_time", { ascending: false }).limit(1).maybeSingle();
      liveMatch = lastFinished;
    }
    res.json(liveMatch || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.post("/", requireAuth, async (req, res) => {
  const { name, owner_id, description, start_date, end_date, logo_url } = req.body;
  const organizerId = req.user.id;
  let finalOwnerId = owner_id;
  if (organizerId) {
    const orgId = await getOrganizerReferenceIdAndSync(organizerId);
    if (orgId) {
      finalOwnerId = orgId;
    }
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("tournaments").insert([{ name, owner_id: finalOwnerId, description, start_date, end_date, logo_url }]).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.get("/institution/:institutionId/teams", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: teams, error } = await supabase.from("team_registrations").select(`
        id,
        tournament_id,
        tournament_category_id,
        institution_id,
        tournament:tournament_id(id, name),
        category:tournament_category_id(id, name, gender, age_group, birth_year_min, birth_year_max)
      `).eq("institution_id", req.params.institutionId);
    if (error) throw error;
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.get("/institution/:institutionId/registrations", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("tournament_registrations").select("tournament_id").eq("institution_id", req.params.institutionId);
    if (error) throw error;
    res.json(data.map((d) => d.tournament_id));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.get("/", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const reqUser = req.user;
    const organizerId = reqUser?.id || req.headers["x-organizer-id"];
    let organizerRole = reqUser?.role;
    if (organizerId && !organizerRole && fs2.existsSync(ACCOUNTS_FILE2)) {
      const accounts = JSON.parse(fs2.readFileSync(ACCOUNTS_FILE2, "utf-8"));
      const user = accounts.find((a) => a.id === organizerId);
      if (user) organizerRole = user.role;
    }
    let orgId = null;
    let isSuperAdmin = organizerRole === "super_admin";
    let isInstitution = organizerRole === "institution";
    if (organizerId && !isSuperAdmin && !isInstitution) {
      orgId = await getOrganizerReferenceIdAndSync(organizerId);
    }
    let query = supabase.from("tournaments").select("*").neq("status", "cancelled");
    if (orgId && !isSuperAdmin && !isInstitution) {
      query = query.eq("owner_id", orgId);
    }
    const { data, error } = await query.order("start_date", { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.get("/staff", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const organizerId = req.user.id;
    const { role } = getUserRoleAndReferenceId2(organizerId);
    let useLocalFallback = false;
    let data = null;
    let error = null;
    try {
      let query = supabase.from("staff").select("*");
      if (role !== "super_admin") {
        query = query.eq("organizer_id", organizerId);
      }
      const resDb = await query.order("name");
      data = resDb.data;
      error = resDb.error;
      if (error && (error.message.includes("column") || error.message.includes("organizer_id"))) {
        useLocalFallback = true;
      }
    } catch (e) {
      useLocalFallback = true;
    }
    if (useLocalFallback) {
      await ensureStaffAndVenuesMappings();
      const { data: allData, error: allErr } = await supabase.from("staff").select("*").order("name");
      if (allErr) {
        if (allErr.message.includes("relation") || allErr.message.includes("cache")) {
          return res.json([]);
        }
        throw allErr;
      }
      if (organizerId && role !== "super_admin") {
        const mapping = loadOrgStaff();
        const allowedIds = mapping[organizerId] || [];
        const filtered = (allData || []).filter((s) => allowedIds.includes(s.id));
        return res.json(filtered);
      }
      return res.json(allData || []);
    }
    if (error) {
      console.error("[GET STAFF] Supabase Error:", error);
      if (error.message.includes("relation") || error.message.includes("cache")) {
        return res.json([]);
      }
      throw error;
    }
    res.json(data || []);
  } catch (error) {
    console.error("[GET STAFF] Catch Error:", error);
    res.status(500).json({ error: error.message });
  }
});
router2.post("/staff", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const organizerId = req.user.id;
    try {
      const staffData = { ...req.body, organizer_id: organizerId };
      const { data, error } = await supabase.from("staff").insert([staffData]).select().single();
      if (error) {
        if (error.message.includes("column") || error.message.includes("organizer_id")) {
          throw new Error("fallback_to_json");
        }
        throw error;
      }
      return res.json(data);
    } catch (dbErr) {
      if (dbErr.message === "fallback_to_json") {
        const { data, error } = await supabase.from("staff").insert([req.body]).select().single();
        if (error) throw error;
        if (organizerId && data?.id) {
          await ensureStaffAndVenuesMappings();
          const mapping = loadOrgStaff();
          if (!mapping[organizerId]) {
            mapping[organizerId] = [];
          }
          mapping[organizerId].push(data.id);
          saveOrgStaff(mapping);
        }
        return res.json(data);
      }
      throw dbErr;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.delete("/staff/:id", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const organizerId = req.user.id;
    const staffId = req.params.id;
    const { error } = await supabase.from("staff").delete().eq("id", staffId);
    if (error) throw error;
    if (organizerId) {
      await ensureStaffAndVenuesMappings();
      const mapping = loadOrgStaff();
      if (mapping[organizerId]) {
        mapping[organizerId] = mapping[organizerId].filter((id) => id !== staffId);
        saveOrgStaff(mapping);
      }
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.patch("/matches/bulk-update", requireAuth, async (req, res) => {
  const { updates } = req.body;
  try {
    const supabase = getSupabaseAdmin();
    const results = [];
    for (const update of updates) {
      const { id, ...fields } = update;
      const { data, error } = await supabase.from("matches").update(fields).eq("id", id).select();
      if (error) throw error;
      results.push(data[0]);
    }
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.get("/:id", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("tournaments").select("*").eq("id", req.params.id).single();
    if (error) throw error;
    let organization = null;
    if (data && data.owner_id) {
      const orgId = await getOrganizerReferenceIdAndSync(data.owner_id);
      if (orgId) {
        const { data: orgData } = await supabase.from("organizations").select("*").eq("id", orgId).maybeSingle();
        organization = orgData;
      }
    }
    res.json({ ...data, organization });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.patch("/:id/status", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { status } = req.body;
    const { data, error } = await supabase.from("tournaments").update({ status }).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.patch("/:id", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { name, description, start_date, end_date, logo_url } = req.body;
    const updateObj = {};
    if (name !== void 0) updateObj.name = name;
    if (description !== void 0) updateObj.description = description;
    if (start_date !== void 0) updateObj.start_date = start_date;
    if (end_date !== void 0) updateObj.end_date = end_date;
    if (logo_url !== void 0) updateObj.logo_url = logo_url;
    const { data, error } = await supabase.from("tournaments").update(updateObj).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.get("/:id/matches", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("matches").select(`
        *,
        category:tournament_category_id(name, gender, age_group),
        team1:team1_id(id, availability, institution:institutions(id, name, logo_url)),
        team2:team2_id(id, availability, institution:institutions(id, name, logo_url)),
        winner:winner_id(id, institution:institutions(id, name, logo_url)),
        venue:venue_id(*)
      `).eq("tournament_id", req.params.id).order("round", { ascending: true }).order("match_index", { ascending: true });
    if (error) {
      if (error.message.includes("relation") || error.message.includes("cache")) return res.json([]);
      throw error;
    }
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.get("/:id/categories", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const tournamentId = req.params.id;
    const { data: categories, error: catError } = await supabase.from("tournament_categories").select("*").eq("tournament_id", tournamentId);
    if (catError) {
      if (catError.message.includes('relation "tournament_categories" does not exist') || catError.message.includes("schema cache")) {
        return res.json([]);
      }
      throw catError;
    }
    if (!categories || categories.length === 0) {
      return res.json([]);
    }
    const { data: teams, error: teamsError } = await supabase.from("team_registrations").select("id, tournament_category_id").eq("tournament_id", tournamentId);
    if (teamsError) {
      console.error("Erro ao buscar inscri\xE7\xF5es de equipes para categorias:", teamsError);
      const result2 = categories.map((cat) => ({ ...cat, registered_count: 0 }));
      return res.json(result2);
    }
    let teamIds = teams ? teams.map((t) => t.id) : [];
    let members = [];
    if (teamIds.length > 0) {
      try {
        const { data: membersData } = await supabase.from("team_members").select("team_id").in("team_id", teamIds);
        members = membersData || [];
      } catch (err) {
        console.error("Erro ao buscar membros dos times:", err);
      }
    }
    const result = categories.map((cat) => {
      const catTeams = teams ? teams.filter((t) => t.tournament_category_id === cat.id) : [];
      const isCombat = cat.rules_config?.sport_type === "combat";
      let count = catTeams.length;
      if (isCombat) {
        const catTeamIds = new Set(catTeams.map((t) => t.id));
        count = members.filter((m) => catTeamIds.has(m.team_id)).length;
      }
      return {
        ...cat,
        registered_count: count
      };
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.post("/:id/categories", async (req, res) => {
  const { name, gender, age_group, birth_year_min, birth_year_max, max_teams, rules_config } = req.body;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("tournament_categories").insert([{
      tournament_id: req.params.id,
      name,
      gender,
      age_group,
      birth_year_min: birth_year_min ?? null,
      birth_year_max: birth_year_max ?? null,
      max_teams,
      rules_config
    }]).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.patch("/categories/:categoryId", async (req, res) => {
  const { name, gender, age_group, birth_year_min, birth_year_max, max_teams, rules_config } = req.body;
  const { categoryId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    const updatePayload = {};
    if (name !== void 0) updatePayload.name = name;
    if (gender !== void 0) updatePayload.gender = gender;
    if (age_group !== void 0) updatePayload.age_group = age_group;
    if (birth_year_min !== void 0) updatePayload.birth_year_min = birth_year_min ?? null;
    if (birth_year_max !== void 0) updatePayload.birth_year_max = birth_year_max ?? null;
    if (max_teams !== void 0) updatePayload.max_teams = max_teams;
    if (rules_config !== void 0) updatePayload.rules_config = rules_config;
    const { data, error } = await supabase.from("tournament_categories").update(updatePayload).eq("id", categoryId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Erro ao atualizar categoria:", error);
    res.status(500).json({ error: error.message });
  }
});
router2.delete("/categories/:categoryId", async (req, res) => {
  const { categoryId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("matches").delete().eq("tournament_category_id", categoryId);
    await supabase.from("team_registrations").delete().eq("tournament_category_id", categoryId);
    await supabase.from("athlete_subscriptions").delete().eq("category_id", categoryId);
    const { error } = await supabase.from("tournament_categories").delete().eq("id", categoryId);
    if (error) throw error;
    res.json({ message: "Categoria removida com sucesso." });
  } catch (error) {
    console.error("Erro ao deletar categoria:", error);
    res.status(500).json({ error: error.message });
  }
});
router2.get("/:id/registrations", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("tournament_registrations").select("*, institution:institutions(id, name, logo_url)").eq("tournament_id", req.params.id);
    if (error) {
      if (error.message.includes("relation") || error.message.includes("cache")) return res.json([]);
      throw error;
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.get("/:id/registrations/summary", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const tournamentId = req.params.id;
    const { data: regs, error: regsError } = await supabase.from("tournament_registrations").select("*, institution:institutions(id, name, logo_url)").eq("tournament_id", tournamentId);
    if (regsError) throw regsError;
    const { data: teams, error: teamsError } = await supabase.from("team_registrations").select("id, institution_id, tournament_category_id").eq("tournament_id", tournamentId);
    if (teamsError) throw teamsError;
    const teamIds = teams?.map((t) => t.id) || [];
    let memberCounts = {};
    if (teamIds.length > 0) {
      const { data: members, error: membersError } = await supabase.from("team_members").select("team_id").in("team_id", teamIds);
      if (!membersError && members) {
        members.forEach((m) => {
          memberCounts[m.team_id] = (memberCounts[m.team_id] || 0) + 1;
        });
      }
    }
    const summary = regs?.map((reg) => {
      const instTeams = teams?.filter((t) => t.institution_id === reg.institution_id) || [];
      const athleteCount = instTeams.reduce((sum, t) => sum + (memberCounts[t.id] || 0), 0);
      return {
        ...reg,
        modalityCount: instTeams.length,
        athleteCount
      };
    });
    res.json(summary || []);
  } catch (error) {
    if (error.message.includes("relation") || error.message.includes("cache")) return res.json([]);
    res.status(500).json({ error: error.message });
  }
});
router2.post("/:id/registrations", async (req, res) => {
  const { institution_id } = req.body;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("tournament_registrations").insert([{
      tournament_id: req.params.id,
      institution_id
    }]).select("*, institution:institutions(id, name, logo_url)").single();
    if (error) {
      if (error.message.includes("relation") || error.message.includes("cache")) {
        throw new Error("A tabela 'tournament_registrations' n\xE3o existe. Execute o script SQL presente no arquivo SUPABASE_SETUP.sql no seu Supabase.");
      }
      if (error.message.includes("row-level security policy")) {
        throw new Error("Erro de RLS: Verifique se voc\xEA cadastrou a 'service_role' key (e n\xE3o a 'anon' key) nos Segredos do app. Se a chave estiver correta, execute o script SQL atualizado do arquivo SUPABASE_SETUP.sql para liberar o acesso.");
      }
      throw error;
    }
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.delete("/:id/registrations/:regId", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("tournament_registrations").delete().eq("id", req.params.regId);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.patch("/:id/registrations/:regId", async (req, res) => {
  const { status } = req.body;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("tournament_registrations").update({ status }).eq("id", req.params.regId).select("*, institution:institutions(id, name, logo_url)").single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.get("/:id/categories/:categoryId/institutions/:instId/members", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: team, error: teamError } = await supabase.from("team_registrations").select("id, availability").eq("tournament_id", req.params.id).eq("tournament_category_id", req.params.categoryId).eq("institution_id", req.params.instId).maybeSingle();
    if (teamError) {
      if (teamError.message.includes("relation") || teamError.message.includes("cache")) return res.json({ athleteIds: [], availability: [] });
      throw teamError;
    }
    if (!team) return res.json({ athleteIds: [], availability: [] });
    const { data: members, error: membersError } = await supabase.from("team_members").select("athlete_id").eq("team_id", team.id);
    if (membersError) {
      if (membersError.message.includes("relation") || membersError.message.includes("cache")) return res.json({ athleteIds: [], availability: team.availability || [] });
      throw membersError;
    }
    res.json({
      athleteIds: members?.map((m) => m.athlete_id) || [],
      availability: team.availability || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.post("/:id/categories/:categoryId/institutions/:instId/members", async (req, res) => {
  const { athleteIds, availability } = req.body;
  try {
    const supabase = getSupabaseAdmin();
    try {
      const { data: tournamentSettings } = await supabase.from("tournament_subscription_settings").select("require_membership").eq("tournament_id", req.params.id).maybeSingle();
      if (tournamentSettings?.require_membership && athleteIds && athleteIds.length > 0) {
        const { data: tournament } = await supabase.from("tournaments").select("owner_id, start_date").eq("id", req.params.id).single();
        if (tournament) {
          const year = new Date(tournament.start_date).getFullYear();
          const { data: activeMemberships } = await supabase.from("memberships").select("member_id").eq("organization_id", tournament.owner_id).eq("year", year).eq("status", "active").in("member_id", athleteIds);
          const activeMemberIds = new Set(activeMemberships?.map((m) => m.member_id) || []);
          const inactiveIds = athleteIds.filter((aid) => !activeMemberIds.has(aid));
          if (inactiveIds.length > 0) {
            const { data: inactiveAthletes } = await supabase.from("members").select("id, full_name").in("id", inactiveIds);
            const names = inactiveAthletes?.map((a) => a.full_name).join(", ") || "alguns atletas";
            return res.status(403).json({
              error: `Os seguintes atletas n\xE3o possuem filia\xE7\xE3o ativa para esta liga em ${year}: ${names}.`
            });
          }
        }
      }
    } catch (e) {
      console.warn("Erro ao validar filia\xE7\xE3o (avan\xE7ando sem valida\xE7\xE3o):", e.message);
    }
    try {
      const { data: category } = await supabase.from("tournament_categories").select("birth_year_min, birth_year_max, name").eq("id", req.params.categoryId).single();
      if (category && (category.birth_year_min || category.birth_year_max) && athleteIds && athleteIds.length > 0) {
        const { data: athletes } = await supabase.from("members").select("id, full_name, birth_date").in("id", athleteIds);
        const incompatible = [];
        for (const athlete of athletes || []) {
          if (!athlete.birth_date) continue;
          const birthYear = new Date(athlete.birth_date).getFullYear();
          const tooOld = category.birth_year_min && birthYear < category.birth_year_min;
          const tooYoung = category.birth_year_max && birthYear > category.birth_year_max;
          if (tooOld || tooYoung) {
            incompatible.push(`${athlete.full_name} (${birthYear})`);
          }
        }
        if (incompatible.length > 0) {
          const rangeLabel = category.birth_year_min && category.birth_year_max ? `${category.birth_year_min}\u2013${category.birth_year_max}` : category.birth_year_min ? `a partir de ${category.birth_year_min}` : `at\xE9 ${category.birth_year_max}`;
          return res.status(403).json({
            error: `Os seguintes atletas n\xE3o se enquadram na faixa de nascimento da categoria "${category.name}" (nascidos ${rangeLabel}): ${incompatible.join(", ")}.`
          });
        }
      }
    } catch (e) {
      console.warn("Erro ao validar faixa de nascimento (avan\xE7ando):", e.message);
    }
    let { data: team, error: teamError } = await supabase.from("team_registrations").select("id").eq("tournament_id", req.params.id).eq("tournament_category_id", req.params.categoryId).eq("institution_id", req.params.instId).single();
    if (teamError) {
      if (teamError.message.includes("relation") || teamError.message.includes("cache")) {
        throw new Error("A tabela 'team_registrations' n\xE3o existe. Execute o script SQL presente no arquivo SUPABASE_SETUP.sql no seu Supabase.");
      }
      if (teamError.message.includes("row-level security policy")) {
        throw new Error("Erro de RLS na tabela 'team_registrations'. Verifique se a 'service_role' key est\xE1 correta ou execute o script SQL atualizado do arquivo SUPABASE_SETUP.sql.");
      }
      const { data: newTeam, error: newTeamError } = await supabase.from("team_registrations").insert([{
        tournament_id: req.params.id,
        tournament_category_id: req.params.categoryId,
        institution_id: req.params.instId,
        availability: availability || []
      }]).select().single();
      if (newTeamError) {
        if (newTeamError.message.includes("row-level security policy")) {
          throw new Error("Erro de RLS ao criar time. Verifique a 'service_role' key ou utilize o script SQL atualizado do arquivo SUPABASE_SETUP.sql.");
        }
        throw newTeamError;
      }
      team = newTeam;
    } else {
      if (availability) {
        await supabase.from("team_registrations").update({ availability }).eq("id", team.id);
      }
    }
    await supabase.from("team_members").delete().eq("team_id", team.id);
    if (athleteIds.length > 0) {
      const { error: insertError } = await supabase.from("team_members").insert(athleteIds.map((aid) => ({
        team_id: team.id,
        athlete_id: aid
      })));
      if (insertError) throw insertError;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.get("/:id/categories/:categoryId/stats", async (req, res) => {
  try {
    const { categoryId } = req.params;
    const supabase = getSupabaseAdmin();
    console.log(`[STATS] Fetching stats for category: ${categoryId}`);
    const { data: matches, error: matchesError } = await supabase.from("matches").select("id, team1_id, team2_id, score1, score2, status, round, scheduled_time, mvp_athlete_id, team1:team1_id(institution:institutions(id, name, logo_url)), team2:team2_id(institution:institutions(id, name, logo_url)), mvp_athlete:mvp_athlete_id(full_name)").eq("tournament_category_id", categoryId);
    if (matchesError) throw matchesError;
    console.log(`[STATS] Found ${matches.length} matches`);
    const teamStats = {};
    const mvpCounts = {};
    matches.forEach((m) => {
      console.log(`[STATS] Match ${m.id} - status: ${m.status}, score: ${m.score1}x${m.score2}, teams: ${m.team1_id} vs ${m.team2_id}, mvp: ${m.mvp_athlete_id}`);
      if (m.mvp_athlete_id && m.status === "finished") {
        if (!mvpCounts[m.mvp_athlete_id]) {
          const athleteData = m.mvp_athlete;
          mvpCounts[m.mvp_athlete_id] = { name: "Atleta", count: 0 };
        }
        mvpCounts[m.mvp_athlete_id].count += 1;
      }
      if (!m.team1_id || !m.team2_id) return;
      if (m.score1 === null || m.score2 === null) return;
      if (!teamStats[m.team1_id]) teamStats[m.team1_id] = { name: m.team1?.institution?.name || "Time Desconhecido", goalsFor: 0, goalsAgainst: 0 };
      if (!teamStats[m.team2_id]) teamStats[m.team2_id] = { name: m.team2?.institution?.name || "Time Desconhecido", goalsFor: 0, goalsAgainst: 0 };
      teamStats[m.team1_id].goalsFor += m.score1 || 0;
      teamStats[m.team1_id].goalsAgainst += m.score2 || 0;
      teamStats[m.team2_id].goalsFor += m.score2 || 0;
      teamStats[m.team2_id].goalsAgainst += m.score1 || 0;
    });
    const bestOffenses = Object.entries(teamStats).map(([id, stats]) => ({ id, ...stats })).sort((a, b) => b.goalsFor - a.goalsFor);
    const bestDefenses = Object.entries(teamStats).map(([id, stats]) => ({ id, ...stats })).sort((a, b) => a.goalsAgainst - b.goalsAgainst);
    const matchIds = matches.map((m) => m.id);
    let topScorers = [];
    let cards = [];
    if (matchIds.length > 0) {
      console.log(`[STATS] Fetching events for ${matchIds.length} matches...`);
      const { data: events, error: eventsError } = await supabase.from("match_events").select("*").in("match_id", matchIds);
      if (eventsError) throw eventsError;
      console.log(`[STATS] Found ${events?.length || 0} total events`);
      const playerGoals = {};
      const validEvents = (events || []).filter((e) => e.event_type && e.event_type.startsWith("goal") && e.athlete_id);
      const cardEvents = (events || []).filter((e) => e.event_type && (e.event_type === "yellow_card" || e.event_type === "red_card") && e.athlete_id);
      const combinedAthleteIds = [.../* @__PURE__ */ new Set([
        ...validEvents.map((e) => e.athlete_id),
        ...cardEvents.map((e) => e.athlete_id)
      ])];
      if (combinedAthleteIds.length > 0) {
        const [{ data: athletesObj }, { data: membersObj }] = await Promise.all([
          Promise.resolve(supabase.from("athletes").select("id, name, institution_id").in("id", combinedAthleteIds)).catch(() => ({ data: [] })),
          Promise.resolve(supabase.from("members").select("id, full_name, institution_id").in("id", combinedAthleteIds)).catch(() => ({ data: [] }))
        ]);
        const athletesMap = {};
        const athleteInstIdMap = {};
        athletesObj?.forEach((a) => {
          athletesMap[a.id] = a.name;
          if (a.institution_id) athleteInstIdMap[a.id] = a.institution_id;
        });
        membersObj?.forEach((m) => {
          athletesMap[m.id] = athletesMap[m.id] || m.full_name;
          if (m.institution_id) athleteInstIdMap[m.id] = m.institution_id;
        });
        const allInstIds = [...new Set(Object.values(athleteInstIdMap))];
        const instMap = {};
        if (allInstIds.length > 0) {
          const { data: instsObj } = await supabase.from("institutions").select("id, name").in("id", allInstIds);
          instsObj?.forEach((i) => {
            instMap[i.id] = i.name;
          });
        }
        const teamIds = [.../* @__PURE__ */ new Set([
          ...validEvents.map((e) => e.team_id).filter((id) => id),
          ...cardEvents.map((e) => e.team_id).filter((id) => id)
        ])];
        const { data: teamsObj, error: teamErr } = await supabase.from("tournament_registrations").select("id, institution:institutions(id, name, logo_url)").in("id", teamIds);
        if (teamErr) console.error("Error fetching teams:", teamErr);
        const teamsMap = {};
        teamsObj?.forEach((t) => {
          teamsMap[t.id] = t.institution?.name || "Time Desconhecido";
        });
        validEvents.forEach((e) => {
          const pts = e.event_type === "goal_2" ? 2 : e.event_type === "goal_3" ? 3 : 1;
          if (!playerGoals[e.athlete_id]) {
            const instId = athleteInstIdMap[e.athlete_id];
            const instName = instId ? instMap[instId] : null;
            playerGoals[e.athlete_id] = {
              name: athletesMap[e.athlete_id] || "Atleta",
              teamName: instName || teamsMap[e.team_id] || "Time Desconhecido",
              goals: 0
            };
          }
          playerGoals[e.athlete_id].goals += pts;
        });
        topScorers = Object.entries(playerGoals).map(([id, p]) => ({ id, ...p })).sort((a, b) => b.goals - a.goals).slice(0, 10);
        cards = cardEvents.map((e) => {
          const match = matches.find((m) => m.id === e.match_id);
          const player_name = athletesMap[e.athlete_id] || "Atleta";
          const round = match ? match.round : null;
          const game_date = match ? match.scheduled_time : null;
          const team1Name = match?.team1?.institution?.name || teamsMap[match?.team1_id] || "Time A";
          const team2Name = match?.team2?.institution?.name || teamsMap[match?.team2_id] || "Time B";
          const teamsJoined = `${team1Name} x ${team2Name}`;
          return {
            id: e.id,
            athlete_id: e.athlete_id,
            playerName: player_name,
            cardType: e.event_type === "yellow_card" ? "yellow" : "red",
            round,
            gameDate: game_date,
            teams: teamsJoined
          };
        });
      }
      console.log(`[STATS] Reduced to ${topScorers.length} top scorers`);
    }
    const topMvps = Object.entries(mvpCounts).map(([id, stats]) => ({ id, ...stats })).sort((a, b) => b.count - a.count).slice(0, 5);
    if (topMvps.length > 0) {
      const mvpIds = topMvps.map((m) => m.id);
      const [{ data: mvpAthletesObj }, { data: mvpMembersObj }] = await Promise.all([
        Promise.resolve(supabase.from("athletes").select("id, name, institution_id").in("id", mvpIds)).catch(() => ({ data: [] })),
        Promise.resolve(supabase.from("members").select("id, full_name, institution_id").in("id", mvpIds)).catch(() => ({ data: [] }))
      ]);
      const mvpMap = {};
      const mvpInstIdMap = {};
      mvpAthletesObj?.forEach((m) => {
        mvpMap[m.id] = m.name;
        if (m.institution_id) mvpInstIdMap[m.id] = m.institution_id;
      });
      mvpMembersObj?.forEach((m) => {
        mvpMap[m.id] = mvpMap[m.id] || m.full_name;
        if (m.institution_id) mvpInstIdMap[m.id] = m.institution_id;
      });
      const mvpInstIds = [...new Set(Object.values(mvpInstIdMap))];
      const instsMap = {};
      if (mvpInstIds.length > 0) {
        const { data: instsObj } = await supabase.from("institutions").select("id, name").in("id", mvpInstIds);
        instsObj?.forEach((i) => {
          instsMap[i.id] = i.name;
        });
      }
      topMvps.forEach((m) => {
        m.name = mvpMap[m.id] || "Atleta Desconhecido";
        const instId = mvpInstIdMap[m.id];
        m.teamName = instId ? instsMap[instId] : "Time Desconhecido";
      });
    }
    res.json({
      topScorers,
      bestOffenses,
      bestDefenses,
      topMvps,
      cards
    });
  } catch (error) {
    console.error("[STATS ERROR]", error);
    res.status(500).json({ error: error.message });
  }
});
router2.get("/:id/categories/:categoryId/matches", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("matches").select(`
        *,
        team1:team1_id(id, availability, institution:institutions(id, name, logo_url)),
        team2:team2_id(id, availability, institution:institutions(id, name, logo_url)),
        winner:winner_id(id, institution:institutions(id, name, logo_url)),
        venue:venue_id(*)
      `).eq("tournament_id", req.params.id).eq("tournament_category_id", req.params.categoryId).order("round", { ascending: true }).order("match_index", { ascending: true });
    if (error) {
      if (error.message.includes("relation") || error.message.includes("cache")) return res.json([]);
      throw error;
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.get("/:id/categories/:categoryId/teams", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("team_registrations").select("*, institution:institutions(id, name, logo_url)").eq("tournament_id", req.params.id).eq("tournament_category_id", req.params.categoryId);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
function backendCalculateStandings(matches) {
  const teamsMap = {};
  matches.forEach((match) => {
    if (!match.team1_id || !match.team2_id) return;
    [match.team1_id, match.team2_id].forEach((id) => {
      if (!teamsMap[id]) {
        const team = id === match.team1_id ? match.team1 : match.team2;
        teamsMap[id] = {
          id,
          name: team?.institution?.name || "Time Desconhecido",
          points: 0,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          sg: 0
        };
      }
    });
    if (match.status === "finished") {
      const t1 = teamsMap[match.team1_id];
      const t2 = teamsMap[match.team2_id];
      t1.played++;
      t2.played++;
      t1.goalsFor += match.score1 || 0;
      t1.goalsAgainst += match.score2 || 0;
      t2.goalsFor += match.score2 || 0;
      t2.goalsAgainst += match.score1 || 0;
      if (match.score1 > match.score2) {
        t1.points += 3;
        t1.wins++;
        t2.losses++;
      } else if (match.score2 > match.score1) {
        t2.points += 3;
        t2.wins++;
        t1.losses++;
      } else {
        t1.points += 1;
        t2.points += 1;
        t1.draws++;
        t2.draws++;
      }
      t1.sg = t1.goalsFor - t1.goalsAgainst;
      t2.sg = t2.goalsFor - t2.goalsAgainst;
    }
  });
  return Object.values(teamsMap).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.sg !== a.sg) return b.sg - a.sg;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.goalsFor - a.goalsFor;
  });
}
router2.post("/:id/categories/:categoryId/matches/generate", async (req, res) => {
  const { id: tournamentId, categoryId } = req.params;
  const { system = "single", groupCount = 1, seeds = [], phase_index = 1, phase_name = "Fase \xDAnica", team_ids, group_label } = req.body;
  try {
    const supabase = getSupabaseAdmin();
    let checkQuery = supabase.from("matches").select("*", { count: "exact", head: true }).eq("tournament_category_id", categoryId).eq("phase_index", phase_index);
    if (group_label) {
      checkQuery = checkQuery.eq("group_label", group_label);
    }
    const { count } = await checkQuery;
    if (count && count > 0) {
      return res.status(400).json({ error: `Chaveamento j\xE1 gerado para esta subdivis\xE3o/fase.` });
    }
    const { data: category } = await supabase.from("tournament_categories").select("rules_config").eq("id", categoryId).single();
    const isCombat = category?.rules_config?.sport_type === "combat";
    let competitors = [];
    if (isCombat) {
      const { data: subs, error: subsError } = await supabase.from("athlete_subscriptions").select(`
          id,
          athlete_name,
          institution_id,
          additional_data,
          institution:institutions(id, name)
        `).eq("tournament_id", tournamentId).eq("category_id", categoryId).eq("validation_status", "approved");
      if (subsError) throw subsError;
      const filteredSubs = (subs || []).filter((sub) => {
        const age = sub.additional_data?.age_group || "";
        const grad = sub.additional_data?.graduation || "";
        const wt = sub.additional_data?.weight_class || "";
        const label = `${age} - ${grad} - ${wt}`;
        return !group_label || label === group_label;
      });
      const { data: catTeams } = await supabase.from("team_registrations").select("id, institution_id").eq("tournament_category_id", categoryId);
      competitors = filteredSubs.map((sub) => {
        const teamReg = catTeams?.find((t) => t.institution_id === sub.institution_id);
        const inst = Array.isArray(sub.institution) ? sub.institution[0] : sub.institution;
        return {
          id: sub.id,
          // virtual id (athlete subscription id)
          name: sub.athlete_name,
          team_registration_id: teamReg?.id || null,
          institution_name: inst?.name || "Avulso"
        };
      });
      if (team_ids && Array.isArray(team_ids) && team_ids.length > 0) {
        const selectedSet = new Set(team_ids);
        competitors = competitors.filter((c) => selectedSet.has(c.id));
      }
    } else {
      let teamsList = [];
      if (team_ids && Array.isArray(team_ids) && team_ids.length > 0) {
        const { data: filterTeams, error: teamsError } = await supabase.from("team_registrations").select("id, institution:institutions(id, name)").eq("tournament_category_id", categoryId).in("id", team_ids);
        if (teamsError) throw teamsError;
        teamsList = filterTeams || [];
      } else {
        const { data: allTeams, error: teamsError } = await supabase.from("team_registrations").select("id, institution:institutions(id, name)").eq("tournament_category_id", categoryId);
        if (teamsError) throw teamsError;
        teamsList = allTeams || [];
      }
      competitors = teamsList.map((t) => ({
        id: t.id,
        name: t.institution?.name || "Sem Nome",
        team_registration_id: t.id,
        institution_name: t.institution?.name || ""
      }));
    }
    if (!competitors || competitors.length < 2) {
      return res.status(400).json({ error: "N\xFAmero insuficiente de competidores para gerar o chaveamento (m\xEDnimo 2)." });
    }
    const seedIds = new Set(seeds);
    const seededCompetitors = competitors.filter((c) => seedIds.has(c.id)).sort(() => Math.random() - 0.5);
    const regularCompetitors = competitors.filter((c) => !seedIds.has(c.id)).sort(() => Math.random() - 0.5);
    let pairs = [];
    let usePairs = false;
    if (system === "single" && phase_index > 1) {
      try {
        if (category?.rules_config?.phases && Array.isArray(category.rules_config.phases)) {
          const prevPhase = category.rules_config.phases[phase_index - 2];
          if (prevPhase && (prevPhase.system === "groups" || prevPhase.system === "group_vs_group")) {
            const { data: prevMatches, error: prevMatchesError } = await supabase.from("matches").select(`
                *,
                team1:team1_id(id, availability, institution:institutions(id, name, logo_url)),
                team2:team2_id(id, availability, institution:institutions(id, name, logo_url)),
                winner:winner_id(id, institution:institutions(id, name, logo_url))
              `).eq("tournament_id", tournamentId).eq("tournament_category_id", categoryId).eq("phase_index", phase_index - 1);
            if (!prevMatchesError && prevMatches && prevMatches.length > 0) {
              const selectedCompetitorSet = new Set(competitors.map((c) => c.id));
              const groupMatches = {};
              prevMatches.forEach((m) => {
                const label = m.group_label || "Geral";
                if (!groupMatches[label]) groupMatches[label] = [];
                groupMatches[label].push(m);
              });
              const groupStandings = {};
              Object.entries(groupMatches).forEach(([label, matches]) => {
                const delimiterRegex = /\s+[xX]\s+/;
                if (delimiterRegex.test(label)) {
                  const parts = label.split(delimiterRegex);
                  const leftName = parts[0].trim();
                  const rightName = parts[1].trim();
                  const leftTeamIds = new Set(matches.map((m) => m.team1_id).filter(Boolean));
                  const rightTeamIds = new Set(matches.map((m) => m.team2_id).filter(Boolean));
                  const standings = backendCalculateStandings(matches);
                  groupStandings[leftName] = standings.filter((t) => leftTeamIds.has(t.id)).filter((t) => selectedCompetitorSet.has(t.id));
                  groupStandings[rightName] = standings.filter((t) => rightTeamIds.has(t.id)).filter((t) => selectedCompetitorSet.has(t.id));
                } else {
                  const standings = backendCalculateStandings(matches);
                  groupStandings[label] = standings.filter((t) => selectedCompetitorSet.has(t.id));
                }
              });
              const groupLabels = Object.keys(groupStandings).sort();
              if (prevPhase.system === "groups") {
                const numGroups = groupLabels.length;
                const pairedGroups = /* @__PURE__ */ new Set();
                for (let g = 0; g < numGroups; g++) {
                  const g1 = groupLabels[g];
                  if (pairedGroups.has(g1)) continue;
                  const oppIndex = numGroups - 1 - g;
                  const g2 = groupLabels[oppIndex];
                  if (g1 === g2) {
                    const ranked = groupStandings[g1] || [];
                    const len = ranked.length;
                    for (let i = 0; i < Math.floor(len / 2); i++) {
                      pairs.push([ranked[i], ranked[len - 1 - i]]);
                    }
                    if (len % 2 !== 0) {
                      pairs.push([ranked[Math.floor(len / 2)], null]);
                    }
                  } else {
                    pairedGroups.add(g1);
                    pairedGroups.add(g2);
                    const ranked1 = groupStandings[g1] || [];
                    const ranked2 = groupStandings[g2] || [];
                    const count2 = Math.max(ranked1.length, ranked2.length);
                    for (let i = 0; i < count2; i++) {
                      const t1 = ranked1[i] || null;
                      const t2 = ranked2[ranked2.length - 1 - i] || null;
                      if (t1 || t2) {
                        pairs.push([t1, t2]);
                      }
                    }
                  }
                }
                usePairs = pairs.length > 0;
              } else if (prevPhase.system === "group_vs_group") {
                groupLabels.forEach((label) => {
                  const ranked = groupStandings[label] || [];
                  const len = ranked.length;
                  for (let i = 0; i < Math.floor(len / 2); i++) {
                    pairs.push([ranked[i], ranked[len - 1 - i]]);
                  }
                  if (len % 2 !== 0) {
                    pairs.push([ranked[Math.floor(len / 2)], null]);
                  }
                });
                usePairs = pairs.length > 0;
              }
            }
          }
        }
      } catch (err) {
        console.error("Erro ao calcular pareamento baseado na fase anterior:", err);
      }
    }
    const shuffledCompetitors = [...seededCompetitors, ...regularCompetitors];
    if (system === "single") {
      const numCompetitors = shuffledCompetitors.length;
      const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(numCompetitors)));
      const rounds = Math.ceil(Math.log2(numCompetitors));
      const matchesInRound1 = nextPowerOf2 / 2;
      const round1Matches = [];
      for (let i = 0; i < matchesInRound1; i++) {
        let c1 = null;
        let c2 = null;
        if (usePairs) {
          const pair = pairs[i];
          if (pair) {
            c1 = pair[0];
            c2 = pair[1];
          }
        } else {
          c1 = shuffledCompetitors[i * 2] || null;
          c2 = shuffledCompetitors[i * 2 + 1] || null;
        }
        const t1Id = c1 ? c1.team_registration_id : null;
        const t2Id = c2 ? c2.team_registration_id : null;
        round1Matches.push({
          tournament_id: tournamentId,
          tournament_category_id: categoryId,
          team1_id: t1Id,
          team2_id: t2Id,
          roster1: c1 && isCombat ? { athlete_id: c1.id, athlete_name: c1.name, institution_name: c1.institution_name } : {},
          roster2: c2 && isCombat ? { athlete_id: c2.id, athlete_name: c2.name, institution_name: c2.institution_name } : {},
          round: 1,
          match_index: i,
          status: t1Id && t2Id ? "scheduled" : t1Id || t2Id ? "finished" : "scheduled",
          winner_id: t1Id && !t2Id ? t1Id : !t1Id && t2Id ? t2Id : null,
          phase_index,
          phase_name,
          group_label: group_label || null
        });
      }
      const { data: createdRound1, error: r1Error } = await supabase.from("matches").insert(round1Matches).select();
      if (r1Error) throw r1Error;
      let prevRoundMatches = createdRound1;
      for (let r = 2; r <= rounds; r++) {
        const numMatchesInRound = Math.pow(2, rounds - r);
        const nextRoundMatches = [];
        for (let i = 0; i < numMatchesInRound; i++) {
          nextRoundMatches.push({
            tournament_id: tournamentId,
            tournament_category_id: categoryId,
            team1_id: null,
            team2_id: null,
            roster1: {},
            roster2: {},
            round: r,
            match_index: i,
            status: "scheduled",
            phase_index,
            phase_name,
            group_label: group_label || null
          });
        }
        const { data: createdRound, error: rError } = await supabase.from("matches").insert(nextRoundMatches).select();
        if (rError) throw rError;
        for (let i = 0; i < prevRoundMatches.length; i++) {
          const parentIndex = Math.floor(i / 2);
          const parentMatch = createdRound.find((m) => m.match_index === parentIndex);
          if (parentMatch) {
            await supabase.from("matches").update({ next_match_id: parentMatch.id }).eq("id", prevRoundMatches[i].id);
          }
        }
        prevRoundMatches = createdRound;
      }
    } else if (system === "groups") {
      const groups = Array.from({ length: groupCount }, () => []);
      seededCompetitors.forEach((c, index) => {
        groups[index % groupCount].push(c);
      });
      regularCompetitors.forEach((c, index) => {
        const groupIndex = (seededCompetitors.length + index) % groupCount;
        groups[groupIndex].push(c);
      });
      const matchesToInsert = [];
      groups.forEach((groupComps, groupIdx) => {
        const groupLabelStr = String.fromCharCode(65 + groupIdx);
        const label = group_label ? `${group_label} - Grupo ${groupLabelStr}` : groupLabelStr;
        for (let i = 0; i < groupComps.length; i++) {
          for (let j = i + 1; j < groupComps.length; j++) {
            const c1 = groupComps[i];
            const c2 = groupComps[j];
            matchesToInsert.push({
              tournament_id: tournamentId,
              tournament_category_id: categoryId,
              team1_id: c1.team_registration_id,
              team2_id: c2.team_registration_id,
              roster1: isCombat ? { athlete_id: c1.id, athlete_name: c1.name, institution_name: c1.institution_name } : {},
              roster2: isCombat ? { athlete_id: c2.id, athlete_name: c2.name, institution_name: c2.institution_name } : {},
              round: 1,
              group_label: label,
              match_index: matchesToInsert.length,
              status: "scheduled",
              phase_index,
              phase_name
            });
          }
        }
      });
      const { error: gError } = await supabase.from("matches").insert(matchesToInsert);
      if (gError) throw gError;
    } else if (system === "group_vs_group") {
      const actualGroupCount = groupCount % 2 === 0 ? groupCount : groupCount + 1;
      const groups = Array.from({ length: actualGroupCount }, () => []);
      shuffledCompetitors.forEach((c, index) => {
        groups[index % actualGroupCount].push(c);
      });
      const matchesToInsert = [];
      for (let g = 0; g < actualGroupCount; g += 2) {
        const groupA = groups[g];
        const groupB = groups[g + 1];
        const groupALabel = String.fromCharCode(65 + g);
        const groupBLabel = String.fromCharCode(65 + g + 1);
        const pairingLabel = `${groupALabel} x ${groupBLabel}`;
        const label = group_label ? `${group_label} - ${pairingLabel}` : pairingLabel;
        groupA.forEach((cA) => {
          groupB.forEach((cB) => {
            matchesToInsert.push({
              tournament_id: tournamentId,
              tournament_category_id: categoryId,
              team1_id: cA.team_registration_id,
              team2_id: cB.team_registration_id,
              roster1: isCombat ? { athlete_id: cA.id, athlete_name: cA.name, institution_name: cA.institution_name } : {},
              roster2: isCombat ? { athlete_id: cB.id, athlete_name: cB.name, institution_name: cB.institution_name } : {},
              round: 1,
              group_label: label,
              match_index: matchesToInsert.length,
              status: "scheduled",
              phase_index,
              phase_name
            });
          });
        });
      }
      if (matchesToInsert.length > 0) {
        const { error: gvError } = await supabase.from("matches").insert(matchesToInsert);
        if (gvError) throw gvError;
      }
    }
    res.json({ message: "Chaveamento gerado com sucesso." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.patch("/matches/:matchId", async (req, res) => {
  const {
    score1,
    score2,
    winner_id,
    status,
    timer_base_seconds,
    timer_last_started_at,
    is_timer_running,
    period,
    report,
    mvp_athlete_id,
    roster1,
    roster2,
    sets_detail
  } = req.body;
  const { matchId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    const updatePayload = {};
    if (score1 !== void 0) updatePayload.score1 = score1;
    if (score2 !== void 0) updatePayload.score2 = score2;
    if (winner_id !== void 0) updatePayload.winner_id = winner_id;
    if (status !== void 0) updatePayload.status = status;
    if (timer_base_seconds !== void 0) updatePayload.timer_base_seconds = timer_base_seconds;
    if (timer_last_started_at !== void 0) updatePayload.timer_last_started_at = timer_last_started_at;
    if (is_timer_running !== void 0) updatePayload.is_timer_running = is_timer_running;
    if (period !== void 0) updatePayload.period = period;
    if (report !== void 0) updatePayload.report = report;
    if (mvp_athlete_id !== void 0) updatePayload.mvp_athlete_id = mvp_athlete_id;
    if (roster1 !== void 0) updatePayload.roster1 = roster1;
    if (roster2 !== void 0) updatePayload.roster2 = roster2;
    if (sets_detail !== void 0) updatePayload.sets_detail = sets_detail;
    const { data: updatedMatch, error } = await supabase.from("matches").update(updatePayload).eq("id", matchId).select(`
        *,
        tournament:tournament_id(name),
        category:tournament_category_id(name, gender, age_group),
        team1:team1_id(id, institution:institutions(id, name, logo_url)),
        team2:team2_id(id, institution:institutions(id, name, logo_url)),
        winner:winner_id(id, institution:institutions(id, name, logo_url)),
        referee1:referee1_id(name),
        referee2:referee2_id(name),
        table_official:table_official_id(name)
      `).single();
    if (error) throw error;
    let finalWinnerId = winner_id || updatedMatch?.winner_id;
    if (status === "finished" && !finalWinnerId && updatedMatch) {
      if ((updatedMatch.score1 || 0) > (updatedMatch.score2 || 0)) {
        finalWinnerId = updatedMatch.team1_id;
      } else if ((updatedMatch.score2 || 0) > (updatedMatch.score1 || 0)) {
        finalWinnerId = updatedMatch.team2_id;
      }
      if (finalWinnerId) {
        await supabase.from("matches").update({ winner_id: finalWinnerId }).eq("id", matchId);
        updatedMatch.winner_id = finalWinnerId;
      }
    }
    if (status === "finished" && finalWinnerId && updatedMatch.next_match_id) {
      const isTeam1 = updatedMatch.match_index % 2 === 0;
      const isCombatMatch = updatedMatch.roster1 && updatedMatch.roster1.athlete_name || updatedMatch.roster2 && updatedMatch.roster2.athlete_name;
      let winnerRoster = {};
      if (isCombatMatch) {
        if (finalWinnerId === updatedMatch.team1_id) {
          winnerRoster = updatedMatch.roster1 || {};
        } else if (finalWinnerId === updatedMatch.team2_id) {
          winnerRoster = updatedMatch.roster2 || {};
        }
      }
      const updateData = isTeam1 ? { team1_id: finalWinnerId, ...isCombatMatch ? { roster1: winnerRoster } : {} } : { team2_id: finalWinnerId, ...isCombatMatch ? { roster2: winnerRoster } : {} };
      await supabase.from("matches").update(updateData).eq("id", updatedMatch.next_match_id);
    }
    res.json(updatedMatch);
  } catch (error) {
    console.error("[PATCH MATCH ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
});
router2.delete("/:id/categories/:categoryId/matches", async (req, res) => {
  const { categoryId } = req.params;
  const phase_index = req.query.phase_index ? parseInt(req.query.phase_index, 10) : void 0;
  const group_label = req.query.group_label;
  try {
    const supabase = getSupabaseAdmin();
    let queryUpdate = supabase.from("matches").update({ next_match_id: null }).eq("tournament_category_id", categoryId);
    let queryDelete = supabase.from("matches").delete().eq("tournament_category_id", categoryId);
    if (phase_index !== void 0 && !isNaN(phase_index)) {
      queryUpdate = queryUpdate.eq("phase_index", phase_index);
      queryDelete = queryDelete.eq("phase_index", phase_index);
    }
    if (group_label) {
      queryUpdate = queryUpdate.eq("group_label", group_label);
      queryDelete = queryDelete.eq("group_label", group_label);
    }
    await queryUpdate;
    const { error } = await queryDelete;
    if (error) throw error;
    res.json({ message: "Chaveamento resetado com sucesso." });
  } catch (error) {
    console.error("Erro ao resetar chaveamento:", error);
    res.status(500).json({ error: error.message });
  }
});
router2.get("/teams/:teamId/athletes", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: teamMembers, error: tmError } = await supabase.from("team_members").select("athlete_id").eq("team_id", req.params.teamId);
    if (tmError) throw tmError;
    let athleteIds = teamMembers?.map((tm) => tm.athlete_id) || [];
    if (athleteIds.length === 0) {
      const { data: teamInfo } = await supabase.from("team_registrations").select("institution_id").eq("id", req.params.teamId).single();
      if (teamInfo?.institution_id) {
        const [{ data: instMembers }, { data: legacyInstMembers }] = await Promise.all([
          supabase.from("members").select("id, full_name, document_number").eq("institution_id", teamInfo.institution_id),
          supabase.from("athletes").select("id, name, document_number").eq("institution_id", teamInfo.institution_id)
        ]);
        const consolidatedFallback = [
          ...instMembers?.map((m) => ({ ...m, name: m.full_name })) || [],
          ...legacyInstMembers?.map((la) => ({ ...la, full_name: la.name })) || []
        ];
        if (consolidatedFallback.length > 0) {
          return res.json(consolidatedFallback);
        }
      }
    }
    if (athleteIds.length === 0) return res.json([]);
    const { data: members, error: mError } = await supabase.from("members").select("id, full_name, document_number").in("id", athleteIds);
    const { data: legacyAthletes, error: laError } = await supabase.from("athletes").select("id, name, document_number").in("id", athleteIds);
    const consolidated = athleteIds.map((id) => {
      const member = members?.find((m) => m.id === id);
      const legacy = legacyAthletes?.find((la) => la.id === id);
      if (member) return { ...member, name: member.full_name };
      if (legacy) return { ...legacy, full_name: legacy.name };
      return null;
    }).filter((a) => a !== null);
    res.json(consolidated);
  } catch (error) {
    console.error("Erro ao listar atletas:", error);
    res.status(500).json({ error: error.message });
  }
});
router2.get("/matches/:matchId/events", async (req, res) => {
  const { matchId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    console.log(`[GET EVENTS] Fetching events for match: ${matchId}`);
    const { data, error } = await supabase.from("match_events").select("*").eq("match_id", matchId).order("created_at", { ascending: true });
    if (error) {
      console.error(`[GET EVENTS] Supabase Error:`, JSON.stringify(error, null, 2));
      return res.status(500).json({ error: error.message, details: error.details, code: error.code });
    }
    console.log(`[GET EVENTS] Found ${data?.length || 0} events`);
    if (!data || data.length === 0) return res.json([]);
    const athleteIds = [...new Set(data.map((e) => e.athlete_id).filter((id) => id && id !== ""))];
    let athletesMap = {};
    if (athleteIds.length > 0) {
      try {
        const [{ data: members, error: meError }, { data: legacy, error: leError }] = await Promise.all([
          supabase.from("members").select("id, full_name").in("id", athleteIds),
          supabase.from("athletes").select("*").in("id", athleteIds)
        ]);
        if (meError) console.warn("[GET EVENTS] Members lookup error:", meError.message);
        if (leError) console.warn("[GET EVENTS] Legacy athletes lookup error:", leError.message);
        members?.forEach((m) => {
          athletesMap[m.id] = m.full_name;
        });
        legacy?.forEach((l) => {
          athletesMap[l.id] = l.name || l.full_name || "Atleta";
        });
      } catch (lookupError) {
        console.error("[GET EVENTS] Error during athlete name lookup:", lookupError);
      }
    }
    const eventsWithAthletes = data.map((e) => ({
      ...e,
      athlete: e.athlete_id ? { id: e.athlete_id, full_name: athletesMap[e.athlete_id] || "Atleta" } : null
    }));
    res.json(eventsWithAthletes);
  } catch (error) {
    console.error(`[GET EVENTS] Critical catch error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});
router2.post("/matches/:matchId/events", async (req, res) => {
  const { team_id, athlete_id, event_type, event_time, period } = req.body;
  const { matchId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    console.log(`[POST EVENT] Type: ${event_type}, Team: ${team_id}, Match: ${matchId}, Athlete: ${athlete_id}, Period: ${period}`);
    const payload = {
      match_id: matchId,
      team_id: team_id || null,
      athlete_id: athlete_id || null,
      event_type,
      event_time
    };
    if (period !== void 0) {
      payload.period = period;
    }
    const { data: event, error: eventError } = await supabase.from("match_events").insert(payload).select().single();
    if (eventError) {
      console.error("[POST EVENT] Supabase error:", JSON.stringify(eventError, null, 2));
      return res.status(500).json({
        error: eventError.message,
        details: eventError.details,
        hint: eventError.hint,
        code: eventError.code
      });
    }
    if (event_type.startsWith("goal")) {
      const parts = event_type.split("_");
      const points = parts.length > 1 ? parseInt(parts[1], 10) : 1;
      try {
        const { data: currentMatch, error: matchFetchError } = await supabase.from("matches").select("score1, score2, team1_id").eq("id", matchId).single();
        if (matchFetchError) throw matchFetchError;
        if (currentMatch) {
          const isTeam1 = currentMatch.team1_id === team_id;
          const updateData = isTeam1 ? { score1: (currentMatch.score1 || 0) + points } : { score2: (currentMatch.score2 || 0) + points };
          const { error: matchUpdateError } = await supabase.from("matches").update(updateData).eq("id", matchId);
          if (matchUpdateError) console.error("[POST EVENT] Failed to update scoreboard:", matchUpdateError.message);
        }
      } catch (placarError) {
        console.error("[POST EVENT] Error updating scoreboard:", placarError.message);
      }
    }
    res.json(event);
  } catch (error) {
    console.error(`[POST EVENT] Critical catch error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});
router2.delete("/matches/:matchId/events/:eventId", async (req, res) => {
  const { matchId, eventId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    console.log(`[DELETE EVENT] Attempting to delete event ${eventId} from match ${matchId}`);
    const { data: event, error: fetchError } = await supabase.from("match_events").select("*").eq("id", eventId).single();
    if (fetchError) {
      console.error(`[DELETE EVENT] Error fetching event: ${fetchError.message}`);
      if (fetchError.code === "PGRST116") {
        return res.status(404).json({ error: "Evento n\xE3o encontrado" });
      }
      throw fetchError;
    }
    if (event && event.event_type.startsWith("goal")) {
      const parts = event.event_type.split("_");
      const points = parts.length > 1 ? parseInt(parts[1], 10) : 1;
      console.log(`[DELETE EVENT] Event was a goal for team ${event.team_id} with ${points} points. Decrementing score.`);
      const { data: match, error: matchError } = await supabase.from("matches").select("*").eq("id", matchId).single();
      if (matchError) {
        console.error(`[DELETE EVENT] Error fetching match for score update: ${matchError.message}`);
      } else if (match) {
        const isTeam1 = match.team1_id === event.team_id;
        const updateData = isTeam1 ? { score1: Math.max(0, (match.score1 || 0) - points) } : { score2: Math.max(0, (match.score2 || 0) - points) };
        console.log(`[DELETE EVENT] Updating match ${matchId} score data:`, updateData);
        const { error: updateError } = await supabase.from("matches").update(updateData).eq("id", matchId);
        if (updateError) console.error(`[DELETE EVENT] Score update error: ${updateError.message}`);
      }
    } else if (event && (event.event_type === "point" || event.event_type === "baleado_point")) {
      console.log(`[DELETE EVENT] Event was a set point for team ${event.team_id}. Decrementing sets_detail.`);
      const { data: match, error: matchError } = await supabase.from("matches").select("*").eq("id", matchId).single();
      if (match && match.sets_detail) {
        const isTeam1 = match.team1_id === event.team_id;
        const updatedSets = [...match.sets_detail || []];
        if (updatedSets.length > 0) {
          const activeIdx = updatedSets.length - 1;
          const set = { ...updatedSets[activeIdx] };
          set.team1 = Math.max(0, (set.team1 || 0) - (isTeam1 ? 1 : 0));
          set.team2 = Math.max(0, (set.team2 || 0) - (!isTeam1 ? 1 : 0));
          updatedSets[activeIdx] = set;
          console.log(`[DELETE EVENT] Updating match ${matchId} sets_detail:`, updatedSets);
          const { error: updateError } = await supabase.from("matches").update({ sets_detail: updatedSets }).eq("id", matchId);
          if (updateError) console.error(`[DELETE EVENT] sets_detail update error: ${updateError.message}`);
        }
      }
    } else if (event && event.event_type === "revive") {
      console.log(`[DELETE EVENT] Event was a revive for team ${event.team_id}. Incrementing sets_detail.`);
      const { data: match, error: matchError } = await supabase.from("matches").select("*").eq("id", matchId).single();
      if (match && match.sets_detail) {
        const isTeam1 = match.team1_id === event.team_id;
        const updatedSets = [...match.sets_detail || []];
        if (updatedSets.length > 0) {
          const activeIdx = updatedSets.length - 1;
          const set = { ...updatedSets[activeIdx] };
          set.team1 = (set.team1 || 0) + (!isTeam1 ? 1 : 0);
          set.team2 = (set.team2 || 0) + (isTeam1 ? 1 : 0);
          updatedSets[activeIdx] = set;
          console.log(`[DELETE EVENT] Updating match ${matchId} sets_detail (revive delete):`, updatedSets);
          const { error: updateError } = await supabase.from("matches").update({ sets_detail: updatedSets }).eq("id", matchId);
          if (updateError) console.error(`[DELETE EVENT] sets_detail update error: ${updateError.message}`);
        }
      }
    }
    const { error: deleteError } = await supabase.from("match_events").delete().eq("id", eventId);
    if (deleteError) {
      console.error(`[DELETE EVENT] Delete error: ${deleteError.message}`);
      throw deleteError;
    }
    console.log(`[DELETE EVENT] Event ${eventId} deleted successfully`);
    res.json({ message: "Evento removido com sucesso." });
  } catch (error) {
    console.error(`[DELETE EVENT] Critical error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});
router2.get("/venues/all", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const organizerId = req.user.id;
    const { role } = getUserRoleAndReferenceId2(organizerId);
    let useLocalFallback = false;
    let data = null;
    let error = null;
    try {
      let query = supabase.from("venues").select("*");
      if (role !== "super_admin") {
        query = query.eq("organizer_id", organizerId);
      }
      const resDb = await query.order("name");
      data = resDb.data;
      error = resDb.error;
      if (error && (error.message.includes("column") || error.message.includes("organizer_id"))) {
        useLocalFallback = true;
      }
    } catch (e) {
      useLocalFallback = true;
    }
    if (useLocalFallback) {
      await ensureStaffAndVenuesMappings();
      const { data: allData, error: allErr } = await supabase.from("venues").select("*").order("name");
      if (allErr) {
        if (allErr.message.includes("relation") || allErr.message.includes("cache")) return res.json([]);
        throw allErr;
      }
      if (organizerId && role !== "super_admin") {
        const mapping = loadOrgVenues();
        const allowedIds = mapping[organizerId] || [];
        const filtered = (allData || []).filter((v) => allowedIds.includes(v.id));
        return res.json(filtered);
      }
      return res.json(allData || []);
    }
    if (error) {
      if (error.message.includes("relation") || error.message.includes("cache")) return res.json([]);
      throw error;
    }
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.post("/venues", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const organizerId = req.user.id;
    const { role } = getUserRoleAndReferenceId2(organizerId);
    const { id, ...venueData } = req.body;
    try {
      let result;
      if (id) {
        let updateQuery = supabase.from("venues").update(venueData).eq("id", id);
        if (role !== "super_admin") {
          updateQuery = updateQuery.eq("organizer_id", organizerId);
        }
        result = await updateQuery.select().single();
      } else {
        const insertData = { ...req.body, organizer_id: organizerId };
        result = await supabase.from("venues").insert([insertData]).select().single();
      }
      const { data, error } = result;
      if (error) {
        if (error.message.includes("column") || error.message.includes("organizer_id")) {
          throw new Error("fallback_to_json");
        }
        throw error;
      }
      return res.json(data);
    } catch (dbErr) {
      if (dbErr.message === "fallback_to_json") {
        let result;
        if (id) {
          result = await supabase.from("venues").update(venueData).eq("id", id).select().single();
        } else {
          result = await supabase.from("venues").insert([req.body]).select().single();
        }
        const { data, error } = result;
        if (error) throw error;
        if (organizerId && data?.id && !id) {
          await ensureStaffAndVenuesMappings();
          const mapping = loadOrgVenues();
          if (!mapping[organizerId]) {
            mapping[organizerId] = [];
          }
          mapping[organizerId].push(data.id);
          saveOrgVenues(mapping);
        }
        return res.json(data);
      }
      throw dbErr;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.delete("/venues/:id", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const organizerId = req.user.id;
    const venueId = req.params.id;
    const { error } = await supabase.from("venues").delete().eq("id", venueId);
    if (error) throw error;
    if (organizerId) {
      await ensureStaffAndVenuesMappings();
      const mapping = loadOrgVenues();
      if (mapping[organizerId]) {
        mapping[organizerId] = mapping[organizerId].filter((id) => id !== venueId);
        saveOrgVenues(mapping);
      }
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var DATA_FILE = path2.join(process.cwd(), "src/backend/data/subscriptions.json");
function loadDb() {
  try {
    if (!fs2.existsSync(DATA_FILE)) {
      const dir = path2.dirname(DATA_FILE);
      if (!fs2.existsSync(dir)) {
        fs2.mkdirSync(dir, { recursive: true });
      }
      fs2.writeFileSync(DATA_FILE, JSON.stringify({ settings: {}, athleteSubscriptions: [] }, null, 2));
    }
    const raw = fs2.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading subscriptions.json", err);
    return { settings: {}, athleteSubscriptions: [] };
  }
}
function saveDb(db) {
  try {
    const dir = path2.dirname(DATA_FILE);
    if (!fs2.existsSync(dir)) {
      fs2.mkdirSync(dir, { recursive: true });
    }
    fs2.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("Error writing subscriptions.json", err);
  }
}
function getDefaultRegistrationConfig() {
  return {
    fields: [
      { id: "parentName", label: "Nome do Respons\xE1vel", enabled: true, required: true, custom: false },
      { id: "parentPhone", label: "Telefone do Respons\xE1vel", enabled: true, required: true, custom: false },
      { id: "bloodType", label: "Tipo Sangu\xEDneo", enabled: true, required: false, custom: false },
      { id: "allergies", label: "Alergias / Restri\xE7\xF5es", enabled: true, required: false, custom: false },
      { id: "emergencyContact", label: "Contato de Emerg\xEAncia", enabled: true, required: true, custom: false }
    ],
    uploads: [
      { id: "document", label: "Documento de Identidade (RG/CPF)", enabled: true, required: true, custom: false },
      { id: "photo", label: "Foto de Rosto (3x4)", enabled: true, required: true, custom: false }
    ],
    terms: [
      {
        id: "imageUse",
        title: "1. Concess\xE3o de Direito de Uso de Imagem",
        content: "Autorizo expressamente o organizador do torneio a capturar e utilizar imagens, v\xEDdeos e transmiss\xF5es de \xE1udio nas quais o atleta participante figure, com finalidade puramente de divulga\xE7\xE3o esportiva, cobertura oficial das partidas, publica\xE7\xF5es em m\xEDdias impressas, redes sociais e portal oficial da competi\xE7\xE3o, sem que isso gere qualquer direito a retribui\xE7\xE3o financeira.",
        enabled: true,
        required: true
      },
      {
        id: "liability",
        title: "2. Termo de Aptid\xE3o F\xEDsica e Responsabilidade",
        content: "Declaro estar inteiramente ciente das regras oficiais do torneio. Sob as penas da lei, declaro que o atleta encontra-se plenamente apto e saud\xE1vel para a participa\xE7\xE3o em esportes competitivos, gozando de perfeita sa\xFAde f\xEDsica e mental. Isento de qualquer responsabilidade civil ou criminal os realizadores, a institui\xE7\xE3o escolar representativa e os patrocinadores por acidentes, imprevistos ou perdas decorrentes do andamento regular dos jogos.",
        enabled: true,
        required: true
      }
    ]
  };
}
function mapSettingsToFrontend(dbSettings) {
  if (!dbSettings) return null;
  return {
    deadline: dbSettings.deadline || "",
    feeType: dbSettings.fee_type || "free",
    teamFee: Number(dbSettings.team_fee) || 0,
    athleteFee: Number(dbSettings.athlete_fee) || 0,
    status: dbSettings.status || "open",
    requireMembership: !!dbSettings.require_membership,
    registrationConfig: dbSettings.registration_config || getDefaultRegistrationConfig(),
    maxVisitorsPerAthlete: Number(dbSettings.max_visitors_per_athlete) || 0
  };
}
function mapSettingsToDb(feSettings) {
  return {
    deadline: feSettings.deadline || "",
    fee_type: feSettings.feeType || "free",
    team_fee: Number(feSettings.teamFee) || 0,
    athlete_fee: Number(feSettings.athleteFee) || 0,
    status: feSettings.status || "open",
    require_membership: !!feSettings.requireMembership,
    registration_config: feSettings.registrationConfig || getDefaultRegistrationConfig(),
    max_visitors_per_athlete: Number(feSettings.maxVisitorsPerAthlete) || 0
  };
}
function mapSubToFrontend(dbSub) {
  if (!dbSub) return null;
  return {
    id: dbSub.id,
    tournamentId: dbSub.tournament_id,
    institutionId: dbSub.institution_id,
    categoryId: dbSub.category_id,
    athleteName: dbSub.athlete_name,
    birthDate: dbSub.birth_date,
    document: dbSub.document,
    gender: dbSub.gender || "Masculino",
    isCompleted: !!dbSub.is_completed,
    validationStatus: dbSub.validation_status || "pending",
    validationFeedback: dbSub.validation_feedback || null,
    validatedAt: dbSub.validated_at || null,
    parentName: dbSub.parent_name || null,
    parentPhone: dbSub.parent_phone || null,
    additionalData: dbSub.additional_data || {},
    documentUrl: dbSub.document_url || null,
    photoUrl: dbSub.photo_url || null,
    authorizedImageUse: !!dbSub.authorized_image_use,
    liabilityWaiver: !!dbSub.liability_waiver,
    paymentStatus: dbSub.payment_status || "pending",
    createdAt: dbSub.created_at
  };
}
async function getSubscriptionSettings(tournamentId) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("tournament_subscription_settings").select("*").eq("tournament_id", tournamentId).maybeSingle();
    if (error) {
      if (error.code === "PGRST116" || error.message.includes('relation "tournament_subscription_settings" does not exist') || error.message.includes("Public.tournament_subscription_settings")) {
        console.warn("Using JSON fallback for subscription settings: Table not found in Supabase.");
      } else {
        throw error;
      }
    } else if (data) {
      return mapSettingsToFrontend(data);
    }
  } catch (err) {
    console.warn("Supabase exception on subscription settings, using JSON fallback", err.message);
  }
  const db = loadDb();
  const rawSettings = db.settings[tournamentId];
  if (rawSettings) {
    const hasConfig = rawSettings.registrationConfig && (rawSettings.registrationConfig.fields?.length > 0 || rawSettings.registrationConfig.uploads?.length > 0 || rawSettings.registrationConfig.terms?.length > 0);
    return {
      deadline: rawSettings.deadline || "",
      feeType: rawSettings.feeType || "free",
      teamFee: Number(rawSettings.teamFee) || 0,
      athleteFee: Number(rawSettings.athleteFee) || 0,
      status: rawSettings.status || "open",
      requireMembership: !!rawSettings.requireMembership,
      registrationConfig: hasConfig ? rawSettings.registrationConfig : getDefaultRegistrationConfig(),
      maxVisitorsPerAthlete: Number(rawSettings.maxVisitorsPerAthlete) || 0
    };
  }
  return {
    deadline: "",
    feeType: "free",
    teamFee: 0,
    athleteFee: 0,
    status: "open",
    requireMembership: false,
    registrationConfig: getDefaultRegistrationConfig(),
    maxVisitorsPerAthlete: 0
  };
}
async function saveSubscriptionSettings(tournamentId, payload) {
  try {
    const supabase = getSupabaseAdmin();
    console.log("[DEBUG] saveSubscriptionSettings payload received:", payload);
    const dbPayload = mapSettingsToDb(payload);
    console.log("[DEBUG] saveSubscriptionSettings dbPayload mapping:", dbPayload);
    const { error } = await supabase.from("tournament_subscription_settings").upsert({
      tournament_id: tournamentId,
      ...dbPayload
    });
    if (error) {
      console.error("[DEBUG] Supabase upsert error:", error);
    } else {
      console.log("[DEBUG] Supabase upsert succeeded!");
      return payload;
    }
    console.warn("Supabase upsert failed, falling back to JSON:", error.message);
  } catch (err) {
    console.warn("Supabase exception on save subscription settings, using JSON fallback", err.message);
  }
  const db = loadDb();
  db.settings[tournamentId] = {
    deadline: payload.deadline || "",
    feeType: payload.feeType || "free",
    teamFee: Number(payload.teamFee) || 0,
    athleteFee: Number(payload.athleteFee) || 0,
    status: payload.status || "open",
    requireMembership: !!payload.requireMembership,
    registrationConfig: payload.registrationConfig || getDefaultRegistrationConfig(),
    maxVisitorsPerAthlete: Number(payload.maxVisitorsPerAthlete) || 0
  };
  saveDb(db);
  return db.settings[tournamentId];
}
async function getAthleteSubscriptions(tournamentId, institutionId) {
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase.from("athlete_subscriptions").select("*").eq("tournament_id", tournamentId);
    if (institutionId) {
      query = query.eq("institution_id", institutionId);
    }
    const { data, error } = await query;
    if (error) {
      if (error.message.includes('relation "athlete_subscriptions" does not exist') || error.message.includes("Public.athlete_subscriptions")) {
        console.warn("Using JSON fallback for athlete subscriptions: Table not found in Supabase.");
      } else {
        throw error;
      }
    } else if (data) {
      return data.map(mapSubToFrontend);
    }
  } catch (err) {
    console.warn("Supabase exception on athlete subscriptions, using JSON fallback", err.message);
  }
  const db = loadDb();
  const subs = db.athleteSubscriptions.filter((s) => s.tournamentId === tournamentId);
  if (institutionId) {
    return subs.filter((s) => s.institutionId === institutionId);
  }
  return subs;
}
router2.get("/:id/subscription-settings", async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const settings = await getSubscriptionSettings(tournamentId);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.post("/:id/subscription-settings", async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const saved = await saveSubscriptionSettings(tournamentId, req.body);
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.get("/:id/athlete-subscriptions", async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const subs = await getAthleteSubscriptions(tournamentId);
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.get("/:id/athlete-subscriptions/institution/:instId", async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const instId = req.params.instId;
    const subs = await getAthleteSubscriptions(tournamentId, instId);
    const supabase = getSupabaseAdmin();
    const settings = await getSubscriptionSettings(tournamentId);
    if (settings?.requireMembership && subs && subs.length > 0) {
      const { data: tournament } = await supabase.from("tournaments").select("owner_id, start_date").eq("id", tournamentId).maybeSingle();
      if (tournament) {
        const year = new Date(tournament.start_date).getFullYear();
        const documents = subs.map((s) => s.document || s.documentNumber).filter(Boolean);
        if (documents.length > 0) {
          const { data: members } = await supabase.from("members").select("id, document_number").in("document_number", documents);
          if (members && members.length > 0) {
            const memberIds = members.map((m) => m.id);
            const { data: memberships } = await supabase.from("memberships").select("member_id, status, payment_status").eq("organization_id", tournament.owner_id).eq("year", year).eq("status", "active").eq("payment_status", "paid").in("member_id", memberIds);
            const activeMemberIds = new Set(memberships?.map((m) => m.member_id) || []);
            const docToMemberMap = new Map(members.map((m) => [m.document_number, m.id]));
            subs.forEach((s) => {
              const doc = s.document || s.documentNumber;
              const mId = docToMemberMap.get(doc);
              s.isMembershipPaid = mId ? activeMemberIds.has(mId) : false;
            });
          } else {
            subs.forEach((s) => {
              s.isMembershipPaid = false;
            });
          }
        } else {
          subs.forEach((s) => {
            s.isMembershipPaid = false;
          });
        }
      } else {
        subs.forEach((s) => {
          s.isMembershipPaid = true;
        });
      }
    } else {
      subs.forEach((s) => {
        s.isMembershipPaid = true;
      });
    }
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.post("/:id/athlete-subscriptions", async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const { institutionId, categoryId, athletes, sync } = req.body;
    if (!institutionId || !categoryId || !Array.isArray(athletes)) {
      return res.status(400).json({ error: "Par\xE2metros inv\xE1lidos" });
    }
    const settings = await getSubscriptionSettings(tournamentId);
    const newSubs = [];
    try {
      const supabase = getSupabaseAdmin();
      if (sync) {
        const payloadDocuments = athletes.map((a) => a.document).filter(Boolean);
        const { data: currentSubs } = await supabase.from("athlete_subscriptions").select("id, document").eq("tournament_id", tournamentId).eq("category_id", categoryId).eq("institution_id", institutionId);
        const subsToDelete = (currentSubs || []).filter((cs) => !payloadDocuments.includes(cs.document));
        if (subsToDelete.length > 0) {
          const deleteDocs = subsToDelete.map((s) => s.document);
          await supabase.from("athlete_subscriptions").delete().eq("tournament_id", tournamentId).eq("category_id", categoryId).eq("institution_id", institutionId).in("document", deleteDocs);
          const { data: team } = await supabase.from("team_registrations").select("id").eq("tournament_id", tournamentId).eq("tournament_category_id", categoryId).eq("institution_id", institutionId).maybeSingle();
          if (team) {
            const { data: dbMembers } = await supabase.from("members").select("id").eq("institution_id", institutionId).in("document_number", deleteDocs);
            if (dbMembers && dbMembers.length > 0) {
              const memberIdsToDelete = dbMembers.map((m) => m.id);
              await supabase.from("team_members").delete().eq("team_id", team.id).in("athlete_id", memberIdsToDelete);
            }
          }
        }
      }
      const { data: existing, error } = await supabase.from("athlete_subscriptions").select("*").eq("tournament_id", tournamentId).eq("category_id", categoryId);
      if (!error && existing) {
        const inserts = [];
        const returned = [];
        for (const a of athletes) {
          const found = existing.find((e) => e.document === a.document);
          if (found) {
            const { data: updated, error: updateErr } = await supabase.from("athlete_subscriptions").update({
              athlete_name: a.name,
              birth_date: a.birthDate || null,
              gender: a.gender || "Masculino",
              additional_data: a.additionalData || {}
            }).eq("id", found.id).select("*").maybeSingle();
            if (!updateErr && updated) {
              returned.push(mapSubToFrontend(updated));
            } else {
              returned.push(mapSubToFrontend(found));
            }
          } else {
            inserts.push({
              tournament_id: tournamentId,
              institution_id: institutionId,
              category_id: categoryId,
              athlete_name: a.name,
              birth_date: a.birthDate || null,
              document: a.document,
              gender: a.gender || "Masculino",
              is_completed: false,
              validation_status: "pending",
              payment_status: settings.feeType === "by_team_and_athlete_parent" ? "pending" : "paid",
              additional_data: a.additionalData || {}
            });
          }
        }
        if (inserts.length > 0) {
          const { data: inserted, error: insertErr } = await supabase.from("athlete_subscriptions").insert(inserts).select("*");
          if (insertErr) {
            throw insertErr;
          }
          if (inserted) {
            inserted.forEach((i) => returned.push(mapSubToFrontend(i)));
          }
        }
        return res.json(returned);
      }
    } catch (dbErr) {
      console.warn("Using JSON fallback for adding athlete subscriptions", dbErr.message);
    }
    const db = loadDb();
    if (sync) {
      const payloadDocs = new Set(athletes.map((a) => a.document).filter(Boolean));
      db.athleteSubscriptions = db.athleteSubscriptions.filter((s) => {
        if (s.tournamentId === tournamentId && s.categoryId === categoryId && s.institutionId === institutionId) {
          return payloadDocs.has(s.document);
        }
        return true;
      });
    }
    athletes.forEach((a) => {
      const idx = db.athleteSubscriptions.findIndex((s) => s.tournamentId === tournamentId && s.document === a.document && s.categoryId === categoryId);
      if (idx !== -1) {
        db.athleteSubscriptions[idx].athleteName = a.name;
        db.athleteSubscriptions[idx].birthDate = a.birthDate;
        db.athleteSubscriptions[idx].gender = a.gender || "Masculino";
        db.athleteSubscriptions[idx].additionalData = a.additionalData || {};
        newSubs.push(db.athleteSubscriptions[idx]);
        return;
      }
      const sub = {
        id: Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
        tournamentId,
        institutionId,
        categoryId,
        athleteName: a.name,
        birthDate: a.birthDate,
        document: a.document,
        gender: a.gender || "Masculino",
        isCompleted: false,
        validationStatus: "pending",
        paymentStatus: settings.feeType === "by_team_and_athlete_parent" ? "pending" : "paid",
        additionalData: a.additionalData || {}
      };
      db.athleteSubscriptions.push(sub);
      newSubs.push(sub);
    });
    saveDb(db);
    res.json(newSubs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.delete("/:id/athlete-subscriptions/:subId", async (req, res) => {
  try {
    const { subId } = req.params;
    try {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.from("athlete_subscriptions").delete().eq("id", subId);
      if (!error) {
        return res.status(204).send();
      }
    } catch (dbErr) {
      console.warn("Using JSON fallback for deleting athlete subscription", dbErr.message);
    }
    const db = loadDb();
    db.athleteSubscriptions = db.athleteSubscriptions.filter((s) => s.id !== subId);
    saveDb(db);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.patch("/:id/athlete-subscriptions/:subId/payment", async (req, res) => {
  const { paymentStatus } = req.body;
  const { subId } = req.params;
  let updated = null;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("athlete_subscriptions").update({ payment_status: paymentStatus }).eq("id", subId).select("*").maybeSingle();
    if (!error && data) {
      updated = mapSubToFrontend(data);
    }
  } catch (err) {
    console.warn("Using JSON fallback for update athlete payment status", err.message);
  }
  if (!updated) {
    const db = loadDb();
    const index = db.athleteSubscriptions.findIndex((s) => s.id === subId);
    if (index !== -1) {
      db.athleteSubscriptions[index].paymentStatus = paymentStatus || "pending";
      saveDb(db);
      updated = db.athleteSubscriptions[index];
    }
  }
  if (updated) {
    res.json(updated);
  } else {
    res.status(404).json({ error: "Inscri\xE7\xE3o n\xE3o encontrada" });
  }
});
router2.get("/public/athlete-subscription/:subId", async (req, res) => {
  try {
    const { subId } = req.params;
    let sub = null;
    try {
      const supabase2 = getSupabaseAdmin();
      const { data, error } = await supabase2.from("athlete_subscriptions").select("*").eq("id", subId).maybeSingle();
      if (!error && data) {
        sub = mapSubToFrontend(data);
      }
    } catch (dbErr) {
      console.warn("Using JSON fallback for public info select", dbErr.message);
    }
    if (!sub) {
      const db = loadDb();
      sub = db.athleteSubscriptions.find((s) => s.id === subId);
    }
    if (!sub) {
      return res.status(404).json({ error: "Inscri\xE7\xE3o n\xE3o encontrada ou encerrada" });
    }
    const supabase = getSupabaseAdmin();
    const [tRes, instRes, catRes] = await Promise.all([
      supabase.from("tournaments").select("name, start_date, owner_id").eq("id", sub.tournamentId).single(),
      supabase.from("institutions").select("name, logo_url").eq("id", sub.institutionId).single(),
      supabase.from("tournament_categories").select("name, gender").eq("id", sub.categoryId).maybeSingle()
    ]);
    const settings = await getSubscriptionSettings(sub.tournamentId);
    let membershipStatus = "active";
    let organizationData = null;
    if (tRes.data?.owner_id) {
      try {
        const { data: org } = await supabase.from("organizations").select("name, requires_membership_fee, membership_fee_amount").eq("id", tRes.data.owner_id).maybeSingle();
        organizationData = org;
      } catch (err) {
        console.warn("Erro ao buscar organiza\xE7\xE3o:", err.message);
      }
    }
    if (settings?.requireMembership && tRes.data) {
      membershipStatus = "pending";
      try {
        const { data: member } = await supabase.from("members").select("id").eq("document_number", sub.document).maybeSingle();
        if (member) {
          const year = new Date(tRes.data.start_date).getFullYear();
          const { data: ms } = await supabase.from("memberships").select("status, payment_status").eq("member_id", member.id).eq("organization_id", tRes.data.owner_id).eq("year", year).maybeSingle();
          if (ms && ms.status === "active" && ms.payment_status === "paid") {
            membershipStatus = "active";
          }
        }
      } catch (err) {
        console.warn("Erro ao checar filia\xE7\xE3o na inscri\xE7\xE3o p\xFAblica (fallback ativo):", err.message);
        membershipStatus = "active";
      }
    }
    res.json({
      subscription: sub,
      tournament: tRes.data,
      institution: instRes.data,
      category: catRes.data,
      settings,
      membershipStatus,
      organization: organizationData,
      pagarmePublicKey: process.env.PAGARME_PUBLIC_KEY || ""
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.post("/public/athlete-subscription/:subId/complete", async (req, res) => {
  try {
    const { subId } = req.params;
    const { parentName, parentPhone, parentEmail, parentPassword, additionalData, documentUrl, photoUrl, authorizedImageUse, liabilityWaiver, paymentStatus } = req.body;
    let completed = null;
    if (parentEmail && parentPassword) {
      try {
        const hashedPassword = await bcrypt.hash(parentPassword, 10);
        const emailLower = parentEmail.toLowerCase().trim();
        let localAccounts = [];
        if (fs2.existsSync(ACCOUNTS_FILE2)) {
          try {
            localAccounts = JSON.parse(fs2.readFileSync(ACCOUNTS_FILE2, "utf-8"));
          } catch (e) {
            console.error("Erro ao carregar contas locais para registrar respons\xE1vel:", e);
          }
        }
        const emailExists = localAccounts.find((a) => a.email.toLowerCase() === emailLower);
        if (!emailExists) {
          const accountId = `acc_${Math.random().toString(36).substring(2, 11)}`;
          const newAccount = {
            id: accountId,
            email: emailLower,
            passwordHash: hashedPassword,
            role: "guardian",
            name: parentName || "Respons\xE1vel",
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          localAccounts.push(newAccount);
          const dir = path2.dirname(ACCOUNTS_FILE2);
          if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
          fs2.writeFileSync(ACCOUNTS_FILE2, JSON.stringify(localAccounts, null, 2));
          try {
            const supabase = getSupabaseAdmin();
            const { error: testError } = await supabase.from("portal_accounts").select("id").limit(1);
            if (!testError) {
              await supabase.from("portal_accounts").insert([{
                id: accountId,
                email: emailLower,
                password_hash: hashedPassword,
                role: "guardian",
                name: parentName || "Respons\xE1vel",
                created_at: (/* @__PURE__ */ new Date()).toISOString()
              }]);
            }
          } catch (sbErr) {
            console.error("Erro ao sincronizar nova conta de respons\xE1vel com Supabase:", sbErr);
          }
        }
      } catch (err) {
        console.error("Erro ao criar conta de respons\xE1vel durante inscri\xE7\xE3o do atleta:", err);
      }
    }
    try {
      const supabase = getSupabaseAdmin();
      const { data: subData } = await supabase.from("athlete_subscriptions").select("*").eq("id", subId).maybeSingle();
      if (subData) {
        const settings = await getSubscriptionSettings(subData.tournament_id);
        const { data: tData } = await supabase.from("tournaments").select("owner_id, start_date").eq("id", subData.tournament_id).maybeSingle();
        if (settings?.requireMembership && tData) {
          const { data: existingMember } = await supabase.from("members").select("id").eq("document_number", subData.document).maybeSingle();
          let athleteId = existingMember?.id;
          if (!athleteId) {
            const { data: newMember } = await supabase.from("members").insert([{
              institution_id: subData.institution_id,
              full_name: subData.athlete_name,
              document_number: subData.document,
              birth_date: subData.birth_date,
              status: "pending"
            }]).select("id").single();
            if (newMember) athleteId = newMember.id;
          }
          if (athleteId) {
            const year = new Date(tData.start_date).getFullYear();
            await supabase.from("memberships").upsert({
              member_id: athleteId,
              organization_id: tData.owner_id,
              year,
              status: "active",
              payment_status: "paid",
              payment_id: `public_checkout_${subId}`,
              paid_at: (/* @__PURE__ */ new Date()).toISOString()
            }, {
              onConflict: "organization_id,member_id,year"
            });
          }
        }
      }
      const { data, error } = await supabase.from("athlete_subscriptions").update({
        is_completed: true,
        parent_name: parentName,
        parent_phone: parentPhone,
        additional_data: additionalData,
        document_url: documentUrl,
        photo_url: photoUrl,
        authorized_image_use: authorizedImageUse,
        liability_waiver: liabilityWaiver,
        payment_status: paymentStatus
      }).eq("id", subId).select("*").maybeSingle();
      if (!error && data) {
        completed = mapSubToFrontend(data);
      }
    } catch (dbErr) {
      console.warn("Using JSON fallback for complete registration", dbErr.message);
    }
    if (!completed) {
      const db = loadDb();
      const index = db.athleteSubscriptions.findIndex((s) => s.id === subId);
      if (index === -1) {
        return res.status(404).json({ error: "Inscri\xE7\xE3o n\xE3o encontrada" });
      }
      db.athleteSubscriptions[index] = {
        ...db.athleteSubscriptions[index],
        isCompleted: true,
        parentName,
        parentPhone,
        additionalData,
        documentUrl,
        photoUrl,
        authorizedImageUse,
        liabilityWaiver,
        paymentStatus: paymentStatus || db.athleteSubscriptions[index].paymentStatus
      };
      saveDb(db);
      completed = db.athleteSubscriptions[index];
    }
    res.json(completed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
async function callPagarMe2(endpoint, method, body) {
  const secretKey = process.env.PAGARME_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAGARME_SECRET_KEY n\xE3o configurada no arquivo de ambiente.");
  }
  const authHeader = "Basic " + Buffer.from(secretKey + ":").toString("base64");
  const response = await fetch(`https://api.pagar.me/core/v5${endpoint}`, {
    method,
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/json",
      "accept": "application/json"
    },
    body: body ? JSON.stringify(body) : void 0
  });
  const data = await response.json();
  if (!response.ok) {
    console.error("Pagar.me API Error details:", data);
    throw new Error(data.message || "Erro retornado pela API do Pagar.me");
  }
  return data;
}
router2.post("/public/athlete-subscription/:subId/pay", async (req, res) => {
  const { subId } = req.params;
  const { method, cardToken, parentName, parentPhone, simulateSuccess } = req.body;
  if (!method) {
    return res.status(400).json({ error: "M\xE9todo de pagamento n\xE3o especificado." });
  }
  try {
    const supabase = getSupabaseAdmin();
    let sub = null;
    const { data: dbSub, error: dbErr } = await supabase.from("athlete_subscriptions").select("*").eq("id", subId).maybeSingle();
    if (!dbErr && dbSub) {
      sub = mapSubToFrontend(dbSub);
    } else {
      const db = loadDb();
      sub = db.athleteSubscriptions.find((s) => s.id === subId);
    }
    if (!sub) {
      return res.status(404).json({ error: "Inscri\xE7\xE3o n\xE3o encontrada." });
    }
    if (sub.paymentStatus === "paid") {
      return res.status(400).json({ error: "Esta inscri\xE7\xE3o j\xE1 foi paga." });
    }
    const { data: tData } = await supabase.from("tournaments").select("name, owner_id, start_date").eq("id", sub.tournamentId).single();
    const settings = await getSubscriptionSettings(sub.tournamentId);
    const athleteFee = settings?.feeType === "by_team_and_athlete_parent" ? settings.athleteFee || 0 : 0;
    let membershipFee = 0;
    let membershipStatus = "active";
    let orgName = "Liga";
    if (settings?.requireMembership && tData) {
      membershipStatus = "pending";
      const { data: org } = await supabase.from("organizations").select("name, requires_membership_fee, membership_fee_amount").eq("id", tData.owner_id).maybeSingle();
      orgName = org?.name || "Liga";
      membershipFee = org?.membership_fee_amount || 50;
      const { data: member } = await supabase.from("members").select("id").eq("document_number", sub.document).maybeSingle();
      if (member) {
        const year = new Date(tData.start_date).getFullYear();
        const { data: ms } = await supabase.from("memberships").select("status, payment_status").eq("member_id", member.id).eq("organization_id", tData.owner_id).eq("year", year).maybeSingle();
        if (ms && ms.status === "active" && ms.payment_status === "paid") {
          membershipStatus = "active";
          membershipFee = 0;
        }
      }
    }
    const totalAmount = athleteFee + membershipFee;
    if (totalAmount <= 0) {
      await updateSubscriptionPaymentStatus(subId, "paid", sub);
      return res.json({ success: true, method, paid: true });
    }
    const hasSecretKey = !!process.env.PAGARME_SECRET_KEY;
    if (simulateSuccess) {
      await updateSubscriptionPaymentStatus(subId, "paid", sub, tData, settings);
      return res.json({ success: true, method, paid: true });
    }
    if (!hasSecretKey) {
      console.warn("PAGARME_SECRET_KEY n\xE3o detectada. Executando pagamento individual em modo SIMULADO.");
      if (method === "pix") {
        return res.json({
          success: true,
          method: "pix",
          qrCode: `00020126360014br.gov.bcb.pix0114+55719914149135204000053039865407${totalAmount.toFixed(2)}5802BR5914QUEROCOMPETIR6009SALVADOR62070503***6304FC7D`,
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=mock-pix-payload-athlete-value`
        });
      }
      await updateSubscriptionPaymentStatus(subId, "paid", sub, tData, settings);
      return res.json({ success: true, method: "card", paid: true });
    }
    const cleanDoc = (sub.document || "00000000000").replace(/\D/g, "");
    const docToUse = cleanDoc.length === 11 || cleanDoc.length === 14 ? cleanDoc : "00000000000";
    const customer = {
      name: parentName || sub.athleteName || "Respons\xE1vel",
      email: "financeiro@querocompetir.com.br",
      document: docToUse,
      type: docToUse.length === 11 ? "individual" : "corporation",
      phones: {
        mobile_phone: {
          country_code: "55",
          area_code: "71",
          number: (parentPhone || "999999999").replace(/\D/g, "").slice(-9)
        }
      }
    };
    const items = [];
    if (athleteFee > 0) {
      items.push({
        amount: Math.round(athleteFee * 100),
        description: `Inscri\xE7\xE3o Torneio - ${sub.athleteName}`,
        quantity: 1
      });
    }
    if (membershipFee > 0) {
      items.push({
        amount: Math.round(membershipFee * 100),
        description: `Anuidade Liga (${orgName}) - ${sub.athleteName}`,
        quantity: 1
      });
    }
    if (method === "pix") {
      const orderPayload = {
        code: sub.id,
        items,
        customer,
        payments: [
          {
            payment_method: "pix",
            pix: {
              expires_in: 86400
            }
          }
        ]
      };
      const pgOrder = await callPagarMe2("/orders", "POST", orderPayload);
      const charge = pgOrder.charges?.[0];
      const transaction = charge?.last_transaction;
      const currentAdditional = sub.additionalData || {};
      const updatedAdditional = {
        ...currentAdditional,
        pagarmeOrderId: pgOrder.id,
        pagarmeChargeId: charge?.id
      };
      await updateSubscriptionAdditionalData(sub.id, updatedAdditional, sub);
      return res.json({
        success: true,
        method: "pix",
        qrCode: transaction?.qr_code || "",
        qrCodeUrl: transaction?.qr_code_url || ""
      });
    }
    if (method === "card") {
      if (!cardToken) {
        return res.status(400).json({ error: "Token do cart\xE3o n\xE3o fornecido." });
      }
      const orderPayload = {
        code: sub.id,
        items,
        customer,
        payments: [
          {
            payment_method: "credit_card",
            credit_card: {
              card_token: cardToken,
              operation_type: "auth_and_capture",
              installments: 1,
              statement_descriptor: "QUEROCOMPETIR"
            }
          }
        ]
      };
      const pgOrder = await callPagarMe2("/orders", "POST", orderPayload);
      const charge = pgOrder.charges?.[0];
      if (charge?.status === "paid") {
        const currentAdditional = sub.additionalData || {};
        const updatedAdditional = {
          ...currentAdditional,
          pagarmeOrderId: pgOrder.id,
          pagarmeChargeId: charge.id
        };
        await updateSubscriptionAdditionalData(sub.id, updatedAdditional, sub);
        await updateSubscriptionPaymentStatus(subId, "paid", sub, tData, settings);
        return res.json({ success: true, method: "card", paid: true });
      } else {
        return res.status(400).json({ error: `Pagamento via cart\xE3o n\xE3o aprovado. Status: ${charge?.status || "desconhecido"}` });
      }
    }
    res.status(400).json({ error: "M\xE9todo de pagamento inv\xE1lido." });
  } catch (err) {
    console.error("Erro na transa\xE7\xE3o Pagar.me do atleta:", err);
    res.status(500).json({ error: err.message || "Erro desconhecido ao processar pagamento." });
  }
});
async function updateSubscriptionAdditionalData(subId, additionalData, sub) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("athlete_subscriptions").update({ additional_data: additionalData }).eq("id", subId);
  } catch (dbErr) {
    console.warn("Using JSON fallback for saving payment IDs", dbErr);
  }
  const db = loadDb();
  const index = db.athleteSubscriptions.findIndex((s) => s.id === subId);
  if (index !== -1) {
    db.athleteSubscriptions[index].additionalData = {
      ...db.athleteSubscriptions[index].additionalData || {},
      ...additionalData
    };
    saveDb(db);
  }
}
async function updateSubscriptionPaymentStatus(subId, status, sub, tData, settings) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("athlete_subscriptions").update({ payment_status: status }).eq("id", subId);
    if (settings?.requireMembership && tData) {
      const { data: existingMember } = await supabase.from("members").select("id").eq("document_number", sub.document).maybeSingle();
      let athleteId = existingMember?.id;
      if (!athleteId) {
        const { data: newMember } = await supabase.from("members").insert([{
          institution_id: sub.institutionId,
          full_name: sub.athleteName,
          document_number: sub.document,
          birth_date: sub.birthDate,
          status: "pending"
        }]).select("id").single();
        if (newMember) athleteId = newMember.id;
      }
      if (athleteId) {
        const year = new Date(tData.start_date).getFullYear();
        await supabase.from("memberships").upsert({
          member_id: athleteId,
          organization_id: tData.owner_id,
          year,
          status: "active",
          payment_status: "paid",
          payment_id: `pagarme_athlete_checkout_${subId}`,
          paid_at: (/* @__PURE__ */ new Date()).toISOString()
        }, {
          onConflict: "organization_id,member_id,year"
        });
      }
    }
  } catch (dbErr) {
    console.warn("Using JSON fallback for payment status activation", dbErr);
  }
  const db = loadDb();
  const index = db.athleteSubscriptions.findIndex((s) => s.id === subId);
  if (index !== -1) {
    db.athleteSubscriptions[index].paymentStatus = status;
    saveDb(db);
  }
}
router2.post("/:id/athlete-subscriptions/:subId/validate", async (req, res) => {
  try {
    const { subId, id: tournamentId } = req.params;
    const { validationStatus, validationFeedback } = req.body;
    let sub = null;
    const validatedAt = (/* @__PURE__ */ new Date()).toISOString();
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.from("athlete_subscriptions").update({
        validation_status: validationStatus || "approved",
        validation_feedback: validationFeedback || null,
        validated_at: validatedAt
      }).eq("id", subId).select("*").maybeSingle();
      if (!error && data) {
        sub = mapSubToFrontend(data);
      }
    } catch (dbErr) {
      console.warn("Using JSON fallback for validate registration", dbErr.message);
    }
    if (!sub) {
      const db = loadDb();
      const index = db.athleteSubscriptions.findIndex((s) => s.id === subId);
      if (index === -1) {
        return res.status(404).json({ error: "Inscri\xE7\xE3o n\xE3o encontrada" });
      }
      db.athleteSubscriptions[index].validationStatus = validationStatus || "approved";
      db.athleteSubscriptions[index].validationFeedback = validationFeedback || null;
      db.athleteSubscriptions[index].validatedAt = validatedAt;
      sub = db.athleteSubscriptions[index];
      saveDb(db);
    }
    if (validationStatus === "approved" && sub) {
      const supabase = getSupabaseAdmin();
      const { data: existingMember } = await supabase.from("members").select("id").eq("institution_id", sub.institutionId).eq("document_number", sub.document).maybeSingle();
      let athleteId = existingMember?.id;
      if (!athleteId) {
        const { data: newMember, error: insertError } = await supabase.from("members").insert([{
          institution_id: sub.institutionId,
          full_name: sub.athleteName,
          document_number: sub.document,
          birth_date: sub.birthDate,
          status: "authorized"
        }]).select("id").single();
        if (insertError) {
          console.error("Erro ao sincronizar atleta em 'members':", insertError);
        } else {
          athleteId = newMember.id;
        }
      }
      if (athleteId) {
        let { data: team, error: teamFindError } = await supabase.from("team_registrations").select("id").eq("tournament_id", sub.tournamentId).eq("tournament_category_id", sub.categoryId).eq("institution_id", sub.institutionId).maybeSingle();
        let teamId = team?.id;
        if (!teamId) {
          const { data: newTeam, error: newTeamError } = await supabase.from("team_registrations").insert([{
            tournament_id: sub.tournamentId,
            tournament_category_id: sub.categoryId,
            institution_id: sub.institutionId,
            availability: []
          }]).select("id").maybeSingle();
          if (!newTeamError && newTeam) {
            teamId = newTeam.id;
          } else {
            console.error("Erro ao criar team_registrations na valida\xE7\xE3o:", newTeamError);
          }
        }
        if (teamId) {
          const { error: linkError } = await supabase.from("team_members").insert([{
            team_id: teamId,
            athlete_id: athleteId
          }]);
          if (linkError && !linkError.message.includes("unique")) {
            console.error("Erro ao vincular atleta ao time:", linkError);
          }
        }
      }
    }
    res.json(sub);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.get("/:id/team-members-all", async (req, res) => {
  const { id: tournamentId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    const { data: teams, error: teamsError } = await supabase.from("team_registrations").select("id, availability, tournament_category_id, institution_id").eq("tournament_id", tournamentId);
    if (teamsError) throw teamsError;
    const teamIds = (teams || []).map((t) => t.id);
    const { data: teamMembers, error: membersError } = teamIds.length > 0 ? await supabase.from("team_members").select("team_id, athlete_id").in("team_id", teamIds) : { data: [], error: null };
    if (membersError) throw membersError;
    const teamAthleteMap = {};
    (teamMembers || []).forEach((m) => {
      if (!teamAthleteMap[m.team_id]) {
        teamAthleteMap[m.team_id] = [];
      }
      teamAthleteMap[m.team_id].push(m.athlete_id);
    });
    res.json(teamAthleteMap);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router2.post("/:id/auto-schedule", async (req, res) => {
  const { id: tournamentId } = req.params;
  const {
    startDate,
    endDate,
    matchDuration = 60,
    dailyStartTime = "08:00",
    dailyEndTime = "20:00",
    maxGamesPerDay = 2,
    onlyUnscheduled = true,
    selectedVenues = []
  } = req.body;
  try {
    const supabase = getSupabaseAdmin();
    const { data: matches, error: matchesError } = await supabase.from("matches").select("id, team1_id, team2_id, scheduled_time, venue_id, court, tournament_category_id, round, match_index").eq("tournament_id", tournamentId);
    if (matchesError) throw matchesError;
    let venueQuery = supabase.from("venues").select("*");
    if (selectedVenues.length > 0) {
      venueQuery = venueQuery.in("id", selectedVenues);
    }
    const { data: venues, error: venuesError } = await venueQuery;
    if (venuesError) throw venuesError;
    if (!venues || venues.length === 0) {
      return res.status(400).json({ error: "Nenhuma sede/local dispon\xEDvel para agendamento autom\xE1tico." });
    }
    const resources = [];
    venues.forEach((v) => {
      let courtList = ["Principal"];
      if (Array.isArray(v.courts) && v.courts.length > 0) {
        courtList = v.courts;
      } else if (v.courts_count && typeof v.courts_count === "number") {
        courtList = Array.from({ length: v.courts_count }, (_, idx) => `Quadra ${idx + 1}`);
      } else if (v.courts_json && Array.isArray(v.courts_json)) {
        courtList = v.courts_json;
      }
      courtList.forEach((c) => {
        resources.push({ venueId: v.id, courtName: c });
      });
    });
    if (resources.length === 0) {
      return res.status(400).json({ error: "Nenhuma quadra dispon\xEDvel para agendamento autom\xE1tico." });
    }
    const { data: teams, error: teamsError } = await supabase.from("team_registrations").select("id, availability, tournament_category_id, institution_id").eq("tournament_id", tournamentId);
    if (teamsError) throw teamsError;
    const teamIds = (teams || []).map((t) => t.id);
    const { data: teamMembers, error: membersError } = teamIds.length > 0 ? await supabase.from("team_members").select("team_id, athlete_id").in("team_id", teamIds) : { data: [], error: null };
    if (membersError) throw membersError;
    const teamAthleteMap = {};
    (teamMembers || []).forEach((m) => {
      if (!teamAthleteMap[m.team_id]) {
        teamAthleteMap[m.team_id] = [];
      }
      teamAthleteMap[m.team_id].push(m.athlete_id);
    });
    const teamInstitutionMap = {};
    (teams || []).forEach((t) => {
      teamInstitutionMap[t.id] = t.institution_id;
    });
    let matchesToSchedule = (matches || []).filter((m) => {
      const hasTeams = m.team1_id && m.team2_id;
      if (!hasTeams) return false;
      if (onlyUnscheduled) {
        return !m.scheduled_time || !m.venue_id;
      }
      return true;
    });
    matchesToSchedule.sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      return a.match_index - b.match_index;
    });
    const activeSchedule = (matches || []).filter((m) => m.scheduled_time && m.venue_id && m.team1_id && m.team2_id).map((m) => ({
      matchId: m.id,
      team1Id: m.team1_id,
      team2Id: m.team2_id,
      scheduledTime: m.scheduled_time,
      venueId: m.venue_id,
      court: m.court || "Principal"
    }));
    if (onlyUnscheduled === false) {
      activeSchedule.length = 0;
    }
    const createTimeSlots = (startD, endD) => {
      const slots2 = [];
      let currentDate = /* @__PURE__ */ new Date(startD + "T00:00:00");
      let limitDate = endD ? /* @__PURE__ */ new Date(endD + "T23:59:59") : new Date((/* @__PURE__ */ new Date(startD + "T00:00:00")).getTime() + 30 * 24 * 60 * 60 * 1e3);
      const [startH, startM] = dailyStartTime.split(":").map(Number);
      const [endH, endM] = dailyEndTime.split(":").map(Number);
      let dayOffset = 0;
      while (true) {
        const loopDate = new Date(currentDate.getTime() + dayOffset * 24 * 60 * 60 * 1e3);
        if (loopDate > limitDate) break;
        const dateStr = loopDate.toISOString().split("T")[0];
        let currentHour = startH;
        let currentMinute = startM;
        const endMinutes = endH * 60 + endM;
        while (currentHour * 60 + currentMinute + matchDuration <= endMinutes) {
          const hh = String(currentHour).padStart(2, "0");
          const mm = String(currentMinute).padStart(2, "0");
          slots2.push(`${dateStr}T${hh}:${mm}`);
          currentMinute += matchDuration;
          if (currentMinute >= 60) {
            currentHour += Math.floor(currentMinute / 60);
            currentMinute = currentMinute % 60;
          }
        }
        dayOffset++;
        if (dayOffset > 365) break;
      }
      return slots2;
    };
    const slots = createTimeSlots(startDate, endDate || startDate);
    const parseHelper = (timeStr) => {
      const regexMatch = timeStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (!regexMatch) return null;
      const [_, year, month, day, hour, minute] = regexMatch;
      return new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        parseInt(hour, 10),
        parseInt(minute, 10)
      );
    };
    const isOverlap = (timeStr1, timeStr2, durationMin) => {
      const t1 = parseHelper(timeStr1);
      const t2 = parseHelper(timeStr2);
      if (!t1 || !t2) return false;
      const diff = Math.abs(t1.getTime() - t2.getTime());
      return diff < durationMin * 60 * 1e3;
    };
    let scheduledCount = 0;
    const updatesToSave = [];
    for (const match of matchesToSchedule) {
      const team1Id = match.team1_id;
      const team2Id = match.team2_id;
      const t1Athletes = teamAthleteMap[team1Id] || [];
      const t2Athletes = teamAthleteMap[team2Id] || [];
      const inst1 = teamInstitutionMap[team1Id];
      const inst2 = teamInstitutionMap[team2Id];
      const allMatchAthletes = /* @__PURE__ */ new Set([...t1Athletes, ...t2Athletes]);
      let foundSlot = false;
      for (const slot of slots) {
        const slotDateStr = slot.split("T")[0];
        const t1GamesToday = activeSchedule.filter((s) => s.scheduledTime.startsWith(slotDateStr) && (s.team1Id === team1Id || s.team2Id === team1Id)).length;
        const t2GamesToday = activeSchedule.filter((s) => s.scheduledTime.startsWith(slotDateStr) && (s.team1Id === team2Id || s.team2Id === team2Id)).length;
        if (t1GamesToday >= maxGamesPerDay || t2GamesToday >= maxGamesPerDay) {
          continue;
        }
        for (const resource of resources) {
          let hasConflict = false;
          for (const scheduled of activeSchedule) {
            if (scheduled.venueId === resource.venueId && scheduled.court === resource.courtName) {
              if (isOverlap(scheduled.scheduledTime, slot, matchDuration)) {
                hasConflict = true;
                break;
              }
            }
            if (scheduled.team1Id === team1Id || scheduled.team1Id === team2Id || scheduled.team2Id === team1Id || scheduled.team2Id === team2Id) {
              const t1 = parseHelper(scheduled.scheduledTime);
              const t2 = parseHelper(slot);
              if (t1 && t2) {
                const diffMin = Math.abs(t1.getTime() - t2.getTime()) / (60 * 1e3);
                if (diffMin < matchDuration) {
                  hasConflict = true;
                  break;
                } else if (diffMin <= matchDuration && maxGamesPerDay > 1) {
                  hasConflict = true;
                  break;
                }
              }
            }
            const scheduledAthletes1 = teamAthleteMap[scheduled.team1Id] || [];
            const scheduledAthletes2 = teamAthleteMap[scheduled.team2Id] || [];
            let athleteConflict = false;
            for (const athleteId of scheduledAthletes1) {
              if (allMatchAthletes.has(athleteId)) {
                athleteConflict = true;
                break;
              }
            }
            if (!athleteConflict) {
              for (const athleteId of scheduledAthletes2) {
                if (allMatchAthletes.has(athleteId)) {
                  athleteConflict = true;
                  break;
                }
              }
            }
            if (athleteConflict && isOverlap(scheduled.scheduledTime, slot, matchDuration)) {
              hasConflict = true;
              break;
            }
          }
          if (!hasConflict) {
            const getDayHelper = (date) => {
              const days = ["Domingo", "Segunda", "Ter\xE7a", "Quarta", "Quinta", "Sexta", "S\xE1bado"];
              return days[date.getDay()];
            };
            const checkTeamAvail = (teamId, slotTime) => {
              const team = teams?.find((t) => t.id === teamId);
              if (!team || !team.availability || team.availability.length === 0) return true;
              const mDate = parseHelper(slotTime);
              if (!mDate) return true;
              const dayStr = getDayHelper(mDate);
              const mHour = mDate.getHours();
              const mMin = mDate.getMinutes();
              const isUnavailableDate = team.availability.some((av) => av.type === "unavailable" && av.date === slotTime.split("T")[0]);
              if (isUnavailableDate) return false;
              const regularAvails = team.availability.filter((a) => a.type !== "unavailable");
              if (regularAvails.length === 0) return true;
              return regularAvails.some((av) => {
                const isDayMatch = av.day === dayStr;
                if (!isDayMatch) return false;
                const [startH, startM] = av.start.split(":").map(Number);
                const [endH, endM] = av.end.split(":").map(Number);
                const timeVal = mHour * 60 + mMin;
                return timeVal >= startH * 60 + startM && timeVal <= endH * 60 + endM;
              });
            };
            const checkVenueAvail = (venueId, slotTime) => {
              const venue = venues?.find((v) => v.id === venueId);
              if (!venue || !venue.availability || venue.availability.length === 0) return true;
              const mDate = parseHelper(slotTime);
              if (!mDate) return true;
              const dayStr = getDayHelper(mDate);
              const mHour = mDate.getHours();
              const mMin = mDate.getMinutes();
              const isUnavailableDate = venue.availability.some((av) => av.type === "unavailable" && av.date === slotTime.split("T")[0]);
              if (isUnavailableDate) return false;
              const regularAvails = venue.availability.filter((a) => a.type !== "unavailable");
              if (regularAvails.length === 0) return true;
              return regularAvails.some((av) => {
                const isDayMatch = av.day === dayStr;
                if (!isDayMatch) return false;
                const [startH, startM] = av.start.split(":").map(Number);
                const [endH, endM] = av.end.split(":").map(Number);
                const timeVal = mHour * 60 + mMin;
                return timeVal >= startH * 60 + startM && timeVal <= endH * 60 + endM;
              });
            };
            const t1Ok = checkTeamAvail(team1Id, slot);
            const t2Ok = checkTeamAvail(team2Id, slot);
            const venueOk = checkVenueAvail(resource.venueId, slot);
            if (t1Ok && t2Ok && venueOk) {
              activeSchedule.push({
                matchId: match.id,
                team1Id,
                team2Id,
                scheduledTime: slot,
                venueId: resource.venueId,
                court: resource.courtName
              });
              updatesToSave.push({
                id: match.id,
                scheduled_time: slot,
                venue_id: resource.venueId,
                court: resource.courtName
              });
              scheduledCount++;
              foundSlot = true;
              break;
            }
          }
        }
        if (foundSlot) break;
      }
    }
    if (updatesToSave.length > 0) {
      for (const update of updatesToSave) {
        const { id, scheduled_time, venue_id, court } = update;
        await supabase.from("matches").update({
          scheduled_time,
          venue_id,
          court
        }).eq("id", id);
      }
    }
    res.json({
      success: true,
      message: `Tabelas geradas com sucesso! ${scheduledCount} partidas foram agendadas prevenindo conflitos de sedes e atletas simult\xE2neos.`,
      scheduledCount,
      totalUnscheduledLeft: matchesToSchedule.length - scheduledCount
    });
  } catch (error) {
    console.error("[AutoSchedule Error]:", error);
    res.status(500).json({ error: error.message });
  }
});
var COMMUNITY_POSTS_FILE = path2.join(process.cwd(), "src", "backend", "data", "tournament_posts.json");
function ensureCommunityFile() {
  const dir = path2.dirname(COMMUNITY_POSTS_FILE);
  if (!fs2.existsSync(dir)) {
    fs2.mkdirSync(dir, { recursive: true });
  }
  if (!fs2.existsSync(COMMUNITY_POSTS_FILE)) {
    fs2.writeFileSync(COMMUNITY_POSTS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}
function loadPostsFromFallback() {
  ensureCommunityFile();
  try {
    return JSON.parse(fs2.readFileSync(COMMUNITY_POSTS_FILE, "utf-8"));
  } catch (e) {
    return [];
  }
}
function savePostsToFallback(posts) {
  ensureCommunityFile();
  try {
    fs2.writeFileSync(COMMUNITY_POSTS_FILE, JSON.stringify(posts, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving fallback community posts:", e);
  }
}
router2.get("/:id/posts", async (req, res) => {
  const tournamentId = req.params.id;
  const showAll = req.query.all === "true";
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("tournament_posts").select("*").eq("tournament_id", tournamentId).order("created_at", { ascending: false });
    if (error) {
      if (error.message.includes("relation") || error.message.includes("not found") || error.message.includes("does not exist")) {
        let fallback = loadPostsFromFallback().filter((p) => p.tournamentId === tournamentId);
        if (!showAll) {
          fallback = fallback.filter((p) => !p.reactions?.is_pending);
        }
        fallback.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return res.json(fallback);
      }
      throw error;
    }
    let formatted = data.map((d) => ({
      id: d.id,
      tournamentId: d.tournament_id,
      authorType: d.author_type,
      authorName: d.author_name,
      authorAvatar: d.author_avatar,
      content: d.content,
      mediaUrl: d.media_url,
      mediaType: d.media_type || "none",
      createdAt: d.created_at,
      reactions: d.reactions || { like: 0, love: 0, applause: 0 },
      comments: d.comments || []
    }));
    if (!showAll) {
      formatted = formatted.filter((p) => !p.reactions?.is_pending);
    }
    res.json(formatted);
  } catch (err) {
    let fallback = loadPostsFromFallback().filter((p) => p.tournamentId === tournamentId);
    if (!showAll) {
      fallback = fallback.filter((p) => !p.reactions?.is_pending);
    }
    fallback.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(fallback);
  }
});
router2.post("/:id/posts", async (req, res) => {
  const tournamentId = req.params.id;
  const { authorType, authorName, authorAvatar, content, mediaUrl, mediaType, isPending } = req.body;
  if (!content && !mediaUrl) {
    return res.status(400).json({ error: "\xC9 necess\xE1rio inserir texto ou m\xEDdia para criar uma postagem." });
  }
  const reactionsObj = { like: 0, love: 0, applause: 0, is_pending: isPending === true };
  const newPost = {
    id: "post_" + Math.random().toString(36).substring(2, 11),
    tournamentId,
    authorType: authorType || "guest",
    authorName: authorName || "An\xF4nimo",
    authorAvatar: authorAvatar || "",
    content: content || "",
    mediaUrl: mediaUrl || "",
    mediaType: mediaType || "none",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    reactions: reactionsObj,
    comments: []
  };
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("tournament_posts").insert([{
      id: newPost.id,
      tournament_id: tournamentId,
      author_type: newPost.authorType,
      author_name: newPost.authorName,
      author_avatar: newPost.authorAvatar,
      content: newPost.content,
      media_url: newPost.mediaUrl,
      media_type: newPost.mediaType,
      reactions: newPost.reactions,
      comments: newPost.comments
    }]).select();
    if (error) {
      if (error.message.includes("relation") || error.message.includes("not found") || error.message.includes("does not exist")) {
        const dbFallback = loadPostsFromFallback();
        dbFallback.push(newPost);
        savePostsToFallback(dbFallback);
        return res.status(201).json(newPost);
      }
      throw error;
    }
    res.status(201).json(newPost);
  } catch (err) {
    const dbFallback = loadPostsFromFallback();
    dbFallback.push(newPost);
    savePostsToFallback(dbFallback);
    res.status(201).json(newPost);
  }
});
router2.post("/:id/posts/:postId/react", async (req, res) => {
  const { postId } = req.params;
  const { type } = req.body;
  if (!["like", "love", "applause"].includes(type)) {
    return res.status(400).json({ error: "Rea\xE7\xE3o inv\xE1lida" });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data: existing, error: getError } = await supabase.from("tournament_posts").select("*").eq("id", postId).maybeSingle();
    if (getError || !existing) {
      if (getError && !getError.message.includes("relation")) throw getError;
      const dbFallback = loadPostsFromFallback();
      const pIdx = dbFallback.findIndex((p) => p.id === postId);
      if (pIdx !== -1) {
        if (!dbFallback[pIdx].reactions) dbFallback[pIdx].reactions = { like: 0, love: 0, applause: 0 };
        dbFallback[pIdx].reactions[type] = (dbFallback[pIdx].reactions[type] || 0) + 1;
        savePostsToFallback(dbFallback);
        return res.json(dbFallback[pIdx]);
      }
      return res.status(404).json({ error: "Post n\xE3o encontrado" });
    }
    const currentReactions = existing.reactions || { like: 0, love: 0, applause: 0 };
    currentReactions[type] = (currentReactions[type] || 0) + 1;
    const { data: updated, error: updateError } = await supabase.from("tournament_posts").update({ reactions: currentReactions }).eq("id", postId).select().single();
    if (updateError) throw updateError;
    res.json({
      id: updated.id,
      tournamentId: updated.tournament_id,
      authorType: updated.author_type,
      authorName: updated.author_name,
      authorAvatar: updated.author_avatar,
      content: updated.content,
      mediaUrl: updated.media_url,
      mediaType: updated.media_type,
      createdAt: updated.created_at,
      reactions: updated.reactions,
      comments: updated.comments
    });
  } catch (err) {
    const dbFallback = loadPostsFromFallback();
    const pIdx = dbFallback.findIndex((p) => p.id === postId);
    if (pIdx !== -1) {
      if (!dbFallback[pIdx].reactions) dbFallback[pIdx].reactions = { like: 0, love: 0, applause: 0 };
      dbFallback[pIdx].reactions[type] = (dbFallback[pIdx].reactions[type] || 0) + 1;
      savePostsToFallback(dbFallback);
      return res.json(dbFallback[pIdx]);
    }
    res.status(404).json({ error: "Post n\xE3o encontrado" });
  }
});
router2.post("/:id/posts/:postId/comments", async (req, res) => {
  const { postId } = req.params;
  const { authorName, content } = req.body;
  if (!content) {
    return res.status(400).json({ error: "Conte\xFAdo do coment\xE1rio \xE9 obrigat\xF3rio." });
  }
  const newComment = {
    id: "comment_" + Math.random().toString(36).substring(2, 11),
    authorName: authorName || "Comentarista",
    content,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  try {
    const supabase = getSupabaseAdmin();
    const { data: existing, error: getError } = await supabase.from("tournament_posts").select("*").eq("id", postId).maybeSingle();
    if (getError || !existing) {
      if (getError && !getError.message.includes("relation")) throw getError;
      const dbFallback = loadPostsFromFallback();
      const pIdx = dbFallback.findIndex((p) => p.id === postId);
      if (pIdx !== -1) {
        if (!dbFallback[pIdx].comments) dbFallback[pIdx].comments = [];
        dbFallback[pIdx].comments.push(newComment);
        savePostsToFallback(dbFallback);
        return res.json(dbFallback[pIdx]);
      }
      return res.status(404).json({ error: "Post n\xE3o encontrado" });
    }
    const currentComments = existing.comments || [];
    currentComments.push(newComment);
    const { data: updated, error: updateError } = await supabase.from("tournament_posts").update({ comments: currentComments }).eq("id", postId).select().single();
    if (updateError) throw updateError;
    res.json({
      id: updated.id,
      tournamentId: updated.tournament_id,
      authorType: updated.author_type,
      authorName: updated.author_name,
      authorAvatar: updated.author_avatar,
      content: updated.content,
      mediaUrl: updated.media_url,
      mediaType: updated.media_type,
      createdAt: updated.created_at,
      reactions: updated.reactions,
      comments: updated.comments
    });
  } catch (err) {
    const dbFallback = loadPostsFromFallback();
    const pIdx = dbFallback.findIndex((p) => p.id === postId);
    if (pIdx !== -1) {
      if (!dbFallback[pIdx].comments) dbFallback[pIdx].comments = [];
      dbFallback[pIdx].comments.push(newComment);
      savePostsToFallback(dbFallback);
      return res.json(dbFallback[pIdx]);
    }
    res.status(404).json({ error: "Post n\xE3o encontrado" });
  }
});
router2.delete("/:id/posts/:postId", async (req, res) => {
  const { postId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("tournament_posts").delete().eq("id", postId);
    if (error) {
      if (error.message.includes("relation") || error.message.includes("not found") || error.message.includes("does not exist")) {
        const dbFallback = loadPostsFromFallback();
        const cleaned = dbFallback.filter((p) => p.id !== postId);
        savePostsToFallback(cleaned);
        return res.status(204).send();
      }
      throw error;
    }
    res.status(204).send();
  } catch (err) {
    const dbFallback = loadPostsFromFallback();
    const cleaned = dbFallback.filter((p) => p.id !== postId);
    savePostsToFallback(cleaned);
    res.status(204).send();
  }
});
router2.post("/:id/posts/:postId/approve", async (req, res) => {
  const { postId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    const { data: existing, error: getError } = await supabase.from("tournament_posts").select("*").eq("id", postId).maybeSingle();
    if (getError || !existing) {
      if (getError && !getError.message.includes("relation")) throw getError;
      const dbFallback = loadPostsFromFallback();
      const pIdx = dbFallback.findIndex((p) => p.id === postId);
      if (pIdx !== -1) {
        if (!dbFallback[pIdx].reactions) dbFallback[pIdx].reactions = { like: 0, love: 0, applause: 0 };
        dbFallback[pIdx].reactions.is_pending = false;
        savePostsToFallback(dbFallback);
        return res.json(dbFallback[pIdx]);
      }
      return res.status(404).json({ error: "Post n\xE3o encontrado" });
    }
    const currentReactions = existing.reactions || { like: 0, love: 0, applause: 0 };
    currentReactions.is_pending = false;
    const { data: updated, error: updateError } = await supabase.from("tournament_posts").update({ reactions: currentReactions }).eq("id", postId).select().single();
    if (updateError) throw updateError;
    res.json({
      id: updated.id,
      tournamentId: updated.tournament_id,
      authorType: updated.author_type,
      authorName: updated.author_name,
      authorAvatar: updated.author_avatar,
      content: updated.content,
      mediaUrl: updated.media_url,
      mediaType: updated.media_type,
      createdAt: updated.created_at,
      reactions: updated.reactions,
      comments: updated.comments
    });
  } catch (err) {
    const dbFallback = loadPostsFromFallback();
    const pIdx = dbFallback.findIndex((p) => p.id === postId);
    if (pIdx !== -1) {
      if (!dbFallback[pIdx].reactions) dbFallback[pIdx].reactions = { like: 0, love: 0, applause: 0 };
      dbFallback[pIdx].reactions.is_pending = false;
      savePostsToFallback(dbFallback);
      return res.json(dbFallback[pIdx]);
    }
    res.status(404).json({ error: "Post n\xE3o encontrado" });
  }
});
var VISITORS_FILE = path2.join(process.cwd(), "src/backend/data/match_visitors.json");
function loadLocalVisitors() {
  try {
    if (!fs2.existsSync(VISITORS_FILE)) {
      return [];
    }
    return JSON.parse(fs2.readFileSync(VISITORS_FILE, "utf-8"));
  } catch (err) {
    console.error("Erro ao ler match_visitors.json", err);
    return [];
  }
}
function saveLocalVisitors(visitors) {
  try {
    const dir = path2.dirname(VISITORS_FILE);
    if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
    fs2.writeFileSync(VISITORS_FILE, JSON.stringify(visitors, null, 2), "utf-8");
  } catch (err) {
    console.error("Erro ao escrever match_visitors.json", err);
  }
}
async function getMatchVisitorsWithInheritance(matchId, athleteId, tournamentId, supabase, localVisitors) {
  let currentVisitors = [];
  try {
    if (supabase) {
      const { data, error } = await supabase.from("match_visitors").select("name, document").eq("match_id", matchId).eq("athlete_id", athleteId);
      if (!error && data) currentVisitors = data;
    }
  } catch (err) {
  }
  const loadedLocals = localVisitors || loadLocalVisitors();
  if (currentVisitors.length === 0) {
    currentVisitors = loadedLocals.filter((v) => v.matchId === matchId && v.athleteId === athleteId).map((v) => ({ name: v.name, document: v.document }));
  }
  if (currentVisitors.length > 0) {
    return currentVisitors.map((v) => ({ name: v.name, document: v.document, isInherited: false }));
  }
  let allMatches = [];
  try {
    if (supabase) {
      const { data, error } = await supabase.from("matches").select("id, scheduled_time, team1_id, team2_id, round, match_index").eq("tournament_id", tournamentId);
      if (!error && data) allMatches = data;
    }
  } catch (err) {
  }
  let athleteTeams = [];
  try {
    if (supabase) {
      const { data, error } = await supabase.from("team_members").select("team_id").eq("athlete_id", athleteId);
      if (!error && data) athleteTeams = data.map((m) => m.team_id);
    }
  } catch (err) {
  }
  if (athleteTeams.length === 0) {
    return [];
  }
  const athleteMatches = allMatches.filter(
    (m) => athleteTeams.includes(m.team1_id) || athleteTeams.includes(m.team2_id)
  );
  athleteMatches.sort((a, b) => {
    if (a.scheduled_time && b.scheduled_time) {
      return new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime();
    }
    if (a.round !== b.round) return a.round - b.round;
    return (a.match_index || 0) - (b.match_index || 0);
  });
  const currentIdx = athleteMatches.findIndex((m) => m.id === matchId);
  if (currentIdx <= 0) {
    return [];
  }
  for (let i = currentIdx - 1; i >= 0; i--) {
    const prevMatch = athleteMatches[i];
    let prevVisitors = [];
    try {
      if (supabase) {
        const { data, error } = await supabase.from("match_visitors").select("name, document").eq("match_id", prevMatch.id).eq("athlete_id", athleteId);
        if (!error && data) prevVisitors = data;
      }
    } catch (err) {
    }
    if (prevVisitors.length === 0) {
      prevVisitors = loadedLocals.filter((v) => v.matchId === prevMatch.id && v.athleteId === athleteId).map((v) => ({ name: v.name, document: v.document }));
    }
    if (prevVisitors.length > 0) {
      return prevVisitors.map((v) => ({ name: v.name, document: v.document, isInherited: true }));
    }
  }
  return [];
}
router2.get("/venues/:venueId", requireAuth, async (req, res) => {
  const { venueId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("venues").select("*").eq("id", venueId).maybeSingle();
    if (error) throw error;
    if (!data) {
      if (venueId === "venue-1") {
        return res.json({
          id: "venue-1",
          name: "Sede Central (Arena Ol\xEDmpica)",
          address: "Av. das Olimp\xEDadas, 1000 - Centro",
          availability: [
            { day: "Segunda", start: "08:00", end: "22:00" },
            { day: "Ter\xE7a", start: "08:00", end: "22:00" },
            { day: "Quarta", start: "08:00", end: "22:00" },
            { day: "Quinta", start: "08:00", end: "22:00" },
            { day: "Sexta", start: "08:00", end: "22:00" },
            { day: "S\xE1bado", start: "08:00", end: "18:00" }
          ]
        });
      }
      return res.status(404).json({ error: "Sede n\xE3o encontrada" });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.put("/venues/:venueId", requireAuth, async (req, res) => {
  const { venueId } = req.params;
  const { name, address, availability } = req.body;
  try {
    const supabase = getSupabaseAdmin();
    if (venueId === "venue-1") {
      return res.json({ id: venueId, name, address, availability });
    }
    const { data, error } = await supabase.from("venues").update({ name, address, availability }).eq("id", venueId).select().maybeSingle();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.get("/venues/:venueId/matches-with-visitors", requireAuth, async (req, res) => {
  const { venueId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    let matchesQuery = supabase.from("matches").select("id, tournament_id, tournament_category_id, team1_id, team2_id, scheduled_time, round, match_index, court");
    if (venueId !== "venue-1") {
      matchesQuery = matchesQuery.eq("venue_id", venueId);
    }
    const { data: matches, error: matchesErr } = await matchesQuery;
    if (matchesErr) {
      if (matchesErr.message.includes("relation") || matchesErr.message.includes("cache")) {
        return res.json([]);
      }
      throw matchesErr;
    }
    if (!matches || matches.length === 0) {
      return res.json([]);
    }
    const tournamentIds = Array.from(new Set(matches.map((m) => m.tournament_id)));
    const categoryIds = Array.from(new Set(matches.map((m) => m.tournament_category_id)));
    const { data: tournaments } = await supabase.from("tournaments").select("id, name").in("id", tournamentIds);
    const { data: categories } = await supabase.from("tournament_categories").select("id, name, gender, age_group").in("id", categoryIds);
    const teamIds = Array.from(new Set(matches.flatMap((m) => [m.team1_id, m.team2_id]).filter(Boolean)));
    const { data: teams } = teamIds.length > 0 ? await supabase.from("team_registrations").select("id, institution_id, institutions:institution_id(name)").in("id", teamIds) : { data: [], error: null };
    const tournamentMap = new Map(tournaments?.map((t) => [t.id, t.name]) || []);
    const categoryMap = new Map(categories?.map((c) => [c.id, `${c.name} (${c.gender})` + (c.age_group ? ` - ${c.age_group}` : "")]) || []);
    const teamMap = new Map(teams?.map((t) => [t.id, t.institutions?.name || "Clube/Escola"]) || []);
    const { data: teamMembers } = teamIds.length > 0 ? await supabase.from("team_members").select("team_id, athlete_id, members:athlete_id(full_name, document_number)").in("team_id", teamIds) : { data: [], error: null };
    const localVisitors = loadLocalVisitors();
    const result = [];
    for (const match of matches) {
      const tournamentName = tournamentMap.get(match.tournament_id) || "Torneio";
      const categoryName = categoryMap.get(match.tournament_category_id) || "Categoria";
      const team1Name = match.team1_id ? teamMap.get(match.team1_id) : null;
      const team2Name = match.team2_id ? teamMap.get(match.team2_id) : null;
      const matchAthletes = [];
      const t1Members = teamMembers?.filter((m) => m.team_id === match.team1_id) || [];
      for (const m of t1Members) {
        if (m.members) {
          const visitors = await getMatchVisitorsWithInheritance(
            match.id,
            m.athlete_id,
            match.tournament_id,
            supabase,
            localVisitors
          );
          matchAthletes.push({
            athleteId: m.athlete_id,
            athleteName: m.members.full_name,
            document: m.members.document_number,
            teamName: team1Name || "Time A",
            visitors
          });
        }
      }
      const t2Members = teamMembers?.filter((m) => m.team_id === match.team2_id) || [];
      for (const m of t2Members) {
        if (m.members) {
          const visitors = await getMatchVisitorsWithInheritance(
            match.id,
            m.athlete_id,
            match.tournament_id,
            supabase,
            localVisitors
          );
          matchAthletes.push({
            athleteId: m.athlete_id,
            athleteName: m.members.full_name,
            document: m.members.document_number,
            teamName: team2Name || "Time B",
            visitors
          });
        }
      }
      result.push({
        matchId: match.id,
        scheduledTime: match.scheduled_time,
        court: match.court || "Principal",
        round: match.round,
        matchIndex: match.match_index,
        tournamentName,
        categoryName,
        team1Name: team1Name || "Time A",
        team2Name: team2Name || "Time B",
        athletes: matchAthletes
      });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.get("/public/guardian/:email/matches-with-visitors", requireAuth, async (req, res) => {
  const { email } = req.params;
  if (req.user.role !== "super_admin" && req.user.role !== "organizer" && req.user.email.toLowerCase() !== email.toLowerCase()) {
    return res.status(403).json({ error: "Acesso n\xE3o autorizado." });
  }
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  try {
    const supabase = getSupabaseAdmin();
    const db = loadDb();
    let subs = [];
    try {
      const { data, error } = await supabase.from("athlete_subscriptions").select("*").eq("validation_status", "approved");
      if (!error && data) subs = data.map(mapSubToFrontend);
    } catch (err) {
    }
    if (subs.length === 0) {
      subs = db.athleteSubscriptions.filter((s) => s.validationStatus === "approved");
    }
    const uEmail = email.toLowerCase().trim();
    const guardianSubs = subs.filter((s) => {
      return s.parentName && s.parentName.toLowerCase().includes(uEmail) || s.additionalData && s.additionalData.parentEmail && s.additionalData.parentEmail.toLowerCase() === uEmail || s.createdBy === req.user.id;
    });
    if (guardianSubs.length === 0) {
      return res.json([]);
    }
    const documents = guardianSubs.map((s) => s.document).filter(Boolean);
    if (documents.length === 0) {
      return res.json([]);
    }
    let members = [];
    try {
      const { data, error } = await supabase.from("members").select("id, full_name, document_number").in("document_number", documents);
      if (!error && data) members = data;
    } catch (err) {
    }
    if (members.length === 0) {
      return res.json([]);
    }
    const athleteIds = members.map((m) => m.id);
    let teamMembers = [];
    try {
      const { data, error } = await supabase.from("team_members").select("team_id, athlete_id").in("athlete_id", athleteIds);
      if (!error && data) teamMembers = data;
    } catch (err) {
    }
    if (teamMembers.length === 0) {
      return res.json([]);
    }
    const teamIds = teamMembers.map((tm) => tm.team_id);
    let matches = [];
    try {
      const { data, error } = await supabase.from("matches").select("id, tournament_id, tournament_category_id, team1_id, team2_id, scheduled_time, round, match_index, court, venue_id, phase_name").or(`team1_id.in.(${teamIds.join(",")}),team2_id.in.(${teamIds.join(",")})`);
      if (!error && data) matches = data;
    } catch (err) {
    }
    if (matches.length === 0) {
      return res.json([]);
    }
    const tournamentIds = Array.from(new Set(matches.map((m) => m.tournament_id)));
    const categoryIds = Array.from(new Set(matches.map((m) => m.tournament_category_id)));
    const venueIds = Array.from(new Set(matches.map((m) => m.venue_id).filter(Boolean)));
    const { data: tournaments } = await supabase.from("tournaments").select("id, name").in("id", tournamentIds);
    const { data: categories } = await supabase.from("tournament_categories").select("id, name, gender, age_group").in("id", categoryIds);
    const { data: venues } = venueIds.length > 0 ? await supabase.from("venues").select("id, name").in("id", venueIds) : { data: [], error: null };
    const allTeamIds = Array.from(new Set(matches.flatMap((m) => [m.team1_id, m.team2_id]).filter(Boolean)));
    const { data: allTeams } = allTeamIds.length > 0 ? await supabase.from("team_registrations").select("id, institutions:institution_id(name)").in("id", allTeamIds) : { data: [], error: null };
    let settingsList = [];
    try {
      const { data: setList, error: setErr } = await supabase.from("tournament_subscription_settings").select("tournament_id, max_visitors_per_athlete").in("tournament_id", tournamentIds);
      if (!setErr && setList) settingsList = setList;
    } catch (err) {
    }
    const tournamentMap = new Map(tournaments?.map((t) => [t.id, t.name]) || []);
    const categoryMap = new Map(categories?.map((c) => [c.id, `${c.name} (${c.gender})` + (c.age_group ? ` - ${c.age_group}` : "")]) || []);
    const venueMap = new Map(venues?.map((v) => [v.id, v.name]) || []);
    const teamNameMap = new Map(allTeams?.map((t) => [t.id, t.institutions?.name || "Clube/Escola"]) || []);
    const limitMap = new Map(settingsList.map((s) => [s.tournament_id, s.max_visitors_per_athlete]));
    const localVisitors = loadLocalVisitors();
    const result = [];
    for (const match of matches) {
      const matchTeamIds = [match.team1_id, match.team2_id].filter(Boolean);
      const activeTeamMembers = teamMembers.filter(
        (tm) => matchTeamIds.includes(tm.team_id) && athleteIds.includes(tm.athlete_id)
      );
      for (const tm of activeTeamMembers) {
        const athlete = members.find((m) => m.id === tm.athlete_id);
        if (!athlete) continue;
        const athleteTeamId = tm.team_id;
        const opponentTeamId = match.team1_id === athleteTeamId ? match.team2_id : match.team1_id;
        const opponentName = opponentTeamId ? teamNameMap.get(opponentTeamId) || "Outra Equipe" : "A Definir";
        const myTeamName = athleteTeamId ? teamNameMap.get(athleteTeamId) || "Minha Equipe" : "Minha Equipe";
        let maxLimit = limitMap.get(match.tournament_id);
        if (maxLimit === void 0) {
          const localSettings = db.settings[match.tournament_id];
          maxLimit = localSettings?.maxVisitorsPerAthlete || 0;
        }
        const visitors = await getMatchVisitorsWithInheritance(
          match.id,
          athlete.id,
          match.tournament_id,
          supabase,
          localVisitors
        );
        let canEdit = true;
        if (match.scheduled_time) {
          const timeDiff = new Date(match.scheduled_time).getTime() - Date.now();
          if (timeDiff < 24 * 60 * 60 * 1e3) {
            canEdit = false;
          }
        }
        result.push({
          matchId: match.id,
          matchTime: match.scheduled_time,
          court: match.court || "Principal",
          round: match.round,
          phase: match.phase_name || `Rodada ${match.round}`,
          myTeamName,
          opponentTeamName: opponentName,
          categoryName: categoryMap.get(match.tournament_category_id) || "Categoria",
          tournamentName: tournamentMap.get(match.tournament_id) || "Torneio",
          venueName: match.venue_id ? venueMap.get(match.venue_id) || "Local do Jogo" : "Sede a Definir",
          athleteId: athlete.id,
          athleteName: athlete.full_name,
          maxVisitors: maxLimit,
          visitors,
          canEdit
        });
      }
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.post("/public/athlete-subscription/match/:matchId/athlete/:athleteId/visitors", requireAuth, async (req, res) => {
  const { matchId, athleteId } = req.params;
  const { visitors } = req.body;
  if (!Array.isArray(visitors)) {
    return res.status(400).json({ error: "O payload de visitantes deve ser um array." });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data: match, error: matchErr } = await supabase.from("matches").select("scheduled_time, tournament_id").eq("id", matchId).maybeSingle();
    if (matchErr) throw matchErr;
    if (!match) {
      return res.status(404).json({ error: "Partida n\xE3o encontrada." });
    }
    if (match.scheduled_time) {
      const timeDiff = new Date(match.scheduled_time).getTime() - Date.now();
      if (timeDiff < 24 * 60 * 60 * 1e3) {
        return res.status(400).json({ error: "N\xE3o \xE9 poss\xEDvel alterar a lista de visitantes nas 24h anteriores ao in\xEDcio do jogo." });
      }
    }
    const settings = await getSubscriptionSettings(match.tournament_id);
    const maxLimit = settings?.maxVisitorsPerAthlete || 0;
    if (maxLimit > 0 && visitors.length > maxLimit) {
      return res.status(400).json({ error: `O limite m\xE1ximo permitido para este torneio \xE9 de ${maxLimit} visitantes por atleta.` });
    }
    let dbSuccess = false;
    try {
      const { error: deleteErr } = await supabase.from("match_visitors").delete().eq("match_id", matchId).eq("athlete_id", athleteId);
      if (!deleteErr) {
        if (visitors.length > 0) {
          const rows = visitors.map((v) => ({
            match_id: matchId,
            athlete_id: athleteId,
            name: v.name.trim(),
            document: v.document.trim()
          }));
          const { error: insertErr } = await supabase.from("match_visitors").insert(rows);
          if (!insertErr) {
            dbSuccess = true;
          } else {
            throw insertErr;
          }
        } else {
          dbSuccess = true;
        }
      }
    } catch (dbErr) {
      console.warn("Erro ao salvar no banco original match_visitors, usando local fallback JSON", dbErr.message);
    }
    const localVisitors = loadLocalVisitors();
    const filtered = localVisitors.filter((v) => !(v.matchId === matchId && v.athleteId === athleteId));
    if (visitors.length > 0) {
      visitors.forEach((v) => {
        filtered.push({
          id: `mv_${Math.random().toString(36).substring(2, 11)}`,
          matchId,
          athleteId,
          name: v.name.trim(),
          document: v.document.trim(),
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      });
    }
    saveLocalVisitors(filtered);
    res.json({ success: true, count: visitors.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var tournamentRoutes_default = router2;

// src/backend/routes/memberRoutes.ts
import { Router as Router3 } from "express";
import fs3 from "fs";
import path3 from "path";
var router3 = Router3();
var ORG_INST_FILE2 = path3.join(process.cwd(), "src", "backend", "data", "organizer_institutions.json");
var ACCOUNTS_FILE3 = path3.join(process.cwd(), "src", "backend", "data", "accounts.json");
function loadOrgInstitutions2() {
  try {
    if (fs3.existsSync(ORG_INST_FILE2)) {
      return JSON.parse(fs3.readFileSync(ORG_INST_FILE2, "utf-8"));
    }
  } catch (e) {
  }
  return {};
}
function getUserRole(userId) {
  try {
    if (fs3.existsSync(ACCOUNTS_FILE3)) {
      const accounts = JSON.parse(fs3.readFileSync(ACCOUNTS_FILE3, "utf-8"));
      const user = accounts.find((a) => a.id === userId);
      return user ? user.role || null : null;
    }
  } catch (e) {
  }
  return null;
}
router3.post("/", requireAuth, async (req, res) => {
  const { institution_id, full_name, document_number, birth_date } = req.body;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("members").insert([{
      institution_id,
      full_name,
      document_number,
      birth_date,
      status: "authorized"
    }]).select().maybeSingle();
    if (error) {
      if (error.code === "23505") return res.status(400).json({ error: "Este documento j\xE1 est\xE1 cadastrado." });
      throw error;
    }
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router3.get("/institution/:institutionId", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("members").select("*").eq("institution_id", req.params.institutionId).order("full_name");
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router3.get("/", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const organizerId = req.user.id;
    const { data, error } = await supabase.from("members").select(`
        *,
        institutions (name)
      `).order("created_at", { ascending: false });
    if (error) throw error;
    if (organizerId) {
      const role = getUserRole(organizerId);
      if (role !== "super_admin") {
        const mapping = loadOrgInstitutions2();
        const allowedInstIds = mapping[organizerId] || [];
        const filtered = (data || []).filter((m) => allowedInstIds.includes(m.institution_id));
        return res.json(filtered);
      }
    }
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router3.get("/:id/stats", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { data: events, error } = await supabase.from("match_events").select(`
        *,
        match:match_id(
          tournament:tournament_id(name),
          category:tournament_category_id(name)
        )
      `).eq("athlete_id", id).order("created_at", { ascending: false });
    if (error) throw error;
    let goals = 0;
    let yellowCards = 0;
    let redCards = 0;
    events.forEach((e) => {
      if (e.event_type.startsWith("goal")) {
        goals += e.event_type === "goal_2" ? 2 : e.event_type === "goal_3" ? 3 : 1;
      }
      if (e.event_type === "yellow_card") yellowCards++;
      if (e.event_type === "red_card") redCards++;
    });
    res.json({
      goals,
      yellowCards,
      redCards,
      events
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
var memberRoutes_default = router3;

// src/backend/routes/authRoutes.ts
import { Router as Router4 } from "express";
import * as fs4 from "fs";
import * as path4 from "path";
import bcrypt2 from "bcryptjs";
var router4 = Router4();
var ACCOUNTS_FILE4 = path4.join(process.cwd(), "src/backend/data/accounts.json");
var BCRYPT_ROUNDS = 10;
async function loadAccountsDb() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("portal_accounts").select("*");
    if (!error && data) {
      const accounts = data.map((a) => ({
        id: a.id,
        email: a.email,
        passwordHash: a.password_hash,
        role: a.role,
        name: a.name,
        referenceId: a.reference_id || void 0,
        createdAt: a.created_at
      }));
      saveAccountsDb(accounts);
      return accounts;
    }
  } catch (err) {
  }
  try {
    const dir = path4.dirname(ACCOUNTS_FILE4);
    if (!fs4.existsSync(dir)) fs4.mkdirSync(dir, { recursive: true });
    if (!fs4.existsSync(ACCOUNTS_FILE4)) {
      const defaultAccounts = [
        {
          id: "sa-1",
          email: "admin@querocompetir.com.br",
          // Plaintext — will be automatically hashed on first login
          passwordHash: "admin123",
          role: "super_admin",
          name: "Super Admin (SaaS Manager)",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        {
          id: "org-1",
          email: "organizador@querocompetir.com.br",
          // Plaintext — will be automatically hashed on first login
          passwordHash: "org123",
          role: "organizer",
          name: "Organizador Principal",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ];
      fs4.writeFileSync(ACCOUNTS_FILE4, JSON.stringify(defaultAccounts, null, 2));
      return defaultAccounts;
    }
    return JSON.parse(fs4.readFileSync(ACCOUNTS_FILE4, "utf-8"));
  } catch (err) {
    console.error("Error reading accounts.json", err);
    return [];
  }
}
function saveAccountsDb(accounts) {
  try {
    const dir = path4.dirname(ACCOUNTS_FILE4);
    if (!fs4.existsSync(dir)) fs4.mkdirSync(dir, { recursive: true });
    fs4.writeFileSync(ACCOUNTS_FILE4, JSON.stringify(accounts, null, 2));
  } catch (err) {
    console.error("Error writing accounts.json", err);
  }
}
function isPlaintextPassword(hash) {
  return !hash.startsWith("$2a$") && !hash.startsWith("$2b$");
}
async function verifyAndMigratePassword(plaintext, account, accounts) {
  if (isPlaintextPassword(account.passwordHash)) {
    if (account.passwordHash !== plaintext) return false;
    account.passwordHash = await bcrypt2.hash(plaintext, BCRYPT_ROUNDS);
    saveAccountsDb(accounts);
    return true;
  }
  return bcrypt2.compare(plaintext, account.passwordHash);
}
async function syncWithSupabase(accounts) {
  try {
    const supabase = getSupabaseAdmin();
    const { error: testError } = await supabase.from("portal_accounts").select("id").limit(1);
    if (!testError) {
      const mapped = accounts.map((a) => ({
        id: a.id,
        email: a.email,
        password_hash: a.passwordHash,
        role: a.role,
        name: a.name,
        reference_id: a.referenceId || null,
        created_at: a.createdAt
      }));
      const { error: upsertError } = await supabase.from("portal_accounts").upsert(mapped);
      if (upsertError) {
        console.error("Error upserting accounts to Supabase portal_accounts:", upsertError);
      } else {
        console.log(`Successfully synced ${mapped.length} accounts to Supabase portal_accounts.`);
      }
    } else {
      console.warn("portal_accounts table not accessible or does not exist yet:", testError.message);
    }
  } catch (err) {
    console.error("Error syncing with Supabase:", err.message || err);
  }
}
router4.post("/login", async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha s\xE3o obrigat\xF3rios." });
  }
  try {
    const accounts = await loadAccountsDb();
    let user = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
    if (user) {
      const passwordValid = await verifyAndMigratePassword(password, user, accounts);
      if (!passwordValid) {
        return res.status(401).json({ error: "Credenciais inv\xE1lidas. Verifique seu e-mail e senha." });
      }
    } else {
      if (role === "institution") {
        try {
          const supabase = getSupabaseAdmin();
          const { data: schools } = await supabase.from("institutions").select("*");
          if (schools && schools.length > 0) {
            const found = schools.find((inst) => {
              const emailClean = (inst.email || "").toLowerCase().trim();
              const nameClean = inst.name.toLowerCase().replace(/[^a-z0-9]/g, "");
              const nameCleanShort = inst.name.toLowerCase().replace(/\s+/g, "").substring(0, 15);
              const inputEmailClean = email.toLowerCase().trim();
              const inputPrefix = inputEmailClean.split("@")[0];
              return emailClean === inputEmailClean || `${nameClean}@querocompetir.com.br` === inputEmailClean || `${nameCleanShort}@querocompetir.com.br` === inputEmailClean || inputPrefix === nameClean || nameClean.startsWith(inputPrefix) || inputPrefix.startsWith(nameClean);
            });
            if (found) {
              const newAcc = {
                id: `inst-acc-${found.id}`,
                email: email.toLowerCase().trim(),
                passwordHash: await bcrypt2.hash(password, BCRYPT_ROUNDS),
                role: "institution",
                name: found.name,
                referenceId: found.id,
                createdAt: (/* @__PURE__ */ new Date()).toISOString()
              };
              accounts.push(newAcc);
              saveAccountsDb(accounts);
              await syncWithSupabase(accounts);
              user = newAcc;
            }
          }
        } catch (err) {
          console.error("Dynamic institution login fallback failed:", err);
        }
      }
      if (!user) {
        return res.status(401).json({ error: "Credenciais inv\xE1lidas. Verifique seu e-mail e senha." });
      }
    }
    if (role && user.role !== role) {
      if (user.role !== "super_admin" && user.role !== "organizer") {
        return res.status(403).json({ error: "Seu perfil n\xE3o possui acesso para esta \xE1rea." });
      }
    }
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      referenceId: user.referenceId
    };
    const token = generateToken(tokenPayload);
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      referenceId: user.referenceId,
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router4.post("/register", async (req, res) => {
  const { email, password, role, name, referenceId } = req.body;
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: "E-mail, senha, nome e perfil s\xE3o obrigat\xF3rios." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "A senha deve ter no m\xEDnimo 6 caracteres." });
  }
  try {
    const accounts = await loadAccountsDb();
    const exists = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      return res.status(400).json({ error: "Este endere\xE7o de e-mail j\xE1 est\xE1 cadastrado." });
    }
    const passwordHash = await bcrypt2.hash(password, BCRYPT_ROUNDS);
    const newAccount = {
      id: `acc_${Math.random().toString(36).substring(2, 11)}`,
      email: email.toLowerCase(),
      passwordHash,
      role,
      name,
      referenceId: referenceId || void 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    accounts.push(newAccount);
    saveAccountsDb(accounts);
    await syncWithSupabase(accounts);
    const token = generateToken({
      id: newAccount.id,
      email: newAccount.email,
      role: newAccount.role,
      name: newAccount.name,
      referenceId: newAccount.referenceId
    });
    res.status(201).json({
      id: newAccount.id,
      email: newAccount.email,
      role: newAccount.role,
      name: newAccount.name,
      referenceId: newAccount.referenceId,
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router4.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Senha atual e nova senha s\xE3o obrigat\xF3rias." });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "A nova senha deve ter no m\xEDnimo 6 caracteres." });
  }
  try {
    const accounts = await loadAccountsDb();
    const account = accounts.find((a) => a.id === userId);
    if (!account) return res.status(404).json({ error: "Usu\xE1rio n\xE3o encontrado." });
    const valid = await verifyAndMigratePassword(currentPassword, account, accounts);
    if (!valid) return res.status(401).json({ error: "Senha atual incorreta." });
    account.passwordHash = await bcrypt2.hash(newPassword, BCRYPT_ROUNDS);
    saveAccountsDb(accounts);
    await syncWithSupabase(accounts);
    res.json({ success: true, message: "Senha alterada com sucesso." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router4.post("/seed", async (req, res) => {
  try {
    const accounts = await loadAccountsDb();
    const adminExists = accounts.find((a) => a.email === "admin@querocompetir.com.br");
    if (!adminExists) {
      accounts.push({
        id: "sa-1",
        email: "admin@querocompetir.com.br",
        passwordHash: await bcrypt2.hash("admin123", BCRYPT_ROUNDS),
        role: "super_admin",
        name: "Super Admin (SaaS Manager)",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } else {
      adminExists.passwordHash = await bcrypt2.hash("admin123", BCRYPT_ROUNDS);
    }
    const orgExists = accounts.find((a) => a.email === "organizador@querocompetir.com.br");
    if (!orgExists) {
      accounts.push({
        id: "org-1",
        email: "organizador@querocompetir.com.br",
        passwordHash: await bcrypt2.hash("org123", BCRYPT_ROUNDS),
        role: "organizer",
        name: "Organizador Principal",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } else {
      orgExists.passwordHash = await bcrypt2.hash("org123", BCRYPT_ROUNDS);
    }
    try {
      const supabase = getSupabaseAdmin();
      const { data: schools } = await supabase.from("institutions").select("id, name");
      if (schools && schools.length > 0) {
        for (const inst of schools) {
          const formattedEmail = `${inst.name.toLowerCase().replace(/\s+/g, "").substring(0, 15)}@querocompetir.com.br`;
          const exists = accounts.find((a) => a.referenceId === inst.id);
          const emailExists = accounts.find((a) => a.email.toLowerCase() === formattedEmail.toLowerCase());
          if (!exists && !emailExists) {
            accounts.push({
              id: `inst-acc-${inst.id}`,
              email: formattedEmail,
              passwordHash: await bcrypt2.hash("clube123", BCRYPT_ROUNDS),
              role: "institution",
              name: inst.name,
              referenceId: inst.id,
              createdAt: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
      }
    } catch (e) {
      console.warn("Could not seed from Supabase:", e);
    }
    try {
      const supabase = getSupabaseAdmin();
      let { data: venuesList } = await supabase.from("venues").select("id, name");
      if (!venuesList || venuesList.length === 0) {
        const { data: newVenue, error: vErr } = await supabase.from("venues").insert([{
          name: "Sede Central (Arena Ol\xEDmpica)",
          address: "Av. das Olimp\xEDadas, 1000 - Centro",
          availability: [
            { day: "Segunda", start: "08:00", end: "22:00" },
            { day: "Ter\xE7a", start: "08:00", end: "22:00" },
            { day: "Quarta", start: "08:00", end: "22:00" },
            { day: "Quinta", start: "08:00", end: "22:00" },
            { day: "Sexta", start: "08:00", end: "22:00" },
            { day: "S\xE1bado", start: "08:00", end: "18:00" }
          ]
        }]).select("id, name");
        if (!vErr && newVenue) {
          venuesList = newVenue;
        }
      }
      if (venuesList && venuesList.length > 0) {
        for (const venue of venuesList) {
          const formattedEmail = `${venue.name.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 15)}@querocompetir.com.br`;
          const exists = accounts.find((a) => a.referenceId === venue.id);
          const emailExists = accounts.find((a) => a.email.toLowerCase() === formattedEmail.toLowerCase());
          if (!exists && !emailExists) {
            accounts.push({
              id: `venue-acc-${venue.id}`,
              email: formattedEmail,
              passwordHash: await bcrypt2.hash("sede123", BCRYPT_ROUNDS),
              role: "venue",
              name: venue.name,
              referenceId: venue.id,
              createdAt: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
      }
    } catch (e) {
      console.warn("Could not seed venues from Supabase:", e);
    }
    const venueStaticExists = accounts.find((a) => a.email === "sede@querocompetir.com.br");
    if (!venueStaticExists) {
      accounts.push({
        id: "venue-acc-static",
        email: "sede@querocompetir.com.br",
        passwordHash: await bcrypt2.hash("sede123", BCRYPT_ROUNDS),
        role: "venue",
        name: "Sede Central (Arena Ol\xEDmpica)",
        referenceId: "00000000-0000-0000-0000-000000000001",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } else {
      venueStaticExists.referenceId = "00000000-0000-0000-0000-000000000001";
    }
    const uniqueAccounts = [];
    const seenEmails = /* @__PURE__ */ new Set();
    for (const acc of accounts) {
      const emailLower = acc.email.toLowerCase();
      if (!seenEmails.has(emailLower)) {
        seenEmails.add(emailLower);
        uniqueAccounts.push(acc);
      }
    }
    saveAccountsDb(uniqueAccounts);
    await syncWithSupabase(uniqueAccounts);
    res.json({
      success: true,
      count: uniqueAccounts.length,
      // Não retornar hashes, apenas e-mails para referência
      accounts: uniqueAccounts.map((a) => ({ email: a.email, role: a.role, name: a.name }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router4.get("/users", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const accounts = await loadAccountsDb();
    res.json(
      accounts.map((a) => ({
        id: a.id,
        email: a.email,
        role: a.role,
        name: a.name,
        referenceId: a.referenceId,
        createdAt: a.createdAt
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router4.delete("/users/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    let accounts = await loadAccountsDb();
    accounts = accounts.filter((a) => a.id !== req.params.id);
    saveAccountsDb(accounts);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router4.get("/guardian/:email/athletes", requireAuth, async (req, res) => {
  const { email } = req.params;
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  try {
    const supabase = getSupabaseAdmin();
    const { data: subs, error: subError } = await supabase.from("athlete_subscriptions").select(`
        *,
        institutions:institution_id(name),
        tournaments:tournament_id(name, owner_id)
      `);
    console.log("=== DEBUG GUARDIAN ATHLETES ===");
    console.log("subError:", subError);
    console.log("subs length:", subs?.length);
    if (subs && subs.length > 0) {
      console.log("subs[0] keys:", Object.keys(subs[0]));
      console.log("subs[0] institutions:", subs[0].institutions);
      console.log("subs[0] tournaments:", subs[0].tournaments);
    }
    if (!subError && subs) {
      const ownerIds = Array.from(new Set(subs.map((s) => s.tournaments?.owner_id).filter(Boolean)));
      const orgMap = /* @__PURE__ */ new Map();
      if (ownerIds.length > 0) {
        const { data: orgs } = await supabase.from("organizations").select("id, name").in("id", ownerIds);
        if (orgs) {
          orgs.forEach((o) => orgMap.set(o.id, o.name));
        }
      }
      const enriched = subs.map((s) => {
        const ownerId = s.tournaments?.owner_id;
        return {
          ...s,
          organizer_name: ownerId ? orgMap.get(ownerId) : "Organizador"
        };
      });
      return res.json(enriched);
    }
    const DATA_FILE2 = path4.join(process.cwd(), "src/backend/data/subscriptions.json");
    if (fs4.existsSync(DATA_FILE2)) {
      const raw = fs4.readFileSync(DATA_FILE2, "utf-8");
      const db = JSON.parse(raw);
      return res.json(db.athleteSubscriptions || []);
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var authRoutes_default = router4;

// src/backend/routes/membershipRoutes.ts
import { Router as Router5 } from "express";
var router5 = Router5();
router5.get("/status", async (req, res) => {
  const { memberId, organizationId, year } = req.query;
  if (!memberId || !organizationId || !year) {
    return res.status(400).json({ error: "Par\xE2metros obrigat\xF3rios ausentes (memberId, organizationId, year)." });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("memberships").select("*").eq("member_id", memberId).eq("organization_id", organizationId).eq("year", parseInt(year, 10)).maybeSingle();
    if (error) throw error;
    if (data) {
      return res.json({
        status: data.status,
        paymentStatus: data.payment_status,
        membership: data
      });
    }
    return res.json({
      status: "pending",
      paymentStatus: "pending",
      membership: null
    });
  } catch (err) {
    console.error("Erro ao carregar anuidade do atleta (fallback ativado):", err.message);
    return res.json({
      status: "active",
      paymentStatus: "paid",
      fallback: true
    });
  }
});
router5.post("/checkout", async (req, res) => {
  const { memberId, organizationId, year } = req.body;
  if (!memberId || !organizationId || !year) {
    return res.status(400).json({ error: "Dados inv\xE1lidos para checkout da anuidade." });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("memberships").upsert({
      member_id: memberId,
      organization_id: organizationId,
      year: parseInt(year, 10),
      status: "active",
      payment_status: "paid",
      payment_id: `pix_${Math.random().toString(36).substring(2, 11)}`,
      paid_at: (/* @__PURE__ */ new Date()).toISOString()
    }, {
      onConflict: "organization_id,member_id,year"
    }).select().maybeSingle();
    if (error) throw error;
    res.json({
      success: true,
      message: "Anuidade paga e filia\xE7\xE3o ativada com sucesso!",
      membership: data
    });
  } catch (err) {
    console.error("Erro no checkout de anuidade:", err.message);
    res.status(500).json({ error: "Erro ao processar pagamento da anuidade. Verifique se executou a migra\xE7\xE3o SQL no Supabase." });
  }
});
router5.post("/offline-approve", requireAuth, async (req, res) => {
  const { memberId, organizationId, year } = req.body;
  const userRole = req.user?.role;
  if (userRole !== "organizer" && userRole !== "super_admin") {
    return res.status(403).json({ error: "Apenas organizadores podem aprovar filia\xE7\xF5es offline." });
  }
  if (!memberId || !organizationId || !year) {
    return res.status(400).json({ error: "Dados insuficientes para aprova\xE7\xE3o." });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("memberships").upsert({
      member_id: memberId,
      organization_id: organizationId,
      year: parseInt(year, 10),
      status: "active",
      payment_status: "paid",
      payment_id: `manual_approve_${req.user?.id || "admin"}`,
      paid_at: (/* @__PURE__ */ new Date()).toISOString()
    }, {
      onConflict: "organization_id,member_id,year"
    }).select().maybeSingle();
    if (error) throw error;
    res.json({
      success: true,
      message: "Afilia\xE7\xE3o aprovada manualmente com sucesso!",
      membership: data
    });
  } catch (err) {
    console.error("Erro na aprova\xE7\xE3o offline da filia\xE7\xE3o:", err.message);
    res.status(500).json({ error: err.message });
  }
});
router5.post("/status-bulk", async (req, res) => {
  const { memberIds, organizationId, year } = req.body;
  if (!memberIds || !organizationId || !year) {
    return res.status(400).json({ error: "Par\xE2metros obrigat\xF3rios ausentes (memberIds, organizationId, year)." });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("memberships").select("member_id, status, payment_status").eq("organization_id", organizationId).eq("year", parseInt(year, 10)).in("member_id", memberIds);
    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error("Erro ao carregar anuidades em lote (fallback ativado):", err.message);
    return res.json(memberIds.map((id) => ({
      member_id: id,
      status: "active",
      payment_status: "paid"
    })));
  }
});
var membershipRoutes_default = router5;

// src/backend/app.ts
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
var app = express();
var isProduction = process.env.NODE_ENV === "production";
app.use(
  helmet({
    contentSecurityPolicy: isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: [
          "'self'",
          process.env.SUPABASE_URL || "",
          "https://*.supabase.co",
          "wss://*.supabase.co"
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"]
      }
    } : false
    // Disable CSP in development for easier debugging
  })
);
var allowedOrigins = process.env.APP_URL ? [process.env.APP_URL, "http://localhost:3000", "http://localhost:5173"] : null;
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (!allowedOrigins) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true
  })
);
app.use(morgan(isProduction ? "combined" : "dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0", env: process.env.NODE_ENV || "development" });
});
app.get("/api/health/env", (_req, res) => {
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "JWT_SECRET"];
  const optional = ["APP_URL", "PAGARME_PUBLIC_KEY", "PAGARME_SECRET_KEY", "NODE_ENV"];
  const report = {};
  for (const key of required) {
    const val = process.env[key];
    if (!val) report[key] = "\u274C MISSING";
    else if (key === "JWT_SECRET") report[key] = val.length >= 32 ? `\u2705 SET (${val.length} chars)` : `\u26A0\uFE0F TOO SHORT (${val.length} chars, need \u226532)`;
    else if (key === "SUPABASE_URL") report[key] = val.startsWith("https://") ? `\u2705 SET` : `\u26A0\uFE0F INVALID (must start with https://)`;
    else report[key] = "\u2705 SET";
  }
  for (const key of optional) {
    report[key] = process.env[key] ? "\u2705 SET" : "\u26AA not set (optional)";
  }
  res.json({ status: "ok", variables: report });
});
app.use(optionalAuth);
app.use("/api/institutions", institutionRoutes_default);
app.use("/api/tournaments", tournamentRoutes_default);
app.use("/api/members", memberRoutes_default);
app.use("/api/auth", authRoutes_default);
app.use("/api/memberships", membershipRoutes_default);
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Erro interno do servidor.";
  console.error(`[ERROR ${status}]`, message);
  res.status(status).json({ error: message });
});
var app_default = app;

// api/_entry.ts
var entry_default = app_default;
export {
  entry_default as default
};
//# sourceMappingURL=index.js.map
