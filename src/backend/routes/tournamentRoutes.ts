import { Router } from "express";
import { getSupabaseAdmin } from "../lib/supabase.ts";
import { requireAuth, requireRole } from "../middleware/auth.ts";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const router = Router();

const ACCOUNTS_FILE = path.join(process.cwd(), "src", "backend", "data", "accounts.json");

const ORG_STAFF_FILE = path.join(process.cwd(), "src", "backend", "data", "organizer_staff.json");
const ORG_VENUES_FILE = path.join(process.cwd(), "src", "backend", "data", "organizer_venues.json");

function getUserRoleAndReferenceId(userId: string): { role: string | null; name: string | null, referenceId: string | null } {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) return { role: null, name: null, referenceId: null };
    const accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
    const user = accounts.find((a: any) => a.id === userId);
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

async function ensureStaffAndVenuesMappings(): Promise<void> {
  const supabase = getSupabaseAdmin();
  
  if (!fs.existsSync(ORG_STAFF_FILE)) {
    try {
      const { data: staffData } = await supabase.from('staff').select('id');
      const staffIds = staffData?.map(s => s.id) || [];
      const initialStaff = {
        "org-1": staffIds
      };
      fs.writeFileSync(ORG_STAFF_FILE, JSON.stringify(initialStaff, null, 2), "utf-8");
    } catch (e) {
      console.error("Error seeding organizer_staff.json:", e);
    }
  }

  if (!fs.existsSync(ORG_VENUES_FILE)) {
    try {
      const { data: venuesData } = await supabase.from('venues').select('id');
      const venueIds = venuesData?.map(v => v.id) || [];
      const initialVenues = {
        "org-1": venueIds
      };
      fs.writeFileSync(ORG_VENUES_FILE, JSON.stringify(initialVenues, null, 2), "utf-8");
    } catch (e) {
      console.error("Error seeding organizer_venues.json:", e);
    }
  }
}

