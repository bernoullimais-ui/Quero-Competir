import { Router } from "express";
import { generatePixEMV } from '../utils/pix.ts';
import { getSupabaseAdmin } from "../lib/supabase.ts";
import fs from "fs";
import path from "path";
import { requireAuth, generateToken } from "../middleware/auth.ts";

const router = Router();

const ORG_INST_FILE = path.join(process.cwd(), "src", "backend", "data", "organizer_institutions.json");
const INVITATIONS_FILE = path.join(process.cwd(), "src", "backend", "data", "institution_invitations.json");
const ACCOUNTS_FILE = path.join(process.cwd(), "src", "backend", "data", "accounts.json");

// ── Organizer→Institution mapping backed by Supabase (Vercel-safe) ────────────
// Falls back to local JSON for local dev environments.

async function loadOrgInstitutionsDb(organizerId: string): Promise<string[]> {
  // 1. Try Supabase organizer_institutions table (works on Vercel)
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("organizer_institutions")
      .select("institution_id")
      .eq("organizer_account_id", organizerId);
    if (!error && data) {
      return data.map((r: any) => r.institution_id);
    }
  } catch (_) {}

  // 2. Fallback: local JSON (dev environment)
  try {
    if (fs.existsSync(ORG_INST_FILE)) {
      const map: Record<string, string[]> = JSON.parse(fs.readFileSync(ORG_INST_FILE, "utf-8"));
      return map[organizerId] || [];
    }
  } catch (_) {}

  return [];
}

