import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://fjpfmjilsyyhamikvyof.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BERNOULLI_ORG_ID = "a21b98ab-7e14-4ce0-9e87-741431d3c1e4";

async function runSeedBernoulliCup() {
  console.log("=== CREATING BERNOULLI CUP 2026 EVENT ===");

  const tournamentId = "b1111111-2222-3333-4444-555555555555";
  const name = "Bernoulli CUP 2026";
  const description = "Torneio oficial de Futsal das unidades Bernoulli+ reunindo categorias do Ensino Fundamental II e Ensino Médio.";
  const startDate = "2026-05-22";
  const endDate = "2026-07-24";
  const logoUrl = "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=500&q=80";

  // 1. Create Tournament
  const { data: tourney, error: tErr } = await supabase
    .from("tournaments")
    .upsert({
      id: tournamentId,
      owner_id: BERNOULLI_ORG_ID,
      name,
      description,
      start_date: startDate,
      end_date: endDate,
      status: "completed",
      logo_url: logoUrl
    })
    .select()
    .single();

  if (tErr) {
    console.error("Error creating tournament:", tErr);
    return;
  }
  console.log("Created Tournament:", tourney.name, "ID:", tourney.id);

  // 2. Create Subscription Settings
  const { error: sErr } = await supabase
    .from("tournament_subscription_settings")
    .upsert({
      tournament_id: tournamentId,
      fee_type: "by_team",
      team_fee: 150.00,
      athlete_fee: 0,
      status: "closed"
    });

  if (sErr) console.error("Error creating subscription settings:", sErr);

  // 3. Create Categories
  const categories = [
    { name: "Futsal - 6º e 7º anos Masculino", gender: "Masculino", age_group: "6º e 7º anos", max_teams: 16 },
    { name: "Futsal - 6º e 7º anos Feminino", gender: "Feminino", age_group: "6º e 7º anos", max_teams: 16 },
    { name: "Futsal - 8º e 9º anos Masculino", gender: "Masculino", age_group: "8º e 9º anos", max_teams: 16 },
    { name: "Futsal - Ensino Médio Masculino", gender: "Masculino", age_group: "Ensino Médio", max_teams: 16 },
  ];

  for (const cat of categories) {
    const { data: existing } = await supabase
      .from("tournament_categories")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("name", cat.name)
      .maybeSingle();

    if (existing) {
      console.log("Category already exists:", cat.name, "ID:", existing.id);
    } else {
      const { data: catData, error: cErr } = await supabase
        .from("tournament_categories")
        .insert({
          tournament_id: tournamentId,
          name: cat.name,
          gender: cat.gender,
          age_group: cat.age_group,
          max_teams: cat.max_teams
        })
        .select()
        .single();

      if (cErr) {
        console.error("Error creating category:", cat.name, cErr);
      } else {
        console.log("Created Category:", catData.name, "ID:", catData.id);
      }
    }
  }

  console.log("=== BERNOULLI CUP 2026 CREATED SUCCESSFULLY ===");
}

runSeedBernoulliCup().catch(console.error);
