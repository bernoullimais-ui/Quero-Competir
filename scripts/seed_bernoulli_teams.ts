import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://fjpfmjilsyyhamikvyof.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TOURNAMENT_ID = "b1111111-2222-3333-4444-555555555555";
const CATEGORY_ID = "8d614c73-9c24-48bb-90a8-3679aab60669"; // Futsal - 6º e 7º anos Masculino
const INSTITUTION_ID = "905c7902-56f0-44e1-ab79-54029c7b0611"; // Bernoulli+

const TEAMS_DATA = [
  { className: "7º ano A", country: "México", flagEmoji: "🇲🇽" },
  { className: "7º ano B", country: "Colômbia", flagEmoji: "🇨🇴" },
  { className: "7º ano C", country: "Canadá", flagEmoji: "🇨🇦" },
  { className: "7º ano D", country: "Haiti", flagEmoji: "🇭🇹" },
  { className: "6º ano A", country: "Argentina", flagEmoji: "🇦🇷" },
  { className: "6º ano B", country: "Equador", flagEmoji: "🇪🇨" },
  { className: "6º ano C", country: "Paraguai", flagEmoji: "🇵🇾" },
];

const FIRST_NAMES_M = ["Gabriel", "Lucas", "Matheus", "Guilherme", "Pedro", "Arthur", "Bernardo", "Rafael", "Enzo", "Felipe", "Rodrigo", "Thiago", "Vinicius", "Bruno", "Diego", "Leonardo", "Samuel", "Daniel"];
const LAST_NAMES = ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes", "Soares"];

function getRandomName() {
  const first = FIRST_NAMES_M[Math.floor(Math.random() * FIRST_NAMES_M.length)];
  const last1 = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const last2 = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last1} ${last2}`;
}

function getRandomCPF() {
  const rnd = (n: number) => Math.floor(Math.random() * n);
  return `${rnd(900) + 100}.${rnd(900) + 100}.${rnd(900) + 100}-${rnd(90) + 10}`;
}

async function runSeedBernoulliTeams() {
  console.log("=== SEEDING BERNOULLI CUP 2026 TEAMS (Futsal - 6º e 7º anos Masculino) ===");

  for (const tData of TEAMS_DATA) {
    const fullTeamName = `${tData.className} (${tData.country})`;
    console.log(`\nRegistering Team: ${fullTeamName}...`);

    // 1. Create or fetch team_registration
    const availabilityData = {
      teamName: fullTeamName,
      country: tData.country,
      className: tData.className,
      flagEmoji: tData.flagEmoji
    };

    const { data: teamReg, error: teamErr } = await supabase
      .from("team_registrations")
      .insert({
        tournament_id: TOURNAMENT_ID,
        tournament_category_id: CATEGORY_ID,
        institution_id: INSTITUTION_ID,
        availability: availabilityData
      })
      .select("id")
      .single();

    if (teamErr) {
      console.error("Error creating team registration for", fullTeamName, teamErr.message);
      continue;
    }

    const teamId = teamReg.id;
    console.log(` -> Team ID created: ${teamId}`);

    // 2. Register 10 athletes per team
    const teamAthletes = [];
    for (let i = 1; i <= 10; i++) {
      const athleteName = getRandomName();
      const birthYear = tData.className.startsWith("6º") ? 2014 : 2013;
      const birthDate = `${birthYear}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;

      teamAthletes.push({
        tournament_id: TOURNAMENT_ID,
        institution_id: INSTITUTION_ID,
        category_id: CATEGORY_ID,
        athlete_name: athleteName,
        birth_date: birthDate,
        document: getRandomCPF(),
        gender: "Masculino",
        is_completed: true,
        validation_status: "approved",
        authorized_image_use: true,
        liability_waiver: true,
        payment_status: "paid",
        parent_name: "Responsável Legal Bernoulli",
        parent_phone: "(31) 99888-0000",
        additional_data: {
          teamId: teamId,
          teamName: fullTeamName,
          country: tData.country,
          className: tData.className,
          athleteFee: 0,
          totalFee: 0
        }
      });
    }

    const { data: insertedAthletes, error: aErr } = await supabase
      .from("athlete_subscriptions")
      .insert(teamAthletes)
      .select("id");

    if (aErr) {
      console.error("Error inserting team athletes:", aErr.message);
    } else if (insertedAthletes) {
      // 3. Link athletes in team_members
      const teamMemberInserts = insertedAthletes.map(ath => ({
        team_id: teamId,
        athlete_id: ath.id
      }));
      await supabase.from("team_members").insert(teamMemberInserts);
      console.log(` -> Successfully added ${insertedAthletes.length} athletes to ${fullTeamName}`);
    }
  }

  console.log("\n=== ALL 7 TEAMS REGISTERED SUCCESSFULLY FOR BERNOULLI CUP 2026! ===");
}

runSeedBernoulliTeams().catch(console.error);
