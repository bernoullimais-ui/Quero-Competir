import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { 
  Building2, ArrowRight, ShieldCheck, UserCheck, 
  UserPlus, Mail, Lock, Phone, User, FileText, Loader2, Play 
} from "lucide-react";

interface PublicInvitationPageProps {
  onLoginSuccess: (user: any) => void;
}

export default function PublicInvitationPage({ onLoginSuccess }: PublicInvitationPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Invite states
  const [invitation, setInvitation] = useState<any>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [errorInvite, setErrorInvite] = useState<string | null>(null);

  // Flow states
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Tab 1 Form: Existing account
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Tab 2 Form: New account
  const [registerName, setRegisterName] = useState("");
  const [registerDoc, setRegisterDoc] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerRespName, setRegisterRespName] = useState("");
  const [registerRespPhone, setRegisterRespPhone] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoadingInvite(true);
    fetch(`/api/institutions/invite/public/${id}`)
      .then(res => {
        if (!res.ok) throw new Error("Convite expirado ou inexistente.");
        return res.json();
      })
      .then(data => {
        setInvitation(data);
        if (data.institutionName) {
          setRegisterName(data.institutionName);
        }
        if (data.email) {
          setRegisterEmail(data.email);
        }
        setLoadingInvite(false);
      })
      .catch(err => {
        console.error(err);
        setErrorInvite(err.message || "Não foi possível carregar o convite.");
        setLoadingInvite(false);
      });
  }, [id]);

  const handleAcceptExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setActionError("Por favor preencha o e-mail e a senha cadastrados.");
      return;
    }

    setSubmitting(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/institutions/invite/public/${id}/accept-existing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();

      if (res.ok && data.id) {
        // Success! Log them in automatically
        onLoginSuccess(data);
        // Redirect directly to their newly populated institution portal!
        navigate(`/portal/institution/${data.referenceId}`);
      } else {
        setActionError(data.error || "Credenciais inválidas ou erro ao aceitar convite.");
      }
    } catch (err) {
      console.error(err);
      setActionError("Falha de conexão com o servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerName || !registerEmail || !registerPassword) {
      setActionError("Nome da instituição, e-mail e senha são campos obrigatórios.");
      return;
    }

    setSubmitting(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/institutions/invite/public/${id}/accept-new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: registerName,
          document_number: registerDoc,
          email: registerEmail,
          password: registerPassword,
          responsible_name: registerRespName,
          responsible_phone: registerRespPhone
        })
      });
      const data = await res.json();

      if (res.ok && data.id) {
        onLoginSuccess(data);
        navigate(`/portal/institution/${data.referenceId}`);
      } else {
        setActionError(data.error || "Não foi possível criar o cadastro da instituição.");
      }
    } catch (err) {
      console.error(err);
      setActionError("Erro ao comunicar com a plataforma.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInvite) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 size={44} className="text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 text-sm font-semibold">Carregando convite seguro...</p>
      </div>
    );
  }

  if (errorInvite || !invitation) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-4">
          <FileText size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Convite Invalido ou Expirado</h2>
        <p className="text-slate-500 text-sm mt-1 max-w-sm">Este link de convite pode ter expirado ou não estar registrado em nossos servidores.</p>
        <button
          onClick={() => navigate("/")}
          className="mt-6 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all"
        >
          Voltar para Início
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        
        {/* Visual Info Column */}
        <div className="md:col-span-5 space-y-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
              <span className="text-xs font-bold font-sans text-slate-600">Adesão por Evento</span>
            </div>
            
            <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight leading-tight">
              Inscrição e Convite
            </h1>
            
            {/* Tournament Details Box */}
            <div className="p-6 bg-gradient-to-br from-indigo-600 to-slate-900 text-white shadow-xl shadow-indigo-100/50 rounded-3xl space-y-4 border border-indigo-600">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Torneio Vinculado</p>
              <div className="flex items-center gap-3">
                {invitation.tournamentLogoUrl ? (
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shrink-0 border border-indigo-400/40 overflow-hidden shadow-sm">
                    <img 
                      src={invitation.tournamentLogoUrl} 
                      alt="Logo do Torneio" 
                      className="w-full h-full object-contain p-1"
                      onError={(e: any) => {
                        e.target.style.display = 'none';
                        if (e.target.nextElementSibling) {
                          e.target.nextElementSibling.style.display = 'flex';
                        }
                      }}
                    />
                    <div className="hidden w-full h-full bg-indigo-500/25 flex items-center justify-center text-xl">
                      🏆
                    </div>
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-indigo-500/25 rounded-2xl flex items-center justify-center text-xl shrink-0 border border-indigo-400/40">
                    🏆
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-white text-lg leading-snug">{invitation.tournamentName || "Torneio"}</h3>
                  <p className="text-indigo-205/85 text-xs">Organizado por {invitation.organizerName}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-indigo-500/30 text-[11px] text-indigo-200/90 flex items-center gap-1.5 font-sans">
                <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                <span>Cadastro e autoinscrição integrados</span>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed md:pr-4">
              Seja muito bem-vindo! Ao confirmar a adesão de sua instituição através desta página segura, você será <strong>inscrito de forma imediata e automática no torneio "{invitation.tournamentName || "Torneio"}"</strong> e seus dados estarão seguros e prontos para compartilhamento com este organizador.
            </p>
          </div>

          <div className="space-y-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-505" />
              <span>Conexão Encriptada Segura Ativa</span>
            </div>
            <div className="flex items-center gap-2">
              <UserCheck size={16} className="text-indigo-550" />
              <span>Sua instituição com visibilidade exclusiva</span>
            </div>
          </div>
        </div>

        {/* Dynamic Action Forms Column */}
        <div className="md:col-span-7 bg-white p-6 md:p-8 rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-100/50 space-y-6">
          
          {/* Tabs switch */}
          <div className="grid grid-cols-2 p-1.5 bg-slate-50 rounded-xl border border-slate-100">
            <button
              onClick={() => { setActiveTab("login"); setActionError(null); }}
              className={`py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "login" 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <UserCheck size={14} />
              Já tenho Cadastro
            </button>
            <button
              onClick={() => { setActiveTab("register"); setActionError(null); }}
              className={`py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "register" 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <UserPlus size={14} />
              Novo por Aqui
            </button>
          </div>

          {actionError && (
            <div className="p-3.5 bg-rose-50 text-rose-600 text-xs font-medium rounded-xl border border-rose-100">
              {actionError}
            </div>
          )}

          {activeTab === "login" ? (
            /* CASE 1: LOGGING IN AN EXISTING CLUB ACCOUNT */
            <form onSubmit={handleAcceptExisting} className="space-y-4">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Entrar e Compartilhar Dados</h3>
                <p className="text-xs text-slate-400 mt-0.5">Utilize o e-mail e senha correspondentes ao portal da sua instituição.</p>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="Seu e-mail cadastrado"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none text-sm transition-all"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Sua senha secreta de acesso"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none text-sm transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-105 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  <>
                    <span>Confirmar Adesão e compartilhar</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* CASE 2: REGISTERING A BRAND NEW CLUB ACCOUNT */
            <form onSubmit={handleAcceptNew} className="space-y-4">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Criar meu Cadastro de Adesão</h3>
                <p className="text-xs text-slate-400 mt-0.5">Sua nova instituição herdará o convite automaticamente na plataforma.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="relative col-span-full">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    required
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="Nome completo da Instituição"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none text-sm transition-all"
                  />
                </div>

                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={registerDoc}
                    onChange={(e) => setRegisterDoc(e.target.value)}
                    placeholder="CNPJ (Opcional)"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none text-sm transition-all"
                  />
                </div>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    required
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder="E-mail de Login futuro"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none text-sm transition-all"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="password"
                    required
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="Senha de Acesso"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none text-sm transition-all"
                  />
                </div>

                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={registerRespName}
                    onChange={(e) => setRegisterRespName(e.target.value)}
                    placeholder="Nome do Responsável"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none text-sm transition-all"
                  />
                </div>

                <div className="relative col-span-full">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={registerRespPhone}
                    onChange={(e) => setRegisterRespPhone(e.target.value)}
                    placeholder="Telefone de WhatsApp do Responsável"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none text-sm transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-100 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Registrando na plataforma...
                  </>
                ) : (
                  <>
                    <span>Criar Cadastro e Aderir</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
}
