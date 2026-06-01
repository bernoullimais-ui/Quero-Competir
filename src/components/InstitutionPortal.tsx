import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Users, FileText, CheckCircle2, ChevronRight, Activity, Building2, UploadCloud, Plus, X, MapPin, Copy, Check, ExternalLink, AlertCircle, Timer, Mail, UserPlus } from "lucide-react";
import { useToast } from "./ui/Toast.tsx";
import { useConfirm } from "./ui/ConfirmDialog.tsx";
import AthleteEnrollmentModal from "./AthleteEnrollmentModal.tsx";

type Tab = "overview" | "roster" | "teams" | "tournaments" | "subscriptions" | "invitations";

function TeamCard({ team, institutionName }: { team: any; institutionName?: string; key?: any }) {
  const [showAthletes, setShowAthletes] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: athletes = [], isLoading, refetch: refetchAthletes } = useQuery({
    queryKey: ['team_athletes', team.id],
    queryFn: async () => {
      const savedUser = localStorage.getItem("currentUser");
      const headers: Record<string, string> = {};
      if (savedUser) {
        try {
          const u = JSON.parse(savedUser);
          if (u && u.token) headers["Authorization"] = `Bearer ${u.token}`;
        } catch (e) {}
      }
      const res = await fetch(`/api/tournaments/teams/${team.id}/athletes`, { headers });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: showAthletes,
  });

  const categoryForModal = team.category ? [{
    ...team.category,
    id: team.tournament_category_id || team.category?.id
  }] : [];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div 
        className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setShowAthletes(!showAthletes)}
      >
        <div>
          <h3 className="text-lg font-bold">
            {team.category ? `${team.category.name} (${team.category.gender} ${team.category.age_group})` : 'Categoria Mista'}
          </h3>
          <p className="text-sm text-slate-500 font-medium">{team.tournament?.name || "Torneio"}</p>
        </div>
        <div className="flex items-center gap-4">
          <ChevronRight size={20} className={`text-slate-400 transition-transform ${showAthletes ? 'rotate-90' : ''}`} />
        </div>
      </div>
      
      {showAthletes && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-6">
          {isLoading ? (
            <p className="text-sm text-slate-500 font-medium">Carregando atletas...</p>
          ) : athletes.length === 0 ? (
            <p className="text-sm text-slate-500 font-medium">Nenhum atleta vinculado a esta equipe.</p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {athletes.map((a: any) => (
                <li key={a.id} className="bg-white px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <Users size={14} />
                  </div>
                  {a.name || a.full_name}
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setShowEnrollModal(true); }}
            className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-4 py-2.5 rounded-xl transition-colors border border-indigo-100"
          >
            <UserPlus size={16} />
            Gerenciar Elenco
          </button>
        </div>
      )}

      {showEnrollModal && team.tournament_id && team.institution_id && (
        <AthleteEnrollmentModal
          isOpen={showEnrollModal}
          onClose={() => {
            setShowEnrollModal(false);
            refetchAthletes();
            queryClient.invalidateQueries({ queryKey: ['team_athletes', team.id] });
          }}
          tournamentId={team.tournament_id}
          institutionId={team.institution_id}
          institutionName={institutionName || team.institution?.name || "Minha Equipe"}
          categories={categoryForModal}
        />
      )}
    </div>
  );
}

