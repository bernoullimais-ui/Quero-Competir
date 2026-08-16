import { useState, useEffect, useCallback, useMemo } from "react";
import {
  MessageCircle, Send, Users, CheckCircle2, Clock, Filter,
  AlertCircle, ChevronDown, Image, FileText, X, Loader2,
  History, Settings2, Eye, Hash, Trophy, Building2, User, Phone, Search
} from "lucide-react";

const VARIABLE_TAGS = [
  { label: "{nome_atleta}", desc: "Nome do atleta" },
  { label: "{torneio}", desc: "Nome do torneio" },
  { label: "{provas}", desc: "Provas inscritas" },
  { label: "{valor}", desc: "Valor da inscrição" },
  { label: "{link}", desc: "Link de pagamento" },
];

interface WhatsAppBroadcastTabProps {
  tournamentId: string;
  tournamentName: string;
  categories?: any[];
  institutions?: any[];
  authToken?: string;
  orgId?: string;
}

export default function WhatsAppBroadcastTab({
  tournamentId,
  tournamentName,
  categories = [],
  institutions = [],
  authToken,
  orgId,
}: WhatsAppBroadcastTabProps) {
  const [activeSection, setActiveSection] = useState<"broadcast" | "history" | "templates">("broadcast");

  // Broadcast state
  const [filter, setFilter] = useState("all");
  const [categoryId, setCategoryId] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [subId, setSubId] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [athleteSearch, setAthleteSearch] = useState("");
  const [athletes, setAthletes] = useState<any[]>([]);
  const [athletesLoading, setAthletesLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; errors: number; total: number } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Templates state
  const [tplPreReg, setTplPreReg] = useState("");
  const [tplConfirmed, setTplConfirmed] = useState("");
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [templatesSaved, setTemplatesSaved] = useState(false);

  // History state
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const headers = useMemo(() => ({ "Content-Type": "application/json", ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }), [authToken]);

  // Carrega atletas do torneio se o filtro for atleta específico
  useEffect(() => {
    if (filter === "specific_athlete" && athletes.length === 0) {
      setAthletesLoading(true);
      fetch(`/api/tournaments/${tournamentId}/athlete-subscriptions`, { headers })
        .then(res => res.json())
        .then(data => setAthletes(Array.isArray(data) ? data : []))
        .catch(() => {})
        .finally(() => setAthletesLoading(false));
    }
  }, [filter, tournamentId, athletes.length, headers]);

  // Deduplica lista de atletas para seleção por nome/telefone
  const uniqueAthletes = useMemo(() => {
    const map = new Map<string, any>();
    for (const a of athletes) {
      const key = a.id;
      if (!map.has(key)) map.set(key, a);
    }
    return Array.from(map.values());
  }, [athletes]);

  const filteredAthletes = useMemo(() => {
    if (!athleteSearch.trim()) return uniqueAthletes;
    const term = athleteSearch.toLowerCase();
    return uniqueAthletes.filter(a =>
      (a.athlete_name || a.athleteName || "").toLowerCase().includes(term) ||
      (a.parent_phone || a.parentPhone || a.additional_data?.phone || "").includes(term) ||
      (a.document || "").includes(term)
    );
  }, [uniqueAthletes, athleteSearch]);

  // Load logs
  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/logs/${tournamentId}`, { headers });
      if (res.ok) setLogs(await res.json());
    } catch { /* ignore */ }
    finally { setLogsLoading(false); }
  }, [tournamentId, headers]);

  useEffect(() => { if (activeSection === "history") loadLogs(); }, [activeSection, loadLogs]);

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = ev => setMediaPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setMediaPreview(null);
    }
  };

  const insertVariable = (v: string) => setMessage(prev => prev + v);

  const handleBroadcast = async () => {
    if (!message.trim()) return;
    setSending(true);
    setSendResult(null);
    setSendError(null);
    try {
      let mediaUrl: string | undefined;
      let mediaName: string | undefined;

      if (mediaFile) {
        mediaUrl = mediaPreview || undefined;
        mediaName = mediaFile.name;
      }

      const body: any = {
        tournamentId,
        filter,
        message,
        ...(filter === "by_category" && categoryId ? { categoryId } : {}),
        ...(filter === "by_institution" && institutionId ? { institutionId } : {}),
        ...(filter === "specific_athlete" && subId ? { subId } : {}),
        ...(filter === "custom_phone" ? { customPhone, recipientName } : {}),
        ...(mediaUrl ? { mediaUrl, mediaName } : {}),
      };

      const res = await fetch("/api/whatsapp/broadcast", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro no envio da mensagem");
      setSendResult(data);
      loadLogs();
    } catch (e: any) {
      setSendError(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleSaveTemplates = async () => {
    setSavingTemplates(true);
    try {
      await fetch(`/api/admin/organizations/${orgId}/whatsapp-templates`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ tplPreReg, tplConfirmed }),
      });
      setTemplatesSaved(true);
      setTimeout(() => setTemplatesSaved(false), 3000);
    } catch { /* ignore */ }
    finally { setSavingTemplates(false); }
  };

  const filterOptions = [
    { value: "all", label: "Todos os atletas", icon: Users },
    { value: "confirmed", label: "Apenas confirmados", icon: CheckCircle2 },
    { value: "pending", label: "Apenas pendentes", icon: Clock },
    { value: "by_category", label: "Por prova/categoria", icon: Trophy },
    { value: "by_institution", label: "Por clube/instituição", icon: Building2 },
    { value: "specific_athlete", label: "Atleta específico", icon: User },
    { value: "custom_phone", label: "Digitar número avulso", icon: Phone },
  ];

  const msgTypeLabel: Record<string, string> = {
    pre_registration: "Pré-inscrição",
    confirmed: "Confirmação",
    cart_recovery: "Lembrete",
    broadcast: "Comunicado",
    test: "Teste",
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center">
          <MessageCircle size={20} className="text-green-600" />
        </div>
        <div>
          <h2 className="text-base font-black text-slate-800">Comunicação WhatsApp</h2>
          <p className="text-xs text-slate-500">Disparo em massa, lembretes e configurações de mensagens automáticas</p>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {[
          { id: "broadcast", label: "Disparar", icon: Send },
          { id: "history", label: "Histórico", icon: History },
          { id: "templates", label: "Templates", icon: Settings2 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeSection === id
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ── BROADCAST ─────────────────────────────────────────── */}
      {activeSection === "broadcast" && (
        <div className="space-y-4">
          {/* Filtro de destinatários */}
          <div>
            <p className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Destinatários</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {filterOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                    filter === value
                      ? "border-green-400 bg-green-50 text-green-700 ring-2 ring-green-400/20"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            {filter === "by_category" && (
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="">Selecione uma prova...</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            {filter === "by_institution" && (
              <select
                value={institutionId}
                onChange={e => setInstitutionId(e.target.value)}
                className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="">Selecione um clube...</option>
                {institutions.map((i: any) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            )}
            {filter === "specific_athlete" && (
              <div className="mt-3 space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={athleteSearch}
                    onChange={e => setAthleteSearch(e.target.value)}
                    placeholder="Buscar por nome, telefone ou documento..."
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-700 bg-white"
                  />
                </div>
                {athletesLoading ? (
                  <div className="flex items-center justify-center py-3 text-slate-400 gap-2 text-xs">
                    <Loader2 size={14} className="animate-spin" /> Carregando inscritos...
                  </div>
                ) : (
                  <select
                    value={subId}
                    onChange={e => setSubId(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
                  >
                    <option value="">Selecione um atleta ({filteredAthletes.length} inscritos)...</option>
                    {filteredAthletes.map((a: any) => {
                      const name = a.athlete_name || a.athleteName || "Atleta";
                      const phone = a.parent_phone || a.parentPhone || a.additional_data?.phone || "Sem telefone";
                      return (
                        <option key={a.id} value={a.id}>
                          {name} — 📞 {phone}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            )}
            {filter === "custom_phone" && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Telefone WhatsApp</label>
                  <input
                    type="text"
                    value={customPhone}
                    onChange={e => setCustomPhone(e.target.value)}
                    placeholder="Ex: (71) 99914-1491"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nome do Contato (opcional)</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={e => setRecipientName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Editor de mensagem */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black text-slate-600 uppercase tracking-wider">Mensagem</p>
              <div className="flex gap-1 flex-wrap justify-end">
                {VARIABLE_TAGS.map(v => (
                  <button
                    key={v.label}
                    onClick={() => insertVariable(v.label)}
                    title={v.desc}
                    className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg hover:bg-indigo-100 transition"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={6}
              placeholder={`Olá {nome_atleta}! 👋\n\nEsta é uma mensagem do torneio *${tournamentName}*.`}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-green-400/30 focus:border-green-400"
            />
            <p className="text-[10px] text-slate-400 mt-1">{message.length} caracteres</p>
          </div>

          {/* Upload de mídia */}
          <div>
            <p className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Mídia (opcional)</p>
            {mediaFile ? (
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                {mediaPreview ? (
                  <img src={mediaPreview} alt="" className="w-12 h-12 object-cover rounded-lg" />
                ) : (
                  <div className="w-12 h-12 bg-slate-200 rounded-lg flex items-center justify-center">
                    <FileText size={20} className="text-slate-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">{mediaFile.name}</p>
                  <p className="text-[10px] text-slate-400">{(mediaFile.size / 1024).toFixed(0)} KB</p>
                </div>
                <button onClick={() => { setMediaFile(null); setMediaPreview(null); }}
                  className="p-1.5 text-slate-400 hover:text-rose-500 transition">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-3 p-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-green-400 hover:bg-green-50/50 transition group">
                <Image size={18} className="text-slate-400 group-hover:text-green-500 transition" />
                <span className="text-xs text-slate-500 group-hover:text-green-600 font-semibold">
                  Clique para anexar imagem ou PDF
                </span>
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleMediaChange} />
              </label>
            )}
          </div>

          {/* Pré-visualização */}
          {message && (
            <div className="bg-[#e9fbe5] rounded-2xl p-4 space-y-1">
              <div className="flex items-center gap-1.5 mb-2">
                <Eye size={12} className="text-green-700" />
                <p className="text-[10px] font-black text-green-700 uppercase tracking-wider">Pré-visualização</p>
              </div>
              {mediaPreview && <img src={mediaPreview} alt="" className="w-full max-h-40 object-cover rounded-xl mb-2" />}
              <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed font-medium">
                {message
                  .replace(/\{nome_atleta\}/g, "João Silva")
                  .replace(/\{torneio\}/g, tournamentName)
                  .replace(/\{provas\}/g, "100m Livre, 200m Livre")
                  .replace(/\{valor\}/g, "R$ 30,00")
                  .replace(/\{link\}/g, "querocompetir.com.br/...")
                }
              </p>
              <p className="text-[9px] text-slate-400 text-right mt-1">Via WhatsApp · uTalk</p>
            </div>
          )}

          {/* Resultado */}
          {sendResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              <div>
                <p className="text-xs font-black text-emerald-800">Disparo concluído!</p>
                <p className="text-[11px] text-emerald-700">
                  {sendResult.sent} enviadas · {sendResult.errors} erros · {sendResult.total} total
                </p>
              </div>
            </div>
          )}

          {sendError && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3">
              <AlertCircle size={18} className="text-rose-500 shrink-0" />
              <p className="text-xs font-semibold text-rose-700">{sendError}</p>
            </div>
          )}

          <button
            onClick={handleBroadcast}
            disabled={
              !message.trim() ||
              sending ||
              (filter === "by_category" && !categoryId) ||
              (filter === "by_institution" && !institutionId) ||
              (filter === "specific_athlete" && !subId) ||
              (filter === "custom_phone" && !customPhone.trim())
            }
            className="w-full bg-green-600 text-white py-3 rounded-2xl font-black text-sm hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-green-600/20"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? "Enviando..." : "Disparar Mensagem"}
          </button>
        </div>
      )}

      {/* ── HISTÓRICO ─────────────────────────────────────────── */}
      {activeSection === "history" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-slate-600 uppercase tracking-wider">Últimas mensagens enviadas</p>
            <button onClick={loadLogs} className="text-xs text-indigo-600 font-bold hover:underline">Atualizar</button>
          </div>
          {logsLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <MessageCircle size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold">Nenhuma mensagem enviada ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${log.status === "sent" ? "bg-green-500" : "bg-rose-500"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                        {msgTypeLabel[log.message_type] || log.message_type}
                      </span>
                      {log.athlete_name && (
                        <span className="text-[10px] font-semibold text-slate-600 truncate">{log.athlete_name}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {log.phone} · {new Date(log.created_at).toLocaleString("pt-BR")}
                    </p>
                    {log.error_detail && (
                      <p className="text-[10px] text-rose-500 mt-0.5 truncate">{log.error_detail}</p>
                    )}
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    log.status === "sent" ? "bg-green-50 text-green-700" : "bg-rose-50 text-rose-700"
                  }`}>
                    {log.status === "sent" ? "✓" : "✗"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TEMPLATES ─────────────────────────────────────────── */}
      {activeSection === "templates" && (
        <div className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-black text-amber-800 mb-1">Variáveis disponíveis nos templates</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {VARIABLE_TAGS.map(v => (
                <span key={v.label} className="text-[10px] font-mono bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                  {v.label} → {v.desc}
                </span>
              ))}
              <span className="text-[10px] font-mono bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{"{pix_block}"} → Chave PIX</span>
              <span className="text-[10px] font-mono bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{"{protocolo}"} → ID da inscrição</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 mb-2">🔔 Template: Pré-Inscrição Realizada</label>
            <textarea
              value={tplPreReg}
              onChange={e => setTplPreReg(e.target.value)}
              rows={7}
              placeholder={`🏆 *{torneio}*\n\nOlá, *{nome_atleta}*! Sua pré-inscrição foi recebida. ✅\n\n📋 Prova(s): {provas}\n💰 Taxa: {valor}\n\n{pix_block}`}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 mb-2">✅ Template: Inscrição Confirmada (Pagamento Aprovado)</label>
            <textarea
              value={tplConfirmed}
              onChange={e => setTplConfirmed(e.target.value)}
              rows={6}
              placeholder={`✅ *Inscrição Confirmada!*\n\n*{nome_atleta}* está confirmado(a) em *{torneio}*! 🎉\n\n📋 Prova(s): {provas}\n🆔 Protocolo: {protocolo}`}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
            />
          </div>

          {templatesSaved && (
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
              <CheckCircle2 size={14} /> Templates salvos com sucesso!
            </div>
          )}

          <button
            onClick={handleSaveTemplates}
            disabled={savingTemplates}
            className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-black text-sm hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {savingTemplates ? <Loader2 size={16} className="animate-spin" /> : <Settings2 size={16} />}
            Salvar Templates
          </button>
        </div>
      )}
    </div>
  );
}
