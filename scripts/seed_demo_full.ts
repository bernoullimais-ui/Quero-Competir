import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://fjpfmjilsyyhamikvyof.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

// We will use Supabase REST or Direct SQL
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ORGANIZER_ACCOUNT_ID = "acc_m15ags71y";
const ORGANIZER_REF_ID = "fc646bf3-d30b-4c50-b2b0-b5805b529a53"; // Quero Competir (EXEMPLO)

const INSTITUTIONS = [
  { id: "55555551-5555-5555-5555-555555555551", name: "Clube Esportivo Real Salvador", city: "Salvador", state: "BA", resp: "Carlos Eduardo" },
  { id: "55555552-5555-5555-5555-555555555552", name: "Colégio e Centro Esportivo Anchieta", city: "Salvador", state: "BA", resp: "Mariana Costa" },
  { id: "55555553-5555-5555-5555-555555555553", name: "Associação Aquática Baiana", city: "Lauro de Freitas", state: "BA", resp: "Roberto Fonseca" },
  { id: "55555554-5555-5555-5555-555555555554", name: "Academia Gracie Barra Lutas", city: "Salvador", state: "BA", resp: "Mestre Fernando" },
  { id: "55555555-5555-5555-5555-555555555555", name: "Instituto Olímpico de Esportes", city: "Camaçari", state: "BA", resp: "Juliana Mendes" },
  { id: "55555556-5555-5555-5555-555555555556", name: "Clube de Regatas da Bahia", city: "Salvador", state: "BA", resp: "Lucas Silveira" },
  { id: "55555557-5555-5555-5555-555555555557", name: "Centro de Formação Estrela", city: "Feira de Santana", state: "BA", resp: "Beatriz Oliveira" },
  { id: "55555558-5555-5555-5555-555555555558", name: "Associação Desportiva Vitória Áurea", city: "Salvador", state: "BA", resp: "Gustavo Santos" },
];

const FIRST_NAMES_M = ["Lucas", "Gabriel", "Matheus", "Guilherme", "Enzo", "Felipe", "Pedro", "Arthur", "Bernardo", "Rafael", "Rodrigo", "Thiago", "Vinicius", "Bruno", "Diego", "Leonardo", "Samuel", "Daniel"];
const FIRST_NAMES_F = ["Sophia", "Alice", "Julia", "Isabella", "Manuela", "Laura", "Luiza", "Beatriz", "Valentina", "Giovanna", "Mariana", "Lara", "Carolina", "Camila", "Gabriela", "Amanda", "Letícia"];
const LAST_NAMES = ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes", "Soares", "Fernandes"];

