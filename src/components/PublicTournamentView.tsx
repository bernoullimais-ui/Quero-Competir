import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Trophy, Calendar, MapPin, Users, LayoutGrid, Timer, TrendingUp, MessageSquare, Info, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import TournamentBracket from "./TournamentBracket.tsx";
import TournamentStats from "./TournamentStats.tsx";
import TournamentClassification from "./TournamentClassification.tsx";
import TournamentCommunity from "./TournamentCommunity.tsx";
import EventInfoTab from "./EventInfoTab.tsx";
import { ErrorBoundary } from "react-error-boundary";
import { applyBrandColors } from "../utils/theme";

const getSubdivisions = (cat: any) => {
  if (!cat || cat.rules_config?.sport_type !== "combat") return [];
  const ages = cat.rules_config?.ages || [];
  const graduations = cat.rules_config?.graduations || [];
  const weights = cat.rules_config?.weights || [];

  const list: string[] = [];
  if (ages.length === 0 && graduations.length === 0 && weights.length === 0) {
    return ["Geral"];
  }

  const activeAges = ages.length > 0 ? ages : [""];
  const activeGrads = graduations.length > 0 ? graduations : [""];
  const activeWeights = weights.length > 0 ? weights : [""];

  for (const age of activeAges) {
    for (const grad of activeGrads) {
      for (const wt of activeWeights) {
        const parts = [age, grad, wt].filter(Boolean);
        list.push(parts.join(" - "));
      }
    }
  }
  return list;
};

