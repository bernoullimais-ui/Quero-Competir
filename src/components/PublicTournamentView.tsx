import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Trophy, Calendar, MapPin, Users, LayoutGrid, Timer, TrendingUp, MessageSquare, Info, Sparkles, Clock } from "lucide-react";
import { motion } from "motion/react";
import TournamentBracket from "./TournamentBracket.tsx";
import SwimmingBalizamento from "./SwimmingBalizamento.tsx";
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
  const [selectedTabCat, setSelectedTabCat] = useState<string>("all");
  const [onlyWithAthletes, setOnlyWithAthletes] = useState<boolean>(true);
  const [athleteSubs, setAthleteSubs] = useState<any[]>([]);
  const [selfRegEnabled, setSelfRegEnabled] = useState(false);

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

    fetch(`/api/tournaments/${id}`)
      .then(r => r.json())
      .then(async (tData) => {
        if (!tData || tData.error) {
          setLoading(false);
          return;
        }
        setTournament(tData);
        if (tData.organization) applyBrandColors(tData.organization);

        const realId = tData.id || id;

        const [cData, subsData, pubSettings] = await Promise.all([
          fetch(`/api/tournaments/${realId}/categories`).then(r => r.json()),
          fetch(`/api/tournaments/${realId}/athlete-subscriptions`).then(r => r.ok ? r.json() : []),
          fetch(`/api/tournaments/${realId}/public-settings`).then(r => r.ok ? r.json() : null),
        ]);

        const catsList = Array.isArray(cData) ? cData : [];
        setCategories(catsList);
        setAthleteSubs(Array.isArray(subsData) ? subsData : []);
        if (pubSettings && !pubSettings.error) {
          setSelfRegEnabled(true);
        }
        setLoading(false);
      })
      .catch(err => {
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

  // Extrair bannerUrl, eventTime e location da descrição se houver
  const bannerMatch = (tournament.description || "").match(/<!--BANNER_URL:(.*?)-->/);
  const bannerUrl = bannerMatch ? bannerMatch[1].trim() : "";
  const timeMatch = (tournament.description || "").match(/<!--EVENT_TIME:(.*?)-->/);
  const eventTime = tournament.event_time || (timeMatch ? timeMatch[1].trim() : "");
  const locationMatch = (tournament.description || "").match(/<!--EVENT_LOCATION:(.*?)-->/);
  const eventLocation = tournament.location || (locationMatch ? locationMatch[1].trim() : "");
  const defaultBannerUrl = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1600";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 1. Full-width Top Banner (edge-to-edge, preenchendo toda a dimensão da página) */}
      <div className="w-full h-48 sm:h-64 md:h-80 lg:h-96 relative overflow-hidden bg-slate-900 shadow-inner">
        <img
          src={bannerUrl || defaultBannerUrl}
          alt={tournament.name}
          className="w-full h-full object-cover object-top"
        />
      </div>

      {/* 2. Header abaixo do banner: Nome, Data, Botão de Inscrição e Menu */}
      <header className="bg-indigo-600 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/10 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border border-white/10">
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
                <div className="flex flex-wrap items-center gap-2.5 mt-2 text-indigo-100 text-xs sm:text-sm font-semibold">
                  <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-xl border border-white/10 shadow-ultra-sm">
                    <Calendar size={14} className="text-indigo-200" /> {new Date(tournament.start_date).toLocaleDateString("pt-BR")}
                  </span>
                  
                  {eventTime && (
                    <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-xl border border-white/10 shadow-ultra-sm">
                      <Clock size={14} className="text-amber-300" /> {eventTime}
                    </span>
                  )}

                  {eventLocation && (
                    <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-xl border border-white/10 shadow-ultra-sm">
                      <MapPin size={14} className="text-rose-300" /> {eventLocation}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {selfRegEnabled && (
              <Link
                to={`/public/torneio/${id}/inscricao`}
                className="shrink-0 bg-white text-indigo-700 px-6 py-3.5 rounded-2xl font-black text-sm hover:bg-indigo-50 transition shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2"
              >
                <Sparkles size={16} /> Inscrever-se
              </Link>
            )}
          </div>

          {/* Menu / Tabs abaixo do header */}
          <div className="mt-5 flex gap-3 sm:gap-4 overflow-x-auto custom-scrollbar pb-1">
            <button
              onClick={() => setActiveTab("evento")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === "evento" ? "bg-white text-indigo-700 shadow-sm" : "text-indigo-100 hover:text-white hover:bg-white/10"
              }`}
            >
              <Info size={16} /> EVENTO
            </button>
            <button
              onClick={() => setActiveTab("tabela")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === "tabela" ? "bg-white text-indigo-700 shadow-sm" : "text-indigo-100 hover:text-white hover:bg-white/10"
              }`}
            >
              <LayoutGrid size={16} /> Tabela de Jogos
            </button>
            <button
              onClick={() => setActiveTab("classificacao")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === "classificacao" ? "bg-white text-indigo-700 shadow-sm" : "text-indigo-100 hover:text-white hover:bg-white/10"
              }`}
            >
              <TrendingUp size={16} /> Classificação
            </button>
            <button
              onClick={() => setActiveTab("estatisticas")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === "estatisticas" ? "bg-white text-indigo-700 shadow-sm" : "text-indigo-100 hover:text-white hover:bg-white/10"
              }`}
            >
              <Trophy size={16} /> Estatísticas gerais
            </button>
            <button
              onClick={() => setActiveTab("comunidade")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === "comunidade" ? "bg-white text-indigo-700 shadow-sm" : "text-indigo-100 hover:text-white hover:bg-white/10"
              }`}
            >
              <MessageSquare size={16} /> Comunidade & Mural
            </button>
          </div>
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
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Tabela & Balizamento do Torneio</h2>
                    <p className="text-slate-500 text-sm font-medium">Selecione a prova ou veja a ordem geral de balizamento.</p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                    {/* Checkbox Apenas com inscritos */}
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors shrink-0">
                      <input
                        type="checkbox"
                        checked={onlyWithAthletes}
                        onChange={(e) => setOnlyWithAthletes(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Apenas com inscritos</span>
                    </label>

                    {/* Select Dropdown de Provas */}
                    <div className="min-w-[280px]">
                      {(() => {
                        const filteredCategories = categories.filter((cat) => {
                          if (!onlyWithAthletes) return true;
                          const count = athleteSubs.filter((sub: any) => 
                            (sub.categoryId === cat.id || sub.category_id === cat.id) &&
                            (sub.validationStatus === "approved" || sub.validation_status === "approved" || sub.isCompleted || sub.is_completed || !sub.validationStatus)
                          ).length;
                          return count > 0;
                        });

                        const displayCategories = filteredCategories.length > 0 ? filteredCategories : categories;

                        return (
                          <select 
                            value={selectedTabCat}
                            onChange={(e) => setSelectedTabCat(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-250 rounded-2xl font-bold text-sm text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors shadow-sm cursor-pointer"
                          >
                            <option value="all">📋 Todas as Provas (Ordem Geral do Balizamento)</option>
                            {displayCategories.map((cat, idx) => {
                              const count = athleteSubs.filter((sub: any) => 
                                (sub.categoryId === cat.id || sub.category_id === cat.id) &&
                                (sub.validationStatus === "approved" || sub.validation_status === "approved" || sub.isCompleted || sub.is_completed || !sub.validationStatus)
                              ).length;
                              return (
                                <option key={cat.id} value={cat.id}>
                                  Prova {idx + 1}: {cat.name} ({cat.gender || ""} {cat.age_group || ""}) — {count} {count === 1 ? "inscrito" : "inscritos"}
                                </option>
                              );
                            })}
                          </select>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* ── VIEW: TODAS AS PROVAS (ORDEM GERAL DO BALIZAMENTO) ── */}
                {selectedTabCat === "all" ? (
                  <div className="space-y-8">
                    <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-indigo-300 font-black text-xs uppercase tracking-widest mb-1">
                          <Timer size={16} />
                          Programação Oficial de Provas
                        </div>
                        <h3 className="text-xl font-bold">Ordem Geral do Balizamento</h3>
                        <p className="text-slate-300 text-xs mt-0.5">
                          Exibindo a sequência cronológica oficial das baterias e raias do torneio.
                        </p>
                      </div>

                      <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-5 py-3 bg-white text-indigo-950 hover:bg-indigo-50 font-bold rounded-2xl text-xs shadow-lg transition-all shrink-0 cursor-pointer"
                      >
                        <Clock size={16} />
                        Imprimir Balizamento Completo 🖨️
                      </button>
                    </div>

                    {(() => {
                      const displayCats = categories.filter((cat) => {
                        if (!onlyWithAthletes) return true;
                        return athleteSubs.some((s: any) => 
                          (s.categoryId === cat.id || s.category_id === cat.id) && 
                          (s.validationStatus === "approved" || s.validation_status === "approved" || s.isCompleted || s.is_completed || !s.validationStatus)
                        );
                      });

                      if (displayCats.length === 0) {
                        return (
                          <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
                            Nenhuma prova com inscritos encontrada.
                          </div>
                        );
                      }

                      return displayCats.map((cat, idx) => {
                        const isSwimming = cat.rules_config?.sport_type === "swimming" ||
                          cat.name?.toLowerCase().includes("natação") ||
                          cat.name?.toLowerCase().includes("natacao") ||
                          tournament?.name?.toLowerCase().includes("natação") ||
                          tournament?.name?.toLowerCase().includes("natacao");

                        return (
                          <div key={cat.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-md">
                                  #{idx + 1}
                                </span>
                                <div>
                                  <h4 className="font-bold text-slate-800 text-base">{cat.name}</h4>
                                  <p className="text-xs text-slate-500 font-medium">{cat.gender} • {cat.age_group}</p>
                                </div>
                              </div>
                            </div>

                            <div className="p-5">
                              {isSwimming ? (
                                <SwimmingBalizamento
                                  category={cat}
                                  athleteSubs={athleteSubs}
                                  tournamentId={id!}
                                  readOnly={true}
                                />
                              ) : (
                                <TournamentBracket 
                                  tournamentId={id!} 
                                  categoryId={cat.id} 
                                  groupCount={cat.group_count || 1} 
                                  disputeSystem={cat.dispute_system || 'elimination'} 
                                  selectedSubdivision=""
                                />
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  /* ── VIEW: PROVA INDIVIDUAL SELECIONADA ── */
                  (() => {
                    const cat = categories.find(c => c.id === selectedTabCat);
                    if (!cat) return null;

                    const isCombat = cat.rules_config?.sport_type === "combat";
                    const isSwimming = cat.rules_config?.sport_type === "swimming" ||
                      cat.name?.toLowerCase().includes("natação") ||
                      cat.name?.toLowerCase().includes("natacao") ||
                      tournament?.name?.toLowerCase().includes("natação") ||
                      tournament?.name?.toLowerCase().includes("natacao");

                    const subsList = getSubdivisions(cat);
                    const activeSub = selectedSubdivisions[cat.id] || subsList[0] || "";

                    return (
                      <div key={cat.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div>
                            <h3 className="text-xl font-black text-slate-800">{cat.name}</h3>
                            <p className="text-sm text-slate-500 font-medium mt-1">{cat.gender} • {cat.age_group}</p>
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

                            {!isSwimming && (
                              <Link
                                to={`/public/tournament/${id}/categories/${cat.id}/draw`}
                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 whitespace-nowrap cursor-pointer"
                              >
                                <Sparkles size={14} />
                                Ver Sorteio Animado 🎬
                              </Link>
                            )}
                          </div>
                        </div>
                        <div className="p-6 overflow-x-auto min-h-[400px]">
                          <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold bg-red-50 rounded-xl">Erro ao renderizar o chaveamento.</div>}>
                            {isSwimming ? (
                              <SwimmingBalizamento
                                category={cat}
                                athleteSubs={athleteSubs}
                                tournamentId={id!}
                                readOnly={true}
                              />
                            ) : (
                              <TournamentBracket 
                                tournamentId={id!} 
                                categoryId={cat.id} 
                                groupCount={cat.group_count || 1} 
                                disputeSystem={cat.dispute_system || 'elimination'} 
                                selectedSubdivision={activeSub}
                              />
                            )}
                          </ErrorBoundary>
                        </div>
                      </div>
                    );
                  })()
                )}
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
