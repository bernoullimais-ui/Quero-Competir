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

const getLaneOrder = (numLanes: number): number[] => {
  switch (numLanes) {
    case 8: return [4, 5, 3, 6, 2, 7, 1, 8];
    case 7: return [4, 5, 3, 6, 2, 7, 1];
    case 6: return [3, 4, 2, 5, 1, 6];
    case 5: return [3, 4, 2, 5, 1];
    case 4: return [2, 3, 1, 4];
    case 3: return [2, 3, 1];
    case 2: return [1, 2];
    default: return Array.from({ length: numLanes }, (_, i) => i + 1);
  }
};

const getDynamicTabLabel = (categories: any[], tournament: any): string => {
  let hasColetivo = false;
  let hasNatacao = false;
  let hasLutas = false;

  const tourName = (tournament?.name || "").toLowerCase();
  if (tourName.includes("natação") || tourName.includes("natacao")) hasNatacao = true;
  if (
    tourName.includes("judô") ||
    tourName.includes("judo") ||
    tourName.includes("jiu") ||
    tourName.includes("karate") ||
    tourName.includes("luta")
  ) hasLutas = true;

  if (categories && categories.length > 0) {
    categories.forEach((cat) => {
      const st = cat.rules_config?.sport_type;
      const catName = (cat.name || "").toLowerCase();

      if (
        st === "swimming" ||
        catName.includes("natação") ||
        catName.includes("natacao") ||
        catName.includes("swim")
      ) {
        hasNatacao = true;
      } else if (
        st === "combat" ||
        catName.includes("judô") ||
        catName.includes("judo") ||
        catName.includes("jiu") ||
        catName.includes("karate") ||
        catName.includes("karatê") ||
        catName.includes("luta") ||
        catName.includes("taekwondo")
      ) {
        hasLutas = true;
      } else {
        hasColetivo = true;
      }
    });
  } else {
    const st = tournament?.sport_type || "";
    if (st === "swimming") hasNatacao = true;
    else if (st === "combat") hasLutas = true;
    else hasColetivo = true;
  }

  const parts: string[] = [];
  if (hasColetivo) parts.push("Tabela");
  if (hasNatacao) parts.push("Balizamento");
  if (hasLutas) parts.push("Chaves");

  if (parts.length === 0) return "Tabela/Balizamento/Chaves";
  return parts.join("/");
};

const hasTeamSports = (categories: any[], tournament: any): boolean => {
  if (categories && categories.length > 0) {
    return categories.some((cat) => {
      const st = cat.rules_config?.sport_type;
      const catName = (cat.name || "").toLowerCase();

      const isSwimming = st === "swimming" || catName.includes("natação") || catName.includes("natacao") || catName.includes("swim");
      const isCombat = st === "combat" || catName.includes("judô") || catName.includes("judo") || catName.includes("jiu") || catName.includes("karate") || catName.includes("karatê") || catName.includes("luta") || catName.includes("taekwondo");

      return !isSwimming && !isCombat;
    });
  }

  const tourName = (tournament?.name || "").toLowerCase();
  const isSwimming = tourName.includes("natação") || tourName.includes("natacao");
  const isCombat = tourName.includes("judô") || tourName.includes("judo") || tourName.includes("jiu") || tourName.includes("karate") || tourName.includes("luta");

  return !isSwimming && !isCombat;
};

