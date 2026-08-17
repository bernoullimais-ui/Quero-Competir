import { Router } from "express";
import { getSupabaseAdmin } from "../lib/supabase.ts";
import { requireAuth, requireRole } from "../middleware/auth.ts";
import fs from "fs";
import path from "path";

const router = Router();
const CONFIG_FILE = path.join(process.cwd(), "src", "backend", "data", "landing_config.json");

const DEFAULT_CONFIG = {
  seo: {
    title: "Quero Competir — Plataforma de Gestão Esportiva",
    description: "A plataforma completa para organizar torneios, gerenciar inscrições e conectar atletas, clubes e organizadores."
  },
  hero: {
    slides: [
      {
        id: "slide1",
        imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=1600",
        title: "Organize Torneios com Excelência",
        subtitle: "Inscrições, balizamento, check-in digital e muito mais em uma única plataforma.",
        ctaText: "Começar Agora",
        ctaUrl: "/login"
      },
      {
        id: "slide2",
        imageUrl: "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&q=80&w=1600",
        title: "Check-in via QR Code",
        subtitle: "Agilidade para sua equipe de arbitragem e recepção no dia do evento.",
        ctaText: "Conhecer Recursos",
        ctaUrl: "/login"
      },
      {
        id: "slide3",
        imageUrl: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&q=80&w=1600",
        title: "Conecte Atletas e Clubes",
        subtitle: "Portal completo para responsáveis, clubes e organizadores esportivos.",
        ctaText: "Saiba Mais",
        ctaUrl: "/login"
      }
    ]
  },
  features: [
    { id: "f1", icon: "🏆", title: "Gestão Completa de Torneios", description: "Crie, configure e gerencie torneios de qualquer modalidade, do início ao fim." },
    { id: "f2", icon: "📱", title: "Check-in via QR Code", description: "Scanner mobile para a equipe de recepção confirmar presença dos atletas em segundos." },
    { id: "f3", icon: "🏊", title: "Balizamento Automático", description: "Geração de raias e séries de natação conforme regras FINA/CBDA automaticamente." },
    { id: "f4", icon: "💳", title: "Pagamentos Integrados", description: "Pix e cartão de crédito via Pagar.me com repasse automático aos organizadores." },
    { id: "f5", icon: "📊", title: "Relatórios e Estatísticas", description: "Dashboards em tempo real com dados de inscrições, financeiro e resultados." },
    { id: "f6", icon: "🤝", title: "Portal para Clubes", description: "As instituições gerenciam seus atletas, fichas médicas e inscrições em um só lugar." }
  ]
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch { /**/ }
  return DEFAULT_CONFIG;
}

function saveConfig(config: any) {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// GET /api/platform/landing-config — PUBLIC
router.get("/landing-config", async (_req, res) => {
  try {
    try {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase.from("platform_config").select("value").eq("key", "landing_page").maybeSingle();
      if (data?.value) return res.json(data.value);
    } catch { /**/ }
    return res.json(loadConfig());
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/platform/landing-config — SUPER ADMIN ONLY
router.patch("/landing-config", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const config = req.body;
    if (!config || typeof config !== "object") return res.status(400).json({ error: "Configuração inválida." });
    saveConfig(config);
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from("platform_config").upsert({ key: "landing_page", value: config }, { onConflict: "key" });
    } catch { /**/ }
    return res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/platform/public-tournaments — PUBLIC
router.get("/public-tournaments", async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("tournaments")
      .select("id, name, start_date, end_date, status, logo_url, owner_id")
      .order("start_date", { ascending: false })
      .limit(9);

    if (error) throw error;
    return res.json(data || []);
  } catch (err: any) {
    console.error("public-tournaments error:", err.message);
    return res.json([]);
  }
});

// GET /api/platform/public-organizations — PUBLIC
router.get("/public-organizations", async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from("organizations").select("id, name, logo_url, subdomain, description").order("name");
    return res.json(data || []);
  } catch { return res.json([]); }
});

export default router;
