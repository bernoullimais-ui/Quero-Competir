import { Router } from "express";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "../lib/supabase.ts";
import { generateToken, requireAuth, requireRole } from "../middleware/auth.ts";

const router = Router();
const ACCOUNTS_FILE = path.join(process.cwd(), "src/backend/data/accounts.json");
const BCRYPT_ROUNDS = 10;

interface Account {
  id: string;
  email: string;
  passwordHash: string;
  role: "super_admin" | "organizer" | "institution" | "guardian" | "venue";
  name: string;
  referenceId?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers de persistência local (accounts.json como fallback)
// ---------------------------------------------------------------------------

async function loadAccountsDb(): Promise<Account[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("portal_accounts")
      .select("*");
    
    if (!error && data) {
      const accounts: Account[] = data.map((a: any) => ({
        id: a.id,
        email: a.email,
        passwordHash: a.password_hash,
        role: a.role,
        name: a.name,
        referenceId: a.reference_id || undefined,
        createdAt: a.created_at,
      }));
      saveAccountsDb(accounts);
      return accounts;
    }
  } catch (err) {
    // Fallback to local accounts.json
  }

  try {
    const dir = path.dirname(ACCOUNTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(ACCOUNTS_FILE)) {
      const defaultAccounts: Account[] = [
        {
          id: "sa-1",
          email: "admin@querocompetir.com.br",
          // Plaintext — will be automatically hashed on first login
          passwordHash: "admin123",
          role: "super_admin",
          name: "Super Admin (SaaS Manager)",
          createdAt: new Date().toISOString(),
        },
        {
          id: "org-1",
          email: "organizador@querocompetir.com.br",
          // Plaintext — will be automatically hashed on first login
          passwordHash: "org123",
          role: "organizer",
          name: "Organizador Principal",
          createdAt: new Date().toISOString(),
        },
      ];
      fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(defaultAccounts, null, 2));
      return defaultAccounts;
    }
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
  } catch (err) {
    console.error("Error reading accounts.json", err);
    return [];
  }
}

function saveAccountsDb(accounts: Account[]) {
  try {
    const dir = path.dirname(ACCOUNTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
  } catch (err) {
    console.error("Error writing accounts.json", err);
  }
}

/** Detecta se um hash é texto puro (legado) ou bcrypt */
function isPlaintextPassword(hash: string): boolean {
  return !hash.startsWith("$2a$") && !hash.startsWith("$2b$");
}

/**
 * Verifica a senha corretamente:
 * - Se o hash armazenado for texto puro (legado), faz comparação direta
 *   e migra para bcrypt após validação bem-sucedida.
 * - Se for bcrypt, usa bcrypt.compare.
 */
async function verifyAndMigratePassword(
  plaintext: string,
  account: Account,
  accounts: Account[]
): Promise<boolean> {
  if (isPlaintextPassword(account.passwordHash)) {
    // Legado: senha em texto puro
    if (account.passwordHash !== plaintext) return false;
    // Migrar para bcrypt
    account.passwordHash = await bcrypt.hash(plaintext, BCRYPT_ROUNDS);
    saveAccountsDb(accounts);
    return true;
  }
  return bcrypt.compare(plaintext, account.passwordHash);
}

async function syncWithSupabase(accounts: Account[]) {
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
        created_at: a.createdAt,
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
  } catch (err: any) {
    console.error("Error syncing with Supabase:", err.message || err);
  }
}

