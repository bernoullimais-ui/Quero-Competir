import React, { useEffect, useState } from "react";
import { Award, Shield, CheckCircle2, TrendingUp, RefreshCw, Trophy, Waves, Timer, Medal, Printer } from "lucide-react";

interface Props {
  tournamentId: string;
}

interface TeamStanding {
  id: string;
  name: string;
  logoUrl: string;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  groupLabel: string;
}

export default function TournamentClassification({ tournamentId }: Props) {
  const [tournament, setTournament] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [athleteSubs, setAthleteSubs] = useState<any[]>([]);
  const [onlyWithResults, setOnlyWithResults] = useState<boolean>(true);
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [standings, setStandings] = useState<Record<string, TeamStanding[]>>({});
  const [loading, setLoading] = useState(true);

  // 1. Resolve Tournament & Fetch Categories & Athlete Subscriptions
  useEffect(() => {
    setLoading(true);
    fetch(`/api/tournaments/${tournamentId}`)
      .then((res) => res.json())
      .then(async (tData) => {
        if (!tData || tData.error) {
          setLoading(false);
          return;
        }
        setTournament(tData);
        const realId = tData.id || tournamentId;

        const [catsRes, subsRes] = await Promise.all([
          fetch(`/api/tournaments/${realId}/categories`).then((r) => r.json()),
          fetch(`/api/tournaments/${realId}/athlete-subscriptions`).then((r) => (r.ok ? r.json() : [])),
        ]);

        const catsList = Array.isArray(catsRes) ? catsRes : [];
        const subsList = Array.isArray(subsRes) ? subsRes : [];
        setCategories(catsList);
        setAthleteSubs(subsList);

        // Se for torneio de Natação, seleciona "all" (Quadro Geral/Todas as Provas) por padrão
        const isNat =
          tData.name?.toLowerCase().includes("natação") ||
          tData.name?.toLowerCase().includes("natacao") ||
          catsList.some(
            (c: any) =>
              c.rules_config?.sport_type === "swimming" ||
              c.name?.toLowerCase().includes("natação") ||
              c.name?.toLowerCase().includes("natacao")
          );

        if (isNat) {
          setSelectedCat("all");
        } else if (catsList.length > 0) {
          setSelectedCat(catsList[0].id);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching tournament data:", err);
        setLoading(false);
      });
  }, [tournamentId]);

  // Detector de Torneio/Prova de Natação
  const isSwimmingTournament =
    tournament?.name?.toLowerCase().includes("natação") ||
    tournament?.name?.toLowerCase().includes("natacao") ||
    categories.some(
      (c) =>
        c.rules_config?.sport_type === "swimming" ||
        c.name?.toLowerCase().includes("natação") ||
        c.name?.toLowerCase().includes("natacao")
    );

  const activeCategory = categories.find((c) => c.id === selectedCat);
  const rulesConfig = activeCategory?.rules_config || {};
  const categoryName = activeCategory?.name || "";

  const isCurrentCatSwimming =
    isSwimmingTournament ||
    rulesConfig?.sport_type === "swimming" ||
    categoryName.toLowerCase().includes("natação") ||
    categoryName.toLowerCase().includes("natacao");

  // 2. Fetch Team/Match data for non-swimming ball sports
  useEffect(() => {
    if (!selectedCat || selectedCat === "all" || isCurrentCatSwimming) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/tournaments/${tournamentId}/categories/${selectedCat}/teams`).then((r) => r.json()),
      fetch(`/api/tournaments/${tournamentId}/categories/${selectedCat}/matches`).then((r) => r.json()),
    ])
      .then(([teamsData, matchesData]) => {
        const dbTeams = Array.isArray(teamsData) ? teamsData : [];
        const dbMatches = Array.isArray(matchesData) ? matchesData : [];
        setTeams(dbTeams);
        setMatches(dbMatches);
        calculateStandings(dbTeams, dbMatches);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching team classification:", err);
        setLoading(false);
      });
  }, [tournamentId, selectedCat, isCurrentCatSwimming]);

  // Cálculo de classificação para esportes de equipe (Futsal, Basquete, Vôlei)
  const calculateStandings = (catTeams: any[], catMatches: any[]) => {
    const table: Record<string, TeamStanding> = {};
    const sportType = rulesConfig?.sport_type || "football";

    catTeams.forEach((t) => {
      const instName = t.institution?.name || "Time Sem Nome";
      const instLogo = t.institution?.logo_url || "";
      table[t.id] = {
        id: t.id,
        name: instName,
        logoUrl: instLogo,
        gamesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        groupLabel: "Geral",
      };
    });

    catMatches.forEach((m) => {
      if (m.status === "finished" && m.team1_id && m.team2_id) {
        const s1 = m.score1 ?? 0;
        const s2 = m.score2 ?? 0;
        const t1 = table[m.team1_id];
        const t2 = table[m.team2_id];
        if (!t1 || !t2) return;

        t1.gamesPlayed += 1;
        t2.gamesPlayed += 1;
        t1.goalsFor += s1;
        t1.goalsAgainst += s2;
        t2.goalsFor += s2;
        t2.goalsAgainst += s1;

        if (s1 > s2) {
          t1.wins += 1;
          t1.points += 3;
          t2.losses += 1;
        } else if (s2 > s1) {
          t2.wins += 1;
          t2.points += 3;
          t1.losses += 1;
        } else {
          t1.draws += 1;
          t1.points += 1;
          t2.draws += 1;
          t2.points += 1;
        }
        t1.goalDifference = t1.goalsFor - t1.goalsAgainst;
        t2.goalDifference = t2.goalsFor - t2.goalsAgainst;
      }
    });

    const groups: Record<string, TeamStanding[]> = { Geral: Object.values(table) };
    groups.Geral.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
    setStandings(groups);
  };

  // Helper para obter atletas ranqueados de uma prova de Natação
  const getCategoryRankedAthletes = (catId: string) => {
    return athleteSubs
      .filter(
        (s: any) =>
          (s.categoryId === catId || s.category_id === catId) &&
          (s.validationStatus === "approved" ||
            s.validation_status === "approved" ||
            s.isCompleted ||
            s.is_completed ||
            !s.validationStatus)
      )
      .map((s: any) => ({
        id: s.id,
        athleteName: s.athleteName || s.athlete_name,
        institutionName:
          s.institutionName ||
          s.institution_name ||
          s.institution?.name ||
          s.additionalData?.club_name ||
          s.additionalData?.institution_name ||
          "Avulso",
        seedTime: s.additionalData?.seed_time || s.additional_data?.seed_time || "--:--.--",
        resultTime: s.additionalData?.result_time || s.additional_data?.result_time || "",
      }))
      .sort((a, b) => {
        const hasTimeA = a.resultTime && a.resultTime.trim() !== "" && a.resultTime !== "--:--.--";
        const hasTimeB = b.resultTime && b.resultTime.trim() !== "" && b.resultTime !== "--:--.--";
        if (hasTimeA && hasTimeB) return a.resultTime.localeCompare(b.resultTime);
        if (hasTimeA) return -1;
        if (hasTimeB) return 1;
        return a.seedTime.localeCompare(b.seedTime);
      });
  };

  // Helper para calcular o Quadro Geral de Medalhas por Clube
  const getMedalStandings = () => {
    const clubMedals: Record<string, { name: string; gold: number; silver: number; bronze: number; total: number }> = {};

    categories.forEach((cat) => {
      const ranked = getCategoryRankedAthletes(cat.id).filter(
        (a) => a.resultTime && a.resultTime.trim() !== "" && a.resultTime !== "--:--.--"
      );

      if (ranked.length > 0 && ranked[0]) {
        const club = ranked[0].institutionName;
        if (!clubMedals[club]) clubMedals[club] = { name: club, gold: 0, silver: 0, bronze: 0, total: 0 };
        clubMedals[club].gold += 1;
        clubMedals[club].total += 1;
      }
      if (ranked.length > 1 && ranked[1]) {
        const club = ranked[1].institutionName;
        if (!clubMedals[club]) clubMedals[club] = { name: club, gold: 0, silver: 0, bronze: 0, total: 0 };
        clubMedals[club].silver += 1;
        clubMedals[club].total += 1;
      }
      if (ranked.length > 2 && ranked[2]) {
        const club = ranked[2].institutionName;
        if (!clubMedals[club]) clubMedals[club] = { name: club, gold: 0, silver: 0, bronze: 0, total: 0 };
        clubMedals[club].bronze += 1;
        clubMedals[club].total += 1;
      }
    });

    return Object.values(clubMedals).sort((a, b) => {
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      if (b.bronze !== a.bronze) return b.bronze - a.bronze;
      return b.total - a.total;
    });
  };

  // Filtrar categorias que tem inscritos ou resultados
  const filteredCategories = categories.filter((cat) => {
    if (!onlyWithResults) return true;
    const ranked = getCategoryRankedAthletes(cat.id);
    return ranked.some((a) => a.resultTime && a.resultTime.trim() !== "" && a.resultTime !== "--:--.--");
  });

  const displayCategories = filteredCategories.length > 0 ? filteredCategories : categories;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* ── HEADER DA CLASSIFICAÇÃO COM DROPDOWN DE FILTRO POR PROVA ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Trophy size={24} className="text-amber-500" />
            Classificação & Resultados Oficiais
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-0.5">
            {isSwimmingTournament
              ? "Acompanhe os resultados por prova e o quadro geral de medalhas da natação."
              : "Pontuação, saldo e aproveitamento ao vivo das equipes."}
          </p>
        </div>

        {/* Filtros em Lista Dropdown */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {isSwimmingTournament && (
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors shrink-0">
              <input
                type="checkbox"
                checked={onlyWithResults}
                onChange={(e) => setOnlyWithResults(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              <span>Apenas com resultados</span>
            </label>
          )}

          <div className="min-w-[280px]">
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-250 rounded-2xl font-bold text-sm text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors shadow-sm cursor-pointer"
            >
              {isSwimmingTournament && (
                <option value="all">🏆 Quadro Geral de Medalhas & Todas as Provas</option>
              )}
              {displayCategories.map((cat, idx) => {
                const rankedWithResults = getCategoryRankedAthletes(cat.id).filter(
                  (a) => a.resultTime && a.resultTime.trim() !== "" && a.resultTime !== "--:--.--"
                );
                return (
                  <option key={cat.id} value={cat.id}>
                    Prova {idx + 1}: {cat.name} ({cat.gender || ""} {cat.age_group || ""}) — {rankedWithResults.length} com resultado
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : isSwimmingTournament || isCurrentCatSwimming ? (
        /* ──────────────── NATAÇÃO: QUADRO DE MEDALHAS & RESULTADOS DA PROVA ──────────────── */
        <div className="space-y-8">
          {/* Se a opção selecionada for "TODAS AS PROVAS" (all): exibe Quadro de Medalhas + Todas as Provas */}
          {selectedCat === "all" ? (
            <>
              {/* Quadro Geral de Medalhas por Clube/Entidade */}
              {(() => {
                const medalTable = getMedalStandings();
                return (
                  <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-xl border border-indigo-900 space-y-4">
                    <div className="flex items-center justify-between border-b border-indigo-800/60 pb-4">
                      <div>
                        <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase tracking-widest mb-1">
                          <Medal size={16} /> Quadro Geral de Medalhas por Clube / Entidade
                        </div>
                        <h3 className="text-xl font-bold">Classificação Geral de Clubes</h3>
                      </div>
                      <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition cursor-pointer border border-white/20"
                      >
                        <Printer size={14} /> Imprimir 🖨️
                      </button>
                    </div>

                    {medalTable.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs font-medium">
                        Nenhum resultado final lançado ainda para compor o Quadro de Medalhas.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="text-indigo-300 border-b border-indigo-800/50 uppercase font-black tracking-wider text-[10px]">
                              <th className="py-2.5 px-4 text-center w-14">Pos</th>
                              <th className="py-2.5 px-4">Clube / Entidade</th>
                              <th className="py-2.5 px-4 text-center w-20 text-amber-400">🥇 Ouro</th>
                              <th className="py-2.5 px-4 text-center w-20 text-slate-300">🥈 Prata</th>
                              <th className="py-2.5 px-4 text-center w-20 text-amber-600">🥉 Bronze</th>
                              <th className="py-2.5 px-4 text-center w-20 font-black text-white">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-indigo-900/40">
                            {medalTable.map((club, idx) => (
                              <tr key={club.name} className={idx === 0 ? "bg-white/10 font-bold" : "text-slate-200"}>
                                <td className="py-3 px-4 text-center">
                                  {idx === 0 && <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-indigo-950 font-black text-xs">1º</span>}
                                  {idx === 1 && <span className="px-2 py-0.5 rounded-lg bg-slate-300 text-indigo-950 font-black text-xs">2º</span>}
                                  {idx === 2 && <span className="px-2 py-0.5 rounded-lg bg-amber-700 text-white font-black text-xs">3º</span>}
                                  {idx > 2 && <span className="text-slate-400 font-bold">{idx + 1}º</span>}
                                </td>
                                <td className="py-3 px-4 font-bold text-sm text-white">{club.name}</td>
                                <td className="py-3 px-4 text-center font-mono font-black text-amber-400 text-sm">{club.gold}</td>
                                <td className="py-3 px-4 text-center font-mono font-black text-slate-300 text-sm">{club.silver}</td>
                                <td className="py-3 px-4 text-center font-mono font-black text-amber-500 text-sm">{club.bronze}</td>
                                <td className="py-3 px-4 text-center font-mono font-black text-white text-base">{club.total}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Resultados Sequenciais de Todas as Provas */}
              <div className="space-y-6">
                <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <Waves size={20} className="text-indigo-600" />
                  Resultados Oficiais por Prova
                </h3>

                {displayCategories.map((cat, idx) => {
                  const rankedAthletes = getCategoryRankedAthletes(cat.id);
                  const withResults = rankedAthletes.filter(
                    (a) => a.resultTime && a.resultTime.trim() !== "" && a.resultTime !== "--:--.--"
                  );

                  return (
                    <div key={cat.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden space-y-0">
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
                        <span className="text-xs font-bold px-3 py-1 bg-slate-200/70 text-slate-700 rounded-xl">
                          {withResults.length} / {rankedAthletes.length} atletas com tempo
                        </span>
                      </div>

                      <div className="p-5 overflow-x-auto">
                        {rankedAthletes.length === 0 ? (
                          <div className="text-center py-6 text-slate-400 text-xs">Nenhum participante inscrito nesta prova.</div>
                        ) : (
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                                <th className="py-2.5 px-4 w-16 text-center">Classif.</th>
                                <th className="py-2.5 px-4">Atleta</th>
                                <th className="py-2.5 px-4">Clube / Entidade</th>
                                <th className="py-2.5 px-4 w-32 text-center">Tempo Inscrição</th>
                                <th className="py-2.5 px-4 w-36 text-center">Tempo Final (Obtido)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {rankedAthletes.map((ath, rankIdx) => {
                                const hasResult = ath.resultTime && ath.resultTime.trim() !== "" && ath.resultTime !== "--:--.--";

                                return (
                                  <tr key={ath.id} className={rankIdx < 3 && hasResult ? "bg-amber-50/30 font-bold" : "hover:bg-slate-50/40"}>
                                    <td className="py-3 px-4 text-center">
                                      {hasResult ? (
                                        rankIdx === 0 ? (
                                          <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-indigo-950 font-black text-xs shadow-xs">1º 🥇</span>
                                        ) : rankIdx === 1 ? (
                                          <span className="px-2.5 py-1 rounded-lg bg-slate-300 text-indigo-950 font-black text-xs shadow-xs">2º 🥈</span>
                                        ) : rankIdx === 2 ? (
                                          <span className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-black text-xs shadow-xs">3º 🥉</span>
                                        ) : (
                                          <span className="font-bold text-slate-500">{rankIdx + 1}º</span>
                                        )
                                      ) : (
                                        <span className="text-slate-300 font-normal">—</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 font-bold text-slate-800 text-sm">{ath.athleteName}</td>
                                    <td className="py-3 px-4 text-slate-600 font-medium">{ath.institutionName}</td>
                                    <td className="py-3 px-4 text-center font-mono text-slate-500">{ath.seedTime}</td>
                                    <td className="py-3 px-4 text-center font-mono font-black text-indigo-900 text-sm">
                                      {hasResult ? ath.resultTime : <span className="text-slate-300 font-normal">—</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* ── SE UMA PROVA ESPECÍFICA FOI SELECIONADA NO DROPDOWN ── */
            (() => {
              const cat = categories.find((c) => c.id === selectedCat);
              if (!cat) return null;
              const rankedAthletes = getCategoryRankedAthletes(cat.id);

              return (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black text-slate-800">{cat.name}</h3>
                      <p className="text-sm text-slate-500 font-medium mt-0.5">{cat.gender} • {cat.age_group}</p>
                    </div>
                    <span className="text-xs font-bold px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
                      {rankedAthletes.filter((a) => a.resultTime).length} com tempo obtido
                    </span>
                  </div>

                  <div className="p-6 overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4 w-16 text-center">Classif.</th>
                          <th className="py-3 px-4">Atleta</th>
                          <th className="py-3 px-4">Clube / Entidade</th>
                          <th className="py-3 px-4 w-32 text-center">Tempo Inscrição</th>
                          <th className="py-3 px-4 w-36 text-center">Tempo Final (Obtido)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rankedAthletes.map((ath, rankIdx) => {
                          const hasResult = ath.resultTime && ath.resultTime.trim() !== "" && ath.resultTime !== "--:--.--";

                          return (
                            <tr key={ath.id} className={rankIdx < 3 && hasResult ? "bg-amber-50/30 font-bold" : "hover:bg-slate-50/40"}>
                              <td className="py-3 px-4 text-center">
                                {hasResult ? (
                                  rankIdx === 0 ? (
                                    <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-indigo-950 font-black text-xs shadow-xs">1º 🥇</span>
                                  ) : rankIdx === 1 ? (
                                    <span className="px-2.5 py-1 rounded-lg bg-slate-300 text-indigo-950 font-black text-xs shadow-xs">2º 🥈</span>
                                  ) : rankIdx === 2 ? (
                                    <span className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-black text-xs shadow-xs">3º 🥉</span>
                                  ) : (
                                    <span className="font-bold text-slate-500">{rankIdx + 1}º</span>
                                  )
                                ) : (
                                  <span className="text-slate-300 font-normal">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-800 text-sm">{ath.athleteName}</td>
                              <td className="py-3 px-4 text-slate-600 font-medium">{ath.institutionName}</td>
                              <td className="py-3 px-4 text-center font-mono text-slate-500">{ath.seedTime}</td>
                              <td className="py-3 px-4 text-center font-mono font-black text-indigo-900 text-sm">
                                {hasResult ? ath.resultTime : <span className="text-slate-300 font-normal">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      ) : (
        /* ──────────────── MODALIDADES COLETIVAS (Futsal, Basquete, Vôlei) ──────────────── */
        Object.keys(standings).length === 0 ? (
          <div className="text-center py-16 bg-white border border-slate-200 rounded-3xl text-slate-400">
            Nenhuma equipe inscrita nesta categoria para gerar a tabela de classificação.
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(standings)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([groupName, teamsList]) => (
                <div key={groupName} className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                      <TrendingUp size={18} className="text-indigo-500" />
                      {groupName}
                    </h3>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tabela Geral</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/30 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="px-6 py-4 text-center w-14">Pos</th>
                          <th className="px-6 py-4 min-w-[200px]">Equipe</th>
                          <th className="px-4 py-4 text-center font-extrabold text-slate-800">P</th>
                          <th className="px-4 py-4 text-center">J</th>
                          <th className="px-4 py-4 text-center">V</th>
                          <th className="px-4 py-4 text-center">E</th>
                          <th className="px-4 py-4 text-center">D</th>
                          <th className="px-4 py-4 text-center">GP</th>
                          <th className="px-4 py-4 text-center">GC</th>
                          <th className="px-4 py-4 text-center">SG</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                        {(teamsList as TeamStanding[]).map((team, idx) => (
                          <tr key={team.id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="px-6 py-4 text-center font-black">{idx + 1}</td>
                            <td className="px-6 py-4 font-bold text-slate-800">{team.name}</td>
                            <td className="px-4 py-4 text-center font-black text-slate-900 bg-slate-50/50">{team.points}</td>
                            <td className="px-4 py-4 text-center text-slate-600">{team.gamesPlayed}</td>
                            <td className="px-4 py-4 text-center text-slate-600">{team.wins}</td>
                            <td className="px-4 py-4 text-center text-slate-600">{team.draws}</td>
                            <td className="px-4 py-4 text-center text-slate-600">{team.losses}</td>
                            <td className="px-4 py-4 text-center text-slate-500">{team.goalsFor}</td>
                            <td className="px-4 py-4 text-center text-slate-500">{team.goalsAgainst}</td>
                            <td className="px-4 py-4 text-center font-semibold">{team.goalDifference}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </div>
        )
      )}
    </div>
  );
}