function loadOrgStaff(): Record<string, string[]> {
  try {
    if (!fs.existsSync(ORG_STAFF_FILE)) return {};
    return JSON.parse(fs.readFileSync(ORG_STAFF_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveOrgStaff(data: Record<string, string[]>) {
  try {
    fs.writeFileSync(ORG_STAFF_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving organizer_staff.json:", e);
  }
}

function loadOrgVenues(): Record<string, string[]> {
  try {
    if (!fs.existsSync(ORG_VENUES_FILE)) return {};
    return JSON.parse(fs.readFileSync(ORG_VENUES_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveOrgVenues(data: Record<string, string[]>) {
  try {
    fs.writeFileSync(ORG_VENUES_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving organizer_venues.json:", e);
  }
}

// Helper to resolve an organizer's unique organization (referenceId)
// and dynamically create one if it does not yet exist.
async function getOrganizerReferenceIdAndSync(organizerId: string): Promise<string | null> {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) return null;
    const accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
    const user = accounts.find((a: any) => a.id === organizerId);
    if (!user) return null;
    
    if (user.referenceId) {
      return user.referenceId;
    }
    
    // Create new organization configuration
    const supabase = getSupabaseAdmin();
    const payload = {
      name: `Organização de ${user.name}`,
      logo_url: "",
      primary_color: "#4F46E5",
      secondary_color: "#0F172A",
      font_family: "inter",
      subdomain: user.name.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 15) || "portal"
    };
    
    const { data, error } = await supabase
      .from('organizations')
      .insert([payload])
      .select()
      .maybeSingle();
      
    if (error) {
      console.error("Error creating default organization for new organizer:", error);
      return null;
    }
    
    if (!data) return null;
    
    const orgId = data.id;
    user.referenceId = orgId;
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
    
    // Try syncing account with portal_accounts if exists
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
          created_at: user.createdAt || new Date().toISOString()
        };
        await supabase.from("portal_accounts").upsert(mapped);
      }
    } catch (e) {
      // Ignored
    }
    
    return orgId;
  } catch (err) {
    console.error("Error resolving/syncing organizer organization:", err);
    return null;
  }
}

// --- ORGANIZATION EXTENSION ---

router.get("/organization", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const organizerId = req.user!.id;
    
    let orgId: string | null = null;
    if (organizerId) {
      orgId = await getOrganizerReferenceIdAndSync(organizerId);
    }
    
    let query = supabase.from('organizations').select('*');
    if (orgId) {
      query = query.eq('id', orgId);
    } else {
      const queryId = req.query.id as string;
      if (queryId) {
        query = query.eq('id', queryId);
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/organization", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    // Remover campos imutáveis do payload
    const { id, updated_at, created_at, ...payload } = req.body;
    const organizerId = req.user!.id;
    
    let orgId: string | null = null;
    if (organizerId) {
      orgId = await getOrganizerReferenceIdAndSync(organizerId);
    }
    
    if (!orgId) {
      // Fallback
      const { data: existing } = await supabase.from('organizations').select('id').limit(1).maybeSingle();
      orgId = existing?.id || null;
    }
    
    let result;
    if (orgId) {
       const { data, error } = await supabase.from('organizations').update(payload).eq('id', orgId).select().maybeSingle();
       if (error) throw error;
       result = data;
    } else {
       const { data, error } = await supabase.from('organizations').insert([payload]).select().maybeSingle();
       if (error) throw error;
       result = data;
    }
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar uma partida específica
router.get("/match/:matchId", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('matches')
      .select(`
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
      `)
      .eq('id', req.params.matchId)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar próximo jogo da mesma quadra/sede
router.get("/matches/:matchId/next", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    // 1. Get current match details
    const { data: currentMatch, error: currError } = await supabase
      .from('matches')
      .select('tournament_id, venue_id, scheduled_time')
      .eq('id', req.params.matchId)
      .single();

    if (currError) throw currError;
    if (!currentMatch.venue_id || !currentMatch.scheduled_time) {
      return res.json(null);
    }

    const currentDate = new Date(currentMatch.scheduled_time);
    const startOfDay = new Date(currentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(currentDate);
    endOfDay.setHours(23, 59, 59, 999);

    // 2. Find next match at the same venue on the same day
    const { data: nextMatch, error: nextError } = await supabase
      .from('matches')
      .select('id, scheduled_time, status')
      .eq('tournament_id', currentMatch.tournament_id)
      .eq('venue_id', currentMatch.venue_id)
      .gte('scheduled_time', currentMatch.scheduled_time)
      .neq('id', req.params.matchId)
      .order('scheduled_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextError) throw nextError;
    res.json(nextMatch || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Placar público dinâmico por sede
router.get("/:tournamentId/venues/:venueId/live", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    
    // 1. Primeiro tenta achar algum jogo 'in_progress' nesta quadra hoje
    const today = new Date();
    const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today); endOfDay.setHours(23, 59, 59, 999);

    let { data: liveMatch, error } = await supabase
      .from('matches')
      .select(`
        *,
        tournament:tournament_id(name, logo_url),
        category:tournament_category_id(name, gender, age_group),
        team1:team1_id(id, institution:institutions(id, name, logo_url)),
        team2:team2_id(id, institution:institutions(id, name, logo_url)),
        venue:venue_id(name)
      `)
      .eq('tournament_id', req.params.tournamentId)
      .eq('venue_id', req.params.venueId)
      .eq('status', 'in_progress')
      .gte('scheduled_time', startOfDay.toISOString())
      .lte('scheduled_time', endOfDay.toISOString())
      .order('scheduled_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    // 2. Se não houver jogo em progresso, tenta achar o que deve ocorrer hoje na ordem ou que já acabou
    // 2. Se não houver jogo em progresso, tenta achar o próximo que deve ocorrer hoje ('scheduled')
    if (!liveMatch) {
      const { data: nextMatch } = await supabase
        .from('matches')
        .select(`
          *,
          tournament:tournament_id(name, logo_url),
          category:tournament_category_id(name, gender, age_group),
          team1:team1_id(id, institution:institutions(id, name, logo_url)),
          team2:team2_id(id, institution:institutions(id, name, logo_url)),
          venue:venue_id(name)
        `)
        .eq('tournament_id', req.params.tournamentId)
        .eq('venue_id', req.params.venueId)
        .eq('status', 'scheduled')
        .gte('scheduled_time', startOfDay.toISOString())
        .lte('scheduled_time', endOfDay.toISOString())
        .order('scheduled_time', { ascending: true })
        .limit(1)
        .maybeSingle();
        
      liveMatch = nextMatch;
    }

    // 3. Se não houver nem 'in_progress' nem 'scheduled', mostra o último que terminou ('finished')
    if (!liveMatch) {
      const { data: lastFinished } = await supabase
        .from('matches')
        .select(`
          *,
          tournament:tournament_id(name, logo_url),
          category:tournament_category_id(name, gender, age_group),
          team1:team1_id(id, institution:institutions(id, name, logo_url)),
          team2:team2_id(id, institution:institutions(id, name, logo_url)),
          venue:venue_id(name)
        `)
        .eq('tournament_id', req.params.tournamentId)
        .eq('venue_id', req.params.venueId)
        .eq('status', 'finished')
        .gte('scheduled_time', startOfDay.toISOString())
        .lte('scheduled_time', endOfDay.toISOString())
        .order('scheduled_time', { ascending: false }) // O último do dia que foi jogado
        .limit(1)
        .maybeSingle();
        
      liveMatch = lastFinished;
    }

    res.json(liveMatch || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Criar torneio
router.post("/", requireAuth, async (req, res) => {
  const { name, owner_id, description, start_date, end_date, logo_url } = req.body;
  const organizerId = req.user!.id;

  let finalOwnerId = owner_id;
  if (organizerId) {
    const orgId = await getOrganizerReferenceIdAndSync(organizerId);
    if (orgId) {
      finalOwnerId = orgId;
    }
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('tournaments')
      .insert([{ name, owner_id: finalOwnerId, description, start_date, end_date, logo_url }])
      .select()
      .single();

    if (error) throw error;
    
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/institution/:institutionId/teams", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: teams, error } = await supabase
      .from('team_registrations')
      .select(`
        id,
        tournament_id,
        tournament_category_id,
        institution_id,
        tournament:tournament_id(id, name),
        category:tournament_category_id(id, name, gender, age_group, birth_year_min, birth_year_max)
      `)
      .eq('institution_id', req.params.institutionId);

    if (error) throw error;
    res.json(teams);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/institution/:institutionId/registrations", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('tournament_registrations')
      .select('tournament_id')
      .eq('institution_id', req.params.institutionId);

    if (error) throw error;
    res.json(data.map(d => d.tournament_id));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Listar torneios ativos
router.get("/", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();

    // Use JWT user if available, otherwise fall back to header (public/unauthenticated contexts)
    const reqUser = (req as any).user;
    const organizerId = reqUser?.id || (req.headers["x-organizer-id"] as string);
    let organizerRole = reqUser?.role;

    // Try to get role from accounts if not in JWT
    if (organizerId && !organizerRole && fs.existsSync(ACCOUNTS_FILE)) {
      const accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
      const user = accounts.find((a: any) => a.id === organizerId);
      if (user) organizerRole = user.role;
    }

    let orgId: string | null = null;
    let isSuperAdmin = organizerRole === "super_admin";
    let isInstitution = organizerRole === "institution";

    if (organizerId && !isSuperAdmin && !isInstitution) {
      orgId = await getOrganizerReferenceIdAndSync(organizerId);
    }

    let query = supabase.from('tournaments').select('*').neq('status', 'cancelled');

    if (orgId && !isSuperAdmin && !isInstitution) {
      query = query.eq('owner_id', orgId);
    }

    const { data, error } = await query.order('start_date', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- STAFF ROUTES ---
router.get("/staff", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const organizerId = req.user!.id;
    const { role } = getUserRoleAndReferenceId(organizerId);
    
    let useLocalFallback = false;
    let data: any[] | null = null;
    let error = null;

    try {
      let query = supabase.from('staff').select('*');
      if (role !== "super_admin") {
        query = query.eq('organizer_id', organizerId);
      }
      const resDb = await query.order('name');
      data = resDb.data;
      error = resDb.error;

      if (error && (error.message.includes('column') || error.message.includes('organizer_id'))) {
        useLocalFallback = true;
      }
    } catch (e) {
      useLocalFallback = true;
    }

    if (useLocalFallback) {
      await ensureStaffAndVenuesMappings();
      const { data: allData, error: allErr } = await supabase.from('staff').select('*').order('name');
      if (allErr) {
        if (allErr.message.includes('relation') || allErr.message.includes('cache')) {
          return res.json([]);
        }
        throw allErr;
      }
      if (organizerId && role !== "super_admin") {
        const mapping = loadOrgStaff();
        const allowedIds = mapping[organizerId] || [];
        const filtered = (allData || []).filter(s => allowedIds.includes(s.id));
        return res.json(filtered);
      }
      return res.json(allData || []);
    }

    if (error) {
      console.error("[GET STAFF] Supabase Error:", error);
      if (error.message.includes('relation') || error.message.includes('cache')) {
        return res.json([]);
      }
      throw error;
    }

    res.json(data || []);
  } catch (error: any) {
    console.error("[GET STAFF] Catch Error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/staff", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const organizerId = req.user!.id;

    try {
      const staffData = { ...req.body, organizer_id: organizerId };
      const { data, error } = await supabase.from('staff').insert([staffData]).select().single();
      if (error) {
        if (error.message.includes('column') || error.message.includes('organizer_id')) {
          throw new Error("fallback_to_json");
        }
        throw error;
      }
      return res.json(data);
    } catch (dbErr: any) {
      if (dbErr.message === "fallback_to_json") {
        const { data, error } = await supabase.from('staff').insert([req.body]).select().single();
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/staff/:id", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const organizerId = req.user!.id;
    const staffId = req.params.id;
    
    const { error } = await supabase.from('staff').delete().eq('id', staffId);
    if (error) throw error;

    if (organizerId) {
      await ensureStaffAndVenuesMappings();
      const mapping = loadOrgStaff();
      if (mapping[organizerId]) {
        mapping[organizerId] = mapping[organizerId].filter(id => id !== staffId);
        saveOrgStaff(mapping);
      }
    }

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- BULK MATCH UPDATE ---
router.patch("/matches/bulk-update", requireAuth, async (req, res) => {
  const { updates } = req.body; // Array of { id, scheduled_time, court, referee1_id, referee2_id, table_official_id }
  try {
    const supabase = getSupabaseAdmin();
    const results = [];
    
    for (const update of updates) {
      const { id, ...fields } = update;
      const { data, error } = await supabase
        .from('matches')
        .update(fields)
        .eq('id', id)
        .select();
      if (error) throw error;
      results.push(data[0]);
    }
    
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar um torneio específico
router.get("/:id", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    
    // Buscar organização associada usando o owner_id
    let organization = null;
    if (data && data.owner_id) {
      const orgId = await getOrganizerReferenceIdAndSync(data.owner_id);
      if (orgId) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .maybeSingle();
        organization = orgData;
      }
    }
    
    res.json({ ...data, organization });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar status do torneio
router.patch("/:id/status", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { status } = req.body;
    const { data, error } = await supabase
      .from('tournaments')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar detalhes do torneio (Name, description, start_date, end_date)
router.patch("/:id", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { name, description, start_date, end_date, logo_url } = req.body;
    
    const updateObj: any = {};
    if (name !== undefined) updateObj.name = name;
    if (description !== undefined) updateObj.description = description;
    if (start_date !== undefined) updateObj.start_date = start_date;
    if (end_date !== undefined) updateObj.end_date = end_date;
    if (logo_url !== undefined) updateObj.logo_url = logo_url;

    const { data, error } = await supabase
      .from('tournaments')
      .update(updateObj)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Listar todas as partidas de um torneio (todas as categorias)
router.get("/:id/matches", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        category:tournament_category_id(name, gender, age_group),
        team1:team1_id(id, availability, institution:institutions(id, name, logo_url)),
        team2:team2_id(id, availability, institution:institutions(id, name, logo_url)),
        winner:winner_id(id, institution:institutions(id, name, logo_url)),
        venue:venue_id(*)
      `)
      .eq('tournament_id', req.params.id)
      .order('round', { ascending: true })
      .order('match_index', { ascending: true });

    if (error) {
      if (error.message.includes('relation') || error.message.includes('cache')) return res.json([]);
      throw error;
    }
    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Listar categorias de um torneio
router.get("/:id/categories", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const tournamentId = req.params.id;

    // 1. Buscar categorias
    const { data: categories, error: catError } = await supabase
      .from('tournament_categories')
      .select('*')
      .eq('tournament_id', tournamentId);

    if (catError) {
      if (catError.message.includes('relation "tournament_categories" does not exist') || 
          catError.message.includes('schema cache')) {
        return res.json([]);
      }
      throw catError;
    }

    if (!categories || categories.length === 0) {
      return res.json([]);
    }

    // 2. Buscar inscrições de equipes para contabilizar no frontend
    const { data: teams, error: teamsError } = await supabase
      .from('team_registrations')
      .select('id, tournament_category_id')
      .eq('tournament_id', tournamentId);

    if (teamsError) {
      console.error("Erro ao buscar inscrições de equipes para categorias:", teamsError);
      const result = categories.map(cat => ({ ...cat, registered_count: 0 }));
      return res.json(result);
    }

    // 2.5 Buscar membros dos times para contagem de atletas em esportes individuais/combate
    let teamIds = teams ? teams.map(t => t.id) : [];
    let members: any[] = [];
    if (teamIds.length > 0) {
      try {
        const { data: membersData } = await supabase
          .from('team_members')
          .select('team_id')
          .in('team_id', teamIds);
        members = membersData || [];
      } catch (err) {
        console.error("Erro ao buscar membros dos times:", err);
      }
    }

    // 3. Consolidar quantitativo de inscritos em cada categoria (equipes ou atletas)
    const result = categories.map(cat => {
      const catTeams = teams ? teams.filter(t => t.tournament_category_id === cat.id) : [];
      const isCombat = cat.rules_config?.sport_type === "combat";
      let count = catTeams.length;
      
      if (isCombat) {
        const catTeamIds = new Set(catTeams.map(t => t.id));
        count = members.filter(m => catTeamIds.has(m.team_id)).length;
      }

      return {
        ...cat,
        registered_count: count
      };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Criar categoria
router.post("/:id/categories", async (req, res) => {
  const { name, gender, age_group, birth_year_min, birth_year_max, max_teams, rules_config } = req.body;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('tournament_categories')
      .insert([{ 
        tournament_id: req.params.id,
        name,
        gender,
        age_group,
        birth_year_min: birth_year_min ?? null,
        birth_year_max: birth_year_max ?? null,
        max_teams,
        rules_config
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar categoria
router.patch("/categories/:categoryId", async (req, res) => {
  const { name, gender, age_group, birth_year_min, birth_year_max, max_teams, rules_config } = req.body;
  const { categoryId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    const updatePayload: any = {};
    if (name !== undefined) updatePayload.name = name;
    if (gender !== undefined) updatePayload.gender = gender;
    if (age_group !== undefined) updatePayload.age_group = age_group;
    if (birth_year_min !== undefined) updatePayload.birth_year_min = birth_year_min ?? null;
    if (birth_year_max !== undefined) updatePayload.birth_year_max = birth_year_max ?? null;
    if (max_teams !== undefined) updatePayload.max_teams = max_teams;
    if (rules_config !== undefined) updatePayload.rules_config = rules_config;

    const { data, error } = await supabase
      .from('tournament_categories')
      .update(updatePayload)
      .eq('id', categoryId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error("Erro ao atualizar categoria:", error);
    res.status(500).json({ error: error.message });
  }
});

// Deletar categoria
router.delete("/categories/:categoryId", async (req, res) => {
  const { categoryId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    
    // 1. Deletar partidas vinculadas
    await supabase
      .from('matches')
      .delete()
      .eq('tournament_category_id', categoryId);

    // 2. Deletar inscrições de equipes vinculadas
    await supabase
      .from('team_registrations')
      .delete()
      .eq('tournament_category_id', categoryId);

    // 3. Deletar inscrições de atletas vinculadas
    await supabase
      .from('athlete_subscriptions')
      .delete()
      .eq('category_id', categoryId);

    // 4. Deletar a categoria em si
    const { error } = await supabase
      .from('tournament_categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw error;
    res.json({ message: "Categoria removida com sucesso." });
  } catch (error: any) {
    console.error("Erro ao deletar categoria:", error);
    res.status(500).json({ error: error.message });
  }
});

// Listar instituições inscritas no torneio
router.get("/:id/registrations", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('tournament_registrations')
      .select('*, institution:institutions(id, name, logo_url)')
      .eq('tournament_id', req.params.id);

    if (error) {
      if (error.message.includes('relation') || error.message.includes('cache')) return res.json([]);
      throw error;
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Resumo de inscrições do torneio (detalhado)
router.get("/:id/registrations/summary", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const tournamentId = req.params.id;

    // 1. Buscar todas as inscrições de instituições
    const { data: regs, error: regsError } = await supabase
      .from('tournament_registrations')
      .select('*, institution:institutions(id, name, logo_url)')
      .eq('tournament_id', tournamentId);

    if (regsError) throw regsError;

    // 2. Buscar todos os times registrados
    const { data: teams, error: teamsError } = await supabase
      .from('team_registrations')
      .select('id, institution_id, tournament_category_id')
      .eq('tournament_id', tournamentId);

    if (teamsError) throw teamsError;

    // 3. Buscar todas as relações em uma única query para processar em memória
    const teamIds = teams?.map(t => t.id) || [];
    let memberCounts: Record<string, number> = {};
    
    if (teamIds.length > 0) {
      const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('team_id')
        .in('team_id', teamIds);
      
      if (!membersError && members) {
        members.forEach(m => {
          memberCounts[m.team_id] = (memberCounts[m.team_id] || 0) + 1;
        });
      }
    }

    // 4. Consolidar os dados
    const summary = regs?.map(reg => {
      const instTeams = teams?.filter(t => t.institution_id === reg.institution_id) || [];
      const athleteCount = instTeams.reduce((sum, t) => sum + (memberCounts[t.id] || 0), 0);
      
      return {
        ...reg,
        modalityCount: instTeams.length,
        athleteCount
      };
    });

    res.json(summary || []);
  } catch (error: any) {
    if (error.message.includes('relation') || error.message.includes('cache')) return res.json([]);
    res.status(500).json({ error: error.message });
  }
});

// Inscrever uma instituição no torneio
router.post("/:id/registrations", async (req, res) => {
  const { institution_id } = req.body;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('tournament_registrations')
      .insert([{ 
        tournament_id: req.params.id,
        institution_id 
      }])
      .select('*, institution:institutions(id, name, logo_url)')
      .single();

    if (error) {
      if (error.message.includes('relation') || error.message.includes('cache')) {
        throw new Error("A tabela 'tournament_registrations' não existe. Execute o script SQL presente no arquivo SUPABASE_SETUP.sql no seu Supabase.");
      }
      if (error.message.includes('row-level security policy')) {
        throw new Error("Erro de RLS: Verifique se você cadastrou a 'service_role' key (e não a 'anon' key) nos Segredos do app. Se a chave estiver correta, execute o script SQL atualizado do arquivo SUPABASE_SETUP.sql para liberar o acesso.");
      }
      throw error;
    }
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Remover uma instituição do torneio
router.delete("/:id/registrations/:regId", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('tournament_registrations')
      .delete()
      .eq('id', req.params.regId);

    if (error) throw error;
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar o status de pagamento/confirmação de uma instituição
router.patch("/:id/registrations/:regId", async (req, res) => {
  const { status } = req.body;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('tournament_registrations')
      .update({ status })
      .eq('id', req.params.regId)
      .select('*, institution:institutions(id, name, logo_url)')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// Listar membros e disponibilidade de um time
router.get("/:id/categories/:categoryId/institutions/:instId/members", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: team, error: teamError } = await supabase
      .from('team_registrations')
      .select('id, availability')
      .eq('tournament_id', req.params.id)
      .eq('tournament_category_id', req.params.categoryId)
      .eq('institution_id', req.params.instId)
      .maybeSingle();

    if (teamError) {
      if (teamError.message.includes('relation') || teamError.message.includes('cache')) return res.json({ athleteIds: [], availability: [] });
      throw teamError;
    }
    
    if (!team) return res.json({ athleteIds: [], availability: [] });

    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('athlete_id')
      .eq('team_id', team.id);

    if (membersError) {
       if (membersError.message.includes('relation') || membersError.message.includes('cache')) return res.json({ athleteIds: [], availability: team.availability || [] });
       throw membersError;
    }
    res.json({ 
      athleteIds: members?.map(m => m.athlete_id) || [], 
      availability: team.availability || [] 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Salvar membros e disponibilidade de um time
router.post("/:id/categories/:categoryId/institutions/:instId/members", async (req, res) => {
  const { athleteIds, availability } = req.body;
  try {
    const supabase = getSupabaseAdmin();

    // 0. Verificar se o torneio exige filiação/anuidade ativa dos atletas
    try {
      const { data: tournamentSettings } = await supabase
        .from('tournament_subscription_settings')
        .select('require_membership')
        .eq('tournament_id', req.params.id)
        .maybeSingle();

      if (tournamentSettings?.require_membership && athleteIds && athleteIds.length > 0) {
        const { data: tournament } = await supabase
          .from('tournaments')
          .select('owner_id, start_date')
          .eq('id', req.params.id)
          .single();
          
        if (tournament) {
          const year = new Date(tournament.start_date).getFullYear();
          const { data: activeMemberships } = await supabase
            .from('memberships')
            .select('member_id')
            .eq('organization_id', tournament.owner_id)
            .eq('year', year)
            .eq('status', 'active')
            .in('member_id', athleteIds);
            
          const activeMemberIds = new Set(activeMemberships?.map(m => m.member_id) || []);
          const inactiveIds = athleteIds.filter((aid: string) => !activeMemberIds.has(aid));
          
          if (inactiveIds.length > 0) {
            const { data: inactiveAthletes } = await supabase
              .from('members')
              .select('id, full_name')
              .in('id', inactiveIds);
              
            const names = inactiveAthletes?.map(a => a.full_name).join(', ') || 'alguns atletas';
            return res.status(403).json({
              error: `Os seguintes atletas não possuem filiação ativa para esta liga em ${year}: ${names}.`
            });
          }
        }
      }
    } catch (e: any) {
      console.warn("Erro ao validar filiação (avançando sem validação):", e.message);
    }

    // 0.5. Validar faixa de nascimento da categoria
    try {
      const { data: category } = await supabase
        .from('tournament_categories')
        .select('birth_year_min, birth_year_max, name')
        .eq('id', req.params.categoryId)
        .single();

      if (category && (category.birth_year_min || category.birth_year_max) && athleteIds && athleteIds.length > 0) {
        const { data: athletes } = await supabase
          .from('members')
          .select('id, full_name, birth_date')
          .in('id', athleteIds);

        const incompatible: string[] = [];
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
          const rangeLabel = category.birth_year_min && category.birth_year_max
            ? `${category.birth_year_min}–${category.birth_year_max}`
            : category.birth_year_min
              ? `a partir de ${category.birth_year_min}`
              : `até ${category.birth_year_max}`;
          return res.status(403).json({
            error: `Os seguintes atletas não se enquadram na faixa de nascimento da categoria "${category.name}" (nascidos ${rangeLabel}): ${incompatible.join(', ')}.`
          });
        }
      }
    } catch (e: any) {
      console.warn("Erro ao validar faixa de nascimento (avançando):", e.message);
    }
    
    // 1. Garantir que o time existe
    let { data: team, error: teamError } = await supabase
      .from('team_registrations')
      .select('id')
      .eq('tournament_id', req.params.id)
      .eq('tournament_category_id', req.params.categoryId)
      .eq('institution_id', req.params.instId)
      .single();

    if (teamError) {
      if (teamError.message.includes('relation') || teamError.message.includes('cache')) {
        throw new Error("A tabela 'team_registrations' não existe. Execute o script SQL presente no arquivo SUPABASE_SETUP.sql no seu Supabase.");
      }
      if (teamError.message.includes('row-level security policy')) {
        throw new Error("Erro de RLS na tabela 'team_registrations'. Verifique se a 'service_role' key está correta ou execute o script SQL atualizado do arquivo SUPABASE_SETUP.sql.");
      }
      const { data: newTeam, error: newTeamError } = await supabase
        .from('team_registrations')
        .insert([{
          tournament_id: req.params.id,
          tournament_category_id: req.params.categoryId,
          institution_id: req.params.instId,
          availability: availability || []
        }])
        .select()
        .single();
      
      if (newTeamError) {
        if (newTeamError.message.includes('row-level security policy')) {
          throw new Error("Erro de RLS ao criar time. Verifique a 'service_role' key ou utilize o script SQL atualizado do arquivo SUPABASE_SETUP.sql.");
        }
        throw newTeamError;
      }
      team = newTeam;
    } else {
      // 1.5 Atualizar disponibilidade se o time já existir
      if (availability) {
        await supabase
          .from('team_registrations')
          .update({ availability })
          .eq('id', team.id);
      }
    }

    // 2. Limpar membros antigos
    await supabase.from('team_members').delete().eq('team_id', team.id);

    // 3. Inserir novos membros
    if (athleteIds.length > 0) {
      const { error: insertError } = await supabase
        .from('team_members')
        .insert(athleteIds.map((aid: string) => ({
          team_id: team.id,
          athlete_id: aid
        })));
      if (insertError) throw insertError;
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Estatísticas da Categoria
router.get("/:id/categories/:categoryId/stats", async (req, res) => {
  try {
    const { categoryId } = req.params;
    const supabase = getSupabaseAdmin();
    console.log(`[STATS] Fetching stats for category: ${categoryId}`);
    
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('id, team1_id, team2_id, score1, score2, status, round, scheduled_time, mvp_athlete_id, team1:team1_id(institution:institutions(id, name, logo_url)), team2:team2_id(institution:institutions(id, name, logo_url)), mvp_athlete:mvp_athlete_id(full_name)')
      .eq('tournament_category_id', categoryId);

    if (matchesError) throw matchesError;

    console.log(`[STATS] Found ${matches.length} matches`);

    const teamStats: Record<string, {name: string, goalsFor: number, goalsAgainst: number}> = {};
    const mvpCounts: Record<string, {name: string, count: number}> = {};

    matches.forEach(m => {
      console.log(`[STATS] Match ${m.id} - status: ${m.status}, score: ${m.score1}x${m.score2}, teams: ${m.team1_id} vs ${m.team2_id}, mvp: ${m.mvp_athlete_id}`);
      
      if (m.mvp_athlete_id && m.status === 'finished') {
        if (!mvpCounts[m.mvp_athlete_id]) {
          const athleteData = m.mvp_athlete as any;
          // Se full_name/name estiverem na view ou relacao (members/athletes podem ser complexos, faremos um fetch fallback depois se precisar)
          mvpCounts[m.mvp_athlete_id] = { name: "Atleta", count: 0 };
        }
        mvpCounts[m.mvp_athlete_id].count += 1;
      }
      
      if (!m.team1_id || !m.team2_id) return;
      if (m.score1 === null || m.score2 === null) return; // Se não tem placar, não considera

      if (!teamStats[m.team1_id]) teamStats[m.team1_id] = { name: (m.team1 as any)?.institution?.name || "Time Desconhecido", goalsFor: 0, goalsAgainst: 0 };
      if (!teamStats[m.team2_id]) teamStats[m.team2_id] = { name: (m.team2 as any)?.institution?.name || "Time Desconhecido", goalsFor: 0, goalsAgainst: 0 };

      teamStats[m.team1_id].goalsFor += (m.score1 || 0);
      teamStats[m.team1_id].goalsAgainst += (m.score2 || 0);

      teamStats[m.team2_id].goalsFor += (m.score2 || 0);
      teamStats[m.team2_id].goalsAgainst += (m.score1 || 0);
    });

    const bestOffenses = Object.entries(teamStats)
      .map(([id, stats]) => ({ id, ...stats }))
      .sort((a, b) => b.goalsFor - a.goalsFor);

    const bestDefenses = Object.entries(teamStats)
      .map(([id, stats]) => ({ id, ...stats }))
      .sort((a, b) => a.goalsAgainst - b.goalsAgainst);

    const matchIds = matches.map(m => m.id);
    let topScorers: any[] = [];
    let cards: any[] = [];
    
    if (matchIds.length > 0) {
      console.log(`[STATS] Fetching events for ${matchIds.length} matches...`);
      const { data: events, error: eventsError } = await supabase
        .from('match_events')
        .select('*')
        .in('match_id', matchIds);

      if (eventsError) throw eventsError;

      console.log(`[STATS] Found ${events?.length || 0} total events`);

      const playerGoals: Record<string, {name: string, teamName: string, goals: number}> = {};
      const validEvents = (events || []).filter(e => e.event_type && e.event_type.startsWith('goal') && e.athlete_id);
      const cardEvents = (events || []).filter(e => e.event_type && (e.event_type === 'yellow_card' || e.event_type === 'red_card') && e.athlete_id);

      const combinedAthleteIds = [...new Set([
        ...validEvents.map(e => e.athlete_id),
        ...cardEvents.map(e => e.athlete_id)
      ])];

      if (combinedAthleteIds.length > 0) {
        // Obter nomes dos atletas e seus institution_ids
        const [{ data: athletesObj }, { data: membersObj }] = await Promise.all([
          Promise.resolve(supabase.from('athletes').select('id, name, institution_id').in('id', combinedAthleteIds)).catch(() => ({ data: [] })),
          Promise.resolve(supabase.from('members').select('id, full_name, institution_id').in('id', combinedAthleteIds)).catch(() => ({ data: [] }))
        ]);
        
        const athletesMap: Record<string, string> = {};
        const athleteInstIdMap: Record<string, string> = {};
        
        athletesObj?.forEach(a => { 
          athletesMap[a.id] = a.name; 
          if (a.institution_id) athleteInstIdMap[a.id] = a.institution_id;
        });
        membersObj?.forEach((m: any) => { 
          athletesMap[m.id] = athletesMap[m.id] || m.full_name; 
          if (m.institution_id) athleteInstIdMap[m.id] = m.institution_id;
        });

        // Buscar nomes das instituições de todos os atletas envolvidos
        const allInstIds = [...new Set(Object.values(athleteInstIdMap))];
        const instMap: Record<string, string> = {};
        if (allInstIds.length > 0) {
          const { data: instsObj } = await supabase.from('institutions').select('id, name').in('id', allInstIds);
          instsObj?.forEach((i: any) => {
            instMap[i.id] = i.name;
          });
        }

        // Obter times (a partir dos eventos)
        const teamIds = [...new Set([
          ...validEvents.map(e => e.team_id).filter(id => id),
          ...cardEvents.map(e => e.team_id).filter(id => id)
        ])];
        
        const { data: teamsObj, error: teamErr } = await supabase.from('tournament_registrations').select('id, institution:institutions(id, name, logo_url)').in('id', teamIds);
        if (teamErr) console.error("Error fetching teams:", teamErr);
        
        const teamsMap: Record<string, string> = {};
        teamsObj?.forEach((t: any) => { teamsMap[t.id] = t.institution?.name || "Time Desconhecido"; });

        // Calcular artilharia
        validEvents.forEach(e => {
          const pts = e.event_type === 'goal_2' ? 2 : e.event_type === 'goal_3' ? 3 : 1;
          
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

        topScorers = Object.entries(playerGoals)
          .map(([id, p]) => ({ id, ...p }))
          .sort((a, b) => b.goals - a.goals)
          .slice(0, 10);

        // Calcular cartões
        cards = cardEvents.map(e => {
          const match = matches.find(m => m.id === e.match_id);
          const player_name = athletesMap[e.athlete_id] || "Atleta";
          const round = match ? match.round : null;
          const game_date = match ? match.scheduled_time : null;
          
          const team1Name = (match?.team1 as any)?.institution?.name || teamsMap[match?.team1_id] || "Time A";
          const team2Name = (match?.team2 as any)?.institution?.name || teamsMap[match?.team2_id] || "Time B";
          const teamsJoined = `${team1Name} x ${team2Name}`;

          return {
            id: e.id,
            athlete_id: e.athlete_id,
            playerName: player_name,
            cardType: e.event_type === 'yellow_card' ? 'yellow' : 'red',
            round,
            gameDate: game_date,
            teams: teamsJoined
          };
        });
      }
      
      console.log(`[STATS] Reduced to ${topScorers.length} top scorers`);
    }

    const topMvps = Object.entries(mvpCounts)
      .map(([id, stats]) => ({ id, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    if (topMvps.length > 0) {
      const mvpIds = topMvps.map(m => m.id);

      const [{ data: mvpAthletesObj }, { data: mvpMembersObj }] = await Promise.all([
        Promise.resolve(supabase.from('athletes').select('id, name, institution_id').in('id', mvpIds)).catch(() => ({ data: [] })),
        Promise.resolve(supabase.from('members').select('id, full_name, institution_id').in('id', mvpIds)).catch(() => ({ data: [] }))
      ]);
      
      const mvpMap: Record<string, string> = {};
      const mvpInstIdMap: Record<string, string> = {};
      mvpAthletesObj?.forEach((m: any) => { 
        mvpMap[m.id] = m.name; 
        if (m.institution_id) mvpInstIdMap[m.id] = m.institution_id;
      });
      mvpMembersObj?.forEach((m: any) => { 
        mvpMap[m.id] = mvpMap[m.id] || m.full_name; 
        if (m.institution_id) mvpInstIdMap[m.id] = m.institution_id;
      });

      const mvpInstIds = [...new Set(Object.values(mvpInstIdMap))];
      const instsMap: Record<string, string> = {};
      if (mvpInstIds.length > 0) {
        const { data: instsObj } = await supabase.from('institutions').select('id, name').in('id', mvpInstIds);
        instsObj?.forEach((i: any) => {
          instsMap[i.id] = i.name;
        });
      }

      topMvps.forEach((m: any) => {
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
  } catch (error: any) {
    console.error('[STATS ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

// Listar partidas de uma categoria
router.get("/:id/categories/:categoryId/matches", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        team1:team1_id(id, availability, institution:institutions(id, name, logo_url)),
        team2:team2_id(id, availability, institution:institutions(id, name, logo_url)),
        winner:winner_id(id, institution:institutions(id, name, logo_url)),
        venue:venue_id(*)
      `)
      .eq('tournament_id', req.params.id)
      .eq('tournament_category_id', req.params.categoryId)
      .order('round', { ascending: true })
      .order('match_index', { ascending: true });

    if (error) {
      if (error.message.includes('relation') || error.message.includes('cache')) return res.json([]);
      throw error;
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Listar times de uma categoria
router.get("/:id/categories/:categoryId/teams", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('team_registrations')
      .select('*, institution:institutions(id, name, logo_url)')
      .eq('tournament_id', req.params.id)
      .eq('tournament_category_id', req.params.categoryId);

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function backendCalculateStandings(matches: any[]) {
  const teamsMap: Record<string, any> = {};

  matches.forEach(match => {
    if (!match.team1_id || !match.team2_id) return;

    [match.team1_id, match.team2_id].forEach(id => {
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

  return Object.values(teamsMap).sort((a: any, b: any) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.sg !== a.sg) return b.sg - a.sg;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.goalsFor - a.goalsFor;
  });
}

// Gerar chaveamento (Diferentes Sistemas)
router.post("/:id/categories/:categoryId/matches/generate", async (req, res) => {
  const { id: tournamentId, categoryId } = req.params;
  const { system = "single", groupCount = 1, seeds = [], phase_index = 1, phase_name = "Fase Única", team_ids, group_label } = req.body;
  
  try {
    const supabase = getSupabaseAdmin();

    // 1. Verificar se já existem partidas para esta fase e subdivisão
    let checkQuery = supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .eq("tournament_category_id", categoryId)
      .eq("phase_index", phase_index);

    if (group_label) {
      checkQuery = checkQuery.eq("group_label", group_label);
    }
    
    const { count } = await checkQuery;
    
    if (count && count > 0) {
      return res.status(400).json({ error: `Chaveamento já gerado para esta subdivisão/fase.` });
    }

    // 2. Buscar informações da categoria para saber se é esporte de combate/luta
    const { data: category } = await supabase
      .from('tournament_categories')
      .select('rules_config')
      .eq('id', categoryId)
      .single();

    const isCombat = category?.rules_config?.sport_type === "combat";
    
    let competitors: any[] = [];
    if (isCombat) {
      // Buscar inscrições de atletas aprovadas
      const { data: subs, error: subsError } = await supabase
        .from("athlete_subscriptions")
        .select(`
          id,
          athlete_name,
          institution_id,
          additional_data,
          institution:institutions(id, name)
        `)
        .eq("tournament_id", tournamentId)
        .eq("category_id", categoryId)
        .eq("validation_status", "approved");

      if (subsError) throw subsError;

      const filteredSubs = (subs || []).filter(sub => {
        const age = sub.additional_data?.age_group || "";
        const grad = sub.additional_data?.graduation || "";
        const wt = sub.additional_data?.weight_class || "";
        const label = `${age} - ${grad} - ${wt}`;
        return !group_label || label === group_label;
      });

      const { data: catTeams } = await supabase
        .from("team_registrations")
        .select("id, institution_id")
        .eq("tournament_category_id", categoryId);

      competitors = filteredSubs.map(sub => {
        const teamReg = catTeams?.find(t => t.institution_id === sub.institution_id);
        const inst: any = Array.isArray(sub.institution) ? sub.institution[0] : sub.institution;
        return {
          id: sub.id, // virtual id (athlete subscription id)
          name: sub.athlete_name,
          team_registration_id: teamReg?.id || null,
          institution_name: inst?.name || "Avulso"
        };
      });

      if (team_ids && Array.isArray(team_ids) && team_ids.length > 0) {
        const selectedSet = new Set(team_ids);
        competitors = competitors.filter(c => selectedSet.has(c.id));
      }
    } else {
      // Buscar times inscritos tradicionalmente
      let teamsList: any[] = [];
      if (team_ids && Array.isArray(team_ids) && team_ids.length > 0) {
        const { data: filterTeams, error: teamsError } = await supabase
          .from("team_registrations")
          .select("id, institution:institutions(id, name)")
          .eq("tournament_category_id", categoryId)
          .in("id", team_ids);
        
        if (teamsError) throw teamsError;
        teamsList = filterTeams || [];
      } else {
        const { data: allTeams, error: teamsError } = await supabase
          .from("team_registrations")
          .select("id, institution:institutions(id, name)")
          .eq("tournament_category_id", categoryId);

        if (teamsError) throw teamsError;
        teamsList = allTeams || [];
      }

      competitors = teamsList.map(t => ({
        id: t.id,
        name: t.institution?.name || "Sem Nome",
        team_registration_id: t.id,
        institution_name: t.institution?.name || ""
      }));
    }

    if (!competitors || competitors.length < 2) {
      return res.status(400).json({ error: "Número insuficiente de competidores para gerar o chaveamento (mínimo 2)." });
    }

    // Separar cabeças de chave do restante
    const seedIds = new Set(seeds);
    const seededCompetitors = competitors.filter(c => seedIds.has(c.id)).sort(() => Math.random() - 0.5);
    const regularCompetitors = competitors.filter(c => !seedIds.has(c.id)).sort(() => Math.random() - 0.5);
    
    let pairs: Array<[any, any]> = [];
    let usePairs = false;

    if (system === "single" && phase_index > 1) {
      try {
        if (category?.rules_config?.phases && Array.isArray(category.rules_config.phases)) {
          const prevPhase = category.rules_config.phases[phase_index - 2];
          if (prevPhase && (prevPhase.system === "groups" || prevPhase.system === "group_vs_group")) {
            const { data: prevMatches, error: prevMatchesError } = await supabase
              .from('matches')
              .select(`
                *,
                team1:team1_id(id, availability, institution:institutions(id, name, logo_url)),
                team2:team2_id(id, availability, institution:institutions(id, name, logo_url)),
                winner:winner_id(id, institution:institutions(id, name, logo_url))
              `)
              .eq('tournament_id', tournamentId)
              .eq('tournament_category_id', categoryId)
              .eq('phase_index', phase_index - 1);

            if (!prevMatchesError && prevMatches && prevMatches.length > 0) {
              const selectedCompetitorSet = new Set(competitors.map(c => c.id));
              
              const groupMatches: Record<string, any[]> = {};
              prevMatches.forEach((m: any) => {
                const label = m.group_label || "Geral";
                if (!groupMatches[label]) groupMatches[label] = [];
                groupMatches[label].push(m);
              });

              const groupStandings: Record<string, any[]> = {};
              Object.entries(groupMatches).forEach(([label, matches]) => {
                const delimiterRegex = /\s+[xX]\s+/;
                if (delimiterRegex.test(label)) {
                  const parts = label.split(delimiterRegex);
                  const leftName = parts[0].trim();
                  const rightName = parts[1].trim();

                  const leftTeamIds = new Set(matches.map(m => m.team1_id).filter(Boolean));
                  const rightTeamIds = new Set(matches.map(m => m.team2_id).filter(Boolean));

                  const standings = backendCalculateStandings(matches);
                  
                  groupStandings[leftName] = standings
                    .filter(t => leftTeamIds.has(t.id))
                    .filter(t => selectedCompetitorSet.has(t.id));
                    
                  groupStandings[rightName] = standings
                    .filter(t => rightTeamIds.has(t.id))
                    .filter(t => selectedCompetitorSet.has(t.id));
                } else {
                  const standings = backendCalculateStandings(matches);
                  groupStandings[label] = standings.filter(t => selectedCompetitorSet.has(t.id));
                }
              });

              const groupLabels = Object.keys(groupStandings).sort();

              if (prevPhase.system === "groups") {
                const numGroups = groupLabels.length;
                const pairedGroups = new Set<string>();

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
                    const count = Math.max(ranked1.length, ranked2.length);

                    for (let i = 0; i < count; i++) {
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
                groupLabels.forEach(label => {
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
      const round1Matches: any[] = [];
      
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
          status: (t1Id && t2Id) ? "scheduled" : (t1Id || t2Id ? "finished" : "scheduled"),
          winner_id: (t1Id && !t2Id) ? t1Id : (!t1Id && t2Id ? t2Id : null),
          phase_index,
          phase_name,
          group_label: group_label || null
        });
      }

      const { data: createdRound1, error: r1Error } = await supabase
        .from("matches")
        .insert(round1Matches)
        .select();
      
      if (r1Error) throw r1Error;

      let prevRoundMatches = createdRound1;
      for (let r = 2; r <= rounds; r++) {
        const numMatchesInRound = Math.pow(2, rounds - r);
        const nextRoundMatches: any[] = [];
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
        
        const { data: createdRound, error: rError } = await supabase
          .from("matches")
          .insert(nextRoundMatches)
          .select();
        
        if (rError) throw rError;

        for (let i = 0; i < prevRoundMatches.length; i++) {
          const parentIndex = Math.floor(i / 2);
          const parentMatch = createdRound.find((m: any) => m.match_index === parentIndex);
          if (parentMatch) {
            await supabase
              .from("matches")
              .update({ next_match_id: parentMatch.id })
              .eq("id", prevRoundMatches[i].id);
          }
        }
        prevRoundMatches = createdRound;
      }
    } 
    else if (system === "groups") {
      const groups: any[][] = Array.from({ length: groupCount }, () => []);
      
      seededCompetitors.forEach((c, index) => {
        groups[index % groupCount].push(c);
      });
      
      regularCompetitors.forEach((c, index) => {
        const groupIndex = (seededCompetitors.length + index) % groupCount;
        groups[groupIndex].push(c);
      });

      const matchesToInsert: any[] = [];

      groups.forEach((groupComps, groupIdx) => {
        const groupLabelStr = String.fromCharCode(65 + groupIdx); // A, B, C...
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

      const { error: gError } = await supabase
        .from("matches")
        .insert(matchesToInsert);
      
      if (gError) throw gError;
    }
    else if (system === "group_vs_group") {
      const actualGroupCount = groupCount % 2 === 0 ? groupCount : groupCount + 1;
      const groups: any[][] = Array.from({ length: actualGroupCount }, () => []);
      shuffledCompetitors.forEach((c, index) => {
        groups[index % actualGroupCount].push(c);
      });

      const matchesToInsert: any[] = [];

      for (let g = 0; g < actualGroupCount; g += 2) {
        const groupA = groups[g];
        const groupB = groups[g + 1];
        const groupALabel = String.fromCharCode(65 + g);
        const groupBLabel = String.fromCharCode(65 + g + 1);
        const pairingLabel = `${groupALabel} x ${groupBLabel}`;
        const label = group_label ? `${group_label} - ${pairingLabel}` : pairingLabel;

        groupA.forEach(cA => {
          groupB.forEach(cB => {
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
        const { error: gvError } = await supabase
          .from("matches")
          .insert(matchesToInsert);
        if (gvError) throw gvError;
      }
    }

    res.json({ message: "Chaveamento gerado com sucesso." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar Resultado de Partida
router.patch("/matches/:matchId", async (req, res) => {
  const { 
    score1, score2, winner_id, status,
    timer_base_seconds, timer_last_started_at, is_timer_running,
    period, report, mvp_athlete_id, roster1, roster2, sets_detail
  } = req.body;
  const { matchId } = req.params;

  try {
    const supabase = getSupabaseAdmin();
    
    // 1. Atualizar a partida atual
    // Filter out undefined values
    const updatePayload: any = {};
    if (score1 !== undefined) updatePayload.score1 = score1;
    if (score2 !== undefined) updatePayload.score2 = score2;
    if (winner_id !== undefined) updatePayload.winner_id = winner_id;
    if (status !== undefined) updatePayload.status = status;
    if (timer_base_seconds !== undefined) updatePayload.timer_base_seconds = timer_base_seconds;
    if (timer_last_started_at !== undefined) updatePayload.timer_last_started_at = timer_last_started_at;
    if (is_timer_running !== undefined) updatePayload.is_timer_running = is_timer_running;
    if (period !== undefined) updatePayload.period = period;
    if (report !== undefined) updatePayload.report = report;
    if (mvp_athlete_id !== undefined) updatePayload.mvp_athlete_id = mvp_athlete_id;
    if (roster1 !== undefined) updatePayload.roster1 = roster1;
    if (roster2 !== undefined) updatePayload.roster2 = roster2;
    if (sets_detail !== undefined) updatePayload.sets_detail = sets_detail;

    const { data: updatedMatch, error } = await supabase
      .from('matches')
      .update(updatePayload)
      .eq('id', matchId)
      .select(`
        *,
        tournament:tournament_id(name),
        category:tournament_category_id(name, gender, age_group),
        team1:team1_id(id, institution:institutions(id, name, logo_url)),
        team2:team2_id(id, institution:institutions(id, name, logo_url)),
        winner:winner_id(id, institution:institutions(id, name, logo_url)),
        referee1:referee1_id(name),
        referee2:referee2_id(name),
        table_official:table_official_id(name)
      `)
      .single();

    if (error) throw error;

    let finalWinnerId = winner_id || updatedMatch?.winner_id;
    if (status === 'finished' && !finalWinnerId && updatedMatch) {
      if ((updatedMatch.score1 || 0) > (updatedMatch.score2 || 0)) {
        finalWinnerId = updatedMatch.team1_id;
      } else if ((updatedMatch.score2 || 0) > (updatedMatch.score1 || 0)) {
        finalWinnerId = updatedMatch.team2_id;
      }
      
      if (finalWinnerId) {
        await supabase
          .from('matches')
          .update({ winner_id: finalWinnerId })
          .eq('id', matchId);
        updatedMatch.winner_id = finalWinnerId;
      }
    }

    // 2. Se finalizou e tem ganhador, avançar o ganhador para a próxima partida
    if (status === 'finished' && finalWinnerId && updatedMatch.next_match_id) {
      const isTeam1 = updatedMatch.match_index % 2 === 0;
      
      const isCombatMatch = (updatedMatch.roster1 && updatedMatch.roster1.athlete_name) || (updatedMatch.roster2 && updatedMatch.roster2.athlete_name);
      let winnerRoster = {};
      if (isCombatMatch) {
        if (finalWinnerId === updatedMatch.team1_id) {
          winnerRoster = updatedMatch.roster1 || {};
        } else if (finalWinnerId === updatedMatch.team2_id) {
          winnerRoster = updatedMatch.roster2 || {};
        }
      }

      const updateData = isTeam1 
        ? { team1_id: finalWinnerId, ...(isCombatMatch ? { roster1: winnerRoster } : {}) } 
        : { team2_id: finalWinnerId, ...(isCombatMatch ? { roster2: winnerRoster } : {}) };
      
      await supabase
        .from('matches')
        .update(updateData)
        .eq('id', updatedMatch.next_match_id);
    }

    res.json(updatedMatch);
  } catch (error: any) {
    console.error("[PATCH MATCH ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
});

// Resetar chaveamento (Deletar todas as partidas de uma categoria, fase ou subdivisão)
router.delete("/:id/categories/:categoryId/matches", async (req, res) => {
  const { categoryId } = req.params;
  const phase_index = req.query.phase_index ? parseInt(req.query.phase_index as string, 10) : undefined;
  const group_label = req.query.group_label as string | undefined;
  
  try {
    const supabase = getSupabaseAdmin();
    
    let queryUpdate = supabase.from('matches').update({ next_match_id: null }).eq('tournament_category_id', categoryId);
    let queryDelete = supabase.from('matches').delete().eq('tournament_category_id', categoryId);

    if (phase_index !== undefined && !isNaN(phase_index)) {
      queryUpdate = queryUpdate.eq('phase_index', phase_index);
      queryDelete = queryDelete.eq('phase_index', phase_index);
    }

    if (group_label) {
      queryUpdate = queryUpdate.eq('group_label', group_label);
      queryDelete = queryDelete.eq('group_label', group_label);
    }

    // 1. Primeiro remover as referências circulares (next_match_id)
    await queryUpdate;

    // 2. Agora sim podemos deletar tudo com segurança
    const { error } = await queryDelete;

    if (error) throw error;
    res.json({ message: "Chaveamento resetado com sucesso." });
  } catch (error: any) {
    console.error("Erro ao resetar chaveamento:", error);
    res.status(500).json({ error: error.message });
  }
});

// Listar atletas de um time específico (Time na categoria)
router.get("/teams/:teamId/athletes", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    
    // 1. Buscar apenas os IDs dos membros do time
    const { data: teamMembers, error: tmError } = await supabase
      .from('team_members')
      .select('athlete_id')
      .eq('team_id', req.params.teamId);

    if (tmError) throw tmError;
    
    let athleteIds = teamMembers?.map(tm => tm.athlete_id) || [];

    // FALLBACK: Se o time não tem atletas vinculados, buscamos todos os membros da instituição do time
    if (athleteIds.length === 0) {
      const { data: teamInfo } = await supabase
        .from('team_registrations')
        .select('institution_id')
        .eq('id', req.params.teamId)
        .single();
      
      if (teamInfo?.institution_id) {
        const [{ data: instMembers }, { data: legacyInstMembers }] = await Promise.all([
          supabase
            .from('members')
            .select('id, full_name, document_number')
            .eq('institution_id', teamInfo.institution_id),
          supabase
            .from('athletes')
            .select('id, name, document_number')
            .eq('institution_id', teamInfo.institution_id)
        ]);
        
        const consolidatedFallback = [
          ...(instMembers?.map(m => ({ ...m, name: m.full_name })) || []),
          ...(legacyInstMembers?.map(la => ({ ...la, full_name: la.name })) || [])
        ];

        if (consolidatedFallback.length > 0) {
          return res.json(consolidatedFallback);
        }
      }
    }

    if (athleteIds.length === 0) return res.json([]);

    // 2. Buscar detalhes na tabela 'members'
    const { data: members, error: mError } = await supabase
      .from('members')
      .select('id, full_name, document_number')
      .in('id', athleteIds);

    // 3. Buscar detalhes na tabela 'athletes' (Legacy)
    const { data: legacyAthletes, error: laError } = await supabase
      .from('athletes')
      .select('id, name, document_number')
      .in('id', athleteIds);

    // 4. Consolidar resultados
    const consolidated = athleteIds.map(id => {
      const member = members?.find(m => m.id === id);
      const legacy = legacyAthletes?.find(la => la.id === id);
      
      if (member) return { ...member, name: member.full_name };
      if (legacy) return { ...legacy, full_name: legacy.name };
      return null;
    }).filter(a => a !== null);
      
    res.json(consolidated);
  } catch (error: any) {
    console.error("Erro ao listar atletas:", error);
    res.status(500).json({ error: error.message });
  }
});

// Listar eventos de uma partida
router.get("/matches/:matchId/events", async (req, res) => {
  const { matchId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    console.log(`[GET EVENTS] Fetching events for match: ${matchId}`);
    
    const { data, error } = await supabase
      .from('match_events')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error(`[GET EVENTS] Supabase Error:`, JSON.stringify(error, null, 2));
      return res.status(500).json({ error: error.message, details: error.details, code: error.code });
    }
    
    console.log(`[GET EVENTS] Found ${data?.length || 0} events`);

    if (!data || data.length === 0) return res.json([]);

    // Buscar nomes dos atletas (suportando as duas tabelas)
    // Filtramos apenas IDs válidos (não nulos e não vazios)
    const athleteIds = [...new Set(data.map(e => e.athlete_id).filter(id => id && id !== ""))];
    
    let athletesMap: Record<string, string> = {};
    if (athleteIds.length > 0) {
      try {
        const [{ data: members, error: meError }, { data: legacy, error: leError }] = await Promise.all([
          supabase.from('members').select('id, full_name').in('id', athleteIds),
          supabase.from('athletes').select('*').in('id', athleteIds)
        ]);
        
        if (meError) console.warn("[GET EVENTS] Members lookup error:", meError.message);
        if (leError) console.warn("[GET EVENTS] Legacy athletes lookup error:", leError.message);

        members?.forEach(m => { athletesMap[m.id] = m.full_name; });
        legacy?.forEach(l => { 
          // Atletas legacy podem ter 'name' ou 'full_name'
          athletesMap[l.id] = l.name || l.full_name || "Atleta"; 
        });
      } catch (lookupError) {
        console.error("[GET EVENTS] Error during athlete name lookup:", lookupError);
      }
    }

    const eventsWithAthletes = data.map(e => ({
      ...e,
      athlete: e.athlete_id ? { id: e.athlete_id, full_name: athletesMap[e.athlete_id] || "Atleta" } : null
    }));

    res.json(eventsWithAthletes);
  } catch (error: any) {
    console.error(`[GET EVENTS] Critical catch error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Registrar evento na partida
router.post("/matches/:matchId/events", async (req, res) => {
  const { team_id, athlete_id, event_type, event_time, period } = req.body;
  const { matchId } = req.params;
  
  try {
    const supabase = getSupabaseAdmin();
    console.log(`[POST EVENT] Type: ${event_type}, Team: ${team_id}, Match: ${matchId}, Athlete: ${athlete_id}, Period: ${period}`);

    // 1. Inserir o evento
    // Garantimos que athlete_id seja null se vazio
    const payload: any = {
      match_id: matchId,
      team_id: team_id || null,
      athlete_id: athlete_id || null,
      event_type,
      event_time
    };

    if (period !== undefined) {
      payload.period = period;
    }

    const { data: event, error: eventError } = await supabase
      .from('match_events')
      .insert(payload)
      .select()
      .single();

    if (eventError) {
      console.error("[POST EVENT] Supabase error:", JSON.stringify(eventError, null, 2));
      return res.status(500).json({ 
        error: eventError.message, 
        details: eventError.details, 
        hint: eventError.hint,
        code: eventError.code 
      });
    }

    // 2. Se for gol, atualizar o placar da partida automaticamente
    if (event_type.startsWith('goal')) {
      const parts = event_type.split('_');
      const points = parts.length > 1 ? parseInt(parts[1], 10) : 1;

      try {
        const { data: currentMatch, error: matchFetchError } = await supabase
          .from('matches')
          .select('score1, score2, team1_id')
          .eq('id', matchId)
          .single();

        if (matchFetchError) throw matchFetchError;

        if (currentMatch) {
          const isTeam1 = currentMatch.team1_id === team_id;
          const updateData = isTeam1 
            ? { score1: (currentMatch.score1 || 0) + points }
            : { score2: (currentMatch.score2 || 0) + points };
          
          const { error: matchUpdateError } = await supabase
            .from('matches')
            .update(updateData)
            .eq('id', matchId);
          
          if (matchUpdateError) console.error("[POST EVENT] Failed to update scoreboard:", matchUpdateError.message);
        }
      } catch (placarError: any) {
        console.error("[POST EVENT] Error updating scoreboard:", placarError.message);
        // Não falhamos a requisição se apenas o placar falhou (o evento já foi registrado)
      }
    }

    res.json(event);
  } catch (error: any) {
    console.error(`[POST EVENT] Critical catch error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Remover evento (Estorno)
router.delete("/matches/:matchId/events/:eventId", async (req, res) => {
  const { matchId, eventId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    console.log(`[DELETE EVENT] Attempting to delete event ${eventId} from match ${matchId}`);
    
    // Buscar o evento antes de deletar para saber se era gol
    const { data: event, error: fetchError } = await supabase
      .from('match_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (fetchError) {
      console.error(`[DELETE EVENT] Error fetching event: ${fetchError.message}`);
      // Se o evento não existir, avisamos
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: "Evento não encontrado" });
      }
      throw fetchError;
    }

    if (event && event.event_type.startsWith('goal')) {
      const parts = event.event_type.split('_');
      const points = parts.length > 1 ? parseInt(parts[1], 10) : 1;

      console.log(`[DELETE EVENT] Event was a goal for team ${event.team_id} with ${points} points. Decrementing score.`);
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (matchError) {
        console.error(`[DELETE EVENT] Error fetching match for score update: ${matchError.message}`);
      } else if (match) {
        const isTeam1 = match.team1_id === event.team_id;
        const updateData = isTeam1 
          ? { score1: Math.max(0, (match.score1 || 0) - points) }
          : { score2: Math.max(0, (match.score2 || 0) - points) };
        
        console.log(`[DELETE EVENT] Updating match ${matchId} score data:`, updateData);
        const { error: updateError } = await supabase.from('matches').update(updateData).eq('id', matchId);
        if (updateError) console.error(`[DELETE EVENT] Score update error: ${updateError.message}`);
      }
    } else if (event && (event.event_type === 'point' || event.event_type === 'baleado_point')) {
      console.log(`[DELETE EVENT] Event was a set point for team ${event.team_id}. Decrementing sets_detail.`);
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (match && match.sets_detail) {
        const isTeam1 = match.team1_id === event.team_id;
        const updatedSets = [...(match.sets_detail || [])];
        if (updatedSets.length > 0) {
          const activeIdx = updatedSets.length - 1;
          const set = { ...updatedSets[activeIdx] };
          set.team1 = Math.max(0, (set.team1 || 0) - (isTeam1 ? 1 : 0));
          set.team2 = Math.max(0, (set.team2 || 0) - (!isTeam1 ? 1 : 0));
          updatedSets[activeIdx] = set;
          
          console.log(`[DELETE EVENT] Updating match ${matchId} sets_detail:`, updatedSets);
          const { error: updateError } = await supabase.from('matches').update({ sets_detail: updatedSets }).eq('id', matchId);
          if (updateError) console.error(`[DELETE EVENT] sets_detail update error: ${updateError.message}`);
        }
      }
    } else if (event && event.event_type === 'revive') {
      console.log(`[DELETE EVENT] Event was a revive for team ${event.team_id}. Incrementing sets_detail.`);
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (match && match.sets_detail) {
        const isTeam1 = match.team1_id === event.team_id;
        const updatedSets = [...(match.sets_detail || [])];
        if (updatedSets.length > 0) {
          const activeIdx = updatedSets.length - 1;
          const set = { ...updatedSets[activeIdx] };
          set.team1 = (set.team1 || 0) + (!isTeam1 ? 1 : 0);
          set.team2 = (set.team2 || 0) + (isTeam1 ? 1 : 0);
          updatedSets[activeIdx] = set;
          
          console.log(`[DELETE EVENT] Updating match ${matchId} sets_detail (revive delete):`, updatedSets);
          const { error: updateError } = await supabase.from('matches').update({ sets_detail: updatedSets }).eq('id', matchId);
          if (updateError) console.error(`[DELETE EVENT] sets_detail update error: ${updateError.message}`);
        }
      }
    }

    const { error: deleteError } = await supabase
      .from('match_events')
      .delete()
      .eq('id', eventId);

    if (deleteError) {
      console.error(`[DELETE EVENT] Delete error: ${deleteError.message}`);
      throw deleteError;
    }

    console.log(`[DELETE EVENT] Event ${eventId} deleted successfully`);
    res.json({ message: "Evento removido com sucesso." });
  } catch (error: any) {
    console.error(`[DELETE EVENT] Critical error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// --- VENUES ROUTES ---
router.get("/venues/all", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const organizerId = req.user!.id;
    const { role } = getUserRoleAndReferenceId(organizerId);

    let useLocalFallback = false;
    let data: any[] | null = null;
    let error = null;

    try {
      let query = supabase.from('venues').select('*');
      if (role !== "super_admin") {
        query = query.eq('organizer_id', organizerId);
      }
      const resDb = await query.order('name');
      data = resDb.data;
      error = resDb.error;

      if (error && (error.message.includes('column') || error.message.includes('organizer_id'))) {
        useLocalFallback = true;
      }
    } catch (e) {
      useLocalFallback = true;
    }

    if (useLocalFallback) {
      await ensureStaffAndVenuesMappings();
      const { data: allData, error: allErr } = await supabase.from('venues').select('*').order('name');
      if (allErr) {
        if (allErr.message.includes('relation') || allErr.message.includes('cache')) return res.json([]);
        throw allErr;
      }
      if (organizerId && role !== "super_admin") {
        const mapping = loadOrgVenues();
        const allowedIds = mapping[organizerId] || [];
        const filtered = (allData || []).filter(v => allowedIds.includes(v.id));
        return res.json(filtered);
      }
      return res.json(allData || []);
    }

    if (error) {
      if (error.message.includes('relation') || error.message.includes('cache')) return res.json([]);
      throw error;
    }

    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/venues", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const organizerId = req.user!.id;
    const { role } = getUserRoleAndReferenceId(organizerId);
    
    const { id, ...venueData } = req.body;
    
    try {
      let result;
      if (id) {
        let updateQuery = supabase.from('venues').update(venueData).eq('id', id);
        if (role !== "super_admin") {
          updateQuery = updateQuery.eq('organizer_id', organizerId);
        }
        result = await updateQuery.select().single();
      } else {
        const insertData = { ...req.body, organizer_id: organizerId };
        result = await supabase.from('venues').insert([insertData]).select().single();
      }
      const { data, error } = result;
      if (error) {
        if (error.message.includes('column') || error.message.includes('organizer_id')) {
          throw new Error("fallback_to_json");
        }
        throw error;
      }
      return res.json(data);
    } catch (dbErr: any) {
      if (dbErr.message === "fallback_to_json") {
        let result;
        if (id) {
          result = await supabase.from('venues').update(venueData).eq('id', id).select().single();
        } else {
          result = await supabase.from('venues').insert([req.body]).select().single();
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/venues/:id", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const organizerId = req.user!.id;
    const venueId = req.params.id;
    
    const { error } = await supabase.from('venues').delete().eq('id', venueId);
    if (error) throw error;

    if (organizerId) {
      await ensureStaffAndVenuesMappings();
      const mapping = loadOrgVenues();
      if (mapping[organizerId]) {
        mapping[organizerId] = mapping[organizerId].filter(id => id !== venueId);
        saveOrgVenues(mapping);
      }
    }

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- ENDPOINTS DE CONFIGURAÇÃO DE TAXAS E INSCRIÇÕES ---

const DATA_FILE = path.join(process.cwd(), 'src/backend/data/subscriptions.json');

interface SubSettings {
  deadline: string;
  feeType: 'free' | 'by_team' | 'by_team_and_athlete_institution' | 'by_team_and_athlete_parent';
  teamFee: number;
  athleteFee: number;
  status: 'open' | 'closed';
  requireMembership?: boolean;
  registrationConfig?: any;
  maxVisitorsPerAthlete?: number;
}

interface AthleteSub {
  id: string;
  tournamentId: string;
  institutionId: string;
  categoryId: string;
  athleteName: string;
  birthDate: string;
  document: string;
  gender: string;
  isCompleted: boolean;
  parentName?: string;
  parentPhone?: string;
  additionalData?: {
    bloodType: string;
    allergies: string;
    emergencyContact: string;
  };
  documentUrl?: string | null;
  photoUrl?: string | null;
  authorizedImageUse?: boolean;
  liabilityWaiver?: boolean;
  paymentStatus?: 'pending' | 'paid';
  validationStatus: 'pending' | 'approved' | 'rejected';
  validationFeedback?: string;
  validatedAt?: string;
}

interface DbSchema {
  settings: Record<string, SubSettings>;
  athleteSubscriptions: AthleteSub[];
}

function loadDb(): DbSchema {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify({ settings: {}, athleteSubscriptions: [] }, null, 2));
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading subscriptions.json", err);
    return { settings: {}, athleteSubscriptions: [] };
  }
}

function saveDb(db: DbSchema) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("Error writing subscriptions.json", err);
  }
}

function getDefaultRegistrationConfig() {
  return {
    fields: [
      { id: "parentName", label: "Nome do Responsável", enabled: true, required: true, custom: false },
      { id: "parentPhone", label: "Telefone do Responsável", enabled: true, required: true, custom: false },
      { id: "bloodType", label: "Tipo Sanguíneo", enabled: true, required: false, custom: false },
      { id: "allergies", label: "Alergias / Restrições", enabled: true, required: false, custom: false },
      { id: "emergencyContact", label: "Contato de Emergência", enabled: true, required: true, custom: false }
    ],
    uploads: [
      { id: "document", label: "Documento de Identidade (RG/CPF)", enabled: true, required: true, custom: false },
      { id: "photo", label: "Foto de Rosto (3x4)", enabled: true, required: true, custom: false }
    ],
    terms: [
      { 
        id: "imageUse", 
        title: "1. Concessão de Direito de Uso de Imagem", 
        content: "Autorizo expressamente o organizador do torneio a capturar e utilizar imagens, vídeos e transmissões de áudio nas quais o atleta participante figure, com finalidade puramente de divulgação esportiva, cobertura oficial das partidas, publicações em mídias impressas, redes sociais e portal oficial da competição, sem que isso gere qualquer direito a retribuição financeira.", 
        enabled: true, 
        required: true 
      },
      { 
        id: "liability", 
        title: "2. Termo de Aptidão Física e Responsabilidade", 
        content: "Declaro estar inteiramente ciente das regras oficiais do torneio. Sob as penas da lei, declaro que o atleta encontra-se plenamente apto e saudável para a participação em esportes competitivos, gozando de perfeita saúde física e mental. Isento de qualquer responsabilidade civil ou criminal os realizadores, a instituição escolar representativa e os patrocinadores por acidentes, imprevistos ou perdas decorrentes do andamento regular dos jogos.", 
        enabled: true, 
        required: true 
      }
    ]
  };
}

function mapSettingsToFrontend(dbSettings: any) {
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

function mapSettingsToDb(feSettings: any) {
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

function mapSubToFrontend(dbSub: any) {
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

function mapSubToDb(feSub: any) {
  return {
    id: feSub.id,
    tournament_id: feSub.tournamentId,
    institution_id: feSub.institutionId,
    category_id: feSub.categoryId,
    athlete_name: feSub.athleteName,
    birth_date: feSub.birthDate,
    document: feSub.document,
    gender: feSub.gender || "Masculino",
    is_completed: !!feSub.isCompleted,
    validation_status: feSub.validationStatus || "pending",
    validation_feedback: feSub.validationFeedback || null,
    validated_at: feSub.validatedAt || null,
    parent_name: feSub.parentName || null,
    parent_phone: feSub.parentPhone || null,
    additional_data: feSub.additionalData || feSub.additional_data || {},
    document_url: feSub.documentUrl || null,
    photo_url: feSub.photoUrl || null,
    authorized_image_use: !!feSub.authorizedImageUse,
    liability_waiver: !!feSub.liabilityWaiver,
    payment_status: feSub.paymentStatus || "pending"
  };
}

async function getSubscriptionSettings(tournamentId: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('tournament_subscription_settings')
      .select('*')
      .eq('tournament_id', tournamentId)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('relation "tournament_subscription_settings" does not exist') || error.message.includes('Public.tournament_subscription_settings')) {
        console.warn("Using JSON fallback for subscription settings: Table not found in Supabase.");
      } else {
        throw error;
      }
    } else if (data) {
      return mapSettingsToFrontend(data);
    }
  } catch (err: any) {
    console.warn("Supabase exception on subscription settings, using JSON fallback", err.message);
  }

  // Fallback to local JSON
  const db = loadDb();
  const rawSettings = db.settings[tournamentId];
  if (rawSettings) {
    const hasConfig = rawSettings.registrationConfig && 
                      (rawSettings.registrationConfig.fields?.length > 0 || 
                       rawSettings.registrationConfig.uploads?.length > 0 || 
                       rawSettings.registrationConfig.terms?.length > 0);
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

async function saveSubscriptionSettings(tournamentId: string, payload: any) {
  try {
    const supabase = getSupabaseAdmin();
    console.log("[DEBUG] saveSubscriptionSettings payload received:", payload);
    const dbPayload = mapSettingsToDb(payload);
    console.log("[DEBUG] saveSubscriptionSettings dbPayload mapping:", dbPayload);
    
    const { error } = await supabase
      .from('tournament_subscription_settings')
      .upsert({
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
  } catch (err: any) {
    console.warn("Supabase exception on save subscription settings, using JSON fallback", err.message);
  }

  // Fallback to local JSON
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

async function getAthleteSubscriptions(tournamentId: string, institutionId?: string) {
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase.from('athlete_subscriptions').select('*').eq('tournament_id', tournamentId);
    if (institutionId) {
      query = query.eq('institution_id', institutionId);
    }
    const { data, error } = await query;
    if (error) {
      if (error.message.includes('relation "athlete_subscriptions" does not exist') || error.message.includes('Public.athlete_subscriptions')) {
        console.warn("Using JSON fallback for athlete subscriptions: Table not found in Supabase.");
      } else {
        throw error;
      }
    } else if (data) {
      return data.map(mapSubToFrontend);
    }
  } catch (err: any) {
    console.warn("Supabase exception on athlete subscriptions, using JSON fallback", err.message);
  }

  // Fallback
  const db = loadDb();
  const subs = db.athleteSubscriptions.filter(s => s.tournamentId === tournamentId);
  if (institutionId) {
    return subs.filter(s => s.institutionId === institutionId);
  }
  return subs;
}

// Obter configurações de inscrição de um torneio
router.get("/:id/subscription-settings", async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const settings = await getSubscriptionSettings(tournamentId);
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar configurações de inscrição de um torneio
router.post("/:id/subscription-settings", async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const saved = await saveSubscriptionSettings(tournamentId, req.body);
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Listar todas as inscrições de atletas para um torneio
router.get("/:id/athlete-subscriptions", async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const subs = await getAthleteSubscriptions(tournamentId);
    res.json(subs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Listar todas as inscrições de atletas para um torneio por instituição
router.get("/:id/athlete-subscriptions/institution/:instId", async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const instId = req.params.instId;
    const subs = await getAthleteSubscriptions(tournamentId, instId);

    const supabase = getSupabaseAdmin();
    const settings = await getSubscriptionSettings(tournamentId);
    
    if (settings?.requireMembership && subs && subs.length > 0) {
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('owner_id, start_date')
        .eq('id', tournamentId)
        .maybeSingle();

      if (tournament) {
        const year = new Date(tournament.start_date).getFullYear();
        const documents = subs.map((s: any) => s.document || s.documentNumber).filter(Boolean);

        if (documents.length > 0) {
          // Localizar membros correspondentes
          const { data: members } = await supabase
            .from('members')
            .select('id, document_number')
            .in('document_number', documents);

          if (members && members.length > 0) {
            const memberIds = members.map(m => m.id);
            // Localizar memberships ativas
            const { data: memberships } = await supabase
              .from('memberships')
              .select('member_id, status, payment_status')
              .eq('organization_id', tournament.owner_id)
              .eq('year', year)
              .eq('status', 'active')
              .eq('payment_status', 'paid')
              .in('member_id', memberIds);

            const activeMemberIds = new Set(memberships?.map(m => m.member_id) || []);
            const docToMemberMap = new Map(members.map(m => [m.document_number, m.id]));

            subs.forEach((s: any) => {
              const doc = s.document || s.documentNumber;
              const mId = docToMemberMap.get(doc);
              s.isMembershipPaid = mId ? activeMemberIds.has(mId) : false;
            });
          } else {
            subs.forEach((s: any) => { s.isMembershipPaid = false; });
          }
        } else {
          subs.forEach((s: any) => { s.isMembershipPaid = false; });
        }
      } else {
        subs.forEach((s: any) => { s.isMembershipPaid = true; });
      }
    } else {
      subs.forEach((s: any) => { s.isMembershipPaid = true; });
    }

    res.json(subs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Adicionar/Atualizar atletas pré-autorizados (pela instituição)
// Adicionar/Atualizar atletas pré-autorizados (pela instituição)
router.post("/:id/athlete-subscriptions", async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const { institutionId, categoryId, athletes, sync } = req.body;
    
    if (!institutionId || !categoryId || !Array.isArray(athletes)) {
      return res.status(400).json({ error: "Parâmetros inválidos" });
    }
    
    const settings = await getSubscriptionSettings(tournamentId);
    const newSubs: any[] = [];
    
    try {
      const supabase = getSupabaseAdmin();

      // Sincronizar exclusões de inscrições desmarcadas se a flag sync estiver ativa
      if (sync) {
        const payloadDocuments = athletes.map((a: any) => a.document).filter(Boolean);
        
        // Buscar todas as inscrições ativas para esta instituição nesta categoria
        const { data: currentSubs } = await supabase
          .from('athlete_subscriptions')
          .select('id, document')
          .eq('tournament_id', tournamentId)
          .eq('category_id', categoryId)
          .eq('institution_id', institutionId);

        const subsToDelete = (currentSubs || []).filter(cs => !payloadDocuments.includes(cs.document));

        if (subsToDelete.length > 0) {
          const deleteDocs = subsToDelete.map(s => s.document);
          
          // 1. Deletar da tabela athlete_subscriptions
          await supabase
            .from('athlete_subscriptions')
            .delete()
            .eq('tournament_id', tournamentId)
            .eq('category_id', categoryId)
            .eq('institution_id', institutionId)
            .in('document', deleteDocs);

          // 2. Deletar da tabela team_members se houver time associado
          const { data: team } = await supabase
            .from('team_registrations')
            .select('id')
            .eq('tournament_id', tournamentId)
            .eq('tournament_category_id', categoryId)
            .eq('institution_id', institutionId)
            .maybeSingle();

          if (team) {
            const { data: dbMembers } = await supabase
              .from('members')
              .select('id')
              .eq('institution_id', institutionId)
              .in('document_number', deleteDocs);

            if (dbMembers && dbMembers.length > 0) {
              const memberIdsToDelete = dbMembers.map(m => m.id);
              await supabase
                .from('team_members')
                .delete()
                .eq('team_id', team.id)
                .in('athlete_id', memberIdsToDelete);
            }
          }
        }
      }

      // Ver se a tabela existe
      const { data: existing, error } = await supabase
        .from('athlete_subscriptions')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('category_id', categoryId);
        
      if (!error && existing) {
        const inserts: any[] = [];
        const returned: any[] = [];
        
        for (const a of athletes) {
          const found = existing.find(e => e.document === a.document);
          if (found) {
            // Se já existe, atualiza as informações adicionais (subdivisão de combate, etc.)
            const { data: updated, error: updateErr } = await supabase
              .from('athlete_subscriptions')
              .update({
                athlete_name: a.name,
                birth_date: a.birthDate || null,
                gender: a.gender || "Masculino",
                additional_data: a.additionalData || {}
              })
              .eq('id', found.id)
              .select('*')
              .maybeSingle();
              
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
          const { data: inserted, error: insertErr } = await supabase
            .from('athlete_subscriptions')
            .insert(inserts)
            .select('*');
            
          if (insertErr) {
            throw insertErr;
          }
          if (inserted) {
            inserted.forEach(i => returned.push(mapSubToFrontend(i)));
          }
        }
        
        return res.json(returned);
      }
    } catch (dbErr: any) {
      console.warn("Using JSON fallback for adding athlete subscriptions", dbErr.message);
    }

    // Fallback to local JSON
    const db = loadDb();
    
    if (sync) {
      const payloadDocs = new Set(athletes.map((a: any) => a.document).filter(Boolean));
      db.athleteSubscriptions = db.athleteSubscriptions.filter(s => {
        if (s.tournamentId === tournamentId && s.categoryId === categoryId && s.institutionId === institutionId) {
          return payloadDocs.has(s.document);
        }
        return true;
      });
    }

    athletes.forEach(a => {
      const idx = db.athleteSubscriptions.findIndex(s => s.tournamentId === tournamentId && s.document === a.document && s.categoryId === categoryId);
      if (idx !== -1) {
        db.athleteSubscriptions[idx].athleteName = a.name;
        db.athleteSubscriptions[idx].birthDate = a.birthDate;
        db.athleteSubscriptions[idx].gender = a.gender || "Masculino";
        db.athleteSubscriptions[idx].additionalData = a.additionalData || {};
        newSubs.push(db.athleteSubscriptions[idx]);
        return;
      }
      
      const sub: any = {
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Remover atleta pré-autorizado
router.delete("/:id/athlete-subscriptions/:subId", async (req, res) => {
  try {
    const { subId } = req.params;
    
    try {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from('athlete_subscriptions')
        .delete()
        .eq('id', subId);
        
      if (!error) {
        return res.status(204).send();
      }
    } catch (dbErr: any) {
      console.warn("Using JSON fallback for deleting athlete subscription", dbErr.message);
    }

    const db = loadDb();
    db.athleteSubscriptions = db.athleteSubscriptions.filter(s => s.id !== subId);
    saveDb(db);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar o status de pagamento de uma inscrição de atleta pelo organizador
router.patch("/:id/athlete-subscriptions/:subId/payment", async (req, res) => {
  const { paymentStatus } = req.body;
  const { subId } = req.params;
  let updated: any = null;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('athlete_subscriptions')
      .update({ payment_status: paymentStatus })
      .eq('id', subId)
      .select('*')
      .maybeSingle();

    if (!error && data) {
      updated = mapSubToFrontend(data);
    }
  } catch (err: any) {
    console.warn("Using JSON fallback for update athlete payment status", err.message);
  }

  if (!updated) {
    const db = loadDb();
    const index = db.athleteSubscriptions.findIndex(s => s.id === subId);
    if (index !== -1) {
      db.athleteSubscriptions[index].paymentStatus = paymentStatus || "pending";
      saveDb(db);
      updated = db.athleteSubscriptions[index];
    }
  }

  if (updated) {
    res.json(updated);
  } else {
    res.status(404).json({ error: "Inscrição não encontrada" });
  }
});


// Endpoint público para obter dados de uma inscrição individual
router.get("/public/athlete-subscription/:subId", async (req, res) => {
  try {
    const { subId } = req.params;
    let sub: any = null;
    
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('athlete_subscriptions')
        .select('*')
        .eq('id', subId)
        .maybeSingle();
        
      if (!error && data) {
        sub = mapSubToFrontend(data);
      }
    } catch (dbErr: any) {
      console.warn("Using JSON fallback for public info select", dbErr.message);
    }

    if (!sub) {
      const db = loadDb();
      sub = db.athleteSubscriptions.find(s => s.id === subId);
    }
    
    if (!sub) {
      return res.status(404).json({ error: "Inscrição não encontrada ou encerrada" });
    }
    
    const supabase = getSupabaseAdmin();
    // Obter dados adicionais em paralelo
    const [tRes, instRes, catRes] = await Promise.all([
      supabase.from('tournaments').select('name, start_date, owner_id').eq('id', sub.tournamentId).single(),
      supabase.from('institutions').select('name, logo_url').eq('id', sub.institutionId).single(),
      supabase.from('tournament_categories').select('name, gender').eq('id', sub.categoryId).maybeSingle()
    ]);
    
    const settings = await getSubscriptionSettings(sub.tournamentId);
    
    // Verificar status da filiação se exigida
    let membershipStatus = "active"; // Padrão se não exigido
    let organizationData: any = null;
    
    if (tRes.data?.owner_id) {
      try {
        const { data: org } = await supabase
          .from('organizations')
          .select('name, requires_membership_fee, membership_fee_amount')
          .eq('id', tRes.data.owner_id)
          .maybeSingle();
        organizationData = org;
      } catch (err: any) {
        console.warn("Erro ao buscar organização:", err.message);
      }
    }

    if (settings?.requireMembership && tRes.data) {
      membershipStatus = "pending";
      try {
        const { data: member } = await supabase
          .from('members')
          .select('id')
          .eq('document_number', sub.document)
          .maybeSingle();

        if (member) {
          const year = new Date(tRes.data.start_date).getFullYear();
          const { data: ms } = await supabase
            .from('memberships')
            .select('status, payment_status')
            .eq('member_id', member.id)
            .eq('organization_id', tRes.data.owner_id)
            .eq('year', year)
            .maybeSingle();

          if (ms && ms.status === 'active' && ms.payment_status === 'paid') {
            membershipStatus = 'active';
          }
        }
      } catch (err: any) {
        console.warn("Erro ao checar filiação na inscrição pública (fallback ativo):", err.message);
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint público para concluir inscrição pelo atleta/responsável
router.post("/public/athlete-subscription/:subId/complete", async (req, res) => {
  try {
    const { subId } = req.params;
    const { parentName, parentPhone, parentEmail, parentPassword, additionalData, documentUrl, photoUrl, authorizedImageUse, liabilityWaiver, paymentStatus } = req.body;
    let completed: any = null;

    // Se parentEmail e parentPassword forem fornecidos, cria a conta de portal (guardian)
    if (parentEmail && parentPassword) {
      try {
        const hashedPassword = await bcrypt.hash(parentPassword, 10);
        const emailLower = parentEmail.toLowerCase().trim();
        
        // 1. Carregar contas locais
        let localAccounts: any[] = [];
        if (fs.existsSync(ACCOUNTS_FILE)) {
          try {
            localAccounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
          } catch (e) {
            console.error("Erro ao carregar contas locais para registrar responsável:", e);
          }
        }

        // 2. Verificar se o e-mail já existe
        const emailExists = localAccounts.find((a) => a.email.toLowerCase() === emailLower);
        if (!emailExists) {
          const accountId = `acc_${Math.random().toString(36).substring(2, 11)}`;
          const newAccount = {
            id: accountId,
            email: emailLower,
            passwordHash: hashedPassword,
            role: "guardian",
            name: parentName || "Responsável",
            createdAt: new Date().toISOString(),
          };

          // Salvar localmente
          localAccounts.push(newAccount);
          const dir = path.dirname(ACCOUNTS_FILE);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(localAccounts, null, 2));

          // Sincronizar com Supabase
          try {
            const supabase = getSupabaseAdmin();
            const { error: testError } = await supabase.from("portal_accounts").select("id").limit(1);
            if (!testError) {
              await supabase.from("portal_accounts").insert([{
                id: accountId,
                email: emailLower,
                password_hash: hashedPassword,
                role: "guardian",
                name: parentName || "Responsável",
                created_at: new Date().toISOString()
              }]);
            }
          } catch (sbErr) {
            console.error("Erro ao sincronizar nova conta de responsável com Supabase:", sbErr);
          }
        }
      } catch (err) {
        console.error("Erro ao criar conta de responsável durante inscrição do atleta:", err);
      }
    }
    
    try {
      const supabase = getSupabaseAdmin();
      
      // Obter dados da inscrição antes de atualizar
      const { data: subData } = await supabase
        .from('athlete_subscriptions')
        .select('*')
        .eq('id', subId)
        .maybeSingle();

      // Se exigir anuidade/filiação, criar o membro e filiação correspondente
      if (subData) {
        const settings = await getSubscriptionSettings(subData.tournament_id);
        const { data: tData } = await supabase
          .from('tournaments')
          .select('owner_id, start_date')
          .eq('id', subData.tournament_id)
          .maybeSingle();

        if (settings?.requireMembership && tData) {
          // Localizar ou criar atleta na tabela 'members' com status pendente
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
                payment_id: `public_checkout_${subId}`,
                paid_at: new Date().toISOString()
              }, {
                onConflict: "organization_id,member_id,year"
              });
          }
        }
      }

      const { data, error } = await supabase
        .from('athlete_subscriptions')
        .update({
          is_completed: true,
          parent_name: parentName,
          parent_phone: parentPhone,
          additional_data: additionalData,
          document_url: documentUrl,
          photo_url: photoUrl,
          authorized_image_use: authorizedImageUse,
          liability_waiver: liabilityWaiver,
          payment_status: paymentStatus
        })
        .eq('id', subId)
        .select('*')
        .maybeSingle();
        
      if (!error && data) {
        completed = mapSubToFrontend(data);
      }
    } catch (dbErr: any) {
      console.warn("Using JSON fallback for complete registration", dbErr.message);
    }

    if (!completed) {
      const db = loadDb();
      const index = db.athleteSubscriptions.findIndex(s => s.id === subId);
      
      if (index === -1) {
        return res.status(404).json({ error: "Inscrição não encontrada" });
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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

// Endpoint público para iniciar/processar pagamento da inscrição e filiação do atleta
router.post("/public/athlete-subscription/:subId/pay", async (req, res) => {
  const { subId } = req.params;
  const { method, cardToken, parentName, parentPhone, simulateSuccess } = req.body;

  if (!method) {
    return res.status(400).json({ error: "Método de pagamento não especificado." });
  }

  try {
    const supabase = getSupabaseAdmin();
    
    // 1. Obter os dados da inscrição
    let sub: any = null;
    const { data: dbSub, error: dbErr } = await supabase
      .from('athlete_subscriptions')
      .select('*')
      .eq('id', subId)
      .maybeSingle();

    if (!dbErr && dbSub) {
      sub = mapSubToFrontend(dbSub);
    } else {
      const db = loadDb();
      sub = db.athleteSubscriptions.find(s => s.id === subId);
    }

    if (!sub) {
      return res.status(404).json({ error: "Inscrição não encontrada." });
    }

    if (sub.paymentStatus === "paid") {
      return res.status(400).json({ error: "Esta inscrição já foi paga." });
    }

    // 2. Buscar configurações do torneio e da organização
    const { data: tData } = await supabase
      .from('tournaments')
      .select('name, owner_id, start_date')
      .eq('id', sub.tournamentId)
      .single();

    const settings = await getSubscriptionSettings(sub.tournamentId);

    // Calcular valores das taxas
    const athleteFee = settings?.feeType === "by_team_and_athlete_parent" ? (settings.athleteFee || 0) : 0;
    
    let membershipFee = 0;
    let membershipStatus = "active";
    let orgName = "Liga";
    if (settings?.requireMembership && tData) {
      membershipStatus = "pending";
      const { data: org } = await supabase
        .from('organizations')
        .select('name, requires_membership_fee, membership_fee_amount')
        .eq('id', tData.owner_id)
        .maybeSingle();

      orgName = org?.name || "Liga";
      membershipFee = org?.membership_fee_amount || 50;

      // Verificar se o atleta já é filiado/ativo
      const { data: member } = await supabase
        .from('members')
        .select('id')
        .eq('document_number', sub.document)
        .maybeSingle();

      if (member) {
        const year = new Date(tData.start_date).getFullYear();
        const { data: ms } = await supabase
          .from('memberships')
          .select('status, payment_status')
          .eq('member_id', member.id)
          .eq('organization_id', tData.owner_id)
          .eq('year', year)
          .maybeSingle();

        if (ms && ms.status === 'active' && ms.payment_status === 'paid') {
          membershipStatus = 'active';
          membershipFee = 0; // Não precisa cobrar anuidade se já é ativo e pago!
        }
      }
    }

    const totalAmount = athleteFee + membershipFee;
    if (totalAmount <= 0) {
      // Se não há taxa a ser paga, marcamos como pago e concluímos
      await updateSubscriptionPaymentStatus(subId, "paid", sub);
      return res.json({ success: true, method, paid: true });
    }

    const hasSecretKey = !!process.env.PAGARME_SECRET_KEY;

    // Se o cliente solicita confirmação simulada
    if (simulateSuccess) {
      await updateSubscriptionPaymentStatus(subId, "paid", sub, tData, settings);
      return res.json({ success: true, method, paid: true });
    }

    // Se não há chaves do Pagar.me configuradas, simulamos o sucesso (Sandbox fallback)
    if (!hasSecretKey) {
      console.warn("PAGARME_SECRET_KEY não detectada. Executando pagamento individual em modo SIMULADO.");
      
      if (method === "pix") {
        return res.json({
          success: true,
          method: "pix",
          qrCode: `00020126360014br.gov.bcb.pix0114+55719914149135204000053039865407${totalAmount.toFixed(2)}5802BR5914QUEROCOMPETIR6009SALVADOR62070503***6304FC7D`,
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=mock-pix-payload-athlete-value`
        });
      }

      // No caso de cartão, confirmamos imediatamente no modo simulado
      await updateSubscriptionPaymentStatus(subId, "paid", sub, tData, settings);
      return res.json({ success: true, method: "card", paid: true });
    }

    // Fluxo Real Integrado ao Pagar.me v5
    const cleanDoc = (sub.document || "00000000000").replace(/\D/g, "");
    const docToUse = cleanDoc.length === 11 || cleanDoc.length === 14 ? cleanDoc : "00000000000";
    const customer = {
      name: parentName || sub.athleteName || "Responsável",
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
        description: `Inscrição Torneio - ${sub.athleteName}`,
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

      const pgOrder = await callPagarMe("/orders", "POST", orderPayload);
      const charge = pgOrder.charges?.[0];
      const transaction = charge?.last_transaction;

      // Salvar IDs de referência na subscription
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
        return res.status(400).json({ error: "Token do cartão não fornecido." });
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

      const pgOrder = await callPagarMe("/orders", "POST", orderPayload);
      const charge = pgOrder.charges?.[0];

      if (charge?.status === "paid") {
        // Salvar IDs de referência e atualizar status para pago
        const currentAdditional = sub.additionalData || {};
        const updatedAdditional = {
          ...currentAdditional,
          pagarmeOrderId: pgOrder.id,
          pagarmeChargeId: charge.id
        };

        // Salva e ativa o status pago
        await updateSubscriptionAdditionalData(sub.id, updatedAdditional, sub);
        await updateSubscriptionPaymentStatus(subId, "paid", sub, tData, settings);

        return res.json({ success: true, method: "card", paid: true });
      } else {
        return res.status(400).json({ error: `Pagamento via cartão não aprovado. Status: ${charge?.status || 'desconhecido'}` });
      }
    }

    res.status(400).json({ error: "Método de pagamento inválido." });
  } catch (err: any) {
    console.error("Erro na transação Pagar.me do atleta:", err);
    res.status(500).json({ error: err.message || "Erro desconhecido ao processar pagamento." });
  }
});

// Helper functions for athlete payment updates
async function updateSubscriptionAdditionalData(subId: string, additionalData: any, sub: any) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase
      .from('athlete_subscriptions')
      .update({ additional_data: additionalData })
      .eq('id', subId);
  } catch (dbErr) {
    console.warn("Using JSON fallback for saving payment IDs", dbErr);
  }
  // Local fallback updates
  const db = loadDb();
  const index = db.athleteSubscriptions.findIndex(s => s.id === subId);
  if (index !== -1) {
    db.athleteSubscriptions[index].additionalData = {
      ...(db.athleteSubscriptions[index].additionalData || {}),
      ...additionalData
    };
    saveDb(db);
  }
}

async function updateSubscriptionPaymentStatus(subId: string, status: 'pending' | 'paid', sub: any, tData?: any, settings?: any) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase
      .from('athlete_subscriptions')
      .update({ payment_status: status })
      .eq('id', subId);

    // Se exige anuidade/filiação, criar o membro e filiação correspondente como ativo e pago
    if (settings?.requireMembership && tData) {
      const { data: existingMember } = await supabase
        .from('members')
        .select('id')
        .eq('document_number', sub.document)
        .maybeSingle();

      let athleteId = existingMember?.id;
      if (!athleteId) {
        const { data: newMember } = await supabase
          .from('members')
          .insert([{
            institution_id: sub.institutionId,
            full_name: sub.athleteName,
            document_number: sub.document,
            birth_date: sub.birthDate,
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
            payment_id: `pagarme_athlete_checkout_${subId}`,
            paid_at: new Date().toISOString()
          }, {
            onConflict: "organization_id,member_id,year"
          });
      }
    }
  } catch (dbErr) {
    console.warn("Using JSON fallback for payment status activation", dbErr);
  }
  // Local fallback updates
  const db = loadDb();
  const index = db.athleteSubscriptions.findIndex(s => s.id === subId);
  if (index !== -1) {
    db.athleteSubscriptions[index].paymentStatus = status;
    saveDb(db);
  }
}

// Validar/Aprovar inscrição de atleta pelo organizador com sincronização no banco original
router.post("/:id/athlete-subscriptions/:subId/validate", async (req, res) => {
  try {
    const { subId, id: tournamentId } = req.params;
    const { validationStatus, validationFeedback } = req.body;
    let sub: any = null;
    const validatedAt = new Date().toISOString();
    
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('athlete_subscriptions')
        .update({
          validation_status: validationStatus || "approved",
          validation_feedback: validationFeedback || null,
          validated_at: validatedAt
        })
        .eq('id', subId)
        .select('*')
        .maybeSingle();
        
      if (!error && data) {
        sub = mapSubToFrontend(data);
      }
    } catch (dbErr: any) {
      console.warn("Using JSON fallback for validate registration", dbErr.message);
    }

    if (!sub) {
      const db = loadDb();
      const index = db.athleteSubscriptions.findIndex(s => s.id === subId);
      if (index === -1) {
        return res.status(404).json({ error: "Inscrição não encontrada" });
      }
      
      db.athleteSubscriptions[index].validationStatus = validationStatus || "approved";
      db.athleteSubscriptions[index].validationFeedback = validationFeedback || null;
      db.athleteSubscriptions[index].validatedAt = validatedAt;
      sub = db.athleteSubscriptions[index];
      saveDb(db);
    }
    
    if (validationStatus === "approved" && sub) {
      const supabase = getSupabaseAdmin();
      
      // 1. Inserir ou recuperar atleta na tabela 'members'
      const { data: existingMember } = await supabase
        .from('members')
        .select('id')
        .eq('institution_id', sub.institutionId)
        .eq('document_number', sub.document)
        .maybeSingle();
        
      let athleteId = existingMember?.id;
      
      if (!athleteId) {
        const { data: newMember, error: insertError } = await supabase
          .from('members')
          .insert([{
            institution_id: sub.institutionId,
            full_name: sub.athleteName,
            document_number: sub.document,
            birth_date: sub.birthDate,
            status: "authorized"
          }])
          .select('id')
          .single();
          
        if (insertError) {
          console.error("Erro ao sincronizar atleta em 'members':", insertError);
        } else {
          athleteId = newMember.id;
        }
      }
      
      // 2. Vincular atleta ao time na tabela 'team_members'
      if (athleteId) {
        // Encontrar ou criar o time correspondente à instituição e categoria de combate
        let { data: team, error: teamFindError } = await supabase
          .from('team_registrations')
          .select('id')
          .eq('tournament_id', sub.tournamentId)
          .eq('tournament_category_id', sub.categoryId)
          .eq('institution_id', sub.institutionId)
          .maybeSingle();

        let teamId = team?.id;

        if (!teamId) {
          const { data: newTeam, error: newTeamError } = await supabase
            .from('team_registrations')
            .insert([{
              tournament_id: sub.tournamentId,
              tournament_category_id: sub.categoryId,
              institution_id: sub.institutionId,
              availability: []
            }])
            .select('id')
            .maybeSingle();

          if (!newTeamError && newTeam) {
            teamId = newTeam.id;
          } else {
            console.error("Erro ao criar team_registrations na validação:", newTeamError);
          }
        }
          
        if (teamId) {
          const { error: linkError } = await supabase
            .from('team_members')
            .insert([{
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- GERADOR INTELIGENTE DE TABELAS E PREVENÇÃO DE CONFLITOS ---
router.get("/:id/team-members-all", async (req, res) => {
  const { id: tournamentId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    // Buscar todos os times
    const { data: teams, error: teamsError } = await supabase
      .from('team_registrations')
      .select('id, availability, tournament_category_id, institution_id')
      .eq('tournament_id', tournamentId);
    
    if (teamsError) throw teamsError;

    const teamIds = (teams || []).map(t => t.id);
    const { data: teamMembers, error: membersError } = teamIds.length > 0 
      ? await supabase.from('team_members').select('team_id, athlete_id').in('team_id', teamIds)
      : { data: [], error: null };
    
    if (membersError) throw membersError;

    const teamAthleteMap: { [teamId: string]: string[] } = {};
    (teamMembers || []).forEach(m => {
      if (!teamAthleteMap[m.team_id]) {
        teamAthleteMap[m.team_id] = [];
      }
      teamAthleteMap[m.team_id].push(m.athlete_id);
    });

    res.json(teamAthleteMap);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/auto-schedule", async (req, res) => {
  const { id: tournamentId } = req.params;
  const { 
    startDate,
    endDate,
    matchDuration = 60, 
    dailyStartTime = "08:00", 
    dailyEndTime = "20:00", 
    onlyUnscheduled = true,
    selectedVenues = []
  } = req.body;

  try {
    const supabase = getSupabaseAdmin();

    // 1. Buscar partidas do torneio
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('id, team1_id, team2_id, scheduled_time, venue_id, court, tournament_category_id, round, match_index')
      .eq('tournament_id', tournamentId);

    if (matchesError) throw matchesError;

    // 2. Buscar sedes cadastradas ou filtradas
    let venueQuery = supabase.from('venues').select('*');
    if (selectedVenues.length > 0) {
      venueQuery = venueQuery.in('id', selectedVenues);
    }
    const { data: venues, error: venuesError } = await venueQuery;
    if (venuesError) throw venuesError;

    if (!venues || venues.length === 0) {
      return res.status(400).json({ error: "Nenhuma sede/local disponível para agendamento automático." });
    }

    // Mapear quadras/mesas de cada sede
    const resources: { venueId: string; courtName: string }[] = [];
    venues.forEach(v => {
      let courtList = ["Principal"];
      if (Array.isArray(v.courts) && v.courts.length > 0) {
        courtList = v.courts;
      } else if (v.courts_count && typeof v.courts_count === 'number') {
        courtList = Array.from({ length: v.courts_count }, (_, idx) => `Quadra ${idx + 1}`);
      } else if (v.courts_json && Array.isArray(v.courts_json)) {
        courtList = v.courts_json;
      }
      courtList.forEach(c => {
        resources.push({ venueId: v.id, courtName: c });
      });
    });

    if (resources.length === 0) {
      return res.status(400).json({ error: "Nenhuma quadra disponível para agendamento automático." });
    }

    // 3. Buscar inscrições de times e membros (para cruzar atletas em comum e evitar conflito)
    const { data: teams, error: teamsError } = await supabase
      .from('team_registrations')
      .select('id, availability, tournament_category_id, institution_id')
      .eq('tournament_id', tournamentId);
    
    if (teamsError) throw teamsError;

    const teamIds = (teams || []).map(t => t.id);
    const { data: teamMembers, error: membersError } = teamIds.length > 0 
      ? await supabase.from('team_members').select('team_id, athlete_id').in('team_id', teamIds)
      : { data: [], error: null };
    
    if (membersError) throw membersError;

    const teamAthleteMap: { [teamId: string]: string[] } = {};
    (teamMembers || []).forEach(m => {
      if (!teamAthleteMap[m.team_id]) {
        teamAthleteMap[m.team_id] = [];
      }
      teamAthleteMap[m.team_id].push(m.athlete_id);
    });

    const teamInstitutionMap: { [teamId: string]: string } = {};
    (teams || []).forEach(t => {
      teamInstitutionMap[t.id] = t.institution_id;
    });

    // Filtrar jogos para agendar
    let matchesToSchedule = (matches || []).filter(m => {
      const hasTeams = m.team1_id && m.team2_id;
      if (!hasTeams) return false;

      if (onlyUnscheduled) {
        return !m.scheduled_time || !m.venue_id;
      }
      return true;
    });

    // Ordenar rodadas inferiores primeiro (as primeiras acontecem antes!)
    matchesToSchedule.sort((a,b) => {
      if (a.round !== b.round) return a.round - b.round;
      return a.match_index - b.match_index;
    });

    // Programar grade atual de jogos ativos
    const activeSchedule: {
      matchId: string;
      team1Id: string;
      team2Id: string;
      scheduledTime: string;
      venueId: string;
      court: string;
    }[] = (matches || [])
      .filter(m => m.scheduled_time && m.venue_id && m.team1_id && m.team2_id)
      .map(m => ({
        matchId: m.id,
        team1Id: m.team1_id!,
        team2Id: m.team2_id!,
        scheduledTime: m.scheduled_time!,
        venueId: m.venue_id!,
        court: m.court || "Principal"
      }));

    if (onlyUnscheduled === false) {
      activeSchedule.length = 0;
    }

    // Auxiliar de criação de datas e horários de jogo (gerar slots)
    const createTimeSlots = (startD: string, endD: string) => {
      const slots: string[] = [];
      let currentDate = new Date(startD + "T00:00:00");
      let limitDate = endD ? new Date(endD + "T23:59:59") : new Date(new Date(startD + "T00:00:00").getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days max if not provided
      
      const [startH, startM] = dailyStartTime.split(':').map(Number);
      const [endH, endM] = dailyEndTime.split(':').map(Number);
      
      let dayOffset = 0;
      while (true) {
        const loopDate = new Date(currentDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        if (loopDate > limitDate) break;
        
        const dateStr = loopDate.toISOString().split('T')[0];
        
        let currentHour = startH;
        let currentMinute = startM;
        const endMinutes = endH * 60 + endM;

        while (currentHour * 60 + currentMinute + matchDuration <= endMinutes) {
          const hh = String(currentHour).padStart(2, '0');
          const mm = String(currentMinute).padStart(2, '0');
          slots.push(`${dateStr}T${hh}:${mm}`);
          
          currentMinute += matchDuration;
          if (currentMinute >= 60) {
            currentHour += Math.floor(currentMinute / 60);
            currentMinute = currentMinute % 60;
          }
        }
        dayOffset++;
        if (dayOffset > 365) break; // failsafe
      }
      return slots;
    };

    const slots = createTimeSlots(startDate, endDate || startDate);

    const parseHelper = (timeStr: string) => {
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

    const isOverlap = (timeStr1: string, timeStr2: string, durationMin: number) => {
      const t1 = parseHelper(timeStr1);
      const t2 = parseHelper(timeStr2);
      if (!t1 || !t2) return false;
      const diff = Math.abs(t1.getTime() - t2.getTime());
      return diff < durationMin * 60 * 1000;
    };

    let scheduledCount = 0;
    const updatesToSave: { id: string; scheduled_time: string; venue_id: string; court: string }[] = [];

    // Algoritmo de Escolha de Horário / Slot Sem Conflitos
    for (const match of matchesToSchedule) {
      const team1Id = match.team1_id!;
      const team2Id = match.team2_id!;
      
      const t1Athletes = teamAthleteMap[team1Id] || [];
      const t2Athletes = teamAthleteMap[team2Id] || [];
      const inst1 = teamInstitutionMap[team1Id];
      const inst2 = teamInstitutionMap[team2Id];

      const allMatchAthletes = new Set([...t1Athletes, ...t2Athletes]);

      let foundSlot = false;

      for (const slot of slots) {
        for (const resource of resources) {
          let hasConflict = false;

          for (const scheduled of activeSchedule) {
            // A. Conflito de quadra na mesma sede no mesmo horário
            if (scheduled.venueId === resource.venueId && scheduled.court === resource.courtName) {
              if (isOverlap(scheduled.scheduledTime, slot, matchDuration)) {
                hasConflict = true;
                break;
              }
            }

            // B. Conflito do mesmo time jogando simultaneamente
            if (scheduled.team1Id === team1Id || scheduled.team1Id === team2Id || 
                scheduled.team2Id === team1Id || scheduled.team2Id === team2Id) {
              if (isOverlap(scheduled.scheduledTime, slot, matchDuration)) {
                hasConflict = true;
                break;
              }
            }

            // C. Conflito de atleta jogando por múltiplos times ao mesmo tempo
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
            // Validar disponibilidade regular do time (se houver cadastrada)
            const getDayHelper = (date: Date) => {
              const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
              return days[date.getDay()];
            };

            const checkTeamAvail = (teamId: string, slotTime: string) => {
              const team = teams?.find(t => t.id === teamId);
              if (!team || !team.availability || team.availability.length === 0) return true;
              
              const mDate = parseHelper(slotTime);
              if (!mDate) return true;
              
              const dayStr = getDayHelper(mDate);
              const mHour = mDate.getHours();
              const mMin = mDate.getMinutes();

              const isUnavailableDate = team.availability.some((av: any) => av.type === 'unavailable' && av.date === slotTime.split('T')[0]);
              if (isUnavailableDate) return false;

              const regularAvails = team.availability.filter((a:any) => a.type !== 'unavailable');
              if (regularAvails.length === 0) return true;

              return regularAvails.some((av: any) => {
                const isDayMatch = av.day === dayStr;
                if (!isDayMatch) return false;
                const [startH, startM] = av.start.split(':').map(Number);
                const [endH, endM] = av.end.split(':').map(Number);
                const timeVal = mHour * 60 + mMin;
                return timeVal >= (startH * 60 + startM) && timeVal <= (endH * 60 + endM);
              });
            };

            const t1Ok = checkTeamAvail(team1Id, slot);
            const t2Ok = checkTeamAvail(team2Id, slot);

            if (t1Ok && t2Ok) {
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

    // Salvar as alterações em lote
    if (updatesToSave.length > 0) {
      for (const update of updatesToSave) {
        const { id, scheduled_time, venue_id, court } = update;
        await supabase
          .from('matches')
          .update({
            scheduled_time,
            venue_id,
            court
          })
          .eq('id', id);
      }
    }

    res.json({
      success: true,
      message: `Tabelas geradas com sucesso! ${scheduledCount} partidas foram agendadas prevenindo conflitos de sedes e atletas simultâneos.`,
      scheduledCount,
      totalUnscheduledLeft: matchesToSchedule.length - scheduledCount
    });

  } catch (error: any) {
    console.error("[AutoSchedule Error]:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- TOURNAMENT COMMUNITY POSTS API (HYBRID PERSISTENCE WITH FILESYSTEM FALLBACK) ---
const COMMUNITY_POSTS_FILE = path.join(process.cwd(), "src", "backend", "data", "tournament_posts.json");

function ensureCommunityFile() {
  const dir = path.dirname(COMMUNITY_POSTS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(COMMUNITY_POSTS_FILE)) {
    fs.writeFileSync(COMMUNITY_POSTS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

function loadPostsFromFallback(): any[] {
  ensureCommunityFile();
  try {
    return JSON.parse(fs.readFileSync(COMMUNITY_POSTS_FILE, "utf-8"));
  } catch (e) {
    return [];
  }
}

function savePostsToFallback(posts: any[]) {
  ensureCommunityFile();
  try {
    fs.writeFileSync(COMMUNITY_POSTS_FILE, JSON.stringify(posts, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving fallback community posts:", e);
  }
}

// 1. Listar posts para um torneio
router.get("/:id/posts", async (req, res) => {
  const tournamentId = req.params.id;
  const showAll = req.query.all === "true";
  try {
    const supabase = getSupabaseAdmin();
    // Tentar buscar do Supabase primeiro
    const { data, error } = await supabase
      .from('tournament_posts')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false });

    if (error) {
      // Se der erro de relação (tabela não existe), cai no fallback JSON
      if (error.message.includes('relation') || error.message.includes('not found') || error.message.includes('does not exist')) {
        let fallback = loadPostsFromFallback().filter(p => p.tournamentId === tournamentId);
        if (!showAll) {
          fallback = fallback.filter(p => !p.reactions?.is_pending);
        }
        fallback.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return res.json(fallback);
      }
      throw error;
    }
    
    // Converter de volta para formato consistente
    let formatted = data.map(d => ({
      id: d.id,
      tournamentId: d.tournament_id,
      authorType: d.author_type,
      authorName: d.author_name,
      authorAvatar: d.author_avatar,
      content: d.content,
      mediaUrl: d.media_url,
      mediaType: d.media_type || 'none',
      createdAt: d.created_at,
      reactions: d.reactions || { like: 0, love: 0, applause: 0 },
      comments: d.comments || []
    }));

    if (!showAll) {
      formatted = formatted.filter(p => !p.reactions?.is_pending);
    }
    res.json(formatted);
  } catch (err: any) {
    // Normal fallback when Supabase table is not provisioned yet
    let fallback = loadPostsFromFallback().filter(p => p.tournamentId === tournamentId);
    if (!showAll) {
      fallback = fallback.filter(p => !p.reactions?.is_pending);
    }
    fallback.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(fallback);
  }
});

// 2. Criar novo post
router.post("/:id/posts", async (req, res) => {
  const tournamentId = req.params.id;
  const { authorType, authorName, authorAvatar, content, mediaUrl, mediaType, isPending } = req.body;

  if (!content && !mediaUrl) {
    return res.status(400).json({ error: "É necessário inserir texto ou mídia para criar uma postagem." });
  }

  const reactionsObj = { like: 0, love: 0, applause: 0, is_pending: isPending === true };

  const newPost = {
    id: "post_" + Math.random().toString(36).substring(2, 11),
    tournamentId,
    authorType: authorType || 'guest',
    authorName: authorName || 'Anônimo',
    authorAvatar: authorAvatar || '',
    content: content || '',
    mediaUrl: mediaUrl || '',
    mediaType: mediaType || 'none',
    createdAt: new Date().toISOString(),
    reactions: reactionsObj,
    comments: []
  };

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('tournament_posts')
      .insert([{
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
      }])
      .select();

    if (error) {
      if (error.message.includes('relation') || error.message.includes('not found') || error.message.includes('does not exist')) {
        const dbFallback = loadPostsFromFallback();
        dbFallback.push(newPost);
        savePostsToFallback(dbFallback);
        return res.status(201).json(newPost);
      }
      throw error;
    }

    res.status(201).json(newPost);
  } catch (err: any) {
    // Normal fallback when Supabase table is not provisioned yet
    const dbFallback = loadPostsFromFallback();
    dbFallback.push(newPost);
    savePostsToFallback(dbFallback);
    res.status(201).json(newPost);
  }
});

// 3. Reagir a uma postagem
router.post("/:id/posts/:postId/react", async (req, res) => {
  const { postId } = req.params;
  const { type } = req.body; // 'like', 'love' ou 'applause'

  if (!['like', 'love', 'applause'].includes(type)) {
    return res.status(400).json({ error: "Reação inválida" });
  }

  try {
    const supabase = getSupabaseAdmin();
    // Tentar carregar do Supabase primeiro
    const { data: existing, error: getError } = await supabase
      .from('tournament_posts')
      .select('*')
      .eq('id', postId)
      .maybeSingle();

    if (getError || !existing) {
      if (getError && !getError.message.includes('relation')) throw getError;
      
      // Fallback
      const dbFallback = loadPostsFromFallback();
      const pIdx = dbFallback.findIndex(p => p.id === postId);
      if (pIdx !== -1) {
        if (!dbFallback[pIdx].reactions) dbFallback[pIdx].reactions = { like: 0, love: 0, applause: 0 };
        dbFallback[pIdx].reactions[type] = (dbFallback[pIdx].reactions[type] || 0) + 1;
        savePostsToFallback(dbFallback);
        return res.json(dbFallback[pIdx]);
      }
      return res.status(404).json({ error: "Post não encontrado" });
    }

    const currentReactions = existing.reactions || { like: 0, love: 0, applause: 0 };
    currentReactions[type] = (currentReactions[type] || 0) + 1;

    const { data: updated, error: updateError } = await supabase
      .from('tournament_posts')
      .update({ reactions: currentReactions })
      .eq('id', postId)
      .select()
      .single();

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

  } catch (err: any) {
    // Normal fallback when Supabase table is not provisioned yet
    const dbFallback = loadPostsFromFallback();
    const pIdx = dbFallback.findIndex(p => p.id === postId);
    if (pIdx !== -1) {
      if (!dbFallback[pIdx].reactions) dbFallback[pIdx].reactions = { like: 0, love: 0, applause: 0 };
      dbFallback[pIdx].reactions[type] = (dbFallback[pIdx].reactions[type] || 0) + 1;
      savePostsToFallback(dbFallback);
      return res.json(dbFallback[pIdx]);
    }
    res.status(404).json({ error: "Post não encontrado" });
  }
});

// 4. Comentar em uma postagem
router.post("/:id/posts/:postId/comments", async (req, res) => {
  const { postId } = req.params;
  const { authorName, content } = req.body;

  if (!content) {
    return res.status(400).json({ error: "Conteúdo do comentário é obrigatório." });
  }

  const newComment = {
    id: "comment_" + Math.random().toString(36).substring(2, 11),
    authorName: authorName || 'Comentarista',
    content,
    createdAt: new Date().toISOString()
  };

  try {
    const supabase = getSupabaseAdmin();
    const { data: existing, error: getError } = await supabase
      .from('tournament_posts')
      .select('*')
      .eq('id', postId)
      .maybeSingle();

    if (getError || !existing) {
      if (getError && !getError.message.includes('relation')) throw getError;
      
      // Fallback
      const dbFallback = loadPostsFromFallback();
      const pIdx = dbFallback.findIndex(p => p.id === postId);
      if (pIdx !== -1) {
        if (!dbFallback[pIdx].comments) dbFallback[pIdx].comments = [];
        dbFallback[pIdx].comments.push(newComment);
        savePostsToFallback(dbFallback);
        return res.json(dbFallback[pIdx]);
      }
      return res.status(404).json({ error: "Post não encontrado" });
    }

    const currentComments = existing.comments || [];
    currentComments.push(newComment);

    const { data: updated, error: updateError } = await supabase
      .from('tournament_posts')
      .update({ comments: currentComments })
      .eq('id', postId)
      .select()
      .single();

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

  } catch (err: any) {
    // Normal fallback when Supabase table is not provisioned yet
    const dbFallback = loadPostsFromFallback();
    const pIdx = dbFallback.findIndex(p => p.id === postId);
    if (pIdx !== -1) {
      if (!dbFallback[pIdx].comments) dbFallback[pIdx].comments = [];
      dbFallback[pIdx].comments.push(newComment);
      savePostsToFallback(dbFallback);
      return res.json(dbFallback[pIdx]);
    }
    res.status(404).json({ error: "Post não encontrado" });
  }
});

// 5. Excluir uma postagem
router.delete("/:id/posts/:postId", async (req, res) => {
  const { postId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('tournament_posts')
      .delete()
      .eq('id', postId);

    if (error) {
      if (error.message.includes('relation') || error.message.includes('not found') || error.message.includes('does not exist')) {
        const dbFallback = loadPostsFromFallback();
        const cleaned = dbFallback.filter(p => p.id !== postId);
        savePostsToFallback(cleaned);
        return res.status(204).send();
      }
      throw error;
    }
    res.status(204).send();
  } catch (err: any) {
    // Normal fallback when Supabase table is not provisioned yet
    const dbFallback = loadPostsFromFallback();
    const cleaned = dbFallback.filter(p => p.id !== postId);
    savePostsToFallback(cleaned);
    res.status(204).send();
  }
});

// 6. Aprovar uma postagem pendente de visitante
router.post("/:id/posts/:postId/approve", async (req, res) => {
  const { postId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    // Tentar carregar do Supabase primeiro
    const { data: existing, error: getError } = await supabase
      .from('tournament_posts')
      .select('*')
      .eq('id', postId)
      .maybeSingle();

    if (getError || !existing) {
      if (getError && !getError.message.includes('relation')) throw getError;
      
      // Fallback
      const dbFallback = loadPostsFromFallback();
      const pIdx = dbFallback.findIndex(p => p.id === postId);
      if (pIdx !== -1) {
        if (!dbFallback[pIdx].reactions) dbFallback[pIdx].reactions = { like: 0, love: 0, applause: 0 };
        dbFallback[pIdx].reactions.is_pending = false;
        savePostsToFallback(dbFallback);
        return res.json(dbFallback[pIdx]);
      }
      return res.status(404).json({ error: "Post não encontrado" });
    }

    const currentReactions = existing.reactions || { like: 0, love: 0, applause: 0 };
    currentReactions.is_pending = false;

    const { data: updated, error: updateError } = await supabase
      .from('tournament_posts')
      .update({ reactions: currentReactions })
      .eq('id', postId)
      .select()
      .single();

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
  } catch (err: any) {
    // Fallback JSON persistence
    const dbFallback = loadPostsFromFallback();
    const pIdx = dbFallback.findIndex(p => p.id === postId);
    if (pIdx !== -1) {
      if (!dbFallback[pIdx].reactions) dbFallback[pIdx].reactions = { like: 0, love: 0, applause: 0 };
      dbFallback[pIdx].reactions.is_pending = false;
      savePostsToFallback(dbFallback);
      return res.json(dbFallback[pIdx]);
    }
    res.status(404).json({ error: "Post não encontrado" });
  }
});

// ==========================================
// VISITORS & VENUE PORTAL ROUTES & HELPERS
// ==========================================

const VISITORS_FILE = path.join(process.cwd(), 'src/backend/data/match_visitors.json');

function loadLocalVisitors(): any[] {
  try {
    if (!fs.existsSync(VISITORS_FILE)) {
      return [];
    }
    return JSON.parse(fs.readFileSync(VISITORS_FILE, 'utf-8'));
  } catch (err) {
    console.error("Erro ao ler match_visitors.json", err);
    return [];
  }
}

function saveLocalVisitors(visitors: any[]) {
  try {
    const dir = path.dirname(VISITORS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(VISITORS_FILE, JSON.stringify(visitors, null, 2), 'utf-8');
  } catch (err) {
    console.error("Erro ao escrever match_visitors.json", err);
  }
}

async function getMatchVisitorsWithInheritance(
  matchId: string,
  athleteId: string,
  tournamentId: string,
  supabase: any,
  localVisitors?: any[]
): Promise<{ name: string; document: string; isInherited: boolean }[]> {
  let currentVisitors: any[] = [];
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('match_visitors')
        .select('name, document')
        .eq('match_id', matchId)
        .eq('athlete_id', athleteId);
      if (!error && data) currentVisitors = data;
    }
  } catch (err) {
    // ignore
  }

  const loadedLocals = localVisitors || loadLocalVisitors();
  if (currentVisitors.length === 0) {
    currentVisitors = loadedLocals
      .filter((v: any) => v.matchId === matchId && v.athleteId === athleteId)
      .map((v: any) => ({ name: v.name, document: v.document }));
  }

  if (currentVisitors.length > 0) {
    return currentVisitors.map(v => ({ name: v.name, document: v.document, isInherited: false }));
  }

  // Se a lista atual estiver vazia, herdar do jogo anterior no mesmo torneio
  let allMatches: any[] = [];
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('matches')
        .select('id, scheduled_time, team1_id, team2_id, round, match_index')
        .eq('tournament_id', tournamentId);
      if (!error && data) allMatches = data;
    }
  } catch (err) {
    // ignore
  }

  let athleteTeams: string[] = [];
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('athlete_id', athleteId);
      if (!error && data) athleteTeams = data.map((m: any) => m.team_id);
    }
  } catch (err) {
    // ignore
  }

  if (athleteTeams.length === 0) {
    return [];
  }

  const athleteMatches = allMatches.filter(m => 
    athleteTeams.includes(m.team1_id) || athleteTeams.includes(m.team2_id)
  );

  athleteMatches.sort((a, b) => {
    if (a.scheduled_time && b.scheduled_time) {
      return new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime();
    }
    if (a.round !== b.round) return a.round - b.round;
    return (a.match_index || 0) - (b.match_index || 0);
  });

  const currentIdx = athleteMatches.findIndex(m => m.id === matchId);
  if (currentIdx <= 0) {
    return [];
  }

  for (let i = currentIdx - 1; i >= 0; i--) {
    const prevMatch = athleteMatches[i];
    let prevVisitors: any[] = [];
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('match_visitors')
          .select('name, document')
          .eq('match_id', prevMatch.id)
          .eq('athlete_id', athleteId);
        if (!error && data) prevVisitors = data;
      }
    } catch (err) {
      // ignore
    }

    if (prevVisitors.length === 0) {
      prevVisitors = loadedLocals
        .filter((v: any) => v.matchId === prevMatch.id && v.athleteId === athleteId)
        .map((v: any) => ({ name: v.name, document: v.document }));
    }

    if (prevVisitors.length > 0) {
      return prevVisitors.map(v => ({ name: v.name, document: v.document, isInherited: true }));
    }
  }

  return [];
}

// 1. Obter informações de uma sede
router.get("/venues/:venueId", requireAuth, async (req, res) => {
  const { venueId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('venues')
      .select('*')
      .eq('id', venueId)
      .maybeSingle();

    if (error) throw error;
    
    if (!data) {
      // Offline / Fallback estático de semente se for o id estático do seed
      if (venueId === "venue-1") {
        return res.json({
          id: "venue-1",
          name: "Sede Central (Arena Olímpica)",
          address: "Av. das Olimpíadas, 1000 - Centro",
          availability: [
            { day: "Segunda", start: "08:00", end: "22:00" },
            { day: "Terça", start: "08:00", end: "22:00" },
            { day: "Quarta", start: "08:00", end: "22:00" },
            { day: "Quinta", start: "08:00", end: "22:00" },
            { day: "Sexta", start: "08:00", end: "22:00" },
            { day: "Sábado", start: "08:00", end: "18:00" }
          ]
        });
      }
      return res.status(404).json({ error: "Sede não encontrada" });
    }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Atualizar dados/disponibilidade da sede
router.put("/venues/:venueId", requireAuth, async (req, res) => {
  const { venueId } = req.params;
  const { name, address, availability } = req.body;
  try {
    const supabase = getSupabaseAdmin();
    
    if (venueId === "venue-1") {
      // Apenas retornar o mock salvo/enviado para fins offline
      return res.json({ id: venueId, name, address, availability });
    }

    const { data, error } = await supabase
      .from('venues')
      .update({ name, address, availability })
      .eq('id', venueId)
      .select()
      .maybeSingle();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Listar partidas e visitantes da sede
router.get("/venues/:venueId/matches-with-visitors", requireAuth, async (req, res) => {
  const { venueId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    
    // Obter partidas da sede
    let matchesQuery = supabase
      .from('matches')
      .select('id, tournament_id, tournament_category_id, team1_id, team2_id, scheduled_time, round, match_index, court');
    
    if (venueId !== "venue-1") {
      matchesQuery = matchesQuery.eq('venue_id', venueId);
    }
    
    const { data: matches, error: matchesErr } = await matchesQuery;
       
    if (matchesErr) {
      if (matchesErr.message.includes('relation') || matchesErr.message.includes('cache')) {
        return res.json([]);
      }
      throw matchesErr;
    }
    
    if (!matches || matches.length === 0) {
      return res.json([]);
    }
    
    const tournamentIds = Array.from(new Set(matches.map(m => m.tournament_id)));
    const categoryIds = Array.from(new Set(matches.map(m => m.tournament_category_id)));
    
    const { data: tournaments } = await supabase.from('tournaments').select('id, name').in('id', tournamentIds);
    const { data: categories } = await supabase.from('tournament_categories').select('id, name, gender, age_group').in('id', categoryIds);
    
    const teamIds = Array.from(new Set(matches.flatMap(m => [m.team1_id, m.team2_id]).filter(Boolean)));
    const { data: teams } = teamIds.length > 0
      ? await supabase.from('team_registrations').select('id, institution_id, institutions:institution_id(name)').in('id', teamIds)
      : { data: [], error: null } as any;
       
    const tournamentMap = new Map<string, string>(tournaments?.map(t => [t.id, t.name]) || []);
    const categoryMap = new Map<string, string>(categories?.map(c => [c.id, `${c.name} (${c.gender})` + (c.age_group ? ` - ${c.age_group}` : '')]) || []);
    const teamMap = new Map<string, string>(teams?.map((t: any) => [t.id, t.institutions?.name || 'Clube/Escola']) || []);
    
    const { data: teamMembers } = teamIds.length > 0
      ? await supabase.from('team_members').select('team_id, athlete_id, members:athlete_id(full_name, document_number)').in('team_id', teamIds)
      : { data: [], error: null } as any;
       
    const localVisitors = loadLocalVisitors();
    const result = [];
    
    for (const match of matches) {
      const tournamentName = tournamentMap.get(match.tournament_id) || "Torneio";
      const categoryName = categoryMap.get(match.tournament_category_id) || "Categoria";
      const team1Name = match.team1_id ? teamMap.get(match.team1_id) : null;
      const team2Name = match.team2_id ? teamMap.get(match.team2_id) : null;
      
      const matchAthletes = [];
      
      // Atletas do Time 1
      const t1Members = teamMembers?.filter((m: any) => m.team_id === match.team1_id) || [];
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
            teamName: team1Name || 'Time A',
            visitors
          });
        }
      }
      
      // Atletas do Time 2
      const t2Members = teamMembers?.filter((m: any) => m.team_id === match.team2_id) || [];
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
            teamName: team2Name || 'Time B',
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Obter partidas de um responsável (guardian) com seus visitantes correspondentes
router.get("/public/guardian/:email/matches-with-visitors", requireAuth, async (req, res) => {
  const { email } = req.params;
  
  if (req.user!.role !== "super_admin" && req.user!.role !== "organizer" && req.user!.email.toLowerCase() !== email.toLowerCase()) {
    return res.status(403).json({ error: "Acesso não autorizado." });
  }
  
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  try {
    const supabase = getSupabaseAdmin();
    const db = loadDb();
    
    let subs: any[] = [];
    try {
      const { data, error } = await supabase
        .from('athlete_subscriptions')
        .select('*')
        .eq('validation_status', 'approved');
      if (!error && data) subs = data.map(mapSubToFrontend);
    } catch (err) {
      // ignore
    }
    
    if (subs.length === 0) {
      subs = db.athleteSubscriptions.filter(s => s.validationStatus === 'approved');
    }
    
    const uEmail = email.toLowerCase().trim();
    const guardianSubs = subs.filter(s => {
      return (
        (s.parentName && s.parentName.toLowerCase().includes(uEmail)) ||
        (s.additionalData && s.additionalData.parentEmail && s.additionalData.parentEmail.toLowerCase() === uEmail) ||
        s.createdBy === req.user!.id
      );
    });
    
    if (guardianSubs.length === 0) {
      return res.json([]);
    }
    
    const documents = guardianSubs.map(s => s.document).filter(Boolean);
    if (documents.length === 0) {
      return res.json([]);
    }
    
    let members: any[] = [];
    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, full_name, document_number')
        .in('document_number', documents);
      if (!error && data) members = data;
    } catch (err) {
      // ignore
    }
    
    if (members.length === 0) {
      return res.json([]);
    }
    
    const athleteIds = members.map(m => m.id);
    
    let teamMembers: any[] = [];
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('team_id, athlete_id')
        .in('athlete_id', athleteIds);
      if (!error && data) teamMembers = data;
    } catch (err) {
      // ignore
    }
    
    if (teamMembers.length === 0) {
      return res.json([]);
    }
    
    const teamIds = teamMembers.map(tm => tm.team_id);
    
    let matches: any[] = [];
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('id, tournament_id, tournament_category_id, team1_id, team2_id, scheduled_time, round, match_index, court, venue_id, phase_name')
        .or(`team1_id.in.(${teamIds.join(',')}),team2_id.in.(${teamIds.join(',')})`);
      if (!error && data) matches = data;
    } catch (err) {
      // ignore
    }
    
    if (matches.length === 0) {
      return res.json([]);
    }
    
    const tournamentIds = Array.from(new Set(matches.map(m => m.tournament_id)));
    const categoryIds = Array.from(new Set(matches.map(m => m.tournament_category_id)));
    const venueIds = Array.from(new Set(matches.map(m => m.venue_id).filter(Boolean)));
    
    const { data: tournaments } = await supabase.from('tournaments').select('id, name').in('id', tournamentIds);
    const { data: categories } = await supabase.from('tournament_categories').select('id, name, gender, age_group').in('id', categoryIds);
    const { data: venues } = venueIds.length > 0
      ? await supabase.from('venues').select('id, name').in('id', venueIds)
      : { data: [], error: null } as any;
       
    const allTeamIds = Array.from(new Set(matches.flatMap(m => [m.team1_id, m.team2_id]).filter(Boolean)));
    const { data: allTeams } = allTeamIds.length > 0
      ? await supabase.from('team_registrations').select('id, institutions:institution_id(name)').in('id', allTeamIds)
      : { data: [], error: null } as any;
       
    let settingsList: any[] = [];
    try {
      const { data: setList, error: setErr } = await supabase
        .from('tournament_subscription_settings')
        .select('tournament_id, max_visitors_per_athlete')
        .in('tournament_id', tournamentIds);
      if (!setErr && setList) settingsList = setList;
    } catch (err) {
      // ignore
    }
    
    const tournamentMap = new Map<string, string>(tournaments?.map(t => [t.id, t.name]) || []);
    const categoryMap = new Map<string, string>(categories?.map(c => [c.id, `${c.name} (${c.gender})` + (c.age_group ? ` - ${c.age_group}` : '')]) || []);
    const venueMap = new Map<string, string>(venues?.map(v => [v.id, v.name]) || []);
    const teamNameMap = new Map<string, string>(allTeams?.map((t: any) => [t.id, t.institutions?.name || 'Clube/Escola']) || []);
    const limitMap = new Map(settingsList.map(s => [s.tournament_id, s.max_visitors_per_athlete]));
    
    const localVisitors = loadLocalVisitors();
    const result = [];
    
    for (const match of matches) {
      const matchTeamIds = [match.team1_id, match.team2_id].filter(Boolean);
      const activeTeamMembers = teamMembers.filter(tm => 
        matchTeamIds.includes(tm.team_id) && athleteIds.includes(tm.athlete_id)
      );
      
      for (const tm of activeTeamMembers) {
        const athlete = members.find(m => m.id === tm.athlete_id);
        if (!athlete) continue;
        
        const athleteTeamId = tm.team_id;
        const opponentTeamId = match.team1_id === athleteTeamId ? match.team2_id : match.team1_id;
        const opponentName = opponentTeamId ? (teamNameMap.get(opponentTeamId) || "Outra Equipe") : "A Definir";
        const myTeamName = athleteTeamId ? (teamNameMap.get(athleteTeamId) || "Minha Equipe") : "Minha Equipe";
        
        // Se as configurações falharem no Supabase, buscar do JSON local
        let maxLimit = limitMap.get(match.tournament_id);
        if (maxLimit === undefined) {
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
          if (timeDiff < 24 * 60 * 60 * 1000) {
            canEdit = false;
          }
        }
        
        result.push({
          matchId: match.id,
          matchTime: match.scheduled_time,
          court: match.court || "Principal",
          round: match.round,
          phase: match.phase_name || `Rodada ${match.round}`,
          myTeamName: myTeamName,
          opponentTeamName: opponentName,
          categoryName: categoryMap.get(match.tournament_category_id) || "Categoria",
          tournamentName: tournamentMap.get(match.tournament_id) || "Torneio",
          venueName: match.venue_id ? (venueMap.get(match.venue_id) || "Local do Jogo") : "Sede a Definir",
          athleteId: athlete.id,
          athleteName: athlete.full_name,
          maxVisitors: maxLimit,
          visitors,
          canEdit
        });
      }
    }
    
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Cadastrar/Substituir lista de visitantes para uma partida
router.post("/public/athlete-subscription/match/:matchId/athlete/:athleteId/visitors", requireAuth, async (req, res) => {
  const { matchId, athleteId } = req.params;
  const { visitors } = req.body;
  
  if (!Array.isArray(visitors)) {
    return res.status(400).json({ error: "O payload de visitantes deve ser um array." });
  }
  
  try {
    const supabase = getSupabaseAdmin();
    
    const { data: match, error: matchErr } = await supabase
      .from('matches')
      .select('scheduled_time, tournament_id')
      .eq('id', matchId)
      .maybeSingle();
       
    if (matchErr) throw matchErr;
    if (!match) {
      return res.status(404).json({ error: "Partida não encontrada." });
    }
    
    // Validação da trava de 24h
    if (match.scheduled_time) {
      const timeDiff = new Date(match.scheduled_time).getTime() - Date.now();
      if (timeDiff < 24 * 60 * 60 * 1000) {
        return res.status(400).json({ error: "Não é possível alterar a lista de visitantes nas 24h anteriores ao início do jogo." });
      }
    }
    
    const settings = await getSubscriptionSettings(match.tournament_id);
    const maxLimit = settings?.maxVisitorsPerAthlete || 0;
    
    if (maxLimit > 0 && visitors.length > maxLimit) {
      return res.status(400).json({ error: `O limite máximo permitido para este torneio é de ${maxLimit} visitantes por atleta.` });
    }
    
    let dbSuccess = false;
    try {
      const { error: deleteErr } = await supabase
        .from('match_visitors')
        .delete()
        .eq('match_id', matchId)
        .eq('athlete_id', athleteId);
         
      if (!deleteErr) {
        if (visitors.length > 0) {
          const rows = visitors.map(v => ({
            match_id: matchId,
            athlete_id: athleteId,
            name: v.name.trim(),
            document: v.document.trim()
          }));
          const { error: insertErr } = await supabase
            .from('match_visitors')
            .insert(rows);
             
          if (!insertErr) {
            dbSuccess = true;
          } else {
            throw insertErr;
          }
        } else {
          dbSuccess = true;
        }
      }
    } catch (dbErr: any) {
      console.warn("Erro ao salvar no banco original match_visitors, usando local fallback JSON", dbErr.message);
    }
    
    // Salvar localmente no fallback JSON
    const localVisitors = loadLocalVisitors();
    const filtered = localVisitors.filter(v => !(v.matchId === matchId && v.athleteId === athleteId));
    
    if (visitors.length > 0) {
      visitors.forEach(v => {
        filtered.push({
          id: `mv_${Math.random().toString(36).substring(2, 11)}`,
          matchId,
          athleteId,
          name: v.name.trim(),
          document: v.document.trim(),
          createdAt: new Date().toISOString()
        });
      });
    }
    saveLocalVisitors(filtered);
    
    res.json({ success: true, count: visitors.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