export default function PublicTournamentView() {
  const { id } = useParams();
  const [tournament, setTournament] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"evento" | "tabela" | "classificacao" | "estatisticas" | "comunidade">("evento");
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [selectedSubdivisions, setSelectedSubdivisions] = useState<Record<string, string>>({});
  const [selectedTabCat, setSelectedTabCat] = useState<string>("");

  useEffect(() => {
    // Verificar se o usuário conectado é organizador para fins de moderação
    try {
      const savedUserStr = localStorage.getItem("currentUser");
      if (savedUserStr) {
        const savedUser = JSON.parse(savedUserStr);
        if (savedUser.role === "organizer" || savedUser.role === "super_admin") {
          setIsOrganizer(true);
        }
      }
    } catch (e) {
      console.error("Error reading currentUser session:", e);
    }

    Promise.all([
      fetch(`/api/tournaments/${id}`).then(r => r.json()),
      fetch(`/api/tournaments/${id}/categories`).then(r => r.json())
    ]).then(([tData, cData]) => {
      setTournament(tData);
      if (tData.organization) applyBrandColors(tData.organization);
      const catsList = Array.isArray(cData) ? cData : [];
      setCategories(catsList);
      if (catsList.length > 0) {
        setSelectedTabCat(catsList[0].id);
      }
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!tournament || tournament.error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
        <Trophy size={48} className="text-slate-300" />
        <h2 className="text-xl font-bold text-slate-500">Torneio não encontrado</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-indigo-600 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border border-white/10">
              {tournament.logo_url ? (
                <img 
                  src={tournament.logo_url} 
                  alt={tournament.name} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Trophy size={32} className="text-white" />
              )}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{tournament.name}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-indigo-100 text-sm font-medium">
                <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(tournament.start_date).toLocaleDateString()}</span>
                {tournament.location && <span className="flex items-center gap-1"><MapPin size={14} /> {tournament.location}</span>}
              </div>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 flex gap-4 overflow-x-auto custom-scrollbar pb-2">
          <button
            onClick={() => setActiveTab("evento")}
            className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold transition-all whitespace-nowrap ${
              activeTab === "evento" ? "bg-slate-50 text-indigo-700" : "text-indigo-100 hover:text-white hover:bg-white/10"
            }`}
          >
            <Info size={18} /> EVENTO
          </button>
          <button
            onClick={() => setActiveTab("tabela")}
            className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold transition-all whitespace-nowrap ${
              activeTab === "tabela" ? "bg-slate-50 text-indigo-700" : "text-indigo-100 hover:text-white hover:bg-white/10"
            }`}
          >
            <LayoutGrid size={18} /> Tabela de Jogos
          </button>
          <button
            onClick={() => setActiveTab("classificacao")}
            className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold transition-all whitespace-nowrap ${
              activeTab === "classificacao" ? "bg-slate-50 text-indigo-700" : "text-indigo-100 hover:text-white hover:bg-white/10"
            }`}
          >
            <TrendingUp size={18} /> Classificação
          </button>
          <button
            onClick={() => setActiveTab("estatisticas")}
            className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold transition-all whitespace-nowrap ${
              activeTab === "estatisticas" ? "bg-slate-50 text-indigo-700" : "text-indigo-100 hover:text-white hover:bg-white/10"
            }`}
          >
            <Trophy size={18} /> Estatísticas gerais
          </button>
          <button
            onClick={() => setActiveTab("comunidade")}
            className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold transition-all whitespace-nowrap ${
              activeTab === "comunidade" ? "bg-slate-50 text-indigo-700" : "text-indigo-100 hover:text-white hover:bg-white/10"
            }`}
          >
            <MessageSquare size={18} /> Comunidade & Mural
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "evento" && (
          <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold bg-red-55 rounded-xl">Erro ao carregar informações gerais do evento.</div>}>
            <EventInfoTab tournament={tournament} categories={categories} />
          </ErrorBoundary>
        )}

        {activeTab === "tabela" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {categories.length > 0 ? (
              <>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Tabela de Jogos</h2>
                    <p className="text-slate-500 font-medium">Acompanhe as disputas por categoria</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <button 
                        key={cat.id}
                        onClick={() => setSelectedTabCat(cat.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                          (selectedTabCat || categories[0]?.id) === cat.id 
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                          : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200"
                        }`}
                      >
                        {cat.name} {cat.gender || cat.age_group ? `(${[cat.gender, cat.age_group].filter(Boolean).join(" ")})` : ""}
                      </button>
                    ))}
                  </div>
                </div>

                {(() => {
                  const cat = categories.find(c => c.id === (selectedTabCat || categories[0]?.id));
                  if (!cat) return null;

                  const isCombat = cat.rules_config?.sport_type === "combat";
                  const subsList = getSubdivisions(cat);
                  const activeSub = selectedSubdivisions[cat.id] || subsList[0] || "";

                  return (
                    <div key={cat.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-black text-slate-800">{cat.name}</h3>
                          <p className="text-sm text-slate-500 font-medium mt-1">Categoria</p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          {isCombat && subsList.length > 0 && (
                            <div className="w-full sm:w-56 flex flex-col gap-1 text-left">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subdivisão de Combate</label>
                              <select
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none font-semibold text-xs text-slate-700 bg-white"
                                value={activeSub}
                                onChange={e => setSelectedSubdivisions({ ...selectedSubdivisions, [cat.id]: e.target.value })}
                              >
                                {subsList.map(sub => (
                                  <option key={sub} value={sub}>
                                    {sub}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <Link
                            to={`/public/tournament/${id}/categories/${cat.id}/draw`}
                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 whitespace-nowrap cursor-pointer"
                          >
                            <Sparkles size={14} />
                            Ver Sorteio Animado 🎬
                          </Link>
                        </div>
                      </div>
                      <div className="p-6 overflow-x-auto min-h-[400px]">
                        <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold bg-red-50 rounded-xl">Erro ao renderizar o chaveamento.</div>}>
                          <TournamentBracket 
                            tournamentId={id!} 
                            categoryId={cat.id} 
                            groupCount={cat.group_count || 1} 
                            disputeSystem={cat.dispute_system || 'elimination'} 
                            selectedSubdivision={activeSub}
                          />
                        </ErrorBoundary>
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="text-center py-12 text-slate-400">Nenhuma categoria cadastrada.</div>
            )}
          </div>
        )}

        {activeTab === "classificacao" && (
          <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold bg-red-55 rounded-xl">Erro ao processar classificação.</div>}>
            <TournamentClassification tournamentId={id!} />
          </ErrorBoundary>
        )}

        {activeTab === "estatisticas" && (
          <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold bg-red-55 rounded-xl">Erro ao processar as estatísticas deste torneio.</div>}>
            <TournamentStats tournamentId={id!} />
          </ErrorBoundary>
        )}

        {activeTab === "comunidade" && (
          <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold bg-red-55 rounded-xl">Erro ao processar a comunidade deste torneio.</div>}>
            <TournamentCommunity tournamentId={id!} isOrganizer={isOrganizer} />
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}