export default function InstitutionPortal() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const { confirm } = useConfirm();

  const parseLocalTime = (scheduledTime: string) => {
    const regexMatch = scheduledTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!regexMatch) return null;
    const [_, year, month, day, hour, minute] = regexMatch;
    return new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10)
    );
  };

  const formatLocalTime = (scheduledTime: string) => {
    const localDate = parseLocalTime(scheduledTime);
    if (!localDate) return "";
    return localDate.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  const getAuthHeaders = (): Record<string, string> => {
    const savedUser = localStorage.getItem("currentUser");
    const headers: Record<string, string> = {};
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u && u.token) headers["Authorization"] = `Bearer ${u.token}`;
        if (u && u.id) headers["x-organizer-id"] = u.id;
      } catch (e) {}
    }
    return headers;
  };
  
  const { data: institution, isLoading: iLoading } = useQuery({
    queryKey: ['institution', id],
    queryFn: async () => {
      const res = await fetch(`/api/institutions/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch institution");
      return res.json();
    }
  });

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['institution_teams', id],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/institution/${id}/teams`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch teams");
      return res.json();
    }
  });

  const { data: athletes = [], refetch: refetchAthletes } = useQuery({
    queryKey: ['institution_athletes', id],
    queryFn: async () => {
      const res = await fetch(`/api/members/institution/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch athletes");
      return res.json();
    }
  });

  const { data: activeTournaments = [] } = useQuery({
    queryKey: ['active_tournaments'],
    queryFn: async () => {
      const res = await fetch('/api/tournaments', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch tournaments");
      return res.json();
    }
  });

  const { data: myRegistrations = [], refetch: refetchRegistrations } = useQuery({
    queryKey: ['institution_registrations', id],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/institution/${id}/registrations`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: incomingInvitations = [], refetch: refetchInvitations } = useQuery<any[]>({
    queryKey: ['incoming_invitations', id],
    queryFn: async () => {
      const res = await fetch("/api/institutions/invitations/incoming", { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const [tournamentsTab, setTournamentsTab] = useState<"abertos" | "inscritos">("abertos");
  const [selectedTournamentMatches, setSelectedTournamentMatches] = useState<string | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [filterMyMatches, setFilterMyMatches] = useState(true);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  const fetchMatches = async (tournamentId: string) => {
    setMatchesLoading(true);
    setSelectedCategoryFilter("all");
    setSelectedTournamentMatches(tournamentId);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/matches`, { headers: getAuthHeaders() });
      const data = await res.json();
      setMatches(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setMatchesLoading(false);
    }
  };

  const [showAddAthlete, setShowAddAthlete] = useState(false);
  const [newAthlete, setNewAthlete] = useState({ full_name: "", document_number: "", birth_date: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inscrições e autorizações de atletas (SaaS Pro)
  const [selectedTournamentForSub, setSelectedTournamentForSub] = useState<string | null>(null);
  const [subTournamentSettings, setSubTournamentSettings] = useState<any>(null);
  const [myAthleteSubs, setMyAthleteSubs] = useState<any[]>([]);
  const [showAddSubModal, setShowAddSubModal] = useState(false);
  const [subCats, setSubCats] = useState<any[]>([]);
  const [newSubForm, setNewSubForm] = useState({
    athleteName: "",
    birthDate: "",
    documentNumber: "",
    categoryId: "",
    age_group: "",
    graduation: "",
    weight_class: ""
  });
  const [copiedSubId, setCopiedSubId] = useState<string | null>(null);

  const fetchMyAthleteSubs = async (tournamentId: string) => {
    setSelectedTournamentForSub(tournamentId);
    try {
      const fetchJsonSafe = async (url: string, fallback: any) => {
        try {
          const r = await fetch(url, { headers: getAuthHeaders() });
          if (!r.ok) return fallback;
          const contentType = r.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            return fallback;
          }
          return await r.json();
        } catch (err) {
          console.error("Erro ao carregar " + url, err);
          return fallback;
        }
      };

      const [resSettings, resSubs, resCats] = await Promise.all([
        fetchJsonSafe(`/api/tournaments/${tournamentId}/subscription-settings`, null),
        fetchJsonSafe(`/api/tournaments/${tournamentId}/athlete-subscriptions/institution/${id}`, []),
        fetchJsonSafe(`/api/tournaments/${tournamentId}/categories`, [])
      ]);

      setSubTournamentSettings(resSettings);
      setMyAthleteSubs(Array.isArray(resSubs) ? resSubs : []);
      setSubCats(Array.isArray(resCats) ? resCats : []);
    } catch (e) {
      console.error("Erro ao buscar pré-atletas", e);
    }
  };

  const handleCreateAthleteSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTournamentForSub) return;
    const selectedCat = subCats.find(c => c.id === newSubForm.categoryId);
    const isCombat = selectedCat?.rules_config?.sport_type === "combat";

    try {
      const res = await fetch(`/api/tournaments/${selectedTournamentForSub}/athlete-subscriptions`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          institutionId: id,
          categoryId: newSubForm.categoryId,
          athletes: [
            {
              name: newSubForm.athleteName,
              birthDate: newSubForm.birthDate,
              document: newSubForm.documentNumber,
              additionalData: isCombat ? {
                age_group: newSubForm.age_group,
                graduation: newSubForm.graduation,
                weight_class: newSubForm.weight_class
              } : {}
            }
          ]
        })
      });
      if (res.ok) {
        setNewSubForm({ athleteName: "", birthDate: "", documentNumber: "", categoryId: "", age_group: "", graduation: "", weight_class: "" });
        setShowAddSubModal(false);
        fetchMyAthleteSubs(selectedTournamentForSub);
      } else {
        toastError("Erro ao indicar pré-atleta.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddAthlete = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          institution_id: id,
          ...newAthlete
        })
      });
      if (res.ok) {
        setNewAthlete({ full_name: "", document_number: "", birth_date: "" });
        setShowAddAthlete(false);
        refetchAthletes();
      } else {
        const err = await res.json();
        toastError(err.error || "Erro ao adicionar atleta");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const enrollInTournament = async (tournamentId: string) => {
    const isConfirmed = await confirm({
      title: "Manifestar Interesse",
      message: "Deseja manifestar intenção de participação neste torneio? O organizador avaliará sua solicitação.",
      variant: "info",
      confirmText: "Sim, enviar",
      cancelText: "Voltar"
    });
    if (!isConfirmed) return;
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/registrations`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ institution_id: id })
      });
      if (res.ok) {
        toastSuccess("Inscrição solicitada com sucesso!");
        refetchRegistrations();
      } else {
        const err = await res.json();
        toastError(err.error || "Erro ao solicitar inscrição");
      }
    } catch(err) {
      console.error(err);
    }
  };

  const handleAcceptInvitation = async (invId: string) => {
    try {
      const res = await fetch(`/api/institutions/invitations/${invId}/accept`, {
        method: "POST",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        toastSuccess(data.message || "Convite aceito com sucesso!");
        refetchInvitations();
        refetchAthletes();
      } else {
        toastError(data.error || "Erro ao aceitar convite.");
      }
    } catch(err) {
      console.error(err);
    }
  };

  const handleRejectInvitation = async (invId: string) => {
    try {
      const res = await fetch(`/api/institutions/invitations/${invId}/reject`, {
        method: "POST",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        toastSuccess(data.message || "Convite recusado.");
        refetchInvitations();
      } else {
        toastError(data.error || "Erro ao recusar convite.");
      }
    } catch(err) {
      console.error(err);
    }
  };

  if (iLoading) return <div className="p-20 text-center font-semibold text-slate-500">Carregando portal...</div>;
  if (!institution) return <div className="p-20 text-center text-red-500 font-bold">Instituição não encontrada.</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {institution.logo_url ? (
              <img src={institution.logo_url} alt="Logo" className="w-12 h-12 rounded-xl border border-slate-200 object-cover" />
            ) : (
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <Building2 size={24} />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight">{institution.name}</h1>
              <p className="text-sm text-slate-500 font-medium">Portal da Instituição</p>
            </div>
          </div>
           <button
            onClick={() => {
              localStorage.removeItem("currentUser");
              window.location.href = "/";
            }}
            className="text-sm font-semibold text-slate-600 hover:text-red-650 transition-colors cursor-pointer"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 flex gap-8">
        
        {/* Sidebar Tabs */}
        <aside className="w-64 shrink-0 space-y-2">
          <button 
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-semibold transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-600 hover:bg-slate-200/50'}`}
          >
            <Activity size={20} />
            Visão Geral
          </button>
          <button 
            onClick={() => setActiveTab("roster")}
            className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-semibold transition-all ${activeTab === 'roster' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-600 hover:bg-slate-200/50'}`}
          >
            <Users size={20} />
            Meu Elenco
          </button>
          <button 
            onClick={() => setActiveTab("teams")}
            className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-semibold transition-all ${activeTab === 'teams' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-600 hover:bg-slate-200/50'}`}
          >
            <Trophy size={20} />
            Minhas Equipes
          </button>
          <button 
            onClick={() => setActiveTab("tournaments")}
            className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-semibold transition-all ${activeTab === 'tournaments' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-600 hover:bg-slate-200/50'}`}
          >
            <Trophy size={20} />
            Torneios Disponíveis
          </button>
          <button 
            onClick={() => {
              setActiveTab("subscriptions");
              setSelectedTournamentForSub(null);
            }}
            className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-semibold transition-all ${activeTab === 'subscriptions' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-600 hover:bg-slate-200/50'}`}
          >
            <FileText size={20} />
            Inscrição por Atleta
          </button>
          <button 
            onClick={() => setActiveTab("invitations")}
            className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl font-semibold transition-all ${activeTab === 'invitations' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-600 hover:bg-slate-200/50'}`}
          >
            <div className="flex items-center gap-3">
              <Mail size={20} />
              Convites Recebidos
            </div>
            {incomingInvitations.filter(i => i.status === "pending").length > 0 && (
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${activeTab === 'invitations' ? 'bg-white text-indigo-600' : 'bg-red-500 text-white animate-pulse'}`}>
                {incomingInvitations.filter(i => i.status === "pending").length}
              </span>
            )}
          </button>
        </aside>

        {/* Content Area */}
        <div className="flex-1">
          {activeTab === "overview" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold">Bem-vindo(a) ao seu Portal!</h2>
              <p className="text-slate-500">Gerencie seus atletas, envie documentos e inscreva-se nas competições organizadas.</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                    <Users size={24} />
                  </div>
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Atletas Cadastrados</p>
                  <h3 className="text-3xl font-bold">{athletes.length}</h3>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                    <Trophy size={24} />
                  </div>
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Torneios Ativos</p>
                  <h3 className="text-3xl font-bold">{activeTournaments.length}</h3>
                </div>
              </div>
            </div>
          )}

          {activeTab === "roster" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Meu Elenco</h2>
                  <p className="text-slate-500">Adicione jogadores e faça o upload de documentação.</p>
                </div>
                <button 
                  onClick={() => setShowAddAthlete(true)}
                  className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2"
                >
                  <Plus size={20} />
                  Novo Atleta
                </button>
              </div>

              {showAddAthlete && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Adicionar Atleta</h3>
                    <button onClick={() => setShowAddAthlete(false)} className="text-slate-400 hover:text-slate-600">
                      <X size={24} />
                    </button>
                  </div>
                  <form onSubmit={handleAddAthlete} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2">Nome Completo</label>
                        <input 
                          type="text" 
                          required
                          value={newAthlete.full_name}
                          onChange={e => setNewAthlete({...newAthlete, full_name: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-2">Documento (RG/CPF)</label>
                        <input 
                          type="text" 
                          required
                          value={newAthlete.document_number}
                          onChange={e => setNewAthlete({...newAthlete, document_number: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-2">Data de Nascimento</label>
                        <input 
                          type="date" 
                          required
                          value={newAthlete.birth_date}
                          onChange={e => setNewAthlete({...newAthlete, birth_date: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="pt-4 flex justify-end">
                      <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {isSubmitting ? "Salvando..." : "Salvar Atleta"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                {athletes.length === 0 ? (
                  <div className="p-16 text-center">
                    <Users size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-bold">Nenhum atleta cadastrado.</h3>
                    <p className="text-slate-500 mt-2">Comece a preencher o elenco do seu clube.</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Nome</th>
                        <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Documento</th>
                        <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Nascimento</th>
                        <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {athletes.map((a: any) => (
                        <tr key={a.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4 font-semibold text-sm">{a.full_name}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">{a.document_number}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">{new Date(a.birth_date).toLocaleDateString()}</td>
                          <td className="px-6 py-4 text-center">
                            <button className="text-indigo-600 text-sm font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1 mx-auto hover:text-indigo-800">
                              <UploadCloud size={16} /> Docs
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === "teams" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Minhas Equipes</h2>
                  <p className="text-slate-500">Equipes inscritas nas competições e seus respectivos atletas.</p>
                </div>
              </div>

              {teamsLoading ? (
                <div className="py-20 text-center font-semibold text-slate-500">Carregando equipes...</div>
              ) : teams.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                  <Trophy className="mx-auto text-slate-300 mb-4" size={48} />
                  <h3 className="text-xl font-bold text-slate-600">Nenhuma equipe cadastrada</h3>
                  <p className="text-slate-500">Você ainda não inscreveu equipes em nenhum torneio.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {teams.map((team: any) => (
                     <TeamCard key={team.id} team={team} institutionName={institution?.name} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "tournaments" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Gerenciamento de Torneios</h2>
                  <p className="text-slate-500">Inscreva-se em competições ou acompanhe seus jogos em andamento.</p>
                </div>
                
                <div className="flex items-center gap-1 p-1 bg-slate-200/50 rounded-xl">
                  <button 
                    onClick={() => { setTournamentsTab("abertos"); setSelectedTournamentMatches(null); }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tournamentsTab === 'abertos' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Abertos para Inscrição
                  </button>
                  <button 
                    onClick={() => { setTournamentsTab("inscritos"); setSelectedTournamentMatches(null); }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tournamentsTab === 'inscritos' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Meus Torneios / Em Andamento
                  </button>
                </div>
              </div>

              {tournamentsTab === "abertos" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeTournaments.filter((t: any) => t.status === 'active' && !myRegistrations.includes(t.id)).length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                      <Trophy className="mx-auto text-slate-300 mb-4" size={48} />
                      <h3 className="text-xl font-bold text-slate-600">Nenhum torneio disponível</h3>
                      <p className="text-slate-500">Você já está inscrito em todos os torneios ativos ou não há novos torneios.</p>
                    </div>
                  ) : (
                    activeTournaments.filter((t: any) => t.status === 'active' && !myRegistrations.includes(t.id)).map((t: any) => (
                      <div key={t.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Inscrições Abertas</span>
                          </div>
                          <h3 className="text-xl font-bold mb-2">{t.name}</h3>
                          <p className="text-sm text-slate-500 mb-6 flex items-center gap-2">
                            <Activity size={16} /> 
                            Início: {new Date(t.start_date).toLocaleDateString()}
                          </p>
                        </div>
                        
                        <button 
                          onClick={() => enrollInTournament(t.id)}
                          className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                        >
                          Inscrever Instituição <ChevronRight size={18} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tournamentsTab === "inscritos" && !selectedTournamentMatches && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeTournaments.filter((t: any) => myRegistrations.includes(t.id)).length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                      <Trophy className="mx-auto text-slate-300 mb-4" size={48} />
                      <h3 className="text-xl font-bold text-slate-600">Nenhuma inscrição</h3>
                      <p className="text-slate-500">Sua instituição não está participando de nenhum torneio no momento.</p>
                    </div>
                  ) : (
                    activeTournaments.filter((t: any) => myRegistrations.includes(t.id)).map((t: any) => (
                      <div key={t.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <span className="w-2 h-2 bg-indigo-500 rounded-full" />
                            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Inscrito</span>
                          </div>
                          <h3 className="text-xl font-bold mb-2">{t.name}</h3>
                          <p className="text-sm text-slate-500 mb-6 flex items-center gap-2">
                            <Activity size={16} /> 
                            {t.status === 'active' ? 'Aguardando chaveamento' : 'Em andamento'}
                          </p>
                        </div>
                        
                        <button 
                          onClick={() => fetchMatches(t.id)}
                          className="w-full bg-indigo-50 text-indigo-600 py-3 rounded-xl font-bold hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                        >
                          Ver Meus Jogos <ChevronRight size={18} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tournamentsTab === "inscritos" && selectedTournamentMatches && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
                    <button 
                      onClick={() => setSelectedTournamentMatches(null)}
                      className="text-slate-500 hover:text-slate-800 font-semibold text-sm flex items-center gap-1"
                    >
                      <ChevronRight size={16} className="rotate-180" />
                      Voltar aos Torneios
                    </button>
                    <div className="flex items-center gap-4">
                      <select
                        value={selectedCategoryFilter}
                        onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                        className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-500 font-medium text-slate-600 bg-slate-50"
                      >
                        <option value="all">Todas as Categorias</option>
                        {Array.from(new Set(matches.map(m => m.category ? `${m.category.name} (${m.category.gender} ${m.category.age_group})` : 'N/A'))).map(catStr => (catStr !== 'N/A' && (
                          <option key={catStr} value={catStr}>{catStr}</option>
                        )))}
                      </select>
                      <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={filterMyMatches} 
                          onChange={(e) => setFilterMyMatches(e.target.checked)} 
                          className="rounded text-indigo-600 w-4 h-4"
                        />
                        Apenas da minha instituição
                      </label>
                    </div>
                  </div>

                  {matchesLoading ? (
                    <div className="py-20 text-center font-semibold text-slate-500">Carregando jogos...</div>
                  ) : (
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                      {(() => {
                        let filteredMatches = matches;
                        if (filterMyMatches) {
                          filteredMatches = filteredMatches.filter(m => m.team1?.institution?.id === id || m.team2?.institution?.id === id);
                        }
                        if (selectedCategoryFilter !== "all") {
                          filteredMatches = filteredMatches.filter(m => m.category && `${m.category.name} (${m.category.gender} ${m.category.age_group})` === selectedCategoryFilter);
                        }

                        filteredMatches = [...filteredMatches].sort((a, b) => {
                          if (a.scheduled_time && b.scheduled_time) {
                            return a.scheduled_time.localeCompare(b.scheduled_time);
                          }
                          if (a.scheduled_time) return -1;
                          if (b.scheduled_time) return 1;
                          return 0;
                        });
                        
                        if (filteredMatches.length === 0) {
                          return (
                            <div className="py-20 text-center">
                              <Trophy className="mx-auto text-slate-300 mb-4" size={48} />
                              <h3 className="text-xl font-bold text-slate-600">Nenhum jogo encontrado.</h3>
                              <p className="text-slate-500">O chaveamento pode não ter sido gerado ou a instituição não possui jogos.</p>
                            </div>
                          );
                        }

                        return (
                          <table className="w-full">
                            <thead className="bg-slate-50/50 border-b border-slate-100">
                              <tr>
                                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Data / Local</th>
                                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Categoria</th>
                                <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">Confronto</th>
                                <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredMatches.map(m => (
                                <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-6 py-4">
                                    <div className="text-sm font-medium">
                                      {m.scheduled_time ? formatLocalTime(m.scheduled_time) : "A definir"}
                                    </div>
                                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                      <MapPin size={12} /> {m.court || m.venue?.name || "A definir"}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded inline-block">
                                      {m.category ? `${m.category.name} (${m.category.gender} ${m.category.age_group})` : "N/A"}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-1">
                                      Fase {m.round}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-center border-l border-r border-slate-50 bg-slate-50/30">
                                    <div className="flex items-center justify-center gap-4">
                                      <div className={`w-32 text-right ${m.team1?.institution?.id === id ? 'font-bold text-indigo-600' : 'text-slate-600 font-medium'} truncate`}>
                                        {m.team1?.institution?.name || "A definir"}
                                      </div>
                                      <div className="shrink-0 flex items-center justify-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                                        <span className={`text-lg font-bold w-6 text-center ${m.status === 'finished' && m.winner_id === m.team1_id ? 'text-indigo-600' : ''}`}>
                                          {m.score1 || 0}
                                        </span>
                                        <span className="text-slate-300 text-xs font-black">X</span>
                                        <span className={`text-lg font-bold w-6 text-center ${m.status === 'finished' && m.winner_id === m.team2_id ? 'text-indigo-600' : ''}`}>
                                          {m.score2 || 0}
                                        </span>
                                      </div>
                                      <div className={`w-32 text-left ${m.team2?.institution?.id === id ? 'font-bold text-indigo-600' : 'text-slate-600 font-medium'} truncate`}>
                                        {m.team2?.institution?.name || "A definir"}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                                      m.status === 'finished' ? 'bg-emerald-50 text-emerald-600' :
                                      m.status === 'in_progress' ? 'bg-red-50 text-red-600 animate-pulse' :
                                      'bg-slate-100 text-slate-500'
                                    }`}>
                                      {m.status === 'finished' ? 'Finalizado' :
                                       m.status === 'in_progress' ? 'Ao Vivo' : 
                                       'Agendado'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "subscriptions" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {!selectedTournamentForSub ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Inscrição de Atletas • SaaS Central</h2>
                    <p className="text-sm text-slate-500 font-medium">Selecione uma competição parceira abaixo para pré-inscrever atletas, gerar links públicos para os responsáveis legais ou auditar o status documental.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {activeTournaments.filter((t: any) => myRegistrations.includes(t.id)).length === 0 ? (
                      <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
                        <AlertCircle size={44} className="mx-auto text-slate-300 mb-3" />
                        <h3 className="text-lg font-bold text-slate-700">Seu clube não está inscrito em torneios</h3>
                        <p className="text-sm text-slate-500 max-w-sm mx-auto mt-2">
                          Vá na aba "Torneios Disponíveis" para formalizar a intenção de participação da sua instituição primeiro.
                        </p>
                      </div>
                    ) : (
                      activeTournaments.filter((t: any) => myRegistrations.includes(t.id)).map((t: any) => (
                        <div key={t.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                          <div>
                            <h3 className="text-lg font-bold mb-1.5">{t.name}</h3>
                            <p className="text-xs text-slate-400 font-black uppercase tracking-wider mb-4">Módulo de Integridade Legislativa</p>
                          </div>
                          
                          <button
                            onClick={() => fetchMyAthleteSubs(t.id)}
                            className="bg-indigo-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-1.5"
                          >
                            Gerenciar Processo de Atletas <ChevronRight size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  
                  {/* Voltar */}
                  <div className="flex items-center justify-between">
                    <button 
                      onClick={() => setSelectedTournamentForSub(null)}
                      className="text-slate-500 hover:text-slate-800 font-bold text-xs flex items-center gap-1"
                    >
                      <ChevronRight size={14} className="rotate-180" />
                      Voltar aos Torneios
                    </button>

                    <button
                      onClick={() => setShowAddSubModal(true)}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-1.5"
                    >
                      <Plus size={16} />
                      Indicar Jogador (Pré-Inscrição)
                    </button>
                  </div>

                  {/* Header e regras */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h2 className="text-xl font-bold">Fluxo de Inscrição • {activeTournaments.find((t: any) => t.id === selectedTournamentForSub)?.name}</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
                      <div className="text-xs font-semibold text-slate-600 space-y-1.5">
                        <p><strong>Prazo Regulamentar:</strong> {subTournamentSettings?.deadline ? new Date(subTournamentSettings.deadline).toLocaleDateString() : "Sem prazo definido"}</p>
                        <p><strong>Modelo de Taxas:</strong> {
                          subTournamentSettings?.feeType === "free" ? "Gratuito" :
                          subTournamentSettings?.feeType === "by_team" ? "Paga por Equipe" :
                          subTournamentSettings?.feeType === "by_team_and_athlete_institution" ? "Paga por Equipe + Atletas (Pela Instituição)" :
                          "Paga por Equipe (Instituição) + Atletas (Responsáveis no preenchimento)"
                        }</p>
                      </div>

                      {subTournamentSettings?.deadline && (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-xs font-medium text-slate-500 self-center">
                          <p className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                            <Timer size={14} className="text-indigo-600" /> Janela Regulamentar e Auditoria
                          </p>
                          O link gerado deve ser preenchido pelos responsáveis no prazo. Após o prazo de inscrições o organizador validará todas as fichas pendentes em até 24 Horas.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lista de Pré-Atletas indicados */}
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-150">
                      <h3 className="text-sm font-bold text-slate-700">Fichas e Status de Candidatos</h3>
                    </div>

                    {myAthleteSubs.length === 0 ? (
                      <div className="p-16 text-center">
                        <Users size={36} className="mx-auto text-slate-350 mb-3" />
                        <h4 className="font-bold text-slate-600 text-sm">Nenhum jogador indicado neste torneio</h4>
                        <p className="text-xs text-slate-400 mt-1">Comece clicando em '+ Indicar Jogador' para gerar convites individuais.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {myAthleteSubs.map((sub: any) => {
                          const cat = subCats.find(c => c.id === sub.categoryId);
                          const directUrl = `${window.location.protocol}//${window.location.host}/public/register-athlete/${sub.id}`;

                          return (
                            <div key={sub.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:bg-slate-50/50 transition">
                              
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-slate-800 text-sm">{sub.athleteName}</h4>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                                    sub.validationStatus === "approved" ? "bg-emerald-50 border-emerald-200 text-emerald-600" :
                                    sub.validationStatus === "rejected" ? "bg-red-50 border-red-200 text-red-600" :
                                    "bg-amber-50 border-amber-200 text-amber-600"
                                  }`}>
                                    {sub.validationStatus === "approved" ? "Aprovado" :
                                     sub.validationStatus === "rejected" ? "Recusado" :
                                     "Pendente de Auditoria"}
                                  </span>

                                  {subTournamentSettings?.requireMembership && (
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                                      sub.isMembershipPaid ? "bg-emerald-50 border-emerald-250 text-emerald-600" : "bg-rose-50 border-rose-250 text-rose-600"
                                    }`}>
                                      {sub.isMembershipPaid ? "🟢 Filiado" : "🔴 Não Filiado / Anuidade Pendente"}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 font-bold uppercase">
                                  Nasc: {new Date(sub.birthDate).toLocaleDateString()} • Doc: {sub.document || sub.documentNumber} • Cat: {cat?.name || "Livre"}
                                  {cat?.rules_config?.sport_type === "combat" && sub.additionalData && (
                                    <span className="text-indigo-600 block mt-0.5 normal-case font-semibold">
                                      Subdivisão: {sub.additionalData.age_group || "N/A"} • {sub.additionalData.graduation || "N/A"} • {sub.additionalData.weight_class || "N/A"}
                                    </span>
                                  )}
                                </p>
                                
                                {sub.validationStatus === "rejected" && sub.validationFeedback && (
                                  <div className="bg-red-50 p-2 rounded-lg text-xs text-red-700 mt-2 max-w-md border border-red-100">
                                    <strong>Pendência:</strong> {sub.validationFeedback}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 self-end md:self-center">
                                {sub.validationStatus !== "approved" && (
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(directUrl);
                                      setCopiedSubId(sub.id);
                                      setTimeout(() => setCopiedSubId(null), 2000);
                                    }}
                                    className="px-3 py-1.5 border border-slate-200 hover:border-indigo-600 rounded-lg text-xs font-bold transition flex items-center gap-1 text-slate-500 hover:text-indigo-600"
                                    title="Clique para copiar o link individual de preenchimento de termo de autorização, documentos e pagamento para os pais."
                                  >
                                    {copiedSubId === sub.id ? (
                                      <>
                                        <Check size={12} className="text-emerald-500" />
                                        Copiado!
                                      </>
                                    ) : (
                                      <>
                                        <Copy size={12} />
                                        Copiar Link do Responsável
                                      </>
                                    )}
                                  </button>
                                )}

                                {sub.validationStatus === "approved" && (
                                  <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-150">
                                    <CheckCircle2 size={12} /> Jogador Ativo no Elenco Principal
                                  </span>
                                )}
                              </div>

                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>
          )}
        </div>

        {/* Modal de Nova Indicação de Atleta */}
        {showAddSubModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">Indicar Atleta para o Evento</h3>
                <button onClick={() => setShowAddSubModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateAthleteSub} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome de Batismo do Jogador</label>
                  <input
                    type="text"
                    required
                    value={newSubForm.athleteName}
                    onChange={e => setNewSubForm({...newSubForm, athleteName: e.target.value})}
                    className="w-full border border-slate-200 p-2.5 outline-none rounded-xl text-xs font-semibold"
                    placeholder="Ex: João Silva de Oliveira"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Nascimento</label>
                    <input
                      type="date"
                      required
                      value={newSubForm.birthDate}
                      onChange={e => setNewSubForm({...newSubForm, birthDate: e.target.value})}
                      className="w-full border border-slate-200 p-2.5 outline-none rounded-xl text-xs font-semibold bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nº Documento (RG/CPF)</label>
                    <input
                      type="text"
                      required
                      value={newSubForm.documentNumber}
                      onChange={e => setNewSubForm({...newSubForm, documentNumber: e.target.value})}
                      className="w-full border border-slate-200 p-2.5 outline-none rounded-xl text-xs font-semibold"
                      placeholder="Ex: 50.123.456-X"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria de Destino</label>
                  <select
                    required
                    value={newSubForm.categoryId}
                    onChange={e => {
                      const cid = e.target.value;
                      setNewSubForm(prev => ({
                        ...prev,
                        categoryId: cid,
                        age_group: "",
                        graduation: "",
                        weight_class: ""
                      }));
                    }}
                    className="w-full border border-slate-200 p-2.5 outline-none rounded-xl text-xs font-bold bg-white"
                  >
                    <option value="">Selecione a categoria correspondente...</option>
                    {subCats.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name} ({cat.gender} - {cat.age_group})</option>
                    ))}
                  </select>
                  {/* Badge de faixa de nascimento */}
                  {(() => {
                    const selCat = subCats.find(c => c.id === newSubForm.categoryId);
                    if (!selCat || (!selCat.birth_year_min && !selCat.birth_year_max)) return null;
                    const birthYear = newSubForm.birthDate ? new Date(newSubForm.birthDate).getFullYear() : null;
                    const tooOld = selCat.birth_year_min && birthYear && birthYear < selCat.birth_year_min;
                    const tooYoung = selCat.birth_year_max && birthYear && birthYear > selCat.birth_year_max;
                    const isIncompatible = tooOld || tooYoung;
                    const rangeLabel = selCat.birth_year_min && selCat.birth_year_max
                      ? `entre ${selCat.birth_year_min} e ${selCat.birth_year_max}`
                      : selCat.birth_year_min
                        ? `a partir de ${selCat.birth_year_min}`
                        : `até ${selCat.birth_year_max}`;
                    return (
                      <div className={`mt-2 flex items-start gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl ${
                        isIncompatible
                          ? "bg-red-50 border border-red-200 text-red-700"
                          : "bg-indigo-50 border border-indigo-100 text-indigo-700"
                      }`}>
                        <span>{isIncompatible ? "⚠️" : "🎂"}</span>
                        <span>
                          {isIncompatible
                            ? `Atenção: o atleta nasceu em ${birthYear}, mas esta categoria aceita apenas nascidos ${rangeLabel}.`
                            : `Esta categoria aceita atletas nascidos ${rangeLabel}.`
                          }
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {(() => {
                  const selectedCat = subCats.find(c => c.id === newSubForm.categoryId);
                  const isCombat = selectedCat?.rules_config?.sport_type === "combat";
                  if (!isCombat) return null;
                  
                  return (
                    <div className="grid grid-cols-3 gap-2 mt-3 animate-in fade-in duration-200">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Idade/Classe</label>
                        <select
                          required
                          value={newSubForm.age_group}
                          onChange={e => setNewSubForm({...newSubForm, age_group: e.target.value})}
                          className="w-full border border-slate-200 p-2 outline-none rounded-xl text-[10px] font-bold bg-white"
                        >
                          <option value="">Escolher...</option>
                          {selectedCat.rules_config.ages?.map((age: string) => (
                            <option key={age} value={age}>{age}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Graduação</label>
                        <select
                          required
                          value={newSubForm.graduation}
                          onChange={e => setNewSubForm({...newSubForm, graduation: e.target.value})}
                          className="w-full border border-slate-200 p-2 outline-none rounded-xl text-[10px] font-bold bg-white"
                        >
                          <option value="">Escolher...</option>
                          {selectedCat.rules_config.graduations?.map((grad: string) => (
                            <option key={grad} value={grad}>{grad}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Peso</label>
                        <select
                          required
                          value={newSubForm.weight_class}
                          onChange={e => setNewSubForm({...newSubForm, weight_class: e.target.value})}
                          className="w-full border border-slate-200 p-2 outline-none rounded-xl text-[10px] font-bold bg-white"
                        >
                          <option value="">Escolher...</option>
                          {selectedCat.rules_config.weights?.map((w: string) => (
                            <option key={w} value={w}>{w}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })()}

                <div className="pt-4 flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 min-h-[40px] bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
                  >
                    Processar Indicação
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddSubModal(false)}
                    className="px-4 min-h-[40px] border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === "invitations" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Mail className="text-indigo-600" />
                Convites de Conexão
              </h2>
              <p className="text-slate-500">
                Aceite convites de organizadores parceiros para compartilhar os dados de atletas e equipes em competições ativas.
              </p>
            </div>

            <div className="space-y-4">
              {incomingInvitations.length === 0 ? (
                <div className="p-16 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                  <Mail size={48} className="mx-auto text-slate-300 mb-4" />
                  <h3 className="text-lg font-bold">Nenhum convite recebido</h3>
                  <p className="text-slate-500 text-sm">Sua instituição ainda não recebeu convites de conexão de outros organizadores.</p>
                </div>
              ) : (
                incomingInvitations.map((inv: any) => (
                  <div key={inv.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-bold text-lg text-slate-950">{inv.organizerName}</h4>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                          inv.status === "pending" ? "bg-amber-50 text-amber-600 border border-amber-100 animate-pulse" :
                          inv.status === "accepted" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                          "bg-slate-50 text-slate-400 border border-slate-100 line-through"
                        }`}>
                          {inv.status === "pending" ? "Pendente" :
                           inv.status === "accepted" ? "Aceito" : "Recusado"}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 font-medium">
                        Convidou sua instituição para conectar na plataforma "Quero Competir" e compartilhar seus atletas para os eventos organizados por eles.
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">Enviado em: {new Date(inv.createdAt).toLocaleString("pt-BR")}</p>
                    </div>

                    {inv.status === "pending" && (
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => handleRejectInvitation(inv.id)}
                          className="px-4 py-2 bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-650 rounded-xl font-bold text-sm transition-colors cursor-pointer border border-slate-150"
                        >
                          Recusar
                        </button>
                        <button
                          onClick={() => handleAcceptInvitation(inv.id)}
                          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors cursor-pointer shadow-md shadow-indigo-100"
                        >
                          Aceitar & Compartilhar
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
