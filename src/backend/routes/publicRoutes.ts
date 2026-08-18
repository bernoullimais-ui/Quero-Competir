import { Router } from "express";
import { getSupabaseAdmin } from "../lib/supabase";

const isValidUUID = (uuid: string) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
};
import { indexHtml } from "../indexHtml";

const router = Router();

const DEFAULT_LOGO = "https://www.querocompetir.com.br/assets/logo.png"; // Usando logo padrao do Quero Competir

const slugify = (text: string) => {
  if (!text) return "";
  return text.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w\-]+/g, "").replace(/\-\-+/g, "-");
};

const handler = async (req: any, res: any) => {
  const { id } = req.params;
  const isScoreboard = req.originalUrl.includes("/placar");

  try {
    const supabase = getSupabaseAdmin();
    const decoded = decodeURIComponent(id).trim();
    
    // Resolve slug to UUID if needed
    let finalTournamentId = decoded;
    if (!isValidUUID(decoded)) {
      const { data: allTournaments } = await supabase.from('tournaments').select('id, name, owner_id');
      if (allTournaments) {
        const targetSlug = slugify(decoded);
        const matched = allTournaments.find(t => 
          slugify(t.name) === targetSlug || 
          t.name.toLowerCase() === decoded.toLowerCase()
        );
        if (matched) {
          finalTournamentId = matched.id;
        } else {
          return res.send(indexHtml);
        }
      } else {
        return res.send(indexHtml);
      }
    }

    // Fetch tournament and organization details
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('name, owner_id')
      .eq('id', finalTournamentId)
      .maybeSingle();

    if (!tournament) {
      return res.send(indexHtml);
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('name, logo_url')
      .eq('id', tournament.owner_id)
      .maybeSingle();

    const titlePrefix = tournament.name || "Torneio";
    const finalTitle = isScoreboard ? `${titlePrefix} - Placar ao Vivo` : titlePrefix;
    const orgName = org?.name || "Organizador";
    const logoUrl = org?.logo_url || DEFAULT_LOGO;
    const description = `Participe deste evento organizado pela ${orgName}!`;
    const appUrl = process.env.APP_URL || "https://www.querocompetir.com.br";
    const currentUrl = `${appUrl}${req.originalUrl}`;

    // Prepare meta tags
    const metaTags = `
    <meta property="og:title" content="${finalTitle}" />
    <meta property="og:site_name" content="${orgName}" />
    <meta property="og:image" content="${logoUrl}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${currentUrl}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${finalTitle}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${logoUrl}" />
    `;

    const modifiedHtml = indexHtml.replace('</head>', `${metaTags}\n</head>`);

    res.send(modifiedHtml);
  } catch (error) {
    console.error("Error generating public tournament page:", error);
    res.send(indexHtml);
  }
};

router.get("/tournament/:id", handler);
router.get("/tournament/:id/*", handler);

export default router;