function getRandomName(gender: "Masculino" | "Feminino" | "Misto" = "Masculino") {
  const isFemale = gender === "Feminino" || (gender === "Misto" && Math.random() > 0.5);
  const first = isFemale 
    ? FIRST_NAMES_F[Math.floor(Math.random() * FIRST_NAMES_F.length)]
    : FIRST_NAMES_M[Math.floor(Math.random() * FIRST_NAMES_M.length)];
  const last1 = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const last2 = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last1} ${last2}`;
}

function getRandomCPF() {
  const rnd = (n: number) => Math.floor(Math.random() * n);
  return `${rnd(900) + 100}.${rnd(900) + 100}.${rnd(900) + 100}-${rnd(90) + 10}`;
}

function getRandomBirthDate(ageMin = 14, ageMax = 25) {
  const age = Math.floor(Math.random() * (ageMax - ageMin + 1)) + ageMin;
  const year = 2026 - age;
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function runSeed() {
  console.log("=== SEEDING DEMO INSTITUTIONS AND SUBSCRIPTIONS ===");

  // 1. Create Institutions in `institutions` table
  console.log("1. Creating 8 Institutions...");
  for (const inst of INSTITUTIONS) {
    const { error } = await supabase.from("institutions").upsert({
      id: inst.id,
      name: inst.name,
      tax_id: `12.345.678/0001-0${inst.id.slice(-1)}`,
      email: `${inst.id.slice(-1)}@querocompetir.com.br`,
      responsible_name: inst.resp,
      responsible_phone: "(71) 99888-7766"
    });
    if (error) console.error("Error upserting institution:", inst.name, error.message);
  }

  // 2. Link Institutions to Organizer in `organizer_institutions`
  console.log("2. Linking Institutions to Organizer in organizer_institutions...");
  for (const inst of INSTITUTIONS) {
    const { error } = await supabase.from("organizer_institutions").upsert({
      organizer_account_id: ORGANIZER_ACCOUNT_ID,
      institution_id: inst.id
    });
    if (error) console.error("Error linking organizer institution:", error.message);
  }

  // 3. Get Tournaments and Categories
  const { data: tournaments, error: tErr } = await supabase
    .from("tournaments")
    .select("id, name")
    .eq("owner_id", ORGANIZER_REF_ID);

  if (tErr || !tournaments) {
    console.error("Failed to fetch tournaments:", tErr);
    return;
  }

  console.log(`Found ${tournaments.length} tournaments for demo organizer.`);

  for (const tourney of tournaments) {
    console.log(`\nProcessing Tournament: ${tourney.name} (${tourney.id})`);

    // 3a. Register all 8 institutions for this tournament in `tournament_registrations`
    for (const inst of INSTITUTIONS) {
      await supabase.from("tournament_registrations").upsert({
        tournament_id: tourney.id,
        institution_id: inst.id,
        status: "approved"
      }, { onConflict: "tournament_id,institution_id" });
    }

    // Get categories for this tournament
    const { data: categories, error: cErr } = await supabase
      .from("tournament_categories")
      .select("*")
      .eq("tournament_id", tourney.id);

    if (cErr || !categories) {
      console.error("Error fetching categories for tournament:", tourney.id);
      continue;
    }

    for (const cat of categories) {
      const isTeamModality = cat.name.toLowerCase().includes("futsal") ||
                             cat.name.toLowerCase().includes("voleibol") ||
                             cat.name.toLowerCase().includes("basquete") ||
                             cat.name.toLowerCase().includes("baleado") ||
                             cat.name.toLowerCase().includes("revezamento");

      console.log(` -> Category: "${cat.name}" (Team Modality: ${isTeamModality})`);

      if (isTeamModality) {
        // Register teams for 6 of the institutions, and 12 athletes per team
        const selectedOrgs = INSTITUTIONS.slice(0, 6);
        for (const inst of selectedOrgs) {
          // Check or insert team_registration
          let teamId: string | null = null;
          const { data: existingTeam } = await supabase
            .from("team_registrations")
            .select("id")
            .eq("tournament_id", tourney.id)
            .eq("tournament_category_id", cat.id)
            .eq("institution_id", inst.id)
            .maybeSingle();

          if (existingTeam) {
            teamId = existingTeam.id;
          } else {
            const { data: newTeam } = await supabase
              .from("team_registrations")
              .insert({
                tournament_id: tourney.id,
                tournament_category_id: cat.id,
                institution_id: inst.id
              })
              .select("id")
              .single();
            teamId = newTeam?.id || null;
          }

          // Insert 12 athletes for this team
          const athleteInserts = [];
          for (let i = 1; i <= 12; i++) {
            const athleteName = getRandomName(cat.gender as any);
            const genderVal = cat.gender === "Feminino" ? "Feminino" : "Masculino";
            athleteInserts.push({
              tournament_id: tourney.id,
              institution_id: inst.id,
              category_id: cat.id,
              athlete_name: athleteName,
              birth_date: getRandomBirthDate(15, 22),
              document: getRandomCPF(),
              gender: genderVal,
              is_completed: true,
              validation_status: "approved",
              authorized_image_use: true,
              liability_waiver: true,
              payment_status: "paid",
              parent_name: "Responsável Legal",
              parent_phone: "(71) 99111-2233",
              additional_data: {
                teamId: teamId,
                teamName: `${inst.name} - ${cat.name}`,
                athleteFee: 0,
                totalFee: 0,
                feeSnapshot: 0
              }
            });
          }
          const { error: aErr } = await supabase.from("athlete_subscriptions").insert(athleteInserts);
          if (aErr) console.error("Error inserting team athletes:", aErr.message);
        }
      } else {
        // Individual modality: 8 to 14 participants per category
        const count = Math.floor(Math.random() * 7) + 8; // 8 to 14
        const athleteInserts = [];
        for (let i = 0; i < count; i++) {
          const randomInst = INSTITUTIONS[i % INSTITUTIONS.length];
          const athleteName = getRandomName(cat.gender as any);
          const genderVal = cat.gender === "Feminino" ? "Feminino" : "Masculino";
          athleteInserts.push({
            tournament_id: tourney.id,
            institution_id: randomInst.id,
            category_id: cat.id,
            athlete_name: athleteName,
            birth_date: getRandomBirthDate(16, 28),
            document: getRandomCPF(),
            gender: genderVal,
            is_completed: true,
            validation_status: "approved",
            authorized_image_use: true,
            liability_waiver: true,
            payment_status: "paid",
            parent_name: "Atleta / Autônomo",
            parent_phone: "(71) 99222-3344",
            additional_data: {
              athleteFee: 50,
              totalFee: 50,
              feeSnapshot: 50
            }
          });
        }
        const { error: aErr } = await supabase.from("athlete_subscriptions").insert(athleteInserts);
        if (aErr) console.error("Error inserting individual athletes:", aErr.message);
      }
    }
  }

  console.log("\n=== SEED COMPLETED SUCCESSFULLY! ===");
}

runSeed().catch(console.error);
