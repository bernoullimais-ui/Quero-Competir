/**
 * Validação de variáveis de ambiente obrigatórias.
 * Chame esta função no início do servidor para falhar rapidamente
 * com mensagens claras caso alguma variável crítica esteja ausente.
 */
export function validateEnv(): void {
  const errors: string[] = [];

  // ─── Obrigatórias sempre ────────────────────────────────────────────────
  const required: Record<string, string> = {
    SUPABASE_URL: "URL do projeto Supabase (ex: https://abc.supabase.co)",
    SUPABASE_SERVICE_ROLE_KEY: "Chave service_role do Supabase (Settings → API)",
    JWT_SECRET: "Segredo JWT — gere com: openssl rand -base64 48",
  };

  for (const [key, description] of Object.entries(required)) {
    if (!process.env[key]) {
      errors.push(`  ❌  ${key}\n       ${description}`);
    }
  }

  // ─── Validações adicionais ──────────────────────────────────────────────
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    errors.push(
      "  ⚠️  JWT_SECRET é muito curto (< 32 caracteres). Use: openssl rand -base64 48"
    );
  }

  if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.startsWith("https://")) {
    errors.push(
      "  ⚠️  SUPABASE_URL deve começar com https://"
    );
  }

  // ─── Aviso para variáveis recomendadas ──────────────────────────────────
  const recommended: Record<string, string> = {
    APP_URL: "URL pública do app — necessário para restrição de CORS em produção",
  };

  const warnings: string[] = [];
  if (process.env.NODE_ENV === "production") {
    for (const [key, description] of Object.entries(recommended)) {
      if (!process.env[key]) {
        warnings.push(`  ⚠️  ${key}\n       ${description}`);
      }
    }
  }

  // ─── Output ─────────────────────────────────────────────────────────────
  if (errors.length > 0) {
    const message = [
      "\n🚨  VARIÁVEIS DE AMBIENTE AUSENTES OU INVÁLIDAS:\n",
      errors.join("\n\n"),
      "\n📖  Consulte o arquivo .env.example para instruções de configuração.\n",
    ].join("\n");
    console.error(message);
    throw new Error(`Missing or invalid environment variables:\n${errors.join("\n")}`);
  }

  if (warnings.length > 0) {
    console.warn("\n⚠️   Variáveis recomendadas não configuradas:\n");
    console.warn(warnings.join("\n\n"));
    console.warn("\n");
  }
}
