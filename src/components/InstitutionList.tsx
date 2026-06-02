import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { 
  Building2, Plus, Search, Check, Loader2, 
  Copy, MessageSquare, Mail, Share2, FileText 
} from "lucide-react";
import { useToast } from "./ui/Toast.tsx";

export default function InstitutionList() {
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"my" | "platform">("my");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // States for Invitation Link Generation
  const [inviteInstitutionName, setInviteInstitutionName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [loadingTournaments, setLoadingTournaments] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const getHeaders = (extraHeaders: any = {}) => {
    const headersObj: any = { ...extraHeaders };
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        if (user && user.token) {
          headersObj["Authorization"] = `Bearer ${user.token}`;
        }
        if (user && user.id) {
          headersObj["x-organizer-id"] = user.id;
        }
      } catch (e) {}
    }
    return headersObj;
  };

  const fetchMyInstitutions = () => {
    setLoading(true);
    fetch("/api/institutions", { headers: getHeaders() })
      .then(res => res.json())
      .then(data => {
        setInstitutions(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  const fetchTournaments = () => {
    setLoadingTournaments(true);
    fetch("/api/tournaments", { headers: getHeaders() })
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setTournaments(list);
        if (list.length > 0) {
          setSelectedTournamentId(list[0].id);
        }
        setLoadingTournaments(false);
      })
      .catch(err => {
        console.error("Error fetching tournaments:", err);
        setLoadingTournaments(false);
      });
  };

  useEffect(() => {
    if (activeTab === "my") {
      fetchMyInstitutions();
    } else {
      fetchTournaments();
    }
  }, [activeTab]);

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTournamentId) {
      toastWarning("É necessário selecionar um torneio para o qual efetuar o convite de adesão.");
      return;
    }

    setGeneratingInvite(true);
    setGeneratedInvite(null);
    setCopiedLink(false);
    setCopiedWhatsApp(false);
    setCopiedEmail(false);

    try {
      const res = await fetch("/api/institutions/invite/generate", {
        method: "POST",
        headers: getHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ 
          institutionName: inviteInstitutionName, 
          email: inviteEmail,
          tournamentId: selectedTournamentId
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGeneratedInvite(data.invitation);
        toastSuccess("Convite gerado com sucesso!");
      } else {
        toastError(data.error || "Erro ao gerar convite.");
      }
    } catch (err) {
      console.error(err);
      toastError("Erro ao conectar com o servidor.");
    } finally {
      setGeneratingInvite(false);
    }
  };

  const getWhatsAppText = () => {
    if (!generatedInvite) return "";
    const nameStr = generatedInvite.institutionName ? ` ${generatedInvite.institutionName}` : "";
    const linkStr = `${window.location.origin}/invite/${generatedInvite.id}`;
    const tName = generatedInvite.tournamentName || "nosso torneio";
    return `Olá${nameStr}! Convidamos sua instituição para participar e inscrever seus atletas no torneio "${tName}" através da plataforma "Quero Competir"!

Acesse o link abaixo para aceitar o convites, confirmar sua participação e compartilhar seus dados e atletas conosco com apenas um clique, ou crie seu cadastro completo na plataforma caso ainda não possua conta:
${linkStr}

Atenciosamente,
${generatedInvite.organizerName}`;
  };

  const getEmailText = () => {
    if (!generatedInvite) return "";
    const linkStr = `${window.location.origin}/invite/${generatedInvite.id}`;
    const tName = generatedInvite.tournamentName || "nosso torneio";
    return `Assunto: Convite de Inscrição no Torneio: ${tName} - Quero Competir

Olá,

Você foi convidado a integrar a sua instituição e registrar seus atletas no torneio "${tName}", sob organização de "${generatedInvite.organizerName}" na plataforma Quero Competir.

Ao acessar o link de adesão abaixo, você poderá realizar o login com seu e-mail e senha cadastrados para confirmar sua inscrição no torneio de forma instantânea e automática, ou realizar um novo cadastro completo da sua instituição de forma automática caso ainda não possua conta na plataforma.

Link para adesão e confirmação de presença: ${linkStr}

Atenciosamente,
${generatedInvite.organizerName}`;
  };

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredList = institutions.filter(inst => {
    const q = searchQuery.toLowerCase();
    return (
      inst.name?.toLowerCase().includes(q) ||
      inst.document_number?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Instituições</h1>
          <p className="text-slate-500 text-sm">Gerencie clubes, escolas e parcerias credenciadas no sistema</p>
        </div>
        <Link 
          to="/instituicoes/new" 
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-indigo-100 hover:bg-indigo-700 flex items-center gap-2 whitespace-nowrap"
        >
          <Plus size={20} />
          Nova Instituição
        </Link>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => { setActiveTab("my"); setSearchQuery(""); }}
          className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 -mb-px ${
            activeTab === "my" 
              ? "border-indigo-600 text-indigo-600 font-bold" 
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Minhas Instituições ({institutions.length})
        </button>
        <button
          onClick={() => { setActiveTab("platform"); }}
          className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 -mb-px ${
            activeTab === "platform" 
              ? "border-indigo-600 text-indigo-600 font-bold" 
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Convidar via WhatsApp / E-mail
        </button>
      </div>

      {activeTab === "my" ? (
        <>
          {/* Search Input Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar instituição pelo nome ou CNPJ..."
              className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none transition-all shadow-sm"
            />
          </div>

          {/* Main Grid display */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 animate-pulse h-48" />
              ))
            ) : filteredList.length > 0 ? (
              filteredList.map(inst => (
                <div key={inst.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group border-b-4 border-b-transparent hover:border-b-indigo-500 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 overflow-hidden">
                        {inst.logo_url ? (
                          <img 
                            src={inst.logo_url} 
                            alt={inst.name} 
                            className="w-full h-full object-contain bg-white" 
                            onError={(e: any) => { 
                              e.target.style.display = 'none'; 
                              e.target.nextElementSibling.style.display = 'block'; 
                            }} 
                          />
                        ) : null}
                        <Building2 size={24} style={{ display: inst.logo_url ? 'none' : 'block' }} />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ativo</span>
                      </div>
                    </div>
                    <h3 className="font-bold text-lg mb-1 truncate">{inst.name}</h3>
                    <p className="text-sm text-slate-500 mb-4">{inst.document_number || "Documento não informado"}</p>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                    <Link to={`/portal/institution/${inst.id}`} target="_blank" className="text-slate-500 hover:text-indigo-600 text-sm font-bold flex items-center gap-1">
                      Ver Portal
                    </Link>
                    <Link to={`/instituicoes/${inst.id}/edit`} className="text-indigo-600 text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      Editar
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <Building2 className="mx-auto mb-4 text-slate-300" size={48} />
                <h3 className="text-lg font-bold">Nenhuma instituição encontrada</h3>
                <p className="text-slate-500 text-sm mb-6">
                  Nenhuma instituição sob sua gestão direta encontrada.
                </p>
                <button 
                  onClick={() => { setActiveTab("platform"); }} 
                  className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                >
                  Conidar nova instituição por link
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Invitation Generation UI */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-12">
            {tournaments.length === 0 && !loadingTournaments && (
              <div className="mb-6 p-4 bg-amber-50 text-amber-800 rounded-2xl border border-amber-200 text-sm font-medium flex items-center justify-between">
                <span>Você precisa de pelo menos um torneio com status ativo para gerar convites de adesão para eventos específicos.</span>
                <Link to="/torneios/new" className="bg-amber-600 text-white px-4 py-2 rounded-xl hover:bg-amber-700 transition-all font-semibold text-xs whitespace-nowrap ml-4">
                  Criar Primeiro Torneio
                </Link>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div>
                <h2 className="font-bold text-lg text-slate-800">Convidar para Evento</h2>
                <p className="text-sm text-slate-500">Conecte e inscreva instantaneamente uma instituição em um torneio promovido por você.</p>
              </div>

              <form onSubmit={handleGenerateInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Selecione o Torneio Alvo</label>
                  {loadingTournaments ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500 py-3 bg-slate-50 rounded-xl px-4 border border-slate-150">
                      <Loader2 size={14} className="animate-spin text-indigo-500" />
                      Carregando torneios...
                    </div>
                  ) : tournaments.length === 0 ? (
                    <div className="p-3.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-semibold border border-rose-100">
                      Nenhum torneio disponível. Crie um novo torneio para poder convidar instituições.
                    </div>
                  ) : (
                    <select
                      value={selectedTournamentId}
                      onChange={(e) => setSelectedTournamentId(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none text-sm transition-all bg-white font-medium text-slate-700"
                    >
                      {tournaments.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Clube/Instituição (Opcional)</label>
                  <input 
                    type="text"
                    value={inviteInstitutionName}
                    onChange={(e) => setInviteInstitutionName(e.target.value)}
                    placeholder="Ex: Flamengo, Escola Pan Americana"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none text-sm transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">E-mail de Contato (Opcional)</label>
                  <input 
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Ex: coordenacao@clube.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none text-sm transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={generatingInvite}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-50 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50"
                >
                  {generatingInvite ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Gerando Convite...
                    </>
                  ) : (
                    <>
                      <Share2 size={18} />
                      Gerar Link e Convites
                    </>
                  )}
                </button>
              </form>
            </div>
            
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-150 space-y-3">
              <h3 className="font-bold text-sm text-slate-700 flex items-center gap-2">
                <Building2 size={16} className="text-indigo-500" />
                Como funciona a adesão de evento?
              </h3>
              <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside">
                <li>O convidado recebe o link seguro de adesão para o torneio selecionado.</li>
                <li>Se ele **já possui cadastro**, ele realiza o login para confirmar a presença de sua instituição e inscrever a equipe de forma instantânea.</li>
                <li>Se ele **não possui cadastro**, ele se cadastra rapidamente e a nova conta é automaticamente vinculada ao torneio de forma integrada.</li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-7">
            {generatedInvite ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 animate-fade-in">
                <div>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wider">Convite Gerado</span>
                  <h2 className="font-bold text-xl text-slate-800 mt-2">
                    {generatedInvite.institutionName ? `Convite para ${generatedInvite.institutionName}` : "Convite Público de Adesão"}
                  </h2>
                  <p className="text-sm text-slate-500">Copie o link seguro ou envie os textos personalizados de WhatsApp e E-mail estruturados abaixo:</p>
                </div>

                {/* Secure Link Row */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Link de Adesão Seguro</p>
                    <p className="text-sm font-semibold font-mono text-indigo-600 truncate mt-1">
                      {window.location.origin}/invite/{generatedInvite.id}
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(`${window.location.origin}/invite/${generatedInvite.id}`, setCopiedLink)}
                    className={`px-4 py-2.5 rounded-lg text-xs font-bold font-sans flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      copiedLink ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"
                    }`}
                  >
                    {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                    {copiedLink ? "Copiado!" : "Copiar Link"}
                  </button>
                </div>

                {/* Tabs for Message Templates */}
                <div className="space-y-4">
                  {/* WhatsApp Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <MessageSquare size={14} className="text-emerald-500" />
                        Texto para WhatsApp
                      </span>
                      <button
                        onClick={() => copyToClipboard(getWhatsAppText(), setCopiedWhatsApp)}
                        className={`text-xs font-semibold flex items-center gap-1 ${copiedWhatsApp ? "text-emerald-600" : "text-indigo-600 hover:text-indigo-700"}`}
                      >
                        {copiedWhatsApp ? <Check size={12} /> : <Copy size={12} />}
                        {copiedWhatsApp ? "Copiado!" : "Copiar Mensagem"}
                      </button>
                    </div>
                    <pre className="p-4 bg-emerald-50/40 text-slate-700 text-xs rounded-xl border border-emerald-100 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                      {getWhatsAppText()}
                    </pre>
                  </div>

                  {/* Email Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Mail size={14} className="text-blue-500" />
                        Texto para E-mail
                      </span>
                      <button
                        onClick={() => copyToClipboard(getEmailText(), setCopiedEmail)}
                        className={`text-xs font-semibold flex items-center gap-1 ${copiedEmail ? "text-emerald-600" : "text-indigo-600 hover:text-indigo-700"}`}
                      >
                        {copiedEmail ? <Check size={12} /> : <Copy size={12} />}
                        {copiedEmail ? "Copiado!" : "Copiar Email"}
                      </button>
                    </div>
                    <pre className="p-4 bg-blue-50/30 text-slate-700 text-xs rounded-xl border border-blue-100 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                      {getEmailText()}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[300px] border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-center p-8 bg-slate-50/50">
                <FileText size={48} className="text-slate-350 mb-3" />
                <h3 className="font-bold text-slate-700">Aguardando dados...</h3>
                <p className="text-slate-500 text-sm max-w-sm mt-1">Preencha os campos ao lado e clique em "Gerar" para obter links e templates personalizados de convite.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
