import React, { useEffect, useState } from "react";
import { Award, Shield, Library, CheckCircle2, TrendingUp, RefreshCw } from "lucide-react";

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
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>("");
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [standings, setStandings] = useState<Record<string, TeamStanding[]>>({});
  const [loading, setLoading] = useState(false);

  const activeCategory = categories.find(c => c.id === selectedCat);
  const rulesConfig = activeCategory?.rules_config || {};
  const categoryName = activeCategory?.name || "";

  const getSportType = (name: string, rules: any) => {
    if (rules?.sport_type) return rules.sport_type;
    const lowerName = (name || "").toLowerCase();
    if (lowerName.includes("basquete") || lowerName.includes("basketball")) return "basketball";
    if (lowerName.includes("volei") || lowerName.includes("vôlei") || lowerName.includes("volleyball")) return "volleyball";
    if (lowerName.includes("handebol") || lowerName.includes("handball")) return "handball";
    if (lowerName.includes("baleado") || lowerName.includes("queimada") || lowerName.includes("dodgeball")) return "dodgeball";
    return "football";
  };

  const sportType = getSportType(categoryName, rulesConfig);

  useEffect(() => {
    fetch(`/api/tournaments/${tournamentId}/categories`)
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setCategories(list);
        if (list.length > 0) {
          setSelectedCat(list[0].id);
        }
      })
      .catch(err => console.error("Error fetching categories:", err));
  }, [tournamentId]);

  const fetchData = () => {
    if (!selectedCat) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/tournaments/${tournamentId}/categories/${selectedCat}/teams`).then(r => r.json()),
      fetch(`/api/tournaments/${tournamentId}/categories/${selectedCat}/matches`).then(r => r.json())
    ]).then(([teamsData, matchesData]) => {
      const dbTeams = Array.isArray(teamsData) ? teamsData : [];
      const dbMatches = Array.isArray(matchesData) ? matchesData : [];
      
      setTeams(dbTeams);
      setMatches(dbMatches);
      calculateStandings(dbTeams, dbMatches);
      setLoading(false);
    }).catch(err => {
      console.error("Error fetching classification data:", err);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
  }, [tournamentId, selectedCat]);

  const calculateStandings = (catTeams: any[], catMatches: any[]) => {
    const table: Record<string, TeamStanding> = {};

    // 1. Inicializar todas as equipes da categoria com estatísticas zeradas
    catTeams.forEach(t => {
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
        groupLabel: "Geral" // fallback
      };
    });

    const getGroupLabelForTeam = (label: string | null | undefined, isTeam1: boolean) => {
      if (!label) return "Classificação Geral";
      let name = label.trim();
      const delimiterRegex = /\s+[xX]\s+/;
      if (delimiterRegex.test(name)) {
        const parts = name.split(delimiterRegex);
        name = isTeam1 ? parts[0].trim() : parts[1].trim();
      }
      return name.toLowerCase().startsWith("grupo") ? name : `Grupo ${name.toUpperCase()}`;
    };

    // Encontrar grupos a partir de chaves de partidas ou designação prévia
    catMatches.forEach(m => {
      if (m.team1_id && table[m.team1_id] && m.group_label) {
        table[m.team1_id].groupLabel = getGroupLabelForTeam(m.group_label, true);
      }
      if (m.team2_id && table[m.team2_id] && m.group_label) {
        table[m.team2_id].groupLabel = getGroupLabelForTeam(m.group_label, false);
      }

      // 2. Processar apenas partidas finalizadas
      if (m.status === "finished" && m.team1_id && m.team2_id) {
        const s1 = m.score1 ?? 0;
        const s2 = m.score2 ?? 0;

        // Garantir que os times existem no dicionário
        if (!table[m.team1_id]) {
          table[m.team1_id] = {
            id: m.team1_id,
            name: m.team1?.institution?.name || "Time A",
            logoUrl: m.team1?.institution?.logo_url || "",
            gamesPlayed: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0,
            groupLabel: getGroupLabelForTeam(m.group_label, true)
          };
        }
        if (!table[m.team2_id]) {
          table[m.team2_id] = {
            id: m.team2_id,
            name: m.team2?.institution?.name || "Time B",
            logoUrl: m.team2?.institution?.logo_url || "",
            gamesPlayed: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0,
            groupLabel: getGroupLabelForTeam(m.group_label, false)
          };
        }

        const t1 = table[m.team1_id];
        const t2 = table[m.team2_id];

        t1.gamesPlayed += 1;
        t2.gamesPlayed += 1;

        if (sportType === 'dodgeball') {
          // Lógica do Baleado
          const sets = m.sets_detail || [];
          const isT1Winner = m.winner_id ? m.winner_id === m.team1_id : (s1 > s2);
          
          let t1Pts = 0;
          let t2Pts = 0;
          
          if (isT1Winner) {
            t1.wins += 1;
            t2.losses += 1;
            
            let pts = 3;
            if (sets.length > 0) {
              const t1WonSets = sets.filter((s: any) => s.team1 > s.team2);
              const hasTimeLimit = t1WonSets.some((s: any) => s.win_type === 'time_limit');
              pts = hasTimeLimit ? 2 : 3;
            }
            t1Pts = pts;
            t2Pts = 0;
          } else {
            t2.wins += 1;
            t1.losses += 1;
            
            let pts = 3;
            if (sets.length > 0) {
              const t2WonSets = sets.filter((s: any) => s.team2 > s.team1);
              const hasTimeLimit = t2WonSets.some((s: any) => s.win_type === 'time_limit');
              pts = hasTimeLimit ? 2 : 3;
            }
            t2Pts = pts;
            t1Pts = 0;
          }
          
          t1.points += t1Pts;
          t2.points += t2Pts;

          // Somar baleados de sets_detail se houver
          if (sets.length > 0) {
            sets.forEach((s: any) => {
              t1.goalsFor += (s.team1 || 0);
              t1.goalsAgainst += (s.team2 || 0);
              t2.goalsFor += (s.team2 || 0);
              t2.goalsAgainst += (s.team1 || 0);
            });
          } else {
            // Fallback: usar sets vencidos como placar
            t1.goalsFor += s1;
            t1.goalsAgainst += s2;
            t2.goalsFor += s2;
            t2.goalsAgainst += s1;
          }
        } 
        else if (sportType === 'volleyball') {
          // Vôlei
          t1.goalsFor += s1;
          t1.goalsAgainst += s2;
          t2.goalsFor += s2;
          t2.goalsAgainst += s1;

          if (s1 > s2) {
            t1.wins += 1;
            t2.losses += 1;
            const isTiebreak = (s1 === 3 && s2 === 2) || (s1 === 2 && s2 === 1);
            if (isTiebreak) {
              t1.points += 2;
              t2.points += 1;
            } else {
              t1.points += 3;
              t2.points += 0;
            }
          } else if (s2 > s1) {
            t2.wins += 1;
            t1.losses += 1;
            const isTiebreak = (s2 === 3 && s1 === 2) || (s2 === 2 && s1 === 1);
            if (isTiebreak) {
              t2.points += 2;
              t1.points += 1;
            } else {
              t2.points += 3;
              t1.points += 0;
            }
          }
        } 
        else if (sportType === 'basketball') {
          // Basquete
          t1.goalsFor += s1;
          t1.goalsAgainst += s2;
          t2.goalsFor += s2;
          t2.goalsAgainst += s1;

          if (s1 > s2) {
            t1.wins += 1;
            t1.points += 2;
            t2.losses += 1;
            t2.points += 1;
          } else if (s2 > s1) {
            t2.wins += 1;
            t2.points += 2;
            t1.losses += 1;
            t1.points += 1;
          }
        } 
        else {
          // Futebol/Futsal/Handebol/Geral
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
        }

        t1.goalDifference = t1.goalsFor - t1.goalsAgainst;
        t2.goalDifference = t2.goalsFor - t2.goalsAgainst;
      }
    });

    // 3. Agrupar equipes pelos seus grupos correspondentes
    const groups: Record<string, TeamStanding[]> = {};
    Object.values(table).forEach(team => {
      const grp = team.groupLabel || "Classificação Geral";
      if (!groups[grp]) {
        groups[grp] = [];
      }
      groups[grp].push(team);
    });

    // 4. Ordenar equipes dentro de cada grupo
    Object.keys(groups).forEach(grp => {
      groups[grp].sort((a, b) => {
        if (sportType === 'volleyball') {
          // Vôlei prioriza: Vitórias -> Pontos -> Saldo de Sets -> Sets Pró
          if (b.wins !== a.wins) return b.wins - a.wins;
          if (b.points !== a.points) return b.points - a.points;
          if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
          return b.goalsFor - a.goalsFor;
        }
        // Geral
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return b.wins - a.wins;
      });
    });

    setStandings(groups);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Tabela de Classificação</h2>
          <p className="text-slate-500 font-medium">Pontuação, saldo e aproveitamento ao vivo</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                selectedCat === cat.id 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              {cat.name} {cat.gender || cat.age_group ? `(${[cat.gender, cat.age_group].filter(Boolean).join(" ")})` : ""}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : Object.keys(standings).length === 0 ? (
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
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fase de Grupos / Tabela única</span>
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
                        {sportType !== 'volleyball' && sportType !== 'basketball' && sportType !== 'dodgeball' && (
                          <th className="px-4 py-4 text-center">E</th>
                        )}
                        <th className="px-4 py-4 text-center">D</th>
                        <th className="px-4 py-4 text-center">
                          {sportType === 'volleyball' ? 'SP' : sportType === 'basketball' ? 'PP' : sportType === 'dodgeball' ? 'BP' : 'GP'}
                        </th>
                        <th className="px-4 py-4 text-center">
                          {sportType === 'volleyball' ? 'SC' : sportType === 'basketball' ? 'PC' : sportType === 'dodgeball' ? 'BC' : 'GC'}
                        </th>
                        <th className="px-4 py-4 text-center">
                          {sportType === 'volleyball' ? 'SD' : sportType === 'basketball' ? 'SP' : sportType === 'dodgeball' ? 'SR' : 'SG'}
                        </th>
                        <th className="px-6 py-4 text-center">% AP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                      {(teamsList as TeamStanding[]).map((team, idx) => {
                        const maxPossiblePoints = sportType === 'basketball' ? 2 : 3;
                        const winRate = team.gamesPlayed > 0 
                          ? Math.round((team.points / (team.gamesPlayed * maxPossiblePoints)) * 100)
                          : 0;
                        const isQualifyingZone = idx < 2; // Zone of promotion

                        return (
                          <tr key={team.id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex w-7 h-7 rounded-lg items-center justify-center font-sans font-black text-xs ${
                                isQualifyingZone 
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-100" 
                                  : "text-slate-500"
                              }`}>
                                {idx + 1}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/60 overflow-hidden flex items-center justify-center shrink-0">
                                  {team.logoUrl ? (
                                    <img src={team.logoUrl} alt={team.name} className="w-full h-full object-contain p-0.5" onError={(e: any) => e.target.style.display = 'none'} />
                                  ) : (
                                    <Shield size={16} className="text-slate-400" />
                                  )}
                                </div>
                                <span className="font-extrabold text-slate-800 tracking-tight text-sm truncate max-w-[200px]" title={team.name}>
                                  {team.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center font-black text-slate-900 border-x border-slate-50/10 bg-slate-50/20">{team.points}</td>
                            <td className="px-4 py-4 text-center font-medium text-slate-600">{team.gamesPlayed}</td>
                            <td className="px-4 py-4 text-center text-slate-600">{team.wins}</td>
                            {sportType !== 'volleyball' && sportType !== 'basketball' && sportType !== 'dodgeball' && (
                              <td className="px-4 py-4 text-center text-slate-600">{team.draws}</td>
                            )}
                            <td className="px-4 py-4 text-center text-slate-600">{team.losses}</td>
                            <td className="px-4 py-4 text-center text-slate-500">{team.goalsFor}</td>
                            <td className="px-4 py-4 text-center text-slate-500">{team.goalsAgainst}</td>
                            <td className={`px-4 py-4 text-center font-semibold ${
                              team.goalDifference > 0 ? "text-emerald-600" :
                              team.goalDifference < 0 ? "text-rose-600" :
                              "text-slate-500"
                            }`}>
                              {team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}
                            </td>
                            <td className="px-6 py-4 text-center font-sans text-xs text-slate-500 font-bold">
                              {winRate}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
