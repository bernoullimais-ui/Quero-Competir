import { Router } from "express";
import { getSupabaseAdmin } from "../lib/supabase.ts";
import fs from "fs";
import path from "path";
import { requireAuth } from "../middleware/auth.ts";

const router = Router();

// File path constants
const ORG_INST_FILE = path.join(process.cwd(), "src", "backend", "data", "organizer_institutions.json");
const ACCOUNTS_FILE = path.join(process.cwd(), "src", "backend", "data", "accounts.json");

function loadOrgInstitutions(): Record<string, string[]> {
  try {
    if (fs.existsSync(ORG_INST_FILE)) {
      return JSON.parse(fs.readFileSync(ORG_INST_FILE, "utf-8"));
    }
  } catch (e) {}
  return {};
}

function getUserRole(userId: string): string | null {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
      const user = accounts.find((a: any) => a.id === userId);
      return user ? (user.role || null) : null;
    }
  } catch (e) {}
  return null;
}

// Pré-registrar atleta (Filtro de Segurança da Instituição)
router.post("/", requireAuth, async (req, res) => {
  const { institution_id, full_name, document_number, birth_date } = req.body;
  
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('members')
      .insert([{ 
        institution_id, 
        full_name, 
        document_number, 
        birth_date,
        status: 'authorized' 
      }])
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: "Este documento já está cadastrado." });
      throw error;
    }
    
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Listar atletas por instituição
router.get("/institution/:institutionId", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('institution_id', req.params.institutionId)
      .order('full_name');

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Listar todos os atletas (Visão Organizador) com filtro de isolamento por organizador
router.get("/", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const organizerId = req.user!.id;

    const { data, error } = await supabase
      .from('members')
      .select(`
        *,
        institutions (name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (organizerId) {
      const role = getUserRole(organizerId);
      if (role !== "super_admin") {
        const mapping = loadOrgInstitutions();
        const allowedInstIds = mapping[organizerId] || [];
        const filtered = (data || []).filter((m: any) => allowedInstIds.includes(m.institution_id));
        return res.json(filtered);
      }
    }

    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar estatísticas de um atleta
router.get("/:id/stats", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;

    // Buscar todos os eventos do atleta
    const { data: events, error } = await supabase
      .from('match_events')
      .select(`
        *,
        match:match_id(
          tournament:tournament_id(name),
          category:tournament_category_id(name)
        )
      `)
      .eq('athlete_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    let goals = 0;
    let yellowCards = 0;
    let redCards = 0;

    events.forEach(e => {
      if (e.event_type.startsWith('goal')) {
        goals += (e.event_type === 'goal_2' ? 2 : e.event_type === 'goal_3' ? 3 : 1);
      }
      if (e.event_type === 'yellow_card') yellowCards++;
      if (e.event_type === 'red_card') redCards++;
    });

    res.json({
      goals,
      yellowCards,
      redCards,
      events
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
