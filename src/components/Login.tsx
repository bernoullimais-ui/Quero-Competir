import React, { useState, useEffect } from "react";
import { Activity, Shield, Building2, Users, ArrowRight, Check, AlertCircle, Eye, EyeOff, Sparkles, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [activeTab, setActiveTab] = useState<"organizer" | "institution" | "guardian" | "super_admin" | "venue">("organizer");
  const [isSignUp, setIsSignUp] = useState(false); // only for guardians
  
  // Input fields
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [selectedInstId, setSelectedInstId] = useState("");

  // Seed default demonstration users
  const [seededUsers, setSeededUsers] = useState<any>(null);

  useEffect(() => {
    // Fetch available institutions to link new institution accounts or select in demo
    fetch("/api/institutions")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setInstitutions(data);
          if (data.length > 0) setSelectedInstId(data[0].id);
        }
      })
      .catch(console.error);
  }, []);

  const handleSeedAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/seed", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSeededUsers(data.accounts);
        setSuccessMessage("Contas padrão configuradas! Selecionamos as credenciais abaixo para você.");
        // Auto-fill standard credentials depending on who is logging in
        const firstUser = data.accounts.find((a: any) => a.role === activeTab);
        if (firstUser) {
          setEmail(firstUser.email);
          let defaultPass = "admin123";
          if (activeTab === "organizer") defaultPass = "org123";
          else if (activeTab === "institution") defaultPass = "clube123";
          else if (activeTab === "venue") defaultPass = "sede123";
          setPassword(firstUser.defaultPassword || defaultPass);
        }
      } else {
        setError("Erro ao semear banco de dados.");
      }
    } catch (err: any) {
      setError("Falha na conexão de auto-semente: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (seededUsers) {
      const matched = seededUsers.find((a: any) => a.role === activeTab);
      if (matched) {
        setEmail(matched.email);
        let defaultPass = "admin123";
        if (activeTab === "organizer") defaultPass = "org123";
        else if (activeTab === "institution") defaultPass = "clube123";
        else if (activeTab === "venue") defaultPass = "sede123";
        setPassword(matched.defaultPassword || defaultPass);
      } else if (activeTab === "super_admin") {
        setEmail("admin@querocompetir.com.br");
        setPassword("admin123");
      } else if (activeTab === "organizer") {
        setEmail("organizador@querocompetir.com.br");
        setPassword("org123");
      } else if (activeTab === "venue") {
        setEmail("sede@querocompetir.com.br");
        setPassword("sede123");
      } else {
        setEmail("");
        setPassword("");
      }
    }
  }, [activeTab, seededUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    const endpoint = isSignUp ? "/api/auth/register" : "/api/auth/login";
    const payload = isSignUp
      ? {
          email,
          password,
          name,
          role: "guardian"
        }
      : {
          email,
          password,
          role: activeTab
        };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMessage(isSignUp ? "Cadastro realizado com sucesso!" : "Login efetuado com sucesso!");
        setTimeout(() => {
          onLoginSuccess(data);
        }, 800);
      } else {
        setError(data.error || "Erro ao realizar operação.");
      }
    } catch (err: any) {
      setError("Erro ao conectar com o servidor: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Decorative colored glow orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Hub Wrapper */}
      <div className="relative w-full max-w-[500px]" id="login-container">
        {/* Brand Banner */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 mb-3 hover:scale-105 duration-300">
            <Activity size={32} />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Quero Competir</h1>
          <p className="text-sm text-slate-400 mt-1 font-medium">Gestão integrada de ligas e torneios esportivos</p>
        </div>

        {/* Auth Box */}
        <div className="bg-slate-900/85 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden" id="login-card">
          
          {/* Header Action to Seed Accounts for Demonstrations */}
          <div className="mb-6 flex justify-between items-center bg-slate-800/40 px-4 py-3 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold">
              <Sparkles size={14} className="animate-pulse" />
              <span>Ambiente Demonstrativo</span>
            </div>
            <button
              type="button"
              onClick={handleSeedAccounts}
              disabled={loading}
              className="text-[10px] uppercase font-extrabold tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white py-1 px-2.5 rounded-lg transition duration-150 disabled:opacity-50"
            >
              Autogerar Contas
            </button>
          </div>

          {!isSignUp && (
            /* Multi-role Navigation Tabs */
            <div className="grid grid-cols-5 gap-1 p-1 bg-slate-950 rounded-2xl mb-6 border border-slate-800/50">
              {[
                { id: "organizer", label: "Org", icon: Shield },
                { id: "institution", label: "Clube", icon: Building2 },
                { id: "venue", label: "Sede", icon: MapPin },
                { id: "guardian", label: "Pais", icon: Users },
                { id: "super_admin", label: "Adm", icon: Activity }
              ].map((roleTab) => {
                const Icon = roleTab.icon;
                const isSelected = activeTab === roleTab.id;
                return (
                  <button
                    key={roleTab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(roleTab.id as any);
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all duration-200 flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-lg"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                    }`}
                  >
                    <Icon size={14} />
                    <span>{roleTab.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Tab Subtitle */}
          <div className="mb-6 text-center">
            {isSignUp ? (
              <>
                <h2 className="text-xl font-bold text-white">Criar Novo Acesso</h2>
                <p className="text-xs text-slate-400 mt-1 font-medium">Cadastre-se como gestor responsável por atletas</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-white">
                  {activeTab === "super_admin" && "Super Admin (SaaS Manager)"}
                  {activeTab === "organizer" && "Portal de Organizadores"}
                  {activeTab === "institution" && "Acesso da Instituição / Clube"}
                  {activeTab === "venue" && "Acesso da Sede / Quadra"}
                  {activeTab === "guardian" && "Acesso de Pais / Responsáveis"}
                </h2>
                <p className="text-xs text-slate-405 mt-1 font-medium">
                  {activeTab === "super_admin" && "Gerencie permissões, organizações e faturas globais"}
                  {activeTab === "organizer" && "Gerencie tabelas de jogos, árbitros e inscrições"}
                  {activeTab === "institution" && "Pré-inscreva atletas, controle escalações e veja partidas"}
                  {activeTab === "venue" && "Gerencie disponibilidades de quadras, datas indisponíveis e veja a lista de visitantes"}
                  {activeTab === "guardian" && "Preencha termos de aceite, envie fichas de saúde e faça pagamentos"}
                </p>
              </>
            )}
          </div>

          {/* Feedback banners */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mb-4 p-4 rounded-xl bg-red-950/50 border border-red-900/50 text-red-400 text-xs flex items-start gap-2 font-semibold leading-relaxed"
                id="login-error-banner"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            {successMessage && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mb-4 p-4 rounded-xl bg-emerald-950/50 border border-emerald-900/50 text-emerald-400 text-xs flex items-start gap-2 font-semibold leading-relaxed"
                id="login-success-banner"
              >
                <Check size={16} className="shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sign-in / Sign-up Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Name field (for Sign-up only) */}
            {isSignUp && (
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-sm text-white font-medium outline-none transition duration-150"
                />
              </div>
            )}

            {/* Email field */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Endereço de E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@dominio.com"
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-sm text-white font-medium outline-none transition duration-150"
              />
            </div>

            {/* Password field */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Senha secreta
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-500 hover:text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1"
                >
                  {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                  <span>{showPassword ? "Ocultar" : "Mostrar"}</span>
                </button>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-sm text-white font-medium outline-none transition duration-150 font-mono"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 text-sm disabled:opacity-50"
            >
              <span>{loading ? "Processando..." : isSignUp ? "Registrar e Acessar" : "Entrar no Sistema"}</span>
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          {/* Toggle between Sign Up and Sign In for Parents */}
          {(activeTab === "guardian" || isSignUp) && (
            <div className="mt-6 text-center border-t border-slate-800/80 pt-5">
              {isSignUp ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:underline transition duration-150"
                >
                  Já possui um acesso de responsável? Faça login aqui
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:underline transition duration-150"
                >
                  Novo acesso por aqui? Cadastre um acesso de responsável para acompanhar inscrições
                </button>
              )}
            </div>
          )}

          {/* Mini helper showing pre-seeded logins if needed */}
          {seededUsers && (
            <div className="mt-6 p-4 rounded-2xl bg-indigo-950/20 border border-indigo-900/30 text-[10px] text-slate-400 space-y-1.5 select-all">
              <span className="font-bold text-indigo-300 uppercase tracking-wider block mb-1">Dica de logins disponíveis:</span>
              <p>📍 Admin: <strong>admin@querocompetir.com.br</strong> (senha: <strong>admin123</strong>)</p>
              <p>📍 Organizador: <strong>organizador@querocompetir.com.br</strong> (senha: <strong>org123</strong>)</p>
              {institutions.length > 0 && (
                <p>📍 Clube Demo: <strong>{institutions[0].name.toLowerCase().replace(/\s+/g, "").substring(0, 15)}@querocompetir.com.br</strong> (senha: <strong>clube123</strong>)</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