const handlePrintAllSumulas = (displayCats: any[], athleteSubs: any[], tournament: any) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const lanesCount = 6;
  const laneOrder = getLaneOrder(lanesCount);

  const proofsHtml = displayCats.map((cat, idx) => {
    const catAthletes = athleteSubs.filter((s: any) => 
      (s.categoryId === cat.id || s.category_id === cat.id) &&
      (s.validationStatus === "approved" || s.validation_status === "approved" || s.isCompleted || s.is_completed || !s.validationStatus)
    ).sort((a, b) => {
      const timeA = a.additionalData?.seed_time || a.additional_data?.seed_time || "99:99.99";
      const timeB = b.additionalData?.seed_time || b.additional_data?.seed_time || "99:99.99";
      return timeA.localeCompare(timeB);
    });

    const totalAthletes = catAthletes.length;
    const numHeats = Math.max(1, Math.ceil(totalAthletes / lanesCount));
    const heatsList: any[] = [];

    for (let h = 0; h < numHeats; h++) {
      const heatAthletes = catAthletes.slice(h * lanesCount, (h + 1) * lanesCount);
      const laneAssignments = Array.from({ length: lanesCount }, (_, i) => ({ laneNumber: i + 1 }));

      heatAthletes.forEach((ath: any, index: number) => {
        const targetLaneNum = laneOrder[index] || (index + 1);
        const laneObj = laneAssignments.find(l => l.laneNumber === targetLaneNum);
        if (laneObj) {
          (laneObj as any).athleteName = ath.athleteName || ath.athlete_name;
          (laneObj as any).institutionName = ath.institutionName || ath.institution_name || ath.institution?.name || ath.additionalData?.club_name || ath.additionalData?.institution_name || "Avulso";
          (laneObj as any).seedTime = ath.additionalData?.seed_time || ath.additional_data?.seed_time || "--:--.--";
        }
      });

      heatsList.push({ heatNumber: h + 1, lanes: laneAssignments });
    }

    return `
      <div class="proof-section">
        <div class="proof-header">
          PROVA #${idx + 1} — ${cat.name} (${cat.gender || ""} ${cat.age_group || ""})
        </div>
        <p style="margin: 4px 0 14px 0; font-size: 11px; color: #64748b; font-weight: 500;">
          Total de Inscritos: ${totalAthletes} atletas • Raias por Disputa: ${lanesCount} • Séries: ${numHeats}
        </p>

        ${heatsList.map(h => `
          <div class="heat-title">SÉRIE ${h.heatNumber} de ${numHeats}</div>
          <table>
            <thead>
              <tr>
                <th style="width: 45px; text-align: center;">Raia</th>
                <th>Atleta</th>
                <th>Clube / Entidade</th>
                <th style="width: 110px;">Tempo Inscrição</th>
                <th style="width: 110px;">Tempo Final</th>
                <th style="width: 70px;">Classif.</th>
              </tr>
            </thead>
            <tbody>
              ${h.lanes.map((l: any) => `
                <tr>
                  <td class="lane-num">${l.laneNumber}</td>
                  <td><strong>${l.athleteName || "—"}</strong></td>
                  <td>${l.institutionName || "—"}</td>
                  <td>${l.seedTime || "--:--.--"}</td>
                  <td>___:___.___</td>
                  <td></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `).join("")}
      </div>
    `;
  }).join("");

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>SÚMULA GERAL DE BALIZAMENTO - ${tournament?.name || "Natação"}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 25px; color: #0f172a; line-height: 1.4; }
          .main-header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 25px; }
          .main-title { font-size: 20px; font-weight: bold; margin: 0; text-transform: uppercase; }
          .sub-title { font-size: 13px; color: #475569; margin-top: 4px; font-weight: 600; }
          .proof-section { page-break-after: always; margin-bottom: 35px; }
          .proof-section:last-child { page-break-after: auto; }
          .proof-header { background-color: #0f172a; color: white; padding: 8px 12px; font-size: 13px; font-weight: bold; border-radius: 6px; text-transform: uppercase; }
          .heat-title { background-color: #f1f5f9; color: #1e293b; padding: 6px 10px; font-size: 11px; font-weight: bold; border-left: 4px solid #3b82f6; margin-top: 15px; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; page-break-inside: avoid; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
          th { background-color: #f8fafc; font-weight: bold; text-transform: uppercase; font-size: 10px; color: #334155; }
          .lane-num { font-weight: bold; text-align: center; width: 45px; background-color: #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="main-header">
          <div class="main-title">${tournament?.name || "Torneio de Natação"}</div>
          <div class="sub-title">SÚMULA GERAL DE BALIZAMENTO E PROGRAMAÇÃO DE PROVAS</div>
        </div>

        ${proofsHtml}
      </body>
    </html>
  `;

  printWindow.document.write(fullHtml);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 300);
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
              <LayoutGrid size={16} /> {getDynamicTabLabel(categories, tournament)}
            </button>
            <button
              onClick={() => setActiveTab("classificacao")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === "classificacao" ? "bg-white text-indigo-700 shadow-sm" : "text-indigo-100 hover:text-white hover:bg-white/10"
              }`}
            >
              <TrendingUp size={16} /> Classificação
            </button>
            {hasTeamSports(categories, tournament) && (
              <button
                onClick={() => setActiveTab("estatisticas")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                  activeTab === "estatisticas" ? "bg-white text-indigo-700 shadow-sm" : "text-indigo-100 hover:text-white hover:bg-white/10"
                }`}
              >
                <Trophy size={16} /> Estatísticas gerais
              </button>
            )}
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
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{getDynamicTabLabel(categories, tournament)} do Torneio</h2>
                    <p className="text-slate-500 text-sm font-medium">Selecione a modalidade ou veja a programação completa.</p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors shrink-0">
                      <input
                        type="checkbox"
                        checked={onlyWithAthletes}
                        onChange={(e) => setOnlyWithAthletes(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Apenas com inscritos</span>
                    </label>

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

                {selectedTabCat === "all" ? (
                  <div className="space-y-8">
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

                      return (
                        <>
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
                              onClick={() => handlePrintAllSumulas(displayCats, athleteSubs, tournament)}
                              className="flex items-center gap-2 px-5 py-3 bg-white text-indigo-950 hover:bg-indigo-50 font-bold rounded-2xl text-xs shadow-lg transition-all shrink-0 cursor-pointer"
                            >
                              <Clock size={16} />
                              Imprimir Balizamento Completo 🖨️
                            </button>
                          </div>

                          <div className="space-y-8">
                            {displayCats.map((cat, idx) => {
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
                                        hideResults={true}
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
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
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
                                hideResults={true}
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

        {activeTab === "estatisticas" && hasTeamSports(categories, tournament) && (
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
