import { getSupabaseAdmin } from "../lib/supabase.ts";

const DEFAULT_TPL_PRE_REGISTRATION = `🏆 *{torneio}*

Olá, *{nome_atleta}*! Sua pré-inscrição foi recebida com sucesso. ✅

📋 *Prova(s):* {provas}
💰 *Taxa:* {valor}

{pix_block}

Após a confirmação do pagamento, sua inscrição será efetivada. Qualquer dúvida, entre em contato com o organizador. 🏊`;

const DEFAULT_TPL_CONFIRMED = `✅ *Inscrição Confirmada!*

*{nome_atleta}* está confirmado(a) em *{torneio}*! 🎉

📋 *Prova(s):* {provas}
🆔 *Protocolo:* {protocolo}

Boa sorte e bom treino! 💪🏊`;

const DEFAULT_TPL_CART_RECOVERY = `⏳ *Lembrete de Inscrição Pendente*

Olá! Identificamos que a inscrição de *{nome_atleta}* em *{torneio}* ainda não foi paga.

📋 *Prova(s):* {provas}
💰 *Valor:* {valor}

{pix_block}

Garanta sua vaga! As inscrições são por ordem de pagamento. 🏆`;

export function formatPhoneBR(phone: string): string {
  let clean = (phone || "").replace(/\D/g, "");
  if (clean.length >= 10 && !clean.startsWith("55")) clean = "55" + clean;
  return clean;
}

export function replaceTemplateVars(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value || "");
  }
  return result;
}

async function resolveCredentials(orgId?: string): Promise<{
  token: string | null;
  fromPhone: string | null;
  organizationId: string | null;
  apiUrl: string;
}> {
  const globalToken = process.env.UTALK_TOKEN?.trim() || null;
  const globalFrom = process.env.UTALK_FROM_PHONE?.trim() || null;
  const globalOrgId = process.env.UTALK_ORGANIZATION_ID?.trim() || null;
  const apiUrl =
    process.env.UTALK_API_URL ||
    "https://app-utalk.umbler.com/api/v1/messages/simplified/";

  if (orgId) {
    try {
      const supabase = getSupabaseAdmin();
      const { data: org } = await supabase
        .from("organizations")
        .select("utalk_token, utalk_from_phone, utalk_organization_id")
        .eq("id", orgId)
        .maybeSingle();

      if (org?.utalk_token && org?.utalk_from_phone && org?.utalk_organization_id) {
        return {
          token: org.utalk_token,
          fromPhone: org.utalk_from_phone,
          organizationId: org.utalk_organization_id,
          apiUrl,
        };
      }
    } catch (e) {
      console.warn("[uTalk] Failed to resolve org credentials, using global:", e);
    }
  }

  return { token: globalToken, fromPhone: globalFrom, organizationId: globalOrgId, apiUrl };
}

async function logMessage(params: {
  tournamentId?: string;
  phone: string;
  messageType: string;
  athleteName?: string;
  status: "sent" | "error";
  errorDetail?: string;
  sentBy?: string;
}) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("whatsapp_logs").insert({
      tournament_id: params.tournamentId || null,
      phone: params.phone,
      message_type: params.messageType,
      athlete_name: params.athleteName || null,
      status: params.status,
      error_detail: params.errorDetail || null,
      sent_by: params.sentBy || "system",
    });
  } catch (e) {
    console.warn("[uTalk] Failed to log message:", e);
  }
}

export async function sendWhatsAppMessage(params: {
  phone: string;
  message: string;
  media?: string;
  mediaName?: string;
  orgId?: string;
  tournamentId?: string;
  messageType?: string;
  athleteName?: string;
  sentBy?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { token, fromPhone, organizationId, apiUrl } = await resolveCredentials(params.orgId);

  if (!token || !fromPhone || !organizationId) {
    console.warn("[uTalk] Credenciais não configuradas — mensagem não enviada.");
    return { success: false, error: "uTalk não configurado" };
  }

  const formattedTo = formatPhoneBR(params.phone);
  if (!formattedTo || formattedTo.length < 12) {
    return { success: false, error: "Telefone inválido" };
  }

  const payload: any = {
    toPhone: formattedTo,
    fromPhone: fromPhone.replace(/\D/g, ""),
    organizationId,
    message: params.message,
  };

  if (params.media) {
    payload.media = params.media;
    payload.mediaUrl = params.media;
    payload.mediaName = params.mediaName || "arquivo";
    payload.fileName = params.mediaName || "arquivo";
  }

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        token,
        "x-token": token,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[uTalk] API error:", res.status, text);
      await logMessage({
        tournamentId: params.tournamentId,
        phone: formattedTo,
        messageType: params.messageType || "unknown",
        athleteName: params.athleteName,
        status: "error",
        errorDetail: `${res.status}: ${text}`,
        sentBy: params.sentBy,
      });
      return { success: false, error: text };
    }

    await logMessage({
      tournamentId: params.tournamentId,
      phone: formattedTo,
      messageType: params.messageType || "unknown",
      athleteName: params.athleteName,
      status: "sent",
      sentBy: params.sentBy,
    });

    return { success: true };
  } catch (e: any) {
    console.error("[uTalk] Exception:", e.message);
    await logMessage({
      tournamentId: params.tournamentId,
      phone: formattedTo,
      messageType: params.messageType || "unknown",
      athleteName: params.athleteName,
      status: "error",
      errorDetail: e.message,
      sentBy: params.sentBy,
    });
    return { success: false, error: e.message };
  }
}

