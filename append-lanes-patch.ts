import fs from 'fs';

let content = fs.readFileSync('src/backend/routes/tournamentRoutes.ts', 'utf-8');

const newEndpoint = `
// Endpoint dedicado para alterar quantidade de raias da natação
router.patch("/:id/swimming-lanes", async (req, res) => {
  try {
    const { lanesCount } = req.body;
    const tData = await findTournamentByIdOrSlug(req.params.id);
    if (!tData) return res.status(404).json({ error: "Torneio não encontrado" });

    const tournamentId = tData.id;
    const supabase = getSupabaseAdmin();
    
    // 1. Atualizar tournaments.rules_config
    const currentRules = tData.rules_config || {};
    const updatedRules = { ...currentRules, swimming_lanes_count: lanesCount };

    await supabase
      .from('tournaments')
      .update({ rules_config: updatedRules })
      .eq('id', tournamentId);

    res.json({ success: true, swimming_lanes_count: lanesCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
`;

if (!content.includes('router.patch("/:id/swimming-lanes"')) {
  content = content.replace('router.patch("/:id/brackets-visibility"', newEndpoint + '\nrouter.patch("/:id/brackets-visibility"');
  fs.writeFileSync('src/backend/routes/tournamentRoutes.ts', content);
  console.log("Endpoint added");
} else {
  console.log("Endpoint already exists");
}