// ---------------------------------------------------------------------------
// 1. LOGIN
// ---------------------------------------------------------------------------
router.post("/login", async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
  }

  try {
    const accounts = await loadAccountsDb();

    let user = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());

    if (user) {
      const passwordValid = await verifyAndMigratePassword(password, user, accounts);
      if (!passwordValid) {
        return res.status(401).json({ error: "Credenciais inválidas. Verifique seu e-mail e senha." });
      }
    } else {
      // Fallback: tentar localizar instituição por e-mail/nome no Supabase
      if (role === "institution") {
        try {
          const supabase = getSupabaseAdmin();
          const { data: schools } = await supabase.from("institutions").select("*");
          if (schools && schools.length > 0) {
            const found = schools.find((inst: any) => {
              const emailClean = (inst.email || "").toLowerCase().trim();
              const nameClean = inst.name.toLowerCase().replace(/[^a-z0-9]/g, "");
              const nameCleanShort = inst.name.toLowerCase().replace(/\s+/g, "").substring(0, 15);
              const inputEmailClean = email.toLowerCase().trim();
              const inputPrefix = inputEmailClean.split("@")[0];

              return (
                emailClean === inputEmailClean ||
                `${nameClean}@querocompetir.com.br` === inputEmailClean ||
                `${nameCleanShort}@querocompetir.com.br` === inputEmailClean ||
                inputPrefix === nameClean ||
                nameClean.startsWith(inputPrefix) ||
                inputPrefix.startsWith(nameClean)
              );
            });

            if (found) {
              const newAcc: Account = {
                id: `inst-acc-${found.id}`,
                email: email.toLowerCase().trim(),
                passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
                role: "institution",
                name: found.name,
                referenceId: found.id,
                createdAt: new Date().toISOString(),
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
        return res.status(401).json({ error: "Credenciais inválidas. Verifique seu e-mail e senha." });
      }
    }

    // Verificar compatibilidade de role
    if (role && user.role !== role) {
      if (user.role !== "super_admin" && user.role !== "organizer") {
        return res.status(403).json({ error: "Seu perfil não possui acesso para esta área." });
      }
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      referenceId: user.referenceId,
    };

    const token = generateToken(tokenPayload as any);

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      referenceId: user.referenceId,
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 2. REGISTER (Guardian ou Institution)
// ---------------------------------------------------------------------------
router.post("/register", async (req, res) => {
  const { email, password, role, name, referenceId } = req.body;

  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: "E-mail, senha, nome e perfil são obrigatórios." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres." });
  }

  try {
    const accounts = await loadAccountsDb();
    const exists = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      return res.status(400).json({ error: "Este endereço de e-mail já está cadastrado." });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const newAccount: Account = {
      id: `acc_${Math.random().toString(36).substring(2, 11)}`,
      email: email.toLowerCase(),
      passwordHash,
      role: role as any,
      name,
      referenceId: referenceId || undefined,
      createdAt: new Date().toISOString(),
    };

    accounts.push(newAccount);
    saveAccountsDb(accounts);
    await syncWithSupabase(accounts);

    const token = generateToken({
      id: newAccount.id,
      email: newAccount.email,
      role: newAccount.role,
      name: newAccount.name,
      referenceId: newAccount.referenceId,
    });

    res.status(201).json({
      id: newAccount.id,
      email: newAccount.email,
      role: newAccount.role,
      name: newAccount.name,
      referenceId: newAccount.referenceId,
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 3. CHANGE PASSWORD (Usuário autenticado)
// ---------------------------------------------------------------------------
router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user!.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Senha atual e nova senha são obrigatórias." });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "A nova senha deve ter no mínimo 6 caracteres." });
  }

  try {
    const accounts = await loadAccountsDb();
    const account = accounts.find((a) => a.id === userId);
    if (!account) return res.status(404).json({ error: "Usuário não encontrado." });

    const valid = await verifyAndMigratePassword(currentPassword, account, accounts);
    if (!valid) return res.status(401).json({ error: "Senha atual incorreta." });

    account.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    saveAccountsDb(accounts);
    await syncWithSupabase(accounts);

    res.json({ success: true, message: "Senha alterada com sucesso." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 4. SEED (apenas para demonstração)
// ---------------------------------------------------------------------------
router.post("/seed", async (req, res) => {
  try {
    const accounts = await loadAccountsDb();

    // Garantir que as contas padrão existam com senhas bcrypt
    const adminExists = accounts.find((a) => a.email === "admin@querocompetir.com.br");
    if (!adminExists) {
      accounts.push({
        id: "sa-1",
        email: "admin@querocompetir.com.br",
        passwordHash: await bcrypt.hash("admin123", BCRYPT_ROUNDS),
        role: "super_admin",
        name: "Super Admin (SaaS Manager)",
        createdAt: new Date().toISOString(),
      });
    } else {
      adminExists.passwordHash = await bcrypt.hash("admin123", BCRYPT_ROUNDS);
    }

    const orgExists = accounts.find((a) => a.email === "organizador@querocompetir.com.br");
    if (!orgExists) {
      accounts.push({
        id: "org-1",
        email: "organizador@querocompetir.com.br",
        passwordHash: await bcrypt.hash("org123", BCRYPT_ROUNDS),
        role: "organizer",
        name: "Organizador Principal",
        createdAt: new Date().toISOString(),
      });
    } else {
      orgExists.passwordHash = await bcrypt.hash("org123", BCRYPT_ROUNDS);
    }

    // Seed instituições do Supabase
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
              passwordHash: await bcrypt.hash("clube123", BCRYPT_ROUNDS),
              role: "institution",
              name: inst.name,
              referenceId: inst.id,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) {
      console.warn("Could not seed from Supabase:", e);
    }

    // Seed sedes (venues) do Supabase e estática offline
    try {
      const supabase = getSupabaseAdmin();
      let { data: venuesList } = await supabase.from("venues").select("id, name");
      
      // Se não houver sedes no Supabase, criar uma padrão para testes
      if (!venuesList || venuesList.length === 0) {
        const { data: newVenue, error: vErr } = await supabase.from("venues").insert([{
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
              passwordHash: await bcrypt.hash("sede123", BCRYPT_ROUNDS),
              role: "venue",
              name: venue.name,
              referenceId: venue.id,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) {
      console.warn("Could not seed venues from Supabase:", e);
    }

    // Garantir conta estática offline de Sede
    const venueStaticExists = accounts.find((a) => a.email === "sede@querocompetir.com.br");
    if (!venueStaticExists) {
      accounts.push({
        id: "venue-acc-static",
        email: "sede@querocompetir.com.br",
        passwordHash: await bcrypt.hash("sede123", BCRYPT_ROUNDS),
        role: "venue",
        name: "Sede Central (Arena Olímpica)",
        referenceId: "00000000-0000-0000-0000-000000000001",
        createdAt: new Date().toISOString(),
      });
    } else {
      venueStaticExists.referenceId = "00000000-0000-0000-0000-000000000001";
    }

    // Passagem de deduplicação final para garantir e-mails únicos
    const uniqueAccounts: Account[] = [];
    const seenEmails = new Set<string>();
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
      accounts: uniqueAccounts.map((a) => ({ email: a.email, role: a.role, name: a.name })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 5. LIST USERS (Super Admin)
// ---------------------------------------------------------------------------
router.get("/users", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const accounts = await loadAccountsDb();
    res.json(
      accounts.map((a) => ({
        id: a.id,
        email: a.email,
        role: a.role,
        name: a.name,
        referenceId: a.referenceId,
        createdAt: a.createdAt,
      }))
    );
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 6. DELETE USER (Super Admin)
// ---------------------------------------------------------------------------
router.delete("/users/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    let accounts = await loadAccountsDb();
    accounts = accounts.filter((a) => a.id !== req.params.id);
    saveAccountsDb(accounts);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 7. GUARDIAN ATHLETES SEARCH
// ---------------------------------------------------------------------------
router.get("/guardian/:email/athletes", requireAuth, async (req, res) => {
  const { email } = req.params;
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  try {
    const supabase = getSupabaseAdmin();
    const { data: subs, error: subError } = await supabase
      .from("athlete_subscriptions")
      .select(`
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
      const ownerIds = Array.from(new Set(subs.map((s: any) => s.tournaments?.owner_id).filter(Boolean)));
      const orgMap = new Map<string, string>();
      if (ownerIds.length > 0) {
        const { data: orgs } = await supabase
          .from("organizations")
          .select("id, name")
          .in("id", ownerIds);
        if (orgs) {
          orgs.forEach((o: any) => orgMap.set(o.id, o.name));
        }
      }
      
      const enriched = subs.map((s: any) => {
        const ownerId = s.tournaments?.owner_id;
        return {
          ...s,
          organizer_name: ownerId ? orgMap.get(ownerId) : "Organizador"
        };
      });
      
      return res.json(enriched);
    }

    const DATA_FILE = path.join(process.cwd(), "src/backend/data/subscriptions.json");
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const db = JSON.parse(raw);
      return res.json(db.athleteSubscriptions || []);
    }
    res.json([]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
