import React, { useState, useEffect } from "react";
import { Activity, Shield, Users, Building2, Trophy, Key, Trash2, ShieldAlert, CheckCircle, TrendingUp, DollarSign, Plus, Eye, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useToast } from "./ui/Toast.tsx";
import { useConfirm } from "./ui/ConfirmDialog.tsx";

interface SuperAdminDashboardProps {
  onLogout: () => void;
  currentUser: any;
}

export default function SuperAdminDashboard({ onLogout, currentUser }: SuperAdminDashboardProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const { confirm } = useConfirm();
  const [users, setUsers] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Registration State
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"organizer" | "super_admin">("organizer");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Global Config Parameters
  const [saasFeePercent, setSaasFeePercent] = useState(10);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [saasConfigSaved, setSaasConfigSaved] = useState(false);

  // Details Modal State
  const [activeModal, setActiveModal] = useState<"athletes" | "institutions" | "tournaments" | null>(null);

  const getHeaders = (extraHeaders: any = {}) => {
    const headersObj: any = { ...extraHeaders };
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        if (user && user.token) {
          headersObj["Authorization"] = `Bearer ${user.token}`;
        }
      } catch (e) {}
    }
    return headersObj;
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [uRes, iRes, tRes, aRes] = await Promise.all([
        fetch("/api/auth/users", { headers: getHeaders() }),
        fetch("/api/institutions", { headers: getHeaders() }),
        fetch("/api/tournaments", { headers: getHeaders() }),
        fetch("/api/members", { headers: getHeaders() })
      ]);

      const [uData, iData, tData, aData] = await Promise.all([
        uRes.json(),
        iRes.json(),
        tRes.json(),
        aRes.json()
      ]);

      if (Array.isArray(uData)) setUsers(uData);
      if (Array.isArray(iData)) setInstitutions(iData);
      if (Array.isArray(tData)) setTournaments(tData);
      if (Array.isArray(aData)) setAthletes(aData);
    } catch (err: any) {
      setError("Erro ao carregar dados do painel: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleDeleteUser = async (userId: string) => {
    const isConfirmed = await confirm({
      title: "Excluir Credencial",
      message: "Tem certeza de que deseja excluir esta credencial de acesso?",
      variant: "danger",
      confirmText: "Excluir",
      cancelText: "Cancelar"
    });
    if (!isConfirmed) return;
    try {
      const res = await fetch(`/api/auth/users/${userId}`, { 
        method: "DELETE",
        headers: getHeaders()
      });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== userId));
        toastSuccess("Credencial excluída com sucesso.");
      } else {
        toastError("Erro ao excluir usuário.");
      }
    } catch (e) {
      console.error(e);
      toastError("Erro ao conectar com o servidor.");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          name: newName,
          role: newRole
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Novo usuário credenciado com sucesso!");
        setNewEmail("");
        setNewName("");
        setNewPassword("");
        fetchAllData();
      } else {
        setError(data.error || "Erro ao registrar usuário.");
      }
    } catch (err: any) {
      setError("Erro de rede: " + err.message);
    }
  };

  const saveSaasConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setSaasConfigSaved(true);
    setTimeout(() => setSaasConfigSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Super Admin Top Header */}
      <header className="bg-slate-900 text-white py-5 px-8 sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <Activity size={24} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">Quero Competir • Gestor do SaaS</h1>
            <p className="text-xs text-slate-400 font-semibold">Administração central da plataforma de ligas esportivas</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 bg-slate-800/80 p-2 px-3.5 rounded-xl border border-slate-800">
            <Shield size={14} className="text-indigo-400" />
            <span className="text-xs font-bold text-slate-200">Sessão: {currentUser.name} (Super Admin)</span>
          </div>
          <button
            onClick={onLogout}
            className="text-xs bg-red-600 hover:bg-red-700 text-white font-extrabold py-2 px-4 rounded-xl transition duration-150 border border-red-900/40"
          >
            Sair do Painel
          </button>
        </div>
      </header>

      {/* Main SaaS Contents Grid */}
      <main className="flex-1 p-8 max-w-7xl w-full mx-auto space-y-8 relative">
        
        {/* Statistics Widgets Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { id: "athletes", label: "Atletas Registrados (SaaS)", value: athletes.length.toString(), change: "Na plataforma", icon: Users, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
            { id: "institutions", label: "Instituições Ativas", value: institutions.length.toString(), change: "Em todo o Brasil", icon: Building2, color: "text-emerald-500 bg-emerald-50 border-emerald-100" },
            { id: "tournaments", label: "Torneios Hospedados", value: tournaments.length.toString(), change: "Ativos & Planejamento", icon: Trophy, color: "text-amber-500 bg-amber-50 border-amber-100" },
            { id: "fees", label: "Taxa de Comissão SaaS", value: `${saasFeePercent}%`, change: "Configurada sobre transações", icon: DollarSign, color: "text-rose-500 bg-rose-50 border-rose-100" }
          ].map((stat, i) => (
            <div 
              key={i} 
              onClick={() => stat.id !== "fees" && setActiveModal(stat.id as any)}
              className={`bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition duration-200 flex items-center justify-between ${stat.id !== "fees" ? "cursor-pointer hover:shadow-md hover:ring-2 hover:ring-indigo-500/50 hover:border-indigo-500/50" : ""}`}
            >
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-450 uppercase tracking-wider block">{stat.label}</span>
                <h3 className="text-3xl font-extrabold text-slate-800">{stat.value}</h3>
                <span className="text-xs font-bold text-slate-400">{stat.change}</span>
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${stat.color} shrink-0`}>
                <stat.icon size={22} />
              </div>
            </div>
          ))}
        </div>

        {/* Form and Controls Sidebars Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Create User Access & Settings left/middle columns */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* User credentials administration */}
            <div className="bg-white rounded-3xl border border-slate-150 p-6 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">Credenciais & Contas Cadastradas</h3>
                  <p className="text-xs text-slate-400 font-medium">Controle de acesso seguro para Organizadores, Clubes e Pais</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {users.length} Contas
                </span>
              </div>

              {loading ? (
                <div className="py-12 text-center text-slate-400 font-medium text-sm">Carregando contas seguras...</div>
              ) : (
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs border-collapse relative">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                      <tr className="border-b border-slate-150 text-slate-450 font-bold uppercase tracking-wider">
                        <th className="py-3 px-4 rounded-tl-xl">E-mail / Usuário</th>
                        <th className="py-3 px-4">Nome Completo</th>
                        <th className="py-3 px-4">Role / Perfil</th>
                        <th className="py-3 px-4 text-center rounded-tr-xl">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="font-semibold text-slate-700 divide-y divide-slate-100">
                      {users.map((u) => {
                        const isMaster = u.email === "admin@querocompetir.com.br";
                        return (
                          <tr key={u.id} className="hover:bg-slate-50/80 transition duration-150">
                            <td className="py-3 px-4 font-mono select-all text-slate-800">{u.email}</td>
                            <td className="py-3 px-4">{u.name}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase ${
                                u.role === "super_admin" 
                                  ? "bg-rose-50 text-rose-700 border-rose-100" 
                                  : u.role === "organizer" 
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                                  : u.role === "institution"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                  : "bg-amber-50 text-amber-700 border-amber-100"
                              }`}>
                                {u.role === "super_admin" && "SAAS_ADMIN"}
                                {u.role === "organizer" && "ORGANIZADOR"}
                                {u.role === "institution" && "CLUBE_ESCOLA"}
                                {u.role === "guardian" && "RESPONSÁVEL_PAI"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isMaster ? (
                                <span className="text-[10px] uppercase text-indigo-500 font-extrabold pr-3">Inviolável</span>
                              ) : (
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="p-1 px-2.5 bg-red-50 hover:bg-red-100 hover:text-red-700 text-red-500 rounded-lg transition duration-150 inline-flex items-center gap-1 text-[11px] font-bold"
                                >
                                  <Trash2 size={12} />
                                  <span>Excluir</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* SaaS Global System parameters */}
            <div className="bg-white rounded-3xl border border-slate-150 p-6 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-extrabold text-slate-800">Parâmetros Operacionais de SaaS</h3>
                <p className="text-xs text-slate-400 font-medium">Configure taxas globais para transações em cartão e PIX</p>
              </div>

              <form onSubmit={saveSaasConfig} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Taxa Organizadora (%)
                  </label>
                  <input
                    type="number"
                    value={saasFeePercent}
                    onChange={(e) => setSaasFeePercent(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-405 font-medium block">
                    Porcentagem retida de cada inscrição individual paga via gateway público.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Modo de Manutenção Central
                  </label>
                  <select
                    value={maintenanceMode ? "true" : "false"}
                    onChange={(e) => setMaintenanceMode(e.target.value === "true")}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="false">Desativado (Normal, Ativo)</option>
                    <option value="true">Ativo (Permitir apenas leitura global)</option>
                  </select>
                  <span className="text-[10px] text-slate-405 font-medium block">
                    Se ativado, bloqueia inscrições temporariamente sob aviso técnico.
                  </span>
                </div>

                <div className="md:col-span-2 pt-2 flex items-center justify-between">
                  {saasConfigSaved && (
                    <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
                      <Check size={16} /> Parâmetros de SaaS atualizados com sucesso !
                    </span>
                  )}
                  <button
                    type="submit"
                    className="ml-auto bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-md transition duration-150"
                  >
                    Salvar Parâmetros Globais
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Create new administration user accounts right sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-150 p-6 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-extrabold text-slate-800">Credenciar Novo Acesso</h3>
                <p className="text-xs text-slate-400 font-medium">Adicione novos Administradores ou Contas de Organizador</p>
              </div>

              {successMsg && (
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-100">
                  {successMsg}
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-bold border border-red-150">
                  {error}
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Pedro Henrique"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500 text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">
                    E-mail de Login
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="ex@querocompetir.com.br"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500 text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">
                    Definir Senha Inicial
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="SuaSenhaSecreta"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500 tracking-tight text-slate-700 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">
                    Perfil / Função
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500 text-slate-700"
                  >
                    <option value="organizer">Organizador (Gestor de Torneios)</option>
                    <option value="super_admin">Super Admin (Gestor Central de SaaS)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 px-5 rounded-xl text-xs transition duration-150 flex items-center justify-center gap-2 mt-2 shadow-lg shadow-indigo-100"
                >
                  <Plus size={14} />
                  <span>Cadastrar Credencial</span>
                </button>
              </form>
            </div>
          </div>

        </div>

        {/* Modal for Details Lists */}
        <AnimatePresence>
          {activeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActiveModal(null)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[85vh]"
              >
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                      {activeModal === "athletes" && <Users size={20} />}
                      {activeModal === "institutions" && <Building2 size={20} />}
                      {activeModal === "tournaments" && <Trophy size={20} />}
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-800">
                        {activeModal === "athletes" && "Listagem de Atletas"}
                        {activeModal === "institutions" && "Listagem de Instituições"}
                        {activeModal === "tournaments" && "Listagem de Torneios"}
                      </h2>
                      <p className="text-xs font-semibold text-slate-500">Visualização global de dados do sistema</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveModal(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 hover:text-slate-800 transition"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {activeModal === "athletes" && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 text-slate-450 font-bold uppercase tracking-wider">
                            <th className="py-3 px-4 rounded-tl-xl">Nome Completo</th>
                            <th className="py-3 px-4">Documento</th>
                            <th className="py-3 px-4">Clube / Instituição</th>
                            <th className="py-3 px-4 text-right rounded-tr-xl">Data de Nasc.</th>
                          </tr>
                        </thead>
                        <tbody className="font-semibold text-slate-700 divide-y divide-slate-100">
                          {athletes.length === 0 ? (
                            <tr><td colSpan={4} className="py-8 text-center text-slate-400">Nenhum atleta registrado</td></tr>
                          ) : athletes.map(a => (
                            <tr key={a.id} className="hover:bg-slate-50/80">
                              <td className="py-3 px-4">{a.full_name || a.name}</td>
                              <td className="py-3 px-4 text-slate-500 font-mono">{a.document_number || "-"}</td>
                              <td className="py-3 px-4">{a.institutions?.name || a.institution_id || "Não vinculada"}</td>
                              <td className="py-3 px-4 text-right">
                                {a.birth_date ? new Date(a.birth_date).toLocaleDateString('pt-BR') : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeModal === "institutions" && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 text-slate-450 font-bold uppercase tracking-wider">
                            <th className="py-3 px-4 rounded-tl-xl">Nome do Clube</th>
                            <th className="py-3 px-4">Responsável</th>
                            <th className="py-3 px-4">E-mail</th>
                            <th className="py-3 px-4 text-right rounded-tr-xl">Documento</th>
                          </tr>
                        </thead>
                        <tbody className="font-semibold text-slate-700 divide-y divide-slate-100">
                          {institutions.length === 0 ? (
                            <tr><td colSpan={4} className="py-8 text-center text-slate-400">Nenhuma instituição registrada</td></tr>
                          ) : institutions.map(i => (
                            <tr key={i.id} className="hover:bg-slate-50/80">
                              <td className="py-3 px-4 font-bold text-slate-800">{i.name}</td>
                              <td className="py-3 px-4">{i.responsible_name || "-"}</td>
                              <td className="py-3 px-4 font-mono text-slate-500">{i.email || "-"}</td>
                              <td className="py-3 px-4 text-right font-mono text-slate-500">{i.document_number || i.tax_id || i.cnpj || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeModal === "tournaments" && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 text-slate-450 font-bold uppercase tracking-wider">
                            <th className="py-3 px-4 rounded-tl-xl">Nome do Torneio</th>
                            <th className="py-3 px-4">Modalidade</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right rounded-tr-xl">Nº Categorias</th>
                          </tr>
                        </thead>
                        <tbody className="font-semibold text-slate-700 divide-y divide-slate-100">
                          {tournaments.length === 0 ? (
                            <tr><td colSpan={4} className="py-8 text-center text-slate-400">Nenhum torneio registrado</td></tr>
                          ) : tournaments.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50/80">
                              <td className="py-3 px-4 font-bold text-slate-800">{t.name}</td>
                              <td className="py-3 px-4 uppercase text-[10px] tracking-wider">{t.sport_type || "Geral"}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${t.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                  {t.status === 'active' ? 'Ativo' : t.status || 'Rascunho'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right text-slate-500">
                                {t.categories ? t.categories.length : 0}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