async function saveOrgInstitutionDb(organizerId: string, institutionId: string): Promise<void> {
  // 1. Persist to Supabase
  try {
    const supabase = getSupabaseAdmin();
    await supabase
      .from("organizer_institutions")
      .upsert({ organizer_account_id: organizerId, institution_id: institutionId })
      .select();
  } catch (_) {}

  // 2. Also update local JSON (keeps dev env in sync)
  try {
    const dir = path.dirname(ORG_INST_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let map: Record<string, string[]> = {};
    if (fs.existsSync(ORG_INST_FILE)) {
      map = JSON.parse(fs.readFileSync(ORG_INST_FILE, "utf-8"));
    }
    if (!map[organizerId]) map[organizerId] = [];
    if (!map[organizerId].includes(institutionId)) map[organizerId].push(institutionId);
    fs.writeFileSync(ORG_INST_FILE, JSON.stringify(map, null, 2), "utf-8");
  } catch (_) {}
}

// Keep legacy sync helpers for code paths that haven't been migrated yet
function loadOrgInstitutions(): Record<string, string[]> {
  try {
    if (fs.existsSync(ORG_INST_FILE)) return JSON.parse(fs.readFileSync(ORG_INST_FILE, "utf-8"));
  } catch (_) {}
  return {};
}

function saveOrgInstitutions(data: Record<string, string[]>) {
  try {
    const dir = path.dirname(ORG_INST_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ORG_INST_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (_) {}
}

function ensureInvitationsFile() {
  try {
    const dir = path.dirname(INVITATIONS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(INVITATIONS_FILE)) fs.writeFileSync(INVITATIONS_FILE, "[]", "utf-8");
  } catch (_) {}
}

function loadInvitations(): any[] {
  ensureInvitationsFile();
  try {
    return JSON.parse(fs.readFileSync(INVITATIONS_FILE, "utf-8"));
  } catch (e) {
    return [];
  }
}

function saveInvitations(data: any[]) {
  ensureInvitationsFile();
  try {
    fs.writeFileSync(INVITATIONS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {}
}

function getUserRoleAndReferenceId(userId: string): { role: string | null; name: string | null, referenceId: string | null } {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
      const user = accounts.find((a: any) => a.id === userId);
      if (user) return { role: user.role || null, name: user.name || null, referenceId: user.referenceId || null };
    }
  } catch (e) {}
  return { role: null, name: null, referenceId: null };
}

async function getUserRoleFromDb(userId: string, jwtRole?: string): Promise<string | null> {
  if (jwtRole) return jwtRole;
  // Try local JSON first
  const local = getUserRoleAndReferenceId(userId);
  if (local.role) return local.role;
  // Fallback to Supabase portal_accounts
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from("portal_accounts").select("role").eq("id", userId).maybeSingle();
    return data?.role || null;
  } catch (_) {
    return null;
  }
}

// Registrar uma nova instituição
router.post("/", requireAuth, async (req, res) => {
  const { name, document_number, email, responsible_name, responsible_phone, logo_url } = req.body;
  const organizerId = req.user!.id;

  try {
    const supabase = getSupabaseAdmin();

    // Insert institution — try different column names for compatibility
    let instData: any = null;
    let instError: any = null;

    const attempts = [
      { tax_id: document_number, name, email, responsible_name, responsible_phone, logo_url },
      { document_number, name, email, responsible_name, responsible_phone, logo_url },
      { cnpj: document_number, name, email, responsible_name, responsible_phone, logo_url },
    ];

    for (const payload of attempts) {
      const { data, error } = await supabase.from('institutions').insert([payload]).select().maybeSingle();
      if (!error) { instData = data; break; }
      instError = error;
      if (!error.message.includes('tax_id') && !error.message.includes('document_number') && !error.message.includes('cnpj')) break;
    }

    if (!instData) {
      console.error("Erro Final Supabase:", instError);
      return res.status(500).json({
        error: instError?.message || "Erro ao criar instituição",
        hint: "Verifique se a coluna de documento no banco é 'tax_id', 'document_number' ou 'cnpj'"
      });
    }

    // Persist organizer→institution mapping to Supabase (Vercel-safe)
    if (organizerId && instData.id) {
      await saveOrgInstitutionDb(organizerId, instData.id);
    }

    res.status(201).json(instData);
  } catch (error: any) {
    console.error("Erro Final Supabase:", error);
    res.status(500).json({
      error: error.message,
      hint: "Verifique se a coluna de documento no banco é 'tax_id', 'document_number' ou 'cnpj'"
    });
  }
});

// Buscar instituição por ID
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const organizerId = req.user!.id;

    if (organizerId) {
      const { role } = getUserRoleAndReferenceId(organizerId);
      if (role !== "super_admin" && role !== "institution") {
        const mapping = loadOrgInstitutions();
        const allowed = mapping[organizerId] || [];
        if (!allowed.includes(req.params.id)) {
          return res.status(403).json({ error: "Você não tem permissão para acessar esta instituição." });
        }
      }
    }

    const { data, error } = await supabase
      .from('institutions')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: "Instituição não encontrada" });
      throw error;
    }

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar instituição por ID
router.put("/:id", requireAuth, async (req, res) => {
  const { name, document_number, email, responsible_name, responsible_phone, logo_url } = req.body;
  const organizerId = req.user!.id;

  try {
    if (organizerId) {
      const { role } = getUserRoleAndReferenceId(organizerId);
      if (role !== "super_admin" && role !== "institution") {
        const mapping = loadOrgInstitutions();
        const allowed = mapping[organizerId] || [];
        if (!allowed.includes(req.params.id)) {
          return res.status(403).json({ error: "Você não tem permissão para editar esta instituição." });
        }
      }
    }

    const supabase = getSupabaseAdmin();
    // Tenta atualizar com tax_id
    let updatePayload: any = { name, email, responsible_name, responsible_phone, logo_url };
    
    // Tentativa 1: update com tax_id
    const { data, error } = await supabase
      .from('institutions')
      .update({ ...updatePayload, tax_id: document_number })
      .eq('id', req.params.id)
      .select()
      .maybeSingle();

    if (error) {
      if (error.message.includes('tax_id')) {
        const { data: d2, error: e2 } = await supabase
          .from('institutions')
          .update({ ...updatePayload, document_number })
          .eq('id', req.params.id)
          .select().maybeSingle();
        if (!e2) return res.json(d2);

        const { data: d3, error: e3 } = await supabase
          .from('institutions')
          .update({ ...updatePayload, cnpj: document_number })
          .eq('id', req.params.id)
          .select().maybeSingle();
        if (!e3) return res.json(d3);
      }
      throw error;
    }

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Listar instituições com suporte a isolamento e painel geral da plataforma
router.get("/", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const reqUser = req.user!;
    const organizerId = reqUser.id;
    const allPlatform = req.query.all_platform === "true";

    // Resolve role from JWT (most reliable) or fallback sources
    const role = await getUserRoleFromDb(organizerId, (reqUser as any).role);
    const isSuperAdmin = role === "super_admin";

    // Load institutions allowed for this organizer from Supabase (Vercel-safe)
    let allowedInstIds: string[] = [];
    if (!isSuperAdmin) {
      allowedInstIds = await loadOrgInstitutionsDb(organizerId);
    }

    // Fetch institutions — try different column names for compatibility
    let rawData: any[] = [];
    let fetchError: any = null;

    let { data, error } = await supabase.from('institutions').select('id, name, tax_id, logo_url, created_at').order('name');
    if (!error) {
      rawData = data?.map(i => ({ ...i, document_number: i.tax_id })) || [];
    } else {
      let { data: d2, error: e2 } = await supabase.from('institutions').select('id, name, document_number, logo_url, created_at').order('name');
      if (!e2) {
        rawData = d2 || [];
      } else {
        let { data: d3, error: e3 } = await supabase.from('institutions').select('id, name, cnpj, logo_url, created_at').order('name');
        if (!e3) rawData = d3?.map(i => ({ ...i, document_number: i.cnpj })) || [];
        else fetchError = error || e2 || e3;
      }
    }

    if (fetchError) throw fetchError;

    if (!isSuperAdmin) {
      const result = rawData
        .filter(inst => allowedInstIds.includes(inst.id))
        .map(inst => allPlatform ? { ...inst, is_managed: true } : inst);
      return res.json(result);
    }

    return res.json(rawData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Listar atletas de uma instituição específica
router.get("/:id/athletes", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    
    // Tentamos buscar da tabela 'members' primeiro (que é a usada no Filtro de Segurança)
    let { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('institution_id', req.params.id)
      .order('full_name');

    if (!error && data && data.length > 0) {
      // Mapeamos full_name para name para compatibilidade com o frontend
      return res.json(data.map(m => ({ ...m, name: m.full_name || m.name })));
    }

    // Fallback para a tabela 'athletes' (caso ela exista e tenha dados)
    const { data: d2, error: e2 } = await supabase
      .from('athletes')
      .select('*')
      .eq('institution_id', req.params.id)
      .order('name');

    if (e2) {
      if (e2.message.includes('relation') || e2.message.includes('cache')) return res.json(data || []);
      throw e2;
    }
    res.json(d2 || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- INTERNAL ACCOUNT HELPERS FOR PUBLIC WORKFLOW ---
function loadAccounts(): any[] {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) return [];
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveAccounts(accounts: any[]) {
  try {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving accounts:", err);
  }
}

// --- INVITATIONS ENDPOINTS ---

// Gerar novo convite público linkável para torneio específico (chamado pelo organizador)
router.post("/invite/generate", requireAuth, async (req, res) => {
  const { institutionName, email, tournamentId } = req.body;
  const organizerId = req.user!.id;

  if (!tournamentId) {
    return res.status(400).json({ error: "É obrigatório selecionar um torneio para o qual efetuar o convite de adesão." });
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
        const { data: dbOrg } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', referenceId)
          .maybeSingle();
        if (dbOrg?.name) {
          orgName = dbOrg.name;
        }
      } catch (e) {
        console.error("Error fetching dynamic organization name for generated invitation:", e);
      }
    }

    // Buscar o nome e a logo do torneio vinculado
    let tournamentName = "";
    let tournamentLogoUrl = "";
    try {
      const { data: dbTournament } = await supabase
        .from('tournaments')
        .select('name, logo_url')
        .eq('id', tournamentId)
        .maybeSingle();
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
      institutionId: null, // para ser preenchido após aceitação
      email: email || "",
      status: "pending",
      createdAt: new Date().toISOString()
    };

    invitations.push(newInvitation);
    saveInvitations(invitations);

    res.status(201).json({
      success: true,
      invitation: newInvitation
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar dados públicos de um convite por seu ID (página de adesão pública)
router.get("/invite/public/:id", async (req, res) => {
  const invitationId = req.params.id;
  try {
    const invitations = loadInvitations();
    const inv = invitations.find(i => i.id === invitationId);
    if (!inv) {
      return res.status(404).json({ error: "Convite não encontrado." });
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Adesão com conta existente (Login e associação)
router.post("/invite/public/:id/accept-existing", async (req, res) => {
  const invitationId = req.params.id;
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
  }

  try {
    const invitations = loadInvitations();
    const inv = invitations.find(i => i.id === invitationId);
    if (!inv) {
      return res.status(404).json({ error: "Convite não encontrado." });
    }

    const accounts = loadAccounts();
    const user = accounts.find(a => a.email.toLowerCase() === email.toLowerCase());

    if (!user || user.passwordHash !== password) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    if (user.role !== "institution") {
      return res.status(403).json({ error: "Apenas contas de instituições podem aceitar convites." });
    }

    const referenceId = user.referenceId;
    if (!referenceId) {
      return res.status(400).json({ error: "Esta conta está mal configurada (id de instituição não localizado)." });
    }

    // Atualiza o convite
    inv.status = "accepted";
    inv.institutionId = referenceId;
    inv.institutionName = user.name;
    saveInvitations(invitations);

    // Mapeamento de compartilhamento multi-organizador
    const mapping = loadOrgInstitutions();
    const targetOrgId = inv.organizerId;
    if (!mapping[targetOrgId]) {
      mapping[targetOrgId] = [];
    }
    if (!mapping[targetOrgId].includes(referenceId)) {
      mapping[targetOrgId].push(referenceId);
      saveOrgInstitutions(mapping);
    }

    // Se o convite tem um Torneio vinculado, inscreve a instituição automaticamente nele!
    if (inv.tournamentId) {
      try {
        const supabase = getSupabaseAdmin();
        const { data: existingReg } = await supabase
          .from('tournament_registrations')
          .select('id')
          .eq('tournament_id', inv.tournamentId)
          .eq('institution_id', referenceId)
          .maybeSingle();

        if (!existingReg) {
          const { error: regErr } = await supabase
            .from('tournament_registrations')
            .insert([{
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
      role: user.role as any,
      name: user.name || "",
      referenceId: user.referenceId || undefined
    });

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      referenceId: user.referenceId,
      token
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Adesão com nova conta (Criação de instituição no Supabase + conta de login local + associação)
router.post("/invite/public/:id/accept-new", async (req, res) => {
  const invitationId = req.params.id;
  const { name, document_number, email, password, responsible_name, responsible_phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Nome, e-mail e senha correspondentes são obrigatórios." });
  }

  try {
    const invitations = loadInvitations();
    const inv = invitations.find(i => i.id === invitationId);
    if (!inv) {
      return res.status(404).json({ error: "Convite não encontrado." });
    }

    const accounts = loadAccounts();
    const emailExists = accounts.some(a => a.email.toLowerCase() === email.toLowerCase());
    if (emailExists) {
      return res.status(400).json({ error: "Este endereço de e-mail já está cadastrado no Quero Competir." });
    }

    const supabase = getSupabaseAdmin();

    // Validar duplicidade de documento (tax_id / cnpj / document_number) antes de tentar a inserção
    if (document_number) {
      const cleanDoc = document_number.replace(/\D/g, "");
      let existingInst: any = null;
      const cols = ['tax_id', 'cnpj', 'document_number'];
      for (const col of cols) {
        try {
          const { data: d1 } = await supabase
            .from('institutions')
            .select('id, name')
            .eq(col, document_number)
            .maybeSingle();
          if (d1) {
            existingInst = d1;
            break;
          }
          if (cleanDoc && cleanDoc !== document_number) {
            const { data: d2 } = await supabase
              .from('institutions')
              .select('id, name')
              .eq(col, cleanDoc)
              .maybeSingle();
            if (d2) {
              existingInst = d2;
              break;
            }
          }
        } catch (e) {}
      }

      if (existingInst) {
        return res.status(400).json({
          error: `O CNPJ/Documento "${document_number}" já está cadastrado para a instituição "${existingInst.name}". Por favor, utilize a aba "Já tenho Cadastro" ou informe outro documento.`
        });
      }
    }
    
    // Inserção da nova instituição seguindo o padrão robusto anterior de fallbacks para colunas do database
    let createdInst: any = null;
    const { data: instData, error: instErr } = await supabase
      .from('institutions')
      .insert([
        { 
          name, 
          tax_id: document_number, 
          email, 
          responsible_name, 
          responsible_phone 
        }
      ])
      .select()
      .maybeSingle();

    if (instErr) {
      if (instErr.message.includes('tax_id')) {
        const { data: d2, error: e2 } = await supabase
          .from('institutions')
          .insert([{ name, document_number, email, responsible_name, responsible_phone }])
          .select().maybeSingle();
        if (!e2) {
          createdInst = d2;
        } else {
          const { data: d3, error: e3 } = await supabase
            .from('institutions')
            .insert([{ name, cnpj: document_number, email, responsible_name, responsible_phone }])
            .select().maybeSingle();
          if (!e3) createdInst = d3;
        }
      }
      if (!createdInst) throw instErr;
    } else {
      createdInst = instData;
    }

    if (!createdInst || !createdInst.id) {
      return res.status(500).json({ error: "Não foi possível criar a instituição no banco de dados." });
    }

    const referenceId = createdInst.id;

    // Criar a credencial local em accounts.json
    const newAccount = {
      id: `acc_${Math.random().toString(36).substring(2, 11)}`,
      email: email.toLowerCase(),
      passwordHash: password,
      role: "institution",
      name,
      referenceId,
      createdAt: new Date().toISOString()
    };

    accounts.push(newAccount);
    saveAccounts(accounts);

    // Atualizar as informações e status do convite
    inv.status = "accepted";
    inv.institutionId = referenceId;
    inv.institutionName = name;
    saveInvitations(invitations);

    // Mapeamento automático de compartilhamento multi-organizador com o organizador dono do convite
    const mapping = loadOrgInstitutions();
    const targetOrgId = inv.organizerId;
    if (!mapping[targetOrgId]) {
      mapping[targetOrgId] = [];
    }
    if (!mapping[targetOrgId].includes(referenceId)) {
      mapping[targetOrgId].push(referenceId);
      saveOrgInstitutions(mapping);
    }

    // Se o convite tem um Torneio vinculado, inscreve a instituição automaticamente nele!
    if (inv.tournamentId) {
      try {
        const { data: existingReg } = await supabase
          .from('tournament_registrations')
          .select('id')
          .eq('tournament_id', inv.tournamentId)
          .eq('institution_id', referenceId)
          .maybeSingle();

        if (!existingReg) {
          const { error: regErr } = await supabase
            .from('tournament_registrations')
            .insert([{
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
      role: newAccount.role as any,
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
  } catch (err: any) {
    console.error("Error creating registration from invitation accept-new:", err);
    if (err.message && (err.message.includes("unique constraint") || err.message.includes("duplicate key"))) {
      return res.status(400).json({
        error: "Esta instituição (CNPJ/Documento) ou endereço de e-mail já está cadastrada na plataforma. Por favor, tente a aba 'Já tenho Cadastro'."
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// Enviar convite legando (antigo convite individual mantido para compatibilidade, sem expor listagem geral)
router.post("/invite", requireAuth, async (req, res) => {
  const { institutionId } = req.body;
  const organizerId = req.user!.id;

  try {
    const { role, referenceId, name: accName } = getUserRoleAndReferenceId(organizerId);
    if (role !== "organizer" && role !== "super_admin") {
      return res.status(403).json({ error: "Somente organizadores podem convidar instituições." });
    }

    const supabase = getSupabaseAdmin();

    let orgName = accName;
    if (referenceId) {
      try {
        const { data: dbOrg } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', referenceId)
          .maybeSingle();
        if (dbOrg?.name) {
          orgName = dbOrg.name;
        }
      } catch (e) {
        console.error("Error fetching dynamic organization name for invitation:", e);
      }
    }

    // Encontrar nome da instituição
    const { data: inst, error } = await supabase
      .from('institutions')
      .select('name')
      .eq('id', institutionId)
      .maybeSingle();

    if (error || !inst) {
      return res.status(404).json({ error: "Instituição não encontrada na plataforma." });
    }

    const invitations = loadInvitations();
    // Impedir convites pendentes duplicados
    const duplicate = invitations.find(
      inv => inv.organizerId === organizerId && inv.institutionId === institutionId && inv.status === "pending"
    );

    if (duplicate) {
      return res.status(440).json({ error: "Você já possui um convite pendente para esta instituição." });
    }

    // Impedir convidar instituição que já faz parte da organização dele
    const mapping = loadOrgInstitutions();
    const alreadyLinked = mapping[organizerId]?.includes(institutionId);
    if (alreadyLinked) {
      return res.status(400).json({ error: "Esta instituição já faz parte da sua organização." });
    }

    const newInvitation = {
      id: Math.random().toString(36).substring(2, 11),
      organizerId,
      organizerName: orgName || "Organizador",
      institutionId,
      institutionName: inst.name,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    invitations.push(newInvitation);
    saveInvitations(invitations);

    res.status(201).json(newInvitation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Listar convites recebidos (chamado pela instituição no portal)
router.get("/invitations/incoming", requireAuth, async (req, res) => {
  const organizerId = req.user!.id;

  try {
    const { role, referenceId } = getUserRoleAndReferenceId(organizerId);
    if (role !== "institution" || !referenceId) {
      return res.json([]); 
    }

    const invitations = loadInvitations();
    const result = invitations.filter(inv => inv.institutionId === referenceId);

    // Dynamically retrieve up-to-date organizer organization names from database
    if (result.length > 0) {
      try {
        const accounts = fs.existsSync(ACCOUNTS_FILE) ? JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8")) : [];
        const orgIds = result
          .map(inv => {
            const user = accounts.find((a: any) => a.id === inv.organizerId);
            return user?.referenceId;
          })
          .filter(Boolean) as string[];

        if (orgIds.length > 0) {
          const supabase = getSupabaseAdmin();
          const { data: orgs } = await supabase
            .from('organizations')
            .select('id, name')
            .in('id', orgIds);
          
          if (orgs && orgs.length > 0) {
            const orgMap = new Map(orgs.map(o => [o.id, o.name]));
            result.forEach(inv => {
              const user = accounts.find((a: any) => a.id === inv.organizerId);
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Aceitar convite
router.post("/invitations/:id/accept", requireAuth, async (req, res) => {
  const organizerId = req.user!.id;
  const invitationId = req.params.id;

  try {
    const { role, referenceId } = getUserRoleAndReferenceId(organizerId);
    if (role !== "institution" || !referenceId) {
      return res.status(403).json({ error: "Apenas contas de instituições podem aceitar convites." });
    }

    const invitations = loadInvitations();
    const inv = invitations.find(i => i.id === invitationId && i.institutionId === referenceId);
    
    if (!inv) {
      return res.status(444).json({ error: "Convite não encontrado." });
    }

    if (inv.status !== "pending") {
      return res.status(400).json({ error: `Este convite já está marcado como ${inv.status}.` });
    }

    inv.status = "accepted";
    saveInvitations(invitations);

    // Mapeamento de compartilhamento multi-organizador
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Recusar convite
router.post("/invitations/:id/reject", requireAuth, async (req, res) => {
  const organizerId = req.user!.id;
  const invitationId = req.params.id;

  try {
    const { role, referenceId } = getUserRoleAndReferenceId(organizerId);
    if (role !== "institution" || !referenceId) {
      return res.status(403).json({ error: "Apenas contas de instituições podem recusar convites." });
    }

    const invitations = loadInvitations();
    const inv = invitations.find(i => i.id === invitationId && i.institutionId === referenceId);
    
    if (!inv) {
      return res.status(444).json({ error: "Convite não encontrado." });
    }

    inv.status = "rejected";
    saveInvitations(invitations);

    res.json({ success: true, message: "Convite recusado." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const INST_PAYMENTS_FILE = path.join(process.cwd(), "src", "backend", "data", "institution_payments.json");

function ensurePaymentsFile() {
  const dir = path.dirname(INST_PAYMENTS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(INST_PAYMENTS_FILE)) {
    fs.writeFileSync(INST_PAYMENTS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

function loadPayments(): any[] {
  ensurePaymentsFile();
  try {
    return JSON.parse(fs.readFileSync(INST_PAYMENTS_FILE, "utf-8"));
  } catch (e) {
    return [];
  }
}

function savePayments(data: any[]) {
  ensurePaymentsFile();
  try {
    fs.writeFileSync(INST_PAYMENTS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {}
}

// Gerar link de pagamento para taxa de instituição
router.post("/payments/generate", requireAuth, async (req, res) => {
  const { tournamentId, institutionId, amount, deadline, allowedMethods } = req.body;
  const organizerId = req.user!.id;

  if (!tournamentId || !institutionId || !amount || !deadline) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes: tournamentId, institutionId, amount, deadline." });
  }

  try {
    const { role } = getUserRoleAndReferenceId(organizerId);
    if (role !== "organizer" && role !== "super_admin") {
      return res.status(403).json({ error: "Somente organizadores podem gerar links de pagamento." });
    }

    const supabase = getSupabaseAdmin();

    // Buscar nome do torneio
    let tournamentName = "";
    try {
      const { data: dbT } = await supabase
        .from('tournaments')
        .select('name')
        .eq('id', tournamentId)
        .maybeSingle();
      if (dbT) tournamentName = dbT.name;
    } catch (e) {
      console.error("Erro ao buscar nome do torneio para pagamento:", e);
    }

    // Buscar nome da instituição
    let institutionName = "";
    try {
      const { data: dbI } = await supabase
        .from('institutions')
        .select('name')
        .eq('id', institutionId)
        .maybeSingle();
      if (dbI) institutionName = dbI.name;
    } catch (e) {
      console.error("Erro ao buscar nome da instituição para pagamento:", e);
    }

    const payments = loadPayments();
    
    // Remover qualquer link pendente anterior para a mesma instituição no mesmo torneio
    const filteredPayments = payments.filter(p => !(p.tournamentId === tournamentId && p.institutionId === institutionId && p.status === 'pending'));

    const id = "pay_" + Math.random().toString(36).substring(2, 11);
    const newPayment = {
      id,
      tournamentId,
      tournamentName: tournamentName || "Torneio",
      institutionId,
      institutionName: institutionName || "Instituição",
      amount: Number(amount),
      deadline,
      allowedMethods: allowedMethods || ["pix", "boleto", "card"],
      status: "pending",
      createdAt: new Date().toISOString()
    };

    filteredPayments.push(newPayment);
    savePayments(filteredPayments);

    res.status(201).json({
      success: true,
      payment: newPayment
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Listar links de pagamento de um torneio
router.get("/payments/tournament/:tournamentId", requireAuth, async (req, res) => {
  const { tournamentId } = req.params;
  try {
    const payments = loadPayments();
    const filtered = payments.filter(p => p.tournamentId === tournamentId);
    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Detalhes públicos de um link de pagamento (sem autenticação)
router.get("/payments/public/:paymentId", async (req, res) => {
  const { paymentId } = req.params;
  try {
    const payments = loadPayments();
    const pay = payments.find(p => p.id === paymentId);
    if (!pay) {
      return res.status(404).json({ error: "Link de pagamento não encontrado." });
    }

    // Buscar equipes/modalidades registradas
    const supabase = getSupabaseAdmin();
    let teamsList: string[] = [];
    try {
      const { data: dbTeams, error: dbTeamsError } = await supabase
        .from('team_registrations')
        .select(`
          id,
          category:tournament_category_id(name, gender, age_group)
        `)
        .eq('tournament_id', pay.tournamentId)
        .eq('institution_id', pay.institutionId);

      if (!dbTeamsError && dbTeams) {
        teamsList = dbTeams.map((t: any) => {
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper function to calculate split payment rules
function buildSplitRules(
  totalCents: number,
  organizerRecipientId?: string | null,
  platformFeePercent: number = 10
) {
  const platformRecipientId = process.env.PAGARME_PLATFORM_RECIPIENT_ID || "re_cmqzdju442lzv0l9tmscp6lw7";
  if (!organizerRecipientId || !platformRecipientId || organizerRecipientId === platformRecipientId) return undefined;

  const platformCents = Math.round(totalCents * (platformFeePercent / 100));
  const organizerCents = totalCents - platformCents;

  if (organizerCents <= 0) return undefined;

  return [
    {
      amount: organizerCents,
      recipient_id: organizerRecipientId,
      type: "flat",
      options: { charge_processing_fee: false, liable: false }
    },
    {
      amount: platformCents,
      recipient_id: platformRecipientId,
      type: "flat",
      options: { charge_processing_fee: true, liable: true }
    }
  ];
}

// Helper function to call Pagar.me API v5
async function callPagarMe(endpoint: string, method: string, body: any) {
  const secretKey = process.env.PAGARME_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAGARME_SECRET_KEY não configurada no arquivo de ambiente.");
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
    console.error("Pagar.me API Error details:", data);
    throw new Error(data.message || "Erro retornado pela API do Pagar.me");
  }
  return data;
}

// Finalizar pagamento público ou gerar transação no gateway Pagar.me
router.post("/payments/public/:paymentId/pay", async (req, res) => {
  const { paymentId } = req.params;
  const { method, cardToken, simulateSuccess } = req.body;

  if (!method) {
    return res.status(400).json({ error: "Método de pagamento não especificado." });
  }

  try {
    const payments = loadPayments();
    const payIndex = payments.findIndex(p => p.id === paymentId);
    if (payIndex === -1) {
      return res.status(404).json({ error: "Link de pagamento não encontrado." });
    }

    const pay = payments[payIndex];
    if (pay.status === "paid") {
      return res.status(400).json({ error: "Este pagamento já foi realizado." });
    }

    // Validar prazo de vencimento
    const now = new Date();
    const limitDate = new Date(pay.deadline + "T23:59:59");
    if (now > limitDate) {
      return res.status(400).json({ error: "Este link de pagamento expirou." });
    }

    const hasSecretKey = !!process.env.PAGARME_SECRET_KEY;

    // Se o cliente solicita confirmação simulada
    if (simulateSuccess) {
      payments[payIndex].status = "paid";
      payments[payIndex].paidAt = new Date().toISOString();
      savePayments(payments);

      const supabase = getSupabaseAdmin();
      const { data: reg } = await supabase
        .from('tournament_registrations')
        .select('id')
        .eq('tournament_id', pay.tournamentId)
        .eq('institution_id', pay.institutionId)
        .maybeSingle();

      if (reg) {
        await supabase
          .from('tournament_registrations')
          .update({ status: 'confirmed' })
          .eq('id', reg.id);
      }

      return res.json({ success: true, method, paid: true });
    }

    // Se não há chaves do Pagar.me configuradas, simulamos o sucesso (Sandbox fallback)
    if (!hasSecretKey) {
      console.warn("PAGARME_SECRET_KEY não detectada. Executando pagamento em modo SIMULADO.");
      
      if (method === "pix") {
        const pixPayload = generatePixEMV("+5571991414913", pay.amount);
        return res.json({
          success: true,
          method: "pix",
          qrCode: pixPayload,
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixPayload)}`
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

      // No caso de cartão, confirmamos imediatamente no modo simulado
      payments[payIndex].status = "paid";
      payments[payIndex].paidAt = new Date().toISOString();
      savePayments(payments);

      const supabase = getSupabaseAdmin();
      const { data: reg } = await supabase
        .from('tournament_registrations')
        .select('id')
        .eq('tournament_id', pay.tournamentId)
        .eq('institution_id', pay.institutionId)
        .maybeSingle();

      if (reg) {
        await supabase
          .from('tournament_registrations')
          .update({ status: 'confirmed' })
          .eq('id', reg.id);
      }

      return res.json({ success: true, method: "card", paid: true });
    }

    // Fluxo Real Integrado ao Pagar.me v5
    const supabase = getSupabaseAdmin();
    const { data: instData } = await supabase
      .from('institutions')
      .select('email, cnpj, contact_phone')
      .eq('id', pay.institutionId)
      .maybeSingle();

    // Obter dados do recebedor do organizador do torneio
    let splitRules: any[] | undefined = undefined;
    try {
      const { data: tData } = await supabase
        .from('tournaments')
        .select('owner_id')
        .eq('id', pay.tournamentId)
        .maybeSingle();

      if (tData?.owner_id) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('pagarme_recipient_id, platform_fee_percent')
          .eq('id', tData.owner_id)
          .maybeSingle();

        if (orgData?.pagarme_recipient_id) {
          const totalCents = Math.round(pay.amount * 100);
          const feePercent = orgData.platform_fee_percent !== undefined ? Number(orgData.platform_fee_percent) : 10;
          splitRules = buildSplitRules(totalCents, orgData.pagarme_recipient_id, feePercent);
        }
      }
    } catch (err: any) {
      console.warn("[Institution Split Rules Warning]", err.message);
    }

    const cleanDoc = (instData?.cnpj || "00000000000191").replace(/\D/g, "");
    const customer = {
      name: pay.institutionName || "Instituição",
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
            description: `Taxa de Adesão - ${pay.tournamentName}`,
            quantity: 1
          }
        ],
        customer,
        payments: [
          {
            payment_method: "pix",
            pix: {
              expires_in: 86400
            },
            ...(splitRules ? { split: splitRules } : {})
          }
        ]
      };

      const pgOrder = await callPagarMe("/orders", "POST", orderPayload);
      const charge = pgOrder.charges?.[0];
      const transaction = charge?.last_transaction;

      // Salvar IDs de referência
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
            description: `Taxa de Adesão - ${pay.tournamentName}`,
            quantity: 1
          }
        ],
        customer,
        payments: [
          {
            payment_method: "boleto",
            boleto: {
              bank: "341", // Itaú
              instructions: "Pagar até o vencimento. Não receber após vencimento.",
              due_at: new Date(pay.deadline + "T23:59:59").toISOString()
            },
            ...(splitRules ? { split: splitRules } : {})
          }
        ]
      };

      const pgOrder = await callPagarMe("/orders", "POST", orderPayload);
      const charge = pgOrder.charges?.[0];
      const transaction = charge?.last_transaction;

      // Salvar IDs de referência
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
        return res.status(400).json({ error: "Token do cartão não fornecido." });
      }

      const orderPayload = {
        code: pay.id,
        items: [
          {
            amount: Math.round(pay.amount * 100),
            description: `Taxa de Adesão - ${pay.tournamentName}`,
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
            },
            ...(splitRules ? { split: splitRules } : {})
          }
        ]
      };

      const pgOrder = await callPagarMe("/orders", "POST", orderPayload);
      const charge = pgOrder.charges?.[0];

      if (charge?.status === "paid") {
        payments[payIndex].status = "paid";
        payments[payIndex].paidAt = new Date().toISOString();
        payments[payIndex].pagarmeOrderId = pgOrder.id;
        payments[payIndex].pagarmeChargeId = charge.id;
        savePayments(payments);

        // Atualizar Supabase
        const { data: reg } = await supabase
          .from('tournament_registrations')
          .select('id')
          .eq('tournament_id', pay.tournamentId)
          .eq('institution_id', pay.institutionId)
          .maybeSingle();

        if (reg) {
          await supabase
            .from('tournament_registrations')
            .update({ status: 'confirmed' })
            .eq('id', reg.id);
        }

        return res.json({ success: true, method: "card", paid: true });
      } else {
        return res.status(400).json({ error: `Pagamento via cartão não aprovado. Status: ${charge?.status || 'desconhecido'}` });
      }
    }

    res.status(400).json({ error: "Método de pagamento inválido." });
  } catch (err: any) {
    console.error("Erro na transação Pagar.me:", err);
    res.status(500).json({ error: err.message || "Erro desconhecido ao processar pagamento." });
  }
});

// Webhook para escutar notificações do Pagar.me
router.post("/payments/webhook", async (req, res) => {
  const event = req.body;
  console.log("Pagar.me Webhook recebido:", event?.type);

  try {
    if (event?.type === "charge.paid" || event?.type === "order.paid") {
      const orderCode = event.data?.code || event.data?.order?.code;
      if (orderCode) {
        const payments = loadPayments();
        const payIndex = payments.findIndex(p => p.id === orderCode);

        if (payIndex !== -1) {
          // 1. Pagamento de Instituição
          if (payments[payIndex].status !== "paid") {
            payments[payIndex].status = "paid";
            payments[payIndex].paidAt = new Date().toISOString();
            savePayments(payments);

            const pay = payments[payIndex];
            const supabase = getSupabaseAdmin();
            const { data: reg } = await supabase
              .from('tournament_registrations')
              .select('id')
              .eq('tournament_id', pay.tournamentId)
              .eq('institution_id', pay.institutionId)
              .maybeSingle();

            if (reg) {
              const { error: updateErr } = await supabase
                .from('tournament_registrations')
                .update({ status: 'confirmed' })
                .eq('id', reg.id);

              if (updateErr) {
                console.error("Erro ao atualizar Supabase via Webhook Pagar.me:", updateErr);
              } else {
                console.log(`Pagamento do link ${orderCode} liquidado e atualizado via Webhook.`);
              }
            }
          }
        } else {
          // 2. Pagamento de Atleta (Inscrição/Filiação)
          const supabase = getSupabaseAdmin();
          const { data: subData } = await supabase
            .from('athlete_subscriptions')
            .select('*')
            .eq('id', orderCode)
            .maybeSingle();

          if (subData && subData.payment_status !== "paid") {
            // Atualizar status de pagamento da inscrição do atleta
            await supabase
              .from('athlete_subscriptions')
              .update({ payment_status: 'paid' })
              .eq('id', orderCode);

            // Obter informações do torneio e da filiação
            const { data: tData } = await supabase
              .from('tournaments')
              .select('owner_id, start_date')
              .eq('id', subData.tournament_id)
              .maybeSingle();

            // Buscar configurações
            const { data: tSettings } = await supabase
              .from('tournament_subscription_settings')
              .select('require_membership')
              .eq('tournament_id', subData.tournament_id)
              .maybeSingle();
            
            if (tSettings?.require_membership && tData) {
              const { data: existingMember } = await supabase
                .from('members')
                .select('id')
                .eq('document_number', subData.document)
                .maybeSingle();

              let athleteId = existingMember?.id;
              if (!athleteId) {
                const { data: newMember } = await supabase
                  .from('members')
                  .insert([{
                    institution_id: subData.institution_id,
                    full_name: subData.athlete_name,
                    document_number: subData.document,
                    birth_date: subData.birth_date,
                    status: "pending"
                  }])
                  .select('id')
                  .single();
                if (newMember) athleteId = newMember.id;
              }

              if (athleteId) {
                const year = new Date(tData.start_date).getFullYear();
                await supabase
                  .from('memberships')
                  .upsert({
                    member_id: athleteId,
                    organization_id: tData.owner_id,
                    year,
                    status: "active",
                    payment_status: "paid",
                    payment_id: `pagarme_webhook_athlete_${orderCode}`,
                    paid_at: new Date().toISOString()
                  }, {
                    onConflict: "organization_id,member_id,year"
                  });
              }
            }
            console.log(`Pagamento da inscrição do atleta ${subData.athlete_name} (${orderCode}) liquidado via Webhook.`);
          }
        }
      }
    }
  } catch (err) {
    console.error("Erro no processamento do Webhook:", err);
  }

  res.json({ received: true });
});

export default router;