// ── High-level helpers ─────────────────────────────────────────────────────

export async function sendPreRegistrationMessage(params: {
  phone: string;
  athleteName: string;
  tournamentName: string;
  tournamentId: string;
  orgId?: string;
  categoryNames: string[];
  totalFee: number;
  pixCopyPaste?: string;
  paymentLink?: string;
  orgTemplate?: string;
}) {
  const pixBlock = params.pixCopyPaste
    ? `🔑 *PIX Copia e Cola:*\n\`${params.pixCopyPaste}\``
    : params.paymentLink
    ? `🔗 *Link de pagamento:* ${params.paymentLink}`
    : "";

  const template = params.orgTemplate || DEFAULT_TPL_PRE_REGISTRATION;
  const message = replaceTemplateVars(template, {
    torneio: params.tournamentName,
    nome_atleta: params.athleteName,
    provas: params.categoryNames.join(", "),
    valor: params.totalFee > 0 ? `R$ ${params.totalFee.toFixed(2)}` : "Gratuita",
    pix_block: pixBlock,
    link: params.paymentLink || "",
    pix: params.pixCopyPaste || "",
  });

  return sendWhatsAppMessage({
    phone: params.phone,
    message,
    orgId: params.orgId,
    tournamentId: params.tournamentId,
    messageType: "pre_registration",
    athleteName: params.athleteName,
  });
}

export async function sendConfirmedMessage(params: {
  phone: string;
  athleteName: string;
  tournamentName: string;
  tournamentId: string;
  orgId?: string;
  categoryNames: string[];
  subId: string;
  orgTemplate?: string;
}) {
  const template = params.orgTemplate || DEFAULT_TPL_CONFIRMED;
  const message = replaceTemplateVars(template, {
    torneio: params.tournamentName,
    nome_atleta: params.athleteName,
    provas: params.categoryNames.join(", "),
    protocolo: params.subId.slice(0, 8).toUpperCase(),
  });

  return sendWhatsAppMessage({
    phone: params.phone,
    message,
    orgId: params.orgId,
    tournamentId: params.tournamentId,
    messageType: "confirmed",
    athleteName: params.athleteName,
  });
}

export async function sendCartRecoveryMessage(params: {
  phone: string;
  athleteName: string;
  tournamentName: string;
  tournamentId: string;
  orgId?: string;
  categoryNames: string[];
  totalFee: number;
  pixCopyPaste?: string;
  paymentLink?: string;
  orgTemplate?: string;
  sentBy?: string;
}) {
  const pixBlock = params.pixCopyPaste
    ? `🔑 *PIX Copia e Cola:*\n\`${params.pixCopyPaste}\``
    : params.paymentLink
    ? `🔗 *Link de pagamento:* ${params.paymentLink}`
    : "";

  const template = params.orgTemplate || DEFAULT_TPL_CART_RECOVERY;
  const message = replaceTemplateVars(template, {
    torneio: params.tournamentName,
    nome_atleta: params.athleteName,
    provas: params.categoryNames.join(", "),
    valor: params.totalFee > 0 ? `R$ ${params.totalFee.toFixed(2)}` : "Gratuita",
    pix_block: pixBlock,
    link: params.paymentLink || "",
    pix: params.pixCopyPaste || "",
  });

  return sendWhatsAppMessage({
    phone: params.phone,
    message,
    orgId: params.orgId,
    tournamentId: params.tournamentId,
    messageType: "cart_recovery",
    athleteName: params.athleteName,
    sentBy: params.sentBy || "system",
  });
}

export { DEFAULT_TPL_PRE_REGISTRATION, DEFAULT_TPL_CONFIRMED, DEFAULT_TPL_CART_RECOVERY };
